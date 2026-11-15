/* O universo do Tatá — corrente de luz (fundo contínuo da apresentação).
   Poeira finíssima suspensa junto ao ribeiro, iluminada pela estrela ao crepúsculo. Uma só corrente
   desce do título até à última imagem: atravessa cada intervalo livre entre linhas de conteúdo,
   desce pelas margens ou pelos intervalos entre colunas e volta a aparecer do outro lado.
   Profundidade de campo: grãos nítidos no plano focal (centro pequeno e contorno suave), fundo
   pequeno e de baixo contraste, primeiro plano ocasional maior e desfocado. Sobre o creme, a luz
   azulada passa a poeira âmbar.
   Uma superfície de desenho fixa com as dimensões da área visível, entre as cores de fundo das
   secções e o conteúdo. Um único ciclo de requestAnimationFrame, movimento pelo tempo decorrido. */
(() => {
  const canvas = document.getElementById('corrente');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const raiz = getComputedStyle(document.documentElement);
  const hex = (v, f) => { const h = (raiz.getPropertyValue(v).trim() || f).replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  const COR = {
    onda: hex('--onda', '#5b6aa8'), ceu: hex('--ceu-claro', '#595995'), luz: hex('--estrela-luz', '#f7eec6'),
    estrela: hex('--estrela', '#f2c94c'), luna: hex('--luna', '#d16b20'), estudio: hex('--estudio', '#bc9a74'),
    linha: hex('--linha', '#a9835c'),
  };
  // paleta em degraus: do azul-violeta (sobre o azul-noite) à poeira âmbar (sobre o creme)
  const AZUL = mix(mix(COR.onda, COR.luz, 0.3), COR.ceu, 0.2);
  const AMBAR = mix(mix(COR.luna, COR.linha, 0.45), COR.estrela, 0.15);
  const DEGRAUS = 8;
  const TONS = Array.from({ length: DEGRAUS }, (_, i) => mix(AZUL, AMBAR, i / (DEGRAUS - 1)));
  const OURO = [COR.estrela, mix(COR.estrela, COR.luna, 0.35)];
  const OURO_CREME = mix(OURO[1], COR.luna, 0.3);
  // índices de tom: 0..7 degraus azul→âmbar, 8 e 9 ouro, 10 ouro sobre o creme
  const PALETA = [...TONS, OURO[0], OURO[1], OURO_CREME];

  const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
  const leitor = document.getElementById('leitor');
  const retrato = document.getElementById('tata');

  /* ---------- ruído contínuo de baixa frequência (somas de senos incomensuráveis) ---------- */
  const r1 = (x) => (Math.sin(x * 1.0) * 0.5 + Math.sin(x * 2.17 + 1.3) * 0.3 + Math.sin(x * 4.31 + 4.1) * 0.2);
  const r2 = (x, y) => (Math.sin(x * 1.1 + y * 0.7) * 0.45 + Math.sin(x * 0.53 - y * 1.31 + 2.1) * 0.35 + Math.sin(x * 2.3 + y * 1.9 + 0.7) * 0.2);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let semente = 7;
  const rnd = (a = 0, b = 1) => { semente = (semente * 16807) % 2147483647; return a + (semente / 2147483647) * (b - a); };

  /* ---------- sprites: 4 níveis de desfocagem por tom ---------- */
  const sprites = new Map();
  function sprite(rgb, nivel) {
    const k = rgb.join(',') + '|' + nivel;
    let c = sprites.get(k);
    if (c) return c;
    const S = 64, r = S / 2; c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    const nuc = mix(rgb, [255, 250, 235], 0.55).join(','), cor = rgb.join(',');
    if (nivel === 0) {        // plano focal: centro pequeno e luminoso, contorno suave
      gr.addColorStop(0, `rgba(${nuc},1)`); gr.addColorStop(0.18, `rgba(${nuc},0.95)`);
      gr.addColorStop(0.32, `rgba(${cor},0.55)`); gr.addColorStop(0.6, `rgba(${cor},0.12)`); gr.addColorStop(1, `rgba(${cor},0)`);
    } else if (nivel === 1) { // ligeiramente fora de foco
      gr.addColorStop(0, `rgba(${nuc},0.8)`); gr.addColorStop(0.3, `rgba(${cor},0.55)`); gr.addColorStop(0.7, `rgba(${cor},0.12)`); gr.addColorStop(1, `rgba(${cor},0)`);
    } else if (nivel === 2) { // desfocado
      gr.addColorStop(0, `rgba(${cor},0.55)`); gr.addColorStop(0.55, `rgba(${cor},0.38)`); gr.addColorStop(0.85, `rgba(${cor},0.12)`); gr.addColorStop(1, `rgba(${cor},0)`);
    } else {                  // primeiro plano: disco desfocado com orla ténue
      gr.addColorStop(0, `rgba(${cor},0.28)`); gr.addColorStop(0.7, `rgba(${cor},0.32)`); gr.addColorStop(0.82, `rgba(${cor},0.4)`);
      gr.addColorStop(0.9, `rgba(${cor},0.14)`); gr.addColorStop(1, `rgba(${cor},0)`);
    }
    g.fillStyle = gr; g.fillRect(0, 0, S, S); sprites.set(k, c);
    return c;
  }

  let SPR = null;
  const sprites4 = () => (SPR = SPR || PALETA.map((rgb) => [0, 1, 2, 3].map((n) => sprite(rgb, n))));

  /* ---------- percurso: composto a partir dos espaços livres da página ---------- */
  const CONTEUDO = ['.abertura .titulo', '.abertura__frase', '.abertura__ribeiro', '.acoes', '.contagem', '.detalhe',
    '.album__cabeca', '.album__estado', '.grupo:not([hidden]) > *', '.album__mais', '.retrato__titulo', '.par__peluche',
    '.par__desenho', '.retrato__legenda', '.fecho__imagem', '.assinatura', '.voltar'];
  const TEXTO = ['.abertura .titulo', '.abertura__frase', '.acoes a', '.contagem', '.detalhe figcaption', '.album__titulo',
    '.filtro', '.album__estado', '.grupo__texto', '.mais:not([hidden])', '.retrato__titulo', '.retrato__legenda', '.assinatura', '.voltar'];

  const PASSO = 4; // espaçamento fixo da tabela (px): troços iguais dão pontos iguais
  function tabela(pts) {
    // cada troço é amostrado pelo seu próprio comprimento, independentemente do resto do percurso
    const bruto = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const P0 = pts[Math.max(0, i - 1)], P1 = pts[i], P2 = pts[i + 1], P3 = pts[Math.min(pts.length - 1, i + 2)];
      const k = Math.max(4, Math.ceil(Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) / 2));
      for (let j = 1; j <= k; j++) {
        const u = j / k, c = (a, b2, c2, d) => 0.5 * (2 * b2 + (-a + c2) * u + (2 * a - 5 * b2 + 4 * c2 - d) * u * u + (-a + 3 * b2 - 3 * c2 + d) * u * u * u);
        bruto.push([c(P0[0], P1[0], P2[0], P3[0]), c(P0[1], P1[1], P2[1], P3[1])]);
      }
    }
    const acum = [0];
    for (let i = 1; i < bruto.length; i++) acum.push(acum[i - 1] + Math.hypot(bruto[i][0] - bruto[i - 1][0], bruto[i][1] - bruto[i - 1][1]));
    const total = acum[acum.length - 1], m = Math.floor(total / PASSO), L = m * PASSO;
    const x = new Float32Array(m + 1), y = new Float32Array(m + 1), nx = new Float32Array(m + 1), ny = new Float32Array(m + 1);
    let j = 0;
    for (let i = 0; i <= m; i++) {
      const alvo = i * PASSO;
      while (j < bruto.length - 2 && acum[j + 1] < alvo) j++;
      const t = (alvo - acum[j]) / ((acum[j + 1] - acum[j]) || 1), a = bruto[j], b2 = bruto[j + 1];
      x[i] = a[0] + (b2[0] - a[0]) * t; y[i] = a[1] + (b2[1] - a[1]) * t;
      const dx = b2[0] - a[0], dy = b2[1] - a[1], d = Math.hypot(dx, dy) || 1;
      nx[i] = -dy / d; ny[i] = dx / d;
    }
    const zona = new Float32Array(m + 1);
    for (let i = 0; i <= m; i++) zona[i] = 0.5 + 0.5 * r1((i * PASSO) / 520 + 1.7);
    return { x, y, nx, ny, zona, m, L };
  }

  const pagina = (el) => { const r = el.getBoundingClientRect(); return r.width && r.height ? { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY } : null; };

  function compor() {
    semente = 3; // a mesma página dá sempre o mesmo percurso: acima de uma mudança nada se altera
    const W = innerWidth;
    const blocos = CONTEUDO.flatMap((s) => [...document.querySelectorAll(s)].map(pagina)).filter(Boolean).sort((a, b) => a.t - b.t);
    // linhas: blocos que se sobrepõem na vertical
    const linhas = [];
    for (const k of blocos) {
      const u = linhas[linhas.length - 1];
      if (u && k.t < u.b - 4) { u.b = Math.max(u.b, k.b); u.itens.push(k); } else linhas.push({ t: k.t, b: k.b, itens: [k] });
    }
    // canais livres em cada linha (margens e intervalos entre colunas)
    const canais = (ln) => {
      const iv = ln.itens.map((k) => [Math.max(0, k.l), Math.min(W, k.r)]).sort((a, b) => a[0] - b[0]);
      const livres = []; let x = 0;
      for (const [a, b] of iv) { if (a - x > 6) livres.push([x, a]); x = Math.max(x, b); }
      if (W - x > 6) livres.push([x, W]);
      return livres.length ? livres : [[0, 10], [W - 10, W]];
    };
    const pts = [];
    const titulo = document.querySelector('.abertura .titulo');
    const t0 = pagina(titulo) || { t: 80, b: 140, l: 0, r: W };
    pts.push([-0.08 * W, t0.t - 10], [Math.max(8, t0.l * 0.5), (t0.t + t0.b) / 2]);
    let lado = 0;
    for (let i = 0; i < linhas.length; i++) {
      const ln = linhas[i], liv = canais(ln);
      // alterna esquerda / direita e, quando há, usa um intervalo entre colunas
      let escolha;
      const interiores = liv.filter(([a, b]) => a > 4 && b < W - 4 && b - a >= 12);
      if (interiores.length && i % 3 === 2) escolha = interiores[Math.floor(rnd(0, interiores.length))];
      else escolha = lado === 0 ? liv[0] : liv[liv.length - 1];
      const cx = (escolha[0] + escolha[1]) / 2 + (escolha[1] - escolha[0]) * rnd(-0.15, 0.15);
      pts.push([cx, ln.t + Math.min(30, (ln.b - ln.t) * 0.2)]);
      if (ln.b - ln.t > 160) pts.push([cx + rnd(-6, 6), (ln.t + ln.b) / 2]);
      pts.push([cx, ln.b - Math.min(30, (ln.b - ln.t) * 0.2)]);
      // no intervalo até à linha seguinte, a corrente atravessa de um lado ao outro numa curva larga e assimétrica
      const prox = linhas[i + 1];
      if (prox) {
        const gy = (ln.b + prox.t) / 2, gh = Math.max(8, prox.t - ln.b);
        lado = 1 - lado;
        const alvoX = lado === 0 ? W * rnd(0.04, 0.2) : W * rnd(0.8, 0.96);
        pts.push([cx + (alvoX - cx) * rnd(0.3, 0.45), gy + gh * rnd(-0.15, 0.15)]);
        pts.push([cx + (alvoX - cx) * rnd(0.62, 0.8), gy + gh * rnd(-0.12, 0.12)]);
      }
    }
    const ult = linhas[linhas.length - 1] || { b: document.documentElement.scrollHeight };
    pts.push([W * 0.6, ult.b + 30], [W * 1.08, ult.b + 60]);
    return tabela(pts);
  }

  /* ---------- partículas ---------- */
  let W = 0, H = 0, dpr = 1, cam = null, antigo = null, trans = 1, textos = [], cremeIni = Infinity, cremeFim = Infinity;
  let parts = [], qualidade = 3; // 3: tudo · 2: menos halos e grãos desfocados · 1: sem primeiro plano, fundo mais ralo · 0: desenha a 30 fps

  function medirTextos() {
    textos = TEXTO.flatMap((s) => [...document.querySelectorAll(s)].map(pagina)).filter(Boolean);
    const rt = pagina(retrato);
    if (rt) { cremeIni = rt.t + 10; cremeFim = rt.t + 110; }
  }

  const densidade = () => (innerWidth < 700 ? 0.44 : innerWidth < 1100 ? 0.55 : 0.6);
  const alvo = () => Math.round(Math.min(11000, Math.max(900, cam.L * densidade())));
  function nova(d, nasce) {
    const q = rnd();
    const z = q < 0.28 ? rnd(0.02, 0.3) : q < 0.92 ? rnd(0.38, 0.62) : rnd(0.7, 1);
    return { d, z, off: (rnd() + rnd() + rnd() - 1.5) / 1.5, fase: rnd(0, 6.283), v: (9 + 16 * z) * rnd(0.85, 1.15),
             ouro: z > 0.35 && z < 0.66 && rnd() < 0.055, k: rnd(), nasce };
  }
  function ajustarQuantidade(d0 = 0) {
    // percurso mais longo (ex.: «Mostrar mais»): os grãos em falta aparecem devagar no troço que mudou
    const n = alvo();
    for (let i = parts.length; i < n; i++) { const q = nova(rnd(Math.min(d0, cam.L - 1), cam.L), 0); q.da = q.d; parts.push(q); }
    if (parts.length > n * 1.25) parts.length = n; // percurso muito mais curto: liberta os que sobram
    anotar();
  }
  function anotar() {
    canvas.dataset.planos = [parts.filter((p) => p.z < 0.33).length, parts.filter((p) => p.z >= 0.33 && p.z < 0.68).length, parts.filter((p) => p.z >= 0.68).length].join(',');
    canvas.dataset.comprimento = Math.round(cam.L);
  }
  function criar() {
    semente = 11;
    const n = alvo();
    parts = [];
    for (let i = 0; i < n; i++) parts.push(nova(rnd(0, cam.L), 1));
    anotar();
  }
  function medir(manter) {
    W = innerWidth; H = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const novo = compor();
    medirTextos();
    // cada partícula está ancorada pela distância (px) desde o início do percurso: o que fica acima de
    // uma mudança mantém exatamente a posição; o que mudou desliza numa transição curta
    if (manter && cam && parts.length) {
      // ponto a partir do qual o percurso mudou; abaixo dele as partículas redistribuem-se na mesma proporção
      const d0 = divergencia(cam, novo);
      const ka = trans < 1 ? 0 : 1;
      for (const p of parts) {
        p.da = ka ? p.d : (p.da ?? p.d);
        if (p.d > d0 && cam.L > d0 + 1) p.d = d0 + ((p.d - d0) * (novo.L - d0)) / (cam.L - d0);
        else if (p.d > novo.L) p.d = p.d % novo.L;
      }
      antigo = cam; trans = d0 >= Math.min(cam.L, novo.L) - 1 ? 1 : 0;
      cam = novo;
      ajustarQuantidade(d0);
    } else {
      cam = novo;
      criar();
    }
  }

  function divergencia(a, b) {
    const L = Math.min(a.L, b.L);
    for (let d = 0; d <= L; d += 6) {
      const ia = Math.round(d / PASSO), ib = ia;
      if (Math.abs(a.x[ia] - b.x[ib]) > 1.5 || Math.abs(a.y[ia] - b.y[ib]) > 1.5) return Math.max(0, d - 6);
    }
    return L;
  }

  const posicao = (c, p, t, out, dd) => {
    const d = Math.min(dd ?? p.d, c.L);
    const i = Math.min(c.m, Math.max(0, Math.round(d / PASSO)));
    // a corrente aproxima-se (grãos espalhados) e afasta-se (filamento fino) ao longo do percurso
    const zona = c.zona[i];
    const largura = (innerWidth < 700 ? 15 : 24) * (0.45 + 1.1 * zona) * (0.6 + 0.8 * p.z);
    const deriva = Math.sin(d / 170 + p.fase + t * 0.35 * (0.6 + p.k)) * (5 + 9 * p.z);
    const lado = p.off * largura + deriva;
    out.x = c.x[i] + c.nx[i] * lado; out.y = c.y[i] + c.ny[i] * lado; out.zona = zona;
    return out;
  };

  const A = { x: 0, y: 0, zona: 0 }, B = { x: 0, y: 0, zona: 0 };
  function desenhar(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!cam) return;
    const sy = scrollY, topo = sy - 60, fundo = sy + H + 60;
    const tv = textos.filter((r) => r.b > topo && r.t < fundo), spr = sprites4();
    const k = trans < 1 ? trans * trans * (3 - 2 * trans) : 1;
    let desenhados = 0;
    for (let n = 0; n < parts.length; n++) {
      const p = parts[n];
      const yi = cam.y[Math.min(cam.m, Math.round(Math.min(p.d, cam.L) / PASSO))];
      if ((yi < topo - 80 || yi > fundo + 80) && k === 1) continue;
      posicao(cam, p, t, A);
      if (k < 1) { posicao(antigo, p, t, B, p.da); A.x = B.x + (A.x - B.x) * k; A.y = B.y + (A.y - B.y) * k; }
      if (A.y < topo || A.y > fundo || A.x < -40 || A.x > W + 40) continue;
      // profundidade efetiva: onde a corrente se aproxima os grãos vêm para a frente
      const z = Math.min(1, Math.max(0, p.z + (A.zona - 0.5) * 0.22));
      const desf = Math.abs(z - 0.5) * 2;               // 0 no plano focal
      if (qualidade < 3 && z > 0.72 && p.k > 0.5) continue; // primeiro reduz grãos desfocados e halos
      if (qualidade < 2 && z > 0.68) continue;
      if (qualidade < 2 && z < 0.3 && p.k > 0.5) continue;
      const nivel = desf < 0.22 ? 0 : desf < 0.45 ? 1 : z > 0.5 && desf > 0.62 ? 3 : 2;
      if (qualidade < 3 && nivel === 3 && p.k > 0.25) continue;
      // tamanho e opacidade pela profundidade
      const base = 0.7 + 3.9 * Math.pow(z, 1.8);
      const tam = base * (nivel === 0 ? 3.2 : nivel === 1 ? 3.6 : nivel === 2 ? 4.2 : 4.6);
      let a = z < 0.33 ? 0.36 + 0.6 * z : z < 0.68 ? 1 : 0.55 - 0.25 * (z - 0.68);
      // zona iluminada: a intensidade de cada grão varia ao atravessá-la
      const luz = 0.5 + 0.5 * Math.sin(A.x / 230 + t * 0.07 + Math.sin(A.y / 410 - t * 0.05) * 2.1);
      a *= 0.45 + 0.55 * luz * luz;
      a *= 0.82 + 0.18 * Math.sin(t * (0.6 + p.k) + p.fase);
      a *= smooth(0, 80, p.d) * (1 - smooth(cam.L - 80, cam.L, p.d)) * p.nasce;
      // menos intensidade junto das letras
      for (const r of tv) {
        const dx = Math.max(r.l - A.x, 0, A.x - r.r), dy = Math.max(r.t - A.y, 0, A.y - r.b);
        if (dx < 14 && dy < 14) { a *= 0.15 + 0.85 * smooth(0, 14, Math.max(dx, dy)); }
      }
      if (a < 0.02) continue;
      // do azul ao âmbar ao entrar no creme
      const c = smooth(cremeIni, cremeFim, A.y);
      let tom = Math.round(c * (DEGRAUS - 1));
      if (p.ouro) tom = c > 0.5 ? 10 : luz > 0.6 ? 8 : 9;
      if (c > 0.5) a = Math.min(1, a * 1.15);
      ctx.globalAlpha = Math.min(1, a);
      const tt = p.ouro ? tam * 1.15 : tam;
      ctx.drawImage(spr[tom][nivel], A.x - tt / 2, A.y - sy - tt / 2, tt, tt);
      desenhados++;
    }
    ctx.globalAlpha = 1;
    canvas.dataset.visiveis = desenhados;
  }

  /* ---------- ciclo ---------- */
  let raf = 0, ultimo = 0, relogio = 30, medias = [], ritmo = 1, salta = false;
  const estado = (e) => { canvas.dataset.estado = e; };
  const bloqueado = () => reduzido.matches || document.hidden || (leitor && leitor.open);

  function frame(agora) {
    raf = 0;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    ritmo = Math.min(1, ritmo + dt / 0.8);              // retoma suave depois de uma pausa
    const e = dt * ritmo;
    relogio += e;
    if (trans < 1) trans = Math.min(1, trans + dt / 0.9);
    const L = cam ? cam.L : 1;
    for (const p of parts) {
      p.d += p.v * e; if (p.d > L) p.d -= L;
      if (trans < 1 && p.da !== undefined) p.da += p.v * e;
      if (p.nasce < 1) p.nasce = Math.min(1, p.nasce + dt / 1.4);
    }
    salta = !salta;
    if (qualidade > 0 || salta) desenhar(relogio); // último recurso: metade dos fotogramas, mesma nitidez
    if (relogio - 30 > 2) { medias.push(dt); if (medias.length > 50) medias.shift(); }
    if (medias.length === 50) {
      const m = medias.reduce((x, y) => x + y, 0) / 50;
      if (m > 0.022 && qualidade > 0) { qualidade--; medias = []; canvas.dataset.qualidade = qualidade; }
    }
    seguir();
  }
  function seguir() { if (bloqueado()) { estado(reduzido.matches ? 'estatico' : 'parado'); return; } raf = requestAnimationFrame(frame); }
  function pedir() {
    if (raf) return;
    if (bloqueado()) { estado(reduzido.matches ? 'estatico' : 'parado'); return; }
    estado('a-animar'); ritmo = 0;
    raf = requestAnimationFrame((t) => { ultimo = t - 16; frame(t); });
  }
  function parar() { if (raf) cancelAnimationFrame(raf); raf = 0; estado(reduzido.matches ? 'estatico' : 'parado'); }

  // com movimento reduzido ou em pausa, a composição estática acompanha o scroll
  addEventListener('scroll', () => { if (!raf) desenhar(relogio); }, { passive: true });
  let tmr = 0;
  const remedir = () => { clearTimeout(tmr); tmr = setTimeout(() => { medir(true); if (!raf) { trans = 1; desenhar(relogio); } }, 90); };
  addEventListener('resize', remedir);
  addEventListener('orientationchange', remedir);
  if ('ResizeObserver' in window) new ResizeObserver(remedir).observe(document.body);
  document.fonts && document.fonts.ready.then(remedir);
  addEventListener('load', remedir);
  document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); else pedir(); });
  reduzido.addEventListener?.('change', () => { if (reduzido.matches) { parar(); desenhar(relogio); } else pedir(); });
  if (leitor) new MutationObserver(() => { if (leitor.open) parar(); else pedir(); }).observe(leitor, { attributes: true, attributeFilter: ['open'] });

  // para os testes: posições de algumas partículas em coordenadas da página
  // para os testes: posições (página) das partículas visíveis, com o respetivo índice
  window.__corrente = { amostra: () => {
    const k = trans < 1 ? trans * trans * (3 - 2 * trans) : 1, out = {};
    parts.forEach((p, n) => {
      posicao(cam, p, relogio, A); if (k < 1) { posicao(antigo, p, relogio, B, p.da); A.x = B.x + (A.x - B.x) * k; A.y = B.y + (A.y - B.y) * k; }
      if (A.y > scrollY && A.y < scrollY + innerHeight && A.x > 0 && A.x < innerWidth) out[n] = [A.x, A.y];
    });
    return out;
  } };

  medir(false);
  desenhar(relogio); // composição completa logo no primeiro fotograma
  pedir();
})();
