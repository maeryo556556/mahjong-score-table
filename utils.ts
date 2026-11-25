// 順位を計算する
export const calcRanks = (
  players: string[],
  scoresMap: Map<string, number>
): Map<string, number> => {
  const sorted = players
    .map(p => ({ player: p, point: scoresMap.get(p) ?? 0 }))
    .sort((a, b) => b.point - a.point);
  const ranks = new Map<string, number>();
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].point < sorted[i - 1].point) {
      currentRank = i + 1;
    }
    ranks.set(sorted[i].player, currentRank);
  }
  return ranks;
};

// スコアバリデーション: 全員0ならエラー
export const isAllZero = (values: number[]): boolean => {
  return values.every(v => v === 0);
};

// スコアバリデーション: 合計が0でないならエラー
export const calcTotal = (values: number[]): number => {
  return values.reduce((sum, v) => sum + v, 0);
};

// ドラムロール値のクランプ
export const clampValue = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

// 共有データバリデーション
export interface ShareGameDataV1 {
  v: 1;
  pc: number;
  d: string;
  p: string[];
  s: Array<[number, string, number, number, number, string]>;
  c: Array<[number, string, number, number, string]>;
}

export interface ShareGameDataV2 {
  v: 2;
  pc: number;
  d: string;
  p: string[];
  s: Array<[number, number, number] | [number, number, number, number, string]>;
  c?: Array<[number, number, number] | [number, number, number, number, string]>;
}

export type ShareGameData = ShareGameDataV1 | ShareGameDataV2;

export const validateShareData = (data: unknown): data is ShareGameData => {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    (d.v === 1 || d.v === 2) &&
    typeof d.pc === 'number' &&
    typeof d.d === 'string' &&
    Array.isArray(d.p) &&
    d.p.every((p: unknown) => typeof p === 'string')
  );
};

// ディープリンクのスキーム（セッション参加リンク mahjong-score://live?code=… で使用）
export const DEEP_LINK_SCHEME = 'mahjong-score';

// 日付フォーマット（YYYY/MM/DD）
export const formatDate = (date: Date): string => {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};

