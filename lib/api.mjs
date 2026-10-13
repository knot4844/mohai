import {searchNearby} from './nearby.mjs';
import {queryNaverHub,naverHubConfigured} from './naver-hub.mjs';
import {isCalendarDate} from './calendar.mjs';
const cache=new Map();
const validPoint=p=>p&&typeof p.lat==='number'&&typeof p.lng==='number'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>=33&&p.lat<=39&&p.lng>=124&&p.lng<=132;
export function publicConfig(env=process.env){return {naverSearch:naverHubConfigured(env),nearby:!!env.KAKAO_REST_API_KEY,mapProvider:'naver',mapClientId:env.NAVER_MAP_CLIENT_ID||'axlm0kzsi4',routing:!!(env.NAVER_MAP_CLIENT_ID&&env.NAVER_MAP_CLIENT_SECRET),weather:!!(env.OPEN_METEO_API_KEY||env.OPEN_METEO_PREVIEW==='true'),preview:true};}
async function remoteJSON(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('upstream_'+r.status);return r.json();}
export async function handleAPI(path,method,body,env=process.env){
 try{
  if(path==='/api/config'&&method==='GET')return [200,publicConfig(env)];
  if(path==='/api/nearby'&&method==='POST')return searchNearby(body,env);
  if(['/api/naver/local','/api/naver/blog','/api/naver/trend'].includes(path)&&method==='POST')return queryNaverHub(path.split('/').at(-1),body,env);
  if(path==='/api/health'&&method==='GET')return [200,{ok:true,version:'0.1.0'}];
  if(path==='/api/weather'&&method==='POST'){
   const {point,date}=body||{};if(!validPoint(point)||!isCalendarDate(date))return [400,{error:'invalid_input'}];
   if(!publicConfig(env).weather)return [503,{error:'weather_not_configured'}];
   const lat=point.lat.toFixed(2),lng=point.lng.toFixed(2),key=`weather:${lat}:${lng}:${date}`;const cached=cache.get(key);if(cached&&Date.now()-cached.at<900000)return [200,cached.data];
   const u=new URL(env.OPEN_METEO_API_KEY?'https://customer-api.open-meteo.com/v1/forecast':'https://api.open-meteo.com/v1/forecast');
   Object.entries({latitude:lat,longitude:lng,hourly:'temperature_2m,precipitation_probability,weather_code',timezone:'Asia/Seoul',start_date:date,end_date:date,...(env.OPEN_METEO_API_KEY?{apikey:env.OPEN_METEO_API_KEY}:{})}).forEach(([k,v])=>u.searchParams.set(k,v));
   const j=await remoteJSON(u);const data={hourly:j.hourly,source:'https://open-meteo.com/',fetchedAt:new Date().toISOString(),approximateLocation:true};cache.set(key,{at:Date.now(),data});return [200,data];
  }
  if(path==='/api/route'&&method==='POST'){
   const {start,goal,mode}=body||{};if(!validPoint(start)||!validPoint(goal))return [400,{error:'invalid_input'}];
   if(mode!=='car')return [422,{error:'transport_not_supported'}];
   if(!publicConfig(env).routing)return [503,{error:'routing_not_configured'}];
   const u=new URL('https://maps.apigw.ntruss.com/map-direction/v1/driving');u.searchParams.set('start',`${start.lng},${start.lat}`);u.searchParams.set('goal',`${goal.lng},${goal.lat}`);u.searchParams.set('option','traoptimal');
   const j=await remoteJSON(u,{headers:{'x-ncp-apigw-api-key-id':env.NAVER_MAP_CLIENT_ID,'x-ncp-apigw-api-key':env.NAVER_MAP_CLIENT_SECRET}});const r=j.route?.traoptimal?.[0];if(j.code!==0||!r)return [502,{error:'no_route'}];
   return [200,{durationMinutes:Math.ceil(r.summary.duration/60000),distanceKm:r.summary.distance/1000,path:r.path,source:'NAVER',fetchedAt:new Date().toISOString(),traffic:'current_not_future',toll:r.summary.tollFare??null}];
  }
  return [404,{error:'not_found'}];
 }catch{return [502,{error:'provider_unavailable'}];}
}
