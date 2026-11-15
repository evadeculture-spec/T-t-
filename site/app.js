/* O universo do Tatá — interações.
   Sem JavaScript tudo continua acessível: cada peça é uma ligação para o ficheiro (imagem, filme
   ou som) e as âncoras levam ao álbum e de volta ao ribeiro. Este script acrescenta os filtros,
   a revelação progressiva, o leitor (anterior, seguinte, fechar) e o brilho na linha de água. */
(() => {
  const dados = JSON.parse(document.getElementById('acervo-dados').textContent);
  const porSlug = Object.fromEntries(dados.map((p, i) => [p.slug, i]));
  const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mmss = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const PASSO = 6;

  /* ---------- filtros e revelação progressiva ---------- */
  const grelha = document.getElementById('grelha');
  const grupos = [...grelha.querySelectorAll('.grupo')];
  const botoesFiltro = [...document.querySelectorAll('.filtro')];
  const mais = document.getElementById('mais');
  const estado = document.getElementById('album-estado');
  let filtro = 'tudo';
  let limite = PASSO;

  const nomes = { tudo: 'peças', filme: 'filmes', imagem: 'imagens', som: 'sons' };
  const nome1 = { tudo: 'peça', filme: 'filme', imagem: 'imagem', som: 'som' };
  const contaPecas = (t) => dados.filter((p) => t === 'tudo' || p.tipo === t).length;

  function aplicar() {
    const visiveis = grupos.filter((g) => filtro === 'tudo' || g.dataset.tipo === filtro);
    grupos.forEach((g) => { g.hidden = true; });
    visiveis.forEach((g, i) => { g.hidden = i >= limite; });
    const faltam = visiveis.length - Math.min(limite, visiveis.length);
    mais.hidden = faltam <= 0;
    if (faltam > 0) mais.textContent = `Mostrar mais (${faltam} ${faltam === 1 ? 'grupo' : 'grupos'})`;
    botoesFiltro.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === filtro)));
    estado.textContent = `${contaPecas(filtro)} ${contaPecas(filtro) === 1 ? nome1[filtro] : nomes[filtro]} em ${visiveis.length} ${visiveis.length === 1 ? 'grupo' : 'grupos'}`;
  }
  function escolher(f) { filtro = f; limite = PASSO; aplicar(); }

  botoesFiltro.forEach((b) => b.addEventListener('click', () => escolher(b.dataset.filtro)));
  mais.addEventListener('click', () => {
    const primeiroNovo = grupos.filter((g) => (filtro === 'tudo' || g.dataset.tipo === filtro))[limite];
    limite += PASSO; aplicar();
    primeiroNovo?.querySelector('a')?.focus({ preventScroll: false });
  });
  document.querySelectorAll('.contagem a[data-filtro]').forEach((a) => a.addEventListener('click', () => escolher(a.dataset.filtro)));
  aplicar();

  /* ---------- explorar: brilho na linha de água ---------- */
  const agua = document.querySelector('.vinheta-agua');
  const album = document.getElementById('album');
  const brilhar = () => {
    if (!agua || semMovimento()) return;
    agua.classList.remove('brilha'); void agua.getBoundingClientRect(); agua.classList.add('brilha');
  };
  document.querySelectorAll('a[href="#album"]').forEach((a) => a.addEventListener('click', (e) => {
    if (semMovimento()) return; // salto imediato pela âncora nativa
    e.preventDefault();
    brilhar();
    history.pushState(null, '', '#album');
    setTimeout(() => { album.scrollIntoView({ behavior: 'smooth', block: 'start' }); album.focus({ preventScroll: true }); }, 220);
  }));

  /* ---------- leitor ---------- */
  const leitor = document.getElementById('leitor');
  const palco = document.getElementById('leitor-palco');
  const titulo = document.getElementById('leitor-titulo');
  const legenda = document.getElementById('leitor-legenda');
  const contador = document.getElementById('leitor-contador');
  const btSom = document.getElementById('leitor-som');
  const btAnt = document.getElementById('leitor-ant');
  const btSeg = document.getElementById('leitor-seg');
  const btFechar = document.getElementById('leitor-fechar');
  let lista = [], pos = 0, origem = null, scrollAntes = 0, comSom = false;

  const sequencia = () => dados.map((p, i) => i).filter((i) => filtro === 'tudo' || dados[i].tipo === filtro);

  function pararMedia() { palco.querySelectorAll('video, audio').forEach((m) => { m.pause(); m.removeAttribute('src'); m.load(); }); }

  function mostrar() {
    pararMedia();
    const p = dados[lista[pos]];
    palco.textContent = '';
    btSom.hidden = true;
    if (p.tipo === 'filme') {
      const v = document.createElement('video');
      v.controls = true; v.playsInline = true; v.setAttribute('playsinline', '');
      v.preload = 'metadata';
      v.poster = `${p.miniatura}-960.jpg`;
      v.src = p.video;
      v.width = p.w; v.height = p.h;
      v.setAttribute('aria-label', `${p.titulo}. ${p.legenda}`);
      if (p.legendas) {
        const t = document.createElement('track');
        t.kind = 'captions'; t.srclang = 'pt'; t.label = 'Português'; t.src = p.legendas; t.default = true;
        v.appendChild(t);
      }
      v.muted = !comSom;
      palco.appendChild(v);
      if (p.som) {
        btSom.hidden = false;
        btSom.setAttribute('aria-pressed', String(comSom));
        btSom.textContent = comSom ? 'Som ligado' : 'Som desligado';
      }
      v.addEventListener('volumechange', () => {
        comSom = !v.muted; btSom.setAttribute('aria-pressed', String(comSom));
        btSom.textContent = comSom ? 'Som ligado' : 'Som desligado';
      });
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
    } else if (p.tipo === 'imagem') {
      const img = new Image();
      img.src = p.inteira; img.alt = p.alt || p.titulo;
      img.width = p.w; img.height = p.h; img.decoding = 'async';
      palco.appendChild(img);
    } else {
      const caixa = document.createElement('div'); caixa.className = 'som';
      const a = document.createElement('audio');
      a.controls = true; a.preload = 'metadata'; a.src = p.audio;
      a.setAttribute('aria-label', p.titulo);
      const tr = document.createElement('p'); tr.className = 'transcricao';
      tr.textContent = p.transcricao;
      const nota = document.createElement('small'); nota.textContent = 'Transcrição da fala.';
      tr.appendChild(nota);
      caixa.append(a, tr); palco.appendChild(caixa);
    }
    titulo.textContent = p.titulo;
    legenda.textContent = p.tipo === 'filme' ? `${p.legenda} ${mmss(p.duracao)}${p.som ? '' : ' · sem som'}` : p.legenda;
    contador.textContent = `${pos + 1} / ${lista.length}`;
    btAnt.disabled = lista.length < 2; btSeg.disabled = lista.length < 2;
  }

  function abrir(i, de) {
    lista = sequencia();
    if (!lista.includes(i)) { lista = dados.map((p, k) => k); }
    pos = lista.indexOf(i);
    origem = de; scrollAntes = scrollY;
    document.documentElement.classList.add('leitor-aberto');
    if (typeof leitor.showModal === 'function') leitor.showModal(); else leitor.setAttribute('open', '');
    mostrar();
    btFechar.focus();
  }
  function aoFechar() {
    pararMedia(); palco.textContent = '';
    document.documentElement.classList.remove('leitor-aberto');
    window.scrollTo({ top: scrollAntes, behavior: 'instant' });
    if (origem) origem.focus({ preventScroll: true });
    origem = null;
  }
  const fechar = () => { if (leitor.close) leitor.close(); else { leitor.removeAttribute('open'); aoFechar(); } };
  const andar = (d) => { pos = (pos + d + lista.length) % lista.length; mostrar(); };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-i], a.abre[data-slug]');
    if (!a) return;
    e.preventDefault();
    const i = a.dataset.i !== undefined ? +a.dataset.i : porSlug[a.dataset.slug];
    abrir(i, a);
  });
  btFechar.addEventListener('click', fechar);
  btAnt.addEventListener('click', () => andar(-1));
  btSeg.addEventListener('click', () => andar(1));
  btSom.addEventListener('click', () => {
    const v = palco.querySelector('video'); if (!v) return;
    v.muted = !v.muted; if (!v.muted && v.paused) v.play().catch(() => {});
  });
  leitor.addEventListener('close', aoFechar);
  leitor.addEventListener('click', (e) => { if (e.target === leitor) fechar(); });
  leitor.addEventListener('keydown', (e) => {
    if (e.target.closest('video, audio')) return; // as setas pertencem ao leitor nativo quando tem foco
    if (e.key === 'ArrowRight') { e.preventDefault(); andar(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); andar(-1); }
  });
  // toque: deslizar para os lados muda de peça
  let x0 = null;
  palco.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  palco.addEventListener('touchend', (e) => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 60 && !e.target.closest('video, audio')) andar(dx < 0 ? 1 : -1);
  });
})();
