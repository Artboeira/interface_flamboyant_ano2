#!/usr/bin/env python3
"""
psd_extract.py — rasterizador mínimo de PSD, sem psd-tools.

Por que existe: o PSD do cliente é a fonte da verdade do design, e precisamos
de duas coisas dele — os assets de marca em PNG transparente, e um render de
cada tela para conferir a interface lado a lado. O Pillow abre PSD mas não
consegue decodificar as camadas deste arquivo, então o decoder está aqui.

Dependência única: Pillow (já instalado). Sem numpy, sem psd-tools, sem rede.

Uso:
    python3 scripts/psd_extract.py assets     # extrai os PNGs de marca
    python3 scripts/psd_extract.py screens    # renderiza as 17 telas em docs/psd/
    python3 scripts/psd_extract.py tree       # imprime a árvore de camadas
    python3 scripts/psd_extract.py text       # lista todo o texto do PSD

Limites conhecidos (suficientes para este arquivo, não para PSD em geral):
  - só profundidade 8 bits, modo RGB;
  - compressão RAW (0) e RLE/PackBits (1) — sem ZIP;
  - blend modes ignorados (tudo composita como Normal);
  - efeitos de camada (sombra, brilho) não são aplicados;
  - camadas de preenchimento sólido (SoCo) são lidas pela cor, não pelo raster.
"""

import os
import struct
import sys
import unicodedata

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PSD = os.path.join(ROOT, 'mesa-atualizacao-sala-final.psd')

# Camadas de marca a extrair → destino. A primeira ocorrência (de cima para
# baixo) de cada nome é a usada; as demais são cópias posicionadas.
#
# A malha de meio-tom do Le Club Lacoste NÃO está aqui de propósito: no PSD
# ela é um raster de 3,5 MB recortado por máscara, que morre no meio da tela.
# Foi substituída por um padrão em CSS (ver `.viewer__texture`).
#
# `mask=True` descarta a cor e guarda só o alfa em branco: o PNG vira uma
# máscara CSS, e quem define a cor é o tema. É o que permite o wordmark sair
# branco sobre vinho e vinho sobre o fundo claro do Le Club Lacoste sem gerar
# dois arquivos — e resolve o wordmark ser composto em Utile, que ainda não
# temos.
BRAND_ASSETS = [
    ('Flamboyant_3Dlogo_PSD_rgb_3', 'assets/brand/star.png',            False),
    ('le_club_lacoste_1 copiar 3',  'assets/brand/seal-lacoste.png',    False),
    ('FLAMBOYANT',                  'assets/brand/wordmark.png',        True),
]


# ── leitura do arquivo ──────────────────────────────────────────────────────

