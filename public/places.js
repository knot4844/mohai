// The map is an exploration surface. Admission confidence only gates recommendations.
export function eventLocations(event){
 return event?.editorial?.locations?.length?event.editorial.locations:event?.editorial?.point?[{id:event.venues[0].id,name:event.venues[0].name_ko,point:event.editorial.point}]:[];
}
export function groupEventLocations(events){
 const groups=new Map();
 for(const event of events)for(const place of eventLocations(event)){
  const key=place.id||`${place.point.lat},${place.point.lng}`;
  if(!groups.has(key))groups.set(key,{...place,events:[]});
  if(!groups.get(key).events.some(e=>e.id===event.id))groups.get(key).events.push(event);
 }
 return [...groups.values()];
}
// Merge screen-near facilities without dropping any event or facility identity.
export function clusterPlaces(groups,project,gap=54){
 const clusters=groups.map(g=>({members:[g],...project(g.point)}));
 const update=c=>{c.x=c.members.reduce((v,g)=>v+project(g.point).x,0)/c.members.length;c.y=c.members.reduce((v,g)=>v+project(g.point).y,0)/c.members.length;c.point={lat:c.members.reduce((v,g)=>v+g.point.lat,0)/c.members.length,lng:c.members.reduce((v,g)=>v+g.point.lng,0)/c.members.length};};
 let changed=true;while(changed){changed=false;outer:for(let i=0;i<clusters.length;i++)for(let j=i+1;j<clusters.length;j++)if(Math.hypot(clusters[i].x-clusters[j].x,clusters[i].y-clusters[j].y)<gap){clusters[i].members.push(...clusters[j].members);update(clusters[i]);clusters.splice(j,1);changed=true;break outer;}}
 for(const c of clusters)update(c);return clusters;
}
