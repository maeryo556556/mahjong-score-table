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
// 入力しやすさを優先し数字のみとする（Issue #48）
export const SESSION_CODE_ALPHABET = '0123456789';
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
 * それ以外（旧静的共有コード・その他の文字列）は null。
 */
export const extractSessionCode = (input: string): string | null => {
  const trimmed = input.trim();
  const fromUrl = parseSessionUrl(trimmed);
  if (fromUrl) return fromUrl;
  const code = normalizeSessionCode(trimmed);
  return isValidSessionCode(code) ? code : null;
};

/**
 * 6桁入力欄（Issue #53）用に入力文字列を整形する。
 * セッションリンクが貼り付けられた場合はそのコードを、それ以外は数字だけを
 * 取り出して先頭から最大6桁を返す。
 */
export const sanitizeSessionCodeInput = (input: string): string => {
  const fromUrl = parseSessionUrl(input.trim());
  if (fromUrl) return fromUrl;
  return input.replace(/[^0-9]/g, '').slice(0, SESSION_CODE_LENGTH);
};

/**
 * ローカルに保存したセッション情報がまだ有効か（コードがあり有効期限内か）。
 * 過去のゲーム一覧で、ライブ共有中のゲームを判定するのに使う。
 */
export const isLocalSessionActive = (
  code: string | null | undefined,
  expiresAt: number | null | undefined,
  now: number
): boolean => !!code && typeof expiresAt === 'number' && now < expiresAt;

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

/**
 * @param ended true なら最初から終了状態のセッション（終了済みゲームのコード共有）を作る
 */
export const buildSessionDoc = (
  game: ShareGameData,
  hostUid: string,
  now: number,
  ended: boolean = false
): SessionDoc => ({
  data: JSON.stringify(game),
  hostUid,
  createdAt: now,
  updatedAt: now,
  expiresAt: now + SESSION_TTL_MS,
  ended,
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
  // 有効期限切れを優先する（終了済みゲームの共有も、発行から24時間後は期限切れとして扱う）
  const status: LiveSessionStatus = isSessionExpired({ expiresAt: d.expiresAt }, now)
    ? 'expired'
    : d.ended === true ? 'ended' : 'live';
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
  /**
   * 終了済みゲームを最初から終了状態（ended: true）のセッションとして発行する。
   * 有効期限は発行時刻から24時間。呼ぶたびに新しいコードを発行する。
   */
  publishFinished(game: ShareGameData): Promise<{ code: string; expiresAt: number }>;
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

  const issue = async (game: ShareGameData, ended: boolean) => {
    const uid = await backend.getUid();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = generateSessionCode(random);
      if (await backend.exists(code)) continue;
      const doc = buildSessionDoc(game, uid, now(), ended);
      await backend.create(code, doc);
      return { code, expiresAt: doc.expiresAt };
    }
    throw new Error('セッションコードの発行に失敗しました');
  };

  return {
    start(game) {
      return issue(game, false);
    },

    publishFinished(game) {
      return issue(game, true);
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

// ---------- 参加したセッションの記録（Issue #58: 閲覧モードへの再入室） ----------

/** ゲストとして参加したセッション。端末に保持し、過去のゲーム一覧から再接続できるようにする */
export interface JoinedSession {
  code: string;
  expiresAt: number;
  status: LiveSessionStatus;
  startDate: string;
  playerCount: number;
  playerNames: string[];
  hanchanCount: number;
  /** 最後にデータを受信した時刻（一覧の並び順に使う） */
  lastSeenAt: number;
}

export const buildJoinedSession = (code: string, snapshot: LiveSessionSnapshot, now: number): JoinedSession => {
  const hanchans = new Set<number>();
  (snapshot.game.s || []).forEach(entry => hanchans.add(entry[0]));
  return {
    code,
    expiresAt: snapshot.expiresAt,
    status: snapshot.status,
    startDate: snapshot.game.d,
    playerCount: snapshot.game.pc,
    playerNames: [...snapshot.game.p],
    hanchanCount: hanchans.size,
    lastSeenAt: now,
  };
};

/**
 * 一覧に表示する再入室可能なセッションを選ぶ。
 * - 有効期限内のものだけ（期限切れのセッションには再接続しても閲覧できない）
 * - すでに履歴に保存したセッション（取り込み済みゲームの受信元コード）は、そちらの項目から入れるので除く
 * - 最後に受信した順（新しい順）に並べる
 */
export const selectRejoinableSessions = (
  sessions: readonly JoinedSession[],
  savedSessionCodes: ReadonlySet<string>,
  now: number
): JoinedSession[] =>
  sessions
    .filter(s => isLocalSessionActive(s.code, s.expiresAt, now) && !savedSessionCodes.has(s.code))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
