import * as THREE from 'three';

// Mirrors that really reflect: a planar reflection, drawn for the nearest mirror only. The room is seen from the camera
// mirrored in the glass, in low resolution and without filtering, like the rest of the picture.
// While it is drawn, the first-person arms are hidden and player_reflection.glb stands where the player is:
// the player's shadow comes from another body, a deformed one, and only the mirror shows them as a normal person.

const PLATE = { w: 0.324, h: 0.474, y: 0.275, z: -0.0195 }; // mirror_plate of mirror_steel.glb
const RANGE = 3.5;
const RES = [480, 270];

const VERTEX = `uniform mat4 textureMatrix; varying vec4 vUv;
  void main() { vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAGMENT = `uniform sampler2D tDiffuse; uniform float tint; varying vec4 vUv;
  void main() { gl_FragColor = vec4(texture2DProj(tDiffuse, vUv).rgb * tint, 1.0);
  #include <colorspace_fragment>
  }`;

export function createMirrors(scene, renderer) {
  const target = new THREE.WebGLRenderTarget(RES[0], RES[1], { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
  const cam = new THREE.PerspectiveCamera();
  const geometry = new THREE.PlaneGeometry(PLATE.w, PLATE.h);
  const mirrors = [];
  const hidden = []; // objects the mirror must not show
  let body = null;

  // Locals of the reflection maths.
  const R = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), V = new THREE.Vector3(), T = new THREE.Vector3();
  const look = new THREE.Vector3(), rot = new THREE.Matrix4(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const view = new THREE.Frustum(), projView = new THREE.Matrix4(), was = [];

  // parent: the mirror's own group, or the scene with a position and a yaw.
  function add(parent, position, yaw = 0) {
    const textureMatrix = new THREE.Matrix4();
    const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: target.texture }, textureMatrix: { value: textureMatrix }, tint: { value: 0.82 } },
      vertexShader: VERTEX, fragmentShader: FRAGMENT, toneMapped: false,
    }));
    mesh.visible = false; // the mirror_plate of the model shows through when it isn't the active one
    if (position) { const pivot = new THREE.Group(); pivot.position.copy(position); pivot.rotation.y = yaw; parent.add(pivot); parent = pivot; }
    mesh.position.set(0, PLATE.y, PLATE.z - 0.001);
    mesh.rotation.y = Math.PI; // the mirror faces -Z
    parent.add(mesh);
    mirrors.push({ mesh, textureMatrix });
    return mesh;
  }

  function nearest(camera) {
    let best = null, bestD = RANGE;
    camera.getWorldPosition(C);
    // Behind the player, the reflection is not rendered at all (a whole extra pass of the scene).
    camera.updateMatrixWorld();
    projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    view.setFromProjectionMatrix(projView);
    for (const m of mirrors) {
      m.mesh.getWorldPosition(R);
      N.set(0, 0, 1).transformDirection(m.mesh.matrixWorld);
      const d = R.distanceTo(C);
      m.mesh.visible = false;
      if (d < bestD && Math.abs(R.y - C.y) < 2 && V.subVectors(C, R).dot(N) > 0 && view.intersectsObject(m.mesh)) { bestD = d; best = m; }
    }
    return best;
  }

  function update(camera, enabled) {
    const m = enabled ? nearest(camera) : null;
    if (!enabled) for (const x of mirrors) x.mesh.visible = false;
    if (!m) return;
    const { mesh, textureMatrix } = m;
    mesh.updateWorldMatrix(true, false);
    R.setFromMatrixPosition(mesh.matrixWorld);
    C.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(mesh.matrixWorld);
    N.set(0, 0, 1).applyMatrix4(rot);
    V.subVectors(R, C);
    if (V.dot(N) > 0) return;
    V.reflect(N).negate().add(R);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(C);
    T.subVectors(R, look).reflect(N).negate().add(R);
    cam.position.copy(V);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
    cam.lookAt(T);
    cam.near = camera.near; cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    textureMatrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse).multiply(mesh.matrixWorld);
    // Oblique near plane: nothing behind the glass may show.
    plane.setFromNormalAndCoplanarPoint(N, R).applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const p = cam.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    p[2] = clip.x; p[6] = clip.y; p[10] = clip.z + 1 - 0.003; p[14] = clip.w;

    was.length = 0;
    for (const o of hidden) { was.push(o.visible); o.visible = false; }
    if (body) body.visible = true;
    const rt = renderer.getRenderTarget(), auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(rt);
    renderer.shadowMap.autoUpdate = auto;
    hidden.forEach((o, i) => { o.visible = was[i]; });
    if (body) body.visible = false;
    mesh.visible = true;
  }

  return { add, update, hide: (...o) => hidden.push(...o), setBody: (b) => { body = b; b.visible = false; }, mirrors };
}
