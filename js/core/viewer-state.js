/* ─────────────────────────────────────────────────────────────────
   core/viewer-state.js — a máquina de estado da tela de painel duplo.

   CAMADA DE NEGÓCIO. Não conhece DOM, não conhece `window`, não faz I/O.
   Roda em Node para teste. Toda função aqui é pura: recebe estado, devolve
   estado novo — nunca muta o que recebeu.

   Por que isolar: a tela de mídia tem quatro eixos de navegação simultâneos
   (pavimento, ambiente, índice da galeria, índice das plantas) mais a troca
   de tamanho entre os painéis. Misturar isso com a construção de nós do DOM
   é exatamente o que transforma essa tela num emaranhado impossível de mudar.

   O ESTADO
     step      índice do pavimento / opção (stepper: SS1, 34, 420 M²…)
     tab       índice do ambiente dentro do pavimento (garagem, car wash…)
     gallery   índice da mídia no painel da galeria
     plans     índice da mídia no painel das plantas
     expanded  qual dos dois painéis está grande: 'gallery' | 'plans'

   POSIÇÃO É FIXA, TAMANHO É QUE MUDA
     Nas duas variantes desenhadas no PSD (TELA_04 MÍDIA FOTOS e MÍDIA
     PLANTAS) a galeria está sempre à esquerda e a planta sempre à direita —
     o que troca é qual das duas ocupa 1215px e qual ocupa 360px. Modelar
     assim (e não como "painel grande / painel pequeno" trocando de lado)
     mantém o conteúdo parado e reduz a animação a uma transição de largura,
     que é exatamente o que o olho lê como "a pequena cresceu".

   REGRAS DE ESTABILIDADE
     Trocar de pavimento reinicia ambiente e ambos os índices de mídia: o
     ambiente 3 do SS1 não tem relação nenhuma com o ambiente 3 do TÉRREO.
     Trocar de ambiente reinicia os índices de mídia pelo mesmo motivo, mas
     preserva `expanded` — quem escolheu ver a planta grande quer continuar
     vendo a planta grande ao passar para o ambiente seguinte.
   ─────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  const GALLERY = 'gallery';
  const PLANS = 'plans';

  /** Envolve um índice dentro de [0, length) nos dois sentidos. */
  function wrap(index, length) {
    if (!length) return 0;
    return ((index % length) + length) % length;
  }

  /** Estado inicial de um nó viewer. */
  function create() {
    return { step: 0, tab: 0, gallery: 0, plans: 0, expanded: GALLERY };
  }

  /* ── leitura: estado + nó → o que está na tela ────────────────────── */

  /** O pavimento/opção corrente. Sempre devolve um objeto, nunca undefined. */
  function currentStep(node, state) {
    const steps = node.steps || [];
    return steps[wrap(state.step, steps.length)] || { label: '', tabs: [] };
  }

  /** O ambiente corrente dentro do pavimento. */
  function currentTab(node, state) {
    const tabs = currentStep(node, state).tabs || [];
    return tabs[wrap(state.tab, tabs.length)] || { label: '', gallery: [], plans: [] };
  }

  /**
   * Os dois painéis, na ordem em que aparecem na tela (esquerda, direita).
   * Cada um traz o que precisa para se desenhar — inclusive se está expandido
   * — para que o renderer nunca precise consultar `expanded` por conta própria.
   */
  function panes(node, state) {
    const tab = currentTab(node, state);
    const items = { [GALLERY]: tab.gallery || [], [PLANS]: tab.plans || [] };

    const describe = (kind, label) => ({
      kind,
      label,
      items: items[kind],
      index: wrap(state[kind], items[kind].length),
      media: items[kind][wrap(state[kind], items[kind].length)] || null,
      expanded: state.expanded === kind,
    });

    const list = [describe(GALLERY, 'IMAGENS GERAIS')];
    // Um viewer de painel único (fachada) é a galeria ocupando a linha toda.
    if ((node.panes || 2) === 2) list.push(describe(PLANS, 'PLANTA DAS IMGS'));
    return list;
  }

  /**
   * O rótulo do canto inferior esquerdo, sempre como array de linhas.
   * Vem do pavimento quando ele define um, senão do nó — é o que produz
   * "APARTAMENTO / 4 SUÍTES E COZINHA FECHADA / 420 M²".
   */
  function caption(node, state) {
    const value = currentStep(node, state).caption || node.caption || '';
    return Array.isArray(value) ? value : String(value).split('\n');
  }

  /** O stepper só aparece quando há mais de um pavimento para percorrer. */
  function hasStepper(node) { return (node.steps || []).length > 1; }

  /**
   * A barra de ambientes aparece com uma aba só — é assim no PSD: o SS3 tem
   * apenas "garagem" e mesmo assim o nome fica centralizado no topo. Some de
   * verdade só quando nenhuma aba tem rótulo (plantas de apartamento, mídia
   * única da fachada).
   */
  function hasTabs(node, state) {
    return (currentStep(node, state).tabs || []).some((tab) => Boolean(tab.label));
  }

  /* ── transições: (nó, estado, …) → estado novo ────────────────────── */

  function goStep(node, state, delta) {
    const steps = (node.steps || []).length;
    if (steps < 2) return state;
    // Pavimento novo → ambiente e mídias voltam ao início. Ver nota no topo.
    return { ...state, step: wrap(state.step + delta, steps), tab: 0, gallery: 0, plans: 0 };
  }

  function goTab(node, state, index) {
    const tabs = (currentStep(node, state).tabs || []).length;
    if (!tabs) return state;
    // `expanded` sobrevive de propósito: a preferência de layout é do usuário.
    return { ...state, tab: wrap(index, tabs), gallery: 0, plans: 0 };
  }

  /** Avança a mídia de um dos painéis. `kind` é 'gallery' ou 'plans'. */
  function goMedia(node, state, kind, delta) {
    const pane = panes(node, state).find((p) => p.kind === kind);
    if (!pane || pane.items.length < 2) return state;
    return { ...state, [kind]: wrap(state[kind] + delta, pane.items.length) };
  }

  /**
   * Expande um dos painéis. Tocar no que já está grande não faz nada — o
   * toque no painel grande é para a mídia, não para o layout.
   */
  function expand(node, state, kind) {
    if ((node.panes || 2) < 2) return state;
    if (kind !== GALLERY && kind !== PLANS) return state;
    if (state.expanded === kind) return state;
    return { ...state, expanded: kind };
  }

  const api = {
    GALLERY, PLANS,
    create, wrap,
    currentStep, currentTab, panes, caption, hasStepper, hasTabs,
    goStep, goTab, goMedia, expand,
  };

  /* Browser: pendura em FLAM.viewerState. Node: exporta pelo module.
     É o único ponto do arquivo que sabe onde está rodando. */
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.FLAM = root.FLAM || {}).viewerState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
