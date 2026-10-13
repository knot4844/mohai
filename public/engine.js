import {matchesTopic,matchesAudience,topics,audiences} from './taxonomy.js';
import {maySuggest} from './verification.js';
import {matchesRegion} from './regions.js';
/* Provider-independent, deterministic ontology and scheduling rules. No network. */
export const locales = ['ko','en','ja','zh-Hans'];
export const dateKey = (date=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function minute(iso) { const m=String(iso).match(/T(\d{2}):(\d{2})/); return m?Number(m[1])*60+Number(m[2]):null; }
export const timeString=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.round(m%60)).padStart(2,'0')}`;
export function haversine(a,b){if(!a||!b)return null;const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r,s=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;return 6371*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));}
export function availability(event,date){
 const s=event.schedule;
 if(event.status==='cancelled'||event.status==='postponed') return 'closed';
 if(date<s.start_date||date>s.end_date) return 'closed';
 if((s.exceptions||[]).some(x=>x.date===date&&['closed','cancelled'].includes(x.status)))return 'closed';
 const sessions=(s.sessions||[]).filter(x=>x.start.slice(0,10)===date&&x.status!=='cancelled');
 if(sessions.length)return 'confirmed';
 if(s.verified_window&&date>=s.verified_window.start&&date<=s.verified_window.end)return 'closed';
 if(s.precision==='complete_sessions')return 'closed';
 // Editorial recurrence is backed by the original source; no inferred daily schedule.
 const rule=event.editorial?.recurrence;
 if(rule){const day=new Date(date+'T12:00:00+09:00').getUTCDay(); if(rule.weekdays&&!rule.weekdays.includes(day))return 'closed';if(rule.excludedDates?.includes(date))return 'closed';return 'confirmed';}
 return 'uncertain';
}
export function eventSessions(event,date){const explicit=(event.schedule.sessions||[]).filter(x=>x.start.slice(0,10)===date&&x.status!=='cancelled').map(x=>({start:minute(x.start),end:minute(x.end)}));if(explicit.length)return explicit;const r=event.editorial?.recurrence;if(r&&availability(event,date)==='confirmed')return [{start:r.start,end:r.end}];return [];}
export function isRegistrationClosed(event){if(['performer_application','general_admission'].includes(event.reservation?.scope))return false;return /(?:접수|모집|예약)\s*(?:마감|종료)|매진/.test(event.reservation?.raw_ko||'');}
export function filterEvents(events,{date,region='all',city='all',category='all',topic='all',audience='all',environment='all',query='',includePrograms=false,freeOnly=false}){const q=query.trim().toLowerCase();return events.filter(e=>e.publication_status==='research'&&matchesRegion(e,region,city)&&availability(e,date)!=='closed'&&(includePrograms||!isRegistrationClosed(e))&&(category==='all'||e.category===category)&&matchesTopic(e,topic)&&matchesAudience(e,audience)&&(environment==='all'||e.editorial?.environment===environment)&&(!freeOnly||e.price?.kind==='free')&&(!q||JSON.stringify([e.title_ko,e.venues,e.translations]).toLowerCase().includes(q)));}
export function rankEvents(events,{origin,weather,date,departure=600}){return [...events].sort((a,b)=>score(b)-score(a));function score(e){let v=date&&availability(e,date)==='confirmed'?12:0;const p=e.editorial?.point;if(origin&&p)v-=haversine(origin,p)/4;if(!p)v-=15;if(e.editorial?.media)v+=3;if(e.category==='festival')v+=4;if(isRegistrationClosed(e))v-=100;if(weather?.rainProbability>=50&&e.editorial?.environment==='indoor')v+=8;if(weather?.rainProbability>=50&&e.editorial?.environment==='outdoor')v-=8;return v;}}
export function buildGraph(events){const nodes=[],edges=[],seen=new Set();function add(n){if(!seen.has(n.id)){nodes.push(n);seen.add(n.id);}}for(const e of events){add({id:e.id,type:'event',label:e.title_ko});for(const id of e.editorial?.classification?.topics||[]){const tag=topics.find(t=>t.id===id);if(!tag)continue;add({id:'topic:'+id,type:'topic',label:tag.labels.ko});edges.push({from:e.id,to:'topic:'+id,relation:'classified_as'});if(tag.parent){const parent=topics.find(t=>t.id===tag.parent);add({id:'topic:'+parent.id,type:'topic',label:parent.labels.ko});if(!edges.some(x=>x.from==='topic:'+id&&x.relation==='subtopic_of'))edges.push({from:'topic:'+id,to:'topic:'+parent.id,relation:'subtopic_of'});}}for(const id of e.editorial?.classification?.audiences||[]){const tag=audiences.find(t=>t.id===id);if(tag){add({id:'audience:'+id,type:'audience_theme',label:tag.labels.ko});edges.push({from:e.id,to:'audience:'+id,relation:'has_audience_theme'});}}for(const v of (e.editorial?.locations?.length?e.editorial.locations.map(p=>({id:p.id,name_ko:p.name})):e.venues)){add({id:v.id,type:'place',label:v.name_ko});edges.push({from:e.id,to:v.id,relation:'held_at'});}for(const s of e.schedule.sessions){const id=`${e.id}@${s.start}`;add({id,type:'session',start:s.start,end:s.end});edges.push({from:e.id,to:id,relation:'has_session'});}for(const ev of e.evidence){add({id:ev.source_id,type:'source',url:ev.url});edges.push({from:e.id,to:ev.source_id,relation:'supported_by'});}}return {nodes,edges};}
export function planDay(events,{date,departure=600,returnBy=1140,legs=[],dwell={},buffer=15,maxLeg=120,returnHome=true}){
 let cursor=departure,clockKnown=true;const stops=[],issues=[];if(!Number.isFinite(departure)||!Number.isFinite(returnBy)||departure>=returnBy){clockKnown=false;issues.push({code:'invalid_time'});}
 for(let i=0;i<events.length;i++){
  const e=events[i],leg=legs[i],duration=leg?.durationMinutes;
  if(!Number.isFinite(duration)){clockKnown=false;issues.push({eventId:e.id,code:'travel_unknown'});}else{if(duration>maxLeg)issues.push({eventId:e.id,code:'travel_limit'});if(clockKnown)cursor+=duration+buffer;}
  if(availability(e,date)==='closed')issues.push({eventId:e.id,code:'not_on_date'});
  if(isRegistrationClosed(e))issues.push({eventId:e.id,code:'registration_closed'});
  if(e.verification&&!maySuggest(e))issues.push({eventId:e.id,code:'verification_required'});
  const sessions=eventSessions(e,date),stay=Number(dwell[e.id]||60);let start=null,end=null,session=null;
  if(clockKnown){
   // Performance sessions are fixed starts; open exhibitions/festivals are windows.
   session=sessions.find(s=>e.category==='performance'?cursor<=s.start:(s.end==null||cursor+stay<=s.end));
   if(!sessions.length){issues.push({eventId:e.id,code:'hours_unknown'});clockKnown=false;}
   else if(!session){issues.push({eventId:e.id,code:'missed_session'});clockKnown=false;}
   else {start=e.category==='performance'?session.start:Math.max(cursor,session.start);end=e.category==='performance'&&session.end!=null?session.end:start+stay;if(session.end!=null&&end>session.end){issues.push({eventId:e.id,code:'insufficient_time'});clockKnown=false;}cursor=end;}
  }
  if(e.editorial?.lastEntry!=null&&start!=null&&start>e.editorial.lastEntry)issues.push({eventId:e.id,code:'entry_closed'});
  if(session&&session.end==null){issues.push({eventId:e.id,code:'duration_unknown'});}
  if(!e.editorial?.point)issues.push({eventId:e.id,code:'location_unknown'});
  stops.push({id:e.id,start,end,stay,leg:leg||null,session});
 }
 if(returnHome&&events.length){const last=legs[events.length];if(!Number.isFinite(last?.durationMinutes)){clockKnown=false;issues.push({code:'return_unknown'});}else{if(last.durationMinutes>maxLeg)issues.push({code:'travel_limit'});if(clockKnown)cursor+=last.durationMinutes+buffer;}}
 if(clockKnown&&cursor>returnBy)issues.push({code:'late_return'});
 return {stops,arrivalHome:clockKnown?cursor:null,issues,feasible:clockKnown&&issues.length===0,status:issues.length?'needs_check':'time_fit'};
}
