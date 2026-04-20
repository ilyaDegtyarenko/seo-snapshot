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

const parseEnvBoolean = (value, envName) => {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false

  exitWithError(`Expected ${ envName } to be true or false, received "${ value }".`)
}

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

const parseEnvCookies = (value, envName) => {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return null
  }

  if (!normalizedValue.startsWith('{')) {
    return normalizedValue
  }

  const parsed = parseJsonObjectEnv(normalizedValue, envName)

  return Object.entries(parsed)
    .map(([ k, v ]) => `${ k }=${ v }`)
    .join('; ') || null
}

const parseEnvUserAgent = (value, envName) => {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return null
  }

  if (!normalizedValue.startsWith('[')) {
    return normalizedValue
  }

  try {
    const parsed = JSON.parse(normalizedValue)

    if (!Array.isArray(parsed)) {
      exitWithError(`Expected ${ envName } to contain a UA string or JSON array of variant objects.`)
    }

    return parsed
  } catch (error) {
    exitWithError(`Failed to parse ${ envName }: ${ error instanceof Error ? error.message : String(error) }`)
  }
}

const parseEnvUrlValue = (value, envName) => {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return null
  }

  if (!normalizedValue.startsWith('{')) {
    return normalizedValue
  }

  try {
    const parsed = JSON.parse(normalizedValue)

    if (isPlainObject(parsed) && isNonEmptyString(parsed.url)) {
      return {
        url: parsed.url.trim(),
        ...(isNonEmptyString(parsed.label) ? { label: parsed.label.trim() } : {}),
      }
    }

    exitWithError(`Expected ${ envName } to contain a URL string or { url, label? } JSON object.`)
  } catch (error) {
    exitWithError(`Failed to parse ${ envName }: ${ error instanceof Error ? error.message : String(error) }`)
  }
}

