"""Explicit, source-version-bound event → facility mappings (WGS84, provider independent)."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
places=json.loads((root/'data/venue-registry.json').read_text());by={p['name']:p for p in places}
events=json.loads((root/'public/data.json').read_text())['events'];bindings={}
for e in events:
 venue=' / '.join(v['name_ko'] for v in e['venues']);names=[]
 normalized=venue.replace('송포 호미걸이 공원','호미걸이공원').replace('노래하는 분수대','노래하는분수대').replace('고양시립 아람미술관','고양아람누리').replace('·호수공원','·일산호수공원')
 for name in by:
  if name in normalized and name!='일산 호수공원':names.append(name)
 if '노래하는분수대' in names:names.remove('일산호수공원') if '일산호수공원' in names else None
 # Deterministic venue order; a multi-site programme is never a guaranteed single-stop itinerary.
 names.sort(key=lambda name:normalized.find(name))
 bindings[e['id']]={'source_version':e['source_version'],'venue_names':[v['name_ko'] for v in e['venues']],'place_ids':[by[n]['id'] for n in names],'multi_site':len(names)>1 or any(t in venue for t in ['·',' 및 ','출발','일대']),'mapping_basis':'Published venue name matched to facility; point is a facility reference, not an event entrance.'}
 if not names:print('UNMAPPED',e['title_ko'],venue)
(root/'data/event-place-bindings.json').write_text(json.dumps(bindings,ensure_ascii=False,indent=2)+'\n')
print(sum(bool(b['place_ids']) for b in bindings.values()),'events bound')
