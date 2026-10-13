import test from 'node:test';
import assert from 'node:assert/strict';
import {queryNaverHub} from '../lib/naver-hub.mjs';
import {handleAPI,publicConfig} from '../lib/api.mjs';
const env={NAVER_SEARCH_CLIENT_ID:'test-id',NAVER_SEARCH_CLIENT_SECRET:'test-secret'};
test('Hub validates before fetching, including impossible dates',async()=>{
 for(const [kind,body] of [['local',{query:''}],['blog',{query:7}],['trend',{keyword:'카페',startDate:'2026-02-30',endDate:'2026-03-01'}],['other',{}]])assert.equal((await queryNaverHub(kind,body,env,()=>assert.fail('must not fetch')))[0],400);
});
test('Hub requires both credentials and public config never exposes them',async()=>{
 assert.equal((await queryNaverHub('local',{query:'카페'},{}))[0],503);
 assert.equal(JSON.stringify(publicConfig(env)).includes('test-'),false);
});
for(const kind of ['local','blog'])test(`${kind} uses Hub endpoint, headers and preserves provider order/fields`,async()=>{
 const items=[{title:'<b>가게</b>',mapx:'1260000000',telephone:''},{title:'두번째'}];
 const [status,data]=await queryNaverHub(kind,{query:' 일산 카페 '},env,async(url,options)=>{
  assert.equal(url.origin,'https://naverapihub.apigw.ntruss.com');assert.equal(url.pathname,`/search/v1/${kind}`);
  assert.equal(url.searchParams.get('display'),'5');assert.equal(url.searchParams.get('query'),'일산 카페');
  assert.equal(options.headers['X-NCP-APIGW-API-KEY'],'test-secret');assert.equal(options.redirect,'error');
  return {ok:true,json:async()=>({items})};
 });assert.equal(status,200);assert.deepEqual(data.result.items,items);
});
test('Trend sends validated group and daily interval without inventing search counts',async()=>{
 const [status,data]=await queryNaverHub('trend',{keyword:'카페',startDate:'2026-10-01',endDate:'2026-10-07'},env,async(url,options)=>{
  assert.equal(url.pathname,'/search-trend/v1/search');assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);assert.equal(body.timeUnit,'date');assert.deepEqual(body.keywordGroups,[{groupName:'카페',keywords:['카페']}]);
  return {ok:true,json:async()=>({results:[{data:[{ratio:100}]}]})};
 });assert.equal(status,200);assert.equal(data.result.results[0].data[0].ratio,100);
});
test('Provider errors do not leak response bodies or credentials',async()=>{
 assert.deepEqual(await queryNaverHub('local',{query:'카페'},env,async()=>({ok:false,status:401})),[502,{error:'naver_hub_unavailable',upstreamStatus:401}]);
 assert.equal((await queryNaverHub('local',{query:'카페'},env,async()=>({ok:true,json:async()=>({})})))[0],502);
});
test('Server routes all three Hub types; GET does not trigger calls',async()=>{
 for(const kind of ['local','blog','trend'])assert.equal((await handleAPI(`/api/naver/${kind}`,'POST',{},{}))[0],400);
 assert.equal((await handleAPI('/api/naver/local','GET',{},{}))[0],404);
});
