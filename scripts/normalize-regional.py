"""Normalize a reviewed regional survey without modifying the earlier Goyang corpus.

Input: data/regional-input.json, an audited snapshot of researchers' source records.
Never invent opening sessions, geocode from an event title, or renew check timestamps.
"""
import json, pathlib, hashlib, datetime, re
R = pathlib.Path(__file__).resolve().parents[1]
FIELDS = ['dates','hours','venue','fee','reservation','conditions','liveAvailability','entrance','languages']
LOCALES = ['ko','en','ja','zh-Hans']
WINDOW = json.loads((R/'data/research-window.json').read_text())
GOYANG_PLACES = {p['name']:p for p in json.loads((R/'data/venue-registry.json').read_text())}
def digest(value):
 return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def read(name): return json.loads((R/'data'/name).read_text())
def write(name,value): (R/'data'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def normalize(raw, province):
 if province not in ['seoul','gyeonggi']:raise ValueError('Unsupported province')
 required=['id','title_ko','summary_ko','start_date','end_date','venue_name','official_url','checked_at']
 for field in required:
  if not raw.get(field): raise ValueError(f'Missing {field}: {raw.get("id")}')
 start,end=raw['start_date'],raw['end_date']
 datetime.date.fromisoformat(start);datetime.date.fromisoformat(end)
 if start>end or start>WINDOW['end'] or end<WINDOW['start']: raise ValueError('Outside window: '+raw['id'])
 if raw.get('source_method')=='snippet' or raw.get('publication_status')=='hold': raise ValueError('Held evidence: '+raw['id'])
 aliases={'start_date':'dates','end_date':'dates','venue_name':'venue','address':'venue','price':'fee'}
 known={aliases.get(f,f) for f in raw.get('verified_fields',[])}&set(FIELDS)
 if not {'dates','venue'}<=known: raise ValueError('Date and venue evidence required: '+raw['id'])
 checked=datetime.datetime.fromisoformat(raw['checked_at'].replace('Z','+00:00'))
 if checked.tzinfo is None: raise ValueError('Check timestamp needs timezone')
 source=raw['official_url']
 if not source.startswith('https://'): raise ValueError('HTTPS official source required')
 version='sha256:'+digest(raw)
 district=raw.get('district') or ('서울시 전역' if province=='seoul' else '경기도')
 city_id=raw.get('city_id') or 'area-'+digest([province,district])[:10]
 labels=raw.get('district_labels') or {l:district for l in LOCALES}
 region={'province':province,'city':city_id,'labels':labels}
 area_id=('kr-11-' if province=='seoul' else 'kr-41-')+city_id
 category=raw.get('category','festival')
 if category not in ['festival','performance','exhibition','experience']: category='festival'
 # Price classification is editorial and conservative: no extraction of amounts
 # from mixed prices or conditional discounts as a universally available price.
 fee=raw.get('fee') or '요금 미확인'
 kind=raw.get('fee_kind','unknown')
 if kind=='unknown' and fee.strip() in ['무료','무료 관람','입장 무료']: kind='free'
 if kind not in ['free','paid','mixed','unknown']: kind='unknown'
 if kind=='unknown': known.discard('fee')
 booking=raw.get('reservation')
 if not booking or re.search('미확인|미공개|확인 필요|예약 확인|공식.*확인',booking): known.discard('reservation')
 hours=raw.get('hours')
 if not hours: known.discard('hours')
 known-=set(['liveAvailability','entrance','languages'])
 urls=list(dict.fromkeys([source]+raw.get('evidence_urls',[])))
 field_evidence=raw.get('field_evidence',{})
 sources=[]
 for f in sorted(known):
  evidence=field_evidence.get(f,{})
  evidence_url=evidence.get('url',source) if isinstance(evidence,dict) else source
  match=next((s for s in sources if s['url']==evidence_url),None)
  if not match:
   match={'url':evidence_url,'fields':[],'checked_at':raw['checked_at'],'method':raw.get('source_method','cached')};sources.append(match)
  match['fields'].append(f)
 translations={}
 for lang in LOCALES:
  tr=raw.get('translations',{}).get(lang,{})
  title=tr.get('title') or tr.get('display_title')
  summary=tr.get('summary')
  if not title or not summary: raise ValueError('Missing translation '+raw['id']+':'+lang)
  translations[lang]={'display_title':title,'summary':summary,'venue_name':tr.get('venue_name',raw['venue_name']),'status':'ai_draft','source_version':version,'published':False,'source_url':source}
 point=None;places=[]
 lat,lng=raw.get('lat'),raw.get('lng')
 if lat is not None and lng is not None:
  if not (36.5<float(lat)<38.5 and 126<float(lng)<128.5): raise ValueError('Coordinate outside capital region: '+raw['id'])
  if not str(raw.get('coordinate_source','')).startswith('https://'): raise ValueError('Coordinate evidence missing: '+raw['id'])
  point={'lat':float(lat),'lng':float(lng),'precision':'venue_reference','verifiedEntrance':False,'source':raw['coordinate_source']}
  venue_reference_name=raw.get('venue_reference_name',raw['venue_name'])
  place={'id':'place-'+digest([province,venue_reference_name])[:12],'name':venue_reference_name,'point':point,'address':raw.get('address'),'region':region}
  if city_id=='goyang' and venue_reference_name in GOYANG_PLACES:
   existing=GOYANG_PLACES[venue_reference_name]
   if abs(existing['point']['lat']-point['lat'])>.01 or abs(existing['point']['lng']-point['lng'])>.01:raise ValueError('Existing Goyang facility coordinate conflicts: '+raw['id'])
   place['id']=existing['id']
  if 'openstreetmap' in point['source']:place.update(attribution='© OpenStreetMap contributors',license='ODbL 1.0')
  places=[place]
 topic=raw.get('topic') or {'festival':'local','performance':'stage','exhibition':'art','experience':'learning'}[category]
 classification={'version':1,'topics':[topic],'audiences':raw.get('audiences',[]),'source_version':version,'source_title':raw['title_ko'],'evidence_urls':urls,'basis':'editorial_source_title_venue_notes'}
 ed={'environment':raw.get('environment','unknown'),'environmentBasis':'공식 행사 소개와 시설 유형에 따른 편집 분류','point':point,'media':None,'locations':places,'multiSite':bool(raw.get('multi_site',False)),'classification':classification}
 if raw.get('recurrence'):
  rule=raw['recurrence'].copy()
  rule['start']=rule.get('start',rule.get('startMinute'))
  rule['end']=rule.get('end',rule.get('endMinute'))
  if not isinstance(rule['start'],(int,float)) or not isinstance(rule['end'],(int,float)) or not 0<=rule['start']<rule['end']<=1440:raise ValueError('Invalid recurrence: '+raw['id'])
  ed['recurrence']=rule
 if raw.get('last_entry') is not None:ed['lastEntry']=raw['last_entry']
 notes=raw.get('notes_ko') or raw.get('notes') or ''
 if isinstance(notes,list):notes=' '.join(notes)
 notes=' '.join(str(n) for n in [notes,raw.get('source_note'),raw.get('coordinate_note')] if n)
 verification={'source_version':version,'checked_at':raw['checked_at'],'recheck_after':(checked+datetime.timedelta(hours=24)).isoformat(),'method':'official_page_text_review','source_methods':[raw.get('source_method','cached')],'cached_source':raw.get('source_method','cached')!='direct','sources':sources,'verified_fields':sorted(known),'unknown_fields':[f for f in FIELDS if f not in known],'notes_ko':notes,'additional_unknowns':raw.get('unknown_fields',[]),'admission':raw.get('admission','unknown'),'conflict':bool(raw.get('conflict',False))}
 event={'id':raw['id'],'source_version':version,'title_ko':raw['title_ko'],'summary_ko':raw['summary_ko'],'category':category,'area_id':area_id,'region':region,'venues':[{'id':places[0]['id'] if places else 'venue-'+digest([district,raw['venue_name']])[:12],'name_ko':raw['venue_name'],'address_ko':raw.get('address'),'latitude':lat,'longitude':lng,'coordinate_source_url':raw.get('coordinate_source')}],'schedule':{'start_date':start,'end_date':end,'timezone':'Asia/Seoul','raw_ko':hours,'sessions':raw.get('sessions',[]),'exceptions':raw.get('exceptions',[]),'precision':raw.get('schedule_precision','date_range')},'status':'scheduled','price':{'kind':kind,'currency':'KRW','min':0 if kind=='free' else None,'max':0 if kind=='free' else None,'raw_ko':fee},'reservation':{'raw_ko':booking,'scope':raw.get('reservation_scope','general_admission')} if booking else None,'onsite_languages':None,'visitor_access':{'notes_ko':raw.get('conditions')},'evidence':[{'source_id':'source-'+digest(u)[:12],'url':u,'fields':sorted(known),'checked_at':raw['checked_at'],'note_ko':'공식 출처 조사 기록; 현장 확인 및 실시간 잔여석 확인 아님'} for u in urls],'last_verified_at':raw['checked_at'],'publication_status':'research','translations':translations,'verification':verification,'editorial':ed}
 return event,places
def main():
 raw=read('regional-input.json');events=[];places={}
 for group in raw['groups']:
  for item in group['events']:
   e,ps=normalize(item,group['province']);events.append(e)
   for p in ps:places[p['id']]=p
 if len({e['id'] for e in events})!=len(events):raise ValueError('Duplicate event IDs')
 write('regional-bundle.json',{'events':events,'places':list(places.values()),'windowStart':WINDOW['start'],'windowEnd':WINDOW['end'],'complete':False})
 print(len(events),'regional events;',len(places),'located facilities')
if __name__=='__main__':main()
