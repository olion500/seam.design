---
name: seam
description: Use seam, the design spec editor, on this repository. Use when the user asks to import the app's screens into seam, capture baseline screenshots, open the seam editor, or apply/verify the design changes they made in seam (token, screen element, or flow edits under .seam/).
---

# seam

seam keeps a design spec of this app in `.seam/`: screens captured from the running app (the baseline), design tokens and screen flows read from the code, and the edits the user makes in the seam editor. You orchestrate it: the `seam` CLI does the deterministic parts (parsing, capturing, diffing) and prints JSON; you do the judgment (running the app, choosing screens, editing code, deciding whether a result matches).

Run the CLI as:

```sh
{{SEAM}} <command> [--repo <repo root>]
```

Every command prints JSON. A JSON object with `error` means the command failed; read the message, fix the cause, and retry.

## Ground rules

- This repository's own rules come first. Read `AGENTS.md`, `CLAUDE.md`, and any docs they point to before changing code, and follow their workflow (issue tracking, approvals for navigation changes, UX or copy review, branch and commit rules). A seam change set is a request from the user, not an approval to skip those steps.
- Never edit `.seam/project.json` by hand to make checks pass. The user edits it through the editor; you change the code and let `seam verify` judge.
- Report to the user in their language: what you changed, which checks passed, and anything you could not verify.

## Workflow A: import the app into seam

1. `seam init` writes a draft `.seam/seam.json`. Check every field against the repo and fix it:
   - `app.command` and `app.url`: how to run the app on the web and where it listens (Expo web is usually `http://localhost:8081`).
   - `routes.dir`: the Expo Router `app/` directory.
   - `tokens.file` / `tokens.exports`: the module that exports the design tokens (hex colors and text styles are picked up).
   - `flows.file`: a Markdown file with Mermaid flowcharts whose nodes look like `ID["ID · name /route"]`, if the repo has one.
   - `screens.include`: the routes to capture first (start with a few). `screens.params`: sample values for dynamic routes, e.g. `{ "/bean/[id]": { "id": "<real id>" } }`.
2. `seam import` builds `.seam/project.json` from routes, flows and tokens. It is safe to rerun; screen positions, baselines and user edits are kept.
3. Start the app (`app.command`) in the background and wait until `app.url` responds. Keep its file watching on: do not set `CI=true` (Expo/Metro disable reloads in CI mode), or later `seam verify` captures will show the old code.
4. `seam capture [screen ids] [--device iphone|galaxy]` emulates the project's phone (`iphone` = iPhone 18 Pro 402×874, the default; `galaxy` = Galaxy S26 360×780; the user can switch it in the editor) and saves a screenshot and the visible elements (role, label, box) of each screen. Look at the screenshots in `.seam/screens/`. Each screen is opened with the app's saved browser data cleared, so it shows the app's first-run data. States without their own URL (a later step of a wizard, a modal, a timer phase) go in `screens.states` of `.seam/seam.json`, keyed by the flow node ID: `{ "PREP2": { "open": "/prepare", "route": "/prepare", "steps": [{ "tap": "원두, 에티오피아 구지" }, { "tap": "레시피 고르기" }] } }`. `open` is the path to load (it may carry a query such as `/record?id=j1`), `route` is the route file that draws it, and each `tap` names a button by its accessible name or text; capture fails with an error naming the step it could not find. Run `seam import` after editing states. If a screen is empty or wrong because it needs data, a login, or a particular state, fix that (sample data, params, states) and capture again rather than accepting a misleading baseline.
5. `seam open` starts the editor on this repo's `.seam/` (default `http://localhost:5190/`). Keep it running in the background and give the user the URL.
6. Tell the user to press **AI에게 보내기** in the editor when their requests are ready, and run `seam wait` (see below). When it returns, continue with Workflow B from step 2.

## Waiting for the user's send

The editor has an **AI에게 보내기** button (repo mode only). It saves the project and drops `.seam/changes/sent.json` with an optional message from the user.

