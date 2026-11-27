// テストは 2 つのプロジェクトに分けて実行する（Issue #104）
// - unit:       既存のロジックテスト（__tests__/**/*.test.ts）。ts-jest + node 環境
// - components: 画面操作（コンポーネント）のテスト（__tests__/**/*.test.tsx）。jest-expo + React Native Testing Library
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/__tests__'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      testMatch: ['**/*.test.ts'],
    },
    {
      displayName: 'components',
      preset: 'jest-expo/ios',
      roots: ['<rootDir>/__tests__'],
      testMatch: ['**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.components.ts'],
    },
  ],
};
