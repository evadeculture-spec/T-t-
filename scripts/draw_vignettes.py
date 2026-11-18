"""Desenha as vinhetas do ribeiro em SVG (fetos, ondulações, linha cosida).

O traço é gerado ponto a ponto a partir de curvas desenhadas à mão (pontos de controlo
escolhidos a olho sobre a cena do ribeiro), com espessura variável: cada folíolo e cada
ondulação é uma forma afilada, não um traço de largura fixa.
Uso: python3 scripts/draw_vignettes.py  -> escreve site/img/{fetos,ondas,costura}.svg
"""
import math, random
from pathlib import Path
OUT = Path(__file__).resolve().parent.parent / "site" / "img"
random.seed(7)
f = lambda v: f"{v:.1f}"

def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])

def leaf(px, py, ang, length, width, bend):
    tx, ty = px + math.cos(ang)*length, py + math.sin(ang)*length
    nx, ny = -math.sin(ang), math.cos(ang)
    mx, my = px + math.cos(ang)*length*0.5, py + math.sin(ang)*length*0.5
    c1 = (mx + nx*width + nx*bend, my + ny*width + ny*bend)
    c2 = (mx - nx*width + nx*bend, my - ny*width + ny*bend)
    return f"M{f(px)} {f(py)}Q{f(c1[0])} {f(c1[1])} {f(tx)} {f(ty)}Q{f(c2[0])} {f(c2[1])} {f(px)} {f(py)}Z"

def frond(p0, p1, p2, p3, n, lmax, side_bias=1.0):
    pts = [bez(p0, p1, p2, p3, i/(n-1)) for i in range(n)]
    d = []
    for i in range(1, n-1):
        t = i/(n-1)
        (x, y), (x2, y2) = pts[i], pts[i+1]
        a = math.atan2(y2-y, x2-x)
        L = lmax * (math.sin(math.pi*min(1, t*1.15))**0.6) * (1 - 0.55*t) * random.uniform(0.9, 1.08)
        if L < 3: continue
        for s in (-1, 1):
            ang = a + s*math.radians(58 - 18*t)
            d.append(leaf(x, y, ang, L*(side_bias if s > 0 else 1), L*0.2, -s*L*0.12))
    spine = f"M{f(p0[0])} {f(p0[1])}C{f(p1[0])} {f(p1[1])} {f(p2[0])} {f(p2[1])} {f(p3[0])} {f(p3[1])}"
    return "".join(d), spine

# 1. Fetos: três frondes que nascem da linha de margem da cena
fronds = [
    (((60, 360), (55, 250), (95, 150), (170, 92)), 20, 46, 1.0, "var(--feto-fundo)"),
    (((115, 360), (120, 270), (170, 200), (250, 178)), 17, 38, 0.9, "var(--feto)"),
    (((20, 360), (10, 300), (20, 245), (58, 205)), 12, 26, 1.0, "var(--feto)"),
]
g = []
for (pts, n, lmax, sb, col) in fronds:
    leaves, spine = frond(*pts, n, lmax, sb)
    g.append(f'<g fill="{col}"><path d="{leaves}"/></g>'
             f'<path d="{spine}" fill="none" stroke="{col}" stroke-width="2.6" stroke-linecap="round"/>')
(OUT / "fetos.svg").write_text(
    '<svg class="vinheta-fetos" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360" aria-hidden="true" focusable="false">'
    + "".join(g) + "</svg>\n")

# 2. Ondulações: o ribeiro a sair da cena, da direita para a esquerda, a abrandar
def ripple(x0, x1, y, amp, waves, wmax, phase):
    n = 60
    top, bot = [], []
    for i in range(n+1):
        t = i/n
        x = x0 + (x1-x0)*t
        yy = y + amp*math.sin(phase + t*waves*2*math.pi)
        w = wmax*(math.sin(math.pi*t)**0.8)
        top.append((x, yy-w)); bot.append((x, yy+w))
    pts = top + bot[::-1]
    center = "M" + " L".join(f"{f(x)} {f(y + amp*math.sin(phase + ((x-x0)/(x1-x0))*waves*2*math.pi))}"
                            for x in [x0 + (x1-x0)*i/40 for i in range(41)])
    return "M" + " L".join(f"{f(a)} {f(b)}" for a, b in pts) + "Z", center

