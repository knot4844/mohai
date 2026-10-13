import urllib.request,urllib.parse,re,json,sys
from pathlib import Path
sys.path.insert(0,'/private/tmp/mohai-geo-deps')
from pyproj import Transformer
tr=Transformer.from_crs(5181,4326,always_xy=True)
rows=[]
for name,u in [('고양생태교육센터','https://www.goyang.go.kr/ecoedu/center/directions.do'),('신원중학교','https://www.goegy.kr/gysinwon-m/lm/location/locationMapView.do?mi=7155'),('송포청소년문화의집','https://www.gcyf.or.kr/sp/bbs/content.php?co_id=songpo_01_4'),('주교청소년자유공간','https://www.gcyf.or.kr/jg/bbs/content.php?co_id=jugyo_01_5'),('행신청소년자유공간','https://www.gcyf.or.kr/hs/bbs/content.php?co_id=haengsin_01_4')]:
 s=urllib.request.urlopen(u).read().decode();key=re.search(r'"key"\s*:\s*"([^"]+)"',s).group(1);mu='https://t1.kakaocdn.net/roughmap/'+key+'.json'
 j=json.loads(urllib.parse.unquote(re.search(r'onDataLoad\("(.*?)"\)',urllib.request.urlopen(mu).read().decode()).group(1)))
 lng,lat=tr.transform(float(j['placeX'])/2.5,float(j['placeY'])/2.5)
 rows.append({'name':name,'lat':lat,'lng':lng,'source':u,'map_source':mu,'raw':j})
rows.append({'name':'고양꽃전시관','lat':37.6552847260535,'lng':126.76890828030449,'source':'https://access.visitkorea.or.kr/ms/detail.do?cotId=59ce3dd9-38d2-4c68-91fa-356c79cbefa7'})
Path('/Users/dyl/mohai/data/extra-locations-source.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for r in rows:print(r['name'],r['lat'],r['lng'])
