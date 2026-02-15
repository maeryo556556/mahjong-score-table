# 麻雀スコアシート

麻雀スコアシートのデジタル版モバイルアプリです。

## 主な機能

- ✅ 3人麻雀/4人麻雀の選択対応
- ✅ 半荘ごとのポイント記録（順位自動判定）
- ✅ チップ移動の記録
- ✅ SQLiteによるローカルデータ保存
- ✅ 総合スコア・順位分布の表示
- ✅ 履歴の削除機能（長押し操作）
- ✅ 時系列での記録表示
- ✅ ゲーム終了時の総合スコア表示

## 技術スタック

- **React Native**: 0.74.0
- **Expo**: ~51.0.0
- **expo-sqlite**: ~14.0.0 (SQLiteデータベース)
- **TypeScript**: ~5.3.0

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
mahjong-rn/
├── App.tsx                 # メインアプリコンポーネント
├── database.ts             # SQLite データベース操作
├── screens/
│   ├── SetupScreen.tsx    # プレイヤー設定画面
│   └── GameScreen.tsx     # ゲーム画面
├── components/
│   ├── DrumRollInput.tsx  # ドラムロール入力UI
│   ├── SummaryCards.tsx   # 総合スコア表示
│   ├── HistoryTable.tsx   # 記録履歴テーブル
│   └── FinishGameModal.tsx # ゲーム終了モーダル
├── package.json
├── app.json
└── tsconfig.json
```

## データベース設計

### gamesテーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー |
| player_count | INTEGER | プレイヤー数（3または4） |
| start_date | TEXT | ゲーム開始日 |
| created_at | INTEGER | 作成日時（UnixTime） |

### scoresテーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー |
| game_id | INTEGER | ゲームID（外部キー） |
| hanchan | INTEGER | 半荘番号 |
| player_name | TEXT | プレイヤー名 |
| point | INTEGER | ポイント |
| rank | INTEGER | 順位 |
| timestamp | INTEGER | 記録日時（UnixTime） |
| formatted_time | TEXT | 表示用日時 |

### chipsテーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー |
| game_id | INTEGER | ゲームID（外部キー） |
| hanchan | INTEGER | 半荘番号 |
| player_name | TEXT | プレイヤー名 |
| chip_point | INTEGER | チップポイント |
| timestamp | INTEGER | 記録日時（UnixTime） |
| formatted_time | TEXT | 表示用日時 |

## 主な機能の実装詳細

### 1. ドラムロール入力UI
- +10/-10ボタンと+1/-1ボタンで増減
- 範囲: -200 〜 +200
- 初期値: 0

### 2. 順位自動判定
- ポイントの高い順に自動判定
- 同点の場合は同順位

### 3. 半荘番号の自動採番
- 半荘削除時、残りの半荘をタイムスタンプ順に自動採番

### 4. 長押し削除
- 履歴行を800ms長押しで削除確認ダイアログ表示
- 半荘行: その半荘のスコアデータを削除
- チップ行: そのチップ移動のみを削除

### 5. データ永続化
- SQLiteデータベースにローカル保存
- アプリを閉じても データが保持される
- CASCADE削除で整合性を保証

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
