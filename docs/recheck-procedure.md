# 자료 재확인 운영 절차 (recheck procedure) · v0.1 · 2026-10-12

## 왜 필요한가

- `public/verification.js`는 `recheck_after`가 지나면 `stale`로 판정하고, `maySuggest`는 `reviewed` 상태만 허용한다. 2026-10-12 기준 공개 원장의 직접 확인 230건은 전부 `recheck_after`가 2026-10-10이라 224건이 `stale`, 6건이 `conflict`, 2건이 `unreviewed`이며 TourAPI 69건은 `listed`다. 자동 추천(`recommend`)이 비어 있는 직접 원인이다.
- 이 상태는 정책 위반이 아니라 정책의 정상 작동이다. 기한을 연장하거나 조건을 완화하면 안 된다(AGENTS.md). 필요한 것은 **재확인 자체를 수행하고 기록하는 절차**다.
- 단, `maySuggest` 실패 조건은 기한 만료 하나가 아니다. `multiSite`, 필수 5필드(dates/hours/venue/fee/reservation) 미확인, 입장 조건이 `walk_in`/`onsite_registration`이 아님, `conflict`도 각각 독립적으로 막는다. 여기에 `recommend`는 좌표, 당일 `confirmed` 회차와 종료시각, 접수 마감 여부, 반경·날씨 조건을 더 요구하고, 목록 자체는 `publication_status==='research'`만 보여 준다. 따라서 "재확인만 하면 추천이 재개된다"는 설명은 큐가 각 건마다 계산한 차단 조건 목록을 근거로만 말할 수 있고, 재확인 결과가 기존 기록과 같다는 가정이 필요하다.

## 도구

```sh
# Node 24 (프로젝트 engines). 시스템 node가 다르면:
npx --yes --package=node@24 node scripts/recheck-queue.mjs            # 기본: public/data.json → data/recheck-queue.json + exports/recheck-queue-<날짜>.md
node scripts/recheck-queue.mjs --date 2026-10-13 --now 2026-10-13T00:00:00+09:00   # 특정 기준일·시각 시뮬레이션
node scripts/recheck-queue.mjs --tier P1 --limit 30 --md exports/recheck-P1.md     # 우선순위 한 단계만
node scripts/recheck-queue.mjs --data exports/모해-운영데이터-2026-10-11.json --dry  # 운영 스냅샷 집계만, 파일 안 씀
```

- 구현 `lib/recheck-queue.mjs`. 원장을 읽기만 하고 `data.json`·`data/verification.json`을 바꾸지 않으며, 외부 페이지를 열지 않고, 예약을 걸지 않는다.
- 제외: **종료일이 문자열로 확인되고** `end_date < 기준일`인 건(종료), `status` cancelled/postponed. 제외 건은 `excluded`에 이유와 함께 남긴다. 종료 행사의 기록 보존은 원장이 담당한다.
- 종료일·시작일이 없거나 null인 건은 종료로 간주하지 않는다(AGENTS: 미확인 ≠ 거짓). 큐에 남기고 `schedule_known:false`, 사유 `schedule_unknown`, 차단 조건 `schedule_unknown`(재확인 대상)을 붙이며, 날짜 기반 `availability` 판정은 하지 않는다. 우선순위는 P2(일정 확인부터).
- 건별 출력:
  - `state` (`verificationState`), `may_suggest_now` (`maySuggest`).
  - `suggest_blockers`: 추천 체인의 실제 조건을 실제 함수로 평가한 목록. 각 항목에 `recheck_addressable`(재확인으로 다룰 수 있는 조건인지) 표시. 코드: `publication_status`, `multi_site`, `verification_state`, `required_fields`, `admission`, `no_point`, `registration_closed`, `schedule_unknown`, `availability_on_date`, `session_end_unknown`.
  - `reasons`: 재확인 사유. `expired`(기한·경과 시간), `conflict`, `review_blocked`(열람 실패 이력), `never_reviewed`, `source_version_mismatch`, `cached_source`, `api_import`, `missing_required_fields`, `admission_not_walk_in`, `multi_site`, `no_point`, `no_sessions`, 형식 오류.
  - `sources`(URL·확인 필드·확인 시각), `evidence_urls`, `homepage`, `missing_required`, `unknown_fields`.
  - `priority`: P1 = 충돌·원문 변경, 또는 7일 내 개최이며 차단 조건이 전부 재확인 대상 필드. P2 = 7일 내 개최이나 재확인과 무관한 차단 있음, 또는 7일 이상 남았으나 차단이 전부 재확인 대상. P3 = 나머지. `priority_basis_ko`에 근거를 적는다.
