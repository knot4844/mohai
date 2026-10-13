import {verificationState,maySuggest} from '../public/verification.js';
import {dateKey,availability,eventSessions,isRegistrationClosed} from '../public/engine.js';
// Builds the operational recheck queue from the published ledger.
// It only reports why a record cannot be trusted today; it never edits recheck_after,
// never relaxes maySuggest and never fetches sources.
export const requiredFields=['dates','hours','venue','fee','reservation'];
export const suggestibleAdmission=['walk_in','onsite_registration'];
const hours=ms=>Math.round(ms/36e5*10)/10;
function addDays(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function recheckReasons(event,{now=Date.now()}={}){
 const v=event.verification||{},reasons=[],state=verificationState(event,now);
 if(!event.verification)reasons.push({code:'no_verification',detail_ko:'검증 기록 없음'});
 if(v.conflict)reasons.push({code:'conflict',detail_ko:'출처 간 충돌 기록'+(v.notes_ko?' · '+v.notes_ko:'')});
 if(v.review_blocked)reasons.push({code:'review_blocked',detail_ko:'원문 열람 실패 또는 보류'+((v.latest_attempts||[]).map(a=>` · ${a.outcome} ${a.attempted_at} ${a.url||''}`).join(''))});
 if(v.method&&!['official_page_text_review','tourapi_import','not_rechecked'].includes(v.method))reasons.push({code:'unknown_method',detail_ko:'알 수 없는 검증 방법 '+v.method});
 if(v.method==='not_rechecked')reasons.push({code:'never_reviewed',detail_ko:'직접 확인 이력 없음'});
 if(v.source_version&&event.source_version&&v.source_version!==event.source_version)reasons.push({code:'source_version_mismatch',detail_ko:'검증 당시 원문 버전과 현재 원문 버전 불일치'});
 const checked=Date.parse(v.checked_at),expires=Date.parse(v.recheck_after);
 if(v.checked_at&&!Number.isFinite(checked))reasons.push({code:'invalid_checked_at',detail_ko:'checked_at 형식 오류 '+v.checked_at});
 if(v.checked_at&&Number.isFinite(checked)&&checked>now)reasons.push({code:'checked_in_future',detail_ko:'확인 시각이 현재보다 미래 '+v.checked_at});
 if(v.recheck_after&&!Number.isFinite(expires))reasons.push({code:'invalid_recheck_after',detail_ko:'recheck_after 형식 오류 '+v.recheck_after});
 if(Number.isFinite(expires)&&expires<=now)reasons.push({code:'expired',detail_ko:`재확인 기한 ${v.recheck_after} 경과 · ${hours(now-expires)}시간 지남`,overdue_hours:hours(now-expires)});
 if(v.cached_source)reasons.push({code:'cached_source',detail_ko:'캐시된 목록 기준 확인 · 원문 직접 확인 필요'});
 if(v.method==='tourapi_import')reasons.push({code:'api_import',detail_ko:'TourAPI 원문 그대로 · 공식 페이지 대조 없음'});
 const verified=new Set(v.verified_fields||[]),missing=requiredFields.filter(f=>!verified.has(f));
 if(missing.length)reasons.push({code:'missing_required_fields',detail_ko:'자동 추천 필수 필드 미확인: '+missing.join(', '),fields:missing});
 if(!suggestibleAdmission.includes(v.admission))reasons.push({code:'admission_not_walk_in',detail_ko:'입장 조건 '+(v.admission||'미기록')+' · 현장 입장 확인 필요'});
 if(typeof event.schedule?.start_date!=='string'||typeof event.schedule?.end_date!=='string')reasons.push({code:'schedule_unknown',detail_ko:`시작일·종료일 미확인 (start ${event.schedule?.start_date??'없음'}, end ${event.schedule?.end_date??'없음'}) · 종료로 간주하지 않음`});
 if(event.editorial?.multiSite)reasons.push({code:'multi_site',detail_ko:'복수 장소 행사 · 회차별 장소 확인 필요'});
 if(!event.editorial?.point)reasons.push({code:'no_point',detail_ko:'좌표 없음'});
 if(!(event.schedule?.sessions||[]).length&&!event.editorial?.recurrence)reasons.push({code:'no_sessions',detail_ko:'회차·운영시간 없음(기간만 확인됨)'});
 return {state,reasons,missing_required:missing};
}
// Every condition the product actually applies before an event can be auto-suggested, evaluated with
// the real functions. `verification` blockers are the ones a recheck can address; the others are not.
export function suggestBlockers(event,{now=Date.now(),date}={}){
 const v=event.verification||{},state=verificationState(event,now),blockers=[];
 if(event.publication_status!=='research')blockers.push({code:'publication_status',detail_ko:`publication_status=${event.publication_status??'없음'} · filterEvents는 research만 표시`,recheck_addressable:false});
 if(event.editorial?.multiSite)blockers.push({code:'multi_site',detail_ko:'editorial.multiSite · maySuggest 제외',recheck_addressable:false});
 if(state!=='reviewed')blockers.push({code:'verification_state',detail_ko:`verificationState=${state} (reviewed 필요)`,recheck_addressable:['stale','unreviewed'].includes(state)});
 const verified=new Set(v.verified_fields||[]),missing=requiredFields.filter(f=>!verified.has(f));
 if(missing.length)blockers.push({code:'required_fields',detail_ko:'미확인 필수 필드: '+missing.join(', '),fields:missing,recheck_addressable:true});
 if(!suggestibleAdmission.includes(v.admission))blockers.push({code:'admission',detail_ko:`admission=${v.admission||'미기록'} (walk_in/onsite_registration 필요)`,recheck_addressable:v.admission==null||v.admission==='unknown'});
 if(!event.editorial?.point)blockers.push({code:'no_point',detail_ko:'editorial.point 없음 · recommend 제외',recheck_addressable:false});
 if(isRegistrationClosed(event))blockers.push({code:'registration_closed',detail_ko:'접수 마감·매진 원문',recheck_addressable:true});
 if(typeof event.schedule?.start_date!=='string'||typeof event.schedule?.end_date!=='string')blockers.push({code:'schedule_unknown',detail_ko:'시작일·종료일 미확인 · availability 판정 불가',recheck_addressable:true});
 else if(date){
  const a=availability(event,date),sessions=eventSessions(event,date);
  if(a!=='confirmed')blockers.push({code:'availability_on_date',detail_ko:`${date} availability=${a} (confirmed 필요)`,recheck_addressable:a==='uncertain'});
  else if(!sessions.some(s=>s.end!=null))blockers.push({code:'session_end_unknown',detail_ko:`${date} 회차 종료시각 없음 · recommend 제외`,recheck_addressable:true});
 }
 return {state,blockers,may_suggest:maySuggest(event,now),verification_only:blockers.length>0&&blockers.every(b=>b.recheck_addressable)};
}
export function recheckPriority(event,{date,reasons,blockers}){
 const s=event.schedule||{},soon=addDays(date,7),known=typeof s.start_date==='string'&&typeof s.end_date==='string',ongoingOrSoon=known&&s.start_date<=soon&&s.end_date>=date;
 // Date-specific blockers (today's availability / session end) describe the reference date, not the record; they do not lower priority.
 const codes=new Set(reasons.map(r=>r.code)),nonVerification=blockers.filter(b=>!b.recheck_addressable&&!['availability_on_date','session_end_unknown'].includes(b.code)).map(b=>b.code);
 if(codes.has('conflict')||codes.has('source_version_mismatch'))return {tier:'P1',basis_ko:'충돌·원문 변경은 표시 자체의 정확성 문제'};
 if(!known)return {tier:'P2',basis_ko:'시작일·종료일 미확인 · 개최 시기를 알 수 없어 종료로 간주하지 않고 일정 확인부터 필요'};
 if(ongoingOrSoon&&!nonVerification.length)return {tier:'P1',basis_ko:'7일 내 개최 · 차단 조건이 모두 재확인 대상 필드(재확인 결과는 미지)'};
 if(ongoingOrSoon)return {tier:'P2',basis_ko:'7일 내 개최 · 재확인과 무관한 차단 조건 있음: '+nonVerification.join(', ')};
 if(!nonVerification.length)return {tier:'P2',basis_ko:'개최까지 7일 이상 · 차단 조건이 모두 재확인 대상 필드'};
 return {tier:'P3',basis_ko:'개최까지 7일 이상 · 재확인과 무관한 차단 조건 있음: '+nonVerification.join(', ')};
}
export function buildRecheckQueue(data,{now=Date.now(),date=dateKey(new Date(now))}={}){
 const events=data.events||[],excluded=[],queue=[];
 for(const e of events){
  const s=e.schedule||{};
  if(['cancelled','postponed'].includes(e.status)){excluded.push({id:e.id,why:'status_'+e.status});continue;}
  // Unknown is not "ended": only a known end_date before the reference date excludes a record.
  if(typeof s.end_date==='string'&&s.end_date<date){excluded.push({id:e.id,why:'ended'});continue;}
  const {state,reasons,missing_required}=recheckReasons(e,{now});
  const {blockers,may_suggest,verification_only}=suggestBlockers(e,{now,date});
  const priority=recheckPriority(e,{date,reasons,blockers});
  queue.push({
   id:e.id,title_ko:e.title_ko,category:e.category,region:e.region?.labels?.ko||e.area_id||null,
   start_date:s.start_date??null,end_date:s.end_date??null,schedule_known:typeof s.start_date==='string'&&typeof s.end_date==='string',status:e.status||null,publication_status:e.publication_status||null,
   state,may_suggest_now:may_suggest,suggest_blockers:blockers,blockers_all_recheck_addressable:verification_only,priority:priority.tier,priority_basis_ko:priority.basis_ko,
   checked_at:e.verification?.checked_at||null,recheck_after:e.verification?.recheck_after||null,method:e.verification?.method||null,admission:e.verification?.admission||null,
   reasons,missing_required,unknown_fields:e.verification?.unknown_fields||[],
   sources:(e.verification?.sources||[]).map(x=>({url:x.url,fields:x.fields||[],checked_at:x.checked_at||null,method:x.method||null})),
   evidence_urls:(e.evidence||[]).map(x=>x.url).filter(u=>/^https?:\/\//.test(u||'')),
   homepage:e.providerHomepage||null
  });
 }
 const order={P1:0,P2:1,P3:2};
 queue.sort((a,b)=>order[a.priority]-order[b.priority]||String(a.start_date??'9999').localeCompare(String(b.start_date??'9999'))||a.id.localeCompare(b.id));
 const count=(list,f)=>list.reduce((m,x)=>{const k=f(x);m[k]=(m[k]||0)+1;return m;},{});
 return {
  generated_at:new Date(now).toISOString(),date,
  policy_ko:'재확인 기한(recheck_after)은 연장하지 않는다. 큐는 이유를 보고할 뿐 데이터·검증 상태를 바꾸지 않는다. 종료일이 확인되고 기준일보다 이전인 행사와 취소·연기 행사만 제외한다. 종료일 미확인은 종료가 아니라 schedule_unknown으로 큐에 남긴다.',
  counts:{total:events.length,excluded:excluded.length,excluded_by:count(excluded,x=>x.why),queued:queue.length,schedule_unknown:queue.filter(x=>!x.schedule_known).length,by_state:count(queue,x=>x.state),by_priority:count(queue,x=>x.priority),by_reason:count(queue.flatMap(x=>x.reasons),r=>r.code),by_blocker:count(queue.flatMap(x=>x.suggest_blockers),b=>b.code),blocker_combinations:count(queue,x=>x.suggest_blockers.map(b=>b.code).join('+')||'none'),suggestible_now:queue.filter(x=>x.may_suggest_now).length,blockers_all_recheck_addressable:queue.filter(x=>x.blockers_all_recheck_addressable).length},
  excluded,events:queue
 };
}
export function renderRecheckMarkdown(queue,{limit=Infinity}={}){
 const fmt=o=>Object.entries(o).map(([k,v])=>k+' '+v).join(', ')||'없음';
 const lines=[`# 재확인 큐 · ${queue.date} (생성 ${queue.generated_at})`,'',queue.policy_ko,'',`- 전체 ${queue.counts.total} · 제외 ${queue.counts.excluded} (${fmt(queue.counts.excluded_by)}) · 큐 ${queue.counts.queued} (일정 미확인 ${queue.counts.schedule_unknown}) · 지금 추천 가능 ${queue.counts.suggestible_now} · 차단 조건이 전부 재확인 대상인 건 ${queue.counts.blockers_all_recheck_addressable}`,`- 상태: ${fmt(queue.counts.by_state)}`,`- 우선순위: ${fmt(queue.counts.by_priority)}`,`- 재확인 사유: ${fmt(queue.counts.by_reason)}`,`- 추천 차단 조건(건수, 중복 집계): ${fmt(queue.counts.by_blocker)}`,`- 차단 조건 조합: ${fmt(queue.counts.blocker_combinations)}`,''];
 for(const e of queue.events.slice(0,limit)){
  lines.push(`## ${e.priority} · ${e.title_ko} (${e.id})`,`- 기간 ${e.schedule_known?`${e.start_date}~${e.end_date}`:`미확인 (start ${e.start_date??'없음'}, end ${e.end_date??'없음'})`} · ${e.category} · ${e.region||'지역 미확인'} · 상태 ${e.state} · 추천 가능 ${e.may_suggest_now?'예':'아니오'}`,`- 확인 ${e.checked_at||'없음'} → 기한 ${e.recheck_after||'없음'} · 방법 ${e.method||'없음'} · 입장 ${e.admission||'미기록'}`,`- 우선순위 근거: ${e.priority_basis_ko}`);
  for(const b of e.suggest_blockers)lines.push(`- 차단 [${b.code}${b.recheck_addressable?' · 재확인 대상':' · 재확인과 무관'}] ${b.detail_ko}`);
  for(const r of e.reasons)lines.push(`- 사유 [${r.code}] ${r.detail_ko}`);
  const urls=[...new Set([...e.sources.map(s=>s.url),...e.evidence_urls,...(e.homepage?[e.homepage]:[])])];
  for(const u of urls){const src=e.sources.find(s=>s.url===u);lines.push(`- 출처: ${u}${src?` (${src.fields.join(', ')||'필드 없음'} · ${src.checked_at||'확인시각 없음'})`:''}`);}
  lines.push('');
 }
 if(queue.events.length>limit)lines.push(`… ${queue.events.length-limit}건 더 (JSON 참조)`,'');
 return lines.join('\n');
}
