.DEFAULT_GOAL := help
.PHONY: help bun-check install dev dev-web dev-server build start test lint typecheck check clean

PORT ?= 5180
BUN := $(shell command -v bun 2>/dev/null)

help: ## 사용할 수 있는 명령 보기
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-11s %s\n", $$1, $$2}'

bun-check:
	@if [ -z "$(BUN)" ]; then \
		echo "bun이 없습니다. 'mise install'(이 레포의 mise.toml에 bun 1.4.3 고정)이나"; \
		echo "'curl -fsSL https://bun.sh/install | bash'로 설치한 뒤 다시 실행하세요."; \
		exit 1; \
	fi

node_modules: package.json bun.lock | bun-check
	bun install
	@touch node_modules

install: node_modules ## 의존성 설치

dev: node_modules ## 개발 서버 실행 (Vite 5173 + API 5180)
	bun run dev

dev-web: node_modules ## 프런트엔드만 실행 (Vite 5173)
	bun run dev:web

dev-server: node_modules ## API 서버만 실행 (5180)
	bun run dev:server

build: node_modules ## 타입체크 후 프로덕션 빌드 (dist/)
	bun run build

start: build ## 빌드한 앱과 API를 한 포트로 실행 (PORT=5180)
	PORT=$(PORT) bun run start

test: node_modules ## Vitest와 서버 테스트 실행
	bun run test

lint: node_modules ## Biome 린트
	bun run lint

typecheck: node_modules ## 앱과 서버 타입체크
	bun run typecheck

check: lint typecheck test ## 린트, 타입체크, 테스트 한 번에

clean: ## 빌드 결과 삭제 (data/는 지우지 않음)
	rm -rf dist