def read_psd(path):
    """Devolve (largura, altura, [camadas]) com os offsets de canal resolvidos."""
    with open(path, 'rb') as fh:
        data = fh.read()

    if data[:4] != b'8BPS':
        raise SystemExit('não é um PSD: %s' % path)

    _nch, height, width, depth, mode = struct.unpack('>HIIHH', data[12:26])
    if depth != 8 or mode != 3:
        raise SystemExit('esperado 8 bits RGB; veio depth=%d mode=%d' % (depth, mode))

    pos = 26
    for _ in range(2):  # color mode data, image resources
        size = struct.unpack('>I', data[pos:pos + 4])[0]
        pos += 4 + size

    pos += 4          # layer and mask info length
    pos += 4          # layer info length
    count = abs(struct.unpack('>h', data[pos:pos + 2])[0])
    pos += 2

    layers = []
    for index in range(count):
        top, left, bottom, right = struct.unpack('>iiii', data[pos:pos + 16])
        pos += 16

        nchannels = struct.unpack('>H', data[pos:pos + 2])[0]
        pos += 2
        channels = [struct.unpack('>hI', data[pos + 6 * k:pos + 6 * k + 6])
                    for k in range(nchannels)]
        pos += nchannels * 6

        pos += 4                                   # assinatura de blend
        blend = data[pos:pos + 4].decode('latin1')
        pos += 4
        opacity, _clipping, flags = data[pos], data[pos + 1], data[pos + 2]
        pos += 4                                   # +1 de filler

        extra_len = struct.unpack('>I', data[pos:pos + 4])[0]
        pos += 4
        extra_end = pos + extra_len

        mask_len = struct.unpack('>I', data[pos:pos + 4])[0]
        mask = None
        if mask_len >= 16:
            mt, ml, mb, mr = struct.unpack('>iiii', data[pos + 4:pos + 20])
            mask = {'top': mt, 'left': ml, 'bottom': mb, 'right': mr,
                    'default': data[pos + 21] if mask_len >= 18 else 0}
        pos += 4 + mask_len

        ranges_len = struct.unpack('>I', data[pos:pos + 4])[0]
        pos += 4 + ranges_len

        name_len = data[pos]
        pascal_name = data[pos + 1:pos + 1 + name_len].decode('latin1')
        pos += (name_len + 1 + 3) // 4 * 4         # padding para múltiplo de 4

        section, unicode_name, fill = None, None, None
        while pos + 12 <= extra_end:
            if data[pos:pos + 4] not in (b'8BIM', b'8B64'):
                break
            key = data[pos + 4:pos + 8].decode('latin1')
            pos += 8
            size = struct.unpack('>I', data[pos:pos + 4])[0]
            pos += 4
            block = data[pos:pos + size]

            if key == 'lsct' and len(block) >= 4:
                section = struct.unpack('>I', block[:4])[0]
            elif key == 'luni':
                chars = struct.unpack('>I', block[:4])[0]
                unicode_name = block[4:4 + chars * 2].decode('utf-16-be').rstrip('\x00')
            elif key == 'SoCo':
                fill = _solid_color(block)

            pos += size
        pos = extra_end

        layers.append({
            'index': index,
            'name': unicode_name or pascal_name,
            'pascal': pascal_name,
            'left': left, 'top': top, 'right': right, 'bottom': bottom,
            'visible': not bool(flags & 2),
            'opacity': opacity, 'blend': blend,
            'section': section, 'fill': fill,
            'channels': channels, 'mask': mask,
        })

    # A seção de dados de canal segue imediatamente, na mesma ordem das camadas.
    for layer in layers:
        offsets = []
        for _cid, length in layer['channels']:
            offsets.append(pos)
            pos += length
        layer['offsets'] = offsets

    return data, width, height, layers


def _solid_color(block):
    """Lê o RGB de uma camada de preenchimento sólido do descritor SoCo."""
    channels = {}
    for tag in (b'Rd  ', b'Grn ', b'Bl  '):
        at = block.find(tag + b'doub')
        if at >= 0:
            channels[tag.strip().decode()] = struct.unpack('>d', block[at + 8:at + 16])[0]
    if len(channels) != 3:
        return None
    return (round(channels['Rd']), round(channels['Grn']), round(channels['Bl']))


# ── decodificação de canal ──────────────────────────────────────────────────

def decode_channel(data, offset, length, width, height):
    """Um canal → Image('L'). Devolve None se vazio ou comprimido em ZIP."""
    if width <= 0 or height <= 0 or length < 2:
        return None

    compression = struct.unpack('>H', data[offset:offset + 2])[0]
    body = data[offset + 2:offset + length]

    if compression == 0:
        buf = body[:width * height].ljust(width * height, b'\x00')

    elif compression == 1:
        counts = struct.unpack('>%dH' % height, body[:height * 2])
        cursor = height * 2
        out = bytearray()
        for row_bytes in counts:
            segment = body[cursor:cursor + row_bytes]
            cursor += row_bytes
            row = bytearray()
            k, end = 0, len(segment)
            while k < end:
                marker = segment[k]
                k += 1
                if marker < 128:                    # literal
                    row += segment[k:k + marker + 1]
                    k += marker + 1
                elif marker > 128:                  # repetição
                    row += bytes([segment[k]]) * (257 - marker)
                    k += 1
            del row[width:]
            out += bytes(row).ljust(width, b'\x00')
        buf = bytes(out)

    else:
        return None                                  # ZIP: não usado neste PSD

    return Image.frombytes('L', (width, height), buf)


