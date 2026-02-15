# 麻雀スコアシート

麻雀スコアシートのデジタル版モバイルアプリです。

## 主な機能

- 3人麻雀/4人麻雀の選択対応
- 半荘ごとのポイント記録（順位自動判定）
- チップ移動の記録
- SQLiteによるローカルデータ保存
- 総合スコア・順位分布の表示
- 履歴の削除機能（長押し操作）
- 時系列での記録表示
- ゲーム終了時の総合スコア表示（メダル付きランキング）
- ゲームの中断・再開機能
- 過去のゲーム一覧の閲覧
- スコア記録完了ダイアログ

## 技術スタック

- **React Native**: 0.81.5
- **Expo**: ~54.0.33
- **expo-router**: ~6.0.23（ファイルベースルーティング）
- **expo-sqlite**: ^16.0.10（SQLiteデータベース）
- **expo-haptics**: ~15.0.8（触覚フィードバック）
- **expo-linear-gradient**: ^15.0.8（グラデーション背景）
- **TypeScript**: ~5.9.2

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn

### インストール

```bash
# プロジェクトディレクトリに移動
cd mahjong-score-table

# 依存パッケージのインストール
npm install

# または
yarn install
```

### 実行

```bash
# 開発サーバーの起動
npm start

# iOSシミュレーターで実行
npm run ios

# Androidエミュレーターで実行
npm run android

# Webブラウザで実行
npm run web
```

## プロジェクト構造

```
mahjong-score-table/
├── app/
│   ├── _layout.tsx             # ルートレイアウト（SafeAreaProvider）
│   └── index.tsx               # メイン画面ナビゲーション
├── database.ts                 # SQLite データベース操作
├── screens/
│   ├── SetupScreen.tsx         # プレイヤー設定・中断ゲーム一覧画面
│   ├── GameScreen.tsx          # ゲーム画面（記録・閲覧兼用）
│   └── PastGamesScreen.tsx     # 過去のゲーム一覧画面
├── components/
│   ├── DrumRollInput.tsx       # ドラムロール入力UI
│   ├── SummaryCards.tsx        # 総合スコア表示
│   ├── HistoryTable.tsx        # 記録履歴テーブル
│   └── FinishGameModal.tsx     # ゲーム終了モーダル
├── App.tsx                     # レガシーエントリポイント
├── package.json
├── app.json
└── tsconfig.json
```

## 画面遷移

```
SetupScreen（初期画面）
  ├── → GameScreen（ゲーム開始 / 中断ゲーム再開）
  │       ├── 中断 → SetupScreen
  │       └── 終了 → SetupScreen
  └── → PastGamesScreen（過去のゲームを見る）
          └── → GameScreen（読み取り専用モード）
```

## データベース設計

### gamesテーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| player_count | INTEGER | プレイヤー数（3または4） |
| start_date | TEXT | ゲーム開始日（YYYY/MM/DD） |
| created_at | INTEGER | 作成日時（UnixTime） |
| finished | INTEGER | 終了フラグ（0: 中断中, 1: 終了） |

### scoresテーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| game_id | INTEGER | ゲームID（外部キー、CASCADE削除） |
| hanchan | INTEGER | 半荘番号 |
| player_name | TEXT | プレイヤー名 |
| point | INTEGER | ポイント |
| rank | INTEGER | 順位 |
| timestamp | INTEGER | 記録日時（UnixTime） |
| formatted_time | TEXT | 表示用日時（M月D日HH:mm） |

インデックス: `idx_scores_game(game_id)`, `idx_scores_hanchan(game_id, hanchan)`

### chipsテーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| game_id | INTEGER | ゲームID（外部キー、CASCADE削除） |
| hanchan | INTEGER | 半荘番号 |
| player_name | TEXT | プレイヤー名 |
| chip_point | INTEGER | チップポイント |
| timestamp | INTEGER | 記録日時（UnixTime） |
| formatted_time | TEXT | 表示用日時（M月D日HH:mm） |

インデックス: `idx_chips_game(game_id)`

### game_playersテーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| game_id | INTEGER | ゲームID（外部キー、CASCADE削除） |
| player_name | TEXT | プレイヤー名 |
| sort_order | INTEGER | 表示順序（0, 1, 2, 3） |

インデックス: `idx_game_players_game(game_id)`

## 主な機能の実装詳細

### 1. ドラムロール入力UI
- +10/-10ボタンと+1/-1ボタンで増減
- 範囲: -200 〜 +200
- 初期値: 0

### 2. 順位自動判定
- ポイントの高い順に自動判定
- 同点の場合は同順位
- 順位バッジの色分け（金/銀/銅/灰）

### 3. 半荘番号の自動採番
- 半荘削除時、残りの半荘をタイムスタンプ順に自動採番

### 4. 長押し削除
- 履歴行を800ms長押しで削除確認ダイアログ表示
- 半荘行: その半荘のスコアデータを削除
- チップ行: そのチップ移動のみを削除
- 過去ゲーム閲覧時は長押し無効（読み取り専用）

### 5. ゲーム中断・再開
- ゲーム中に「中断」ボタンで中断（確認ダイアログあり）
- セットアップ画面に中断中のゲーム一覧を表示
- タップで中断ゲームを再開
- 新規ゲーム開始時に中断中ゲームを自動終了（確認ダイアログあり）

### 6. 過去のゲーム閲覧
- 終了済みゲームの一覧表示（日付・人数・プレイヤー名・半荘数）
- タップで読み取り専用モードで詳細表示
- 長押しでゲーム削除

### 7. データ永続化
- SQLiteデータベースにローカル保存
- アプリを閉じてもデータが保持される
- CASCADE削除で整合性を保証
- マイグレーション対応（finishedカラムの追加）

## バリデーション

### プレイヤー名
- 必須入力
- 最大4文字

### ポイント入力
- 全員0点の場合は記録不可
- 合計が±0でない場合は記録不可
- 範囲: -200 〜 +200

### チップ移動
- 全員0点の場合は記録不可
- 合計が±0でない場合は記録不可
- 範囲: -200 〜 +200

## ビルド

### Android APKビルド
```bash
eas build --platform android --profile preview
```

### iOS IPAビルド
```bash
eas build --platform ios --profile preview
```

## ライセンス

MIT License

## 作成者

Claude (Anthropic)
