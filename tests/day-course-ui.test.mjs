import test from 'node:test';
import assert from 'node:assert/strict';
import {createDayCourse} from '../public/day-course.js';

// Exercise the production component and its real handlers without a network or WebGL.
// This DOM double tracks node identity/focus/scroll; it is not a browser layout test.
class Element {
 constructor(tag,owner){this.tagName=tag;this.ownerDocument=owner;this.children=[];this.attributes={};this.textContent='';this.className='';this.disabled=false;this.scrollTop=0;this.classList={add:name=>{this.className+=' '+name;}};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){if(walk(this).includes(this.ownerDocument.activeElement))this.ownerDocument.activeElement=null;this.children=children;}
 setAttribute(name,value){this.attributes[name]=value;}
 focus(){this.ownerDocument.activeElement=this;}
}
const walk=root=>[root,...root.children.flatMap(walk)];
const content=root=>root.textContent+' '+root.children.map(content).join(' ');
const withClass=(root,cls)=>walk(root).filter(n=>n.className.split(' ').includes(cls));
const point={lat:37.65,lng:126.77};
const fetchedAt='2026-10-12T01:02:03.000Z';
const event=(i,extra={})=>({id:'event:'+i,kind:'event',name:'Event '+i,point:{lat:37.65+i*.001,lng:126.77},url:'https://example.test/event/'+i,...extra});
const place=(i,extra={})=>({id:'kakao:'+i,kind:'place',name:'Fixture café '+i,category:'CE7',point:{lat:37.65+i*.001,lng:126.77},url:'https://example.test/place/'+i,...extra});
const response=(places=[place(1)],extra={})=>({ok:true,json:async()=>({places,fetchedAt,...extra})});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

function uiTest(name,fn){test(name,async()=>{
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
 const document={activeElement:null,createElement(tag){return new Element(tag,this);},createElementNS(ns,tag){return this.createElement(tag);}};
 globalThis.document=document;
 globalThis.fetch=async()=>{throw Error('Unexpected network request in UI test');};
 try{
  const root=document.createElement('section'),changes=[];
  const course=createDayCourse(root,stops=>changes.push(stops));
  let context={lang:'ko',date:'2026-10-12',origin:{point},config:{nearby:true},events:[event(1),event(2)]};
  const update=(patch={})=>{context={...context,...patch};return course.update(context);};
  const button=(label,scope=root)=>walk(scope).find(n=>n.tagName==='button'&&n.textContent===label&&!n.disabled);
  const click=(label,scope=root)=>{const b=button(label,scope);assert.ok(b,'Missing enabled button: '+label);return b.onclick();};
  const candidates=()=>withClass(root,'day-candidates')[0];
  const stops=()=>withClass(root,'day-stops')[0];
  update();await fn({root,document,update,click,button,candidates,stops,changes,course});
 }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;globalThis.fetch=previousFetch;}
});}

uiTest('refresh immediately removes old candidates; failed refresh keeps selected Place as dated draft',async u=>{
 globalThis.fetch=async()=>response([place(1),place(2)]);
 u.click('마시기 · 카페');await u.click('주변 검색');u.click('선택',u.candidates());
 const staleButton=u.button('선택',u.candidates());
 const original=u.update()[0];assert.equal(original.fetchedAt,fetchedAt);
 const request=deferred();globalThis.fetch=()=>request.promise;
 const pending=u.click('주변 검색');
 assert.equal(u.candidates().children.length,0);
 assert.match(content(u.stops()),/다시 조회 중/);
 // Even an old detached handler cannot select a now-invalid response.
 staleButton.onclick();assert.equal(u.update().length,1);
 request.resolve({ok:false});await pending;
 assert.equal(u.candidates().children.length,0);
 assert.match(content(u.root),/검색에 실패/);
 assert.match(content(u.stops()),/재조회가 실패/);
 assert.match(content(u.stops()),/이전 조회/);
 assert.match(content(u.stops()),/KST/);
 assert.equal(u.update()[0],original);
});

uiTest('successful retry shows new lookup time without silently renewing an already selected Place',async u=>{
 globalThis.fetch=async()=>response();u.click('마시기 · 카페');await u.click('주변 검색');u.click('선택',u.candidates());
 globalThis.fetch=async()=>({ok:false});await u.click('주변 검색');
 const newer='2026-10-12T02:03:04.000Z';globalThis.fetch=async()=>response([place(1),place(3)],{fetchedAt:newer});
 await u.click('주변 검색');
 assert.equal(u.candidates().children.length,2);
 assert.doesNotMatch(content(u.root),/재조회가 실패|검색에 실패/);
 assert.equal(u.update()[0].fetchedAt,fetchedAt);
 u.click('선택',u.candidates());assert.equal(u.update()[1].fetchedAt,newer);
 const shown=withClass(u.root,'day-fetched').map(content);
 assert.ok(shown.some(x=>x.includes('11:03:04')));
 assert.ok(shown.some(x=>x.includes('10:02:03')));
});

