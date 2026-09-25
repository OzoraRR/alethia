#!/usr/bin/env python3
"""Voxel magnifying glass over a terminal/payload report (right-facing iso).

- Lens is HORIZONTAL (ring parallel to the document, handle up-right) like the ref
- .sweep: lens glides slowly left<->right across the document
- .fl_*: colored lines flare when the lens passes over them (timing computed)
- .holo: triangle "!" warning badge pops in with glitch on top of the glass, vanishes

Run: python3 scripts/gen_voxel_lens.py [out.svg]
"""
import sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_islands import island_base, P_TERRAIN, svg

W = 2.0
OX, OY = 168.0, 122.0   # right-facing isometric (mirrored)
ISLAND_SEED = 21         # own random tiles (computer=2, server=13)

SWEEP_BASE = 160.0       # screen-x of lens center at rest
SWEEP_A = 40.0           # sweep amplitude in px
SWEEP_DUR = 9            # seconds, slow glide (shared by sweep + flares)

BOXES = [  # x0,x1,y0,y1,z0,z1, material
    (6, 34, 5, 27, 0, 1, "paper"),      # report sheet
]

MATS = {
    "paper":   ("#C9D4E4", "#E8EEF7", "#FFFFFF", ""),
    "steel":   ("#3E4E62", "#5B6E88", "#9FB0C6", ""),
    "glass":   ("#9FE4FF", "#BFEFFF", "#E6FAFF", ' fill-opacity="0.55"'),
    "dark":    ("#05080D", "#0A1018", "#16222F", ""),
    "white":   ("#C7D2E2", "#E4EAF4", "#FFFFFF", ' filter="url(#glow)"'),
    "cyan":    ("#0E7C90", "#35E0FF", "#7FEFFF", ' filter="url(#glow)"'),
    "lime":    ("#4E6B0A", "#B6D73C", "#D6EE7A", ' filter="url(#glow)"'),
    "green":   ("#14663C", "#3ECF80", "#86EFB8", ' filter="url(#glow)"'),
    "red":     ("#8F1F1A", "#FF6B6B", "#FF9A9A", ' filter="url(#glow)"'),
    "holofill": ("#B31414", "#E53A3A", "#FF6B6B", ' fill-opacity="0.45"'),
    "holored": ("#8F1F1A", "#FF5252", "#FF8A80", ' filter="url(#glow)"'),
}

V = {}
HANDLE = set()


def setv(x0, x1, y0, y1, z0, z1, m):
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            for z in range(z0, z1 + 1):
                V[(x, y, z)] = m


# ---- report top layer: terminal window with payload lines ----
setv(10, 25, 5, 5, 1, 1, "dark")                 # document title line (dark grey)
setv(10, 29, 8, 21, 1, 1, "dark")                # terminal panel
setv(10, 29, 8, 8, 1, 1, "red")                  # window title strip
setv(12, 20, 10, 10, 1, 1, "lime")               # yellow payload line
setv(12, 23, 13, 13, 1, 1, "green")              # green payload line
setv(12, 21, 16, 16, 1, 1, "lime")               # yellow payload line
setv(12, 16, 19, 19, 1, 1, "white")
V[(18, 19, 1)] = "lime"                          # blinking cursor
# chart blocks at sheet bottom
setv(12, 16, 24, 25, 1, 1, "cyan")
setv(18, 23, 24, 25, 1, 1, "lime")
setv(25, 28, 24, 25, 1, 1, "white")

# ---- horizontal magnifying glass (ring parallel to doc, hovering) ----
CX, CY = 20, 16
for x in range(8, 33):
    for y in range(4, 29):
        d = math.hypot(x + 0.5 - CX, y + 0.5 - CY)
        if 7.5 < d <= 10.5:
            for z in (4, 5, 6):
                V[(x, y, z)] = "steel"           # rim, 3 deep
        elif d <= 7.5:
            for z in (4, 5):
                V[(x, y, z)] = "glass"           # lens, 2 deep
# shine slash across the glass top
for x in range(8, 33):
    for y in range(4, 29):
        if 34 <= x + y <= 35 and math.hypot(x + 0.5 - CX, y + 0.5 - CY) <= 5.5:
            V[(x, y, 5)] = "white"
# handle extending up-right (screen) from the rim
for x in range(2, 11):
    for y in (15, 16):
        for z in (4, 5, 6):
            V[(x, y, z)] = "steel"
            HANDLE.add((x, y, z))

# ---- triangle warning badge floating above the glass ----
HTOP, HBOT, HW, HCX = 26, 16, 7, 20
tri_edge = set()
for z in range(HBOT, HTOP + 1):
    t = (HTOP - z) / (HTOP - HBOT)          # 0 apex -> 1 base
    half = HW * t
    xl, xr = int(round(HCX - half)), int(round(HCX + half))
    if z == HTOP:
        tri_edge.add((HCX, z))
    elif z == HBOT:
        for x in range(xl, xr + 1):
            tri_edge.add((x, z))
    else:
        tri_edge.add((xl, z))
        tri_edge.add((xr, z))
