import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runAudit } from '../src/run-audit.mjs'

const createTempDir = async () => {
  return mkdtemp(path.join(os.tmpdir(), 'seo-snapshot-run-audit-'))
}

test('runAudit records the expanded target count when variants are enabled', async (context) => {
  const tempDir = await createTempDir()
  const requests = []
  const originalFetch = globalThis.fetch
  const responseBody = `<!doctype html>
<html lang="en">
  <head>
    <title>Snapshot Test</title>
    <meta name="description" content="${ 'SEO snapshot integration test '.repeat(4).trim() }">
  </head>
  <body>
    <h1>Snapshot Test</h1>
    <p>${ 'content '.repeat(80).trim() }</p>
  </body>
</html>`

  context.after(async () => {
    globalThis.fetch = originalFetch
    await rm(tempDir, { recursive: true, force: true })
  })

  globalThis.fetch = async (url, options = {}) => {
    requests.push({
      url: String(url),
      userAgent: options.headers?.['user-agent'] ?? null,
    })

    return new Response(responseBody, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    })
  }

  const result = await runAudit({}, {
    cwd: tempDir,
    env: {
      SEO_SNAPSHOT_CONFIG: JSON.stringify({
        baseUrl: 'https://www.example.com',
        targets: [ '/', '/catalog' ],
        output: {
          dir: './reports',
          formats: [ 'json' ],
        },
        request: {
          timeoutMs: 5_000,
          maxRedirects: 2,
          concurrency: 2,
          userAgent: [
            { label: 'Desktop', userAgent: 'desktop-bot' },
            { label: 'Mobile', userAgent: 'mobile-bot' },
          ],
        },
      }),
    },
  })

  assert.equal(result.report.options.targetCount, 4)
  assert.equal(result.summary.total, 4)
  assert.equal(requests.length, 4)
  assert.deepEqual(requests.map(request => request.userAgent), [
    'desktop-bot',
    'mobile-bot',
    'desktop-bot',
    'mobile-bot',
  ])
  assert.deepEqual([ ...new Set(result.report.pages.map(page => page.variantId)) ], [
    'variant-1',
    'variant-2',
  ])
})
