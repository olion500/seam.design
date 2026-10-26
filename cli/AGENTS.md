# cli

## OVERVIEW
`seam` CLI: 대상 레포의 `.seam/`을 만들고 캡처하고 diff하는 결정적 도구. AI 에이전트가 `skill/seam/SKILL.md`를 통해 호출한다. AGENTS.md를 둔 이유는 별도 런타임(Bun 전용, 자체 tsconfig)이고 다른 레포를 다루는 독립 도메인이기 때문이다(점수 약 9).

## STRUCTURE
| File | Role |
|------|------|
| `seam.ts` | 진입점(`#!/usr/bin/env bun`), 인자 파싱, 명령 분기: init, import, capture, open, changes, verify, done, skill install |
| `repo.ts` | `SeamConfig`, `.seam/` 경로 헬퍼, `buildProject`(재가져오기 시 이전 화면 위치·기준·편집 유지), `SeamError` |
| `parse.ts` | Expo Router 라우트, Mermaid 흐름(`ID["ID · 이름 /route"]`), 토큰 모듈 파싱 |
| `changes.ts` | `pendingChanges`: token / element / transition 변경 묶음과 Markdown |
| `capture.ts` | 헤드리스 브라우저 기기 에뮬레이션, DOM 요소(역할, 라벨, 박스) 추출 |
| `cli.test.ts` | bun:test. 임시 디렉터리에 가짜 레포를 만들어 테스트 |

## `.seam/` LAYOUT (대상 레포)
`seam.json`(설정) / `project.json`(편집기와 공유하는 `Project`) / `screens/*.png` / `changes/pending/`(change.json, README.md, after/) / `changes/<timestamp>/`(보관본)

## CONVENTIONS
- 모든 출력은 stdout에 `JSON.stringify(..., null, 2)`로 낸다. 실패하면 `{ "error": ... }`. 사람용 텍스트는 `HELP`뿐이다.
- 예상된 실패는 `SeamError`를 던진다(메시지는 한국어, 다음 행동 안내 포함).
- `--repo <경로>`가 공통 플래그이고 기본값은 cwd. `SEAM_ROOT`는 이 레포 루트다.
- 도메인 타입과 시드는 `../src/model/*`에서 상대 경로로 가져온다(`@/` 금지).
- 대상 앱 가정: Expo Router 웹, 기본 URL `http://localhost:8081`, 토큰 파일은 `theme.ts` 계열.
- `seam open`은 `dist/`가 없으면 먼저 `bun run build`를 하고, `SEAM_REPO`를 설정해 `server/index.ts`를 production 모드로 띄운다(기본 포트 5190).
- `seam skill install`은 SKILL.md의 `{{SEAM}}`을 `bun <절대경로>/cli/seam.ts`로 바꿔 `.claude/skills/seam`과 `.agents/skills/seam`에 복사한다.

## ANTI-PATTERNS
- CLI에 판단 로직(코드 수정, 화면 선택)을 넣지 않는다. 판단은 에이전트, 결정적 작업은 CLI가 맡는다.
- JSON이 아닌 출력을 stdout에 섞지 않는다. 에이전트가 파싱한다.
- 명령을 추가하거나 바꾸면 `HELP`, `skill/seam/SKILL.md`, `cli.test.ts`를 함께 갱신한다.
- `done --force`는 사용자가 명시적으로 요청했을 때만 쓴다(SKILL.md 규칙).

## COMMANDS
```bash
bun cli/seam.ts --help
bun cli/seam.ts import --repo ../coffee
bun test cli
tsc --noEmit -p cli
```
