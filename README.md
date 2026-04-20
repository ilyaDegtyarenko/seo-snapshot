# SEO Snapshot

A small CLI for checking the SEO state of a URL set. The tool crawls pages, captures redirects, collects core SEO signals, and saves reports in `HTML` and `JSON`.

## Features

- read URLs from `config/targets.txt`, `config/targets.xml`, inline config, and/or env overrides
- support `baseUrl` for relative paths
- compare the same target path across a primary and secondary domain and show SEO differences
- repeat the audit per User-Agent variant and keep variant labels in the reports
- follow redirects and store the redirect chain
- measure TTFB and capture security headers such as `Content-Security-Policy` and `X-Frame-Options`
- collect document metrics such as image counts, missing `alt` attributes, internal links, and heading hierarchy
- check title, description, canonical, H1, `lang`, robots directives, response `Link` headers, `hreflang`, OpenGraph, Twitter Card, JSON-LD, and visible body text
- capture resource hints (`rel=preload`, `rel=preconnect`, `rel=dns-prefetch`) and site-verification meta tags such as `facebook-domain-verification`
- detect page-level issues, duplicate head tags, and produce an overall issue breakdown
- support named config profiles, browser auto-open, audit-code suppression, custom cookies, and custom request headers
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

1. Copy `config/seo-snapshot.example.mjs` to `config/seo-snapshot.mjs`.
2. Copy `config/targets.example.txt` to `config/targets.txt` for a text list, or copy `config/targets.example.xml` to `config/targets.xml` for a sitemap dump.
3. Point `targetsFile` in `config/seo-snapshot.mjs` to `./targets.txt` or `./targets.xml`, or keep inline `targets`.
4. Put secrets or small toggles in `.env` only when needed.
5. Run `pnpm run snapshot`.

The main config template is `config/seo-snapshot.example.mjs`.

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
  --config ./config/seo-snapshot.mjs \
  --output-dir ./reports \
  --format html,json \
  --timeout-ms 15000 \
  --max-redirects 10 \
  --concurrency 4 \
  --profile staging \
  --open \
  --user-agent "Desktop=Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)" \
  --user-agent "Mobile=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
```

Repeated `--user-agent` flags enable variants. Each target is fetched once per variant, and the HTML/JSON reports keep the variant label on page records and comparison cards.

Additional CLI behaviors:

- `--open` opens the generated HTML report in the default browser if HTML output is enabled
- `--profile <name>` applies `config.profiles[name]` before env overrides

## Environment Config

`pnpm run snapshot` loads `.env` from the project root automatically via Node's `--env-file-if-exists`.

Recommended split:

- `config/seo-snapshot.example.mjs`: committed template for the runtime config
- `config/seo-snapshot.mjs`: ignored runtime config with local structured settings such as `baseUrl`, `compare.baseUrl`, `targetsFile`, profiles, or User-Agent variants
- `config/targets.example.txt` / `config/targets.example.xml`: committed target templates
- `config/targets.txt` / `config/targets.xml`: ignored runtime target inputs
- `.env`: ignored secrets and small scalar toggles such as cookies, headers, `SEO_SNAPSHOT_OPEN`, and one-off overrides
- CLI flags: one-shot per-run overrides

Config precedence:

1. `config/seo-snapshot.mjs`
2. `SEO_SNAPSHOT_CONFIG`
3. selected `config.profiles[...]`
4. individual `SEO_SNAPSHOT_*` overrides
5. CLI flags

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
SEO_SNAPSHOT_CONFIG_PATH=./config/seo-snapshot.mjs
SEO_SNAPSHOT_REQUEST_USER_AGENT='[{"label":"Desktop","userAgent":"Mozilla/5.0 (Macintosh...)"},{"label":"Mobile","userAgent":"Mozilla/5.0 (iPhone...)"}]'
SEO_SNAPSHOT_REQUEST_COOKIES='{"session":"abc123","token":"xyz"}'
```

Headers, profile, and suppressed issue codes via env:

```bash
SEO_SNAPSHOT_PROFILE=staging
SEO_SNAPSHOT_OPEN=true
SEO_SNAPSHOT_REQUEST_HEADERS='{"Authorization":"Bearer token","X-Custom":"value"}'
SEO_SNAPSHOT_AUDIT_IGNORE='["missing_twitter_card","missing_og_image"]'
```

See `.env.example` for the full list.

For complex local settings, prefer `config/seo-snapshot.mjs` over JSON-in-env strings.

