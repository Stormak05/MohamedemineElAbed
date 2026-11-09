import * as THREE from 'three';
import { PlayerBody } from './body.js';
import { loadModel } from './decor.js';
import { FH } from './hopital/plan.js';
import { patrolClear } from './patrol.js';

// A medical responder enters from a nearby clear stretch, then reaches toward the patient's arm.
// This is separate from the doctors at their desks; they retain their own posts and conversations.
export async function createTreatment(scene, loader, hospital) {
  const model = await loadModel(loader, 'doctor');
  const syringe = await loadModel(loader, 'injection_syringe');
  syringe.name = 'treatment_syringe';
  const root = new THREE.Group(); root.name = 'medical_responder'; root.visible = false;
  model.rotation.y = Math.PI; root.add(model); scene.add(root);
  const pos = new THREE.Vector3(), camera = new THREE.PerspectiveCamera(); camera.rotation.order = 'YXZ';
  const body = new PlayerBody(); body.add(root, model);
  const arm = model.getObjectByName('forearm_r'); arm.add(syringe); syringe.visible = false;
  const collider = hospital.addCollider(0, 0, 0, 0, 0, 1.85, { furniture:true, get active() { return root.visible; } });
  let state = null, finish = null, bob = 0, stepDist = 0;
  const clear = p => patrolClear(p, hospital, collider);
  const syncCollider = () => {
    Object.assign(collider, {x0:pos.x-0.25,x1:pos.x+0.25,z0:pos.z-0.25,z1:pos.z+0.25,y0:pos.y+FH,y1:pos.y+FH+1.85});
  };
  const done = (result = true) => { const resolve = finish; finish = null; resolve?.(result); };
  const hands = {ready:true,rest:{right:null,left:null},right:{fn:1,wrist:new THREE.Vector3()},left:{fn:null,wrist:new THREE.Vector3()}};
  return {
    root, pos,
    begin(viewer, yaw, floorY) {
      const patient = viewer.clone().setY(floorY);
      // Start behind the viewer so the responder is already walking when the camera turns.
      // Check every 5 cm, including furniture and floors.
      for (const distance of [6, 4.5, 3, 2.4, 1.8]) for (let i=0;i<9;i++) {
        const angle = yaw + (i%2 ? 1 : -1) * Math.ceil(i/2) * Math.PI/12;
        const direction = new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
        const end = patient.clone().addScaledVector(direction,0.72);
        const start = patient.clone().addScaledVector(direction,distance);
        if (!clear(end) || !clear(start)) continue;
        let safe = true;
        for(let d=0.72;d<=distance;d+=0.05) if(!clear(patient.clone().addScaledVector(direction,d))) {safe=false;break;}
        if(!safe) continue;
        pos.copy(start); root.visible=true; syringe.visible=false; bob=stepDist=0;
        state={phase:'approach',end,patient,direction,elapsed:0}; syncCollider();
        camera.position.copy(pos).y+=1.6; camera.lookAt(viewer); body.prev=null;
        body.update(1/60,0,{visible:true,camera,pos,floorY,mode:'stand',bob});
        return true;
      }
      return false;
    },
    arrived() {
      if (state?.phase === 'ready') return Promise.resolve(true);
      if (state?.phase === 'failed') return Promise.resolve(false);
      return new Promise(resolve => {finish=resolve;});
    },
    inject() {
      state.phase='inject'; state.elapsed=0; syringe.visible=true;
      return new Promise(resolve => {finish=resolve;});
    },
    update(dt,t,onStep=()=>{}) {
      if(!state || dt<=0) return;
      if(state.phase==='approach') {
        const distance=pos.distanceTo(state.end), step=Math.min(distance,1.1*Math.min(dt,0.05));
        const next=pos.clone().lerp(state.end,distance?step/distance:1);
        if(!clear(next)) {
          state.elapsed+=dt;
          if(state.elapsed>2) {state.phase='failed';root.visible=false;done(false);}
          return;
        }
        state.elapsed=0;
        pos.copy(next); bob+=step*9; stepDist+=step;
        if(stepDist>=0.62) {stepDist%=0.62;onStep(pos);}
        if(distance<=0.02) {state.phase='ready';done();}
      }
      camera.position.copy(pos).y+=1.6;
      camera.lookAt(state.patient.clone().setY(pos.y+1.35));
      const pose={visible:true,camera,pos,floorY:pos.y,mode:'stand',bob};
      if(state.phase==='inject') {
        state.elapsed+=dt;
        const weight=Math.min(1,state.elapsed/0.8,Math.max(0,(2.4-state.elapsed)/0.7));
        const rest=pos.clone().setY(pos.y+0.95);
        const target=state.patient.clone().setY(pos.y+1.05).addScaledVector(state.direction,0.15);
        hands.right.wrist.copy(rest).lerp(target,weight); pose.hands=hands;
      }
      body.update(dt,t,pose); syncCollider();
      if(state.phase==='inject') {
        root.updateMatrixWorld(true);
        syringe.position.set(0,-body.rigs[0].limbs.r.fore,0);
        const wrist=arm.localToWorld(syringe.position.clone());
        const direction=state.patient.clone().setY(pos.y+1.05).sub(wrist).normalize();
        const worldQ=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
        syringe.quaternion.copy(arm.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ));
        if(state.elapsed>=2.4) {state.phase='done';syringe.visible=false;done();}
      }
    },
    reset() {root.visible=false;state=null;done();},
  };
}
