/* ─────────────────────────────────────────────────────────────────
   core/content.js — o modelo de conteúdo da mesa.

   CAMADA DE NEGÓCIO. Não conhece DOM, não conhece `window`, não faz fetch.
   Recebe o objeto já parseado do config.json e responde perguntas sobre ele.
   Roda em Node — ver o selftest no rodapé, que é a garantia de que a
   separação de camadas não vazou.

   A árvore
     Cada nó tem `id`, `label` e `type`. Nós são endereçados por caminho:
     "legitimo/subsolos". Dois tipos, porque as 17 telas do PSD são estados
     de três renderers, não dezessete:

       menu    → uma trilha de pills. `items` são os filhos.
       viewer  → a tela de mídia. `steps[].tabs[].{gallery,plans}`.

     Vídeo não é um tipo: é detectado pela extensão do arquivo, como no
     totem da feira. Um `viewer` com `panes: 1` é a tela de mídia única.

   Validação
     `validate()` é estrita de propósito. O config é escrito à mão a partir
     do PSD, e um `steps` esquecido num viewer vira uma tela preta na sala
     de vendas com o cliente na frente. Melhor falhar alto no boot.
   ─────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  const VIDEO_RE = /\.(mp4|webm|mov|m4v)($|\?)/i;

  /** True quando o caminho aponta para um vídeo (decide <video> vs <img>). */
  function isVideo(url) { return VIDEO_RE.test(String(url || '')); }

  /**
   * Normaliza uma entrada de mídia. O config aceita a forma curta
   * ("caminho.jpg") e a completa ({ src, title }) — daqui para dentro só
   * existe a completa.
   */
  function asAsset(entry) {
    if (!entry) return null;
    const asset = typeof entry === 'string' ? { src: entry } : { ...entry };
    if (!asset.src) return null;
    asset.video = isVideo(asset.src);
    return asset;
  }

  function assetList(entries) {
    return (Array.isArray(entries) ? entries : []).map(asAsset).filter(Boolean);
  }

  /* ── construção ───────────────────────────────────────────────────── */

  /**
   * Normaliza a árvore inteira uma vez, no boot. Depois disso nenhum
   * renderer precisa lidar com campo ausente ou forma curta.
   */
  function normalizeNode(raw) {
    const node = {
      id: String(raw.id || ''),
      label: String(raw.label || ''),
      type: raw.type === 'menu' ? 'menu' : 'viewer',
      title: raw.title || null,          // título sublinhado acima da trilha
      caption: raw.caption || null,      // rótulo do canto inferior esquerdo
    };

    if (node.type === 'menu') {
      node.items = (raw.items || []).map(normalizeNode);
      return node;
    }

    node.panes = raw.panes === 1 ? 1 : 2;
    node.stepperAxis = raw.stepperAxis === 'y' ? 'y' : 'x';
    node.theme = raw.theme === 'light' ? 'light' : 'dark';
    node.steps = (raw.steps || []).map((step) => ({
      label: String(step.label || ''),
      caption: step.caption || null,
      tabs: (step.tabs || []).map((tab) => ({
        label: String(tab.label || ''),
        gallery: assetList(tab.gallery),
        plans: assetList(tab.plans),
      })),
    }));
    return node;
  }

  /**
   * Cria o modelo a partir do config bruto. Lança se o config for inválido —
   * quem chama transforma isso numa tela de erro legível.
   */
  function create(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') throw new Error('config vazio');
    if (!Array.isArray(rawConfig.menu)) throw new Error('config.menu ausente ou não é lista');

    const menu = rawConfig.menu.map(normalizeNode);
    const problems = validate(menu);
    if (problems.length) throw new Error(problems.join(' · '));

    const brand = rawConfig.brand || {};

    return {
      idleMs: Number(rawConfig.idleTimeoutMs) || 180000,
      kiosk: rawConfig.kiosk === true,
      brand: {
        name: brand.name || 'FLAMBOYANT',
        wordmark: brand.wordmark || 'assets/brand/wordmark.png',
        star: brand.star || 'assets/brand/star.png',
        seal: brand.seal || 'assets/brand/seal-lacoste.png',
      },
      menu,
      resolve: (path) => resolve(menu, path),
      assets: () => collectAssets(menu),
    };
  }

  /* ── resolução de caminho ─────────────────────────────────────────── */

  /** "legitimo/subsolos" → ['legitimo', 'subsolos'] */
  function segments(path) {
    if (Array.isArray(path)) return path.filter(Boolean).map(String);
    return String(path || '').split('/').filter(Boolean);
  }

  /**
   * Desce a árvore por ids. Devolve { node, path, parents } ou null se o
   * caminho não existir — quem chama decide se volta ao menu ou erra.
   */
  function resolve(menu, path) {
    const ids = segments(path);
    if (!ids.length) return null;

    let list = menu;
    let node = null;
    const parents = [];

    for (const id of ids) {
      node = (list || []).find((candidate) => candidate.id === id) || null;
      if (!node) return null;
      parents.push(node);
      list = node.items;
    }

    return { node, path: ids, parents: parents.slice(0, -1) };
  }

  /* ── validação ────────────────────────────────────────────────────── */

  /** Devolve uma lista de problemas legíveis. Vazia = config sadio. */
  function validate(menu, trail = []) {
    const problems = [];
    const seen = new Set();

    for (const node of menu) {
      const where = trail.concat(node.id || '?').join('/');

      if (!node.id) problems.push(`nó sem id em "${trail.join('/') || 'raiz'}"`);
      if (!node.label) problems.push(`"${where}" sem label`);
      if (seen.has(node.id)) problems.push(`id duplicado "${where}"`);
      seen.add(node.id);

      if (node.type === 'menu') {
        if (!node.items.length) problems.push(`menu "${where}" sem items`);
        else problems.push(...validate(node.items, trail.concat(node.id)));
        continue;
      }

      if (!node.steps.length) {
        problems.push(`viewer "${where}" sem steps`);
        continue;
      }
      node.steps.forEach((step, i) => {
        if (!step.tabs.length) problems.push(`"${where}" step[${i}] sem tabs`);
        step.tabs.forEach((tab, j) => {
          // Um ambiente sem nenhuma mídia é legítimo enquanto os arquivos não
          // chegam — renderiza placeholder. Sem `label` não é: a aba some.
          if (!tab.label && step.tabs.length > 1) {
            problems.push(`"${where}" step[${i}].tab[${j}] sem label`);
          }
        });
      });
    }

    return problems;
  }

  /** Todo caminho de mídia referenciado na árvore, sem repetição. */
  function collectAssets(menu, out = new Set()) {
    for (const node of menu) {
      if (node.type === 'menu') { collectAssets(node.items, out); continue; }
      for (const step of node.steps) {
        for (const tab of step.tabs) {
          for (const asset of tab.gallery.concat(tab.plans)) out.add(asset.src);
        }
      }
    }
    return Array.from(out);
  }

  const api = { create, resolve, validate, segments, isVideo, asAsset, assetList };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.FLAM = root.FLAM || {}).content = api;

  /* ── selftest ───────────────────────────────────────────────────────
     `node js/core/content.js --selftest` — carrega o config.json de verdade,
     valida a árvore inteira, exercita a máquina de estado e lista as mídias
     referenciadas que ainda não existem no disco.

     Roda sem browser, sem framework e sem rede de propósito: se um dia este
     comando parar de funcionar, é porque a camada de negócio passou a
     depender de infraestrutura — e aí a arquitetura é que está errada. */
  if (typeof module !== 'undefined' && require.main === module
      && process.argv.includes('--selftest')) {
    const fs = require('fs');
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '..', '..');
    const viewerState = require('./viewer-state.js');

    let failures = 0;
    const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };

    const raw = JSON.parse(fs.readFileSync(path.join(projectRoot, 'config.json'), 'utf8'));
    const model = create(raw);   // lança se a validação achar problema
    console.log('config.json válido — %d nós na raiz, idle %ds',
                model.menu.length, Math.round(model.idleMs / 1000));

    /* Todo nó é alcançável pelo próprio caminho, e todo viewer sobrevive a
       ser percorrido em todos os eixos. */
    let viewers = 0;
    let steps = 0;
    let tabs = 0;

    (function walk(nodes, trail) {
      for (const node of nodes) {
        const where = trail.concat(node.id);
        if (!model.resolve(where.join('/'))) fail(`caminho não resolve: ${where.join('/')}`);

        if (node.type === 'menu') { walk(node.items, where); continue; }

        viewers++;
        steps += node.steps.length;

        let state = viewerState.create();
        for (let s = 0; s < node.steps.length; s++) {
          const step = viewerState.currentStep(node, state);
          tabs += step.tabs.length;

          for (let t = 0; t < step.tabs.length; t++) {
            const withTab = viewerState.goTab(node, state, t);
            const list = viewerState.panes(node, withTab);

            if (list.length !== node.panes) {
              fail(`${where.join('/')} step ${s} tab ${t}: ${list.length} painéis, esperado ${node.panes}`);
            }
            if (list.filter((p) => p.expanded).length !== 1) {
              fail(`${where.join('/')} step ${s} tab ${t}: nenhum ou mais de um painel expandido`);
            }

            const expandPlans = viewerState.expand(node, withTab, viewerState.PLANS);
            if (node.panes === 2 && expandPlans.expanded !== viewerState.PLANS) {
              fail(`${where.join('/')}: expandir as plantas não teve efeito`);
            }
            if (!viewerState.caption(node, withTab).length) {
              fail(`${where.join('/')} step ${s}: caption vazio`);
            }
          }
          state = viewerState.goStep(node, state, 1);
        }

        // Voltar N passos tem de cair no mesmo lugar de avançar N passos.
        const forward = node.steps.reduce((acc) => viewerState.goStep(node, acc, 1), viewerState.create());
        if (forward.step !== 0) fail(`${where.join('/')}: stepper não fecha o ciclo (parou em ${forward.step})`);
      }
    })(model.menu, []);

    console.log('percorrido: %d viewers, %d steps, %d tabs', viewers, steps, tabs);

    /* Mídia referenciada que ainda não existe no disco. Não é erro — os
       arquivos chegam depois — mas é o inventário que o cliente precisa. */
    const missing = model.assets().filter(
      (src) => !fs.existsSync(path.join(projectRoot, src)));
    console.log('mídias referenciadas: %d, ausentes no disco: %d',
                model.assets().length, missing.length);
    if (process.argv.includes('--list-missing')) missing.forEach((m) => console.log('  · ' + m));

    if (failures) {
      console.error('\n%d falha(s).', failures);
      process.exit(1);
    }
    console.log('\nselftest ok.');
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
