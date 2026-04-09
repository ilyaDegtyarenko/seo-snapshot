# SEO Snapshot

A small CLI project for checking the SEO state of a URL set. The tool crawls pages, captures redirects, collects core SEO signals, and saves reports in `HTML` and `JSON`.

## Features

- read URLs from `config/targets.txt` and/or from `config/seo-snapshot.config.mjs`
- support `baseUrl` for relative paths
- follow redirects and store the redirect chain
- check title, description, canonical, H1, `lang`, OpenGraph, Twitter Card, and JSON-LD
- detect page-level issues and produce an overall issue breakdown
- save reports to `reports/`

## Project Structure

```text
.
├── bin/
├── config/
├── src/
├── test/
└── package.json
```

## Run

```bash
pnpm run snapshot
```

Direct CLI usage:

```bash
node ./bin/seo-snapshot.mjs
```

Help:

```bash
node ./bin/seo-snapshot.mjs --help
```

## CLI Options

```bash
pnpm run snapshot -- \
  --config ./config/seo-snapshot.config.mjs \
  --output-dir ./reports \
  --format html,json \
  --timeout-ms 15000 \
  --max-redirects 10 \
  --concurrency 4
```

## Config

Example `config/seo-snapshot.config.mjs`:

```js
export default {
  baseUrl: 'http://127.0.0.1:3000',
  targetsFile: './targets.txt',
  targets: [
    '/',
    '/news',
  ],
  output: {
    dir: '../reports',
    formats: [ 'html', 'json' ],
  },
  request: {
    timeoutMs: 15_000,
    maxRedirects: 10,
    concurrency: 4,
    userAgent: 'Mozilla/5.0 (compatible; SEO-Snapshot/1.0)',
  },
  audit: {
    minTitleLength: 15,
    maxTitleLength: 60,
    minDescriptionLength: 70,
    maxDescriptionLength: 160,
    minBodyTextLength: 250,
  },
}
```

## What The Audit Includes

- page status and fetch errors
- redirect chain
- title and its length
- meta description and its length
- canonical presence
- `lang` on `<html>`
- H1 and multiple-H1 cases
- `og:title`, `og:description`, `og:image`
- `twitter:card`
- JSON-LD and parsing errors
- `noindex` markers
- visible text volume

## Tests

```bash
pnpm test
```

## Output

After running the tool, files like these are created in `reports/`:

```text
reports/seo-report-20260409-110000-000.html
reports/seo-report-20260409-110000-000.json
```
