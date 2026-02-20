import * as SQLite from 'expo-sqlite';

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
};

// ゲーム作成
export const createGame = (playerCount: number, playerNames: string[]) => {
  const now = new Date();
  const startDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

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
  const formattedTime = `${now.getMonth() + 1}月${now.getDate()}日${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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
  const formattedTime = `${now.getMonth() + 1}月${now.getDate()}日${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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
  const games = getDb().getAllSync<{ id: number; player_count: number; start_date: string; created_at: number }>(
    'SELECT id, player_count, start_date, created_at FROM games WHERE finished = 1 ORDER BY created_at DESC'
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

// ゲームデータをエクスポート用に取得
export interface ShareGameData {
  v: 1;
  pc: number;
  d: string;
  p: string[];
  s: Array<[number, string, number, number, number, string]>; // [hanchan, player_name, point, rank, timestamp, formatted_time]
  c: Array<[number, string, number, number, string]>; // [hanchan, player_name, chip_point, timestamp, formatted_time]
}

export const exportGameData = (gameId: number): string => {
  const game = getGameById(gameId);
  if (!game) throw new Error('ゲームが見つかりません');

  const players = getPlayerNames(gameId);
  const scores = getDb().getAllSync<{
    hanchan: number; player_name: string; point: number; rank: number; timestamp: number; formatted_time: string;
  }>('SELECT hanchan, player_name, point, rank, timestamp, formatted_time FROM scores WHERE game_id = ? ORDER BY timestamp', [gameId]);

  const chips = getDb().getAllSync<{
    hanchan: number; player_name: string; chip_point: number; timestamp: number; formatted_time: string;
  }>('SELECT hanchan, player_name, chip_point, timestamp, formatted_time FROM chips WHERE game_id = ? ORDER BY timestamp', [gameId]);

  const data: ShareGameData = {
    v: 1,
    pc: game.player_count,
    d: game.start_date,
    p: players,
    s: scores.map(s => [s.hanchan, s.player_name, s.point, s.rank, s.timestamp, s.formatted_time]),
    c: chips.map(c => [c.hanchan, c.player_name, c.chip_point, c.timestamp, c.formatted_time]),
  };

  const json = JSON.stringify(data);
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
};

// 共有コードからゲームデータをインポート
export const importGameData = (shareCode: string): number => {
  let data: ShareGameData;
  try {
    const binary = atob(shareCode);
    const json = decodeURIComponent(binary.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    data = JSON.parse(json);
  } catch {
    throw new Error('共有コードが正しくありません');
  }

  if (data.v !== 1 || !data.pc || !data.d || !data.p || !Array.isArray(data.p)) {
    throw new Error('共有コードの形式が正しくありません');
  }

  let gameId = 0;
  getDb().withTransactionSync(() => {
    const result = getDb().runSync(
      'INSERT INTO games (player_count, start_date, created_at, finished) VALUES (?, ?, ?, 1)',
      [data.pc, data.d, Date.now()]
    );
    gameId = result.lastInsertRowId;

    data.p.forEach((name, index) => {
      getDb().runSync(
        'INSERT INTO game_players (game_id, player_name, sort_order) VALUES (?, ?, ?)',
        [gameId, name, index]
      );
    });

    if (data.s) {
      data.s.forEach(([hanchan, playerName, point, rank, timestamp, formattedTime]) => {
        getDb().runSync(
          'INSERT INTO scores (game_id, hanchan, player_name, point, rank, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [gameId, hanchan, playerName, point, rank, timestamp, formattedTime]
        );
      });
    }

    if (data.c) {
      data.c.forEach(([hanchan, playerName, chipPoint, timestamp, formattedTime]) => {
        getDb().runSync(
          'INSERT INTO chips (game_id, hanchan, player_name, chip_point, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?)',
          [gameId, hanchan, playerName, chipPoint, timestamp, formattedTime]
        );
      });
    }
  });

  return gameId;
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
