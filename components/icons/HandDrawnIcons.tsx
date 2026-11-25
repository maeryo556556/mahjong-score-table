// オリジナルの手書き風アイコン（Issue #62: 画面表示用の絵文字を置き換え）
// すべての線を sketch.ts の揺らぎ付きパスで描き、さらに細く薄い「二度書き」の線を重ねて
// ラフなペン画の風合いに統一している。塗りは線から少しずらして色鉛筆のはみ出し感を出す。
// Issue #66: 候補ボードからユーザーが選んだデザインに各アイコンを描き直した（TileFanIcon を除く）。
// Issue #67: TileFanIcon を金の五筒（1枚の牌）に描き直した。
import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Point, wobblyCircle, wobblyCurve, wobblyLine } from './sketch';

// ---------------------------------------------------------------------------
// 図形の定義と共通レンダラー
// ---------------------------------------------------------------------------

/** 'stroke' / 'fill' はアイコンの props の色、それ以外は色そのもの */
type ColorRef = 'stroke' | 'fill' | string;

export type Shape =
  | { kind: 'line'; points: Point[]; closed?: boolean; width?: number; color?: ColorRef }
  | { kind: 'curve'; points: Point[]; closed?: boolean; width?: number; color?: ColorRef }
  | { kind: 'circle'; cx: number; cy: number; r: number; width?: number; color?: ColorRef }
  | { kind: 'fillPoly'; points: Point[]; color: ColorRef }
  /** 点列を角の丸い滑らかな閉曲線として塗る（ぷっくりした形用） */
  | { kind: 'fillCurve'; points: Point[]; color: ColorRef }
  | { kind: 'fillCircle'; cx: number; cy: number; r: number; color: ColorRef };

const BASE_WIDTH = 1.7;
const FILL_OFFSET = 0.5; // 塗りを線からずらす量（viewBox 単位）
const OVERDRAW_OPACITY = 0.35;

type RenderedPath =
  | { type: 'path'; d: string; stroke?: ColorRef; fill?: ColorRef; width?: number; opacity?: number }
  | { type: 'circle'; cx: number; cy: number; r: number; fill: ColorRef };

/** 線の揺らぎの調整（指定しなければ sketch.ts の既定値。アプリ内のアイコンは既定のまま） */
export interface SketchWobble {
  /** 揺らぎの大きさ（viewBox 単位） */
  amplitude?: number;
  /** 直線に揺らぎ点を入れる間隔（viewBox 単位） */
  step?: number;
}

function strokePath(shape: Shape, seed: number, wobble?: SketchWobble): string {
  switch (shape.kind) {
    case 'line':
      return wobblyLine(shape.points, seed, { closed: shape.closed, ...wobble });
    case 'curve':
      return wobblyCurve(shape.points, seed, { closed: shape.closed, amplitude: wobble?.amplitude });
    case 'circle':
      return wobblyCircle(shape.cx, shape.cy, shape.r, seed);
    default:
      return '';
  }
}

