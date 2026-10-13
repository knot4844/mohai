import test from 'node:test';import assert from 'node:assert/strict';
import {matchesRegion,regionCities} from '../public/regions.js';
import {filterEvents} from '../public/engine.js';
const base={publication_status:'research',status:'scheduled',category:'festival',title_ko:'행사',schedule:{start_date:'2026-10-09',end_date:'2026-10-11',sessions:[]},editorial:{environment:'outdoor'}};
const sample=[{...base,id:'goyang',area_id:'kr-41-goyang'},...['seoul','gyeonggi'].map((province,i)=>({...base,id:province,region:{province,city:['jongno','paju'][i],labels:{ko:['종로구','파주시'][i]}}}))];
test('province and city filters intersect without excluding Goyang from Gyeonggi',()=>{
 assert.deepEqual(sample.filter(e=>matchesRegion(e,'gyeonggi')).map(e=>e.id),['goyang','gyeonggi']);
 assert.deepEqual(sample.filter(e=>matchesRegion(e,'seoul','jongno')).map(e=>e.id),['seoul']);
 assert.equal(sample.filter(e=>matchesRegion(e,'seoul','paju')).length,0);
 assert.deepEqual(regionCities(sample,'goyang').map(x=>x.id),['goyang']);
});
test('region filtering preserves date, cost and environment restrictions',()=>{
 assert.deepEqual(filterEvents(sample,{date:'2026-10-09',region:'gyeonggi',city:'paju'}).map(e=>e.id),['gyeonggi']);
 assert.equal(filterEvents(sample,{date:'2026-10-12',region:'seoul'}).length,0);
 assert.equal(filterEvents(sample,{date:'2026-10-09',region:'seoul',freeOnly:true}).length,0);
 assert.equal(filterEvents(sample,{date:'2026-10-09',region:'seoul',environment:'indoor'}).length,0);
});
