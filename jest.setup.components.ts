/**
 * 画面操作（コンポーネント）テスト用のセットアップ（Issue #104）
 * jest.config.js の components プロジェクトからのみ読み込まれる。
 */
import { initSqliteMock, resetSqliteMock } from './__tests__/support/sqliteMock';

// Expo（expo/src/winter）は一部のグローバルを「初回アクセス時に require する遅延 getter」として定義する。
// jest 30 はテスト終了後の後片付けでグローバルに触れるため、そのとき require が走って
// 「You are trying to `import` a file outside of the scope of the test code」で失敗することがある。
// セットアップ中に一度アクセスして値を確定させておく
for (const name of [
  '__ExpoImportMetaRegistry',
  'structuredClone',
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
]) {
  void (globalThis as Record<string, unknown>)[name];
}

// SQLite: ネイティブモジュールの代わりに sql.js のインメモリ DB を使う
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-sqlite', () => require('./__tests__/support/sqliteMock'));

// Safe Area: ネイティブの計測を行わない公式モック
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Firebase（リアルタイム共有）: テストでは通信しない。呼ばれたら失敗として扱う
jest.mock('./firebase', () => ({
  getLiveSessionService: jest.fn(() => {
    throw new Error('テストでは Firebase に接続しません');
  }),
}));

beforeAll(async () => {
  await initSqliteMock();
});

beforeEach(() => {
  resetSqliteMock();
});
