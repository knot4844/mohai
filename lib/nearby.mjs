export const nearbyCategories=Object.freeze({FD6:'음식점',CE7:'카페',CT1:'문화시설',AT4:'관광명소',AD5:'숙박'});
const validPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>=33&&p.lat<=39&&p.lng>=124&&p.lng<=132;
export async function searchNearby(body,env=process.env,fetcher=fetch){
 const {point,category,radius=3000,bounds}=body||{};
 if(!validPoint(point)||!Object.hasOwn(nearbyCategories,category)||![1000,3000,5000].includes(radius))return [400,{error:'invalid_input'}];
 if(bounds&&(![bounds.west,bounds.south,bounds.east,bounds.north].every(Number.isFinite)||bounds.west < -180||bounds.east > 180||bounds.south < -85||bounds.north > 85||bounds.west>=bounds.east||bounds.south>=bounds.north||point.lng<bounds.west||point.lng>bounds.east||point.lat<bounds.south||point.lat>bounds.north))return [400,{error:'invalid_input'}];
 if(!env.KAKAO_REST_API_KEY)return [503,{error:'nearby_not_configured'}];
 const url=new URL('https://dapi.kakao.com/v2/local/search/category.json');
 for(const [k,v]of Object.entries({category_group_code:category,x:point.lng,y:point.lat,radius,sort:'distance',size:15,page:1}))url.searchParams.set(k,String(v));
 if(bounds){url.searchParams.delete('radius');url.searchParams.set('rect',[bounds.west,bounds.south,bounds.east,bounds.north].join(','));}
 try{
  const r=await fetcher(url,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`},signal:AbortSignal.timeout(10000)});
  if(!r.ok)return [502,{error:'nearby_provider_unavailable'}];
  const j=await r.json();if(!Array.isArray(j.documents))return [502,{error:'invalid_provider_response'}];
  const seen=new Set(),places=[];
  for(const p of j.documents){const point={lat:Number(p.y),lng:Number(p.x)};if(!p.id||!p.place_name||!p.x||!p.y||!validPoint(point)||seen.has(String(p.id)))continue;seen.add(String(p.id));
   if(bounds&&(point.lng<bounds.west||point.lng>bounds.east||point.lat<bounds.south||point.lat>bounds.north))continue;
   places.push({id:`kakao:${p.id}`,kind:'place',provider:'kakao',providerId:String(p.id),name:String(p.place_name),category,categoryName:String(p.category_name||nearbyCategories[category]),point,address:String(p.road_address_name||p.address_name||''),url:`https://place.map.kakao.com/${encodeURIComponent(p.id)}`,hours:null,availability:'unknown'});
  }
  return [200,{places,source:'Kakao Local',fetchedAt:new Date().toISOString(),hasMore:j.meta?.is_end===false,radius,category}];
 }catch{return [502,{error:'nearby_provider_unavailable'}];}
}
