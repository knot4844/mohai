// Server/build only. Never serialize request URLs or upstream error messages (they may contain keys).
const BASE='https://apis.data.go.kr/B551011/KorService2/';
export class TourAPIError extends Error {constructor(code){super(code);this.code=code;}}
export function serviceKey(value){if(!value?.trim())throw new TourAPIError('not_configured');try{return decodeURIComponent(value.trim());}catch{throw new TourAPIError('invalid_key_encoding');}}
export async function tourRequest(operation,params,{key,fetcher=fetch}={}){
 if(!['searchFestival2','detailIntro2','detailCommon2','ldongCode2'].includes(operation))throw new TourAPIError('invalid_operation');
 const url=new URL(operation,BASE);for(const [k,v] of Object.entries({...params,serviceKey:serviceKey(key),MobileOS:'WEB',MobileApp:'MOHAI',_type:'json'}))url.searchParams.set(k,String(v));
 try{
  const r=await fetcher(url,{signal:AbortSignal.timeout(18000),redirect:'error'});if(!r.ok)throw new TourAPIError('upstream_http_'+r.status);
  const text=await r.text();let json;try{json=JSON.parse(text);}catch{throw new TourAPIError('upstream_non_json');}
  const response=json.response;if(!response?.header)throw new TourAPIError('invalid_response');
  const code=String(response.header.resultCode);if(!['0000','00','0'].includes(code))throw new TourAPIError('provider_code_'+code.replace(/[^0-9A-Za-z_]/g,'').slice(0,12));
  const body=response.body||{},item=body.items?.item;return {items:Array.isArray(item)?item:item?[item]:[],totalCount:Number(body.totalCount||0)};
 }catch(e){if(e instanceof TourAPIError)throw e;throw new TourAPIError('provider_unavailable');}
}
export function dateISO(v){if(!/^\d{8}$/.test(String(v)))return null;const s=String(v),iso=`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;try{return new Date(iso+'T00:00:00Z').toISOString().slice(0,10)===iso?iso:null;}catch{return null;}}
export function overlaps(item,start,end){const a=dateISO(item.eventstartdate),b=dateISO(item.eventenddate);return !!a&&!!b&&a<=b&&a<=end&&b>=start;}
const fields=['contentid','contenttypeid','title','addr1','addr2','areacode','sigungucode','lDongRegnCd','lDongSignguCd','eventstartdate','eventenddate','mapx','mapy','modifiedtime','progresstype','festivaltype','cpyrhtDivCd','cat1','cat2','cat3','lclsSystm1','lclsSystm2','lclsSystm3'];
export async function collectFestivals({key,start,end,fetcher=fetch,maxPages=12}){
 // Look back before this year to include long-running events. Coverage is explicitly bounded.
 const lookback=`${Number(start.slice(0,4))-2}0101`,items=new Map(),coverage=[];
 for(const region of ['11','41']){
  let total=0,received=0,pages=0;
  for(let page=1;page<=maxPages;page++){
   const result=await tourRequest('searchFestival2',{eventStartDate:lookback,eventEndDate:end.replaceAll('-',''),lDongRegnCd:region,numOfRows:100,pageNo:page,arrange:'A'},{key,fetcher});
   total=result.totalCount;pages=page;received+=result.items.length;
   for(const item of result.items)if(overlaps(item,start,end)&&item.contentid){const clean=Object.fromEntries(fields.filter(f=>item[f]!=null).map(f=>[f,String(item[f])]));clean.requestedRegion=region;items.set(clean.contentid,clean);}
   if(received>=total)break;
   if(!result.items.length)throw new TourAPIError('incomplete_pagination');
  }
  if(received<total)throw new TourAPIError('page_limit_exceeded');coverage.push({region,total,received,pages});
 }
 return {provider:'한국관광공사 TourAPI',source:'https://www.data.go.kr/data/15101578/openapi.do',fetchedAt:new Date().toISOString(),window:{start,end},queryStart:lookback,coverage,completeCensus:false,items:[...items.values()]};
}
export async function enrichFestivals(snapshot,{key,fetcher=fetch}={}){
 const fields=['eventplace','eventhomepage','playtime','usetimefestival','agelimit','spendtimefestival','bookingplace','eventstartdate','eventenddate'];let cursor=0;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<snapshot.items.length){const item=snapshot.items[cursor++];try{const r=await tourRequest('detailIntro2',{contentId:item.contentid,contentTypeId:15},{key,fetcher});const intro=r.items[0];if(!intro)throw new TourAPIError('empty_detail');item.intro=Object.fromEntries(fields.filter(k=>intro[k]!=null).map(k=>[k,String(intro[k])]));}catch(e){item.detailError=e.code||'provider_unavailable';}}}));return snapshot;
}
