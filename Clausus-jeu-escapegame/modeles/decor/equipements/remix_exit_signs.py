"""Remix the existing Blockbench sign: remix its atlas arrow on a clean green background, preserving geometry/UVs.
Run from anywhere with Python 3 + Pillow. Originals stay unchanged.
"""
import base64
import copy
import io
import json
from pathlib import Path
import struct
import random
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent
model = json.loads((SOURCE / 'exit_sign.bbmodel').read_text())
atlas = Image.open(io.BytesIO(base64.b64decode(model['textures'][0]['source'].split(',')[1]))).convert('RGBA')
original = (SOURCE / 'exit_sign.glb').read_bytes()
json_size = struct.unpack_from('<I', original, 12)[0]
gltf = json.loads(original[20:20 + json_size])
bin_start = 20 + json_size
bin_size = struct.unpack_from('<I', original, bin_start)[0]
binary = original[bin_start + 8:bin_start + 8 + bin_size]

for direction, rotation in [('up', 180), ('left', -90), ('right', 90)]:
    image = atlas.copy()
    box = (116, 14, 158, 74)
    arrow = atlas.crop(box)
    mask = Image.eval(arrow.getchannel('R'), lambda p: 255 if p > 190 else 0)
    arrow.putalpha(mask)
    arrow = arrow.rotate(rotation, expand=True, resample=Image.Resampling.NEAREST)
    arrow.thumbnail((42, 60), Image.Resampling.NEAREST)
    # Repaint the WHOLE diffuser background, avoiding the original baked arrow shadow
    # and rectangular highlights. Keep the runner and door's exact cream pixels.
    grain = random.Random(104)
    for y in range(96):
        for x in range(240):
            pixel = atlas.getpixel((x, y))
            old_arrow = box[0] <= x < box[2] and box[1] <= y < box[3]
            if pixel[0] > 190 and not old_arrow:
                continue
            noise = grain.randint(-2, 2)
            image.putpixel((x, y), (15 + noise, 122 + noise, 67 + noise, 255))
    image.alpha_composite(arrow, (116 + (42 - arrow.width) // 2, 14 + (60 - arrow.height) // 2))
    out = io.BytesIO(); image.save(out, format='PNG'); png = out.getvalue()
    name = f'exit_sign_{direction}'
    bb = copy.deepcopy(model)
    bb['name'] = name
    bb['textures'][0]['name'] = f'{name}_atlas.png'
    bb['textures'][0]['source'] = 'data:image/png;base64,' + base64.b64encode(png).decode()
    (SOURCE / f'{name}.bbmodel').write_text(json.dumps(bb, ensure_ascii=False, separators=(',', ':')))
    # Reuse every mesh accessor and UV. Replace the embedded image buffer view.
    doc = copy.deepcopy(gltf)
    payload = binary + b'\0' * (-len(binary) % 4)
    view = doc['bufferViews'][doc['images'][0]['bufferView']]
    view['byteOffset'], view['byteLength'] = len(payload), len(png)
    payload += png
    doc['buffers'][0]['byteLength'] = len(payload)
    payload += b'\0' * (-len(payload) % 4)
    metadata = json.dumps(doc, separators=(',', ':')).encode()
    metadata += b' ' * (-len(metadata) % 4)
    data = struct.pack('<III', 0x46546c67, 2, 28 + len(metadata) + len(payload))
    data += struct.pack('<II', len(metadata), 0x4e4f534a) + metadata
    data += struct.pack('<II', len(payload), 0x004e4942) + payload
    for folder in [SOURCE, ROOT / 'packages/game/assets']:
        (folder / f'{name}.glb').write_bytes(data)
