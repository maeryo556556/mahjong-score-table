// アプリアイコンの絵柄（Issue #74, #76）
// 従来のアイコン（generate_assets.py の generate_icon）と同じ構図 ── 「SCORE」の見出しと
// 番号付きの表が描かれたスコアシートに、右下から傾けた「中」の牌を重ねる ── を、
// アプリ内の手書き風アイコンと同じ揺らぎ付きの線・色鉛筆風の塗りで描き直したもの。
// アプリ画面では使わず、scripts/render_sketch_icons.js で PNG に書き出して
// generate_assets.py がアイコン（icon / adaptive-icon / favicon / splash）に合成する。
// 背景（青のグラデーション）は含まない（透過）。
import React from 'react';
import Svg, { G, Text as SvgText } from 'react-native-svg';
import { Point } from './sketch';
import { Shape, SketchShapes, SketchWobble, TILE_SHAPES } from './HandDrawnIcons';

const VIEW = 100;

// シートの描画座標は 1単位 = SHEET_SCALE（viewBox 単位）。線の太さと揺らぎを大きさに合わせるため
const SHEET_SCALE = 2;
// 従来のアイコンと同じ配置: x 10〜90, y 17〜89（viewBox 単位）
const SHEET_X = 10;
const SHEET_Y = 17;
const SHEET_W = 80 / SHEET_SCALE; // 40
const SHEET_H = 72 / SHEET_SCALE; // 36

const SHEET_INK = '#1e3c72';
const GRID_INK = '#3c5aa0';
const PAPER = '#fffdf6';
const ROW_TINT = '#d6e4f7';
const SHADOW = 'rgba(8, 20, 50, 0.3)';

const TITLE_H = SHEET_H * 0.14;
const GRID_TOP = TITLE_H + SHEET_H * 0.01;
const GRID_BOTTOM = SHEET_H - SHEET_H * 0.025;
const GRID_LEFT = SHEET_W * 0.025;
const GRID_RIGHT = SHEET_W - SHEET_W * 0.025;
const NUM_COL_W = (GRID_RIGHT - GRID_LEFT) * 0.07;
const HEADER_H = (GRID_BOTTOM - GRID_TOP) * 0.06;