- `seam wait` blocks until that file appears, consumes it, writes the change set exactly like `seam changes`, and prints `{ "sent": true, "messages": [{ "at", "text" }], "count", "changes", ... }`. If the user already pressed send before you started waiting, it returns at once.
- While it runs, the editor shows the user that an AI is waiting.
- Your shell may cap how long a command can run. Then use `seam wait --timeout <seconds>` below that cap; on `{ "sent": false, "timedOut": true }` run it again. Do not treat a timeout as the user being done.
- `messages` are instructions from the user for this round. Read them together with the change set; they win over your own guesses. `count: 0` with messages means the user is asking something without new edits.
- After you finish a round (`seam done`, or a report to the user), run `seam wait` again if the user wants to keep iterating in the editor.

## Workflow B: apply the user's seam changes to the code

1. `seam changes` (or the output of `seam wait`) writes `.seam/changes/pending/change.json` and `README.md` and prints the list. Kinds:
   - `token`: `path` (e.g. `colors.primary`) in `file` at `line` goes from `before` to `after`.
   - `element`: on screen `screen` (`route`, source files in `sources`), the element `element` (role, label, box in the baseline screenshot `baselineImage`) should get the new text `label` and/or follow the free-form `note`. Instead of an element, the user may have drawn an `area` (x, y, w, h in screen CSS px of the baseline screenshot): the note is about whatever is inside that rectangle, so look at that part of `baselineImage` to find the code. With neither, the note is about the whole screen.
   - `transition`: a flow edge was `added` or `removed`. Update the navigation code and the flow document (`flows.file`) together, following the repo's navigation rules.
2. Plan the code edits. Find the code behind each element from `sources`, the element label, and the screenshot. If a change is ambiguous or conflicts with the repo's rules, ask the user instead of guessing.
3. Edit the code and run the repo's own checks (typecheck, lint, tests).
4. With the app running, `seam verify`. It checks token values in the token file, looks for new labels on a fresh capture, checks flow edges in the flow document, and saves after-screenshots in `.seam/changes/pending/after/`.
   - `fail`: not applied yet, or the app is still serving old code. Check the after-screenshot; if it shows the old UI, restart the dev server (with its cache cleared) and verify again before touching the code.
   - `review`: needs your judgment. Compare the baseline and after images for that screen and decide whether the note is satisfied; if not, keep working.
5. Let the user review. Tell them the result is ready and to press **검토** in the editor, then run `seam wait`. The editor shows each change with its baseline and after-screenshot side by side; the user approves or sends items back with a note.
   - `review.approved: true`: the editor already ran `seam done` (after-screenshots became the new baseline, requests were cleared, the set is archived under `review.archived`). Report what changed. Commit `.seam/` together with the code change if the repo tracks it.
   - `review.approved: false`: `review.rejected` lists the changes sent back, each with the user's `note` and the `change` it refers to. Fix those (the approved ones stay as they are), run the repo's checks, `seam verify` again, and wait for the next review.
   - Only run `seam done` yourself when the user tells you so in the chat instead of using the editor.

## Render modes and live token preview

`app.render` in `.seam/seam.json` (also switchable in the editor) is `live` or `capture`:

- `live`: the editor shows each screen as the running app (`app.url` + route) in an iframe, and falls back to the screenshot when the app is not running. Baselines are still screenshots from `seam capture`; the live view is the current code.
- `capture`: the editor shows screenshots only.

In live mode the editor appends `?seam-tokens=<JSON>` to every app URL: an object of token source paths to edited values, e.g. `{"colors.primary":"#3F5A2E","typography.title":"40 / 400"}` (`{}` when nothing is edited). Apps whose tokens are CSS variables can use `seam-bridge.js` instead. For apps whose tokens are JS objects, add a development-only hook to the token module: read the parameter (keep it in sessionStorage so in-app navigation keeps it), and apply each path to the exported objects before other modules use them; for `fontSize / fontWeight` values set both fields. Never ship it in production builds, and follow the repo's rules for that code change.

## Other commands

- If the editor shows that some baseline screenshots were taken at another device size (the user switched devices), run `seam capture` again with the app running.

- `seam verify --no-capture`: check tokens and flows without running the app (element items become `review`).
- `seam done --force`: archive even with failures. Only when the user explicitly says so (approving every item in the editor's review counts, and the editor does it for you).
- `seam skill install --dir <repo>`: install this skill into another repository.
