#!/usr/bin/env python3
"""Generate app assets for Mahjong Score Table app.

Generates:
  - icon.png, adaptive-icon.png, splash.png, favicon.png (app assets)
    手書き風の絵柄（components/icons/AppIconArt.tsx）を使う（Issue #74）
  - iphone/promo_1_setup.png ... promo_8_live_viewer.png (8 iPhone App Store images, 1242x2688)
  - ipad/promo_1_setup.png ... promo_8_live_viewer.png (8 iPad App Store images, 2048x2732)
  - guide/guide_1_setup.png ... guide_7_share.png (使い方ガイドの画像, 4:3, Issue #72)
    掲載画像と同じ画面モックアップから、各ページで説明する部分を切り出したもの

App Store 掲載画像はデザイン画像（モックアップ）で作る（Issue #70）。
  - 手書き風アイコンとタイトルロゴは scripts/render_sketch_icons.js がアプリのコンポーネント
    （components/icons/*.tsx）から PNG に書き出したものを使う（Node・npm ci 済み・Playwright の Chromium が必要）
  - 文字は Noto Sans JP / M PLUS Rounded 1c を npm pack で .cache/fonts/ に取得して使う
    （取得できない場合は IPA ゴシックで代替）

Usage:
  python3 generate_assets.py               # すべて生成
  python3 generate_assets.py --promos-only # 掲載画像と使い方ガイドの画像だけ生成
  python3 generate_assets.py --guide-only  # 使い方ガイドの画像だけ生成
  python3 generate_assets.py --icons-only  # アプリのアイコン（icon / adaptive-icon / splash / favicon）だけ生成
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import os

# ──────────────────────────────────────────────
# Colors matching the React Native app exactly
# ──────────────────────────────────────────────
BG_DARK = (30, 60, 114)       # #1e3c72  gradient top
BG_MED = (42, 82, 152)        # #2a5298  gradient bottom / accent
WHITE = (255, 255, 255)
CARD_BG = (255, 255, 255)
CARD_BORDER = (222, 226, 230)  # #dee2e6
SECTION_TITLE_COLOR = (30, 60, 114)  # #1e3c72
SECTION_BORDER = (42, 82, 152)       # #2a5298
GREEN = (40, 167, 69)         # #28a745
RED = (220, 53, 69)           # #dc3545
YELLOW = (255, 193, 7)        # #ffc107
GRAY_TEXT = (108, 117, 125)   # #6c757d
DARK_TEXT = (51, 51, 51)      # #333333
MED_TEXT = (85, 85, 85)       # #555555
LIGHT_TEXT = (102, 102, 102)  # #666666
HINT_TEXT = (153, 153, 153)   # #999999
INPUT_BORDER = (221, 221, 221)  # #ddd
SCORE_BOX_BG = (248, 248, 248)   # #f8f8f8
SCORE_BOX_BORDER = (238, 238, 238)  # #eee
DRUMROLL_BTN_BG = (233, 236, 239)  # #e9ecef
DRUMROLL_BTN_BORDER = (173, 181, 189)  # #adb5bd
DRUMROLL_BTN_TEXT = (73, 80, 87)  # #495057
DRUMROLL_DISPLAY_BORDER = (42, 82, 152)  # #2a5298
SUSPENDED_BG = (232, 244, 253)  # #e8f4fd
SUSPENDED_BORDER = (179, 217, 242)  # #b3d9f2
GOLD = (255, 215, 0)          # #FFD700
SILVER = (192, 192, 192)      # #C0C0C0
BRONZE = (205, 127, 50)       # #CD7F32
RANK_GRAY = (149, 165, 166)   # #95a5a6
TEAL = (23, 162, 184)         # #17a2b8
CODE_BG = (245, 245, 245)     # #f5f5f5

GRID_BLUE = (60, 90, 160)
GRID_LIGHT = (220, 230, 245)
TILE_BG = (250, 245, 235)
SCORE_TEXT_COLOR = (25, 50, 110)

# Fonts
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_JP = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def font(size, bold=False, jp=False, mono=False):
    if mono:
        return ImageFont.truetype(FONT_MONO, size)
    if jp:
        return ImageFont.truetype(FONT_JP, size)
    if bold:
        return ImageFont.truetype(FONT_BOLD, size)
    return ImageFont.truetype(FONT_REGULAR, size)


def draw_gradient_bg(img, color1, color2):
    """Vertical linear gradient."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    for y in range(h):
        ratio = y / h
        r = int(color1[0] + (color2[0] - color1[0]) * ratio)
        g = int(color1[1] + (color2[1] - color1[1]) * ratio)
        b = int(color1[2] + (color2[2] - color1[2]) * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))


def text_size(draw, text, f):
    bbox = draw.textbbox((0, 0), text, font=f)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_centered_text(draw, text, cx, y, f, fill):
    tw, _ = text_size(draw, text, f)
    draw.text((cx - tw // 2, y), text, fill=fill, font=f)


def rrect(draw, xy, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


# ──────────────────────────────────────────────
# Icon / Splash / Favicon (keep existing design)
# ──────────────────────────────────────────────

def draw_shadow(img, xy, radius, shadow_offset=6, shadow_blur=12):
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    x1, y1, x2, y2 = xy
    sd.rounded_rectangle(
        (x1 + shadow_offset, y1 + shadow_offset, x2 + shadow_offset, y2 + shadow_offset),
        radius=radius, fill=(0, 0, 0, 60)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_blur))
    img.paste(Image.alpha_composite(Image.new('RGBA', img.size, (0, 0, 0, 0)), shadow), (0, 0))
    return img


def draw_mahjong_tile(img, cx, cy, tile_w, tile_h, rotation=15):
    pad = int(max(tile_w, tile_h) * 0.8)
    tile_img = Image.new('RGBA', (tile_w + pad * 2, tile_h + pad * 2), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile_img)
    tx, ty = pad, pad
    td.rounded_rectangle(
        (tx + 4, ty + 4, tx + tile_w + 4, ty + tile_h + 4),
        radius=int(tile_w * 0.1), fill=(100, 100, 110, 70)
    )
    td.rounded_rectangle(
        (tx, ty, tx + tile_w, ty + tile_h),
        radius=int(tile_w * 0.1), fill=(230, 230, 230), outline=(180, 180, 185), width=3
    )
    inner_margin = int(tile_w * 0.07)
    td.rounded_rectangle(
        (tx + inner_margin, ty + inner_margin, tx + tile_w - inner_margin, ty + tile_h - inner_margin),
        radius=int(tile_w * 0.07), fill=TILE_BG
    )
    chung_size = int(tile_h * 0.45)
    chung_font = font(chung_size, jp=True)
    char = "中"
    bbox = td.textbbox((0, 0), char, font=chung_font)
    cw = bbox[2] - bbox[0]
    ch = bbox[3] - bbox[1]
    char_x = tx + (tile_w - cw) // 2
    char_y = ty + (tile_h - ch) // 2 - int(tile_h * 0.05)
    td.text((char_x, char_y), char, fill=(190, 30, 30), font=chung_font)
    if rotation != 0:
        tile_img = tile_img.rotate(-rotation, resample=Image.BICUBIC, expand=False)
    paste_x = cx - tile_img.width // 2
    paste_y = cy - tile_img.height // 2
    img.paste(tile_img, (paste_x, paste_y), tile_img)
    return img


def draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h, num_rows=8, num_cols=8, score_font_size=None):
    draw = ImageDraw.Draw(img)
    shadow_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.rounded_rectangle(
        (sheet_x + 8, sheet_y + 8, sheet_x + sheet_w + 8, sheet_y + sheet_h + 8),
        radius=12, fill=(0, 0, 0, 50)
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(15))
    img = Image.alpha_composite(img, shadow_layer)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        (sheet_x, sheet_y, sheet_x + sheet_w, sheet_y + sheet_h),
        radius=10, fill=WHITE, outline=(180, 190, 210), width=2
    )
    if score_font_size is None:
        score_font_size = int(sheet_h * 0.085)
    score_f = font(score_font_size, bold=True)
    score_text = "SCORE"
    bbox = draw.textbbox((0, 0), score_text, font=score_f)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    title_h = int(sheet_h * 0.14)
    title_y = sheet_y + int((title_h - text_h) * 0.4)
    text_x = sheet_x + (sheet_w - text_w) // 2
    draw.text((text_x, title_y), score_text, fill=SCORE_TEXT_COLOR, font=score_f)
    grid_top = sheet_y + title_h + int(sheet_h * 0.01)
    grid_bottom = sheet_y + sheet_h - int(sheet_h * 0.02)
    grid_left = sheet_x + int(sheet_w * 0.02)
    grid_right = sheet_x + sheet_w - int(sheet_w * 0.02)
    grid_h = grid_bottom - grid_top
    grid_w = grid_right - grid_left
    num_col_w = int(grid_w * 0.07)
    header_h = int(grid_h * 0.06)
    data_left = grid_left + num_col_w
    data_top = grid_top + header_h
    data_w = grid_right - data_left
    data_h = grid_bottom - data_top
    col_w = data_w / num_cols
    row_h = data_h / num_rows
    for i in range(num_rows):
        ry = data_top + i * row_h
        if i % 2 == 0:
            draw.rectangle((grid_left, ry, grid_right, ry + row_h), fill=GRID_LIGHT)
    line_color = GRID_BLUE
    line_w = max(2, int(sheet_w * 0.003))
    draw.rectangle((grid_left, grid_top, grid_right, grid_bottom), outline=line_color, width=line_w + 1)
    draw.line([(grid_left, data_top), (grid_right, data_top)], fill=line_color, width=line_w + 1)
    draw.line([(data_left, grid_top), (data_left, grid_bottom)], fill=line_color, width=line_w)
    for i in range(1, num_rows):
        y = data_top + i * row_h
        draw.line([(grid_left, y), (grid_right, y)], fill=line_color, width=line_w)
    for i in range(1, num_cols):
        x = data_left + i * col_w
        draw.line([(x, grid_top), (x, grid_bottom)], fill=line_color, width=line_w)
    num_f_size = int(row_h * 0.45)
    num_f = font(num_f_size)
    for i in range(num_rows):
        num = str(i + 1)
        bbox = draw.textbbox((0, 0), num, font=num_f)
        nw = bbox[2] - bbox[0]
        nh = bbox[3] - bbox[1]
        nx = grid_left + (num_col_w - nw) // 2
        ny = data_top + i * row_h + (row_h - nh) // 2
        draw.text((nx, ny), num, fill=GRID_BLUE, font=num_f)
    return img


