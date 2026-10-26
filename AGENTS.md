# PROJECT KNOWLEDGE BASE

**Generated:** 2026-10-26
**Commit:** a72d0fe
**Branch:** main

## OVERVIEW
seam: 디자인 명세 편집기. 앱 화면(기준 스크린샷 + 시안 명세 트리), 전이, 토큰, 규칙, 모션을 편집한다. Vite 8 + React 19 + Zustand(immer, zundo) 웹 앱, Bun + SQLite API 서버, 대상 레포의 `.seam/`을 다루는 AI 에이전트용 `seam` CLI와 스킬로 구성된다.

## STRUCTURE
```
seam.design/
├── src/
│   ├── model/        # 순수 도메인(타입, diff, 규칙, 내보내기, 시드). server와 cli도 import함 -> src/model/AGENTS.md
│   ├── store/        # useEditor(Zustand+immer+zundo), persist(IndexedDB -> 서버/레포 동기화)
│   ├── views/        # flow(React Flow 캔버스), System/Rules/Motion(lazy 로드)
│   ├── components/   # 앱 컴포넌트, inspector/, ui/(shadcn 생성물)
│   └── lib/          # api 클라이언트, 전이 이징, 파일 유틸
├── server/           # Bun.serve API: projects/shares(SQLite), capture(헤드리스 Chrome), repo 모드
├── cli/              # seam CLI(bun 실행, JSON 출력) -> cli/AGENTS.md
├── skill/seam/       # SKILL.md 원본. {{SEAM}}은 설치 시 CLI 절대 경로로 치환됨
├── public/           # seam-bridge.js(라이브 시안 토큰 주입), demo/checkout.html
├── tasks.md          # 구현 계획과 진행 상황(한국어). 작업 관리는 여기서
└── Makefile          # make 래퍼(한국어 help)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 편집기 상태/액션 추가 | `src/store/store.ts` | 모든 변경은 `useEditor` 액션으로. undo는 zundo `temporal` |
| 저장·동기화 동작 | `src/store/persist.ts` | IndexedDB 먼저, 이후 서버 또는 레포. 1.2초 디바운스 자동 저장 |
| 새 보기(탭) | `src/App.tsx`, `src/model/types.ts`(`View`) | 해시 라우팅 `#/flow` 등, 흐름 외 보기는 `lazy` |
| 캔버스 노드/엣지 | `src/views/flow/` | `ScreenNode`, `TransitionEdge`, hover 미리 보기 `preview.ts` |
| 검사기 패널 | `src/components/inspector/` | 가장 큰 파일들(373, 430줄) |
| API 엔드포인트 | `server/app.ts` | `createApp`은 의존성 주입(store, capture) -> 테스트에서 가짜 주입 |
| SQLite 스키마 | `server/db.ts` | projects, shares 두 테이블, JSON 통째 저장 |
| URL 캡처 | `server/capture.ts`(편집기), `cli/capture.ts`(CLI) | 둘은 별개 구현 |
| 라이브 시안 브리지 | `public/seam-bridge.js`, `src/components/LiveFrame.tsx` | postMessage `seam:tokens` / `seam:ready` |
| 기기 크기 | `src/model/devices.ts` | iphone 402x874(기본), galaxy 360x780 |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `Project` 외 도메인 타입 | types | `src/model/types.ts` | ~26 | 웹·서버·CLI 공용 데이터 형식 |
| `useEditor` | Zustand store | `src/store/store.ts` | ~20 | 편집기 단일 상태 |
| `cn` | fn | `src/lib/utils.ts` | 24 | Tailwind 클래스 병합 |
| `api` | object | `src/lib/api.ts` | 4 | `/api/*` 호출, 실패 시 `ApiError` |
| `createApp` | fn | `server/app.ts` | 2 | fetch 핸들러 팩토리 |
| `Store` | class | `server/db.ts` | 3 | bun:sqlite 저장소 |
| `parseProject` | fn | `src/model/exportSpec.ts` | 서버 | 요청 본문 검증·파싱 |

