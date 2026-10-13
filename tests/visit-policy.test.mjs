import test from 'node:test';import assert from 'node:assert/strict';import {visitState} from '../public/visit-policy.js';
const date='2026-10-11',now=new Date('2026-10-11T15:00:00+09:00');
const event=(category='festival',end='18:00')=>({category,schedule:{start_date:date,end_date:date,sessions:[{start:date+'T10:00:00+09:00',end:date+'T'+end+':00+09:00'}]}});
test('ended date and ended sessions are not shown as current',()=>{assert.equal(visitState(event(), '2026-10-10',{now}),'ended');assert.equal(visitState(event('festival','14:00'),date,{now}),'ended');});
test('ongoing walk-in festival remains candidate, started performance does not',()=>{assert.equal(visitState(event(),date,{now}),'candidate');assert.equal(visitState(event('performance'),date,{now}),'unconfirmed');});
test('period only and sold out events are not suggested',()=>{const e=event();e.schedule.sessions=[];assert.equal(visitState(e,date,{now}),'unconfirmed');const sold=event();sold.reservation={sold_out:true};assert.equal(visitState(sold,date,{now}),'unavailable');});
