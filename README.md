# O universo do Tatá

Um álbum web para folhear no iPad: o ribeiro e a estrela, o Tatá do peluche ao desenho,
algumas descobertas do Higgsfield e a Luna encostada ao Tatá no fim.

- `site/` — o que é publicado (HTML, CSS, JS, meios, fontes). Funciona sem sessão no Higgsfield.
- `src/index.html` — modelo da página; `python3 scripts/build.py` monta `site/index.html`
  (insere os SVG desenhados e o domínio de produção; `SITE_URL` muda o domínio).
- `scripts/build_media.py` — recortes e exportações a partir dos originais (pasta não versionada).
- `scripts/draw_vignettes.py` — fetos, ondulações e linha cosida em SVG.
- `scripts/capa_og.cjs` — capa de partilha 1200×630 e ícones.
- `tests/percurso.cjs` — percorre a visita (Folhear, vídeo, ampliação, Escape, foco, regresso).
- `tests/capturas.cjs` — capturas a 390×844, 820×1180, 1180×820 e 1440×900.

Pré-visualização local: `npm run serve` e abrir http://localhost:8080/ ; testes: `npm test`.

## Identidade

- Cores (em `site/styles.css`, `:root`): azul-noite `#1e2347`, céu `#3d4b89`, estrela `#f2c94c`,
  papel creme `#f4ebdd`, pelo `#dabf9a`, Luna `#d16b20`, linha cosida `#a9835c`.
- Tipo: Fraunces (SIL OFL), eixo SOFT no máximo.
- Lettering «Tatá» desenhado à mão (`site/img/tata-lettering.svg`); o acento é um ponto de costura.
- Símbolo secundário: a estrela de cinco pontas do ribeiro (`site/img/estrela.svg`, `site/favicon.svg`).

## Peças

| Ficheiro | Origem |
|---|---|
| ribeiro-descoberta, a-descoberta.mp4 | clipe original «The Discovery» (8 s); 1.º fotograma como capa |
| tata-acena | geração original do retrato a acenar (recorte ao corpo inteiro) |
| peluche-original | fotografia original do peluche (recorte e ligeira correção de exposição) |
| luna-cachecol | geração original |
| ramo-ate-a-estrela, travessia-tronco, colina-noite | fotogramas dos clipes originais 2, 3 e 5 |
| luna-encostada | recorte só da arte a partir de uma captura de ecrã (sem barras nem interface) |