def layer_image(data, layer):
    """Camada → Image('RGBA') no tamanho do próprio bbox, com máscara aplicada."""
    width = layer['right'] - layer['left']
    height = layer['bottom'] - layer['top']
    if width <= 0 or height <= 0:
        return None

    planes = {}
    for (cid, length), offset in zip(layer['channels'], layer['offsets']):
        if cid == -2 and layer['mask']:
            m = layer['mask']
            planes[-2] = decode_channel(data, offset, length,
                                        m['right'] - m['left'], m['bottom'] - m['top'])
        elif cid in (0, 1, 2, -1):
            planes[cid] = decode_channel(data, offset, length, width, height)

    if planes.get(0) is None:
        return None

    alpha = planes.get(-1) or Image.new('L', (width, height), 255)

    if planes.get(-2) is not None:
        m = layer['mask']
        full = Image.new('L', (width, height), m.get('default') or 0)
        full.paste(planes[-2], (m['left'] - layer['left'], m['top'] - layer['top']))
        alpha = ImageChops.multiply(alpha, full)

    if layer['opacity'] < 255:
        alpha = alpha.point(lambda v, op=layer['opacity']: v * op // 255)

    return Image.merge('RGBA', (planes[0],
                                planes.get(1) or planes[0],
                                planes.get(2) or planes[0],
                                alpha))


# ── árvore de grupos ────────────────────────────────────────────────────────

def build_tree(layers):
    """
    As camadas vêm de baixo para cima; um grupo aparece como
    [divisor, ...filhos, nome-do-grupo]. Lendo de cima para baixo, o nome vem
    primeiro e o divisor fecha.
    """
    def is_divider(l):
        return l['section'] == 3 or l['pascal'].startswith('</Layer')

    def is_group(l):
        return l['section'] in (1, 2)

    top_down = list(reversed(layers))
    cursor = [0]

    def parse():
        out = []
        while cursor[0] < len(top_down):
            layer = top_down[cursor[0]]
            if is_divider(layer):
                cursor[0] += 1
                return out
            cursor[0] += 1
            out.append({'layer': layer, 'children': parse() if is_group(layer) else None})
        return out

    return parse()


def find_group(tree, path):
    """Desce a árvore por nomes de grupo e devolve a lista de filhos."""
    nodes = tree
    for name in path:
        for node in nodes:
            if node['layer']['name'].strip() == name.strip():
                nodes = node['children']
                break
        else:
            raise SystemExit('grupo não encontrado: %r em %s'
                             % (name, [n['layer']['name'] for n in nodes]))
    return nodes


def find_layer(tree, name):
    """
    A MAIOR camada (não-grupo) com este nome. O PSD reusa o mesmo elemento em
    várias telas, em tamanhos diferentes — para virar asset queremos sempre a
    instância de maior resolução (o wordmark deitado da CAPA, 1477×167, e não
    o vertical da lateral, 94×825).
    """
    best = None
    best_area = -1

    def walk(nodes):
        nonlocal best, best_area
        for node in nodes:
            if node['children'] is not None:
                walk(node['children'])
                continue
            layer = node['layer']
            if layer['name'].strip() != name.strip():
                continue
            area = (layer['right'] - layer['left']) * (layer['bottom'] - layer['top'])
            if area > best_area:
                best, best_area = layer, area

    walk(tree)
    return best


# ── composição ──────────────────────────────────────────────────────────────

def compose(data, nodes, size):
    """Composita um grupo inteiro (respeitando visibilidade) sobre branco."""
    canvas = Image.new('RGBA', size, (255, 255, 255, 255))
    _compose_into(data, canvas, nodes, size)
    return canvas.convert('RGB')


def _compose_into(data, canvas, nodes, size):
    for node in reversed(nodes):                      # de baixo para cima
        layer = node['layer']
        if not layer['visible']:
            continue

        if node['children'] is not None:
            _compose_into(data, canvas, node['children'], size)
            continue

        # Preenchimento sólido de página inteira: pinta a cor, não há raster.
        if layer['fill'] and (layer['right'] - layer['left']) >= size[0] - 2:
            canvas.alpha_composite(Image.new('RGBA', size, layer['fill'] + (255,)))
            continue

        image = layer_image(data, layer)
        if image is None:
            continue

        full = Image.new('RGBA', size, (0, 0, 0, 0))
        full.paste(image, (layer['left'], layer['top']))   # paste aceita offset negativo
        canvas.alpha_composite(full)


def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return ''.join(c if c.isalnum() else '-' for c in text).strip('-').lower()


# ── comandos ────────────────────────────────────────────────────────────────

def screen_paths(tree):
    """Todos os caminhos de grupo que representam uma tela do PSD."""
    paths = []
    for node in tree:
        name = node['layer']['name']
        if name == '_old':
            # O grupo `_old` guarda a versão mais recente das telas de mídia
            # (aba ativa em semibold, contador maior). Vale como referência.
            for child in node['children']:
                paths.append(['_old', child['layer']['name']])
        elif name in ('CAPA', 'TELA_01') or name.startswith('TELA'):
            paths.append([name])
        elif node['children']:
            for child in node['children']:
                paths.append([name, child['layer']['name']])
    return paths


def cmd_assets(data, size, tree):
    for name, dest, as_mask in BRAND_ASSETS:
        layer = find_layer(tree, name)
        if layer is None:
            print('  ! camada ausente: %s' % name)
            continue
        image = layer_image(data, layer)
        if image is None:
            print('  ! sem raster: %s' % name)
            continue
        if as_mask:
            alpha = image.getchannel('A')
            image = Image.merge('RGBA', (alpha.point(lambda _: 255),) * 3 + (alpha,))
        out = os.path.join(ROOT, dest)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        image.save(out)
        print('  %-34s → %-38s (%dx%d)%s'
              % (name, dest, image.width, image.height, '  [máscara]' if as_mask else ''))


def cmd_screens(data, size, tree):
    out_dir = os.path.join(ROOT, 'docs', 'psd')
    os.makedirs(out_dir, exist_ok=True)
    for path in screen_paths(tree):
        image = compose(data, find_group(tree, path), size)
        name = slug('__'.join(path)) + '.png'
        image.save(os.path.join(out_dir, name))
        print('  docs/psd/%-46s %s' % (name, ' / '.join(path)))


def cmd_tree(data, size, tree):
    def walk(nodes, depth=0):
        for node in nodes:
            layer = node['layer']
            mark = 'ON ' if layer['visible'] else 'off'
            kind = '[G] ' if node['children'] is not None else '    '
            box = '' if node['children'] is not None else '  (%d,%d)-(%d,%d)' % (
                layer['left'], layer['top'], layer['right'], layer['bottom'])
            print('  ' * depth + '%s %s%s%s' % (mark, kind, layer['name'], box))
            if node['children'] is not None:
                walk(node['children'], depth + 1)
    walk(tree)


def cmd_text(data, size, tree):
    """Todo o texto do PSD, na ordem em que aparece no arquivo."""
    import re
    seen = []
    for match in re.finditer(b'Txt TEXT', data):
        at = match.end()
        length = struct.unpack('>I', data[at:at + 4])[0]
        if 0 < length < 4000:
            value = data[at + 4:at + 4 + length * 2].decode('utf-16-be', 'ignore').rstrip('\x00')
            if value not in seen:
                seen.append(value)
                print(repr(value))


COMMANDS = {'assets': cmd_assets, 'screens': cmd_screens, 'tree': cmd_tree, 'text': cmd_text}


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else 'assets'
    if command not in COMMANDS:
        raise SystemExit('uso: psd_extract.py [%s]' % ' | '.join(COMMANDS))
    if not os.path.exists(PSD):
        raise SystemExit('PSD não encontrado: %s' % PSD)

    data, width, height, layers = read_psd(PSD)
    tree = build_tree(layers)
    print('%s — %dx%d, %d camadas' % (os.path.basename(PSD), width, height, len(layers)))
    COMMANDS[command](data, (width, height), tree)


if __name__ == '__main__':
    main()
