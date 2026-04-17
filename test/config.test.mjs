import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readSeoConfig, resolveTargets } from '../src/config.mjs'

const createTempDir = async () => {
  return mkdtemp(path.join(os.tmpdir(), 'seo-snapshot-config-'))
}

test('readSeoConfig merges file config with env overrides', async (context) => {
  const tempDir = await createTempDir()

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const configPath = path.join(tempDir, 'seo-snapshot.mjs')

  await writeFile(configPath, `export default {
  baseUrl: 'https://file.example',
  targets: [ '/file-only' ],
  output: {
    dir: './reports',
    formats: [ 'html' ],
  },
  request: {
    timeoutMs: 3000,
    concurrency: 2,
  },
  audit: {
    minTitleLength: 12,
  },
}
`, 'utf8')

  const result = await readSeoConfig('./seo-snapshot.mjs', tempDir, {
    SEO_SNAPSHOT_BASE_URL: 'https://env.example',
    SEO_SNAPSHOT_TARGETS: '/,/news',
    SEO_SNAPSHOT_OUTPUT_FORMATS: 'html,json',
    SEO_SNAPSHOT_REQUEST_CONCURRENCY: '6',
  })

  assert.equal(result.absoluteConfigPath, configPath)
  assert.equal(result.configDir, tempDir)
  assert.equal(result.config.baseUrl, 'https://env.example')
  assert.deepEqual(result.config.targets, [ '/', '/news' ])
  assert.deepEqual(result.config.output.formats, [ 'html', 'json' ])
  assert.equal(result.config.request.timeoutMs, 3000)
  assert.equal(result.config.request.concurrency, 6)
  assert.equal(result.config.audit.minTitleLength, 12)
})

