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

export const sortByCountDesc = (entries) => {
  return [ ...entries ].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }

    return left.code.localeCompare(right.code)
  })
}
