# 오늘모해 객체 데이터 계약 0.1

내 위치에서 ‘오늘 모해?’의 첫 선택에 사용할 객체를 일관되게 축적하기 위한 로컬 실행 계약이다. 장소·행사·회차·필드별 근거를 다루며 액션/다음 행동 추천은 후속 단계다.

설계 기준은 [객체 데이터 구조와 수집 계획](</Users/dyl/reports/오늘모해 객체 데이터 구조와 수집 계획.md>)이다. 구현 결과는 [표본 검증 보고서](/Users/dyl/mohai/docs/ontology/pilot-report.md)를 본다.

## 실행과 저장 범위

```sh
cd /Users/dyl/mohai
npm run ontology:pilot
npm run ontology:check
npm test
```

`ontology:pilot`은 고정한 원본과 ID 결정 목록을 읽고 의미 검증과 메모리 SQL 적재를 모두 통과한 후 `data/ontology/pilot.json`과 `pilot-report.json`을 재생성한다. `ontology:check`는 같은 검증과 저장본의 일치를 검사하며 파일을 쓰지 않는다. 시간은 manifest의 고정 기준시각을 사용해 재현성을 유지한다.

Node와 Python3 표준 라이브러리만 사용한다. [schema.sql](/Users/dyl/mohai/data/ontology/schema.sql)은 SQLite STRICT의 **로컬 검증용 실행 스키마**다. 테스트 시 `:memory:` 데이터베이스를 만들고 닫는다. 운영 DB를 설치하거나 SQLite를 운영 저장소로 확정한 것은 아니다. PostgreSQL/PostGIS 물리 스키마와 배포 마이그레이션은 다음 단계의 별도 결정이다.

이 스키마는 완전한 후보 묶음을 새 DB에 INSERT하는 검증용이다. 임의 UPDATE API·온라인 편집·일반 병합 엔진은 제공하지 않는다. SQL 제약과 [의미 검증기](/Users/dyl/mohai/lib/ontology/validate.mjs)를 함께 실행해야 전체 계약을 검사한다. SQL 적재 성공만으로 날짜의 의미나 근거의 일치를 보장하지 않는다.

`public/`, `dist/`, 배포 빌드와 연결하지 않는다. 신규 외부 API 호출이나 키 사용은 없다. 원본 스냅샷의 보관 범위는 `local_research_only`다. 이 파일을 공개용 API 응답으로 그대로 반환하면 안 된다. 두 출력 파일은 각각 임시 파일에서 rename하며, 운영 릴리스 전체의 원자적 전환 기능은 아직 구현하지 않았다.

## 입력과 식별자

| 파일 | 역할 |
| --- | --- |
| [pilot-sources.json](/Users/dyl/mohai/data/ontology/pilot-sources.json) | 기존 파일에서 뽑아 고정한 22개 원본 레코드. 원본 파일·배열 위치·내용 해시·원문 포함 |
| [pilot-manifest.json](/Users/dyl/mohai/data/ontology/pilot-manifest.json) | 장소16·행사8의 고정 UUID, 회차 UUID, 원본 선택 위치, 관계 결정, 원본 전체 해시 |
| [pilot.mjs](/Users/dyl/mohai/lib/ontology/pilot.mjs) | 원본을 타입별 행과 필드 근거로 변환하는 순수 함수 |
| [pilot.json](/Users/dyl/mohai/data/ontology/pilot.json) | 관계형 테이블별로 배열을 가진 변환 결과 |

Object와 Occurrence의 UUID는 한 번 발급해 manifest에 보존한다. 이름·좌표·시작시각으로 다시 만들지 않는다. 근거·가격·분류 등 종속 행 ID만 부모 ID와 필드 키로 결정한다. 원본이 변경되면 기본 실행은 해시 불일치로 중단한다. 기존 원본을 덮어쓰며 자동 갱신하는 도구가 아니다.

회차 UUID는 동결 스냅샷의 특정 세션 행에 대응한다. 새로운 원본에서 회차가 추가·삭제·재정렬되거나 시간이 바뀌면 원본과 manifest의 대응을 명시적으로 재검토해야 한다. 이름이나 시간이 수정됐다고 동일 객체·회차의 ID를 자동 변경하지 않는다. ID 수정과 병합은 별도의 결정 기록이 필요하다.

