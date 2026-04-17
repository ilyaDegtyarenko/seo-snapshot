import { createHash } from 'node:crypto'
import { resolveMaybeUrl, normalizeWhitespace } from './utils.mjs'

const ENTITY_MAP = {
  amp: '&',
  apos: '\'',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

const UNIQUE_HEAD_SIGNAL_SPECS = [
  { key: 'title', label: '<title>' },
  { key: 'description', label: 'meta[name="description"]' },
  { key: 'robots', label: 'meta[name="robots"]' },
  { key: 'canonical', label: 'link[rel~="canonical"]' },
  { key: 'viewport', label: 'meta[name="viewport"]' },
  { key: 'ogTitle', label: 'meta[property="og:title"]' },
  { key: 'ogDescription', label: 'meta[property="og:description"]' },
  { key: 'ogType', label: 'meta[property="og:type"]' },
  { key: 'ogUrl', label: 'meta[property="og:url"]' },
  { key: 'ogImage', label: 'meta[property="og:image"]' },
  { key: 'twitterCard', label: 'meta[name="twitter:card"]' },
  { key: 'twitterTitle', label: 'meta[name="twitter:title"]' },
  { key: 'twitterDescription', label: 'meta[name="twitter:description"]' },
  { key: 'twitterImage', label: 'meta[name="twitter:image"]' },
  { key: 'manifest', label: 'link[rel~="manifest"]' },
  { key: 'appleItunesApp', label: 'meta[name="apple-itunes-app"]' },
]

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

const getHeadHtml = (html) => {
  const headMatch = String(html || '').match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)

  return headMatch?.[1] ?? String(html || '')
}

const normalizeAttributeValue = (value) => {
  const normalizedValue = normalizeWhitespace(value)

  return normalizedValue || null
}

const getFirstValue = (values) => {
  if (!Array.isArray(values)) {
    return null
  }

  return values.find(value => value !== null) ?? null
}

const getMetaContents = (metaTags, matcher) => {
  return metaTags
    .filter(matcher)
    .map(attributes => normalizeAttributeValue(attributes.content))
    .filter(Boolean)
}

const getMetaContentsByName = (metaTags, expectedName) => {
  const normalizedName = expectedName.toLowerCase()

  return getMetaContents(metaTags, attributes => attributes.name?.trim().toLowerCase() === normalizedName)
}

const getMetaContentsByProperty = (metaTags, expectedProperty) => {
  const normalizedProperty = expectedProperty.toLowerCase()

  return getMetaContents(metaTags, attributes => attributes.property?.trim().toLowerCase() === normalizedProperty)
}

const getMetaContentsByHttpEquiv = (metaTags, expectedHttpEquiv) => {
  const normalizedHttpEquiv = expectedHttpEquiv.toLowerCase()

  return getMetaContents(metaTags, attributes => attributes['http-equiv']?.trim().toLowerCase() === normalizedHttpEquiv)
}

