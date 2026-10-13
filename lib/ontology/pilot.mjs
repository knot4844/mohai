import {createHash} from 'node:crypto';

export const TABLES=['snapshots','objects','places','events','occurrences','relations','schedules','admissions','prices','facts','classifications','mappings'];
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Only dependent row IDs are derived. Object/session IDs are issued once in the manifest.
export const rowId=(...parts)=>hash(parts).slice(0,32);
export function pointer(value,path){
 if(path==='')return value;
 if(!path.startsWith('/'))throw new Error('Invalid source pointer');
 for(const part of path.slice(1).split('/').map(p=>p.replace(/~1/g,'/').replace(/~0/g,'~'))){
  if(value===null||typeof value!=='object'||!Object.hasOwn(value,part))return undefined;
  value=value[part];
 }
 return value;
}
const j=value=>JSON.stringify(value);
const pathExists=(r,path)=>pointer(r.raw,path)!==undefined;
export function assertInputs(manifest,sources){
 if(manifest.schema_version!=='0.1.0'||manifest.transform_version!=='pilot-1')throw new Error('Unsupported contract version');
 if(hash(sources.records)!==manifest.source_digest)throw new Error('Source bundle drift: explicit snapshot review required');
 const ids=new Set(),recordIds=new Set();
 for(const r of sources.records){
  if(recordIds.has(r.id)||hash(r.raw)!==r.payload_sha256)throw new Error('Source record hash/ID mismatch');
  recordIds.add(r.id);
 }
 for(const s of manifest.selections){
  if(ids.has(s.id)||!recordIds.has(s.record_id))throw new Error('Selection ID/reference mismatch');
  ids.add(s.id);
  const r=sources.records.find(r=>r.id===s.record_id),v=pointer(r.raw,s.source_path);
  if(!v||v.id!==s.legacy_id)throw new Error('Selection source identity mismatch');
  if(s.kind==='event'&&s.occurrence_ids.length!==v.schedule.sessions.length)throw new Error('Occurrence identity reconciliation required');
  for(const id of s.occurrence_ids){if(ids.has(id))throw new Error('Duplicate issued ID');ids.add(id);}
 }
}