rows = [  # x0, x1, y, amp, waves, wmax, classe
    (420, 1180, 18, 3.0, 3.0, 2.6, "onda"),
    (160, 980, 40, 3.5, 3.5, 3.2, "onda"),
    (600, 1160, 58, 2.5, 2.0, 1.6, "onda onda-fina"),
    (40, 700, 72, 3.0, 3.0, 2.2, "onda"),
    (300, 1100, 94, 2.0, 2.5, 1.2, "onda onda-fina"),
    (820, 1040, 30, 1.5, 1.0, 1.4, "reflexo"),
    (880, 1000, 50, 1.2, 0.8, 1.1, "reflexo"),
]
parts, glint = [], ""
for i, (x0, x1, y, a, w, wm, cls) in enumerate(rows):
    shape, center = ripple(x0, x1, y, a, w, wm, i*1.3)
    parts.append(f'<path class="{cls}" d="{shape}"/>')
    if i == 1: glint = center
parts.append(f'<path class="onda-brilho" d="{glint}" pathLength="100"/>')
(OUT / "ondas.svg").write_text(
    '<svg class="vinheta-ondas" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 110" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">'
    + "".join(parts) + "</svg>\n")

# 3. Linha cosida: um ponto corrido que serve de chão comum ao peluche e ao desenho
p = ((10, 34), (180, 18), (420, 52), (690, 26))
pts = [bez(*p, i/120) for i in range(121)]
seam = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
ticks = []
for i in range(84, 118, 6):  # pontos em cruz no fim, como a costura do peito
    (x, y), (x2, y2) = pts[i], pts[i+1]
    a = math.atan2(y2-y, x2-x) + math.pi/2
    ticks.append(f"M{f(x-math.cos(a)*6)} {f(y-math.sin(a)*6)}L{f(x+math.cos(a)*6)} {f(y+math.sin(a)*6)}")
(OUT / "costura.svg").write_text(
    '<svg class="vinheta-costura" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
    f'<path d="{seam}" fill="none" stroke="var(--linha)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="11 8" vector-effect="non-scaling-stroke"/>'
    f'<path d="{"".join(ticks)}" fill="none" stroke="var(--linha)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>'
    "</svg>\n")
print("ok")

# 4. Linha de água: o reflexo dourado da estrela desce da cena e corre até ao primeiro fotograma do álbum
p = ((1010, 6), (900, 70), (420, 40), (70, 152))
n = 140
pts = [bez(*p, i/n) for i in range(n+1)]
cima, baixo = [], []
for i, (x, y) in enumerate(pts):
    t = i/n
    (x2, y2) = pts[min(i+1, n)] if i < n else pts[i]
    (x1, y1) = pts[max(i-1, 0)]
    a = math.atan2(y2-y1, x2-x1) + math.pi/2
    w = 0.6 + 3.4*math.sin(math.pi*min(1, t*1.4))**0.7*(1-0.55*t) + 0.5*math.sin(t*38)
    cima.append((x+math.cos(a)*w, y+math.sin(a)*w)); baixo.append((x-math.cos(a)*w, y-math.sin(a)*w))
forma = "M" + " L".join(f"{f(a)} {f(b)}" for a, b in cima + baixo[::-1]) + "Z"
centro = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
marcas = []
for (x0, y0, L, wm) in ((960, 30, 70, 1.6), (880, 54, 46, 1.2), (560, 64, 90, 1.4), (300, 96, 60, 1.1), (180, 130, 40, 0.9)):
    s, c = ripple(x0, x0+L, y0, 1.2, 1.0, wm, x0/50)
    marcas.append(f'<path class="agua-marca" d="{s}"/>')
(OUT / "linha-agua.svg").write_text(
    '<svg class="vinheta-agua" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
    '<defs><linearGradient id="agua-cor" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--estrela)"/>'
    '<stop offset=".28" stop-color="var(--estrela-luz)" stop-opacity=".85"/><stop offset=".55" stop-color="var(--onda)"/>'
    '<stop offset="1" stop-color="var(--onda-fina)"/></linearGradient></defs>'
    + "".join(marcas) + f'<path class="agua-linha" d="{forma}" fill="url(#agua-cor)"/>'
    f'<path class="agua-brilho" d="{centro}" pathLength="100"/></svg>\n')
print("linha de água ok")