const tokenizeRel = (value) => {
  return String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

const getLinkTagsByRel = (linkTags, relValue) => {
  return linkTags.filter(attributes => tokenizeRel(attributes.rel).includes(relValue))
}

const buildResolvedLinkValue = (value, pageUrl) => {
  return resolveMaybeUrl(normalizeAttributeValue(value), pageUrl)
}

const buildAlternateLinks = (linkTags, pageUrl) => {
  return getLinkTagsByRel(linkTags, 'alternate')
    .filter(attributes => normalizeAttributeValue(attributes.hreflang))
    .map(attributes => ({
      hreflang: normalizeAttributeValue(attributes.hreflang),
      href: buildResolvedLinkValue(attributes.href, pageUrl),
    }))
}

const buildAlternateResources = (linkTags, pageUrl) => {
  return getLinkTagsByRel(linkTags, 'alternate')
    .filter(attributes => !normalizeAttributeValue(attributes.hreflang))
    .map(attributes => ({
      rel: normalizeAttributeValue(attributes.rel),
      type: normalizeAttributeValue(attributes.type),
      title: normalizeAttributeValue(attributes.title),
      href: buildResolvedLinkValue(attributes.href, pageUrl),
    }))
}

const buildIconLinks = (linkTags, pageUrl) => {
  return linkTags
    .filter(attributes => tokenizeRel(attributes.rel).includes('icon'))
    .map(attributes => ({
      rel: normalizeAttributeValue(attributes.rel),
      href: buildResolvedLinkValue(attributes.href, pageUrl),
      sizes: normalizeAttributeValue(attributes.sizes),
      type: normalizeAttributeValue(attributes.type),
    }))
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

const collectJsonLdStrings = (value, key, collector, { recursive = true } = {}) => {
  if (!value) {
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdStrings(item, key, collector, { recursive })
    }

    return
  }

  if (typeof value !== 'object') {
    return
  }

  const candidate = value[key]

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const normalizedItem = normalizeAttributeValue(item)

      if (normalizedItem) {
        collector.add(normalizedItem)
      }
    }
  } else {
    const normalizedCandidate = normalizeAttributeValue(candidate)

    if (normalizedCandidate) {
      collector.add(normalizedCandidate)
    }
  }

  if (!recursive) {
    return
  }

  for (const nestedValue of Object.values(value)) {
    collectJsonLdStrings(nestedValue, key, collector, { recursive })
  }
}

const sortJsonValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.keys(value)
    .sort((left, right) => left.localeCompare(right))
    .reduce((accumulator, key) => {
      accumulator[key] = sortJsonValue(value[key])
      return accumulator
    }, {})
}

const buildJsonLdBlock = (value, pageUrl) => {
  const types = new Set()
  const names = new Set()
  const ids = new Set()
  const urls = new Set()

  appendJsonLdTypes(value, types)
  collectJsonLdStrings(value, 'name', names)
  collectJsonLdStrings(value, '@id', ids)
  collectJsonLdStrings(value, 'url', urls)

  const normalizedValue = JSON.stringify(sortJsonValue(value))

  // Strip the page origin from JSON content before hashing so that structurally
  // identical schemas only differing by domain (local vs prod) hash identically.
  let hashableValue = normalizedValue

  try {
    const origin = pageUrl ? new URL(pageUrl).origin : null

    if (origin && origin !== 'null') {
      hashableValue = normalizedValue.replaceAll(origin, '{origin}')
    }
  } catch {
    // use normalizedValue as-is
  }

  const hash = createHash('sha1').update(hashableValue).digest('hex').slice(0, 12)
  const typeLabel = [ ...types ].sort().join(', ') || 'Unknown'
  const previewName = [ ...names ][0] ?? null
  const rawPreviewLocation = [ ...urls ][0] ?? [ ...ids ][0] ?? null

  // Normalize previewLocation to path-only when it belongs to the page origin,
  // so the summary is comparable across environments.
  let previewLocation = rawPreviewLocation

  if (rawPreviewLocation && pageUrl) {
    try {
      const parsedLocation = new URL(rawPreviewLocation)
      const parsedPage = new URL(pageUrl)

      if (parsedLocation.origin === parsedPage.origin) {
        previewLocation = `${ parsedLocation.pathname }${ parsedLocation.search }${ parsedLocation.hash }` || '/'
      }
    } catch {
      // use rawPreviewLocation as-is
    }
  }

  const summaryParts = [ typeLabel ]

  if (previewName) {
    summaryParts.push(previewName)
  }

  if (previewLocation) {
    summaryParts.push(previewLocation)
  }

  return {
    hash,
    normalizedLength: normalizedValue.length,
    preview: normalizedValue.length > 280
      ? `${ normalizedValue.slice(0, 280) }...`
      : normalizedValue,
    summary: summaryParts.join(' | '),
    types: [ ...types ].sort(),
  }
}

