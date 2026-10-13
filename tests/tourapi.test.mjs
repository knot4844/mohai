import test from 'node:test';import assert from 'node:assert/strict';
import {serviceKey,tourRequest,overlaps,collectFestivals} from '../lib/tourapi.mjs';
const reply=(items,total=items.length)=>({ok:true,text:async()=>JSON.stringify({response:{header:{resultCode:'0000'},body:{items:{item:items},totalCount:total}}})});
test('TourAPI accepts encoded keys once and never leaks provider errors or keys',async()=>{
 assert.equal(serviceKey('abc%2Bdef%3D'),'abc+def=');
 await assert.rejects(tourRequest('searchFestival2',{}, {key:'secret',fetcher:async()=>{throw new Error('https://bad/?serviceKey=secret');}}),e=>e.message==='provider_unavailable'&&!e.message.includes('secret'));
 await assert.rejects(tourRequest('searchFestival2',{}, {key:'secret',fetcher:async()=>({ok:true,text:async()=>'<error>secret</error>'})}),/upstream_non_json/);
});
test('festival overlap includes ongoing and cross-year events, excluding invalid/outside dates',()=>{
 assert.equal(overlaps({eventstartdate:'20250901',eventenddate:'20261231'},'2026-10-10','2026-12-31'),true);
 assert.equal(overlaps({eventstartdate:'20261231',eventenddate:'20270101'},'2026-10-10','2026-12-31'),true);
 assert.equal(overlaps({eventstartdate:'20260230',eventenddate:'20261231'},'2026-10-10','2026-12-31'),false);
 assert.equal(overlaps({eventstartdate:'20260101',eventenddate:'20261009'},'2026-10-10','2026-12-31'),false);
});
test('snapshot is fixed-region, deduplicated and strips response fields not explicitly permitted',async()=>{
 const urls=[];const result=await collectFestivals({key:'private+key',start:'2026-10-10',end:'2026-12-31',fetcher:async url=>{urls.push(url);return reply([{contentid:'1',title:'행사',eventstartdate:'20261001',eventenddate:'20261101',unknown:'private',firstimage:'unlicensed'}]);}});
 assert.equal(result.items.length,1);assert.equal(result.items[0].unknown,undefined);assert.equal(result.items[0].firstimage,undefined);assert.equal(JSON.stringify(result).includes('private+key'),false);
 assert.deepEqual(urls.map(u=>u.searchParams.get('lDongRegnCd')),['11','41']);assert.equal(urls[0].searchParams.get('eventStartDate'),'20240101');
});
test('incomplete pagination aborts rather than publishing an incomplete success',async()=>{
 await assert.rejects(collectFestivals({key:'key',start:'2026-10-10',end:'2026-12-31',fetcher:async()=>reply([],120)}),/incomplete_pagination/);
});
import {mergeTourAPI} from '../lib/tourapi-normalize.mjs';
import {maySuggest,verificationState} from '../public/verification.js';
const base={events:[],places:[],scope:{area_ids:[]},locationCoverage:{}};
const regions={'종로구':['jongno',{ko:'종로구',en:'Jongno',ja:'鍾路区','zh-Hans':'钟路区'}]};
const item={contentid:'123',title:'행사',eventstartdate:'20261001',eventenddate:'20261231',lDongRegnCd:'11',addr1:'서울특별시 종로구 예시',mapy:'37.57',mapx:'126.97',intro:{eventplace:'예시광장',playtime:'금요일 공연',usetimefestival:'일부 무료'}};
const snapshot={fetchedAt:'2026-10-10T01:00:00Z',window:{start:'2026-10-10',end:'2026-12-31'},items:[item]};
test('API entries never masquerade as manual reviews or invent sessions, translation, admission or free prices',()=>{
 const {data,audit}=mergeTourAPI(base,snapshot,regions),e=data.events[0];assert.equal(audit.added.length,1);assert.equal(e.schedule.sessions.length,0);assert.equal(e.price.kind,'mixed');assert.equal(e.translations.en.status,'original_title_pending_translation');assert.equal(verificationState(e,Date.parse(snapshot.fetchedAt)+100),'listed');assert.equal(maySuggest(e,Date.parse(snapshot.fetchedAt)+100),false);
 assert.equal(mergeTourAPI(data,snapshot,regions).data.events.length,1);
});
test('API conflicts and missing details are held, and cancelled events remain cancelled',()=>{
 assert.equal(mergeTourAPI(base,{...snapshot,items:[{...item,intro:{...item.intro,eventenddate:'20261101'}}]},regions).audit.held[0].reason,'list_detail_date_conflict');
 assert.equal(mergeTourAPI(base,{...snapshot,items:[{...item,intro:null}]},regions).data.events.length,0);
 assert.equal(mergeTourAPI(base,{...snapshot,items:[{...item,progresstype:'취소'}]},regions).data.events[0].status,'cancelled');
});
