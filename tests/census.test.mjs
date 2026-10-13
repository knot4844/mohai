import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {availability,filterEvents} from '../public/engine.js';
import {verificationState,maySuggest} from '../public/verification.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../public/data.json'),events=data.events.filter(e=>e.area_id==='kr-41-goyang'&&!e.region),census=data.census,audit=read('../data/census-audit.json');
const at=Date.parse('2026-10-09T12:00:00Z');
test('census release contains 50 new plus one promoted event, without duplicate IDs',()=>{
 assert.equal(events.length,107);assert.equal(new Set(events.map(e=>e.id)).size,107);assert.equal(census.newEvents,50);assert.equal(census.complete,false);
 assert.equal(events.filter(e=>e.title_ko.includes('동물교감치유문화제')).length,1);
 assert.equal(events.filter(e=>e.id==='mohae-goyang-826a8820f5233d3c').length,1);
 for(const e of events){assert.equal(e.publication_status,'research');for(const l of ['ko','en','ja','zh-Hans'])assert.ok(e.translations[l]?.display_title);}
});
test('conflicts and cached lists never claim current automatic admission',()=>{
 const conflicts=events.filter(e=>e.verification.conflict);assert.equal(conflicts.length,6);
 for(const e of conflicts){assert.equal(verificationState(e,at),'conflict');assert.equal(maySuggest(e,at),false);}
 for(const e of events.filter(e=>e.verification.cached_source))assert.equal(maySuggest(e,at),false);
});
test('first Wednesday is not a daily programme; holiday closure remains closed',()=>{
 const e=events.find(e=>e.id.endsWith('f2e18bd4e7766a61'));assert.equal(availability(e,'2026-10-09'),'closed');assert.equal(availability(e,'2026-11-04'),'confirmed');
 const reading=events.find(e=>e.id.endsWith('d0a8c0c479f3051d'));assert.equal(reading.price.min,20000);assert.equal(availability(reading,'2026-11-11'),'closed');
});
test('early-bird prices are conditional and family history tour is not universally free',()=>{
 const art=events.find(e=>e.title_ko.includes('스페인 미술 거장전'));assert.equal(art.price.kind,'mixed');assert.equal(art.price.min,null);assert.equal(art.editorial.lastEntry,1020);
 const history=events.find(e=>e.title_ko.includes('1회차 서오릉 역사 탐방'));assert.equal(filterEvents([history],{date:history.schedule.start_date,freeOnly:true,includePrograms:true}).length,0);
});
// The prior ledger lives outside this repository (/Users/dyl/mohae-data). Its URL list is pinned in
// tests/fixtures/prior-source-ledger.json so this test runs without that path; when the external file
// is present the fixture is also compared against it so a changed ledger cannot drift unnoticed.
test('every prior registered source URL has an audit record, without claiming all pages complete',()=>{
 const pinned=read('./fixtures/prior-source-ledger.json');assert.ok(pinned.urls.length>0);
 const urls=new Set(audit.source_audit.map(s=>s.url));for(const u of pinned.urls)assert.ok(urls.has(u),u);assert.equal(audit.complete_census,false);
 const external=new URL(pinned.origin,'file://');
 if(fs.existsSync(external)){const old=JSON.parse(fs.readFileSync(external));assert.deepEqual([...new Set(old.source_ledger.map(s=>s.url))].sort(),pinned.urls,'fixture out of date: regenerate tests/fixtures/prior-source-ledger.json');}
});
