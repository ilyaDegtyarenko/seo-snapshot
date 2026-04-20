import test from 'node:test'
import assert from 'node:assert/strict'
import { extractSeoInfoFromHtml } from '../src/extract-seo.mjs'

test('extractSeoInfoFromHtml parses detailed SEO fields from head and JSON-LD', () => {
  const html = `<!doctype html>
  <html lang="uk">
    <head>
      <meta charset="utf-8">
      <title>Movie page</title>
      <meta name="description" content="Long enough movie description for a useful SEO snippet.">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta property="og:title" content="Movie page OG">
      <meta property="og:description" content="OG description">
      <meta property="og:type" content="video.movie">
      <meta property="og:locale" content="uk_UA">
      <meta property="og:locale:alternate" content="en_US">
      <meta property="og:image" content="/cover.jpg">
      <meta property="og:image:alt" content="Movie poster">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:url" content="/movie/123">
      <meta name="twitter:image" content="/cover.jpg">
      <meta name="twitter:image" content="/cover-duplicate.jpg">
      <meta name="apple-itunes-app" content="app-id=123, app-argument=app://movie/123">
      <meta property="al:ios:url" content="app://movie/123">
      <meta property="al:android:package" content="tv.sweet.player">
      <meta http-equiv="Content-Language" content="uk">
      <link rel="canonical" href="/movie/123">
      <link rel="manifest" href="/manifest.json">
      <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
      <link rel="alternate" hreflang="uk" href="/uk/movie/123">
      <link rel="alternate" type="text/plain" title="LLMs index" href="/llms.txt">
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Movie","name":"Movie title","url":"https://example.com/movie/123"}
      </script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"SWEET.TV","url":"https://example.com/"},{"@type":"Organization","name":"SWEET.TV","url":"https://example.com/"}]}
      </script>
    </head>
    <body>
      <h1>Movie title</h1>
      <p>Some visible text for the page content.</p>
    </body>
  </html>`

  const result = extractSeoInfoFromHtml(html, 'https://example.com/movie/123')

  assert.equal(result.document.lang, 'uk')
  assert.equal(result.document.contentLanguage, 'uk')
  assert.equal(result.document.title, 'Movie page')
  assert.deepEqual(result.document.h1, [ 'Movie title' ])
  assert.equal(result.meta.charset, 'utf-8')
  assert.equal(result.meta.viewport, 'width=device-width, initial-scale=1')
  assert.equal(result.meta.description, 'Long enough movie description for a useful SEO snippet.')
  assert.equal(result.meta.openGraph.type, 'video.movie')
  assert.equal(result.meta.openGraph.imageAlt, 'Movie poster')
  assert.equal(result.meta.openGraph.locale, 'uk_UA')
  assert.deepEqual(result.meta.openGraph.localeAlternates, [ 'en_US' ])
  assert.equal(result.links.canonical, 'https://example.com/movie/123')
  assert.equal(result.links.manifest, 'https://example.com/manifest.json')
  assert.equal(result.links.favicon, 'https://example.com/favicon.ico')
  assert.equal(result.links.alternates[0].href, 'https://example.com/uk/movie/123')
  assert.equal(result.links.alternateResources[0].href, 'https://example.com/llms.txt')
  assert.equal(result.meta.openGraph.image, 'https://example.com/cover.jpg')
  assert.equal(result.meta.twitter.card, 'summary_large_image')
  assert.equal(result.meta.twitter.url, 'https://example.com/movie/123')
  assert.equal(result.meta.appleItunesApp, 'app-id=123, app-argument=app://movie/123')
  assert.equal(result.meta.appLinks.iosUrl, 'app://movie/123')
  assert.equal(result.meta.appLinks.androidPackage, 'tv.sweet.player')
  assert.deepEqual(result.jsonLd.types, [ 'Movie', 'Organization', 'WebSite' ])
  assert.equal(result.jsonLd.hasWebSite, true)
  assert.equal(result.jsonLd.hasOrganization, true)
  assert.equal(result.jsonLd.blocks.length, 2)
  assert.match(result.jsonLd.blocks[0].summary, /Movie/)
  assert.match(result.jsonLd.blocks[0].json, /"@type": "Movie"/)
  assert.match(result.jsonLd.blocks[0].json, /"name": "Movie title"/)
  assert.deepEqual(result.head.duplicates, [
    {
      key: 'twitterImage',
      label: 'meta[name="twitter:image"]',
      count: 2,
    },
  ])
})

