import {eventSessions} from './engine.js';
export function visitDuration(event,date){
 if(event.visit_duration_raw)return {raw:event.visit_duration_raw};
 if(event.category!=='performance')return null;
 const durations=[...new Set(eventSessions(event,date).filter(s=>Number.isFinite(s.end)&&s.end>s.start).map(s=>s.end-s.start))];
 return durations.length?{minutes:durations}:null;
}
