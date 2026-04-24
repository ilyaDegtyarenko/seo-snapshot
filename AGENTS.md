# Repository Guidelines

## Project Structure & Module Organization

`bin/seo-snapshot.mjs` is the CLI entrypoint. Core runtime code lives in `src/`: `config.mjs` loads config, `fetch-page.mjs` retrieves pages, `extract-seo.mjs` parses signals, `audit.mjs` and `compare.mjs` build findings, and `reporters.mjs` writes HTML/JSON output. `run-audit.mjs` orchestrates the full flow. Tests live in `test/` and generally mirror source modules, for example `src/compare.mjs` -> `test/compare.test.mjs`. Keep committed examples in `config/`; local runtime files and generated reports belong in ignored files under `config/` and `reports/`.

## Build, Test, and Development Commands

Use Node `>=22.9` with `pnpm`.

- `pnpm install`: install dependencies.
- `pnpm run snapshot`: run the CLI with `.env` loaded automatically if present.
- `pnpm run snapshot -- --help`: inspect supported flags before changing CLI behavior.
- `node ./bin/seo-snapshot.mjs`: run the entrypoint directly for focused debugging.
- `pnpm test`: run the full test suite with Node’s built-in test runner.

There is no separate build step; this repository is executed directly as ESM.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, LF, final newline, and 2-space indentation. Match the existing JavaScript style: ESM `.mjs` files, single quotes, no semicolons, camelCase identifiers, and kebab-case filenames such as `run-audit.mjs`. Prefer small, named exports and keep modules narrowly focused instead of adding large cross-cutting utilities.

## Testing Guidelines

Tests use `node:test` with `node:assert/strict`. Name new files `test/<module>.test.mjs` and mirror the module under test. Add or update tests whenever CLI parsing, config resolution, fetch behavior, SEO extraction, comparisons, or report generation changes. Run `pnpm test` before opening a PR.

## Commit & Pull Request Guidelines

Recent history mostly follows Conventional Commit prefixes like `feat:`, `fix:`, `refactor:`, and `style:`. Keep commit subjects short, imperative, and specific. PRs should summarize behavior changes, note any new flags or config fields, and include test coverage details. When HTML report output changes, attach a screenshot or sample output path so reviewers can validate the UI quickly.

## Configuration & Generated Files

Do not commit `.env`, `config/seo-snapshot.mjs`, `config/targets.json`, `config/targets.txt`, `config/targets.xml`, or anything under `reports/`. Start from the files in `config/*.example.*` and keep secrets or one-off overrides in `.env`.

When config behavior changes, update the examples in the same patch. That includes `.env.example`, `config/seo-snapshot.example.mjs`, and any affected `config/targets.example.*` files. If the change affects CLI flags or setup flow, update the matching README examples too so the documented path stays runnable.