Alternatively, pass variables inline in two ways.

Full config as JSON:

```bash
SEO_SNAPSHOT_CONFIG='{"baseUrl":"http://127.0.0.1:3000","targets":["/","/news"],"output":{"dir":"./reports","formats":["html","json"]}}' \
node ./bin/seo-snapshot.mjs
```

File config plus env overrides:

```bash
SEO_SNAPSHOT_CONFIG_PATH=./config/seo-snapshot.mjs \
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
- `SEO_SNAPSHOT_OUTPUT_HIDE_TTFB` as `true` or `false`
- `SEO_SNAPSHOT_REQUEST_TIMEOUT_MS`
- `SEO_SNAPSHOT_REQUEST_MAX_REDIRECTS`
- `SEO_SNAPSHOT_REQUEST_CONCURRENCY`
- `SEO_SNAPSHOT_REQUEST_USER_AGENT` as a single string or a JSON array of `{ "label": "...", "userAgent": "..." }`
- `SEO_SNAPSHOT_REQUEST_COOKIES` as a header string or `{ "key": "value" }` JSON object
- `SEO_SNAPSHOT_REQUEST_HEADERS` as a JSON object
- `SEO_SNAPSHOT_OPEN`
- `SEO_SNAPSHOT_PROFILE`
- `SEO_SNAPSHOT_AUDIT_MIN_TITLE_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MAX_TITLE_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MIN_DESCRIPTION_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MAX_DESCRIPTION_LENGTH`
- `SEO_SNAPSHOT_AUDIT_MIN_BODY_TEXT_LENGTH`
- `SEO_SNAPSHOT_AUDIT_IGNORE` as a JSON array or comma/newline-separated list

## Config

Committed template in `config/seo-snapshot.example.mjs`:

```js
export default {
  baseUrl: { url: 'http://127.0.0.1:3000', label: 'Local' }, // or a plain string
  compare: {
    baseUrl: { url: 'https://www.example.com', label: 'Prod' },
  },
  profiles: {
    staging: {
      baseUrl: { url: 'https://staging.example.com', label: 'Staging' },
      compare: {
        baseUrl: { url: 'https://www.example.com', label: 'Prod' },
      },
    },
  },
  // targetsFile: './targets.txt',
  // targetsFile: './targets.xml',
  targets: [
    '/',
    '/news',
  ],
  output: {
    dir: '../reports',
    formats: [ 'html', 'json' ],
    hideTtfb: false,
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

**Available issue codes for `audit.ignore`:**

| Code | Severity | Description |
|------|----------|-------------|
| `fetch_error` | error | Network or fetch error |
| `http_5xx` | error | Server returned 5xx status |
| `http_4xx` | warning | Page returned 4xx status |
| `non_html` | warning | Response is not HTML |
| `missing_title` | error | Missing `<title>` |
| `short_title` | warning | Title too short |
| `long_title` | warning | Title too long |
| `missing_description` | warning | Missing meta description |
| `short_description` | warning | Meta description too short |
| `long_description` | warning | Meta description too long |
| `missing_h1` | warning | Missing H1 |
| `multiple_h1` | warning | More than one H1 |
| `missing_lang` | warning | Missing `lang` on `<html>` |
| `lang_content_language_mismatch` | warning | `html[lang]` doesn't match `Content-Language` header |
| `missing_canonical` | warning | Missing canonical link |
| `canonical_cross_domain` | warning | Canonical points to a different host |
| `canonical_trailing_slash_mismatch` | warning | Canonical trailing slash doesn't match page URL |
| `header_canonical_mismatch` | warning | Response `Link` canonical doesn't match HTML canonical |
| `noindex` | warning | Page is marked noindex |
| `missing_meta_robots` | info | Missing meta robots tag |
| `missing_hreflang` | info | Missing hreflang on homepage-like route |
| `invalid_hreflang` | warning | hreflang links missing href or hreflang value |
| `hreflang_missing_x_default` | warning | hreflang links missing `x-default` |
| `hreflang_missing_self` | warning | hreflang links missing self entry for page lang |
| `hreflang_cross_domain` | warning | hreflang links point to a different host |
| `missing_og_title` | info | Missing `og:title` |
| `missing_og_description` | info | Missing `og:description` |
| `missing_og_image` | info | Missing `og:image` |
| `missing_twitter_card` | info | Missing `twitter:card` |
| `missing_jsonld` | info | No JSON-LD found |
| `invalid_jsonld` | warning | JSON-LD parse error |
| `missing_schema_website` | info | Homepage missing `WebSite` JSON-LD |
| `missing_schema_organization` | info | Homepage missing `Organization` JSON-LD |
| `schema_missing_properties` | warning | JSON-LD missing required properties |
| `llms_link_cross_domain` | warning | `Link: llms` header points to a different host |
| `thin_content` | warning | Visible body text too short |
| `images_missing_alt` | warning | Images missing `alt` attribute |
| `heading_hierarchy_skip` | warning | Heading hierarchy skips a level |
| `duplicate_title` | warning | Multiple `<title>` tags |
| `duplicate_description` | warning | Multiple meta description tags |
| `duplicate_robots` | warning | Multiple meta robots tags |
| `duplicate_canonical` | warning | Multiple canonical links |
| `duplicate_viewport` | warning | Multiple viewport meta tags |
| `duplicate_og_title` | warning | Multiple `og:title` tags |
| `duplicate_og_description` | warning | Multiple `og:description` tags |
| `duplicate_og_type` | warning | Multiple `og:type` tags |
| `duplicate_og_url` | warning | Multiple `og:url` tags |
| `duplicate_og_image` | warning | Multiple `og:image` tags |
| `duplicate_twitter_card` | warning | Multiple `twitter:card` tags |
| `duplicate_twitter_title` | warning | Multiple `twitter:title` tags |
| `duplicate_twitter_description` | warning | Multiple `twitter:description` tags |
| `duplicate_twitter_image` | warning | Multiple `twitter:image` tags |
| `duplicate_manifest` | warning | Multiple manifest links |
| `duplicate_apple_itunes_app` | warning | Multiple `apple-itunes-app` tags |

Copy it to `config/seo-snapshot.mjs` and trim it down to the settings you actually need. `config/seo-snapshot.mjs` is the runtime config file loaded by default; there is no automatic `.local` overlay anymore. This keeps the committed template stable while real machine-specific settings stay ignored.

`output.hideTtfb` — set to `true` to omit the TTFB field from page cards and comparison diffs. Useful when TTFB is not meaningful (e.g. local dev, CI environments). Defaults to `false`.

Comparison mode notes:

- `compare.baseUrl` requires `baseUrl`.
- Both `baseUrl` and `compare.baseUrl` can be a string URL or an object with `url` and optional `label`.
- `baseUrl` is used as the primary domain.
- The same target path is fetched on both domains and the report adds a dedicated diff section.
- Absolute targets are normalized to `pathname + search + hash` before they are replayed on both domains.

The following fields are compared between domains:

- fetch error, parse-skipped reason
- HTTP status, TTFB, final URL (path-normalized for source-local URLs)
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
- `facebook-domain-verification` meta tag
- resource hints: preload links, preconnect links, DNS-prefetch links
- JSON-LD: script count, parse errors, schema types, `WebSite`/`Organization` presence, block signatures, missing required properties
- duplicate head-tag signals
- visible body text length, image count, images without `alt`, internal link count
- issue code sets (per-domain diff)

Recommended local setup for targets:

- keep `config/seo-snapshot.mjs`, `config/targets.txt`, and `config/targets.xml` ignored and local-only
- commit `config/seo-snapshot.example.mjs`, `config/targets.example.txt`, and `config/targets.example.xml` as shared templates
- point `targetsFile` to `./targets.txt` for plain text input or `./targets.xml` for sitemap exports

Supported `targetsFile` inputs:

- plain text lists with one target per line
- sitemap XML dumps with `<url><loc>...</loc></url>` entries

## What The Report Includes

Each page record contains:

- source domain label in compare mode
- variant label and variant ID when User-Agent variants are enabled
- page status and fetch errors
- TTFB in milliseconds
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

- TTFB, `charset`, `Content-Language`, viewport value, application name, theme color
- `Content-Security-Policy`, `X-Frame-Options`
- raw response `Link` header plus parsed relation entries
- manifest URL, favicon, all icon links
- full OpenGraph data: type, URL, site name, locale, locale alternates, image alt, video
- full Twitter data: title, description, URL, image alt
- app deep links: `apple-itunes-app`, `al:ios:*`, `al:android:*`
- site-verification meta tag: `facebook-domain-verification`
- hreflang alternates, alternate resources (feeds, etc.)
- `rel=prev` / `rel=next` pagination links
- resource hints: preload links (`href`, `as`, `type`), preconnect links, DNS-prefetch links
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
