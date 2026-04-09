import { getLength, sortByCountDesc } from './utils.mjs'

const pushIssue = (issues, severity, code, message) => {
  issues.push({
    severity,
    code,
    message,
  })
}

export const buildPageIssues = (page, rules) => {
  const issues = []

  if (page.error) {
    pushIssue(issues, 'error', 'fetch_error', page.error)
    return issues
  }

  if (page.status >= 500) {
    pushIssue(issues, 'error', 'http_5xx', `Server returned ${ page.status }.`)
  } else if (page.status >= 400) {
    pushIssue(issues, 'warning', 'http_4xx', `Page returned ${ page.status }.`)
  }

  if (page.parseSkippedReason) {
    pushIssue(issues, 'warning', 'non_html', page.parseSkippedReason)
    return issues
  }

  const title = page.seo?.document.title
  const description = page.seo?.meta.description
  const h1 = page.seo?.document.h1 ?? []
  const lang = page.seo?.document.lang
  const canonical = page.seo?.links.canonical
  const robots = `${ page.seo?.meta.robots || '' } ${ page.headers.xRobotsTag || '' }`.toLowerCase()
  const openGraph = page.seo?.meta.openGraph ?? {}
  const twitter = page.seo?.meta.twitter ?? {}
  const jsonLd = page.seo?.jsonLd ?? { scriptCount: 0, parseErrors: 0 }
  const bodyTextLength = page.seo?.document.bodyTextLength ?? 0

  const titleLength = getLength(title)
  const descriptionLength = getLength(description)

  if (!title) {
    pushIssue(issues, 'error', 'missing_title', 'Missing <title>.')
  } else if (titleLength < rules.minTitleLength) {
    pushIssue(issues, 'warning', 'short_title', `Title is too short (${ titleLength }).`)
  } else if (titleLength > rules.maxTitleLength) {
    pushIssue(issues, 'warning', 'long_title', `Title is too long (${ titleLength }).`)
  }

  if (!description) {
    pushIssue(issues, 'warning', 'missing_description', 'Missing meta description.')
  } else if (descriptionLength < rules.minDescriptionLength) {
    pushIssue(issues, 'warning', 'short_description', `Meta description is too short (${ descriptionLength }).`)
  } else if (descriptionLength > rules.maxDescriptionLength) {
    pushIssue(issues, 'warning', 'long_description', `Meta description is too long (${ descriptionLength }).`)
  }

  if (h1.length === 0) {
    pushIssue(issues, 'warning', 'missing_h1', 'Missing H1.')
  } else if (h1.length > 1) {
    pushIssue(issues, 'warning', 'multiple_h1', `Page contains ${ h1.length } H1 headings.`)
  }

  if (!lang) {
    pushIssue(issues, 'warning', 'missing_lang', 'Missing lang attribute on <html>.')
  }

  if (!canonical) {
    pushIssue(issues, 'warning', 'missing_canonical', 'Missing canonical link.')
  }

  if (robots.includes('noindex')) {
    pushIssue(issues, 'warning', 'noindex', 'Page is marked as noindex.')
  }

  if (!openGraph.title) {
    pushIssue(issues, 'info', 'missing_og_title', 'Missing og:title.')
  }

  if (!openGraph.description) {
    pushIssue(issues, 'info', 'missing_og_description', 'Missing og:description.')
  }

  if (!openGraph.image) {
    pushIssue(issues, 'info', 'missing_og_image', 'Missing og:image.')
  }

  if (!twitter.card) {
    pushIssue(issues, 'info', 'missing_twitter_card', 'Missing twitter:card.')
  }

  if (jsonLd.scriptCount === 0) {
    pushIssue(issues, 'info', 'missing_jsonld', 'No JSON-LD structured data found.')
  }

  if (jsonLd.parseErrors > 0) {
    pushIssue(issues, 'warning', 'invalid_jsonld', `${ jsonLd.parseErrors } JSON-LD block(s) could not be parsed.`)
  }

  if (bodyTextLength < rules.minBodyTextLength) {
    pushIssue(issues, 'warning', 'thin_content', `Visible text is too short (${ bodyTextLength } chars).`)
  }

  return issues
}

export const buildSummary = (pages) => {
  const issueCounts = new Map()
  const severityCounts = {
    error: 0,
    warning: 0,
    info: 0,
  }

  const summary = pages.reduce((accumulator, page) => {
    accumulator.total += 1
    accumulator.totalIssues += page.issues.length

    if (page.issues.length > 0) {
      accumulator.pagesWithIssues += 1
    }

    if (page.error) {
      accumulator.errors += 1
    }

    if (page.error || (page.status && page.status >= 400)) {
      accumulator.failedPages += 1
    }

    if (page.redirectChain.length > 1) {
      accumulator.redirected += 1
    }

    if (page.status && page.status >= 400) {
      accumulator.httpErrors += 1
    }

    if (page.issues.some(issue => issue.code === 'noindex')) {
      accumulator.noindex += 1
    }

    if (page.parseSkippedReason) {
      accumulator.skipped += 1
    }

    for (const issue of page.issues) {
      issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1)
      severityCounts[issue.severity] += 1
    }

    return accumulator
  }, {
    total: 0,
    errors: 0,
    failedPages: 0,
    redirected: 0,
    httpErrors: 0,
    noindex: 0,
    skipped: 0,
    pagesWithIssues: 0,
    totalIssues: 0,
  })

  return {
    ...summary,
    severityCounts,
    issueBreakdown: sortByCountDesc(
      [ ...issueCounts.entries() ].map(([ code, count ]) => ({ code, count })),
    ),
  }
}