// 表示用時刻フォーマット（M月D日HH:mm）
export const formatTime = (date: Date): string => {
  return `${date.getMonth() + 1}月${date.getDate()}日${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 共有データから復元した記録行（SQLite の scores / chips 行と同じ形）
// 新規ゲームのプレイヤー名入力欄の初期値を作る。
// 直近のゲームのプレイヤー名を先頭から詰め、足りない枠は空文字にする（常に4枠）。
export const MAX_PLAYERS = 4;
export const buildDefaultPlayerNames = (lastNames: readonly string[] | null | undefined): string[] => {
  const names = new Array<string>(MAX_PLAYERS).fill('');
  (lastNames ?? []).slice(0, MAX_PLAYERS).forEach((name, i) => {
    names[i] = typeof name === 'string' ? name : '';
  });
  return names;
};

export interface ScoreRow {
  hanchan: number;
  player_name: string;
  point: number;
  rank: number;
  timestamp: number;
  formatted_time: string;
}

export interface ChipRow {
  id: number;
  hanchan: number;
  player_name: string;
  chip_point: number;
  timestamp: number;
  formatted_time: string;
}

export interface GameRecords {
  playerCount: number;
  startDate: string;
  players: string[];
  scores: ScoreRow[];
  chips: ChipRow[];
}

/**
 * 共有データ（v1/v2）を記録行に展開する。
 * 取り込み（importGameData）とライブ閲覧の両方で使う。
 * スコア・チップは記録日時の新しい順に並べる。
 * @param now タイムスタンプを持たない旧データのフォールバック時刻
 */
export const shareDataToRecords = (data: ShareGameData, now: number = Date.now()): GameRecords => {
  const scores: ScoreRow[] = [];
  const chips: ChipRow[] = [];
  const dateParts = data.d.split('/');
  const fallbackFormattedTime = `${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`;

  if (data.v === 1) {
    (data.s || []).forEach(([hanchan, playerName, point, rank, timestamp, ft]) => {
      scores.push({ hanchan, player_name: playerName, point, rank, timestamp, formatted_time: ft });
    });
    (data.c || []).forEach(([hanchan, playerName, chipPoint, timestamp, ft], i) => {
      chips.push({ id: i + 1, hanchan, player_name: playerName, chip_point: chipPoint, timestamp, formatted_time: ft });
    });
  } else {
    // v2: プレイヤーインデックスから名前復元、半荘ごとに順位再計算
    const byHanchan = new Map<number, Array<{ playerName: string; point: number; ts: number; ft: string }>>();
    (data.s || []).forEach((entry) => {
      const hanchan = entry[0];
      const playerName = data.p[entry[1]];
      const point = entry[2];
      const hasTs = entry.length >= 5;
      const ts = hasTs ? (entry as [number, number, number, number, string])[3] : now;
      const ft = hasTs ? (entry as [number, number, number, number, string])[4] : fallbackFormattedTime;
      if (!byHanchan.has(hanchan)) byHanchan.set(hanchan, []);
      byHanchan.get(hanchan)!.push({ playerName, point, ts, ft });
    });
    byHanchan.forEach((entries, hanchan) => {
      const ranks = calcRanks(data.p, new Map(entries.map(e => [e.playerName, e.point])));
      entries.forEach(({ playerName, point, ts, ft }) => {
        scores.push({ hanchan, player_name: playerName, point, rank: ranks.get(playerName)!, timestamp: ts, formatted_time: ft });
      });
    });

    // チップは半荘ごとにグループ化（HistoryTable がタイムスタンプでグループ化するため）
    const chipsByHanchan = new Map<number, Array<{ pIdx: number; chipPoint: number; ts: number; ft: string }>>();
    (data.c || []).forEach((entry) => {
      const hanchan = entry[0];
      const hasTs = entry.length >= 5;
      const ts = hasTs ? (entry as [number, number, number, number, string])[3] : 0;
      const ft = hasTs ? (entry as [number, number, number, number, string])[4] : fallbackFormattedTime;
      if (!chipsByHanchan.has(hanchan)) chipsByHanchan.set(hanchan, []);
      chipsByHanchan.get(hanchan)!.push({ pIdx: entry[1], chipPoint: entry[2], ts, ft });
    });
    let chipId = 1;
    [...chipsByHanchan.keys()].sort((a, b) => a - b).forEach((hanchan, idx) => {
      // タイムスタンプがない旧データの場合、半荘ごとに異なるタイムスタンプを割り当て
      const fallbackTs = now + idx + 1;
      chipsByHanchan.get(hanchan)!.forEach(({ pIdx, chipPoint, ts, ft }) => {
        chips.push({
          id: chipId++,
          hanchan,
          player_name: data.p[pIdx],
          chip_point: chipPoint,
          timestamp: ts || fallbackTs,
          formatted_time: ft,
        });
      });
    });
  }

  scores.sort((a, b) => b.timestamp - a.timestamp);
  chips.sort((a, b) => b.timestamp - a.timestamp);

  return { playerCount: data.pc, startDate: data.d, players: data.p, scores, chips };
};

// ---------- プレイヤー名の変更（Issue #58） ----------

export const MAX_PLAYER_NAME_LENGTH = 6; // Issue #60: 4文字→6文字

/**
 * ゲーム途中のプレイヤー名変更の入力を検証する。問題なければ null、あればエラーメッセージを返す。
 * 記録はプレイヤー名で紐づけているため、空欄・上限文字数超・重複は不可とする。
 */
export const validatePlayerNamesChange = (
  currentNames: readonly string[],
  newNames: readonly string[]
): string | null => {
  if (newNames.length !== currentNames.length) {
    return 'プレイヤー数が一致しません';
  }
  const trimmed = newNames.map(n => n.trim());
  if (trimmed.some(n => !n)) {
    return 'すべてのプレイヤーの名前を入力してください';
  }
  if (trimmed.some(n => n.length > MAX_PLAYER_NAME_LENGTH)) {
    return `プレイヤー名は${MAX_PLAYER_NAME_LENGTH}文字以内で入力してください`;
  }
  if (new Set(trimmed).size !== trimmed.length) {
    return '同じ名前のプレイヤーがいます。別の名前にしてください';
  }
  return null;
};

/** 変更前後で名前が1つでも変わっているか */
export const hasPlayerNamesChanged = (currentNames: readonly string[], newNames: readonly string[]): boolean =>
  currentNames.length !== newNames.length || currentNames.some((name, i) => name !== newNames[i].trim());

// ---------- 過去のゲームの保存上限とお気に入り（Issue #60） ----------

// Issue #60 本文の「50件」は、Issue コメントの確定値（お気に入りを含めて合計100件・お気に入りは最大20件）に読み替えている

/** 終了済みゲームの保存上限（お気に入りを含む合計）。超えたら古い通常データ（お気に入り以外）から自動で削除する */
export const MAX_SAVED_GAMES = 100;

/**
 * お気に入りの上限。上限に達している状態では新たに登録できない（メッセージを表示し、自動解除はしない）。
 * お気に入りは最大20件なので、保存枠（100件）がお気に入りだけで埋まることはない。
 */
export const MAX_FAVORITE_GAMES = 20;

export interface PrunableGame {
  id: number;
  created_at: number;
  favorite: number | boolean;
}

/**
 * 保存上限を超えたために削除すべき終了済みゲームのIDを返す。
 * - 上限はお気に入りを含めた合計件数に対して適用する
 * - 削除するのは通常データ（お気に入り以外）のみで、古いもの（created_at の昇順、同時刻は id の昇順）から削除する
 * - お気に入りと protectIds に含まれるゲーム（保存したばかりのゲームなど）は削除しない
 * 削除できる通常データが足りない場合は、削除できる分だけを返す
 * （お気に入りは最大20件のため、通常の上限100件ではこの状況は起こらない）。
 */
export const selectGamesToPrune = (
  games: readonly PrunableGame[],
  limit: number = MAX_SAVED_GAMES,
  protectIds: readonly number[] = []
): number[] => {
  const overflow = games.length - Math.max(0, limit);
  if (overflow <= 0) return [];
  const protect = new Set(protectIds);
  return games
    .filter(g => !g.favorite && !protect.has(g.id))
    .slice()
    .sort((a, b) => (a.created_at - b.created_at) || (a.id - b.id))
    .slice(0, overflow)
    .map(g => g.id);
};

/**
 * お気に入りに登録できるか。上限（20件）に達している場合は登録できない（自動解除はしない）。
 * 既にお気に入りのゲームは件数が増えないため常に true。
 */
export const canAddFavorite = (
  favoriteIds: readonly number[],
  gameId: number,
  limit: number = MAX_FAVORITE_GAMES
): boolean => favoriteIds.includes(gameId) || favoriteIds.length < limit;

// ---- 過去のゲームの複数選択・まとめて削除（Issue #74） ----

export interface SelectableGame {
  id: number;
  favorite?: number;
}

/** 選択の切り替え（選択済みなら外し、未選択なら加える）。元の配列は変更しない */
export const toggleSelection = (selected: readonly number[], id: number): number[] =>
  selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];

/**
 * そのゲームを選択できるか。お気に入り（favorite = 1）のゲームは誤って消さないよう選択させない（Issue #78）。
 * ホストとして共有中（進行中）のゲームも一覧から削除させないため選択させない。
 */
export const isGameSelectable = (
  game: SelectableGame,
  excludeIds: ReadonlySet<number> = new Set(),
): boolean => game.favorite !== 1 && !excludeIds.has(game.id);

/**
 * 選択できるゲームの ID（お気に入りと、excludeIds に含まれるホスト共有中のゲームを除く）。
 */
export const selectableGameIds = (
  games: readonly SelectableGame[],
  excludeIds: ReadonlySet<number> = new Set(),
): number[] => games.filter(g => isGameSelectable(g, excludeIds)).map(g => g.id);

/** 選択できるゲームがすべて選択されているか（選択できるゲームが無いときは false） */
export const isAllSelected = (selected: readonly number[], selectableIds: readonly number[]): boolean =>
  selectableIds.length > 0 && selectableIds.every(id => selected.includes(id));

/**
 * 「すべて選択」と「選択解除」の切り替え。すべて選択済みなら空に、そうでなければ選択できるゲームすべてにする。
 */
export const toggleSelectAll = (selected: readonly number[], selectableIds: readonly number[]): number[] =>
  isAllSelected(selected, selectableIds) ? [] : [...selectableIds];

/**
 * 一覧の更新後に、もう存在しない（または選択できなくなった）ゲームを選択から外す。
 */
export const pruneSelection = (selected: readonly number[], selectableIds: readonly number[]): number[] => {
  const ids = new Set(selectableIds);
  return selected.filter(id => ids.has(id));
};

/** まとめて削除の確認ダイアログの本文 */
export const buildBulkDeleteMessage = (count: number): string =>
  `選択した${count}件のゲームを削除しますか？\nこの操作は取り消せません。`;

// ---- 過去のゲーム一覧の最終スコア（Issue #78） ----

export interface PlayerFinalScore {
  playerName: string;
  total: number;
}

/**
 * プレイヤーごとの最終スコア（スコア合計 + チップ合計）。ゲーム画面の総合スコア（SummaryCards）と同じ計算。
 * playerNames の並び順で返し、記録の無いプレイヤーは 0 とする。
 */
export const calcFinalScores = (
  playerNames: readonly string[],
  scores: readonly { player_name: string; point: number }[],
  chips: readonly { player_name: string; chip_point: number }[],
): PlayerFinalScore[] =>
  playerNames.map(playerName => {
    const scoreTotal = scores.filter(s => s.player_name === playerName).reduce((sum, s) => sum + s.point, 0);
    const chipTotal = chips.filter(c => c.player_name === playerName).reduce((sum, c) => sum + c.chip_point, 0);
    return { playerName, total: scoreTotal + chipTotal };
  });

/** スコアの符号付き表示（プラスは「+」を付ける。総合スコアの表示と同じ） */
export const formatSignedScore = (value: number): string => `${value > 0 ? '+' : ''}${value}`;
