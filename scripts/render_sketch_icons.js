#!/usr/bin/env node
/**
 * アプリの手書き風アイコン・タイトルロゴ（components/icons/*.tsx）を PNG に書き出す。
 * generate_assets.py から呼び出し、App Store 掲載画像のモックアップに実物と同じ絵柄を貼り込む（Issue #70）。
 *
 * 使い方: node scripts/render_sketch_icons.js <spec.json> <出力ディレクトリ> [ロゴ用フォント.ttf]
 *   spec.json: [{ "name": "tile", "component": "TileIcon", "props": { "size": 24 }, "px": 120 }, ...]
 *   px は書き出す PNG の横幅（ピクセル）。縦は SVG の縦横比から決まる。
 *
 * react-native / react-native-svg は最小限のスタブに差し替え、react-dom/server で素の SVG にしてから
 * Chromium（Playwright）で透過 PNG にラスタライズする。描画ロジック自体はアプリのコードをそのまま使う。
 */
/* global __dirname */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

// ---- .ts / .tsx をその場でトランスパイルして読み込む ----
const compile = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

// ---- react-native / react-native-svg のスタブ ----
const React = require('react');

// RN 専用の props は SVG 要素に渡さない
const RN_ONLY_PROPS = new Set([
  'style',
  'testID',
  'accessible',
  'accessibilityRole',
  'accessibilityLabel',
  'importantForAccessibility',
]);
const svgElement = (tag) => {
  const Component = ({ children, ...props }) => {
    const clean = {};
    for (const [k, v] of Object.entries(props)) {
      if (!RN_ONLY_PROPS.has(k) && v !== undefined) clean[k] = v;
    }
    if (tag === 'svg') clean.xmlns = 'http://www.w3.org/2000/svg';
    return React.createElement(tag, clean, children);
  };
  Component.displayName = tag;
  return Component;
};
const svgStub = {
  __esModule: true,
  default: svgElement('svg'),
  Svg: svgElement('svg'),
  G: svgElement('g'),
  Path: svgElement('path'),
  Circle: svgElement('circle'),
  Text: svgElement('text'),
};
const rnStub = {
  Platform: { OS: 'web', select: (spec) => ('default' in spec ? spec.default : spec.web) },
  StyleSheet: { create: (s) => s },
};
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'react-native-svg') return svgStub;
  if (request === 'react-native') return rnStub;
  return originalLoad.call(this, request, parent, isMain);
};

const { renderToStaticMarkup } = require('react-dom/server');
const icons = require(path.join(ROOT, 'components/icons/HandDrawnIcons.tsx'));
const { TitleLogo } = require(path.join(ROOT, 'components/icons/TitleLogo.tsx'));
const components = { ...icons, TitleLogo };

async function main() {
  const [specPath, outDir, logoFont] = process.argv.slice(2);
  if (!specPath || !outDir) {
    console.error('usage: node scripts/render_sketch_icons.js <spec.json> <outDir> [logoFont.ttf]');
    process.exit(2);
  }
  const specs = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // ロゴの丸ゴシック（TitleLogo の LOGO_FONT の候補 'M PLUS Rounded 1c'）を読み込む
    const fontFace = logoFont
      ? `@font-face { font-family: 'M PLUS Rounded 1c'; font-weight: 700;
           src: url(data:font/ttf;base64,${fs.readFileSync(logoFont).toString('base64')}) format('truetype'); }`
      : '';
    for (const spec of specs) {
      const Component = components[spec.component];
      if (!Component) throw new Error(`unknown component: ${spec.component}`);
      const svg = renderToStaticMarkup(React.createElement(Component, spec.props || {}));
      const widthMatch = svg.match(/<svg[^>]*\swidth="([\d.]+)"/);
      const heightMatch = svg.match(/<svg[^>]*\sheight="([\d.]+)"/);
      const w = Number(widthMatch[1]);
      const h = Number(heightMatch[1]);
      const pxW = spec.px;
      const pxH = Math.round((pxW * h) / w);
      const scaled = svg
        .replace(/(<svg[^>]*\s)width="[\d.]+"/, `$1width="${pxW}"`)
        .replace(/(<svg[^>]*\s)height="[\d.]+"/, `$1height="${pxH}"`);
      await page.setViewportSize({ width: pxW, height: pxH });
      await page.setContent(
        `<!doctype html><html><head><style>${fontFace}
           html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head>
         <body>${scaled}</body></html>`,
      );
      await page.evaluate(() => document.fonts.ready);
      const out = path.join(outDir, `${spec.name}.png`);
      await page.locator('svg').first().screenshot({ path: out, omitBackground: true });
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
