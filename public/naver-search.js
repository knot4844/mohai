import {safeDetailURL} from './day-course-model.js';

// Only use region words present in a returned address. Never infer the user's city.
export function nearbyFoodQuery(places){
 const address=places?.find(p=>typeof p.address==='string'&&p.address.trim())?.address;
 if(!address)return null;
 const parts=address.trim().split(/\s+/),region=parts.slice(0,2);
 if(parts[2]&&/[구군읍면동]$/.test(parts[2]))region.push(parts[2]);
 return region.length===2||region.length===3?region.join(' ')+' 음식점':null;
}
const copy={
 ko:{title:'네이버 지역 검색',hint:'검색어 기준 · 네이버 순서 그대로 최대 5건. 현재 위치 반경·거리순 결과가 아닙니다. 영업·예약 여부는 별도 확인하세요.',placeholder:'예: 일산 음식점',search:'네이버 검색',loading:'네이버 검색 중…',error:'검색하지 못했습니다. 다시 시도해 주세요.',empty:'검색 결과가 없습니다.',ready:'지역명이나 음식점 이름을 입력해 검색하세요.',missing:'네이버 검색 연결 준비 중입니다.',auto:'카카오 음식점 주소의 지역명으로 검색',manual:'직접 입력한 검색어',source:'네이버에서 보기',details:'업체 링크',time:'조회 시각'},
 en:{title:'NAVER local search',hint:'Keyword search · Up to 5 results in NAVER order, not radius or distance order. Check hours and reservations separately.',placeholder:'e.g. 일산 음식점',search:'Search NAVER',loading:'Searching NAVER…',error:'Search failed. Please retry.',empty:'No results.',ready:'Enter an area or restaurant name.',missing:'NAVER search is not connected.',auto:'Search using the area in a Kakao restaurant address',manual:'Your search keyword',source:'View on NAVER',details:'Business link',time:'Retrieved at'},
 ja:{title:'NAVER 地域検索',hint:'キーワード検索 · NAVERの順序で最大5件。現在地の半径・距離順ではありません。営業時間や予約は別途ご確認ください。',placeholder:'例: 일산 음식점',search:'NAVERで検索',loading:'NAVERで検索中…',error:'検索に失敗しました。再試行してください。',empty:'結果がありません。',ready:'地域名または店名を入力してください。',missing:'NAVER検索は準備中です。',auto:'カカオの店舗住所の地域名で検索',manual:'入力したキーワード',source:'NAVERで見る',details:'店舗リンク',time:'取得日時'},
 'zh-Hans':{title:'NAVER 地区搜索',hint:'关键词搜索 · 按NAVER顺序最多5条。并非当前位置半径或距离排序。营业和预约情况请另行确认。',placeholder:'例: 일산 음식점',search:'搜索NAVER',loading:'正在搜索NAVER…',error:'搜索失败，请重试。',empty:'没有结果。',ready:'请输入地区或餐厅名称。',missing:'NAVER搜索尚未连接。',auto:'使用Kakao餐厅地址中的地区名称搜索',manual:'输入的关键词',source:'在NAVER查看',details:'商家链接',time:'查询时间'}
};
// Allow provider highlighting, but never render arbitrary provider HTML.
function providerText(node,value){
 const doc=new DOMParser().parseFromString(String(value??''),'text/html');
 function append(parent,child){
  if(child.nodeType===3){parent.append(document.createTextNode(child.textContent));return;}
  if(child.nodeType!==1)return;
  if(['SCRIPT','STYLE','IFRAME'].includes(child.tagName))return;
  const target=child.tagName==='B'?document.createElement('b'):parent;
  for(const inner of child.childNodes)append(target,inner);
  if(target!==parent)parent.append(target);
 }
 for(const child of doc.body.childNodes)append(node,child);
}
export function createNaverSearch(root){
 let context={},key='',generation=0,controller=null,query='',response=null,busy=false,failed=false,automatic=false,signature='';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function clear(){generation++;controller?.abort();controller=null;query='';response=null;busy=false;failed=false;automatic=false;draw();}
 function draw(){
  const next=JSON.stringify([context.lang,context.enabled,query,response,busy,failed,automatic]);if(next===signature)return;signature=next;
  const t=copy[context.lang]||copy.en;root.replaceChildren();root.append(el('h3',t.title),el('small',t.hint));
  const form=el('form'),input=el('input'),button=el('button',t.search);form.className='naver-search-form';input.type='search';input.maxLength=100;input.value=query;input.placeholder=t.placeholder;input.setAttribute('aria-label',t.title);input.required=true;button.type='submit';button.disabled=busy||!context.enabled;
  form.onsubmit=e=>{e.preventDefault();if(input.value.trim())search(input.value.trim(),false);};form.append(input,button);root.append(form);
  const status=el('p',!context.enabled?t.missing:busy?t.loading:failed?t.error:response&&!response.result.items.length?t.empty:!response?t.ready:'');status.setAttribute('role','status');root.append(status);
  if(!response)return;
  root.append(el('small',`${automatic?t.auto:t.manual}: ${query}`));
  if(Number.isFinite(Date.parse(response.fetchedAt)))root.append(el('small',`${t.time}: ${new Intl.DateTimeFormat(context.lang,{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Seoul'}).format(new Date(response.fetchedAt))} KST`));
  const source=el('a',t.source);source.href='https://search.naver.com/search.naver?where=nexearch&query='+encodeURIComponent(query);source.target='_blank';source.rel='noopener noreferrer';root.append(source);
  const list=el('ol');list.className='naver-results';
  for(const item of response.result.items.slice(0,5)){
   const row=el('li'),name=el('strong');providerText(name,item.title);row.append(name,el('small',item.category),el('p',item.roadAddress||item.address));
   if(item.description){const description=el('p');providerText(description,item.description);row.append(description);}
   const url=safeDetailURL(item.link);if(url){const a=el('a',t.details);a.href=url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);}list.append(row);
  }root.append(list);
 }
 async function search(value,auto=false){
  if(!context.enabled||!value?.trim())return;
  controller?.abort();controller=new AbortController();const token=++generation;query=value.trim().slice(0,100);automatic=auto;response=null;failed=false;busy=true;draw();
  try{const r=await fetch('/api/naver/local',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,body:JSON.stringify({query})});if(!r.ok)throw Error();const body=await r.json();if(!Array.isArray(body.result?.items)||body.result.items.some(x=>!x||typeof x.title!=='string'))throw Error();if(token===generation)response=body;}
  catch{if(token===generation)failed=true;}finally{if(token===generation){busy=false;draw();}}
 }
 return {clear,search,update(next){const nextKey=JSON.stringify([next.origin?.point?.lat,next.origin?.point?.lng,next.date]);context=next;if(nextKey!==key){key=nextKey;clear();}else draw();}};
}