const normalizeCompareSource = (value, index) => {
  if (isNonEmptyString(value)) {
    const url = toAbsoluteUrl(value.trim())
    const label = new URL(url).host || `domain-${ index + 1 }`

    return {
      label,
      url,
    }
  }

  if (isPlainObject(value) && isNonEmptyString(value.url)) {
    const url = toAbsoluteUrl(value.url.trim())
    const label = isNonEmptyString(value.label)
      ? value.label.trim()
      : (new URL(url).host || `domain-${ index + 1 }`)

    return {
      label,
      url,
    }
  }

  const compareKey = index === 1 ? 'compareUrl' : 'baseUrl'

  exitWithError(`Expected ${ compareKey } to be a string URL or { url, label? } object.`)
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
  [ 'SEO_SNAPSHOT_BASE_URL', [ 'baseUrl' ], parseEnvUrlValue ],
  [ 'SEO_SNAPSHOT_COMPARE_URL', [ 'compareUrl' ], parseEnvUrlValue ],
  [ 'SEO_SNAPSHOT_TARGETS_FILE', [ 'targetsFile' ], parseEnvString ],
  [ 'SEO_SNAPSHOT_TARGETS', [ 'targets' ], parseEnvList ],
  [ 'SEO_SNAPSHOT_OUTPUT_DIR', [ 'output', 'dir' ], parseEnvString ],
  [ 'SEO_SNAPSHOT_OUTPUT_FORMATS', [ 'output', 'formats' ], parseEnvList ],
  [ 'SEO_SNAPSHOT_OUTPUT_HIDE_TTFB', [ 'output', 'hideTtfb' ], parseEnvBoolean ],
  [ 'SEO_SNAPSHOT_REQUEST_TIMEOUT_MS', [ 'request', 'timeoutMs' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_REQUEST_MAX_REDIRECTS', [ 'request', 'maxRedirects' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_REQUEST_CONCURRENCY', [ 'request', 'concurrency' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_REQUEST_USER_AGENT', [ 'request', 'userAgent' ], parseEnvUserAgent ],
  [ 'SEO_SNAPSHOT_REQUEST_COOKIES', [ 'request', 'cookies' ], parseEnvCookies ],
  [ 'SEO_SNAPSHOT_REQUEST_HEADERS', [ 'request', 'headers' ], (value, envName) => parseJsonObjectEnv(value, envName) ],
  [ 'SEO_SNAPSHOT_AUDIT_MIN_TITLE_LENGTH', [ 'audit', 'minTitleLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_MAX_TITLE_LENGTH', [ 'audit', 'maxTitleLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_MIN_DESCRIPTION_LENGTH', [ 'audit', 'minDescriptionLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_MAX_DESCRIPTION_LENGTH', [ 'audit', 'maxDescriptionLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_MIN_BODY_TEXT_LENGTH', [ 'audit', 'minBodyTextLength' ], parseEnvPositiveInt ],
  [ 'SEO_SNAPSHOT_AUDIT_IGNORE', [ 'audit', 'ignore' ], parseEnvList ],
  [ 'SEO_SNAPSHOT_AUDIT_FLAG_EMPTY_ALT', [ 'audit', 'flagEmptyAlt' ], parseEnvBoolean ],
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
  const configSources = []

  if (requestedConfigPath) {
    absoluteConfigPath = normalizePathLikeValue(requestedConfigPath, cwd)
    const fileConfig = await loadConfigFromFile(absoluteConfigPath)

    config = fileConfig.config
    configDir = path.dirname(absoluteConfigPath)
    configSources.push(absoluteConfigPath)
  } else if (envJsonConfig) {
    config = envJsonConfig
  } else {
    const defaultConfigPath = normalizePathLikeValue(DEFAULT_CONFIG_PATH, cwd)

    if (await fileExists(defaultConfigPath)) {
      absoluteConfigPath = defaultConfigPath
      configDir = path.dirname(defaultConfigPath)
      config = (await loadConfigFromFile(defaultConfigPath)).config
      configSources.push(defaultConfigPath)
    } else if (!envOverrideConfig) {
      exitWithError(`Config is not defined. Provide ${ DEFAULT_CONFIG_PATH }, --config, ${ ENV_CONFIG_PATH_VAR }, or ${ ENV_CONFIG_JSON_VAR }.`)
    }
  }

  if (envJsonConfig) {
    config = mergeSeoConfig(config, envJsonConfig)
  }

  const profileName = parseEnvString(env.SEO_SNAPSHOT_PROFILE || '') || null

  if (profileName) {
    if (isPlainObject(config.profiles?.[profileName])) {
      config = mergeSeoConfig(config, config.profiles[profileName])
    } else {
      exitWithError(`Profile "${ profileName }" is not defined in config.profiles.`)
    }
  }

  if (envOverrideConfig) {
    config = mergeSeoConfig(config, envOverrideConfig)
  }

  if (envJsonConfig || envOverrideConfig) {
    configSources.push('env')
  }

  return {
    absoluteConfigPath,
    configDir,
    configLabel: configSources.length > 0
      ? configSources.join(' + ')
      : (envJsonConfig ? ENV_CONFIG_JSON_VAR : 'env'),
    config,
  }
}

const readTargetsFromJson = (raw, filePath) => {
  let parsed

  try {
    parsed = JSON.parse(raw)
  } catch {
    exitWithError(`Failed to parse JSON targets file: ${ filePath }`)
  }

  if (!Array.isArray(parsed)) {
    exitWithError(`JSON targets file must contain an array of URLs: ${ filePath }`)
  }

  return parsed.map(item => String(item || '').trim()).filter(Boolean)
}

const readTargetsFromFile = async (filePath) => {
  const raw = await readFile(filePath, 'utf8')
  const normalizedRaw = String(raw).trimStart()

  if (normalizedRaw.startsWith('<')) {
    return readTargetsFromSitemapXml(raw, filePath)
  }

  if (normalizedRaw.startsWith('[') || normalizedRaw.startsWith('{')) {
    return readTargetsFromJson(raw, filePath)
  }

  return readTargetsFromText(raw)
}

export const resolveComparisonSources = (config) => {
  const rawSource = config?.compareUrl

  if (rawSource === undefined) {
    return null
  }

  const rawBaseUrl = config?.baseUrl
  const hasBaseUrl = isNonEmptyString(rawBaseUrl) || (isPlainObject(rawBaseUrl) && isNonEmptyString(rawBaseUrl.url))

  if (!hasBaseUrl) {
    exitWithError('compareUrl requires baseUrl (or SEO_SNAPSHOT_BASE_URL) for the primary domain.')
  }

  const sources = [
    normalizeCompareSource(config.baseUrl, 0),
    normalizeCompareSource(rawSource, 1),
  ]
  const uniqueUrls = new Set(sources.map(source => source.url))

  if (uniqueUrls.size !== sources.length) {
    exitWithError('compareUrl must differ from baseUrl.')
  }

  return sources
}

const normalizeComparableTargetPath = (target) => {
  const normalizedTarget = String(target ?? '').trim()

  if (!normalizedTarget) {
    return null
  }

  try {
    const absoluteUrl = new URL(normalizedTarget)

    return `${ absoluteUrl.pathname }${ absoluteUrl.search }${ absoluteUrl.hash }` || '/'
  } catch {
    const relativeUrl = new URL(normalizedTarget, 'https://seo-snapshot.local')

    return `${ relativeUrl.pathname }${ relativeUrl.search }${ relativeUrl.hash }` || '/'
  }
}

const AUTO_DETECT_TARGETS_FILES = [ 'targets.json', 'targets.txt', 'targets.xml' ]

const autoDetectTargetsFile = async (configDir) => {
  for (const name of AUTO_DETECT_TARGETS_FILES) {
    const candidate = path.join(configDir, name)
    if (await fileExists(candidate)) {
      return candidate
    }
  }
  return null
}

export const resolveTargets = async (config, configDir) => {
  const inlineTargets = Array.isArray(config.targets)
    ? config.targets.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const targetsFile = normalizePathLikeValue(config.targetsFile, configDir)
    ?? (inlineTargets.length === 0 ? await autoDetectTargetsFile(configDir) : null)
  const fileTargets = targetsFile
    ? await readTargetsFromFile(targetsFile)
    : []
  const mergedTargets = [
    ...fileTargets,
    ...inlineTargets,
  ]

  if (mergedTargets.length === 0) {
    exitWithError('No targets configured. Add URLs to config/targets.json, config/targets.txt, or config/targets.xml, or set config.targets.')
  }

  const normalizedTargets = []
  const seenTargets = new Set()
  const compareSources = resolveComparisonSources(config)

  if (compareSources) {
    for (const target of mergedTargets) {
      const comparisonPath = normalizeComparableTargetPath(target)

      if (!comparisonPath) {
        continue
      }

      for (const source of compareSources) {
        const absoluteUrl = toAbsoluteUrl(comparisonPath, source.url)
        const targetKey = `${ source.url }::${ absoluteUrl }`

        if (seenTargets.has(targetKey)) {
          continue
        }

        seenTargets.add(targetKey)
        normalizedTargets.push({
          input: target,
          path: comparisonPath,
          url: absoluteUrl,
          source,
        })
      }
    }

    return normalizedTargets
  }

  const baseUrl = isNonEmptyString(config.baseUrl)
    ? config.baseUrl.trim()
    : (isPlainObject(config.baseUrl) && isNonEmptyString(config.baseUrl.url))
      ? config.baseUrl.url.trim()
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

export const normalizeVariants = (userAgentValue) => {
  if (!Array.isArray(userAgentValue) || userAgentValue.length === 0) {
    return null
  }

  return userAgentValue.map((item, index) => {
    if (!isPlainObject(item) || !isNonEmptyString(item.userAgent)) {
      exitWithError(`request.userAgent[${ index }] must be an object with a userAgent string property.`)
    }

    return {
      id: `variant-${ index + 1 }`,
      label: isNonEmptyString(item.label) ? item.label.trim() : `Variant ${ index + 1 }`,
      userAgent: item.userAgent.trim(),
    }
  })
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

const normalizeCookies = (value) => {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value.trim() || null
  }

  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([ k, v ]) => `${ k }=${ v }`)
      .join('; ') || null
  }

  return null
}

export const buildRuntimeOptions = ({ config, configDir, cliOptions, cwd = process.cwd() }) => {
  const request = config.request ?? {}
  const output = config.output ?? {}
  const audit = config.audit ?? {}
  const compareSources = resolveComparisonSources(config)

  const timeoutMs = cliOptions.timeoutMs ?? request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRedirects = cliOptions.maxRedirects ?? request.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  const concurrency = cliOptions.concurrency ?? request.concurrency ?? DEFAULT_CONCURRENCY
  const userAgentRaw = cliOptions.userAgent ?? request.userAgent ?? DEFAULT_USER_AGENT
  const variants = normalizeVariants(userAgentRaw)
  const userAgent = variants !== null
    ? variants[0].userAgent
    : (isNonEmptyString(userAgentRaw) ? userAgentRaw : DEFAULT_USER_AGENT)
  const cookies = normalizeCookies(request.cookies ?? null)
  const headers = isPlainObject(request.headers) ? { ...request.headers } : null
  const hasCliOutputDir = cliOptions.outputDir !== undefined
  const hasConfigOutputDir = output.dir !== undefined
  const outputDir = normalizePathLikeValue(
    hasCliOutputDir
      ? cliOptions.outputDir
      : (hasConfigOutputDir ? output.dir : DEFAULT_REPORTS_DIR),
    hasCliOutputDir || !hasConfigOutputDir
      ? cwd
      : configDir,
  )
  const formats = normalizeFormats(cliOptions.formats ?? output.formats ?? DEFAULT_FORMATS)

  return {
    request: {
      timeoutMs,
      maxRedirects,
      concurrency,
      userAgent,
      ...(cookies !== null ? { cookies } : {}),
      ...(headers !== null ? { headers } : {}),
    },
    output: {
      dir: outputDir,
      formats,
      hideTtfb: Boolean(output.hideTtfb),
    },
    variants,
    compare: compareSources
      ? {
        sources: compareSources,
      }
      : null,
    audit: {
      ...DEFAULT_AUDIT_RULES,
      ...(audit && typeof audit === 'object' ? audit : {}),
    },
  }
}
