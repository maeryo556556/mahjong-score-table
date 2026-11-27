/**
 * expo-sqlite のテスト用モック（Issue #104）
 *
 * ネイティブモジュールの代わりに sql.js（WebAssembly 版 SQLite）のインメモリ DB を使い、
 * database.ts が使う同期 API（execSync / runSync / getAllSync / getFirstSync / withTransactionSync）を再現する。
 * これにより画面テストでも database.ts の SQL をそのまま実行できる。
 *
 * jest-expo の環境では WebAssembly 版が DB を開けない（SQLITE_CANTOPEN / out of memory）ため、
 * 純 JS（asm.js）版を使う。asm.js 版は読み込み時に非推奨の警告を出すので、その警告だけ抑止する。
 */
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs: typeof import('sql.js').default = require('sql.js/dist/sql-asm.js');

let SQL: SqlJsStatic | null = null;
const openDatabases: Database[] = [];

/** sql.js の初期化（非同期）。jest.setup.components.ts の beforeAll で呼ぶ */
export const initSqliteMock = async () => {
  if (SQL) return;
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('asm.js build is deprecated')) return;
    originalWarn(...args);
  };
  try {
    SQL = await initSqlJs();
  } finally {
    console.warn = originalWarn;
  }
};

/** 開いている DB の全テーブルを削除する（テストごとに初期状態へ戻すため） */
export const resetSqliteMock = () => {
  for (const db of openDatabases) {
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    for (const [name] of tables[0]?.values ?? []) {
      db.run(`DROP TABLE IF EXISTS "${String(name)}"`);
    }
  }
};

type Params = SqlValue[] | Record<string, SqlValue>;

const normalizeParams = (args: unknown[]): Params | undefined => {
  if (args.length === 0) return undefined;
  if (args.length === 1 && (Array.isArray(args[0]) || (args[0] !== null && typeof args[0] === 'object'))) {
    return args[0] as Params;
  }
  return args as SqlValue[];
};

const queryAll = (db: Database, source: string, params?: Params) => {
  const stmt = db.prepare(source);
  try {
    if (params) stmt.bind(params);
    const rows: Record<string, SqlValue>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
};

class MockSQLiteDatabase {
  constructor(private readonly db: Database) {}

  execSync(source: string) {
    this.db.exec(source);
  }

  runSync(source: string, ...args: unknown[]) {
    this.db.run(source, normalizeParams(args));
    const changes = this.db.getRowsModified();
    const lastInsertRowId = Number(this.db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
    return { changes, lastInsertRowId };
  }

  getAllSync<T>(source: string, ...args: unknown[]): T[] {
    return queryAll(this.db, source, normalizeParams(args)) as T[];
  }

  getFirstSync<T>(source: string, ...args: unknown[]): T | null {
    return (queryAll(this.db, source, normalizeParams(args))[0] as T | undefined) ?? null;
  }

  withTransactionSync(task: () => void) {
    this.db.run('BEGIN');
    try {
      task();
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }

  closeSync() {
    // テスト中は開いたままにする
  }
}

export const openDatabaseSync = (_name: string) => {
  if (!SQL) throw new Error('sql.js が初期化されていません（initSqliteMock を先に呼んでください）');
  const db = new SQL.Database();
  openDatabases.push(db);
  return new MockSQLiteDatabase(db);
};
