import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readSeoConfig } from '../src/config.mjs'

const createTempDir = async () => {
  return mkdtemp(path.join(os.tmpdir(), 'seo-snapshot-config-'))
}

test('readSeoConfig merges file config with env overrides', async (context) => {
  const tempDir = await createTempDir()

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const configPath = path.join(tempDir, 'seo-snapshot.config.mjs')

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

  const result = await readSeoConfig('./seo-snapshot.config.mjs', tempDir, {
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
