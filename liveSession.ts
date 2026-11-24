/**
 * リアルタイム共有セッション
 *
 * ホストが進行中の対局を `sessions/{code}` ドキュメントに書き込み、
 * 参加者はコードでドキュメントを購読して読み取り専用で閲覧する。
 *
 * このモジュールは Firebase に直接依存しない。通信部分は SessionBackend として
 * 注入する（実装は firebase.ts、テストではモック）。
 */
import { validateShareData, DEEP_LINK_SCHEME } from './utils';
import type { ShareGameData } from './utils';

export const SESSIONS_COLLECTION = 'sessions';
// 読み間違えやすい文字（I, O, 0, 1）を除いた英数字
export const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SESSION_CODE_LENGTH = 6;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const LIVE_DEEP_LINK_HOST = 'live';

const SESSION_CODE_PATTERN = new RegExp(`^[${SESSION_CODE_ALPHABET}]{${SESSION_CODE_LENGTH}}$`);

// ---------- コード ----------

export const generateSessionCode = (random: () => number = Math.random): string => {
  let code = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    const idx = Math.floor(random() * SESSION_CODE_ALPHABET.length) % SESSION_CODE_ALPHABET.length;
    code += SESSION_CODE_ALPHABET[idx];
  }
  return code;
};

// 大文字化し、空白・ハイフンを除去する
export const normalizeSessionCode = (input: string): string => {
  return input.toUpperCase().replace(/[\s-]/g, '');
};

export const isValidSessionCode = (code: string): boolean => SESSION_CODE_PATTERN.test(code);

export const buildSessionUrl = (code: string): string => {
  return `${DEEP_LINK_SCHEME}://${LIVE_DEEP_LINK_HOST}?code=${encodeURIComponent(code)}`;
};

// mahjong-score://live?code=XXXXXX からコードを抽出（null = 該当なし）
export const parseSessionUrl = (url: string): string | null => {
  const prefix = `${DEEP_LINK_SCHEME}://${LIVE_DEEP_LINK_HOST}`;
  if (!url.startsWith(prefix)) return null;
  try {
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const code = normalizeSessionCode(new URLSearchParams(queryString).get('code') || '');
    return isValidSessionCode(code) ? code : null;
  } catch {
    return null;
  }
};

/**
 * 取り込み欄の入力がセッションコード（またはセッションリンク）ならコードを返す。
 * 静的共有コード・共有リンクの場合は null。
 */
export const extractSessionCode = (input: string): string | null => {
  const trimmed = input.trim();
  const fromUrl = parseSessionUrl(trimmed);
  if (fromUrl) return fromUrl;
  const code = normalizeSessionCode(trimmed);
  return isValidSessionCode(code) ? code : null;
};

// ---------- ドキュメント ----------

/** sessions/{code} ドキュメント。時刻はすべて Unix ミリ秒 */
export interface SessionDoc {
  /** 既存の共有データ形式（v2）の JSON 文字列。Firestore は入れ子配列を保存できないため文字列で持つ */
  data: string;
  hostUid: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  ended: boolean;
}

export const buildSessionDoc = (game: ShareGameData, hostUid: string, now: number): SessionDoc => ({
  data: JSON.stringify(game),
  hostUid,
  createdAt: now,
  updatedAt: now,
  expiresAt: now + SESSION_TTL_MS,
  ended: false,
});

export const buildSessionUpdate = (game: ShareGameData, now: number): Pick<SessionDoc, 'data' | 'updatedAt'> => ({
  data: JSON.stringify(game),
  updatedAt: now,
});

export type LiveSessionStatus = 'live' | 'ended' | 'expired';

export interface LiveSessionSnapshot {
  status: LiveSessionStatus;
  game: ShareGameData;
  updatedAt: number;
  expiresAt: number;
}

export const isSessionExpired = (doc: Pick<SessionDoc, 'expiresAt'>, now: number): boolean => now >= doc.expiresAt;

// ドキュメントを検証して閲覧用に変換する。不正な場合は null
export const parseSessionDoc = (raw: unknown, now: number): LiveSessionSnapshot | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.data !== 'string' || typeof d.expiresAt !== 'number') return null;
  let game: unknown;
  try {
    game = JSON.parse(d.data);
  } catch {
    return null;
  }
  if (!validateShareData(game)) return null;
  const status: LiveSessionStatus = d.ended === true
    ? 'ended'
    : isSessionExpired({ expiresAt: d.expiresAt }, now) ? 'expired' : 'live';
  return {
    status,
    game,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
    expiresAt: d.expiresAt,
  };
};

// ---------- サービス ----------

export interface SessionBackend {
  /** 匿名認証済みのユーザーIDを返す（未サインインならサインインする） */
  getUid(): Promise<string>;
  exists(code: string): Promise<boolean>;
  create(code: string, doc: SessionDoc): Promise<void>;
  update(code: string, patch: Partial<SessionDoc>): Promise<void>;
  /** ドキュメントを購読する。存在しない場合は null を通知する。戻り値は購読解除関数 */
  subscribe(
    code: string,
    onNext: (doc: Record<string, unknown> | null) => void,
    onError: (error: Error) => void
  ): () => void;
}

export type JoinEvent =
  | { type: 'snapshot'; snapshot: LiveSessionSnapshot }
  | { type: 'notFound' }
  | { type: 'error'; error: Error };

export interface LiveSessionService {
  /** セッションを作成してコードと有効期限を返す */
  start(game: ShareGameData): Promise<{ code: string; expiresAt: number }>;
  /** ホストのゲーム更新をセッションへ反映する */
  push(code: string, game: ShareGameData): Promise<void>;
  /** セッションを終了状態にする */
  end(code: string): Promise<void>;
  /** 参加者としてセッションを購読する。戻り値は購読解除関数 */
  join(code: string, onEvent: (event: JoinEvent) => void): () => void;
}

export const createLiveSessionService = (
  backend: SessionBackend,
  options: { now?: () => number; random?: () => number; maxAttempts?: number } = {}
): LiveSessionService => {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 5;

  return {
    async start(game) {
      const uid = await backend.getUid();
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = generateSessionCode(random);
        if (await backend.exists(code)) continue;
        const doc = buildSessionDoc(game, uid, now());
        await backend.create(code, doc);
        return { code, expiresAt: doc.expiresAt };
      }
      throw new Error('セッションコードの発行に失敗しました');
    },

    async push(code, game) {
      await backend.getUid();
      await backend.update(code, buildSessionUpdate(game, now()));
    },

    async end(code) {
      await backend.getUid();
      await backend.update(code, { ended: true, updatedAt: now() });
    },

    join(code, onEvent) {
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;
      backend.getUid().then(() => {
        if (cancelled) return;
        unsubscribe = backend.subscribe(
          code,
          (raw) => {
            if (raw === null) {
              onEvent({ type: 'notFound' });
              return;
            }
            const snapshot = parseSessionDoc(raw, now());
            if (snapshot) {
              onEvent({ type: 'snapshot', snapshot });
            } else {
              onEvent({ type: 'error', error: new Error('セッションのデータ形式が正しくありません') });
            }
          },
          (error) => onEvent({ type: 'error', error })
        );
      }).catch((error: unknown) => {
        if (cancelled) return;
        onEvent({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
  };
};
