import { isSourceLocalUrl, sortByCountDesc } from './utils.mjs'

const normalizeScalar = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  const normalizedValue = String(value).trim()

  return normalizedValue || null
}

// Normalize robots directive strings so that "index,follow" and "index, follow"
// compare as equal — servers differ in whether they include a space after commas.
const normalizeRobotsValue = (value) => {
  const normalized = normalizeScalar(value)

  if (!normalized) {
    return null
  }

  return normalized
    .split(/\s*,\s*/)
    .map(directive => directive.trim())
    .filter(Boolean)
    .join(',')
}

const normalizeList = (items, { sort = false } = {}) => {
  if (!Array.isArray(items)) {
    return []
  }

  const normalizedItems = items
    .map(item => normalizeScalar(item))
    .filter(item => item !== null)

  if (!sort) {
    return normalizedItems
  }

  return [ ...normalizedItems ].sort((left, right) => String(left).localeCompare(String(right)))
}

const normalizeAbsoluteUrl = (url) => {
  if (!url) {
    return null
  }

  try {
    return new URL(String(url)).toString()
  } catch {
    return normalizeScalar(url)
  }
}

const normalizeComparableUrl = (url, page) => {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(String(url))
    const sourceLocal = isSourceLocalUrl(parsed.toString(), page)

    if (sourceLocal === false) {
      return parsed.toString()
    }

    return `${ parsed.pathname }${ parsed.search }${ parsed.hash }` || '/'
  } catch {
    return normalizeScalar(url)
  }
}

const normalizeCrossDomainFlag = (url, page) => {
  const sourceLocal = isSourceLocalUrl(url, page)

  if (sourceLocal === null) {
    return null
  }

  return !sourceLocal
}

const normalizeAlternateLinks = (links, page) => {
  if (!Array.isArray(links)) {
    return []
  }

  return normalizeList(links.map((link) => {
    const hreflang = normalizeScalar(link?.hreflang) ?? '-'
    const href = normalizeComparableUrl(link?.href, page) ?? '-'

    return `${ hreflang }: ${ href }`
  }), { sort: true })
}

const normalizeAlternateResources = (links, page) => {
  if (!Array.isArray(links)) {
    return []
  }

  return normalizeList(links.map((link) => {
    const rel = normalizeScalar(link?.rel) ?? 'alternate'
    const type = normalizeScalar(link?.type)
    const title = normalizeScalar(link?.title)
    const href = normalizeAbsoluteUrl(link?.href) ?? '-'
    const prefixParts = [ rel ]

    if (type) {
      prefixParts.push(type)
    }

    if (title) {
      prefixParts.push(title)
    }

    return `${ prefixParts.join(' | ') }: ${ href }`
  }), { sort: true })
}

const normalizeLinkHeaderEntries = (entries, page) => {
  if (!Array.isArray(entries)) {
    return []
  }

  return normalizeList(entries.map((entry) => {
    const rel = normalizeScalar(entry?.rel) ?? 'link'
    const hreflang = normalizeScalar(entry?.hreflang)
    const type = normalizeScalar(entry?.type)
    const title = normalizeScalar(entry?.title)
    const isCanonicalRel = rel === 'canonical'
    const isHreflangEntry = Boolean(hreflang)
    const href = (isCanonicalRel || isHreflangEntry ? normalizeComparableUrl(entry?.href, page) : normalizeAbsoluteUrl(entry?.href)) ?? '-'
    const labelParts = [ rel ]

    if (hreflang) {
      labelParts.push(`hreflang=${ hreflang }`)
    }

    if (type) {
      labelParts.push(type)
    }

    if (title) {
      labelParts.push(title)
    }

    return `${ labelParts.join(' | ') }: ${ href }`
  }), { sort: true })
}

