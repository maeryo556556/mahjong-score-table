import * as SQLite from 'expo-sqlite';
import {
  calcRanks,
  encodeShareCode,
  decodeShareCode,
  validateShareData,
  formatDate,
  formatTime,
} from './utils';
import type { ShareGameData, ShareGameDataV1, ShareGameDataV2 } from './utils';

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

export const exportGameData = (gameId: number): string => {
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

  const data: ShareGameDataV2 = {
    v: 2,
    pc: game.player_count,
    d: game.start_date,
    p: players,
    s: scores.map(s => [s.hanchan, playerIndex.get(s.player_name)!, s.point, s.timestamp, s.formatted_time]),
    ...(chips.length > 0 ? { c: chips.map(c => [c.hanchan, playerIndex.get(c.player_name)!, c.chip_point, c.timestamp, c.formatted_time]) } : {}),
  };

  const json = JSON.stringify(data);
  return encodeShareCode(json);
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

  if (!validateShareData(data)) {
    throw new Error('共有コードの形式が正しくありません');
  }

  let gameId = 0;
  const now = Date.now();
  const dateParts = data.d.split('/');
  const formattedTime = `${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`;

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

    if (data.v === 1) {
      // v1: 旧フォーマットそのまま
      if (data.s) {
        data.s.forEach(([hanchan, playerName, point, rank, timestamp, ft]) => {
          getDb().runSync(
            'INSERT INTO scores (game_id, hanchan, player_name, point, rank, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [gameId, hanchan, playerName, point, rank, timestamp, ft]
          );
        });
      }
      if (data.c) {
        data.c.forEach(([hanchan, playerName, chipPoint, timestamp, ft]) => {
          getDb().runSync(
            'INSERT INTO chips (game_id, hanchan, player_name, chip_point, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?)',
            [gameId, hanchan, playerName, chipPoint, timestamp, ft]
          );
        });
      }
    } else {
      // v2: プレイヤーインデックスから名前復元、順位再計算
      if (data.s) {
        // 半荘ごとにグループ化して順位を計算
        const byHanchan = new Map<number, Array<{ playerName: string; point: number; ts: number; ft: string }>>();
        data.s.forEach((entry) => {
          const hanchan = entry[0];
          const playerName = data.p[entry[1]];
          const point = entry[2];
          // タイムスタンプが含まれていればそれを使用、なければ fallback
          const ts = entry.length >= 5 ? (entry as [number, number, number, number, string])[3] : now;
          const ft = entry.length >= 5 ? (entry as [number, number, number, number, string])[4] : formattedTime;
          if (!byHanchan.has(hanchan)) byHanchan.set(hanchan, []);
          byHanchan.get(hanchan)!.push({ playerName, point, ts, ft });
        });

        byHanchan.forEach((entries, hanchan) => {
          const scoresMap = new Map(entries.map(e => [e.playerName, e.point]));
          const ranks = calcRanks(data.p, scoresMap);
          entries.forEach(({ playerName, point, ts, ft }) => {
            getDb().runSync(
              'INSERT INTO scores (game_id, hanchan, player_name, point, rank, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [gameId, hanchan, playerName, point, ranks.get(playerName)!, ts, ft]
            );
          });
        });
      }
      if (data.c) {
        // 半荘ごとにグループ化（HistoryTable がタイムスタンプでグループ化するため）
        const chipsByHanchan = new Map<number, Array<{ pIdx: number; chipPoint: number; ts: number; ft: string }>>();
        data.c.forEach((entry) => {
          const hanchan = entry[0];
          const pIdx = entry[1];
          const chipPoint = entry[2];
          const hasTs = entry.length >= 5;
          const ts = hasTs ? (entry as [number, number, number, number, string])[3] : 0;
          const ft = hasTs ? (entry as [number, number, number, number, string])[4] : formattedTime;
          if (!chipsByHanchan.has(hanchan)) chipsByHanchan.set(hanchan, []);
          chipsByHanchan.get(hanchan)!.push({ pIdx, chipPoint, ts, ft });
        });

        const sortedHanchans = [...chipsByHanchan.keys()].sort((a, b) => a - b);
        sortedHanchans.forEach((hanchan, idx) => {
          const entries = chipsByHanchan.get(hanchan)!;
          // タイムスタンプがない旧データの場合、半荘ごとに異なるタイムスタンプを割り当て
          const fallbackTs = now + idx + 1;
          entries.forEach(({ pIdx, chipPoint, ts, ft }) => {
            getDb().runSync(
              'INSERT INTO chips (game_id, hanchan, player_name, chip_point, timestamp, formatted_time) VALUES (?, ?, ?, ?, ?, ?)',
              [gameId, hanchan, data.p[pIdx], chipPoint, ts || fallbackTs, ft]
            );
          });
        });
      }
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
