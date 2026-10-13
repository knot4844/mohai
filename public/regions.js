// Administrative identity is independent of the map provider and UI language.
export function eventRegion(event){
 if(event.region)return event.region;
 if(event.area_id==='kr-41-goyang')return {province:'gyeonggi',city:'goyang',labels:{ko:'고양시',en:'Goyang',ja:'高陽市','zh-Hans':'高阳市'}};
 return {province:'unknown',city:'unknown',labels:{ko:'지역 확인 필요',en:'Region unverified',ja:'地域未確認','zh-Hans':'地区待确认'}};
}
export function matchesRegion(event,region='all',city='all'){
 const r=eventRegion(event);
 return (region==='all'||(region==='goyang'?r.city==='goyang':r.province===region))&&(city==='all'||r.city===city);
}
export function regionCities(events,region='all'){
 const cities=new Map();for(const e of events)if(matchesRegion(e,region)){
  const r=eventRegion(e);cities.set(r.city,{id:r.city,labels:r.labels});
 }
 return [...cities.values()].sort((a,b)=>a.labels.ko.localeCompare(b.labels.ko,'ko'));
}
