import test from 'node:test'
import assert from 'node:assert/strict'
import { extractSeoInfoFromHtml } from '../src/extract-seo.mjs'

test('extractSeoInfoFromHtml parses core SEO fields', () => {
  const html = `<!doctype html>
  <html lang="uk">
    <head>
      <title>Movie page</title>
      <meta name="description" content="Long enough movie description for a useful SEO snippet.">
      <meta property="og:title" content="Movie page OG">
      <meta property="og:description" content="OG description">
      <meta property="og:image" content="/cover.jpg">
      <meta name="twitter:card" content="summary_large_image">
      <link rel="canonical" href="/movie/123">
      <link rel="alternate" hreflang="uk" href="/uk/movie/123">
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Movie"}
      </script>
    </head>
    <body>
      <h1>Movie title</h1>
      <p>Some visible text for the page content.</p>
    </body>
  </html>`

  const result = extractSeoInfoFromHtml(html, 'https://example.com/movie/123')

  assert.equal(result.document.lang, 'uk')
  assert.equal(result.document.title, 'Movie page')
  assert.deepEqual(result.document.h1, [ 'Movie title' ])
  assert.equal(result.meta.description, 'Long enough movie description for a useful SEO snippet.')
  assert.equal(result.links.canonical, 'https://example.com/movie/123')
  assert.equal(result.links.alternates[0].href, 'https://example.com/uk/movie/123')
  assert.equal(result.meta.openGraph.image, 'https://example.com/cover.jpg')
  assert.equal(result.meta.twitter.card, 'summary_large_image')
  assert.deepEqual(result.jsonLd.types, [ 'Movie' ])
})
