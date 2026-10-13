# MOHAI · 오늘모해

서울·경기 행사 탐색과 하루 코스를 조합하는 **리서치 프리뷰**입니다. 기존 noado 임대 관리 앱과 별도 프로젝트입니다.

- 요청 도메인: https://mohai.noado.kr
- Vercel project: knot4844s-projects/mohai
- 소스: /Users/dyl/mohai
- 원 조사: /Users/dyl/mohae-data (수정하지 않음)

## 구현한 기능

- 실제 조사 행사·프로그램 232건(기존183 + 연말 서울19·고양27·수원3 추가). 조사 기간 2026-10-09~12-31. 지역/시군구/날짜/유형/실내외/무료/검색 필터.
- ko/en/ja/zh-Hans UI와 기존 행사 번역 연결. 번역은 AI 초안, noindex 프리뷰로 명시.
- 점 선택/마우스 진입/키보드 포커스 시 포토카드, 클릭 고정, 모바일 탭 대응.
- 출발지 선택 및 브라우저 GPS 1회 요청. GPS 좌표는 저장·공유 URL에서 제외.
- 최대 5곳 코스 추가/삭제/순서/체류시간, 기기 내 저장, 공유 링크 복원.
- 행사 회차·접수마감·마지막 입장·이동한도·귀가시간을 검사하는 결정적 일정 엔진.
- 행사-장소-회차-출처 노드 및 관계 생성. `public/engine.js`의 `buildGraph`.
- 네이버 JavaScript 지도와 서버 전용 Directions 5 어댑터. 키 미설정 시 지리적 관계도 표시.
- 날씨 서버 어댑터, 시간대별 예보, 비 예보에 따른 실내 우선 정렬. Open-Meteo 출처 표시.
- 사진 3장: 호수공원/행주산성/킨텍스. 장소 기록 사진이며 행사 실사로 표시하지 않음. 저작자와 라이선스 화면 내 표시. 크기 축소 및 표시 영역 크롭.
- 영상 필드는 지원하지만 허가된 실제 행사 영상은 미등록.

## 실행·검증

Node 24 LTS 권장, 외부 패키지 의존성 없음.

```sh
cd /Users/dyl/mohai
cp .env.example .env.local
npm run dev
npm test
npm run build
```

`http://localhost:4173`. `public/data.json`은 원 조사+출처가 있는 편집층에서 생성했습니다. `scripts/prepare-data.py`는 조사 경로가 있는 로컬 환경에서만 재생성합니다. 배포 빌드는 이미 준비한 JSON을 사용합니다.

## 실제 연결 상태와 남은 작업

### 네이버 지도·교통

배포 환경의 네이버 Dynamic Map은 연결되어 있습니다. 기본 화면은 지도 없는 장소 연결 보기이며, 지도 토글을 켜면 SDK를 지연 로드합니다. 서버용 Directions 자격증명은 미설정이므로 실제 교통 소요시간은 미연결입니다. 지도 키는 공개 클라이언트 식별자이며 비밀키를 `/api/config`로 노출하지 않습니다.

Directions 5는 이 구현에서 자동차만 지원합니다. 도보·대중교통은 소요시간 미연결로 표시합니다. 현재 교통을 기준으로 받은 ETA는 미래 교통 예측이라고 표시하지 않습니다.

공식 문서:
- https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html
- https://api.ncloud-docs.com/docs/application-maps-overview

### 위치 정확도

공식 약도·관광기관 공개 좌표·Wikidata·OpenStreetMap의 시설 기준점을 공급자 독립 WGS84 장소 데이터로 관리합니다. 최신 연결 건수는 `public/data.json`의 `locationCoverage`, 출처는 `public/place-coordinates.json`에 있습니다. 확인되지 않은 좌표는 null로 유지하며, 복수 장소 행사의 대표점은 별도 표시합니다. 시설 기준점은 실제 입구·주차장·집결지 좌표가 아닙니다.

