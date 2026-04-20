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
  ttfbMs = 123,
  imageCount = 4,
  imagesWithoutAlt = 1,
  internalLinkCount = 12,
  headingHierarchy = [ 1, 2, 4 ],
  contentSecurityPolicy = "default-src 'self'",
  xFrameOptions = 'SAMEORIGIN',
  issues = [],
} = {}) => ({
  input,
  targetPath,
  source,
  requestedUrl,
  finalUrl,
  status: 200,
  ttfbMs,
  finalResponseTtfbMs: ttfbMs,
  error: null,
  parseSkippedReason: null,
  headers: {
    contentType: 'text/html; charset=utf-8',
    contentLength: '1024',
    contentSecurityPolicy,
    xFrameOptions,
    xRobotsTag: null,
  },
  seo: {
    document: {
      title,
      h1: [ title ],
      lang: 'en',
      bodyTextLength: 640,
      imageCount,
      imagesWithoutAlt,
      internalLinkCount,
      headingHierarchy,
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
    configPath: 'config/seo-snapshot.mjs',
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
  assert.match(html, /function createNavGroup\(config\)/)
  assert.match(html, /function syncNavGroupFilter\(group\)/)
  assert.match(html, /function syncActiveNavLinkFromScroll\(\)/)
  assert.doesNotMatch(html, /data-nav-active-btn/)
  assert.match(html, /nav: document\.querySelector\(config\.navSelector\)/)
  assert.match(html, /function scrollNavLinkIntoView\(group, link\)/)
  assert.match(html, /group\.nav\.scrollTop -= \(navRect\.top - linkRect\.top\) \+ scrollPadding/)
  assert.match(html, /group\.nav\.scrollTop \+= \(linkRect\.bottom - navRect\.bottom\) \+ scrollPadding/)
  assert.doesNotMatch(html, /scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/)
  assert.match(html, /function getActiveNavLink\(group\)/)
  assert.match(html, /scrollNavLinkIntoView\(group, getActiveNavLink\(group\)\)/)
  assert.match(html, /window\.addEventListener\('scroll', requestScrollSync, \{ passive: true \}\)/)
  assert.match(html, /data-scroll-top/)
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

test('renderHtmlReport displays new crawl, security, and content detail fields', () => {
  const html = renderHtmlReport(createReport({
    pages: [
      createPage(),
    ],
  }))

  assert.match(html, /TTFB<\/dt><dd>123 ms<\/dd>/)
  assert.match(html, /Final response TTFB<\/dt><dd>123 ms<\/dd>/)
  assert.match(html, /Content-Security-Policy<\/dt><dd>default-src &#39;self&#39;<\/dd>/)
  assert.match(html, /X-Frame-Options<\/dt><dd>SAMEORIGIN<\/dd>/)
  assert.match(html, /Body text length<\/dt><dd>640<\/dd>/)
  assert.match(html, /Images<\/dt><dd>4<\/dd>/)
  assert.match(html, /Images without alt<\/dt><dd>1<\/dd>/)
  assert.match(html, /Internal links<\/dt><dd>12<\/dd>/)
  assert.match(html, /Heading hierarchy<\/dt><dd>H1 → H2 → H4<\/dd>/)
})

test('renderHtmlReport adds Comparison sidebar anchors and routes hashes to the comparison tab', () => {
  const comparison = {
    sources: [
      { label: 'prod', url: 'https://www.example.com/' },
      { label: 'stage', url: 'https://stage.example.com/' },
    ],
    targetCount: 2,
    targetsWithDifferences: 1,
    totalDifferences: 1,
    differenceBreakdown: [
      { key: 'title', label: 'Title', count: 1 },
    ],
    comparisons: [
      {
        targetPath: '/home',
        left: {
          label: 'prod',
          baseUrl: 'https://www.example.com/',
          requestedUrl: 'https://www.example.com/home',
          finalUrl: 'https://www.example.com/home',
          status: 200,
        },
        right: {
          label: 'stage',
          baseUrl: 'https://stage.example.com/',
          requestedUrl: 'https://stage.example.com/home',
          finalUrl: 'https://stage.example.com/home',
          status: 200,
        },
        differences: [
          { key: 'title', label: 'Title', left: 'Prod Home', right: 'Stage Home' },
        ],
        fields: [
          { key: 'status', label: 'HTTP status', left: 200, right: 200, changed: false },
          { key: 'title', label: 'Title', left: 'Prod Home', right: 'Stage Home', changed: true },
        ],
        issueDelta: {
          onlyOnLeft: [],
          onlyOnRight: [],
        },
      },
      {
        targetPath: '/about',
        left: {
          label: 'prod',
          baseUrl: 'https://www.example.com/',
          requestedUrl: 'https://www.example.com/about',
          finalUrl: 'https://www.example.com/about',
          status: 200,
        },
        right: {
          label: 'stage',
          baseUrl: 'https://stage.example.com/',
          requestedUrl: 'https://stage.example.com/about',
          finalUrl: 'https://stage.example.com/about',
          status: 200,
        },
        differences: [],
        fields: [
          { key: 'status', label: 'HTTP status', left: 200, right: 200, changed: false },
        ],
        issueDelta: {
          onlyOnLeft: [],
          onlyOnRight: [],
        },
      },
    ],
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

  assert.match(html, /<h3>Comparison Index<\/h3>/)
  assert.match(html, /aria-label="Comparison navigation"/)
  assert.match(html, /<select class="field-select" data-comparison-difference-filter/)
  assert.match(html, /All compared paths \(2\)/)
  assert.match(html, /Title \(1\)/)
  assert.match(html, /data-comparison-visible-count>2<\/span> of 2 compared paths shown/)
  assert.match(html, /href="#comparison-1-home"/)
  assert.match(html, /id="comparison-1-home"/)
  assert.match(html, /https:\/\/www\.example\.com\/home<\/code> → <code>https:\/\/stage\.example\.com\/home/)
  assert.match(html, /data-comparison-card/)
  assert.match(html, /data-comparison-diff-only/)
  assert.match(html, /class="toggle-switch"/)
  assert.match(html, /class="toggle-switch-control"/)
  assert.match(html, /data-comparison-field-changed="false"/)
  assert.match(html, /data-comparison-field-changed="true"/)
  assert.match(html, /data-difference-keys="title"/)
  assert.match(html, /data-has-differences="true"/)
  assert.match(html, /data-has-differences="false"/)
  assert.match(html, /data-nav-tab="comparison"/)
  assert.doesNotMatch(html, /data-nav-active-btn/)
  assert.match(html, /function syncNavGroupFilter\(group\)/)
  assert.match(html, /function matchesNavGroupFilter\(element, group, selectedFilter\)/)
  assert.match(html, /function syncComparisonFieldRows\(group\)/)
  assert.match(html, /diffOnlyToggleSelector: '\[data-comparison-diff-only\]'/)
  assert.match(html, /function scrollNavLinkIntoView\(group, link\)/)
  assert.match(html, /group\.nav\.scrollTop -= \(navRect\.top - linkRect\.top\) \+ scrollPadding/)
  assert.match(html, /group\.nav\.scrollTop \+= \(linkRect\.bottom - navRect\.bottom\) \+ scrollPadding/)
  assert.match(html, /navSelector: '#tab-comparison \.page-index-nav'/)
  assert.match(html, /function getTabForAnchorId\(anchorId\)/)
  assert.match(html, /anchorTarget\.hasAttribute\('data-comparison-card'\)/)
  assert.match(html, /filterMatchMode: 'multi'/)
})
