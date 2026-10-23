import {spaceCandidates} from './space.js';
import {normalizeEvents,findEvents,scheduleState,validDate,locate} from './discovery.js';
import {createCourseMap,loadNaver} from './map2d.js';
import {categories,addStop,removeStop,moveStop,projectPoint,distance,courseSegments,hasPoint} from './model.js';
import {createNaverSearch,nearbyFoodQuery} from '../naver-search.js';
const realPlaces=[];
let external=[],searchVersion=0,searchAbort,screenBounds=null,mapSearch=false,lastViewport='',config={};
const naverSearch=createNaverSearch(document.querySelector('#naver-search'));
const providerCategories={restaurant:'FD6',cafe:'CE7',culture:'CT1',attraction:'AT4',lodging:'AD5'};
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let all=[],events=[],origin=null,area='',nearby=[],cancelLocation=()=>{},mapLoading=false,mapFailed=false;
const params=new URLSearchParams(location.search);
let tileLimit=6,spaceOffset=0;
function spacePage(){return spaceCandidates(nearby,{origin,filter,query,offset:spaceOffset});}
let mode=params.get('view')==='2d'?'2d':'space',stops=[],filter='all',query='',focus=null;
let geoMap;
let THREE,OrbitControls,renderer,scene,camera,controls,group,loop,labels=[],nodes=[],size=6,webgl=true;
const notice=text=>$('#notice').textContent=text,meta=c=>categories[c]||categories.event;
let known=[],center={lat:36.5,lng:127.8},extent=1;
function coords(p){const q=projectPoint(p.point,center);return {x:q.x*4/extent,y:q.y*4/extent};}
function items(){return [...new Map([...nearby,...stops].map(p=>[p.id,p])).values()];}
function discover(){
 nearby=findEvents(events,{origin,area,date:$('#date').value,radius:screenBounds?2000:Number($('#radius').value)});
 if(screenBounds)nearby=nearby.filter(p=>p.point&&p.point.lng>=screenBounds.west&&p.point.lng<=screenBounds.east&&p.point.lat>=screenBounds.south&&p.point.lat<=screenBounds.north);
 nearby.push(...external);all=[...events,...external,...stops];
 const anchors=stops.filter(p=>p.kind==='event'&&hasPoint(p.point));
 nearby.push(...realPlaces.filter(p=>anchors.some(e=>distance(e.point,p.point)<=3)));
 $('#result-count').textContent=nearby.length;
 $('#radius').disabled=!origin||!!screenBounds;
}
function refreshScope(fit=false){discover();render();if(fit)home();}
function statusText(p){if(p.kind!=='event')return `카카오 조회 ${p.checkedAt||'시각 미확인'} · 영업 미확인`;const st=scheduleState(p,$('#date').value);const flags=[{period:'기간 내 · 당일 회차 미확인',unknown:'행사 기간 미확인',conflict:'자료 충돌 · 추가 불가',ended:'종료',upcoming:'선택일 이전에 시작하지 않음',cancelled:'취소',invalid:'날짜 확인 필요'}[st]];if(p.publication)flags.push(p.publication==='research'?'조사 자료':p.publication);if(p.recheckAfter&&Date.parse(p.recheckAfter)<Date.now())flags.push('재확인 기한 경과');return flags.join(' · ');}
function canAdd(p){return p.kind!=='event'||['period','unknown'].includes(scheduleState(p,$('#date').value));}

