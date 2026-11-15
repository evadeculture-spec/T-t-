"""Monta site/index.html a partir de src/index.html.
- substitui <!--#include caminho --> pelo SVG correspondente em site/ (inline, para animar e herdar cores)
- substitui {{URL}} pelo domínio de produção (SITE_URL ou o valor por omissão)
"""
import os, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get("SITE_URL", "https://universo-tata.netlify.app").rstrip("/")
html = (ROOT / "src" / "index.html").read_text()
html = re.sub(r"<!--#include ([^ ]+) -->", lambda m: (ROOT / "site" / m.group(1)).read_text().strip(), html)
html = html.replace("{{URL}}", URL)
(ROOT / "site" / "index.html").write_text(html)
print("site/index.html", len(html), "bytes;", URL)
