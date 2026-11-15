# O universo do Tatá

Portfólio ilustrado do Tatá, pensado primeiro para telemóvel: abertura com a cena do ribeiro,
álbum com todo o acervo (filmes, imagens e som), «Do peluche ao desenho» e o fecho com a Luna
encostada ao Tatá. Produção: https://universo-tata.netlify.app/

## Estrutura

- `site/` — tudo o que é publicado. Funciona sem sessão no Higgsfield.
  - `site/acervo.json` — catálogo público (sem dados da conta).
  - `site/media/acervo/` — filmes (720p), posters, miniaturas, imagens inteiras, legendas e som.
- `src/index.html` — modelo da página; `scripts/build.py` monta `site/index.html` e gera o álbum
  completo em HTML (todas as peças acessíveis mesmo sem JavaScript).
- `inventario/inventario.json` — inventário de trabalho (não publicado): identificador estável,
  tipo, grupo, estado de integração e duplicados de cada peça do Higgsfield ligada ao Tatá.
- `scripts/importar.py` — importação idempotente a partir do inventário e de uma pasta de
  originais com o identificador como nome (`<id>.mp4|png|wav`). Volta a correr sem refazer o que existe.
- `scripts/abertura_media.py` — planos da abertura (ribeiro e aproximação da Luna).
- `scripts/draw_vignettes.py` — fetos, linha de água e linha cosida em SVG.
- `scripts/capa_og.cjs` — capa de partilha 1200×630 e ícones.
- `scripts/verificar_nomes.py` — garante que nenhum nome pessoal chega ao site
  (texto, nomes de ficheiros, metadados de vídeo, som e imagens).
- `tests/percurso.cjs` — percurso completo em 320, 390×844, 844×390, 820×1180, 1180×820 e 1440×900,
  leitor de todo o acervo, 3G simulado, movimento reduzido, sem JavaScript e teclado.
- `tests/capturas.cjs` — capturas dos seis enquadramentos.

## Comandos

```sh
python3 scripts/importar.py <pasta-originais>   # só quando há peças novas
npm run build                                    # monta a página e verifica nomes
npm run serve                                    # http://localhost:8080/
npm test                                         # com o servidor a correr
```

## Peso dos meios

19 filmes recodificados a 720p (≈26 MB no total), imagens em WebP + JPEG. Fica abaixo de limites
práticos do Netlify e do Git; se o acervo crescer muito, os filmes devem passar para um alojamento
de media próprio com URLs estáveis, mantendo os mesmos nomes em `acervo.json`.
