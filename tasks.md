# 디자인 명세 편집기 구현 계획

참고: UI/UX 명세 v0.1, 디자인 HTML 6장(Main, DesignSystem, Rules, Motion, Compare, Empty)

## 결정 사항 (제안)
- 스택: Vite + React + TypeScript, Tailwind v4 + shadcn/ui, Pretendard
- 캔버스: @xyflow/react (React Flow), 상태: Zustand + immer + zundo(undo)
- 모션: Motion(framer-motion), 저장: 처음엔 IndexedDB(Dexie), 나중에 서버
- 시안 렌더링: 이미지가 아니라 "화면 명세 트리"(토큰을 참조하는 컴포넌트 트리)를 직접 렌더링한다. 그래야 토큰을 바꿨을 때 시안이 바로 갱신된다.
- 기준 화면: 처음엔 스크린샷 업로드만 받고, URL 캡처(Playwright 서버)는 나중에 붙인다.

## 0. 기반
- [x] Vite + React + TS + Tailwind v4 + shadcn/ui 초기화, 테스트(Vitest) 설정
- [x] 린트(Biome) 설정 — 처음엔 빠져 있었고 나중에 추가
- [x] 디자인 토큰을 CSS 변수로 정의 (primary #000, surface #F5F5F7, accent #0085E4, hairline #DADCE0, warn #F9BA0D, change #F8521F, radius 8px, Pretendard)
- [x] shadcn 테마 매핑과 Button 변형(Primary/Filled/Ghost/Accent), Slider, Input, Dialog, Dropdown (보기 전환 탭과 기준/시안 배지는 직접 만든 컴포넌트)
- [x] 앱 셸: 상단 바(제목, 저장 안 됨 점, 보기 전환, 공유, 명세 내보내기) + 캔버스 + 검사기

## 1. 데이터 모델과 저장
- [x] 타입: Project, Screen(기준 이미지, 시안 버전, 상태, 크기), Transition(출발 요소, 트리거, 조건, 모션), Token, Component, Asset, Rule, MotionPreset, SourceMapping
- [x] Zustand 스토어 + undo/redo, dirty 플래그
- [x] IndexedDB 저장/불러오기, JSON 가져오기/내보내기
- [x] 예시 프로젝트 "결제 흐름 개편" 시드 데이터

## 2. 흐름 보기
- [x] React Flow 화면 노드(썸네일, 이름, 기준/시안 배지, 변경 점, 경고 아이콘)
- [x] 전이 화살표(라벨, 점선 = 조건부), 확대/축소 컨트롤
- [x] hover 미리 보기 팝오버 + 기준/시안 토글
- [x] 클릭하면 검사기(속성, 변경 내역, 규칙, 소스 매핑, 나가는 전이)
- [x] 화면 속 요소를 다른 노드로 끌어 전이 생성
- [x] 빈 프로젝트 상태(화면 추가, 스크린샷 올리기), 기준 이미지 없음 자리표시자

## 3. 시안 렌더러와 변경 감지
- [x] 화면 명세 트리 렌더러(토큰을 CSS 변수로 주입)
- [x] 기준 대비 변경 diff 계산, 변경 점 표시, 클릭하면 변경 내역

## 4. 디자인 시스템 보기
- [x] 토큰 표 + 검사기 값 편집(빠른 선택), 쓰는 시안 수와 즉시 갱신
- [x] 컴포넌트 변형 × 상태 갤러리, 에셋 목록

## 5. 규칙 보기
- [x] 규칙 엔진(순수 함수): 주요 버튼 하나, 터치 영역 48px, 막다른 화면 없음, 색은 토큰만, 모션 줄이기 대체 동작
- [x] 규칙 카드 목록(연결 화면 수, 위반), 노드 경고와 연동

## 6. 모션 보기와 비교 서랍
- [x] 프리셋 목록/편집(길이, 이징, 방향, 모션 줄이기 대체)
- [x] 두 화면 전환 재생기(재생, 스크러버, 모션 줄이기 미리 보기)
- [x] Shift+클릭 비교 서랍: 나란히 / 겹쳐 보기 + 투명도 슬라이더, 전이 정보

## 7. 내보내기와 이후
- [x] 명세 내보내기(Markdown + JSON)

## 8. 개선
- [x] hover 미리 보기 지연(350ms)과 드래그·이동 중 닫기
- [x] 좁은 화면: 검사기를 오버레이로
- [x] 보기별 코드 분할로 번들 축소
- [x] 내보내기 파일 다운로드 브라우저 확인

## 9. 서버
- [x] Bun 서버 + SQLite 프로젝트 저장/목록 API
- [x] 클라이언트 서버 저장과 프로젝트 열기
- [x] 공유 링크(스냅샷) 만들기와 열기
- [x] URL 자동 캡처(헤드리스 크롬)로 기준 스크린샷
- [x] React 앱 라이브 시안: 화면별 앱 URL을 iframe으로 띄우고 토큰을 postMessage 브리지로 주입

## 구현 메모
- 개발: `bun install && bun run dev` (Vite 5173 + API 서버 5180, /api는 Vite가 프록시)
- 운영: `bun run build && bun run start` (한 포트에서 dist와 /api를 함께 서빙, 기본 5180)
- 검증: `bun run typecheck`, `bun run lint`, `bun run test`(Vitest + bun test server), `bun run build`
- 환경 변수: `PORT`, `SEAM_DATA_DIR`(SQLite 위치, 기본 ./data), `SEAM_CHROME_PATH`(URL 캡처용 Chrome)
- 저장: 브라우저 IndexedDB에 먼저 저장하고 서버에도 올림. 서버가 꺼져 있으면 "로컬에만 저장됨" 표시
- 공유: 링크는 그 순간의 사본. 받은 사람이 열면 새 프로젝트로 복제됨
- 라이브 시안: 대상 React 앱에 `<script src="<편집기 주소>/seam-bridge.js"></script>`를 넣고, 앱 스타일이 `--accent` 같은 토큰 이름의 CSS 변수를 쓰면 토큰 변경이 바로 반영됨. 예시는 `public/demo/checkout.html`
- URL 캡처는 서버가 주는 URL을 그대로 여는 기능이라 내부망 주소도 열 수 있음. 외부에 공개할 때는 허용 주소 제한이 필요함

## 열린 질문
- [x] 대상 앱: 웹(React)으로 확정 (10월 25일)
- [ ] 기준 화면: 수동 스크린샷으로 충분한가, URL 자동 캡처가 필요한가 (지금은 둘 다 지원)
