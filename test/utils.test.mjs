import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLinkHeader } from '../src/utils.mjs'

test('parseLinkHeader extracts canonical, llms, and hreflang entries from response headers', () => {
  const entries = parseLinkHeader(
    '<https://example.com/catalog>; rel="canonical", <https://example.com/llms.txt>; rel="llms"; type="text/plain", </en/catalog>; rel="alternate"; hreflang="en"',
    'https://example.com/catalog',
  )

  assert.deepEqual(entries, [
    {
      href: 'https://example.com/catalog',
      rel: 'canonical',
      relTokens: [ 'canonical' ],
      hreflang: null,
      title: null,
      type: null,
    },
    {
      href: 'https://example.com/llms.txt',
      rel: 'llms',
      relTokens: [ 'llms' ],
      hreflang: null,
      title: null,
      type: 'text/plain',
    },
    {
      href: 'https://example.com/en/catalog',
      rel: 'alternate',
      relTokens: [ 'alternate' ],
      hreflang: 'en',
      title: null,
      type: null,
    },
  ])
})