test('readSeoConfig supports env-only config', async () => {
  const tempDir = await createTempDir()

  try {
    const result = await readSeoConfig(undefined, tempDir, {
      SEO_SNAPSHOT_CONFIG: JSON.stringify({
        baseUrl: 'https://env.example',
        targets: [ '/', '/catalog' ],
        output: {
          dir: './env-reports',
          formats: [ 'json' ],
        },
        request: {
          timeoutMs: 4500,
        },
      }),
      SEO_SNAPSHOT_REQUEST_CONCURRENCY: '5',
    })

    assert.equal(result.absoluteConfigPath, null)
    assert.equal(result.configDir, tempDir)
    assert.equal(result.config.baseUrl, 'https://env.example')
    assert.deepEqual(result.config.targets, [ '/', '/catalog' ])
    assert.equal(result.config.output.dir, './env-reports')
    assert.deepEqual(result.config.output.formats, [ 'json' ])
    assert.equal(result.config.request.timeoutMs, 4500)
    assert.equal(result.config.request.concurrency, 5)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('readSeoConfig loads config path from env', async (context) => {
  const tempDir = await createTempDir()

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const configPath = path.join(tempDir, 'custom.config.mjs')

  await writeFile(configPath, `export default {
  baseUrl: 'https://path.example',
  targets: [ '/' ],
}
`, 'utf8')

  const result = await readSeoConfig(undefined, tempDir, {
    SEO_SNAPSHOT_CONFIG_PATH: './custom.config.mjs',
  })

  assert.equal(result.absoluteConfigPath, configPath)
  assert.equal(result.config.baseUrl, 'https://path.example')
  assert.deepEqual(result.config.targets, [ '/' ])
})

test('readSeoConfig supports single compare domain from env override', async () => {
  const tempDir = await createTempDir()

  try {
    const result = await readSeoConfig(undefined, tempDir, {
      SEO_SNAPSHOT_BASE_URL: 'https://www.example.com',
      SEO_SNAPSHOT_COMPARE_BASE_URL: 'https://stage.example.com',
      SEO_SNAPSHOT_TARGETS: '/news',
    })

    assert.equal(result.absoluteConfigPath, null)
    assert.deepEqual(result.config.compare, {
      baseUrl: 'https://stage.example.com',
    })
    assert.equal(result.config.baseUrl, 'https://www.example.com')
    assert.deepEqual(result.config.targets, [ '/news' ])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('readSeoConfig uses the default runtime config path without any local overlay', async (context) => {
  const tempDir = await createTempDir()

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const configDir = path.join(tempDir, 'config')
  const configPath = path.join(configDir, 'seo-snapshot.mjs')

  await mkdir(configDir, { recursive: true })
  await writeFile(configPath, `export default {
  baseUrl: 'https://runtime.example.com',
  targets: [ '/from-file' ],
  output: {
    formats: [ 'html', 'json' ],
  },
  request: {
    timeoutMs: 3000,
    concurrency: 2,
  },
}
`, 'utf8')

  const result = await readSeoConfig(undefined, tempDir, {
    SEO_SNAPSHOT_REQUEST_CONCURRENCY: '8',
  })

  assert.equal(result.absoluteConfigPath, configPath)
  assert.equal(result.configDir, configDir)
  assert.equal(result.config.baseUrl, 'https://runtime.example.com')
  assert.deepEqual(result.config.targets, [ '/from-file' ])
  assert.equal(result.config.request.timeoutMs, 3000)
  assert.equal(result.config.request.concurrency, 8)
  assert.match(result.configLabel, /seo-snapshot\.mjs \+ env$/)
})

test('readSeoConfig supports env-only overrides without a runtime config file', async (context) => {
  const tempDir = await createTempDir()

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const result = await readSeoConfig(undefined, tempDir, {
    SEO_SNAPSHOT_BASE_URL: 'https://env-only.example.com',
    SEO_SNAPSHOT_TARGETS: '/',
  })

  assert.equal(result.absoluteConfigPath, null)
  assert.equal(result.configDir, tempDir)
  assert.equal(result.config.baseUrl, 'https://env-only.example.com')
  assert.deepEqual(result.config.targets, [ '/' ])
  assert.equal(result.configLabel, 'env')
})

test('readSeoConfig merges profile config on top of base config', async (context) => {
  const tempDir = await createTempDir()

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const configPath = path.join(tempDir, 'seo-snapshot.mjs')

  await writeFile(configPath, `export default {
  baseUrl: 'https://prod.example.com',
  targets: [ '/' ],
  profiles: {
    staging: {
      baseUrl: 'https://staging.example.com',
      compare: {
        baseUrl: 'https://prod.example.com',
      },
    },
  },
}
`, 'utf8')

  const result = await readSeoConfig('./seo-snapshot.mjs', tempDir, {
    SEO_SNAPSHOT_PROFILE: 'staging',
  })

  assert.equal(result.config.baseUrl, 'https://staging.example.com')
  assert.deepEqual(result.config.compare, { baseUrl: 'https://prod.example.com' })
  assert.deepEqual(result.config.targets, [ '/' ])
})

test('resolveTargets reads plain-text targets files and deduplicates merged targets', async (context) => {
  const tempDir = await createTempDir()

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  await writeFile(path.join(tempDir, 'targets.txt'), `# main
/
/news
https://example.com/news
`, 'utf8')

  const targets = await resolveTargets({
    baseUrl: 'https://example.com',
    targetsFile: './targets.txt',
    targets: [ '/news', '/movies' ],
  }, tempDir)

  assert.deepEqual(targets, [
    { input: '/', url: 'https://example.com/' },
    { input: '/news', url: 'https://example.com/news' },
    { input: '/movies', url: 'https://example.com/movies' },
  ])
})

test('resolveTargets reads sitemap XML dumps from targetsFile', async (context) => {
  const tempDir = await createTempDir()

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  await writeFile(path.join(tempDir, 'targets.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
  </url>
  <url>
    <loc>https://example.com/search?tab=movies&amp;page=2</loc>
  </url>
</urlset>
`, 'utf8')

  const targets = await resolveTargets({
    targetsFile: './targets.xml',
  }, tempDir)

  assert.deepEqual(targets, [
    { input: 'https://example.com/', url: 'https://example.com/' },
    { input: 'https://example.com/search?tab=movies&page=2', url: 'https://example.com/search?tab=movies&page=2' },
  ])
})

test('resolveTargets expands the same target path across compare domains', async () => {
  const tempDir = await createTempDir()

  try {
    const targets = await resolveTargets({
      baseUrl: 'https://www.example.com',
      compare: {
        baseUrl: {
          label: 'stage',
          url: 'https://stage.example.com',
        },
      },
      targets: [ '/news', 'https://legacy.example.com/catalog?page=2' ],
    }, tempDir)

    assert.deepEqual(targets, [
      {
        input: '/news',
        path: '/news',
        url: 'https://www.example.com/news',
        source: {
          label: 'www.example.com',
          url: 'https://www.example.com/',
        },
      },
      {
        input: '/news',
        path: '/news',
        url: 'https://stage.example.com/news',
        source: {
          label: 'stage',
          url: 'https://stage.example.com/',
        },
      },
      {
        input: 'https://legacy.example.com/catalog?page=2',
        path: '/catalog?page=2',
        url: 'https://www.example.com/catalog?page=2',
        source: {
          label: 'www.example.com',
          url: 'https://www.example.com/',
        },
      },
      {
        input: 'https://legacy.example.com/catalog?page=2',
        path: '/catalog?page=2',
        url: 'https://stage.example.com/catalog?page=2',
        source: {
          label: 'stage',
          url: 'https://stage.example.com/',
        },
      },
    ])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('resolveTargets uses baseUrl as the primary compare domain when one compare URL is configured', async () => {
  const tempDir = await createTempDir()

  try {
    const targets = await resolveTargets({
      baseUrl: 'https://www.example.com',
      compare: {
        baseUrl: 'https://stage.example.com',
      },
      targets: [ '/news' ],
    }, tempDir)

    assert.deepEqual(targets, [
      {
        input: '/news',
        path: '/news',
        url: 'https://www.example.com/news',
        source: {
          label: 'www.example.com',
          url: 'https://www.example.com/',
        },
      },
      {
        input: '/news',
        path: '/news',
        url: 'https://stage.example.com/news',
        source: {
          label: 'stage.example.com',
          url: 'https://stage.example.com/',
        },
      },
    ])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
