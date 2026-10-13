export const categories={restaurant:{name:'음식점',color:'#cf8651',height:4.5,icon:'🍴'},culture:{name:'문화시설',color:'#ad6aa3',height:5.5,icon:'▣'},attraction:{name:'관광명소',color:'#428c9a',height:6.5,icon:'◇'},lodging:{name:'숙박',color:'#776ca6',height:7.5,icon:'⌂'},event:{name:'행사',color:'#e76547',height:.5,icon:'✦'},park:{name:'산책',color:'#5c9178',height:1.5,icon:'♧'},heritage:{name:'역사',color:'#8187bc',height:2.5,icon:'▥'},cafe:{name:'카페',color:'#b88b57',height:3.5,icon:'☕'}};
export function addStop(stops,item){return stops.length>=6||stops.some(s=>s.id===item.id)?stops:[...stops,item];}
export function removeStop(stops,id){return stops.filter(s=>s.id!==id);}
export function moveStop(stops,index,delta){const to=index+delta;if(index<0||index>=stops.length||to<0||to>=stops.length)return stops;const next=[...stops];[next[index],next[to]]=[next[to],next[index]];return next;}
export function hasPoint(p){return !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=85&&Math.abs(p.lng)<=180;}
export function projectPoint(point,origin){if(!hasPoint(point)||!hasPoint(origin))return null;const r=Math.PI/180;return {x:(point.lng-origin.lng)*111.32*Math.cos(origin.lat*r),y:(point.lat-origin.lat)*111.32};}
export function distance(a,b){if(!hasPoint(a)||!hasPoint(b))return null;const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));}
export function courseSegments(stops){return stops.slice(1).map((to,i)=>({from:stops[i],to,distanceKm:distance(stops[i].point,to.point),minutes:null}));}
export function inEventPeriod(event,date){return !!date&&date>=event.startDate&&date<=event.endDate;}
