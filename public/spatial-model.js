// Geography and categorical display layers are separate from ranking.
export function geographicPoint(point,origin){
 if(!point||![point.lat,point.lng,origin?.lat,origin?.lng].every(Number.isFinite)||Math.abs(point.lat)>85||Math.abs(origin.lat)>85||Math.abs(point.lng)>180)throw new RangeError('Invalid geographic point');
 const r=Math.PI/180,k=6371*Math.cos(origin.lat*r);
 return {x:k*(point.lng-origin.lng)*r,y:k*(Math.log(Math.tan(Math.PI/4+point.lat*r/2))-Math.log(Math.tan(Math.PI/4+origin.lat*r/2)))};
}
// Fixed display layers, not scores. IDs and raw event classifications stay unchanged.
export const categoryLayers=Object.freeze([
 {id:'unknown',z:.3,color:'#b1b9b3',glyph:'?'},
 {id:'festival',z:1.5,color:'#c9e797',glyph:'✦'},
 {id:'performance',z:3.3,color:'#c5aceb',glyph:'♪'},
 {id:'exhibition',z:5.1,color:'#9bd4dc',glyph:'▧'},
 {id:'experience',z:6.9,color:'#e9bc8e',glyph:'✿'}
].map(Object.freeze));
export function categoryNodes(places){
 return places.flatMap(place=>{
  const groups=new Map();
  for(const event of place.events||[]){
   const id=categoryLayers.some(l=>l.id===event.category)?event.category:'unknown';
   if(!groups.has(id))groups.set(id,[]);
   if(!groups.get(id).some(e=>e.id===event.id))groups.get(id).push(event);
  }
  return categoryLayers.filter(l=>groups.has(l.id)).map(layer=>({
   ...place,events:groups.get(layer.id),layer,nodeId:JSON.stringify([place.id,layer.id])
  }));
 });
}
export function spatialFrame(places,origin){
 const valid=places.filter(p=>Number.isFinite(p.point?.lat)&&Number.isFinite(p.point?.lng)&&Math.abs(p.point.lat)<=85&&Math.abs(p.point.lng)<=180);
 const center=origin||{lat:valid.length?(Math.min(...valid.map(p=>p.point.lat))+Math.max(...valid.map(p=>p.point.lat)))/2:37.63,lng:valid.length?(Math.min(...valid.map(p=>p.point.lng))+Math.max(...valid.map(p=>p.point.lng)))/2:126.79};
 const positioned=valid.map(p=>({...p,xy:geographicPoint(p.point,center)}));
 const extent=Math.max(.5,...positioned.flatMap(p=>[Math.abs(p.xy.x),Math.abs(p.xy.y)]));
 return {center,extent,places:positioned};
}

// Provider categories retain separate display identity from ledger event categories.
export const placeCategoryLayers=Object.freeze([
 {id:'FD6',z:8.7,color:'#efc299',names:['음식점','Food','食事','餐饮']},
 {id:'CE7',z:10.5,color:'#d8bc97',names:['카페','Cafés','カフェ','咖啡']},
 {id:'CT1',z:12.3,color:'#83cbb5',names:['문화시설','Culture','文化施設','文化设施']},
 {id:'AT4',z:14.1,color:'#e9a6bc',names:['관광명소','Sights','観光','景点']},
 {id:'AD5',z:15.9,color:'#a8bce8',names:['숙박','Stay','宿泊','住宿']}
].map(Object.freeze));
export const courseLayer=stop=>(stop.kind==='place'?placeCategoryLayers:categoryLayers).find(l=>l.id===stop.category)||categoryLayers[0];
