# 디자인 명세 편집기 구현 계획

참고: UI/UX 명세 v0.1, 디자인 HTML 6장(Main, DesignSystem, Rules, Motion, Compare, Empty)

## 결정 사항 (제안)
- 스택: Vite + React + TypeScript, Tailwind v4 + shadcn/ui, Pretendard
- 캔버스: @xyflow/react (React Flow), 상태: Zustand + immer + zundo(undo)
- 모션: Motion(framer-motion), 저장: 처음엔 IndexedDB(Dexie), 나중에 서버
- 시안 렌더링: 이미지가 아니라 "화면 명세 트리"(토큰을 참조하는 컴포넌트 트리)를 직접 렌더링한다. 그래야 토큰을 바꿨을 때 시안이 바로 갱신된다.
- 기준 화면: 처음엔 스크린샷 업로드만 받고, URL 캡처(Playwright 서버)는 나중에 붙인다.

## 0. 기반
- [ ] Vite + React + TS + Tailwind v4 + shadcn/ui 초기화, 린트/테스트(Vitest) 설정
- [ ] 디자인 토큰을 CSS 변수로 정의 (primary #000, surface #F5F5F7, accent #0085E4, hairline #DADCE0, warn #F9BA0D, change #F8521F, radius 8px, Pretendard)
- [ ] shadcn 테마 매핑과 Button 변형(Primary/Filled/Ghost/Accent), Badge(기준/시안), Tabs, Sheet, Slider, Table, Input
- [ ] 앱 셸: 상단 바(제목, 저장 안 됨 점, 보기 전환, 공유, 명세 내보내기) + 캔버스 + 검사기

## 1. 데이터 모델과 저장
- [ ] 타입: Project, Screen(기준 이미지, 시안 버전, 상태, 크기), Transition(출발 요소, 트리거, 조건, 모션), Token, Component, Asset, Rule, MotionPreset, SourceMapping
- [ ] Zustand 스토어 + undo/redo, dirty 플래그
- [ ] IndexedDB 저장/불러오기, JSON 가져오기/내보내기
- [ ] 예시 프로젝트 "결제 흐름 개편" 시드 데이터

## 2. 흐름 보기
- [ ] React Flow 화면 노드(썸네일, 이름, 기준/시안 배지, 변경 점, 경고 아이콘)
- [ ] 전이 화살표(라벨, 점선 = 조건부), 확대/축소 컨트롤
- [ ] hover 미리 보기 팝오버 + 기준/시안 토글
- [ ] 클릭하면 검사기(속성, 변경 내역, 규칙, 소스 매핑, 나가는 전이)
- [ ] 화면 속 요소를 다른 노드로 끌어 전이 생성
- [ ] 빈 프로젝트 상태(화면 추가, 스크린샷 올리기), 기준 이미지 없음 자리표시자

## 3. 시안 렌더러와 변경 감지
- [ ] 화면 명세 트리 렌더러(토큰을 CSS 변수로 주입)
- [ ] 기준 대비 변경 diff 계산, 변경 점 표시, 클릭하면 변경 내역

## 4. 디자인 시스템 보기
- [ ] 토큰 표 + 검사기 값 편집(빠른 선택), 쓰는 시안 수와 즉시 갱신
- [ ] 컴포넌트 변형 × 상태 갤러리, 에셋 목록

## 5. 규칙 보기
- [ ] 규칙 엔진(순수 함수): 주요 버튼 하나, 터치 영역 48px, 막다른 화면 없음, 색은 토큰만, 모션 줄이기 대체 동작
- [ ] 규칙 카드 목록(연결 화면 수, 위반), 노드 경고와 연동

## 6. 모션 보기와 비교 서랍
- [ ] 프리셋 목록/편집(길이, 이징, 방향, 모션 줄이기 대체)
- [ ] 두 화면 전환 재생기(재생, 스크러버, 모션 줄이기 미리 보기)
- [ ] Shift+클릭 비교 서랍: 나란히 / 겹쳐 보기 + 투명도 슬라이더, 전이 정보

## 7. 내보내기와 이후
- [ ] 명세 내보내기(Markdown + JSON)
- [ ] (나중) 서버 저장과 공유 링크, URL 자동 캡처, 실제 앱 iframe 렌더링

## 열린 질문
- [ ] 대상 앱: 웹(React)인가, 모바일 네이티브인가
- [ ] 기준 화면: 수동 스크린샷으로 충분한가, URL 자동 캡처가 필요한가
