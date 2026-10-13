from pathlib import Path
import json
r=Path(__file__).resolve().parents[2]; p=r/'previews/three'; t=json.loads((r/'data/ontology/pilot.json').read_text())['tables']; media=json.loads((r/'data/media.json').read_text())
names={o['id']:o['canonical_name'] for o in t['objects']}
tags=['자연','문화','전시','문화','문화','문화','문화','역사','전시','자연']; photos={0:media[0],7:media[1],8:media[2]}
data=[]; excluded=[]
for i,o in enumerate(t['places']):
 d={**o,'name':names[o['object_id']]}
 if o['latitude'] is None: excluded.append(d); continue
 d.update(tag=tags[i],demoScore=[85,67,54,73,31,42,49,78,94,61][i],media=photos.get(i))
 if d['media']: d['media']['src']='.'+d['media']['src']
 data.append(d)
(p/'data.json').write_text(json.dumps({'places':data,'excluded':excluded,'asOf':'2026-10-11','notice':'연구 자료 · 현재 운영 확인 전','tagBasis':'시제품용 수동 주제 분류'},ensure_ascii=False,indent=2))
