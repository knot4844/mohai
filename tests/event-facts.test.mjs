import test from 'node:test';import assert from 'node:assert/strict';import {visitDuration} from '../public/event-facts.js';
const date='2026-10-10',schedule={start_date:date,end_date:date,sessions:[{start:date+'T10:00:00+09:00',end:date+'T18:00:00+09:00'}]};
test('opening hours are not visit duration',()=>{assert.equal(visitDuration({category:'exhibition',schedule},date),null);});
test('fixed performance runtime uses actual sessions',()=>{assert.deepEqual(visitDuration({category:'performance',schedule},date),{minutes:[480]});assert.equal(visitDuration({category:'performance',schedule:{...schedule,sessions:[]}},date),null);});
test('official duration is kept as source text',()=>{assert.deepEqual(visitDuration({visit_duration_raw:'약 60분',schedule},date),{raw:'약 60분'});});
