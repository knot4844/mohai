# 모해 공통 화면 실행

4182는 더 이상 별도 시제품을 제공하지 않습니다.

프로젝트 루트에서 Node24로 `node previews/course-lab/server.mjs`를 실행합니다.
http://127.0.0.1:4182/?view=2d

- UI: public/index.html + public/course/* (운영과 동일)
- 원장: 운영 /data.json을 읽기 전용 전달
- 검색: 운영 /api/config, /api/nearby, /api/naver/{local,blog,trend}만 전달
- 비밀키 로컬 복제 없음. 위치검색 요청 좌표는 운영을 통해 제공자에 전달됩니다.
- 4173 기본 서버는 개발용 로컬 데이터/환경을 사용합니다.
- 이 폴더의 과거 UI 파일은 실행되지 않습니다. 수정은 public/course에서 합니다.
