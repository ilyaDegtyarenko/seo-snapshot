import test from 'node:test'
import assert from 'node:assert/strict'
import { renderHtmlReport } from '../src/reporters.mjs'

const createPage = ({
  input = '/home',
  targetPath = '/home',
  requestedUrl = 'https://www.example.com/home',
  finalUrl = requestedUrl,
  source = null,
  title = 'Home',
  description = 'Home description',
  issues = [],
} = {}) => ({
  input,
  targetPath,
  source,
  requestedUrl,
  finalUrl,
  status: 200,
  error: null,
  parseSkippedReason: null,
  headers: {
    contentType: 'text/html; charset=utf-8',
    contentLength: '1024',
    xRobotsTag: null,
  },
  seo: {
    document: {
      title,
      h1: [ title ],
      lang: 'en',
    },
    meta: {
      description,
      robots: 'index,follow',
      openGraph: {
        url: finalUrl,
        image: `${ finalUrl }.jpg`,
      },
      twitter: {
        image: `${ finalUrl }.twitter.jpg`,
      },
    },
    links: {
      canonical: finalUrl,
      prev: null,
      next: null,
      alternates: [
        { hreflang: 'en', href: finalUrl },
      ],
    },
    jsonLd: {
      types: [ 'WebPage' ],
    },
  },
  redirectChain: [
    { url: requestedUrl, status: 200, location: null },
  ],
  issues,
})

const createReport = ({ pages, comparison = null }) => ({
  generatedAt: '2026-04-09T12:00:00.000Z',
  options: {
    configPath: 'config/seo-snapshot.config.mjs',
    baseUrl: 'https://www.example.com/',
    compare: comparison,
    timeoutMs: 15000,
    maxRedirects: 5,
    concurrency: 3,
    userAgent: 'seo-snapshot-test',
    targetCount: pages.length,
    formats: [ 'html' ],
    outputDir: '/tmp/seo-snapshot',
    audit: {
      minTitleLength: 15,
      maxTitleLength: 60,
      minDescriptionLength: 70,
      maxDescriptionLength: 160,
      minBodyTextLength: 300,
    },
  },
  comparison,
  pages,
})

test('renderHtmlReport adds Pages sidebar anchors and comparison domain filter', () => {
  const comparison = {
    sources: [
      { label: 'prod', url: 'https://www.example.com/' },
      { label: 'stage', url: 'https://stage.example.com/' },
    ],
    targetCount: 2,
    targetsWithDifferences: 1,
    totalDifferences: 3,
    differenceBreakdown: [],
    comparisons: [],
  }
  const html = renderHtmlReport(createReport({
    comparison,
    pages: [
      createPage({
        input: '/home',
        targetPath: '/home',
        requestedUrl: 'https://www.example.com/home',
        finalUrl: 'https://www.example.com/home',
        source: comparison.sources[0],
        title: 'Prod Home',
      }),
      createPage({
        input: '/home',
        targetPath: '/home',
        requestedUrl: 'https://stage.example.com/home',
        finalUrl: 'https://stage.example.com/home',
        source: comparison.sources[1],
        title: 'Stage Home',
      }),
    ],
  }))

  assert.match(html, /<h3>Page Index<\/h3>/)
  assert.match(html, /<select class="field-select" data-page-domain-filter/)
  assert.match(html, /All domains \(2\)/)
  assert.match(html, /prod \(www\.example\.com\) \(1\)/)
  assert.match(html, /stage \(stage\.example\.com\) \(1\)/)
  assert.match(html, /href="#page-1-home"/)
  assert.match(html, /data-page-anchor="page-2-home"/)
  assert.match(html, /id="page-1-home"/)
  assert.match(html, /data-source-key="https:\/\/www\.example\.com\/"/)
  assert.match(html, /'#tab-' \+ name/)
  assert.match(html, /function syncActivePageLinkFromScroll\(\)/)
  assert.match(html, /window\.addEventListener\('scroll', requestScrollSync, \{ passive: true \}\)/)
  assert.match(html, /link\.setAttribute\('aria-current', 'location'\)/)
})

test('renderHtmlReport keeps page index without comparison filter', () => {
  const html = renderHtmlReport(createReport({
    pages: [
      createPage({
        input: '/pricing',
        targetPath: '/pricing',
        requestedUrl: 'https://www.example.com/pricing',
        finalUrl: 'https://www.example.com/pricing',
        title: 'Pricing',
      }),
    ],
  }))

  assert.match(html, /<h3>Page Index<\/h3>/)
  assert.doesNotMatch(html, /<select class="field-select" data-page-domain-filter/)
  assert.match(html, /href="#page-1-pricing"/)
  assert.match(html, /Use the anchor list to move through long reports faster\./)
})
