export const DEFAULT_CONFIG_PATH = 'config/seo-snapshot.config.mjs'
export const DEFAULT_REPORTS_DIR = 'reports'
export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_MAX_REDIRECTS = 10
export const DEFAULT_CONCURRENCY = 4
export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; SEO-Snapshot/1.0)'
export const DEFAULT_FORMATS = [ 'html', 'json' ]
export const HTML_CONTENT_TYPE_PATTERN = /^(text\/html|application\/xhtml\+xml)\b/i

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
  --user-agent <value>    Override the request User-Agent.
  --help                  Show this help.

Config file format:
  export default {
    baseUrl: 'http://127.0.0.1:3000',
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
    },
    audit: {
      minTitleLength: ${ DEFAULT_AUDIT_RULES.minTitleLength },
      maxTitleLength: ${ DEFAULT_AUDIT_RULES.maxTitleLength },
      minDescriptionLength: ${ DEFAULT_AUDIT_RULES.minDescriptionLength },
      maxDescriptionLength: ${ DEFAULT_AUDIT_RULES.maxDescriptionLength },
      minBodyTextLength: ${ DEFAULT_AUDIT_RULES.minBodyTextLength },
    },
  }

Targets file format:
  - one target per line
  - empty lines are ignored
  - lines starting with # are ignored
`.trim()
