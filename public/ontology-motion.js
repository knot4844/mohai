import {clusterPlaces} from './places.js';
// Geographic positions preserve bearings; edges encode categories and itinerary relations.
const NS='http://www.w3.org/2000/svg';
const colors=['#70d9be','#edb873','#e88980','#9ba5ed','#a8cf79','#80c8e6'];
const el=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n;};
export function semanticGroups(places){
 const result=new Map();
 for(const p of places){const category=p.events[0]?.category||'other';if(!result.has(category))result.set(category,[]);result.get(category).push(p);}
 return [...result].map(([id,members],i)=>({id,members,color:colors[i%colors.length]}));
}
export function geographicLayout(places,origin,width,height){
 const points=places.map(p=>p.point).filter(p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng));
 const center=origin?.point||{lat:points.length?(Math.min(...points.map(p=>p.lat))+Math.max(...points.map(p=>p.lat)))/2:37.65,lng:points.length?(Math.min(...points.map(p=>p.lng))+Math.max(...points.map(p=>p.lng)))/2:126.8};
 const mercator=p=>({x:p.lng*Math.PI/180,y:Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))});
 const c=mercator(center),projected=points.map(mercator);
 const dx=Math.max(.0001,...projected.map(p=>Math.abs(p.x-c.x))),dy=Math.max(.0001,...projected.map(p=>Math.abs(p.y-c.y)));
 const scale=Math.min(Math.max(20,width/2-45)/dx,Math.max(20,height/2-90)/dy);
 return p=>{const q=mercator(p);return {x:width/2+(q.x-c.x)*scale,y:height/2-(q.y-c.y)*scale};};
}
export function pinchViewport(start,current,width,height){
 const zoom=Math.max(.6,Math.min(8,start.zoom*current.distance/Math.max(1,start.distance))),ratio=zoom/start.zoom;
 return {zoom,pan:{x:current.x-width/2-(start.x-width/2-start.pan.x)*ratio,y:current.y-height/2-(start.y-height/2-start.pan.y)*ratio}};
}
export function relax(nodes,width,height,steps=1){
 for(let s=0;s<steps;s++){
  for(const n of nodes){if(n.fixed)continue;n.vx=(n.vx+(n.tx-n.x)*.016)*.76;n.vy=(n.vy+(n.ty-n.y)*.016)*.76;}
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<.01){dx=.1;dy=.1;d=Math.hypot(dx,dy);}const min=a.radius+b.radius+9;
   if(d<min){const f=(min-d)*.18;dx=dx/d*f;dy=dy/d*f;if(!a.fixed){a.vx-=dx;a.vy-=dy;}if(!b.fixed){b.vx+=dx;b.vy+=dy;}}
  }
  for(const n of nodes){if(n.fixed)continue;n.x=Math.max(n.radius+15,Math.min(width-n.radius-15,n.x+n.vx));n.y=Math.max(n.radius+55,Math.min(height-n.radius-60,n.y+n.vy));}
 }
 return nodes;
}
export function mountOntology(container,{places,width,height,t,origin,selectedIds=[],onReset,onCluster,memory={}}){
 const buckets=semanticGroups(places),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let inView=true,hovering=false;
 let destroyed=false,frame=0,tick=0,paused=memory.paused??reduced.matches,focused=buckets.some(b=>b.id===memory.focused)?memory.focused:null,selected=null,zoom=1,pan={x:0,y:0},drag=null,moved=false,activePointer=null,skipClick=false;
 const pointers=new Map();let pinch=null;
 let nodes=[],edges=[],viewWidth=width,viewHeight=height;
 container.replaceChildren();container.classList.add('ontology-scene');
 const svg=el('svg',{viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':t('graphScene')});
 const backdrop=el('g',{'aria-hidden':'true'});
 for(let i=0;i<28;i++)backdrop.append(el('circle',{cx:(i*137+29)%width,cy:(i*83+53)%height,r:i%4===0?1.5:.7,fill:'#a7d8c7',opacity:.2}));
 svg.append(backdrop);const world=el('g');svg.append(world);container.append(svg);
 const compass=document.createElement('div');compass.className='ontology-compass';compass.textContent='N ↑ · W ← → E · S ↓';container.append(compass);
 const header=document.createElement('div');header.className='ontology-heading';container.append(header);
 const controls=document.createElement('div');controls.className='ontology-controls';container.append(controls);
 const button=(text,label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.title=label;b.onclick=action;controls.append(b);return b;};
 const back=button('↶',t('graphBack'),()=>{focused=null;onReset?.();build();});
 button('+',t('graphZoomIn'),()=>setZoom(zoom*1.25));button('−',t('graphZoomOut'),()=>setZoom(zoom/1.25));
 button('⊙',t('graphFit'),()=>{zoom=1;pan={x:0,y:0};paint();});
 const pause=button(paused?'▶':'Ⅱ',t('graphPause'),()=>{paused=!paused;syncPause();if(!paused)start();});
 const legend=document.createElement('div');legend.className='ontology-legend';legend.textContent=t('graphRelation');container.append(legend);
 function syncPause(){memory.paused=paused;pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',t(paused?'graphPlay':'graphPause'));pause.setAttribute('aria-pressed',String(paused));container.classList.toggle('motion-paused',paused);}
 function setZoom(v){zoom=Math.max(.6,Math.min(8,v));build(true);}
 function node(id,label,x,y,radius,color,kind,p){const n={id,label,x,y,tx:x,ty:y,vx:0,vy:0,radius,color,kind,p};nodes.push(n);return n;}
 function link(a,b,kind='category'){const path=el('path',{class:`ontology-edge ${kind}`,'data-from':a.id,'data-to':b.id});const spark=el('circle',{r:kind==='origin'?2:1.6,fill:b.color,class:'ontology-spark'});world.append(path,spark);edges.push({a,b,path,spark,kind,phase:edges.length*.137});}
 function build(keepCamera=false){
  memory.focused=focused;
  if(!keepCamera){zoom=1;pan={x:0,y:0};}tick=0;hovering=false;nodes=[];edges=[];world.replaceChildren();back.hidden=!focused;container.classList.toggle('expanded',!!focused);
  const shown=focused?buckets.filter(b=>b.id===focused):buckets;
  const count=shown.reduce((s,b)=>s+b.members.length,0);
  viewWidth=focused?Math.max(width,Math.sqrt(count)*80):width;viewHeight=focused?Math.max(height,Math.sqrt(count)*84+130):height;
  header.replaceChildren();const title=document.createElement('strong');title.textContent=focused?t(focused):t('graphTitle');const sub=document.createElement('small');sub.textContent=`${count} ${t('mapPlaces')} · ${t('graphSelectPlace')}`;header.append(title,sub);
  const center=node('center',origin?.name||t('graphToday'),viewWidth/2,viewHeight/2,18/(Math.min(width/viewWidth,height/viewHeight)*zoom),'#f1cd94','center');center.fixed=true;
  const project=geographicLayout(places,origin,viewWidth,viewHeight);
  const fit=Math.min(width/viewWidth,height/viewHeight)*zoom;
  const clusters=clusterPlaces(places,project,60/fit);
  for(const c of clusters){
   const p=c.members[0],bucket=buckets.find(b=>b.members.includes(p));
   const n=c.members.length>1?node('cluster:'+c.members.map(p=>p.id).join(','),`${c.members.length} ${t('nearbyPlaces')}`,c.x,c.y,23/fit,bucket.color,'cluster',c):node(p.id,p.displayTitle||p.name,c.x,c.y,22/fit,bucket.color,'place',p);
   n.fixed=true;if(origin)link(center,n,'origin');
  }
  // Preserve the ordered itinerary as an explicit relation, never a road route.
  const stops=selectedIds.map(id=>nodes.find(n=>n.kind==='place'&&n.p.events.some(e=>e.id===id)));
  if(stops.length&&stops.every(Boolean)){
   const chain=[...(origin?[center]:[]),...stops];
   for(let i=1;i<chain.length;i++)if(chain[i-1]!==chain[i])link(chain[i-1],chain[i],'plan');
  }
  // Only link the selected origin to an active place; do not imply road routing.
  for(const n of nodes){
   const g=el('g',{class:`ontology-node ${n.kind}`,tabindex:n.kind==='center'?'-1':'0',role:n.kind==='center'?'img':'button','aria-label':n.kind==='hub'?`${n.label} · ${n.p.members.length} ${t('mapPlaces')} · ${t('graphExpand')}`:n.kind==='place'?`${n.label} · ${n.p.events.length} ${t('categoryEvents')}`:n.label});
   n.element=g;
   g.style.setProperty('--pulse-delay',`${-nodes.indexOf(n)*.21}s`);
   if(n.kind==='place'){const e=n.p.events.find(e=>selectedIds.includes(e.id))||n.p.events[0];g.dataset.node=e.id;g.dataset.place=n.id;g.classList.toggle('planned',n.p.events.some(e=>selectedIds.includes(e.id)));}
   if(n.kind==='cluster')g.dataset.clusterNode=n.id;
   if(n.kind==='hub'){g.dataset.hub=n.p.id;g.setAttribute('aria-expanded','false');}
   g.style.setProperty('--node-color',n.color);
   g.append(el('circle',{class:'ontology-hit',r:n.kind==='center'?0:24/fit}),el('circle',{class:'ontology-halo',r:n.radius+5/fit}),el('circle',{class:'ontology-core',r:n.radius}));
   if(n.kind==='place'&&n.p.media){const clipId='place-clip-'+nodes.indexOf(n);const clip=el('clipPath',{id:clipId});clip.append(el('circle',{r:n.radius}));g.append(clip,el('image',{href:n.p.media,x:-n.radius,y:-n.radius,width:n.radius*2,height:n.radius*2,preserveAspectRatio:'xMidYMid slice','clip-path':`url(#${clipId})`,'pointer-events':'none'}));}
   if(n.kind!=='place'||!n.p.media)g.append(el('text',{class:'ontology-number','text-anchor':'middle',y:4},n.kind==='hub'||n.kind==='cluster'?n.p.members.length:n.kind==='center'?'⌖':({festival:'✦',performance:'♪',exhibition:'▧',experience:'✿'}[n.p.events[0]?.category]||'◈')));
   for(const num of g.querySelectorAll('.ontology-number'))num.style.fontSize=`${16/fit}px`;
   const label=el('text',{class:'ontology-label','text-anchor':'middle',y:n.radius+14/fit},n.label.length>(focused?10:15)?n.label.slice(0,focused?9:14)+'…':n.label);label.style.fontSize=`${10/fit}px`;if(n.kind==='place'){const action=el('text',{class:'ontology-label','text-anchor':'middle',y:-n.radius-8/fit},n.p.activityLabel);action.style.fontSize=`${11/fit}px`;g.append(action);}g.append(label);g.append(el('title',{},n.label));world.append(g);
  }
  for(const n of nodes.filter(n=>n.kind!=='place'))world.append(n.element);
  relax(nodes,viewWidth,viewHeight,120);if(!paused){for(const n of nodes)if(!n.fixed){n.tx=n.x;n.ty=n.y;n.x=viewWidth/2+(n.x-viewWidth/2)*.3;n.y=viewHeight/2+(n.y-viewHeight/2)*.3;}}syncPause();paint();start();
 }
 function transform(){const fit=Math.min(width/viewWidth,height/viewHeight);world.setAttribute('transform',`translate(${width/2+pan.x} ${height/2+pan.y}) scale(${fit*zoom}) translate(${-viewWidth/2} ${-viewHeight/2})`);}
 function paint(){
  transform();for(const n of nodes){n.element.setAttribute('transform',`translate(${n.x.toFixed(2)} ${n.y.toFixed(2)})`);n.element.classList.toggle('active',n.id===selected);}
  for(const e of edges){const {a,b}=e;const cx=(a.x+b.x)/2+(b.y-a.y)*.13,cy=(a.y+b.y)/2-(b.x-a.x)*.13;e.path.setAttribute('d',`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`);const active=b.id===selected||a.id===selected;e.path.classList.toggle('active',active);const q=(tick*.003+e.phase)%1;e.spark.setAttribute('cx',(1-q)**2*a.x+2*(1-q)*q*cx+q*q*b.x);e.spark.setAttribute('cy',(1-q)**2*a.y+2*(1-q)*q*cy+q*q*b.y);e.spark.style.opacity=paused?'0':active?'1':'.42';}
 }
 function animate(){frame=0;if(destroyed||paused||document.hidden||!inView)return;tick++;if(tick%2===0){for(const n of nodes)if(!n.fixed&&!hovering){n.tx+=Math.sin(tick*.008+nodes.indexOf(n))*.035;n.ty+=Math.cos(tick*.006+nodes.indexOf(n))*.035;}if(!hovering)relax(nodes,viewWidth,viewHeight);paint();}frame=requestAnimationFrame(animate);}
 function start(){cancelAnimationFrame(frame);frame=0;if(!paused&&!document.hidden&&!destroyed&&inView)frame=requestAnimationFrame(animate);}
 function focus(id){selected=id;const old=edges.find(e=>e.kind==='origin');if(old){old.path.remove();old.spark.remove();edges=edges.filter(e=>e!==old);}const dest=nodes.find(n=>n.id===id);if(origin&&dest){link(nodes[0],dest,'origin');world.prepend(edges.at(-1).path,edges.at(-1).spark);}paint();}
 function activate(event){if(skipClick){event.stopImmediatePropagation();skipClick=false;return;}const clustered=event.target.closest('[data-cluster-node]');if(clustered){onCluster?.(nodes.find(n=>n.id===clustered.dataset.clusterNode).p.members);return;}const hub=event.target.closest('[data-hub]');if(hub){focused=hub.dataset.hub;onReset?.();build();}}
 svg.addEventListener('pointerover',e=>{if(e.target.closest('.ontology-node'))hovering=true;});
 svg.addEventListener('pointerout',e=>{if(e.target.closest('.ontology-node')&&!e.target.closest('.ontology-node').contains(e.relatedTarget))hovering=false;});
 svg.addEventListener('focusin',()=>{hovering=true;});svg.addEventListener('focusout',()=>{hovering=false;});
 svg.addEventListener('click',activate,true);
 svg.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.dataset.clusterNode){event.preventDefault();onCluster?.(nodes.find(n=>n.id===event.target.dataset.clusterNode).p.members);return;}if(['Enter',' '].includes(event.key)&&event.target.dataset.hub){event.preventDefault();focused=event.target.dataset.hub;onReset?.();build();}});
 function gesture(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};}
 function local(e){const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)*width/r.width,y:(e.clientY-r.top)*height/r.height};}
 svg.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;pointers.set(e.pointerId,local(e));
  if(pointers.size===2){pinch={...gesture(),zoom,pan:{...pan}};drag=null;moved=true;skipClick=true;for(const id of pointers.keys())svg.setPointerCapture(id);return;}
  if(pointers.size>2)return;
  activePointer=e.pointerId;drag={...local(e),pan:{...pan}};moved=false;
 });
 svg.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,local(e));
  if(pinch&&pointers.size>=2){const next=pinchViewport(pinch,gesture(),width,height);zoom=next.zoom;pan=next.pan;build(true);return;}
  if(e.pointerType==='touch'||!drag||e.pointerId!==activePointer)return;const p=local(e),dx=p.x-drag.x,dy=p.y-drag.y;
  if(Math.hypot(dx,dy)>6){moved=true;svg.setPointerCapture(e.pointerId);}if(!moved)return;pan={x:drag.pan.x+dx,y:drag.pan.y+dy};paint();
 });
 function release(e){
  pointers.delete(e.pointerId);if(moved||pinch){skipClick=true;setTimeout(()=>{if(!pointers.size)skipClick=false;},250);}
  pinch=null;drag=null;activePointer=null;
  if(pointers.size===1){const [id,p]=[...pointers][0];activePointer=id;drag={...p,pan:{...pan}};}
 }
 svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);svg.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))release(e);});
 const visibility=()=>{if(document.hidden)cancelAnimationFrame(frame);else start();};document.addEventListener('visibilitychange',visibility);
 const preference=()=>{paused=reduced.matches;syncPause();paint();start();};reduced.addEventListener('change',preference);
 const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)start();else cancelAnimationFrame(frame);});observer.observe(container);
 build();return {focus,destroy(){destroyed=true;observer.disconnect();cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);container.classList.remove('ontology-scene');}};
}
