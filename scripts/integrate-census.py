"""Build source-bound review overrides and additions; never renew source check timestamps."""
import json,pathlib,hashlib,copy,datetime
R=pathlib.Path(__file__).resolve().parents[1]
load=lambda p:json.load(open(p))
write=lambda p,x:p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
x=load(R/'data/census-input.json');base=load('/Users/dyl/mohae-data/events.json')['events'];byid={e['id']:e for e in base}
old=load(R/'data/verification-before-census.json');reviews=copy.deepcopy(old);classes=load(R/'data/classifications.json');additions=[]
FIELDS=['dates','hours','venue','fee','reservation','conditions','liveAvailability','entrance','languages']
def digest(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def merge(a,b):
 for k,v in b.items():
  if isinstance(v,dict) and isinstance(a.get(k),dict):merge(a[k],v)
  else:a[k]=copy.deepcopy(v)
 return a
def generic_summaries(e):
 a,b=e['schedule']['start_date'],e['schedule']['end_date'];v=e['venues'][0]['name_ko']
 return {'ko':f'{a}~{b}, {v}. 회차·요금·신청 조건은 아래의 공식 자료 대조 결과를 확인하세요.','en':f'{a}–{b}. Venue (Korean): {v}. See the checked schedule, fees and registration conditions below.','ja':f'{a}～{b}。会場（韓国語）：{v}。確認した日程・料金・申込条件は以下をご覧ください。','zh-Hans':f'{a}至{b}。场地（韩文）：{v}。请查看下方已核对的时间、费用及报名条件。'}
def sources_for(r):
 rows=[]
 for f in r.get('verified_fields',[]):
  if f not in FIELDS:continue
  fe=r.get('field_evidence',{}).get(f,{})
  url=fe.get('url') or r.get('source_url')
  if not url:continue
  row=next((z for z in rows if z['url']==url),None)
  if not row:row={'url':url,'fields':[],'checked_at':fe.get('checked_at') or r['checked_at'],'method':fe.get('method') or r.get('method','official_page_text_review')};rows.append(row)
  row['fields'].append(f)
 return rows
def review_event(e,records,isnew=False):
 eid=e['id'];previous=copy.deepcopy(reviews.get(eid,{}));p=copy.deepcopy(previous.get('patch',{}));sources=copy.deepcopy(previous.get('sources',[]))
 for s in sources:s.setdefault('checked_at',previous.get('checked_at'));s.setdefault('method','official_page_text_review')
 good=[r for r in records if r.get('outcome')=='reviewed' and r.get('checked_at')]
 if not good:
  previous.setdefault('source_version',e['source_version']);previous.setdefault('method','not_rechecked');previous.setdefault('verified_fields',[]);previous.setdefault('unknown_fields',FIELDS);previous.setdefault('sources',[])
  previous['latest_attempts']=[{'outcome':r.get('outcome'),'attempted_at':r.get('attempted_at'),'url':r.get('source_url'),'note_ko':r.get('notes_ko','')} for r in records];previous['review_blocked']=True
  reviews[eid]=previous;return
 notes=[];ed=copy.deepcopy(previous.get('editorial',{}))
 for r in good:
  if r.get('source_version') and r['source_version']!=e['source_version']:raise ValueError('Source mismatch '+eid)
  merge(p,r.get('patch',{}))
  if r.get('event') and eid.endswith('826a8820f5233d3c'):
   p['venues']=r['event']['venues'];p['publication_status']='research';p['translations']=copy.deepcopy(r['event']['translations'])
   for tr in p['translations'].values():tr['source_version']=e['source_version']
  if r.get('venue_detail'):ed['venueDetail']=r['venue_detail']
  sources+=sources_for(r);notes.append(r.get('notes_ko',''))
 current=merge(copy.deepcopy(e),p)
 # Do not label an unknown value checked just because its source page was read.
 known=set(f for s in sources for f in s['fields'])
 if not current.get('price') or current['price'].get('kind')=='unknown' or current['price'].get('kind')=='paid' and current['price'].get('min') is None:known.discard('fee')
 if not current.get('reservation'):known.discard('reservation')
 if not current.get('visitor_access',{}).get('notes_ko'):known.discard('conditions')
 if not current['schedule'].get('sessions') and not current['schedule'].get('raw_ko'):known.discard('hours')
 known-=set(['liveAvailability','entrance','languages'])
 for s in sources:s['fields']=[f for f in s['fields'] if f in known]
 sources=[s for s in sources if s['fields']]
 latest=max(r['checked_at'] for r in good);oldest=min([s['checked_at'] for s in sources] or [latest])
 expiry=(datetime.datetime.fromisoformat(oldest)+datetime.timedelta(hours=24)).isoformat(timespec='seconds')
 methods=sorted(set(r.get('method','official_page_text_review') for r in good))
 conflict=any(r.get('conflict',False) for r in good)
 summaries=previous.get('summaries') if eid.endswith(('18a6121854d03004','7fc1dd01588bf4d0')) else generic_summaries(current)
 reviews[eid]={'source_version':e['source_version'],'checked_at':latest,'recheck_after':expiry,'method':'official_page_text_review','source_methods':methods,'sources':sources,'verified_fields':[f for f in FIELDS if f in known],'unknown_fields':[f for f in FIELDS if f not in known],'notes_ko':' '.join(dict.fromkeys([previous.get('notes_ko','')]+notes)).strip(),'additional_unknowns':list(dict.fromkeys(f for r in good for f in r.get('unknown_fields',[]) if f not in FIELDS)),'admission':good[-1].get('admission','unknown'),'conflict':conflict,'patch':p,'editorial':ed,'summaries':summaries or generic_summaries(current)}
 if any('list' in m or 'cached' in m for m in methods):reviews[eid]['cached_source']=True
 return current
for group in x['reviews']:
 e=byid[group['existing_id']];review_event(e,[r['record'] for r in group['records']])
# Preserve unresolved base holds; only explicit promotion with confirmed date/venue is public.
for group in x['new_events']:
 if group['integration_status']=='hold':continue
 chosen=group['records'][-1];r=chosen['record'];e=copy.deepcopy(r.get('event',r.get('patch',r)))
 if '_review' in e: rr=e.pop('_review')
 else:rr=copy.deepcopy(r)
 e={k:v for k,v in e.items() if not k.startswith('_')}
 parent=r.get('_parent_event_title') or r.get('event',{}).get('_parent_event_title')
 if parent:e['parent_event_title']=parent
 if '스페인 미술 거장전' in e['title_ko']:
  e['price'].update(kind='mixed',min=None,max=None);e['price']['raw_ko']+=' 이후 요금은 미확인.'
 e.setdefault('id','mohae-goyang-'+digest([e['title_ko'],e['schedule']['start_date'],e['venues'][0]['name_ko']])[:16])
 e.setdefault('source_version','sha256:'+digest(e));e.setdefault('onsite_languages',None);e.setdefault('summary_ko',r.get('notes_ko',''))
 e.setdefault('translations',copy.deepcopy(r.get('translations',{})))
 for l,t in e['translations'].items():t['source_version']=e['source_version'];t['status']='ai_draft'
 e.setdefault('last_verified_at',rr['checked_at']);e.setdefault('publication_status','research')
 e.setdefault('evidence',[{'source_id':'source-'+digest(rr['source_url'])[:12],'url':rr['source_url'],'fields':rr['verified_fields'],'checked_at':rr['checked_at'],'note_ko':rr.get('notes_ko','')}])
 rr.pop('source_version',None);rr['patch']={}
 review_event(e,[rr],True)
 # Use authored multilingual new summaries rather than replacing them with generic text.
 reviews[e['id']]['summaries']={l:t['summary'] for l,t in e['translations'].items()}
 if '고카프' in e['title_ko']:reviews[e['id']]['editorial']['lastEntry']=1050
 if '스페인 미술 거장전' in e['title_ko']:reviews[e['id']]['editorial']['lastEntry']=1020
 additions.append(e)
 title=e['title_ko'];category=e['category']
 topic= ('youth' if '청소년' in title else 'local') if category=='festival' else ('art' if '미술' in title else 'food-fair' if '카페' in title else 'art') if category=='exhibition' else ('stage' if '발레' in title else 'concert' if any(w in title for w in ['밴드','윤종신','토크']) else 'classical') if category=='performance' else ('heritage' if any(w in title for w in ['왕릉','서오릉','제향','능침']) else 'digital' if any(w in title for w in ['AI','스마트폰','3D','드론']) else 'craft' if any(w in title for w in ['각인','전사','만들기']) else 'ecology' if any(w in title for w in ['환경','열매','씨앗']) else 'reading' if any(w in title for w in ['독서','그림책','문학','책놀이터']) else 'learning')
 # GOCAF is an outdoor/camping exhibition, not an art exhibition; omit inaccurate leaf.
 assigned=['camping-fair'] if '고카프' in title else [topic]
 classes[e['id']]={'version':1,'topics':assigned,'audiences':[],'source_title':title,'source_version':e['source_version'],'evidence_urls':[rr['source_url']],'basis':'editorial_source_title_venue_notes','review_note_ko':'공식 행사명과 안내에 기반한 분류; 참여 연령은 별도 확인.'}
# Specific corrections extracted in detail notes; do not infer unlisted sessions.
eid='mohae-goyang-d0a8c0c479f3051d';reviews[eid]['patch']['price']={'kind':'paid','currency':'KRW','min':20000,'max':20000,'raw_ko':'수강료 20,000원; 별도 결제 완료 필요'}
reviews[eid]['patch'].setdefault('schedule',copy.deepcopy(byid[eid]['schedule']))['exceptions']=[{'date':'2026-11-11','status':'closed','note_ko':'공식 상세 휴강일'}]
eid='mohae-goyang-f2e18bd4e7766a61';s=copy.deepcopy(byid[eid]['schedule']);s['sessions']=[{'start':'2026-11-04T16:00:00+09:00','end':'2026-11-04T16:40:00+09:00','status':'scheduled'}];s['raw_ko']='매월 첫 수요일, 6·8월 휴강. 조사기간 내 11/4 16:00~16:40';s['verified_window']={'start':'2026-10-09','end':'2026-11-05'};reviews[eid]['patch']['schedule']=s
eid='mohae-goyang-826a8820f5233d3c'
classes[eid]={'version':1,'topics':['seasonal'],'audiences':[],'source_title':byid[eid]['title_ko'],'source_version':byid[eid]['source_version'],'evidence_urls':[reviews[eid]['sources'][0]['url']],'basis':'editorial_source_title_venue_notes'}
write(R/'data/additional-events.json',additions);write(R/'data/verification.json',reviews);write(R/'data/classifications.json',classes)
write(R/'data/census-audit.json',{'scope':x['scope'],'complete_census':False,'counts':x['counts'],'source_audit':x['source_audit'],'holds':x['holds'],'excluded':x['excluded'],'notes':x['count_notes']})
print('additional events',len(additions),'review records',len(reviews),'new IDs unique',len(set(e['id'] for e in additions)))
