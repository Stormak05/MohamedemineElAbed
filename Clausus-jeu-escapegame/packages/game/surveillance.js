import * as THREE from 'three';

const target = new THREE.Vector3();

export function attachCameraEye(head, model, mountModel) {
  const shell = [...head.children];
  const fixedShell = mountModel ? head.parent.children.filter((part) => part !== head) : [];
  const mount = mountModel?.clone(true);
  if (mount) {
    mount.visible = false;
    head.parent.add(mount);
  }
  const eye = model.clone(true);
  eye.visible = false;
  head.add(eye);
  head.userData.eye = { shell: [...shell, ...fixedShell], model: eye, mount, active: false };
}

// The lens faces local -Z; aim relative to the head's pivot and its rotated parent.
export function trackCamera(head, position, dt, loss = 0) {
  const eye = head.userData.eye;
  if (eye) {
    // Hysteresis keeps the hallucination from flickering at the sanity threshold.
    eye.active = loss >= (eye.active ? 0.6 : 0.7);
    eye.model.visible = eye.active;
    if (eye.mount) eye.mount.visible = eye.active;
    for (const part of eye.shell) part.visible = !eye.active;
  }
  head.parent.updateWorldMatrix(true, false);
  head.parent.worldToLocal(target.copy(position)).sub(head.position);
  const yaw = Math.atan2(-target.x, -target.z);
  const pitch = Math.atan2(target.y, Math.hypot(target.x, target.z));
  const blend = 1 - Math.exp(-2.5 * dt);
  const delta = yaw - head.rotation.y;
  head.rotation.order = 'YXZ';
  head.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * blend;
  head.rotation.x += (pitch - head.rotation.x) * blend;
}
