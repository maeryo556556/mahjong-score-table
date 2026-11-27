#!/usr/bin/env node
/**
 * 期限切れリアルタイム共有セッションの掃除スクリプト（Issue #102）
 *
 * Firestore の `sessions` コレクションから、`expiresAt`（Timestamp）が
 * 実行時刻より前のドキュメントだけを削除する。`expiresAt` が未来のドキュメント
 * （進行中・有効期限内のセッション）には触らない。
 *
 * 背景:
 *   Firebase は無料の Spark プランのため TTL ポリシーによる自動削除が使えない。
 *   そこで GitHub Actions（.github/workflows/cleanup-expired-sessions.yml）から
 *   定期実行して掃除する。
 *
 * 運用方式:
 *   - 毎月1日 03:00 UTC に自動実行（本削除）
 *   - Actions 画面の「Run workflow」から手動実行も可能。手動時は `dry_run` 入力
 *     （デフォルト true）でドライランを選べる
 *
 * 必要な GitHub Secrets:
 *   - FIREBASE_SERVICE_ACCOUNT : Firebase サービスアカウントキー（JSON 文字列をそのまま登録）
 *
 * 環境変数:
 *   - FIREBASE_SERVICE_ACCOUNT : 上記サービスアカウントキー JSON（必須）
 *   - DRY_RUN=1                : 削除せず、対象件数と対象コード一覧をログに出すだけにする
 *
 * ローカル実行例:
 *   npm install --no-save firebase-admin
 *   FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" DRY_RUN=1 node scripts/cleanup-expired-sessions.mjs
 */

import { pathToFileURL } from 'node:url';

const COLLECTION = 'sessions';
const BATCH_SIZE = 500; // Firestore の WriteBatch 上限
const MAX_ROUNDS = 10000; // 無限ループ防止の安全弁（500件 × 10000 = 500万件）

/**
 * Timestamp（firebase-admin）を Unix ミリ秒に変換する。Timestamp でなければ null。
 */
const toMillis = value =>
  value && typeof value.toMillis === 'function' ? value.toMillis() : null;

/**
 * 期限切れセッションを掃除する本体。
 * @param {object} params
 * @param {import('firebase-admin/firestore').Firestore} params.db
 * @param {typeof import('firebase-admin/firestore').Timestamp} params.Timestamp
 * @param {number} params.nowMs 判定基準時刻（実行開始時に固定する）
 * @param {boolean} params.dryRun
 * @param {(msg: string) => void} [params.log]
 * @returns {Promise<{ targetCount: number, deletedCount: number, codes: string[] }>}
 */
export async function cleanupExpiredSessions({ db, Timestamp, nowMs, dryRun, log = console.log }) {
  const cutoff = Timestamp.fromMillis(nowMs);
  const baseQuery = db
    .collection(COLLECTION)
    .where('expiresAt', '<', cutoff)
    .orderBy('expiresAt')
    .limit(BATCH_SIZE);

  // 念のためクライアント側でも expiresAt を再確認し、未来・不正値は絶対に対象にしない
  const isExpired = doc => {
    const ms = toMillis(doc.get('expiresAt'));
    return ms !== null && ms < nowMs;
  };

  const codes = [];
  let deletedCount = 0;
  let lastDoc = null;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    // 判定基準時刻は固定。ドライランは削除しないためカーソルで次ページへ進む。
    // 本削除は消した分だけ結果が詰まるが、念のためカーソルで進めて同じ文書の再処理を避ける。
    const query = lastDoc ? baseQuery.startAfter(lastDoc) : baseQuery;
    const snap = await query.get();
    if (snap.empty) break;
    lastDoc = snap.docs[snap.docs.length - 1];

    const targets = snap.docs.filter(isExpired);
    const skipped = snap.docs.length - targets.length;
    if (skipped > 0) log(`[warn] expiresAt を再確認して対象外にした文書: ${skipped} 件`);
    for (const doc of targets) codes.push(doc.id);

    if (!dryRun && targets.length > 0) {
      const batch = db.batch();
      for (const doc of targets) batch.delete(doc.ref);
      await batch.commit();
      deletedCount += targets.length;
      log(`削除: ${targets.length} 件（累計 ${deletedCount} 件）`);
    }

    if (snap.docs.length < BATCH_SIZE) break;
    if (round === MAX_ROUNDS - 1) log('[warn] 安全上限に達したため処理を打ち切りました');
  }

  return { targetCount: codes.length, deletedCount, codes };
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('環境変数 FIREBASE_SERVICE_ACCOUNT が未設定です（サービスアカウントキー JSON を設定してください）');
    process.exit(1);
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT を JSON として解釈できませんでした');
    process.exit(1);
  }

  const dryRun = process.env.DRY_RUN === '1';
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const nowMs = Date.now();
  console.log(`モード: ${dryRun ? 'ドライラン（削除しません）' : '本削除'}`);
  console.log(`判定基準時刻: ${new Date(nowMs).toISOString()}（expiresAt がこれより前の文書が対象）`);

  const result = await cleanupExpiredSessions({ db, Timestamp, nowMs, dryRun });

  console.log(`対象件数: ${result.targetCount} 件`);
  if (dryRun) {
    console.log(`対象コード: ${result.codes.length > 0 ? result.codes.join(', ') : '（なし）'}`);
  } else {
    console.log(`削除件数: ${result.deletedCount} 件`);
  }
}

// 直接実行されたときだけ main を動かす（関数単体のテストで import できるように）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('掃除処理に失敗しました:', err);
    process.exit(1);
  });
}
