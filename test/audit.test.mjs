import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPageIssues, buildSummary } from '../src/audit.mjs'
import { DEFAULT_AUDIT_RULES } from '../src/constants.mjs'

test('buildPageIssues reports critical SEO gaps', () => {
  const page = {
    status: 200,
    error: null,
    parseSkippedReason: null,
    headers: {
      xRobotsTag: null,
    },
    seo: {
      document: {
        title: 'Short',
        h1: [],
        lang: null,
        bodyTextLength: 50,
      },
      meta: {
        description: null,
        robots: 'noindex',
        openGraph: {},
        twitter: {},
      },
      links: {
        canonical: null,
      },
      jsonLd: {
        scriptCount: 0,
        parseErrors: 1,
      },
    },
  }

  const issues = buildPageIssues(page, DEFAULT_AUDIT_RULES)
  const codes = issues.map(issue => issue.code)

  assert.deepEqual(codes, [
    'short_title',
    'missing_description',
    'missing_h1',
    'missing_lang',
    'missing_canonical',
    'noindex',
    'missing_og_title',
    'missing_og_description',
    'missing_og_image',
    'missing_twitter_card',
    'missing_jsonld',
    'invalid_jsonld',
    'thin_content',
  ])
})

test('buildSummary aggregates issue and severity counts', () => {
  const pages = [
    {
      error: null,
      status: 200,
      redirectChain: [ { url: 'https://example.com', status: 200, location: null } ],
      parseSkippedReason: null,
      issues: [
        { code: 'missing_description', severity: 'warning' },
        { code: 'missing_og_image', severity: 'info' },
      ],
    },
    {
      error: null,
      status: 404,
      redirectChain: [ { url: 'https://example.com/missing', status: 404, location: null } ],
      parseSkippedReason: null,
      issues: [
        { code: 'http_4xx', severity: 'warning' },
      ],
    },
    {
      error: 'timeout',
      status: null,
      redirectChain: [],
      parseSkippedReason: null,
      issues: [
        { code: 'fetch_error', severity: 'error' },
      ],
    },
  ]

  const summary = buildSummary(pages)

  assert.equal(summary.total, 3)
  assert.equal(summary.totalIssues, 4)
  assert.equal(summary.pagesWithIssues, 3)
  assert.equal(summary.errors, 1)
  assert.equal(summary.failedPages, 2)
  assert.equal(summary.severityCounts.error, 1)
  assert.equal(summary.severityCounts.warning, 2)
  assert.equal(summary.severityCounts.info, 1)
  assert.deepEqual(summary.issueBreakdown, [
    { code: 'fetch_error', count: 1 },
    { code: 'http_4xx', count: 1 },
    { code: 'missing_description', count: 1 },
    { code: 'missing_og_image', count: 1 },
  ])
})
