import {orderedCandidates,addCourseStop,moveCourseStop,courseLegs,safeDetailURL,reconcileEventStops} from './day-course-model.js';
import {geographicPoint} from './spatial-model.js';
const categories={events:['행사','Events','イベント','活动'],FD6:['먹기 · 음식점','Food','食事','餐饮'],CE7:['마시기 · 카페','Cafés','カフェ','咖啡'],CT1:['보기 · 문화시설','Culture','文化施設','文化设施'],AT4:['즐기기 · 관광명소','Sights','観光','景点'],AD5:['자기 · 숙박','Stay','宿泊','住宿']};
const copy={
 ko:{title:'선택해서 만드는 오늘의 코스',start:'출발지를 정하면 주변 후보를 비교할 수 있어요.',search:'주변 검색',radius:'검색 반경',privacy:'검색하면 선택한 출발지 좌표를 카카오에 전달합니다.',memory:'검색 결과와 코스는 이 페이지의 메모리에만 보관합니다. 탭·반경을 되돌리면 이전 결과를 표시하며 자동 갱신하지 않습니다. 재검색 시 해당 후보를 지우고, 출발지·날짜 변경 또는 새로고침 시 모두 초기화합니다.',missing:'카카오 주변 검색 연결 준비 중입니다. 현재는 우리 원장의 행사를 선택할 수 있어요.',loading:'주변 장소를 조회하고 있어요. 이전 후보는 지웠습니다.',error:'주변 검색에 실패해 해당 후보를 비웠습니다. 선택한 장소는 이전 조회의 초안으로 남아 있습니다. 다시 검색해 주세요.',empty:'이 범위에서 확인된 후보가 없습니다.',hint:'거리순 비교 · 영업·예약 가능 여부는 확인이 필요합니다.',add:'선택',remove:'빼기',up:'앞으로',down:'뒤로',clear:'코스 비우기',unknown:'이동시간 미확인',straight:'직선거리',draft:'방문 순서 초안 · 선은 도로 경로가 아닙니다. 이동·체류시간 확인 전에는 하루 안에 가능한 일정으로 확정하지 않습니다.',count:'선택',limit:'가까운 후보를 최대 15개까지 표시합니다.',more:'표시되지 않은 후보가 더 있습니다.',source:'상세 확인',event:'우리 원장 · 행사',place:'카카오 · 장소',reset:'출발지나 날짜가 바뀌어 주변 검색과 코스를 초기화했습니다.',removed:'종료되었거나 현재 후보에서 제외된 선택 행사를 코스에서 삭제했습니다.',cleared:'코스를 비웠습니다.',fetched:'조회 시각',unknownTime:'조회 시각 미확인',snapshot:'이전 조회에서 선택한 장소 초안 · 현재 영업·예약 가능 여부 미확인',refreshing:'이 장소를 선택했던 검색 조건을 다시 조회 중입니다. 기존 선택은 이전 조회의 초안입니다.',failed:'이 장소를 선택했던 검색 조건의 재조회가 실패했습니다. 기존 선택은 이전 조회의 초안입니다.'},
 en:{title:'Build your day',start:'Choose an origin to compare nearby options.',search:'Search nearby',radius:'Search radius',privacy:'Search sends the selected origin coordinates to Kakao.',memory:'Results and this course stay only in this page’s memory. Returning to a tab or radius shows previous results without automatic refresh. Searching again clears those candidates; changing origin or date, or reloading, clears everything.',missing:'Kakao nearby search is not connected yet. You can select events from our records.',loading:'Searching nearby… Previous candidates have been cleared.',error:'Search failed and those candidates were cleared. Selected places remain drafts from an earlier lookup. Please search again.',empty:'No candidates found in this range.',hint:'Nearest first · Check opening hours and reservations.',add:'Select',remove:'Remove',up:'Earlier',down:'Later',clear:'Clear course',unknown:'Travel time unknown',straight:'Straight-line',draft:'Visit-order draft. Lines are not roads. Feasibility requires verified travel and stay times.',count:'Selected',limit:'Showing at most 15 nearest candidates.',more:'Additional candidates are not shown.',source:'Details',event:'Our records · Event',place:'Kakao · Place',reset:'Origin or date changed. Search and course cleared.',removed:'Selected events that ended or are no longer candidates were removed from the course.',cleared:'Course cleared.',fetched:'Retrieved at',unknownTime:'Retrieval time unknown',snapshot:'Place draft from an earlier lookup · Current opening and reservation availability unknown',refreshing:'Refreshing the search used to select this place. The selection remains a draft from the earlier lookup.',failed:'The search used to select this place failed to refresh. The selection remains a draft from the earlier lookup.'},
 ja:{title:'選んでつくる今日のコース',start:'出発地を選ぶと周辺の候補を比較できます。',search:'周辺を検索',radius:'検索半径',privacy:'検索すると、選択した出発地の座標をカカオに送信します。',memory:'検索結果とコースはこのページのメモリにのみ保持します。タブや半径を戻すと以前の結果を表示し、自動更新はしません。再検索時にその候補を消去し、出発地・日付の変更やページの再読み込みですべて初期化します。',missing:'カカオの周辺検索は準備中です。現在は登録済みのイベントを選択できます。',loading:'周辺を検索中です。以前の候補は消去しました。',error:'検索に失敗したため、その候補を消去しました。選択済みの場所は以前の検索に基づく下書きとして残ります。再検索してください。',empty:'この範囲に確認できた候補はありません。',hint:'近い順に比較 · 営業時間や予約状況は確認が必要です。',add:'選択',remove:'削除',up:'前へ',down:'後ろへ',clear:'コースを空にする',unknown:'移動時間は未確認',straight:'直線距離',draft:'訪問順序の下書きです。線は道路経路ではありません。移動・滞在時間を確認するまでは、一日で実行できる予定として確定しません。',count:'選択済み',limit:'近い候補を最大15件表示します。',more:'表示されていない候補がほかにもあります。',source:'詳細を確認',event:'登録情報 · イベント',place:'カカオ · 場所',reset:'出発地または日付が変わったため、検索結果とコースを初期化しました。',removed:'終了した、または現在の候補から外れた選択済みイベントをコースから削除しました。',cleared:'コースを空にしました。',fetched:'取得日時',unknownTime:'取得日時は不明',snapshot:'以前の検索で選んだ場所の下書き · 現在の営業・予約状況は未確認',refreshing:'この場所を選んだ検索条件で再検索中です。選択内容は以前の検索に基づく下書きです。',failed:'この場所を選んだ検索条件での再検索に失敗しました。選択内容は以前の検索に基づく下書きです。'},
 'zh-Hans':{title:'自选今日行程',start:'选择出发地后即可比较周边候选地点。',search:'搜索周边',radius:'搜索半径',privacy:'搜索时会将所选出发地的坐标发送给 Kakao。',memory:'搜索结果和行程仅保存在此页面的内存中。切回标签或半径时显示之前的结果，不会自动更新。重新搜索会清除相应候选；更改出发地、日期或刷新页面会清空所有内容。',missing:'Kakao 周边搜索尚未接通。目前可以选择已登记的活动。',loading:'正在搜索周边，已清除之前的候选。',error:'搜索失败，已清除相应候选。已选地点仍作为上次查询的草稿保留，请重新搜索。',empty:'此范围内没有找到候选。',hint:'按距离比较 · 营业和预约情况需要确认。',add:'选择',remove:'移除',up:'前移',down:'后移',clear:'清空行程',unknown:'行程时间未确认',straight:'直线距离',draft:'访问顺序草稿，连线不是道路路线。在确认交通和停留时间前，不能确定能否在一天内完成。',count:'已选',limit:'最多显示距离最近的15个候选。',more:'还有未显示的候选。',source:'查看详情',event:'登记资料 · 活动',place:'Kakao · 地点',reset:'出发地或日期已更改，搜索结果和行程已清空。',removed:'已从行程中移除已结束或不再属于当前候选的已选活动。',cleared:'行程已清空。',fetched:'查询时间',unknownTime:'查询时间未知',snapshot:'之前查询时选择的地点草稿 · 当前营业和预约情况未确认',refreshing:'正在按选择此地点时的条件重新搜索，原有选择仍是之前查询的草稿。',failed:'按选择此地点时的条件重新搜索失败，原有选择仍是之前查询的草稿。'}
};
export function createDayCourse(root,onChange=()=>{}){
 let context=null,key='',generation=0,busyKey=null,results=new Map(),failures=new Set(),stops=[],category='events',radius=3000,notices=new Set(),lastDraw='';
 const l=()=>copy[context.lang]||copy.en,idx=()=>({ko:0,en:1,ja:2,'zh-Hans':3}[context.lang]??1);
 const queryKey=()=>category+':'+radius;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function button(text,fn,disabled=false){const b=el('button',text);b.type='button';b.disabled=disabled;b.onclick=fn;return b;}
 function status(text,cls='day-notice'){const n=el('p',text,cls);n.setAttribute('role','status');return n;}
 function timestamp(value){const parsed=Date.parse(value);if(!Number.isFinite(parsed))return l().unknownTime;return `${l().fetched}: ${new Intl.DateTimeFormat(context.lang,{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Seoul'}).format(parsed)} (KST)`;}
 function draw(){
  if(!context)return;
  // A minute tick with identical data must not replace focused controls or scroll containers.
  const signature=JSON.stringify([context.lang,context.date,context.origin?.point?.lat,context.origin?.point?.lng,!!context.config.nearby,context.events,category,radius,busyKey,[...results],[...failures],stops,[...notices]]);
  if(signature===lastDraw)return;
  lastDraw=signature;
  const t=l();root.replaceChildren();root.append(el('h3',t.title));
  for(const notice of notices)root.append(status(t[notice]));
  const origin=context.origin?.point;
  if(!origin){root.append(el('p',t.start));return;}
  const tabs=el('div',null,'day-tabs');
  for(const [id,names]of Object.entries(categories)){
   const b=button(names[idx()],()=>{category=id;draw();if(context.origin?.bounds&&id!=='events'&&context.config.nearby)search();});b.setAttribute('aria-pressed',String(category===id));tabs.append(b);
  }
  root.append(tabs,el('small',t.memory,'day-memory'));
  if(category!=='events'){
   const settings=el('div',null,'day-settings'),label=el('label',t.radius+' '),select=el('select');select.setAttribute('aria-label',t.radius);
   for(const r of [1000,3000,5000]){const o=el('option',r/1000+' km');o.value=r;o.selected=radius===r;select.append(o);}
   select.onchange=()=>{radius=Number(select.value);draw();};label.append(select);
   if(context.origin?.bounds)label.textContent=({ko:'지도에 보이는 화면 범위',en:'Visible map area',ja:'地図の表示範囲','zh-Hans':'地图可见范围'})[context.lang]||'Visible map area';
   settings.append(label,button(t.search,search,busyKey!==null||!context.config.nearby));root.append(settings,el('small',t.privacy));
   if(!context.config.nearby)root.append(el('p',t.missing));
  }
  if(busyKey===queryKey())root.append(status(t.loading));
  if(failures.has(queryKey()))root.append(status(t.error));
  const response=results.get(queryKey()),items=category==='events'?context.events:response?.places||[];
  const ranked=orderedCandidates(items,origin);root.append(el('p',t.hint,'day-hint'));
  if(response)root.append(el('small',timestamp(response.fetchedAt),'day-fetched'));
  root.append(el('small',t.limit,'day-limit'));
  const list=el('div',null,'day-candidates');
  for(const item of ranked.slice(0,15)){
   const row=el('article');row.append(el('strong',item.name),el('small',`${item.kind==='event'?t.event:t.place} · ${t.straight} ${item.distanceKm.toFixed(1)} km`));
   if(item.categoryName)row.append(el('small',item.categoryName));
   if(item.address)row.append(el('small',item.address));
   const url=safeDetailURL(item.url);
   if(url){const a=el('a',t.source);a.href=url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);}
   row.append(button(stops.some(s=>s.id===item.id)?'✓':t.add,()=>{
    // Bind selection to the exact response, not mutable tab/radius state.
    if(item.kind==='place'&&results.get(item.sourceQuery)!==response)return;
    const stop=item.kind==='event'?context.events.find(e=>e.id===item.id):item;
    if(!stop)return;
    stops=addCourseStop(stops,stop);notices.delete('cleared');draw();onChange(stops);
   },stops.length>=4||stops.some(s=>s.id===item.id)));
   list.append(row);
  }
  root.append(list);
  if(!ranked.length&&(category==='events'||response))root.append(el('p',t.empty));
  if(ranked.length>15||response?.hasMore)root.append(el('small',t.more));
  root.append(el('h4',`${t.count} ${stops.length} / 4`));
  const itinerary=el('ol',null,'day-stops'),legs=courseLegs(stops,origin);
  stops.forEach((s,i)=>{
   const row=el('li');row.append(el('strong',`${i+1}. ${s.name}`),el('small',`${t.straight} ${legs[i].distanceKm.toFixed(1)} km · ${t.unknown}`));
   if(s.kind==='place'){
    row.append(el('small',timestamp(s.fetchedAt),'day-fetched'),el('small',t.snapshot,'day-snapshot'));
    if(busyKey===s.sourceQuery)row.append(status(t.refreshing));
    if(failures.has(s.sourceQuery))row.append(status(t.failed));
   }
   row.append(button(t.up,()=>{stops=moveCourseStop(stops,i,-1);draw();onChange(stops);},i===0),button(t.down,()=>{stops=moveCourseStop(stops,i,1);draw();onChange(stops);},i===stops.length-1),button(t.remove,()=>{stops=stops.filter(x=>x.id!==s.id);draw();onChange(stops);}));
   itinerary.append(row);
  });
  root.append(itinerary);
  if(stops.length)root.append(diagram(origin),button(t.clear,()=>{stops=[];notices.add('cleared');draw();onChange(stops);}));
  root.append(el('small',t.draft));
 }
 function diagram(origin){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 360 210');svg.setAttribute('role','img');svg.setAttribute('aria-label',stops.map((s,i)=>`${i+1}. ${s.name}`).join(' → '));svg.classList.add('day-diagram');const positions=[{x:0,y:0},...stops.map(s=>geographicPoint(s.point,origin))];const extent=Math.max(.2,...positions.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));const xy=positions.map(p=>[180+p.x/extent*75,110-p.y/extent*75]);const line=document.createElementNS(ns,'polyline');line.setAttribute('points',xy.map(p=>p.join(',')).join(' '));svg.append(line);xy.forEach(([x,y],i)=>{const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',11);svg.append(circle);const text=document.createElementNS(ns,'text');text.setAttribute('x',x);text.setAttribute('y',y+4);text.textContent=String(i);svg.append(text);});const compass=document.createElementNS(ns,'text');compass.setAttribute('x','320');compass.setAttribute('y','20');compass.textContent='N ↑';svg.append(compass);return svg;}
 async function search(){
  const token=++generation,c=category,r=radius,q=c+':'+r,p={...context.origin.point};
  // Never leave an earlier response available for selection during/after a failed refresh.
  results.delete(q);failures.delete(q);busyKey=q;draw();
  try{
   const resp=await fetch('/api/nearby',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({point:p,category:c,radius:r,...(context.origin.bounds?{bounds:context.origin.bounds}:{})})});
   if(!resp.ok)throw Error('nearby_failed');
   const body=await resp.json();
   if(token!==generation)return;
   if(!body||!Array.isArray(body.places)||body.places.some(s=>!s||s.kind!=='place'||typeof s.id!=='string'||typeof s.name!=='string'||!Number.isFinite(s.point?.lat)||!Number.isFinite(s.point?.lng)))throw Error('invalid_nearby_response');
   const fetchedAt=typeof body.fetchedAt==='string'&&Number.isFinite(Date.parse(body.fetchedAt))?body.fetchedAt:null;
   results.set(q,{places:body.places.map(s=>({...s,fetchedAt,sourceQuery:q})),fetchedAt,hasMore:body.hasMore===true});
  }catch{
   if(token===generation){results.delete(q);failures.add(q);}
  }finally{
   if(token===generation){busyKey=null;draw();}
  }
 }
 return {async searchViewport(){if(!context?.origin?.point||!context.config.nearby)return null;if(category==='events')category='FD6';const q=queryKey();await search();return results.get(q)||null;},async searchFood(){
  if(!context?.origin?.point||!context.config.nearby)return null;
  category='FD6';await search();return results.get(queryKey())||null;
 },update(next){
  const nextKey=JSON.stringify([next.origin?.point?.lat??null,next.origin?.point?.lng??null,next.origin?.bounds??null,next.date]);
  if(nextKey!==key){
   const wasActive=context&&(stops.length||results.size||busyKey!==null||failures.size);
   generation++;busyKey=null;results.clear();failures.clear();stops=[];notices.clear();
   if(wasActive)notices.add('reset');
   key=nextKey;
  }
  context=next;
  const reconciled=reconcileEventStops(stops,next.events);
  if(reconciled.length<stops.length)notices.add('removed');
  stops=reconciled;draw();return stops;
 }};
}
