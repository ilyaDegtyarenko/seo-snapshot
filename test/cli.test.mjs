import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../src/cli.mjs'

test('parseArgs preserves a single user-agent string that contains an equals sign', () => {
  const userAgent = 'MyBot/1.0 (+https://example.com/?src=cli)'
  const options = parseArgs([ '--user-agent', userAgent ])

  assert.equal(options.userAgent, userAgent)
})

test('parseArgs enables labeled variants when --user-agent is repeated', () => {
  const options = parseArgs([
    '--user-agent', 'Desktop=Mozilla/5.0 (Macintosh)',
    '--user-agent', 'Mobile=Mozilla/5.0 (iPhone)',
  ])

  assert.deepEqual(options.userAgent, [
    {
      label: 'Desktop',
      userAgent: 'Mozilla/5.0 (Macintosh)',
    },
    {
      label: 'Mobile',
      userAgent: 'Mozilla/5.0 (iPhone)',
    },
  ])
})

test('parseArgs recognizes --diff-only flag', () => {
  const options = parseArgs([ '--diff-only' ])

  assert.equal(options.diffOnly, true)
})