uiTest('missing lookup timestamp is displayed as unknown; invalid payload is a failure with no candidates',async u=>{
 globalThis.fetch=async()=>response([place(1)],{fetchedAt:'invalid'});
 u.click('마시기 · 카페');await u.click('주변 검색');u.click('선택',u.candidates());
 assert.match(content(u.stops()),/조회 시각 미확인/);
 globalThis.fetch=async()=>({ok:true,json:async()=>({places:[null]})});await u.click('주변 검색');
 assert.equal(u.candidates().children.length,0);assert.match(content(u.root),/검색에 실패/);
});

uiTest('page-memory results retain their timestamp across tabs, but every Search refetches with no-store',async u=>{
 let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'/api/nearby');assert.equal(options.cache,'no-store');return response();};
 u.click('마시기 · 카페');await u.click('주변 검색');
 u.click('행사');u.click('마시기 · 카페');assert.equal(calls,1);assert.equal(u.candidates().children.length,1);
 assert.match(content(u.root),/메모리에만 보관/);assert.match(content(u.root),/자동 갱신하지 않습니다/);
 await u.click('주변 검색');assert.equal(calls,2);
});

uiTest('failure is scoped to the source query even after switching tabs or radius',async u=>{
 globalThis.fetch=async()=>response();u.click('마시기 · 카페');await u.click('주변 검색');u.click('선택',u.candidates());
 const request=deferred();globalThis.fetch=()=>request.promise;const pending=u.click('주변 검색');
 u.click('행사');request.resolve({ok:false});await pending;
 assert.match(content(u.stops()),/재조회가 실패/);
 u.click('마시기 · 카페');assert.equal(u.candidates().children.length,0);assert.match(content(u.root),/검색에 실패/);
 const select=walk(u.root).find(n=>n.tagName==='select');select.value='1000';select.onchange();
 assert.match(content(u.stops()),/재조회가 실패/);
 assert.equal(u.candidates().children.length,0);
});

uiTest('date/origin reset announces discarded course; late response cannot repopulate it',async u=>{
 u.click('선택',u.candidates());assert.equal(u.update().length,1);
 assert.equal(u.update({date:'2026-10-13'}).length,0);assert.match(content(u.root),/초기화했습니다/);
 const request=deferred();globalThis.fetch=()=>request.promise;u.click('마시기 · 카페');const pending=u.click('주변 검색');
 assert.equal(u.update({origin:{point:{lat:37.66,lng:126.77}}}).length,0);
 request.resolve(response());await pending;assert.equal(u.candidates().children.length,0);
 assert.match(content(u.root),/초기화했습니다/);
});

uiTest('removing origin still renders reset explanation; no spurious initial reset notice',async u=>{
 assert.doesNotMatch(content(u.root),/초기화했습니다/);
 u.click('선택',u.candidates());u.update({origin:null});
 assert.match(content(u.root),/초기화했습니다/);assert.match(content(u.root),/출발지를 정하면/);
});

uiTest('expired/removed events are announced and pruned while selected Places survive',async u=>{
 u.click('선택',u.candidates());globalThis.fetch=async()=>response();u.click('마시기 · 카페');await u.click('주변 검색');u.click('선택',u.candidates());
 const stops=u.update({events:[]});assert.equal(stops.length,1);assert.equal(stops[0].kind,'place');
 assert.match(content(u.root),/현재 후보에서 제외된 선택 행사를 코스에서 삭제/);
});

uiTest('locale change refreshes selected Event names and diagram labels without changing IDs/order',async u=>{
 u.click('선택',u.candidates());u.click('선택',u.candidates());
 const events=[event(1,{name:'日本語イベント一'}),event(2,{name:'日本語イベント二'})];
 const stops=u.update({lang:'ja',events});
 assert.deepEqual(stops.map(s=>s.id),['event:1','event:2']);
 assert.match(content(u.stops()),/1. 日本語イベント一/);assert.match(content(u.stops()),/2. 日本語イベント二/);
 assert.match(withClass(u.root,'day-diagram')[0].attributes['aria-label'],/日本語イベント一 → 2. 日本語イベント二/);
 assert.doesNotMatch(content(u.stops()),/Event 1/);
});

uiTest('integration contract: selection callbacks and localized update return the mixed stops array',async u=>{
 u.click('선택',u.candidates());
 assert.deepEqual(u.changes.at(-1).map(s=>s.id),['event:1']);
 globalThis.fetch=async()=>response();u.click('마시기 · 카페');await u.click('주변 검색');u.click('선택',u.candidates());
 assert.deepEqual(u.changes.at(-1).map(s=>s.kind),['event','place']);
 const selectedPlace=u.changes.at(-1)[1],callbackCount=u.changes.length;
 const returned=u.update({lang:'en',events:[event(1,{name:'Updated English event'}),event(2)]});
 assert.equal(returned[0].name,'Updated English event');assert.equal(returned[1],selectedPlace);
 assert.equal(u.changes.length,callbackCount,'update returns state to app; it must not trigger a recursive map callback');
 u.click('Later',u.stops());assert.deepEqual(u.changes.at(-1).map(s=>s.kind),['place','event']);
 u.click('Remove',u.stops());assert.equal(u.changes.at(-1).length,1);
 u.click('Clear course');assert.deepEqual(u.changes.at(-1),[]);
});

