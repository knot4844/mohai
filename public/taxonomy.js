// Stable semantic IDs; independent of maps, locale, region and source event format.
export const taxonomyVersion=2;
const labels=(ko,en,ja,zh)=>({ko,en,ja,'zh-Hans':zh});
const node=(id,parent,...copy)=>({id,parent,labels:labels(...copy)});
export const topics=[
node('festivals',null,'축제·행사','Festivals','祭り・イベント','节庆活动'),
node('seasonal','festivals','꽃·계절 축제','Flowers & seasons','花・季節の祭り','花卉与季节'),
node('local','festivals','지역 축제','Local festivals','地域の祭り','地方节庆'),
node('night','festivals','야간 행사','Night events','夜間イベント','夜间活动'),
node('youth','festivals','청소년 행사','Youth events','青少年イベント','青少年活动'),
node('shows',null,'공연·음악','Shows & music','公演・音楽','演出与音乐'),
node('classical','shows','클래식·성악','Classical & vocals','クラシック・声楽','古典与声乐'),
node('concert','shows','콘서트·라이브','Concerts & live music','コンサート・ライブ','演唱会与现场音乐'),
node('musical','shows','뮤지컬','Musicals','ミュージカル','音乐剧'),
node('stage','shows','연극·퍼포먼스','Theatre & performance','演劇・パフォーマンス','戏剧与表演'),
node('camping-fair','exhibitions','캠핑·레저 박람회','Camping & leisure fairs','キャンプ・レジャー博覧会','露营与休闲展'),
node('exhibitions',null,'전시·박람회','Exhibitions & fairs','展示・博覧会','展览与博览会'),
node('general-exhibition','exhibitions','전시·박람회 일반','Other exhibitions & fairs','展示・博覧会全般','展览与博览会综合'),
node('art','exhibitions','미술·기획전','Art exhibitions','美術・企画展','美术与策展'),
node('parenting-fair','exhibitions','육아·교육 박람회','Parenting & education fairs','育児・教育博覧会','育儿与教育展'),
node('food-fair','exhibitions','식음료 박람회','Food & drink fairs','飲食の博覧会','食品与饮品展'),
node('experiences',null,'체험·배움','Activities & learning','体験・学び','体验与学习'),
node('craft','experiences','공예·만들기','Arts & crafts','工作・ものづくり','手工制作'),
node('digital','experiences','디지털·미디어','Digital & media','デジタル・メディア','数字与媒体'),
node('gardening','experiences','농사·가드닝','Farming & gardening','農業・園芸','农耕与园艺'),
node('learning','experiences','인문·교양 수업','Humanities & learning','教養講座','人文与通识'),
node('sports','experiences','스포츠·야외 활동','Sports & outdoor activities','スポーツ・野外活動','体育与户外活动'),
node('books',null,'책·문화','Books & culture','本・文化','书籍与文化'),
node('reading','books','독서·그림책','Reading & picture books','読書・絵本','阅读与绘本'),
node('writing','books','글쓰기','Writing','文章を書く','写作'),
node('author-talk','books','작가와의 만남','Author talks','作家との出会い','作家交流'),
node('language','books','외국어·영어그림책','Languages & English books','外国語・英語絵本','外语与英语绘本'),
node('nature-history',null,'자연·역사','Nature & heritage','自然・歴史','自然与历史'),
node('ecology','nature-history','생태·환경','Ecology & environment','生態・環境','生态与环境'),
node('heritage','nature-history','역사·문화유산','History & heritage','歴史・文化遺産','历史与文化遗产'),
node('cafes',null,'카페','Cafés','カフェ','咖啡馆'),
node('bakery','cafes','베이커리·디저트','Bakery & desserts','ベーカリー・デザート','烘焙与甜点'),
node('restaurants',null,'식당','Restaurants','レストラン','餐厅'),
node('dining','restaurants','식사·맛집','Dining','食事','美食'),
node('destinations',null,'가볼 만한 곳','Places to visit','お出かけスポット','值得去的地方'),
node('outings','destinations','산책·문화공간','Walks & culture','散策・文化施設','散步与文化空间')
];
export const audiences=[
node('adult',null,'성인 대상 프로그램','Adult programmes','成人向け講座','成人项目'),
node('family',null,'어린이·가족 주제','Children & family themes','子ども・家族向けテーマ','儿童与家庭主题'),
node('teen',null,'청소년 주제','Teen themes','青少年向けテーマ','青少年主题'),
node('parent',null,'양육자·임신부 주제','Parenting & pregnancy themes','育児・妊娠のテーマ','育儿与孕期主题')
];
export const topicLabel=(id,lang='ko')=>topics.find(n=>n.id===id)?.labels[lang]||id;
export function matchesTopic(event,id='all'){return id==='all'||(event.editorial?.classification?.topics||[]).some(tag=>tag===id||topics.find(n=>n.id===tag)?.parent===id);}
export function matchesAudience(event,id='all'){return id==='all'||(event.editorial?.classification?.audiences||[]).includes(id);}
