/* ─────────────────────────────────────────────────────────────────
   app.js — composition root.

   É o único arquivo que conhece as duas pontas: carrega o config.json pela
   rede, entrega ao núcleo (`FLAM.content.create`) e deixa o modelo pronto em
   `FLAM.app.model` para os renderers. Nada de regra de negócio mora aqui.

   Também é onde ficam as responsabilidades de infraestrutura da mesa:
     • o handler único de toque, delegado no document (data-action);
     • as travas de gesto (pinch, duplo-toque, menu de contexto);
     • o timer de ociosidade que devolve a mesa para a capa;
     • os atalhos de teclado, que só existem no desenvolvimento.
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const FLAM = (window.FLAM = window.FLAM || {});
  const { fetchJSON, log } = FLAM.util;

  const state = { model: null };

  FLAM.app = {
    get model() { return state.model; },
    get idleMs() { return state.model ? state.model.idleMs : 180000; },
    openPath,
  };

  /* ── navegação ──────────────────────────────────────────────────── */

  /**
   * Abre o nó endereçado por `path`. O tipo do nó — e só ele — decide qual
   * tela responde: menus ramificam, viewers abrem a tela de mídia.
   */
  function openPath(path) {
    const found = state.model.resolve(path);
    if (!found) { log('app', `caminho desconhecido: ${path}`); return; }
    FLAM.router.navigate(found.node.type === 'menu' ? 'menu' : 'viewer', { path: found.path });
  }

  /* ── toque ──────────────────────────────────────────────────────── */
  function onTap(ev) {
    const target = ev.target.closest('[data-action]');
    if (!target) return;
    switch (target.getAttribute('data-action')) {
      case 'start':
        FLAM.router.navigate('menu');
        break;
      case 'open': {
        const path = target.getAttribute('data-path');
        if (path) openPath(path);
        break;
      }
      case 'back':
        FLAM.router.back();
        break;
      default:
        log('app', 'ação não tratada:', target.getAttribute('data-action'));
    }
  }

  /* ── teclado (só desenvolvimento — a mesa não tem teclado) ───────── */
  function onKey(ev) {
    if (ev.key === 'Escape' || ev.key === 'Backspace') {
      ev.preventDefault();
      FLAM.router.back();
      return;
    }

    const screen = document.querySelector('.screen--viewer.is-active');
    if (!screen) return;

    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      if (typeof screen._viewerMedia !== 'function') return;
      ev.preventDefault();
      screen._viewerMedia(ev.key === 'ArrowLeft' ? -1 : 1);
    } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      if (typeof screen._viewerStep !== 'function') return;
      ev.preventDefault();
      screen._viewerStep(ev.key === 'ArrowUp' ? -1 : 1);
    }
  }

  /* ── ociosidade ─────────────────────────────────────────────────── */
  let idleTimer = null;

  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const current = FLAM.router.current();
      if (current && current.screen !== 'splash') {
        log('app', `ocioso ${FLAM.app.idleMs}ms → capa`);
        FLAM.router.reset();
      } else {
        armIdle();   // já está na capa; segue vigiando
      }
    }, FLAM.app.idleMs);
  }

  /* ── tela de erro de boot ───────────────────────────────────────── */
  function bootError(title, detail) {
    const root = document.getElementById('screen-root');
    root.innerHTML = '';
    root.appendChild(FLAM.util.el('section.screen.is-active', {}, [
      FLAM.util.el('div.boot-error', {}, [
        FLAM.util.el('h1.boot-error__title', {}, title),
        detail ? FLAM.util.el('p.boot-error__detail', {}, detail) : null,
      ]),
    ]));
  }

  /* ── boot ───────────────────────────────────────────────────────── */
  async function boot() {
    let raw;
    try {
      raw = await fetchJSON('config.json');
    } catch (e) {
      console.error('[app] config.json não carregou', e);
      bootError('config.json não encontrado', String(e.message || e));
      return;
    }

    // A validação é estrita de propósito: melhor uma tela de erro legível no
    // boot do que uma tela preta na sala de vendas com o cliente na frente.
    try {
      state.model = FLAM.content.create(raw);
    } catch (e) {
      console.error('[app] config.json inválido', e);
      bootError('config inválido', String(e.message || e));
      return;
    }

    const query = new URLSearchParams(location.search);

    /* `?rem=10` congela a escala raiz — só para conferência visual.
       Todo o layout deriva de `100vh / 108`, então basta o viewport oscilar
       um pixel para o desenho inteiro sair de escala. O Chrome headless faz
       exatamente isso: redimensiona o viewport durante a carga, e a captura
       sai numa escala e as medidas em outra. Com o rem fixo em 10px a tela
       renderiza no grid de 1920×1080 do PSD e a comparação vira 1:1.
       Sem efeito em produção — o launcher não passa este parâmetro. */
    const rem = Number(query.get('rem'));
    if (rem > 0) {
      document.documentElement.style.fontSize = `${rem}px`;
      log('app', `escala raiz fixada em ${rem}px (conferência visual)`);
    }

    // Modo kiosk esconde o cursor, para um ponteiro esquecido não ficar
    // parado sobre a mesa. Vem do launcher (?kiosk=1) ou do config.
    if (query.has('kiosk') || state.model.kiosk) {
      document.body.setAttribute('data-kiosk', '');
      log('app', 'modo kiosk ativo');
    }

    document.addEventListener('click', onTap);
    document.addEventListener('keydown', onKey);

    // Mesa: bloqueia zoom de qualquer origem — pinch (2+ dedos), gesto do
    // Safari/trackpad e Ctrl+scroll. Toque de um dedo segue normal.
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    ['pointerdown', 'touchstart', 'mousedown', 'wheel'].forEach((evt) =>
      document.addEventListener(evt, armIdle, { passive: true }));

    log('app', `config ok — ${state.model.menu.length} nós na raiz, ocioso ${state.model.idleMs}ms`);

    /* Atalho de desenvolvimento: `?screen=viewer&path=legitimo/subsolos` entra
       direto numa tela para conferência visual contra o PSD. Sem efeito no uso
       normal, já que o launcher não passa esses parâmetros. */
    const devScreen = query.get('screen');
    if (devScreen && FLAM.screens.has(devScreen)) {
      const path = query.get('path');
      await FLAM.router.start(devScreen, path ? { path: path.split('/').filter(Boolean) } : {});
    } else {
      await FLAM.router.start('splash');
    }

    armIdle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
