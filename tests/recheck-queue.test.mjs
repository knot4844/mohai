import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildRecheckQueue,recheckReasons,suggestBlockers,renderRecheckMarkdown} from '../lib/recheck-queue.mjs';
import {maySuggest} from '../public/verification.js';
const now=Date.parse('2026-10-12T00:00:00Z'),date='2026-10-12';
const base=()=>({id:'ev-1',title_ko:'테스트 행사',category:'festival',publication_status:'research',status:'scheduled',source_version:'v1',
 schedule:{start_date:'2026-10-10',end_date:'2026-10-20',sessions:[{start:'2026-10-12T10:00',end:'2026-10-12T18:00'}]},
 editorial:{point:{lat:37.65,lng:126.77}},evidence:[{url:'https://example.org/e'}],
 verification:{source_version:'v1',method:'official_page_text_review',checked_at:'2026-10-11T00:00:00Z',recheck_after:'2026-10-12T00:00:00Z',verified_fields:['dates','hours','venue','fee','reservation'],unknown_fields:['conditions'],admission:'walk_in',sources:[{url:'https://example.org/e',fields:['dates','hours','venue','fee','reservation'],checked_at:'2026-10-11T00:00:00Z'}]}});
test('expired review is the only blocker for an otherwise complete record; queue never edits the record',()=>{
 const e=base();const before=JSON.stringify(e);
 const {reasons}=recheckReasons(e,{now});assert.deepEqual(reasons.map(r=>r.code),['expired']);
 const {blockers,may_suggest,verification_only}=suggestBlockers(e,{now,date});
 assert.equal(may_suggest,false);assert.deepEqual(blockers.map(b=>b.code),['verification_state']);assert.equal(verification_only,true);
 assert.equal(JSON.stringify(e),before);
 // one minute earlier the same record is suggestible: expiry, not policy, is the cause
 assert.equal(maySuggest(e,now-60000),true);
});
test('every maySuggest and recommend precondition is reported separately and tagged as recheck-addressable or not',()=>{
 const e=base();e.publication_status='draft';e.editorial.multiSite=true;delete e.editorial.point;e.verification.verified_fields=['dates'];e.verification.admission='ticket_required';e.verification.conflict=true;e.schedule.sessions=[];
 const {blockers}=suggestBlockers(e,{now,date});const by=Object.fromEntries(blockers.map(b=>[b.code,b.recheck_addressable]));
 assert.deepEqual(Object.keys(by).sort(),['admission','availability_on_date','multi_site','no_point','publication_status','required_fields','verification_state'].sort());
 assert.equal(by.publication_status,false);assert.equal(by.multi_site,false);assert.equal(by.no_point,false);assert.equal(by.admission,false);
 assert.equal(by.required_fields,true);assert.equal(by.verification_state,false,'conflict is not cleared by a routine recheck');
 const fresh=base();fresh.schedule.sessions=[{start:'2026-10-12T10:00'}];fresh.verification.recheck_after='2026-10-13T00:00:00Z';
 assert.deepEqual(suggestBlockers(fresh,{now,date}).blockers.map(b=>b.code),['session_end_unknown']);
});
test('ended and cancelled events are excluded; priorities reflect date and non-verification blockers',()=>{
 const ended=base();ended.id='ended';ended.schedule.end_date='2026-10-11';
 const cancelled=base();cancelled.id='cancelled';cancelled.status='cancelled';
 const soon=base();soon.id='soon';
 const later=base();later.id='later';later.schedule.start_date='2026-12-01';later.schedule.end_date='2026-12-02';
 const ticket=base();ticket.id='ticket';ticket.verification.admission='ticket_required';
 const conflict=base();conflict.id='conflict';conflict.schedule.start_date='2026-12-01';conflict.schedule.end_date='2026-12-02';conflict.verification.conflict=true;
 const q=buildRecheckQueue({events:[ended,cancelled,later,ticket,soon,conflict]},{now,date});
 assert.deepEqual(q.excluded.map(x=>x.why).sort(),['ended','status_cancelled']);
 assert.deepEqual(q.events.map(e=>e.id),['soon','conflict','ticket','later']);
 assert.deepEqual(q.events.map(e=>e.priority),['P1','P1','P2','P2']);
 assert.equal(q.counts.suggestible_now,0);assert.equal(q.counts.by_blocker.verification_state,4);assert.equal(q.counts.blocker_combinations['verification_state'],1,'only the event confirmed today has expiry as its sole blocker');assert.equal(q.counts.blocker_combinations['verification_state+availability_on_date'],2,'the two December events (later, conflict) are additionally not open on the reference date');
 const md=renderRecheckMarkdown(q,{limit:1});assert.ok(md.includes('## P1 · 테스트 행사 (soon)'));assert.ok(md.includes('차단 [verification_state · 재확인 대상]'));assert.ok(md.includes('3건 더'));
});
test('unknown end date is never treated as ended: it stays queued as schedule_unknown',()=>{
 const noEnd=base();noEnd.id='no-end';delete noEnd.schedule.end_date;
 const noDates=base();noDates.id='no-dates';noDates.schedule={};
 const nullEnd=base();nullEnd.id='null-end';nullEnd.schedule.end_date=null;
 const ended=base();ended.id='ended';ended.schedule.end_date='2026-10-11';
 const q=buildRecheckQueue({events:[noEnd,noDates,nullEnd,ended]},{now,date});
 assert.deepEqual(q.excluded.map(x=>x.id),['ended']);
 assert.deepEqual(q.events.map(e=>e.id).sort(),['no-dates','no-end','null-end']);
 assert.equal(q.counts.schedule_unknown,3);
 for(const e of q.events){
  assert.equal(e.schedule_known,false);assert.equal(e.priority,'P2');
  assert.ok(e.reasons.some(r=>r.code==='schedule_unknown'),e.id);
  assert.ok(e.suggest_blockers.some(b=>b.code==='schedule_unknown'&&b.recheck_addressable===true),e.id);
  assert.ok(!e.suggest_blockers.some(b=>b.code==='availability_on_date'),'no availability verdict without dates');
 }
 assert.equal(q.events.find(e=>e.id==='no-dates').start_date,null);
 const md=renderRecheckMarkdown(q);assert.ok(md.includes('기간 미확인 (start 2026-10-10, end 없음)'));assert.ok(md.includes('일정 미확인 3'));
});
test('published ledger: no record is auto-suggestible today and every blocked record names its conditions',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url)));
 const q=buildRecheckQueue(data,{now,date});
 assert.equal(q.counts.total,data.events.length);assert.equal(q.counts.queued+q.counts.excluded,data.events.length);
 for(const e of q.events){assert.equal(e.may_suggest_now,false);assert.ok(e.suggest_blockers.length>0,e.id);assert.ok(['P1','P2','P3'].includes(e.priority));}
 assert.ok(q.counts.by_blocker.verification_state>0);
});
