import test from 'node:test';import assert from 'node:assert/strict';
import {semanticGroups,relax,geographicLayout,pinchViewport} from '../public/ontology-motion.js';
test('semantic grouping preserves every place and only uses evidenced event categories',()=>{
 const places=Array.from({length:120},(_,i)=>({id:'p'+i,events:[{category:i%2?'performance':'festival'}]}));
 const buckets=semanticGroups(places);assert.equal(buckets.length,2);assert.deepEqual(new Set(buckets.flatMap(b=>b.members.map(p=>p.id))),new Set(places.map(p=>p.id)));
 for(const b of buckets)assert.ok(b.members.every(p=>p.events.some(e=>e.category===b.id)));
});
test('coincident points separate and remain bounded while fixed origins stay fixed',()=>{
 const nodes=Array.from({length:14},(_,i)=>({x:200,y:250,tx:200,ty:250,vx:0,vy:0,radius:15,fixed:i===0}));
 relax(nodes,400,600,200);
 assert.equal(nodes[0].x,200);assert.equal(nodes[0].y,250);
 for(const n of nodes){assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));assert.ok(n.x>=30&&n.x<=370&&n.y>=70&&n.y<=525);}
 assert.ok(new Set(nodes.map(n=>Math.round(n.x)+','+Math.round(n.y))).size>10);
});

test('geographic layout preserves compass directions and origin at all viewport sizes',()=>{
 const origin={point:{lat:37.65,lng:126.8}},places=[{point:{lat:37.75,lng:126.8}},{point:{lat:37.55,lng:126.8}},{point:{lat:37.65,lng:126.9}},{point:{lat:37.65,lng:126.7}}];
 for(const [w,h] of [[390,500],[1200,650]]){
 const project=geographicLayout(places,origin,w,h),center=project(origin.point),[north,south,east,west]=places.map(p=>project(p.point));
 assert.equal(center.x,w/2);assert.equal(center.y,h/2);assert.ok(north.y<center.y&&south.y>center.y);assert.ok(east.x>center.x&&west.x<center.x);assert.equal(north.x,center.x);assert.equal(east.y,center.y);
 }
});

test('pinch zoom follows finger distance and keeps the touched point anchored',()=>{
 const start={x:100,y:200,distance:100,zoom:1,pan:{x:0,y:0}};
 const out=pinchViewport(start,{x:100,y:200,distance:200},400,600);assert.equal(out.zoom,2);assert.deepEqual(out.pan,{x:100,y:100});
 const back=pinchViewport({...out,x:100,y:200,distance:200},{x:100,y:200,distance:100},400,600);assert.equal(back.zoom,1);assert.deepEqual(back.pan,{x:0,y:0});
 assert.equal(pinchViewport(start,{x:100,y:200,distance:10000},400,600).zoom,8);
 assert.equal(pinchViewport(start,{x:100,y:200,distance:1},400,600).zoom,.6);
});
