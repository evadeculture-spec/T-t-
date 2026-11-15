"""Planos da abertura: a aproximação da Luna (fotograma do filme f5803808, 1,2 s) e o ribeiro.
Uso: python3 scripts/abertura_media.py <pasta-originais>"""
import subprocess, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
ORIG = Path(sys.argv[1]); OUT = ROOT / "site" / "media"
tmp = OUT / ".luna.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.2", "-i", str(ORIG / "f5803808-39c8-4c47-84f2-699ca302d3f6.mp4"),
                "-frames:v", "1", str(tmp)], check=True)
im = Image.open(tmp).convert("RGB").crop((470, 0, 1910, 1080)); tmp.unlink()
for w in (480, 800, 1200):
    r = im.resize((w, round(1080 * w / 1440)), Image.LANCZOS)
    r.save(OUT / f"luna-aproxima-{w}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
    r.save(OUT / f"luna-aproxima-{w}.webp", "WEBP", quality=76, method=6)
print("ok", im.size)

# Plano principal da abertura: primeiro fotograma do filme «The Discovery» (257b134b), em alta resolução
tmp = OUT / ".ribeiro.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0", "-i", str(ORIG / "257b134b-d140-4894-9426-7f5cfc436eb4.mp4"),
                "-frames:v", "1", str(tmp)], check=True)
rib = Image.open(tmp).convert("RGB"); tmp.unlink()
for w in (800, 1280, 1920):
    r = rib if w == 1920 else rib.resize((w, round(1080 * w / 1920)), Image.LANCZOS)
    r.save(OUT / f"ribeiro-descoberta-{w}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
    r.save(OUT / f"ribeiro-descoberta-{w}.webp", "WEBP", quality=78, method=6)
print("ribeiro ok")
