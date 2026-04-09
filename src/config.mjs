import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  DEFAULT_AUDIT_RULES,
  DEFAULT_CONCURRENCY,
  DEFAULT_CONFIG_PATH,
  DEFAULT_FORMATS,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_REPORTS_DIR,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  ENV_CONFIG_JSON_VAR,
  ENV_CONFIG_PATH_VAR,
  SUPPORTED_FORMATS,
} from './constants.mjs'
import {
  decodeXmlEntities,
  exitWithError,
  isNonEmptyString,
  normalizePathLikeValue,
  toAbsoluteUrl,
} from './utils.mjs'

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const SITEMAP_URL_ENTRY_PATTERN = /<(?:[\w-]+:)?url\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?url>/gi
const SITEMAP_LOC_PATTERN = /<(?:[\w-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?loc>/i

const fileExists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const parseJsonObjectEnv = (value, envName) => {
  try {
    const parsed = JSON.parse(String(value))

    if (!isPlainObject(parsed)) {
      exitWithError(`Expected ${ envName } to contain a JSON object.`)
    }

    return parsed
  } catch (error) {
    exitWithError(`Failed to parse ${ envName }: ${ error instanceof Error ? error.message : String(error) }`)
  }
}

const parseJsonArrayEnv = (value, envName) => {
  try {
    const parsed = JSON.parse(String(value))

    if (!Array.isArray(parsed)) {
      exitWithError(`Expected ${ envName } to contain a JSON array.`)
    }

    return parsed.map(item => String(item || '').trim()).filter(Boolean)
  } catch (error) {
    exitWithError(`Failed to parse ${ envName }: ${ error instanceof Error ? error.message : String(error) }`)
  }
}

const parseEnvString = (value) => String(value ?? '').trim()

const parseEnvPositiveInt = (value, envName) => {
  const parsed = Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    exitWithError(`Expected ${ envName } to be a positive integer, received "${ value }".`)
  }

  return parsed
}

const parseEnvList = (value, envName) => {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return []
  }

  if (normalizedValue.startsWith('[')) {
    return parseJsonArrayEnv(normalizedValue, envName)
  }

  return normalizedValue
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
}

const assignNestedValue = (target, pathParts, value) => {
  let cursor = target

  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index]

    if (!isPlainObject(cursor[key])) {
      cursor[key] = {}
    }

    cursor = cursor[key]
  }

  cursor[pathParts[pathParts.length - 1]] = value
}

const mergeSeoConfig = (baseConfig, overrideConfig) => {
  const mergedConfig = isPlainObject(baseConfig)
    ? { ...baseConfig }
    : {}

  if (!isPlainObject(overrideConfig)) {
    return mergedConfig
  }

  for (const [ key, value ] of Object.entries(overrideConfig)) {
    if (isPlainObject(mergedConfig[key]) && isPlainObject(value)) {
      mergedConfig[key] = {
        ...mergedConfig[key],
        ...value,
      }
      continue
    }

    mergedConfig[key] = value
  }

  return mergedConfig
}

const readEnvJsonConfig = (env) => {
  if (!isNonEmptyString(env[ENV_CONFIG_JSON_VAR])) {
    return null
  }

  return parseJsonObjectEnv(env[ENV_CONFIG_JSON_VAR], ENV_CONFIG_JSON_VAR)
}

