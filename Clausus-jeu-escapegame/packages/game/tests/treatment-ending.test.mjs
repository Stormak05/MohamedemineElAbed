import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../main.js', import.meta.url),'utf8');
const ending = source.slice(source.indexOf('async function caughtEnding('),source.indexOf('// Lying in bed'));
function harness(safe = true, arrived = true) {
  const events = [];
  const point = {clone(){return this;},add(){return this;}};
  const context = vm.createContext({
    ending:false,G:{over:false},keys:new Set(),player:{yaw:0,y:0},camera:{position:point},
    THREE:{Vector3:class {}},relief:1,blackout:0,
    treatment:{pos:point,begin:()=>safe,arrived:async()=>{events.push('arrival');return arrived;},inject:async()=>{events.push('injection');}},
    camTo:async()=>{},lookQuat:()=>null,wait:async()=>{},thought:()=>{},
    fallDown:async()=>events.push('fall'),endGame:kind=>events.push(kind),
    say:async(lines,opts)=>events.push({lines,who:opts.who}),
  });
  vm.runInContext(ending,context);
  return {events,run:()=>context.caughtEnding()};
}
test('doctor arrives and visibly injects before announcing the sedative and the fall',async()=>{
  const h=harness();await h.run();
  const said=h.events.findIndex(e=>e.lines?.some(l=>l.includes('sédatif')));
  assert.ok(h.events.indexOf('arrival')<h.events.indexOf('injection'));
  assert.ok(h.events.indexOf('injection')<said);
  assert.equal(h.events[said].who,'MÉDECIN');
  assert.ok(said<h.events.indexOf('fall'));
  assert.ok(h.events.some(e=>e.who==='AGENT DE SÉCURITÉ'));
});
for(const [safe,arrived] of [[false,false],[true,false]]) test(`failed approach (${safe}, ${arrived}) never claims a sedative or blocks the ending`,async()=>{
  const h=harness(safe,arrived);await h.run();
  assert.equal(h.events.includes('injection'),false);
  assert.equal(h.events.some(e=>e.lines?.some(l=>l.includes('sédatif'))),false);
  assert.equal(h.events.at(-1),'caught');
});
