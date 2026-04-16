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

const getSourceHosts = (page) => {
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

const isSourceLocalUrl = (url, page) => {
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
    const href = normalizeComparableUrl(link?.href, page) ?? '-'
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
    const href = normalizeComparableUrl(entry?.href, page) ?? '-'
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

const getIssueCodes = (page) => {
  return normalizeList(page.issues?.map(issue => issue.code), { sort: true })
}

const areEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const sortByCountDesc = (entries) => {
  return [ ...entries ].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }

    return left.key.localeCompare(right.key)
  })
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
    getValue: page => page.status ?? null,
  },
  {
    key: 'finalUrl',
    label: 'Final URL',
    getValue: page => normalizeComparableUrl(page.finalUrl, page),
  },
  {
    key: 'charset',
    label: 'Charset',
    getValue: page => normalizeScalar(page.seo?.meta.charset),
  },
  {
    key: 'title',
    label: 'Title',
    getValue: page => normalizeScalar(page.seo?.document.title),
  },
  {
    key: 'description',
    label: 'Meta description',
    getValue: page => normalizeScalar(page.seo?.meta.description),
  },
  {
    key: 'canonical',
    label: 'Canonical',
    getValue: page => normalizeComparableUrl(page.seo?.links.canonical, page),
  },
  {
    key: 'canonicalCrossDomain',
    label: 'Canonical cross-domain',
    getValue: page => normalizeCrossDomainFlag(page.seo?.links.canonical, page),
  },
  {
    key: 'metaRobots',
    label: 'Meta robots',
    getValue: page => normalizeScalar(page.seo?.meta.robots),
  },
  {
    key: 'xRobotsTag',
    label: 'X-Robots-Tag',
    getValue: page => normalizeScalar(page.headers?.xRobotsTag),
  },
  {
    key: 'linkHeaderCanonical',
    label: 'Link header canonical',
    getValue: page => normalizeComparableUrl(page.headers?.links?.canonical, page),
  },
  {
    key: 'linkHeaderCanonicalCrossDomain',
    label: 'Link header canonical cross-domain',
    getValue: page => normalizeCrossDomainFlag(page.headers?.links?.canonical, page),
  },
  {
    key: 'linkHeaderLlms',
    label: 'Link header llms',
    getValue: page => normalizeAbsoluteUrl(page.headers?.links?.llms),
  },
  {
    key: 'linkHeaderEntries',
    label: 'Link header entries',
    getValue: page => normalizeLinkHeaderEntries(page.headers?.links?.entries, page),
  },
  {
    key: 'lang',
    label: 'Lang',
    getValue: page => normalizeScalar(page.seo?.document.lang),
  },
  {
    key: 'contentLanguage',
    label: 'Content-Language',
    getValue: page => normalizeScalar(page.seo?.document.contentLanguage),
  },
  {
    key: 'viewport',
    label: 'Viewport',
    getValue: page => normalizeScalar(page.seo?.meta.viewport),
  },
  {
    key: 'applicationName',
    label: 'Application name',
    getValue: page => normalizeScalar(page.seo?.meta.applicationName),
  },
  {
    key: 'themeColor',
    label: 'Theme color',
    getValue: page => normalizeScalar(page.seo?.meta.themeColor),
  },
  {
    key: 'manifest',
    label: 'Manifest',
    getValue: page => normalizeComparableUrl(page.seo?.links.manifest, page),
  },
  {
    key: 'favicon',
    label: 'Favicon',
    getValue: page => normalizeComparableUrl(page.seo?.links.favicon, page),
  },
  {
    key: 'icons',
    label: 'Icons',
    getValue: page => normalizeIconLinks(page.seo?.links.icons, page),
  },
  {
    key: 'h1',
    label: 'H1',
    getValue: page => normalizeList(page.seo?.document.h1),
  },
  {
    key: 'hreflang',
    label: 'hreflang',
    getValue: page => normalizeAlternateLinks(page.seo?.links.alternates, page),
  },
  {
    key: 'alternateResources',
    label: 'Alternate resources',
    getValue: page => normalizeAlternateResources(page.seo?.links.alternateResources, page),
  },
  {
    key: 'prev',
    label: 'Prev',
    getValue: page => normalizeComparableUrl(page.seo?.links.prev, page),
  },
  {
    key: 'next',
    label: 'Next',
    getValue: page => normalizeComparableUrl(page.seo?.links.next, page),
  },
  {
    key: 'ogTitle',
    label: 'OpenGraph title',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.title),
  },
  {
    key: 'ogDescription',
    label: 'OpenGraph description',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.description),
  },
  {
    key: 'ogType',
    label: 'OpenGraph type',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.type),
  },
  {
    key: 'ogSiteName',
    label: 'OpenGraph site name',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.siteName),
  },
  {
    key: 'ogLocale',
    label: 'OpenGraph locale',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.locale),
  },
  {
    key: 'ogLocaleAlternates',
    label: 'OpenGraph locale alternates',
    getValue: page => normalizeList(page.seo?.meta.openGraph?.localeAlternates, { sort: true }),
  },
  {
    key: 'ogUrl',
    label: 'OpenGraph URL',
    getValue: page => normalizeComparableUrl(page.seo?.meta.openGraph?.url, page),
  },
  {
    key: 'ogUrlCrossDomain',
    label: 'OpenGraph URL cross-domain',
    getValue: page => normalizeCrossDomainFlag(page.seo?.meta.openGraph?.url, page),
  },
  {
    key: 'ogImage',
    label: 'OpenGraph image',
    getValue: page => normalizeAbsoluteUrl(page.seo?.meta.openGraph?.image),
  },
  {
    key: 'ogImageAlt',
    label: 'OpenGraph image alt',
    getValue: page => normalizeScalar(page.seo?.meta.openGraph?.imageAlt),
  },
  {
    key: 'ogVideo',
    label: 'OpenGraph video',
    getValue: page => normalizeAbsoluteUrl(page.seo?.meta.openGraph?.video),
  },
  {
    key: 'twitterCard',
    label: 'Twitter card',
    getValue: page => normalizeScalar(page.seo?.meta.twitter?.card),
  },
  {
    key: 'twitterTitle',
    label: 'Twitter title',
    getValue: page => normalizeScalar(page.seo?.meta.twitter?.title),
  },
  {
    key: 'twitterDescription',
    label: 'Twitter description',
    getValue: page => normalizeScalar(page.seo?.meta.twitter?.description),
  },
  {
    key: 'twitterUrl',
    label: 'Twitter URL',
    getValue: page => normalizeComparableUrl(page.seo?.meta.twitter?.url, page),
  },
  {
    key: 'twitterImage',
    label: 'Twitter image',
    getValue: page => normalizeAbsoluteUrl(page.seo?.meta.twitter?.image),
  },
  {
    key: 'twitterImageAlt',
    label: 'Twitter image alt',
    getValue: page => normalizeScalar(page.seo?.meta.twitter?.imageAlt),
  },
  {
    key: 'appleItunesApp',
    label: 'Apple iTunes app',
    getValue: page => normalizeScalar(page.seo?.meta.appleItunesApp),
  },
  {
    key: 'iosAppUrl',
    label: 'iOS deep link',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.iosUrl),
  },
  {
    key: 'iosAppStoreId',
    label: 'iOS App Store ID',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.iosAppStoreId),
  },
  {
    key: 'iosAppName',
    label: 'iOS app name',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.iosAppName),
  },
  {
    key: 'androidAppUrl',
    label: 'Android deep link',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.androidUrl),
  },
  {
    key: 'androidPackage',
    label: 'Android package',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.androidPackage),
  },
  {
    key: 'androidAppName',
    label: 'Android app name',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.androidAppName),
  },
  {
    key: 'androidAppStoreUrl',
    label: 'Android app store URL',
    getValue: page => normalizeScalar(page.seo?.meta.appLinks?.androidAppStoreUrl),
  },
  {
    key: 'jsonLdScriptCount',
    label: 'JSON-LD script count',
    getValue: page => page.seo?.jsonLd?.scriptCount ?? null,
  },
  {
    key: 'jsonLdParseErrors',
    label: 'JSON-LD parse errors',
    getValue: page => page.seo?.jsonLd?.parseErrors ?? null,
  },
  {
    key: 'jsonLdTypes',
    label: 'JSON-LD types',
    getValue: page => normalizeList(page.seo?.jsonLd?.types, { sort: true }),
  },
  {
    key: 'jsonLdHasWebSite',
    label: 'JSON-LD has WebSite',
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

const buildDifferences = (leftPage, rightPage) => {
  return DIFFERENCE_SPECS.flatMap((spec) => {
    const leftValue = spec.getValue(leftPage)
    const rightValue = spec.getValue(rightPage)

    if (areEqual(leftValue, rightValue)) {
      return []
    }

    return [{
      key: spec.key,
      label: spec.label,
      left: leftValue,
      right: rightValue,
    }]
  })
}

export const buildComparisonReport = (pages, compareOptions) => {
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

    if (!groupedPages.has(targetPath)) {
      groupedPages.set(targetPath, [])
    }

    groupedPages.get(targetPath).push(page)
  }

  const differenceCounts = new Map()
  const comparisons = []

  for (const [ targetPath, targetPages ] of groupedPages.entries()) {
    const leftPage = targetPages.find(page => page.source?.url === leftSource.url) ?? null
    const rightPage = targetPages.find(page => page.source?.url === rightSource.url) ?? null

    if (!leftPage || !rightPage) {
      continue
    }

    const differences = buildDifferences(leftPage, rightPage)
    const issueDelta = buildIssueDelta(leftPage, rightPage)

    for (const difference of differences) {
      differenceCounts.set(difference.key, (differenceCounts.get(difference.key) ?? 0) + 1)
    }

    comparisons.push({
      targetPath,
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
      issueDelta,
    })
  }

  comparisons.sort((left, right) => left.targetPath.localeCompare(right.targetPath))

  return {
    sources: compareOptions.sources,
    targetCount: comparisons.length,
    targetsWithDifferences: comparisons.filter(comparison => comparison.differences.length > 0).length,
    totalDifferences: comparisons.reduce((total, comparison) => total + comparison.differences.length, 0),
    differenceBreakdown: sortByCountDesc([ ...differenceCounts.entries() ].map(([ key, count ]) => {
      const label = DIFFERENCE_SPECS.find(spec => spec.key === key)?.label ?? key

      return {
        key,
        label,
        count,
      }
    })),
    comparisons,
  }
}
