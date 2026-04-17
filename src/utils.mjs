import path from 'node:path'

export const exitWithError = (message) => {
  console.error(message)
  process.exit(1)
}

export const parsePositiveInt = (value, flagName) => {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    exitWithError(`Expected a positive integer for ${ flagName }, received "${ value }".`)
  }

  return parsed
}

export const readOptionValue = (argv, index, flagName) => {
  const value = argv[index + 1]

  if (!value || value.startsWith('--')) {
    exitWithError(`Missing value for ${ flagName }.`)
  }

  return value
}

export const normalizePathLikeValue = (value, cwd) => {
  if (!value) {
    return null
  }

  return path.isAbsolute(value) ? value : path.resolve(cwd, value)
}

export const formatTimestamp = (date) => {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')

  return `${ year }${ month }${ day }-${ hours }${ minutes }${ seconds }-${ milliseconds }`
}

export const escapeHtml = (value) => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

export const decodeXmlEntities = (value) => {
  return String(value ?? '').replaceAll(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const normalizedEntity = String(entity).toLowerCase()

    if (normalizedEntity === 'amp') {
      return '&'
    }

    if (normalizedEntity === 'lt') {
      return '<'
    }

    if (normalizedEntity === 'gt') {
      return '>'
    }

    if (normalizedEntity === 'quot') {
      return '"'
    }

    if (normalizedEntity === 'apos') {
      return '\''
    }

    if (!normalizedEntity.startsWith('#')) {
      return match
    }

    const isHex = normalizedEntity[1] === 'x'
    const codePoint = Number.parseInt(
      normalizedEntity.slice(isHex ? 2 : 1),
      isHex ? 16 : 10,
    )

    if (!Number.isFinite(codePoint)) {
      return match
    }

    try {
      return String.fromCodePoint(codePoint)
    } catch {
      return match
    }
  })
}

export const resolveMaybeUrl = (value, baseUrl) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return null
  }

  try {
    return new URL(normalizedValue, baseUrl).toString()
  } catch {
    return normalizedValue
  }
}

export const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value).toString()
  } catch {
    if (!baseUrl) {
      throw new Error(`Relative path "${ value }" requires config.baseUrl.`)
    }

    return new URL(value, baseUrl).toString()
  }
}

export const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

export const normalizeWhitespace = (value) => {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

const splitLinkHeaderEntries = (value) => {
  const entries = []
  let currentEntry = ''
  let isInsideQuotes = false
  let isInsideAngleBrackets = false

  for (const character of String(value || '')) {
    if (character === '"' && !isInsideAngleBrackets) {
      isInsideQuotes = !isInsideQuotes
      currentEntry += character
      continue
    }

    if (character === '<' && !isInsideQuotes) {
      isInsideAngleBrackets = true
      currentEntry += character
      continue
    }

    if (character === '>' && !isInsideQuotes) {
      isInsideAngleBrackets = false
      currentEntry += character
      continue
    }

    if (character === ',' && !isInsideQuotes && !isInsideAngleBrackets) {
      const normalizedEntry = normalizeWhitespace(currentEntry)

      if (normalizedEntry) {
        entries.push(normalizedEntry)
      }

      currentEntry = ''
      continue
    }

    currentEntry += character
  }

  const trailingEntry = normalizeWhitespace(currentEntry)

  if (trailingEntry) {
    entries.push(trailingEntry)
  }

  return entries
}

const stripMatchingQuotes = (value) => {
  const normalizedValue = String(value || '').trim()

  if (
    normalizedValue.length >= 2
    && normalizedValue.startsWith('"')
    && normalizedValue.endsWith('"')
  ) {
    return normalizedValue.slice(1, -1)
  }

  return normalizedValue
}

export const tokenizeRel = (value) => {
  return normalizeWhitespace(String(value || '').toLowerCase())
    .split(' ')
    .filter(Boolean)
}

export const parseLinkHeader = (value, baseUrl) => {
  return splitLinkHeaderEntries(value)
    .map((entry) => {
      const linkMatch = /^<([^>]+)>(.*)$/.exec(entry)

      if (!linkMatch) {
        return null
      }

      const [, rawHref, rawParameters = '' ] = linkMatch
      const parameters = {}

      for (const parameterMatch of rawParameters.matchAll(/;\s*([^\s=;]+)(?:\s*=\s*(?:"([^"]*)"|([^";,]+)))?/g)) {
        const [, rawKey, quotedValue, unquotedValue ] = parameterMatch

        if (!rawKey) {
          continue
        }

        parameters[rawKey.toLowerCase()] = stripMatchingQuotes(quotedValue ?? unquotedValue ?? '')
      }

      const relTokens = tokenizeRel(parameters.rel)

      return {
        href: resolveMaybeUrl(rawHref, baseUrl),
        rel: relTokens.join(' '),
        relTokens,
        hreflang: normalizeWhitespace(parameters.hreflang) || null,
        title: normalizeWhitespace(parameters.title) || null,
        type: normalizeWhitespace(parameters.type) || null,
      }
    })
    .filter(Boolean)
}

export const getLength = (value) => normalizeWhitespace(value).length

export const getHighestSeverity = (issues) => {
  if (!Array.isArray(issues) || issues.length === 0) {
    return 'success'
  }

  if (issues.some(issue => issue.severity === 'error')) {
    return 'error'
  }

  if (issues.some(issue => issue.severity === 'warning')) {
    return 'warning'
  }

  return 'info'
}

export const getSourceHosts = (page) => {
  const sourceHosts = new Set()

  for (const candidate of [ page.source?.url, page.finalUrl, page.requestedUrl ]) {
    if (!candidate) {
      continue
    }

    try {
      sourceHosts.add(new URL(String(candidate)).host.toLowerCase())
    } catch {
      continue
    }
  }

  return sourceHosts
}

export const isSourceLocalUrl = (url, page) => {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(String(url))
    const sourceHosts = getSourceHosts(page)

    if (sourceHosts.size === 0) {
      return null
    }

    return sourceHosts.has(parsed.host.toLowerCase())
  } catch {
    return null
  }
}

export const sortByCountDesc = (entries, labelKey = 'code') => {
  return [ ...entries ].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }

    return String(left[labelKey] ?? '').localeCompare(String(right[labelKey] ?? ''))
  })
}
