import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {groupEventLocations,eventLocations} from '../public/places.js';
import {filterEvents} from '../public/engine.js';
import {maySuggest} from '../public/verification.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url)));data.events=data.events.filter(e=>e.area_id==='kr-41-goyang'&&!e.region);
test('all 107 events have bounded, source-linked facility coordinates',()=>{
 assert.equal(data.events.length,107);
 for(const e of data.events){const ps=eventLocations(e);assert.ok(ps.length,e.title_ko);for(const p of ps){assert.ok(p.point.lat>37.5&&p.point.lat<37.8,p.name);assert.ok(p.point.lng>126.65&&p.point.lng<127,p.name);assert.match(p.point.source,/^https:\/\//);assert.equal(p.point.verifiedEntrance,false);}}
});
test('all visible events remain on the exploration map irrespective of admission confidence',()=>{
 const visible=filterEvents(data.events,{date:'2026-10-09',includePrograms:true});const groups=groupEventLocations(visible);const mapped=new Set(groups.flatMap(g=>g.events.map(e=>e.id)));
 assert.equal(mapped.size,visible.length);
 assert.ok(groups.some(g=>g.events.some(e=>e.verification.cached_source)));
 const newFair=visible.find(e=>e.title_ko.includes('고카프'));assert.ok(mapped.has(newFair.id));
});
test('same facility groups events, without losing individual access or duplicating IDs',()=>{
 const groups=groupEventLocations(data.events),aram=groups.find(g=>g.name==='고양아람누리');assert.ok(aram.events.length>=14);
 for(const g of groups)assert.equal(new Set(g.events.map(e=>e.id)).size,g.events.length);
 const makers=groups.find(g=>g.name==='대화도서관');assert.ok(makers.events.length>=9);
});
test('multi-site events appear at each related facility and do not get automatic single-stop recommendations',()=>{
 const e=data.events.find(e=>e.venues[0].name_ko.includes('해움·새들'));assert.equal(eventLocations(e).length,2);assert.equal(groupEventLocations([e]).length,2);assert.equal(maySuggest(e,Date.parse('2026-10-09T12:00:00Z')),false);
 const fountain=data.events.find(e=>e.venues[0].name_ko.includes('노래하는분수대'));assert.deepEqual(eventLocations(fountain).map(p=>p.name),['노래하는분수대']);
});
test('screen clustering prevents overlapping hit targets and preserves every facility',async()=>{
 const {clusterPlaces}=await import('../public/places.js');const groups=groupEventLocations(data.events);const project=p=>({x:p.lng*1400,y:p.lat*1400});
 const cs=clusterPlaces(groups,project);assert.equal(cs.flatMap(c=>c.members).length,groups.length);assert.ok(cs.some(c=>c.members.length>1));
 for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++)assert.ok(Math.hypot(cs[i].x-cs[j].x,cs[i].y-cs[j].y)>=54);
 assert.equal(clusterPlaces(groups,p=>({x:p.lng*1000000,y:p.lat*1000000})).length,groups.length);
});
