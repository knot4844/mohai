import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
window=json.loads((root/'data/research-window.json').read_text())
bundle=json.load(open('/Users/dyl/mohae-data/events.json'))
bundle['events'].extend(json.load(open(root/'data/additional-events.json')))
places=json.load(open(root/'data/places-source.json'))['entities']
media=json.load(open(root/'data/media.json'))
classifications=json.load(open(root/'data/classifications.json'))
reviews=json.load(open(root/'data/verification.json'))
venue_registry=json.load(open(root/'data/venue-registry.json'))
venue_by_id={p['id']:p for p in venue_registry}
place_bindings=json.load(open(root/'data/event-place-bindings.json'))
def point(q):
 p=places[q]['claims']['P625'][0]['mainsnak']['datavalue']['value']
 return {'lat':p['latitude'],'lng':p['longitude'],'precision':'venue_reference','source':'https://www.wikidata.org/wiki/'+q,'verifiedEntrance':False}
# Source-bound editorial layer is independent of original research. Not an event geocode.
for e in bundle['events']:
 v=e['venues'][0]['name_ko']; title=e['title_ko']; ed={'environment':'unknown','point':None,'media':None}
 if '호수공원' in v: ed.update(environment='outdoor',point=point('Q6477301'),media='lake')
 if '행주산성' in v: ed.update(environment='outdoor',point=point('Q12624761'),media='fortress',recurrence={'weekdays':[0,1,2,3,4,5,6],'start':1080,'end':1320},lastEntry=1260)
 if '킨텍스' in v: ed.update(environment='indoor',point=point('Q484665'),media='kintex')
 if '어울림' in v: ed.update(environment='indoor',point=point('Q12584337'))
 if '화정역 문화광장' in v: ed.update(environment='outdoor',point=point('Q79836'))
 if '아람음악당' in v or ('도서관' in v and not any(x in v for x in ['·','호수공원','박물관'])): ed['environment']='indoor'
 if '라페스타' in v: ed.update(environment='outdoor',recurrence={'weekdays':[6],'start':1110,'end':1200})
 ed['environmentBasis']='장소 명칭과 시설 유형에 따른 편집 분류; 현장 전체의 실내외 조건 보증 아님'
 classification=classifications.get(e['id'])
 if classification and classification['source_version']==e['source_version']:
  ed['classification']=classification
 review=reviews.get(e['id'])
 if review:
  if review['source_version']!=e['source_version']: raise ValueError('Verification source changed: '+e['id'])
  e.update(review.get('patch',{}))
  ed.update(review.get('editorial',{}))
  e['verification']={k:v for k,v in review.items() if k not in ['patch','editorial','summaries']}
  if review.get('checked_at'): e['last_verified_at']=review['checked_at']
  for lang,summary in review.get('summaries',{}).items():
   if lang not in e['translations']: continue
   e['translations'][lang]['summary']=summary
   e['translations'][lang]['verification_revision']=review['checked_at']
   if lang=='ko': e['summary_ko']=summary
 else:
  e['verification']={'method':'not_rechecked','verified_fields':[],'unknown_fields':['dates','hours','venue','fee','reservation','conditions','liveAvailability','entrance','languages'],'sources':[]}
 binding=place_bindings.get(e['id'])
 if binding:
  if binding['source_version']!=e['source_version'] or binding['venue_names']!=[v['name_ko'] for v in e['venues']]:
   raise ValueError('Place binding needs review: '+e['id'])
  ed['locations']=[venue_by_id[p] for p in binding['place_ids']]
  ed['point']=ed['locations'][0]['point'] if ed['locations'] else None
  ed['multiSite']=binding['multi_site']
 e['editorial']=ed
regional_path=root/'data/regional-bundle.json'
regional=json.loads(regional_path.read_text()) if regional_path.exists() else {'events':[],'places':[]}
bundle['events'].extend(regional['events'])
if len({e['id'] for e in bundle['events']})!=len(bundle['events']):raise ValueError('Duplicate IDs across regional surveys')
venue_registry.extend(regional['places'])
venue_registry=list({p['id']:p for p in venue_registry}.values())
bundle['scope']['area_ids']=sorted(set(e['area_id'] for e in bundle['events'] if e['publication_status']=='research'))
bundle['scope'].update(window_start=window['start'],window_end=window['end'])
out={'scope':bundle['scope'],'researchDate':'2026-10-09','events':[e for e in bundle['events'] if e['publication_status']=='research'],'media':media,'preview':True,'publicReleaseApproved':False,'referencePlaces':[{'id':q,'name':places[q]['labels']['ko']['value'],'point':point(q)} for q in places]}
out['census']={'sourceRows':93,'originalUniqueSources':88,'newEvents':len(json.load(open(root/'data/additional-events.json'))),'promotedEvents':1,'windowStart':'2026-10-09','windowEnd':'2026-11-05','complete':False}
out['places']=venue_registry
# Additional public venue origins are not personal GPS positions.
out['referencePlaces'].extend({'id':p['id'],'name':p['name'],'point':p['point']} for p in regional['places'])
out['regionalSurvey']={'newEvents':len(regional['events']),'locatedEvents':sum(bool(e['editorial']['point']) for e in regional['events']),'windowStart':window['start'],'windowEnd':window['end'],'complete':False}
(root/'public/place-coordinates.json').write_text(json.dumps(venue_registry,ensure_ascii=False,indent=2))
out['locationCoverage']={'events':len(out['events']),'locatedEvents':sum(bool(e['editorial']['point']) for e in out['events']),'usedPlaces':len({p['id'] for e in out['events'] for p in e['editorial'].get('locations',[])}),'precision':'facility_reference_not_event_entrance'}
audit=json.loads((root/'data/census-audit.json').read_text())
if (root/'data/regional-audit.json').exists():
 audit={'scope':'고양 기존 조사 및 서울·경기 확장 조사','complete_census':False,'goyang':audit,'regional':json.loads((root/'data/regional-audit.json').read_text())}
if (root/'data/yearend-audit.json').exists():
 audit['yearend']=json.loads((root/'data/yearend-audit.json').read_text())
(root/'public/research-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
(root/'public/data.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')))
print(len(out['events']),'events',sum(e['editorial']['point'] is not None for e in out['events']),'reference points')