기존 `place-9f29da024f99`는 시설과 홀 두 객체에 대응하므로 전역 alias로 쓰지 않는다. `snapshot_id + source_path` 단위로 대응을 기록한다. 다른 공급자의 같은 이름이나 가까운 좌표를 자동으로 합치는 로직은 없다.

## 실행 테이블과 필드

SQL에 모든 열과 필수성·CHECK·FK를 명시했다. 다음은 사용 목적과 핵심 계약이다.

| 테이블 | 기본키·관계 | 필드와 제약 |
| --- | --- | --- |
| snapshots | id | source_file, source_selector, payload_sha256, source_version, raw_json, storage_scope. 원문 해시 일치 필요 |
| objects | id UUID | kind=place/event, canonical_name 필수, publication_state=research, lifecycle_state. 영업 중 여부를 뜻하지 않음 |
| places | object_id → objects | address_text, latitude, longitude, location_role. 좌표와 역할은 함께 있거나 모두 null |
| events | object_id → objects | starts_on, ends_on, timezone, coverage, status, multi_site. 기간 역전 금지 |
| occurrences | id UUID, event_id → events | starts_at, ends_at, local_date, timezone, status, visit_mode. 날짜/시간 정밀도 유지, 끝 미상은 null |
| relations | id, from_id/to_id → objects | held_at, facility_reference, part_of. 대상 타입·중복·순환 검사, 출처와 판단 이유 필수 |
| schedules | id, object_id → objects | raw_text, recurrence_json, exceptions_json, timezone, coverage. 이번 표본은 행사 규칙을 보존하고 회차로 펼치지 않음 |
| admissions | id, object_id → objects | reservation_required와 reservation_state. 기존 legacy_mode는 판단 재료로만 보존 |
| prices | id, object_id → objects | kind, minimum, maximum, currency, raw_text, scope=legacy_record_only. 음수와 범위 역전 금지 |
| facts | id, object_id 또는 occurrence_id | field, value_json, knowledge_state, review_state, snapshot_id, source_path, transform, checked_at/precision, recheck_after, valid_from/until, method |
| classifications | id, object_id → objects | namespace, dimension, concept, version, snapshot_id, source_path. 기존 분류임을 표시 |
| mappings | id, snapshot_id + source_path 유일 | legacy_id, target_id, disposition, reason. 보류는 target_id=null |

객체는 해당 kind의 상세 행을 정확히 하나 가져야 한다. Occurrence는 Object 개수에 합산하지 않는다. 장소의 좌표를 행사에 복제하지 않고 관계로 찾는다. 이번 좌표는 모두 기존 시설 기준점이며 entrance로 승격하지 않는다.

가격의 minimum/maximum은 원본에 있는 범위만 옮긴다. 좌석별 가격 문자열을 새 PriceLine이나 Product로 파싱하지 않았다. 상품·메뉴·조직·혜택·미디어 권리의 상세 테이블은 이번 24객체에서 검증할 실자료가 부족해 구현 범위에서 제외했다. 기존 원문은 스냅샷에서 재처리할 수 있다.

## 필드별 원본 매핑