for y in (15, 16):
    for z in range(HBOT, HTOP + 1):         # red semi-transparent fill
        t = (HTOP - z) / (HTOP - HBOT)
        half = HW * t
        for x in range(int(round(HCX - half)), int(round(HCX + half)) + 1):
            V[(x, y, z)] = "holofill"
    for (x, z) in tri_edge:                 # glowing red outline
        V[(x, y, z)] = "holored"
    for z in (19, 20, 21, 22):              # "!" column
        V[(HCX, y, z)] = "holored"
    V[(HCX, y, 17)] = "holored"             # "!" dot
    for x in range(15, 26):                 # caption bar (MALWARE-style text)
        V[(x, y, 15)] = "holored"

BLINK = {(18, 19, 1)}

# flare groups: name, x0, x1, y, flare color  (on paper top, z=1)
FLARE = [
    ("fl_title", 10, 25, 5, "#CFE0F5"),
    ("fl_lime1", 12, 20, 10, "#F7FFB0"),
    ("fl_green", 12, 23, 13, "#D8FFE9"),
    ("fl_lime3", 12, 21, 16, "#F7FFB0"),
]


def in_lens(x, y, z):
    if (x, y, z) in HANDLE:
        return True
    if z not in (4, 5, 6) or (x, y, z) not in V:
        return False
    return math.hypot(x + 0.5 - CX, y + 0.5 - CY) <= 10.5


def in_holo(x, y, z):
    return y in (15, 16) and 15 <= z <= 26 and 13 <= x <= 27 and (x, y, z) in V


def flare_css(name, x0, x1, y):
    cx_sx = OX + (y - (x0 + x1) / 2) * W
    s = max(-1.0, min(1.0, (cx_sx - SWEEP_BASE) / SWEEP_A))
    p = (s + 1) / 2
    t1, t2, w = 50 * p, 100 - 50 * p, 1.2
    return (f"@keyframes {name}{{0%{{opacity:0}}{t1-w:.1f}%{{opacity:0}}{t1:.1f}%{{opacity:1}}"
            f"{t1+w:.1f}%{{opacity:0}}{t2-w:.1f}%{{opacity:0}}{t2:.1f}%{{opacity:1}}"
            f"{t2+w:.1f}%{{opacity:0}}100%{{opacity:0}}}}"
            f".{name}{{animation:{name} {SWEEP_DUR}s linear infinite}}")


def build_style():
    a = f"{SWEEP_A:g}"
    css = [f"@keyframes sweep{{0%{{transform:translateX(-{a}px)}}"
           f"50%{{transform:translateX({a}px)}}"
           f"100%{{transform:translateX(-{a}px)}}}}",
           f".sweep{{animation:sweep {SWEEP_DUR}s linear infinite}}",
           "@keyframes lensping{from{transform:scale(.55);opacity:.85}to{transform:scale(2.2);opacity:0}}",
           ".ping{transform-origin:160px 148px;animation:lensping 2.4s linear infinite}",
           ".ping2{transform-origin:160px 148px;animation:lensping 2.4s linear infinite;animation-delay:1.2s}",
           "@keyframes holo{0%,54%{opacity:0;transform:translate(0,0)}"
           "55%{opacity:1;transform:translate(2px,-1px)}"
           "57%{opacity:.25;transform:translate(-3px,1px)}"
           "59%{opacity:1;transform:translate(1px,0)}"
           "63%{opacity:1;transform:translate(-2px,1px) skewX(8deg)}"
           "65%{opacity:.35;transform:translate(3px,-1px)}"
           "67%{opacity:1;transform:translate(0,0)}"
           "82%{opacity:1;transform:translate(0,0)}"
           "84%{opacity:.2;transform:translate(2px,0)}"
           "86%{opacity:1;transform:translate(0,0)}"
           "93%{opacity:1;transform:translate(-2px,0)}"
           "95%,100%{opacity:0;transform:translate(0,0)}}",
           ".holo{animation:holo 7s linear infinite}"]
    css += [flare_css(*f[:4]) for f in FLARE]
    return "<style>" + "".join(css) + "</style>"


def in_box(x, y, z):
    for b in BOXES:
        if b[0] <= x <= b[1] and b[2] <= y <= b[3] and b[4] <= z <= b[5]:
            return True
    return False


def occ(x, y, z):
    return (x, y, z) in V or in_box(x, y, z)


def mat(x, y, z):
    if (x, y, z) in V:
        return V[(x, y, z)]
    for b in BOXES:
        if b[0] <= x <= b[1] and b[2] <= y <= b[3] and b[4] <= z <= b[5]:
            return b[6]
    return None


def P(x, y, z):
    # mirrored: fronts (+y) face down-right -> right-facing iso
    return (OX + (y - x) * W, OY + (x + y) * W / 2 - z * W)


