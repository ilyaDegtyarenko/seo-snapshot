# SEO Snapshot

A small CLI for checking the SEO state of a URL set. The tool crawls pages, captures redirects, collects core SEO signals, and saves reports in `HTML` and `JSON`.

## Features

- read URLs from `config/targets.txt`, local sitemap XML dumps, inline config, and/or env overrides
- support `baseUrl` for relative paths
- compare the same target path across a primary and secondary domain and show SEO differences
- repeat the audit per User-Agent variant and keep variant labels in the reports
- follow redirects and store the redirect chain
- measure response time and capture security headers such as `Content-Security-Policy` and `X-Frame-Options`
- collect document metrics such as image counts, missing `alt` attributes, internal links, and heading hierarchy
- check title, description, canonical, H1, `lang`, robots directives, response `Link` headers, `hreflang`, OpenGraph, Twitter Card, JSON-LD, and visible body text
- detect page-level issues, duplicate head tags, and produce an overall issue breakdown
- support named config profiles, diff-only comparison output, browser auto-open, audit-code suppression, custom cookies, and custom request headers
- write per-page crawl progress to `stderr` and save reports to `reports/`

## Requirements

- Node.js `>= 22.9`
- `pnpm`

## Project Structure

```text
.
├── bin/
├── config/
├── src/
├── test/
└── package.json
```

## Quick Start

```bash
pnpm install
pnpm run snapshot
```

Typical local setup:

1. Copy `config/targets.example.txt` to `config/targets.txt` if you want a local text target list.
2. Adjust `config/seo-snapshot.config.mjs`.
3. Run `pnpm run snapshot`.

During the crawl the CLI writes per-target progress lines to `stderr`. After each run it prints a short English summary and a `file://` link to the main report. The process exits with code `1` if at least one page fails to fetch or returns `>= 400`.

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
  --profile staging \
  --diff-only \
  --open \
  --user-agent "Desktop=Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)" \
  --user-agent "Mobile=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
```

Repeated `--user-agent` flags enable variants. Each target is fetched once per variant, and the HTML/JSON reports keep the variant label on page records and comparison cards.

Additional CLI behaviors:

- `--diff-only` keeps only changed comparison cards in comparison mode
- `--open` opens the generated HTML report in the default browser if HTML output is enabled
- `--profile <name>` applies `config.profiles[name]` before env overrides

## Environment Config

`pnpm run snapshot` loads `.env` from the project root automatically via Node's `--env-file-if-exists`.

Basic run via env:

```bash
SEO_SNAPSHOT_BASE_URL=https://example.com
SEO_SNAPSHOT_TARGETS=/,/news,/about
```

Compare mode via env:

```bash
SEO_SNAPSHOT_BASE_URL='{"url":"https://www.example.com","label":"prod"}'
SEO_SNAPSHOT_COMPARE_BASE_URL='{"url":"https://stage.example.com","label":"stage"}'
SEO_SNAPSHOT_TARGETS=/,/news
```

User-Agent variants and cookies via env:

```bash
SEO_SNAPSHOT_CONFIG_PATH=./config/seo-snapshot.config.mjs
SEO_SNAPSHOT_REQUEST_USER_AGENT='[{"label":"Desktop","userAgent":"Mozilla/5.0 (Macintosh...)"},{"label":"Mobile","userAgent":"Mozilla/5.0 (iPhone...)"}]'
SEO_SNAPSHOT_REQUEST_COOKIES='{"session":"abc123","token":"xyz"}'
```

Headers, profile, diff-only, and suppressed issue codes via env:

```bash
SEO_SNAPSHOT_PROFILE=staging
SEO_SNAPSHOT_DIFF_ONLY=true
SEO_SNAPSHOT_OPEN=true
SEO_SNAPSHOT_REQUEST_HEADERS='{"Authorization":"Bearer token","X-Custom":"value"}'
SEO_SNAPSHOT_AUDIT_IGNORE='["missing_twitter_card","missing_og_image"]'
```

See `.env.example` for the full list.

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
SEO_SNAPSHOT_COMPARE_BASE_URL=https://stage.example.com \
SEO_SNAPSHOT_TARGETS="/,/news,/movies" \
SEO_SNAPSHOT_OUTPUT_FORMATS=html,json \
SEO_SNAPSHOT_REQUEST_CONCURRENCY=8 \
node ./bin/seo-snapshot.mjs
```

