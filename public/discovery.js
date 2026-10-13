import {availability,haversine,isRegistrationClosed} from './engine.js';
import {verificationState} from './verification.js';
// Editorial discovery score, not popularity, booking availability or paid placement.
export function rankPlaces(places,{origin,date}={}){
 return places.map(p=>{
  const distance=origin?haversine(origin,p.point):null;
  const proximity=distance==null?0:40/(1+distance/5);
  const evidence=Math.max(...p.events.map(e=>{
   const status=verificationState(e);
   return (availability(e,date)==='confirmed'?35:10)+({reviewed:25,listed:15,stale:5,unreviewed:0,conflict:-40}[status]||0)-(isRegistrationClosed(e)?60:0);
  }));
  return {...p,discoveryScore:proximity+evidence,distance};
 }).sort((a,b)=>b.discoveryScore-a.discoveryScore||a.id.localeCompare(b.id));
}
