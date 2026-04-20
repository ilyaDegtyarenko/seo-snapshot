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
  variant = null,
  variantId = null,
  issues = [],
} = {}) => ({
  input,
  targetPath,
  source,
  variant,
  variantId,
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

const createReport = ({ pages, comparison = null, fullConfig = null }) => ({
  generatedAt: '2026-04-09T12:00:00.000Z',
  options: {
    configPath: 'config/seo-snapshot.mjs',
    fullConfig: fullConfig ?? {
      baseUrl: 'https://www.example.com/',
      targets: [ '/home' ],
      request: {
        timeoutMs: 15000,
        maxRedirects: 5,
        concurrency: 3,
        userAgent: 'seo-snapshot-test',
      },
      output: {
        dir: '/tmp/seo-snapshot',
        formats: [ 'html' ],
      },
      audit: {
        minTitleLength: 15,
        maxTitleLength: 60,
        minDescriptionLength: 70,
        maxDescriptionLength: 160,
        minBodyTextLength: 300,
      },
    },
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
  assert.match(html, /--anchor-scroll-offset: 56px;/)
  assert.match(html, /scroll-padding-top: var\(--anchor-scroll-offset\);/)
  assert.match(html, /scroll-margin-top: var\(--anchor-scroll-offset\);/)
  assert.match(html, /function updateAnchorScrollOffset\(\)/)
  assert.match(html, /document\.querySelectorAll\('\.variant-group-title'\)/)
  assert.match(html, /document\.documentElement\.style\.setProperty\('--anchor-scroll-offset', offset \+ 'px'\)/)
  assert.match(html, /function scrollToAnchorTarget\(target\)/)
  assert.match(html, /window\.scrollTo\(\{ top: top, behavior: 'smooth' \}\)/)
  assert.match(html, /function handleInternalAnchorClick\(event\)/)
  assert.match(html, /document\.addEventListener\('click', handleInternalAnchorClick\)/)
  assert.doesNotMatch(html, /scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/)
  assert.match(html, /function getActiveNavLink\(group\)/)
  assert.match(html, /scrollNavLinkIntoView\(group, getActiveNavLink\(group\)\)/)
  assert.match(html, /window\.addEventListener\('scroll', requestScrollSync, \{ passive: true \}\)/)
  assert.match(html, /data-scroll-top/)
  assert.match(html, /link\.setAttribute\('aria-current', 'location'\)/)
})

test('renderHtmlReport prints the resolved full config as JSON', () => {
  const html = renderHtmlReport(createReport({
    fullConfig: {
      baseUrl: 'https://resolved.example.com',
      compareUrl: 'https://stage.example.com',
      targets: [ '/', '/pricing' ],
      request: {
        timeoutMs: 9000,
        concurrency: 4,
        headers: {
          'x-test': 'yes',
        },
      },
      output: {
        dir: '/tmp/resolved-reports',
        formats: [ 'html', 'json' ],
      },
    },
    pages: [
      createPage(),
    ],
  }))

  assert.match(html, /<summary>Full config<\/summary>/)
  assert.match(html, /&quot;baseUrl&quot;: &quot;https:\/\/resolved\.example\.com&quot;/)
  assert.match(html, /&quot;compareUrl&quot;: &quot;https:\/\/stage\.example\.com&quot;/)
  assert.match(html, /&quot;targets&quot;: \[/)
  assert.match(html, /&quot;x-test&quot;: &quot;yes&quot;/)
  assert.match(html, /&quot;formats&quot;: \[/)
  assert.match(html, /\.raw-details \{[^}]*min-width: 0;/s)
  assert.match(html, /\.raw-details pre \{[^}]*max-width: 100%;[^}]*white-space: pre-wrap;[^}]*overflow-wrap: anywhere;/s)
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
  assert.doesNotMatch(html, /<a class="card-link" href="#comparison-/)
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

test('renderHtmlReport shows expandable full JSON-LD schemas on page cards', () => {
  const page = createPage()
  page.seo.jsonLd.blocks = [
    {
      hash: 'abc123',
      json: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        author: {
          '@type': 'Person',
          name: 'Ada Lovelace',
        },
        headline: 'Example headline',
      }, null, 2),
      preview: '{"@context":"https://schema.org","@type":"Article","headline":"Example headline"}',
      summary: 'Article | Example headline',
    },
  ]

  const html = renderHtmlReport(createReport({
    pages: [ page ],
  }))

  assert.match(html, /<h3>JSON-LD blocks<\/h3>/)
  assert.match(html, /<details class="jsonld-details">\s*<summary>Full schema<\/summary>\s*<pre>/)
  assert.match(html, /&quot;@context&quot;: &quot;https:\/\/schema\.org&quot;/)
  assert.match(html, /&quot;headline&quot;: &quot;Example headline&quot;/)
  assert.match(html, /\.jsonld-details pre \{[\s\S]*max-height: 420px;[\s\S]*white-space: pre-wrap;[\s\S]*overflow-wrap: anywhere;/)
  assert.doesNotMatch(html, /<div class="muted"><code>\{&quot;@context&quot;/)
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
  assert.match(html, /<a class="card-link" href="#page-1-home" title="https:\/\/www\.example\.com\/home"><span class="card-link-icon" aria-hidden="true">→<\/span><span>Go to prod page<\/span><\/a>/)
  assert.match(html, /<a class="card-link" href="#page-2-home" title="https:\/\/stage\.example\.com\/home"><span class="card-link-icon" aria-hidden="true">→<\/span><span>Go to stage page<\/span><\/a>/)
  assert.match(html, /<a class="card-link" href="#comparison-1-home" title="\/home"><span class="card-link-icon" aria-hidden="true">→<\/span><span>Go to comparison<\/span><\/a>/)
  assert.match(html, /\.card-link \{[\s\S]*min-height: 24px;[\s\S]*padding: 3px 8px;[\s\S]*font-size: 11px;/)
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
  assert.match(html, /function ensureAnchorVisible\(anchorId\)/)
  assert.match(html, /group\.filter\.value = 'all'/)
  assert.match(html, /group\.diffOnlyToggle\.checked = false/)
  assert.match(html, /filterMatchMode: 'multi'/)
})

test('renderHtmlReport highlights changed fragments inside comparison values', () => {
  const comparison = {
    sources: [
      { label: 'prod', url: 'https://www.example.com/' },
      { label: 'stage', url: 'https://stage.example.com/' },
    ],
    targetCount: 1,
    targetsWithDifferences: 1,
    totalDifferences: 5,
    differenceBreakdown: [
      { key: 'canonical', label: 'Canonical', count: 2 },
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
          { key: 'canonical', label: 'Canonical', left: 'hello /uk es.', right: 'hello / es.' },
          { key: 'alternate', label: 'Alternate', left: 'hello / es.', right: 'hello /uk es.' },
          { key: 'bodyTextLength', label: 'Body text length', left: 12, right: 123 },
          { key: 'jsonLdBlocks', label: 'JSON-LD blocks', left: [ 'hash-a | WebPage', 'hash-old | Article | Old' ], right: [ 'hash-b | WebPage', 'hash-new | Product' ] },
          { key: 'issueCodes', label: 'Issue codes', left: [ 'missing_title' ], right: [ 'missing_description' ] },
        ],
        fields: [
          { key: 'canonical', label: 'Canonical', left: 'hello /uk es.', right: 'hello / es.', changed: true },
          { key: 'alternate', label: 'Alternate', left: 'hello / es.', right: 'hello /uk es.', changed: true },
          { key: 'bodyTextLength', label: 'Body text length', left: 12, right: 123, changed: true },
          { key: 'jsonLdBlocks', label: 'JSON-LD blocks', left: [ 'hash-a | WebPage', 'hash-old | Article | Old' ], right: [ 'hash-b | WebPage', 'hash-new | Product' ], changed: true },
          { key: 'issueCodes', label: 'Issue codes', left: [ 'missing_title' ], right: [ 'missing_description' ], changed: true },
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
      }),
    ],
  }))

  assert.match(html, /hello \/<span class="diff-inline-change diff-inline-change-old">uk<\/span> es\./)
  assert.match(html, /hello \/<span class="diff-inline-change diff-inline-change-new">uk<\/span> es\./)
  assert.match(html, /<span class="diff-inline-label">Body text length<\/span>\s*<span class="diff-inline-old">12<\/span>\s*<span class="diff-arrow">→<\/span>\s*<span class="diff-inline-new">123<\/span>/)
  assert.match(html, /<span class="diff-inline-label">JSON-LD blocks<\/span>[\s\S]*<span class="jsonld-compare-status">Changed<\/span>[\s\S]*<span class="jsonld-block-summary">WebPage<\/span>[\s\S]*<span class="jsonld-block-hash">hash-a<\/span>[\s\S]*<span class="jsonld-block-hash">hash-b<\/span>/)
  assert.match(html, /<span class="jsonld-compare-status">Removed<\/span>[\s\S]*<span class="jsonld-block-summary">Article \| Old<\/span>[\s\S]*<span class="jsonld-block-hash">hash-old<\/span>/)
  assert.match(html, /<span class="jsonld-compare-status">Added<\/span>[\s\S]*<span class="jsonld-block-summary">Product<\/span>[\s\S]*<span class="jsonld-block-hash">hash-new<\/span>/)
  assert.match(html, /<span class="diff-inline-label">Issue codes<\/span>\s*<span class="diff-inline-old">missing_title<\/span>\s*<span class="diff-arrow">→<\/span>\s*<span class="diff-inline-new">missing_description<\/span>/)
  assert.match(html, /\.diff-inline-change-new \{[\s\S]*background: #064e3b;[\s\S]*color: #a7f3d0;/)
})

test('renderHtmlReport offsets anchors below sticky User-Agent variant headers', () => {
  const html = renderHtmlReport(createReport({
    pages: [
      createPage({
        input: '/home',
        targetPath: '/home',
        title: 'Desktop Home',
        variant: 'Desktop',
        variantId: 'desktop',
      }),
      createPage({
        input: '/home',
        targetPath: '/home',
        title: 'Mobile Home',
        variant: 'Mobile',
        variantId: 'mobile',
      }),
    ],
  }))

  assert.match(html, /<summary class="variant-group-title">Desktop<\/summary>/)
  assert.match(html, /<summary class="variant-group-title">Mobile<\/summary>/)
  assert.match(html, /var offset = maxStickyTitleHeight > 0 \? Math\.ceil\(maxStickyTitleHeight \+ 16\) : 24/)
  assert.match(html, /return offset/)
  assert.match(html, /var top = Math\.max\(0, window\.scrollY \+ target\.getBoundingClientRect\(\)\.top - offset\)/)
  assert.match(html, /scrollToAnchorTarget\(target\)/)
  assert.match(html, /if \(location\.hash === '#' \+ anchorId\) \{\s+syncFromHash\(\)\s+return\s+\}/)
  assert.match(html, /updateAnchorScrollOffset\(\)\s+if \(updateHash\)/)
  assert.match(html, /window\.addEventListener\('resize', function \(\) \{\s+updateAnchorScrollOffset\(\)\s+requestScrollSync\(\)\s+\}\)/)
})
