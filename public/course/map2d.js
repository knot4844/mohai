import {categories,hasPoint,courseSegments} from './model.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function loadNaver(){
 if(window.naver?.maps)return window.naver.maps;
 const r=await fetch('/api/config');if(!r.ok)throw Error('네이버 지도 공개 설정을 불러오지 못했습니다');const c=await r.json();if(!c.mapClientId)throw Error('네이버 지도 공개 설정이 없습니다');
 await new Promise((resolve,reject)=>{const s=document.createElement('script');const timer=setTimeout(()=>{s.remove();reject(Error('네이버 지도 연결 시간 초과'));},12000);s.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(c.mapClientId)}&language=ko`;s.onload=()=>{clearTimeout(timer);window.naver?.maps?resolve():reject(Error('네이버 지도 인증 또는 로딩 실패'));};s.onerror=()=>{clearTimeout(timer);s.remove();reject(Error('네이버 지도 로딩 실패'));};document.head.append(s);});return window.naver.maps;
}
export function createCourseMap(n,element,all,onSelect,onViewport=()=>{}){
 const map=new n.Map(element,{center:new n.LatLng(36.5,127.8),zoom:7,zoomControl:true,scrollWheel:false});let objects=[],origin=null;
 let timer;
 const viewport=()=>{const c=map.getCenter(),b=map.getBounds(),sw=b.getSW(),ne=b.getNE();return {point:{lat:c.lat(),lng:c.lng()},bounds:{west:sw.lng(),south:sw.lat(),east:ne.lng(),north:ne.lat()}};};
 n.Event.addListener(map,'idle',()=>{clearTimeout(timer);timer=setTimeout(()=>onViewport(viewport()),800);});
 n.Event.addListener(map,'click',e=>map.panTo(e.coord));
 const refresh=()=>n.Event.trigger(map,'resize');
 const fit=()=>{refresh();if(origin){map.setCenter(new n.LatLng(origin.lat,origin.lng));map.setZoom(12);return;}const p=all.filter(p=>hasPoint(p.point));if(p.length)map.fitBounds(p.map(p=>new n.LatLng(p.point.lat,p.point.lng)),{top:80,right:40,bottom:65,left:40,maxZoom:15});};
 return {fit,refresh,viewport,update(stops,filter,next=all,nextOrigin=null){all=next;origin=nextOrigin;objects.forEach(o=>o.setMap(null));objects=[];
 for(const leg of courseSegments(stops))if(leg.distanceKm!==null)objects.push(new n.Polyline({map,path:[leg.from,leg.to].map(p=>new n.LatLng(p.point.lat,p.point.lng)),strokeColor:'#345c49',strokeWeight:3,strokeStyle:'shortdash'}));
 for(const p of all.filter(p=>hasPoint(p.point))){const i=stops.findIndex(s=>s.id===p.id),c=categories[p.category];const marker=new n.Marker({map,position:new n.LatLng(p.point.lat,p.point.lng),title:p.name,zIndex:i>=0?500+i:1,icon:{content:`<button class="geo-pin" aria-label="${escape(p.name)} 상세"><span style="--c:${c.color}" class="${i>=0?'chosen':''}">${i>=0?i+1:c.icon}</span></button>`,anchor:new n.Point(17,17)}});n.Event.addListener(marker,'click',()=>onSelect(p.id));objects.push(marker);}
 if(origin)objects.push(new n.Marker({map,position:new n.LatLng(origin.lat,origin.lng),zIndex:1000,icon:{content:'<span class="origin-pin">● 검색 기준</span>',anchor:new n.Point(12,12)}}));
 }};
}
