import {isCalendarDate} from './calendar.mjs';

export const naverHubConfigured=env=>Boolean(env.NAVER_SEARCH_CLIENT_ID&&env.NAVER_SEARCH_CLIENT_SECRET);
const validText=s=>typeof s==='string'&&s.trim().length>0&&s.length<=100;

// Provider results stay separate from verified ledger facts. Never cache or persist.
export async function queryNaverHub(kind,body,env=process.env,fetcher=fetch){
 const headers={'X-NCP-APIGW-API-KEY-ID':env.NAVER_SEARCH_CLIENT_ID,'X-NCP-APIGW-API-KEY':env.NAVER_SEARCH_CLIENT_SECRET};
 let url,options={headers};
 if(kind==='local'||kind==='blog'){
  if(!validText(body?.query))return [400,{error:'invalid_input'}];
  url=new URL(`https://naverapihub.apigw.ntruss.com/search/v1/${kind}`);
  for(const [key,value] of Object.entries({query:body.query.trim(),display:5,start:1,sort:kind==='local'?'random':'sim',format:'json'}))url.searchParams.set(key,value);
 }else if(kind==='trend'){
  const {startDate,endDate,keyword}=body||{};
  if(!isCalendarDate(startDate)||!isCalendarDate(endDate)||startDate>endDate||startDate<'2016-01-01'||!validText(keyword))return [400,{error:'invalid_input'}];
  url=new URL('https://naverapihub.apigw.ntruss.com/search-trend/v1/search');
  options={method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({startDate,endDate,timeUnit:'date',keywordGroups:[{groupName:keyword.trim(),keywords:[keyword.trim()]}]})};
 }else return [400,{error:'invalid_input'}];
 if(!naverHubConfigured(env))return [503,{error:'naver_hub_not_configured'}];
 try{
  const response=await fetcher(url,{...options,signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)return [502,{error:'naver_hub_unavailable',upstreamStatus:response.status}];
  const result=await response.json();
  if(!Array.isArray(kind==='trend'?result.results:result.items))return [502,{error:'invalid_provider_response'}];
  return [200,{source:'NAVER API HUB',kind,fetchedAt:new Date().toISOString(),result}];
 }catch{return [502,{error:'naver_hub_unavailable'}];}
}
