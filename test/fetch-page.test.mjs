import test from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { fetchWithRedirects } from '../src/fetch-page.mjs'

const createHeaders = (entries = {}) => ({
  get: name => entries[String(name).toLowerCase()] ?? null,
})

const createResponse = ({
  status = 200,
  location = null,
  body = '<!doctype html><html><head><title>Test</title></head><body>ok</body></html>',
} = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: createHeaders(location ? { location } : {}),
  text: async () => body,
})

test('fetchWithRedirects measures ttfb before reading the response body', async (context) => {
  const originalFetch = globalThis.fetch
  let bodyWasRead = false

  context.after(() => {
    globalThis.fetch = originalFetch
  })

  context.mock.method(performance, 'now', (() => {
    const values = [ 1000, 1123, 1450 ]
    return () => values.shift() ?? 1450
  })())

  globalThis.fetch = async () => createResponse({
    body: '<html>body</html>',
    status: 200,
  })

  const result = await fetchWithRedirects('https://example.com', {
    maxRedirects: 0,
    timeoutMs: 5_000,
    userAgent: 'seo-snapshot-test',
  })

  bodyWasRead = Boolean(result.body)

  assert.equal(bodyWasRead, true)
  assert.equal(result.ttfbMs, 123)
})

test('fetchWithRedirects measures ttfb across redirect hops until final response headers', async (context) => {
  const originalFetch = globalThis.fetch
  let requestCount = 0

  context.after(() => {
    globalThis.fetch = originalFetch
  })

  context.mock.method(performance, 'now', (() => {
    const values = [ 2000, 2175 ]
    return () => values.shift() ?? 2175
  })())

  globalThis.fetch = async (url) => {
    requestCount += 1

    if (requestCount === 1) {
      return createResponse({
        status: 301,
        location: '/final',
        body: '',
      })
    }

    return createResponse({
      status: 200,
      body: `<html>${ url }</html>`,
    })
  }

  const result = await fetchWithRedirects('https://example.com/start', {
    maxRedirects: 2,
    timeoutMs: 5_000,
    userAgent: 'seo-snapshot-test',
  })

  assert.equal(requestCount, 2)
  assert.equal(result.finalUrl, 'https://example.com/final')
  assert.equal(result.ttfbMs, 175)
  assert.deepEqual(result.redirectChain, [
    {
      url: 'https://example.com/start',
      status: 301,
      location: 'https://example.com/final',
    },
    {
      url: 'https://example.com/final',
      status: 200,
      location: null,
    },
  ])
})
