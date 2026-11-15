"""Importa o acervo do Tatá a partir do inventário (idempotente).

Uso:
  python3 scripts/importar.py <pasta-originais> [--forcar]

A pasta de originais (não versionada) tem um ficheiro por peça, com o identificador estável
do Higgsfield como nome: <id>.mp4 | <id>.png | <id>.jpg | <id>.wav
Para voltar a descarregar, basta guardar lá os ficheiros com esses nomes; este script não usa
URLs da conta. Só as peças com estado integrado/recorte entram no site; duplicados, capturas
de duplicados e peças privadas ficam registados no inventário e não são servidos.

Gera:
  site/media/acervo/<slug>.mp4 (720p, sem metadados; sem som quando o original tem fala com
                                 nomes próprios -> cópia de apresentação limpa)
  site/media/acervo/<slug>-{480,960}.{webp,jpg}  miniaturas e posters
  site/media/acervo/<slug>-1600.jpg              imagem inteira (só imagens)
  site/media/acervo/<slug>.vtt                   legendas, quando há fala
  site/media/acervo/voz-do-tata.m4a              som
  site/acervo.json                               catálogo público (sem dados da conta)
"""
import json, subprocess, sys, hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ORIG = Path(sys.argv[1])
FORCAR = "--forcar" in sys.argv
OUT = ROOT / "site" / "media" / "acervo"
OUT.mkdir(parents=True, exist_ok=True)
INV = json.loads((ROOT / "inventario" / "inventario.json").read_text())

SERVIR = {"integrado", "integrado-copia-limpa", "recorte-de-captura"}

# Legendas (texto do guião da voz, alinhado pelas pausas medidas na faixa de voz)
FALA = [
    (0.28, 1.2, "Olha!"),
    (1.43, 3.8, "Uma estrela brilhante!"),
    (4.05, 8.4, "Vou atravessar o tronco para chegar até ela."),
    (8.88, 10.2, "Consegui!"),
    (10.5, 13.2, "Encontrei a estrela!"),
    (13.55, 19.4, "Vou devolver a estrela para o céu, bem alto!"),
]

def ts(t):
    m, s = divmod(t, 60)
    return f"00:{int(m):02d}:{s:06.3f}"

def vtt(nome, desvio):
    linhas = ["WEBVTT", ""]
    for i, (a, b, txt) in enumerate(FALA, 1):
        linhas += [str(i), f"{ts(a + desvio)} --> {ts(b + desvio)}", txt, ""]
    (OUT / f"{nome}.vtt").write_text("\n".join(linhas))

def precisa(*ficheiros):
    return FORCAR or not all((OUT / f).exists() for f in ficheiros)

def sem_exif(im):
    return Image.frombytes(im.mode, im.size, im.tobytes())

def gravar_variantes(slug, im, larguras=(480, 960), inteira=None):
    im = sem_exif(im.convert("RGB"))
    w0, h0 = im.size
    # nomes estáveis pelas larguras pedidas (mesmo quando o original é mais pequeno)
    for w in larguras:
        r = im.resize((min(w, w0), round(h0 * min(w, w0) / w0)), Image.LANCZOS)
        r.save(OUT / f"{slug}-{w}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        r.save(OUT / f"{slug}-{w}.webp", "WEBP", quality=76, method=6)
    if inteira:
        r = im if w0 <= inteira else im.resize((inteira, round(h0 * inteira / w0)), Image.LANCZOS)
        r.save(OUT / f"{slug}-{inteira}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
    return w0, h0

def duracao(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(f)]).decode().strip())

catalogo = []
contagem = {"filme": 0, "imagem": 0, "som": 0}
ficheiros_vistos = {}

for p in INV["pecas"]:
    if p.get("estado") not in SERVIR:
        continue
    slug, tipo = p["slug"], p["tipo"]
    item = {k: p[k] for k in ("slug", "tipo", "grupo", "ordem", "titulo", "legenda") if k in p}
    item["grupoTitulo"] = INV["grupos"][p["grupo"]]

    if tipo == "filme":
        src = ORIG / f"{p['id']}.mp4"
        tirar_som = p.get("som") in ("removido", "sem-som")
        if precisa(f"{slug}.mp4"):
            cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-map_metadata", "-1",
                   "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "slow", "-crf", "26",
                   "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
            cmd += ["-an"] if tirar_som else ["-c:a", "aac", "-b:a", "96k"]
            subprocess.run(cmd + [str(OUT / f"{slug}.mp4")], check=True)
        if precisa(f"{slug}-480.webp", f"{slug}-960.jpg"):
            tmp = OUT / f".{slug}.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(p.get("poster_s", 1)), "-i", str(src),
                            "-frames:v", "1", str(tmp)], check=True)
            gravar_variantes(slug, Image.open(tmp)); tmp.unlink()
        item.update(w=1280, h=720, video=f"media/acervo/{slug}.mp4",
                    duracao=round(duracao(OUT / f"{slug}.mp4"), 1), som=not tirar_som)
        if p.get("legendas"):
            vtt(p["legendas"], 0.5)
            item["legendas"] = f"media/acervo/{p['legendas']}.vtt"
    elif tipo == "imagem":
        src = next(ORIG.glob(f"{p['id']}.*"))
        if precisa(f"{slug}-480.webp", f"{slug}-1600.jpg"):
            im = Image.open(src).convert("RGB")
            if p.get("recorte"): im = im.crop(tuple(p["recorte"]))
            if p["slug"] == "peluche":
                from PIL import ImageEnhance
                im = ImageEnhance.Contrast(ImageEnhance.Brightness(im).enhance(1.28)).enhance(1.06)
            gravar_variantes(slug, im, inteira=1600)
        with Image.open(OUT / f"{slug}-960.jpg") as r:
            w, h = r.size
        item.update(w=w, h=h, inteira=f"media/acervo/{slug}-1600.jpg", alt=p["alt"])
    elif tipo == "som":
        src = ORIG / f"{p['id']}.wav"
        if precisa(f"{slug}.m4a"):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-map_metadata", "-1",
                            "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(OUT / f"{slug}.m4a")], check=True)
        item.update(audio=f"media/acervo/{slug}.m4a", duracao=round(duracao(OUT / f"{slug}.m4a"), 1),
                    transcricao=p["transcricao"])
    if tipo != "som":
        item["miniatura"] = f"media/acervo/{slug}"
    contagem[tipo] += 1
    catalogo.append(item)

# ordem do álbum: pela ordem dos grupos no inventário e, dentro do grupo, pela ordem da variante
ordem_grupos = list(INV["grupos"])
catalogo.sort(key=lambda i: (ordem_grupos.index(i["grupo"]), i.get("ordem", 0)))
(ROOT / "site" / "acervo.json").write_text(json.dumps({"contagem": contagem, "pecas": catalogo}, ensure_ascii=False, indent=1))

# reconciliação: inventário x ficheiros x catálogo
servidos = {f.name for f in OUT.iterdir() if not f.name.startswith(".")}
for i in catalogo:
    if i["tipo"] == "filme": assert f"{i['slug']}.mp4" in servidos, i["slug"]
    if i["tipo"] == "som": assert f"{i['slug']}.m4a" in servidos, i["slug"]
    if i["tipo"] != "som": assert f"{i['slug']}-480.webp" in servidos, i["slug"]
inv_servir = [p for p in INV["pecas"] if p.get("estado") in SERVIR]
assert len(inv_servir) == len(catalogo)
print(json.dumps(contagem), "| ficheiros:", len(servidos),
      "| MB:", round(sum(f.stat().st_size for f in OUT.iterdir()) / 1e6, 1))
