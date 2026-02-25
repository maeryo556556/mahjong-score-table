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


if __name__ == '__main__':
    import os
    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')

    generate_icon(os.path.join(assets_dir, 'icon.png'))
    generate_adaptive_icon(os.path.join(assets_dir, 'adaptive-icon.png'))
    generate_splash(os.path.join(assets_dir, 'splash.png'))
    generate_favicon(os.path.join(assets_dir, 'favicon.png'))

    print("\nAll assets generated successfully!")
