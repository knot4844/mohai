import {haversine} from './engine.js';
export function eventTitle(event,lang='ko'){return event?.translations?.[lang]?.display_title||event?.title_ko||'';}
// Ranges are for display only; route planning still uses the original duration.
export function travelTimeRange(minutes,lang='ko'){
 if(!Number.isFinite(minutes)||minutes<0)return null;
 const upper=Math.max(10,Math.ceil(minutes/10)*10),lower=upper-10;
 const units={ko:'분',en:' min',ja:'分','zh-Hans':'分钟'};
 return lower===0?({ko:'10분 이내',en:'Within 10 min',ja:'10分以内','zh-Hans':'10分钟以内'}[lang]||'Within 10 min'):`${lower}–${upper}${units[lang]||units.en}`;
}
export function eventMarker(event,place,{lang='ko',origin=null,minutes=null}={}){
 const km=origin&&place?.point?haversine(origin,place.point):null;
 const distance=km==null?'':`${{ko:'직선거리',en:'Straight-line',ja:'直線距離','zh-Hans':'直线距离'}[lang]||'Straight-line'} ${km.toFixed(1)} km`;
 return {title:eventTitle(event,lang),distance,time:travelTimeRange(minutes,lang)};
}