# Issue #74: アイコンは従来の構図（スコアシート＋傾けた「中」の牌）のまま、アプリ内の手書き風アイコンと
# 同じタッチで描き直した。絵柄は components/icons/AppIconArt.tsx を scripts/render_sketch_icons.js で
# PNG にしたもの（ICONS['appicon*']）を使い、背景のグラデーションだけここで描く。
# 旧来の draw_score_sheet / draw_mahjong_tile は使わなくなったが、比較用に残している。

APP_ICON_MARGIN = 16  # appicon_wide の周囲の余白（viewBox 単位。AppIconArt の margin）


def _art(name, px):
    return ICONS[name].resize((px, px), Image.LANCZOS)


def _icon_background(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_gradient_bg(bg, BG_DARK, BG_MED)
    # 色鉛筆でなぞったような、うっすらした斜めのハッチング
    hatch = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hatch)
    step = max(6, size // 40)
    for k in range(-size, size, step):
        hd.line([(k, size), (k + size, 0)], fill=(255, 255, 255, 10), width=max(1, size // 300))
    bg.alpha_composite(hatch)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.18), fill=255)
    img.paste(bg, (0, 0), mask)
    return img, mask


def generate_icon(output_path, size=1024):
    img, mask = _icon_background(size)
    art = _art('appicon', size)
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    layer.paste(art, (0, 0), mask)  # 牌のはみ出しは角丸で切る
    img.alpha_composite(layer)
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


def _paste_wide_art(img, name, sheet_w, sheet_x, sheet_y):
    """AppIconArt（margin 付き）を、スコアシートが (sheet_x, sheet_y) から幅 sheet_w になるように貼る。"""
    view = 100 + APP_ICON_MARGIN * 2
    px = int(round(sheet_w / 80 * view))
    art = _art(name, px)
    unit = px / view
    ox = int(round(sheet_x - (APP_ICON_MARGIN + 10) * unit))
    oy = int(round(sheet_y - (APP_ICON_MARGIN + 17) * unit))
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    layer.paste(art, (ox, oy), art)
    img.alpha_composite(layer)


def generate_adaptive_icon(output_path, size=1024):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sheet_w = int(size * 0.56)
    sheet_h = sheet_w * 72 / 80
    sheet_x = (size - sheet_w) // 2 - int(size * 0.02)
    sheet_y = int((size - sheet_h) // 2 + int(size * 0.02))
    _paste_wide_art(img, 'appicon_wide', sheet_w, sheet_x, sheet_y)
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


def generate_splash(output_path, width=1284, height=2778):
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw_gradient_bg(img, BG_DARK, (35, 70, 130))
    sheet_w = int(width * 0.55)
    sheet_h = int(sheet_w * 72 / 80)
    sheet_x = (width - sheet_w) // 2
    sheet_y = int(height * 0.25)
    _paste_wide_art(img, 'appicon_wide', sheet_w, sheet_x, sheet_y)
    draw = ImageDraw.Draw(img)
    text_y = sheet_y + sheet_h + int(width * 0.2)  # 下にはみ出す牌と重ならない位置
    jp_large = font(int(width * 0.09), jp=True)
    draw_centered_text(draw, "麻雀", width // 2, text_y, jp_large, WHITE)
    text_y2 = text_y + int(width * 0.12)
    jp_small = font(int(width * 0.055), jp=True)
    draw_centered_text(draw, "スコアシートモバイル", width // 2, text_y2, jp_small, (200, 210, 230))
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({width}x{height})")


def generate_favicon(output_path, size=48):
    render_size = size * 8
    img, mask = _icon_background(render_size)
    art = _art('appicon_small', render_size)
    layer = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    layer.paste(art, (0, 0), mask)
    img.alpha_composite(layer)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


# ══════════════════════════════════════════════
# App Store 掲載画像（デザイン画像 / モックアップ）  Issue #70
# ══════════════════════════════════════════════
#
# 画面は React Native のスタイル値（dp）をそのまま使って描く。アイコンとタイトルロゴは
# scripts/render_sketch_icons.js でアプリのコンポーネント（components/icons/*.tsx）から PNG に
# 書き出したものを貼り込むため、アプリの表示と同じ絵柄になる。

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_CACHE_DIR = os.path.join(ROOT_DIR, '.cache', 'fonts')

# 掲載画像用のフォント（npm の @expo-google-fonts から取得し .cache/fonts/ に置く。取得できなければ IPA ゴシック）
FONT_PACKAGES = [
    ('@expo-google-fonts/noto-sans-jp@0.4.4', {
        'package/400Regular/NotoSansJP_400Regular.ttf': 'NotoSansJP-Regular.ttf',
        'package/700Bold/NotoSansJP_700Bold.ttf': 'NotoSansJP-Bold.ttf',
    }),
    ('@expo-google-fonts/m-plus-rounded-1c@0.4.4', {
        'package/700Bold/MPLUSRounded1c_700Bold.ttf': 'MPLUSRounded1c-Bold.ttf',
        'package/800ExtraBold/MPLUSRounded1c_800ExtraBold.ttf': 'MPLUSRounded1c-ExtraBold.ttf',
    }),
]


def ensure_promo_fonts():
    """掲載画像用のフォントを用意する。取得に失敗した場合は IPA ゴシックで代替する。"""
    import subprocess
    import tarfile
    import tempfile
    os.makedirs(FONT_CACHE_DIR, exist_ok=True)
    for spec, members in FONT_PACKAGES:
        if all(os.path.exists(os.path.join(FONT_CACHE_DIR, out)) for out in members.values()):
            continue
        try:
            with tempfile.TemporaryDirectory() as tmp:
                name = subprocess.run(
                    ['npm', 'pack', spec, '--silent', '--pack-destination', tmp],
                    check=True, capture_output=True, text=True,
                ).stdout.strip().splitlines()[-1]
                with tarfile.open(os.path.join(tmp, name)) as tar:
                    for member, out in members.items():
                        src = tar.extractfile(member)
                        with open(os.path.join(FONT_CACHE_DIR, out), 'wb') as f:
                            f.write(src.read())
            print(f"Fetched fonts: {spec}")
        except Exception as e:  # noqa: BLE001
            print(f"[warn] フォントを取得できませんでした（{spec}）: {e}。IPA ゴシックで代替します")

    def pick(name):
        p = os.path.join(FONT_CACHE_DIR, name)
        return p if os.path.exists(p) else FONT_JP

    return {
        'regular': pick('NotoSansJP-Regular.ttf'),
        'bold': pick('NotoSansJP-Bold.ttf'),
        'logo': pick('MPLUSRounded1c-Bold.ttf'),
        'caption': pick('MPLUSRounded1c-ExtraBold.ttf'),
    }


PROMO_FONTS = {}
_font_cache = {}


def pfont(kind, px):
    """kind: 'regular' | 'bold' | 'caption'"""
    key = (kind, px)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(PROMO_FONTS.get(kind, FONT_JP), px)
    return _font_cache[key]


# ──────────────────────────────────────────────
# アプリのアイコン（components/icons/*.tsx を PNG 化）
# ──────────────────────────────────────────────

ICON_SPECS = [
    ('tile', 'TileIcon', {}),
    ('fan', 'TileFanIcon', {}),
    ('medal1', 'MedalIcon', {'rank': 1}),
    ('medal2', 'MedalIcon', {'rank': 2}),
    ('medal3', 'MedalIcon', {'rank': 3}),
    ('flag', 'GoalFlagIcon', {}),
    ('celebrate', 'CelebrateIcon', {}),
    ('celebrate_chip', 'CelebrateIcon', {'color': '#856404'}),
    ('broadcast', 'BroadcastIcon', {}),
    ('broadcast_dark', 'BroadcastIcon', {'color': '#3e2723'}),
    ('send', 'SendIcon', {}),
    ('pencil', 'PencilIcon', {}),
    ('star_on', 'StarIcon', {'filled': True}),
    ('star_off', 'StarIcon', {}),
]
ICON_RENDER_PX = 400
LOGO_RENDER_PX = 1600

ICONS = {}


def render_app_icons():
    """Node でアプリのアイコンとタイトルロゴを PNG に書き出して読み込む。"""
    import json
    import subprocess
    import tempfile
    specs = [{'name': n, 'component': c, 'props': p, 'px': ICON_RENDER_PX} for n, c, p in ICON_SPECS]
    specs.append({'name': 'logo', 'component': 'TitleLogo', 'props': {'width': 320}, 'px': LOGO_RENDER_PX})
    # アプリアイコンの絵柄（Issue #74）
    specs.append({'name': 'appicon', 'component': 'AppIconArt', 'props': {'size': 100}, 'px': 1024})
    specs.append({'name': 'appicon_wide', 'component': 'AppIconArt',
                  'props': {'size': 100, 'rows': 6, 'cols': 6, 'margin': APP_ICON_MARGIN}, 'px': 1600})
    specs.append({'name': 'appicon_small', 'component': 'AppIconArt',
                  'props': {'size': 100, 'rows': 5, 'cols': 5}, 'px': 384})
    with tempfile.TemporaryDirectory() as tmp:
        spec_path = os.path.join(tmp, 'spec.json')
        with open(spec_path, 'w') as f:
            json.dump(specs, f)
        out_dir = os.path.join(tmp, 'icons')
        cmd = ['node', os.path.join(ROOT_DIR, 'scripts', 'render_sketch_icons.js'), spec_path, out_dir]
        if PROMO_FONTS.get('logo') and PROMO_FONTS['logo'] != FONT_JP:
            cmd.append(PROMO_FONTS['logo'])
        subprocess.run(cmd, check=True, cwd=ROOT_DIR)
        for spec in specs:
            ICONS[spec['name']] = Image.open(os.path.join(out_dir, spec['name'] + '.png')).convert('RGBA')
    print(f"Rendered {len(ICONS)} app icons from components/icons")


# ──────────────────────────────────────────────
# Device configurations
# ──────────────────────────────────────────────

class DeviceConfig:
    """Configuration for different device types."""
    def __init__(self, screen_w, screen_h, promo_w, promo_h, base_dp, is_tablet=False):
        self.screen_w = screen_w
        self.screen_h = screen_h
        self.promo_w = promo_w
        self.promo_h = promo_h
        self.base_dp = base_dp
        self.is_tablet = is_tablet


# iPhone 6.5インチ（1242×2688）/ iPad 12.9インチ（2048×2732）
IPHONE = DeviceConfig(1179, 2556, 1242, 2688, 393, False)
IPAD = DeviceConfig(1536, 2048, 2048, 2732, 540, True)

# 画面の色（React Native のスタイル値）
C_BLUE_TOP = (30, 60, 114)          # #1e3c72
C_BLUE_BOTTOM = (42, 82, 152)       # #2a5298
C_YELLOW_TOP = (249, 168, 37)       # #f9a825
C_YELLOW_BOTTOM = (253, 216, 53)    # #fdd835
C_LIVE_TEXT = (62, 39, 35)          # #3e2723
C_LIVE_BORDER = (245, 127, 23)      # #f57f17
C_CHIP_CARD = (255, 236, 179)       # #ffecb3
C_CHIP_ROW = (255, 243, 205)        # #fff3cd
C_CHIP_TEXT = (133, 100, 4)         # #856404
C_ROW_BG = (248, 249, 250)          # #f8f9fa
C_LIVE_CARD = (255, 248, 225)       # #fff8e1


def rgba(color, alpha=1.0):
    return (color[0], color[1], color[2], int(round(255 * alpha)))


WHITE_A = lambda a: (255, 255, 255, int(round(255 * a)))  # noqa: E731


class Screen:
    """アプリ画面のモックアップ。座標・サイズはすべて dp で指定する。"""

    def __init__(self, config, live=False):
        self.config = config
        self.w = config.screen_w
        self.h = config.screen_h
        self.scale = config.screen_w / config.base_dp
        self.wdp = config.base_dp
        self.hdp = config.screen_h / self.scale
        self.live = live
        self.bg = (C_YELLOW_TOP, C_YELLOW_BOTTOM) if live else (C_BLUE_TOP, C_BLUE_BOTTOM)
        self.img = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 255))
        draw_gradient_bg(self.img, *self.bg)
        self.status_h = 24 if config.is_tablet else 54
        self.top = self.status_h  # SafeArea の下端

    # ---- 基本 ----
    def px(self, dp):
        return int(round(dp * self.scale))

    def _composite(self, layer, x0, y0):
        """layer を (x0, y0) に重ねる（画面外にはみ出す部分は切り取る）。"""
        lw, lh = layer.size
        sx, sy = max(0, -x0), max(0, -y0)
        dx, dy = max(0, x0), max(0, y0)
        w = min(lw - sx, self.w - dx)
        h = min(lh - sy, self.h - dy)
        if w <= 0 or h <= 0:
            return
        self.img.alpha_composite(layer, dest=(dx, dy), source=(sx, sy, sx + w, sy + h))

    def rect(self, x, y, w, h, r=0, fill=None, outline=None, width=0):
        X, Y, W, H = self.px(x), self.px(y), self.px(w), self.px(h)
        if W <= 0 or H <= 0:
            return
        layer = Image.new('RGBA', (W + 2, H + 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.rounded_rectangle((0, 0, W - 1, H - 1), radius=self.px(r), fill=fill,
                            outline=outline, width=self.px(width) if outline else 0)
        self._composite(layer, X, Y)

    def line(self, x1, y1, x2, y2, color, width=1):
        X1, Y1, X2, Y2 = self.px(x1), self.px(y1), self.px(x2), self.px(y2)
        Wd = max(1, self.px(width))
        x0, y0 = min(X1, X2) - Wd, min(Y1, Y2) - Wd
        layer = Image.new('RGBA', (abs(X2 - X1) + 2 * Wd + 1, abs(Y2 - Y1) + 2 * Wd + 1), (0, 0, 0, 0))
        ImageDraw.Draw(layer).line([(X1 - x0, Y1 - y0), (X2 - x0, Y2 - y0)], fill=color, width=Wd)
        self._composite(layer, x0, y0)

    def shadow(self, x, y, w, h, r, dy=2, blur=4, alpha=0.1):
        X, Y, W, H = self.px(x), self.px(y + dy), self.px(w), self.px(h)
        B = self.px(blur)
        pad = B * 3
        layer = Image.new('RGBA', (W + 2 * pad, H + 2 * pad), (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle((pad, pad, pad + W, pad + H), radius=self.px(r),
                                                fill=(0, 0, 0, int(255 * alpha)))
        layer = layer.filter(ImageFilter.GaussianBlur(max(1, B)))
        self._composite(layer, X - pad, Y - pad)

    def card(self, x, y, w, h, r=12, fill=WHITE, outline=None, width=0, shadow=True):
        if shadow:
            self.shadow(x, y, w, h, r)
        self.rect(x, y, w, h, r, fill=fill, outline=outline, width=width)

    def font(self, size, bold=True):
        return pfont('bold' if bold else 'regular', self.px(size))

    def text_w(self, s, size, bold=True, spacing=0):
        f = self.font(size, bold)
        return f.getlength(s) / self.scale + spacing * max(0, len(s) - 1)

    def text(self, x, y, s, size, color, bold=True, anchor='lm', spacing=0):
        """y は行の中心（anchor の 'm'）または上端（'a'）。spacing は字間（dp）。"""
        if spacing:
            # 字間ありは1文字ずつ並べる（anchor の横方向だけ反映）
            total = self.text_w(s, size, bold, spacing)
            sx = x - (total / 2 if anchor[0] == 'm' else total if anchor[0] == 'r' else 0)
            for ch in s:
                self.text(sx, y, ch, size, color, bold, 'l' + anchor[1])
                sx += self.text_w(ch, size, bold) + spacing
            return
        f = self.font(size, bold)
        X, Y = self.px(x), self.px(y)
        tmp = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
        x0, y0, x1, y1 = tmp.textbbox((X, Y), s, font=f, anchor=anchor)
        pad = 4
        layer = Image.new('RGBA', (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((X - x0 + pad, Y - y0 + pad), s, font=f, fill=color, anchor=anchor)
        self._composite(layer, x0 - pad, y0 - pad)

    def wrap(self, s, size, max_w, bold=True):
        """日本語向けの1文字単位の折り返し（行頭禁則つき）。"""
        lines, cur = [], ''
        for ch in s:
            if ch == '\n':
                lines.append(cur)
                cur = ''
                continue
            if cur and self.text_w(cur + ch, size, bold) > max_w and ch not in '、。）」・ー':
                lines.append(cur)
                cur = ch
            else:
                cur += ch
        if cur:
            lines.append(cur)
        return lines

    def paragraph(self, x, y, s, size, color, max_w, line_h, bold=False, align='l'):
        lines = self.wrap(s, size, max_w, bold)
        for i, ln in enumerate(lines):
            cy = y + line_h * i + line_h / 2
            if align == 'm':
                self.text(x + max_w / 2, cy, ln, size, color, bold, 'mm')
            else:
                self.text(x, cy, ln, size, color, bold, 'lm')
        return y + line_h * len(lines)

    def icon(self, name, x, y, size):
        src = ICONS[name]
        W = self.px(size)
        H = int(round(W * src.height / src.width))
        self._composite(src.resize((W, H), Image.LANCZOS), self.px(x), self.px(y))

    # ---- 仕上げ ----
    def finish(self):
        """ステータスバー（スクロールした内容の上に背景色ごと描く）。"""
        strip = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 255))
        draw_gradient_bg(strip, *self.bg)
        self.img.paste(strip.crop((0, 0, self.w, self.px(self.status_h))), (0, 0))
        fg = C_LIVE_TEXT if self.live else WHITE
        if self.config.is_tablet:
            cy, x_time = 12, 22
            self.text(x_time, cy, '9:41', 12, fg, True, 'lm')
            self.text(x_time + 36, cy, '11月22日(日)', 12, fg, True, 'lm')
        else:
            cy, x_time = 29, 52
            self.text(x_time, cy, '9:41', 16, fg, True, 'mm')
        # 電波・Wi-Fi・電池
        rx = self.wdp - (22 if self.config.is_tablet else 30)
        bw, bh = 24, 11.5
        self.rect(rx - bw, cy - bh / 2, bw, bh, 3.5, outline=fg[:3] + (110,), width=1)
        self.rect(rx - bw + 2, cy - bh / 2 + 2, bw - 4 - 4, bh - 4, 2, fill=fg)
        self.rect(rx + 1, cy - 2, 1.5, 4, 0.7, fill=fg[:3] + (110,))
        wx = rx - bw - 12
        for i, rr in enumerate([8, 5.3, 2.6]):
            self._wifi_arc(wx, cy + 4, rr, fg)
        sx = wx - 12 - 20
        for i in range(4):
            bh2 = 3.5 + i * 2.3
            self.rect(sx + i * 4.6, cy + 5 - bh2, 3, bh2, 1, fill=fg)
        if not self.config.is_tablet:
            # Dynamic Island
            iw, ih = 124, 36
            self.rect((self.wdp - iw) / 2, 11, iw, ih, ih / 2, fill=(0, 0, 0, 255))
        return self.img

    def _wifi_arc(self, cx, cy, r, color):
        X, Y, R = self.px(cx), self.px(cy), self.px(r)
        layer = Image.new('RGBA', (2 * R + 4, 2 * R + 4), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        if r < 3:
            d.pieslice((2, 2, 2 * R + 2, 2 * R + 2), 225, 315, fill=color)
        else:
            d.arc((2, 2, 2 * R + 2, 2 * R + 2), 225, 315, fill=color, width=self.px(1.8))
        self._composite(layer, X - R - 2, Y - R - 2)


# ──────────────────────────────────────────────
# サンプルの対局データ（合計・順位はここから計算する）
# ──────────────────────────────────────────────

PLAYERS = ['太郎', '花子', '次郎', '美咲']
GAME_DATE = '2026/11/22'
# (半荘, [点数], 記録時刻)
SCORE_ROUNDS = [
    (1, [45, -5, 10, -50], '11月22日19:52'),
    (2, [-20, 38, 4, -22], '11月22日20:31'),
    (3, [32, -15, -8, -9], '11月22日21:08'),
]
# ([チップ], 記録時刻, 直後の半荘)
CHIP_ROUNDS = [
    ([-2, 5, 0, -3], '11月22日20:33', 2),
]
RANK_COLORS = {1: GOLD, 2: SILVER, 3: BRONZE, 4: RANK_GRAY}
LIVE_EXPIRES = '2026/11/24 19:40'      # リアルタイム共有の有効期限（開始から48時間）
SHARE_EXPIRES = '2026/11/25 10:05'     # 終了済みゲームの共有コードの有効期限（発行から48時間）
LIVE_CODE = '482915'
SHARE_CODE = '381604'


def ranks_of(points):
    order = sorted(range(len(points)), key=lambda i: -points[i])
    ranks = [0] * len(points)
    for r, i in enumerate(order):
        ranks[i] = r + 1
    return ranks


def build_records(n_rounds, n_chips):
    """記録済みの半荘数・チップ記録数から、履歴行と総合スコアを作る。"""
    rows = []
    for hanchan, pts, t in SCORE_ROUNDS[:n_rounds]:
        rows.append(('score', hanchan, pts, ranks_of(pts), t))
    for chips, t, after in CHIP_ROUNDS[:n_chips]:
        rows.append(('chip', after, chips, None, t))
    # 新しい順（チップは直後の半荘のあと）
    rows.sort(key=lambda r: (r[1], r[0] == 'chip'), reverse=True)
    totals = [0] * len(PLAYERS)
    chip_totals = [0] * len(PLAYERS)
    rank_counts = [{r: 0 for r in range(1, len(PLAYERS) + 1)} for _ in PLAYERS]
    for kind, _, vals, rks, _ in rows:
        for i, v in enumerate(vals):
            totals[i] += v
            if kind == 'chip':
                chip_totals[i] += v
            else:
                rank_counts[i][rks[i]] += 1
    return rows, totals, chip_totals, rank_counts


def fmt_signed(v):
    return f"+{v}" if v > 0 else str(v)


def value_color(v, neutral=GRAY_TEXT):
    return GREEN if v > 0 else RED if v < 0 else neutral


# ──────────────────────────────────────────────
# 共通パーツ（アプリのコンポーネントに対応）
# ──────────────────────────────────────────────

PAD = 16  # scrollContent の padding


def section_title(sc, x, y, w, title, icon=None, right=None, right_color=GREEN, size=16, mb=12):
    """下線付きの見出し（sectionTitleRow / sectionTitle）。次の要素の y を返す。"""
    line_h = size * 1.25
    cy = y + max(line_h, 20 if icon else 0) / 2
    tx = x
    if icon:
        sc.icon(icon, x, cy - 10, 20)
        tx = x + 26
    sc.text(tx, cy, title, size, SECTION_TITLE_COLOR, True, 'lm')
    if right:
        sc.text(x + w, cy + 1, right, 12, right_color, False, 'rm')
    by = y + max(line_h, 20 if icon else 0) + 6
    sc.rect(x, by, w, 2, fill=C_BLUE_BOTTOM)
    return by + 2 + mb


def draw_badge(sc, x, y, label, color, size=10, pad_h=6, pad_v=3, r=10):
    w = sc.text_w(label, size) + 2 * pad_h
    h = size * 1.25 + 2 * pad_v
    sc.rect(x, y, w, h, r, fill=color)
    sc.text(x + w / 2, y + h / 2, label, size, WHITE, True, 'mm')
    return w, h


def drum_roll(sc, x, y, w, label, value):
    """DrumRollInput。高さを返す。"""
    sc.text(x, y + 10, label, 16, DARK_TEXT, True, 'lm')
    y += 20 + 6
    bw = (w - 4) / 2
    bh = 6 * 2 + 15 + 2
    for row_y, labels in ((y, ('+10', '+1')), (y + bh + 4 + 46 + 4, ('-10', '-1'))):
        for i, lb in enumerate(labels):
            bx = x + i * (bw + 4)
            sc.rect(bx, row_y, bw, bh, 4, fill=DRUMROLL_BTN_BG, outline=DRUMROLL_BTN_BORDER, width=1)
            sc.text(bx + bw / 2, row_y + bh / 2, lb, 12, DRUMROLL_BTN_TEXT, True, 'mm')
    dy = y + bh + 4
    sc.rect(x, dy, w, 46, 6, fill=WHITE, outline=C_BLUE_BOTTOM, width=2)
    sc.text(x + w / 2, dy + 23, fmt_signed(value), 18, value_color(value, SECTION_TITLE_COLOR), True, 'mm')
    return 26 + bh + 4 + 46 + 4 + bh


def input_card(sc, y, title, icon, values, record_label, record_color, fill=WHITE):
    """ポイント入力 / チップ移動 のカード。カード下端の y を返す。"""
    x, w = PAD, sc.wdp - 2 * PAD
    inner = w - 32
    col_w = inner * 0.48
    dr_h = 26 + 29 + 4 + 46 + 4 + 29
    h = 16 + 26 + 12 + 2 * (dr_h + 8) + 8 + 12 + 41 + 16
    sc.card(x, y, w, h, fill=fill)
    total = sum(values)
    cy = section_title(sc, x + 16, y + 16, inner, title, icon,
                       f"合計: {fmt_signed(total) if total else 0}", GREEN if total == 0 else RED)
    for i, (name, v) in enumerate(zip(PLAYERS, values)):
        dx = x + 16 + (i % 2) * (col_w + 8)
        dy = cy + (i // 2) * (dr_h + 8 + 8)
        drum_roll(sc, dx, dy, col_w, name, v)
    by = cy + 2 * (dr_h + 8 + 8) - 8 + 12
    rw = (inner - 8) / 3
    sc.rect(x + 16, by, rw, 41, 6, fill=WHITE, outline=DRUMROLL_BTN_BORDER, width=1)
    sc.text(x + 16 + rw / 2, by + 20.5, 'リセット', 14, GRAY_TEXT, True, 'mm')
    sc.rect(x + 16 + rw + 8, by, rw * 2, 41, 6, fill=record_color)
    sc.text(x + 16 + rw + 8 + rw, by + 20.5, record_label, 14, WHITE, True, 'mm')
    return y + h


def summary_cards(sc, y, totals, chip_totals, rank_counts):
    """SummaryCards（総合スコア）。カード下端の y を返す。"""
    x, w = PAD, sc.wdp - 2 * PAD
    inner = w - 32
    cw = inner * 0.48
    gap = 8
    # 先に高さを計算する（順位バッジは折り返す）
    def badge_rows(i):
        bx, rows = 0, 1
        for r in range(1, len(PLAYERS) + 1):
            bw = sc.text_w(f"{r}位 × {rank_counts[i][r]}", 10) + 12
            if bx and bx + bw > cw - 28:
                rows += 1
                bx = 0
            bx += bw + 4
        return rows
    item_h = []
    for i in range(len(PLAYERS)):
        hh = 12 + 18 + 6 + 6 + 25 + 6 + 6 + badge_rows(i) * 18.5 + (badge_rows(i) - 1) * 4
        if chip_totals[i]:
            hh += 6 + 14
        item_h.append(hh + 12)
    row_h = [max(item_h[0], item_h[1]), max(item_h[2], item_h[3])]
    h = 16 + 20 + 6 + 2 + 12 + row_h[0] + gap + row_h[1] + 16
    sc.card(x, y, w, h)
    cy = section_title(sc, x + 16, y + 16, inner, '総合スコア')
    for i, name in enumerate(PLAYERS):
        sx = x + 16 + (i % 2) * (cw + gap)
        sy = cy + (0 if i < 2 else row_h[0] + gap)
        sc.rect(sx, sy, cw, row_h[i // 2], 8, fill=C_ROW_BG, outline=CARD_BORDER, width=2)
        ix, iy = sx + 14, sy + 14
        sc.text(ix, iy + 9, name, 14, DARK_TEXT, True, 'lm')
        iy += 18 + 6 + 6
        sc.text(ix, iy + 12.5, fmt_signed(totals[i]), 20, value_color(totals[i]), True, 'lm')
        iy += 25 + 6 + 6
        bx = 0
        for r in range(1, len(PLAYERS) + 1):
            label = f"{r}位 × {rank_counts[i][r]}"
            bw = sc.text_w(label, 10) + 12
            if bx and bx + bw > cw - 28:
                bx = 0
                iy += 18.5 + 4
            draw_badge(sc, ix + bx, iy, label, RANK_COLORS[r])
            bx += bw + 4
        iy += 18.5
        if chip_totals[i]:
            sc.text(ix, iy + 6 + 7, f"チップ: {fmt_signed(chip_totals[i])}", 11, GRAY_TEXT, False, 'lm')
    return y + h


def history_table(sc, y, rows, editable):
    """HistoryTable（記録履歴）。カード下端の y を返す。"""
    x, w = PAD, sc.wdp - 2 * PAD
    inner = w - 32
    row_heights = []
    for kind, *_ in rows:
        row_heights.append(10 + 17 + 8 + (14 + 4 + 18 + 4 + 16 if kind == 'score' else 14 + 4 + 16) + 10)
    h = 16 + 20 + 6 + 2 + 4 + (14 + 10 if editable else 6) + sum(rh + 8 for rh in row_heights) + 8
    sc.card(x, y, w, h)
    cy = section_title(sc, x + 16, y + 16, inner, f"記録履歴（{GAME_DATE}）", mb=4)
    if editable:
        sc.text(x + 16, cy + 7, '※ 長押しで記録を削除できます', 11, HINT_TEXT, False, 'lm')
        cy += 14 + 10
    else:
        cy += 6
    cell_w = inner * 0.23
    for (kind, hanchan, vals, rks, t), rh in zip(rows, row_heights):
        chip = kind == 'chip'
        sc.rect(x + 16, cy, inner, rh, 8, fill=C_CHIP_ROW if chip else C_ROW_BG,
                outline=YELLOW if chip else CARD_BORDER, width=1)
        hx, hy = x + 16 + 10, cy + 10 + 8.5
        if chip:
            sc.icon('celebrate_chip', hx, hy - 8, 16)
            sc.text(hx + 20, hy, 'チップ', 14, C_CHIP_TEXT, True, 'lm')
        else:
            sc.text(hx, hy, f"第{hanchan}半荘", 14, DARK_TEXT, True, 'lm')
        sc.text(x + 16 + inner - 10, hy, t, 11, C_CHIP_TEXT if chip else GRAY_TEXT, False, 'rm')
        gy = cy + 10 + 17 + 8
        gx = x + 16 + 10
        for i, name in enumerate(PLAYERS):
            ccx = gx + i * (cell_w + 8) + cell_w / 2
            sc.text(ccx, gy + 7, name, 11, MED_TEXT, True, 'mm')
            if chip:
                sc.text(ccx, gy + 18 + 8, fmt_signed(vals[i]), 13, value_color(vals[i], HINT_TEXT), True, 'mm')
            else:
                label = f"{rks[i]}位"
                bw = sc.text_w(label, 10) + 16
                draw_badge(sc, ccx - bw / 2, gy + 18, label, RANK_COLORS[rks[i]], pad_h=8)
                sc.text(ccx, gy + 18 + 18.5 + 4 + 8, fmt_signed(vals[i]), 13, DARK_TEXT, True, 'mm')
        cy += rh + 8
    return y + h


def header_button(sc, x, y, w, h, label, fill, fg=WHITE, outline=None, size=14):
    sc.rect(x, y, w, h, 6, fill=fill, outline=outline, width=1 if outline else 0)
    sc.text(x + w / 2, y + h / 2, label, size, fg, True, 'mm')


def back_header(sc, y, title, right=None, fg=WHITE, back_fill=WHITE_A(0.2), title_size=24):
    """← 戻る | タイトル | 右側。ヘッダー下端の y を返す。"""
    bw = sc.text_w('← 戻る', 14) + 24
    h = 34
    header_button(sc, PAD, y + (title_size * 1.25 - h) / 2 + 2, bw, h - 4, '← 戻る', back_fill, fg)
    hh = title_size * 1.25
    sc.text(sc.wdp / 2, y + hh / 2, title, title_size, fg, True, 'mm')
    if right:
        label, fill, rfg = right
        rw = sc.text_w(label, 14) + 24
        header_button(sc, sc.wdp - PAD - rw, y + (hh - 30) / 2, rw, 30, label, fill, rfg)
    return y + hh


def live_banner(sc, y, title, lines, icon, live_mode=False):
    """liveBanner（共有中・閲覧中）。下端の y を返す。"""
    x, w = PAD, sc.wdp - 2 * PAD
    h = 12 + 20 + sum(4 + 15 for _ in lines) + 12
    if live_mode:
        sc.rect(x, y, w, h, 12, fill=WHITE_A(0.6), outline=C_LIVE_BORDER, width=2)
        fg, sub = C_LIVE_TEXT, rgba(C_LIVE_TEXT, 0.85)
    else:
        sc.rect(x, y, w, h, 12, fill=WHITE_A(0.15), outline=WHITE_A(0.4), width=1)
        fg, sub = WHITE, WHITE_A(0.85)
    sc.icon(icon, x + 12, y + 12 + 1, 18)
    sc.text(x + 12 + 24, y + 12 + 10, title, 15, fg, True, 'lm')
    ly = y + 12 + 20
    for ln in lines:
        sc.text(x + 12, ly + 4 + 7.5, ln, 12, sub, False, 'lm')
        ly += 4 + 15
    return y + h


def game_header(sc, y, hanchan):
    """進行中ゲームのヘッダー（第N半荘 | 名前変更 | 中断 | ゲーム終了）。下端の y を返す。"""
    h = 34
    sc.text(PAD, y + h / 2, f"第{hanchan}半荘", 24, WHITE, True, 'lm')
    labels = [('ゲーム終了', RED, RED), ('中断', WHITE_A(0.2), WHITE_A(0.4)), ('名前変更', WHITE_A(0.15), WHITE_A(0.4))]
    rx = sc.wdp - PAD
    for label, fill, border in labels:
        extra = 13 + 4 if label == '名前変更' else 0
        bw = sc.text_w(label, 13) + 20 + extra
        bx = rx - bw
        sc.rect(bx, y, bw, h, 6, fill=fill, outline=border, width=1)
        if extra:
            sc.icon('pencil', bx + 10, y + (h - 13) / 2, 13)
        sc.text(bx + 10 + extra + (bw - 20 - extra) / 2, y + h / 2, label, 13, WHITE, True, 'mm')
        rx = bx - 8
    return y + h


def live_start_button(sc, y):
    x, w = PAD, sc.wdp - 2 * PAD
    h = 14 + 22 + 4 + 15 + 14
    sc.shadow(x, y, w, h, 10, alpha=0.25)
    sc.rect(x, y, w, h, 10, fill=YELLOW_BTN)
    label = 'リアルタイム共有を開始'
    tw = sc.text_w(label, 16) + 20 + 8
    sx = sc.wdp / 2 - tw / 2
    sc.icon('broadcast_dark', sx, y + 14 + 1, 20)
    sc.text(sx + 28, y + 14 + 11, label, 16, C_LIVE_TEXT, True, 'lm')
    sc.text(sc.wdp / 2, y + 14 + 22 + 4 + 7.5, '同じ卓のメンバーがコードでスコアを閲覧できます', 12,
            rgba(C_LIVE_TEXT, 0.8), False, 'mm')
    return y + h


YELLOW_BTN = (253, 216, 53)  # #fdd835


def modal_overlay(sc, alpha=0.5):
    layer = Image.new('RGBA', (sc.w, sc.h), (0, 0, 0, int(255 * alpha)))
    sc.img.alpha_composite(layer)


def code_modal(sc, title, desc, code, expires, buttons):
    """共有コードのモーダル（shareModalContent）。"""
    modal_overlay(sc)
    mw = min(sc.wdp - 48, 460)
    mx = (sc.wdp - mw) / 2
    inner = mw - 48
    desc_lines = sc.wrap(desc, 13, inner, False)
    h = 24 + 25 + 12 + len(desc_lines) * 20 + 16 + 44 + 8 + 15 + 16 + len(buttons) * (48 + 8) - 8 + 24
    my = (sc.hdp - h) / 2
    sc.anchors = {**getattr(sc, 'anchors', {}), 'modal_top': my, 'modal_h': h}
    sc.shadow(mx, my, mw, h, 16, dy=4, blur=8, alpha=0.3)
    sc.rect(mx, my, mw, h, 16, fill=WHITE)
    y = my + 24
    sc.text(sc.wdp / 2, y + 12.5, title, 20, SECTION_TITLE_COLOR, True, 'mm')
    y += 25 + 12
    for ln in desc_lines:
        sc.text(sc.wdp / 2, y + 10, ln, 13, LIGHT_TEXT, False, 'mm')
        y += 20
    y += 16
    sc.text(sc.wdp / 2, y + 22, code, 36, SECTION_TITLE_COLOR, True, 'mm', spacing=6)
    y += 44 + 8
    sc.text(sc.wdp / 2, y + 7.5, f"有効期限: {expires}", 12, LIGHT_TEXT, False, 'mm')
    y += 15 + 16
    for label, fill, fg in buttons:
        sc.rect(mx + 24, y, inner, 48, 8, fill=fill)
        sc.text(sc.wdp / 2, y + 24, label, 16, fg, True, 'mm')
        y += 48 + 8


def finish_modal(sc, totals, rank_counts):
    """FinishGameModal（ゲーム終了の確認）。"""
    modal_overlay(sc)
    mw = min(sc.wdp - 40, 450)
    mx = (sc.wdp - mw) / 2
    order = sorted(range(len(PLAYERS)), key=lambda i: -totals[i])
    row_h = 10 + 18 + 6 + 15.5 + 10
    head_h = 20 + 40 + 8 + 25 + 10 + 2
    body_h = 20 + 2 * 20 + 16 + len(order) * (row_h + 8) - 8 + 20
    foot_h = 20 + 41 + 20 + 1
    h = head_h + body_h + foot_h
    my = (sc.hdp - h) / 2
    sc.anchors = {**getattr(sc, 'anchors', {}), 'modal_top': my, 'modal_h': h}
    sc.shadow(mx, my, mw, h, 12, dy=4, blur=8, alpha=0.3)
    sc.rect(mx, my, mw, h, 12, fill=WHITE)
    sc.icon('flag', sc.wdp / 2 - 20, my + 20, 40)
    sc.text(sc.wdp / 2, my + 20 + 40 + 8 + 12.5, 'ゲーム終了', 20, DARK_TEXT, True, 'mm')
    sc.rect(mx, my + head_h - 2, mw, 2, fill=CARD_BORDER)
    y = my + head_h + 20
    for ln in ('ゲームを終了して最初の画面に戻りますか？', '記録は保存されます。'):
        sc.text(sc.wdp / 2, y + 10, ln, 14, MED_TEXT, False, 'mm')
        y += 20
    y += 16
    border = {0: YELLOW, 1: SILVER, 2: BRONZE}
    for idx, i in enumerate(order):
        rx, rw = mx + 20, mw - 40
        sc.rect(rx, y, rw, row_h, 6, fill=(255, 251, 234) if idx == 0 else C_ROW_BG)
        sc.rect(rx, y, 3, row_h, 0, fill=border.get(idx, CARD_BORDER))
        nx = rx + 3 + 10
        if idx < 3:
            sc.icon(f"medal{idx + 1}", nx, y + 10, 18)
            nx += 22
        sc.text(nx, y + 10 + 9, PLAYERS[i], 14, DARK_TEXT, True, 'lm')
        bx = rx + 13
        for r in range(1, len(PLAYERS) + 1):
            c = rank_counts[i][r]
            if not c:
                continue
            bw, _ = draw_badge(sc, bx, y + 10 + 18 + 6, f"{r}位×{c}", RANK_COLORS[r], size=9, pad_v=2)
            bx += bw + 4
        sc.text(rx + rw - 10, y + row_h / 2, fmt_signed(totals[i]), 18, value_color(totals[i]), True, 'rm')
        y += row_h + 8
    fy = my + head_h + body_h
    sc.rect(mx, fy, mw, 1, fill=CARD_BORDER)
    bw = (mw - 40 - 10) / 2
    for k, (label, fill) in enumerate((('キャンセル', GRAY_TEXT), ('終了する', RED))):
        bx = mx + 20 + k * (bw + 10)
        sc.rect(bx, fy + 21, bw, 41, 6, fill=fill)
        sc.text(bx + bw / 2, fy + 21 + 20.5, label, 14, WHITE, True, 'mm')


# ──────────────────────────────────────────────
# 掲載画像の枠（キャッチコピー + 端末フレーム）
# ──────────────────────────────────────────────

def fit_font(draw, text, kind, size, max_w):
    while size > 10:
        f = pfont(kind, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return pfont(kind, size)


def create_promo_frame(screen_img, title, subtitle, config):
    promo_w, promo_h = config.promo_w, config.promo_h
    img = Image.new('RGBA', (promo_w, promo_h), (0, 0, 0, 255))
    draw_gradient_bg(img, (14, 30, 70), (48, 96, 170))

    # 端末の後ろの淡い光
    glow = Image.new('RGBA', (promo_w, promo_h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((promo_w * 0.05, promo_h * 0.28, promo_w * 0.95, promo_h * 0.9),
                                 fill=(120, 170, 255, 60))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(promo_w * 0.08)))

    draw = ImageDraw.Draw(img)
    unit = promo_w if not config.is_tablet else promo_w * 0.8
    y = int(promo_h * 0.035)
    tf = fit_font(draw, title, 'caption', int(unit * 0.088), promo_w * 0.9)
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((promo_w // 2 + 4, y + 6), title, font=tf, fill=(0, 0, 0, 110), anchor='ma')
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4)))
    draw = ImageDraw.Draw(img)
    draw.text((promo_w // 2, y), title, font=tf, fill=WHITE, anchor='ma')
    y += int(tf.size * 1.32)
    sf = fit_font(draw, subtitle, 'caption', int(unit * 0.056), promo_w * 0.9)
    draw.text((promo_w // 2, y), subtitle, font=sf, fill=(255, 213, 79), anchor='ma')
    y += int(sf.size * 1.45) + int(promo_h * 0.012)

    # 端末（下端まで収まる最大サイズ）
    sw, sh_ = config.screen_w, config.screen_h
    bottom_margin = int(promo_h * 0.03)
    avail_h = promo_h - y - bottom_margin
    bezel_ratio = 0.03 if config.is_tablet else 0.032
    phone_w = min(int(promo_w * (0.84 if config.is_tablet else 0.8)), int(avail_h / (sh_ / sw + 2 * bezel_ratio)))
    phone_h = int(phone_w * sh_ / sw)
    bezel = int(phone_w * bezel_ratio)
    corner = int(phone_w * (0.035 if config.is_tablet else 0.13))
    ow, oh = phone_w + 2 * bezel, phone_h + 2 * bezel
    px = (promo_w - ow) // 2
    py = promo_h - bottom_margin - oh

    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((px + 10, py + 24, px + ow + 10, py + oh + 24),
                                             radius=corner + bezel, fill=(0, 0, 0, 120))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(36)))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((px, py, px + ow, py + oh), radius=corner + bezel, fill=(24, 24, 28),
                           outline=(92, 96, 108), width=max(3, bezel // 7))

    screen = screen_img.resize((phone_w, phone_h), Image.LANCZOS)
    mask = Image.new('L', (phone_w, phone_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, phone_w - 1, phone_h - 1), radius=corner, fill=255)
    img.paste(screen, (px + bezel, py + bezel), mask)
    return img.convert('RGB')


def save_promo(sc, title, subtitle, config, output_path):
    promo = create_promo_frame(sc.finish(), title, subtitle, config)
    assert promo.size == (config.promo_w, config.promo_h)
    promo.save(output_path, 'PNG', optimize=True)
    print(f"Generated: {output_path} ({promo.size[0]}x{promo.size[1]})")


# ──────────────────────────────────────────────
# 各画面
# ──────────────────────────────────────────────

def draw_setup_screen(sc):
    """初期画面を描く。「新規ゲーム」カードの上端の y を返す。"""
    x, w = PAD, sc.wdp - 2 * PAD
    y = sc.top + PAD
    # 使い方ボタン + タイトルロゴ
    sc.rect(sc.wdp - PAD - 40, y, 40, 40, 8, fill=WHITE_A(0.25))
    sc.text(sc.wdp - PAD - 20, y + 14, '?', 18, WHITE, True, 'mm')
    sc.text(sc.wdp - PAD - 20, y + 31, '使い方', 9, WHITE, True, 'mm')
    logo_w = min(340, max(200, sc.wdp - 32 - 2 * 46))
    sc.icon('logo', (sc.wdp - logo_w) / 2, y, logo_w)
    y += logo_w * 108 / 320 + 24
    card_top = y

    # 新規ゲーム
    inner = w - 40
    in_w = inner * 0.48
    type_h = 16 * 2 + 30 + 8 + 17 + 4
    h = 20 + (22 + 8 + 2 + 16) + (17 + 8) + type_h + 20 + (17 + 8) + 20 + 2 * (15 + 4 + 43) + 12 + 20 + 4 + 47 + 20
    sc.card(x, y, w, h, shadow=True)
    cy = section_title(sc, x + 20, y + 20, inner, '新規ゲーム', size=18, mb=16)
    sc.text(x + 20, cy + 8.5, '麻雀タイプ', 14, SECTION_TITLE_COLOR, True, 'lm')
    cy += 17 + 8
    tw = (inner - 12) / 2
    for i, (label, icon, active) in enumerate((('4人麻雀', 'tile', True), ('3人麻雀', 'fan', False))):
        tx = x + 20 + i * (tw + 12)
        sc.rect(tx, cy, tw, type_h, 8, fill=C_BLUE_BOTTOM if active else WHITE,
                outline=C_BLUE_BOTTOM if active else CARD_BORDER, width=2)
        sc.icon(icon, tx + tw / 2 - 15, cy + 18, 30)
        sc.text(tx + tw / 2, cy + 18 + 30 + 8 + 8.5, label, 14, WHITE if active else GRAY_TEXT, True, 'mm')
    cy += type_h + 20
    sc.text(x + 20, cy + 8.5, 'プレイヤー設定', 14, SECTION_TITLE_COLOR, True, 'lm')
    cy += 17 + 8
    sc.text(x + 20, cy + 7, '※ 6文字以内で入力してください', 11, HINT_TEXT, False, 'lm')
    cy += 14 + 6
    for i, name in enumerate(PLAYERS):
        ix = x + 20 + (i % 2) * (in_w + 12)
        iy = cy + (i // 2) * (15 + 4 + 43 + 12)
        sc.text(ix, iy + 7.5, f"プレイヤー{i + 1}", 12, MED_TEXT, True, 'lm')
        sc.rect(ix, iy + 19, in_w, 43, 6, fill=WHITE, outline=INPUT_BORDER, width=2)
        sc.text(ix + 12, iy + 19 + 21.5, name, 16, DARK_TEXT, False, 'lm')
    cy += 2 * (15 + 4 + 43) + 12 + 20 + 4
    sc.rect(x + 20, cy, inner, 47, 6, fill=C_BLUE_BOTTOM)
    sc.text(sc.wdp / 2, cy + 23.5, 'ゲーム開始', 16, WHITE, True, 'mm')
    y += h + 16

    # 過去のゲーム履歴管理
    h2 = 20 + 48 + 47 + 8 + 47 + 20
    sc.card(x, y, w, h2)
    cy = section_title(sc, x + 20, y + 20, inner, '過去のゲーム履歴管理', size=18, mb=16)
    for label, fill in (('過去のゲームを見る', GRAY_TEXT), ('ゲームを取り込む', TEAL)):
        sc.rect(x + 20, cy, inner, 47, 6, fill=fill)
        sc.text(sc.wdp / 2, cy + 23.5, label, 16, WHITE, True, 'mm')
        cy += 47 + 8
    return card_top


def generate_promo_setup(output_path, config=IPHONE):
    """初期画面（新しいタイトルロゴ・麻雀タイプのアイコン）。"""
    sc = Screen(config)
    draw_setup_screen(sc)
    save_promo(sc, '3人・4人麻雀に対応', '名前を入れてすぐにスタート', config, output_path)


def draw_game_screen(sc, scroll, hanchan, n_rounds, n_chips, score_values, chip_values, live_host=False):
    """進行中のゲーム画面全体を、scroll（dp）だけスクロールした状態で描く。"""
    rows, totals, chip_totals, rank_counts = build_records(n_rounds, n_chips)
    y = sc.top + PAD - scroll
    y = game_header(sc, y, hanchan) + 16
    if live_host:
        y = live_banner(sc, y, 'リアルタイム共有中',
                        [f"有効期限: {LIVE_EXPIRES}", '入力は自動で共有されます。タップでコードを表示'],
                        'broadcast') + 16
    else:
        y = live_start_button(sc, y) + 16
    sc.anchors = {'score_top': y}
    y = input_card(sc, y, 'ポイント入力', 'tile', score_values, 'スコアを記録', GREEN) + 16
    chip_top = y
    y = input_card(sc, y, 'チップ移動', 'celebrate', chip_values, 'チップを記録', YELLOW, fill=C_CHIP_CARD) + 16
    summary_top = y
    y = summary_cards(sc, y, totals, chip_totals, rank_counts) + 16
    history_table(sc, y, rows, editable=True)
    return chip_top, summary_top, (totals, rank_counts)


def game_offsets(config):
    """チップ移動カード・総合スコアの位置（スクロール量の計算用）。"""
    probe = Screen(config)
    chip_top, summary_top, _ = draw_game_screen(probe, 0, 4, 3, 1, [0] * 4, [0] * 4)
    return chip_top - probe.top, summary_top - probe.top


def generate_promo_score(output_path, config=IPHONE):
    """スコア入力（ポイント入力）。"""
    sc = Screen(config)
    draw_game_screen(sc, 0, 3, 2, 1, [32, -15, -8, -9], [0, 0, 0, 0])
    save_promo(sc, 'ポイントをかんたん入力', 'ボタンで増減・合計±0で記録', config, output_path)


def generate_promo_chip(output_path, config=IPHONE):
    """チップ移動と総合スコア（チップ移動カードまでスクロール）。"""
    chip_top, _ = game_offsets(config)
    sc = Screen(config)
    draw_game_screen(sc, chip_top - PAD, 4, 3, 1, [0] * 4, [3, -1, 2, -4])
    save_promo(sc, 'チップの移動も記録', '総合スコアに自動で反映', config, output_path)


def generate_promo_summary(output_path, config=IPHONE):
    """総合スコアと記録履歴 + ゲーム終了の確認（メダル）。"""
    _, summary_top = game_offsets(config)
    sc = Screen(config)
    _, _, (totals, rank_counts) = draw_game_screen(sc, summary_top - PAD, 4, 3, 1, [0] * 4, [0] * 4)
    finish_modal(sc, totals, rank_counts)
    save_promo(sc, '順位とスコアをひと目で', 'ゲーム終了で結果を確定', config, output_path)


def generate_promo_live_host(output_path, config=IPHONE):
    """リアルタイム共有（ホスト）: 共有中バナー + 6桁の数字コードのモーダル。"""
    sc = Screen(config)
    draw_game_screen(sc, 0, 3, 2, 1, [0] * 4, [0] * 4, live_host=True)
    code_modal(sc, 'リアルタイム共有', '「ゲームを取り込む」にこのコードを入力すると閲覧できます',
               LIVE_CODE, LIVE_EXPIRES,
               [('コードをコピー', GREEN, WHITE), ('閉じる', (240, 240, 240), LIGHT_TEXT)])
    save_promo(sc, 'リアルタイム共有', '6桁の数字コード・最長48時間', config, output_path)


def generate_promo_live_viewer(output_path, config=IPHONE):
    """閲覧モード（ゲスト・黄色基調）。"""
    sc = Screen(config, live=True)
    rows, totals, chip_totals, rank_counts = build_records(2, 1)
    y = sc.top + PAD
    # ヘッダー: ← 戻る | 日付 | 閲覧モード
    y = back_header(sc, y, GAME_DATE, ('閲覧モード', RED, WHITE), fg=C_LIVE_TEXT,
                    back_fill=rgba(C_LIVE_TEXT, 0.12)) + 16
    y = live_banner(sc, y, '閲覧中', ['ホストの入力が自動で反映されます（編集不可）', f"有効期限: {LIVE_EXPIRES}"],
                    'broadcast_dark', live_mode=True) + 16
    y = summary_cards(sc, y, totals, chip_totals, rank_counts) + 16
    history_table(sc, y, rows, editable=False)
    save_promo(sc, '閲覧モード', 'ホストの記録が自動で反映', config, output_path)


def generate_promo_share(output_path, config=IPHONE):
    """終了済みゲームの共有（6桁の数字コード）。"""
    sc = Screen(config)
    rows, totals, chip_totals, rank_counts = build_records(3, 1)
    y = sc.top + PAD
    y = back_header(sc, y, GAME_DATE, ('共有', C_BLUE_BOTTOM, WHITE)) + 16
    y = live_banner(sc, y, f"共有中  コード: {SHARE_CODE}", [f"有効期限: {SHARE_EXPIRES}", 'タップでコードを表示'],
                    'send') + 16
    y = summary_cards(sc, y, totals, chip_totals, rank_counts) + 16
    history_table(sc, y, rows, editable=False)
    code_modal(sc, 'ゲームを共有', '「ゲームを取り込む」にこのコードを入力すると閲覧・保存できます',
               SHARE_CODE, SHARE_EXPIRES,
               [('送信する', C_BLUE_BOTTOM, WHITE), ('コードをコピー', GREEN, WHITE),
                ('閉じる', (240, 240, 240), LIGHT_TEXT)])
    save_promo(sc, '終わった対局も共有', '6桁の数字コード・48時間有効', config, output_path)


PAST_GAMES = [
    # (日付, 人数, プレイヤー, 半荘数, お気に入り, 取り込み, 閲覧中)
    ('2026/11/24', 4, ['健太', '翔', '大輔', '拓海'], 2, None, False, True),
    ('2026/11/22', 4, PLAYERS, 3, True, False, False),
    ('2026/11/20', 3, ['太郎', '花子', '次郎'], 6, True, False, False),
    ('2026/11/15', 4, ['Aさん', 'Bさん', 'Cさん', 'Dさん'], 5, False, True, False),
    ('2026/11/08', 3, ['太郎', '美咲', '次郎'], 4, False, False, False),
    ('2026/11/01', 4, PLAYERS, 6, True, False, False),
    ('2026/10/25', 3, ['花子', '次郎', '美咲'], 3, False, False, False),
    ('2026/10/18', 4, ['太郎', '花子', '健太', '翔'], 5, False, False, False),
    ('2026/10/11', 4, PLAYERS, 4, False, False, False),
]


def generate_promo_past_games(output_path, config=IPHONE):
    """過去のゲーム一覧（お気に入り・金の五筒アイコン・閲覧中の対局）。"""
    sc = Screen(config)
    x, w = PAD, sc.wdp - 2 * PAD
    y = sc.top + 12
    y = back_header(sc, y, '過去のゲーム', title_size=20) + 12
    note = ('星マークをタップでお気に入り（最大20件）。保存はお気に入りを含めて100件までで、'
            '超えるとお気に入り以外の古いものから自動で削除されます。')
    y = sc.paragraph(x, y, note, 12, WHITE_A(0.85), w, 18) + 12
    card_h = 16 + 22 + 8 + 1 + 10 + 20 + 16
    for date, count, names, hanchan, fav, imported, joined in PAST_GAMES:
        if joined:
            sc.card(x, y, w, card_h, fill=C_LIVE_CARD, outline=YELLOW_LIVE, width=2)
        else:
            sc.card(x, y, w, card_h)
        ix, iw = x + 16, w - 32
        hy = y + 16 + 11
        sc.text(ix, hy, date, 16, SECTION_TITLE_COLOR, True, 'lm')
        bx = ix + sc.text_w(date, 16) + 8
        if joined:
            bw = sc.text_w('● 閲覧モード', 11) + 12
            sc.rect(bx, hy - 9, bw, 18, 4, fill=YELLOW_LIVE)
            sc.text(bx + bw / 2, hy, '● 閲覧モード', 11, C_LIVE_TEXT, True, 'mm')
        if imported:
            bw = sc.text_w('共有', 11) + 12
            sc.rect(bx, hy - 9, bw, 18, 4, fill=(232, 244, 253), outline=(144, 202, 249), width=1)
            sc.text(bx + bw / 2, hy, '共有', 11, (21, 101, 192), True, 'mm')
        # 右側: 麻雀タイプ + お気に入り
        rx = ix + iw
        if fav is not None:
            sc.icon('star_on' if fav else 'star_off', rx - 2 - 22, hy - 11, 22)
            rx -= 2 + 22 + 2 + 8
        label = '3人麻雀' if count == 3 else '4人麻雀'
        lw = sc.text_w(label, 13, False)
        sc.text(rx, hy, label, 13, GRAY_TEXT, False, 'rm')
        sc.icon('fan' if count == 3 else 'tile', rx - lw - 3 - 16, hy - 8, 16)
        sc.rect(ix, y + 16 + 22 + 8, iw, 1, fill=(238, 238, 238))
        by = y + 16 + 22 + 8 + 1 + 10 + 10
        sc.text(ix, by, ' / '.join(names), 14, DARK_TEXT, False, 'lm')
        sc.text(ix + iw, by, f"{hanchan}半荘", 13, GRAY_TEXT, True, 'rm')
        y += card_h + 12
        if y > sc.hdp:
            break
    save_promo(sc, '過去の対局を保存', 'お気に入り登録・最大100件まで保存', config, output_path)


YELLOW_LIVE = (249, 168, 37)  # #f9a825


# ──────────────────────────────────────────────
# 使い方ガイドの画像（Issue #72）
# ──────────────────────────────────────────────
# 使い方のモーダルは正方形に近い比率で表示するため、画像は 4:3 で作る（Issue #72）。
# Issue #74: 明るく楽しいトーンに作り替え。ページごとのパステル調のグラデーション背景に
# 紙吹雪を散らし、各ページで説明する部分の画面を「カード」として少し傾けて載せ、
# アプリの手書き風アイコンをステッカーのように貼る。説明文はアプリ側で一言だけ添える。

GUIDE_ASPECT = 3 / 4          # 高さ / 幅（出力画像）
GUIDE_OUT_W = 960             # 出力する画像の幅（px）
GUIDE_CARD_W = 760            # 画面カードの幅（px）
GUIDE_CARD_TOP = 64           # 画面カードの上端（px）。下端は画像の外まではみ出させる
GUIDE_CARD_ASPECT = (GUIDE_OUT_W * GUIDE_ASPECT - GUIDE_CARD_TOP + 40) / GUIDE_CARD_W  # 切り出す高さ / 幅
GUIDE_SEED = 74

# ページごとの明るい配色（背景グラデーション上・下、アクセント）。SetupScreen の GUIDE_THEMES と揃える
GUIDE_THEMES = [
    ((255, 241, 118), (255, 183, 77), (255, 112, 67)),     # 1 レモン → オレンジ
    ((178, 235, 242), (129, 212, 250), (41, 121, 255)),    # 2 ミント → スカイ
    ((255, 224, 130), (255, 204, 128), (255, 160, 0)),     # 3 ひまわり
    ((248, 187, 208), (225, 190, 231), (236, 64, 122)),    # 4 ピーチ → ラベンダー
    ((200, 230, 201), (165, 214, 167), (67, 160, 71)),     # 5 ライム
    ((255, 245, 157), (255, 213, 79), (245, 127, 23)),     # 6 たまご
    ((209, 196, 233), (179, 229, 252), (124, 77, 255)),    # 7 ラベンダー → 空色
]
# 各ページに貼る手書き風アイコン
GUIDE_STICKERS = ['tile', 'pencil', 'celebrate_chip', 'flag', 'broadcast', 'broadcast_dark', 'send']
# ステッカーを貼る側（説明したい部分を隠さない側）
GUIDE_STICKER_LEFT = [True, False, True, False, True, True, True]
CONFETTI_COLORS = [(255, 82, 82), (255, 193, 7), (76, 175, 80), (33, 150, 243), (156, 39, 176), (255, 255, 255)]


def _guide_background(index):
    import random
    top, bottom, accent = GUIDE_THEMES[index]
    W, H = GUIDE_OUT_W, int(round(GUIDE_OUT_W * GUIDE_ASPECT))
    bg = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    draw_gradient_bg(bg, top, bottom)
    rnd = random.Random(GUIDE_SEED * 100 + index)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # 大きな水玉（うっすら）
    for _ in range(6):
        r = rnd.randint(60, 140)
        x, y = rnd.randint(-40, W + 40), rnd.randint(-40, H + 40)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 60))
    # 紙吹雪（丸・細長い四角・きらきら）
    for _ in range(46):
        c = rnd.choice(CONFETTI_COLORS + [accent])
        x, y = rnd.randint(0, W), rnd.randint(0, H)
        kind = rnd.random()
        if kind < 0.4:
            r = rnd.randint(5, 11)
            d.ellipse((x - r, y - r, x + r, y + r), fill=c + (220,))
        elif kind < 0.8:
            piece = Image.new('RGBA', (34, 34), (0, 0, 0, 0))
            ImageDraw.Draw(piece).rounded_rectangle((11, 4, 21, 30), radius=4, fill=c + (230,))
            piece = piece.rotate(rnd.randint(0, 180), resample=Image.BICUBIC)
            layer.alpha_composite(piece, dest=(max(0, x - 17), max(0, y - 17)))
        else:
            r = rnd.randint(10, 16)
            pts = []
            for k in range(8):
                a = math.pi / 4 * k
                rr = r if k % 2 == 0 else r * 0.32
                pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
            d.polygon(pts, fill=(255, 255, 255, 235))
    bg.alpha_composite(layer)
    return bg, accent


def save_guide(sc, top_dp, output_path, index):
    """画面の top_dp（dp）から下を切り出し、明るい背景にカードとして載せて 4:3 で保存する。"""
    img = sc.finish()
    crop_h = sc.wdp * GUIDE_CARD_ASPECT
    top = max(0.0, min(top_dp, sc.hdp - crop_h))
    box = (0, sc.px(top), sc.w, sc.px(top) + int(round(sc.w * GUIDE_CARD_ASPECT)))
    shot = img.crop(box).convert('RGBA')
    cw = GUIDE_CARD_W
    ch = int(round(cw * GUIDE_CARD_ASPECT))
    shot = shot.resize((cw, ch), Image.LANCZOS)

    out, accent = _guide_background(index)
    W, H = out.size

    # カード: 白い太めのフチ + 角丸 + やわらかい影。左右交互に少しだけ傾ける
    border = 14
    radius = 30
    card = Image.new('RGBA', (cw + border * 2, ch + border * 2), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle((0, 0, card.width - 1, card.height - 1), radius=radius + border,
                                           fill=(255, 255, 255, 255))
    mask = Image.new('L', shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), radius=radius, fill=255)
    card.paste(shot, (border, border), mask)
    angle = 2.2 if index % 2 == 0 else -2.2
    pad = 60
    holder = Image.new('RGBA', (card.width + pad * 2, card.height + pad * 2), (0, 0, 0, 0))
    shadow = Image.new('RGBA', holder.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((pad + 6, pad + 14, pad + card.width + 6, pad + card.height + 14),
                                             radius=radius + border, fill=accent + (110,))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    holder.alpha_composite(shadow)
    holder.alpha_composite(card, dest=(pad, pad))
    holder = holder.rotate(angle, resample=Image.BICUBIC)
    cx = W // 2
    out.alpha_composite(holder, dest=(cx - holder.width // 2, GUIDE_CARD_TOP - border - pad))

    # 手書き風アイコンのステッカー（白い丸の台紙に貼って、カードの角に重ねる）
    sticker = ICONS[GUIDE_STICKERS[index]]
    sr = 74
    disc = Image.new('RGBA', (sr * 2 + 40, sr * 2 + 40), (0, 0, 0, 0))
    dd = ImageDraw.Draw(disc)
    dd.ellipse((20 + 4, 20 + 8, 20 + sr * 2 + 4, 20 + sr * 2 + 8), fill=(0, 0, 0, 50))
    disc = disc.filter(ImageFilter.GaussianBlur(4))
    dd = ImageDraw.Draw(disc)
    dd.ellipse((20, 20, 20 + sr * 2, 20 + sr * 2), fill=(255, 255, 255, 255), outline=accent + (255,), width=7)
    icon_px = int(sr * 1.3)
    ic = sticker.resize((icon_px, int(round(icon_px * sticker.height / sticker.width))), Image.LANCZOS)
    # 白線のアイコン（送信・配信）は台紙が白だと見えないので、アクセント色の丸を下に敷く
    if GUIDE_STICKERS[index] in ('send', 'broadcast'):
        ImageDraw.Draw(disc).ellipse((20 + 12, 20 + 12, 20 + sr * 2 - 12, 20 + sr * 2 - 12), fill=accent + (255,))
        icon_px = int(sr * 1.05)
        ic = sticker.resize((icon_px, int(round(icon_px * sticker.height / sticker.width))), Image.LANCZOS)
    disc.alpha_composite(ic, dest=(20 + sr - ic.width // 2, 20 + sr - ic.height // 2))
    left = GUIDE_STICKER_LEFT[index]
    disc = disc.rotate(-10 if left else 10, resample=Image.BICUBIC)
    sx = 18 if left else W - disc.width - 18
    out.alpha_composite(disc, dest=(sx, 0))

    out = out.convert('RGB')
    out.save(output_path, 'PNG', optimize=True)
    print(f"Generated: {output_path} ({out.size[0]}x{out.size[1]})")


def generate_guide_images(output_dir, config=IPHONE):
    """使い方ガイド（SetupScreen）の各ページの画像。"""
    os.makedirs(output_dir, exist_ok=True)
    path = lambda name: os.path.join(output_dir, name)  # noqa: E731

    # 1. ゲームの始め方: 麻雀タイプとプレイヤー名
    sc = Screen(config)
    card_top = draw_setup_screen(sc)
    save_guide(sc, card_top + 20 + 26 + 12 - 6, path('guide_1_setup.png'), 0)

    # 2. スコアの記録: ポイント入力
    sc = Screen(config)
    draw_game_screen(sc, 0, 3, 2, 1, [32, -15, -8, -9], [0, 0, 0, 0])
    save_guide(sc, sc.anchors['score_top'] - 10, path('guide_2_score.png'), 1)

    # 3. チップの記録: チップ移動（チップ移動カードまでスクロール）
    chip_top, _ = game_offsets(config)
    sc = Screen(config)
    draw_game_screen(sc, chip_top - PAD, 4, 3, 1, [0] * 4, [3, -1, 2, -4])
    save_guide(sc, sc.top + PAD - 10, path('guide_3_chip.png'), 2)

    # 4. ゲームの中断・終了: ヘッダーのボタン + ゲーム終了の確認
    sc = Screen(config)
    _, _, (totals, rank_counts) = draw_game_screen(sc, 0, 4, 3, 1, [0] * 4, [0] * 4)
    finish_modal(sc, totals, rank_counts)
    save_guide(sc, sc.anchors['modal_top'] - 10, path('guide_4_finish.png'), 3)

    # 5. リアルタイム共有（ホスト）: 6桁のコード
    sc = Screen(config)
    draw_game_screen(sc, 0, 3, 2, 1, [0] * 4, [0] * 4, live_host=True)
    code_modal(sc, 'リアルタイム共有', '「ゲームを取り込む」にこのコードを入力すると閲覧できます',
               LIVE_CODE, LIVE_EXPIRES,
               [('コードをコピー', GREEN, WHITE), ('閉じる', (240, 240, 240), LIGHT_TEXT)])
    a = sc.anchors
    save_guide(sc, a['modal_top'] + a['modal_h'] / 2 - sc.wdp * GUIDE_CARD_ASPECT / 2, path('guide_5_live_share.png'), 4)

    # 6. 閲覧モード（ゲスト・黄色基調）
    sc = Screen(config, live=True)
    rows, totals, chip_totals, rank_counts = build_records(2, 1)
    y = sc.top + PAD
    y = back_header(sc, y, GAME_DATE, ('閲覧モード', RED, WHITE), fg=C_LIVE_TEXT,
                    back_fill=rgba(C_LIVE_TEXT, 0.12)) + 16
    y = live_banner(sc, y, '閲覧中', ['ホストの入力が自動で反映されます（編集不可）', f"有効期限: {LIVE_EXPIRES}"],
                    'broadcast_dark', live_mode=True) + 16
    y = summary_cards(sc, y, totals, chip_totals, rank_counts) + 16
    history_table(sc, y, rows, editable=False)
    save_guide(sc, sc.top + PAD - 10, path('guide_6_live_viewer.png'), 5)

    # 7. 過去のゲームと共有: 終了済みゲームの共有コード
    sc = Screen(config)
    rows, totals, chip_totals, rank_counts = build_records(3, 1)
    y = sc.top + PAD
    y = back_header(sc, y, GAME_DATE, ('共有', C_BLUE_BOTTOM, WHITE)) + 16
    y = live_banner(sc, y, f"共有中  コード: {SHARE_CODE}", [f"有効期限: {SHARE_EXPIRES}", 'タップでコードを表示'],
                    'send') + 16
    y = summary_cards(sc, y, totals, chip_totals, rank_counts) + 16
    history_table(sc, y, rows, editable=False)
    code_modal(sc, 'ゲームを共有', '「ゲームを取り込む」にこのコードを入力すると閲覧・保存できます',
               SHARE_CODE, SHARE_EXPIRES,
               [('送信する', C_BLUE_BOTTOM, WHITE), ('コードをコピー', GREEN, WHITE),
                ('閉じる', (240, 240, 240), LIGHT_TEXT)])
    save_guide(sc, sc.anchors['modal_top'] - 10, path('guide_7_share.png'), 6)


# ══════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════

def generate_all_promos(output_dir, config):
    """Generate all 8 promotional screenshots for a given device config."""
    os.makedirs(output_dir, exist_ok=True)
    generate_promo_setup(os.path.join(output_dir, 'promo_1_setup.png'), config)
    generate_promo_score(os.path.join(output_dir, 'promo_2_score.png'), config)
    generate_promo_chip(os.path.join(output_dir, 'promo_3_chip.png'), config)
    generate_promo_summary(os.path.join(output_dir, 'promo_4_summary.png'), config)
    generate_promo_past_games(os.path.join(output_dir, 'promo_5_past_games.png'), config)
    generate_promo_share(os.path.join(output_dir, 'promo_6_share.png'), config)
    generate_promo_live_host(os.path.join(output_dir, 'promo_7_live_share.png'), config)
    generate_promo_live_viewer(os.path.join(output_dir, 'promo_8_live_viewer.png'), config)


def prepare_promo_resources():
    PROMO_FONTS.update(ensure_promo_fonts())
    render_app_icons()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--promos-only', action='store_true',
                        help='App Store 掲載画像（assets/iphone, assets/ipad）と使い方ガイドの画像だけを生成する')
    parser.add_argument('--guide-only', action='store_true',
                        help='使い方ガイドの画像（assets/guide）だけを生成する')
    parser.add_argument('--icons-only', action='store_true',
                        help='アプリのアイコン（icon / adaptive-icon / splash / favicon）だけを生成する')
    args = parser.parse_args()

    assets_dir = os.path.join(ROOT_DIR, 'assets')

    if args.guide_only:
        prepare_promo_resources()
        generate_guide_images(os.path.join(assets_dir, 'guide'), IPHONE)
        raise SystemExit(0)

    prepare_promo_resources()

    if args.icons_only or not args.promos_only:
        # App assets（手書き風の絵柄を使うため、アイコンの書き出し後に生成する。Issue #74）
        generate_icon(os.path.join(assets_dir, 'icon.png'))
        generate_adaptive_icon(os.path.join(assets_dir, 'adaptive-icon.png'))
        generate_splash(os.path.join(assets_dir, 'splash.png'))
        generate_favicon(os.path.join(assets_dir, 'favicon.png'))
        if args.icons_only:
            raise SystemExit(0)

    # iPhone promotional screenshots (1242x2688)
    generate_all_promos(os.path.join(assets_dir, 'iphone'), IPHONE)

    # iPad promotional screenshots (2048x2732)
    generate_all_promos(os.path.join(assets_dir, 'ipad'), IPAD)

    # 使い方ガイドの画像（4:3）
    generate_guide_images(os.path.join(assets_dir, 'guide'), IPHONE)

    print("\nAll assets generated successfully!")
