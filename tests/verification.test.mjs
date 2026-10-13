import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {maySuggest,verificationState} from '../public/verification.js';
import {isRegistrationClosed,filterEvents,eventSessions} from '../public/engine.js';
import {recommend} from '../public/recommendations.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url)));
const event=id=>data.events.find(e=>e.id.endsWith(id));
const now=Date.parse('2026-10-09T12:00:00Z');
const cobe=event('18a6121854d03004'),haengju=event('7fc1dd01588bf4d0');
test('source reviews expire, never silently renew, and reject changed source versions',()=>{
 assert.equal(verificationState(cobe,now),'reviewed');
 assert.equal(maySuggest(cobe,Date.parse(cobe.verification.recheck_after)),false);
 assert.equal(verificationState({...cobe,source_version:'changed'},now),'unreviewed');
 assert.equal(maySuggest({...cobe,verification:undefined},now),false);
});
test('date-only, ticket-required and unknown admission events stay out of automatic courses',()=>{
 for(const id of ['e6da1b391beb5c1c','682092d97e35ec76','cc14b70d7616430e'])assert.equal(maySuggest(event(id),now),false);
 const noHours=structuredClone(cobe);noHours.schedule.sessions=[];
 assert.equal(recommend([noHours],{origin:cobe.editorial.point,date:'2026-10-09',departure:600,returnBy:1000,now}).events.length,0);
});
test('conditional free entry is not included in unconditional free filter',()=>{
 assert.equal(cobe.price.kind,'mixed');
 assert.equal(filterEvents([cobe],{date:'2026-10-09',freeOnly:true}).length,0);
 assert.equal(eventSessions(cobe,'2026-10-09')[0].end,1080);
});
test('registration closing variants are caught without confusing performers and visitors',()=>{
 for(const text of ['접수 종료','모집마감','예약 마감','매진'])assert.equal(isRegistrationClosed({reservation:{raw_ko:text}}),true);
 assert.equal(isRegistrationClosed(event('4c67d3ec7c5c4047')),false);
 assert.equal(isRegistrationClosed(haengju),false);
});
test('Haengju official FAQ correction and weather condition are honored',()=>{
 assert.equal(haengju.editorial.lastEntry,1290);
 for(const l of ['ko','en','ja','zh-Hans'])assert.ok(haengju.translations[l].summary.includes('21:30'));
 assert.equal(recommend([haengju],{origin:haengju.editorial.point,date:'2026-10-09',departure:1080,returnBy:1320,now,weather:{rainProbability:80}}).events.length,0);
});
test('every claimed verified field has an explicit official source and unreviewed records stay honest',()=>{
 let checked=0;
 for(const e of data.events){const v=e.verification;assert.ok(v);if(v.method==='not_rechecked'){assert.equal(v.checked_at,undefined);continue;}checked++;assert.equal(v.source_version,e.source_version);for(const f of v.verified_fields)assert.ok(v.sources.some(s=>s.fields.includes(f)),`${e.id}: ${f}`);assert.ok(Date.parse(v.recheck_after)>Date.parse(v.checked_at));}
 assert.equal(checked,105+(data.regionalSurvey?.newEvents||0));
});
