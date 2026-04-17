export const DEFAULT_CONFIG_PATH = 'config/seo-snapshot.config.mjs'
export const DEFAULT_REPORTS_DIR = 'reports'
export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_MAX_REDIRECTS = 10
export const DEFAULT_CONCURRENCY = 4
export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; SEO-Snapshot/1.0)'
export const DEFAULT_FORMATS = [ 'html', 'json' ]
export const HTML_CONTENT_TYPE_PATTERN = /^(text\/html|application\/xhtml\+xml)\b/i
export const ENV_CONFIG_PATH_VAR = 'SEO_SNAPSHOT_CONFIG_PATH'
export const ENV_CONFIG_JSON_VAR = 'SEO_SNAPSHOT_CONFIG'

export const DEFAULT_AUDIT_RULES = {
  minTitleLength: 15,
  maxTitleLength: 60,
  minDescriptionLength: 70,
  maxDescriptionLength: 160,
  minBodyTextLength: 250,
}

export const SUPPORTED_FORMATS = [ 'html', 'json' ]

export const buildHelpText = () => `
Usage:
  pnpm run snapshot
  pnpm run snapshot -- --config ./config/seo-snapshot.config.mjs
  node ./bin/seo-snapshot.mjs --format html,json --output-dir ./reports

Options:
  --config <file>         Override config file path. Default: ${ DEFAULT_CONFIG_PATH }.
  --output-dir <dir>      Override report output directory. Default: ${ DEFAULT_REPORTS_DIR }.
  --format <list>         Report formats: html, json, both. Default: ${ DEFAULT_FORMATS.join(', ') }.
  --timeout-ms <number>   Per-request timeout in milliseconds. Default: ${ DEFAULT_TIMEOUT_MS }.
  --max-redirects <n>     Maximum redirect hops to follow. Default: ${ DEFAULT_MAX_REDIRECTS }.
  --concurrency <n>       Maximum parallel requests. Default: ${ DEFAULT_CONCURRENCY }.
  --user-agent <value>    Override the request User-Agent. Repeat the flag to enable variants; repeated values may use "Label=UA".
  --diff-only             Only output paths with differences in comparison mode.
  --open                  Open the HTML report in the default browser after generation.
  --profile <name>        Activate a named profile from config.profiles.
  --help                  Show this help.

Environment:
  ${ ENV_CONFIG_PATH_VAR }     Config file path alternative to --config.
  ${ ENV_CONFIG_JSON_VAR }          JSON object with the full config.
  SEO_SNAPSHOT_BASE_URL       Override config.baseUrl.
  SEO_SNAPSHOT_COMPARE_BASE_URL
  SEO_SNAPSHOT_TARGETS_FILE   Override config.targetsFile.
  SEO_SNAPSHOT_TARGETS        Override config.targets. Accepts JSON array or comma/newline list.
  SEO_SNAPSHOT_OUTPUT_DIR     Override config.output.dir.
  SEO_SNAPSHOT_OUTPUT_FORMATS Override config.output.formats.
  SEO_SNAPSHOT_REQUEST_TIMEOUT_MS
  SEO_SNAPSHOT_REQUEST_MAX_REDIRECTS
  SEO_SNAPSHOT_REQUEST_CONCURRENCY
  SEO_SNAPSHOT_REQUEST_USER_AGENT
  SEO_SNAPSHOT_REQUEST_COOKIES
  SEO_SNAPSHOT_DIFF_ONLY        Only output targets with differences (comparison mode).
  SEO_SNAPSHOT_OPEN             Open report after generation (true/false).
  SEO_SNAPSHOT_PROFILE          Named profile to activate from config.profiles.
  SEO_SNAPSHOT_AUDIT_MIN_TITLE_LENGTH
  SEO_SNAPSHOT_AUDIT_MAX_TITLE_LENGTH
  SEO_SNAPSHOT_AUDIT_MIN_DESCRIPTION_LENGTH
  SEO_SNAPSHOT_AUDIT_MAX_DESCRIPTION_LENGTH
  SEO_SNAPSHOT_AUDIT_MIN_BODY_TEXT_LENGTH
  SEO_SNAPSHOT_AUDIT_IGNORE     Issue codes to suppress. Comma-separated or JSON array.

Config file format:
  export default {
    baseUrl: 'http://127.0.0.1:3000',
    compare: {
      baseUrl: 'https://staging.example.com',
    },
    profiles: {
      staging: {
        baseUrl: 'https://staging.example.com',
        compare: {
          baseUrl: 'https://prod.example.com',
        },
      },
    },
    targetsFile: './targets.txt',
    targets: [ '/', '/news' ],
    output: {
      dir: '../reports',
      formats: [ 'html', 'json' ],
    },
    request: {
      timeoutMs: ${ DEFAULT_TIMEOUT_MS },
      maxRedirects: ${ DEFAULT_MAX_REDIRECTS },
      concurrency: ${ DEFAULT_CONCURRENCY },
      userAgent: '${ DEFAULT_USER_AGENT }',
      // Or multiple variants:
      // userAgent: [
      //   { label: 'Desktop', userAgent: 'Mozilla/5.0 (Macintosh...)' },
      //   { label: 'Mobile', userAgent: 'Mozilla/5.0 (iPhone...)' },
      // ],
    },
    audit: {
      minTitleLength: ${ DEFAULT_AUDIT_RULES.minTitleLength },
      maxTitleLength: ${ DEFAULT_AUDIT_RULES.maxTitleLength },
      minDescriptionLength: ${ DEFAULT_AUDIT_RULES.minDescriptionLength },
      maxDescriptionLength: ${ DEFAULT_AUDIT_RULES.maxDescriptionLength },
      minBodyTextLength: ${ DEFAULT_AUDIT_RULES.minBodyTextLength },
      ignore: [ 'missing_twitter_card', 'missing_og_image' ],
    },
  }

Targets file format:
  - plain text: one target per line, empty lines and lines starting with # are ignored
  - XML sitemap dump: <url><loc>https://example.com/page</loc></url>

Comparison mode:
  - set compare.baseUrl with one absolute URL
  - config.baseUrl is used as the primary domain
  - the same target path will be fetched on both domains and included in the diff block
`.trim()
