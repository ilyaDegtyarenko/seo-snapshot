import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_FORMATS,
  SUPPORTED_FORMATS,
  buildHelpText,
} from './constants.mjs'
import { exitWithError, parsePositiveInt, readOptionValue } from './utils.mjs'

const parseFormats = (value) => {
  const normalized = String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)

  if (normalized.includes('both')) {
    return DEFAULT_FORMATS
  }

  if (normalized.length === 0) {
    exitWithError('Missing value for --format.')
  }

  const invalidFormat = normalized.find(format => !SUPPORTED_FORMATS.includes(format))

  if (invalidFormat) {
    exitWithError(`Unsupported report format "${ invalidFormat }". Supported formats: ${ SUPPORTED_FORMATS.join(', ') }.`)
  }

  return [ ...new Set(normalized) ]
}

const parseUserAgentArgs = (values) => {
  if (values.length === 0) {
    return undefined
  }

  if (values.length === 1) {
    return values[0]
  }

  return values.map((v, i) => {
    const eqIndex = v.indexOf('=')

    if (eqIndex > 0) {
      return { label: v.slice(0, eqIndex).trim(), userAgent: v.slice(eqIndex + 1).trim() }
    }

    return { label: `Variant ${ i + 1 }`, userAgent: v }
  })
}

export const parseArgs = (argv) => {
  const options = {
    help: false,
    configPath: undefined,
    outputDir: undefined,
    timeoutMs: undefined,
    maxRedirects: undefined,
    concurrency: undefined,
    userAgent: undefined,
    formats: undefined,
  }
  const userAgentValues = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    switch (arg) {
      case '--':
        break
      case '--help':
        options.help = true
        break
      case '--config':
        options.configPath = readOptionValue(argv, index, arg)
        index += 1
        break
      case '--output-dir':
        options.outputDir = readOptionValue(argv, index, arg)
        index += 1
        break
      case '--format':
        options.formats = parseFormats(readOptionValue(argv, index, arg))
        index += 1
        break
      case '--timeout-ms':
        options.timeoutMs = parsePositiveInt(readOptionValue(argv, index, arg), arg)
        index += 1
        break
      case '--max-redirects':
        options.maxRedirects = parsePositiveInt(readOptionValue(argv, index, arg), arg)
        index += 1
        break
      case '--concurrency':
        options.concurrency = parsePositiveInt(readOptionValue(argv, index, arg), arg)
        index += 1
        break
      case '--user-agent':
        userAgentValues.push(readOptionValue(argv, index, arg))
        index += 1
        break
      default:
        if (arg.startsWith('--')) {
          exitWithError(`Unknown flag "${ arg }".\n\n${ buildHelpText() }`)
        }

        exitWithError(`Unexpected positional argument "${ arg }". Configure targets in ${ options.configPath ?? process.env.SEO_SNAPSHOT_CONFIG_PATH ?? DEFAULT_CONFIG_PATH }.`)
    }
  }

  options.userAgent = parseUserAgentArgs(userAgentValues)

  return options
}

export const runCli = async (argv = process.argv.slice(2)) => {
  const options = parseArgs(argv)

  if (options.help) {
    console.log(buildHelpText())
    return
  }

  const { runAudit } = await import('./run-audit.mjs')
  const result = await runAudit(options, {
    cwd: process.cwd(),
  })
  const primaryOutputPath = result.htmlOutputPath ?? result.outputPaths[0] ?? null

  process.stdout.write(`SEO snapshot completed: ${ result.summary.total } pages checked, ${ result.summary.pagesWithIssues } with issues, ${ result.summary.failedPages } failed.\n`)

  if (result.report.comparison) {
    process.stdout.write(`Compared paths: ${ result.report.comparison.targetCount }, differences on ${ result.report.comparison.targetsWithDifferences }.\n`)
  }

  if (primaryOutputPath) {
    const primaryLabel = result.htmlOutputPath ? 'Open report' : 'Open output'
    process.stdout.write(`${ primaryLabel }: ${ pathToFileURL(primaryOutputPath).href }\n`)
  }

  if (result.hasFailures) {
    process.exitCode = 1
  }
}