const normalizeIconLinks = (icons, page) => {
  if (!Array.isArray(icons)) {
    return []
  }

  return normalizeList(icons.map((icon) => {
    const rel = normalizeScalar(icon?.rel) ?? 'icon'
    const type = normalizeScalar(icon?.type)
    const sizes = normalizeScalar(icon?.sizes)
    const href = normalizeComparableUrl(icon?.href, page) ?? '-'
    const prefixParts = [ rel ]

    if (type) {
      prefixParts.push(type)
    }

    if (sizes) {
      prefixParts.push(sizes)
    }

    return `${ prefixParts.join(' | ') }: ${ href }`
  }), { sort: true })
}

const normalizeDuplicateSignals = (duplicates) => {
  if (!Array.isArray(duplicates)) {
    return []
  }

  return normalizeList(duplicates.map(duplicate =>
    `${ normalizeScalar(duplicate?.label) ?? normalizeScalar(duplicate?.key) ?? 'unknown' } x${ duplicate?.count ?? 0 }`
  ), { sort: true })
}

const normalizeJsonLdBlocks = (blocks) => {
  if (!Array.isArray(blocks)) {
    return []
  }

  return normalizeList(blocks.map(block => {
    const hash = normalizeScalar(block?.hash) ?? 'unknown'
    const summary = normalizeScalar(block?.summary) ?? 'Unknown JSON-LD block'

    return `${ hash } | ${ summary }`
  }), { sort: true })
}

const normalizePreloadLinks = (preloads, page) => {
  if (!Array.isArray(preloads)) {
    return []
  }

  return normalizeList(preloads.map((preload) => {
    const href = normalizeComparableUrl(preload?.href, page) ?? '-'
    const as = normalizeScalar(preload?.as) ?? ''
    const type = normalizeScalar(preload?.type) ?? ''
    const parts = [ as || 'preload' ]

    if (type) {
      parts.push(type)
    }

    return `${ parts.join('/') }: ${ href }`
  }), { sort: true })
}

const normalizeJsonLdMissingRequiredProperties = (issues) => {
  if (!Array.isArray(issues)) {
    return []
  }

  return normalizeList(issues.map(issue => {
    const type = normalizeScalar(issue?.type) ?? 'Unknown'
    const property = normalizeScalar(issue?.property) ?? 'unknown'

    return `${ type }.${ property }`
  }), { sort: true })
}

const getIssueCodes = (page) => {
  return normalizeList(page.issues?.map(issue => issue.code), { sort: true })
}

const areEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const isEmptyComparableValue = (value) => {
  if (value === null || value === undefined) {
    return true
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === 'string') {
    return value.trim() === ''
  }

  return false
}

