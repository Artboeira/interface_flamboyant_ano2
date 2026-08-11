# CLAUDE.md — Flamboyant · Mesa da Sala de Vendas

Instruções para quem (ou o que) for mexer neste projeto. Leia antes de editar.

---

## O que é

Mesa de toque para a **sala de vendas** do Flamboyant (cliente NSI, produção
Estúdio AB). Não confundir com o totem da Feira ABRASCE, que fica em
`../../interface_feira` — este projeto herdou a arquitetura daquele, mas o
conteúdo, o layout e o modelo de navegação são outros.

**Fonte da verdade do desenho:** `mesa-atualizacao-sala-final.psd`, na raiz.
1920×1080, 949 camadas, 17 telas. Quando código e PSD divergirem, o PSD ganha —
e a divergência vai para `docs/CONTEUDO.md`, seção 5.

---

## Regras inegociáveis

1. **Vanilla. Sem build, sem dependência de runtime, sem rede.**
   A mesa roda offline num PC embarcado. Nada de npm, bundler, CDN, Google
   Fonts ou Typekit. Toda fonte e todo asset é self-hosted.

2. **A dependência aponta para dentro.**
   ```
   core/  não conhece o DOM, não conhece window, não faz I/O
   ui/    conhece core/ e o DOM
   app.js compõe os dois
   ```
   `node js/core/content.js --selftest` roda sem browser. Se um dia parar de
   rodar, é porque a camada de negócio passou a depender de infraestrutura — e
   aí a arquitetura é que está errada, não o teste.

3. **Conteúdo mora no `config.json`, nunca no código.**
   Mídia nova, ambiente novo, pavimento novo: tudo é edição de JSON. Se uma
   mudança de conteúdo exigir mexer em `.js`, o modelo está errado.

4. **Medidas em `rem`, nunca em `px`.**
   `:root { font-size: calc(100vh / 108) }` → `1rem = 1%` da altura do
   viewport, ou seja **px do PSD ÷ 10 = rem**. As únicas exceções legítimas
   são os hairlines de `1.5px`, que são constante física.

5. **Uma curva de easing só, em todo o produto:** `cubic-bezier(0.22, 1, 0.36, 1)`.
   Uma distância só nas entradas: `1.8rem`. Sem bounce, sem spring, sem
   frosted glass, sem emoji.

---

## Como o movimento é construído

O padrão vem do totem da feira e é a assinatura visual do produto:

- **Cross-dissolve de 600ms** entre telas. O router destrói e reconstrói a tela
  a cada navegação, inclusive no VOLTAR — é de propósito, e é por isso que as
  entradas se repetem nos dois sentidos.
- **Escada de entrada:** estrutura → conteúdo → cromo. O rodapé sempre por
  último. Delays em `0 → 280 → 480 → 640ms`.
- **`both` de fill-mode** em toda entrada, senão o elemento pisca durante o delay.
- **Truque das duas camadas:** o wrapper carrega o transform de *posição*, o
  filho carrega o transform *animado*. É o que permite a rosácea girar para
  sempre e ainda animar a entrada. Vale para `.star-img`, `.seal img` e
  `.side-wordmark__mark` — cuidado ao mexer nesses três.
- **`prefers-reduced-motion`** desliga tudo, inclusive os giros e a troca de
  painel (que continua funcionando, só sem deslizar).

Velocidades de giro (`--fl-spin-*`) são primas entre si de propósito: assim as
três rosáceas do Le Club Lacoste nunca sincronizam.

---

## Cuidados que já custaram tempo

**`url()` dentro de custom property** resolve contra a *folha de estilo*, não
contra o documento. `--fl-wordmark-src: url("assets/...")` usado em
`css/styles.css` vira `/css/assets/...` → 404 → a máscara apaga o elemento
inteiro, sem erro no console. Por isso `assetUrl()` em `screens.js` absolutiza
o caminho antes. Se um asset em máscara ou background sumir, é aqui.

**Chrome headless não entrega o viewport que se pede.** `--window-size=1920,1080`
dá viewport de 993px, e como tudo escala por `100vh`, o layout sai 8% menor sem
aviso. Some-se a isso que o headless redimensiona o viewport durante a carga e
que `--screenshot` captura no tamanho da janela. As três calibragens estão
documentadas no topo de `scripts/shots.sh` — use o script, não invente flags.

**`--virtual-time-budget` congela transições CSS.** Animações e transições não
avançam com o tempo virtual, então uma captura headless mostra o estado
inicial. Para verificar interação em headless, passe
`--force-prefers-reduced-motion` e a transição vira instantânea.

**A troca de painel é largura, não posição.** Galeria sempre à esquerda,
planta sempre à direita; o que muda é qual está expandida. Modelar como "painel
grande e painel pequeno trocando de lado" quebra a animação e contraria o PSD.

---

## Conferir uma mudança visual

Sempre lado a lado com o PSD, no mesmo grid de 1920×1080:

```bash
python3 -m http.server 8791 --bind 127.0.0.1 &
python3 scripts/psd_extract.py screens    # docs/psd/   — referência
scripts/shots.sh 8791                     # docs/shots/ — o código
```

Para um diff de alinhamento, sobreponha os dois em canais diferentes
(vermelho = PSD, ciano = código): o que estiver alinhado sai cinza.

O `psd_extract.py` é um rasterizador de PSD escrito à mão (Pillow não decodifica
as camadas deste arquivo). Suporta compressão RAW e RLE, ignora blend modes e
efeitos. Suficiente para este PSD, não para PSD em geral.

---

## Antes de dar por pronto

- [ ] `node js/core/content.js --selftest` passa
- [ ] `scripts/shots.sh` bate com `docs/psd/` nas telas tocadas
- [ ] nenhuma medida em `px` foi introduzida (exceto hairline)
- [ ] nenhuma requisição de rede foi introduzida
- [ ] `prefers-reduced-motion` continua zerando o movimento
- [ ] pendências novas registradas em `docs/CONTEUDO.md`
