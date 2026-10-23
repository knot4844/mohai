import {distance,hasPoint} from './model.js';
export function spaceCandidates(places,{origin,filter='all',query='',offset=0}={}){
 if(!hasPoint(origin))return {places:[],total:0,offset:0};
 const unique=[...new Map(places.map(p=>[p.id,p])).values()];
 const eligible=unique.filter(p=>hasPoint(p.point)&&!p.conflict&&p.status!=='cancelled'&&(filter==='all'||p.category===filter)&&`${p.name} ${p.address}`.includes(query));
 eligible.sort((a,b)=>distance(origin,a.point)-distance(origin,b.point)||String(a.id).localeCompare(String(b.id)));
 const start=offset>=eligible.length?0:Math.max(0,offset);
 return {places:eligible.slice(start,start+3),total:eligible.length,offset:start};
}
