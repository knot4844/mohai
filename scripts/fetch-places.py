import urllib.request,json,urllib.parse,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
u='https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode({'action':'wbgetentities','ids':'Q6477301|Q12624761|Q484665|Q12584337|Q79836','props':'labels|claims','languages':'ko|en|ja|zh','format':'json'})
r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'MOHAI/0.1'}),timeout=30)
x=json.load(r);(root/'data/places-source.json').write_text(json.dumps(x,ensure_ascii=False))
for k,v in x['entities'].items():
 print(k,{a:b['value'] for a,b in v.get('labels',{}).items()})
 for prop in ['P625','P18']:
  print(prop,[c.get('mainsnak',{}).get('datavalue',{}).get('value') for c in v.get('claims',{}).get(prop,[])])