Supported overrides:

- `SEO_SNAPSHOT_CONFIG_PATH`
- `SEO_SNAPSHOT_CONFIG`
- `SEO_SNAPSHOT_BASE_URL` as a URL string or `{ "url": "...", "label": "..." }` JSON object
- `SEO_SNAPSHOT_COMPARE_BASE_URL` as a URL string or `{ "url": "...", "label": "..." }` JSON object
- `SEO_SNAPSHOT_TARGETS_FILE`
- `SEO_SNAPSHOT_TARGETS` as a JSON array or comma/newline-separated list
- `SEO_SNAPSHOT_OUTPUT_DIR`
- `SEO_SNAPSHOT_OUTPUT_FORMATS`
- `SEO_SNAPSHOT_REQUEST_TIMEOUT_MS`
- `SEO_SNAPSHOT_REQUEST_MAX_REDIRECTS`
- `SEO_SNAPSHOT_REQUEST_CONCURRENCY`
- `SEO_SNAPSHOT_REQUEST_USER_AGENT` as a single string or a JSON array of `{ "label": "...", "userAgent": "..." }`
- `SEO_SNAPSHOT_REQUEST_COOKIES` as a header string or `{ "key": "value" }` JSON object
- `SEO_SNAPSHOT_REQUEST_HEADERS` as a JSON object
- `SEO_SNAPSHOT_DIFF_ONLY`
- `SEO_SNAPSHOT_OPEN`
- `SEO_SNAPSHOT_PROFILE`
- `SEO_SNAPSHOT_AUDIT_MIN_TITLE_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MAX_TITLE_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MIN_DESCRIPTION_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MAX_DESCRIPTION_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MIN_BODY_TEXT_LENGTH`
- `SEO_SNAPSHOT_AUDIT_IGNORE` as a JSON array or comma/newline-separated list

## Config

Example `config/seo-snapshot.config.mjs`:

```js
export default {
  baseUrl: { url: 'http://127.0.0.1:3000', label: 'local' }, // or a plain string
  diffOnly: false,
  compare: {
    baseUrl: { label: 'stage', url: 'https://stage.example.com' },
  },
  profiles: {
    staging: {
      baseUrl: { url: 'https://staging.example.com', label: 'staging' },
      compare: {
        baseUrl: { label: 'prod', url: 'https://www.example.com' },
      },
    },
  },
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
    userAgent: [
      { label: 'Desktop', userAgent: 'Mozilla/5.0 (Macintosh...)' },
      { label: 'Mobile', userAgent: 'Mozilla/5.0 (iPhone...)' },
    ], // or a single string
    headers: { Authorization: 'Bearer token' },
    cookies: { session: 'abc123', token: 'xyz' }, // or 'session=abc123; token=xyz'
  },
  audit: {
    minTitleLength: 15,
    maxTitleLength: 60,
    minDescriptionLength: 70,
    maxDescriptionLength: 160,
    minBodyTextLength: 250,
    ignore: [ 'missing_twitter_card', 'missing_og_image' ],
  },
}
```

Comparison mode notes:

- `compare.baseUrl` requires `baseUrl`.
- Both `baseUrl` and `compare.baseUrl` can be a string URL or an object with `url` and optional `label`.
- `baseUrl` is used as the primary domain.
- The same target path is fetched on both domains and the report adds a dedicated diff section.
- Absolute targets are normalized to `pathname + search + hash` before they are replayed on both domains.
- `diffOnly` only filters the comparison block; the page crawl still runs for all configured targets.

The following fields are compared between domains:

