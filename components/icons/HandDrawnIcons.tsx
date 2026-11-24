// オリジナルの手書き風アイコン（Issue #62: 画面表示用の絵文字を置き換え）
// すべての線を sketch.ts の揺らぎ付きパスで描き、さらに細く薄い「二度書き」の線を重ねて
// ラフなペン画の風合いに統一している。塗りは線から少しずらして色鉛筆のはみ出し感を出す。
import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Point, wobblyCircle, wobblyCurve, wobblyLine } from './sketch';

// ---------------------------------------------------------------------------
// 図形の定義と共通レンダラー
// ---------------------------------------------------------------------------

/** 'stroke' / 'fill' はアイコンの props の色、それ以外は色そのもの */
type ColorRef = 'stroke' | 'fill' | string;

type Shape =
  | { kind: 'line'; points: Point[]; closed?: boolean; width?: number; color?: ColorRef }
  | { kind: 'curve'; points: Point[]; closed?: boolean; width?: number; color?: ColorRef }
  | { kind: 'circle'; cx: number; cy: number; r: number; width?: number; color?: ColorRef }
  | { kind: 'fillPoly'; points: Point[]; color: ColorRef }
  | { kind: 'fillCircle'; cx: number; cy: number; r: number; color: ColorRef };

const BASE_WIDTH = 1.7;
const FILL_OFFSET = 0.5; // 塗りを線からずらす量（viewBox 単位）
const OVERDRAW_OPACITY = 0.35;

type RenderedPath =
  | { type: 'path'; d: string; stroke?: ColorRef; fill?: ColorRef; width?: number; opacity?: number }
  | { type: 'circle'; cx: number; cy: number; r: number; fill: ColorRef };

function strokePath(shape: Shape, seed: number): string {
  switch (shape.kind) {
    case 'line':
      return wobblyLine(shape.points, seed, { closed: shape.closed });
    case 'curve':
      return wobblyCurve(shape.points, seed, { closed: shape.closed });
    case 'circle':
      return wobblyCircle(shape.cx, shape.cy, shape.r, seed);
    default:
      return '';
  }
}