const DIFFERENCE_SPECS = [
  {
    key: 'error',
    label: 'Fetch error',
    getValue: page => normalizeScalar(page.error),
  },
  {
    key: 'parseSkippedReason',
    label: 'Parse skipped',
    getValue: page => normalizeScalar(page.parseSkippedReason),
  },
  {
    key: 'status',
    label: 'HTTP status',
    hint: 'HTTP response status code returned by the server',
    getValue: page => page.status ?? null,
  },
  {
    key: 'ttfbMs',
    label: 'TTFB (ms)',
    hint: 'Time to First Byte — time from sending the request to receiving the first byte of the response',
    getValue: page => page.ttfbMs ?? null,
  },
  {
    key: 'finalResponseTtfbMs',
    label: 'Final response TTFB (ms)',
    hint: 'TTFB measured for the final URL after all redirects',
    getValue: page => page.finalResponseTtfbMs ?? null,
  },
  {
    key: 'finalUrl',
    label: 'Final URL',
    hint: 'The URL after all redirects have been followed',
    getValue: page => normalizeComparableUrl(page.finalUrl, page),
  },
  {
    key: 'charset',
    label: 'Charset',
    hint: 'Character encoding declared in the meta tag or HTTP header',
    getValue: page => normalizeScalar(page.seo?.meta.charset),
  },
  {
    key: 'title',
    label: 'Title',
    hint: '<title> tag content — shown in browser tabs and search result headlines',
    getValue: page => normalizeScalar(page.seo?.document.title),
  },
  {
    key: 'description',
    label: 'Meta description',
    hint: '<meta name="description"> — page summary shown in search result snippets',
    getValue: page => normalizeScalar(page.seo?.meta.description),
  },
  {
    key: 'canonical',
    label: 'Canonical',
    hint: '<link rel="canonical"> — declares the preferred URL for this content to avoid duplicates',
    getValue: page => normalizeComparableUrl(page.seo?.links.canonical, page),
  },
  {
    key: 'canonicalCrossDomain',
    label: 'Canonical cross-domain',
    hint: 'Whether the canonical URL points to a different domain',
    getValue: page => normalizeCrossDomainFlag(page.seo?.links.canonical, page),
  },
  {
    key: 'metaRobots',
    label: 'Meta robots',
    hint: '<meta name="robots"> — crawler directives: index/noindex, follow/nofollow',
    getValue: page => normalizeRobotsValue(page.seo?.meta.robots),
  },
  {
    key: 'xRobotsTag',
    label: 'X-Robots-Tag',
    hint: 'HTTP header version of robots directives — equivalent to meta robots but set server-side',
    getValue: page => normalizeRobotsValue(page.headers?.xRobotsTag),
  },
  {
    key: 'contentSecurityPolicy',
    label: 'Content-Security-Policy',
    hint: 'HTTP header restricting allowed resource origins to mitigate XSS attacks',
    getValue: page => normalizeScalar(page.headers?.contentSecurityPolicy),
  },
  {
    key: 'xFrameOptions',
    label: 'X-Frame-Options',
    hint: 'HTTP header preventing the page from being embedded in a frame — protects against clickjacking',
    getValue: page => normalizeScalar(page.headers?.xFrameOptions),
  },
  {
    key: 'linkHeaderCanonical',
    label: 'Link header canonical',
    hint: 'Canonical URL specified via HTTP Link header instead of an in-page tag',
    getValue: page => normalizeComparableUrl(page.headers?.links?.canonical, page),
  },
  {
    key: 'linkHeaderCanonicalCrossDomain',
    label: 'Link header canonical cross-domain',
    hint: 'Whether the canonical in the HTTP Link header points to a different domain',
    getValue: page => normalizeCrossDomainFlag(page.headers?.links?.canonical, page),
  },
  {
    key: 'linkHeaderLlms',
    label: 'Link header llms',
    hint: 'Link to llms.txt via HTTP Link header — hints for LLM crawlers',
    getValue: page => normalizeAbsoluteUrl(page.headers?.links?.llms),
  },
  {
    key: 'linkHeaderEntries',
    label: 'Link header entries',
    hint: 'HTTP Link response header — may carry canonical, pagination, preload and other relations',
    getValue: page => normalizeLinkHeaderEntries(page.headers?.links?.entries, page),
  },
  {
    key: 'lang',
    label: 'Lang',
    hint: 'lang attribute on the <html> element — declares the language of the page content',
    getValue: page => normalizeScalar(page.seo?.document.lang),
  },
  {
    key: 'contentLanguage',
    label: 'Content-Language',
    hint: 'Page language from the HTTP Content-Language header or meta tag',
    getValue: page => normalizeScalar(page.headers?.contentLanguage ?? page.seo?.document.contentLanguage),
  },
  {
    key: 'viewport',
    label: 'Viewport',
    hint: '<meta name="viewport"> — controls scaling and layout on mobile devices',
    getValue: page => normalizeScalar(page.seo?.meta.viewport),
  },
  {
    key: 'applicationName',
    label: 'Application name',
    hint: '<meta name="application-name"> — name of the web application',
    getValue: page => normalizeScalar(page.seo?.meta.applicationName),
  },
  {
    key: 'themeColor',
    label: 'Theme color',
    hint: '<meta name="theme-color"> — browser UI color on mobile devices',
    getValue: page => normalizeScalar(page.seo?.meta.themeColor),
  },
  {
    key: 'manifest',
    label: 'Manifest',
    hint: '<link rel="manifest"> — link to the PWA manifest JSON file',
    getValue: page => normalizeComparableUrl(page.seo?.links.manifest, page),
  },
  {
    key: 'favicon',
    label: 'Favicon',
    hint: 'URL of the site favicon',
    getValue: page => normalizeComparableUrl(page.seo?.links.favicon, page),
  },
  {
    key: 'icons',
    label: 'Icons',
    hint: 'All icon link tags declared in the page <head>',
    getValue: page => normalizeIconLinks(page.seo?.links.icons, page),
  },
  {
    key: 'h1',
    label: 'H1',
    hint: 'Text content of all <h1> elements on the page',
    getValue: page => normalizeList(page.seo?.document.h1),
  },
  {
    key: 'hreflang',
    label: 'hreflang',
    hint: '<link rel="alternate" hreflang="..."> — language/region variants of the page for international SEO',
    getValue: page => normalizeAlternateLinks(page.seo?.links.alternates, page),
  },
  {
    key: 'alternateResources',
    label: 'Alternate resources',
    hint: '<link rel="alternate"> entries pointing to non-HTML versions (e.g. AMP, feed)',
    getValue: page => normalizeAlternateResources(page.seo?.links.alternateResources, page),
  },
  {
    key: 'prev',
    label: 'Prev',
    hint: '<link rel="prev"> — link to the previous pagination page',
    getValue: page => normalizeComparableUrl(page.seo?.links.prev, page),
  },
  {
    key: 'next',
    label: 'Next',
    hint: '<link rel="next"> — link to the next pagination page',
    getValue: page => normalizeComparableUrl(page.seo?.links.next, page),
  },
  {
    key: 'ogTitle',
    label: 'OpenGraph title',
    hint: 'og:title — page title for social media link previews',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.title),
  },
  {
    key: 'ogDescription',
    label: 'OpenGraph description',
    hint: 'og:description — page description for social media link previews',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.description),
  },
  {
    key: 'ogType',
    label: 'OpenGraph type',
    hint: 'og:type — object type for Open Graph: website, article, product, etc.',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.type),
  },
  {
    key: 'ogSiteName',
    label: 'OpenGraph site name',
    hint: 'og:site_name — site name shown in social media link previews',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.siteName),
  },
  {
    key: 'ogLocale',
    label: 'OpenGraph locale',
    hint: 'og:locale — language and region of the content, e.g. en_US',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.locale),
  },
  {
    key: 'ogLocaleAlternates',
    label: 'OpenGraph locale alternates',
    hint: 'og:locale:alternate — additional language/region variants declared for Open Graph',
    getValue: page => normalizeList(page.seo?.meta.openGraph?.localeAlternates, { sort: true }),
  },
  {
    key: 'ogUrl',
    label: 'OpenGraph URL',
    hint: 'og:url — canonical URL of the page for Open Graph',
    getValue: page => normalizeComparableUrl(page.seo?.meta.openGraph?.url, page),
  },
  {
    key: 'ogUrlCrossDomain',
    label: 'OpenGraph URL cross-domain',
    hint: 'Whether the og:url points to a different domain',
    getValue: page => normalizeCrossDomainFlag(page.seo?.meta.openGraph?.url, page),
  },
  {
    key: 'ogImage',
    label: 'OpenGraph image',
    hint: 'og:image — image used when the page is shared on social media',
    getValue: page => normalizeAbsoluteUrl(page.seo?.meta.openGraph?.image),
  },
  {
    key: 'ogImageAlt',
    label: 'OpenGraph image alt',
    hint: 'og:image:alt — alternative text for the og:image',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.imageAlt),
  },
  {
    key: 'ogVideo',
    label: 'OpenGraph video',
    hint: 'og:video — video URL for Open Graph previews',
    getValue: page => normalizeAbsoluteUrl(page.seo?.meta.openGraph?.video),
  },
  {
    key: 'twitterCard',
    label: 'Twitter card',
    hint: 'twitter:card — card type controlling how the page looks when shared on Twitter/X',
    getValue: page => normalizeScalar(page.seo?.meta.twitter?.card),
  },
  {
    key: 'twitterTitle',
    label: 'Twitter title',
    hint: 'twitter:title — page title for Twitter/X link previews',
    getValue: page => normalizeScalar(page.seo?.meta.twitter?.title),
  },
  {
    key: 'twitterDescription',
    label: 'Twitter description',
    hint: 'twitter:description — page description for Twitter/X link previews',
    getValue: page => normalizeScalar(page.seo?.meta.twitter?.description),
  },
  {
    key: 'twitterUrl',
    label: 'Twitter URL',
    hint: 'twitter:url — canonical URL of the page for Twitter Card',
    getValue: page => normalizeComparableUrl(page.seo?.meta.twitter?.url, page),
  },
  {
    key: 'twitterImage',
    label: 'Twitter image',
    hint: 'twitter:image — image shown in Twitter/X link previews',
    getValue: page => normalizeAbsoluteUrl(page.seo?.meta.twitter?.image),
  },
  {
    key: 'twitterImageAlt',
    label: 'Twitter image alt',
    hint: 'twitter:image:alt — alternative text for the twitter:image',
    getValue: page => normalizeScalar(page.seo?.meta.twitter?.imageAlt),
  },
  {
    key: 'appleItunesApp',
    label: 'Apple iTunes app',
    hint: '<meta name="apple-itunes-app"> — Smart App Banner configuration for iOS',
    getValue: page => normalizeScalar(page.seo?.meta.appleItunesApp),
  },
  {
    key: 'iosAppUrl',
    label: 'iOS deep link',
    hint: 'al:ios:url — deep link to open this page in the iOS app',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.iosUrl),
  },
  {
    key: 'iosAppStoreId',
    label: 'iOS App Store ID',
    hint: 'al:ios:app_store_id — App Store identifier of the iOS app',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.iosAppStoreId),
  },
  {
    key: 'iosAppName',
    label: 'iOS app name',
    hint: 'al:ios:app_name — display name of the iOS app',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.iosAppName),
  },
  {
    key: 'androidAppUrl',
    label: 'Android deep link',
    hint: 'al:android:url — deep link to open this page in the Android app',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.androidUrl),
  },
  {
    key: 'androidPackage',
    label: 'Android package',
    hint: 'al:android:package — package name of the Android app',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.androidPackage),
  },
  {
    key: 'androidAppName',
    label: 'Android app name',
    hint: 'al:android:app_name — display name of the Android app',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.androidAppName),
  },
  {
    key: 'androidAppStoreUrl',
    label: 'Android app store URL',
    hint: 'Link to the app on Google Play',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.androidAppStoreUrl),
  },
  {
    key: 'facebookDomainVerification',
    label: 'Facebook domain verification',
    hint: '<meta name="facebook-domain-verification"> — domain verification for Facebook Business Manager',
    getValue: page => normalizeScalar(page.seo?.meta.facebookDomainVerification),
  },
  {
    key: 'preloads',
    label: 'Preload links',
    hint: '<link rel="preload"> — resources to fetch early for performance (fonts, scripts, styles)',
    getValue: page => normalizePreloadLinks(page.seo?.links.preloads, page),
  },
  {
    key: 'preconnects',
    label: 'Preconnect links',
    hint: '<link rel="preconnect"> — origins to establish early connections to for performance',
    getValue: page => normalizeList(page.seo?.links.preconnects, { sort: true }),
  },
  {
    key: 'dnsPrefetches',
    label: 'DNS-prefetch links',
    hint: '<link rel="dns-prefetch"> — origins to resolve DNS for in advance',
    getValue: page => normalizeList(page.seo?.links.dnsPrefetches, { sort: true }),
  },
  {
    key: 'jsonLdScriptCount',
    label: 'JSON-LD script count',
    hint: 'Number of <script type="application/ld+json"> blocks on the page',
    getValue: page => page.seo?.jsonLd?.scriptCount ?? null,
  },
  {
    key: 'jsonLdParseErrors',
    label: 'JSON-LD parse errors',
    hint: 'Number of JSON-LD blocks that failed to parse',
    getValue: page => page.seo?.jsonLd?.parseErrors ?? null,
  },
  {
    key: 'jsonLdTypes',
    label: 'JSON-LD types',
    hint: 'Schema.org @type values found in JSON-LD blocks (e.g. WebSite, Product, BreadcrumbList)',
    getValue: page => normalizeList(page.seo?.jsonLd?.types, { sort: true }),
  },
  {
    key: 'jsonLdHasWebSite',
    label: 'JSON-LD has WebSite',
    hint: 'Whether the page has a JSON-LD block with @type: WebSite — used for sitelinks search box',
    getValue: page => {
      if (page.seo?.jsonLd?.hasWebSite === undefined) {
        return null
      }

      return Boolean(page.seo?.jsonLd?.hasWebSite)
    },
  },
  {
    key: 'jsonLdHasOrganization',
    label: 'JSON-LD has Organization',
    hint: 'Whether the page has a JSON-LD block with @type: Organization — used for knowledge panel',
    getValue: page => {
      if (page.seo?.jsonLd?.hasOrganization === undefined) {
        return null
      }

      return Boolean(page.seo?.jsonLd?.hasOrganization)
    },
  },
  {
    key: 'jsonLdBlocks',
    label: 'JSON-LD blocks',
    getValue: page => normalizeJsonLdBlocks(page.seo?.jsonLd?.blocks),
  },
  {
    key: 'jsonLdMissingRequiredProperties',
    label: 'JSON-LD missing required properties',
    getValue: page => normalizeJsonLdMissingRequiredProperties(page.seo?.jsonLd?.missingRequiredProperties),
  },
  {
    key: 'headDuplicates',
    label: 'Head duplicates',
    getValue: page => normalizeDuplicateSignals(page.seo?.head?.duplicates),
  },
  {
    key: 'bodyTextLength',
    label: 'Body text length',
    getValue: page => page.seo?.document.bodyTextLength ?? null,
  },
  {
    key: 'imageCount',
    label: 'Image count',
    getValue: page => page.seo?.document.imageCount ?? null,
  },
  {
    key: 'imagesWithoutAlt',
    label: 'Images without alt',
    getValue: page => page.seo?.document.imagesWithoutAlt ?? null,
  },
  {
    key: 'imagesWithEmptyAlt',
    label: 'Images with empty alt',
    getValue: page => page.seo?.document.imagesWithEmptyAlt ?? null,
  },
  {
    key: 'internalLinkCount',
    label: 'Internal link count',
    getValue: page => page.seo?.document.internalLinkCount ?? null,
  },
  {
    key: 'issueCodes',
    label: 'Issue codes',
    getValue: page => getIssueCodes(page),
  },
]