### 날씨

`OPEN_METEO_PREVIEW=true`는 비상업적 평가·프로토타입에서만 무료 엔드포인트를 허용합니다. 로컬에서 실제 예보 응답을 확인했고 리서치 프리뷰 배포에만 연결합니다. 공개 상용 서비스 전환 시 기상청 API 또는 상업 이용 라이선스가 있는 제공자로 전환해야 합니다. 유료 키가 있으면 `OPEN_METEO_API_KEY`로 customer API를 사용하도록 구현했지만 구매/유료 호출은 하지 않았습니다.

- https://open-meteo.com/en/pricing (평가·프로토타입 이용 안내)
- https://open-meteo.com/en/terms (상업 이용, 호출 한도, 위치 로그 정책)
- API 응답은 15분 메모리 캐시, 날씨 위치는 소수 둘째 자리로 반올림. 현재 캐시는 인스턴스 단위이며 대규모 트래픽용 공용 캐시·분산 호출한도는 미구현.

### 데이터 운영

원 자료 조사일은 2026-10-09, 조사창 10-09~11-05입니다. 자동수집·취소 감지·예약 연동은 없습니다. 기간이 겹치는 것을 ‘오늘 실제 개최’로 확정하지 않고, 회차가 미확인인 경우 표시합니다. 접수마감은 기본 숨김, 요금 null은 무료 필터에서 제외합니다. 가족/연령/회원/거주조건은 상세 안내와 번역문에 보존되어 있지만 사용자의 자격을 자동 판정하는 기능은 없습니다.

`published:false` 연구 번역을 **명시적으로 프리뷰**에서만 사용합니다. 정식 공개 상태로 승격하거나 전문 검수 완료라고 표시하지 않습니다. 공식 공지 링크로 원문 확인이 가능합니다.

## 정식 운영 전 중요 사항

길찾기 키 연결과 실제 차량 경로 E2E, 입구 좌표 확인, 누락 행사 재조사와 갱신 운영, 번역 품질 확인, 실제 행사 사진·영상 권한 확보가 필요합니다. 현재 결과를 실시간 전국 일정 서비스의 완성본으로 안내하면 안 됩니다.

### GPS와 장소 연결 모션
지도 위의 `내 위치로 주변 보기` 버튼은 브라우저 위치 권한을 받은 뒤 단발 GPS 측정을 요청합니다. 위치 수신 뒤 파란 기준점을 중심으로 행사 위치를 배치하고 점 선택·키보드 포커스·마우스 오버 시 기준점에서 해당 장소까지 선을 그립니다. 좌표가 같은 시설은 관계도에서 마커가 겹치지 않게 살짝 이동해 표시합니다. 실제 도로 지도에서는 좌표를 유지합니다. 모바일 사진 카드는 지도 아래에 표시해 점과 연결선을 가리지 않습니다. OS의 동작 줄이기 설정을 존중합니다.

네이버 지도 키가 없을 때는 위치 관계도에서 동작합니다. Naver SDK용 기준점·화면 범위 조정·Polyline 모션도 구현했으나 키가 없는 환경에서 실제 SDK 동작은 검증하지 못했습니다. 선과 직선거리는 교통 시간이나 입장 가능성 보장이 아닙니다. GPS 좌표는 저장·공유하지 않으며 기존 날씨/경로 조회 시에만 해당 제공자에게 전송합니다.

### Map-first recommendation update
The main screen is now a map with origin-centred links and numbered courses, not event cards. `public/recommendations.js` selects draft courses for 120/240/480-minute budgets using source schedules, weather, distinct venues and bounded straight-line distances. These are selection heuristics, **not verified travel-time guarantees**. Real road paths/traffic require the existing server-side Directions adapter to be configured. Manual edits stop automatic recommendation until a preset or the suggestion action is used again. Expanded research and course controls remain available below the map.

