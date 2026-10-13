// Permanent places are separate from dated events. Null hours/coordinates are
// unknown, never interpreted as open-now or used for automatic itineraries.
export const placeCatalog=[
 {id:'forest-outings-ilsan',topics:['cafes','bakery'],name:'포레스트 아웃팅스 일산',address:'고양시 일산동구 고양대로 1124',source:'https://www.forestoutings.co.kr/default/company/sub01.php',checked:'2026-10-11',hours:null,point:null},
 {id:'gatten-starfield-goyang',topics:['restaurants','dining'],name:'갓덴스시 스타필드 고양',address:'고양시 덕양구 고양대로 1955 · B1',source:'https://www.starfield.co.kr/goyang/tenant/categoryInfo.do',checked:'2026-10-11',hours:null,point:null},
 {id:'mijin-starfield-goyang',topics:['restaurants','dining'],name:'광화문미진 스타필드 고양',address:'고양시 덕양구 고양대로 1955 · 3F',source:'https://www.starfield.co.kr/goyang/tenant/categoryInfo.do',checked:'2026-10-11',hours:null,point:null},
 {id:'starfield-goyang',topics:['destinations','outings'],name:'스타필드 고양',address:'고양시 덕양구 고양대로 1955',source:'https://www.starfield.co.kr/goyang/tenant/categoryInfo.do',checked:'2026-10-11',hours:null,point:null}
];
export const catalogMatches=topic=>placeCatalog.filter(p=>p.topics.includes(topic));
export function renderPlaceCatalog(container,topic,lang){
 const items=catalogMatches(topic);container.replaceChildren();container.hidden=!items.length;
 const copy={ko:['상설 장소','영업시간·휴무·좌표 확인 중 · 오늘 방문 가능 여부는 매장에 확인해 주세요.','공식 안내 ↗'],en:['Permanent places','Hours, closures and coordinates pending verification. Confirm availability with the venue.','Official guide ↗'],ja:['常設スポット','営業時間・休業日・座標を確認中。訪問前に店舗へご確認ください。','公式案内 ↗'],'zh-Hans':['常设场所','营业时间、休息日和坐标待核实。到访前请向商家确认。','官方信息 ↗']}[lang]||[];
 for(const p of items){const card=document.createElement('article');card.className='catalog-place';const title=document.createElement('h3');title.textContent=p.name;const address=document.createElement('p');address.textContent=p.address;const note=document.createElement('small');note.textContent=copy[1];const link=document.createElement('a');link.href=p.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent=copy[2];card.append(title,address,note,document.createElement('br'),link);container.append(card);}
}
