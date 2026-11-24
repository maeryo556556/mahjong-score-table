import { deflate, inflate } from 'pako';

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

// 共有コードエンコード（JSON → deflate圧縮 → Base64）
export const encodeShareCode = (json: string): string => {
  const utf8Bytes = new TextEncoder().encode(json);
  const compressed = deflate(utf8Bytes);
  // Uint8Array → binary string → base64
  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary);
};

// 共有コードデコード（Base64 → inflate解凍 → JSON）
// 旧形式（非圧縮）にも後方互換
export const decodeShareCode = (code: string): string => {
  const binary = atob(code);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // 圧縮データの場合は inflate、旧形式なら従来のデコード
  try {
    const decompressed = inflate(bytes);
    return new TextDecoder().decode(decompressed);
  } catch {
    // 旧形式（非圧縮 base64）のフォールバック
    return decodeURIComponent(
      binary
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  }
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

// ディープリンク定数
export const DEEP_LINK_SCHEME = 'mahjong-score';
export const DEEP_LINK_HOST = 'import';

// 共有コードからディープリンクURLを生成
export const buildShareUrl = (shareCode: string): string => {
  return `${DEEP_LINK_SCHEME}://${DEEP_LINK_HOST}?code=${encodeURIComponent(shareCode)}`;
};

// ディープリンクURLから共有コードを抽出（null = 該当なし）
export const parseShareUrl = (url: string): string | null => {
  try {
    // mahjong-score://import?code=<base64> 形式
    const prefix = `${DEEP_LINK_SCHEME}://${DEEP_LINK_HOST}`;
    if (!url.startsWith(prefix)) return null;
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    return params.get('code') || null;
  } catch {
    return null;
  }
};

// 日付フォーマット（YYYY/MM/DD）
export const formatDate = (date: Date): string => {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};

// 表示用時刻フォーマット（M月D日HH:mm）
export const formatTime = (date: Date): string => {
  return `${date.getMonth() + 1}月${date.getDate()}日${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 共有データから復元した記録行（SQLite の scores / chips 行と同じ形）
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