uiTest('unchanged minute updates preserve actual node identity, focus and candidate scroll',async u=>{
 u.click('선택',u.candidates());
 const list=u.candidates(),selectedButton=u.button('선택',list);list.scrollTop=78;selectedButton.focus();
 const children=[...u.root.children];
 for(let i=0;i<3;i++)u.update({events:[event(1),event(2)],origin:{point:{lng:126.77,lat:37.65}}});
 assert.deepEqual(u.root.children,children);assert.equal(u.candidates(),list);assert.equal(list.scrollTop,78);assert.equal(u.document.activeElement,selectedButton);
 u.click('마시기 · 카페');const select=walk(u.root).find(n=>n.tagName==='select');select.focus();
 u.update();assert.equal(walk(u.root).find(n=>n.tagName==='select'),select);assert.equal(u.document.activeElement,select);
});

uiTest('unchanged updates during pending search preserve controls and issue no extra request',async u=>{
 const request=deferred();let calls=0;globalThis.fetch=()=>{calls++;return request.promise;};
 u.click('마시기 · 카페');const pending=u.click('주변 검색');
 const select=walk(u.root).find(n=>n.tagName==='select');select.focus();u.update();
 assert.equal(walk(u.root).find(n=>n.tagName==='select'),select);assert.equal(u.document.activeElement,select);assert.equal(calls,1);
 request.resolve(response());await pending;assert.equal(u.candidates().children.length,1);
});

uiTest('candidate cap is explained for events and places; only absolute safe detail links render',async u=>{
 const urls=['#','',undefined,'javascript:alert(1)','data:text/html,test','/relative','https://','https://user:pass@example.test/','https://example.test/valid'];
 u.update({events:Array.from({length:17},(_,i)=>event(i,{url:urls[i%urls.length]})).reverse()});
 assert.equal(u.candidates().children.length,15);assert.match(content(u.root),/최대 15개/);assert.match(content(u.root),/표시되지 않은 후보/);
 const links=walk(u.candidates()).filter(n=>n.tagName==='a');assert.equal(links.length,1);assert.equal(links[0].href,'https://example.test/valid');
 assert.match(content(u.candidates().children[0]),/Event 0/);
 globalThis.fetch=async()=>response([place(1)],{hasMore:true});u.click('마시기 · 카페');await u.click('주변 검색');
 assert.match(content(u.root),/최대 15개/);assert.match(content(u.root),/표시되지 않은 후보/);
});

uiTest('four-stop cap, reordering, removal and clear execute through production UI handlers',async u=>{
 u.update({events:Array.from({length:5},(_,i)=>event(i))});
 for(let i=0;i<4;i++)u.click('선택',u.candidates());
 assert.equal(u.update().length,4);assert.equal(u.button('선택',u.candidates()),undefined);
 u.click('뒤로',u.stops());assert.equal(u.update()[0].id,'event:1');
 u.click('빼기',u.stops());assert.equal(u.update().length,3);
 u.click('코스 비우기');assert.equal(u.update().length,0);assert.match(content(u.root),/코스를 비웠습니다/);
 assert.ok(u.changes.length>=7);
});

uiTest('Japanese and Simplified Chinese render localized search, failures, draft and reset notices',async u=>{
 for(const [lang,tab,search,add,failed,draft,reset] of [
  ['ja','カフェ','周辺を検索','選択','再検索に失敗','以前の検索','初期化しました'],
  ['zh-Hans','咖啡','搜索周边','选择','重新搜索失败','之前查询','已清空']
 ]){
  u.update({lang,date:lang==='ja'?'2026-10-13':'2026-10-14'});
  u.click(tab);globalThis.fetch=async()=>response();await u.click(search);u.click(add,u.candidates());
  globalThis.fetch=async()=>({ok:false});await u.click(search);
  assert.ok(content(u.stops()).includes(failed));assert.ok(content(u.stops()).includes(draft));
  assert.doesNotMatch(content(u.root),/Build your day|Search nearby|Travel time unknown|조회 시각/);
  u.update({origin:null});assert.ok(content(u.root).includes(reset));u.update({origin:{point}});
 }
});

uiTest('GPS food action searches FD6 once and minute renders do not repeat requests',async u=>{
 let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).category,'FD6');return response([place(1,{category:'FD6',address:'경기 고양시 일산서구 테스트로 1'})]);};
 const result=await u.course.searchFood();assert.equal(calls,1);assert.equal(result.places.length,1);assert.match(content(u.candidates()),/테스트로/);u.update();u.update();assert.equal(calls,1);
});
uiTest('GPS food action has no network without origin or configured provider',async u=>{
 u.update({origin:null});assert.equal(await u.course.searchFood(),null);
 u.update({origin:{point},config:{nearby:false}});assert.equal(await u.course.searchFood(),null);
});
