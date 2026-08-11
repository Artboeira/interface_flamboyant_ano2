/* ─────────────────────────────────────────────────────────────────
   ui/screens.js — os renderers.

   CAMADA DE ADAPTAÇÃO. Conhece o DOM e conhece o núcleo (FLAM.content,
   FLAM.viewerState); o núcleo não conhece este arquivo. Toda decisão de
   navegação vem de `viewerState`; aqui só se traduz estado em nós do DOM.

   Três renderers cobrem as 17 telas do PSD:

     splash — fundo vinho escuro, wordmark FLAMBOYANT, pill INÍCIO e a
              rosácea 3D nascendo da borda inferior.                (CAPA)

     menu   — rosácea pendurada no topo, título opcional sublinhado e uma
              trilha de pills enfiada num hairline.   (TELA_01, TELA_02 das
              torres, TELA_03 FACHADA)

     viewer — wordmark vertical na lateral, barra de ambientes e stepper no
              topo, painel de mídia grande + painel pequeno que troca de
              lugar ao toque, rótulo multilinha no rodapé.
              (TELA_03 ×6, TELA_04 ×4, LE CLUB LACOSTE)

   Cada tela monta o próprio cromo — não há header/footer global.
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const FLAM = (window.FLAM = window.FLAM || {});
  const { el, log } = FLAM.util;
  const VS = FLAM.viewerState;
  const SVGNS = 'http://www.w3.org/2000/svg';

  const SLOT_MS = 400;   // deve casar com --fl-slot no CSS

  /* ── peças compartilhadas ─────────────────────────────────────── */

  function screenEl(name, children, modifiers = []) {
    const classes = [`screen`, `screen--${name}`].concat(modifiers).join('.');
    return el(`section.${classes}`, { 'data-screen': name }, children);
  }

  const brand = () => (FLAM.app.model && FLAM.app.model.brand) || {};

  /**
   * Absolutiza um caminho de asset antes de ele entrar num `url()` de custom
   * property. Sem isso o browser resolve a URL contra a folha de estilo que
   * consome a variável — `css/styles.css` — e um caminho como
   * "assets/brand/wordmark.png" vira "/css/assets/brand/wordmark.png", que
   * dá 404 e faz a máscara apagar o elemento inteiro, silenciosamente.
   */
  function assetUrl(src) {
    return new URL(String(src || ''), document.baseURI).href;
  }

  /**
   * A rosácea 3D. O wrapper carrega o transform de posição e o <img> carrega
   * o giro — é o que permite girar para sempre e ainda animar a entrada sem
   * os dois transforms brigarem.
   */
  function star() {
    return el('img.star-img', { src: brand().star, alt: '', draggable: 'false' });
  }

  /** Wordmark como máscara CSS: pega a cor do tema, serve no claro e no escuro. */
  function wordmark(className) {
    const node = el(`div.${className}`, {
      role: 'img',
      'aria-label': brand().name,
    });
    node.style.setProperty('--fl-wordmark-src', `url("${assetUrl(brand().wordmark)}")`);
    return node;
  }

  /**
   * Wordmark do trilho lateral. Duas camadas pelo mesmo motivo da rosácea:
   * o wrapper recebe a animação de entrada e o filho carrega a rotação de
   * −90°. Num elemento só, a animação sobrescreveria o transform e o
   * wordmark entraria deitado.
   */
  function sideWordmark() {
    return el('div.side-wordmark', {}, [wordmark('side-wordmark__mark')]);
  }

  function pill(label, action, attrs = {}) {
    return el('button.pill', Object.assign({ 'data-action': action }, attrs),
              String(label).toUpperCase());
  }

  /** VOLTAR, sempre no mesmo lugar (1543, 962 no PSD). */
  function footerBack() {
    return el('footer.foot', {}, [pill('Voltar', 'back')]);
  }

  /** Chevron dentro de um círculo. SVG inline — nada de asset para isso. */
  function chevronCircle(dir) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const circle = document.createElementNS(SVGNS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);

    const PATHS = {
      left:  'M14 8 L10 12 L14 16',
      right: 'M10 8 L14 12 L10 16',
      up:    'M8 14 L12 10 L16 14',
      down:  'M8 10 L12 14 L16 10',
    };
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', PATHS[dir] || PATHS.right);
    svg.appendChild(path);

    return el('span.chevron-circle', {}, svg);
  }

  function bail(reason, name) {
    log('screens', reason, '→ capa');
    setTimeout(() => FLAM.router.reset(), 360);
    return screenEl(name, []);
  }

  /* ════════════════════════════════════════════════════════════════
     splash — CAPA
     ══════════════════════════════════════════════════════════════ */
  function renderSplash() {
    return screenEl('splash', [
      el('div.splash__head', {}, [
        wordmark('wordmark'),
        el('div.splash__cta', {}, [pill('Início', 'start')]),
      ]),
      el('div.splash__star', {}, [star()]),
    ]);
  }

  /* ════════════════════════════════════════════════════════════════
     menu — TELA_01, TELA_02 das torres, TELA_03 FACHADA
       params: { path?: string[] }   ausente → menu raiz
     ══════════════════════════════════════════════════════════════ */
  function renderMenu(params) {
    const model = FLAM.app.model;
    const path = Array.isArray(params && params.path) ? params.path : [];

    let items;
    let title = null;

    if (!path.length) {
      items = model.menu;
    } else {
      const found = model.resolve(path);
      if (!found || found.node.type !== 'menu') {
        return bail(`caminho de menu inválido: ${path.join('/')}`, 'menu');
      }
      items = found.node.items;
      title = found.node.title;
    }

    // Trilha centrada: pill — linha — pill — … Sem pontas soltas: no PSD o
    // hairline vai de dentro do primeiro botão até dentro do último, então só
    // os trechos entre os pills ficam à vista.
    const rail = el('div.pill-rail');
    items.forEach((item, i) => {
      if (i > 0) rail.appendChild(el('span.pill-rail__line'));
      rail.appendChild(pill(item.label, 'open', {
        'data-path': path.concat(item.id).join('/'),
      }));
    });

    return screenEl('menu', [
      el('div.menu__star', {}, [star()]),
      el('div.menu__body', {}, [
        title ? el('h2.menu__title', {}, title) : null,
        rail,
      ]),
      footerBack(),
    ]);
  }

  /* ════════════════════════════════════════════════════════════════
     viewer — TELA_03, TELA_04 e LE CLUB LACOSTE
       params: { path: string[] }

     Todo o comportamento é ditado por FLAM.viewerState. Este renderer
     monta o DOM uma vez e depois só repinta o que mudou — remontar a tela
     inteira a cada toque mataria os cross-fades.
     ══════════════════════════════════════════════════════════════ */
  function renderViewer(params) {
    const model = FLAM.app.model;
    const path = Array.isArray(params && params.path) ? params.path : [];
    const found = model.resolve(path);

    if (!found || found.node.type !== 'viewer') {
      return bail(`caminho de viewer inválido: ${path.join('/')}`, 'viewer');
    }

    const node = found.node;
    let state = VS.create();

    /* ── barra superior: abas de ambiente + stepper ──────────────── */
    const tabsEl = el('nav.topbar__tabs');
    const stepLabel = el('span.stepper__label');
    const stepPrev = el('button.stepper__btn', {
      'aria-label': 'Anterior',
      onClick: () => apply(VS.goStep(node, state, -1)),
    }, chevronCircle(node.stepperAxis === 'y' ? 'up' : 'left'));
    const stepNext = el('button.stepper__btn', {
      'aria-label': 'Próximo',
      onClick: () => apply(VS.goStep(node, state, +1)),
    }, chevronCircle(node.stepperAxis === 'y' ? 'down' : 'right'));

    const stepper = el(`div.stepper.stepper--${node.stepperAxis}`, {},
                       [stepPrev, stepLabel, stepNext]);
    if (!VS.hasStepper(node)) stepper.classList.add('is-hidden');

    const topbar = el('header.topbar', {}, [tabsEl, stepper]);

    /* ── painéis ─────────────────────────────────────────────────
       Um painel por espécie de conteúdo, na ordem fixa da tela: galeria à
       esquerda, plantas à direita. Nenhum dos dois troca de lugar — o que
       muda é qual está expandido. */
    const panes = VS.panes(node, state).map((pane) => buildPane(pane.kind));
    const stageRow = el('div.viewer__panes', {}, panes.map((p) => p.root));

    /* ── rodapé ──────────────────────────────────────────────────── */
    const captionEl = el('div.viewer__caption');

    const screen = screenEl('viewer', [
      sideWordmark(),
      node.theme === 'light' ? lacosteDecor() : null,
      el('div.viewer__body', {}, [topbar, stageRow]),
      captionEl,
      footerBack(),
    ], node.theme === 'light' ? ['screen--light'] : []);

    if (node.panes === 1) screen.classList.add('screen--viewer-single');

    /* ── construção de um painel ─────────────────────────────────── */
    function buildPane(kind) {
      const stage = el('div.pane__stage');
      const label = el('div.pane__label');

      const prev = el('button.pane__nav.pane__nav--prev', {
        'aria-label': 'Imagem anterior',
        onClick: (ev) => { ev.stopPropagation(); apply(VS.goMedia(node, state, kind, -1)); },
      }, chevronCircle('left'));

      const next = el('button.pane__nav.pane__nav--next', {
        'aria-label': 'Próxima imagem',
        onClick: (ev) => { ev.stopPropagation(); apply(VS.goMedia(node, state, kind, +1)); },
      }, chevronCircle('right'));

      const root = el(`div.pane.pane--${kind}`, {}, [stage, label, prev, next]);

      // Tocar num painel recolhido o expande; `expand` ignora o toque quando
      // ele já é o expandido, então o painel grande fica livre para a mídia.
      root.addEventListener('click', () => apply(VS.expand(node, state, kind)));

      return { root, stage, label, prev, next, kind };
    }

    /* ── mídia ───────────────────────────────────────────────────── */
    function placeholder() {
      return el('div.pane__placeholder', {}, [
        el('span.pane__placeholder-label', {}, 'CONTEÚDO EM BREVE'),
      ]);
    }

    function buildMedia(asset) {
      const slotEl = el('div.pane__slot');
      if (!asset) { slotEl.appendChild(placeholder()); return slotEl; }

      let media;
      if (asset.video) {
        media = el('video.pane__video', {
          src: asset.src,
          controls: 'controls',
          playsinline: 'playsinline',
          preload: 'metadata',
        });
        media.autoplay = true;    // o launcher passa --autoplay-policy
        media.muted = false;
      } else {
        media = el('img.pane__img', { src: asset.src, alt: asset.title || '', draggable: 'false' });
      }
      // Arquivo ausente cai no placeholder — é o caminho normal enquanto a
      // mídia real não chega.
      media.addEventListener('error', () => {
        slotEl.innerHTML = '';
        slotEl.appendChild(placeholder());
      });

      slotEl.appendChild(media);
      return slotEl;
    }

    /**
     * Cross-fade de duplo buffer dentro de um painel: o novo slot entra por
     * cima, o antigo sai, e só depois é removido. Trocar o `src` no lugar
     * daria um piscar branco.
     */
    function paintPane(pane, asset, labelText) {
      pane.label.textContent = labelText || '';

      const signature = asset ? asset.src : '';
      if (pane.stage.dataset.signature === signature) return;
      pane.stage.dataset.signature = signature;

      // Pausa qualquer vídeo saindo para o áudio não vazar entre trocas.
      pane.stage.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch (e) {} });

      const incoming = buildMedia(asset);
      const outgoing = Array.from(pane.stage.querySelectorAll('.pane__slot:not(.is-leaving)'));

      pane.stage.appendChild(incoming);
      incoming.offsetHeight;                       // força layout antes do fade
      incoming.classList.add('is-active');
      outgoing.forEach((o) => o.classList.add('is-leaving'));
      setTimeout(() => outgoing.forEach((o) => { if (o.parentNode) o.remove(); }), SLOT_MS + 40);
    }

    /* ── repintura ───────────────────────────────────────────────── */
    function apply(next) {
      state = next;
      paint();
    }

    function paint() {
      const step = VS.currentStep(node, state);

      /* abas */
      const showTabs = VS.hasTabs(node, state);
      topbar.classList.toggle('has-tabs', showTabs);
      topbar.classList.toggle('topbar--multi', step.tabs.length > 1);
      tabsEl.innerHTML = '';
      if (showTabs) {
        step.tabs.forEach((tab, i) => {
          if (i > 0) tabsEl.appendChild(el('span.topbar__sep', {}, '|'));
          tabsEl.appendChild(el('button.topbar__tab', {
            'data-active': i === state.tab ? '' : null,
            onClick: () => apply(VS.goTab(node, state, i)),
          }, tab.label));
        });
      }

      /* stepper */
      stepLabel.textContent = step.label || '';

      /* painéis — a ordem de VS.panes() é a ordem da tela */
      VS.panes(node, state).forEach((data, i) => {
        const pane = panes[i];
        paintPane(pane, data.media, data.label);
        pane.root.classList.toggle('is-expanded', data.expanded);
        pane.root.classList.toggle('has-nav', data.items.length > 1);
      });

      /* rodapé */
      captionEl.innerHTML = '';
      const lines = VS.caption(node, state).filter(Boolean);
      if (lines.length) {
        // A régua vertical acompanha a altura do texto, por isso os dois
        // ficam numa linha própria: o bloco todo é centrado verticalmente,
        // e dentro dele régua e texto se esticam juntos.
        captionEl.appendChild(el('div.viewer__caption-row', {}, [
          el('span.viewer__caption-rule'),
          el('div.viewer__caption-text', {}, lines.map((line) => el('span', {}, line))),
        ]));
      }
    }

    paint();

    // Só depois do primeiro quadro os painéis passam a animar a largura: a
    // tela entra com o layout já resolvido, e a transição fica reservada para
    // o toque do usuário. Ver a nota em `.screen--viewer.is-ready .pane`.
    requestAnimationFrame(() => screen.classList.add('is-ready'));

    // Setas do teclado durante o desenvolvimento (a mesa não tem teclado).
    screen._viewerMedia = (delta) => apply(VS.goMedia(node, state, state.expanded, delta));
    screen._viewerStep = (delta) => apply(VS.goStep(node, state, delta));

    return screen;
  }

  /**
   * Os três selos do Le Club Lacoste, com a textura meio-tom por baixo.
   * Cada selo gira em velocidade e sentido próprios (ver --fl-spin-seal-* no
   * tema) para o conjunto nunca repetir a mesma composição.
   */
  function lacosteDecor() {
    const seals = [1, 2, 3].map((n) =>
      el(`div.seal.seal--${n}`, {}, [
        el('img', { src: brand().seal, alt: '', draggable: 'false' }),
      ]));

    // A malha de meio-tom é desenhada em CSS (ver `.viewer__texture`), não
    // importada do PSD — lá ela vem recortada por máscara e densa demais na
    // faixa do menu.
    return el('div.viewer__decor', {}, [el('div.viewer__texture')].concat(seals));
  }

  /* ── registro ─────────────────────────────────────────────────── */
  const REGISTRY = {
    splash: renderSplash,
    menu: renderMenu,
    viewer: renderViewer,
  };

  function build(name, params = {}) {
    const render = REGISTRY[name];
    if (!render) throw new Error(`[screens] sem renderer para "${name}"`);
    return render(params);
  }

  FLAM.screens = { build, has: (name) => Boolean(REGISTRY[name]) };
})();
