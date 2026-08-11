# Flamboyant — Mesa Interativa (Sala de Vendas)

Mesa de toque para a sala de vendas do Flamboyant. HTML/CSS/JS puro, **sem
build, sem dependência de runtime, offline**. Roda em Chrome kiosk no PC
embarcado da mesa (Full HD 1920×1080, landscape, toque infravermelho).

Cliente NSI · produção Estúdio AB.

---

## Rodar

```bash
python3 -m http.server 8791 --bind 127.0.0.1
# → http://127.0.0.1:8791/
```

Na mesa (Windows), o atalho de produção é `scripts/kiosk-launch.bat`; ele sobe
o `bin/miniserve.exe` em loopback e abre o Chrome em modo kiosk. Detalhes de
instalação em [docs/KIOSK.md](docs/KIOSK.md).

---

## As telas

Dezessete telas do PSD, três renderers:

| Renderer | Cobre |
|---|---|
| `splash` | a capa |
| `menu`   | menu raiz, submenu de cada torre, submenu da fachada |
| `viewer` | todas as telas de mídia, incluindo o Le Club Lacoste |

O que muda entre elas é o **conteúdo**, não o código: quem descreve a árvore é
o `config.json`.

```
CAPA
└── LEGÍTIMO · AUTÊNTICO · LE CLUB LACOSTE
    ├── torre: SUBSOLOS · ÁREAS COMUNS · APARTAMENTOS · FACHADA
    │   ├── SUBSOLOS      stepper de pavimento  + menu de ambientes
    │   ├── ÁREAS COMUNS  stepper vertical      + menu de ambientes
    │   ├── APARTAMENTOS  stepper por metragem
    │   └── FACHADA → IMAGEM · VÍDEO
    └── LE CLUB LACOSTE   tema claro, três quadras
```

### A tela de mídia

Quatro eixos de navegação convivem na mesma tela:

- **abas** no topo — o ambiente (garagem, car wash, spa…);
- **stepper** à direita — o pavimento ou a metragem;
- **setas dentro do painel** — as imagens daquele ambiente, a partir da segunda;
- **toque no painel recolhido** — ele cresce e o outro encolhe.

A galeria fica sempre à esquerda e a planta sempre à direita; o que troca é
qual das duas está expandida. É o desenho do PSD (`TELA_04 MÍDIA FOTOS` e
`MÍDIA PLANTAS` são o mesmo layout com as larguras invertidas).

---

## Conteúdo

Todo o conteúdo vive no `config.json`. Para publicar mídia nova **não se mexe
em código**: solta o arquivo na pasta e acrescenta o caminho no array.

```jsonc
{ "label": "CAR WASH",
  "gallery": [                                  // fotos do ambiente
    { "src": "assets/content/legitimo/subsolos/ss1/car-wash-01.jpg" },
    { "src": "assets/content/legitimo/subsolos/ss1/car-wash-02.jpg" }
  ],
  "plans":   [                                  // plantas do mesmo ambiente
    { "src": "assets/content/legitimo/subsolos/ss1/planta-car-wash.png" }
  ] }
```

As setas de navegação do painel aparecem sozinhas a partir da segunda imagem.
Vídeo não tem tipo próprio — é reconhecido pela extensão (`.mp4`, `.webm`,
`.mov`, `.m4v`), e vídeos ficam em `videos/` (fora do versionamento, por peso).

Enquanto um arquivo não existe, o painel mostra o placeholder cinza. Hoje as
**152 mídias referenciadas ainda não foram entregues** — a interface inteira
navega mesmo assim. Ver [docs/CONTEUDO.md](docs/CONTEUDO.md) para o inventário
e as pendências de texto.

---

## Estrutura

```
config.json          a árvore de conteúdo — é aqui que o conteúdo se edita
index.html           ponto de entrada; nenhuma tela é escrita em HTML
assets/brand/        rosácea, selo Lacoste, wordmark (extraídos do PSD)
assets/content/      mídia por torre / seção / pavimento / ambiente
videos/              vídeos (não versionados)
css/
  colors_and_type.css   tokens do design system do Estúdio AB
  theme-flamboyant.css  paleta, geometria e tempos deste projeto
  styles.css            layout, componentes e todas as animações
js/
  core/content.js       árvore de conteúdo — sem DOM, roda em Node
  core/viewer-state.js  estado da tela de mídia — sem DOM, roda em Node
  ui/screens.js         os três renderers
  ui/router.js          pilha de navegação + cross-dissolve
  app.js                composição, toque, ociosidade
scripts/
  psd_extract.py     rasteriza o PSD: assets de marca e render das telas
  shots.sh           captura as telas do código para conferência
  kiosk-launch.*     launchers de produção e desenvolvimento
docs/
  KIOSK.md           instalação na mesa
  CONTEUDO.md        inventário de mídia e pendências
  psd/               render de cada tela do PSD (referência visual)
```

A dependência aponta sempre para dentro: `core/` não conhece o DOM, `ui/`
conhece `core/` e o DOM, `app.js` compõe os dois. O teste do núcleo roda sem
browser justamente para provar isso:

```bash
node js/core/content.js --selftest                  # valida a árvore inteira
node js/core/content.js --selftest --list-missing   # + lista as mídias que faltam
```

---

## Conferência visual

Os renders do PSD e as capturas do código ficam lado a lado, no mesmo grid de
1920×1080:

```bash
python3 scripts/psd_extract.py screens   # docs/psd/   — referência
scripts/shots.sh 8791                    # docs/shots/ — o que o código produz
```

O `shots.sh` carrega três calibragens do Chrome headless que, se erradas,
falham em silêncio (viewport menor que a janela, escala raiz oscilando, captura
no tamanho da janela). Estão documentadas no topo do próprio script.

Atalhos de desenvolvimento, sem efeito em produção:

| Parâmetro | Efeito |
|---|---|
| `?screen=viewer&path=legitimo/subsolos` | entra direto numa tela |
| `?rem=10` | fixa a escala raiz no grid do PSD (conferência) |
| `?kiosk=1` | esconde o cursor |

Teclado (a mesa não tem, é só para o desenvolvimento): `Esc`/`Backspace`
voltam, `←`/`→` passam a mídia do painel expandido, `↑`/`↓` movem o stepper.

---

## Pendências

- **Utile** — instalada (arquivos do cliente), cobertura de caracteres completa.
  Faltam os pesos **Regular (400)** e **Semibold (600)**, que são os que o PSD
  usa; vieram Light e Bold. O texto corrente sai mais leve que o desenho até
  eles chegarem. Detalhes em [docs/CONTEUDO.md](docs/CONTEUDO.md); para
  conferir, abra `http://127.0.0.1:8791/docs/fontproof.html`.
- **Mídia** — 152 caminhos previstos, nenhum arquivo entregue.
- **Ambientes dos apartamentos** — o PSD só desenhou o menu de ambientes numa
  das plantas de cada torre. Ver [docs/CONTEUDO.md](docs/CONTEUDO.md).