### Detailed categories
`public/taxonomy.js` defines six topic parents and 21 subtopics, each with Korean, English, Japanese and Simplified Chinese labels. An event can carry multiple subtopics, independently of its original source type and venue coordinates. Audience themes, environment and price are separate intersecting filters. Unknown price/location/audience is not inferred. `data/classifications.json` binds explicit editorial classifications to source versions; `scripts/prepare-data.py` preserves only matching versions. Category filters are exposed directly above the map and feed the recommendation engine. They do not certify age eligibility, guardian access, reservations or travel times.

### Optional geographic map
The default view now shows place nodes and connection lines without basemap tiles. The visible “Show map” switch lazily loads Naver Maps and toggles the geographic layer while preserving the selected event, filters and course. Each page load starts with the map off. SDK loading is deduplicated and a stale completion cannot override a newer off selection. This uses the existing geographic SVG connection view; the separate force-directed semantic explorer remains a research proposal.

## 서울·경기 조사 갱신

기존 고양 조사와 신규 지역 자료는 분리하여 보존합니다. 아래 명령은 직접 원문을 재조회하지 않으며, 검토가 끝난 조사 스냅샷을 정규화합니다. 출처 확인 시각은 갱신하지 않습니다.

```sh
python3 scripts/import-regional-survey.py '/Users/dyl/research_notes/서울 경기 행사 확장 조사'
python3 scripts/normalize-regional.py
python3 scripts/prepare-data.py
node scripts/verification-queue.mjs
npm test
npm run build
```

`regional-input.json` → `regional-bundle.json` → `public/data.json`. 지역은 `region.province`와 안정된 `region.city`, 장소는 별도 ID와 좌표 출처로 관리합니다. 원문 캐시 조사와 직접 확인을 구분하며, 날짜만 있는 행사에 임의 회차를 만들지 않습니다. 자료의 검증 기한은 24시간이며 자동 재조사 예약은 아직 없습니다. SEO의 noindex 프리뷰 상태는 이번 지역 확장과 별개로 유지합니다.

## TourAPI 연결 (2026-10-10)

- Vercel Production의 `TOUR_API_SERVICE_KEY`를 빌드 서버 안에서만 사용한다. 로컬 환경변수 전체 pull 금지. 브라우저에 키를 보내지 않는다.
- `scripts/build.mjs` → `scripts/fetch-tourapi.mjs` → `lib/tourapi.mjs`로 공식 KorService2/searchFestival2 및 detailIntro2 호출. 서울(11)·경기(41), 오늘~2026-12-31에 겹치는 행사. 시작 조회는 2년 전으로 넓히고 응답의 실제 기간으로 다시 필터링한다.
- 기존 `public/data.json`은 직접조사 232건 기준 원본으로 유지한다. 운영 `dist/data.json`에는 `lib/tourapi-normalize.mjs`가 API 결과를 합친다. 첫 연결: 87건 수집, 71건 추가, 중복14건 유지, 보류2건 = 총303건.
- API 목록 조회4회 + 상세87회. `tourapi-snapshot.json`, `tourapi-audit.json`에 공개 필드만 저장. 원시 요청URL/키/공급자 오류문구는 저장·출력하지 않는다. 사진은 이용조건 검토 전 자동 사용하지 않는다.
- API 자료는 `tourapi_import`/listed로 표시한다. 운영회차 추정 없음, 자동 코스 추천 제외. 새 이름의 외국어 번역 대기 상태를 보존한다.
- 갱신은 배포 시에만 수행한다. Cron/정기 갱신 미설정. 인증/목록수집 실패 시 배포 실패로 기존 운영 배포를 유지한다. 상세 누락은 개별 보류한다.
- 로컬에서는 키가 없으면 API 단계만 건너뛰므로 232건 빌드가 정상이다. 배포 303건을 로컬 기본 데이터와 혼동하지 말 것.
