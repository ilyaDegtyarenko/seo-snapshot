import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import {
  DEFAULT_AUDIT_RULES,
  DEFAULT_CONCURRENCY,
  DEFAULT_FORMATS,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_REPORTS_DIR,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  SUPPORTED_FORMATS,
} from './constants.mjs'
import {
  exitWithError,
  isNonEmptyString,
  normalizePathLikeValue,
  toAbsoluteUrl,
} from './utils.mjs'

export const readSeoConfig = async (configPath, cwd) => {
  const absoluteConfigPath = normalizePathLikeValue(configPath, cwd)

  if (!absoluteConfigPath) {
    exitWithError('Config path is not defined.')
  }

  try {
    const configModule = await import(pathToFileURL(absoluteConfigPath).href)
    const config = configModule.default

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      exitWithError(`Expected default export object in ${ absoluteConfigPath }.`)
    }

    return {
      absoluteConfigPath,
      config,
    }
  } catch (error) {
    exitWithError(`Failed to load config ${ absoluteConfigPath }: ${ error instanceof Error ? error.message : String(error) }`)
  }
}

const readTargetsFromFile = async (filePath) => {
  const raw = await readFile(filePath, 'utf8')

  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => Boolean(line) && !line.startsWith('#'))
}

export const resolveTargets = async (config, configDir) => {
  const targetsFile = normalizePathLikeValue(config.targetsFile, configDir)
  const fileTargets = targetsFile
    ? await readTargetsFromFile(targetsFile)
    : []
  const inlineTargets = Array.isArray(config.targets)
    ? config.targets.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const mergedTargets = [
    ...fileTargets,
    ...inlineTargets,
  ]

  if (mergedTargets.length === 0) {
    exitWithError('No targets configured. Add URLs to config/targets.txt or config.targets.')
  }

  const normalizedTargets = []
  const seenTargets = new Set()
  const baseUrl = isNonEmptyString(config.baseUrl)
    ? config.baseUrl.trim()
    : null

  for (const target of mergedTargets) {
    const absoluteUrl = toAbsoluteUrl(target, baseUrl)

    if (seenTargets.has(absoluteUrl)) {
      continue
    }

    seenTargets.add(absoluteUrl)
    normalizedTargets.push({
      input: target,
      url: absoluteUrl,
    })
  }

  return normalizedTargets
}

const normalizeFormats = (formats) => {
  if (!Array.isArray(formats) || formats.length === 0) {
    return DEFAULT_FORMATS
  }

  const normalized = formats
    .flatMap(item => String(item || '').split(','))
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)

  if (normalized.includes('both')) {
    return DEFAULT_FORMATS
  }

  const uniqueFormats = [ ...new Set(normalized) ]
  const invalidFormat = uniqueFormats.find(format => !SUPPORTED_FORMATS.includes(format))

  if (invalidFormat) {
    exitWithError(`Unsupported report format "${ invalidFormat }". Supported formats: ${ SUPPORTED_FORMATS.join(', ') }.`)
  }

  if (uniqueFormats.length === 0) {
    return DEFAULT_FORMATS
  }

  return uniqueFormats
}

export const buildRuntimeOptions = ({ config, configDir, cliOptions }) => {
  const request = config.request ?? {}
  const output = config.output ?? {}
  const audit = config.audit ?? {}

  const timeoutMs = cliOptions.timeoutMs ?? request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRedirects = cliOptions.maxRedirects ?? request.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  const concurrency = cliOptions.concurrency ?? request.concurrency ?? DEFAULT_CONCURRENCY
  const userAgent = cliOptions.userAgent ?? request.userAgent ?? DEFAULT_USER_AGENT
  const outputDir = normalizePathLikeValue(cliOptions.outputDir ?? output.dir ?? DEFAULT_REPORTS_DIR, configDir)
  const formats = normalizeFormats(cliOptions.formats ?? output.formats ?? DEFAULT_FORMATS)

  return {
    request: {
      timeoutMs,
      maxRedirects,
      concurrency,
      userAgent,
    },
    output: {
      dir: outputDir,
      formats,
    },
    audit: {
      ...DEFAULT_AUDIT_RULES,
      ...(audit && typeof audit === 'object' ? audit : {}),
    },
  }
}