- fetch error, parse-skipped reason
- HTTP status, response time, final URL (path-normalized for source-local URLs)
- charset, title, meta description, canonical (path-normalized), canonical cross-domain flag
- meta robots, `X-Robots-Tag`, `Content-Security-Policy`, `X-Frame-Options`
- response `Link` header canonical, canonical cross-domain flag, `llms`, and parsed header entries
- `lang`, `Content-Language`, viewport, application name, theme color
- manifest, favicon, icon links
- H1 list
- hreflang alternates, alternate resources (feeds, etc.)
- `rel=prev` / `rel=next` pagination links
- OpenGraph: title, description, type, site name, locale, locale alternates, URL (path-normalized), URL cross-domain flag, image, image alt, video
- Twitter: card, title, description, URL (path-normalized), image, image alt
- App links: `apple-itunes-app`, `al:ios:*`, `al:android:*`
- JSON-LD: script count, parse errors, schema types, `WebSite`/`Organization` presence, block signatures, missing required properties
- duplicate head-tag signals
- visible body text length, image count, images without `alt`, internal link count
- issue code sets (per-domain diff)

Recommended local setup for targets:

- keep `config/targets.txt` ignored and local-only
- commit `config/targets.example.txt` as the shared template
- for sitemap exports, point `targetsFile` to a local XML file such as `./targets.local.xml`

Supported `targetsFile` inputs:

- plain text lists with one target per line
- sitemap XML dumps with `<url><loc>...</loc></url>` entries

## What The Report Includes

Each page record contains:

- source domain label in compare mode
- variant label and variant ID when User-Agent variants are enabled
- page status and fetch errors
- response time in milliseconds
- redirect chain
- extracted SEO, security, and crawl metrics (see below)
- parse-skipped reason for non-HTML responses
- per-page issue list with severity (`error` / `warning` / `info`)
- overall summary: total pages, pages with issues, failed pages, redirected, noindex count, issue breakdown by code

### Audit checks (produce issues)

The following fields are actively checked and generate issues if missing or out of range:

- **title** - missing, too short (`< minTitleLength`), too long (`> maxTitleLength`)
- **meta description** - missing, too short, too long
- **H1** - missing, or multiple H1s on one page
- **`lang` attribute on `<html>`** - missing
- **canonical link** - missing
- **canonical consistency** - warning when canonical points to another host; warning when canonical trailing slash differs from the page URL; warning when response `Link` canonical conflicts with HTML canonical
- **`noindex`** - detected in `meta[name="robots"]` or `X-Robots-Tag` header
- **meta robots tag** - missing (`info` severity)
- **`Content-Language` vs `html lang`** - warning on locale mismatch
- **hreflang on homepage-like routes** - missing (`info` severity)
- **hreflang integrity** - invalid entries, missing `x-default`, missing self-locale entry, or cross-domain targets (`warning`)
- **og:title, og:description, og:image** - missing (`info` severity)
- **twitter:card** - missing (`info` severity)
- **images without `alt`** - warning when one or more `<img>` elements are missing a usable `alt`
- **heading hierarchy** - warning when headings skip levels (for example `H2` to `H4`)
- **JSON-LD** - no structured data blocks found (`info`), or parse errors in existing blocks (`warning`)
- **homepage JSON-LD coverage** - missing `WebSite` or `Organization` schema on homepage-like routes (`info`)
- **Schema.org required properties** - warning when supported JSON-LD types are missing required fields
- **response `Link` `llms` target** - warning when it points to another host
- **visible body text** - shorter than `minBodyTextLength`
- **HTTP status** - 4xx produces a warning, 5xx produces an error
- **duplicate head tags** - repeated `<title>`, `meta[name="description"]`, `meta[name="robots"]`, canonical, viewport, og:title/description/type/url/image, twitter:card/title/description/image, manifest, `apple-itunes-app`

### Additional extracted signals shown in reports

Some of the following fields are display-only, while others are also used by audit checks or comparison mode.

The following fields are collected and shown in the report:

- response time, `charset`, `Content-Language`, viewport value, application name, theme color
- `Content-Security-Policy`, `X-Frame-Options`
- raw response `Link` header plus parsed relation entries
- manifest URL, favicon, all icon links
- full OpenGraph data: type, URL, site name, locale, locale alternates, image alt, video
- full Twitter data: title, description, URL, image alt
- app deep links: `apple-itunes-app`, `al:ios:*`, `al:android:*`
- hreflang alternates, alternate resources (feeds, etc.)
- `rel=prev` / `rel=next` pagination links
- JSON-LD schema types, `WebSite`/`Organization` flags, block signatures, previews, and missing required properties
- visible body text length, image count, images without `alt`, internal link count, heading hierarchy

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
