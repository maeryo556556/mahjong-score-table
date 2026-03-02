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

// 共有コードエンコード（JSON → Base64）
export const encodeShareCode = (json: string): string => {
  return btoa(
    encodeURIComponent(json).replace(
      /%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16))
    )
  );
};

// 共有コードデコード（Base64 → JSON）
export const decodeShareCode = (code: string): string => {
  const binary = atob(code);
  return decodeURIComponent(
    binary
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
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
  s: Array<[number, number, number]>;
  c?: Array<[number, number, number]>;
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

// 日付フォーマット（YYYY/MM/DD）
export const formatDate = (date: Date): string => {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};

// 表示用時刻フォーマット（M月D日HH:mm）
export const formatTime = (date: Date): string => {
  return `${date.getMonth() + 1}月${date.getDate()}日${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
