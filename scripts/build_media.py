"""Prepara os meios do site a partir dos originais descarregados do Higgsfield.

Uso:  python3 scripts/build_media.py <pasta-com-originais>

A pasta de originais (não versionada) deve conter:
  gen_c7655626.png   retrato do Tatá a acenar (geração original)
  gen_7bc16c3f.png   a Luna de cachecol azul (geração original)
  5d95dde5-....png   fotografia do peluche artesanal (upload original)
  dabc54fa-....png   captura de ecrã da Luna encostada ao Tatá (só se recorta a arte)
  vid/257b134b.mp4   clipe «The Discovery» (8 s)
  vid/1457899e.mp4, vid/f4879c84.mp4, vid/64e3cd98.mp4  clipes de onde saem fotogramas
Só a seleção é exportada para site/media. As capturas completas nunca são copiadas.
"""
import subprocess, sys, json
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance
import numpy as np

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "site" / "media"
OUT.mkdir(parents=True, exist_ok=True)
manifest = {}

def frame(clip, t):
    tmp = OUT.parent.parent / f".frame_{clip}_{t}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(SRC / "vid" / f"{clip}.mp4"),
                    "-frames:v", "1", str(tmp)], check=True)
    im = Image.open(tmp).convert("RGB"); tmp.unlink()
    return im

def save(name, im, widths, q=82):
    """Grava JPEG + WebP em várias larguras; regista dimensões para o HTML."""
    w0, h0 = im.size
    out = []
    for w in widths:
        if w > w0: w = w0
        r = im if w == w0 else im.resize((w, round(h0 * w / w0)), Image.LANCZOS)
        r.save(OUT / f"{name}-{w}.jpg", "JPEG", quality=q, optimize=True, progressive=True)
        r.save(OUT / f"{name}-{w}.webp", "WEBP", quality=q - 4, method=6)
        out.append(w)
    manifest[name] = {"w": w0, "h": h0, "sizes": sorted(set(out))}

# 1. Ribeiro: primeiro fotograma do clipe «The Discovery» (capa do vídeo)
rib = frame("257b134b", 0)
save("ribeiro-descoberta", rib, [800, 1280, 1920])
# recorte 3:2 para telefone, conserva Luna, Tatá e a estrela
save("ribeiro-descoberta-3x2", rib.crop((90, 0, 1710, 1080)), [600, 900, 1280])

# 2. Retrato do Tatá a acenar: corpo inteiro com ar à volta
tata = Image.open(SRC / "gen_c7655626.png").convert("RGB")
save("tata-acena", tata.crop((620, 0, 2130, 1536)), [600, 1000, 1510])

# 3. Fotografia original do peluche (só ligeira correção de exposição)
pel = Image.open(SRC / "5d95dde5-9c0a-4ec0-bc8e-3de2d352ce06.png").convert("RGB")
pel = pel.crop((318, 520, 1018, 1250))
pel = ImageEnhance.Brightness(pel).enhance(1.28)
pel = ImageEnhance.Contrast(pel).enhance(1.06)
save("peluche-original", pel, [500, 700])

# 4. Álbum
save("luna-cachecol", Image.open(SRC / "gen_7bc16c3f.png").convert("RGB").crop((626, 0, 2126, 1536)), [600, 1000, 1500])
save("ramo-ate-a-estrela", frame("1457899e", 2.5), [800, 1280, 1920])
save("travessia-tronco", frame("f4879c84", 1), [800, 1280, 1920])
save("colina-noite", frame("64e3cd98", 7.3), [800, 1280, 1920])

# 5. Fecho: Luna encostada ao Tatá — recorte só da arte dentro da captura
cap = Image.open(SRC / "dabc54fa-a6ba-45a1-aed8-7b621eae4d22.png").convert("RGB")
save("luna-encostada", cap.crop((4, 374, 2236, 1572)), [800, 1280, 2232])

# 6. Clipe: H.264 + AAC, arranque rápido
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC / "vid" / "257b134b.mp4"),
                "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
                "-vf", "scale=1600:-2", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                str(OUT / "a-descoberta.mp4")], check=True)

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
print(json.dumps(manifest))
