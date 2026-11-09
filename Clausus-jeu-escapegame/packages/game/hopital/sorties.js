import * as THREE from 'three';
import { loadModel } from '../decor.js';
import { FH, CEIL, wx, wz, toF0 } from './plan.js';

// Coordinates in each floor's drawing. The front faces the approaching player;
// arrows are read from that side (up = continue straight ahead).
export const EXIT_SIGNS = [
  // Upstairs: both sides of the central block lead to the stair door, never the lift.
  { f: 1, x: 140, y: 100, yaw: -Math.PI / 2, arrow: 'up' },
  { f: 1, x: 380, y: 100, yaw: -Math.PI / 2, arrow: 'right' },
  { f: 1, x: 100, y: 100, yaw: 0, arrow: 'right' },
  { f: 1, x: 100, y: 240, yaw: Math.PI, arrow: 'up' },
  { f: 1, x: 100, y: 297, yaw: Math.PI, arrow: 'left' },
  { f: 1, x: 380, y: 297, yaw: -Math.PI / 2, arrow: 'left' },
  { f: 1, x: 380, y: 196, yaw: Math.PI, arrow: 'left' },
  { f: 1, x: 380, y: 196, yaw: 0, arrow: 'right' },
  // Ground floor: down the side corridors, through reception to the outside door.
  { f: 0, x: 439, y: 466, yaw: Math.PI / 2, arrow: 'left' },
  { f: 0, x: 439, y: 369, yaw: -Math.PI / 2, arrow: 'right' },
  { f: 0, x: 139, y: 369, yaw: Math.PI / 2, arrow: 'left' },
  { f: 0, x: 139, y: 569, yaw: Math.PI, arrow: 'left' },
  { f: 0, x: 439, y: 569, yaw: Math.PI, arrow: 'right' },
  { f: 0, x: 300, y: 569, yaw: Math.PI / 2, arrow: 'left' },
  { f: 0, x: 300, y: 569, yaw: -Math.PI / 2, arrow: 'right' },
  { f: 0, x: 296, y: 640, yaw: Math.PI, arrow: 'up' },
];

export async function addExitSigns(scene, loader) {
  const sources = new Map(await Promise.all(['up', 'left', 'right'].map(async (direction) => {
    const sign = await loadModel(loader, `exit_sign_${direction}`);
    const diffuser = sign.getObjectByName('sign_diffuser');
    diffuser.material = new THREE.MeshBasicMaterial({ map: diffuser.material.map, toneMapped: false });
    return [direction, sign];
  })));
  const casing = new THREE.MeshLambertMaterial({ color: 0xd9d3bb });
  const scale = 2.4;
  const halfHeight = new THREE.Box3().setFromObject(sources.get('up')).getSize(new THREE.Vector3()).y * scale / 2;
  const hangerLength = CEIL - 2.35 - halfHeight;
  const hanger = new THREE.CylinderGeometry(0.008, 0.008, hangerLength, 6);
  for (const { f, x, y, yaw, arrow } of EXIT_SIGNS) {
    const [px, py] = toF0(f, x, y);
    const group = new THREE.Group();
    group.name = 'Panneau de sortie';
    // The original model faces +Z, with its back at Z=0: opposing signs sit back to back.
    group.position.set(wx(px) + Math.sin(yaw) * 0.003, f * FH + 2.35, wz(py) + Math.cos(yaw) * 0.003);
    group.rotation.y = yaw;
    const sign = sources.get(arrow).clone(true);
    sign.scale.setScalar(scale);
    group.add(sign);
    for (const dx of [-0.3, 0.3]) {
      const rod = new THREE.Mesh(hanger, casing);
      rod.position.set(dx, halfHeight + hangerLength / 2, 0.04); group.add(rod);
    }
    scene.add(group);
  }
}
