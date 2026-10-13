import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';
import {isCalendarDate} from '../lib/calendar.mjs';
import {handleAPI} from '../lib/api.mjs';
test('calendar validation rejects impossible dates that match the YYYY-MM-DD shape',()=>{
 for(const ok of ['2026-10-12','2024-02-29','2026-12-31','2026-01-01'])assert.equal(isCalendarDate(ok),true,ok);
 for(const bad of ['2026-02-30','2026-02-29','2026-13-01','2026-00-10','2026-04-31','2026-10-00','2026-1-5','20261012','',null,undefined,20261012,'2026-10-12T00:00'])assert.equal(isCalendarDate(bad),false,String(bad));
});
test('weather rejects non-calendar dates before touching the provider or the key check',async()=>{
 const point={lat:37.65,lng:126.77};
 for(const date of ['2026-02-30','2026-13-01','2026-04-31'])assert.deepEqual(await handleAPI('/api/weather','POST',{point,date},{OPEN_METEO_PREVIEW:'true'}),[400,{error:'invalid_input'}]);
 assert.deepEqual(await handleAPI('/api/weather','POST',{point,date:'2026-10-12'},{}),[503,{error:'weather_not_configured'}]);
});
test('local server answers malformed and oversized API bodies with JSON and no-store',async()=>{
 const port=4300+Math.floor(Math.random()*500);
 const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('MOHAI'))resolve();});child.once('exit',c=>reject(new Error('server exited '+c)));setTimeout(()=>reject(new Error('server start timeout')),8000);});
  const post=(path,body)=>fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body});
  const bad=await post('/api/weather','{not json');
  assert.equal(bad.status,400);assert.match(bad.headers.get('content-type'),/application\/json/);assert.equal(bad.headers.get('cache-control'),'no-store');assert.deepEqual(await bad.json(),{error:'invalid_json'});
  const big=await post('/api/weather','{"pad":"'+'x'.repeat(9000)+'"}');
  assert.equal(big.status,413);assert.match(big.headers.get('content-type'),/application\/json/);assert.equal(big.headers.get('cache-control'),'no-store');assert.deepEqual(await big.json(),{error:'payload_too_large'});
  const missing=await fetch(`http://127.0.0.1:${port}/api/nope`);
  assert.equal(missing.status,404);assert.deepEqual(await missing.json(),{error:'not_found'});
 }finally{child.kill();await once(child,'exit').catch(()=>{});}
});
