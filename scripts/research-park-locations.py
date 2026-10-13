import urllib.request,xml.etree.ElementTree as ET,json
from pathlib import Path
rows=[]
for bbox in ['126.829,37.659,126.835,37.664','126.732,37.669,126.737,37.674']:
 u='https://api.openstreetmap.org/api/0.6/map?bbox='+bbox
 try:
  s=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'MOHAI venue verification'}),timeout=30).read();root=ET.fromstring(s);nodes={n.attrib['id']:(float(n.attrib['lat']),float(n.attrib['lon'])) for n in root.findall('node')}
  for w in root.findall('way'):
   tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')};name=tags.get('name','')
   if any(t in name for t in ['마상','호미걸이']):
    pts=[nodes[n.attrib['ref']] for n in w.findall('nd')];lat=(min(x[0] for x in pts)+max(x[0] for x in pts))/2;lng=(min(x[1] for x in pts)+max(x[1] for x in pts))/2
    rows.append({'name':name,'lat':lat,'lng':lng,'source':'https://www.openstreetmap.org/way/'+w.attrib['id'],'license':'ODbL 1.0','attribution':'© OpenStreetMap contributors','geometry':pts});print(rows[-1])
 except Exception as e:print(str(e))
Path('/Users/dyl/mohai/data/park-locations-source.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
