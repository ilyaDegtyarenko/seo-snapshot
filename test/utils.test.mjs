import test from 'node:test'
import assert from 'node:assert/strict'
import { getSourceHosts, isSourceLocalUrl, parseLinkHeader, sortByCountDesc } from '../src/utils.mjs'

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

test('getSourceHosts collects unique lowercase hosts from page URL candidates', () => {
  const hosts = getSourceHosts({
    source: { url: 'https://WWW.Example.Com/page' },
    finalUrl: 'https://www.example.com/page',
    requestedUrl: 'https://www.example.com/page',
  })

  assert.deepEqual(hosts, new Set([ 'www.example.com' ]))
})

test('isSourceLocalUrl returns true for same-host URLs and false for foreign hosts', () => {
  const page = {
    source: { url: 'https://www.example.com/' },
    finalUrl: 'https://www.example.com/page',
    requestedUrl: 'https://www.example.com/page',
  }

  assert.equal(isSourceLocalUrl('https://www.example.com/other', page), true)
  assert.equal(isSourceLocalUrl('https://other.example.com/page', page), false)
  assert.equal(isSourceLocalUrl(null, page), null)
  assert.equal(isSourceLocalUrl('not-a-url', page), null)
})

test('sortByCountDesc sorts by count descending then by label alphabetically', () => {
  const input = [
    { label: 'b', count: 2 },
    { label: 'a', count: 2 },
    { label: 'c', count: 5 },
  ]
  const result = sortByCountDesc(input, 'label')

  assert.deepEqual(result, [
    { label: 'c', count: 5 },
    { label: 'a', count: 2 },
    { label: 'b', count: 2 },
  ])
})