## CONVENTIONS
- 경로 별칭 `@/*` -> `src/*`는 웹 코드에서만 쓴다. `server/`, `cli/`는 `../src/model/...` 상대 경로로 import.
- tsconfig 세 개: 루트(web, DOM), `server/`, `cli/`(types: bun). `typecheck`가 셋 다 돌린다.
- 테스트 러너 두 개: Vitest(jsdom)는 `src/**/*.test.{ts,tsx}`만, `bun test`는 `server`와 `cli`.
- Biome는 린트만 켜져 있고 포매터는 꺼져 있다. `src/components/ui`는 린트 대상에서 제외.
- 사용자에게 보이는 문자열, 서버/CLI 오류 메시지, Makefile help는 한국어. 코드 식별자와 주석은 영어.
- id는 `crypto.randomUUID().slice(0, 8)`, 날짜 문자열은 `ko-KR` 로케일.
- 서버 오류 형식은 `{ error: string }`. 클라이언트 `request()`가 이를 `ApiError`로 바꾼다.
- vite 빌드는 react/xyflow/radix를 별도 청크로 나눈다(`codeSplitting.groups`).

## ANTI-PATTERNS (THIS PROJECT)
- `src/components/ui/*`는 shadcn 생성물: 손으로 크게 고치지 말고 래핑하거나 `bits.tsx`에 직접 만든 컴포넌트를 둔다.
- 스토어 밖에서 `project`를 직접 변경하지 않는다. 액션을 추가하면 undo와 dirty 판정(`project !== savedProject`)이 유지된다.
- 시안을 이미지로 저장하지 않는다. 시안은 토큰을 참조하는 명세 트리(`ScreenSpec`)이고, 그래야 토큰 변경이 즉시 반영된다.
- 색은 토큰 이름으로 참조한다. raw hex는 `token-colors` 규칙 위반으로 표시된다.
- URL 캡처는 받은 URL을 그대로 연다(내부망 포함). 외부 공개 시 허용 주소 제한이 필요하다.

## UNIQUE STYLES
- 디자인 토큰은 `src/index.css`의 CSS 변수(primary #000, surface #F5F5F7, accent #0085E4, hairline #DADCE0, warn #F9BA0D, change #F8521F, radius 8px, Pretendard).
- 저장 상태: `useSync.status` = `idle | saving | server | repo | local-only`. 서버가 꺼져 있어도 로컬 저장은 성공한다.
- 공유 링크(`#/share/<id>`)는 스냅샷이다. 열면 새 id를 가진 사본으로 복제된다.
- 레포 모드: `SEAM_REPO`가 설정되면 서버가 `<repo>/.seam/project.json`을 읽고 쓰고, `/repo/<파일>`로 스크린샷을 서빙한다.

## COMMANDS
```bash
mise install              # bun 1.4.3 고정(mise.toml)
make dev                  # = bun run dev: Vite 5173 + API 5180 (/api 프록시)
make check                # lint + typecheck + test
bun run test              # vitest run && bun test server cli
bun run build             # typecheck 후 vite build -> dist/
make start                # build 후 한 포트(PORT, 기본 5180)에서 dist + /api
bun cli/seam.ts <cmd>     # seam CLI (cli/AGENTS.md)
```

## NOTES
- 환경 변수: `PORT`, `SEAM_DATA_DIR`(SQLite 위치, 기본 `./data`, gitignore됨), `SEAM_CHROME_PATH`(`cli/capture.ts`에서만 읽음), `SEAM_REPO`, `NODE_ENV=production`(dist 서빙).
- 사용자는 자기 WSL 셸에서 `make`/`bun`을 실행한다. 실행 명령을 안내하기 전에 사용자 PATH(mise shim) 기준으로 동작하는지 확인한다.
- TypeScript 7, Vite 8(rolldown), Vitest 5, React 19 등 최신 메이저 버전이다. 옛 API를 가정하지 않는다.
- 남은 과제: 설치된 스킬 안의 CLI 경로가 이 머신 절대 경로라 다른 머신에서는 못 쓴다(`tasks.md` 참고).
