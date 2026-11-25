// アプリアイコンの絵柄（Issue #74）
// 従来のアイコン（generate_assets.py の generate_icon）と同じ構図 ── 「SCORE」の見出しと
// 番号付きの表が描かれたスコアシートに、右下から傾けた「中」の牌を重ねる ── を、
// アプリ内の手書き風アイコンと同じ揺らぎ付きの線・色鉛筆風の塗りで描き直したもの。
// アプリ画面では使わず、scripts/render_sketch_icons.js で PNG に書き出して
// generate_assets.py がアイコン（icon / adaptive-icon / favicon / splash）に合成する。
// 背景（青のグラデーション）は含まない（透過）。
import React from 'react';
import Svg, { G, Text as SvgText } from 'react-native-svg';
import { Point } from './sketch';
import { Shape, SketchShapes, TILE_SHAPES } from './HandDrawnIcons';

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

/** 文字ごとの回転（度）と上下のずれ。固定値なので毎回同じ形になる */
const TITLE = 'SCORE';
const TITLE_ROTATE = [-6, 4, -3, 5, -4];
const TITLE_DY = [0.3, -0.4, 0.2, -0.3, 0.4];
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
  const titleX0 = SHEET_W / 2 - (titleAdvance * TITLE.length) / 2;
  const titleBase = TITLE_H * 0.86;
  const numSize = Math.min(rowH * 0.62, NUM_COL_W * 1.05);
  return (
    <Svg width={size} height={size} viewBox={`${-margin} ${-margin} ${VIEW + margin * 2} ${VIEW + margin * 2}`}>
      <G transform={`translate(${SHEET_X} ${SHEET_Y}) scale(${SHEET_SCALE})`}>
        <SketchShapes shapes={sheetShapes} seed={74} color={SHEET_INK} fill={PAPER} />
        {Array.from(TITLE).map((ch, i) => {
          const cx = titleX0 + titleAdvance * (i + 0.5);
          const y = titleBase + TITLE_DY[i];
          return (
            <SvgText
              key={`t${i}`}
              x={cx}
              y={y}
              fill={SHEET_INK}
              fontSize={titleSize}
              fontWeight="bold"
              fontFamily={FONT}
              textAnchor="middle"
              transform={`rotate(${TITLE_ROTATE[i]} ${cx} ${y - titleSize * 0.35})`}
            >
              {ch}
            </SvgText>
          );
        })}
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
      {/* 右下から傾けて重ねた「中」の牌（アプリの TileIcon と同じ絵柄） */}
      <SketchShapes
        shapes={ICON_TILE_SHAPES}
        seed={75}
        color="#3e2723"
        fill="#43a047"
        transform="translate(84 83) rotate(15) scale(2.55) translate(-11.6 -11.6)"
      />
    </Svg>
  );
}
