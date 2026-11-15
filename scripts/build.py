"""Monta site/index.html a partir de src/index.html.

- <!--#include caminho -->  insere o SVG correspondente de site/ (inline, para animar e herdar cores)
- {{ALBUM}}                 álbum completo gerado a partir de site/acervo.json (funciona sem JavaScript)
- {{ACERVO_JSON}}           os mesmos dados para o leitor (só campos públicos)
- {{N_FILMES}} {{N_IMAGENS}} {{N_SONS}} e plurais: contagens reais do acervo
- {{URL}}                   domínio de produção (SITE_URL ou o valor por omissão)
"""
import html, json, os, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get("SITE_URL", "https://universo-tata.netlify.app").rstrip("/")
acervo = json.loads((ROOT / "site" / "acervo.json").read_text())
pecas = acervo["pecas"]
e = lambda s: html.escape(str(s), quote=True)

def mmss(s):
    s = round(s)
    return f"{s // 60}:{s % 60:02d}"

def imagem(p, sizes, classe="", carregar="lazy"):
    base = p["miniatura"]
    alt = p.get("alt") or ""
    return (f'<picture><source type="image/webp" srcset="{base}-480.webp 480w, {base}-960.webp 960w" sizes="{sizes}">'
            f'<img class="{classe}" src="{base}-480.jpg" srcset="{base}-480.jpg 480w, {base}-960.jpg 960w" sizes="{sizes}" '
            f'width="{p["w"]}" height="{p["h"]}" loading="{carregar}" decoding="async" alt="{e(alt)}"></picture>')

def destino(p):
    return p.get("video") or p.get("inteira") or p.get("audio")

def rotulo(p):
    if p["tipo"] == "filme":
        return f'Ver o filme «{p["titulo"]}», {mmss(p["duracao"])}'
    if p["tipo"] == "som":
        return f'Ouvir «{p["titulo"]}», {mmss(p["duracao"])}'
    return f'Ver a imagem «{p["titulo"]}» inteira'

grupos = {}
for i, p in enumerate(pecas):
    p["i"] = i
    grupos.setdefault(p["grupo"], []).append(p)

cartoes = []
for g, lista in grupos.items():
    pri, resto = lista[0], lista[1:]
    tipo = pri["tipo"]
    n = len(lista)
    versoes = f'<span class="grupo__n">{n} versões</span>' if n > 1 else ""
    if tipo == "som":
        corpo = (f'<a class="peca peca--som" href="{e(destino(pri))}" data-i="{pri["i"]}" aria-label="{e(rotulo(pri))}">'
                 f'<svg class="peca__onda" viewBox="0 0 240 60" aria-hidden="true" focusable="false"><use href="#onda-som"/></svg>'
                 f'<span class="peca__selo">Ouvir · {mmss(pri["duracao"])}</span></a>')
    else:
        selo = f'<span class="peca__selo"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z"/></svg>{mmss(pri["duracao"])}</span>' if tipo == "filme" else ""
        corpo = (f'<a class="peca" href="{e(destino(pri))}" data-i="{pri["i"]}" aria-label="{e(rotulo(pri))}">'
                 f'{imagem(pri, "(min-width: 1100px) 30vw, (min-width: 700px) 45vw, 100vw")}{selo}</a>')
    var = ""
    if resto:
        itens = "".join(
            f'<li><a class="variante" href="{e(destino(v))}" data-i="{v["i"]}" aria-label="{e(rotulo(v))}">'
            f'{imagem(v, "(min-width: 1100px) 10vw, (min-width: 700px) 15vw, 30vw")}'
            f'<span class="variante__n" aria-hidden="true">{k + 2}</span></a></li>'
            for k, v in enumerate(resto))
        var = f'<ul class="variantes" aria-label="Outras versões de {e(pri["grupoTitulo"])}">{itens}</ul>'
    cartoes.append(
        f'<article class="grupo grupo--{tipo}" data-tipo="{tipo}" id="grupo-{g}">'
        f'{corpo}<div class="grupo__texto"><h3 class="grupo__titulo">{e(pri["grupoTitulo"])}{versoes}</h3>'
        f'<p class="grupo__legenda">{e(pri["legenda"])}</p></div>{var}</article>')

publico = [{k: p[k] for k in ("slug", "tipo", "grupo", "grupoTitulo", "titulo", "legenda", "w", "h", "video", "inteira",
                              "audio", "duracao", "som", "legendas", "alt", "miniatura", "transcricao") if k in p}
           for p in pecas]
c = acervo["contagem"]
plural = lambda n, um, varios: f"{n} {um if n == 1 else varios}"

out = (ROOT / "src" / "index.html").read_text()
out = re.sub(r"<!--#include ([^ ]+) -->", lambda m: (ROOT / "site" / m.group(1)).read_text().strip(), out)
out = (out.replace("{{ALBUM}}", "\n".join(cartoes))
          .replace("{{ACERVO_JSON}}", json.dumps(publico, ensure_ascii=False).replace("</", "<\\/"))
          .replace("{{N_FILMES}}", plural(c["filme"], "filme", "filmes"))
          .replace("{{N_IMAGENS}}", plural(c["imagem"], "imagem", "imagens"))
          .replace("{{N_SONS}}", plural(c["som"], "som", "sons"))
          .replace("{{N_GRUPOS}}", str(len(grupos)))
          .replace("{{URL}}", URL))
assert "{{" not in out, re.findall(r"\{\{\w+\}\}", out)
(ROOT / "site" / "index.html").write_text(out)
print("site/index.html", len(out), "bytes;", len(grupos), "grupos;", c, ";", URL)