/** 図形の一覧から描画用のパスを作る。塗り → 本線 → 二度書きの順に重ねる */
function buildPaths(shapes: Shape[], seed: number, wobble?: SketchWobble): RenderedPath[] {
  const fills: RenderedPath[] = [];
  const strokes: RenderedPath[] = [];
  shapes.forEach((shape, i) => {
    const s = seed * 1000 + i * 37;
    if (shape.kind === 'fillPoly') {
      const d =
        shape.points
          .map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${(x + FILL_OFFSET).toFixed(2)} ${(y + FILL_OFFSET).toFixed(2)}`)
          .join('') + 'Z';
      fills.push({ type: 'path', d, fill: shape.color });
      return;
    }
    if (shape.kind === 'fillCurve') {
      const shifted = shape.points.map(([x, y]): Point => [x + FILL_OFFSET, y + FILL_OFFSET]);
      fills.push({ type: 'path', d: wobblyCurve(shifted, s, { closed: true, amplitude: 0 }) + 'Z', fill: shape.color });
      return;
    }
    if (shape.kind === 'fillCircle') {
      fills.push({ type: 'circle', cx: shape.cx + FILL_OFFSET * 0.6, cy: shape.cy + FILL_OFFSET * 0.6, r: shape.r, fill: shape.color });
      return;
    }
    const width = (shape.width ?? 1) * BASE_WIDTH;
    const color = shape.color ?? 'stroke';
    strokes.push({ type: 'path', d: strokePath(shape, s, wobble), stroke: color, width });
    strokes.push({ type: 'path', d: strokePath(shape, s + 101, wobble), stroke: color, width: width * 0.55, opacity: OVERDRAW_OPACITY });
  });
  return [...fills, ...strokes];
}

export interface HandDrawnIconProps {
  /** 一辺のサイズ（px）。既定 24 */
  size?: number;
  /** 線の色 */
  color?: string;
  /** 塗りの色（アイコンごとに既定あり） */
  fill?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * 図形の一覧を手書き風の SVG 要素として描く（<Svg> の中で使う）。
 * アイコン以外（タイトルロゴなど）でも同じ線の風合いで描けるように切り出している。
 */
export function SketchShapes({
  shapes,
  seed,
  color,
  fill,
  transform,
  wobble,
}: {
  shapes: Shape[];
  seed: number;
  color: string;
  fill: string;
  transform?: string;
  /** 線の揺らぎを弱めたいとき（アプリアイコンなど）に指定する。省略時は従来どおり */
  wobble?: SketchWobble;
}) {
  const amplitude = wobble?.amplitude;
  const step = wobble?.step;
  const paths = useMemo(
    () => buildPaths(shapes, seed, amplitude === undefined && step === undefined ? undefined : { amplitude, step }),
    [shapes, seed, amplitude, step],
  );
  const resolve = (c: ColorRef | undefined) => (c === 'stroke' ? color : c === 'fill' ? fill : c);
  return (
    <G transform={transform}>
      {paths.map((p, i) =>
        p.type === 'circle' ? (
          <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={resolve(p.fill)} />
        ) : (
          <Path
            key={i}
            d={p.d}
            fill={p.fill ? resolve(p.fill) : 'none'}
            stroke={p.stroke ? resolve(p.stroke) : undefined}
            strokeWidth={p.width}
            strokeOpacity={p.opacity}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </G>
  );
}

function SketchIcon({
  shapes,
  seed,
  size = 24,
  color,
  fill,
  style,
  testID,
}: { shapes: Shape[]; seed: number; color: string; fill: string } & Omit<HandDrawnIconProps, 'color' | 'fill'>) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style}
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <SketchShapes shapes={shapes} seed={seed} color={color} fill={fill} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// 形状ヘルパー
// ---------------------------------------------------------------------------

const rotate = ([x, y]: Point, [cx, cy]: Point, deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};

const arc = (cx: number, cy: number, r: number, fromDeg: number, toDeg: number, n = 6): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Point;
  });

/** 点列を中心まわりに楕円で並べる（ツヤなどの小さな塗り用） */
const ellipse = (cx: number, cy: number, rx: number, ry: number, deg: number, n = 8): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return rotate([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], [cx, cy], deg);
  });

const lerp = ([x1, y1]: Point, [x2, y2]: Point, t: number): Point => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];

const rect = (x1: number, y1: number, x2: number, y2: number): Point[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

// ---------------------------------------------------------------------------
// 牌（4人麻雀・タイトル・ポイント入力）
// ---------------------------------------------------------------------------

const TILE_FACE = '#fffaf0';
const TILE_MARK = '#d84343';

/** 「中」の牌。右下に背面の緑がのぞく立体感のある定番型 */
export const TILE_SHAPES: Shape[] = [
  // 牌の厚み（背面の緑）
  { kind: 'fillPoly', points: rect(6.6, 4.6, 20.4, 22.4), color: 'fill' },
  { kind: 'line', points: [[19, 3.2], [20.6, 4.8], [20.6, 22.6], [6.6, 22.6], [5, 21]], width: 0.9 },
  // 表面
  { kind: 'fillPoly', points: rect(4.6, 2.6, 18.6, 20.6), color: TILE_FACE },
  { kind: 'line', points: rect(4.4, 2.6, 18.8, 20.8), closed: true },
  // 「中」の字：口 と縦画
  { kind: 'line', points: [[8, 8.4], [8.3, 14.2]], width: 0.95, color: TILE_MARK },
  { kind: 'line', points: [[8, 8.4], [15.2, 8.2], [15, 14]], width: 0.95, color: TILE_MARK },
  { kind: 'line', points: [[8.3, 13.9], [15, 13.8]], width: 0.9, color: TILE_MARK },
  { kind: 'line', points: [[11.6, 5], [11.7, 18.2]], width: 1.05, color: TILE_MARK },
];

/** 麻雀牌「中」（4人麻雀・タイトルなど） */
export function TileIcon({ color = '#3e2723', fill = '#43a047', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={TILE_SHAPES} seed={1} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 金の五筒（3人麻雀）  Issue #67: 扇状の2枚牌から B案のデザインに変更
// ---------------------------------------------------------------------------

const PIN_GOLD = '#f6c445';
const PIN_RING = '#a8780a';
const PIN_R = 2.3;
const PIN_INNER_R = 1.35;

/** 五筒の丸の位置（四隅＋中央の「五」の形） */
const FIVE_PIN_CENTERS: Point[] = [
  [8.2, 6.6],
  [15, 6.6],
  [11.6, 11.6],
  [8.2, 16.6],
  [15, 16.6],
];

const TILE_FAN_SHAPES: Shape[] = [
  // 白〜クリーム色の牌1枚
  { kind: 'fillPoly', points: rect(4.6, 2.6, 18.6, 20.6), color: TILE_FACE },
  { kind: 'line', points: rect(4.4, 2.6, 18.8, 20.8), closed: true },
  // 金色の丸（塗り）＋濃い金の二重リング
  ...FIVE_PIN_CENTERS.flatMap(([cx, cy]): Shape[] => [
    { kind: 'fillCircle', cx, cy, r: PIN_R, color: 'fill' },
    { kind: 'circle', cx, cy, r: PIN_R, width: 0.42, color: PIN_RING },
    { kind: 'circle', cx, cy, r: PIN_INNER_R, width: 0.28, color: PIN_RING },
  ]),
];

/** 金の五筒の牌（3人麻雀）。名前は互換のため TileFanIcon のまま */
export function TileFanIcon({ color = '#3e2723', fill = PIN_GOLD, ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={TILE_FAN_SHAPES} seed={2} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 順位メダル
// ---------------------------------------------------------------------------

/** 順位ごとのコインの色（1位: 金、2位: 銀、3位: 銅） */
const MEDAL_COINS: Record<1 | 2 | 3, string> = {
  1: '#f6c445',
  2: '#cfd8dc',
  3: '#d79a62',
};
const MEDAL_RIBBON_LEFT = '#e05a5a';
const MEDAL_RIBBON_RIGHT = '#4a7fd4';

const MEDAL_NUMERALS: Record<1 | 2 | 3, Shape[]> = {
  1: [
    { kind: 'line', points: [[10.8, 14], [12.3, 12.7], [12.3, 18.6]], width: 0.9 },
    { kind: 'line', points: [[10.9, 18.6], [13.6, 18.6]], width: 0.8 },
  ],
  2: [
    { kind: 'curve', points: [[10.2, 13.9], [11.4, 12.6], [13.3, 12.9], [13.6, 14.4], [12.4, 16.2], [10.3, 18.4]], width: 0.9 },
    { kind: 'line', points: [[10.3, 18.4], [13.9, 18.3]], width: 0.9 },
  ],
  3: [
    { kind: 'curve', points: [[10.3, 13.3], [12, 12.6], [13.5, 13.5], [13, 15], [11.6, 15.4]], width: 0.9 },
    { kind: 'curve', points: [[11.6, 15.4], [13.4, 15.8], [13.8, 17.2], [12.4, 18.5], [10.2, 17.9]], width: 0.9 },
  ],
};

/** 赤と青のリボンが付いた定番メダル。順位ごとの色の円に順位数字 */
const medalShapes = (rank: 1 | 2 | 3): Shape[] => {
  const left: Point[] = [[4.6, 1.6], [9.2, 1.6], [13.2, 9.8], [9.4, 10.8]];
  const right: Point[] = [[19.4, 1.6], [14.8, 1.6], [10.8, 9.8], [14.6, 10.8]];
  return [
    // 右（青）を奥、左（赤）を手前に重ねてリボンが交差して見えるようにする
    { kind: 'fillPoly', points: right, color: MEDAL_RIBBON_RIGHT },
    { kind: 'line', points: right, closed: true, width: 0.85 },
    { kind: 'fillPoly', points: left, color: MEDAL_RIBBON_LEFT },
    { kind: 'line', points: left, closed: true, width: 0.85 },
    // リボンの中央線
    { kind: 'line', points: [[7, 2.6], [10.6, 9.6]], width: 0.45, color: '#fff' },
    { kind: 'line', points: [[17, 2.6], [13.4, 9.6]], width: 0.45, color: '#fff' },
    // コイン（色は順位ごとに MedalIcon の fill で切り替える）
    { kind: 'fillCircle', cx: 12, cy: 15.6, r: 6.6, color: 'fill' },
    { kind: 'circle', cx: 12, cy: 15.6, r: 6.6 },
    { kind: 'circle', cx: 12, cy: 15.6, r: 4.8, width: 0.55 },
    ...MEDAL_NUMERALS[rank],
  ];
};

const MEDAL_SHAPES: Record<1 | 2 | 3, Shape[]> = {
  1: medalShapes(1),
  2: medalShapes(2),
  3: medalShapes(3),
};

/** 順位メダル（1〜3位）。コインは 1位=金、2位=銀、3位=銅 */
export function MedalIcon({
  rank,
  color = '#4e342e',
  fill,
  ...rest
}: HandDrawnIconProps & { rank: 1 | 2 | 3 }) {
  return (
    <SketchIcon shapes={MEDAL_SHAPES[rank]} seed={10 + rank} color={color} fill={fill ?? MEDAL_COINS[rank]} {...rest} />
  );
}

// ---------------------------------------------------------------------------
// 波打つチェッカーフラッグ（ゲーム終了）
// ---------------------------------------------------------------------------

const FLAG_X0 = 5.4;
const FLAG_X1 = 21;
const FLAG_HEIGHT = 9;
const FLAG_COLS = 4;
const FLAG_ROWS = 3;

/** 旗の上端の y 座標（横方向に1波ぶん波打つ） */
const flagTop = (x: number) => 3.4 + 1.3 * Math.sin(((x - FLAG_X0) / (FLAG_X1 - FLAG_X0)) * Math.PI * 2);
/** 旗の面上の点（u: 0〜1 で横、v: 0〜1 で縦） */
const flagPoint = (u: number, v: number): Point => {
  const x = FLAG_X0 + (FLAG_X1 - FLAG_X0) * u;
  return [x, flagTop(x) + FLAG_HEIGHT * v];
};
/** 旗の横方向の辺を細かく区切った点列 */
const flagEdge = (v: number, u0 = 0, u1 = 1, n = 8): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => flagPoint(u0 + ((u1 - u0) * i) / n, v));

const flagCell = (col: number, row: number): Point[] => {
  const u0 = col / FLAG_COLS;
  const u1 = (col + 1) / FLAG_COLS;
  const v0 = row / FLAG_ROWS;
  const v1 = (row + 1) / FLAG_ROWS;
  return [...flagEdge(v0, u0, u1, 3), ...flagEdge(v1, u0, u1, 3).reverse()];
};

const FLAG_SHAPES: Shape[] = [
  // 白地
  { kind: 'fillPoly', points: [...flagEdge(0), ...flagEdge(1).reverse()], color: '#fff' },
  // 市松模様（塗りの色）
  ...Array.from({ length: FLAG_COLS * FLAG_ROWS }, (_, i) => ({ col: i % FLAG_COLS, row: Math.floor(i / FLAG_COLS) }))
    .filter(({ col, row }) => (col + row) % 2 === 0)
    .map(({ col, row }): Shape => ({ kind: 'fillPoly', points: flagCell(col, row), color: 'fill' })),
  // 輪郭
  { kind: 'curve', points: flagEdge(0, 0, 1, 6) },
  { kind: 'curve', points: flagEdge(1, 0, 1, 6) },
  { kind: 'line', points: [flagPoint(1, 0), flagPoint(1, 1)] },
  // ポールと先端の玉
  { kind: 'line', points: [[5.2, 2.4], [5.4, 22]], width: 1.15 },
  { kind: 'fillCircle', cx: 5.2, cy: 1.9, r: 1.1, color: '#f6c445' },
  { kind: 'circle', cx: 5.2, cy: 1.9, r: 1.1, width: 0.55 },
];

/** 波打つチェッカーフラッグ（ゲーム終了） */
export function GoalFlagIcon({ color = '#37474f', fill = '#37474f', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={FLAG_SHAPES} seed={20} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 紙吹雪が飛び出すクラッカー（チップ）
// ---------------------------------------------------------------------------

const POPPER_TIP: Point = [2.8, 21.2];
const POPPER_L: Point = [6.4, 9.6];
const POPPER_R: Point = [14.4, 17.6];
const POPPER_MOUTH: Point[] = [POPPER_L, [10, 11.2], [12.8, 14], POPPER_R];
const POPPER_STRIPE = '#e05a5a';

const CELEBRATE_SHAPES: Shape[] = [
  // 円すい形の本体と縞模様
  { kind: 'fillPoly', points: [POPPER_TIP, POPPER_L, ...POPPER_MOUTH.slice(1, -1), POPPER_R], color: 'fill' },
  { kind: 'line', points: [lerp(POPPER_TIP, POPPER_L, 0.45), lerp(POPPER_TIP, POPPER_R, 0.45)], width: 0.85, color: POPPER_STRIPE },
  { kind: 'line', points: [lerp(POPPER_TIP, POPPER_L, 0.75), lerp(POPPER_TIP, POPPER_R, 0.75)], width: 0.85, color: POPPER_STRIPE },
  { kind: 'line', points: [POPPER_L, POPPER_TIP, POPPER_R], width: 0.95 },
  { kind: 'curve', points: POPPER_MOUTH, width: 0.95 },
  // 飛び出す紙テープと紙吹雪
  { kind: 'curve', points: [[10.6, 11], [11.4, 7.4], [10, 5], [11.6, 2.2]], width: 0.75, color: '#4a7fd4' },
  { kind: 'curve', points: [[13, 13.4], [16.4, 12.4], [18.2, 14.4], [21.4, 13.4]], width: 0.75, color: '#3f9e6b' },
  { kind: 'line', points: [[14.4, 6.6], [15.6, 8], [16.8, 6.4], [18, 7.8], [19.2, 6.2]], width: 0.7, color: POPPER_STRIPE },
  { kind: 'fillCircle', cx: 19.8, cy: 10.4, r: 1, color: '#ec6fa0' },
  { kind: 'fillCircle', cx: 15.4, cy: 3, r: 0.9, color: '#f6c445' },
  { kind: 'circle', cx: 20.2, cy: 3, r: 1.1, width: 0.55, color: '#4a7fd4' },
  { kind: 'fillPoly', points: [[17.6, 17.4], [19.2, 16.8], [19.7, 18.3], [18.1, 18.9]], color: '#ec6fa0' },
  { kind: 'fillCircle', cx: 7.2, cy: 5.4, r: 0.8, color: '#3f9e6b' },
];

/** 紙吹雪が飛び出すクラッカー（チップ） */
export function CelebrateIcon({ color = '#5d4037', fill = '#ffd54f', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={CELEBRATE_SHAPES} seed={30} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 電波（リアルタイム共有・閲覧モード）
// ---------------------------------------------------------------------------

const SIGNAL_ORIGIN: Point = [5, 19];

const BROADCAST_SHAPES: Shape[] = [
  // 左下の点から右上へ広がる3本のアーク
  { kind: 'curve', points: arc(SIGNAL_ORIGIN[0], SIGNAL_ORIGIN[1], 5.4, -84, -6, 4), width: 1.05 },
  { kind: 'curve', points: arc(SIGNAL_ORIGIN[0], SIGNAL_ORIGIN[1], 9.8, -84, -6, 6), width: 1.05 },
  { kind: 'curve', points: arc(SIGNAL_ORIGIN[0], SIGNAL_ORIGIN[1], 14.2, -84, -6, 8), width: 1.05 },
  { kind: 'fillCircle', cx: SIGNAL_ORIGIN[0], cy: SIGNAL_ORIGIN[1], r: 2, color: 'fill' },
  { kind: 'circle', cx: SIGNAL_ORIGIN[0], cy: SIGNAL_ORIGIN[1], r: 2, width: 0.8 },
];

/** 点から右上へ広がる電波（リアルタイム共有・閲覧モード） */
export function BroadcastIcon({ color = '#fff', fill = '#ff7043', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={BROADCAST_SHAPES} seed={40} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 紙飛行機（終了済みゲームの共有中）
// ---------------------------------------------------------------------------

const PLANE_NOSE: Point = [21.4, 2.8];
const PLANE_WING: Point = [3.4, 9.6];
const PLANE_FOLD: Point = [10.8, 12.6];
const PLANE_TAIL: Point = [14.2, 20.4];
const PLANE_SKY = '#81d4fa';

const SEND_SHAPES: Shape[] = [
  // 片面だけ水色、もう片面は塗りの色
  { kind: 'fillPoly', points: [PLANE_NOSE, PLANE_WING, PLANE_FOLD], color: PLANE_SKY },
  { kind: 'fillPoly', points: [PLANE_NOSE, PLANE_FOLD, PLANE_TAIL], color: 'fill' },
  { kind: 'line', points: [PLANE_NOSE, PLANE_WING, PLANE_FOLD, PLANE_TAIL], closed: true, width: 0.95 },
  { kind: 'line', points: [PLANE_NOSE, PLANE_FOLD], width: 0.7 },
  // 後ろに引く点線の軌跡
  ...([[8.8, 15.6], [6.9, 17.3], [5, 18.6], [3, 19.6]] as Point[]).map(
    ([x, y]): Shape => ({ kind: 'line', points: [[x + 0.55, y - 0.45], [x - 0.55, y + 0.45]], width: 0.75 }),
  ),
];

/** 点線の軌跡を引く紙飛行機（共有中） */
export function SendIcon({ color = '#fff', fill = 'rgba(255,255,255,0.35)', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={SEND_SHAPES} seed={50} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 鉛筆と書いた線（名前変更）
// ---------------------------------------------------------------------------

// 先端 (5, 16.6) から右上へ伸びる鉛筆。s: 軸方向の距離、w: 軸に垂直な方向のずれ
const pencil = (s: number, w: number): Point => {
  const k = Math.SQRT1_2;
  return [5 + s * k + w * k, 16.6 - s * k + w * k];
};

const PENCIL_SHAPES: Shape[] = [
  // 下に書いた赤い線
  { kind: 'curve', points: [[3.2, 20.4], [7, 19.4], [10.6, 20.8], [14.4, 19.6], [18, 20.8], [21.2, 19.8]], width: 1, color: '#ef5350' },
  // 軸・削った木・消しゴム
  { kind: 'fillPoly', points: [pencil(3.8, -2.3), pencil(15, -2.3), pencil(15, 2.3), pencil(3.8, 2.3)], color: 'fill' },
  { kind: 'fillPoly', points: [pencil(3.8, -2.3), pencil(0, 0), pencil(3.8, 2.3)], color: '#f5d6a8' },
  { kind: 'fillPoly', points: [pencil(15, -2.3), pencil(18, -2.3), pencil(18, 2.3), pencil(15, 2.3)], color: '#f48fb1' },
  { kind: 'line', points: [pencil(3.8, -2.3), pencil(18, -2.3), pencil(18, 2.3), pencil(3.8, 2.3)], closed: true, width: 0.95 },
  { kind: 'line', points: [pencil(3.8, -2.3), pencil(0, 0), pencil(3.8, 2.3)], width: 0.95 },
  { kind: 'line', points: [pencil(15, -2.3), pencil(15, 2.3)], width: 0.7 },
  { kind: 'line', points: [pencil(5.4, 0), pencil(13.6, 0)], width: 0.5 },
  { kind: 'fillPoly', points: [pencil(0, 0), pencil(1.5, -0.9), pencil(1.5, 0.9)], color: 'stroke' },
];

/** 斜めに置いた鉛筆と書いた線（名前変更） */
export function PencilIcon({ color = '#fff', fill = '#ffca28', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={PENCIL_SHAPES} seed={60} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// ぷっくりした星（お気に入り）
// ---------------------------------------------------------------------------

// 頂点を制御点にした滑らかな閉曲線で描くため、角が丸くふくらんだ形になる
const STAR_POINTS: Point[] = Array.from({ length: 10 }, (_, i) => {
  const a = ((-90 + i * 36) * Math.PI) / 180;
  const r = i % 2 === 0 ? 11.6 : 5.4;
  return [12 + Math.cos(a) * r, 13 + Math.sin(a) * r] as Point;
});

const STAR_OUTLINE: Shape[] = [{ kind: 'curve', points: STAR_POINTS, closed: true, width: 0.95 }];
const STAR_FILLED: Shape[] = [
  { kind: 'fillCurve', points: STAR_POINTS, color: 'fill' },
  ...STAR_OUTLINE,
  // 白いツヤ
  { kind: 'fillCurve', points: ellipse(9.2, 10.6, 1.7, 0.75, -35), color: 'rgba(255,255,255,0.9)' },
  { kind: 'fillCircle', cx: 7.4, cy: 12.6, r: 0.5, color: 'rgba(255,255,255,0.9)' },
];

/** ぷっくりした星（お気に入り）。filled で塗りつぶし＋ツヤ */
export function StarIcon({
  filled = false,
  color = filled ? '#c17900' : '#adb5bd',
  fill = '#ffca28',
  ...rest
}: HandDrawnIconProps & { filled?: boolean }) {
  return <SketchIcon shapes={filled ? STAR_FILLED : STAR_OUTLINE} seed={70} color={color} fill={fill} {...rest} />;
}