const ENV_OVERRIDE_MAPPINGS = [
  [ 'SEO_SNAPSHOT_BASE_URL', [ 'baseUrl' ], parseEnvString ],
  [ 'SEO_SNAPSHOT_TARGETS_FILE', [ 'targetsFile' ], parseEnvString ],
  [ 'SEO_SNAPSHOT_TARGETS', [ 'targets' ], parseEnvList ],
  [ 'SEO_SNAPSHOT_OUTPUT_DIR', [ 'output', 'dir' ], parseEnvString ],
  [ 'SEO_SNAPSHOT_OUTPUT_FORMATS', [ 'output', 'formats' ], parseEnvList ],
  [ 'SEO_SNAPSHOT_REQUEST_TIMEOUT_MS', [ 'request', 'timeoutMs' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_REQUEST_MAX_REDIRECTS', [ 'request', 'maxRedirects' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_REQUEST_CONCURRENCY', [ 'request', 'concurrency' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_REQUEST_USER_AGENT', [ 'request', 'userAgent' ], parseEnvString ],
  [ 'SEO_SNAPSHOT_AUDIT_MIN_TITLE_LENGTH', [ 'audit', 'minTitleLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_MAX_TITLE_LENGTH', [ 'audit', 'maxTitleLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_MIN_DESCRIPTION_LENGTH', [ 'audit', 'minDescriptionLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_MAX_DESCRIPTION_LENGTH', [ 'audit', 'maxDescriptionLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_MIN_BODY_TEXT_LENGTH', [ 'audit', 'minBodyTextLength' ], parseEnvPositiveInt ],
]

const readEnvOverrideConfig = (env) => {
  const overrideConfig = {}
  let hasOverrides = false

  for (const [ envName, pathParts, parser ] of ENV_OVERRIDE_MAPPINGS) {
    if (env[envName] === undefined) {
      continue
    }

    assignNestedValue(overrideConfig, pathParts, parser(env[envName], envName))
    hasOverrides = true
  }

  return hasOverrides ? overrideConfig : null
}

const loadConfigFromFile = async (absoluteConfigPath) => {
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

const readTargetsFromText = (raw) => {
  return String(raw)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => Boolean(line) && !line.startsWith('#'))
}

const unwrapXmlValue = (value) => {
  return String(value ?? '')
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/u, '$1')
    .trim()
}

const readTargetsFromSitemapXml = (raw, filePath) => {
  const targets = []

  for (const match of String(raw).matchAll(SITEMAP_URL_ENTRY_PATTERN)) {
    const urlEntry = match[1]
    const locMatch = urlEntry.match(SITEMAP_LOC_PATTERN)

    if (!locMatch) {
      continue
    }

    const target = decodeXmlEntities(unwrapXmlValue(locMatch[1]))

    if (target) {
      targets.push(target)
    }
  }

  if (targets.length === 0) {
    exitWithError(`No sitemap URLs found in ${ filePath }. Expected <url><loc>...</loc></url> entries.`)
  }

  return targets
}

export const readSeoConfig = async (configPath, cwd, env = process.env) => {
  const envConfigPath = isNonEmptyString(env[ENV_CONFIG_PATH_VAR])
    ? env[ENV_CONFIG_PATH_VAR].trim()
    : null
  const requestedConfigPath = isNonEmptyString(configPath)
    ? configPath.trim()
    : envConfigPath
  const envJsonConfig = readEnvJsonConfig(env)
  const envOverrideConfig = readEnvOverrideConfig(env)
  let absoluteConfigPath = null
  let configDir = cwd
  let config = {}

  if (requestedConfigPath) {
    absoluteConfigPath = normalizePathLikeValue(requestedConfigPath, cwd)
    const fileConfig = await loadConfigFromFile(absoluteConfigPath)

    config = fileConfig.config
    configDir = path.dirname(absoluteConfigPath)

    if (envJsonConfig) {
      config = mergeSeoConfig(config, envJsonConfig)
    }
  } else if (envJsonConfig) {
    config = envJsonConfig
  } else {
    const defaultConfigPath = normalizePathLikeValue(DEFAULT_CONFIG_PATH, cwd)

    if (await fileExists(defaultConfigPath)) {
      absoluteConfigPath = defaultConfigPath
      configDir = path.dirname(defaultConfigPath)
      config = (await loadConfigFromFile(defaultConfigPath)).config
    } else if (!envOverrideConfig) {
      exitWithError(`Config is not defined. Provide ${ DEFAULT_CONFIG_PATH }, --config, ${ ENV_CONFIG_PATH_VAR }, or ${ ENV_CONFIG_JSON_VAR }.`)
    }
  }

  if (envOverrideConfig) {
    config = mergeSeoConfig(config, envOverrideConfig)
  }

  return {
    absoluteConfigPath,
    configDir,
    configLabel: absoluteConfigPath
      ? (envJsonConfig || envOverrideConfig ? `${ absoluteConfigPath } + env` : absoluteConfigPath)
      : (envJsonConfig ? ENV_CONFIG_JSON_VAR : 'env'),
    config,
  }
}

const readTargetsFromFile = async (filePath) => {
  const raw = await readFile(filePath, 'utf8')
  const normalizedRaw = String(raw).trimStart()

  if (normalizedRaw.startsWith('<')) {
    return readTargetsFromSitemapXml(raw, filePath)
  }

  return readTargetsFromText(raw)
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
    exitWithError('No targets configured. Add URLs to config/targets.txt, provide a sitemap XML dump, or set config.targets.')
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
