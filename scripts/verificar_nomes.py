"""Confirma que nenhum nome pessoal chega ao site publicado.
Procura (sem acentos, maiúsculas, pontuação nem espaços) em: texto de todos os ficheiros de site/,
nomes de ficheiros, metadados de vídeo/som (ffprobe) e metadados de imagens (EXIF/XMP/texto PNG).
Falha com código 1 se encontrar alguma ocorrência."""
import json, re, subprocess, sys, unicodedata
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "site"
PROIBIDOS = ["joao", "marcia", "afonso", "joaoemarcia", "marciaejoao"]

def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]", "", s)

achados = []
def ver(onde, texto):
    n = norm(texto)
    for p in PROIBIDOS:
        if p in n: achados.append((onde, p))

for f in ROOT.rglob("*"):
    if not f.is_file(): continue
    rel = str(f.relative_to(ROOT))
    ver("nome:" + rel, rel)
    if f.suffix in {".html", ".css", ".js", ".json", ".vtt", ".svg", ".txt", ".xml", ".webmanifest"}:
        ver(rel, f.read_text(errors="ignore"))
    elif f.suffix in {".mp4", ".m4a", ".mov", ".webm"}:
        meta = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format_tags:stream_tags",
                                        "-of", "json", str(f)]).decode()
        ver(rel + " (metadados)", meta)
    elif f.suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        with Image.open(f) as im:
            info = " ".join(str(v) for v in im.info.values() if isinstance(v, (str, bytes)))
            exif = " ".join(str(v) for v in im.getexif().values())
        ver(rel + " (metadados)", info + exif)
        # também procura texto em claro dentro do ficheiro (XMP, comentários)
        for corrida in re.findall(rb"[\x20-\x7e\xc0-\xff]{8,}", f.read_bytes()):
            t = corrida.decode("latin-1")
            if re.search(r"[A-Za-z]{4,}", t) and re.search(r"(?i)jo.?.?o\b|m.?rcia|afonso", t):
                achados.append((rel + " (texto embutido)", t[:60]))

print(f"verificados {sum(1 for f in ROOT.rglob('*') if f.is_file())} ficheiros")
if achados:
    for a in achados: print("ENCONTRADO:", a)
    sys.exit(1)
print("nenhum nome pessoal encontrado")
