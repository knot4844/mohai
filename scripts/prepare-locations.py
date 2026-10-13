"""Build a provider-neutral venue registry from audited public coordinate sources."""
import json,pathlib,hashlib
from datetime import datetime,timezone
root=pathlib.Path(__file__).resolve().parents[1]
def read(n):return json.loads((root/'data'/n).read_text())
registry={}
def add(name,lat,lng,source,**extra):
 key='place-'+hashlib.sha256(name.encode()).hexdigest()[:12]
 registry[name]={'id':key,'name':name,'point':{'lat':round(lat,7),'lng':round(lng,7),'precision':'venue_reference','verifiedEntrance':False,'source':source},**extra}
for r in read('library-locations-source.json'):
 if 'error' not in r:add(r['name'],r['lat'],r['lng'],r['url'],address=r.get('address'),coordinateSource=r.get('map_source'))
city={r['item']:r for r in read('city-locations-source.json')}
for key,name in {'539':'고양아람누리','943':'고양관광정보센터','542':'라페스타','950':'노래하는분수대','1162':'새들','1402':'해움','1043':'백마 화사랑','961':'고양생태공원','516':'스타필드 고양','527':'서오릉','1051':'가와지볍씨박물관','545':'일산호수공원','547':'킨텍스'}.items():
 r=city[key];add(name,r['lat'],r['lng'],r['source'])
for r in read('extra-locations-source.json'):add(r['name'],r['lat'],r['lng'],r['source'],coordinateSource=r.get('map_source'))
p=root/'data/park-locations-source.json'
if p.exists():
 for r in json.loads(p.read_text()):
  if r['name'] in ['마상공원','호미걸이공원']:add(r['name'],r['lat'],r['lng'],r['source'],attribution=r['attribution'],license=r['license'])
# Retain previous reference facilities, without mistaking a facility for an entrance.
for q,p in read('places-source.json')['entities'].items():
 name=p['labels']['ko']['value'];v=p['claims']['P625'][0]['mainsnak']['datavalue']['value']
 if name not in registry:add(name,v['latitude'],v['longitude'],'https://www.wikidata.org/wiki/'+q)
(root/'data/venue-registry.json').write_text(json.dumps(list(registry.values()),ensure_ascii=False,indent=2)+'\n')
print(len(registry),'registered facilities')
