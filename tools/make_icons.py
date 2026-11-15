"""生成 PWA 图标（纯标准库，无需 Pillow）。

运行：python tools/make_icons.py
输出：icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, icon.svg
"""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")

INK = (47, 93, 80)        # #2F5D50
CREAM = (251, 247, 239)   # #FBF7EF
SAGE = (159, 191, 178)    # #9FBFB2
CLAY = (200, 115, 79)     # #C8734F


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def rounded_box_sdf(px, py, cx, cy, hw, hh, r):
    qx = abs(px - cx) - hw + r
    qy = abs(py - cy) - hh + r
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def paint(canvas, size, cx, cy, hw, hh, r, color):
    """以解析抗锯齿方式把一个圆角矩形混合到画布上（坐标均为 0..1 比例）。"""
    cxp, cyp = cx * size, cy * size
    hwp, hhp, rp = hw * size, hh * size, r * size
    x0 = max(0, int(cxp - hwp - 2))
    x1 = min(size, int(cxp + hwp + 3))
    y0 = max(0, int(cyp - hhp - 2))
    y1 = min(size, int(cyp + hhp + 3))
    cr, cg, cb = color[0] / 255.0, color[1] / 255.0, color[2] / 255.0
    for y in range(y0, y1):
        py = y + 0.5
        for x in range(x0, x1):
            px = x + 0.5
            d = rounded_box_sdf(px, py, cxp, cyp, hwp, hhp, rp)
            cov = clamp(0.5 - d)
            if cov <= 0:
                continue
            i = y * size + x
            dst = canvas[i]
            canvas[i] = (
                dst[0] + (cr - dst[0]) * cov,
                dst[1] + (cg - dst[1]) * cov,
                dst[2] + (cb - dst[2]) * cov,
                dst[3] + (1.0 - dst[3]) * cov,
            )


def render(size, rounded=True):
    canvas = [(0.0, 0.0, 0.0, 0.0)] * (size * size)

    # 背景
    paint(canvas, size, 0.5, 0.5, 0.5, 0.5, 0.22 if rounded else 0.0, INK)

    # 纸张
    paint(canvas, size, 0.5, 0.505, 0.155, 0.235, 0.028, CREAM)
    # 文字线
    for cy, hw in ((0.398, 0.085), (0.483, 0.085), (0.568, 0.085), (0.648, 0.042)):
        paint(canvas, size, 0.492 if hw < 0.06 else 0.5, cy, hw, 0.011, 0.011, SAGE)
    # 书签
    paint(canvas, size, 0.606, 0.305, 0.028, 0.085, 0.012, CLAY)

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r, g, b, a = canvas[y * size + x]
            row.extend((
                int(clamp(r) * 255 + 0.5),
                int(clamp(g) * 255 + 0.5),
                int(clamp(b) * 255 + 0.5),
                int(clamp(a) * 255 + 0.5),
            ))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#2F5D50"/>
  <rect x="177" y="138" width="159" height="241" rx="15" fill="#FBF7EF"/>
  <path d="M204 204h96M204 247h96M204 290h96M204 330h48"
        stroke="#9FBFB2" stroke-width="13" stroke-linecap="round"/>
  <rect x="296" y="112" width="29" height="88" rx="7" fill="#C8734F"/>
</svg>
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    write_png(os.path.join(OUT, "icon-192.png"), 192, render(192, True))
    write_png(os.path.join(OUT, "icon-512.png"), 512, render(512, True))
    write_png(os.path.join(OUT, "icon-maskable-512.png"), 512, render(512, False))
    write_png(os.path.join(OUT, "apple-touch-icon.png"), 180, render(180, False))
    with open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(SVG)
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
