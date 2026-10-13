import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {filterEvents,availability,eventSessions} from '../public/engine.js';import {eventLocations} from '../public/places.js';import {maySuggest} from '../public/verification.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url)));
const regional=data.events.filter(e=>e.region);
test('regional data adds four-language source-bound events without replacing Goyang',()=>{
 assert.ok(regional.length>0);assert.equal(data.events.length,107+regional.length);assert.equal(new Set(data.events.map(e=>e.id)).size,data.events.length);
 assert.equal(data.regionalSurvey.newEvents,regional.length);
 for(const e of regional){assert.ok(e.schedule.start_date<=data.scope.window_end&&e.schedule.end_date>=data.scope.window_start);for(const l of ['ko','en','ja','zh-Hans']){assert.ok(e.translations[l]?.display_title);assert.ok(e.translations[l]?.summary);assert.ok(e.region.labels[l]);}for(const field of ['dates','venue'])assert.ok(e.verification.sources.some(s=>s.fields.includes(field)&&s.url.startsWith('https://')));}
});
test('only evidenced regional coordinates are mapped, never guessed entrances',()=>{
 for(const e of regional){const ps=eventLocations(e);assert.equal(Boolean(ps.length),Boolean(e.venues[0].coordinate_source_url));for(const p of ps){assert.ok(p.point.lat>36.5&&p.point.lat<38.5);assert.ok(p.point.lng>126&&p.point.lng<128.5);assert.match(p.point.source,/^https:\/\//);assert.equal(p.point.verifiedEntrance,false);}if(e.editorial.multiSite)assert.equal(maySuggest(e,Date.parse(e.verification.checked_at)+1000),false);}
});
test('new date-only and cached events do not manufacture operating sessions or admission',()=>{
 for(const e of regional){if(!e.schedule.sessions.length&&!e.editorial.recurrence)assert.equal(availability(e,e.schedule.start_date),'uncertain');if(e.verification.cached_source)assert.equal(maySuggest(e,Date.parse(e.verification.checked_at)+1000),false);if(e.price.kind!=='free')assert.equal(filterEvents([e],{date:e.schedule.start_date,freeOnly:true,includePrograms:true}).length,0);}
});
test('confirmed recurring schedules expose valid start and end times',()=>{
 for(const e of regional.filter(e=>e.editorial.recurrence))for(const s of eventSessions(e,e.schedule.start_date)){assert.ok(Number.isFinite(s.start));assert.ok(Number.isFinite(s.end));assert.ok(s.start<s.end);}
});
test('two dated family workshops are not shown as a continuous two-week event',()=>{
 const e=regional.find(e=>e.id==='yangju-gwana-family-20261011');assert.equal(availability(e,'2026-10-11'),'confirmed');assert.equal(availability(e,'2026-10-12'),'closed');assert.equal(availability(e,'2026-10-25'),'confirmed');
});
test('Seoul and Gyeonggi are discoverable separately with a city filter',()=>{
 const seoul=filterEvents(data.events,{date:'2026-10-09',region:'seoul',includePrograms:true});assert.ok(seoul.length);assert.ok(seoul.every(e=>e.region.province==='seoul'));
 const paju=filterEvents(data.events,{date:'2026-10-09',region:'gyeonggi',city:'paju',includePrograms:true});assert.ok(paju.length);assert.ok(paju.every(e=>e.region.city==='paju'));
 const museum=regional.filter(e=>e.venues[0].name_ko.startsWith('서울시립 북서울미술관'));assert.ok(museum.length>1);assert.equal(new Set(museum.map(e=>eventLocations(e)[0]?.id)).size,1);
});

test('year-end coverage preserves ongoing and cross-year events without inventing daily sessions',()=>{
 assert.equal(data.scope.window_end,'2026-12-31');
 const bell=data.events.find(e=>e.id==='seoul-yearend-fun389');
 assert.equal(bell.schedule.end_date,'2027-01-01');
 assert.notEqual(availability(bell,'2026-12-31'),'closed');
 assert.equal(availability(bell,'2026-12-30'),'closed');
 assert.ok(filterEvents(data.events,{date:'2026-12-31',region:'seoul',includePrograms:true}).some(e=>e.id===bell.id));
 const show=data.events.find(e=>e.id==='goyang-artgy-8453');
 assert.equal(availability(show,'2026-11-06'),'confirmed');
 assert.equal(availability(show,'2026-11-08'),'closed');
 assert.equal(new Set(data.places.map(p=>p.id)).size,data.places.length);
 const aram=data.events.filter(e=>e.editorial.locations?.some(p=>p.name==='고양아람누리'));
 assert.ok(aram.some(e=>!e.region)&&aram.some(e=>e.region));
 assert.equal(new Set(aram.flatMap(e=>e.editorial.locations.filter(p=>p.name==='고양아람누리').map(p=>p.id))).size,1);
});
