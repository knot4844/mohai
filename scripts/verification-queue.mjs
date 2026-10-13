import fs from 'node:fs';import {verificationState} from '../public/verification.js';
const root=new URL('../',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('public/data.json',root))),now=Date.now(),states={};
const events=data.events.map(e=>{const state=verificationState(e,now);states[state]=(states[state]||0)+1;return {id:e.id,title:e.title_ko,area_id:e.area_id,review_state_at_publication:state,checked_at:e.verification.checked_at,recheck_after:e.verification.recheck_after,missing:e.verification.unknown_fields||[],source_urls:(e.verification.sources||[]).map(s=>s.url)};});
fs.writeFileSync(new URL('data/verification-queue.json',root),JSON.stringify({scope:`서울·경기 ${data.scope.window_start}~${data.scope.window_end} 조사. 지역 전체 완전성 및 실시간 운영 보장 아님`,generated_at:new Date(now).toISOString(),registered:events.length,states_at_publication:states,events},null,2)+'\n');
console.log(JSON.stringify(states));
