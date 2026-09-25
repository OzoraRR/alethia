#!/usr/bin/env python3
"""Isometric floating-island renderer (reconstructed from shipped SVGs).

Cube geometry: top center = (160+(gx-gy)*16, 150+(gx+gy+1)*8 + 30*level)
Palette = (left, right, top). Painter sort: (gx+gy, -level, gx).
"""
import random

P_TERRAIN = ("#101C2C", "#16283D", "#22384F")   # top surface rock
P_DEEP    = ("#171F2B", "#232E40", "#3A4A5C")   # layer 1
P_DEEPER  = ("#0A1018", "#111A26", "#1E2A40")   # layer 2 / tip
P_GRASS   = ("#1E7A4C", "#2FA368", "#5BD68A")   # grass tiles


def island_base(seed=1):
    """Return [(gx, gy, level, palette)] for a seeded floating island."""
    rng = random.Random(seed)
    cells = []
    for gx in range(-4, 5):
        for gy in range(-4, 5):
            d = ((gx + 0.5) ** 2 + (gy + 0.5) ** 2) ** 0.5
            if d <= 3.4 or (d <= 4.8 and rng.random() < 0.45):
                cells.append((gx, gy, d))
    grass = set(rng.sample(range(len(cells)), min(4, len(cells))))
    out = []
    for i, (gx, gy, d) in enumerate(cells):
        out.append((gx, gy, 0, P_GRASS if i in grass else P_TERRAIN))
        if d <= 2.6 and rng.random() < 0.6:
            out.append((gx, gy, 1, P_DEEP))
            if d <= 1.8 and rng.random() < 0.7:
                out.append((gx, gy, 2, P_DEEPER))
    out.append((0, 0, 3, P_DEEPER))               # bottom rock tip
    return out


def render(cubes, out):
    for gx, gy, lvl, pal in sorted(cubes, key=lambda c: (c[0] + c[1], -c[2], c[0])):
        xc = 160 + (gx - gy) * 16
        yc = 150 + (gx + gy + 1) * 8 + 30 * lvl
        xs0, xs1 = xc - 16, xc + 16
        y0, y1, y2, y3 = yc - 8, yc + 8, yc + 30, yc + 38
        p = lambda v: f"{v:.1f}"
        out.append(f'<polygon points="{p(xs0)},{p(yc)} {p(xc)},{p(y1)} {p(xc)},{p(y3)} {p(xs0)},{p(y2)}" fill="{pal[0]}"/>')
        out.append(f'<polygon points="{p(xs1)},{p(yc)} {p(xc)},{p(y1)} {p(xc)},{p(y3)} {p(xs1)},{p(y2)}" fill="{pal[1]}"/>')
        out.append(f'<polygon points="{p(xc)},{p(y0)} {p(xs1)},{p(yc)} {p(xc)},{p(y1)} {p(xs0)},{p(yc)}" fill="{pal[2]}"/>')


def svg(body):
    return (
        '<svg width="320" height="260" viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg">\n'
        '<defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%">'
        '<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/>'
        '<feMergeNode in="SourceGraphic"/></feMerge></filter></defs>\n'
        '<style>.blk{animation:blk 1.8s steps(1) infinite}'
        '@keyframes blk{0%,55%{opacity:1}56%,100%{opacity:.25}}'
        '.rain{animation:rain 2.4s linear infinite}'
        '.rain2{animation:rain 2.4s linear infinite -0.8s}'
        '.rain3{animation:rain 2.4s linear infinite -1.6s}'
        '@keyframes rain{0%{transform:translateY(-14px);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateY(14px);opacity:0}}'
        '.rainbg{animation:rainbg 3.2s linear infinite}'
        '.rainbg2{animation:rainbg 3.2s linear infinite -1.1s}'
        '.rainbg3{animation:rainbg 3.2s linear infinite -2.2s}'
        '@keyframes rainbg{0%{transform:translateY(-24px);opacity:0}12%{opacity:.9}88%{opacity:.9}100%{transform:translateY(64px);opacity:0}}'
        '</style>\n'
        + body + '\n</svg>\n'
    )
