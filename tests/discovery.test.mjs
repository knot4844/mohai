import test from 'node:test';import assert from 'node:assert/strict';import {rankPlaces} from '../public/discovery.js';
const date='2026-10-10',base={schedule:{start_date:date,end_date:date,sessions:[]},reservation:{},verification:{}};
const place=(id,lat,event=base)=>({id,point:{lat,lng:126.8},events:[event]});
test('discovery prefers nearby places with equal evidence without popularity data',()=>{
 const p=rankPlaces([place('far',38),place('near',37.65)],{origin:{lat:37.65,lng:126.8},date});assert.equal(p[0].id,'near');assert.equal(p[0].popularity,undefined);
});
test('confirmed daily sessions rank above uncertain ranges and closed registration',()=>{
 const confirmed={...base,schedule:{...base.schedule,sessions:[{start:date+'T10:00:00+09:00'}]}};
 const p=rankPlaces([place('uncertain',37.65),place('confirmed',37.65,confirmed),place('closed',37.65,{...confirmed,reservation:{raw_ko:'접수 마감'}})],{date});assert.deepEqual(p.map(p=>p.id),['confirmed','uncertain','closed']);
});
