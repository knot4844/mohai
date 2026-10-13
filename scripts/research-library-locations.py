import urllib.request,urllib.parse,re,json,concurrent.futures,sys
from pathlib import Path
sys.path.insert(0,'/private/tmp/mohai-geo-deps')
from pyproj import Transformer
transform=Transformer.from_crs(5181,4326,always_xy=True)
base='https://www.goyanglib.or.kr'
def get(u):return urllib.request.urlopen(u,timeout=20).read().decode()
s=get(base+'/center/index.do')
links=dict((a,re.sub('<[^>]+>','',n).strip()) for a,n in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',s,re.S) if re.search(r'/[A-Z]+/index.do',a) and '도서관' in n)
def collect(item):
 path,name=item
 try:
  s=get(base+path);link=next(a for a,n in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',s,re.S) if '찾아오시는길' in n)
  url=base+link;s=get(url);key=re.search(r'"key"\s*:\s*"([^"]+)"',s).group(1)
  raw=get('https://t1.kakaocdn.net/roughmap/'+key+'.json');j=json.loads(urllib.parse.unquote(re.search(r'onDataLoad\("(.*?)"\)',raw).group(1)))
  lng,lat=transform.transform(float(j['placeX'])/2.5,float(j['placeY'])/2.5)
  addr=re.search(r'주소\s*:?\s*</span>(.*?)</li>',s,re.S)
  return {'name':name.replace('(휴관)',''),'url':url,'map_source':'https://t1.kakaocdn.net/roughmap/'+key+'.json','address':re.sub('<[^>]+>','',addr.group(1)).strip() if addr else None,'lat':lat,'lng':lng,'raw':j,'conversion':'WCONGNAMUL divided by 2.5, EPSG:5181 to EPSG:4326; facility reference, not entrance'}
 except Exception as e:return {'name':name,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:rows=list(ex.map(collect,links.items()))
Path('/Users/dyl/mohai/data/library-locations-source.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for r in rows:print(r['name'],r.get('lat'),r.get('lng'),r.get('error',''))