| 원본 경로 | 대상 | 처리 |
| --- | --- | --- |
| /title_ko, /name, /venues/0/name_ko | objects.canonical_name + fact | 원문 표시명을 보존, 새 번역 생성 없음 |
| /address, /venues/0/address_ko | places.address_text + fact | B1·3F 등 층 표시 보존 |
| /point | places 좌표 + place.location fact | 시설 기준점으로만 이관 |
| /venues/0/latitude 등 | 개별 구역/홀 좌표 | 부모 시설점일 수 있어 사용 보류. 원문 값은 snapshot에 남음 |
| /schedule/start_date, end_date | events 기간 + facts | 종료 날짜 포함, 날짜 정밀도 유지 |
| /schedule/precision | events.coverage + fact | complete_sessions→complete, partial_sessions→partial, 나머지→unknown |
| /schedule/sessions/N | occurrences + facts | manifest의 회차 UUID 사용, end null 보존 |
| /editorial/recurrence, /schedule/exceptions | schedules | 원문 규칙 보존, 부분 목록을 완전 목록으로 승격하지 않음 |
| /reservation/required | admissions + fact | 명시 boolean만 사용. legacy conflict가 있으면 conflict/null |
| /verification/admission | admissions.legacy_mode | walk_in을 예약 불필요로 자동 변환하지 않음 |
| /price | prices + 금액 facts | 해당 레코드 범위만 적용, 부대행사로 가격 상속 없음 |
| /editorial/classification/*, /topics | classifications | 원래 분류 ID와 버전/namespace 유지, 액션 변환 없음 |
| /editorial/locations/N | facility_reference | 기존 시설 참조 관계만 보존 |
| 명시 개최 구역인 /venues/0 | held_at | 축제 주제광장과 아람극장을 독립 객체로 연결 |

`facts.source_path`는 추출한 원본 레코드 안의 JSON Pointer다. 원래 파일의 위치는 snapshot.source_selector와 합쳐 찾는다. 필드가 없으면 source_path는 해당 레코드 루트이며 transform=`missing:<field>`로 이유를 명시한다. 의도적으로 사용하지 않은 값은 `withheld:<reason>`이다. 원문 필드 선택·변환 결과·현재 값의 불일치를 검증기가 차단한다.

전체 Object 선택과 참조별 이관 결정은 `pilot.json.tables.mappings`의 43행이다. 이중 selected가 24행이며 나머지는 참조 연결과 보류 기록이다. 모든 원문 필드를 43개의 typed mapping으로 완전히 구조화했다는 뜻은 아니다. 사용하지 않은 원문은 snapshot에서 유지한다.

## 알려진 값과 검증 상태

known은 ‘원본에 값이 있어 구조화했다’는 뜻이다. 오늘 현장에서 이용 가능하다는 인증이 아니다. 모든 fact의 method와 review_state는 legacy_import로 두었다. 사용하지 않는 값은 unknown, 원본 접수 조건 충돌은 conflict다. false는 확인된 boolean 거짓, 0은 금액 0이며 null과 구별한다. not_applicable은 계약·합성 테스트에서 지원하지만 이번 실제 표본에는 0건이다.

checked_at은 기존 검증 목록에서 해당 필드를 명시한 출처의 확인 시각만 옮긴다. 원본 버전이 다르거나 해당 필드의 확인 기록이 없으면 null이다. 상설 카탈로그의 ‘2026-10-11’처럼 날짜만 있으면 checked_precision=date로 보존한다. 변환 실행시각을 확인시각으로 채우지 않는다.

recheck_after는 기존 기한을 그대로 보존한다. 신선도는 고정 as_of 기준 계산이며 기한이 지난 값은 stale, 확인시각·기한이 불충분하면 unverified다. 이관이 새 확인을 뜻하지 않으므로 fresh로 승격되는 값은 없다. valid_from/until은 근거가 없어 null로 남아 있으며 영구 유효를 뜻하지 않는다.

원본의 conflict 플래그만 남아 있는 자료는 충돌하는 개별 주장을 새로 꾸며 만들지 않는다. conflict/null과 원문 설명을 보존하고, 실제 복수 출처를 확보한 다음 assertion별 해결 기록으로 확장한다. 포함관계 네 건은 proposed로 저장해 명칭과 기존 연결을 바탕으로 한 검토안임을 구분한다.

## 다음 단계의 경계

이번 계약은 공개가 아니라 이관 검증의 기반이다. 다음은 기존232 행사·관련 장소·상설4·보관 API87을 대상으로 네트워크 없는 그림자 이관이다. 그 전에 이번 파일에서 고정한 ID 목록을 일반 identity ledger로 확장하고 공급자별 처리 결과와 병합/분리 검토 대기열을 마련한다.

운영 PostgreSQL DDL·인덱스, 공개 전환/롤백, 소스 이용권한 정책 집행, 자동 재확인, 새 분류 사전, Action/Activity 및 추천은 아직 구현하지 않았다. 저장 SQL만 보고 이 기능들이 준비됐다고 간주하지 않는다.