const normalizeJsonLdType = (value) => {
  const normalizedValue = normalizeAttributeValue(value)

  if (!normalizedValue) {
    return null
  }

  return normalizedValue
    .toLowerCase()
    .replace(/^https?:\/\/schema\.org\//, '')
}

const getBodyTextLength = (html) => {
  const bodyMatch = String(html || '').match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  const bodyHtml = bodyMatch?.[1] ?? ''

  const stripped = bodyHtml
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replaceAll(/<!--[\s\S]*?-->/g, ' ')

  return stripTags(stripped).length
}

const countImages = (html) => {
  const imgTags = findTagAttributes(String(html || ''), 'img')
  let imagesWithoutAlt = 0

  for (const attributes of imgTags) {
    const alt = normalizeAttributeValue(attributes.alt)

    if (alt === null) {
      imagesWithoutAlt += 1
    }
  }

  return {
    imageCount: imgTags.length,
    imagesWithoutAlt,
  }
}

const countInternalLinks = (html, pageUrl) => {
  const bodyMatch = String(html || '').match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  const bodyHtml = bodyMatch?.[1] ?? ''
  const aTags = findTagAttributes(bodyHtml, 'a')
  let pageHost = null
  let internalLinkCount = 0

  try {
    pageHost = new URL(pageUrl).host.toLowerCase()
  } catch {
    return 0
  }

  for (const attributes of aTags) {
    const href = normalizeAttributeValue(attributes.href)

    if (!href || href.startsWith('#') || (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href))) {
      continue
    }

    try {
      const resolved = new URL(href, pageUrl)

      if (resolved.host.toLowerCase() === pageHost) {
        internalLinkCount += 1
      }
    } catch {
      internalLinkCount += 1
    }
  }

  return internalLinkCount
}

const getHeadingHierarchy = (html) => {
  const bodyMatch = String(html || '').match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  const bodyHtml = bodyMatch?.[1] ?? String(html || '')
  const hierarchy = []

  for (const match of bodyHtml.matchAll(/<h([1-6])\b[^>]*>/gi)) {
    hierarchy.push(Number(match[1]))
  }

  return hierarchy
}

const buildHeadCounts = ({
  alternateLinks,
  alternateResources,
  iconLinks,
  jsonLdScriptCount,
  linkTags,
  metaTags,
  titleCount,
}) => {
  return {
    title: titleCount,
    description: getMetaContentsByName(metaTags, 'description').length,
    robots: getMetaContentsByName(metaTags, 'robots').length,
    canonical: getLinkTagsByRel(linkTags, 'canonical').length,
    viewport: getMetaContentsByName(metaTags, 'viewport').length,
    ogTitle: getMetaContentsByProperty(metaTags, 'og:title').length,
    ogDescription: getMetaContentsByProperty(metaTags, 'og:description').length,
    ogType: getMetaContentsByProperty(metaTags, 'og:type').length,
    ogUrl: getMetaContentsByProperty(metaTags, 'og:url').length,
    ogImage: getMetaContentsByProperty(metaTags, 'og:image').length,
    twitterCard: getMetaContentsByName(metaTags, 'twitter:card').length,
    twitterTitle: getMetaContentsByName(metaTags, 'twitter:title').length,
    twitterDescription: getMetaContentsByName(metaTags, 'twitter:description').length,
    twitterImage: getMetaContentsByName(metaTags, 'twitter:image').length,
    manifest: getLinkTagsByRel(linkTags, 'manifest').length,
    appleItunesApp: getMetaContentsByName(metaTags, 'apple-itunes-app').length,
    hreflang: alternateLinks.length,
    alternateResources: alternateResources.length,
    icons: iconLinks.length,
    jsonLd: jsonLdScriptCount,
  }
}

