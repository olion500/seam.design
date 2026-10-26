# src/model

## OVERVIEW
순수 도메인 계층: 타입, 시드, 기준/시안 diff, 규칙 엔진, 토큰 변환, 내보내기·파싱. 이 디렉터리에 AGENTS.md를 둔 이유는 웹 앱뿐 아니라 `server/`와 `cli/`도 직접 import하는 공유 경계이기 때문이다(점수 약 11, 참조 중심성이 가장 높음).

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| 데이터 형식 변경 | `types.ts` | `Project`가 IndexedDB, SQLite, `.seam/project.json`에 그대로 저장된다 |
| 새 규칙 | `types.ts`(`RuleCheck`) + `rules.ts`(`runRule` switch) + `seed.ts` | `collectWarnings`가 노드 경고로 연결 |
| 변경 감지 | `diff.ts` | change id 형식 `layout:gap`, `edit:<id>`, `add:<id>`, `remove:<id>` |
| 토큰 -> CSS | `tokens.ts` | `tokenVars`(명세 렌더러), `bridgeVars`(라이브 iframe), `colorRef`/`lengthRef` |
| 내보내기·가져오기 | `exportSpec.ts` | `toMarkdown`, `toJSON`, `parseProject`(서버 요청 검증에도 사용) |
| 기기 | `devices.ts` | `deviceOf`는 모르는 id를 기본 기기로 대체 |
| 예시 프로젝트 | `seed.ts` | "결제 흐름 개편". 테스트가 이 데이터에 의존 |

## CONVENTIONS
- 내부 import는 `./` 상대 경로만 쓴다. `@/` 별칭은 금지(server/cli의 tsconfig에서 깨짐). 테스트 파일만 예외.
- 런타임 의존성 없음. `react`는 `tokens.ts`에서 `import type`만 허용된다.
- 모든 함수는 순수하다: 스토어, DOM, fetch, 파일 시스템에 접근하지 않는다.
- 색 속성(`fill`, `stroke`)은 토큰 이름 또는 raw hex를 담는다. raw hex는 `token-colors` 규칙이 잡아낸다.

## ANTI-PATTERNS
- `Project` 필드를 바꾸면서 하위 호환을 무시하지 않는다. 기존 IndexedDB와 SQLite 데이터, 대상 레포의 `.seam/project.json`이 옛 형식으로 남아 있다. 새 필드는 optional로 추가한다.
- `seed.ts`를 고칠 때 `model.test.ts`의 기대값(예: payment 화면의 변경 3개)을 함께 확인한다.

## TESTS
- `model.test.ts`(Vitest): diff, 규칙, 내보내기 왕복, `@/lib/transition` 이징을 함께 검증한다.
- 실행: `bun run test` 또는 `bunx vitest run src/model`.
- 이 디렉터리를 바꾸면 `bun test server cli`도 돌린다. 서버의 `parseProject`, CLI의 `buildProject`·`pendingChanges`가 같은 타입에 의존한다.
