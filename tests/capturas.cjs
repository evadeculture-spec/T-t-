// Captura as composições em quatro enquadramentos. Uso: node tests/capturas.cjs [url] [pasta]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:8080/';
const out = process.argv[3] || 'capturas';
const vistas = [[320, 640, 'telefone-320'], [390, 844, 'telefone'], [844, 390, 'telefone-deitado'], [820, 1180, 'ipad-vertical'], [1180, 820, 'ipad-horizontal'], [1440, 900, 'computador']];
(async () => {
  const b = await chromium.launch();
  for (const [w, h, n] of vistas) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1300, isMobile: w < 900 && h < 900 });
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.screenshot({ path: `${out}/${n}-primeiro-ecra.png` });
    // percorre a página para carregar as imagens preguiçosas
    const alt = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < alt; y += h / 2) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(120); }
    await p.waitForLoadState('networkidle');
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${n}-pagina.png`, fullPage: true });
    const largura = await p.evaluate(() => document.documentElement.scrollWidth);
    const partidas = await p.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.currentSrc || i.src));
    console.log(n, 'scrollWidth', largura, largura > w ? 'SCROLL HORIZONTAL!' : 'ok', 'imagens por carregar:', partidas.length);
    await p.close();
  }
  await b.close();
})();