const buildIssueDelta = (leftPage, rightPage) => {
  const leftIssueCodes = getIssueCodes(leftPage)
  const rightIssueCodes = getIssueCodes(rightPage)
  const rightIssueSet = new Set(rightIssueCodes)
  const leftIssueSet = new Set(leftIssueCodes)

  return {
    onlyOnLeft: leftIssueCodes.filter(code => !rightIssueSet.has(code)),
    onlyOnRight: rightIssueCodes.filter(code => !leftIssueSet.has(code)),
  }
}

const hasComparisonDifferences = (comparison) => {
  return comparison.differences.length > 0 ||
    (comparison.issueDelta && (comparison.issueDelta.onlyOnLeft.length || comparison.issueDelta.onlyOnRight.length))
}

const buildComparisonFields = (leftPage, rightPage, hideTtfb = false) => {
  const specs = hideTtfb
    ? DIFFERENCE_SPECS.filter(spec => ![ 'ttfbMs', 'finalResponseTtfbMs' ].includes(spec.key))
    : DIFFERENCE_SPECS

  return specs.flatMap((spec) => {
    const leftValue = spec.getValue(leftPage)
    const rightValue = spec.getValue(rightPage)
    const changed = !areEqual(leftValue, rightValue)

    if (!changed && isEmptyComparableValue(leftValue) && isEmptyComparableValue(rightValue)) {
      return []
    }

    return [{
      key: spec.key,
      label: spec.label,
      hint: spec.hint,
      left: leftValue,
      right: rightValue,
      changed,
    }]
  })
}

