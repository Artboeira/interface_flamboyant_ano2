# Conteúdo — inventário e pendências

Este documento é a ponte entre o PSD e o `config.json`. Registra o que foi
transcrito, o que foi deliberadamente alterado e o que ainda falta do cliente.

Para o inventário sempre atualizado, direto do código:

```bash
node js/core/content.js --selftest --list-missing
```

Hoje: **11 telas de mídia, 38 pavimentos/opções, 78 ambientes, 152 arquivos
referenciados — 0 entregues.** A interface navega inteira com placeholders.

---

## 1. Onde cada arquivo entra

O caminho no `config.json` é a única coisa que liga o arquivo à tela. A
convenção adotada:

```
assets/content/<torre>/<seção>/<pavimento>/<ambiente>-01.jpg      foto
assets/content/<torre>/<seção>/<pavimento>/planta-<ambiente>.png  planta
assets/content/<torre>/fachada/fachada-01.jpg                     fachada
videos/<torre>-fachada.mp4                                        vídeo
```

Exemplo:

```
assets/content/legitimo/subsolos/ss1/car-wash-01.jpg
assets/content/legitimo/subsolos/ss1/planta-car-wash.png
```

Nada disso é obrigatório — o `config.json` aceita qualquer caminho. A convenção
existe só para que a pasta seja navegável por quem for soltar os arquivos.

**Mais de uma foto por ambiente:** acrescentar entradas no array `gallery`. As
setas dentro do painel aparecem sozinhas a partir da segunda imagem.

```jsonc
"gallery": [
  { "src": ".../car-wash-01.jpg" },
  { "src": ".../car-wash-02.jpg" },
  { "src": ".../car-wash-03.jpg" }
]
```

**Vídeo** não tem tipo próprio: é reconhecido pela extensão (`.mp4`, `.webm`,
`.mov`, `.m4v`). Entra num `gallery` como qualquer outra mídia. Toca com som,
porque o launcher passa `--autoplay-policy=no-user-gesture-required`.

---

## 2. A árvore, como está no PSD

### Legítimo

| Seção | Pavimentos / opções | Ambientes |
|---|---|---|
| Subsolos | SS3 · SS2 · SS1 · TÉRREO | SS3 e SS2: garagem · SS1: garagem, lobby legítimo, car wash, port cochère · Térreo: garagem, bicicletário |
| Áreas comuns | 34 · 33 · 2 · Lazer executivo · Lazer comum | 34: academia · 33: salão de festas · 2: pilates, sala de massagem, sauna seca, spa, espaço beauty, yoga e pilates solo · Lazer executivo: salão de festas, brinquedoteca, piscina adulto · Lazer comum: mini mercado, churrasqueira, playground, piscina infantil, espaço pet |
| Apartamentos | 872 (duplex superior e inferior) · 461 (tipo house) · 420 (cozinha fechada, padrão, opção) | só a opção de 420 tem menu: varanda, living, sala íntima, suíte master |
| Fachada | imagem · vídeo | — |

### Autêntico

| Seção | Pavimentos / opções | Ambientes |
|---|---|---|
| Subsolos | SS3 · SS2 · SS1 · TÉRREO | igual ao Legítimo, com **lobby autêntico** no lugar de lobby legítimo |
| Áreas comuns | 31 · 30 · Lazer executivo · Lazer comum | 31: sauna seca, sala de massagem, spa, espaço beauty, pilates, yoga · 30: ergonometria, musculação · Lazer executivo: salão de festas gourmet, salão de festas, brinquedoteca, piscina adulto · Lazer comum: igual ao Legítimo |
| Apartamentos | 649 (duplex sup./inf.) · 530 (duplex sup./inf.) · 330 (tipo house) · 306 (padrão, opção) · 274 (tipo house) · 250 (padrão, opção) | só as opções de 306 (suíte master, living, varanda) e 250 (suíte master, living) têm menu |
| Fachada | imagem · vídeo | — |

### Le Club Lacoste

Tela única, tema claro: quadra de tênis · quadra esportiva · quadra de areia.

---

## 3. Alterações deliberadas em relação ao texto do PSD

Três, todas por serem erros visíveis num equipamento que fica na frente do
cliente. Se o cliente preferir o texto original, é uma linha no `config.json`.

| PSD | No config | Por quê |
|---|---|---|
| `WELNESS` (Legítimo, nível 2) | `WELLNESS` | Grafia errada; o próprio PSD escreve `WELLNESS` no Autêntico |
| `PORT CORCHERE` | `PORT COCHÈRE` | Grafia errada; o PSD alterna entre `PORT CORCHERE` e `port cochere` na mesma tela |
| `872M2`, `420 M2` | `872 M²`, `420 M²` | Notação de metro quadrado |

Além dessas, os rótulos foram transcritos literalmente, inclusive a caixa
baixa de `garagem` e `legítimo`/`autêntico`, que no PSD são intencionais.

---

## 4. Pendências com o cliente

### 4.1 Ambientes dos apartamentos — **falta informação**

O PSD desenhou o menu de ambientes numa planta só de cada torre:

