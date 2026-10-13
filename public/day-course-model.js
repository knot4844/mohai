import {haversine} from './engine.js';
export function orderedCandidates(items,origin){return items.filter(x=>x.point&&Number.isFinite(x.point.lat)&&Number.isFinite(x.point.lng)).map(x=>({...x,distanceKm:haversine(origin,x.point)})).sort((a,b)=>(a.distanceKm??Infinity)-(b.distanceKm??Infinity)||a.id.localeCompare(b.id));}
export function addCourseStop(stops,stop){if(stops.some(s=>s.id===stop.id)||stops.length>=4)return stops;return [...stops,stop];}
export function moveCourseStop(stops,index,delta){const next=index+delta;if(index<0||next<0||index>=stops.length||next>=stops.length)return stops;const result=[...stops];[result[index],result[next]]=[result[next],result[index]];return result;}
// Never estimate duration from distance. Lines represent visit order, not roads.
export function courseLegs(stops,origin){return stops.map((stop,i)=>({from:i?stops[i-1].point:origin,to:stop.point,distanceKm:haversine(i?stops[i-1].point:origin,stop.point),minutes:null}));}

// A missing source is not a navigable detail page. Only absolute web URLs are allowed.
export function safeDetailURL(value){
 if(typeof value!=='string'||!/^https?:\/\//i.test(value))return null;
 try{const url=new URL(value);return url.hostname&&!url.username&&!url.password?url.href:null;}catch{return null;}
}

// Refresh event labels/metadata from the current locale and remove expired candidates.
// Place selections remain snapshots of the lookup that the user actually selected.
export function reconcileEventStops(stops,events){
 const current=new Map(events.map(e=>[e.id,e]));
 return stops.flatMap(stop=>stop.kind==='event'?(current.has(stop.id)?[current.get(stop.id)]:[]):[stop]);
}