/** 図形の一覧から描画用のパスを作る。塗り → 本線 → 二度書きの順に重ねる */
function buildPaths(shapes: Shape[], seed: number): RenderedPath[] {
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
    if (shape.kind === 'fillCircle') {
      fills.push({ type: 'circle', cx: shape.cx + FILL_OFFSET * 0.6, cy: shape.cy + FILL_OFFSET * 0.6, r: shape.r, fill: shape.color });
      return;
    }
    const width = (shape.width ?? 1) * BASE_WIDTH;
    const color = shape.color ?? 'stroke';
    strokes.push({ type: 'path', d: strokePath(shape, s), stroke: color, width });
    strokes.push({ type: 'path', d: strokePath(shape, s + 101), stroke: color, width: width * 0.55, opacity: OVERDRAW_OPACITY });
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

function SketchIcon({
  shapes,
  seed,
  size = 24,
  color,
  fill,
  style,
  testID,
}: { shapes: Shape[]; seed: number; color: string; fill: string } & Omit<HandDrawnIconProps, 'color' | 'fill'>) {
  const paths = useMemo(() => buildPaths(shapes, seed), [shapes, seed]);
  const resolve = (c: ColorRef | undefined) => (c === 'stroke' ? color : c === 'fill' ? fill : c);
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

const TILE_SHAPES: Shape[] = [
  // 牌の厚み（背面）
  { kind: 'fillPoly', points: rect(6.6, 4.6, 20.4, 22.4), color: 'fill' },
  { kind: 'line', points: [[19, 3.2], [20.6, 4.8], [20.6, 22.6], [6.6, 22.6], [5, 21]], width: 0.9 },
  // 表面
  { kind: 'fillPoly', points: rect(4.6, 2.6, 18.6, 20.6), color: TILE_FACE },
  { kind: 'line', points: rect(4.4, 2.6, 18.8, 20.8), closed: true },
  // 面の模様：二重丸と中心の点
  { kind: 'circle', cx: 11.6, cy: 11.7, r: 4, width: 0.8, color: TILE_MARK },
  { kind: 'circle', cx: 11.6, cy: 11.7, r: 1.9, width: 0.7, color: TILE_MARK },
  { kind: 'fillCircle', cx: 11.4, cy: 11.5, r: 0.7, color: TILE_MARK },
];

/** 麻雀牌（4人麻雀・タイトルなど） */
export function TileIcon({ color = '#3e2723', fill = '#43a047', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={TILE_SHAPES} seed={1} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 扇状に重ねた2枚の牌（3人麻雀）
// ---------------------------------------------------------------------------

const fanTile = (deg: number, dx: number): Point[] =>
  rect(6 + dx, 3, 16 + dx, 18.5).map(p => rotate(p, [11 + dx, 21], deg));

const FAN_BACK = fanTile(-14, -1.5);
const FAN_FRONT = fanTile(12, 2.5);
const backPivot: Point = [9.5, 21];
const frontPivot: Point = [13.5, 21];

const TILE_FAN_SHAPES: Shape[] = [
  // 奥の牌
  { kind: 'fillPoly', points: FAN_BACK, color: TILE_FACE },
  { kind: 'line', points: FAN_BACK, closed: true, width: 0.95 },
  // 奥の牌の模様：斜めに並ぶ3つの点
  ...([[7.6, 6.6], [9.6, 10.6], [11.6, 14.6]] as Point[]).map(
    (p): Shape => ({ kind: 'fillCircle', cx: rotate(p, backPivot, -14)[0], cy: rotate(p, backPivot, -14)[1], r: 1, color: 'fill' }),
  ),
  // 手前の牌
  { kind: 'fillPoly', points: FAN_FRONT, color: TILE_FACE },
  { kind: 'line', points: FAN_FRONT, closed: true },
  // 手前の牌の模様：節のある2本の棒
  { kind: 'line', points: [rotate([12.4, 6], frontPivot, 12), rotate([12.4, 15.5], frontPivot, 12)], width: 0.85, color: 'fill' },
  { kind: 'line', points: [rotate([16, 6], frontPivot, 12), rotate([16, 15.5], frontPivot, 12)], width: 0.85, color: 'fill' },
  { kind: 'line', points: [rotate([11.4, 10.7], frontPivot, 12), rotate([13.4, 10.7], frontPivot, 12)], width: 0.7, color: 'fill' },
  { kind: 'line', points: [rotate([15, 10.7], frontPivot, 12), rotate([17, 10.7], frontPivot, 12)], width: 0.7, color: 'fill' },
];

/** 扇状に重ねた牌（3人麻雀） */
export function TileFanIcon({ color = '#3e2723', fill = '#2e7d32', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={TILE_FAN_SHAPES} seed={2} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 順位メダル
// ---------------------------------------------------------------------------

const MEDAL_COLORS: Record<1 | 2 | 3, { coin: string; ribbon: string }> = {
  1: { coin: '#f6c445', ribbon: '#e05a5a' },
  2: { coin: '#cfd8dc', ribbon: '#4a7fd4' },
  3: { coin: '#d79a62', ribbon: '#3f9e6b' },
};

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

const medalShapes = (rank: 1 | 2 | 3): Shape[] => {
  const { coin, ribbon } = MEDAL_COLORS[rank];
  const left: Point[] = [[5, 1.6], [9.4, 1.6], [13, 9.6], [9.2, 10.6]];
  const right: Point[] = [[19, 1.6], [14.6, 1.6], [11, 9.6], [14.8, 10.6]];
  return [
    { kind: 'fillPoly', points: left, color: ribbon },
    { kind: 'fillPoly', points: right, color: ribbon },
    { kind: 'line', points: left, closed: true, width: 0.85 },
    { kind: 'line', points: right, closed: true, width: 0.85 },
    { kind: 'fillCircle', cx: 12, cy: 15.6, r: 6.6, color: coin },
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

/** 順位メダル（1〜3位） */
export function MedalIcon({ rank, color = '#4e342e', ...rest }: HandDrawnIconProps & { rank: 1 | 2 | 3 }) {
  return <SketchIcon shapes={MEDAL_SHAPES[rank]} seed={10 + rank} color={color} fill={MEDAL_COLORS[rank].coin} {...rest} />;
}

// ---------------------------------------------------------------------------
// ゴールの旗（ゲーム終了）
// ---------------------------------------------------------------------------

const FLAG_TOP: Point[] = [[5.2, 3.6], [8.5, 2.4], [12, 4.4], [16, 2.8], [20, 4]];
const FLAG_BOTTOM: Point[] = [[20, 12.4], [16.5, 11.2], [12.5, 13], [9, 10.9], [5.2, 12]];

const FLAG_SHAPES: Shape[] = [
  { kind: 'fillPoly', points: [...FLAG_TOP, ...FLAG_BOTTOM], color: 'fill' },
  { kind: 'curve', points: FLAG_TOP },
  { kind: 'line', points: [[20, 4], [20, 12.4]] },
  { kind: 'curve', points: FLAG_BOTTOM },
  // 斜線のハッチング
  { kind: 'line', points: [[9, 3.6], [7.4, 10.6]], width: 0.6 },
  { kind: 'line', points: [[12.6, 4.6], [11, 11.8]], width: 0.6 },
  { kind: 'line', points: [[16.4, 3.4], [14.8, 11.4]], width: 0.6 },
  // ポールと足元
  { kind: 'line', points: [[5, 2], [5.2, 21.6]], width: 1.1 },
  { kind: 'curve', points: [[1.8, 22], [4.2, 21.2], [6.4, 21.4], [9, 22.2]], width: 0.8 },
];

/** ゴールの旗（ゲーム終了） */
export function GoalFlagIcon({ color = '#37474f', fill = '#ff8a65', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={FLAG_SHAPES} seed={20} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// きらめきと紙吹雪（チップ）
// ---------------------------------------------------------------------------

const SPARKLE: Point[] = [[9.6, 5], [11, 11.6], [17.6, 13], [11, 14.4], [9.6, 21], [8.2, 14.4], [1.8, 13], [8.2, 11.6]];

const CELEBRATE_SHAPES: Shape[] = [
  { kind: 'fillPoly', points: SPARKLE, color: 'fill' },
  { kind: 'line', points: SPARKLE, closed: true, width: 0.95 },
  { kind: 'line', points: [[15.6, 3.6], [17, 5], [18.4, 3.4], [19.8, 4.8], [21.2, 3.4]], width: 0.75, color: '#e05a5a' },
  { kind: 'line', points: [[14.2, 7.2], [15.4, 8.8]], width: 0.75 },
  { kind: 'fillCircle', cx: 19.8, cy: 9.4, r: 1.15, color: '#ec6fa0' },
  { kind: 'circle', cx: 4.4, cy: 5, r: 1.3, width: 0.6, color: '#4a7fd4' },
  { kind: 'fillCircle', cx: 20.2, cy: 18.6, r: 0.95, color: '#4a7fd4' },
  { kind: 'line', points: [[15, 18], [17, 20]], width: 0.65, color: '#3f9e6b' },
  { kind: 'line', points: [[17, 18], [15, 20]], width: 0.65, color: '#3f9e6b' },
];

/** きらめきと紙吹雪（チップ） */
export function CelebrateIcon({ color = '#5d4037', fill = '#ffd54f', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={CELEBRATE_SHAPES} seed={30} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 電波塔（リアルタイム共有・閲覧モード）
// ---------------------------------------------------------------------------

const BROADCAST_SHAPES: Shape[] = [
  { kind: 'line', points: [[12, 11.2], [8.2, 22]] },
  { kind: 'line', points: [[12, 11.2], [15.8, 22]] },
  { kind: 'line', points: [[9.8, 17.4], [14.2, 17.4]], width: 0.75 },
  { kind: 'line', points: [[9.2, 20], [14.8, 20]], width: 0.6 },
  { kind: 'fillCircle', cx: 12, cy: 9.2, r: 1.9, color: 'fill' },
  { kind: 'circle', cx: 12, cy: 9.2, r: 1.9, width: 0.8 },
  { kind: 'curve', points: arc(12, 9.2, 4.6, -42, 42, 4), width: 0.85 },
  { kind: 'curve', points: arc(12, 9.2, 8.2, -48, 48, 6), width: 0.85 },
  { kind: 'curve', points: arc(12, 9.2, 4.6, 138, 222, 4), width: 0.85 },
  { kind: 'curve', points: arc(12, 9.2, 8.2, 132, 228, 6), width: 0.85 },
];

/** 電波塔（リアルタイム共有・閲覧モード） */
export function BroadcastIcon({ color = '#fff', fill = '#ff7043', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={BROADCAST_SHAPES} seed={40} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 送り出し（終了済みゲームの共有中）
// ---------------------------------------------------------------------------

const SEND_SHAPES: Shape[] = [
  { kind: 'fillPoly', points: [[4.4, 15.6], [19.6, 15.6], [19.6, 20.4], [4.4, 20.4]], color: 'fill' },
  { kind: 'line', points: [[4, 12.6], [4.2, 20.6], [19.8, 20.4], [20, 12.6]] },
  { kind: 'line', points: [[12, 16.4], [12, 3.4]] },
  { kind: 'line', points: [[7.6, 7.8], [12, 3.4], [16.4, 7.8]] },
  { kind: 'line', points: [[8, 12.4], [8, 10.4]], width: 0.6 },
  { kind: 'line', points: [[16, 12.4], [16, 10.4]], width: 0.6 },
];

/** 送り出し（共有中） */
export function SendIcon({ color = '#fff', fill = 'rgba(255,255,255,0.35)', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={SEND_SHAPES} seed={50} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 鉛筆（名前変更）
// ---------------------------------------------------------------------------

// 先端 (3.5, 20.5) から右上へ伸びる鉛筆。s: 軸方向の距離、w: 軸に垂直な方向のずれ
const pencil = (s: number, w: number): Point => {
  const k = Math.SQRT1_2;
  return [3.5 + s * k + w * k, 20.5 - s * k + w * k];
};

const PENCIL_SHAPES: Shape[] = [
  { kind: 'fillPoly', points: [pencil(4.2, -2.6), pencil(17, -2.6), pencil(17, 2.6), pencil(4.2, 2.6)], color: 'fill' },
  { kind: 'fillPoly', points: [pencil(17, -2.6), pencil(20, -2.6), pencil(20, 2.6), pencil(17, 2.6)], color: '#f48fb1' },
  { kind: 'line', points: [pencil(4.2, -2.6), pencil(20, -2.6), pencil(20, 2.6), pencil(4.2, 2.6)], closed: true, width: 0.95 },
  { kind: 'line', points: [pencil(4.2, -2.6), pencil(0, 0), pencil(4.2, 2.6)], width: 0.95 },
  { kind: 'line', points: [pencil(17, -2.6), pencil(17, 2.6)], width: 0.7 },
  { kind: 'line', points: [pencil(6, 0), pencil(15.6, 0)], width: 0.5 },
  { kind: 'fillPoly', points: [pencil(0, 0), pencil(1.6, -1), pencil(1.6, 1)], color: 'stroke' },
];

/** 鉛筆（名前変更） */
export function PencilIcon({ color = '#fff', fill = '#ffca28', ...rest }: HandDrawnIconProps) {
  return <SketchIcon shapes={PENCIL_SHAPES} seed={60} color={color} fill={fill} {...rest} />;
}

// ---------------------------------------------------------------------------
// 星（お気に入り）
// ---------------------------------------------------------------------------

const STAR_POINTS: Point[] = Array.from({ length: 10 }, (_, i) => {
  const a = ((-90 + i * 36) * Math.PI) / 180;
  const r = i % 2 === 0 ? 10 : 4.3;
  return [12 + Math.cos(a) * r, 12.8 + Math.sin(a) * r] as Point;
});

const STAR_OUTLINE: Shape[] = [{ kind: 'line', points: STAR_POINTS, closed: true, width: 0.95 }];
const STAR_FILLED: Shape[] = [{ kind: 'fillPoly', points: STAR_POINTS, color: 'fill' }, ...STAR_OUTLINE];

/** 星（お気に入り）。filled で塗りつぶし */
export function StarIcon({
  filled = false,
  color = filled ? '#c17900' : '#adb5bd',
  fill = '#ffca28',
  ...rest
}: HandDrawnIconProps & { filled?: boolean }) {
  return <SketchIcon shapes={filled ? STAR_FILLED : STAR_OUTLINE} seed={70} color={color} fill={fill} {...rest} />;
}
