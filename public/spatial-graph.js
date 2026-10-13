import {eventMarker} from './event-marker.js';
import * as THREE from './vendor/three186/three.module.js';
import {OrbitControls} from './vendor/three186/OrbitControls.js';
import {spatialFrame,categoryLayers,categoryNodes,placeCategoryLayers,courseLayer} from './spatial-model.js';
const copy={
 ko:{layers:'Z축: 카테고리',layerNote:'높이는 분류이며 순위가 아닙니다',unclassified:'분류 미확인',top:'북쪽 위',home:'전체 보기',rotate:'자동 회전',touch:'터치 탐색',list:'이벤트 선택',note:'X·Y 실제 방위 · 선은 위치 표시, 이동 경로 아님',center:'지역 중심',empty:'현재 조건의 방문 후보가 없습니다.'},
 en:{layers:'Z: categories',layerNote:'Height denotes category, not rank',unclassified:'Unclassified',top:'North up',home:'Fit all',rotate:'Auto rotate',touch:'Touch explore',list:'Select event',note:'X/Y geographic directions · lines mark locations, not routes',center:'Area center',empty:'No visit candidates for these filters.'},
 ja:{layers:'Z軸：カテゴリ',layerNote:'高さは分類であり順位ではありません',unclassified:'分類未確認',top:'北を上に',home:'全体表示',rotate:'自動回転',touch:'タッチ探索',list:'イベントを選択',note:'X/Yは地理方位 · 線は位置表示、経路ではありません',center:'地域の中心',empty:'現在の条件に合う訪問候補はありません。'},
 'zh-Hans':{layers:'Z轴：类别',layerNote:'高度代表类别，不代表排名',unclassified:'分类未确认',top:'北向上',home:'显示全部',rotate:'自动旋转',touch:'触摸探索',list:'选择活动',note:'X/Y为地理方位 · 连线表示位置，不是路线',center:'区域中心',empty:'当前条件下没有可访问候选地点。'}
};
export function mountSpatialGraph(container,{places,t,lang='ko',origin,eventLabel=(e,p)=>eventMarker(e,p,{lang,origin:origin?.point}),selectedIds=[],courseStops=[],onPlace,onLeave,onReset,onUnavailable,memory={}}){
 const text=copy[lang]||copy.ko,frame=spatialFrame([...places,...courseStops.map(s=>({id:s.id,point:s.point,events:[]}))],origin?.point),factor=8/frame.extent;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let dead=false,inView=true,selected=null,selectedLayer=null,tween=null;
 // Allocate WebGL first so initialization failures leave the 2D fallback clean.
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 container.replaceChildren();container.classList.add('spatial-scene');
 const host=document.createElement('div');host.className='spatial-canvas';host.append(renderer.domElement);
 const overlay=document.createElement('div');overlay.className='spatial-labels';
 const tools=document.createElement('div');tools.className='spatial-tools';
 const note=document.createElement('div');note.className='spatial-note';note.setAttribute('role','status');container.append(host,overlay,tools,note);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.1,180);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,host);controls.enableDamping=!reduced.matches;controls.minDistance=2;controls.maxDistance=90;controls.maxPolarAngle=Math.PI/2-.03;controls.autoRotateSpeed=.4;
 let mobile=matchMedia('(pointer:coarse)').matches||innerWidth<=750,touchEnabled=false;controls.enabled=!mobile;
 function button(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;tools.append(b);return b;}
 const center=new THREE.Vector3(0,0,courseStops.length?Math.max(3,...courseStops.map(s=>courseLayer(s).z))/2:3);function home(){const d=Math.max(1,1.1/camera.aspect);return new THREE.Vector3(5*d,-23*d,23*d);}
 function move(p,target){if(reduced.matches){camera.position.copy(p);controls.target.copy(target);return;}tween={from:camera.position.clone(),targetFrom:controls.target.clone(),p,target,start:performance.now()};}
 button(text.home,()=>{move(home(),center);onReset?.();});
 button(text.top,()=>{const d=Math.max(28,28/camera.aspect);move(new THREE.Vector3(0,-.001,d),new THREE.Vector3());});
 const rotate=button(text.rotate,()=>{controls.autoRotate=!controls.autoRotate;rotate.setAttribute('aria-pressed',String(controls.autoRotate));});rotate.setAttribute('aria-pressed','false');
 const touch=button(text.touch,()=>{touchEnabled=!touchEnabled;syncTouch();});
 function syncTouch(){controls.enabled=!mobile||touchEnabled;host.classList.toggle('exploring',touchEnabled);touch.setAttribute('aria-pressed',String(touchEnabled));touch.hidden=!mobile;}
 syncTouch();controls.addEventListener('start',()=>tween=null);
 // No grid or category plane borders: category is encoded by height and color.
 function glyph(label,color){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');const shade=c.createRadialGradient(43,35,3,64,64,60);shade.addColorStop(0,'#557568');shade.addColorStop(.55,'#284d40');shade.addColorStop(1,'#112b24');c.fillStyle=shade;c.beginPath();c.arc(64,64,57,0,Math.PI*2);c.fill();c.strokeStyle=color;c.lineWidth=4;c.stroke();c.fillStyle=color;c.font='bold 42px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(label,64,65);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;}
 for(const [label,x,y]of[['N',0,10.7],['S',0,-10.7],['E',10.7,0],['W',-10.7,0]]){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glyph(label,'#aec99a')}));s.position.set(x,y,.1);s.scale.set(.65,.65,1);scene.add(s);}
 const originRing=new THREE.Mesh(new THREE.RingGeometry(.13,.23,24),new THREE.MeshBasicMaterial({color:0xe3f2b6,side:THREE.DoubleSide}));originRing.position.z=.025;scene.add(originRing);
 const originLabel=document.createElement('span');originLabel.className='spatial-origin';originLabel.textContent=origin?.name||text.center;overlay.append(originLabel);
 const access=document.createElement('details');access.className='spatial-access';const summary=document.createElement('summary');summary.textContent=`${text.list} (${frame.places.length})`;const choices=document.createElement('div');access.append(summary,choices);container.append(access);
 const nodes=[],loader=new THREE.TextureLoader(),layered=categoryNodes(frame.places);
 const layerName=id=>id==='unknown'?text.unclassified:t(id);
 const legend=document.createElement('div');legend.className='spatial-layers';legend.setAttribute('aria-label',text.layers);

 for(const layer of categoryLayers){const count=layered.filter(p=>p.layer.id===layer.id).length;if(layer.id==='unknown'&&!count)continue;
  const label=document.createElement('span');label.style.setProperty('--layer-color',layer.color);label.textContent=`${layerName(layer.id)} · ${count}`;legend.append(label);

 }
 container.append(legend);summary.textContent=`${text.list} (${layered.reduce((sum,p)=>sum+p.events.length,0)})`;

 function activate(n,pin,event=n.event){selectedLayer=n.p.layer.id;if(!event)return;if(pin){n.event=event;const info=eventLabel(event,n.p);n.b.querySelector('strong').textContent=info.title+(n.p.events.length>1?` +${n.p.events.length-1}`:'');n.b.querySelector('small').textContent=[info.time,info.distance].filter(Boolean).join(' · ');n.b.title=[info.title,n.p.name,layerName(n.p.layer.id),info.distance].filter(Boolean).join(' · ');}onPlace?.(event.id,pin,n.p.id);if(pin){focus(n.p.id);const target=new THREE.Vector3(n.node.position.x,n.node.position.y,n.target);move(target.clone().add(new THREE.Vector3(3,-7,6)),target);access.open=false;}}
 for(const p of layered){const {color,glyph:icon}=p.layer;
  const mat=new THREE.SpriteMaterial({map:glyph(icon,color)}),node=new THREE.Sprite(mat);node.position.set(p.xy.x*factor,p.xy.y*factor,p.layer.z);node.scale.set(1.1,1.1,1);scene.add(node);
  if(p.media)loader.load(p.media,texture=>{if(dead){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;mat.map.dispose();mat.map=texture;mat.needsUpdate=true;},undefined,()=>{});
  const ring=new THREE.Mesh(new THREE.RingGeometry(.1,.16,24),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));ring.position.set(node.position.x,node.position.y,.02);scene.add(ring);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(node.position.x,node.position.y,0),node.position.clone()]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.18}));scene.add(line);
  const event=p.events.find(e=>selectedIds.includes(e.id))||p.events[0],info=eventLabel(event,p);
  const b=document.createElement('button');b.className='spatial-node';b.type='button';
  const heading=document.createElement('strong');heading.textContent=info.title+(p.events.length>1?` +${p.events.length-1}`:'');
  const sub=document.createElement('small');sub.textContent=[info.time,info.distance].filter(Boolean).join(' · ');
  b.append(heading,sub);b.title=[info.title,p.name,layerName(p.layer.id),sub.textContent].filter(Boolean).join(' · ');
  b.style.setProperty('--node-color',color);b.dataset.layer=p.layer.id;b.dataset.place=p.id;overlay.append(b);const n={p,event,node,line,ring,b,target:p.layer.z};nodes.push(n);node.userData.node=n;

  b.onclick=()=>activate(n,true);b.onpointerenter=e=>{if(e.pointerType==='mouse')activate(n,false);};b.onpointerleave=()=>onLeave?.();b.onfocus=()=>activate(n,false);b.onblur=()=>onLeave?.();
  for(const e of p.events){const item=document.createElement('button'),detail=eventLabel(e,p);item.type='button';item.textContent=[detail.title,detail.time,detail.distance].filter(Boolean).join(' · ');item.onclick=()=>activate(n,true,e);choices.append(item);}
 }
 const courseLabels=[],coursePositions=[];
 for(const layer of placeCategoryLayers){const selected=courseStops.filter(s=>s.kind==='place'&&s.category===layer.id);if(!selected.length)continue;const label=document.createElement('span');label.style.setProperty('--layer-color',layer.color);label.textContent=`${layer.names[{ko:0,en:1,ja:2,'zh-Hans':3}[lang]??1]} · ${selected.length}`;legend.append(label);}
 courseStops.forEach((stop,i)=>{const layer=courseLayer(stop);const p=frame.places.find(p=>p.id===stop.id);if(!p)return;const pos=new THREE.Vector3(p.xy.x*factor,p.xy.y*factor,layer.z);coursePositions.push(pos);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glyph(String(i+1),layer.color),depthTest:false}));sprite.position.copy(pos);sprite.scale.set(.9,.9,1);sprite.renderOrder=2;scene.add(sprite);const label=document.createElement('span');label.className='spatial-course-label';label.textContent=`${i+1}. ${stop.name}`;label.title=stop.name;overlay.append(label);const stack=courseStops.slice(0,i).filter(s=>s.point.lat===stop.point.lat&&s.point.lng===stop.point.lng&&courseLayer(s).z===layer.z).length;courseLabels.push({label,pos,offset:-25-stack*25});});
 if(coursePositions.length){const path=[new THREE.Vector3(0,0,.03),...coursePositions];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(path),new THREE.LineDashedMaterial({color:'#e4eec9',transparent:true,opacity:.65,dashSize:.2,gapSize:.13}));line.computeLineDistances();scene.add(line);}
 note.textContent=!nodes.length&&!courseStops.length?text.empty:text.layerNote;note.title=text.note;
 function isSelected(n){return n.p.id===selected&&(!selectedLayer||n.p.layer.id===selectedLayer);}
 function focus(id){selected=id;if(!id)selectedLayer=null;for(const n of nodes){n.b.classList.toggle('active',isSelected(n));n.line.visible=isSelected(n);n.ring.visible=isSelected(n);}}
 focus(null);
 let down=null;host.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});host.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(nodes.map(n=>n.node))[0];if(hit)activate(hit.object.userData.node,true);});
 const resize=new ResizeObserver(()=>{if(dead)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();mobile=matchMedia('(pointer:coarse)').matches||innerWidth<=750;syncTouch();if(!selected){camera.position.copy(home());controls.target.copy(center);}});resize.observe(host);
 const intersection=new IntersectionObserver(([entry])=>inView=entry.isIntersecting);intersection.observe(host);
 const pref=()=>{controls.enableDamping=!reduced.matches;if(reduced.matches){controls.autoRotate=false;rotate.setAttribute('aria-pressed','false');tween=null;}};reduced.addEventListener('change',pref);
 const lost=e=>{e.preventDefault();renderer.setAnimationLoop(null);queueMicrotask(()=>{if(!dead)onUnavailable?.();});};renderer.domElement.addEventListener('webglcontextlost',lost);
 let last=performance.now();const v=new THREE.Vector3();
 function position(el,p,offset){v.copy(p).project(camera);el.style.left=(v.x*.5+.5)*host.clientWidth+'px';el.style.top=((-v.y*.5+.5)*host.clientHeight+offset)+'px';return v.z>=-1&&v.z<=1;}
 camera.position.copy(home());controls.target.copy(center);
 renderer.setAnimationLoop(now=>{const dt=Math.min(.08,(now-last)/1000);last=now;if(dead||document.hidden||!inView)return;
  if(tween){const a=Math.min(1,(now-tween.start)/750),ease=1-(1-a)**3;camera.position.lerpVectors(tween.from,tween.p,ease);controls.target.lerpVectors(tween.targetFrom,tween.target,ease);if(a===1)tween=null;}
  controls.update(dt);const boxes=[],reserve=tools.offsetHeight+24;
  for(const n of [...nodes].sort((a,b)=>isSelected(b)-isSelected(a))){n.node.position.z=reduced.matches?n.target:THREE.MathUtils.damp(n.node.position.z,n.target,8,dt);n.node.scale.setScalar(isSelected(n)?1.4:1.1);const attr=n.line.geometry.attributes.position;attr.setZ(1,n.node.position.z);attr.needsUpdate=true;n.line.geometry.computeBoundingSphere();const visible=position(n.b,n.node.position,25),x=parseFloat(n.b.style.left),y=parseFloat(n.b.style.top),w=n.b.offsetWidth||120;const box={x,y,w};const overlap=boxes.some(b=>Math.abs(b.y-y)<52&&Math.abs(b.x-x)<(w+b.w)/2+4);const show=visible&&y>reserve&&y<host.clientHeight-note.offsetHeight-20&&x>w/2&&x<host.clientWidth-w/2&&(!overlap||isSelected(n));n.b.style.visibility=show?'visible':'hidden';if(show)boxes.push(box);}
  for(const {label,pos,offset} of courseLabels){label.style.visibility=position(label,pos,offset)?'visible':'hidden';}
  originLabel.style.visibility=position(originLabel,new THREE.Vector3(),18)?'visible':'hidden';renderer.render(scene,camera);
 });
 return {focus,destroy(){if(dead)return;dead=true;renderer.setAnimationLoop(null);resize.disconnect();intersection.disconnect();reduced.removeEventListener('change',pref);renderer.domElement.removeEventListener('webglcontextlost',lost);controls.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});renderer.dispose();container.classList.remove('spatial-scene');container.replaceChildren();}};
}
