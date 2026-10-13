import {geographicLayout,pinchViewport} from './ontology-motion.js';
import {clusterPlaces} from './places.js';

// Force Graph owns the canvas and moving edges. Accessible HTML photo nodes
// share its coordinates. Geographic anchors never enter a free-force layout.
export function mountPhotoGraph(container,{places,width,height,t,origin,selectedIds=[],courseStops=[],onReset,onCluster,onPlace,onLeave,memory={}}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let expandedCluster=null;
 let paused=memory.paused??reduced.matches,selected=null,destroyed=false,inView=true;
 let zoom=1,pan={x:0,y:0},nodes=[],links=[],pinch=null,drag=null,moved=false;
 const pointers=new Map();
 container.replaceChildren();container.classList.add('ontology-scene','photo-graph');
 const canvas=document.createElement('div');canvas.className='photo-graph-canvas';
 const overlay=document.createElement('div');overlay.className='photo-graph-nodes';container.append(canvas,overlay);
 const graph=new window.ForceGraph(canvas).width(width).height(height).backgroundColor('transparent')
  .enableNodeDrag(false).enableZoomInteraction(false).enablePanInteraction(false)
  .enablePointerInteraction(false).nodeCanvasObject(()=>{})
  .linkColor(l=>l.target.id===selected||l.source.id===selected?'#efc38a':'#8fbba66b')
  .linkWidth(l=>l.target.id===selected?2:1).linkCurvature(.12)
  .linkDirectionalParticles(l=>paused?0:l.target.id===selected?4:2)
  .linkDirectionalParticleWidth(2.5).linkDirectionalParticleSpeed(.003)
  .linkDirectionalParticleColor(()=> '#f0d5a5').cooldownTicks(0);
 const heading=document.createElement('div');heading.className='ontology-heading';
 const title=document.createElement('strong');title.textContent=t('graphTitle');
 const count=document.createElement('small');count.textContent=places.length?`${places.length} ${t('mapPlaces')} · ${t('graphSelectPlace')}`:t('noVisitableEvents');heading.append(title,count);
 const compass=document.createElement('div');compass.className='ontology-compass';compass.textContent='N ↑ · W ← → E · S ↓';
 const controls=document.createElement('div');controls.className='ontology-controls';
 function button(text,label,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.onclick=action;controls.append(b);return b;}
 button('+',t('graphZoomIn'),()=>{zoom=Math.min(8,zoom*1.3);build();});
 button('−',t('graphZoomOut'),()=>{zoom=Math.max(.6,zoom/1.3);build();});
 button('⊙',t('graphFit'),()=>{expandedCluster=null;zoom=1;pan={x:0,y:0};onReset?.();build();});
 const pause=button('Ⅱ',t('graphPause'),()=>{paused=!paused;sync();});
 const legend=document.createElement('div');legend.className='ontology-legend';legend.textContent=t('graphRelation');
 container.append(heading,compass,controls,legend);
 function sync(){memory.paused=paused;pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',t(paused?'graphPlay':'graphPause'));pause.setAttribute('aria-pressed',String(paused));container.classList.toggle('motion-paused',paused);graph.linkDirectionalParticles(l=>paused?0:l.target.id===selected?4:2);if(paused||document.hidden||!inView)graph.pauseAnimation();else graph.resumeAnimation();}
 function build(){
  overlay.replaceChildren();const project=geographicLayout([...places,...courseStops],origin,width,height);
  const positioned=p=>{const q=project(p);return {x:(q.x-width/2)*zoom+pan.x,y:(q.y-height/2)*zoom+pan.y};};
  const clusters=clusterPlaces(places,positioned,94);
  nodes=[{id:'origin',x:pan.x,y:pan.y,fx:pan.x,fy:pan.y,origin:true}];
  const expandedExists=clusters.some(c=>'cluster:'+c.members.map(p=>p.id).join(',')===expandedCluster);
  if(!expandedExists)expandedCluster=null;
  for(const c of clusters){
   if(expandedCluster&&'cluster:'+c.members.map(p=>p.id).join(',')!==expandedCluster)continue;
   const p=c.members[0],key='cluster:'+c.members.map(p=>p.id).join(',');
   if(c.members.length>1&&expandedCluster===key){
    // Spiderfy is an interaction layout, not a change to the stored geography.
    const radius=Math.max(105,c.members.length*90/(2*Math.PI));
    const cx=Math.max(-width/2+radius+42,Math.min(width/2-radius-42,c.x));
    const cy=Math.max(-height/2+radius+90,Math.min(height/2-radius-65,c.y));
    for(const [i,member] of c.members.entries()){
     const angle=-Math.PI/2+i*Math.PI*2/c.members.length,x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;
     nodes.push({id:member.id,x,y,fx:x,fy:y,members:[member],p:member,expanded:true});
    }
   }else nodes.push({id:c.members.length>1?key:p.id,x:c.x,y:c.y,fx:c.x,fy:c.y,members:c.members,p});
  }
  links=nodes.slice(1).map(n=>({source:'origin',target:n.id}));
  graph.graphData({nodes,links}).centerAt(0,0).zoom(1);
  for(const n of nodes){
   const b=document.createElement(n.origin?'div':'button');b.className='photo-graph-node'+(n.origin?' photo-graph-origin':'')+(n.expanded?' photo-graph-expanded':'');
   b.style.left=`${width/2+n.x}px`;b.style.top=`${height/2+n.y}px`;b.style.setProperty('--delay',`${-nodes.indexOf(n)*.7}s`);
   if(n.origin){b.textContent='⌖';b.setAttribute('aria-label',origin?.name||t('graphToday'));const label=document.createElement('span');label.textContent=origin?.name||t('graphToday');b.append(label);}
   else{
    b.type='button';b.setAttribute('aria-label',n.members.length>1?`${n.members.length} ${t('nearbyPlaces')}`:n.p.displayTitle||n.p.name);
    const visual=document.createElement('span');visual.className='photo-graph-visual';
    const media=n.members.find(p=>p.media)?.media;
    if(media){const img=document.createElement('img');img.src=media;img.alt='';img.draggable=false;img.onerror=()=>{img.remove();visual.classList.add('photo-graph-fallback');visual.textContent='✦';};visual.append(img);}
    else{visual.classList.add('photo-graph-fallback');visual.textContent=({festival:'✦',performance:'♪',exhibition:'▧',experience:'✿'}[n.p.events[0]?.category]||'◈');}
    const label=document.createElement('span');label.className='photo-graph-label';label.textContent=n.members.length>1?`${n.members.length} ${t('nearbyPlaces')}`:n.p.displayTitle||n.p.name;
    if(n.members.length===1&&n.p.distanceLabel){const distance=document.createElement('small');distance.textContent=n.p.distanceLabel;label.append(distance);}b.append(visual,label);
    if(n.members.length>1){const badge=document.createElement('span');badge.className='photo-graph-badge';badge.textContent=n.members.length;b.append(badge);}
    const activate=pin=>{if(n.members.length>1){if(pin){expandedCluster=n.id;onReset?.();build();}return;}const e=n.p.events.find(e=>selectedIds.includes(e.id))||n.p.events[0];onPlace?.(e.id,pin,n.p.id);};
    b.onclick=()=>{if(!moved)activate(true);};b.onpointerenter=e=>{if(e.pointerType==='mouse')activate(false);};b.onpointerleave=()=>onLeave?.();b.onfocus=()=>activate(false);
   }
   n.element=b;overlay.append(b);
  }
  if(courseStops.length){
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('flat-course-path');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('aria-label',t('lineNote'));
   const coords=[origin?.point,...courseStops.map(s=>s.point)].filter(Boolean).map(p=>positioned(p));const line=document.createElementNS(ns,'polyline');line.setAttribute('points',coords.map(p=>`${width/2+p.x},${height/2+p.y}`).join(' '));svg.append(line);overlay.append(svg);
   courseStops.forEach((stop,i)=>{const q=positioned(stop.point),badge=document.createElement('span');badge.className='flat-course-stop';badge.textContent=`${i+1}. ${stop.name}`;badge.title=stop.name;badge.style.left=`${width/2+q.x}px`;const stack=courseStops.slice(0,i).filter(s=>s.point.lat===stop.point.lat&&s.point.lng===stop.point.lng).length;badge.style.top=`${height/2+q.y-24-stack*25}px`;overlay.append(badge);});
  }
  legend.textContent=t(expandedCluster?'graphSpreadHint':'graphRelation');focus(selected);sync();
 }
 function focus(id){selected=id;for(const n of nodes)n.element?.classList.toggle('active',n.id===id);graph.linkColor(l=>l.target.id===selected||l.source.id===selected?'#efc38a':'#8fbba66b');}
 function local(e){const r=container.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 function gesture(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};}
 function down(e){if(e.button!==0||e.target.closest('.ontology-controls'))return;pointers.set(e.pointerId,local(e));moved=false;if(pointers.size===2){pinch={...gesture(),zoom,pan:{...pan}};drag=null;}else drag={...local(e),pan:{...pan}};}
 function move(e){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,local(e));if(pinch&&pointers.size>=2){const next=pinchViewport(pinch,gesture(),width,height);zoom=next.zoom;pan=next.pan;moved=true;build();return;}if(e.pointerType==='touch'||!drag)return;const p=local(e),dx=p.x-drag.x,dy=p.y-drag.y;if(Math.hypot(dx,dy)>6){moved=true;pan={x:drag.pan.x+dx,y:drag.pan.y+dy};build();}}
 function up(e){pointers.delete(e.pointerId);pinch=null;drag=null;}
 container.addEventListener('pointerdown',down);container.addEventListener('pointermove',move);window.addEventListener('pointerup',up);container.addEventListener('pointercancel',up);
 // Only two-finger gestures are consumed; a one-finger swipe remains page scroll.
 function touch(e){if(e.touches.length>=2)e.preventDefault();}
 container.addEventListener('touchmove',touch,{passive:false});
 const visibility=()=>sync(),preference=()=>{paused=reduced.matches;sync();};document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);
 const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();});observer.observe(container);
 build();return {focus,destroy(){if(destroyed)return;destroyed=true;observer.disconnect();graph._destructor();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);container.removeEventListener('pointerdown',down);container.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);container.removeEventListener('pointercancel',up);container.removeEventListener('touchmove',touch);container.classList.remove('ontology-scene','photo-graph');}};
}