const distanceText=p=>{const d=origin?distance(origin,p.point):null;return d!==null?`검색 기준점 직선 ${d.toFixed(2)} km`:!p.point?'좌표 미확인 · 지도 제외':'선택 지역 자료 · 내 위치 거리 미확인';};
function toggle(id){const item=[...all,...stops].find(p=>p.id===id);if(!item)return;if(stops.some(p=>p.id===id)){stops=removeStop(stops,id);notice(`${item.name}을 코스에서 뺐습니다.`);}else{if(!canAdd(item)){notice('행사 기간·취소·충돌 또는 날짜 상태를 확인해 주세요.');return;}const next=addStop(stops,item);if(next===stops){notice('최대 6곳까지 담을 수 있습니다. 다른 장소를 하나 빼고 추가해 주세요.');return;}stops=next;notice(`${item.name}을 코스에 추가했습니다.${!item.point?' 좌표 미확인으로 위치도와 구간 거리는 표시하지 않습니다.':''}`);}discover();render();}
function render(){
 $('#filters').innerHTML=['all',...Object.keys(categories)].map(c=>`<button data-filter="${c}" aria-pressed="${filter===c}">${c==='all'?'전체':meta(c).name}</button>`).join('');
 const candidates=mode==='space'?spacePage().places:nearby.filter(p=>(filter==='all'||p.category===filter)&&`${p.name} ${p.address}`.includes(query));
 $('#candidates').innerHTML=candidates.length?candidates.slice(0,tileLimit).map(p=>{const index=stops.findIndex(s=>s.id===p.id),selected=index>=0,disabled=!selected&&(stops.length>=6||!canAdd(p));return `<article class="candidate ${selected?'selected':''}" style="--c:${meta(p.category).color}"><button class="tile-open" data-focus="${esc(p.id)}" aria-label="${esc(p.name)} 상세">${photoTile(p)}${selected?`<span class="tile-number">${index+1}</span>`:''}</button><div class="info"><strong>${esc(p.name)}</strong><small>${esc(meta(p.category).name)} · ${distanceText(p)}</small></div><button class="toggle" data-toggle="${esc(p.id)}" aria-label="${esc(p.name)} ${selected?'코스에서 빼기':'코스에 추가'}" ${disabled?'disabled':''}>${selected?'−':'+'}</button>${photoCredit(p)}</article>`;}).join(''):'<div class="empty">현재 조건의 자료가 없습니다. 위치·날짜·범위를 확인하세요.</div>';
 $('#more-tiles').hidden=mode==='space'||candidates.length<=tileLimit;
 document.body.classList.toggle('space-mode',mode==='space');
 $('#next-space').hidden=mode!=='space';$('#next-space').disabled=spacePage().total<=3;
 $('#count').textContent=`${stops.length} / 6`;
 const date=$('#date').value;$('#day-date').textContent=date?`${Number(date.slice(5,7))}월 ${Number(date.slice(8,10))}일`:'날짜 선택';
 $('#stops').innerHTML=Array.from({length:stops.length>3?6:3},(_,i)=>{const p=stops[i];if(!p)return `<article class="stop empty-slot"><span class="tile-number">${i+1}</span><span>방문지를 담아 주세요</span></article>`;return `<article class="stop" style="--c:${meta(p.category).color}"><button class="tile-open" data-focus="${esc(p.id)}" aria-label="${esc(p.name)} 상세">${photoTile(p)}<span class="tile-number">${i+1}</span></button><div class="stop-body"><div class="stop-title"><strong>${esc(p.name)}</strong><button data-toggle="${esc(p.id)}" aria-label="${esc(p.name)} 코스에서 빼기">×</button></div><small>${distanceText(p)}</small><div class="stop-tools"><button data-move="${i}" data-delta="-1" aria-label="${esc(p.name)} 앞으로" ${i===0?'disabled':''}>←</button><button data-move="${i}" data-delta="1" aria-label="${esc(p.name)} 뒤로" ${i===stops.length-1?'disabled':''}>→</button></div></div>${photoCredit(p)}</article>`;}).join('');
 const legs=courseSegments(stops),missing=stops.filter(p=>!hasPoint(p.point)).length;
 $('#course-summary').textContent=!stops.length?'빈 코스 · 아래 장소 타일에서 시작하세요':`${stops.length}곳 선택 · ${legs.length}개 이동 구간${missing?` · ${missing}곳 좌표 미확인`:''} · 자동 최적화하지 않은 방문 순서`;
 $('#copy').disabled=!stops.length;
 $('#legend').innerHTML=Object.values(categories).map(c=>`<span><i style="background:${c.color}"></i>${c.name}</span>`).join('');
 $('#scene-note').textContent=mode==='3d'?'드래그 회전 · 높이는 분류 · 점선은 방문 순서':'';
 $('#scene-note').hidden=mode!=='3d';
 $('#view2d').setAttribute('aria-pressed',String(mode==='2d'));$('#view3d').setAttribute('aria-pressed',String(mode!=='2d'));
 $('#view-purpose').textContent=mode==='space'?'내 주변, 세 곳씩 천천히':mode==='3d'?'3D · 같은 장소를 분류별 높이로 탐색':'2D · 실제 위치 관계와 코스 순서를 비교';
 $('#view-help').textContent=mode==='space'?'가상 배치 · 직선거리는 실제 좌표 기준 · 가까운 순서로 3곳씩 표시합니다.':`검색 결과와 담은 코스의 좌표를 표시합니다. 2D·3D 전환 시 선택과 순서를 유지합니다. 장소는 카카오 실시간 조회 최대 15건입니다. 지도에서 정하기를 누르면 이동을 멈춘 뒤 화면 범위로 갱신합니다.`;
 drawScene();drawDetail();
}
function drawDetail(){
 const p=all.find(x=>x.id===focus);$('#detail').hidden=!p;if(!p)return;
 const selected=stops.some(s=>s.id===p.id),description=String(p.description||'').replace(/\s+/g,' ').trim();
 const sentence=description.match(/^.*?[.!?。](?:\s|$)/)?.[0]?.trim()||description;
 const summary=sentence.length>90?sentence.slice(0,89)+'…':sentence;
 $('#detail').innerHTML=`<button class="close" aria-label="상세 닫기">×</button><h3>${esc(p.name)}</h3><p class="detail-place">${esc(p.venueName||p.address||'장소 미확인')}</p>${summary?`<p class="detail-summary" title="${esc(description)}">${esc(summary)}</p>`:''}<details class="detail-evidence"><summary>상세 정보·출처</summary><p>${esc(description)}</p><p>${esc(statusText(p))}</p><p>${esc(p.address)}</p>${photoCredit(p)}<p>${esc(p.coordinateNote||'좌표 미확인')}</p><p>자료 확인 ${esc(p.checkedAt)} · 당일 방문 가능 여부 미확인</p><a href="${p.source}" target="_blank" rel="noopener noreferrer">${esc(p.sourceName)} 원문 ↗</a></details><button class="primary" id="detail-add" ${!selected&&(stops.length>=6||!canAdd(p))?'disabled':''}>${selected?'코스에서 빼기 −':'코스에 추가 +'}</button>`;
 $('#detail .close').onclick=()=>{focus=null;drawDetail();};$('#detail-add').onclick=()=>toggle(p.id);
}
function disposeGroup(){if(!group)return;scene.remove(group);group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
function line(points,color,dashed=false,opacity=1){const g=new THREE.BufferGeometry().setFromPoints(points);const m=dashed?new THREE.LineDashedMaterial({color,dashSize:.18,gapSize:.12,transparent:true,opacity}):new THREE.LineBasicMaterial({color,transparent:true,opacity});const o=new THREE.Line(g,m);o.computeLineDistances();group.add(o);return o;}
function drawSpace(){
 const page=spacePage(),root=$('#virtual-space');
 root.innerHTML=`<div class="space-halo" aria-hidden="true"></div><div class="space-origin"><span aria-hidden="true">◎</span><strong>${origin?(mapSearch?'선택한 출발점':'내 위치'):'어디서 시작할까요?'}</strong><small>${origin?'주변에서 보내는 하루':'내 위치를 허용하거나 지도에서 정해 주세요'}</small></div>${page.places.map((p,i)=>`<button class="space-place space-slot-${i}" data-space-id="${esc(p.id)}" style="--c:${meta(p.category).color};--delay:-${i*1.7}s" aria-label="${esc(p.name)} 상세" aria-pressed="${focus===p.id}"><span class="space-orb">${p.photo?`<img src="${esc(p.photo.src)}" alt="장소 기록 사진" decoding="async">`:`<span aria-hidden="true">${meta(p.category).icon}</span>`}</span><strong>${esc(p.name)}</strong><small>${esc(meta(p.category).name)} · 직선 ${distance(origin,p.point).toFixed(2)} km</small></button>`).join('')}${origin&&!page.total?'<p class="space-empty">이 조건에 맞는 후보가 없어요.<br>분류나 반경을 바꿔 보세요.</p>':''}`;
 root.querySelectorAll('[data-space-id]').forEach(b=>b.onclick=()=>{focus=b.dataset.spaceId;drawDetail();root.querySelectorAll('[data-space-id]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));});
 $('.scene-badge').textContent=origin?`${page.total? page.offset+1:0}–${page.offset+page.places.length} / ${page.total}곳 · 가까운 순`:'내 위치에서 시작';
}
function drawScene(){
 $('#virtual-space').hidden=mode!=='space';
 if(mode==='space'){$('#map2d').hidden=true;$('#scene').hidden=true;$('#labels').hidden=true;$('.north').hidden=true;drawSpace();return;}

 known=items().filter(p=>hasPoint(p.point));
 const points=[...known.map(p=>p.point),...(origin?[origin]:[])];
 center=origin||(points.length?{lat:(Math.min(...points.map(p=>p.lat))+Math.max(...points.map(p=>p.lat)))/2,lng:(Math.min(...points.map(p=>p.lng))+Math.max(...points.map(p=>p.lng)))/2}:{lat:36.5,lng:127.8});
 extent=Math.max(.1,...points.flatMap(p=>{const q=projectPoint(p,center);return [Math.abs(q.x),Math.abs(q.y)];}));
 $('#map2d').hidden=mode!=='2d';$('#scene').hidden=mode==='2d';$('#labels').hidden=mode==='2d';
 $('.north').hidden=mode==='3d';
 $('.scene-badge').textContent=mode==='3d'?'실제 XY · 높이는 장소 분류':'실제 지도 · 점선은 방문 순서';
 if(mode==='2d'){
  if(!geoMap){
   if(mapFailed){$('.scene-badge').textContent='네이버 지도 연결 실패 · 목록과 3D는 사용 가능';return;}
   $('.scene-badge').textContent='네이버 지도 연결 중';
   if(!mapLoading){mapLoading=true;loadNaver().then(n=>{geoMap=createCourseMap(n,$('#map2d'),items(),id=>{focus=id;drawDetail();},viewportChanged);geoMap.update(stops,filter,items(),origin);if(mode==='2d'){geoMap.fit();drawScene();}}).catch(()=>{mapFailed=true;$('.scene-badge').textContent='네이버 지도 연결 실패 · 로컬 주소 등록/네트워크 확인 필요';}).finally(()=>{mapLoading=false;});}return;
  }
  $('.scene-badge').textContent='네이버 지도 · 점선은 방문 순서';geoMap.refresh();geoMap.update(stops,filter,items(),origin);return;
 }
 nodes=items().filter(p=>hasPoint(p.point)).map(p=>{const xy=coords(p);return {...p,...xy,z:mode==='3d'?meta(p.category).height:0.05};});
 size=Math.max(5,...nodes.flatMap(p=>[Math.abs(p.x)+1.5,Math.abs(p.y)+1.5]));
 $('#labels').replaceChildren();labels=nodes.map(p=>{const b=document.createElement('button'),i=stops.findIndex(s=>s.id===p.id);b.className=`map-label ${i>=0?'selected':''} ${filter!=='all'&&p.category!==filter&&p.category!=='event'?'faded':''}`;b.style.setProperty('--c',meta(p.category).color);b.innerHTML=`<b>${i>=0?i+1:meta(p.category).icon}</b>${esc(p.name)}`;b.setAttribute('aria-label',`${p.name} 상세`);b.onclick=()=>{focus=p.id;drawDetail();if(controls&&mode==='3d'){controls.target.set(p.x*.4,p.y*.4,p.z*.4);}};$('#labels').append(b);return {b,p};});
 if(!renderer){drawFlatFallback();return;}
 disposeGroup();group=new THREE.Group();scene.add(group);
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(size*2.7,size*2.7),new THREE.MeshBasicMaterial({color:'#e9eee0',side:THREE.DoubleSide}));plane.position.z=-.04;group.add(plane);
 for(let i=-Math.ceil(size);i<=Math.ceil(size);i++){line([new THREE.Vector3(i,-size,0),new THREE.Vector3(i,size,0)],'#ced8c5',false,.6);line([new THREE.Vector3(-size,i,0),new THREE.Vector3(size,i,0)],'#ced8c5',false,.6);}
 for(const p of nodes){const active=filter==='all'||p.category===filter||p.category==='event',c=meta(p.category).color;
 const ring=new THREE.Mesh(new THREE.RingGeometry(.28,.34,48),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,transparent:true,opacity:active?.4:.1}));ring.position.set(p.x,p.y,.015);group.add(ring);
 if(mode==='3d')line([new THREE.Vector3(p.x,p.y,0),new THREE.Vector3(p.x,p.y,p.z)],c,false,active?.4:.12);
 const ball=new THREE.Mesh(new THREE.SphereGeometry(p.category==='event'?.18:.13,24,16),new THREE.MeshStandardMaterial({color:c,roughness:.6,transparent:true,opacity:active?1:.2}));ball.position.set(p.x,p.y,p.z);group.add(ball);
 }
 for(const leg of courseSegments(stops)){if(leg.distanceKm===null)continue;const a=nodes.find(p=>p.id===leg.from.id),b=nodes.find(p=>p.id===leg.to.id);line([new THREE.Vector3(a.x,a.y,a.z+.05),new THREE.Vector3(b.x,b.y,b.z+.05)],'#385d49',true,.85);}
 resize();
}
function drawFlatFallback(){const w=$('#scene').clientWidth,h=$('#scene').clientHeight,scale=Math.min(w,h)/(size*2.6),pos=p=>[w/2+p.x*scale,h/2-p.y*scale];const lines=courseSegments(stops).filter(l=>l.distanceKm!==null).map(l=>{const a=pos(nodes.find(p=>p.id===l.from.id)),b=pos(nodes.find(p=>p.id===l.to.id));return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#456c54" stroke-width="2" stroke-dasharray="5 5"/>`;}).join('');$('#scene').innerHTML=`<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" aria-label="실제 좌표 위치도"><defs><pattern id="grid" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse"><path d="M ${scale} 0 L 0 0 0 ${scale}" fill="none" stroke="#d7dfcf"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/>${lines}${nodes.map(p=>{const [x,y]=pos(p);return `<circle cx="${x}" cy="${y}" r="6" fill="${meta(p.category).color}"/>`;}).join('')}</svg>`;positionLabels(p=>pos(p));}

function positionLabels(project){
 const w=$('#labels').clientWidth,h=$('#labels').clientHeight,placed=[];
 const ordered=[...labels].sort((a,b)=>Number(b.b.classList.contains('selected'))-Number(a.b.classList.contains('selected')));
 for(const {b,p}of ordered){const [px,py]=project(p),bw=b.offsetWidth,bh=b.offsetHeight;
 const clampX=x=>Math.max(bw/2+6,Math.min(w-bw/2-6,x)),clampY=y=>Math.max(100,Math.min(h-76,y));
 const candidates=[];for(const dy of [0,-38,38,-76,76,-114,114])for(const dx of [0,-bw-10,bw+10])candidates.push({x:clampX(px+dx),y:clampY(py-8+dy),cost:Math.abs(dy)+Math.abs(dx)*1.1});
 candidates.sort((a,b)=>a.cost-b.cost);const best=candidates.find(q=>!placed.some(r=>Math.abs(q.x-r.x)<(r.w+bw)/2+5&&q.y-bh<r.y+5&&q.y>r.y-r.h-5))||candidates[0];
 placed.push({...best,w:bw,h:bh});b.style.left=best.x+'px';b.style.top=best.y+'px';
 }
}
function home(){if(mode==='space'){drawSpace();return;}if(mode==='2d'){geoMap?.fit();return;}if(!renderer)return;const aspect=$('#scene').clientWidth/Math.max(1,$('#scene').clientHeight),d=size*Math.max(1,1/aspect);if(mode==='2d'){camera=new THREE.OrthographicCamera(-size*1.3*aspect,size*1.3*aspect,size*1.3,-size*1.3,.1,150);if(aspect<1){camera.left=-size*1.3;camera.right=size*1.3;camera.top=size*1.3/aspect;camera.bottom=-size*1.3/aspect;}camera.position.set(0,0,35);camera.up.set(0,1,0);camera.lookAt(0,0,0);}else{camera=new THREE.PerspectiveCamera(43,aspect,.1,200);camera.up.set(0,0,1);camera.position.set(d*1.05,-d*1.85,d*2.2);camera.lookAt(0,0,1.6);}controls?.dispose();controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,mode==='3d'?1.6:0);controls.enableRotate=mode==='3d';controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.06;controls.minDistance=5;controls.maxDistance=65;controls.minZoom=.6;controls.maxZoom=4;controls.update();}
function resize(){if(mode!=='3d'||!renderer)return;const w=$('#scene').clientWidth,h=$('#scene').clientHeight;renderer.setSize(w,h);if(camera?.isPerspectiveCamera){camera.aspect=w/h;camera.updateProjectionMatrix();}else if(camera){const aspect=w/h;camera.left=-size*1.3*Math.max(1,aspect);camera.right=-camera.left;camera.top=size*1.3*Math.max(1,1/aspect);camera.bottom=-camera.top;camera.updateProjectionMatrix();}}
function switchView(next){if(next==='3d'&&!webgl){notice('이 브라우저에서는 3D를 사용할 수 없어 2D로 유지합니다.');return;}mode=next;render();home();notice(`${mode==='space'?'가상 공간':mode.toUpperCase()}로 전환했습니다. 선택한 ${stops.length}곳과 순서는 그대로입니다.`);}
$('#view2d').onclick=()=>switchView('2d');$('#view3d').onclick=()=>switchView('space');$('#reset-camera').onclick=()=>{if(mapFailed&&mode==='2d'){mapFailed=false;drawScene();}else home();};
$('#next-space').onclick=()=>{const p=spacePage();spaceOffset=p.offset+3>=p.total?0:p.offset+3;focus=null;render();};
$('#more-tiles').onclick=()=>{tileLimit+=6;render();};
$('#filters').onclick=e=>{const b=e.target.closest('[data-filter]');if(b){filter=b.dataset.filter;tileLimit=6;spaceOffset=0;focus=null;render();if(origin)searchPlaces();}};
$('#search').oninput=e=>{query=e.target.value.trim();spaceOffset=0;focus=null;render();};
$('#candidates').onclick=e=>{const f=e.target.closest('[data-focus]');if(f){focus=f.dataset.focus;drawDetail();return;}const b=e.target.closest('[data-toggle]');if(b&&!b.disabled)toggle(b.dataset.toggle);};
$('#stops').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.focus){focus=b.dataset.focus;drawDetail();return;}if(b.dataset.toggle)toggle(b.dataset.toggle);else if(b.dataset.move!=null){stops=moveStop(stops,+b.dataset.move,+b.dataset.delta);render();notice('코스 순서를 변경했습니다. 위치도 번호도 함께 바뀝니다.');}};
$('#clear').onclick=()=>{stops=[];focus=null;refreshScope();notice('코스를 모두 비웠습니다. 행사와 장소를 처음부터 자유롭게 추가하세요.');};
$('#date').onchange=()=>{stops=[];focus=null;searchVersion++;searchAbort?.abort();external=[];naverSearch.clear();refreshScope(false);if(origin)searchPlaces();notice(validDate($('#date').value)?'날짜가 바뀌어 코스를 비웠습니다. 다시 선택해 주세요.':'실제 달력의 날짜를 선택해 주세요.');};
$('#copy').onclick=async()=>{const text=`내 주변 코스 · ${$('#date').value}\n`+stops.map((p,i)=>`${i+1}. ${p.name}\n${p.address}\n${p.source}`).join('\n\n')+'\n\n방문 순서 초안 · 영업·입장·이동시간 미확인';try{await navigator.clipboard.writeText(text);notice('출처 링크를 포함한 코스 목록을 복사했습니다.');}catch{notice('클립보드 권한이 없어 복사하지 못했습니다. 화면의 목록을 직접 선택해 복사할 수 있습니다.');}};
$('#date').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('#gps').onclick=()=>{cancelLocation();$('#gps').disabled=true;$('#location-status').textContent='위치 확인 중…';cancelLocation=locate(navigator,(p,accuracy)=>{mapSearch=false;screenBounds=null;lastViewport='';origin=p;area='';$('#region').value='';$('#gps').disabled=false;$('#location-status').textContent=`내 위치 기준 · 정확도 약 ${Math.round(accuracy)}m`;refreshScope(true);searchPlaces();},message=>{origin=null;area='';$('#region').value='';$('#gps').disabled=false;$('#location-status').textContent=message;refreshScope(true);$('#region').focus();});};
$('#region').onchange=e=>{cancelLocation();$('#gps').disabled=false;origin=null;area=e.target.value;$('#location-status').textContent=area?'선택 지역 기준 · 현재 위치를 추정하지 않습니다.':'위치 사용 또는 지역 선택으로 시작하세요.';refreshScope(true);};
$('#radius').onchange=()=>{screenBounds=null;mapSearch=false;refreshScope();searchPlaces();};
async function loadData(){try{const r=await fetch('/data.json');if(!r.ok)throw Error();const ledger=await r.json();const photos=await fetch('/course/photos.json').then(r=>r.ok?r.json():[]).catch(()=>[]);events=normalizeEvents(ledger,photos);all=[...events,...realPlaces];$('#region').innerHTML='<option value="">지역을 선택하세요</option>'+[...new Map(events.map(p=>[p.area,p.areaName])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ko')).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');$('#retry-data').hidden=true;refreshScope(true);notice('내 위치로 찾기를 누르거나 지도에서 정하기를 누르세요. 검색 결과는 직접 담는 코스 초안이며 확정 방문 추천이 아닙니다.');}catch{$('#retry-data').hidden=false;notice('원장 자료를 불러오지 못했습니다. 다시 불러오기를 눌러 주세요.');}}
$('#retry-data').onclick=loadData;
config=await fetch('/api/config').then(r=>r.json()).catch(()=>({}));
render();loadData();
new ResizeObserver(()=>{if(mode==='2d')geoMap?.refresh();else if(mode==='3d'&&renderer)resize();else if(mode==='3d')drawFlatFallback();}).observe($('.scene-wrap'));

function updateSearchContext(){naverSearch.update({lang:'ko',date:$('#date').value,origin:origin?{point:origin}:null,enabled:!!config.naverSearch});}
async function searchPlaces(){
 tileLimit=6;spaceOffset=0;const version=++searchVersion;searchAbort?.abort();searchAbort=new AbortController();external=[];focus=null;updateSearchContext();naverSearch.clear();refreshScope();
 if(!origin)return;
 if(!config.nearby){$('#nearby-status').textContent='이 환경에는 카카오 검색 키가 연결되지 않았습니다.';return;}
 const code=providerCategories[filter]||'FD6';
 $('#nearby-status').textContent='카카오 장소 조회 중 · 이전 후보는 비웠습니다.';
 try{const r=await fetch('/api/nearby',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:searchAbort.signal,body:JSON.stringify({point:origin,category:code,radius:Number($('#radius').value)*1000,...(screenBounds?{bounds:screenBounds}:{})})});if(!r.ok)throw Error();const j=await r.json();if(version!==searchVersion)return;
 const category=Object.keys(providerCategories).find(k=>providerCategories[k]===code);
 external=j.places.map(p=>({...p,category,source:p.url,sourceName:'카카오 장소',checkedAt:j.fetchedAt,description:'실시간 검색 결과 · 방문 가능 여부 미확인',coordinateNote:'카카오 제공 장소 좌표'}));refreshScope();
 $('#nearby-status').textContent=`카카오 ${external.length}곳 · ${screenBounds?'화면 범위':'선택 반경'} · 최대 15건${j.hasMore?' (추가 후보 있음)':''} · ${j.fetchedAt}`;
 if(code==='FD6'){const q=nearbyFoodQuery(j.places);if(q)await naverSearch.search(q,true);}
 }catch(e){if(version!==searchVersion)return;$('#nearby-status').textContent='조회 실패 · 이전 후보를 비웠습니다. 국내 지역으로 지도를 이동하거나 내 위치로 다시 시도하세요.';}
}
function viewportChanged(v){if(!mapSearch||mode!=='2d')return;const key=JSON.stringify(v);if(key===lastViewport)return;lastViewport=key;origin=v.point;screenBounds=v.bounds;area='';$('#radius').disabled=true;$('#location-status').textContent='지도 중심 기준 · 화면 이동 후 자동 갱신 · 코스는 유지';searchPlaces();}
$('#choose-map').onclick=()=>{cancelLocation();$('#gps').disabled=false;mapSearch=true;lastViewport='';if(mode!=='2d')switchView('2d');if(geoMap)viewportChanged(geoMap.viewport());else drawScene();};

function photoTile(p){return p.photo?`<img src="${esc(p.photo.src)}" alt="${esc(p.name)} 개최 장소 기록 사진 · 현재 행사 모습 아님" loading="lazy" decoding="async"><span class="photo-caption">장소 기록 사진</span>`:`<span class="no-photo"><span aria-hidden="true">${meta(p.category).icon}</span>사진 미확보</span>`;}
function photoCredit(p){const m=p.photo;if(!m)return '';return `<details class="photo-credit"><summary>사진 출처</summary><a href="${esc(m.source)}" target="_blank" rel="noopener noreferrer">${esc(m.author)}</a> · <a href="${esc(m.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(m.license)}</a><span>${esc(m.capturedAt||'촬영일 미확인')} · 화면에 맞춰 잘라 표시 · 현재 행사 사진 아님</span></details>`;}

document.addEventListener('error',e=>{const img=e.target;if(img.tagName==='IMG'&&img.closest('.tile-open,.space-orb')){const label=document.createElement('span');label.className='no-photo';label.textContent='사진을 불러오지 못했습니다';img.replaceWith(label);}},true);
