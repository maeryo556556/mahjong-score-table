#!/usr/bin/env python3
"""Generate app assets for Mahjong Score Table app."""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

# Colors
BG_DARK = (30, 60, 114)       # #1e3c72
BG_MED = (42, 82, 152)        # #2a5298
WHITE = (255, 255, 255)
SHEET_WHITE = (255, 255, 255)
GRID_BLUE = (60, 90, 160)
GRID_LIGHT = (220, 230, 245)  # alternating row bg
TILE_BG = (250, 245, 235)
TILE_BORDER = (200, 200, 200)
TILE_SHADOW = (150, 150, 160, 80)
RED = (190, 30, 30)
SCORE_TEXT_COLOR = (25, 50, 110)

# Fonts
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_JP = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"


def rounded_rectangle(draw, xy, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_shadow(img, xy, radius, shadow_offset=6, shadow_blur=12):
    """Draw a drop shadow."""
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


def draw_gradient_bg(img, color1, color2):
    """Draw a radial-ish gradient background."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    for y in range(h):
        ratio = y / h
        r = int(color1[0] + (color2[0] - color1[0]) * ratio)
        g = int(color1[1] + (color2[1] - color1[1]) * ratio)
        b = int(color1[2] + (color2[2] - color1[2]) * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))


def draw_mahjong_tile(img, cx, cy, tile_w, tile_h, rotation=15):
    """Draw a mahjong tile with 中 character at specified center position."""
    # Create tile on a larger transparent canvas for rotation
    pad = int(max(tile_w, tile_h) * 0.8)
    tile_img = Image.new('RGBA', (tile_w + pad * 2, tile_h + pad * 2), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile_img)

    tx, ty = pad, pad

    # Shadow
    td.rounded_rectangle(
        (tx + 4, ty + 4, tx + tile_w + 4, ty + tile_h + 4),
        radius=int(tile_w * 0.1), fill=(100, 100, 110, 70)
    )

    # Tile outer border
    td.rounded_rectangle(
        (tx, ty, tx + tile_w, ty + tile_h),
        radius=int(tile_w * 0.1), fill=(230, 230, 230), outline=(180, 180, 185), width=3
    )

    # Tile inner face
    inner_margin = int(tile_w * 0.07)
    td.rounded_rectangle(
        (tx + inner_margin, ty + inner_margin, tx + tile_w - inner_margin, ty + tile_h - inner_margin),
        radius=int(tile_w * 0.07), fill=TILE_BG
    )

    # Draw 中 character
    chung_size = int(tile_h * 0.45)
    try:
        chung_font = ImageFont.truetype(FONT_JP, chung_size)
    except:
        chung_font = ImageFont.truetype(FONT_BOLD, chung_size)

    char = "中"
    bbox = td.textbbox((0, 0), char, font=chung_font)
    cw = bbox[2] - bbox[0]
    ch = bbox[3] - bbox[1]
    char_x = tx + (tile_w - cw) // 2
    char_y = ty + (tile_h - ch) // 2 - int(tile_h * 0.05)
    td.text((char_x, char_y), char, fill=RED, font=chung_font)

    # Rotate
    if rotation != 0:
        tile_img = tile_img.rotate(-rotation, resample=Image.BICUBIC, expand=False)

    # Paste onto main image
    paste_x = cx - tile_img.width // 2
    paste_y = cy - tile_img.height // 2
    img.paste(tile_img, (paste_x, paste_y), tile_img)

    return img


def draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h, num_rows=8, num_cols=8, score_font_size=None):
    """Draw the score sheet with grid and SCORE text."""
    draw = ImageDraw.Draw(img)

    # Sheet shadow
    shadow_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.rounded_rectangle(
        (sheet_x + 8, sheet_y + 8, sheet_x + sheet_w + 8, sheet_y + sheet_h + 8),
        radius=12, fill=(0, 0, 0, 50)
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(15))
    img = Image.alpha_composite(img, shadow_layer)
    draw = ImageDraw.Draw(img)

    # Sheet background
    draw.rounded_rectangle(
        (sheet_x, sheet_y, sheet_x + sheet_w, sheet_y + sheet_h),
        radius=10, fill=WHITE, outline=(180, 190, 210), width=2
    )

    # SCORE title
    if score_font_size is None:
        score_font_size = int(sheet_h * 0.085)
    score_font = ImageFont.truetype(FONT_BOLD, score_font_size)

    score_text = "SCORE"
    bbox = draw.textbbox((0, 0), score_text, font=score_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Title area - ensure enough space so SCORE doesn't overlap with grid
    title_h = int(sheet_h * 0.14)
    title_y = sheet_y + int((title_h - text_h) * 0.4)

    # Draw SCORE text centered
    text_x = sheet_x + (sheet_w - text_w) // 2
    draw.text((text_x, title_y), score_text, fill=SCORE_TEXT_COLOR, font=score_font)

    # Grid area - starts below title with clear gap
    grid_top = sheet_y + title_h + int(sheet_h * 0.01)
    grid_bottom = sheet_y + sheet_h - int(sheet_h * 0.02)
    grid_left = sheet_x + int(sheet_w * 0.02)
    grid_right = sheet_x + sheet_w - int(sheet_w * 0.02)

    grid_h = grid_bottom - grid_top
    grid_w = grid_right - grid_left

    # Number column width
    num_col_w = int(grid_w * 0.07)

    # Header row height
    header_h = int(grid_h * 0.06)

    # Data area
    data_left = grid_left + num_col_w
    data_top = grid_top + header_h
    data_w = grid_right - data_left
    data_h = grid_bottom - data_top

    col_w = data_w / num_cols
    row_h = data_h / num_rows

    # Draw alternating row backgrounds
    for i in range(num_rows):
        ry = data_top + i * row_h
        if i % 2 == 0:
            draw.rectangle(
                (grid_left, ry, grid_right, ry + row_h),
                fill=GRID_LIGHT
            )

    # Draw grid lines
    line_color = GRID_BLUE
    line_w = max(2, int(sheet_w * 0.003))

    # Outer border
    draw.rectangle(
        (grid_left, grid_top, grid_right, grid_bottom),
        outline=line_color, width=line_w + 1
    )

    # Header line
    draw.line(
        [(grid_left, data_top), (grid_right, data_top)],
        fill=line_color, width=line_w + 1
    )

    # Number column line
    draw.line(
        [(data_left, grid_top), (data_left, grid_bottom)],
        fill=line_color, width=line_w
    )

    # Horizontal lines
    for i in range(1, num_rows):
        y = data_top + i * row_h
        draw.line([(grid_left, y), (grid_right, y)], fill=line_color, width=line_w)

    # Vertical lines
    for i in range(1, num_cols):
        x = data_left + i * col_w
        draw.line([(x, grid_top), (x, grid_bottom)], fill=line_color, width=line_w)

    # Row numbers
    num_font_size = int(row_h * 0.45)
    num_font = ImageFont.truetype(FONT_REGULAR, num_font_size)
    for i in range(num_rows):
        num = str(i + 1)
        bbox = draw.textbbox((0, 0), num, font=num_font)
        nw = bbox[2] - bbox[0]
        nh = bbox[3] - bbox[1]
        nx = grid_left + (num_col_w - nw) // 2
        ny = data_top + i * row_h + (row_h - nh) // 2
        draw.text((nx, ny), num, fill=GRID_BLUE, font=num_font)

    return img


def generate_icon(output_path, size=1024):
    """Generate the main app icon."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    # Draw rounded square background with gradient
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_gradient_bg(bg, BG_DARK, BG_MED)

    # Create mask for rounded corners
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    corner_radius = int(size * 0.18)
    md.rounded_rectangle((0, 0, size - 1, size - 1), radius=corner_radius, fill=255)

    img.paste(bg, (0, 0), mask)

    # Draw score sheet
    margin = int(size * 0.10)
    sheet_x = margin
    sheet_y = int(size * 0.17)
    sheet_w = int(size * 0.80)
    sheet_h = int(size * 0.72)

    # Use large bold SCORE text
    score_font_size = int(sheet_h * 0.11)
    img = draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h, score_font_size=score_font_size)

    # Draw mahjong tile at bottom-right corner, large and overlapping score sheet
    tile_w = int(size * 0.35)
    tile_h = int(size * 0.43)
    tile_cx = sheet_x + sheet_w - int(size * 0.06)
    tile_cy = sheet_y + sheet_h - int(size * 0.06)
    img = draw_mahjong_tile(img, tile_cx, tile_cy, tile_w, tile_h, rotation=15)

    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


