// 手書き風アイコン用のパス生成ヘルパー（Issue #62）
// 直線・円などの図形に、シード付きの乱数で小さな揺らぎを加えた SVG パス文字列を作る。
// シードが同じなら常に同じ形になるため、再描画しても線が震えない。

export type Point = [number, number];

/** シード付き疑似乱数（mulberry32）。0 以上 1 未満を返す */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** 点列を、中点を通る二次ベジェで滑らかにつないだパスにする */
function smoothPath(points: Point[], closed: boolean): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    const [a, b] = points;
    return `M${fmt(a[0])} ${fmt(a[1])}L${fmt(b[0])} ${fmt(b[1])}`;
  }
  const pts = closed ? [...points, points[0], points[1]] : points;
  const mid = (p: Point, q: Point): Point => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const start = closed ? mid(pts[0], pts[1]) : pts[0];
  let d = `M${fmt(start[0])} ${fmt(start[1])}`;
  const last = pts.length - 1;
  for (let i = 1; i < last; i++) {
    const m = mid(pts[i], pts[i + 1]);
    const end = !closed && i === last - 1 ? pts[last] : m;
    d += `Q${fmt(pts[i][0])} ${fmt(pts[i][1])} ${fmt(end[0])} ${fmt(end[1])}`;
  }
  return d;
}

export interface WobbleOptions {
  /** 揺らぎの大きさ（viewBox 単位）。既定 0.35 */
  amplitude?: number;
  /** 何単位ごとに揺らぎ点を入れるか。既定 4 */
  step?: number;
  /** 閉じた図形として扱うか */
  closed?: boolean;
}

/**
 * 折れ線を手書き風の揺らぎのある線にする。
 * 各辺を細かく分割し、線に垂直な方向へ少しずらした点を通す。頂点は鋭さを保つ。
 */
export function wobblyLine(points: Point[], seed: number, options: WobbleOptions = {}): string {
  const { amplitude = 0.35, step = 4, closed = false } = options;
  const rand = createRandom(seed);
  const jitter = () => (rand() * 2 - 1) * amplitude;
  const src = closed ? [...points, points[0]] : points;
  // 頂点の角を残すため、辺ごとに独立したサブパスとして描く
  let d = '';
  for (let i = 0; i < src.length - 1; i++) {
    const [x1, y1] = src[i];
    const [x2, y2] = src[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(len / step));
    const nx = len === 0 ? 0 : -(y2 - y1) / len;
    const ny = len === 0 ? 0 : (x2 - x1) / len;
    const seg: Point[] = [[x1 + jitter() * 0.5, y1 + jitter() * 0.5]];
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const off = jitter();
      seg.push([x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off]);
    }
    seg.push([x2 + jitter() * 0.5, y2 + jitter() * 0.5]);
    d += smoothPath(seg, false);
  }
  return d;
}

/** 点列をそのまま揺らぎのある滑らかな曲線にする（頂点を丸める） */
export function wobblyCurve(points: Point[], seed: number, options: WobbleOptions = {}): string {
  const { amplitude = 0.35, closed = false } = options;
  const rand = createRandom(seed);
  const pts = points.map(([x, y]): Point => [
    x + (rand() * 2 - 1) * amplitude,
    y + (rand() * 2 - 1) * amplitude,
  ]);
  return smoothPath(pts, closed);
}

/**
 * 手描きの円。半径に揺らぎを入れ、書き始めと書き終わりを少し重ねて
 * （ペンで一筆書きしたように）閉じきらない形にする。
 */
export function wobblyCircle(
  cx: number,
  cy: number,
  r: number,
  seed: number,
  options: { amplitude?: number; overlap?: number } = {},
): string {
  const { amplitude = 0.06, overlap = 0.35 } = options;
  const rand = createRandom(seed);
  const start = rand() * Math.PI * 2;
  const total = Math.PI * 2 + overlap;
  const n = Math.max(10, Math.round(r * 3));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (total * i) / n;
    // 書き終わりに向かって少しだけ内側へずれていく
    const rr = r * (1 + (rand() * 2 - 1) * amplitude - (i / n) * 0.05);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smoothPath(pts, false);
}
