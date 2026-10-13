import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {project,score,height} from './model.mjs';
const $=id=>document.getElementById(id), data=await fetch('./data.json').then(r=>r.json());
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode='demo',interest='자연',selected=null,focusCamera=()=>{},refresh=()=>{};
const colors={'자연':0xbddf8a,'문화':0xbba3e3,'전시':0x83c9cf,'역사':0xe6b383};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function select(p){selected=p;renderDetail();focusCamera(p);}
function renderDetail(){if(!selected)return;const p=selected,s=score(p,mode,interest),m=p.media;
 $('detail').innerHTML=`<p class="eyebrow">${escape(p.tag)} / RESEARCH OBJECT</p><h2>${escape(p.name)}</h2>${m?`<img src="${m.src}" alt="${escape(p.name)} 장소 기록 사진">`:''}<p class="score">${s}<span style="font-size:14px"> / 100</span></p><p>${mode==='demo'?'인지도 시뮬레이션 · 가상 점수':mode==='flat'?'높이 없이 위치만 표시':`관심사 ‘${interest}’ ${s?'일치':'불일치'}`}</p><p class="small">${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}<br>시설 참조 좌표 · 정확한 입구 미검증<br>연구 자료 · 영업·예약·당일 방문 가능성 미확인</p>${m?`<p class="small">장소 기록 사진 · 현재 행사 사진 아님<br><a href="${m.source}" target="_blank" rel="noopener">${escape(m.author)}</a> · <a href="${m.licenseUrl}" target="_blank" rel="noopener">${escape(m.license)}</a></p>`:''}`;
}
for(const p of data.places){const b=document.createElement('button');b.textContent=p.name;b.onclick=()=>select(p);$('list').append(b);}
$('excluded').textContent=data.excluded.map(p=>p.name).join(' · ')+' — 원본 좌표 미확인. 임의 위치를 만들지 않았습니다.';
function change(){mode=$('mode').value;interest=$('interest').value;$('interests').hidden=mode!=='preference';$('explanation').textContent=mode==='demo'?'가상 점수 0–100 · 실제 인기도가 아닙니다.':mode==='preference'?'선택 주제 일치 100 / 불일치 0 · 학습된 추천 아님':'X = 동서 · Y = 남북 · Z = 0';refresh();renderDetail();}
$('mode').onchange=change;$('interest').onchange=change;
try{init();}catch(e){console.error(e);$('status').textContent='3D 사용 불가 · 아래 장소 목록으로 탐색하세요';for(const b of document.querySelectorAll('.tools button'))b.disabled=true;}
function init(){
 const host=$('canvas-host'),scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0b191c,.019);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));host.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(44,1,.1,120);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,host);controls.enableDamping=!reduced;controls.dampingFactor=.08;controls.minDistance=3;controls.maxDistance=40;controls.maxPolarAngle=Math.PI/2-.025;controls.autoRotateSpeed=.45;
 const coarse=matchMedia('(pointer:coarse)').matches;let touchLayout=coarse||innerWidth<=760;controls.enabled=!touchLayout;
 const center=new THREE.Vector3(2,-1,1),home=new THREE.Vector3(4,-13,13);camera.position.copy(home);controls.target.copy(center);
 let tween=null;function move(position,target){if(reduced){camera.position.copy(position);controls.target.copy(target);return;}tween={p:camera.position.clone(),t:controls.target.clone(),to:position,target,start:performance.now()};}
 controls.addEventListener('start',()=>tween=null);
 function homePosition(){return center.clone().add(home.clone().sub(center).multiplyScalar(Math.max(1,.95/camera.aspect)));}
 $('home').onclick=()=>move(homePosition(),center);$('top').onclick=()=>move(new THREE.Vector3(2,-1.001,25),new THREE.Vector3(2,-1,0));
 $('motion').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('motion').setAttribute('aria-pressed',controls.autoRotate);};
 $('immersive').onclick=()=>{controls.enabled=!controls.enabled;host.classList.toggle('active',controls.enabled);$('immersive').setAttribute('aria-pressed',controls.enabled);$('immersive').textContent=controls.enabled?'터치 탐색 끄기':'터치 탐색 켜기';};
 const grid=new THREE.GridHelper(24,24,0x557369,0x28443e);grid.rotation.x=Math.PI/2;scene.add(grid);
 function sprite(text,color,size=256){const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');x.fillStyle='#172d28';x.beginPath();x.arc(size/2,size/2,size*.44,0,Math.PI*2);x.fill();x.strokeStyle=color;x.lineWidth=4;x.stroke();x.fillStyle=color;x.textAlign='center';x.textBaseline='middle';x.font=`bold ${size*.24}px sans-serif`;x.fillText(text,size/2,size/2);return new THREE.CanvasTexture(c);}
 for(const [s,x,y]of[['N',0,11],['S',0,-11],['E',11,0],['W',-11,0]]){const a=new THREE.Sprite(new THREE.SpriteMaterial({map:sprite(s,'#a6c89c')}));a.position.set(x,y,.07);a.scale.set(.7,.7,1);scene.add(a);}
 const origin=new THREE.Mesh(new THREE.RingGeometry(.13,.2,32),new THREE.MeshBasicMaterial({color:0xe0f3bb,side:THREE.DoubleSide}));origin.position.z=.02;scene.add(origin);
 const originLabel=document.createElement('span');originLabel.className='node-label';originLabel.style.pointerEvents='none';originLabel.textContent='기준점 · 호수공원';$('labels').append(originLabel);
 const nodes=[],loader=new THREE.TextureLoader();
 for(const p of data.places){const {x,y}=project(p.latitude,p.longitude),col=colors[p.tag];
  const map=sprite(p.tag,new THREE.Color(col).getStyle());map.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map,color:0xffffff});const node=new THREE.Sprite(material);node.position.set(x,y,height(score(p,mode,interest))+.26);node.scale.set(1.1,1.1,1);node.userData=p;scene.add(node);
  if(p.media)loader.load(p.media.src,texture=>{texture.colorSpace=THREE.SRGBColorSpace;material.map.dispose();material.map=texture;material.needsUpdate=true;},undefined,()=>{});
  const ring=new THREE.Mesh(new THREE.RingGeometry(.12,.17,32),new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide}));ring.position.set(x,y,.03);scene.add(ring);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,y,0),node.position.clone()]),new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.5}));scene.add(line);
  const b=document.createElement('button');b.className='node-label';b.textContent=p.name;b.onclick=()=>select(p);$('labels').append(b);
  nodes.push({p,node,line,b,target:node.position.z});
 }
 refresh=()=>{for(const n of nodes)n.target=height(score(n.p,mode,interest))+.26;};
 focusCamera=p=>{const n=nodes.find(n=>n.p===p);const target=new THREE.Vector3(n.node.position.x,n.node.position.y,n.target);move(target.clone().add(new THREE.Vector3(4,-6,5)),target);};
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
 host.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});host.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(nodes.map(n=>n.node))[0];if(hit)select(hit.object.userData);});
 const resize=new ResizeObserver(()=>{const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();const mobile=coarse||innerWidth<=760;if(mobile!==touchLayout){touchLayout=mobile;controls.enabled=!mobile;host.classList.remove('active');$('immersive').setAttribute('aria-pressed','false');$('immersive').textContent='터치 탐색 켜기';}if(!selected){camera.position.copy(homePosition());controls.target.copy(center);}});resize.observe(host);
 let visible=true;const observer=new IntersectionObserver(([e])=>visible=e.isIntersecting);observer.observe(host);
 let prev=performance.now(),acc=0,count=0;const v=new THREE.Vector3();
 function positionLabel(el,pos,offset){v.copy(pos).project(camera);el.hidden=v.z>1||v.z< -1;el.style.left=(v.x*.5+.5)*host.clientWidth+'px';el.style.top=((-v.y*.5+.5)*host.clientHeight+offset)+'px';}
 renderer.setAnimationLoop(now=>{const dt=Math.min((now-prev)/1000,.1);prev=now;if(document.hidden||!visible)return;
  if(tween){let t=Math.min(1,(now-tween.start)/850),a=1-(1-t)**3;camera.position.lerpVectors(tween.p,tween.to,a);controls.target.lerpVectors(tween.t,tween.target,a);if(t===1)tween=null;}
  controls.update(dt);
  for(const n of nodes){n.node.position.z=reduced?n.target:THREE.MathUtils.damp(n.node.position.z,n.target,7,dt);const arr=n.line.geometry.attributes.position;arr.setXYZ(1,n.node.position.x,n.node.position.y,n.node.position.z);arr.needsUpdate=true;n.line.geometry.computeBoundingSphere();n.node.scale.setScalar(n.p===selected?1.5:1.1);positionLabel(n.b,n.node.position,24);n.b.classList.toggle('selected',n.p===selected);}
  positionLabel(originLabel,new THREE.Vector3(0,0,0),23);
  const occupied=[];
  for(const n of [...nodes].sort((a,b)=>(b.p===selected)-(a.p===selected))){const x=parseFloat(n.b.style.left),y=parseFloat(n.b.style.top),w=n.b.offsetWidth||100,h=26;const box={l:x-w/2,r:x+w/2,t:y-h/2,b:y+h/2};const collision=occupied.some(o=>box.l<o.r+4&&box.r>o.l-4&&box.t<o.b+4&&box.b>o.t-4);const show=!n.b.hidden&&y>95&&y<host.clientHeight-48&&x>0&&x<host.clientWidth&&(!collision||n.p===selected);n.b.style.visibility=show?'visible':'hidden';if(show)occupied.push(box);}
  renderer.render(scene,camera);acc+=dt;count++;if(acc>=1){$('status').textContent=`WebGL2 · ${nodes.length} 장소 · ${Math.round(count/acc)} fps`;acc=0;count=0;}
 });
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);$('status').textContent='그래픽 연결 중단 · 새로고침 또는 아래 목록 이용';});
 window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);controls.dispose();resize.disconnect();observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});renderer.dispose();},{once:true});
}
