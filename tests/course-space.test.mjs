import test from 'node:test';
import assert from 'node:assert/strict';
import {spaceCandidates} from '../public/course/space.js';
const origin={lat:37.5,lng:127};
const places=Array.from({length:7},(_,i)=>({id:String(i),name:`장소 ${i}`,category:i%2?'cafe':'restaurant',point:{lat:37.5+i*.001,lng:127}}));
test('virtual scene needs a real origin and never fills missing candidates',()=>{
 assert.equal(spaceCandidates(places).total,0);
 assert.equal(spaceCandidates(places.slice(0,1),{origin}).places.length,1);
});
test('three nearest unique candidates, stable pagination and filter',()=>{
 assert.deepEqual(spaceCandidates([...places].reverse(),{origin}).places.map(p=>p.id),['0','1','2']);
 assert.deepEqual(spaceCandidates([...places,places[0]],{origin,offset:3}).places.map(p=>p.id),['3','4','5']);
 assert.deepEqual(spaceCandidates(places,{origin,offset:6}).places.map(p=>p.id),['6']);
 assert.deepEqual(spaceCandidates(places,{origin,offset:9}).places.map(p=>p.id),['0','1','2']);
 assert.deepEqual(spaceCandidates(places,{origin,filter:'cafe'}).places.map(p=>p.id),['1','3','5']);
});
test('missing coordinates, conflict and cancellation are not offered',()=>{
 const bad=places.map((p,i)=>({...p,...(i===0?{point:null}:i===1?{conflict:true}:{status:'cancelled'})}));
 assert.equal(spaceCandidates(bad,{origin}).total,0);
});
