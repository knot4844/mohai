import {hash,pointer,TABLES} from './pilot.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value??''))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
export function validInstant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value))return false;
 return validDate(value.slice(0,10))&&Number.isFinite(Date.parse(value));
}
export function freshness(fact,asOf){
 if(!validInstant(asOf))throw new Error('Invalid as_of');
 if(fact.recheck_after&&Date.parse(fact.recheck_after)<=Date.parse(asOf))return 'stale';
 if(!fact.checked_at||fact.checked_precision!=='instant'||!fact.recheck_after)return 'unverified';
 return fact.review_state==='reviewed'?'fresh':'legacy_only';
}
export function validatePilot(bundle){
 const errors=[],t=bundle.tables,fail=(code,detail)=>errors.push({code,detail});
 if(!t||TABLES.some(name=>!Array.isArray(t[name])))return [{code:'table_contract',detail:'Missing table arrays'}];
 if(bundle.schema_version!=='0.1.0'||bundle.mode!=='offline_research')fail('mode','Only research contract v0.1 supported');
 if(!validInstant(bundle.as_of))fail('as_of','Invalid reference instant');
 const maps=Object.fromEntries(TABLES.map(name=>[name,new Map(t[name].map(row=>[row.id??row.object_id,row]))]));
 for(const name of TABLES)if(maps[name].size!==t[name].length)fail('duplicate_id',name);
 for(const o of t.objects){
  if(!uuid.test(o.id))fail('object_id',o.id);
  if(!['place','event'].includes(o.kind)||!o.canonical_name?.trim()||o.publication_state!=='research')fail('object_contract',o.id);
  if(!maps[o.kind==='place'?'places':'events'].has(o.id))fail('subtype',o.id);
 }
 for(const p of t.places){
  if(maps.objects.get(p.object_id)?.kind!=='place')fail('subtype',p.object_id);
  if(p.latitude!==null&&(!Number.isFinite(p.latitude)||p.latitude< -90||p.latitude>90))fail('coordinate',p.object_id);
  if(p.longitude!==null&&(!Number.isFinite(p.longitude)||p.longitude< -180||p.longitude>180))fail('coordinate',p.object_id);
  if((p.latitude===null)!==(p.longitude===null)||(p.latitude===null)!==(p.location_role===null))fail('coordinate_pair',p.object_id);
 }
 for(const e of t.events){
  if(maps.objects.get(e.object_id)?.kind!=='event')fail('subtype',e.object_id);
  for(const v of [e.starts_on,e.ends_on])if(v!==null&&!validDate(v))fail('date',e.object_id);
  if(e.starts_on&&e.ends_on&&e.starts_on>e.ends_on)fail('event_range',e.object_id);
  if(!['complete','partial','unknown'].includes(e.coverage))fail('coverage',e.object_id);
  try{new Intl.DateTimeFormat('en',{timeZone:e.timezone});}catch{fail('timezone',e.object_id);}
 }
 for(const o of t.occurrences){
  if(!uuid.test(o.id)||maps.objects.has(o.id))fail('occurrence_id',o.id);
  const e=maps.events.get(o.event_id);if(!e){fail('occurrence_parent',o.id);continue;}
  let validZone=true;try{new Intl.DateTimeFormat('en',{timeZone:e.timezone});}catch{validZone=false;}
  for(const v of [o.starts_at,o.ends_at])if(v!==null&&!validInstant(v))fail('instant',o.id);
  if(o.local_date!==null&&!validDate(o.local_date))fail('date',o.id);
  if(o.ends_at&&(!o.starts_at||Date.parse(o.ends_at)<=Date.parse(o.starts_at)))fail('occurrence_range',o.id);
  if(o.timezone!==e.timezone)fail('timezone',o.id);
  if(validZone&&o.starts_at&&validInstant(o.starts_at)){
   const date=new Intl.DateTimeFormat('en-CA',{timeZone:e.timezone}).format(new Date(o.starts_at));
   if(o.local_date!==date)fail('local_date',o.id);
   if((e.starts_on&&date<e.starts_on)||(e.ends_on&&date>e.ends_on))fail('outside_event',o.id);
  }
 }
 const raws=new Map();
 for(const s of t.snapshots){
  try{const raw=JSON.parse(s.raw_json);raws.set(s.id,raw);if(hash(raw)!==s.payload_sha256)fail('source_hash',s.id);}catch{fail('raw_json',s.id);}
  if(s.storage_scope!=='local_research_only')fail('source_policy',s.id);
 }
 const reconstructed=t.snapshots.map(s=>({id:s.id,file:s.source_file,selector:s.source_selector,payload_sha256:s.payload_sha256,raw:raws.get(s.id)}));
 if(hash(reconstructed)!==bundle.source_digest)fail('source_digest','Frozen source ledger mismatch');
 const reference=(row)=>{
  if(!raws.has(row.snapshot_id))fail('snapshot_ref',row.id);
  else if(pointer(raws.get(row.snapshot_id),row.source_path)===undefined)fail('source_pointer',row.id);
 };
 for(const name of ['relations','schedules','admissions','prices','facts','classifications','mappings'])for(const row of t[name])reference(row);
 for(const row of t.schedules){
  const raw=raws.get(row.snapshot_id),sch=raw?.schedule;
  if(!sch||row.raw_text!==(sch.raw_ko??null)||row.exceptions_json!==JSON.stringify(sch.exceptions||[])||row.recurrence_json!==(raw.editorial?.recurrence?JSON.stringify(raw.editorial.recurrence):null))fail('schedule_source',row.id);
  try{for(const x of JSON.parse(row.exceptions_json))if(!validDate(x.date))fail('exception_date',row.id);}catch{fail('exceptions_json',row.id);}
 }
 for(const row of t.admissions){
  const raw=raws.get(row.snapshot_id);
  const expected=raw?.verification?.conflict?'conflict':typeof raw?.reservation?.required==='boolean'?'known':'unknown';
  const value=expected==='known'?Number(raw.reservation.required):null;
  if(row.reservation_state!==expected||row.reservation_required!==value||row.legacy_mode!==(raw?.verification?.admission??null)||row.raw_text!==(raw?.reservation?.raw_ko??null))fail('admission_source',row.id);
 }
 for(const row of t.prices){
  const price=raws.get(row.snapshot_id)?.price;
  if(row.kind!==(price?.kind??'unknown')||row.minimum!==(price?.min??null)||row.maximum!==(price?.max??null)||row.currency!==(price?.currency??null)||row.raw_text!==(price?.raw_ko??null))fail('price_source',row.id);
 }
 for(const row of t.classifications)if(pointer(raws.get(row.snapshot_id),row.source_path)!==row.concept)fail('classification_source',row.id);
 const edges=new Map(),keys=new Set();
 for(const r of t.relations){
  const a=maps.objects.get(r.from_id),b=maps.objects.get(r.to_id);
  if(!a||!b){fail('relation_ref',r.id);continue;}
  if(r.predicate==='part_of'){
   if(a.kind!==b.kind)fail('relation_type',r.id);
   edges.set(a.id,[...(edges.get(a.id)||[]),b.id]);
  }else if(!['held_at','facility_reference'].includes(r.predicate)||a.kind!=='event'||b.kind!=='place')fail('relation_type',r.id);
  const key=[a.id,b.id,r.predicate].join('|');if(keys.has(key))fail('duplicate_relation',r.id);keys.add(key);
 }
 const visited=new Set(),active=new Set();
 function visit(id){if(active.has(id)){fail('containment_cycle',id);return;}if(visited.has(id))return;active.add(id);for(const child of edges.get(id)||[])visit(child);active.delete(id);visited.add(id);}
 for(const id of edges.keys())visit(id);
 const factKeys=new Set();
 function current(f){
  const o=maps.objects.get(f.object_id),p=maps.places.get(f.object_id),e=maps.events.get(f.object_id),occ=maps.occurrences.get(f.occurrence_id);
  const admission=t.admissions.find(a=>a.object_id===f.object_id),price=t.prices.find(p=>p.object_id===f.object_id);
  const values={
   'object.canonical_name':o?.canonical_name,'place.address_text':p?.address_text,
   'place.location':p?(p.latitude===null?null:{latitude:p.latitude,longitude:p.longitude,role:p.location_role}):undefined,
   'place.opening_hours':p?null:undefined,'place.reservation_required':p?null:undefined,
   ...Object.fromEntries(['starts_on','ends_on','timezone','coverage','status'].map(k=>['event.'+k,e?.[k]])),
   ...Object.fromEntries(['starts_at','ends_at','status'].map(k=>['occurrence.'+k,occ?.[k]])),
   'occurrence.visit_mode':occ?(occ.visit_mode==='unknown'?null:occ.visit_mode):undefined,
   'admission.reservation_required':admission?(admission.reservation_required===null?null:!!admission.reservation_required):undefined,
   'price.minimum':price?.minimum,'price.maximum':price?.maximum
  };
  return values[f.field];
 }
 for(const f of t.facts){
  const key=[f.object_id??f.occurrence_id,f.field].join('|');if(factKeys.has(key))fail('duplicate_fact',key);factKeys.add(key);
  if((f.object_id!==null)+(f.occurrence_id!==null)!==1)fail('fact_subject',f.id);
  let v;try{v=JSON.parse(f.value_json);}catch{fail('fact_json',f.id);continue;}
  if(!['known','unknown','not_applicable','conflict'].includes(f.knowledge_state)||(f.knowledge_state==='known')===(v===null))fail('knowledge_state',f.id);
  if(JSON.stringify(current(f))!==f.value_json)fail('fact_current_mismatch',f.id);
  const raw=raws.get(f.snapshot_id),source=raw?pointer(raw,f.source_path):undefined;
  if(f.transform==='copy'&&JSON.stringify(source)!==f.value_json)fail('copy_mismatch',f.id);
  if(f.transform.startsWith('withheld:')&&v!==null)fail('withheld_value',f.id);
  if(f.transform.startsWith('missing:')&&v!==null)fail('missing_value',f.id);
  if(f.transform==='point_to_site_reference'&&v!==null&&JSON.stringify({latitude:source?.lat,longitude:source?.lng,role:'site_reference'})!==f.value_json)fail('point_mismatch',f.id);
  if(f.transform==='coverage_map'&&v!==(source==='complete_sessions'?'complete':source==='partial_sessions'?'partial':'unknown'))fail('coverage_mismatch',f.id);
  if(f.checked_precision==='instant'&&!validInstant(f.checked_at))fail('checked_at',f.id);
  if(f.checked_precision==='date'&&!validDate(f.checked_at))fail('checked_at',f.id);
  if(f.checked_precision==='unknown'&&f.checked_at!==null)fail('checked_at',f.id);
  if(f.recheck_after!==null&&!validInstant(f.recheck_after))fail('recheck_after',f.id);
  if(f.checked_at&&f.recheck_after&&Date.parse(f.recheck_after)<Date.parse(f.checked_at))fail('recheck_order',f.id);
  // This is a frozen legacy import, not a new source review.
  if(f.review_state==='reviewed')fail('review_upgrade',f.id);
 }
 for(const o of t.objects){
  const fields=o.kind==='place'?['object.canonical_name','place.address_text','place.location','place.opening_hours','place.reservation_required']:['object.canonical_name','event.starts_on','event.ends_on','event.timezone','event.coverage','event.status','admission.reservation_required','price.minimum','price.maximum'];
  for(const field of fields)if(!factKeys.has(o.id+'|'+field))fail('missing_evidence',o.id+':'+field);
 }
 for(const o of t.occurrences)for(const field of ['starts_at','ends_at','status','visit_mode'])if(!factKeys.has(o.id+'|occurrence.'+field))fail('missing_evidence',o.id+':'+field);
 for(const m of t.mappings){
  if(m.disposition==='held'?m.target_id!==null:!maps.objects.has(m.target_id))fail('mapping_target',m.id);
 }
 for(const row of t.classifications)if(!maps.objects.has(row.object_id))fail('classification_target',row.id);
 return errors;
}
