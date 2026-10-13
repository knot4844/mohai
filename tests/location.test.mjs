import test from 'node:test';import assert from 'node:assert/strict';
import {locationProfile,requestPosition} from '../public/location-access.js';
test('device help distinguishes iPad desktop UA, iOS Chrome and Android in-app',()=>{
 assert.equal(locationProfile({userAgent:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}).guide,'ios');
 assert.equal(locationProfile({userAgent:'iPhone CriOS Safari'}).guide,'iosOther');
 assert.equal(locationProfile({userAgent:'Android Chrome Safari'}).guide,'android');
 assert.deepEqual(locationProfile({userAgent:'Android Chrome Safari KAKAOTALK'}),{guide:'androidOther',inApp:true});
 assert.equal(locationProfile({userAgent:'Android SamsungBrowser Chrome Safari'}).guide,'androidOther');
});
test('known denied permission never requests GPS',async()=>{let called=false;await assert.rejects(requestPosition({permissions:{query:async()=>({state:'denied'})},geolocation:{getCurrentPosition(){called=true;}}}),e=>e.code===1);assert.equal(called,false);});
test('first request invokes native GPS and permission failure remains distinct',async()=>{let calls=0;await assert.rejects(requestPosition({permissions:{query:async()=>({state:'prompt'})},geolocation:{getCurrentPosition(ok,fail){calls++;fail({code:1});}}}),e=>e.code===1);assert.equal(calls,1);});
test('unsupported permissions query falls back; retry checks permission again',async()=>{const position={coords:{latitude:37.65,longitude:126.76}};const geo={getCurrentPosition(ok){ok(position);}};assert.equal(await requestPosition({permissions:{query:async()=>{throw new Error('unsupported');}},geolocation:geo}),position);assert.equal(await requestPosition({permissions:{query:async()=>({state:'granted'})},geolocation:geo}),position);});
test('timeout is not reported as a permission denial',async()=>{await assert.rejects(requestPosition({geolocation:{getCurrentPosition(ok,fail){fail({code:3});}}}),e=>e.code===3);});
