import { resolveMaybeUrl, normalizeWhitespace } from './utils.mjs'

const ENTITY_MAP = {
  amp: '&',
  apos: '\'',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

const decodeHtmlEntities = (value) => {
  return String(value || '').replaceAll(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    }

    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    }

    return ENTITY_MAP[entity.toLowerCase()] ?? match
  })
}

const stripTags = (value) => {
  return normalizeWhitespace(
    decodeHtmlEntities(String(value || '').replaceAll(/<[^>]+>/g, ' ')),
  )
}

const parseAttributes = (tag) => {
  const attributes = {}

  for (const match of tag.matchAll(/([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const [, key, doubleQuoted, singleQuoted, unquoted ] = match

    if (!key) {
      continue
    }

    attributes[key.toLowerCase()] = decodeHtmlEntities(doubleQuoted ?? singleQuoted ?? unquoted ?? '')
  }

  return attributes
}

const findTagAttributes = (html, tagName) => {
  const matches = html.match(new RegExp(`<${ tagName }\\b[^>]*>`, 'gi')) ?? []

  return matches.map(parseAttributes)
}

const findTagContents = (html, tagName) => {
  return [ ...html.matchAll(new RegExp(`<${ tagName }\\b[^>]*>([\\s\\S]*?)</${ tagName }>`, 'gi')) ]
}

const getMetaContent = (html, matcher) => {
  for (const attributes of findTagAttributes(html, 'meta')) {
    if (matcher(attributes)) {
      return normalizeWhitespace(attributes.content)
    }
  }

  return null
}

const getMetaContentByName = (html, expectedName) => {
  const normalizedName = expectedName.toLowerCase()

  return getMetaContent(html, attributes => attributes.name?.trim().toLowerCase() === normalizedName)
}

const getMetaContentByProperty = (html, expectedProperty) => {
  const normalizedProperty = expectedProperty.toLowerCase()

  return getMetaContent(html, attributes => attributes.property?.trim().toLowerCase() === normalizedProperty)
}

const tokenizeRel = (value) => {
  return String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

const appendJsonLdTypes = (value, collector) => {
  if (!value) {
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendJsonLdTypes(item, collector)
    }

    return
  }

  if (typeof value !== 'object') {
    return
  }

  const schemaType = value['@type']

  if (Array.isArray(schemaType)) {
    for (const item of schemaType) {
      if (item) {
        collector.add(String(item))
      }
    }
  } else if (schemaType) {
    collector.add(String(schemaType))
  }

  if (value['@graph']) {
    appendJsonLdTypes(value['@graph'], collector)
  }
}

const getBodyTextLength = (html) => {
  const stripped = html
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replaceAll(/<!--[\s\S]*?-->/g, ' ')

  return stripTags(stripped).length
}

export const extractSeoInfoFromHtml = (html, pageUrl) => {
  const htmlTagAttributes = findTagAttributes(html, 'html')[0] ?? {}
  const titleMatch = findTagContents(html, 'title')[0]
  const title = titleMatch ? stripTags(titleMatch[1]) : null
  const h1 = findTagContents(html, 'h1')
    .map(match => stripTags(match[1]))
    .filter(Boolean)
  const linkTags = findTagAttributes(html, 'link')
  const canonicalTag = linkTags.find(attributes => tokenizeRel(attributes.rel).includes('canonical'))
  const alternateLinks = linkTags
    .filter(attributes => tokenizeRel(attributes.rel).includes('alternate') && attributes.hreflang)
    .map(attributes => ({
      hreflang: normalizeWhitespace(attributes.hreflang),
      href: resolveMaybeUrl(attributes.href, pageUrl),
    }))
  const paginationLinks = {
    prev: linkTags.find(attributes => tokenizeRel(attributes.rel).includes('prev'))?.href ?? null,
    next: linkTags.find(attributes => tokenizeRel(attributes.rel).includes('next'))?.href ?? null,
  }
  const jsonLdTypes = new Set()
  let jsonLdParseErrors = 0
  let jsonLdScriptCount = 0

  for (const match of findTagContents(html, 'script')) {
    const scriptTag = match[0]
    const content = String(match[1] || '').trim()
    const attributes = parseAttributes(scriptTag.slice(0, scriptTag.indexOf('>') + 1))

    if (String(attributes.type || '').toLowerCase() !== 'application/ld+json' || !content) {
      continue
    }

    jsonLdScriptCount += 1

    try {
      appendJsonLdTypes(JSON.parse(content), jsonLdTypes)
    } catch {
      jsonLdParseErrors += 1
    }
  }

  return {
    document: {
      lang: normalizeWhitespace(htmlTagAttributes.lang) || null,
      title,
      h1,
      bodyTextLength: getBodyTextLength(html),
    },
    meta: {
      description: getMetaContentByName(html, 'description'),
      robots: getMetaContentByName(html, 'robots'),
      openGraph: {
        title: getMetaContentByProperty(html, 'og:title'),
        description: getMetaContentByProperty(html, 'og:description'),
        url: resolveMaybeUrl(getMetaContentByProperty(html, 'og:url'), pageUrl),
        image: resolveMaybeUrl(getMetaContentByProperty(html, 'og:image'), pageUrl),
        type: getMetaContentByProperty(html, 'og:type'),
        siteName: getMetaContentByProperty(html, 'og:site_name'),
      },
      twitter: {
        card: getMetaContentByName(html, 'twitter:card'),
        title: getMetaContentByName(html, 'twitter:title'),
        description: getMetaContentByName(html, 'twitter:description'),
        image: resolveMaybeUrl(getMetaContentByName(html, 'twitter:image'), pageUrl),
      },
    },
    links: {
      canonical: canonicalTag ? resolveMaybeUrl(canonicalTag.href, pageUrl) : null,
      alternates: alternateLinks,
      prev: resolveMaybeUrl(paginationLinks.prev, pageUrl),
      next: resolveMaybeUrl(paginationLinks.next, pageUrl),
    },
    jsonLd: {
      scriptCount: jsonLdScriptCount,
      parseErrors: jsonLdParseErrors,
      types: [ ...jsonLdTypes ].sort(),
    },
  }
}