test('extractSeoInfoFromHtml counts images without alt and internal links', () => {
  const html = `<!doctype html>
  <html lang="en">
    <head><title>Image test</title></head>
    <body>
      <img src="/a.jpg" alt="Photo A">
      <img src="/b.jpg" alt="">
      <img src="/c.jpg">
      <a href="/page1">Internal</a>
      <a href="/page2">Internal 2</a>
      <a href="https://external.com/page">External</a>
      <a href="https://example.com/page3">Same host</a>
      <a href="mailto:test@example.com">Mail</a>
    </body>
  </html>`

  const result = extractSeoInfoFromHtml(html, 'https://example.com/test')

  assert.equal(result.document.imageCount, 3)
  assert.equal(result.document.imagesWithoutAlt, 1)
  assert.equal(result.document.imagesWithEmptyAlt, 1)
  assert.equal(result.document.internalLinkCount, 3)
})

test('extractSeoInfoFromHtml extracts heading hierarchy', () => {
  const html = `<!doctype html>
  <html lang="en">
    <head><title>Headings</title></head>
    <body>
      <h1>Title</h1>
      <h2>Section</h2>
      <h4>Skipped H3</h4>
      <h2>Another section</h2>
    </body>
  </html>`

  const result = extractSeoInfoFromHtml(html, 'https://example.com/')

  assert.deepEqual(result.document.headingHierarchy, [ 1, 2, 4, 2 ])
})

test('extractSeoInfoFromHtml counts body text from parsed visible nodes', () => {
  const html = `<!doctype html>
  <html lang="en">
    <head><title>Hidden text test</title></head>
    <body>
      <main>Visible&nbsp;text <span>kept</span></main>
      <div hidden>Hidden text</div>
      <section aria-hidden="true">ARIA hidden text</section>
      <p style="display: none">Display none text</p>
      <p style="visibility: hidden">Visibility hidden text</p>
      <p style="content-visibility: hidden">Content visibility hidden text</p>
      <template>Template text</template>
      <noscript>No script text</noscript>
      <script>document.write('Script text')</script>
      <style>.x { display: block; }</style>
    </body>
  </html>`

  const result = extractSeoInfoFromHtml(html, 'https://example.com/text')

  assert.equal(result.document.bodyTextLength, 17)
})

test('extractSeoInfoFromHtml counts text inside an unclosed body tag', () => {
  const html = '<html><head><title>Test</title></head><body><main>Visible text</main>'

  const result = extractSeoInfoFromHtml(html, 'https://example.com/text')

  assert.equal(result.document.bodyTextLength, 12)
})

test('extractSeoInfoFromHtml preserves inline text and separates block text', () => {
  const html = '<html><body><p>One<span>Two</span></p><p>Three<br>Four</p></body></html>'

  const result = extractSeoInfoFromHtml(html, 'https://example.com/text')

  assert.equal(result.document.bodyTextLength, 17)
})

test('extractSeoInfoFromHtml detects missing required schema properties', () => {
  const html = `<!doctype html>
  <html lang="en">
    <head>
      <title>Schema test</title>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","headline":"Test"}
      </script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Widget","offers":{"@type":"Offer"}}
      </script>
    </head>
    <body><h1>Test</h1></body>
  </html>`

  const result = extractSeoInfoFromHtml(html, 'https://example.com/test')

  assert.equal(Array.isArray(result.jsonLd.missingRequiredProperties), true)
  assert.equal(result.jsonLd.missingRequiredProperties.length > 0, true)

  const articleIssues = result.jsonLd.missingRequiredProperties.filter(issue => issue.type === 'Article')
  const issuePairs = result.jsonLd.missingRequiredProperties.map(issue => `${ issue.type }.${ issue.property }`)

  assert.equal(articleIssues.length > 0, true)
  assert.equal(issuePairs.includes('Article.author'), true)
  assert.equal(issuePairs.includes('Article.datePublished'), true)
  assert.equal(issuePairs.includes('Offer.price'), true)
  assert.equal(issuePairs.includes('Offer.priceCurrency'), true)
})
