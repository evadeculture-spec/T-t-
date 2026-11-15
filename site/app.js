/* O universo do Tatá — interações.
   Tudo funciona sem JavaScript: «Folhear» é uma âncora, «Ver a descoberta» abre o ficheiro
   de vídeo e «Voltar ao ribeiro» é outra âncora. Este script só acrescenta o reflexo dourado,
   o vídeo dentro da cena e a ampliação do álbum. */
(() => {
  const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Folhear: um reflexo dourado percorre uma ondulação e a leitura passa ao retrato ---- */
  const folhear = document.getElementById('folhear');
  const ondas = document.querySelector('.vinheta-ondas');
  const alvo = document.getElementById('tata');

  folhear?.addEventListener('click', (e) => {
    if (semMovimento() || !alvo) return; // passagem imediata, pela âncora nativa
    e.preventDefault();
    if (ondas) {
      ondas.classList.remove('brilha');
      void ondas.getBoundingClientRect(); // reinicia a animação
      ondas.classList.add('brilha');
    }
    history.pushState(null, '', '#tata');
    // o reflexo arranca no próprio toque; a página começa a deslizar logo a seguir
    setTimeout(() => {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      alvo.focus({ preventScroll: true });
    }, 260);
  });

  /* ---- Ver a descoberta: o clipe toca dentro da cena, com comandos nativos ---- */
  const ver = document.getElementById('ver');
  const cena = document.getElementById('cena');
  let video = null;

  const fecharVideo = () => {
    if (!video) return;
    video.pause();
    video.remove();
    video = null;
    cena.classList.remove('a-ver');
    ver.lastChild.textContent = 'Ver a descoberta';
    ver.focus();
  };

  ver?.addEventListener('click', (e) => {
    e.preventDefault();
    if (video) { fecharVideo(); return; }
    video = document.createElement('video');
    video.src = ver.getAttribute('href');
    video.poster = 'media/ribeiro-descoberta-1280.jpg';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-label', 'A descoberta: a Luna e o Tatá junto ao ribeiro, com a estrela no musgo. Oito segundos.');
    cena.classList.add('a-ver');
    cena.appendChild(video);
    ver.lastChild.textContent = 'Voltar à imagem';
    const p = video.play();
    if (p && p.catch) p.catch(() => { /* o visitante pode carregar no play */ });
  });

  /* ---- Ampliar uma peça do álbum ---- */
  const dialogo = document.getElementById('ampliar');
  const img = document.getElementById('ampliar-img');
  const legenda = document.getElementById('ampliar-legenda');
  const fechar = document.getElementById('ampliar-fechar');
  let origem = null;

  const abrir = (botao) => {
    const fig = botao.closest('figure');
    const miniatura = botao.querySelector('img');
    origem = botao;
    img.src = botao.dataset.full;
    img.width = +botao.dataset.w; img.height = +botao.dataset.h;
    img.alt = miniatura ? miniatura.alt : '';
    legenda.textContent = fig.querySelector('figcaption')?.textContent || '';
    document.documentElement.classList.add('ampliado');
    if (typeof dialogo.showModal === 'function') dialogo.showModal();
    else dialogo.setAttribute('open', '');
    fechar.focus();
  };
  const aoFechar = () => {
    document.documentElement.classList.remove('ampliado');
    img.removeAttribute('src');
    if (origem) origem.focus({ preventScroll: true });
    origem = null;
  };

  document.querySelectorAll('.peca__botao').forEach((b) => b.addEventListener('click', () => abrir(b)));
  fechar.addEventListener('click', () => dialogo.close ? dialogo.close() : (dialogo.removeAttribute('open'), aoFechar()));
  dialogo.addEventListener('close', aoFechar);
  // tocar no fundo escuro fora da imagem também fecha
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialogo.open && !dialogo.close) { dialogo.removeAttribute('open'); aoFechar(); }
  });

  /* ---- Voltar ao ribeiro: devolve o foco ao início ---- */
  document.querySelector('.voltar')?.addEventListener('click', () => {
    setTimeout(() => folhear?.focus({ preventScroll: true }), semMovimento() ? 0 : 700);
  });
})();