- Legítimo: apenas em `APARTAMENTO OPÇÃO 3 SUÍTES · 420 M²`
  (varanda | living | sala íntima | suíte master)
- Autêntico: apenas em `306 M²` (suíte master | living | varanda) e
  `250 M²` (suíte master | living)

Os outros 11 tipos de apartamento ficaram com **um ambiente sem rótulo** — a
barra superior não aparece e o painel mostra a foto e a planta direto. Isso é
transcrição fiel, não decisão de projeto: **não inventamos a lista de ambientes
dos demais tipos.**

Quando o cliente informar, é só preencher os `tabs` correspondentes no
`config.json`; nenhuma mudança de código é necessária.

### 4.2 Fonte Utile — **instalada, faltam dois pesos**

O PSD é composto em Utile (de Sibylle Hagmann), nos pesos **Regular (400)** e
**Semibold (600)**.

**Instalado (11/08):** arquivos fornecidos pelo cliente, em `css/fonts/utile/`.
Cobertura de caracteres completa — 524 glifos, todos os acentos, `|`, `²`.
Conferido em `docs/fontproof.html`: zero ausentes. A responsabilidade pelo
licenciamento é do cliente, que forneceu os arquivos.

**O que falta:** vieram **Light (300)** e **Bold (700)** — justamente os dois
pesos que o desenho não usa. Medindo a espessura de haste com a altura de
caixa alta igualada em 17px:

| | haste |
|---|---|
| PSD (o desenho) | 2,0 px |
| Utile Light | 1,0 px |
| Utile Bold | 4,0 px |

O arranjo em uso hoje — Light no texto corrente, Bold no destaque — é o melhor
possível com o que existe, mas o texto corrente sai mais leve que no desenho.

**Pedir ao cliente:** os pesos **Regular (400)** e **Semibold (600)** da mesma
família. Chegando, é somar dois `@font-face` em `css/theme-flamboyant.css` e
devolver `--fl-w-regular` para 400 e `--fl-w-semibold` para 600. Nada mais muda.

**Conferir sempre em** `docs/fontproof.html` (com o servidor no ar,
`http://127.0.0.1:8791/docs/fontproof.html`). A página compõe o texto real da
interface e mede glifo a glifo. Enquanto disser "ausente(s)", a fonte não está
pronta para a mesa.

**Corpos de texto.** Foram calibrados contra o PSD medindo altura de caixa alta,
não escolhidos a olho — a Utile tem caixa alta menor que a Helvetica em relação
ao corpo, e os valores herdados do proxy saíam todos pequenos. Estado atual,
com a Utile no ar (PSD vs interface, em px):

| elemento | PSD | interface |
|---|---|---|
| aba de ambiente | 18 | 17 |
| stepper | 18 | 17 |
| rótulo do painel | 17 | 16 |
| rótulo inferior | 13 | 14 |
| título da torre | 29 | 31 |
| pill / VOLTAR | 14 | 13 |

Os centros verticais batem exatamente. Se os pesos Regular/Semibold entrarem,
vale refazer essa medição — a métrica muda com o peso.

### 4.3 Mídia — 152 arquivos

Nenhum entregue. Lista completa e atualizada:

```bash
node js/core/content.js --selftest --list-missing
```

---

## 5. Decisões de desenho que vieram do PSD e destoam do design system

Registradas para não parecerem descuido numa revisão futura. O PSD do cliente
é a fonte da verdade, como já era no totem da feira.

- **Cantos arredondados** — 14px nos painéis de mídia e 8px nas pills, contra o
  `border-radius: 0` do design system do Estúdio AB.
- **Setas com orientações diferentes** — horizontais nos subsolos e
  apartamentos, verticais nas áreas comuns. Mantido como no PSD, por decisão
  explícita.
- **Tela clara de co-branding** — o Le Club Lacoste inverte para fundo `#EDEDED`
  texturizado, com o verde da Lacoste. É paleta do parceiro, não do Flamboyant.
- **O chip preto "marcação"** que aparece no centro de cada painel no PSD é
  anotação de diagramação, não elemento de interface. Não foi implementado.

- **A malha de meio-tom do Le Club Lacoste é gerada em CSS**, não importada do
  PSD. No arquivo original ela é um raster de 3,5 MB em Color Burn a 30% com
  uma máscara de camada que a recorta num retângulo: a malha cobre pouco mais
  da metade esquerda da tela e termina num degrau visível. Além disso, a
  densidade sobe muito justamente na faixa do menu de ambientes, que passa por
  cima dela e fica difícil de ler.

  A versão em CSS mantém o passo de 8px medido no PSD e o contraste da região
  calma dele (ponto ~15 níveis abaixo do fundo), só que uniforme e cobrindo a
  tela inteira. Ajustável em três tokens no `theme-flamboyant.css`:
  `--fl-dot`, `--fl-dot-pitch`, `--fl-dot-size`.

  Se o cliente quiser o recorte original de volta, é caso de pedir a camada
  sem máscara — não de reimportar a que está no PSD.
