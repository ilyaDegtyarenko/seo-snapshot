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

const normalizeUrlPath = (url) => {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(String(url))

    return `${ parsed.pathname }${ parsed.search }${ parsed.hash }` || '/'
  } catch {
    return normalizeScalar(url)
  }
}

const normalizeAlternateLinks = (links) => {
  if (!Array.isArray(links)) {
    return []
  }

  return normalizeList(links.map((link) => {
    const hreflang = normalizeScalar(link?.hreflang) ?? '-'
    const href = normalizeUrlPath(link?.href) ?? '-'

    return `${ hreflang }: ${ href }`
  }), { sort: true })
}

const normalizeRobotsValue = (page) => {
  const robotsValue = `${ page.seo?.meta.robots || '' } ${ page.headers?.xRobotsTag || '' }`
    .replace(/\s+/g, ' ')
    .trim()

  return robotsValue || null
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
    getValue: page => normalizeUrlPath(page.finalUrl),
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
    getValue: page => normalizeUrlPath(page.seo?.links.canonical),
  },
  {
    key: 'robots',
    label: 'Robots',
    getValue: page => normalizeRobotsValue(page),
  },
  {
    key: 'lang',
    label: 'Lang',
    getValue: page => normalizeScalar(page.seo?.document.lang),
  },
  {
    key: 'h1',
    label: 'H1',
    getValue: page => normalizeList(page.seo?.document.h1),
  },
  {
    key: 'hreflang',
    label: 'hreflang',
    getValue: page => normalizeAlternateLinks(page.seo?.links.alternates),
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
    key: 'ogUrl',
    label: 'OpenGraph URL',
    getValue: page => normalizeUrlPath(page.seo?.meta.openGraph?.url),
  },
  {
    key: 'ogImage',
    label: 'OpenGraph image',
    getValue: page => normalizeUrlPath(page.seo?.meta.openGraph?.image),
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
    key: 'twitterImage',
    label: 'Twitter image',
    getValue: page => normalizeUrlPath(page.seo?.meta.twitter?.image),
  },
  {
    key: 'jsonLdTypes',
    label: 'JSON-LD types',
    getValue: page => normalizeList(page.seo?.jsonLd?.types, { sort: true }),
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
