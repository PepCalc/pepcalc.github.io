# Every target runs on the Node version in .nvmrc (via nvm when available).
SHELL := /bin/bash
NODE := source $$HOME/.nvm/nvm.sh >/dev/null 2>&1 && nvm use >/dev/null 2>&1; 

.PHONY: install check serve format build

install:
	$(NODE) npm ci

## Gate: formatting, sitemap, script-free pages, links and anchors, em-dashes.
check:
	$(NODE) npm run check

## Rebuild site/sitemap.xml from the pages.
build:
	$(NODE) npm run build

## Serve site/ at http://localhost:4174/.
serve:
	$(NODE) npm run serve

format:
	$(NODE) npm run format
