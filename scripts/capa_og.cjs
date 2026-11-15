// Compõe a capa de partilha 1200×630 (cena do ribeiro + lettering) e os ícones PNG.
// Uso: node scripts/capa_og.cjs   (com o site servido em http://localhost:8080)
const { chromium } = require('playwright');
const fs = require('fs');
const base = 'http://localhost:8080/';
const lettering = fs.readFileSync(__dirname + '/../site/img/tata-lettering.svg', 'utf8');
const capa = `<!doctype html><html><head><style>
@font-face{font-family:F;src:url(/fonts/fraunces-latin-full-italic.woff2);font-style:italic}
html,body{margin:0;width:1200px;height:630px;background:#1e2347;overflow:hidden}
.cena{position:absolute;left:108px;top:56px;width:922px;height:518px;border-radius:3px;overflow:hidden}
.cena img{width:100%;height:100%;display:block}
.t{position:absolute;left:548px;top:74px;color:#f4ebdd;filter:drop-shadow(0 2px 10px rgba(20,22,50,.55))}
.t small{display:block;font:italic 30px/1 F,serif;color:#f1dfc2;margin:0 0 4px 6px;font-variation-settings:"SOFT" 100}
.t svg{width:300px;height:auto;overflow:visible}.t .acento{stroke:#f2c94c}
.ondas{position:absolute;left:0;right:0;bottom:12px;height:40px}
</style></head><body>
<div class="cena"><img src="/media/ribeiro-descoberta-1920.jpg"></div>
<div class="t"><small>O universo do</small>${lettering}</div>
</body></html>`;
const icone = (s) => `<!doctype html><html><body style="margin:0;background:transparent">${fs.readFileSync(__dirname + '/../site/favicon.svg','utf8').replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  fs.writeFileSync(__dirname + '/../site/og/_capa.html', capa); // mesma origem, para a fonte carregar
  await p.goto(base + 'og/_capa.html', { waitUntil: 'networkidle' });
  fs.unlinkSync(__dirname + '/../site/og/_capa.html');
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: 'site/og/capa-ribeiro.jpg', type: 'jpeg', quality: 86 });
  for (const [s, f] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png']]) {
    const q = await b.newPage({ viewport: { width: s, height: s } });
    await q.setContent(icone(s));
    await q.screenshot({ path: 'site/' + f, omitBackground: true });
  }
  await b.close();
})();