- 집계: 상태·우선순위·사유·차단 조건(중복 집계)·차단 조건 조합·지금 추천 가능 건수·차단 조건이 전부 재확인 대상인 건수.

## 절차 (수동, 예약 없음)

1. **큐 생성**: 위 명령으로 당일 큐를 만든다. `exports/recheck-queue-<날짜>.md`를 작업 목록으로 쓴다.
2. **P1부터 원문 확인**: 각 건의 `sources` URL을 직접 연다(브라우저). 확인 대상은 `missing_required`와 `unknown_fields`에 적힌 필드, 그리고 `reasons`가 가리키는 항목(충돌이면 충돌 내용, `review_blocked`면 이전 실패 URL). 캐시·검색엔진 사본은 직접 확인이 아니다(`cached_source` 유지).
3. **기록**: 확인 결과를 `data/verification.json`의 해당 ID에 적는다. 바꾸는 값은 `checked_at`(실제 확인 시각), `recheck_after`(확인 시각 + 정책 주기), `sources[].checked_at`, 확인된 `verified_fields`, 해소된 `unknown_fields`, `admission`, `conflict`/`notes_ko`. **원문이 달라졌으면** `source_version`이 바뀌므로 조사 스냅샷부터 갱신해야 하며(`scripts/prepare-data.py`는 버전 불일치 시 중단), 바뀐 사실을 `patch`로 반영한다. 확인하지 않은 필드를 `verified_fields`에 넣지 않는다.
4. **재생성·검증**: `python3 scripts/prepare-data.py` → `node scripts/verification-queue.mjs`(공개용 상태 집계) → `npm test` → 큐를 다시 만들어 해당 건이 빠졌는지 본다. 빌드·배포는 별도 승인.
5. **보고**: 큐의 전후 집계(`counts`)와 바뀐 ID 목록을 HANDOFF에 적는다. 재확인으로도 `required_fields`·`admission`·`no_point` 차단이 남는 건은 "재확인 완료, 추천 제외 유지"로 적는다.

## 하지 않는 것

- `recheck_after`를 확인 없이 연장하거나, `stale`을 `reviewed`로 취급하도록 정책을 바꾸지 않는다.
- 자동 스케줄(cron, Vercel cron)을 등록하지 않는다. 주기 결정은 사용자 승인 사항이다.
- 대량 수집·대량 자동 재조회를 하지 않는다. 큐는 수동 확인의 작업 목록이다.
- TourAPI 건(`api_import`)은 재배포 시 다시 수집되며, 공식 페이지 대조 없이는 `listed`를 넘지 않는다.

## 열린 결정 (사용자 판단 필요)

- 재확인 주기: 현재 데이터는 24시간. 수동 절차로는 유지가 불가능하므로 필드별 주기(예: 일정 7일, 요금 30일) 또는 행사 시작일 기준 주기를 설계해야 한다. 이 문서는 주기를 바꾸지 않는다.
- 재확인 담당과 도구: 브라우저 확인을 사람/에이전트 중 누가 하는지, 확인 기록을 `verification.json`에 어떤 형식으로 남길지(현재 수동 JSON 편집).
