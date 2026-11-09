import * as THREE from 'three';
import { loadModel } from './decor.js';
import { ROOMS, FH, SECURITY_MONITORS, SECURITY_DESK_GAP, SECURITY_DESK_H } from './hopital/plan.js';
import { layoutOf } from './hopital/mobilier.js';

// Reuse the Blockbench CRTs, with a separate low-resolution live picture per lens.
export async function createSecurityMonitors(scene, renderer, loader, hospital, heads, hidden = [], body = null) {
  const room = ROOMS[0].find((r) => r[4] === 'Poste de sécurité 001');
  const { cx, cz, fwd, right, hv } = layoutOf(0, ...room);
  const model = await loadModel(loader, 'terminal');
  const feeds = heads.map((head, i) => {
    const terminal = model.clone(true);
    for (const name of ['pc_case', 'keyboard', 'mouse']) {
      const part = terminal.getObjectByName(name);
      part.removeFromParent();
    }
    // Removing the desktop case also removes the CRT's support (15 cm on the source model).
    // Seat the remaining stand on the counter using its actual bounds, including group transforms.
    const bottom = new THREE.Box3().setFromObject(terminal).min.y;
    const u = SECURITY_MONITORS[i];
    terminal.position.set(cx + right[0] * u + fwd[0] * (hv - SECURITY_DESK_GAP), -FH + SECURITY_DESK_H - bottom,
      cz + right[1] * u + fwd[1] * (hv - SECURITY_DESK_GAP));
    terminal.rotation.y = Math.atan2(fwd[0], fwd[1]) + Math.PI;
    scene.add(terminal);
    const target = new THREE.WebGLRenderTarget(256, 192, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
    });
    const screen = terminal.getObjectByName('screen');
    screen.material = new THREE.MeshBasicMaterial({ color: 0x07100c });
    screen.geometry.computeBoundingBox();
    const b = screen.geometry.boundingBox;
    const picture = new THREE.Mesh(new THREE.PlaneGeometry((b.max.x - b.min.x) * 0.86, (b.max.y - b.min.y) * 0.84),
      new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false }));
    picture.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.max.z + 0.002);
    screen.add(picture);
    const camera = new THREE.PerspectiveCamera(75, 4 / 3, 0.04, 65);
    // Move past the lens so the housing cannot obstruct its own picture.
    camera.position.set(0, 0, -0.15);
    head.add(camera);
    return { terminal, target, camera };
  });
  let next = 0, elapsed = 1;
  function update(dt, viewer, enabled) {
    if (!enabled || viewer.position.y > -FH / 2 || Math.hypot(viewer.position.x - cx, viewer.position.z - cz) > 9) return;
    elapsed += dt;
    if (elapsed < 1 / 30) return;
    elapsed = 0;
    const feed = feeds[next++ % feeds.length];
    const objects = [...hidden, ...feeds.map((f) => f.terminal)];
    const visibility = objects.map((o) => o.visible);
    const floors = hospital.H.surveillanceFloors;
    const floorVisibility = floors.map((o) => o.visible);
    const bodyVisible = body?.visible;
    const previous = renderer.getRenderTarget(), auto = renderer.shadowMap.autoUpdate;
    try {
      objects.forEach((o) => { o.visible = false; });
      floors.forEach((o) => { o.visible = true; });
      if (body) body.visible = true;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(feed.target);
      renderer.clear();
      renderer.render(scene, feed.camera);
    } finally {
      renderer.setRenderTarget(previous);
      renderer.shadowMap.autoUpdate = auto;
      objects.forEach((o, i) => { o.visible = visibility[i]; });
      floors.forEach((o, i) => { o.visible = floorVisibility[i]; });
      if (body) body.visible = bodyVisible;
    }
  }
  return { update, feeds };
}
