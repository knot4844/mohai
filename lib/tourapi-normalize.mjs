import {createHash} from 'node:crypto';
import {dateISO,overlaps} from './tourapi.mjs';
const source='https://www.data.go.kr/data/15101578/openapi.do';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const plain=x=>String(x||'').replace(/<br\s*\/?\s*>/gi,' · ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const titleKey=x=>plain(x).toLowerCase().replace(/20\d{2}|제\s*\d+\s*회/g,'').replace(/[^가-힣a-z]/g,'');
const reviewedMatches={
 '4082595':'seoul-full-colors-2026','2828431':'seoul-hangang-autumn-2026','3011280':'seoul-design-week-2026','3546110':'seoul-hanok-2026',
 '1725993':'mohae-goyang-e6da1b391beb5c1c','914138':'gg-suwon-hwaseong-2026','2828336':'gg-siheung-wolgot-2026','2846034':'gg-anyang-youth-2026',
 '4117047':'gg-yangpyeong-chives-2026','1147035':'gg-yeoju-grains-2026','2870929':'yeoncheon-chrysanthemum-20261016','3113045':'paju-fair-book-culture-20261009',
 '3019085':'gg-icheon-pets-2026','1841539':'gg-pyeongtaek-mato-2026'
};
export function mergeTourAPI(base,snapshot,regions){
 const data=structuredClone(base);data.events=data.events.filter(e=>e.provider!=='tourapi');data.places=data.places.filter(p=>p.provider!=='tourapi');
 const audit={provider:'TourAPI',fetchedAt:snapshot.fetchedAt,window:snapshot.window,queryStart:snapshot.queryStart,coverage:snapshot.coverage,completeCensus:false,duplicates:[],held:[],added:[],note:'API 수록 정보이며 현장 운영·예약 가능 확인이 아닙니다. 번역 전 원문 명칭을 유지합니다. 배포 시 갱신, 정기 수집은 미설정.'};
 for(const row of snapshot.items){
  const id='tourapi-'+row.contentid,start=dateISO(row.eventstartdate),end=dateISO(row.eventenddate);
  if(!overlaps(row,snapshot.window.start,snapshot.window.end)){audit.held.push({contentId:row.contentid,reason:'outside_or_invalid_dates'});continue;}
  const province=row.lDongRegnCd==='11'?'seoul':row.lDongRegnCd==='41'?'gyeonggi':null;
  if(!province){audit.held.push({contentId:row.contentid,reason:'region_unconfirmed'});continue;}
  const match=data.events.find(e=>e.id===reviewedMatches[row.contentid])||data.events.find(e=>titleKey(e.title_ko)===titleKey(row.title)&&e.region?.province===province&&e.schedule.start_date===start&&e.schedule.end_date===end);
  if(match){const dateConflict=match.schedule.start_date!==start||match.schedule.end_date!==end;audit.duplicates.push({contentId:row.contentid,eventId:match.id,title:row.title,dateConflict,apiDates:[start,end],existingDates:[match.schedule.start_date,match.schedule.end_date]});continue;}
  if(row.contentid==='2987791'){audit.held.push({contentId:row.contentid,title:row.title,reason:'parent_event_overlaps_existing_dmz_exhibition'});continue;}
  const intro=row.intro;if(!intro?.eventplace){audit.held.push({contentId:row.contentid,title:row.title,reason:row.detailError||'venue_detail_missing'});continue;}
  if((intro.eventstartdate&&dateISO(intro.eventstartdate)!==start)||(intro.eventenddate&&dateISO(intro.eventenddate)!==end)){audit.held.push({contentId:row.contentid,title:row.title,reason:'list_detail_date_conflict'});continue;}
  const district=plain(row.addr1).split(' ')[1],regionEntry=regions[district];if(!regionEntry){audit.held.push({contentId:row.contentid,title:row.title,reason:'city_unmapped',district});continue;}
  const region={province,city:regionEntry[0],labels:regionEntry[1]},name=plain(intro.eventplace),title=plain(row.title),address=plain([row.addr1,row.addr2].filter(Boolean).join(' '));
  const lat=Number(row.mapy),lng=Number(row.mapx),located=lat>36.5&&lat<38.5&&lng>126&&lng<128.5;
  const multiSite=/전역|일원|일대|\s및\s|,|외\s*\d|전국/.test(name);
  const point=located?{lat,lng,precision:'provider_reference',verifiedEntrance:false,source}:null;
  const shared=located?data.places.find(p=>plain(p.name)===name&&Math.abs(p.point.lat-lat)<.005&&Math.abs(p.point.lng-lng)<.005):null;
  const place=shared||(point?{id:'tourplace-'+hash([name,address]).slice(0,12),name,address,point,region,provider:'tourapi'}:null);
  const version='sha256:'+hash(row),venueId=place?.id||'tourvenue-'+row.contentid,known=['dates','venue'];
  const hours=plain(intro.playtime),fee=plain(intro.usetimefestival);if(hours)known.push('hours');if(fee)known.push('fee');
  const category=row.lclsSystm2==='EV02'?'performance':row.lclsSystm2==='EV03'?'exhibition':'festival';
  const topic=category==='performance'?'stage':category==='exhibition'?'general-exhibition':'local';
  const summary=`${name}에서 ${start}부터 ${end}까지 안내된 행사입니다. 한국관광공사 API 수록 정보이며 운영일·예약 여부는 별도 확인이 필요합니다.`;
  const translations={};for(const l of ['ko','en','ja','zh-Hans'])translations[l]={display_title:title,summary:l==='ko'?summary:l==='en'?`TourAPI lists this event at ${name}, ${start}–${end}. Original Korean title retained; opening dates and admission need confirmation.`:l==='ja'?`${name}で${start}～${end}に案内されているイベントです。韓国語の原題を表示。開催日・入場条件は要確認。`:`TourAPI收录的活动：${name}，${start}至${end}。保留韩文原名，开放日期与入场条件需确认。`,venue_name:name,status:l==='ko'?'source_original':'original_title_pending_translation',source_version:version,published:false,source_url:source};
  const homepage=plain(String(intro.eventhomepage||'').match(/https?:\/\/[^\s"<>]+/)?.[0]);
  const sources=[{url:source,fields:known,checked_at:snapshot.fetchedAt,method:'tourapi_import'}];if(/^https?:\/\//.test(homepage))sources.push({url:homepage,fields:[],checked_at:snapshot.fetchedAt,method:'tourapi_homepage_reference'});
  const status=/취소/.test(row.progresstype)?'cancelled':/연기/.test(row.progresstype)?'postponed':'scheduled';
  const notes=`TourAPI 콘텐츠 ID ${row.contentid}. 수집 ${snapshot.fetchedAt}. 공연시간·요금은 API 원문이며 회차별 운영·잔여석은 미확인. ${multiSite?'복합·광역 장소의 대표 좌표입니다. ':''}명칭 번역은 대기 중입니다.`;
  const e={id,provider:'tourapi',provider_id:row.contentid,source_version:version,title_ko:title,summary_ko:summary,category,area_id:(province==='seoul'?'kr-11-':'kr-41-')+region.city,region,
   venues:[{id:venueId,name_ko:name,address_ko:address,latitude:point?.lat??null,longitude:point?.lng??null,coordinate_source_url:point?source:null}],
   visit_duration_raw:plain(intro.spendtimefestival)||null,
   schedule:{start_date:start,end_date:end,timezone:'Asia/Seoul',raw_ko:hours||null,sessions:[],exceptions:[],precision:'date_range'},status,
   price:{kind:fee==='무료'?'free':fee.includes('무료')?'mixed':/원|유료/.test(fee)?'paid':'unknown',currency:'KRW',min:fee==='무료'?0:null,max:fee==='무료'?0:null,raw_ko:fee||'요금 미확인'},reservation:intro.bookingplace?{raw_ko:plain(intro.bookingplace),scope:'general_admission'}:null,
   onsite_languages:null,visitor_access:{notes_ko:plain(intro.agelimit)||null},evidence:[{source_id:'tourapi-'+row.contentid,url:source,fields:known,checked_at:snapshot.fetchedAt,note_ko:notes}],last_verified_at:snapshot.fetchedAt,publication_status:'research',translations,
   verification:{source_version:version,checked_at:snapshot.fetchedAt,recheck_after:new Date(Date.parse(snapshot.fetchedAt)+86400000).toISOString(),method:'tourapi_import',cached_source:true,sources,verified_fields:known,unknown_fields:['reservation','conditions','liveAvailability','entrance','languages'],notes_ko:notes,admission:'unknown',conflict:false},
   editorial:{environment:'unknown',point:place?.point||null,media:null,locations:place?[place]:[],multiSite,classification:{version:1,topics:[topic],audiences:[],source_version:version,source_title:title,evidence_urls:[source],basis:'tourapi_provider_category'}},providerHomepage:homepage||null};
  data.events.push(e);if(place&&!data.places.some(p=>p.id===place.id))data.places.push(place);audit.added.push({contentId:row.contentid,eventId:id,title,located:!!point});
 }
 data.tourapi={connected:true,fetchedAt:snapshot.fetchedAt,newEvents:audit.added.length,sourceRows:snapshot.items.length,duplicates:audit.duplicates.length,held:audit.held.length,refresh:'on_deployment',automaticSchedule:false,window:snapshot.window};
 data.locationCoverage={...data.locationCoverage,events:data.events.length,locatedEvents:data.events.filter(e=>e.editorial.point).length,usedPlaces:new Set(data.events.flatMap(e=>e.editorial.locations||[]).map(p=>p.id)).size};
 data.scope.area_ids=[...new Set(data.events.map(e=>e.area_id))].sort();return {data,audit};
}
