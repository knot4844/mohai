import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildPilot,hash} from '../lib/ontology/pilot.mjs';
import {validatePilot,freshness,validDate,validInstant} from '../lib/ontology/validate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(root+'data/ontology/'+file,'utf8'));
const manifest=read('pilot-manifest.json'),sources=read('pilot-sources.json');
const build=()=>buildPilot(manifest,sources);
const selection=(legacy,kind='event')=>manifest.selections.find(s=>s.kind===kind&&s.legacy_id===legacy);
const eventId=legacy=>selection(legacy).id;
const sql=data=>spawnSync('python3',[root+'scripts/check-ontology-sql.py'],{input:JSON.stringify(data),encoding:'utf8'});
const fails=(data,code)=>assert.ok(validatePilot(data).some(e=>e.code===code),JSON.stringify(validatePilot(data)));

test('ontology pilot: 24 real objects, unique stable identities and complete source accounting',()=>{
 const data=build();assert.deepEqual(validatePilot(data),[]);
 assert.equal(data.tables.objects.length,24);assert.equal(data.tables.places.length,16);assert.equal(data.tables.events.length,8);
 assert.equal(new Set(data.tables.objects.map(o=>o.id)).size,24);
 assert.equal(data.tables.mappings.filter(m=>m.disposition==='selected').length,24);
 assert.equal(new Set(data.tables.mappings.map(m=>m.snapshot_id)).size,sources.records.length);
 const result=sql(data);assert.equal(result.status,0,result.stdout+result.stderr);
});
test('ontology pilot: repeated conversion matches saved canonical artifact byte-for-byte',()=>{
 assert.deepEqual(build(),build());assert.deepEqual(build(),read('pilot.json'));
});
test('ontology pilot: frozen source drift and session identity changes require review',()=>{
 const changed=structuredClone(sources);changed.records[0].raw.name='changed';
 assert.throws(()=>buildPilot(manifest,changed),/drift/);
 const bad=structuredClone(manifest);bad.selections.find(s=>s.occurrence_ids.length).occurrence_ids.pop();
 assert.throws(()=>buildPilot(bad,sources),/identity reconciliation/);
});
test('ontology pilot: reviewed name correction keeps assigned object identity',()=>{
 const changed=structuredClone(sources),m=structuredClone(manifest);
 changed.records[0].raw.name+=' (이름 수정 합성 검사)';changed.records[0].payload_sha256=hash(changed.records[0].raw);m.source_digest=hash(changed.records);
 const result=buildPilot(m,changed);
 assert.equal(result.tables.objects[0].id,build().tables.objects[0].id);
 assert.notEqual(result.tables.objects[0].canonical_name,build().tables.objects[0].canonical_name);
});
test('ontology pilot: a facility and hall with the same legacy ID remain distinct',()=>{
 const data=build(),same=manifest.selections.filter(s=>s.legacy_id==='place-9f29da024f99');
 assert.equal(same.length,2);assert.notEqual(same[0].id,same[1].id);
 const hall=data.tables.places.find(p=>p.object_id===same.find(s=>s.source_path).id);
 const facility=data.tables.places.find(p=>p.object_id===same.find(s=>!s.source_path).id);
 assert.equal(hall.latitude,null);assert.ok(facility.latitude>0);
 const mappings=data.tables.mappings.filter(m=>m.legacy_id==='place-9f29da024f99');
 assert.equal(new Set(mappings.map(m=>m.target_id)).size,2);
 assert.ok(mappings.every(m=>m.snapshot_id&&m.source_path!==undefined));
});
test('ontology pilot: nested tenants keep floor-specific address and unknown hours/coordinates',()=>{
 const data=build();
 const tenants=['gatten-starfield-goyang','mijin-starfield-goyang'].map(id=>selection(id,'place').id);
 assert.notEqual(...tenants);
 assert.ok(data.tables.places.find(p=>p.object_id===tenants[0]).address_text.includes('B1'));
 assert.ok(data.tables.places.find(p=>p.object_id===tenants[1]).address_text.includes('3F'));
 for(const id of tenants){assert.equal(data.tables.places.find(p=>p.object_id===id).latitude,null);assert.equal(data.tables.facts.find(f=>f.object_id===id&&f.field==='place.opening_hours').knowledge_state,'unknown');}
});
test('ontology pilot: date-only and range-only events never generate daily sessions',()=>{
 const data=build();
 for(const id of ['mohae-goyang-b957dc9f49a31d09','goyang-megashow-travel-20261112']){
  assert.equal(data.tables.occurrences.filter(o=>o.event_id===eventId(id)).length,0);
  assert.equal(data.tables.events.find(e=>e.object_id===eventId(id)).coverage,'unknown');
 }
 assert.equal(data.tables.events.find(e=>e.object_id===eventId('mohae-goyang-03a9f44070a621cb')).coverage,'partial');
});
test('ontology pilot: multi-site references and exception closures survive without a representative entry',()=>{
 const data=build(),id=eventId('mohae-goyang-17721f6917df7a94');
 assert.equal(data.tables.events.find(e=>e.object_id===id).multi_site,1);
 assert.equal(data.tables.relations.filter(r=>r.from_id===id&&r.predicate==='facility_reference').length,2);
 assert.ok(JSON.parse(data.tables.schedules.find(s=>s.object_id===id).exceptions_json).some(e=>e.date==='2026-10-11'&&e.status==='closed'));
});
test('ontology pilot: end time and visit mode are not fabricated from performance category',()=>{
 const data=build(),occ=data.tables.occurrences.find(o=>o.event_id===eventId('goyang-artgy-8473'));
 assert.equal(occ.ends_at,null);assert.equal(occ.visit_mode,'unknown');
 const bad=structuredClone(data);bad.tables.occurrences.find(o=>o.id===occ.id).ends_at='2026-12-25T18:00:00+09:00';fails(bad,'fact_current_mismatch');
});
test('ontology pilot: free parent festival never makes paid sub-event free',()=>{
 const data=build(),free=data.tables.prices.find(p=>p.object_id===eventId('mohae-goyang-e6da1b391beb5c1c')),paid=data.tables.prices.find(p=>p.object_id===eventId('mohae-goyang-b957dc9f49a31d09'));
 assert.equal(free.minimum,0);assert.equal(free.scope,'legacy_record_only');assert.equal(paid.kind,'paid');assert.equal(paid.minimum,null);
});
test('ontology pilot: admission conflicts and contradictory walk-in legacy metadata are held',()=>{
 const data=build(),conflict=data.tables.admissions.find(a=>a.object_id===eventId('mohae-goyang-ddee156d9fd5f2c1'));
 assert.equal(conflict.reservation_state,'conflict');assert.equal(conflict.reservation_required,null);
 const uncertain=data.tables.admissions.find(a=>a.object_id===eventId('mohae-goyang-e6da1b391beb5c1c'));
 assert.equal(uncertain.legacy_mode,'walk_in');assert.equal(uncertain.reservation_state,'unknown');
});
test('ontology pilot: field-specific timestamps are preserved without converting a date to an instant',()=>{
 const data=build(),id=selection('forest-outings-ilsan','place').id;
 const name=data.tables.facts.find(f=>f.object_id===id&&f.field==='object.canonical_name');
 assert.equal(name.checked_at,'2026-10-11');assert.equal(name.checked_precision,'date');
 assert.equal(freshness(name,data.as_of),'unverified');
 const dates=data.tables.facts.find(f=>f.object_id===eventId('mohae-goyang-e6da1b391beb5c1c')&&f.field==='event.starts_on');
 assert.equal(freshness(dates,data.as_of),'stale');assert.ok(!data.tables.facts.some(f=>f.review_state==='reviewed'));
});
test('ontology pilot: missing, forged and changed field evidence is rejected',()=>{
 const missing=build();missing.tables.facts.shift();fails(missing,'missing_evidence');
 const bad=build();bad.tables.facts[0].source_path='/not-in-source';fails(bad,'source_pointer');
 const upgrade=build();upgrade.tables.facts[0].review_state='reviewed';fails(upgrade,'review_upgrade');
 const altered=build();altered.tables.snapshots[0].raw_json='{}';fails(altered,'source_hash');
});
test('ontology pilot: impossible dates, timezone errors and time reversal are rejected',()=>{
 assert.equal(validDate('2026-02-30'),false);assert.equal(validInstant('2026-02-30T17:00:00+09:00'),false);
 assert.equal(validInstant('2026-10-11T24:00:00+09:00'),false);
 const bad=build();bad.tables.events[0].starts_on='2026-02-30';fails(bad,'date');
 const reversed=build();reversed.tables.occurrences[0].ends_at='2026-10-01T08:00:00+09:00';fails(reversed,'occurrence_range');
 assert.notEqual(sql(reversed).status,0);
});
test('ontology SQL contract: duplicate IDs, dangling refs and incorrect subtype fail',()=>{
 const duplicate=build();duplicate.tables.objects.push({...duplicate.tables.objects[0]});assert.notEqual(sql(duplicate).status,0);
 const dangling=build();dangling.tables.occurrences[0].event_id='00000000-0000-4000-8000-000000000001';assert.notEqual(sql(dangling).status,0);
 const wrong=build();wrong.tables.objects.find(o=>o.id===wrong.tables.places[0].object_id).kind='event';assert.notEqual(sql(wrong).status,0);
});
test('ontology SQL contract: wrong relation types and containment cycles fail',()=>{
 const wrong=build();wrong.tables.relations[0].to_id=wrong.tables.events[0].object_id;
 fails(wrong,'relation_type');assert.notEqual(sql(wrong).status,0);
 const cyclic=build(),p=cyclic.tables.relations.find(r=>r.predicate==='part_of');
 cyclic.tables.relations.push({...p,id:'synthetic-cycle',from_id:p.to_id,to_id:p.from_id});
 fails(cyclic,'containment_cycle');assert.notEqual(sql(cyclic).status,0);
});
test('ontology SQL contract: negative prices, out-of-range points and unknown columns fail',()=>{
 const negative=build();negative.tables.prices[0].minimum=-1;assert.notEqual(sql(negative).status,0);
 const coordinate=build();coordinate.tables.places[0].latitude=100;assert.notEqual(sql(coordinate).status,0);fails(coordinate,'coordinate');
 const unknown=build();unknown.tables.objects[0].unregistered_field=true;assert.notEqual(sql(unknown).status,0);
});
test('ontology SQL contract: synthetic false, unknown, not applicable, conflict remain distinct',()=>{
 const data=build(),a=data.tables.admissions[0];
 // SQL type/state test only. These synthetic values never enter the real output artifact.
 for(const [state,value] of [['known',0],['unknown',null],['not_applicable',null],['conflict',null]]){
  a.reservation_state=state;a.reservation_required=value;assert.equal(sql(data).status,0);
 }
 a.reservation_state='known';a.reservation_required=null;assert.notEqual(sql(data).status,0);
 a.reservation_state='unknown';a.reservation_required=0;assert.notEqual(sql(data).status,0);
});
test('ontology SQL contract: synthetic overnight window is allowed but reverse is not',()=>{
 const data=build(),occ=data.tables.occurrences[0];occ.starts_at='2026-10-01T22:00:00+09:00';occ.ends_at='2026-10-02T02:00:00+09:00';
 assert.equal(sql(data).status,0);occ.ends_at='2026-10-01T02:00:00+09:00';assert.notEqual(sql(data).status,0);
});
test('ontology pilot: full candidate validation does not modify prior release on failure',()=>{
 const before=fs.readFileSync(root+'data/ontology/pilot.json','utf8'),bad=build();bad.tables.objects.push({...bad.tables.objects[0]});
 assert.notEqual(sql(bad).status,0);assert.equal(fs.readFileSync(root+'data/ontology/pilot.json','utf8'),before);
 assert.equal(sql(build()).status,0);
});
test('ontology pilot: synthetic source cancellation is preserved without fabricating a new occurrence',()=>{
 const input=structuredClone(sources),m=structuredClone(manifest),s=selection('goyang-megashow-travel-20261112');
 const record=input.records.find(r=>r.id===s.record_id);record.raw.status='cancelled';record.payload_sha256=hash(record.raw);m.source_digest=hash(input.records);
 const result=buildPilot(m,input);assert.equal(result.tables.events.find(e=>e.object_id===s.id).status,'cancelled');
 assert.equal(result.tables.occurrences.filter(o=>o.event_id===s.id).length,0);assert.deepEqual(validatePilot(result),[]);
});
test('ontology pilot: schedule, classification and raw price tampering are rejected',()=>{
 const schedule=build();schedule.tables.schedules[0].exceptions_json='[]';
 const index=schedule.tables.schedules.findIndex(s=>JSON.parse(s.exceptions_json).length);
 assert.ok(index>=0);schedule.tables.schedules[index].exceptions_json='[]';fails(schedule,'schedule_source');
 const price=build();price.tables.prices[0].raw_text='모든 부대행사 무료';fails(price,'price_source');
 const cls=build();cls.tables.classifications[0].concept='invented';fails(cls,'classification_source');
});
test('ontology pilot: a invalid timezone is reported, not silently used or thrown during date conversion',()=>{
 const data=build();data.tables.events[0].timezone='Not/A_Timezone';fails(data,'timezone');
});
