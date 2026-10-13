import urllib.request,re,json,concurrent.futures,html
from pathlib import Path
x=Path('/Users/dyl/mohai/data/census-input.json').read_text()
urls=set(re.findall(r'https?[^"\s]+tourRsrcView[^"\s]+',x))
urls.add('https://www.goyang.go.kr/visitgoyang/www/tourRsrcView.do?key=243&tourRsrcNo=539')
urls.update(['https://goyang.go.kr/visitgoyang/www/tourRsrcView.do?key=91&tourRsrcNo=527','https://www.goyang.go.kr/visitgoyang/www/tourRsrcView.do?key=121&tourRsrcNo=516'])
rows=[]
def f(u):
 try:
  s=urllib.request.urlopen(u,timeout=20).read().decode(); r=[]
  for attrs,body in re.findall(r'<button([^>]*data-itemcode[^>]*)>(.*?)</button>',s,re.S):
   a=dict(re.findall(r'([\w-]+)="([^"]*)"',attrs));n=re.search(r'<span class="text">(.*?)</span>',body)
   if n and a.get('data-latitude') and a.get('data-longitude'):r.append({'name':html.unescape(n.group(1)),'lat':float(a['data-latitude']),'lng':float(a['data-longitude']),'item':a['data-itemcode'],'source':u})
  return r
 except Exception as e:return []
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
 for r in ex.map(f,urls):rows.extend(r)
rows=list({r['item']:r for r in rows}.values());Path('/Users/dyl/mohai/data/city-locations-source.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('sources',len(urls),'places',len(rows))
for r in rows:
 if any(n in r['name'] for n in ['화사랑','서오릉','꽃전시','분수','스타필드','생태','해움','새들','종합운동','호미','마상','라페','관광정보','가와지','아람']):print(r['item'],r['name'],r['lat'],r['lng'])