const rect = (x1: number, y1: number, x2: number, y2: number): Point[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

/** スコアシート（紙・表・縞）の図形 */
export function buildSheetShapes(rows: number, cols: number): Shape[] {
  const dataTop = GRID_TOP + HEADER_H;
  const dataLeft = GRID_LEFT + NUM_COL_W;
  const rowH = (GRID_BOTTOM - dataTop) / rows;
  const colW = (GRID_RIGHT - dataLeft) / cols;
  const shapes: Shape[] = [
    // 影（右下にずらした紙）
    { kind: 'fillPoly', points: rect(1.2, 1.4, SHEET_W + 1.2, SHEET_H + 1.4), color: SHADOW },
    // 紙
    { kind: 'fillPoly', points: rect(-0.4, -0.4, SHEET_W - 0.3, SHEET_H - 0.3), color: PAPER },
  ];
  // 1行おきの色付きの縞（色鉛筆で塗ったように線から少しずれる）
  for (let i = 0; i < rows; i += 2) {
    const y = dataTop + rowH * i;
    shapes.push({ kind: 'fillPoly', points: rect(GRID_LEFT, y, GRID_RIGHT - 0.4, y + rowH - 0.3), color: ROW_TINT });
  }
  // 紙の輪郭
  shapes.push({ kind: 'line', points: rect(0, 0, SHEET_W, SHEET_H), closed: true, width: 0.42, color: SHEET_INK });
  // 表の外枠・見出し行・番号列
  shapes.push({ kind: 'line', points: rect(GRID_LEFT, GRID_TOP, GRID_RIGHT, GRID_BOTTOM), closed: true, width: 0.3, color: GRID_INK });
  shapes.push({ kind: 'line', points: [[GRID_LEFT, dataTop], [GRID_RIGHT, dataTop]], width: 0.28, color: GRID_INK });
  shapes.push({ kind: 'line', points: [[dataLeft, GRID_TOP], [dataLeft, GRID_BOTTOM]], width: 0.24, color: GRID_INK });
  for (let i = 1; i < rows; i++) {
    const y = dataTop + rowH * i;
    shapes.push({ kind: 'line', points: [[GRID_LEFT, y], [GRID_RIGHT, y]], width: 0.17, color: GRID_INK });
  }
  for (let i = 1; i < cols; i++) {
    const x = dataLeft + colW * i;
    shapes.push({ kind: 'line', points: [[x, GRID_TOP], [x, GRID_BOTTOM]], width: 0.17, color: GRID_INK });
  }
  return shapes;
}

/** アイコンの大きさでは線が太すぎるため、牌の線だけ細くする */
const ICON_TILE_SHAPES: Shape[] = TILE_SHAPES.map((shape) =>
  shape.kind === 'line' ? { ...shape, width: (shape.width ?? 1) * 0.7 } : shape,
);

/**
 * Issue #76: アイコンの大きさでは揺らぎが目立ちすぎるため、アイコンの線だけ揺らぎを弱めてなめらかにする。
 * （SketchShapes の既定値は変えないので、アプリ内の他のアイコンの見た目はそのまま）
 */
const ICON_WOBBLE: SketchWobble = { amplitude: 0.07, step: 7 };

/**
 * 見出し「SCORE」の手描き文字（Issue #76）。フォントではなくペンのストロークで描く。
 * 各文字は 10×12 の箱（y は下向き）の中の中心線で定義する。
 */
const GLYPH_W = 10;
const GLYPH_H = 12;
const GLYPH_STROKE = 0.88; // Shape の width（BASE_WIDTH に掛ける倍率）
const glyph = (strokes: Array<{ kind: 'line' | 'curve'; points: Point[]; closed?: boolean }>): Shape[] =>
  strokes.map((st) => ({ ...st, width: GLYPH_STROKE, color: SHEET_INK }));
const TITLE_GLYPHS: Shape[][] = [
  // S
  glyph([{ kind: 'curve', points: [[8.5, 2.2], [6, 0.7], [3, 1], [1.8, 3], [3, 5], [6.5, 6.2], [8.3, 8.5], [6.5, 11], [3, 11.3], [1.5, 9.8]] }]),
  // C
  glyph([{ kind: 'curve', points: [[7.03, 2.02], [5.2, 0.8], [2.37, 2.02], [0.87, 5.1], [0.87, 6.9], [2.37, 9.98], [5.2, 11.2], [7.03, 9.98]] }]),
  // O
  glyph([{ kind: 'curve', closed: true, points: [[9.4, 6], [8.2, 2.4], [5, 0.8], [1.8, 2.4], [0.6, 6], [1.8, 9.6], [5, 11.2], [8.2, 9.6]] }]),
  // R
  glyph([
    { kind: 'line', points: [[2, 11.5], [2, 0.5]] },
    { kind: 'curve', points: [[2, 0.5], [5.5, 0.3], [8, 1.8], [8, 4], [5.5, 5.6], [2, 5.4]] },
    { kind: 'line', points: [[4.8, 5.5], [8.3, 11.5]] },
  ]),
  // E
  glyph([
    { kind: 'line', points: [[2.5, 0.5], [2.5, 11.5]] },
    { kind: 'line', points: [[2.5, 0.6], [8.5, 0.8]] },
    { kind: 'line', points: [[2.5, 6], [7.5, 6.1]] },
    { kind: 'line', points: [[2.5, 11.4], [8.5, 11.2]] },
  ]),
];

/** 見出し帯の高さに対する文字（10×12 の箱）の高さの割合 */
const TITLE_GLYPH_RATIO = 0.86;
/** 全文字の中心線の上下の端（箱の座標）。上下中央に置くのに使う */
const GLYPH_INK_Y: [number, number] = (() => {
  const ys = TITLE_GLYPHS.flat().flatMap((sh) => ('points' in sh ? sh.points.map(([, y]) => y) : []));
  return [Math.min(...ys), Math.max(...ys)];
})();

/** 文字の中心線の左右の端（箱の座標） */
const glyphXRange = (shapes: Shape[]): [number, number] => {
  const xs = shapes.flatMap((sh) => ('points' in sh ? sh.points.map(([x]) => x) : []));
  return [Math.min(...xs), Math.max(...xs)];
};

const NUM_ROTATE = [-6, 4, -3, 5, -5, 3, -4, 6, -2, 4];

const FONT = "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', sans-serif";

export interface AppIconArtProps {
  /** 一辺のサイズ（px）。既定 1024 */
  size?: number;
  /** 表の行数・列数（小さいサイズ用に減らせる） */
  rows?: number;
  cols?: number;
  /** 周囲の余白（viewBox 単位）。牌がはみ出す部分も描きたいとき（スプラッシュなど）に使う */
  margin?: number;
}

/** アプリアイコンの絵柄（スコアシート＋「中」の牌）。背景は透過 */
export function AppIconArt({ size = 1024, rows = 8, cols = 8, margin = 0 }: AppIconArtProps) {
  const sheetShapes = React.useMemo(() => buildSheetShapes(rows, cols), [rows, cols]);
  const dataTop = GRID_TOP + HEADER_H;
  const rowH = (GRID_BOTTOM - dataTop) / rows;
  const titleSize = TITLE_H * 0.95;
  const titleAdvance = titleSize * 0.74;
  const titleX0 = SHEET_W / 2 - (titleAdvance * TITLE_GLYPHS.length) / 2;
  // 各文字を同じ大きさに縮め、線の太さも含めて紙の上端の線〜表の上端の線の間（見出し帯）の上下中央に置く
  // （傾き・上下ずれなし）。0.92 倍だと太い線が紙の輪郭に掛かるため、帯内に収まる 0.86 倍にしている
  const glyphScale = (TITLE_H * TITLE_GLYPH_RATIO) / GLYPH_H;
  const glyphTop = GRID_TOP / 2 - ((GLYPH_INK_Y[0] + GLYPH_INK_Y[1]) / 2) * glyphScale;
  // 従来の文字の並び（titleX0〜titleX0 + titleAdvance × 文字数）の幅に、文字どうしの隙間が等しくなるよう並べる
  const titleLayout = React.useMemo(() => {
    const ranges = TITLE_GLYPHS.map(glyphXRange);
    const inkW = ranges.reduce((sum, [a, b]) => sum + (b - a) * glyphScale, 0);
    const gap = (titleAdvance * TITLE_GLYPHS.length - inkW) / (TITLE_GLYPHS.length - 1);
    let x = titleX0;
    return ranges.map(([a, b]) => {
      const left = x - a * glyphScale;
      x += (b - a) * glyphScale + gap;
      return left;
    });
  }, [glyphScale, titleAdvance, titleX0]);
  const numSize = Math.min(rowH * 0.62, NUM_COL_W * 1.05);
  return (
    <Svg width={size} height={size} viewBox={`${-margin} ${-margin} ${VIEW + margin * 2} ${VIEW + margin * 2}`}>
      <G transform={`translate(${SHEET_X} ${SHEET_Y}) scale(${SHEET_SCALE})`}>
        <SketchShapes shapes={sheetShapes} seed={74} color={SHEET_INK} fill={PAPER} wobble={ICON_WOBBLE} />
        {TITLE_GLYPHS.map((shapes, i) => (
          <SketchShapes
            key={`t${i}`}
            shapes={shapes}
            seed={76 + i}
            color={SHEET_INK}
            fill={SHEET_INK}
            wobble={ICON_WOBBLE}
            transform={`translate(${titleLayout[i].toFixed(3)} ${glyphTop.toFixed(3)}) scale(${glyphScale.toFixed(4)})`}
          />
        ))}
        {Array.from({ length: rows }, (_, i) => {
          const cx = GRID_LEFT + NUM_COL_W / 2;
          const y = dataTop + rowH * (i + 0.5) + numSize * 0.36;
          return (
            <SvgText
              key={`n${i}`}
              x={cx}
              y={y}
              fill={GRID_INK}
              fontSize={numSize}
              fontWeight="bold"
              fontFamily={FONT}
              textAnchor="middle"
              transform={`rotate(${NUM_ROTATE[i % NUM_ROTATE.length]} ${cx} ${y - numSize * 0.35})`}
            >
              {i + 1}
            </SvgText>
          );
        })}
      </G>
      {/* 右下から傾けて重ねた「中」の牌（アプリの TileIcon と同じ絵柄）。Issue #76: 牌全体がアイコン内に収まる大きさ・位置 */}
      <SketchShapes
        shapes={ICON_TILE_SHAPES}
        seed={75}
        color="#3e2723"
        fill="#43a047"
        wobble={ICON_WOBBLE}
        transform="translate(76 72) rotate(12) scale(1.85) translate(-11.6 -11.6)"
      />
    </Svg>
  );
}