export const buildComparisonReport = (pages, compareOptions, hideTtfb = false) => {
  if (!compareOptions?.sources || compareOptions.sources.length !== 2) {
    return null
  }

  const [ leftSource, rightSource ] = compareOptions.sources
  const groupedPages = new Map()

  for (const page of pages) {
    const targetPath = String(page.targetPath || page.input || '').trim()

    if (!targetPath) {
      continue
    }

    const variant = page.variant ?? null
    const variantId = page.variantId ?? variant
    const groupKey = variantId ? `${ targetPath }::${ variantId }` : targetPath

    if (!groupedPages.has(groupKey)) {
      groupedPages.set(groupKey, { targetPath, variant, variantId, pages: [] })
    }

    groupedPages.get(groupKey).pages.push(page)
  }

  const differenceCounts = new Map()
  const comparisons = []

  for (const { targetPath, variant, variantId, pages: targetPages } of groupedPages.values()) {
    const leftPage = targetPages.find(page => page.source?.url === leftSource.url) ?? null
    const rightPage = targetPages.find(page => page.source?.url === rightSource.url) ?? null

    if (!leftPage || !rightPage) {
      continue
    }

    const fields = buildComparisonFields(leftPage, rightPage, hideTtfb)
    const differences = fields
      .filter(field => field.changed)
      .map(({ key, label, left, right }) => ({ key, label, left, right }))
    const issueDelta = buildIssueDelta(leftPage, rightPage)

    for (const difference of differences) {
      differenceCounts.set(difference.key, (differenceCounts.get(difference.key) ?? 0) + 1)
    }

    comparisons.push({
      targetPath,
      variant,
      variantId,
      left: {
        label: leftSource.label,
        baseUrl: leftSource.url,
        requestedUrl: leftPage.requestedUrl,
        finalUrl: leftPage.finalUrl,
        status: leftPage.status,
      },
      right: {
        label: rightSource.label,
        baseUrl: rightSource.url,
        requestedUrl: rightPage.requestedUrl,
        finalUrl: rightPage.finalUrl,
        status: rightPage.status,
      },
      differences,
      fields,
      issueDelta,
    })
  }

  comparisons.sort((left, right) => {
    const pathCmp = left.targetPath.localeCompare(right.targetPath)

    if (pathCmp !== 0) {
      return pathCmp
    }

    const variantCmp = (left.variant ?? '').localeCompare(right.variant ?? '')

    if (variantCmp !== 0) {
      return variantCmp
    }

    return (left.variantId ?? '').localeCompare(right.variantId ?? '')
  })

  const variantLabels = [ ...new Set(comparisons.map(c => c.variant).filter(Boolean)) ]
  const changedComparisons = comparisons.filter(hasComparisonDifferences)

  return {
    sources: compareOptions.sources,
    variants: variantLabels.length > 0 ? variantLabels : null,
    targetCount: comparisons.length,
    targetsWithDifferences: changedComparisons.length,
    totalDifferences: changedComparisons.reduce((total, comparison) => total + comparison.differences.length, 0),
    differenceBreakdown: sortByCountDesc([ ...differenceCounts.entries() ].map(([ key, count ]) => {
      const label = DIFFERENCE_SPECS.find(spec => spec.key === key)?.label ?? key

      return {
        key,
        label,
        count,
      }
    }), 'key'),
    comparisons,
  }
}
