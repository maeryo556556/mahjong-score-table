#!/usr/bin/env python3
"""Generate app assets for Mahjong Score Table app.

Generates:
  - icon.png, adaptive-icon.png, splash.png, favicon.png (app assets)
  - iphone/promo_1_setup.png ... promo_5_share.png (5 iPhone promotional screenshots)
  - ipad/promo_1_setup.png ... promo_5_share.png (5 iPad promotional screenshots)
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


def generate_icon(output_path, size=1024):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_gradient_bg(bg, BG_DARK, BG_MED)
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.18), fill=255)
    img.paste(bg, (0, 0), mask)
    margin = int(size * 0.10)
    sheet_x = margin
    sheet_y = int(size * 0.17)
    sheet_w = int(size * 0.80)
    sheet_h = int(size * 0.72)
    img = draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h, score_font_size=int(sheet_h * 0.11))
    tile_w = int(size * 0.35)
    tile_h = int(size * 0.43)
    img = draw_mahjong_tile(img, sheet_x + sheet_w - int(size * 0.06),
                            sheet_y + sheet_h - int(size * 0.06), tile_w, tile_h, rotation=15)
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


def generate_adaptive_icon(output_path, size=1024):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sheet_w = int(size * 0.56)
    sheet_h = int(size * 0.52)
    sheet_x = (size - sheet_w) // 2 - int(size * 0.02)
    sheet_y = (size - sheet_h) // 2 + int(size * 0.04)
    img = draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h,
                           num_rows=6, num_cols=6, score_font_size=int(sheet_h * 0.11))
    tile_w = int(size * 0.27)
    tile_h = int(size * 0.33)
    img = draw_mahjong_tile(img, sheet_x + sheet_w - int(size * 0.04),
                            sheet_y + sheet_h - int(size * 0.04), tile_w, tile_h, rotation=15)
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


def generate_splash(output_path, width=1284, height=2778):
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw_gradient_bg(img, BG_DARK, (35, 70, 130))
    draw = ImageDraw.Draw(img)
    sheet_w = int(width * 0.55)
    sheet_h = int(sheet_w * 0.9)
    sheet_x = (width - sheet_w) // 2
    sheet_y = int(height * 0.25)
    img = draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h,
                           num_rows=6, num_cols=6, score_font_size=int(sheet_h * 0.11))
    draw = ImageDraw.Draw(img)
    tile_w = int(width * 0.22)
    tile_h = int(tile_w * 1.23)
    img = draw_mahjong_tile(img, sheet_x + sheet_w - int(width * 0.04),
                            sheet_y + sheet_h - int(width * 0.04), tile_w, tile_h, rotation=15)
    text_y = sheet_y + sheet_h + int(height * 0.04)
    jp_large = font(int(width * 0.09), jp=True)
    draw = ImageDraw.Draw(img)
    draw_centered_text(draw, "麻雀", width // 2, text_y, jp_large, WHITE)
    text_y2 = text_y + int(width * 0.12)
    jp_small = font(int(width * 0.055), jp=True)
    draw_centered_text(draw, "スコアシートモバイル", width // 2, text_y2, jp_small, (200, 210, 230))
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({width}x{height})")


def generate_favicon(output_path, size=48):
    render_size = size * 8
    img = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    bg = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    draw_gradient_bg(bg, BG_DARK, BG_MED)
    mask = Image.new('L', (render_size, render_size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, render_size - 1, render_size - 1), radius=int(render_size * 0.18), fill=255)
    img.paste(bg, (0, 0), mask)
    margin = int(render_size * 0.10)
    sheet_x = margin
    sheet_y = int(render_size * 0.17)
    sheet_w = int(render_size * 0.80)
    sheet_h = int(render_size * 0.72)
    img = draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h,
                           num_rows=5, num_cols=5, score_font_size=int(sheet_h * 0.13))
    tile_w = int(render_size * 0.35)
    tile_h = int(render_size * 0.43)
    img = draw_mahjong_tile(img, sheet_x + sheet_w - int(render_size * 0.06),
                            sheet_y + sheet_h - int(render_size * 0.06), tile_w, tile_h, rotation=15)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


# ══════════════════════════════════════════════
# Promotional Screenshots – accurate app mockups
# ══════════════════════════════════════════════

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


IPHONE = DeviceConfig(1080, 2340, 1242, 2688, 375, False)
IPAD = DeviceConfig(1536, 2048, 2048, 2732, 590, True)


class PhoneScreen:
    """Helper to draw pixel-accurate app screen mockups."""

    def __init__(self, config=IPHONE):
        self.w = config.screen_w
        self.h = config.screen_h
        self.base_dp = config.base_dp
        self.img = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        draw_gradient_bg(self.img, BG_DARK, BG_MED)
        self.draw = ImageDraw.Draw(self.img)
        self.pad = int(self.w * 0.042)  # ~16px at 375dp
        self.y = int(self.h * 0.02)     # start below status area

    def _s(self, dp):
        """Scale dp to pixels."""
        return int(dp * self.w / self.base_dp)

    def draw_status_bar(self):
        """Draw iOS-style status bar."""
        d = self.draw
        sf = font(self._s(12), bold=True)
        d.text((self._s(20), self._s(6)), "9:41", fill=WHITE, font=sf)
        # battery
        bx = self.w - self._s(35)
        by = self._s(8)
        bw, bh = self._s(22), self._s(10)
        d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=2, fill=WHITE)
        d.rectangle((bx + bw, by + bh // 4, bx + bw + 2, by + bh * 3 // 4), fill=WHITE)
        self.y = self._s(28)

    def draw_card_shadow(self, x, y, w, h, radius=None):
        """Draw a card shadow under a card region."""
        if radius is None:
            radius = self._s(12)
        shadow = Image.new('RGBA', self.img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle(
            (x + 2, y + 4, x + w + 2, y + h + 4),
            radius=radius, fill=(0, 0, 0, 40)
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(8))
        self.img = Image.alpha_composite(self.img, shadow)
        self.draw = ImageDraw.Draw(self.img)

    def draw_card(self, x, y, w, h, radius=None):
        """Draw a white card with shadow."""
        if radius is None:
            radius = self._s(12)
        self.draw_card_shadow(x, y, w, h, radius)
        rrect(self.draw, (x, y, x + w, y + h), radius, fill=CARD_BG)

    def draw_section_title(self, x, y, w, text, has_right=None):
        """Draw section title with blue underline, matching the app."""
        d = self.draw
        f_title = font(self._s(16), jp=True)
        d.text((x, y), text, fill=SECTION_TITLE_COLOR, font=f_title)
        line_y = y + self._s(24)
        d.line([(x, line_y), (x + w, line_y)], fill=SECTION_BORDER, width=max(2, self._s(2)))
        if has_right:
            f_right = font(self._s(12), jp=True)
            tw, _ = text_size(d, has_right, f_right)
            d.text((x + w - tw, y + self._s(4)), has_right, fill=GREEN, font=f_right)
        return line_y + self._s(8)

    def draw_drumroll_input(self, x, y, label, value, box_w=None):
        """Draw a DrumRollInput component matching DrumRollInput.tsx exactly."""
        d = self.draw
        if box_w is None:
            box_w = self._s(155)
        # Label
        lf = font(self._s(12), jp=True)
        d.text((x, y), label, fill=DARK_TEXT, font=lf)
        y += self._s(18)

        btn_h = self._s(26)
        btn_gap = self._s(4)
        bf = font(self._s(11), bold=True)

        # Top row: [+10] [+1]
        top_btns = ["+10", "+1"]
        for i, bl in enumerate(top_btns):
            bx = x + i * (box_w // 2 + btn_gap // 2)
            bw = box_w // 2 - btn_gap // 2
            rrect(d, (bx, y, bx + bw, y + btn_h), self._s(4),
                   fill=DRUMROLL_BTN_BG, outline=DRUMROLL_BTN_BORDER, width=1)
            tw, _ = text_size(d, bl, bf)
            d.text((bx + (bw - tw) // 2, y + (btn_h - self._s(12)) // 2), bl,
                   fill=DRUMROLL_BTN_TEXT, font=bf)
        y += btn_h + btn_gap

        # Display
        disp_h = self._s(40)
        rrect(d, (x, y, x + box_w, y + disp_h), self._s(6),
               fill=WHITE, outline=DRUMROLL_DISPLAY_BORDER, width=2)
        vf = font(self._s(18), bold=True)
        val_str = f"+{value}" if value > 0 else str(value)
        val_color = GREEN if value > 0 else RED if value < 0 else SECTION_TITLE_COLOR
        tw, _ = text_size(d, val_str, vf)
        d.text((x + (box_w - tw) // 2, y + (disp_h - self._s(18)) // 2), val_str,
               fill=val_color, font=vf)
        y += disp_h + btn_gap

        # Bottom row: [-1] [-10]
        bot_btns = ["-1", "-10"]
        for i, bl in enumerate(bot_btns):
            bx = x + i * (box_w // 2 + btn_gap // 2)
            bw = box_w // 2 - btn_gap // 2
            rrect(d, (bx, y, bx + bw, y + btn_h), self._s(4),
                   fill=DRUMROLL_BTN_BG, outline=DRUMROLL_BTN_BORDER, width=1)
            tw2, _ = text_size(d, bl, bf)
            d.text((bx + (bw - tw2) // 2, y + (btn_h - self._s(12)) // 2), bl,
                   fill=DRUMROLL_BTN_TEXT, font=bf)
        return y + btn_h

    def draw_button(self, x, y, w, h, text, bg_color, text_color=WHITE):
        """Draw a rounded button."""
        d = self.draw
        rrect(d, (x, y, x + w, y + h), self._s(6), fill=bg_color)
        bf = font(self._s(14), jp=True)
        tw, _ = text_size(d, text, bf)
        d.text((x + (w - tw) // 2, y + (h - self._s(14)) // 2), text,
               fill=text_color, font=bf)

    def get_image(self):
        return self.img


def create_promo_frame(phone_img, title_text=None, subtitle_text=None, config=IPHONE):
    """Wrap a phone/tablet screen image in a promo frame with title."""
    promo_w, promo_h = config.promo_w, config.promo_h
    screen_w, screen_h = config.screen_w, config.screen_h

    img = Image.new('RGBA', (promo_w, promo_h), (0, 0, 0, 0))
    draw_gradient_bg(img, (15, 30, 80), (25, 55, 120))
    draw = ImageDraw.Draw(img)

    top_y = int(promo_h * 0.02)

    # Title text
    if title_text:
        title_font_size = int(promo_w * 0.058)
        tf = font(title_font_size, jp=True)
        draw_centered_text(draw, title_text, promo_w // 2, top_y, tf, WHITE)
        top_y += int(title_font_size * 1.4)

    if subtitle_text:
        sub_font_size = int(promo_w * 0.032)
        sf = font(sub_font_size, jp=True)
        draw_centered_text(draw, subtitle_text, promo_w // 2, top_y, sf, (160, 200, 255))
        top_y += int(sub_font_size * 1.4)

    # Device frame
    phone_w = int(promo_w * 0.82)
    phone_h = int(phone_w * screen_h / screen_w)
    phone_scaled = phone_img.resize((phone_w, phone_h), Image.LANCZOS)

    # Bezel dimensions (iPad has slightly thicker bezels, less rounded corners)
    if config.is_tablet:
        bezel = int(phone_w * 0.012)
        corner_r = int(phone_w * 0.03)
    else:
        bezel = int(phone_w * 0.015)
        corner_r = int(phone_w * 0.055)

    px = (promo_w - phone_w) // 2 - bezel
    py = top_y + int(promo_h * 0.01)

    # Shadow
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (px + 12, py + 12, px + phone_w + bezel * 2 + 12, py + phone_h + bezel * 2 + 12),
        radius=corner_r + bezel, fill=(0, 0, 0, 80)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    # Device body
    draw.rounded_rectangle(
        (px, py, px + phone_w + bezel * 2, py + phone_h + bezel * 2),
        radius=corner_r + bezel, fill=(20, 20, 25), outline=(60, 60, 65), width=2
    )

    # Screen mask
    screen_mask = Image.new('L', (phone_w, phone_h), 0)
    sm = ImageDraw.Draw(screen_mask)
    sm.rounded_rectangle((0, 0, phone_w - 1, phone_h - 1), radius=corner_r, fill=255)

    # Composite screen
    screen_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    screen_layer.paste(phone_scaled, (px + bezel, py + bezel), screen_mask)
    img = Image.alpha_composite(img, screen_layer)

    return img


# ── Promo 1: Setup Screen ──

def generate_promo_setup(output_path, config=IPHONE):
    """Setup screen with type selection and player inputs."""
    ps = PhoneScreen(config)
    d = ps.draw
    s = ps._s
    pad = ps.pad

    ps.draw_status_bar()

    # Header
    header_y = ps.y + s(8)
    title_f = font(s(36), jp=True)
    draw_centered_text(d, "麻雀", ps.w // 2, header_y, title_f, WHITE)
    # Actually the title in SetupScreen is "🀄 麻雀" but emoji won't render in PIL
    # So use text only
    sub_f = font(s(16), jp=True)
    draw_centered_text(d, "スコアシートモバイル", ps.w // 2, header_y + s(44), sub_f, WHITE)

    # Help button (top right)
    hx = ps.w - pad - s(40)
    hy = header_y
    rrect(d, (hx, hy, hx + s(40), hy + s(36)), s(8), fill=(255, 255, 255, 64))
    hf = font(s(18), bold=True)
    draw_centered_text(d, "?", hx + s(20), hy + s(2), hf, WHITE)
    hlf = font(s(9), jp=True)
    draw_centered_text(d, "使い方", hx + s(20), hy + s(22), hlf, WHITE)

    card_y = header_y + s(76)
    card_x = pad
    card_w = ps.w - 2 * pad

    # ── Main Card: ゲーム設定 ──
    card_h = s(380)
    ps.draw_card(card_x, card_y, card_w, card_h)
    d = ps.draw  # refresh after card shadow composite
    inner_pad = s(20)
    cx = card_x + inner_pad
    cw = card_w - 2 * inner_pad

    # Section title
    cy = card_y + inner_pad
    next_y = ps.draw_section_title(cx, cy, cw, "ゲーム設定")
    d = ps.draw

    # 麻雀タイプ label
    lf = font(s(14), jp=True)
    d.text((cx, next_y), "麻雀タイプ", fill=SECTION_TITLE_COLOR, font=lf)
    next_y += s(24)

    # Type buttons (two side by side)
    btn_w = (cw - s(12)) // 2
    btn_h = s(56)

    # 4人麻雀 (active)
    rrect(d, (cx, next_y, cx + btn_w, next_y + btn_h), s(8),
           fill=BG_MED, outline=BG_MED, width=2)
    icon_f = font(s(20), jp=True)
    draw_centered_text(d, "4人麻雀", cx + btn_w // 2, next_y + s(20), font(s(14), jp=True), WHITE)

    # 3人麻雀 (inactive)
    bx2 = cx + btn_w + s(12)
    rrect(d, (bx2, next_y, bx2 + btn_w, next_y + btn_h), s(8),
           fill=WHITE, outline=CARD_BORDER, width=2)
    draw_centered_text(d, "3人麻雀", bx2 + btn_w // 2, next_y + s(20), font(s(14), jp=True), GRAY_TEXT)

    next_y += btn_h + s(16)

    # プレイヤー設定
    d.text((cx, next_y), "プレイヤー設定", fill=SECTION_TITLE_COLOR, font=lf)
    next_y += s(22)
    hint_f = font(s(11), jp=True)
    d.text((cx, next_y), "※ 4文字以内で入力してください", fill=HINT_TEXT, font=hint_f)
    next_y += s(18)

    # Player input fields (2x2 grid)
    inp_w = (cw - s(12)) // 2
    inp_h = s(44)
    inp_label_f = font(s(12), jp=True)
    inp_text_f = font(s(16), jp=True)
    player_names = ["太郎", "花子", "次郎", "美咲"]

    for i, name in enumerate(player_names):
        col = i % 2
        row = i // 2
        ix = cx + col * (inp_w + s(12))
        iy = next_y + row * (inp_h + s(24))

        d.text((ix, iy), f"プレイヤー{i+1}", fill=MED_TEXT, font=inp_label_f)
        iy += s(18)
        rrect(d, (ix, iy, ix + inp_w, iy + inp_h), s(6),
               fill=WHITE, outline=INPUT_BORDER, width=2)
        d.text((ix + s(10), iy + s(10)), name, fill=DARK_TEXT, font=inp_text_f)

    next_y += 2 * (inp_h + s(24)) + s(4)

    # ゲーム開始 button
    btn_y = next_y
    ps.draw_button(cx, btn_y, cw, s(48), "ゲーム開始", BG_MED)

    # ── Second Card: 過去のゲーム履歴管理 ──
    card2_y = card_y + card_h + s(16)
    card2_h = s(170)
    ps.draw_card(card_x, card2_y, card_w, card2_h)
    d = ps.draw
    cy2 = card2_y + inner_pad
    ps.draw_section_title(cx, cy2, cw, "過去のゲーム履歴管理")
    by = cy2 + s(36)
    ps.draw_button(cx, by, cw, s(48), "過去のゲームを見る", GRAY_TEXT)
    by += s(56)
    ps.draw_button(cx, by, cw, s(48), "ゲームを取り込む", TEAL)

    phone_img = ps.get_image()
    promo = create_promo_frame(phone_img, "麻雀対戦スコア管理", "３麻４麻両対応！", config)
    promo.save(output_path, 'PNG')
    print(f"Generated: {output_path}")


# ── Promo 2: Score Input Screen ──

def generate_promo_score(output_path, config=IPHONE):
    """Game screen with score drum roll input."""
    ps = PhoneScreen(config)
    d = ps.draw
    s = ps._s
    pad = ps.pad

    ps.draw_status_bar()

    # Header: 第1半荘 | [中断] [ゲーム終了]
    hy = ps.y + s(4)
    hf = font(s(24), jp=True)
    d.text((pad, hy), "第1半荘", fill=WHITE, font=hf)

    # Suspend button
    bx = ps.w - pad - s(86) - s(8) - s(50)
    rrect(d, (bx, hy, bx + s(50), hy + s(32)), s(6),
           fill=(255, 255, 255, 50), outline=(255, 255, 255, 100), width=1)
    bf = font(s(13), jp=True)
    draw_centered_text(d, "中断", bx + s(25), hy + s(6), bf, WHITE)

    # Finish button
    fx = ps.w - pad - s(86)
    rrect(d, (fx, hy, fx + s(86), hy + s(32)), s(6), fill=RED)
    draw_centered_text(d, "ゲーム終了", fx + s(43), hy + s(6), bf, WHITE)

    card_y = hy + s(48)
    card_x = pad
    card_w = ps.w - 2 * pad
    inner_pad = s(16)
    cx = card_x + inner_pad
    cw = card_w - 2 * inner_pad

    # ── ポイント入力 Card ──
    card_h = s(390)
    ps.draw_card(card_x, card_y, card_w, card_h)
    d = ps.draw
    cy = card_y + inner_pad
    cy = ps.draw_section_title(cx, cy, cw, "ポイント入力", "合計: 0")
    d = ps.draw

    # DrumRoll inputs (2x2 grid)
    players_scores = [("太郎", 32), ("花子", -15), ("次郎", -8), ("美咲", -9)]
    dr_gap = s(8)
    dr_w = (cw - dr_gap) // 2
    dr_row_h = s(120)
    for i, (name, val) in enumerate(players_scores):
        col = i % 2
        row = i // 2
        dx = cx + col * (dr_w + dr_gap)
        dy = cy + row * dr_row_h
        ps.draw_drumroll_input(dx, dy, name, val, box_w=dr_w)

    # スコアを記録 button
    btn_y = cy + 2 * dr_row_h + s(8)
    ps.draw_button(cx, btn_y, cw, s(42), "スコアを記録", GREEN)

    # ── チップ移動 Card (2x2 grid, all 4 players) ──
    chip_y = card_y + card_h + s(16)
    chip_h = s(290)
    ps.draw_card(card_x, chip_y, card_w, chip_h)
    d = ps.draw
    cy2 = chip_y + inner_pad
    ps.draw_section_title(cx, cy2, cw, "チップ移動", "合計: 0")
    d = ps.draw
    cy2 += s(36)

    # Show all 4 chip drum roll inputs in 2x2 grid
    chip_scores = [("太郎", 3), ("花子", -1), ("次郎", 2), ("美咲", -4)]
    for i, (name, val) in enumerate(chip_scores):
        col = i % 2
        row = i // 2
        dx2 = cx + col * (dr_w + dr_gap)
        dy2 = cy2 + row * dr_row_h
        ps.draw_drumroll_input(dx2, dy2, name, val, box_w=dr_w)

    phone_img = ps.get_image()
    promo = create_promo_frame(phone_img, "スコアの記録", "直感的なUIでかんたん入力", config)
    promo.save(output_path, 'PNG')
    print(f"Generated: {output_path}")


# ── Promo 3: Summary + History Screen ──

def generate_promo_summary(output_path, config=IPHONE):
    """Summary cards and history table."""
    ps = PhoneScreen(config)
    d = ps.draw
    s = ps._s
    pad = ps.pad

    ps.draw_status_bar()

    # Header
    hy = ps.y + s(4)
    hf = font(s(24), jp=True)
    d.text((pad, hy), "第3半荘", fill=WHITE, font=hf)

    # Buttons
    bx = ps.w - pad - s(86) - s(8) - s(50)
    bf = font(s(13), jp=True)
    rrect(d, (bx, hy, bx + s(50), hy + s(32)), s(6),
           fill=(255, 255, 255, 50), outline=(255, 255, 255, 100), width=1)
    draw_centered_text(d, "中断", bx + s(25), hy + s(6), bf, WHITE)
    fx = ps.w - pad - s(86)
    rrect(d, (fx, hy, fx + s(86), hy + s(32)), s(6), fill=RED)
    draw_centered_text(d, "ゲーム終了", fx + s(43), hy + s(6), bf, WHITE)

    card_y = hy + s(48)
    card_x = pad
    card_w = ps.w - 2 * pad
    inner_pad = s(16)
    cx = card_x + inner_pad
    cw = card_w - 2 * inner_pad

    # ── 総合スコア Card ──
    card_h = s(240)
    ps.draw_card(card_x, card_y, card_w, card_h)
    d = ps.draw
    cy = card_y + inner_pad
    cy = ps.draw_section_title(cx, cy, cw, "総合スコア")
    d = ps.draw

    # Summary cards (2x2)
    summary = [
        ("太郎", "+87", 1, GOLD),
        ("花子", "+23", 2, SILVER),
        ("次郎", "-42", 3, BRONZE),
        ("美咲", "-68", 4, RANK_GRAY),
    ]
    sc_w = (cw - s(8)) // 2
    sc_h = s(80)
    for i, (name, score, rank, accent) in enumerate(summary):
        col = i % 2
        row = i // 2
        sx = cx + col * (sc_w + s(8))
        sy = cy + row * (sc_h + s(8))

        # Card bg
        rrect(d, (sx, sy, sx + sc_w, sy + sc_h), s(8),
               fill=(248, 249, 250), outline=CARD_BORDER, width=2)
        # Left accent
        d.rectangle((sx + 1, sy + s(6), sx + s(4), sy + sc_h - s(6)), fill=accent)

        # Player name
        nf = font(s(14), jp=True)
        d.text((sx + s(12), sy + s(6)), name, fill=DARK_TEXT, font=nf)

        # Score
        sf = font(s(20), bold=True)
        scolor = GREEN if score.startswith("+") else RED
        tw, _ = text_size(d, score, sf)
        d.text((sx + (sc_w - tw) // 2, sy + s(28)), score, fill=scolor, font=sf)

        # Rank badge
        rank_text = f"{rank}位"
        rf = font(s(10), jp=True)
        rtw, _ = text_size(d, rank_text, rf)
        rbx = sx + s(12)
        rby = sy + sc_h - s(22)
        rrect(d, (rbx, rby, rbx + rtw + s(10), rby + s(16)), s(8), fill=accent)
        d.text((rbx + s(5), rby + s(1)), rank_text, fill=WHITE, font=rf)

    # ── 記録履歴 Card ──
    hist_y = card_y + card_h + s(16)
    hist_h = s(280)
    ps.draw_card(card_x, hist_y, card_w, hist_h)
    d = ps.draw
    hy2 = hist_y + inner_pad
    hy2 = ps.draw_section_title(cx, hy2, cw, "記録履歴")
    d = ps.draw
    hint_f = font(s(11), jp=True)
    d.text((cx, hy2), "※ 長押しで記録を削除", fill=HINT_TEXT, font=hint_f)
    hy2 += s(18)

    # History rows
    hist_data = [
        ("第1半荘", [("太郎", "+12", 1), ("花子", "-8", 3), ("次郎", "+20", 1), ("美咲", "-24", 4)]),
        ("第2半荘", [("太郎", "+43", 1), ("花子", "-30", 4), ("次郎", "-20", 3), ("美咲", "+7", 2)]),
    ]
    row_h = s(80)
    name_f = font(s(11), jp=True)
    val_f = font(s(13), bold=True)
    label_f = font(s(13), jp=True)
    rank_f = font(s(10), jp=True)
    time_f = font(s(11), jp=True)

    rank_colors = {1: GOLD, 2: SILVER, 3: BRONZE, 4: RANK_GRAY}

    for ri, (label, scores) in enumerate(hist_data):
        ry = hy2 + ri * (row_h + s(8))
        # Row background
        rrect(d, (cx, ry, cx + cw, ry + row_h), s(8),
               fill=(248, 249, 250), outline=CARD_BORDER, width=1)

        # Label + time
        d.text((cx + s(8), ry + s(4)), label, fill=DARK_TEXT, font=label_f)
        d.text((cx + cw - s(60), ry + s(6)), "14:3" + str(ri), fill=GRAY_TEXT, font=time_f)

        # Score cells (4 columns, centered within each cell)
        cell_w = cw // 4
        for ci, (pname, pval, prank) in enumerate(scores):
            cell_cx = cx + ci * cell_w + cell_w // 2  # center of cell
            cell_y = ry + s(24)
            # Player name centered
            ntw, _ = text_size(d, pname, name_f)
            d.text((cell_cx - ntw // 2, cell_y), pname, fill=MED_TEXT, font=name_f)
            # Rank badge centered
            rc = rank_colors.get(prank, RANK_GRAY)
            rtext = f"{prank}位"
            rtw2, _ = text_size(d, rtext, rank_f)
            badge_w = rtw2 + s(8)
            rrect(d, (cell_cx - badge_w // 2, cell_y + s(16),
                       cell_cx + badge_w // 2, cell_y + s(30)), s(6), fill=rc)
            d.text((cell_cx - rtw2 // 2, cell_y + s(17)), rtext, fill=WHITE, font=rank_f)
            # Value centered
            vc = GREEN if pval.startswith("+") else RED
            vtw, _ = text_size(d, pval, val_f)
            d.text((cell_cx - vtw // 2, cell_y + s(34)), pval, fill=vc, font=val_f)

    phone_img = ps.get_image()
    promo = create_promo_frame(phone_img, "総合スコア & 履歴", "ランキングと全記録を一目で確認", config)
    promo.save(output_path, 'PNG')
    print(f"Generated: {output_path}")


# ── Promo 4: Past Games Screen ──

def generate_promo_past_games(output_path, config=IPHONE):
    """Past games list screen."""
    ps = PhoneScreen(config)
    d = ps.draw
    s = ps._s
    pad = ps.pad

    ps.draw_status_bar()

    # Header: ← 戻る | 過去のゲーム | (spacer)
    hy = ps.y + s(4)
    # Back button
    rrect(d, (pad, hy, pad + s(60), hy + s(32)), s(6), fill=(255, 255, 255, 50))
    bf = font(s(14), jp=True)
    draw_centered_text(d, "← 戻る", pad + s(30), hy + s(6), bf, WHITE)
    # Title
    tf = font(s(20), jp=True)
    draw_centered_text(d, "過去のゲーム", ps.w // 2, hy + s(2), tf, WHITE)

    card_x = pad
    card_w = ps.w - 2 * pad
    inner_pad = s(16)

    # Game cards
    games = [
        ("2026/02/25", "4人麻雀", "太郎 / 花子 / 次郎 / 美咲", "5半荘"),
        ("2026/02/20", "3人麻雀", "太郎 / 花子 / 次郎", "3半荘"),
        ("2026/02/15", "4人麻雀", "Aさん / Bさん / Cさん / Dさん", "4半荘"),
        ("2026/02/10", "4人麻雀", "太郎 / 花子 / 次郎 / 美咲", "6半荘"),
        ("2026/02/05", "3人麻雀", "太郎 / 花子 / 次郎", "2半荘"),
    ]

    card_h = s(88)
    gy = hy + s(48)

    for date, gtype, players, hanchan in games:
        ps.draw_card(card_x, gy, card_w, card_h)
        d = ps.draw
        cx = card_x + inner_pad
        cw = card_w - 2 * inner_pad

        # Header row: date + type
        df = font(s(16), jp=True)
        d.text((cx, gy + s(10)), date, fill=SECTION_TITLE_COLOR, font=df)
        gtf = font(s(13), jp=True)
        tw, _ = text_size(d, gtype, gtf)
        d.text((cx + cw - tw, gy + s(12)), gtype, fill=GRAY_TEXT, font=gtf)
        # Divider
        div_y = gy + s(38)
        d.line([(cx, div_y), (cx + cw, div_y)], fill=(238, 238, 238), width=1)

        # Body: players + hanchan
        pf = font(s(14), jp=True)
        d.text((cx, div_y + s(8)), players, fill=DARK_TEXT, font=pf)
        hf2 = font(s(13), jp=True)
        tw2, _ = text_size(d, hanchan, hf2)
        d.text((cx + cw - tw2, div_y + s(10)), hanchan, fill=GRAY_TEXT, font=hf2)

        gy += card_h + s(12)

    phone_img = ps.get_image()
    promo = create_promo_frame(phone_img, "過去のゲーム一覧", "いつでも振り返り・削除が可能", config)
    promo.save(output_path, 'PNG')
    print(f"Generated: {output_path}")


# ── Promo 5: Share / Read-Only Screen ──

def generate_promo_share(output_path, config=IPHONE):
    """Read-only game view with share modal."""
    ps = PhoneScreen(config)
    d = ps.draw
    s = ps._s
    pad = ps.pad

    ps.draw_status_bar()

    # Header: ← 戻る | 2026/02/25 | 共有
    hy = ps.y + s(4)
    rrect(d, (pad, hy, pad + s(60), hy + s(32)), s(6), fill=(255, 255, 255, 50))
    bf = font(s(14), jp=True)
    draw_centered_text(d, "← 戻る", pad + s(30), hy + s(6), bf, WHITE)

    tf = font(s(24), jp=True)
    draw_centered_text(d, "2026/02/25", ps.w // 2, hy + s(0), tf, WHITE)

    # Share button
    share_x = ps.w - pad - s(50)
    rrect(d, (share_x, hy, share_x + s(50), hy + s(32)), s(6), fill=BG_MED)
    draw_centered_text(d, "共有", share_x + s(25), hy + s(6), bf, WHITE)

    card_y = hy + s(48)
    card_x = pad
    card_w = ps.w - 2 * pad
    inner_pad = s(16)
    cx = card_x + inner_pad
    cw = card_w - 2 * inner_pad

    # ── Summary Card ──
    card_h = s(240)
    ps.draw_card(card_x, card_y, card_w, card_h)
    d = ps.draw
    cy = card_y + inner_pad
    cy = ps.draw_section_title(cx, cy, cw, "総合スコア")
    d = ps.draw

    summary = [
        ("太郎", "+87", 1, GOLD),
        ("花子", "+23", 2, SILVER),
        ("次郎", "-42", 3, BRONZE),
        ("美咲", "-68", 4, RANK_GRAY),
    ]
    sc_w = (cw - s(8)) // 2
    sc_h = s(80)
    for i, (name, score, rank, accent) in enumerate(summary):
        col = i % 2
        row = i // 2
        sx = cx + col * (sc_w + s(8))
        sy = cy + row * (sc_h + s(8))
        rrect(d, (sx, sy, sx + sc_w, sy + sc_h), s(8),
               fill=(248, 249, 250), outline=CARD_BORDER, width=2)
        d.rectangle((sx + 1, sy + s(6), sx + s(4), sy + sc_h - s(6)), fill=accent)
        nf = font(s(14), jp=True)
        d.text((sx + s(12), sy + s(6)), name, fill=DARK_TEXT, font=nf)
        sf = font(s(20), bold=True)
        scolor = GREEN if score.startswith("+") else RED
        tw, _ = text_size(d, score, sf)
        d.text((sx + (sc_w - tw) // 2, sy + s(28)), score, fill=scolor, font=sf)
        rank_text = f"{rank}位"
        rf = font(s(10), jp=True)
        rtw, _ = text_size(d, rank_text, rf)
        rbx = sx + s(12)
        rby = sy + sc_h - s(22)
        rrect(d, (rbx, rby, rbx + rtw + s(10), rby + s(16)), s(8), fill=accent)
        d.text((rbx + s(5), rby + s(1)), rank_text, fill=WHITE, font=rf)

    # ── Share Modal Overlay ──
    # Semi-transparent overlay
    overlay = Image.new('RGBA', ps.img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((0, 0, ps.w, ps.h), fill=(0, 0, 0, 128))
    ps.img = Image.alpha_composite(ps.img, overlay)
    d = ImageDraw.Draw(ps.img)
    ps.draw = d

    # Modal
    modal_w = ps.w - 2 * s(24)
    modal_h = s(360)
    mx = s(24)
    my = (ps.h - modal_h) // 2

    # Modal shadow
    mshadow = Image.new('RGBA', ps.img.size, (0, 0, 0, 0))
    msd = ImageDraw.Draw(mshadow)
    msd.rounded_rectangle((mx + 4, my + 4, mx + modal_w + 4, my + modal_h + 4),
                           radius=s(16), fill=(0, 0, 0, 60))
    mshadow = mshadow.filter(ImageFilter.GaussianBlur(12))
    ps.img = Image.alpha_composite(ps.img, mshadow)
    d = ImageDraw.Draw(ps.img)
    ps.draw = d

    rrect(d, (mx, my, mx + modal_w, my + modal_h), s(16), fill=WHITE)

    # Modal title
    mtf = font(s(20), jp=True)
    draw_centered_text(d, "ゲームを共有", ps.w // 2, my + s(20), mtf, SECTION_TITLE_COLOR)

    # Description
    mdf = font(s(13), jp=True)
    desc1 = "以下の共有コードを相手に送ってください。"
    desc2 = "相手はセットアップ画面の「ゲームを取り込む」"
    desc3 = "から入力できます。"
    draw_centered_text(d, desc1, ps.w // 2, my + s(52), mdf, LIGHT_TEXT)
    draw_centered_text(d, desc2, ps.w // 2, my + s(70), mdf, LIGHT_TEXT)
    draw_centered_text(d, desc3, ps.w // 2, my + s(88), mdf, LIGHT_TEXT)

    # Code box
    code_x = mx + s(20)
    code_y = my + s(110)
    code_w = modal_w - 2 * s(20)
    code_h = s(80)
    rrect(d, (code_x, code_y, code_x + code_w, code_y + code_h), s(8),
           fill=CODE_BG, outline=INPUT_BORDER, width=1)
    cf = font(s(11), mono=True)
    d.text((code_x + s(10), code_y + s(8)), "eyJ2IjoxLCJwYyI6NCwicG4iOl", fill=DARK_TEXT, font=cf)
    d.text((code_x + s(10), code_y + s(24)), "siWkRvbGxhciIsIuiKseiKsSIsIu", fill=DARK_TEXT, font=cf)
    d.text((code_x + s(10), code_y + s(40)), "asoYjmiiIsIue+Ogjk5Il0sInNo...", fill=DARK_TEXT, font=cf)

    # Buttons
    btn_y = code_y + code_h + s(16)
    btn_w = modal_w - 2 * s(20)
    btn_h = s(44)
    # 送信する
    rrect(d, (code_x, btn_y, code_x + btn_w, btn_y + btn_h), s(8), fill=BG_MED)
    bbf = font(s(16), jp=True)
    draw_centered_text(d, "送信する", code_x + btn_w // 2, btn_y + s(10), bbf, WHITE)
    btn_y += btn_h + s(8)
    # コピーする
    rrect(d, (code_x, btn_y, code_x + btn_w, btn_y + btn_h), s(8), fill=GREEN)
    draw_centered_text(d, "コピーする", code_x + btn_w // 2, btn_y + s(10), bbf, WHITE)
    btn_y += btn_h + s(8)
    # 閉じる
    rrect(d, (code_x, btn_y, code_x + btn_w, btn_y + btn_h), s(8), fill=(240, 240, 240))
    draw_centered_text(d, "閉じる", code_x + btn_w // 2, btn_y + s(10), bbf, LIGHT_TEXT)

    phone_img = ps.get_image()
    promo = create_promo_frame(phone_img, "ゲームの共有", "共有コードで友達にかんたん送信", config)
    promo.save(output_path, 'PNG')
    print(f"Generated: {output_path}")


# ══════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════

def generate_all_promos(output_dir, config):
    """Generate all 5 promotional screenshots for a given device config."""
    os.makedirs(output_dir, exist_ok=True)
    generate_promo_setup(os.path.join(output_dir, 'promo_1_setup.png'), config)
    generate_promo_score(os.path.join(output_dir, 'promo_2_score.png'), config)
    generate_promo_summary(os.path.join(output_dir, 'promo_3_summary.png'), config)
    generate_promo_past_games(os.path.join(output_dir, 'promo_4_past_games.png'), config)
    generate_promo_share(os.path.join(output_dir, 'promo_5_share.png'), config)


if __name__ == '__main__':
    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')

    # App assets
    generate_icon(os.path.join(assets_dir, 'icon.png'))
    generate_adaptive_icon(os.path.join(assets_dir, 'adaptive-icon.png'))
    generate_splash(os.path.join(assets_dir, 'splash.png'))
    generate_favicon(os.path.join(assets_dir, 'favicon.png'))

    # iPhone promotional screenshots (1242x2688)
    iphone_dir = os.path.join(assets_dir, 'iphone')
    generate_all_promos(iphone_dir, IPHONE)

    # iPad promotional screenshots (2048x2732)
    ipad_dir = os.path.join(assets_dir, 'ipad')
    generate_all_promos(ipad_dir, IPAD)

    print("\nAll assets generated successfully!")
