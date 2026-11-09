import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.core.js';
import * as plan from '../hopital/plan.js';
import { patrolClear } from '../patrol.js';
test('all six actors patrol the real furnished hospital, move their colliders and stop for conversation', async () => {
const base = new URL('../', import.meta.url);
const previousDocument = globalThis.document;
try {
const src = (p) => readFileSync(new URL(p,base),'utf8');
const uri = (s) => `data:text/javascript,${encodeURIComponent(s)}`;
const three = new URL('vendor/three/three.core.js',base).href;
const rewrite = (s) => s.replaceAll("'three'",JSON.stringify(three));
const ctx = new Proxy({measureText:()=>({width:10})}, { get: (o,k) => o[k] ?? (()=>{}), set: (o,k,v) => (o[k]=v,true) });
globalThis.document = { createElement: () => ({getContext:()=>ctx}) };
const util = uri(rewrite(src('util.js')));
const merge = uri(rewrite(src('vendor/three/addons/utils/BufferGeometryUtils.js')));
let building = rewrite(src('hopital/batiment.js')).replace("'three/addons/utils/BufferGeometryUtils.js'",JSON.stringify(merge)).replace("'../util.js'",JSON.stringify(util)).replace("'./plan.js'",JSON.stringify(new URL('hopital/plan.js',base).href));
const { buildHospital } = await import(uri(building));
const H = buildHospital(new THREE.Group());
// Read accessor bounds and node transforms from the actual GLBs; textures do not affect collision boxes.
globalThis.__patrolLoad = async (_loader, file) => {
 const data=readFileSync(new URL(`assets/${file}.glb`,base));
 const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
 const node = (i) => {
  const n=gltf.nodes[i], group=new THREE.Group(); group.name=n.name||'';
  if(n.matrix) group.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));
  else { if(n.translation)group.position.fromArray(n.translation); if(n.rotation)group.quaternion.fromArray(n.rotation);if(n.scale)group.scale.fromArray(n.scale); }
  for(const p of gltf.meshes?.[n.mesh]?.primitives||[]) {
   const a=gltf.accessors[p.attributes.POSITION], lo=new THREE.Vector3().fromArray(a.min), hi=new THREE.Vector3().fromArray(a.max), size=hi.clone().sub(lo),center=lo.add(hi).multiplyScalar(.5);
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),new THREE.MeshBasicMaterial());mesh.position.copy(center);group.add(mesh);
  }
  for(const child of n.children||[])group.add(node(child));return group;
 };
 const root=new THREE.Group();for(const i of gltf.scenes[gltf.scene||0].nodes)root.add(node(i));return root;
};
let furniture = rewrite(src('hopital/mobilier.js')).replace("'three/addons/utils/BufferGeometryUtils.js'",JSON.stringify(merge)).replace("import { loadModel } from '../decor.js';",'const loadModel=globalThis.__patrolLoad;').replace("import { attachCameraEye, trackCamera } from '../surveillance.js';",'const attachCameraEye=()=>{},trackCamera=()=>{};').replace("'./plan.js'",JSON.stringify(new URL('hopital/plan.js',base).href));
const {loadFurniture,layoutOf}=await import(uri(furniture));await loadFurniture(null,H);
const hospital={H,roomAt:(x,y,z)=>H.roomAt(x,y+plan.FH,z),clearance:()=>1};
const spotText=src('histoire.js').match(/export function spot\([\s\S]*?\n\}/)[0].replace('export ','');
const spot=new Function('ROOMS','FH','layoutOf',`${spotText}; return spot;`)(plan.ROOMS,plan.FH,layoutOf);
hospital.addCollider=(x0,z0,x1,z1,y0,y1,extra)=>{const c={x0,z0,x1,z1,y0:y0+plan.FH,y1:y1+plan.FH,...extra};H.colliders.push(c);return c;};
globalThis.__patrolSpot=spot;
let npcSource=rewrite(src('pnj.js')).replace("'./body.js'",JSON.stringify(uri(rewrite(src('body.js'))))).replace("import { loadModel } from './decor.js';",'const loadModel=globalThis.__patrolLoad;').replace("import { spot } from './histoire.js';",'const spot=globalThis.__patrolSpot;').replace("'./hopital/plan.js'",JSON.stringify(new URL('hopital/plan.js',base).href)).replace("'./patrol.js'",JSON.stringify(new URL('patrol.js',base).href));
const {createNPCs}=await import(uri(npcSource));const actors=await createNPCs(new THREE.Scene(),null,hospital),far=new THREE.Vector3(1000,1000,1000);
const guard = actors.actors.find(a => a.id === 'orderly_male');
const staff = actors.actors.filter(a => a.needsCoat);
assert.equal(staff.length, 3);
for (const actor of staff) {
 assert.equal(actor.root.visible, false, 'medical staff start hidden without the coat');
 assert.equal(actor.collider.active, false, 'hidden staff have no collision');
}
assert.equal(guard.root.visible, true, 'guard remains present without the coat');
assert.equal(guard.name, 'AGENT DE SÉCURITÉ');
assert.equal(guard.model, 'security_guard');
const guardPost = guard.pos.clone();
assert.equal(hospital.roomAt(guard.pos.x, guard.pos.y, guard.pos.z), 'Couloir');
assert.ok(guard.pos.distanceTo(new THREE.Vector3(plan.wx(478.5), -plan.FH, plan.wz(466))) < 2.5, 'guard waits near the downstairs stair door');
assert.ok(guard.clear(guard.pos), 'guard post clears the furnished hospital');
const steps = new Map();
const onStep = (pos) => {
 const actor = actors.actors.find(a => a.pos === pos);
 assert.ok(actor, 'footstep is emitted at the actor position');
 steps.set(actor, (steps.get(actor) ?? 0) + 1);
};
for(let i=0;i<600;i++)actors.update(1/60,i/60,far,{blouse:false,onStep});
assert.ok(guard.pos.equals(guardPost), 'guard stays at his post without the coat');
assert.equal(guard.bob, 0, 'waiting guard does not walk');
for (const actor of staff) assert.equal(actor.bob, 0, 'hidden staff do not walk or make footsteps');
actors.update(0, 10, far, { blouse:true, onStep });
for (const actor of staff) {
 assert.equal(actor.root.visible, true, 'wearing the coat reveals medical staff even with no elapsed time');
 assert.equal(actor.collider.active, true, 'visible staff regain collision');
}
const visited = new Set();
for(let i=0;i<36000;i++){
 actors.update(1/60,i/60,far,{onStep,blouse:true});
 guard.patrol.route.forEach((p, index) => {
  if (Math.hypot(guard.pos.x - p.x, guard.pos.z - p.z) < 0.1) visited.add(index);
 });
 for(const a of actors.actors.filter(a => !a.wandering)){
  if(!a.clear(a.pos))throw new Error('PNJ collision '+a.id);
  if(Math.abs(a.collider.x0-a.pos.x+.25)>1e-8||Math.abs(a.collider.z0-a.pos.z+.25)>1e-8)throw new Error('Collider drift '+a.id);
 }
}
assert.equal(visited.size, guard.patrol.route.length, 'guard visits every corridor, reception and hall on his full ground-floor round');
for(const a of actors.actors.filter(a => !a.wandering)){
 if(!a.patrol.enabled||a.bob<10)throw new Error('PNJ immobile '+a.id);
 assert.equal(steps.get(a), Math.floor(a.bob / 9 / 0.62), 'steps follow the distance actually walked');
 const before=a.pos.clone();const viewer=a.camera.position.clone().add(new THREE.Vector3(0,0,1));
 const stepCount = steps.get(a);
 for(let i=0;i<120;i++)actors.update(1/60,60+i/60,viewer,{onStep,blouse:true});
 if(!a.pos.equals(before))throw new Error('Dialogue pause failed '+a.id);
 assert.equal(steps.get(a), stepCount, 'no footsteps while stopped for conversation');
}
const before=actors.actors.map(a=>a.pos.clone()), pausedSteps = new Map(steps);actors.update(0,100,far,{onStep,blouse:true});
if(actors.actors.some((a,i)=>!a.pos.equals(before[i])))throw new Error('Pause failed');
assert.deepEqual(steps, pausedSteps, 'no footsteps while paused');
const wanderer = actors.actors.find(a => a.wandering);
assert.equal(steps.has(wanderer), false, 'inactive encounter stays silent');
for(let i=0;i<600;i++)actors.update(1/60,101+i/60,far,{active:true,onStep});
assert.ok(steps.get(wanderer) > 0, 'wandering patient also has footsteps');
const wanderSteps = steps.get(wanderer);
for(let i=0;i<120;i++)actors.update(1/60,112+i/60,far,{active:true,consumed:true,onStep});
assert.equal(steps.get(wanderer), wanderSteps, 'consumed encounter stays silent');
for (const [entrance, z] of [['stairs', 466], ['lift', 544]]) {
 guard.pos.copy(guardPost); guard.camera.position.set(guard.pos.x, guard.pos.y + 1.6, guard.pos.z);
 const viewer = new THREE.Vector3(plan.wx(470), -plan.FH + 1.6, plan.wz(z));
 let caught = 0;
 const options = { active:true, consumed:true, blouse:false, onGuardCatch:() => caught++ };
 const before = guard.pos.clone();
 hospital.clearance = () => 0;
 for(let i=0;i<120;i++)actors.update(1/60,120+i/60,viewer,options);
 assert.ok(guard.pos.equals(before), 'wall prevents interception');
 hospital.clearance = () => 1;
 actors.update(1/60,123,viewer,{...options,active:false});
 assert.ok(guard.pos.equals(before), 'another interaction prevents interception');
 actors.update(1/60,124,viewer,options);
 for(let i=0;i<600;i++) {
  actors.update(1/60,125+i/60,viewer,options);
  assert.ok(guard.clear(guard.pos), 'guard stays clear of hospital collisions');
 }
 assert.ok(guard.pos.equals(before), `${entrance}: guard lets the player reach the nurse`);
 assert.equal(caught, 0, `${entrance}: no automatic confrontation before the nurse`);
}
assert.equal(actors.actors.filter(a => !a.wandering).length, 6);
assert.equal(actors.actors.filter(a => a.wandering).length, 1);
actors.update(0, 140, far, { blouse:true, onStep });
const staffPositions = staff.map(actor => actor.pos.clone());
actors.update(0, 140, far, { blouse:false, onStep });
for (const [index, actor] of staff.entries()) {
 assert.equal(actor.root.visible, false, 'removing the coat hides medical staff again');
 assert.equal(actor.collider.active, false);
 assert.ok(actor.pos.equals(staffPositions[index]), 'visibility changes do not move actors');
}
const treatmentSource = rewrite(src('treatment.js'))
 .replace("'./body.js'",JSON.stringify(uri(rewrite(src('body.js')))))
 .replace("import { loadModel } from './decor.js';",'const loadModel=globalThis.__patrolLoad;')
 .replace("'./hopital/plan.js'",JSON.stringify(new URL('hopital/plan.js',base).href))
 .replace("'./patrol.js'",JSON.stringify(new URL('patrol.js',base).href));
