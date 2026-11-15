/* O universo do Tatá — corrente de luz (fundo animado).
   O reflexo da estrela desfaz-se em pontos: uma corrente azul-violeta entra pela margem inferior
   esquerda da abertura, faz uma curva larga e sobe até junto da estrela, onde aparecem pontos
   dourados. No álbum continua, mais rala, pelas margens; antes do creme de «Do peluche ao
   desenho» dissipa-se. Canvas 2D fixo, acima das cores de fundo e abaixo de imagens, texto e
   controlos. Profundidade simulada por escala, opacidade e velocidade em três planos.
   Um único ciclo de requestAnimationFrame, movimento calculado pelo tempo decorrido. */
(() => {
  const canvas = document.getElementById('corrente');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const raiz = getComputedStyle(document.documentElement);
  const cor = (v, f) => (raiz.getPropertyValue(v).trim() || f);
  const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const mistura = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  const C = {
    onda: hex(cor('--onda', '#5b6aa8')), ceu: hex(cor('--ceu-claro', '#595995')),
    luz: hex(cor('--estrela-luz', '#f7eec6')), estrela: hex(cor('--estrela', '#f2c94c')),
    papel: hex(cor('--papel', '#f4ebdd')), pelo: hex(cor('--pelo', '#dabf9a')),
  };
  // tons por plano (variáveis do projeto, misturadas para ler sobre o azul-noite)
  const TONS = {
    fundo: [C.ceu, C.onda, mistura(C.onda, C.ceu, 0.5)],
    meio: [mistura(C.onda, C.luz, 0.22), mistura(C.onda, C.luz, 0.38), mistura(C.ceu, C.luz, 0.3)],
    frente: [C.papel, C.luz, C.pelo],
    ouro: [C.estrela, mistura(C.estrela, C.luz, 0.4)],
  };

  const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
  const leitor = document.getElementById('leitor');
  const abertura = document.getElementById('inicio');
  const ribeiro = document.querySelector('.abertura__ribeiro img');
  const album = document.getElementById('album');
  const retrato = document.getElementById('tata');

  /* ---------- sprites (pontos suaves e halos), um por cor ---------- */
  const sprites = new Map();
  function sprite(rgb, halo) {
    const k = rgb.join(',') + (halo ? 'h' : '');
    if (sprites.has(k)) return sprites.get(k);
    const s = halo ? 48 : 16, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d'), r = s / 2;
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    if (halo) {
      gr.addColorStop(0, `rgba(${k.replace('h', '')},1)`);
      gr.addColorStop(0.16, `rgba(${k.replace('h', '')},0.9)`);
      gr.addColorStop(0.35, `rgba(${k.replace('h', '')},0.22)`);
      gr.addColorStop(1, `rgba(${k.replace('h', '')},0)`);
    } else {
      gr.addColorStop(0, `rgba(${k},1)`);
      gr.addColorStop(0.55, `rgba(${k},0.85)`);
      gr.addColorStop(1, `rgba(${k},0)`);
    }
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    sprites.set(k, c);
    return c;
  }

  /* ---------- caminhos em coordenadas da página ---------- */
  // cada caminho é uma tabela de pontos com posição, normal e largura, parametrizada por comprimento
  function tabela(fn, n, largura) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(fn(i / n));
    const acum = [0];
    for (let i = 1; i <= n; i++) acum.push(acum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = acum[n] || 1;
    const out = [];
    let j = 0;
    for (let i = 0; i <= n; i++) {
      const alvo = (i / n) * total;
      while (j < n - 1 && acum[j + 1] < alvo) j++;
      const t = (alvo - acum[j]) / ((acum[j + 1] - acum[j]) || 1);
      const a = pts[j], b = pts[j + 1];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      out.push({ x: a.x + dx * t, y: a.y + dy * t, nx: -dy / d, ny: dx / d, w: largura(i / n) });
    }
    return out;
  }
  // Catmull-Rom pelos pontos de passagem
  const spline = (P) => (t) => {
    const n = P.length - 1, f = Math.min(n - 1e-6, t * n), i = Math.floor(f), u = f - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)];
    const c = (a, b, c2, d) => 0.5 * ((2 * b) + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u * u + (-a + 3 * b - 3 * c2 + d) * u * u * u);
    return { x: c(p0[0], p1[0], p2[0], p3[0]), y: c(p0[1], p1[1], p2[1], p3[1]) };
  };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  let W = 0, H = 0, dpr = 1, caminhos = [], limiteCreme = Infinity, estrela = null;

  function medir() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    const telemovel = Math.min(innerWidth, innerHeight) < 700;
    dpr = Math.min(devicePixelRatio || 1, telemovel ? 1.25 : 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);

    const sy = scrollY;
    const ab = abertura.getBoundingClientRect(), im = ribeiro.getBoundingClientRect();
    const al = album.getBoundingClientRect(), rt = retrato.getBoundingClientRect();
    const fundoAb = ab.bottom + sy, base = Math.min(innerWidth, innerHeight);
    const deitado = innerWidth >= 760 && innerWidth > innerHeight;
    // a estrela está pousada no musgo a 84 % da largura e 58 % da altura da cena
    estrela = { x: im.left + im.width * 0.84, y: im.top + sy + im.height * 0.585 };
    limiteCreme = rt.top + sy + 70;

    const det = document.querySelector('.abertura__detalhes').getBoundingClientRect();
    const cont = document.querySelector('.contagem').getBoundingClientRect();
    const Y = (v) => v + sy;
    let pts;
    if (deitado) {
      // dupla página: entra no canto inferior esquerdo, sobe pela coluna vazia sob o texto e corre
      // junto à base da cena até por baixo da estrela
      // em ecrãs baixos (telemóvel deitado) a entrada desce para não atravessar a contagem
      const yb = innerHeight < 500 ? Math.min(fundoAb - 10, sy + innerHeight - 8) : Math.min(fundoAb - 30, sy + innerHeight - 40);
      const xs = im.left - Math.max(16, (im.left - cont.right) * 0.35);
      pts = [[-0.05 * W, yb + 30], [0.06 * W, yb - (innerHeight < 500 ? 2 : 10)], [0.2 * W, yb - (innerHeight < 500 ? 0.015 : 0.06) * H], [xs - 0.06 * W, Y(im.bottom) + 0.12 * H],
             [xs, Y(im.bottom) + 10], [im.left + im.width * 0.4, Y(im.bottom) + 11], [estrela.x, Y(im.bottom) + 9]];
    } else {
      // vertical: entra pela margem esquerda no intervalo entre a contagem e os detalhes e sobe,
      // à direita das ações, até por baixo da estrela
      const gap = Y((cont.bottom + det.top) / 2);
      pts = [[-0.08 * W, gap + 14], [0.22 * W, gap + 6], [0.52 * W, gap], [0.78 * W, gap - 0.22 * (gap - Y(im.bottom))],
             [0.9 * W, Y(im.bottom) + 0.45 * (gap - Y(im.bottom))], [estrela.x + 0.02 * W, Y(im.bottom) + 18], [estrela.x, Y(im.bottom) + 8]];
    }
    const larg = base * (deitado ? 0.06 : 0.055);
    caminhos = [
      tabela(spline(pts), 260, (s) => larg * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, s * 1.1))) * (1 - 0.6 * smooth(0.7, 1, s))),
    ];
    // álbum: a corrente continua pelas duas margens, mais rala, até ao creme
    const topoAl = al.top + sy - 20, fimAl = rt.top + sy + 60, g = Math.max(10, Math.min(W * 0.06, 70));
    const margemPath = (x0, fase) => (t) => ({ x: x0 + Math.sin(t * 9 + fase) * g * 0.28, y: topoAl + (fimAl - topoAl) * t });
    caminhos.push(tabela(margemPath(g * 0.5, 0), 260, () => g * 0.35));
    caminhos.push(tabela(margemPath(W - g * 0.5, 2), 260, () => g * 0.35));
  }

  /* ---------- partículas ---------- */
  let parts = [], qualidade = 2; // 2: tudo; 1: sem halos; 0: menos pontos
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function criar() {
    parts = [];
    const area = innerWidth * innerHeight;
    let n = Math.round(Math.min(950, Math.max(260, area / 1500)));
    if (qualidade === 0) n = Math.round(n * 0.6);
    // plano intermédio: filamentos descontínuos — grupos que viajam juntos com intervalos vazios entre si
    const fil = 7, grupos = [];
    for (let f = 0; f < fil; f++) {
      const off = (f / (fil - 1)) * 2 - 1;
      let s = Math.random() * 0.2;
      while (s < 1) { const comp = rnd(0.05, 0.13); grupos.push({ f, off: off * rnd(0.75, 1), s, comp }); s += comp + rnd(0.04, 0.12); }
    }
    const nMeio = Math.round(n * 0.6), nFundo = Math.round(n * 0.3), nFrente = Math.max(14, Math.min(42, Math.round(n * 0.07)));
    for (let i = 0; i < nMeio; i++) {
      const gr = grupos[i % grupos.length];
      parts.push({ c: 0, plano: 1, s: (gr.s + Math.random() * gr.comp) % 1, off: gr.off + rnd(-0.08, 0.08),
        v: rnd(0.0105, 0.0125) * (1 + gr.f * 0.015), r: rnd(1.1, 2.1), a: rnd(0.6, 1), fase: rnd(0, 6.28), tom: pick(TONS.meio), ouro: false });
    }
    for (let i = 0; i < nFundo; i++) {
      parts.push({ c: 0, plano: 0, s: Math.random(), off: rnd(-2.2, 2.2), v: rnd(0.004, 0.0065), r: rnd(0.7, 1.2),
        a: rnd(0.3, 0.55), fase: rnd(0, 6.28), tom: pick(TONS.fundo), ouro: false });
    }
    for (let i = 0; i < nFrente; i++) {
      const s = Math.random() < 0.55 ? rnd(0.62, 1) : Math.random();
      parts.push({ c: 0, plano: 2, s, off: rnd(-0.9, 0.9), v: rnd(0.014, 0.019), r: rnd(1.6, 2.6), a: rnd(0.6, 0.95),
        fase: rnd(0, 6.28), tom: pick(TONS.frente), ouro: false });
    }
    // alguns pontos de ouro no plano intermédio, mais intensos junto da estrela
    for (let i = 0; i < Math.round(n * 0.05); i++) {
      parts.push({ c: 0, plano: 1, s: rnd(0.72, 1), off: rnd(-0.5, 0.5), v: rnd(0.011, 0.013), r: rnd(1, 1.6), a: rnd(0.6, 0.95),
        fase: rnd(0, 6.28), tom: pick(TONS.ouro), ouro: true });
    }
    canvas.dataset.planos = [0, 1, 2].map((k) => parts.filter((p) => p.plano === k).length).join(',');
    // margens do álbum: poucos pontos, sobretudo do fundo e intermédios
    const nMarg = Math.round(n * 0.3);
    for (let i = 0; i < nMarg; i++) {
      const plano = Math.random() < 0.55 ? 0 : 1;
      parts.push({ c: 1 + (i % 2), plano, s: Math.random(), off: rnd(-1, 1), v: plano ? rnd(0.006, 0.008) : rnd(0.003, 0.0045),
        r: plano ? rnd(1, 1.7) : rnd(0.7, 1.1), a: plano ? rnd(0.5, 0.85) : rnd(0.3, 0.55), fase: rnd(0, 6.28),
        tom: pick(plano ? TONS.meio : TONS.fundo), ouro: false });
    }
  }

  /* ---------- desenho ---------- */
  function desenhar(t) {
    const sy = scrollY;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const resp = 1 + 0.1 * Math.sin(t * 0.45); // a onda respira devagar
    for (const p of parts) {
      const tab = caminhos[p.c]; if (!tab) continue;
      const i = Math.min(tab.length - 1, Math.round(p.s * (tab.length - 1)));
      const q = tab[i];
      const onda = Math.sin(t * (0.5 + p.plano * 0.12) + p.fase + p.s * 9) * (2 + p.plano * 2.5);
      const lado = p.off * q.w * resp * (p.plano === 0 ? 1.25 : 1) + onda;
      const x = q.x + q.nx * lado, yPag = q.y + q.ny * lado, y = yPag - sy;
      if (y < -20 || y > H + 20 || x < -20 || x > W + 20) continue;
      // envelope: entra e sai devagar nas pontas; dissipa-se antes do creme
      let a = p.a * smooth(0, 0.07, p.s) * (1 - smooth(0.94, 1, p.s));
      a *= 1 - smooth(limiteCreme - 260, limiteCreme, yPag);
      if (p.c === 0 && !p.ouro && p.plano < 2) a *= 1 - 0.35 * smooth(0.85, 1, p.s); // o azul cede o lugar ao ouro
      if (a < 0.02) continue;
      let tom = p.tom;
      // em frente, os pontos aquecem para dourado ao aproximar-se da estrela
      if (p.c === 0 && p.plano === 2 && p.s > 0.78) tom = TONS.ouro[0];
      const pisca = 0.85 + 0.15 * Math.sin(t * 1.3 + p.fase * 3);
      ctx.globalAlpha = Math.min(1, a * pisca);
      if (p.plano === 2 && qualidade === 2) {
        const sz = p.r * 9; ctx.drawImage(sprite(tom, true), x - sz / 2, y - sz / 2, sz, sz);
      } else {
        const sz = p.r * (p.plano === 2 ? 3 : 2.6) * (p.ouro ? 1.2 : 1);
        ctx.drawImage(sprite(tom, false), x - sz / 2, y - sz / 2, sz, sz);
      }
    }
    // brilho dourado junto da estrela, o ponto mais intenso da corrente
    if (estrela) {
      const ey = (caminhos[0][caminhos[0].length - 1].y) - sy, ex = caminhos[0][caminhos[0].length - 1].x;
      if (ey > -80 && ey < H + 80) {
        ctx.globalAlpha = 0.5 + 0.08 * Math.sin(t * 0.8);
        const sz = Math.min(W, H) * 0.16;
        ctx.drawImage(sprite(TONS.ouro[1], true), ex - sz / 2, ey - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }

  function avancar(dt) {
    for (const p of parts) { p.s += p.v * dt; if (p.s > 1) p.s -= 1; }
  }

  /* ---------- ciclo ---------- */
  let raf = 0, ultimo = 0, relogio = rnd(0, 100), medias = [], pausado = false;
  const estado = (e) => { canvas.dataset.estado = e; };

  function frame(agora) {
    raf = 0;
    const dt = Math.min(0.05, (agora - ultimo) / 1000); // sem saltos depois de pausas
    ultimo = agora;
    relogio += dt;
    avancar(dt);
    desenhar(relogio);
    // desempenho: primeiro tira os halos, depois reduz pontos
    medias.push(dt); if (medias.length > 45) medias.shift();
    if (medias.length === 45) {
      const m = medias.reduce((a, b) => a + b, 0) / 45;
      if (m > 0.024 && qualidade > 0) { qualidade--; if (qualidade === 0) criar(); medias = []; canvas.dataset.qualidade = qualidade; }
    }
    seguir();
  }
  const bloqueado = () => pausado || reduzido.matches || document.hidden || (leitor && leitor.open);
  function seguir() {
    if (bloqueado()) { estado(reduzido.matches ? 'estatico' : 'parado'); return; }
    raf = requestAnimationFrame(frame);
  }
  function pedir() { // (re)arranque: o relógio recomeça no fotograma seguinte, sem saltos
    if (raf) return;
    if (bloqueado()) { estado(reduzido.matches ? 'estatico' : 'parado'); return; }
    estado('a-animar');
    raf = requestAnimationFrame((t) => { ultimo = t - 16; frame(t); });
  }
  function parar() { if (raf) cancelAnimationFrame(raf); raf = 0; estado(reduzido.matches ? 'estatico' : 'parado'); }

  function arrancar() {
    medir(); criar();
    desenhar(relogio); // composição completa logo no primeiro fotograma
    pedir();
  }

  // composição estática com movimento reduzido: redesenha só ao deslocar a página
  addEventListener('scroll', () => { if (reduzido.matches || (leitor && leitor.open)) desenhar(relogio); }, { passive: true });
  let tmr = 0;
  const remedir = () => { clearTimeout(tmr); tmr = setTimeout(() => { medir(); desenhar(relogio); }, 120); };
  addEventListener('resize', remedir);
  if ('ResizeObserver' in window) new ResizeObserver(remedir).observe(document.body);
  document.fonts && document.fonts.ready.then(remedir);
  addEventListener('load', remedir);
  document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); else pedir(); });
  reduzido.addEventListener?.('change', () => { if (reduzido.matches) { parar(); desenhar(relogio); } else pedir(); });
  // filme aberto ou imagem ampliada: o fundo deixa de animar
  if (leitor) {
    new MutationObserver(() => { if (leitor.open) parar(); else pedir(); }).observe(leitor, { attributes: true, attributeFilter: ['open'] });
  }

  arrancar(); // a cena tem largura e altura reservadas, por isso o desenho do caminho não espera pela imagem
})();