def f(p):
    return f"{p[0]:.1f},{p[1]:.1f}"


def uv(x, y):
    sx, sy = P(x, y, 0)
    dv = (sx - 160) / 16
    du = (sy - 150) / 8
    return ((du + dv) / 2, (du - dv) / 2)


def vis_faces(x, y, z):
    fl = []
    if not occ(x, y, z + 1):
        fl.append("top")
    if not occ(x, y + 1, z):
        fl.append("left")
    if not occ(x + 1, y, z):
        fl.append("right")
    return fl


def polys_for(x, y, z, fl, m, cls="", fill=None):
    pal, extra = MATS[m][0:3], MATS[m][3]
    if fill:
        pal, extra = (fill, fill, fill), ' filter="url(#glow)"'
    out = []
    if "top" in fl:
        p = [P(x, y, z+1), P(x+1, y, z+1), P(x+1, y+1, z+1), P(x, y+1, z+1)]
        out.append(f'<polygon points="{f(p[0])} {f(p[1])} {f(p[2])} {f(p[3])}" fill="{pal[2]}"{extra}{cls}/>')
    if "left" in fl:
        p = [P(x, y+1, z+1), P(x+1, y+1, z+1), P(x+1, y+1, z), P(x, y+1, z)]
        out.append(f'<polygon points="{f(p[0])} {f(p[1])} {f(p[2])} {f(p[3])}" fill="{pal[0]}"{extra}{cls}/>')
    if "right" in fl:
        p = [P(x+1, y, z+1), P(x+1, y+1, z+1), P(x+1, y+1, z), P(x+1, y, z)]
        out.append(f'<polygon points="{f(p[0])} {f(p[1])} {f(p[2])} {f(p[3])}" fill="{pal[1]}"{extra}{cls}/>')
    return out


def main(outpath):
    from gen_islands import render
    isl = list(island_base(ISLAND_SEED))
    have = set((x, y) for x, y, z, p in isl if z == 0)
    patch = []
    for b in BOXES:
        cs = [uv(x, y) for x in (b[0], b[1]) for y in (b[2], b[3])]
        umin = min(c[0] for c in cs) - 0.2
        umax = max(c[0] for c in cs) + 0.2
        vmin = min(c[1] for c in cs) - 0.2
        vmax = max(c[1] for c in cs) + 0.2
        for gx in range(int(math.floor(umin)), int(math.ceil(umax)) + 1):
            for gy in range(int(math.floor(vmin)), int(math.ceil(vmax)) + 1):
                cx, cy = gx + 0.5, gy + 0.5
                if not (umin <= cx <= umax and vmin <= cy <= vmax):
                    continue
                if (gx, gy) in have or math.hypot(cx, cy) > 5.0:
                    continue
                have.add((gx, gy))
                patch.append((gx, gy, 0, P_TERRAIN))

    out = [build_style()]
    render(isl + patch, out)

    # voxel model, painter-sorted, routed to groups
    model, lens_out, holo_out = [], [], []
    vox = []
    for x in range(0, 46):
        for y in range(0, 40):
            for z in range(0, 33):
                if not occ(x, y, z):
                    continue
                fl = vis_faces(x, y, z)
                if fl:
                    vox.append((x + y + z, x, y, z, fl))
    for _, x, y, z, fl in sorted(vox):
        cls = ' class="blk"' if (x, y, z) in BLINK else ""
        ps = polys_for(x, y, z, fl, mat(x, y, z), cls)
        if in_holo(x, y, z):
            holo_out += ps
        elif in_lens(x, y, z):
            lens_out += ps
        else:
            model += ps
    out += model

    # line flare overlays (bright copies, opacity animated)
    for name, x0, x1, y, col in FLARE:
        g = [f'<g class="{name}" opacity="0">']
        for x in range(x0, x1 + 1):
            fl = vis_faces(x, y, 1)
            if fl:
                g += polys_for(x, y, 1, fl, mat(x, y, 1), fill=col)
        g.append("</g>")
        out += g

    # sweeping group: pings + lens + warning badge (badge rides above the glass)
    sw = ['<g class="sweep">']
    for cls in ("ping", "ping2"):
        sw.append(f'<circle cx="160" cy="148" r="20" fill="none" stroke="#35E0FF" '
                  f'stroke-width="2" class="{cls}" filter="url(#glow)"/>')
    sw += lens_out
    sw += ['<g class="holo" opacity="0">'] + holo_out + ["</g>"]
    sw.append("</g>")
    out += sw

    with open(outpath, "w") as fh:
        fh.write(svg("\n".join(out)))
    print("wrote", outpath, "model:", len(model), "lens:", len(lens_out),
          "holo:", len(holo_out), "patch:", len(patch))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "rig-lens.svg"
    if "/" not in out:
        out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "public", "media", out)
    main(out)