const {createTreatment}=await import(uri(treatmentSource));
const treatment=await createTreatment(new THREE.Scene(),null,hospital);
assert.equal(treatment.root.visible,false, 'medical responder stays hidden until called');
const viewer = new THREE.Vector3(plan.wx(470), -plan.FH+1.6, plan.wz(466));
assert.ok(treatment.begin(viewer,-Math.PI/2,-plan.FH), 'medical responder has a safe approach beside the stairs');
const start=treatment.pos.clone(); let medicSteps=0;
const forward = new THREE.Vector3(1,0,0); // viewer yaw = -PI/2
assert.ok(start.clone().sub(viewer).setY(0).normalize().dot(forward)<-0.45,
 'responder starts behind the viewer, outside the visible field');

for(let i=0;i<600;i++) {
 const before=treatment.pos.clone();
 treatment.update(1/60,i/60,()=>medicSteps++);
 const movement=treatment.pos.clone().sub(before);
 if(movement.length()>0.001) {
  const facing=new THREE.Vector3(0,0,-1).applyQuaternion(treatment.root.quaternion);
  assert.ok(facing.dot(movement.normalize())>0.95,'responder faces the direction of travel');
 }
 assert.ok(patrolClear(treatment.pos,hospital,H.colliders.at(-1)), 'medical responder clears the real furnished hospital');
}
await treatment.arrived();
assert.ok(treatment.pos.distanceTo(start)>0.5, 'doctor walks into reach instead of an invisible injection');
assert.ok(medicSteps>0);
const syringe=treatment.root.getObjectByName('treatment_syringe');
const injection=treatment.inject(); assert.ok(syringe.visible);
const still=treatment.pos.clone();treatment.update(0,20);assert.ok(treatment.pos.equals(still));
for(let i=0;i<180;i++) {
 treatment.update(1/60,20+i/60);
 if(i===70) {
  treatment.root.updateMatrixWorld(true);
  const tip=syringe.localToWorld(new THREE.Vector3(0,2.15/16,0));
  assert.ok(tip.distanceTo(viewer.clone().setY(-plan.FH+1.05))<0.3,'needle reaches the patient during the injection gesture');
 }
}
await injection; assert.equal(syringe.visible,false,'syringe put away after the visible gesture');
treatment.reset(); assert.equal(treatment.root.visible,false);
const surfaces=H.surfaces;H.surfaces=[];
assert.equal(treatment.begin(viewer,0,-plan.FH),false, 'never spawn a doctor without a safe floor and route');
H.surfaces=surfaces;
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
  delete globalThis.__patrolLoad;
  delete globalThis.__patrolSpot;
}
});