export function buildPilot(manifest,sources){
 assertInputs(manifest,sources);
 const tables=Object.fromEntries(TABLES.map(t=>[t,[]])),issues=[];
 const records=new Map(sources.records.map(r=>[r.id,r]));
 const addIssue=(object_id,code,note)=>issues.push({object_id,code,note});
 const addMapping=(r,path,legacy_id,target_id,disposition,reason)=>{
  if(tables.mappings.some(m=>m.snapshot_id===r.id&&m.source_path===path))return;
  tables.mappings.push({id:rowId('mapping',r.id,path),snapshot_id:r.id,source_path:path,legacy_id:legacy_id??null,target_id,disposition,reason});
 };
 function fact(r,object_id,occurrence_id,field,value,path,{group=null,transform='copy',state=null,validFrom=null,validUntil=null}={}){
  state??=value===null?'unknown':'known';
  if(!pathExists(r,path)){path='';transform='missing:'+field;}
  const v=r.raw.verification,fieldSources=(v?.source_version===r.raw.source_version?v?.sources:[])?.filter(s=>s.fields?.includes(group))||[];
  const times=fieldSources.map(s=>s.checked_at).filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(a)-Date.parse(b));
  const catalogDate=['object.canonical_name','place.address_text'].includes(field)?r.raw.checked:null;
  const checked=state==='known'?(times.at(-1)||catalogDate||null):null;
  tables.facts.push({id:rowId('fact',object_id,occurrence_id,field),object_id,occurrence_id,field,value_json:j(value),knowledge_state:state,review_state:'legacy_import',snapshot_id:r.id,source_path:path,transform,checked_at:checked,checked_precision:checked?(checked.includes('T')?'instant':'date'):'unknown',recheck_after:checked&&v?v.recheck_after??null:null,valid_from:validFrom,valid_until:validUntil,method:'legacy_import'});
 }
 for(const r of sources.records)tables.snapshots.push({id:r.id,source_file:r.file,source_selector:r.selector,payload_sha256:r.payload_sha256,source_version:r.raw.source_version??null,raw_json:j(r.raw),storage_scope:'local_research_only'});
 for(const s of manifest.selections){
  const r=records.get(s.record_id),raw=pointer(r.raw,s.source_path),pre=s.source_path;
  const nameField=s.kind==='event'?'title_ko':Object.hasOwn(raw,'name_ko')?'name_ko':'name';
  tables.objects.push({id:s.id,kind:s.kind,canonical_name:raw[nameField],publication_state:'research',lifecycle_state:'active'});
  addMapping(r,pre,s.legacy_id,s.id,'selected',s.case);
  fact(r,s.id,null,'object.canonical_name',raw[nameField],pre+'/'+nameField);
  if(s.kind==='place'){
   // Nested venue coordinates can be the parent facility's point. Never copy them to a hall.
   const p=pre?null:raw.point??null;
   const addressField=Object.hasOwn(raw,'address_ko')?'address_ko':'address';
   const place={object_id:s.id,address_text:raw[addressField]??null,latitude:p?.lat??null,longitude:p?.lng??null,location_role:p?'site_reference':null};
   tables.places.push(place);
   fact(r,s.id,null,'place.address_text',place.address_text,pre+'/'+addressField,{group:'venue'});
   fact(r,s.id,null,'place.location',p?{latitude:p.lat,longitude:p.lng,role:'site_reference'}:null,pre?pre+'/latitude':'/point',{transform:pre?'withheld:facility_coordinate':'point_to_site_reference'});
   fact(r,s.id,null,'place.opening_hours',null,pre?pre:'/hours',{transform:'withheld:no_verified_opening_schedule'});
   fact(r,s.id,null,'place.reservation_required',null,pre,{transform:'withheld:no_admission_evidence'});
   if(!p)addIssue(s.id,'location_unknown',pre?'시설 좌표를 개별 구역/홀로 복사하지 않음':'원본 좌표 미확인');
   addIssue(s.id,'opening_unknown','상설 운영시간을 행사·본관으로부터 상속하지 않음');
  }else{
   const sch=raw.schedule,coverage=sch.precision==='complete_sessions'?'complete':sch.precision==='partial_sessions'?'partial':'unknown';
   const event={object_id:s.id,starts_on:sch.start_date??null,ends_on:sch.end_date??null,timezone:sch.timezone,coverage,status:raw.status??'unknown',multi_site:raw.editorial?.multiSite?1:0};
   tables.events.push(event);
   for(const [field,value,path,group] of [['starts_on',event.starts_on,'/schedule/start_date','dates'],['ends_on',event.ends_on,'/schedule/end_date','dates'],['timezone',event.timezone,'/schedule/timezone','dates'],['coverage',coverage,'/schedule/precision','hours'],['status',event.status,'/status','dates']])fact(r,s.id,null,'event.'+field,value,path,{group,transform:field==='coverage'?'coverage_map':'copy'});
   tables.schedules.push({id:rowId('schedule',s.id),object_id:s.id,timezone:sch.timezone,coverage,raw_text:sch.raw_ko??null,recurrence_json:raw.editorial?.recurrence?j(raw.editorial.recurrence):null,exceptions_json:j(sch.exceptions||[]),snapshot_id:r.id,source_path:'/schedule'});
   for(const [i,session] of sch.sessions.entries()){
    const occ={id:s.occurrence_ids[i],event_id:s.id,starts_at:session.start??null,ends_at:session.end??null,local_date:session.start?.slice(0,10)??null,timezone:sch.timezone,status:session.status??'unknown',visit_mode:'unknown'};
    tables.occurrences.push(occ);
    for(const [field,key] of [['starts_at','start'],['ends_at','end'],['status','status']])fact(r,null,occ.id,'occurrence.'+field,occ[field],`/schedule/sessions/${i}/${key}`,{group:'hours'});
    fact(r,null,occ.id,'occurrence.visit_mode',null,`/schedule/sessions/${i}`,{transform:'withheld:category_is_not_admission'});
    if(!occ.ends_at)addIssue(s.id,'occurrence_end_unknown','시작만 확인된 회차에 종료·체류시간을 생성하지 않음');
   }
   const conflicting=!!raw.verification?.conflict;
   const explicit=typeof raw.reservation?.required==='boolean'?raw.reservation.required:null;
   const state=conflicting?'conflict':explicit===null?'unknown':'known';
   const reservation=state==='known'?explicit:null;
   tables.admissions.push({id:rowId('admission',s.id),object_id:s.id,reservation_required:reservation===null?null:Number(reservation),reservation_state:state,legacy_mode:raw.verification?.admission??null,raw_text:raw.reservation?.raw_ko??null,snapshot_id:r.id,source_path:Object.hasOwn(raw,'reservation')?'/reservation':''});
   fact(r,s.id,null,'admission.reservation_required',reservation,'/reservation/required',{group:'reservation',state,transform:conflicting?'withheld:legacy_conflict':'copy'});
   const price=raw.price;
   tables.prices.push({id:rowId('price',s.id),object_id:s.id,kind:price?.kind??'unknown',minimum:price?.min??null,maximum:price?.max??null,currency:price?.currency??null,scope:'legacy_record_only',raw_text:price?.raw_ko??null,snapshot_id:r.id,source_path:Object.hasOwn(raw,'price')?'/price':''});
   for(const [field,key] of [['minimum','min'],['maximum','max']])fact(r,s.id,null,'price.'+field,price?.[key]??null,'/price/'+key,{group:'fee'});
   if(!sch.sessions.length)addIssue(s.id,'no_explicit_occurrences','전체 기간/시간 원문에서 회차를 자동 생성하지 않음');
   if(conflicting)addIssue(s.id,'legacy_conflict','기존 검증의 충돌을 유지, 접수 조건 채택 보류');
   if(raw.verification?.admission==='walk_in'&&raw.verification?.unknown_fields?.includes('reservation'))addIssue(s.id,'admission_evidence_gap','walk_in 표시와 예약 미확인이 함께 있어 입장 확정 보류');
  }
  const classification=raw.editorial?.classification;
  const lists=s.kind==='event'?[
   ['legacy_category','kind',[raw.category],'/category','legacy'],
   ['legacy_taxonomy','topic',classification?.topics||[],'/editorial/classification/topics',String(classification?.version??'unknown')],
   ['legacy_taxonomy','audience_theme',classification?.audiences||[],'/editorial/classification/audiences',String(classification?.version??'unknown')]
  ]:[['legacy_catalog','topic',raw.topics||[],pre+'/topics','unversioned']];
  for(const [namespace,dimension,concepts,path,version] of lists)for(const [index,concept] of concepts.entries())if(concept)tables.classifications.push({id:rowId('class',s.id,namespace,dimension,concept),object_id:s.id,namespace,dimension,concept,version,snapshot_id:r.id,source_path:namespace==='legacy_category'?path:path+'/'+index,review_state:'legacy_import'});
 }
 // Bind only the reviewed source-reference decisions, never fuzzy name/coordinate matches.
 for(const d of manifest.relation_decisions||[]){
  const r=records.get(d.record_id);
  if(!r||!pathExists(r,d.source_path))throw new Error('Relation source decision drift');
  tables.relations.push({id:d.id,from_id:d.from_id,to_id:d.to_id,predicate:d.predicate,snapshot_id:r.id,source_path:d.source_path,review_state:d.review_state,reason:d.reason});
  const v=pointer(r.raw,d.source_path);
  addMapping(r,d.source_path,v?.id??null,d.to_id,'reference',d.reason);
 }
 for(const s of manifest.selections.filter(s=>s.kind==='event')){
  const r=records.get(s.record_id);
  for(const [i,v] of (r.raw.venues||[]).entries())if(!tables.mappings.some(m=>m.snapshot_id===r.id&&m.source_path===`/venues/${i}`))addMapping(r,`/venues/${i}`,v.id,null,'held','원문 개최 구역과 시설의 동일성을 추정하지 않음; 원문 보존');
 }
 return {schema_version:manifest.schema_version,transform_version:manifest.transform_version,as_of:manifest.as_of,mode:'offline_research',source_digest:manifest.source_digest,tables,issues,gaps:manifest.gaps};
}