const buildHeadDuplicates = (counts) => {
  return UNIQUE_HEAD_SIGNAL_SPECS.flatMap((spec) => {
    const count = counts[spec.key] ?? 0

    if (count <= 1) {
      return []
    }

    return [{
      key: spec.key,
      label: spec.label,
      count,
    }]
  })
}

export const extractSeoInfoFromHtml = (html, pageUrl) => {
  const normalizedHtml = String(html || '')
  const headHtml = getHeadHtml(normalizedHtml)
  const htmlTagAttributes = findTagAttributes(normalizedHtml, 'html')[0] ?? {}
  const metaTags = findTagAttributes(headHtml, 'meta')
  const linkTags = findTagAttributes(headHtml, 'link')
  const titleMatches = findTagContents(headHtml, 'title')
  const title = titleMatches[0] ? stripTags(titleMatches[0][1]) : null
  const h1 = findTagContents(normalizedHtml, 'h1')
    .map(match => stripTags(match[1]))
    .filter(Boolean)
  const canonicalTag = getLinkTagsByRel(linkTags, 'canonical')[0] ?? null
  const alternateLinks = buildAlternateLinks(linkTags, pageUrl)
  const alternateResources = buildAlternateResources(linkTags, pageUrl)
  const iconLinks = buildIconLinks(linkTags, pageUrl)
  const paginationLinks = {
    prev: getLinkTagsByRel(linkTags, 'prev')[0]?.href ?? null,
    next: getLinkTagsByRel(linkTags, 'next')[0]?.href ?? null,
  }
  const ogLocaleAlternates = getMetaContentsByProperty(metaTags, 'og:locale:alternate')
  const jsonLdTypes = new Set()
  const jsonLdBlocks = []
  let jsonLdParseErrors = 0
  let jsonLdScriptCount = 0

  for (const match of findTagContents(normalizedHtml, 'script')) {
    const scriptTag = match[0]
    const content = String(match[1] || '').trim()
    const attributes = parseAttributes(scriptTag.slice(0, scriptTag.indexOf('>') + 1))

    if (String(attributes.type || '').toLowerCase() !== 'application/ld+json' || !content) {
      continue
    }

    jsonLdScriptCount += 1

    try {
      const parsedJson = JSON.parse(content)

      appendJsonLdTypes(parsedJson, jsonLdTypes)
      jsonLdBlocks.push(buildJsonLdBlock(parsedJson, pageUrl))
    } catch {
      jsonLdParseErrors += 1
    }
  }

  const headCounts = buildHeadCounts({
    alternateLinks,
    alternateResources,
    iconLinks,
    jsonLdScriptCount,
    linkTags,
    metaTags,
    titleCount: titleMatches.length,
  })
  const normalizedJsonLdTypes = [ ...jsonLdTypes ]
    .map(type => normalizeJsonLdType(type))
    .filter(Boolean)
  const jsonLdTypeSet = new Set(normalizedJsonLdTypes)
  const imageStats = countImages(normalizedHtml)
  const internalLinkCount = countInternalLinks(normalizedHtml, pageUrl)

  return {
    document: {
      lang: normalizeAttributeValue(htmlTagAttributes.lang),
      contentLanguage: getFirstValue(getMetaContentsByHttpEquiv(metaTags, 'content-language')),
      title,
      h1,
      bodyTextLength: getBodyTextLength(normalizedHtml),
      imageCount: imageStats.imageCount,
      imagesWithoutAlt: imageStats.imagesWithoutAlt,
      internalLinkCount,
      headingHierarchy: getHeadingHierarchy(normalizedHtml),
    },
    meta: {
      charset: normalizeAttributeValue(metaTags.find(attributes => attributes.charset)?.charset),
      description: getFirstValue(getMetaContentsByName(metaTags, 'description')),
      robots: getFirstValue(getMetaContentsByName(metaTags, 'robots')),
      viewport: getFirstValue(getMetaContentsByName(metaTags, 'viewport')),
      applicationName: getFirstValue(getMetaContentsByName(metaTags, 'application-name')),
      themeColor: getFirstValue(getMetaContentsByName(metaTags, 'theme-color')),
      appleItunesApp: getFirstValue(getMetaContentsByName(metaTags, 'apple-itunes-app')),
      openGraph: {
        title: getFirstValue(getMetaContentsByProperty(metaTags, 'og:title')),
        description: getFirstValue(getMetaContentsByProperty(metaTags, 'og:description')),
        url: buildResolvedLinkValue(getFirstValue(getMetaContentsByProperty(metaTags, 'og:url')), pageUrl),
        image: buildResolvedLinkValue(getFirstValue(getMetaContentsByProperty(metaTags, 'og:image')), pageUrl),
        imageAlt: getFirstValue(getMetaContentsByProperty(metaTags, 'og:image:alt')),
        type: getFirstValue(getMetaContentsByProperty(metaTags, 'og:type')),
        siteName: getFirstValue(getMetaContentsByProperty(metaTags, 'og:site_name')),
        locale: getFirstValue(getMetaContentsByProperty(metaTags, 'og:locale')),
        localeAlternates: ogLocaleAlternates,
        video: buildResolvedLinkValue(getFirstValue(getMetaContentsByProperty(metaTags, 'og:video')), pageUrl),
      },
      twitter: {
        card: getFirstValue(getMetaContentsByName(metaTags, 'twitter:card')),
        title: getFirstValue(getMetaContentsByName(metaTags, 'twitter:title')),
        description: getFirstValue(getMetaContentsByName(metaTags, 'twitter:description')),
        image: buildResolvedLinkValue(getFirstValue(getMetaContentsByName(metaTags, 'twitter:image')), pageUrl),
        imageAlt: getFirstValue(getMetaContentsByName(metaTags, 'twitter:image:alt')),
        url: buildResolvedLinkValue(getFirstValue(getMetaContentsByName(metaTags, 'twitter:url')), pageUrl),
      },
      appLinks: {
        iosUrl: getFirstValue(getMetaContentsByProperty(metaTags, 'al:ios:url')),
        iosAppStoreId: getFirstValue(getMetaContentsByProperty(metaTags, 'al:ios:app_store_id')),
        iosAppName: getFirstValue(getMetaContentsByProperty(metaTags, 'al:ios:app_name')),
        androidUrl: getFirstValue(getMetaContentsByProperty(metaTags, 'al:android:url')),
        androidPackage: getFirstValue(getMetaContentsByProperty(metaTags, 'al:android:package')),
        androidAppName: getFirstValue(getMetaContentsByProperty(metaTags, 'al:android:app_name')),
        androidAppStoreUrl: getFirstValue(getMetaContentsByProperty(metaTags, 'al:android:app_store_url')),
      },
    },
    links: {
      canonical: canonicalTag ? buildResolvedLinkValue(canonicalTag.href, pageUrl) : null,
      alternates: alternateLinks,
      alternateResources,
      manifest: buildResolvedLinkValue(getLinkTagsByRel(linkTags, 'manifest')[0]?.href ?? null, pageUrl),
      icons: iconLinks,
      favicon: iconLinks[0]?.href ?? null,
      prev: buildResolvedLinkValue(paginationLinks.prev, pageUrl),
      next: buildResolvedLinkValue(paginationLinks.next, pageUrl),
    },
    jsonLd: {
      scriptCount: jsonLdScriptCount,
      parseErrors: jsonLdParseErrors,
      types: [ ...jsonLdTypes ].sort(),
      hasWebSite: jsonLdTypeSet.has('website'),
      hasOrganization: jsonLdTypeSet.has('organization'),
      blocks: jsonLdBlocks,
      signatures: jsonLdBlocks.map(block => `${ block.hash } | ${ block.summary }`).sort(),
    },
    head: {
      counts: headCounts,
      duplicates: buildHeadDuplicates(headCounts),
    },
  }
}
