import {availability,eventSessions,dateKey,isRegistrationClosed} from './engine.js';
// Period-only listings remain research material; they are not today's suggestions.
export function visitState(event,date,{now=new Date()}={}){
 if(date<dateKey(now)||availability(event,date)==='closed')return 'ended';
 if(isRegistrationClosed(event)||event.reservation?.sold_out||event.verification?.conflict)return 'unavailable';
 if(availability(event,date)!=='confirmed')return 'unconfirmed';
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number);
 const at=date===dateKey(now)?parts[0]*60+parts[1]:-1;
 const sessions=eventSessions(event,date);
 const future=sessions.some(s=>event.category==='performance'?s.start>at:s.end!=null&&s.end>at);
 if(future)return 'candidate';
 if(sessions.length&&sessions.every(s=>s.end!=null&&s.end<=at))return 'ended';
 return 'unconfirmed';
}
