"""Snapshot the three completed source notebooks; normalization remains reproducible.

Usage: python3 scripts/import-regional-survey.py /absolute/path/to/survey
"""
import json,pathlib,sys,hashlib
R=pathlib.Path(__file__).resolve().parents[1]
labels=[
 ('서울시 전역','seoul-wide','Across Seoul','ソウル各地','首尔各地'),
 ('종로구','jongno','Jongno-gu','鍾路区','钟路区'),('중구','jung','Jung-gu','中区','中区'),
 ('용산구','yongsan','Yongsan-gu','龍山区','龙山区'),('강남구','gangnam','Gangnam-gu','江南区','江南区'),
 ('노원구','nowon','Nowon-gu','蘆原区','芦原区'),('관악구','gwanak','Gwanak-gu','冠岳区','冠岳区'),
 ('강서구','gangseo','Gangseo-gu','江西区','江西区'),('도봉구','dobong','Dobong-gu','道峰区','道峰区'),
 ('마포구','mapo','Mapo-gu','麻浦区','麻浦区'),
 ('수원시','suwon','Suwon','水原市','水原市'),('용인시','yongin','Yongin','龍仁市','龙仁市'),
 ('화성시','hwaseong','Hwaseong','華城市','华城市'),('평택시','pyeongtaek','Pyeongtaek','平沢市','平泽市'),
 ('성남시','seongnam','Seongnam','城南市','城南市'),('김포시','gimpo','Gimpo','金浦市','金浦市'),
 ('안산시','ansan','Ansan','安山市','安山市'),('안양시','anyang','Anyang','安養市','安养市'),
 ('시흥시','siheung','Siheung','始興市','始兴市'),('광명시','gwangmyeong','Gwangmyeong','光明市','光明市'),
 ('부천시','bucheon','Bucheon','富川市','富川市'),('양평군','yangpyeong','Yangpyeong','楊平郡','杨平郡'),
 ('여주시','yeoju','Yeoju','驪州市','骊州市'),('오산시','osan','Osan','烏山市','乌山市'),
 ('이천시','icheon','Icheon','利川市','利川市'),('파주시','paju','Paju','坡州市','坡州市'),
 ('연천군','yeoncheon','Yeoncheon','漣川郡','涟川郡'),('구리시','guri','Guri','九里市','九里市'),
 ('가평군','gapyeong','Gapyeong','加平郡','加平郡'),('양주시','yangju','Yangju','楊州市','杨州市'),
 ('남양주시','namyangju','Namyangju','南楊州市','南杨州市')]
labels += [
 ('고양시','goyang','Goyang','高陽市','高阳市'),('안성시','anseong','Anseong','安城市','安城市'),
 ('군포시','gunpo','Gunpo','軍浦市','军浦市'),('의왕시','uiwang','Uiwang','義王市','义王市'),
 ('과천시','gwacheon','Gwacheon','果川市','果川市'),('광주시','gwangju','Gwangju','広州市','广州市'),
 ('하남시','hanam','Hanam','河南市','河南市'),('의정부시','uijeongbu','Uijeongbu','議政府市','议政府市'),
 ('포천시','pocheon','Pocheon','抱川市','抱川市'),('동두천시','dongducheon','Dongducheon','東豆川市','东豆川市'),
 ('송파구','songpa','Songpa-gu','松坡区','松坡区'),('서초구','seocho','Seocho-gu','瑞草区','瑞草区'),
 ('영등포구','yeongdeungpo','Yeongdeungpo-gu','永登浦区','永登浦区'),('성동구','seongdong','Seongdong-gu','城東区','城东区'),
 ('광진구','gwangjin','Gwangjin-gu','広津区','广津区'),('강동구','gangdong','Gangdong-gu','江東区','江东区'),
 ('서대문구','seodaemun','Seodaemun-gu','西大門区','西大门区'),('은평구','eunpyeong','Eunpyeong-gu','恩平区','恩平区'),
 ('강북구','gangbuk','Gangbuk-gu','江北区','江北区'),('성북구','seongbuk','Seongbuk-gu','城北区','城北区'),
 ('중랑구','jungnang','Jungnang-gu','中浪区','中浪区'),('동대문구','dongdaemun','Dongdaemun-gu','東大門区','东大门区'),
 ('동작구','dongjak','Dongjak-gu','銅雀区','铜雀区'),('구로구','guro','Guro-gu','九老区','九老区'),
 ('금천구','geumcheon','Geumcheon-gu','衿川区','衿川区'),('양천구','yangcheon','Yangcheon-gu','陽川区','阳川区')]
areas={ko:(id,dict(zip(['ko','en','ja','zh-Hans'],[ko,en,ja,zh]))) for ko,id,en,ja,zh in labels}
def main():
 source=pathlib.Path(sys.argv[1]);groups=[]
 for name,province in [('seoul','seoul'),('north','gyeonggi'),('south','gyeonggi')]:
  path=source/(name+'.json')
  if not path.exists():continue
  events=json.loads(path.read_text())
  for e in events:
   d=e.get('district') or '서울시 전역'
   if province=='seoul' and '·' in d:d='서울시 전역';e['multi_site']=True
   if d in areas:e['city_id'],e['district_labels']=areas[d]
   else:raise ValueError('Administrative labels need review: '+d)
   # Explicitly distinguish price rules, preserving all source wording.
   fee=e.get('fee') or ''
   if fee in ['무료','무료 관람','입장 무료','무료 (경기도청 안내 기준)']:e['fee_kind']='free'
   elif fee and any(t in fee for t in ['일부 프로그램 유료','군민 무료','개월 미만 무료']):e['fee_kind']='mixed'
   elif fee and ('유료' in fee or '원' in fee):e['fee_kind']='paid'
   if e.get('category')=='sports':e.update(category='experience',topic='sports')
   elif e.get('category')=='nature':e.update(category='festival',topic='seasonal')
   if '재즈' in e['title_ko']:e['topic']='concert'
   if any(t in e['title_ko'] for t in ['야행','달빛','빛섬']):e['topic']='night'
   if any(t in e['title_ko'] for t in ['억새','코스모스','국화','댑싸리']):e['topic']='seasonal'
   if any(t in e['title_ko'] for t in ['책문화','북페스티벌']):e['topic']='reading'
   if e['venue_name'].startswith('서울시립 북서울미술관'):e['venue_reference_name']='서울시립 북서울미술관'
   # The source explicitly lists two separate October dates, not a daily run.
   if e['id']=='yangju-gwana-family-20261011':e['schedule_precision']='complete_sessions'
  groups.append({'name':name,'province':province,'survey':source.name,'source_file':path.name,'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'events':events})
 if not groups:raise ValueError('No regional survey files found')
 if '--append' in sys.argv:
  previous=json.loads((R/'data/regional-input.json').read_text())
  groups=[g for g in previous['groups'] if g.get('survey')!=source.name]+groups
 ids=[e['id'] for g in groups for e in g['events']]
 if len(set(ids))!=len(ids):raise ValueError('Duplicate event IDs across surveys; review before publishing')
 (R/'data/regional-input.json').write_text(json.dumps({'groups':groups},ensure_ascii=False,indent=2)+'\n')
 print(sum(len(g['events']) for g in groups),'source records snapshotted')
if __name__=='__main__':main()
