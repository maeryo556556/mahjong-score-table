import { deflate, inflate } from 'pako';

// 順位を計算する
export const calcRanks = (
  players: string[],
  scoresMap: Map<string, number>
): Map<string, number> => {
  const sorted = players
    .map(p => ({ player: p, point: scoresMap.get(p) ?? 0 }))
    .sort((a, b) => b.point - a.point);
  const ranks = new Map<string, number>();
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].point < sorted[i - 1].point) {
      currentRank = i + 1;
    }
    ranks.set(sorted[i].player, currentRank);
  }
  return ranks;
};

// スコアバリデーション: 全員0ならエラー
export const isAllZero = (values: number[]): boolean => {
  return values.every(v => v === 0);
};

// スコアバリデーション: 合計が0でないならエラー
export const calcTotal = (values: number[]): number => {
  return values.reduce((sum, v) => sum + v, 0);
};

// ドラムロール値のクランプ
export const clampValue = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

// 共有コードエンコード（JSON → deflate圧縮 → Base64）
export const encodeShareCode = (json: string): string => {
  const utf8Bytes = new TextEncoder().encode(json);
  const compressed = deflate(utf8Bytes);
  // Uint8Array → binary string → base64
  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary);
};

// 共有コードデコード（Base64 → inflate解凍 → JSON）
// 旧形式（非圧縮）にも後方互換
export const decodeShareCode = (code: string): string => {
  const binary = atob(code);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // 圧縮データの場合は inflate、旧形式なら従来のデコード
  try {
    const decompressed = inflate(bytes);
    return new TextDecoder().decode(decompressed);
  } catch {
    // 旧形式（非圧縮 base64）のフォールバック
    return decodeURIComponent(
      binary
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  }
};

// 共有データバリデーション
export interface ShareGameDataV1 {
  v: 1;
  pc: number;
  d: string;
  p: string[];
  s: Array<[number, string, number, number, number, string]>;
  c: Array<[number, string, number, number, string]>;
}

export interface ShareGameDataV2 {
  v: 2;
  pc: number;
  d: string;
  p: string[];
  s: Array<[number, number, number] | [number, number, number, number, string]>;
  c?: Array<[number, number, number] | [number, number, number, number, string]>;
}

export type ShareGameData = ShareGameDataV1 | ShareGameDataV2;

export const validateShareData = (data: unknown): data is ShareGameData => {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    (d.v === 1 || d.v === 2) &&
    typeof d.pc === 'number' &&
    typeof d.d === 'string' &&
    Array.isArray(d.p) &&
    d.p.every((p: unknown) => typeof p === 'string')
  );
};

// ディープリンク定数
export const DEEP_LINK_SCHEME = 'mahjong-score';
export const DEEP_LINK_HOST = 'import';

// 共有コードからディープリンクURLを生成
export const buildShareUrl = (shareCode: string): string => {
  return `${DEEP_LINK_SCHEME}://${DEEP_LINK_HOST}?code=${encodeURIComponent(shareCode)}`;
};

// ディープリンクURLから共有コードを抽出（null = 該当なし）
export const parseShareUrl = (url: string): string | null => {
  try {
    // mahjong-score://import?code=<base64> 形式
    const prefix = `${DEEP_LINK_SCHEME}://${DEEP_LINK_HOST}`;
    if (!url.startsWith(prefix)) return null;
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    return params.get('code') || null;
  } catch {
    return null;
  }
};

// 日付フォーマット（YYYY/MM/DD）
export const formatDate = (date: Date): string => {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};

// 表示用時刻フォーマット（M月D日HH:mm）
export const formatTime = (date: Date): string => {
  return `${date.getMonth() + 1}月${date.getDate()}日${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
