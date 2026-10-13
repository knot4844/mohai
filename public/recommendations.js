import {availability,eventSessions,haversine,isRegistrationClosed} from './engine.js';
import {maySuggest} from './verification.js';
export const scenarios={quick:{minutes:120,maxStops:1,stay:60,radius:{walk:1,transit:3,car:5}},half:{minutes:240,maxStops:2,stay:60,radius:{walk:2,transit:10,car:15}},day:{minutes:480,maxStops:4,stay:90,radius:{walk:4,transit:25,car:35}}};
// Distance bounds and a 40% unallocated budget are selection heuristics, not travel estimates.
// Unknown travel times must still be checked by planDay before a course is time-verified.
export function recommend(events,{origin,date,scenario='quick',transport='car',departure=600,returnBy=1439,weather,now=Date.now()}={}){
 const preset=scenarios[scenario]||scenarios.quick,budget=Math.max(0,Math.min(preset.minutes,returnBy-departure)),radius=preset.radius[transport]??preset.radius.car;
 if(!origin||budget<preset.stay)return {events:[],dwell:{},radius,budget,verified:false};
 const candidates=events.filter(e=>maySuggest(e,now)&&e.editorial?.point&&availability(e,date)==='confirmed'&&eventSessions(e,date).some(s=>s.end!=null)&&!isRegistrationClosed(e)&&!(e.editorial.weatherSensitive&&weather?.rainProbability>=50)&&haversine(origin,e.editorial.point)<=radius);
 const chosen=[],dwell={},places=new Set();let at=origin,spent=0,optimistic=departure;
 while(chosen.length<preset.maxStops&&spent+preset.stay<=budget*.6){
  const eligible=candidates.filter(e=>!places.has(`${e.editorial.point.lat},${e.editorial.point.lng}`)).map(e=>{
   const sessions=eventSessions(e,date),session=sessions.find(s=>e.category==='performance'?s.start>=optimistic&&s.end!=null&&s.end<=departure+budget:(s.end==null||Math.max(optimistic,s.start)+preset.stay<=Math.min(s.end,departure+budget)));
   if(sessions.length&&!session)return null;
   const start=session?Math.max(optimistic,session.start):optimistic,stay=e.category==='performance'&&session?session.end-session.start:preset.stay;
   if(stay<=0||spent+(start-optimistic)+stay>budget*.6||start+stay>departure+budget||e.editorial.lastEntry!=null&&start>e.editorial.lastEntry)return null;
   const rain=weather?.rainProbability>=50,env=e.editorial.environment;
   const score=(start-optimistic)/15+haversine(at,e.editorial.point)+(availability(e,date)==='uncertain'?3:0)+(rain?(env==='indoor'?-8:env==='outdoor'?8:0):0);
   return {e,start,stay,score};
  }).filter(Boolean).sort((a,b)=>a.score-b.score||a.e.id.localeCompare(b.e.id));
  if(!eligible.length)break;const {e,start,stay}=eligible[0];chosen.push(e);dwell[e.id]=stay;spent+=start-optimistic+stay;optimistic=start+stay;at=e.editorial.point;places.add(`${at.lat},${at.lng}`);
 }
 return {events:chosen,dwell,radius,budget,verified:false};
}
