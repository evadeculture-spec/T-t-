// Percorre a visita do primeiro ao último plano. Uso: node tests/percurso.cjs [url]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:8080/';
let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) falhas++; };

(async () => {
  const b = await chromium.launch();

  for (const [w, h, nome, toque] of [[390, 844, 'telefone', true], [1180, 820, 'ipad-horizontal', true], [1440, 900, 'computador', false]]) {
    console.log(`\n${nome} ${w}×${h}`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: toque, isMobile: w < 500 });
    const p = await ctx.newPage();
    const pedidos = [], erros = [], falhados = [];
    p.on('request', (r) => pedidos.push(r.url()));
    p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    p.on('pageerror', (e) => erros.push(String(e)));
    p.on('response', (r) => { if (r.status() >= 400) falhados.push(r.status() + ' ' + r.url()); });
    await p.goto(url, { waitUntil: 'load' });

    // primeiro ecrã: cena, título e convite visíveis sem vídeo
    const caixa = async (sel) => p.locator(sel).first().boundingBox();
    const cena = await caixa('#cena img'), fol = await caixa('#folhear'), tit = await caixa('#titulo');
    ok(cena && cena.y + cena.height <= h + 1, 'a cena inteira cabe no primeiro ecrã');
    ok(fol && fol.y + fol.height <= h, '«Folhear» visível no primeiro ecrã');
    ok(tit && tit.y + tit.height <= h, 'título visível no primeiro ecrã');
    ok(!pedidos.some((u) => u.endsWith('.mp4')), 'nenhum vídeo pedido antes do toque');
    ok(await p.evaluate(() => { const i = document.querySelector('#cena img'); return i.complete && i.naturalWidth > 0; }), 'imagem da cena carregada');

    // áreas táteis
    const pequenos = await p.evaluate(() => [...document.querySelectorAll('a, button')].filter((e) => {
      if (e.closest('dialog')) return false; const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44;
    }).map((e) => e.textContent.trim() || e.getAttribute('aria-label')));
    ok(pequenos.length === 0, 'controlos com pelo menos 44×44 px ' + (pequenos.length ? JSON.stringify(pequenos) : ''));

    // Ver a descoberta
    await p.click('#ver');
    await p.waitForSelector('#cena video');
    await p.waitForTimeout(1500);
    const v = await p.evaluate(() => { const v = document.querySelector('#cena video'); return { t: v.currentTime, c: v.controls, err: v.error && v.error.code, dur: v.duration }; });
    ok(v.c, 'vídeo com comandos nativos (pausa, som)');
    ok(!v.err && v.dur > 7.5, `vídeo carregado (${(v.dur || 0).toFixed(1)} s)`);
    ok(v.t > 0.3, `vídeo a tocar após o toque (t=${v.t.toFixed(2)} s)`);
    await p.click('#ver');
    ok(await p.locator('#cena video').count() === 0, '«Voltar à imagem» devolve a cena');

    // Folhear
    await p.click('#folhear');
    await p.waitForTimeout(80);
    ok(await p.evaluate(() => document.querySelector('.vinheta-ondas').classList.contains('brilha')), 'reflexo dourado ativado na ondulação');
    await p.waitForTimeout(1500);
    const topo = await p.evaluate(() => document.getElementById('tata').getBoundingClientRect().top);
    ok(Math.abs(topo) < 4, `a leitura passa para o retrato (topo=${topo.toFixed(0)})`);
    ok(await p.evaluate(() => location.hash === '#tata' && document.activeElement.id === 'tata'), 'âncora #tata e foco no retrato');

    // Álbum: ampliar, Escape, Fechar, regresso ao ponto de leitura
    const botoes = await p.locator('.peca__botao').count();
    ok(botoes === 4, `${botoes} peças no álbum`);
    for (let i = 0; i < botoes; i++) {
      const bt = p.locator('.peca__botao').nth(i);
      await bt.scrollIntoViewIfNeeded();
      await p.waitForTimeout(200);
      const y0 = await p.evaluate(() => scrollY);
      await bt.click();
      await p.waitForFunction(() => { const i = document.getElementById('ampliar-img'); return i.complete && i.naturalWidth > 0; });
      const est = await p.evaluate(() => ({ aberto: document.getElementById('ampliar').open, foco: document.activeElement.id, leg: document.getElementById('ampliar-legenda').textContent, alt: document.getElementById('ampliar-img').alt }));
      ok(est.aberto && est.foco === 'ampliar-fechar' && est.alt, `peça ${i + 1} ampliada, foco em «Fechar» — ${est.leg}`);
      const r = await caixa('#ampliar-img');
      ok(r && r.width <= w && r.y + r.height <= h, 'imagem ampliada inteira no ecrã');
      if (i % 2 === 0) await p.keyboard.press('Escape'); else await p.click('#ampliar-fechar');
      await p.waitForTimeout(150);
      const fim = await p.evaluate(() => ({ aberto: document.getElementById('ampliar').open, y: scrollY, foco: document.activeElement.className }));
      ok(!fim.aberto && fim.foco === 'peca__botao' && Math.abs(fim.y - y0) < 2, `${i % 2 === 0 ? 'Escape' : '«Fechar»'} fecha e devolve o foco à miniatura no mesmo ponto`);
    }

    // Fecho
    const fecho = await p.evaluate(() => { const i = document.querySelector('.fecho img'); i.scrollIntoView(); return true; });
    await p.waitForTimeout(400);
    ok(await p.evaluate(() => { const i = document.querySelector('.fecho img'); return i.complete && i.naturalWidth > 0; }), 'imagem de fecho carregada');
    ok(await p.locator('.assinatura').textContent() === 'Tatá · João e Márcia', 'assinatura «Tatá · João e Márcia»');
    await p.click('.voltar');
    await p.waitForTimeout(1500);
    ok(await p.evaluate(() => scrollY < 4 && location.hash === '#ribeiro'), '«Voltar ao ribeiro» regressa ao início');

    ok(erros.length === 0, 'sem erros na consola ' + (erros.length ? JSON.stringify(erros) : ''));
    ok(falhados.length === 0, 'todos os pedidos responderam ' + (falhados.length ? JSON.stringify(falhados) : ''));
    await ctx.close();
  }

  // Movimento reduzido: passagem imediata
  console.log('\nmovimento reduzido');
  const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.click('#folhear');
  await p.waitForTimeout(60);
  const topo = await p.evaluate(() => document.getElementById('tata').getBoundingClientRect().top);
  ok(Math.abs(topo) < 4, `passagem imediata para o retrato (topo=${topo.toFixed(0)})`);
  await ctx.close();

  // Sem JavaScript: âncoras funcionam
  console.log('\nsem JavaScript');
  const c2 = await b.newContext({ viewport: { width: 820, height: 1180 }, javaScriptEnabled: false });
  const q = await c2.newPage();
  await q.goto(url);
  await q.click('#folhear');
  await q.waitForTimeout(800);
  ok(await q.evaluate(() => Math.abs(document.getElementById('tata').getBoundingClientRect().top) < 4), '«Folhear» é uma âncora funcional');
  ok(await q.getAttribute('#ver', 'href') === 'media/a-descoberta.mp4', '«Ver a descoberta» aponta para o ficheiro do clipe');
  await c2.close();

  // Teclado: ordem de tabulação até ao álbum
  console.log('\nteclado');
  const c3 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const k = await c3.newPage();
  await k.goto(url);
  const ordem = [];
  for (let i = 0; i < 9; i++) { await k.keyboard.press('Tab'); ordem.push(await k.evaluate(() => document.activeElement.id || document.activeElement.className)); }
  ok(ordem.slice(0, 2).join() === 'folhear,ver' && ordem.filter((x) => x === 'peca__botao').length === 4 && ordem.includes('voltar'), 'ordem: ' + ordem.join(' → '));
  await c3.close();

  await b.close();
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
  process.exit(falhas ? 1 : 0);
})();
