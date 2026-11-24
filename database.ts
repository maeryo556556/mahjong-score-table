import * as SQLite from 'expo-sqlite';
import {
  encodeShareCode,
  decodeShareCode,
  validateShareData,
  shareDataToRecords,
  formatDate,
  formatTime,
} from './utils';
import type { ShareGameData, ShareGameDataV2 } from './utils';

let _db: SQLite.SQLiteDatabase | null = null;

const getDb = (): SQLite.SQLiteDatabase => {
  if (!_db) {
    _db = SQLite.openDatabaseSync('mahjong.db');
  }
  return _db;
};

// データベース初期化
export const initDatabase = () => {
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_count INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      finished INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      hanchan INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      point INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      formatted_time TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      hanchan INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      chip_point INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      formatted_time TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_id);
    CREATE INDEX IF NOT EXISTS idx_scores_hanchan ON scores(game_id, hanchan);
    CREATE INDEX IF NOT EXISTS idx_chips_game ON chips(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players(game_id);
  `);

  // 既存DBにfinishedカラムがない場合のマイグレーション
  try {
    getDb().runSync('ALTER TABLE games ADD COLUMN finished INTEGER NOT NULL DEFAULT 0');
  } catch {
    // カラムが既に存在する場合は無視
  }

  // 既存DBにimportedカラムがない場合のマイグレーション
  try {
    getDb().runSync('ALTER TABLE games ADD COLUMN imported INTEGER NOT NULL DEFAULT 0');
  } catch {
    // カラムが既に存在する場合は無視
  }

  // リアルタイム共有セッション（ホスト側）のカラム追加マイグレーション
  try {
    getDb().runSync('ALTER TABLE games ADD COLUMN live_session_code TEXT');
  } catch {
    // カラムが既に存在する場合は無視
  }
  try {
    getDb().runSync('ALTER TABLE games ADD COLUMN live_session_expires_at INTEGER');
  } catch {
    // カラムが既に存在する場合は無視
  }
};

// ゲーム作成
export const createGame = (playerCount: number, playerNames: string[]) => {
  const now = new Date();
  const startDate = formatDate(now);

  let gameId: number = 0;
  getDb().withTransactionSync(() => {
    const result = getDb().runSync(
      'INSERT INTO games (player_count, start_date, created_at) VALUES (?, ?, ?)',
      [playerCount, startDate, Date.now()]
    );
    gameId = result.lastInsertRowId;

    playerNames.forEach((name, index) => {
      getDb().runSync(
        'INSERT INTO game_players (game_id, player_name, sort_order) VALUES (?, ?, ?)',
        [gameId, name, index]
      );
    });
  });

  return gameId;
};

// スコア記録
export const recordScore = (
  gameId: number,
  hanchan: number,
  scores: Array<{ player: string; point: number; rank: number }>
) => {
  const now = new Date();
  const timestamp = now.getTime();
  const formattedTime = formatTime(now);

  getDb().withTransactionSync(() => {
    scores.forEach(score => {
      getDb().runSync(
        'INSERT INTO scores (game_id, hanchan, player_name, point, rank, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [gameId, hanchan, score.player, score.point, score.rank, timestamp, formattedTime]
      );
    });
  });
};

// チップ記録
export const recordChip = (
  gameId: number,
  hanchan: number,
  chips: Array<{ player: string; chipPoint: number }>
) => {
  const now = new Date();
  const timestamp = now.getTime();
  const formattedTime = formatTime(now);

  getDb().withTransactionSync(() => {
    chips.forEach(chip => {
      getDb().runSync(
        'INSERT INTO chips (game_id, hanchan, player_name, chip_point, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?)',
        [gameId, hanchan, chip.player, chip.chipPoint, timestamp, formattedTime]
      );
    });
  });
};

// 現在のゲーム取得（未終了のゲームのみ）
export const getCurrentGame = () => {
  const result = getDb().getFirstSync<{ id: number; player_count: number; start_date: string }>(
    'SELECT id, player_count, start_date FROM games WHERE finished = 0 ORDER BY id DESC LIMIT 1'
  );
  return result;
};

// ゲーム終了
export const finishGame = (gameId: number) => {
  getDb().runSync('UPDATE games SET finished = 1 WHERE id = ?', [gameId]);
};

// ゲームをIDで取得
export const getGameById = (gameId: number) => {
  const result = getDb().getFirstSync<{ id: number; player_count: number; start_date: string; finished: number }>(
    'SELECT id, player_count, start_date, finished FROM games WHERE id = ?',
    [gameId]
  );
  return result;
};

// 終了済みゲーム一覧取得
export const getFinishedGames = () => {
  const games = getDb().getAllSync<{ id: number; player_count: number; start_date: string; created_at: number; imported: number }>(
    'SELECT id, player_count, start_date, created_at, imported FROM games WHERE finished = 1 ORDER BY created_at DESC'
  );
  return games.map(game => {
    const players = getDb().getAllSync<{ player_name: string }>(
      'SELECT player_name FROM game_players WHERE game_id = ? ORDER BY sort_order',
      [game.id]
    );
    const hanchanCount = getDb().getFirstSync<{ count: number }>(
      'SELECT COUNT(DISTINCT hanchan) as count FROM scores WHERE game_id = ?',
      [game.id]
    );
    return {
      ...game,
      playerNames: players.map(p => p.player_name),
      hanchanCount: hanchanCount?.count || 0,
    };
  });
};

// 中断中（未終了）ゲーム一覧取得
export const getUnfinishedGames = () => {
  const games = getDb().getAllSync<{ id: number; player_count: number; start_date: string; created_at: number }>(
    'SELECT id, player_count, start_date, created_at FROM games WHERE finished = 0 ORDER BY created_at DESC'
  );
  return games.map(game => {
    const players = getDb().getAllSync<{ player_name: string }>(
      'SELECT player_name FROM game_players WHERE game_id = ? ORDER BY sort_order',
      [game.id]
    );
    const hanchanCount = getDb().getFirstSync<{ count: number }>(
      'SELECT COUNT(DISTINCT hanchan) as count FROM scores WHERE game_id = ?',
      [game.id]
    );
    return {
      ...game,
      playerNames: players.map(p => p.player_name),
      hanchanCount: hanchanCount?.count || 0,
    };
  });
};

// ゲーム削除
export const deleteGame = (gameId: number) => {
  getDb().withTransactionSync(() => {
    getDb().runSync('DELETE FROM chips WHERE game_id = ?', [gameId]);
    getDb().runSync('DELETE FROM scores WHERE game_id = ?', [gameId]);
    getDb().runSync('DELETE FROM game_players WHERE game_id = ?', [gameId]);
    getDb().runSync('DELETE FROM games WHERE id = ?', [gameId]);
  });
};

// プレイヤー名取得
export const getPlayerNames = (gameId: number) => {
  const result = getDb().getAllSync<{ player_name: string }>(
    'SELECT player_name FROM game_players WHERE game_id = ? ORDER BY sort_order',
    [gameId]
  );
  return result.map(r => r.player_name);
};

// スコア履歴取得
export const getScoreHistory = (gameId: number) => {
  const result = getDb().getAllSync<{
    hanchan: number;
    player_name: string;
    point: number;
    rank: number;
    timestamp: number;
    formatted_time: string;
  }>(
    'SELECT hanchan, player_name, point, rank, timestamp, formatted_time FROM scores WHERE game_id = ? ORDER BY timestamp DESC',
    [gameId]
  );
  return result;
};

// チップ履歴取得
export const getChipHistory = (gameId: number) => {
  const result = getDb().getAllSync<{
    id: number;
    hanchan: number;
    player_name: string;
    chip_point: number;
    timestamp: number;
    formatted_time: string;
  }>(
    'SELECT id, hanchan, player_name, chip_point, timestamp, formatted_time FROM chips WHERE game_id = ? ORDER BY timestamp DESC',
    [gameId]
  );
  return result;
};

// 次の半荘番号取得
export const getNextHanchan = (gameId: number) => {
  const result = getDb().getFirstSync<{ max_hanchan: number | null }>(
    'SELECT MAX(hanchan) as max_hanchan FROM scores WHERE game_id = ?',
    [gameId]
  );
  return (result?.max_hanchan || 0) + 1;
};

// 半荘削除
export const deleteHanchan = (gameId: number, hanchan: number) => {
  getDb().withTransactionSync(() => {
    getDb().runSync('DELETE FROM scores WHERE game_id = ? AND hanchan = ?', [gameId, hanchan]);
    getDb().runSync('DELETE FROM chips WHERE game_id = ? AND hanchan = ?', [gameId, hanchan]);

    // 半荘番号を採番し直す
    const scores = getDb().getAllSync<{ hanchan: number; timestamp: number }>(
      'SELECT DISTINCT hanchan, MIN(timestamp) as timestamp FROM scores WHERE game_id = ? GROUP BY hanchan ORDER BY timestamp',
      [gameId]
    );
    
    scores.forEach((item, index) => {
      const newHanchan = index + 1;
      if (item.hanchan !== newHanchan) {
        getDb().runSync('UPDATE scores SET hanchan = ? WHERE game_id = ? AND hanchan = ?', [newHanchan, gameId, item.hanchan]);
        getDb().runSync('UPDATE chips SET hanchan = ? WHERE game_id = ? AND hanchan = ?', [newHanchan, gameId, item.hanchan]);
      }
    });
  });
};

// チップ削除
export const deleteChip = (chipId: number) => {
  getDb().runSync('DELETE FROM chips WHERE id = ?', [chipId]);
};

// 型定義は utils.ts から re-export
export type { ShareGameDataV1, ShareGameDataV2, ShareGameData } from './utils';

// ゲームを共有データ（v2形式）に変換
export const buildShareData = (gameId: number): ShareGameDataV2 => {
  const game = getGameById(gameId);
  if (!game) throw new Error('ゲームが見つかりません');

  const players = getPlayerNames(gameId);
  const playerIndex = new Map(players.map((name, i) => [name, i]));

  const scores = getDb().getAllSync<{
    hanchan: number; player_name: string; point: number; timestamp: number; formatted_time: string;
  }>('SELECT hanchan, player_name, point, timestamp, formatted_time FROM scores WHERE game_id = ? ORDER BY hanchan, player_name', [gameId]);

  const chips = getDb().getAllSync<{
    hanchan: number; player_name: string; chip_point: number; timestamp: number; formatted_time: string;
  }>('SELECT hanchan, player_name, chip_point, timestamp, formatted_time FROM chips WHERE game_id = ? ORDER BY hanchan, player_name', [gameId]);

  return {
    v: 2,
    pc: game.player_count,
    d: game.start_date,
    p: players,
    s: scores.map(s => [s.hanchan, playerIndex.get(s.player_name)!, s.point, s.timestamp, s.formatted_time]),
    ...(chips.length > 0 ? { c: chips.map(c => [c.hanchan, playerIndex.get(c.player_name)!, c.chip_point, c.timestamp, c.formatted_time]) } : {}),
  };
};

export const exportGameData = (gameId: number): string => {
  return encodeShareCode(JSON.stringify(buildShareData(gameId)));
};

// 共有データを終了済み・取り込み済みゲームとして保存
// （共有コードの取り込みと、ライブ共有終了後の保存で共通）
export const importShareData = (data: ShareGameData): number => {
  if (!validateShareData(data)) {
    throw new Error('共有コードの形式が正しくありません');
  }

  const now = Date.now();
  const records = shareDataToRecords(data, now);
  let gameId = 0;

  getDb().withTransactionSync(() => {
    const result = getDb().runSync(
      'INSERT INTO games (player_count, start_date, created_at, finished, imported) VALUES (?, ?, ?, 1, 1)',
      [data.pc, data.d, now]
    );
    gameId = result.lastInsertRowId;

    data.p.forEach((name, index) => {
      getDb().runSync(
        'INSERT INTO game_players (game_id, player_name, sort_order) VALUES (?, ?, ?)',
        [gameId, name, index]
      );
    });

    records.scores.forEach(s => {
      getDb().runSync(
        'INSERT INTO scores (game_id, hanchan, player_name, point, rank, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [gameId, s.hanchan, s.player_name, s.point, s.rank, s.timestamp, s.formatted_time]
      );
    });
    records.chips.forEach(c => {
      getDb().runSync(
        'INSERT INTO chips (game_id, hanchan, player_name, chip_point, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?)',
        [gameId, c.hanchan, c.player_name, c.chip_point, c.timestamp, c.formatted_time]
      );
    });
  });

  return gameId;
};

// 共有コードからゲームデータをインポート
export const importGameData = (shareCode: string): number => {
  let data: ShareGameData;
  try {
    const json = decodeShareCode(shareCode);
    data = JSON.parse(json);
  } catch {
    throw new Error('共有コードが正しくありません');
  }
  return importShareData(data);
};

// ホスト側: ゲームに紐づくリアルタイム共有セッションの取得・保存
export const getLiveSession = (gameId: number): { code: string; expiresAt: number } | null => {
  const row = getDb().getFirstSync<{ live_session_code: string | null; live_session_expires_at: number | null }>(
    'SELECT live_session_code, live_session_expires_at FROM games WHERE id = ?',
    [gameId]
  );
  if (!row?.live_session_code || !row.live_session_expires_at) return null;
  return { code: row.live_session_code, expiresAt: row.live_session_expires_at };
};

export const setLiveSession = (gameId: number, session: { code: string; expiresAt: number } | null) => {
  getDb().runSync(
    'UPDATE games SET live_session_code = ?, live_session_expires_at = ? WHERE id = ?',
    [session?.code ?? null, session?.expiresAt ?? null, gameId]
  );
};

// ゲームデータクリア
export const clearAllData = () => {
  getDb().withTransactionSync(() => {
    getDb().runSync('DELETE FROM chips');
    getDb().runSync('DELETE FROM scores');
    getDb().runSync('DELETE FROM game_players');
    getDb().runSync('DELETE FROM games');
  });
};

export default getDb;
