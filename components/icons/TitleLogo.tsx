// 初期画面の手書き風タイトルロゴ（Issue #66）
// 「麻雀スコアシート」の文字の横に少し傾けた麻雀牌を重ね、「モバイル」は黄色い旗型の帯に入れた
// 1つのロックアップ。線は HandDrawnIcons と同じ揺らぎ付きパスで描き、文字は1字ずつわずかに
// 回転・上下させて手書き感を出す。
import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Text as SvgText } from 'react-native-svg';
import { Point } from './sketch';
import { Shape, SketchShapes, TILE_SHAPES } from './HandDrawnIcons';

const VIEW_W = 320;
const VIEW_H = 108;

/** 丸ゴシック系があれば使い、無ければ太字のゴシックで代替する */
const LOGO_FONT = Platform.select({
  ios: 'Hiragino Maru Gothic ProN',
  android: 'sans-serif',
  default: "'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', 'Yu Gothic', sans-serif",
});

// 文字ごとの回転（度）と上下のずれ。固定値なので毎回同じ形になる
const TITLE = '麻雀スコアシート';
const TITLE_ROTATE = [-5, 3, -2, 4, -3, 2, -4, 3];
const TITLE_DY = [1, -2, 1, -1, 2, 0, -2, 1];
const TITLE_SIZE = 30;
const TITLE_X0 = 58;
const TITLE_BASELINE = 50;

const SUB = 'モバイル';
const SUB_ROTATE = [-4, 3, -3, 4];
const SUB_DY = [0, -1, 1, -1];
const SUB_SIZE = 20;

// 帯は 1単位 = BANNER_SCALE px の座標で描く（線の太さと揺らぎをロゴの大きさに合わせるため）
const BANNER_SCALE = 3;
const BANNER_X = 148;
const BANNER_Y = 60;
const BANNER_TOP: Point[] = [[0, 1.2], [12, 0.2], [25, 1.4], [38, 0.3], [50, 1]];
const BANNER_BOTTOM: Point[] = [[50, 12], [38, 11.2], [25, 12.4], [12, 11.3], [0, 12.2]];
const BANNER_NOTCH: Point = [46.4, 6.6];

const BANNER_SHAPES: Shape[] = [
  { kind: 'fillPoly', points: [...BANNER_TOP, BANNER_NOTCH, ...BANNER_BOTTOM], color: 'fill' },
  { kind: 'curve', points: BANNER_TOP, width: 0.6 },
  { kind: 'line', points: [BANNER_TOP[BANNER_TOP.length - 1], BANNER_NOTCH, BANNER_BOTTOM[0]], width: 0.6 },
  { kind: 'curve', points: BANNER_BOTTOM, width: 0.6 },
  { kind: 'line', points: [BANNER_BOTTOM[BANNER_BOTTOM.length - 1], BANNER_TOP[0]], width: 0.6 },
  // 左端の折り返し
  { kind: 'fillPoly', points: [[0, 1.2], [-3.4, 3.4], [-3.4, 14.4], [0, 12.2]], color: '#f9a825' },
  { kind: 'line', points: [[0, 1.2], [-3.4, 3.4], [-3.4, 14.4], [0, 12.2]], width: 0.5 },
];

const BANNER_CENTER_X = BANNER_X + (50 * BANNER_SCALE) / 2 - 4;
const BANNER_BASELINE = BANNER_Y + 6.4 * BANNER_SCALE + SUB_SIZE * 0.36;

/** 1文字ずつ回転させて並べた文字列（影を少しずらして重ねる） */
function SketchText({
  text,
  rotate,
  dy,
  size,
  x0,
  baseline,
  color,
  shadow,
}: {
  text: string;
  rotate: number[];
  dy: number[];
  size: number;
  x0: number;
  baseline: number;
  color: string;
  shadow?: string;
}) {
  const chars = Array.from(text);
  const layer = (fill: string, offset: number) =>
    chars.map((ch, i) => {
      const cx = x0 + size * (i + 0.5) + offset;
      const y = baseline + (dy[i] ?? 0) + offset;
      return (
        <SvgText
          key={`${fill}-${i}`}
          x={cx}
          y={y}
          fill={fill}
          fontSize={size}
          fontWeight="bold"
          fontFamily={LOGO_FONT}
          textAnchor="middle"
          transform={`rotate(${rotate[i] ?? 0} ${cx} ${y - size * 0.35})`}
        >
          {ch}
        </SvgText>
      );
    });
  return (
    <G>
      {shadow ? layer(shadow, 2) : null}
      {layer(color, 0)}
    </G>
  );
}

export interface TitleLogoProps {
  /** ロゴの横幅（px）。高さは縦横比から決まる。既定 300 */
  width?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 手書き風タイトルロゴ「麻雀スコアシート モバイル」 */
export function TitleLogo({ width = 300, style, testID }: TitleLogoProps) {
  return (
    <Svg
      width={width}
      height={(width * VIEW_H) / VIEW_W}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      style={style}
      testID={testID}
      accessible
      accessibilityRole="header"
      accessibilityLabel="麻雀スコアシートモバイル"
    >
      {/* 少し傾けた牌（文字の頭に重ねる） */}
      <SketchShapes
        shapes={TILE_SHAPES}
        seed={101}
        color="#3e2723"
        fill="#43a047"
        transform="translate(4 14) rotate(-12 26 30) scale(2.3)"
      />
      <SketchText
        text={TITLE}
        rotate={TITLE_ROTATE}
        dy={TITLE_DY}
        size={TITLE_SIZE}
        x0={TITLE_X0}
        baseline={TITLE_BASELINE}
        color="#fff"
        shadow="rgba(0,0,0,0.3)"
      />
      {/* 「モバイル」の黄色い旗型の帯 */}
      <G transform={`rotate(-3 ${BANNER_CENTER_X} ${BANNER_Y + 18})`}>
        <SketchShapes
          shapes={BANNER_SHAPES}
          seed={102}
          color="#5d4037"
          fill="#ffd54f"
          transform={`translate(${BANNER_X} ${BANNER_Y}) scale(${BANNER_SCALE})`}
        />
        <SketchText
          text={SUB}
          rotate={SUB_ROTATE}
          dy={SUB_DY}
          size={SUB_SIZE}
          x0={BANNER_CENTER_X - (SUB_SIZE * SUB.length) / 2}
          baseline={BANNER_BASELINE}
          color="#4e342e"
        />
      </G>
    </Svg>
  );
}
