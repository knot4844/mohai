import urllib.request,json,urllib.parse,re,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
def get(url):
 return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'MOHAI/0.1 (local travel research)'}),timeout=25).read()
x=json.load(open(root/'data/media-source.json'))
rows=[]
for name,p in zip(['lake','fortress'], sorted(x['query']['pages'].values(),key=lambda v:v['title'])):
 i=p['imageinfo'][0]; m=i['extmetadata']; url=i['url'].split('?')[0]
 (root/f'public/assets/{name}.jpg').write_bytes(get(url))
 rows.append({'id':name,'src':f'/assets/{name}.jpg','source':i['descriptionurl'],'author':re.sub('<[^>]+>','',m.get('Artist',{}).get('value','')),'license':m.get('LicenseShortName',{}).get('value'),'licenseUrl':m.get('LicenseUrl',{}).get('value','https://creativecommons.org/publicdomain/mark/1.0/'),'kind':'venue_archive','caption_ko':'장소 기록 사진 · 현재 행사 사진 아님'})
(root/'data/media.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for term in ['고양아람누리','킨텍스','라페스타','고양어울림누리','화정역']:
 u='https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode({'action':'wbsearchentities','search':term,'language':'ko','format':'json','limit':2})
 try:
  d=json.loads(get(u)); print(term,[(v['id'],v.get('description','')) for v in d.get('search',[])])
 except Exception as e: print(term,type(e).__name__)
