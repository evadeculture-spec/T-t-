// Percorre a visita: abertura, leitor (filmes e imagens), filtros, variantes, revelação progressiva,
// fecho e regresso. Uso: node tests/percurso.cjs [url]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:8080/';
let falhas = 0;
const TOTAL_PECAS = 27, TOTAL_GRUPOS = 15; // 19 filmes + 8 imagens; a faixa de voz autónoma não é publicada
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) falhas++; };

(async () => {
  const b = await chromium.launch();
  const vistas = [[320, 640, 'telefone 320'], [390, 844, 'telefone'], [844, 390, 'telefone deitado'], [820, 1180, 'iPad vertical'], [1180, 820, 'iPad horizontal'], [1440, 900, 'computador']];

  for (const [w, h, nome] of vistas) {
    console.log(`\n${nome} ${w}×${h}`);
    const toque = w < 1300;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: toque, isMobile: toque && w < 900 });
    const p = await ctx.newPage();
    const pedidos = [], erros = [], falhados = [];
    p.on('request', (r) => pedidos.push(r.url()));
    p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    p.on('pageerror', (e) => erros.push(String(e)));
    p.on('response', (r) => { if (r.status() >= 400) falhados.push(r.status() + ' ' + r.url()); });
    await p.goto(url, { waitUntil: 'load' });

    const caixa = (sel) => p.locator(sel).first().boundingBox();
    const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(scrollW <= w, `sem scroll horizontal (${scrollW})`);
    if (w >= 390) {
      const marca = await caixa('.titulo .lettering'), cena = await caixa('.abertura__ribeiro img'), acao = await caixa('.acao--principal');
      ok(marca && marca.y + marca.height <= h, 'identidade no primeiro ecrã');
      ok(cena && cena.y + cena.height <= h, 'cena inteira no primeiro ecrã');
      ok(acao && acao.y + acao.height <= h, 'ação «Ver a descoberta» no primeiro ecrã');
    }
    ok(!pedidos.some((u) => /\.(mp4|m4a)/.test(u)), 'nenhum filme ou som pedido na abertura');
    ok(await p.evaluate(() => { const i = document.querySelector('.abertura__ribeiro img'); return i.complete && i.naturalWidth > 0; }), 'cena do ribeiro carregada');
    const pequenos = await p.evaluate(() => [...document.querySelectorAll('a, button')].filter((e) => {
      if (e.closest('dialog') || e.closest('[hidden]') || !e.offsetParent) return false;
      const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44;
    }).map((e) => (e.textContent.trim() || e.getAttribute('aria-label')).slice(0, 30)));
    ok(pequenos.length === 0, 'controlos com pelo menos 44×44 px ' + (pequenos.length ? JSON.stringify(pequenos) : ''));

    // Ver a descoberta: filme inline com comandos nativos, som desligado até o visitante o pedir
    await p.click('.acao--principal');
    await p.waitForSelector('#leitor[open] video');
    await p.waitForFunction(() => { const v = document.querySelector('#leitor video'); return v && v.currentTime > 0.4; }, null, { timeout: 15000 }).catch(() => {});
    let v = await p.evaluate(() => { const v = document.querySelector('#leitor video'); return { t: v.currentTime, c: v.controls, inl: v.playsInline, m: v.muted, d: v.duration, src: v.currentSrc }; });
    ok(v.c && v.inl, 'leitor com comandos nativos e reprodução inline');
    ok(v.t > 0.4 && v.d > 7.5, `«A descoberta» a reproduzir (${v.t.toFixed(1)} s de ${(v.d || 0).toFixed(1)} s)`);
    ok(v.m, 'começa sem som (som por opção do visitante)');
    await p.click('#leitor-som');
    ok(!(await p.evaluate(() => document.querySelector('#leitor video').muted)), '«Som» liga o áudio');
    await p.evaluate(() => document.querySelector('#leitor video').pause());
    ok(await p.evaluate(() => document.querySelector('#leitor video').paused), 'pausa');
    await p.click('#leitor-seg');
    ok((await p.textContent('#leitor-titulo')) === 'A descoberta, pelo caminho', '«Seguinte» passa à variante seguinte');
    await p.click('#leitor-ant');
    ok((await p.textContent('#leitor-titulo')) === 'A descoberta', '«Anterior» volta');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    ok(!(await p.evaluate(() => document.getElementById('leitor').open)) && (await p.evaluate(() => document.activeElement.classList.contains('acao--principal'))), 'Escape fecha e devolve o foco à ação');

    // Explorar o álbum
    await p.click('#explorar');
    await p.waitForTimeout(1300);
    const topo = await p.evaluate(() => document.getElementById('album').getBoundingClientRect().top);
    ok(Math.abs(topo) < 4, `«Explorar o álbum» leva ao álbum (topo=${topo.toFixed(0)})`);

    // Filtros
    await p.click('.filtro[data-filtro="imagem"]');
    let vis = await p.evaluate(() => [...document.querySelectorAll('.grupo')].filter((g) => !g.hidden).map((g) => g.dataset.tipo));
    ok(vis.length > 0 && vis.every((t) => t === 'imagem'), `filtro Imagens (${vis.length} grupos)`);
    const est = await p.textContent('#album-estado');
    ok(/^8 imagens/.test(est), `estado: ${est}`);
    // abrir uma imagem e voltar ao mesmo ponto com o filtro mantido
    const alvo = p.locator('.grupo:not([hidden]) .peca').nth(1);
    await alvo.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
    const y0 = await p.evaluate(() => scrollY);
    await alvo.click();
    await p.waitForFunction(() => { const i = document.querySelector('#leitor img'); return i && i.complete && i.naturalWidth > 0; });
    const r = await caixa('#leitor img');
    ok(r && r.x >= 0 && r.x + r.width <= w + 1 && r.y + r.height <= h + 1, 'imagem ampliada inteira no ecrã');
    await p.click('#leitor-fechar'); await p.waitForTimeout(150);
    const fim = await p.evaluate(() => ({ y: scrollY, foco: document.activeElement.className, f: document.querySelector('.filtro[aria-pressed=true]').dataset.filtro }));
    ok(Math.abs(fim.y - y0) < 3 && fim.foco === 'peca' && fim.f === 'imagem', 'fechar mantém filtro, ponto de leitura e foco');

    // Variantes
    await p.click('.filtro[data-filtro="filme"]');
    const variante = p.locator('.grupo:not([hidden]) .variante').first();
    await variante.scrollIntoViewIfNeeded();
    await variante.click();
    await p.waitForSelector('#leitor[open] video');
    ok((await p.textContent('#leitor-titulo')) === 'A descoberta, pelo caminho', 'tocar numa variante abre essa versão');
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);

    // Revelação progressiva: todos os grupos alcançáveis
    await p.click('.filtro[data-filtro="tudo"]');
    while (await p.isVisible('#mais')) { await p.click('#mais'); await p.waitForTimeout(80); }
    const nGrupos = await p.evaluate(() => [...document.querySelectorAll('.grupo')].filter((g) => !g.hidden).length);
    ok(nGrupos === TOTAL_GRUPOS, `«Mostrar mais» revela todos os grupos (${nGrupos})`);

    // Fecho e regresso
    ok(await p.evaluate(() => !/jo[aã]o|m[aá]rcia/i.test(document.body.innerText)), 'nenhum nome pessoal no texto visível');
    await p.click('.voltar');
    const voltou = await p.waitForFunction(() => scrollY < 4, null, { timeout: 4000 }).then(() => true).catch(() => false);
    ok(voltou, '«Voltar ao ribeiro» regressa ao início');
    ok(erros.length === 0, 'sem erros na consola ' + (erros.length ? JSON.stringify(erros.slice(0, 3)) : ''));
    ok(falhados.length === 0, 'todos os pedidos responderam ' + (falhados.length ? JSON.stringify(falhados.slice(0, 3)) : ''));
    await ctx.close();
  }

  // Todo o acervo pelo leitor: cada filme carrega metadados, cada imagem e som carregam
  console.log('\nacervo completo pelo leitor (computador)');
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(url);
    await p.click('.grupo .peca');
    const total = +(await p.textContent('#leitor-contador')).split('/')[1];
    const vistos = new Set(); let maus = [];
    for (let k = 0; k < total; k++) {
      const t = await p.textContent('#leitor-titulo');
      const res = await p.evaluate(() => new Promise((ok) => {
        const v = document.querySelector('#leitor video, #leitor audio'), i = document.querySelector('#leitor img');
        if (v) { if (v.readyState >= 1) ok({ tipo: v.tagName, d: v.duration, tr: v.textTracks.length }); else { v.addEventListener('loadedmetadata', () => ok({ tipo: v.tagName, d: v.duration, tr: v.textTracks.length }), { once: true }); v.addEventListener('error', () => ok({ erro: true }), { once: true }); setTimeout(() => ok({ erro: 'tempo' }), 15000); } }
        else if (i) { if (i.complete && i.naturalWidth) ok({ tipo: 'IMG' }); else { i.onload = () => ok({ tipo: 'IMG' }); i.onerror = () => ok({ erro: true }); } }
        else ok({ erro: 'vazio' });
      }));
      if (res.erro) maus.push(t);
      vistos.add(t);
      if (t === 'A história, com a voz do Tatá') {
        const cues = await p.evaluate(() => new Promise((ok) => { const v = document.querySelector('#leitor video'); const tr = v.textTracks[0]; tr.mode = 'showing'; setTimeout(() => ok(tr.cues ? tr.cues.length : 0), 800); }));
        ok(cues === 6, `legendas da fala carregadas (${cues} deixas)`);
      }
      await p.click('#leitor-seg');
    }
    ok(vistos.size === TOTAL_PECAS && total === TOTAL_PECAS, `${TOTAL_PECAS} peças percorridas no leitor (${vistos.size})`);
    ok(maus.length === 0, 'todas carregam (metadados de vídeo, imagens) ' + (maus.length ? JSON.stringify(maus) : ''));
    await ctx.close();
  }

  // Sem a secção «Som» (telemóvel): filtros, cartão, contagem e navegação
  console.log('\nsem a secção «Som» (telemóvel 390×844)');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(url);
    const filtros = await p.$$eval('.filtro', (bs) => bs.map((x) => x.textContent.trim()));
    ok(filtros.join('|') === 'Tudo|Filmes|Imagens', `filtros: ${filtros.join(', ')}`);
    ok(await p.locator('.contagem').innerText().then((t) => !/som/i.test(t)), `contagem da abertura: ${(await p.locator('.contagem').innerText()).replace(/\s+/g, ' ')}`);
    ok(await p.evaluate(() => !document.querySelector('.peca--som, [data-tipo="som"], a[href$=".m4a"], #onda-som')), 'sem cartão «A voz do Tatá», onda ou ligação à faixa');
    ok(await p.evaluate(() => !/A voz do Tatá|Ouvir ·/.test(document.body.innerText)), 'texto «A voz do Tatá» e «Ouvir» ausentes da página');
    ok(await p.evaluate(() => !JSON.parse(document.getElementById('acervo-dados').textContent).some((x) => x.tipo === 'som' || x.audio)), 'catálogo público sem faixa de som');
    const estado = await p.textContent('#album-estado');
    ok(estado.startsWith(`${TOTAL_PECAS} peças em ${TOTAL_GRUPOS} grupos`), `estado em «Tudo»: ${estado}`);
    const r = await p.request.get(new URL('media/acervo/voz-do-tata.m4a', url).href);
    ok(r.status() === 404, `faixa autónoma não publicada (HTTP ${r.status()})`);
    // percorrer «Tudo» com Seguinte e Anterior: nenhuma faixa de som
    await p.click('.grupo .peca');
    const total = +(await p.textContent('#leitor-contador')).split('/')[1];
    const titulos = [];
    let comAudio = 0;
    for (let k = 0; k < total; k++) { titulos.push(await p.textContent('#leitor-titulo')); comAudio += await p.locator('#leitor audio').count(); await p.click('#leitor-seg'); }
    for (let k = 0; k < 3; k++) await p.click('#leitor-ant');
    ok(total === TOTAL_PECAS && comAudio === 0 && !titulos.includes('A voz do Tatá') && new Set(titulos).size === TOTAL_PECAS, `Anterior/Seguinte em «Tudo»: ${total} peças, nenhuma faixa de som`);
    await p.keyboard.press('Escape');
    // o filme narrado mantém o som, as legendas e o controlo de volume
    const narrado = p.locator('a[aria-label^="Ver o filme «A história, com a voz do Tatá»"]');
    await p.click('.filtro[data-filtro="filme"]');
    while (await p.isVisible('#mais')) await p.click('#mais');
    await narrado.scrollIntoViewIfNeeded(); await narrado.click();
    await p.waitForSelector('#leitor[open] video');
    ok(!(await p.isHidden('#leitor-som')), 'botão de som visível no filme narrado');
    await p.click('#leitor-som');
    await p.waitForFunction(() => { const v = document.querySelector('#leitor video'); return v.currentTime > 1.5; }, null, { timeout: 15000 }).catch(() => {});
    const a = await p.evaluate(() => { const v = document.querySelector('#leitor video'); return { m: v.muted, vol: v.volume, t: v.currentTime, bytes: v.webkitAudioDecodedByteCount, tr: v.textTracks.length && v.textTracks[0].cues ? v.textTracks[0].cues.length : 0 }; });
    ok(!a.m && a.vol > 0 && a.bytes > 0, `som do filme narrado a tocar (áudio descodificado: ${a.bytes} bytes, ${a.t.toFixed(1)} s)`);
    ok(a.tr === 6, `legendas do filme narrado (${a.tr} deixas)`);
    await ctx.close();
  }

  // Ligação móvel simulada
  console.log('\nligação móvel simulada (Fast 3G, 390×844)');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    let bytes = 0; const pedidos = [];
    p.on('requestfinished', async (r) => { pedidos.push(r.url()); try { const s = await r.sizes(); bytes += s.responseBodySize; } catch {} });
    const t0 = Date.now();
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => { const i = document.querySelector('.abertura__ribeiro img'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 });
    const tCena = (Date.now() - t0) / 1000;
    await p.waitForLoadState('load');
    ok(tCena < 6, `cena do ribeiro visível em ${tCena.toFixed(1)} s`);
    ok(!pedidos.some((u) => /\.(mp4|m4a)/.test(u)), `abertura sem vídeos (${(bytes / 1024).toFixed(0)} KB transferidos)`);
    await ctx.close();
  }

  // Movimento reduzido e sem JavaScript
  console.log('\nmovimento reduzido');
  {
    const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage(); await p.goto(url);
    await p.click('#explorar'); await p.waitForTimeout(80);
    ok(Math.abs(await p.evaluate(() => document.getElementById('album').getBoundingClientRect().top)) < 4, 'passagem imediata para o álbum');
    await ctx.close();
  }
  console.log('\nsem JavaScript');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const p = await ctx.newPage(); await p.goto(url);
    const n = await p.evaluate(() => [...document.querySelectorAll('.grupo')].filter((g) => getComputedStyle(g).display !== 'none').length);
    ok(n === TOTAL_GRUPOS, `todos os grupos visíveis sem JavaScript (${n})`);
    ok(await p.getAttribute('.acao--principal', 'href') === 'media/acervo/descoberta.mp4', '«Ver a descoberta» liga ao ficheiro do filme');
    await ctx.close();
  }
  console.log('\nteclado');
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage(); await p.goto(url);
    const ordem = [];
    for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); ordem.push(await p.evaluate(() => document.activeElement.className || document.activeElement.id)); }
    ok(ordem[0].includes('topo__marca') && ordem.some((c) => c.includes('acao--principal')), 'ordem: ' + ordem.join(' → '));
    await p.locator('.grupo .peca').first().focus(); await p.keyboard.press('Enter');
    await p.waitForSelector('#leitor[open]');
    await p.keyboard.press('ArrowRight');
    ok((await p.textContent('#leitor-contador')).startsWith('2 /'), 'seta para a direita avança no leitor');
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    ok(await p.evaluate(() => document.activeElement.classList.contains('peca')), 'foco volta à peça');
    await ctx.close();
  }

  await b.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
  process.exit(falhas ? 1 : 0);
})();
