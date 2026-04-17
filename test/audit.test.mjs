import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPageIssues, buildSummary } from '../src/audit.mjs'
import { DEFAULT_AUDIT_RULES } from '../src/constants.mjs'

test('buildPageIssues reports critical SEO gaps', () => {
  const page = {
    targetPath: '/',
    status: 200,
    error: null,
    parseSkippedReason: null,
    headers: {
      xRobotsTag: null,
      links: {
        canonical: null,
        llms: null,
      },
    },
    seo: {
      document: {
        title: 'Short',
        h1: [],
        lang: null,
        bodyTextLength: 50,
        imageCount: 0,
        imagesWithoutAlt: 0,
        internalLinkCount: 0,
        headingHierarchy: [],
      },
      meta: {
        description: null,
        robots: 'noindex',
        openGraph: {},
        twitter: {},
      },
      links: {
        canonical: null,
        alternates: [],
      },
      jsonLd: {
        scriptCount: 0,
        parseErrors: 1,
        hasWebSite: false,
        hasOrganization: false,
      },
      head: {
        duplicates: [
          {
            key: 'twitterImage',
            label: 'meta[name="twitter:image"]',
            count: 2,
          },
        ],
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
    'duplicate_twitter_image',
    'missing_canonical',
    'noindex',
    'missing_hreflang',
    'missing_og_title',
    'missing_og_description',
    'missing_og_image',
    'missing_twitter_card',
    'missing_jsonld',
    'invalid_jsonld',
    'missing_schema_website',
    'missing_schema_organization',
    'thin_content',
  ])
})

test('buildPageIssues handles page with undefined headers gracefully', () => {
  const page = {
    targetPath: '/test',
    status: 200,
    error: null,
    parseSkippedReason: null,
    headers: undefined,
    seo: {
      document: {
        title: 'A valid page title for testing',
        h1: [ 'Hello' ],
        lang: 'en',
        bodyTextLength: 500,
        imageCount: 0,
        imagesWithoutAlt: 0,
        internalLinkCount: 0,
        headingHierarchy: [ 1 ],
      },
      meta: {
        description: 'A description that is long enough for the audit to pass without warnings.',
        robots: 'index,follow',
        openGraph: { title: 'OG', description: 'OG desc', image: '/img.jpg' },
        twitter: { card: 'summary' },
      },
      links: {
        canonical: 'https://example.com/test',
        alternates: [],
      },
      jsonLd: {
        scriptCount: 1,
        parseErrors: 0,
        hasWebSite: false,
        hasOrganization: false,
      },
      head: {
        duplicates: [],
      },
    },
  }

  const issues = buildPageIssues(page, DEFAULT_AUDIT_RULES)
  const codes = issues.map(issue => issue.code)

  assert.equal(codes.includes('fetch_error'), false)
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

test('buildPageIssues detects heading hierarchy skip', () => {
  const page = {
    targetPath: '/test',
    status: 200,
    error: null,
    parseSkippedReason: null,
    headers: {
      xRobotsTag: null,
      links: { canonical: null, llms: null },
    },
    seo: {
      document: {
        title: 'A page title long enough',
        h1: [ 'Hello' ],
        lang: 'en',
        bodyTextLength: 500,
        imageCount: 0,
        imagesWithoutAlt: 0,
        internalLinkCount: 0,
        headingHierarchy: [ 1, 2, 4 ],
      },
      meta: {
        description: 'A description that is long enough for audit to pass the minimum length check.',
        robots: 'index,follow',
        openGraph: { title: 'OG', description: 'OG desc', image: '/img.jpg' },
        twitter: { card: 'summary' },
      },
      links: {
        canonical: 'https://example.com/test',
        alternates: [],
      },
      jsonLd: {
        scriptCount: 1,
        parseErrors: 0,
        hasWebSite: false,
        hasOrganization: false,
      },
      head: { duplicates: [] },
    },
  }

  const issues = buildPageIssues(page, DEFAULT_AUDIT_RULES)
  const codes = issues.map(issue => issue.code)

  assert.equal(codes.includes('heading_hierarchy_skip'), true)
})

test('buildPageIssues detects trailing slash mismatch between canonical and final URL', () => {
  const page = {
    targetPath: '/catalog',
    finalUrl: 'https://example.com/catalog',
    status: 200,
    error: null,
    parseSkippedReason: null,
    headers: {
      xRobotsTag: null,
      links: { canonical: null, llms: null },
    },
    seo: {
      document: {
        title: 'A page title long enough',
        h1: [ 'Catalog' ],
        lang: 'en',
        bodyTextLength: 500,
        imageCount: 0,
        imagesWithoutAlt: 0,
        internalLinkCount: 0,
        headingHierarchy: [ 1, 2 ],
      },
      meta: {
        description: 'A description that is long enough for audit to pass the minimum length check.',
        robots: 'index,follow',
        openGraph: { title: 'OG', description: 'OG desc', image: '/img.jpg' },
        twitter: { card: 'summary' },
      },
      links: {
        canonical: 'https://example.com/catalog/',
        alternates: [],
      },
      jsonLd: {
        scriptCount: 1,
        parseErrors: 0,
        hasWebSite: false,
        hasOrganization: false,
      },
      head: { duplicates: [] },
    },
  }

  const issues = buildPageIssues(page, DEFAULT_AUDIT_RULES)
  const codes = issues.map(issue => issue.code)

  assert.equal(codes.includes('canonical_trailing_slash_mismatch'), true)
})

test('buildPageIssues detects Content-Language vs html lang mismatch', () => {
  const page = {
    targetPath: '/test',
    status: 200,
    error: null,
    parseSkippedReason: null,
    headers: {
      xRobotsTag: null,
      links: { canonical: null, llms: null },
    },
    seo: {
      document: {
        title: 'A page title long enough',
        h1: [ 'Hello' ],
        lang: 'en',
        contentLanguage: 'uk',
        bodyTextLength: 500,
        imageCount: 0,
        imagesWithoutAlt: 0,
        internalLinkCount: 0,
        headingHierarchy: [ 1 ],
      },
      meta: {
        description: 'A description that is long enough for audit to pass the minimum length check.',
        robots: 'index,follow',
        openGraph: { title: 'OG', description: 'OG desc', image: '/img.jpg' },
        twitter: { card: 'summary' },
      },
      links: {
        canonical: 'https://example.com/test',
        alternates: [],
      },
      jsonLd: {
        scriptCount: 1,
        parseErrors: 0,
        hasWebSite: false,
        hasOrganization: false,
      },
      head: { duplicates: [] },
    },
  }

  const issues = buildPageIssues(page, DEFAULT_AUDIT_RULES)
  const codes = issues.map(issue => issue.code)

  assert.equal(codes.includes('lang_content_language_mismatch'), true)
})

test('buildPageIssues detects missing required schema properties', () => {
  const page = {
    targetPath: '/test',
    status: 200,
    error: null,
    parseSkippedReason: null,
    headers: {
      xRobotsTag: null,
      links: { canonical: null, llms: null },
    },
    seo: {
      document: {
        title: 'A page title long enough',
        h1: [ 'Hello' ],
        lang: 'en',
        bodyTextLength: 500,
        imageCount: 0,
        imagesWithoutAlt: 0,
        internalLinkCount: 0,
        headingHierarchy: [ 1 ],
      },
      meta: {
        description: 'A description that is long enough for audit to pass the minimum length check.',
        robots: 'index,follow',
        openGraph: { title: 'OG', description: 'OG desc', image: '/img.jpg' },
        twitter: { card: 'summary' },
      },
      links: {
        canonical: 'https://example.com/test',
        alternates: [],
      },
      jsonLd: {
        scriptCount: 1,
        parseErrors: 0,
        hasWebSite: false,
        hasOrganization: false,
        missingRequiredProperties: [
          { type: 'Article', property: 'author' },
          { type: 'Offer', property: 'priceCurrency' },
        ],
      },
      head: { duplicates: [] },
    },
  }

  const issues = buildPageIssues(page, DEFAULT_AUDIT_RULES)
  const codes = issues.map(issue => issue.code)

  assert.equal(codes.includes('schema_missing_properties'), true)
})

test('buildPageIssues filters out ignored issue codes', () => {
  const page = {
    targetPath: '/',
    status: 200,
    error: null,
    parseSkippedReason: null,
    headers: {
      xRobotsTag: null,
      links: { canonical: null, llms: null },
    },
    seo: {
      document: {
        title: 'Short',
        h1: [],
        lang: null,
        bodyTextLength: 50,
        imageCount: 0,
        imagesWithoutAlt: 0,
        internalLinkCount: 0,
        headingHierarchy: [],
      },
      meta: {
        description: null,
        robots: null,
        openGraph: {},
        twitter: {},
      },
      links: {
        canonical: null,
        alternates: [],
      },
      jsonLd: {
        scriptCount: 0,
        parseErrors: 0,
        hasWebSite: false,
        hasOrganization: false,
      },
      head: { duplicates: [] },
    },
  }

  const rules = {
    ...DEFAULT_AUDIT_RULES,
    ignore: [ 'missing_description', 'missing_h1', 'thin_content' ],
  }

  const issues = buildPageIssues(page, rules)
  const codes = issues.map(issue => issue.code)

  assert.equal(codes.includes('missing_description'), false)
  assert.equal(codes.includes('missing_h1'), false)
  assert.equal(codes.includes('thin_content'), false)
  assert.equal(codes.includes('short_title'), true)
})
