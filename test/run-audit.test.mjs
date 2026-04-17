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

test('runAudit records responseTimeMs for each page', async (context) => {
  const tempDir = await createTempDir()
  const originalFetch = globalThis.fetch

  context.after(async () => {
    globalThis.fetch = originalFetch
    await rm(tempDir, { recursive: true, force: true })
  })

  globalThis.fetch = async () => {
    return new Response('<!doctype html><html><head><title>Test</title></head><body><h1>Hi</h1><p>content word </p></body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
  }

  const result = await runAudit({}, {
    cwd: tempDir,
    env: {
      SEO_SNAPSHOT_CONFIG: JSON.stringify({
        baseUrl: 'https://example.com',
        targets: [ '/' ],
        output: { dir: './reports', formats: [ 'json' ] },
      }),
    },
  })

  assert.equal(typeof result.report.pages[0].responseTimeMs, 'number')
  assert.equal(result.report.pages[0].responseTimeMs >= 0, true)
})

test('runAudit captures security headers from response', async (context) => {
  const tempDir = await createTempDir()
  const originalFetch = globalThis.fetch

  context.after(async () => {
    globalThis.fetch = originalFetch
    await rm(tempDir, { recursive: true, force: true })
  })

  globalThis.fetch = async () => {
    return new Response('<!doctype html><html><head><title>Sec</title></head><body><h1>Hi</h1><p>content text</p></body></html>', {
      status: 200,
      headers: {
        'content-type': 'text/html',
        'content-language': 'uk',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'DENY',
      },
    })
  }

  const result = await runAudit({}, {
    cwd: tempDir,
    env: {
      SEO_SNAPSHOT_CONFIG: JSON.stringify({
        baseUrl: 'https://example.com',
        targets: [ '/' ],
        output: { dir: './reports', formats: [ 'json' ] },
      }),
    },
  })

  assert.equal(result.report.pages[0].headers.contentLanguage, 'uk')
  assert.equal(result.report.pages[0].headers.contentSecurityPolicy, "default-src 'self'")
  assert.equal(result.report.pages[0].headers.xFrameOptions, 'DENY')
})

test('runAudit emits progress messages via onProgress callback', async (context) => {
  const tempDir = await createTempDir()
  const originalFetch = globalThis.fetch
  const progressMessages = []

  context.after(async () => {
    globalThis.fetch = originalFetch
    await rm(tempDir, { recursive: true, force: true })
  })

  globalThis.fetch = async () => {
    return new Response('<!doctype html><html><head><title>T</title></head><body><h1>H</h1><p>text</p></body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
  }

  await runAudit({}, {
    cwd: tempDir,
    env: {
      SEO_SNAPSHOT_CONFIG: JSON.stringify({
        baseUrl: 'https://example.com',
        targets: [ '/', '/news' ],
        output: { dir: './reports', formats: [ 'json' ] },
      }),
    },
    onProgress: (message) => progressMessages.push(message),
  })

  assert.equal(progressMessages.length, 2)
  assert.match(progressMessages[0], /\[1\/2\]/)
  assert.match(progressMessages[1], /\[2\/2\]/)
})

test('runAudit filters comparison output when diffOnly is enabled', async (context) => {
  const tempDir = await createTempDir()
  const originalFetch = globalThis.fetch
  const originalDateNow = Date.now

  context.after(async () => {
    globalThis.fetch = originalFetch
    Date.now = originalDateNow
    await rm(tempDir, { recursive: true, force: true })
  })

  Date.now = () => 1_000

  globalThis.fetch = async (url) => {
    const currentUrl = new URL(String(url))
    const isDifferentPath = currentUrl.pathname === '/different'
    const title = isDifferentPath && currentUrl.host === 'stage.example.com'
      ? 'Different Stage Title'
      : 'Shared Title'
    const description = `${ title } ${ 'content '.repeat(20).trim() }`

    return new Response(`<!doctype html><html lang="en"><head><title>${ title }</title><meta name="description" content="${ description }"></head><body><h1>${ title }</h1><p>${ 'content '.repeat(80).trim() }</p></body></html>`, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
  }

  const result = await runAudit({ diffOnly: true }, {
    cwd: tempDir,
    env: {
      SEO_SNAPSHOT_CONFIG: JSON.stringify({
        baseUrl: 'https://www.example.com',
        compare: {
          baseUrl: 'https://stage.example.com',
        },
        targets: [ '/same', '/different' ],
        output: { dir: './reports', formats: [ 'json' ] },
      }),
    },
  })

  assert.equal(result.report.options.diffOnly, true)
  assert.equal(result.report.comparison.targetCount, 1)
  assert.equal(result.report.comparison.comparisons.length, 1)
  assert.equal(result.report.comparison.comparisons[0].targetPath, '/different')
})