def generate_adaptive_icon(output_path, size=1024):
    """Generate Android adaptive icon foreground - matches icon.png design."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    # Adaptive icons have a safe zone (inner 66% of the canvas = 72px of 108dp)
    # We need to keep important content within the center ~66%
    safe_margin = int(size * 0.17)

    # Draw score sheet (smaller, centered in safe zone)
    sheet_w = int(size * 0.56)
    sheet_h = int(size * 0.52)
    sheet_x = (size - sheet_w) // 2 - int(size * 0.02)
    sheet_y = (size - sheet_h) // 2 + int(size * 0.04)

    score_font_size = int(sheet_h * 0.11)
    img = draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h,
                           num_rows=6, num_cols=6, score_font_size=score_font_size)

    # Draw mahjong tile at bottom-right corner, large and overlapping score sheet
    tile_w = int(size * 0.27)
    tile_h = int(size * 0.33)
    tile_cx = sheet_x + sheet_w - int(size * 0.04)
    tile_cy = sheet_y + sheet_h - int(size * 0.04)
    img = draw_mahjong_tile(img, tile_cx, tile_cy, tile_w, tile_h, rotation=15)

    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


def generate_splash(output_path, width=1284, height=2778):
    """Generate splash screen matching icon design."""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))

    # Gradient background
    draw_gradient_bg(img, BG_DARK, (35, 70, 130))

    draw = ImageDraw.Draw(img)

    # Draw score sheet centered in upper portion
    sheet_w = int(width * 0.55)
    sheet_h = int(sheet_w * 0.9)
    sheet_x = (width - sheet_w) // 2
    sheet_y = int(height * 0.25)

    score_font_size = int(sheet_h * 0.11)
    img = draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h,
                           num_rows=6, num_cols=6, score_font_size=score_font_size)
    draw = ImageDraw.Draw(img)

    # Draw mahjong tile at bottom-right corner, large and overlapping score sheet
    tile_w = int(width * 0.22)
    tile_h = int(tile_w * 1.23)
    tile_cx = sheet_x + sheet_w - int(width * 0.04)
    tile_cy = sheet_y + sheet_h - int(width * 0.04)
    img = draw_mahjong_tile(img, tile_cx, tile_cy, tile_w, tile_h, rotation=15)

    # App name text below the sheet
    text_y = sheet_y + sheet_h + int(height * 0.04)

    # 麻雀
    jp_font_large = ImageFont.truetype(FONT_JP, int(width * 0.09))
    text = "麻雀"
    bbox = draw.textbbox((0, 0), text, font=jp_font_large)
    tw = bbox[2] - bbox[0]
    draw.text(((width - tw) // 2, text_y), text, fill=WHITE, font=jp_font_large)

    # スコアシートモバイル
    text_y2 = text_y + int(width * 0.12)
    jp_font_small = ImageFont.truetype(FONT_JP, int(width * 0.055))
    text2 = "スコアシートモバイル"
    bbox2 = draw.textbbox((0, 0), text2, font=jp_font_small)
    tw2 = bbox2[2] - bbox2[0]
    draw.text(((width - tw2) // 2, text_y2), text2, fill=(200, 210, 230), font=jp_font_small)

    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({width}x{height})")


def generate_favicon(output_path, size=48):
    """Generate favicon - simplified version of icon."""
    # Render at higher resolution then downscale for quality
    render_size = size * 8
    img = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))

    # Background
    bg = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    draw_gradient_bg(bg, BG_DARK, BG_MED)

    mask = Image.new('L', (render_size, render_size), 0)
    md = ImageDraw.Draw(mask)
    corner_radius = int(render_size * 0.18)
    md.rounded_rectangle((0, 0, render_size - 1, render_size - 1), radius=corner_radius, fill=255)

    img.paste(bg, (0, 0), mask)

    # Simplified: small score sheet with SCORE + tile
    margin = int(render_size * 0.10)
    sheet_x = margin
    sheet_y = int(render_size * 0.17)
    sheet_w = int(render_size * 0.80)
    sheet_h = int(render_size * 0.72)

    score_font_size = int(sheet_h * 0.13)
    img = draw_score_sheet(img, sheet_x, sheet_y, sheet_w, sheet_h,
                           num_rows=5, num_cols=5, score_font_size=score_font_size)

    # Tile at bottom-right corner, large and overlapping score sheet
    tile_w = int(render_size * 0.35)
    tile_h = int(render_size * 0.43)
    tile_cx = sheet_x + sheet_w - int(render_size * 0.06)
    tile_cy = sheet_y + sheet_h - int(render_size * 0.06)
    img = draw_mahjong_tile(img, tile_cx, tile_cy, tile_w, tile_h, rotation=15)

    # Downscale with high quality
    img = img.resize((size, size), Image.LANCZOS)

    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")


def draw_phone_frame(img, x, y, pw, ph, corner_radius=40, bezel=6):
    """Draw a phone frame outline and return the screen area coordinates."""
    draw = ImageDraw.Draw(img)

    # Phone outer shadow
    shadow_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.rounded_rectangle(
        (x + 10, y + 10, x + pw + 10, y + ph + 10),
        radius=corner_radius, fill=(0, 0, 0, 70)
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(25))
    img = Image.alpha_composite(img, shadow_layer)
    draw = ImageDraw.Draw(img)

    # Phone body (dark frame)
    draw.rounded_rectangle(
        (x, y, x + pw, y + ph),
        radius=corner_radius, fill=(20, 20, 25), outline=(60, 60, 65), width=2
    )

    # Screen area inside bezel
    sx = x + bezel
    sy = y + bezel
    sw = pw - bezel * 2
    sh = ph - bezel * 2
    screen_radius = corner_radius - bezel

    return img, (sx, sy, sw, sh, screen_radius)


def draw_app_screen(img, sx, sy, sw, sh, screen_radius):
    """Draw a simulated app game screen inside the phone screen area."""
    draw = ImageDraw.Draw(img)

    # Screen background - app header gradient
    screen_img = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    draw_gradient_bg(screen_img, BG_DARK, BG_MED)

    # Create rounded mask for screen
    screen_mask = Image.new('L', (sw, sh), 0)
    sm = ImageDraw.Draw(screen_mask)
    sm.rounded_rectangle((0, 0, sw - 1, sh - 1), radius=screen_radius, fill=255)

    # Paste screen background
    img.paste(screen_img, (sx, sy), screen_mask)
    draw = ImageDraw.Draw(img)

    # --- Status bar ---
    status_h = int(sh * 0.028)
    status_y = sy + int(sh * 0.008)
    status_font = ImageFont.truetype(FONT_BOLD, int(status_h * 0.7))
    draw.text((sx + int(sw * 0.06), status_y), "9:41", fill=WHITE, font=status_font)

    # Battery icon area (right side)
    bat_y = status_y + int(status_h * 0.15)
    bat_w_px = int(sw * 0.06)
    bat_h_px = int(status_h * 0.55)
    bat_x = sx + sw - int(sw * 0.08)
    draw.rounded_rectangle(
        (bat_x, bat_y, bat_x + bat_w_px, bat_y + bat_h_px),
        radius=2, fill=WHITE
    )

    # --- App header ---
    header_top = sy + int(sh * 0.04)
    header_h = int(sh * 0.045)
    header_font_size = int(header_h * 0.65)
    header_font = ImageFont.truetype(FONT_JP, header_font_size)
    header_text = "第3半荘"
    bbox = draw.textbbox((0, 0), header_text, font=header_font)
    htw = bbox[2] - bbox[0]
    draw.text((sx + (sw - htw) // 2, header_top), header_text, fill=WHITE, font=header_font)

    # --- Content area ---
    content_top = header_top + header_h + int(sh * 0.01)
    content_left = sx + int(sw * 0.035)
    content_right = sx + sw - int(sw * 0.035)
    content_w = content_right - content_left

    # --- Section: ポイント入力 ---
    section_y = content_top
    section_font_size = int(sh * 0.019)
    section_font = ImageFont.truetype(FONT_JP, section_font_size)

    # Section title bar
    card_pad = int(sw * 0.03)
    card_h_title = int(sh * 0.032)
    draw.rounded_rectangle(
        (content_left, section_y, content_right, section_y + card_h_title),
        radius=8, fill=(255, 255, 255, 35)
    )
    # Use text markers instead of emoji (which may render as tofu)
    draw.text(
        (content_left + card_pad, section_y + int(card_h_title * 0.15)),
        "ポイント入力", fill=WHITE, font=section_font
    )

    # --- Player input cards (2x2 grid) ---
    card_gap = int(sw * 0.02)
    card_top = section_y + card_h_title + card_gap
    card_w = (content_w - card_gap) // 2
    card_h = int(sh * 0.095)

    players = [
        ("プレイヤー1", "+32"),
        ("プレイヤー2", "-15"),
        ("プレイヤー3", "+8"),
        ("プレイヤー4", "-25"),
    ]
    player_colors = [
        (40, 167, 69),    # green
        (220, 53, 69),    # red
        (40, 167, 69),    # green
        (220, 53, 69),    # red
    ]

    name_font = ImageFont.truetype(FONT_JP, int(sh * 0.016))
    score_input_font = ImageFont.truetype(FONT_BOLD, int(sh * 0.028))
    small_btn_font = ImageFont.truetype(FONT_BOLD, int(sh * 0.012))

    for i, (pname, pscore) in enumerate(players):
        col = i % 2
        row = i // 2
        cx = content_left + col * (card_w + card_gap)
        cy = card_top + row * (card_h + card_gap)

        # Card background
        draw.rounded_rectangle(
            (cx, cy, cx + card_w, cy + card_h),
            radius=10, fill=WHITE, outline=(220, 225, 235), width=2
        )

        # Player name
        draw.text(
            (cx + card_pad, cy + int(card_h * 0.06)),
            pname, fill=(80, 80, 80), font=name_font
        )

        # Score value centered
        bbox = draw.textbbox((0, 0), pscore, font=score_input_font)
        score_tw = bbox[2] - bbox[0]
        draw.text(
            (cx + (card_w - score_tw) // 2, cy + int(card_h * 0.32)),
            pscore, fill=player_colors[i], font=score_input_font
        )

        # +/- buttons row
        btn_y = cy + int(card_h * 0.73)
        btn_h = int(card_h * 0.18)
        btn_w_unit = int(card_w * 0.2)
        btn_labels = ["-10", "-1", "+1", "+10"]
        btn_colors = [(220, 53, 69), (220, 53, 69), (40, 167, 69), (40, 167, 69)]
        for j, (bl, bc) in enumerate(zip(btn_labels, btn_colors)):
            bx = cx + int(card_pad * 0.5) + j * (btn_w_unit + int(card_pad * 0.3))
            draw.rounded_rectangle(
                (bx, btn_y, bx + btn_w_unit, btn_y + btn_h),
                radius=4, fill=bc
            )
            bbox = draw.textbbox((0, 0), bl, font=small_btn_font)
            blw = bbox[2] - bbox[0]
            draw.text(
                (bx + (btn_w_unit - blw) // 2, btn_y + 1),
                bl, fill=WHITE, font=small_btn_font
            )

    # --- Total row ---
    total_y = card_top + 2 * (card_h + card_gap) + int(card_gap * 0.2)
    total_h = int(sh * 0.028)
    draw.rounded_rectangle(
        (content_left, total_y, content_right, total_y + total_h),
        radius=8, fill=WHITE, outline=(220, 225, 235), width=2
    )
    total_font = ImageFont.truetype(FONT_JP, int(sh * 0.015))
    draw.text(
        (content_left + card_pad, total_y + int(total_h * 0.15)),
        "合計:  ±0", fill=(40, 167, 69), font=total_font
    )

    # --- Record button ---
    btn_top = total_y + total_h + card_gap
    btn_h_rec = int(sh * 0.035)
    draw.rounded_rectangle(
        (content_left, btn_top, content_right, btn_top + btn_h_rec),
        radius=10, fill=(30, 60, 114)
    )
    rec_font = ImageFont.truetype(FONT_JP, int(sh * 0.017))
    rec_text = "スコアを記録"
    bbox = draw.textbbox((0, 0), rec_text, font=rec_font)
    rtw = bbox[2] - bbox[0]
    draw.text(
        (sx + (sw - rtw) // 2, btn_top + int(btn_h_rec * 0.2)),
        rec_text, fill=WHITE, font=rec_font
    )

    # --- Summary section ---
    summary_top = btn_top + btn_h_rec + card_gap * 2
    draw.rounded_rectangle(
        (content_left, summary_top, content_right, summary_top + card_h_title),
        radius=8, fill=(255, 255, 255, 35)
    )
    draw.text(
        (content_left + card_pad, summary_top + int(card_h_title * 0.15)),
        "総合スコア", fill=WHITE, font=section_font
    )

    # Summary cards (2x2)
    sum_top = summary_top + card_h_title + card_gap
    sum_card_h = int(sh * 0.07)
    summary_data = [
        ("プレイヤー1", "+87", "1位", (255, 215, 0)),
        ("プレイヤー2", "+23", "2位", (192, 192, 192)),
        ("プレイヤー3", "-42", "3位", (205, 127, 50)),
        ("プレイヤー4", "-68", "4位", (149, 165, 166)),
    ]

    sum_name_font = ImageFont.truetype(FONT_JP, int(sh * 0.014))
    sum_score_font = ImageFont.truetype(FONT_BOLD, int(sh * 0.022))
    rank_font = ImageFont.truetype(FONT_JP, int(sh * 0.013))

    for i, (sname, sscore, rank, accent) in enumerate(summary_data):
        col = i % 2
        row = i // 2
        cx = content_left + col * (card_w + card_gap)
        cy = sum_top + row * (sum_card_h + card_gap)

        # Card with left accent border
        draw.rounded_rectangle(
            (cx, cy, cx + card_w, cy + sum_card_h),
            radius=10, fill=WHITE, outline=(220, 225, 235), width=2
        )
        # Left accent bar
        draw.rounded_rectangle(
            (cx, cy + 4, cx + 5, cy + sum_card_h - 4),
            radius=2, fill=accent
        )

        # Rank + name
        draw.text(
            (cx + card_pad + 4, cy + int(sum_card_h * 0.08)),
            f"{rank} {sname}", fill=(80, 80, 80), font=sum_name_font
        )

        # Score
        scolor = (40, 167, 69) if sscore.startswith("+") else (220, 53, 69)
        bbox = draw.textbbox((0, 0), sscore, font=sum_score_font)
        stw = bbox[2] - bbox[0]
        draw.text(
            (cx + (card_w - stw) // 2, cy + int(sum_card_h * 0.45)),
            sscore, fill=scolor, font=sum_score_font
        )

    # --- History section ---
    hist_top = sum_top + 2 * (sum_card_h + card_gap) + card_gap
    draw.rounded_rectangle(
        (content_left, hist_top, content_right, hist_top + card_h_title),
        radius=8, fill=(255, 255, 255, 35)
    )
    draw.text(
        (content_left + card_pad, hist_top + int(card_h_title * 0.15)),
        "記録履歴", fill=WHITE, font=section_font
    )

    # History table
    table_top = hist_top + card_h_title + card_gap
    table_bottom = sy + sh - int(sh * 0.02)
    table_h = table_bottom - table_top

    # Table background
    draw.rounded_rectangle(
        (content_left, table_top, content_right, table_bottom),
        radius=10, fill=WHITE, outline=(220, 225, 235), width=2
    )

    # Table header
    th_h = int(table_h * 0.12)
    th_font = ImageFont.truetype(FONT_JP, int(sh * 0.012))
    draw.rectangle(
        (content_left + 1, table_top + 1, content_right - 1, table_top + th_h),
        fill=(235, 240, 250)
    )
    draw.line(
        [(content_left, table_top + th_h), (content_right, table_top + th_h)],
        fill=(200, 210, 225), width=1
    )

    # Column headers
    cols = ["", "P1", "P2", "P3", "P4"]
    col_w_unit = content_w // 5
    for j, col_name in enumerate(cols):
        cx_t = content_left + j * col_w_unit + col_w_unit // 2
        bbox = draw.textbbox((0, 0), col_name, font=th_font)
        cw = bbox[2] - bbox[0]
        draw.text((cx_t - cw // 2, table_top + int(th_h * 0.25)),
                   col_name, fill=(80, 100, 140), font=th_font)

    # Table rows
    hist_data = [
        ("第1半荘", ["+12", "-8", "+20", "-24"]),
        ("第2半荘", ["+43", "-30", "-20", "+7"]),
        ("第3半荘", ["+32", "-15", "+8", "-25"]),
    ]
    row_h_t = int((table_h - th_h) / max(len(hist_data), 1))
    row_font = ImageFont.truetype(FONT_JP, int(sh * 0.011))
    val_font = ImageFont.truetype(FONT_BOLD, int(sh * 0.013))

    for r, (label, vals) in enumerate(hist_data):
        ry = table_top + th_h + r * row_h_t

        # Alternating row bg
        if r % 2 == 0:
            draw.rectangle(
                (content_left + 1, ry, content_right - 1, ry + row_h_t),
                fill=(245, 248, 255)
            )

        # Row line
        if r > 0:
            draw.line(
                [(content_left + 4, ry), (content_right - 4, ry)],
                fill=(230, 235, 245), width=1
            )

        # Label
        bbox = draw.textbbox((0, 0), label, font=row_font)
        lw = bbox[2] - bbox[0]
        draw.text(
            (content_left + col_w_unit // 2 - lw // 2, ry + int(row_h_t * 0.3)),
            label, fill=(80, 100, 140), font=row_font
        )

        # Values
        for j, val in enumerate(vals):
            vcolor = (40, 167, 69) if val.startswith("+") else (220, 53, 69)
            bbox = draw.textbbox((0, 0), val, font=val_font)
            vw = bbox[2] - bbox[0]
            vx = content_left + (j + 1) * col_w_unit + col_w_unit // 2 - vw // 2
            draw.text((vx, ry + int(row_h_t * 0.25)), val, fill=vcolor, font=val_font)

    return img


def generate_promo(output_path, width=1242, height=2688):
    """Generate App Store promotional screenshot image."""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))

    # Background gradient (darker, richer)
    draw_gradient_bg(img, (15, 30, 80), (25, 55, 120))

    # Add subtle decorative elements - scattered translucent tiles in background
    for tx, ty, ts, tr in [(100, 200, 60, 25), (width - 180, 350, 50, -20),
                            (80, height - 500, 45, 30), (width - 150, height - 400, 55, -15),
                            (width // 2 - 300, 150, 40, 10), (width // 2 + 250, height - 350, 48, -25)]:
        deco = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        dd = ImageDraw.Draw(deco)
        dd.rounded_rectangle(
            (tx, ty, tx + ts, ty + int(ts * 1.25)),
            radius=6, fill=(255, 255, 255, 15)
        )
        if tr != 0:
            # Simple alpha composite (no rotation for perf)
            pass
        img = Image.alpha_composite(img, deco)

    draw = ImageDraw.Draw(img)

    # === TOP: App branding ===
    top_margin = int(height * 0.04)

    # App icon (small)
    icon_size = int(width * 0.13)
    icon_x = (width - icon_size) // 2
    icon_y = top_margin

    # Draw mini icon
    icon_img = Image.new('RGBA', (icon_size, icon_size), (0, 0, 0, 0))
    icon_bg = Image.new('RGBA', (icon_size, icon_size), (0, 0, 0, 0))
    draw_gradient_bg(icon_bg, BG_DARK, BG_MED)
    icon_mask = Image.new('L', (icon_size, icon_size), 0)
    imd = ImageDraw.Draw(icon_mask)
    imd.rounded_rectangle((0, 0, icon_size - 1, icon_size - 1), radius=int(icon_size * 0.22), fill=255)
    icon_img.paste(icon_bg, (0, 0), icon_mask)

    # Mini score sheet on icon
    m_margin = int(icon_size * 0.12)
    m_sw = int(icon_size * 0.76)
    m_sh = int(icon_size * 0.68)
    icon_img = draw_score_sheet(icon_img, m_margin, int(icon_size * 0.18), m_sw, m_sh,
                                 num_rows=4, num_cols=4,
                                 score_font_size=int(m_sh * 0.14))
    # Mini tile on icon
    mt_w = int(icon_size * 0.30)
    mt_h = int(icon_size * 0.37)
    icon_img = draw_mahjong_tile(icon_img,
                                  m_margin + m_sw - int(icon_size * 0.04),
                                  int(icon_size * 0.18) + m_sh - int(icon_size * 0.04),
                                  mt_w, mt_h, rotation=15)
    img.paste(icon_img, (icon_x, icon_y), icon_img)

    # App name
    app_name_y = icon_y + icon_size + int(height * 0.01)
    app_name_font = ImageFont.truetype(FONT_JP, int(width * 0.06))
    app_name = "麻雀スコアシート"
    bbox = draw.textbbox((0, 0), app_name, font=app_name_font)
    anw = bbox[2] - bbox[0]
    draw.text(((width - anw) // 2, app_name_y), app_name, fill=WHITE, font=app_name_font)

    # Subtitle
    app_sub_font = ImageFont.truetype(FONT_JP, int(width * 0.028))
    app_sub = "モバイル"
    bbox = draw.textbbox((0, 0), app_sub, font=app_sub_font)
    asw = bbox[2] - bbox[0]
    sub_y = app_name_y + int(width * 0.072)
    draw.text(((width - asw) // 2, sub_y), app_sub, fill=(180, 200, 230), font=app_sub_font)

    # === HEADLINE ===
    headline_y = sub_y + int(height * 0.025)
    headline_font = ImageFont.truetype(FONT_JP, int(width * 0.05))

    hl1 = "麻雀のスコア管理を"
    bbox = draw.textbbox((0, 0), hl1, font=headline_font)
    hl1w = bbox[2] - bbox[0]
    draw.text(((width - hl1w) // 2, headline_y), hl1, fill=WHITE, font=headline_font)

    hl2 = "もっとスマートに"
    bbox = draw.textbbox((0, 0), hl2, font=headline_font)
    hl2w = bbox[2] - bbox[0]
    hl2_y = headline_y + int(width * 0.065)
    draw.text(((width - hl2w) // 2, hl2_y), hl2, fill=(100, 200, 255), font=headline_font)

    # === PHONE MOCKUP ===
    phone_w = int(width * 0.72)
    phone_h = int(phone_w * 1.78)
    phone_x = (width - phone_w) // 2
    phone_y = hl2_y + int(height * 0.03)

    img, (scr_x, scr_y, scr_w, scr_h, scr_r) = draw_phone_frame(
        img, phone_x, phone_y, phone_w, phone_h,
        corner_radius=int(phone_w * 0.06), bezel=int(phone_w * 0.012)
    )

    # Draw simulated app screen
    img = draw_app_screen(img, scr_x, scr_y, scr_w, scr_h, scr_r)

    # Recreate draw object since phone_frame/app_screen may have replaced img
    draw = ImageDraw.Draw(img)

    # === BOTTOM: Feature highlights ===
    bottom_y = phone_y + phone_h + int(height * 0.018)
    feat_font = ImageFont.truetype(FONT_JP, int(width * 0.032))

    features = [
        ("3人・4人麻雀対応", (100, 200, 255)),
        ("チップ移動もかんたん記録", (130, 220, 180)),
        ("ゲーム共有・取り込み対応", (200, 180, 255)),
    ]

    for i, (feat, fcolor) in enumerate(features):
        fy = bottom_y + i * int(height * 0.028)
        bbox = draw.textbbox((0, 0), feat, font=feat_font)
        fw = bbox[2] - bbox[0]
        # Bullet dot
        dot_x = (width - fw) // 2 - int(width * 0.04)
        draw.ellipse(
            (dot_x, fy + int(width * 0.012), dot_x + int(width * 0.015), fy + int(width * 0.027)),
            fill=fcolor
        )
        draw.text(((width - fw) // 2, fy), feat, fill=WHITE, font=feat_font)

    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({width}x{height})")


if __name__ == '__main__':
    import os
    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')

    generate_icon(os.path.join(assets_dir, 'icon.png'))
    generate_adaptive_icon(os.path.join(assets_dir, 'adaptive-icon.png'))
    generate_splash(os.path.join(assets_dir, 'splash.png'))
    generate_favicon(os.path.join(assets_dir, 'favicon.png'))
    generate_promo(os.path.join(assets_dir, 'promo.png'))

    print("\nAll assets generated successfully!")
