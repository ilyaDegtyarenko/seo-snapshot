# SEO Snapshot

A small CLI project for checking the SEO state of a URL set. The tool crawls pages, captures redirects, collects core SEO signals, and saves reports in `HTML` and `JSON`.

## Features

- read URLs from `config/targets.txt`, local sitemap XML dumps, and/or from `config/seo-snapshot.config.mjs`
- support `baseUrl` for relative paths
- compare the same target path across two domains and show SEO differences
- follow redirects and store the redirect chain
- check title, description, canonical, H1, `lang`, response `Link` headers, `hreflang`, OpenGraph, Twitter Card, and JSON-LD
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

After each run the CLI now prints a short English summary and a `file://` link to the main report.

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
  --concurrency 4 \
  --user-agent "Mozilla/5.0 (compatible; MyBot/1.0)"
```

## Environment Config

You can pass config through environment variables. Place them in a `.env` file at the project root — `pnpm run snapshot` loads it automatically:

```bash
SEO_SNAPSHOT_BASE_URL=https://example.com
SEO_SNAPSHOT_TARGETS=/,/news,/about
```

Compare mode via env:

```bash
SEO_SNAPSHOT_BASE_URL=https://www.example.com
SEO_SNAPSHOT_COMPARE_BASE_URL=https://stage.example.com
SEO_SNAPSHOT_TARGETS=/,/news
```

See `.env.example` for all available variables.

Alternatively, pass variables inline in two ways.

Full config as JSON:

```bash
SEO_SNAPSHOT_CONFIG='{"baseUrl":"http://127.0.0.1:3000","targets":["/","/news"],"output":{"dir":"./reports","formats":["html","json"]}}' \
node ./bin/seo-snapshot.mjs
```

File config plus env overrides:

```bash
SEO_SNAPSHOT_CONFIG_PATH=./config/seo-snapshot.config.mjs \
SEO_SNAPSHOT_BASE_URL=http://127.0.0.1:3000 \
SEO_SNAPSHOT_TARGETS="/,/news,/movies" \
SEO_SNAPSHOT_OUTPUT_FORMATS=html,json \
SEO_SNAPSHOT_REQUEST_CONCURRENCY=8 \
node ./bin/seo-snapshot.mjs
```

Supported overrides:

- `SEO_SNAPSHOT_CONFIG_PATH`
- `SEO_SNAPSHOT_CONFIG`
- `SEO_SNAPSHOT_BASE_URL`
- `SEO_SNAPSHOT_COMPARE_BASE_URL` as URL string or `{ "url": "...", "label": "..." }` JSON object
- `SEO_SNAPSHOT_TARGETS_FILE`
- `SEO_SNAPSHOT_TARGETS` as JSON array or comma/newline-separated list
- `SEO_SNAPSHOT_OUTPUT_DIR`
- `SEO_SNAPSHOT_OUTPUT_FORMATS`
- `SEO_SNAPSHOT_REQUEST_TIMEOUT_MS`
- `SEO_SNAPSHOT_REQUEST_MAX_REDIRECTS`
- `SEO_SNAPSHOT_REQUEST_CONCURRENCY`
- `SEO_SNAPSHOT_REQUEST_USER_AGENT`
- `SEO_SNAPSHOT_REQUEST_COOKIES`
- `SEO_SNAPSHOT_AUDIT_MIN_TITLE_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MAX_TITLE_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MIN_DESCRIPTION_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MAX_DESCRIPTION_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MIN_BODY_TEXT_LENGTH`

## Config

Example `config/seo-snapshot.config.mjs`:

```js
export default {
  baseUrl: 'http://127.0.0.1:3000',
  targetsFile: './targets.txt', // or './targets.local.xml' for a sitemap export
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
    cookies: 'session=abc123; token=xyz', // string or { key: value } object
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

Comparison mode example:

```js
export default {
  baseUrl: 'https://www.example.com',
  compare: {
    baseUrl: { label: 'stage', url: 'https://stage.example.com' },
  },
  targets: [
    '/',
    '/news',
    '/catalog?page=2',
  ],
}
```

When `compare.baseUrl` is set, the tool uses `baseUrl` as the primary domain and the compare URL as the secondary one. The same target path is fetched on both domains and the report adds a dedicated diff section. The following fields are compared between domains:

- fetch error, parse-skipped reason
- HTTP status, final URL (path-normalised for source-local URLs)
- charset, title, meta description, canonical (path-normalised), canonical cross-domain flag
- meta robots, `X-Robots-Tag` header
- response `Link` header canonical, canonical cross-domain flag, `llms`, and parsed header entries
- `lang`, `Content-Language`, viewport, application name, theme color
- manifest, favicon, icon links
- H1 list
- hreflang alternates, alternate resources (feeds, etc.)
- `rel=prev` / `rel=next` pagination links
- OpenGraph: title, description, type, site name, locale, locale alternates, URL (path-normalised), URL cross-domain flag, image, image alt, video
- Twitter: card, title, description, URL (path-normalised), image, image alt
- App links: `apple-itunes-app`, `al:ios:*`, `al:android:*`
- JSON-LD: script count, parse errors, schema types, `WebSite`/`Organization` presence, block signatures
- duplicate head-tag signals
- visible body text length
- issue code sets (per-domain diff)

Recommended local setup for targets:

- keep `config/targets.txt` ignored and local-only
- commit `config/targets.example.txt` as the shared template
- for sitemap exports, point `targetsFile` to a local XML file such as `./targets.local.xml`

## What The Report Includes

Each page record contains:

- page status and fetch errors
- redirect chain
- all extracted SEO signals (see below)
- per-page issue list with severity (`error` / `warning` / `info`)
- overall summary: total pages, pages with issues, failed pages, redirected, noindex count, issue breakdown by code

### Audit checks (produce issues)

The following fields are actively checked and generate issues if missing or out of range:

- **title** — missing, too short (`< minTitleLength`), too long (`> maxTitleLength`)
- **meta description** — missing, too short, too long
- **H1** — missing, or multiple H1s on one page
- **`lang` attribute on `<html>`** — missing
- **canonical link** — missing
- **canonical host consistency** — warning when canonical points to another host; warning when response `Link` canonical conflicts with HTML canonical
- **`noindex`** — detected in `meta[name="robots"]` or `X-Robots-Tag` header
- **meta robots tag** — missing (`info` severity)
- **hreflang on homepage-like routes** — missing (`info` severity)
- **hreflang integrity** — invalid entries, missing `x-default`, missing self-locale entry, or cross-domain targets (`warning`)
- **og:title, og:description, og:image** — missing (`info` severity)
- **twitter:card** — missing (`info` severity)
- **JSON-LD** — no structured data blocks found (`info`), or parse errors in existing blocks (`warning`)
- **homepage JSON-LD coverage** — missing `WebSite` or `Organization` schema on homepage-like routes (`info`)
- **response `Link` `llms` target** — warning when it points to another host
- **visible body text** — shorter than `minBodyTextLength`
- **HTTP status** — 4xx produces a warning, 5xx produces an error
- **duplicate head tags** — repeated `<title>`, `meta[name="description"]`, `meta[name="robots"]`, canonical, viewport, og:title/description/type/url/image, twitter:card/title/description/image, manifest, `apple-itunes-app`

### Extracted signals (displayed in report, no issues raised)

The following fields are collected and shown in the report but do not trigger audit issues:

- `charset`, `Content-Language`, viewport value, application name, theme color
- raw response `Link` header plus parsed relation entries
- manifest URL, favicon, all icon links
- full OpenGraph data: type, URL, site name, locale, locale alternates, image alt, video
- full Twitter data: title, description, URL, image alt
- app deep links: `apple-itunes-app`, `al:ios:*`, `al:android:*`
- hreflang alternates, alternate resources (feeds, etc.)
- `rel=prev` / `rel=next` pagination links
- JSON-LD schema types, `WebSite`/`Organization` flags, block signatures, and previews
- visible body text length

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

Supported targets file inputs:

- plain text lists with one target per line
- sitemap XML dumps with `<url><loc>...</loc></url>` entries
