import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = new URL('../../../modeles/decor/equipements/', import.meta.url);
const runtime = new URL('../assets/', import.meta.url);
function glb(data) {
  const size = data.readUInt32LE(12);
  assert.equal(data.readUInt32LE(8), data.length);
  return { doc: JSON.parse(data.subarray(20, 20 + size)), bin: data.subarray(28 + size) };
}
const original = glb(readFileSync(new URL('exit_sign.glb', source)));
const originalBB = JSON.parse(readFileSync(new URL('exit_sign.bbmodel', source)));
for (const direction of ['up', 'left', 'right']) test(`exit sign ${direction}: preserves original geometry, UVs and Blockbench source`, () => {
  const file = `exit_sign_${direction}`;
  const data = readFileSync(new URL(`${file}.glb`, source));
  assert.deepEqual(data, readFileSync(new URL(`${file}.glb`, runtime)));
  const { doc, bin } = glb(data);
  for (const key of ['nodes', 'meshes', 'accessors', 'materials', 'textures']) assert.deepEqual(doc[key], original.doc[key]);
  const imageView = doc.images[0].bufferView;
  doc.bufferViews.forEach((view, i) => {
    if (i === imageView) return;
    assert.deepEqual(view, original.doc.bufferViews[i]);
    const offset = view.byteOffset ?? 0;
    assert.deepEqual(bin.subarray(offset, offset + view.byteLength), original.bin.subarray(offset, offset + view.byteLength));
  });
  const bb = JSON.parse(readFileSync(new URL(`${file}.bbmodel`, source)));
  assert.deepEqual(bb.elements, originalBB.elements);
  assert.deepEqual(bb.outliner, originalBB.outliner);
  const image = doc.bufferViews[imageView];
  assert.deepEqual(bin.subarray(image.byteOffset, image.byteOffset + image.byteLength), Buffer.from(bb.textures[0].source.split(',')[1], 'base64'));
  assert.notEqual(bb.textures[0].source, originalBB.textures[0].source);
});
