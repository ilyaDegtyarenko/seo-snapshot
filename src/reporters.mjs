import { buildSummary } from './audit.mjs'
import { escapeHtml, getHighestSeverity } from './utils.mjs'

const renderBadge = (label, tone = 'neutral') => {
  return `<span class="badge badge-${ tone }">${ escapeHtml(label) }</span>`
}

const renderKeyValueRow = (label, value) => {
  const normalizedValue = (value === null || value === undefined || value === '')
    ? '<span class="muted">-</span>'
    : escapeHtml(value)

  return `<div class="kv-row"><dt>${ escapeHtml(label) }</dt><dd>${ normalizedValue }</dd></div>`
}

const renderList = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return '<span class="muted">-</span>'
  }

  return `<ul class="inline-list">${ items.map(item => `<li>${ escapeHtml(item) }</li>`).join('') }</ul>`
}

const renderAlternateLinks = (links) => {
  if (!Array.isArray(links) || links.length === 0) {
    return '<span class="muted">-</span>'
  }

  return `<ul class="stack-list">${ links.map(link => `<li><strong>${ escapeHtml(link.hreflang) }</strong>: ${ escapeHtml(link.href || '-') }</li>`).join('') }</ul>`
}

const renderAlternateResources = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return '<span class="muted">-</span>'
  }

  return `<ul class="stack-list">${ items.map((item) => {
    const labelParts = [ item.rel || 'alternate' ]

    if (item.hreflang) {
      labelParts.push(`hreflang=${ item.hreflang }`)
    }

    if (item.type) {
      labelParts.push(item.type)
    }

    if (item.title) {
      labelParts.push(item.title)
    }

    return `<li><strong>${ escapeHtml(labelParts.join(' | ')) }</strong>: ${ escapeHtml(item.href || '-') }</li>`
  }).join('') }</ul>`
}

const renderIconLinks = (icons) => {
  if (!Array.isArray(icons) || icons.length === 0) {
    return '<span class="muted">-</span>'
  }

  return `<ul class="stack-list">${ icons.map((icon) => {
    const labelParts = [ icon.rel || 'icon' ]

    if (icon.type) {
      labelParts.push(icon.type)
    }

    if (icon.sizes) {
      labelParts.push(icon.sizes)
    }

    return `<li><strong>${ escapeHtml(labelParts.join(' | ')) }</strong>: ${ escapeHtml(icon.href || '-') }</li>`
  }).join('') }</ul>`
}

const renderHeadDuplicates = (duplicates) => {
  if (!Array.isArray(duplicates) || duplicates.length === 0) {
    return '<p class="muted">No duplicate head signals found.</p>'
  }

  return `<ul class="stack-list">${ duplicates.map(duplicate =>
    `<li><strong>${ escapeHtml(duplicate.label || duplicate.key || 'unknown') }</strong>: ${ escapeHtml(duplicate.count) }</li>`
  ).join('') }</ul>`
}

const renderJsonLdBlocks = (blocks) => {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return '<span class="muted">-</span>'
  }

  return `<ul class="stack-list">${ blocks.map(block => `
    <li>
      <strong>${ escapeHtml(block.hash || 'unknown') }</strong>: ${ escapeHtml(block.summary || 'Unknown JSON-LD block') }
      ${ block.preview ? `<div class="muted"><code>${ escapeHtml(block.preview) }</code></div>` : '' }
    </li>
  `).join('') }</ul>`
}

const renderRedirectChain = (redirectChain) => {
  if (!Array.isArray(redirectChain) || redirectChain.length === 0) {
    return '<span class="muted">-</span>'
  }

  return `<ol class="stack-list">${ redirectChain.map((step) => {
    const location = step.location ? ` -> ${ escapeHtml(step.location) }` : ''
    return `<li><code>${ escapeHtml(step.url) }</code> <strong>${ escapeHtml(step.status) }</strong>${ location }</li>`
  }).join('') }</ol>`
}

const renderIssues = (issues) => {
  if (!Array.isArray(issues) || issues.length === 0) {
    return '<p class="muted">No issues found.</p>'
  }

  return `<ul class="issue-list">${ issues.map(issue => `<li class="issue-row"><span>${ renderBadge(issue.code, issue.severity) }</span><span>${ escapeHtml(issue.message) }</span></li>`).join('') }</ul>`
}

const renderIssueBreakdown = (summary) => {
  if (summary.issueBreakdown.length === 0) {
    return '<p class="muted">No issue clusters yet.</p>'
  }

  return `<ul class="inline-list">${ summary.issueBreakdown.map(issue => `<li><strong>${ escapeHtml(issue.code) }</strong> (${ escapeHtml(issue.count) })</li>`).join('') }</ul>`
}

const renderSummaryCard = (value, label, tone = 'neutral') => {
  const toneClass = tone !== 'neutral' ? ` tone-${ tone }` : ''
  return `<article class="summary-card${ toneClass }"><strong>${ escapeHtml(value) }</strong><span>${ escapeHtml(label) }</span></article>`
}

const getHostname = (value) => {
  if (!value) {
    return null
  }

  try {
    return new URL(value).host || null
  } catch {
    return null
  }
}

const slugifyAnchorPart = (value) => {
  return String(value ?? '')
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

const getPageTitle = (page) => {
  return page.seo?.document.title
    || page.targetPath
    || page.input
    || page.finalUrl
    || page.requestedUrl
    || 'Untitled page'
}

const getPageNavLabel = (page) => {
  return page.targetPath
    || page.input
    || page.finalUrl
    || page.requestedUrl
    || getPageTitle(page)
}

const getSourceMeta = (sourceUrl, sourceLabel, fallbackUrl = null) => {
  const host = getHostname(sourceUrl || fallbackUrl)
  const badge = host || sourceLabel || null
  const display = host && sourceLabel && sourceLabel !== host
    ? `${ sourceLabel } (${ host })`
    : (host || sourceLabel || sourceUrl || null)

  return {
    key: sourceUrl || host || 'primary',
    url: sourceUrl,
    label: sourceLabel,
    host,
    badge,
    display,
  }
}

const getPageSourceMeta = (page) => {
  return getSourceMeta(
    page.source?.url ?? null,
    page.source?.label ?? null,
    page.finalUrl || page.requestedUrl,
  )
}

const getPageSourceDetails = (sourceMeta) => {
  if (!sourceMeta.display) {
    return null
  }

  if (sourceMeta.url && sourceMeta.display !== sourceMeta.url) {
    return `${ sourceMeta.display } · ${ sourceMeta.url }`
  }

  return sourceMeta.display
}

const buildPageAnchorId = (page, index) => {
  const slug = slugifyAnchorPart(getPageNavLabel(page))
  return slug
    ? `page-${ index + 1 }-${ slug }`
    : `page-${ index + 1 }`
}

const buildPageEntries = (pages) => {
  return pages.map((page, index) => {
    const source = getPageSourceMeta(page)

    return {
      anchorId: buildPageAnchorId(page, index),
      index,
      navLabel: getPageNavLabel(page),
      source,
      title: getPageTitle(page),
      variant: page.variant ?? null,
      page,
    }
  })
}

const buildSourceFilters = (entries, getSource) => {
  const filters = new Map()

  for (const entry of entries) {
    const source = getSource(entry)

    if (filters.has(source.key)) {
      filters.get(source.key).count += 1
      continue
    }

    filters.set(source.key, {
      key: source.key,
      label: source.display || source.badge || 'Primary source',
      count: 1,
    })
  }

  return [ ...filters.values() ]
}

const getComparisonNavLabel = (comparison) => {
  return comparison.targetPath
    || comparison.left?.finalUrl
    || comparison.left?.requestedUrl
    || comparison.right?.finalUrl
    || comparison.right?.requestedUrl
    || 'Untitled path'
}

const getComparisonDifferenceCount = (comparison) => {
  return comparison.differences.length +
    (comparison.issueDelta?.onlyOnLeft?.length ?? 0) +
    (comparison.issueDelta?.onlyOnRight?.length ?? 0)
}

const buildComparisonAnchorId = (comparison, index) => {
  const slug = slugifyAnchorPart(getComparisonNavLabel(comparison))

  return slug
    ? `comparison-${ index + 1 }-${ slug }`
    : `comparison-${ index + 1 }`
}

const buildComparisonEntries = (comparisons) => {
  return comparisons.map((comparison, index) => {
    const navLabel = getComparisonNavLabel(comparison)
    const diffCount = getComparisonDifferenceCount(comparison)
    const differenceKeys = [ ...new Set(comparison.differences.map(difference => difference.key)) ]

    return {
      anchorId: buildComparisonAnchorId(comparison, index),
      comparison,
      differenceKeys,
      diffCount,
      index,
      navLabel,
    }
  })
}

const renderComparisonBreakdown = (comparison) => {
  if (!comparison || comparison.differenceBreakdown.length === 0) {
    return '<p class="muted">No field-level differences detected.</p>'
  }

  return `<ul class="inline-list">${ comparison.differenceBreakdown.map(entry => `<li><strong>${ escapeHtml(entry.label) }</strong> (${ escapeHtml(entry.count) })</li>`).join('') }</ul>`
}

const renderValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '<span class="muted">-</span>'
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '<span class="muted">-</span>'
    }

    return `<ul class="stack-list">${ value.map(item => `<li>${ escapeHtml(item) }</li>`).join('') }</ul>`
  }

  return escapeHtml(value)
}

const renderDiffValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '<span class="muted">—</span>'
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? '<span class="muted">—</span>' : escapeHtml(value.join(', '))
  }
  return escapeHtml(String(value))
}

const renderIssueDelta = (issueDelta, comparison) => {
  if (!issueDelta || (!issueDelta.onlyOnLeft.length && !issueDelta.onlyOnRight.length)) {
    return ''
  }

  const leftBadges = issueDelta.onlyOnLeft.map(code =>
    `<span class="diff-issue-badge diff-issue-left">${ escapeHtml(code) } (${ escapeHtml(comparison.left.label) } only)</span>`
  )
  const rightBadges = issueDelta.onlyOnRight.map(code =>
    `<span class="diff-issue-badge diff-issue-right">${ escapeHtml(code) } (${ escapeHtml(comparison.right.label) } only)</span>`
  )

  return `
    <div class="diff-inline-row">
      <span class="diff-inline-label">Issues delta</span>
      <div class="diff-issue-badges">${ [ ...leftBadges, ...rightBadges ].join('') }</div>
    </div>
  `
}

const renderComparisonDifferences = (comparison) => {
  return comparison.differences.map(difference => `
    <div class="diff-inline-row">
      <span class="diff-inline-label">${ escapeHtml(difference.label) }</span>
      <span class="diff-inline-old">${ renderDiffValue(difference.left) }</span>
      <span class="diff-arrow">→</span>
      <span class="diff-inline-new">${ renderDiffValue(difference.right) }</span>
    </div>
  `).join('')
}

const getComparisonSideTone = (side) => {
  if (!side.status) return 'neutral'
  if (side.status >= 500) return 'error'
  if (side.status >= 400) return 'warning'
  if (side.status >= 300) return 'info'
  return 'success'
}

const renderComparisonIndexItem = (entry) => {
  const leftUrl = entry.comparison.left.finalUrl || entry.comparison.left.requestedUrl || '-'
  const rightUrl = entry.comparison.right.finalUrl || entry.comparison.right.requestedUrl || '-'
  const metaParts = [
    `${ entry.comparison.left.label } → ${ entry.comparison.right.label }`,
    `status ${ entry.comparison.left.status ?? 'n/a' } → ${ entry.comparison.right.status ?? 'n/a' }`,
    `${ entry.diffCount } difference${ entry.diffCount !== 1 ? 's' : '' }`,
  ].filter(Boolean)

  return `
    <a
      class="page-index-link"
      href="#${ escapeHtml(entry.anchorId) }"
      data-comparison-link
      data-nav-link
      data-nav-tab="comparison"
      data-nav-anchor="${ escapeHtml(entry.anchorId) }"
      data-difference-keys="${ escapeHtml(entry.differenceKeys.join('|')) }"
      title="${ escapeHtml(`${ leftUrl } → ${ rightUrl }`) }"
    >
      <strong>${ escapeHtml(entry.navLabel) }</strong>
      <span class="page-index-title">${ escapeHtml(`${ leftUrl } → ${ rightUrl }`) }</span>
      <span class="page-index-meta">${ escapeHtml(metaParts.join(' · ')) }</span>
    </a>
  `
}

const renderComparisonCard = (entry) => {
  const { comparison, anchorId, diffCount, navLabel } = entry
  const leftUrl = comparison.left.finalUrl || comparison.left.requestedUrl || '-'
  const rightUrl = comparison.right.finalUrl || comparison.right.requestedUrl || '-'

  return `
    <section
      class="page-card"
      id="${ escapeHtml(anchorId) }"
      data-comparison-card
      data-nav-card
      data-nav-tab="comparison"
      data-difference-keys="${ escapeHtml(entry.differenceKeys.join('|')) }"
    >
      <header class="page-card-header">
        <div class="page-card-title">
          <h2>${ escapeHtml(navLabel) }</h2>
          <p class="page-url"><code>${ escapeHtml(leftUrl) }</code> → <code>${ escapeHtml(rightUrl) }</code></p>
        </div>
        <div class="badge-row">
          ${ renderBadge(`${ comparison.left.label } ${ comparison.left.status ?? 'n/a' }`, getComparisonSideTone(comparison.left)) }
          ${ renderBadge(`${ comparison.right.label } ${ comparison.right.status ?? 'n/a' }`, getComparisonSideTone(comparison.right)) }
          ${ renderBadge(`${ diffCount } difference${ diffCount !== 1 ? 's' : '' }`, 'warning') }
        </div>
      </header>

      <div class="diff-inline-list">
        ${ renderComparisonDifferences(comparison) }
        ${ renderIssueDelta(comparison.issueDelta, comparison) }
      </div>
    </section>
  `
}

const getStatusTone = (page) => {
  if (page.error) {
    return 'error'
  }

  if (!page.status) {
    return 'neutral'
  }

  if (page.status >= 500) {
    return 'error'
  }

  if (page.status >= 400) {
    return 'warning'
  }

  if (page.status >= 300) {
    return 'info'
  }

  return 'neutral'
}

const renderPageIndexItem = (entry) => {
  const statusLabel = entry.page.error ? 'error' : `status ${ entry.page.status ?? 'n/a' }`
  const metaParts = [
    entry.source.badge,
    entry.variant,
    statusLabel,
  ].filter(Boolean)

  return `
    <a
      class="page-index-link"
      href="#${ escapeHtml(entry.anchorId) }"
      data-page-link
      data-nav-link
      data-nav-tab="pages"
      data-page-anchor="${ escapeHtml(entry.anchorId) }"
      data-nav-anchor="${ escapeHtml(entry.anchorId) }"
      data-source-key="${ escapeHtml(entry.source.key) }"
      data-variant="${ escapeHtml(entry.variant ?? '') }"
      title="${ escapeHtml(entry.title) }"
    >
      <strong>${ escapeHtml(entry.navLabel) }</strong>
      ${ entry.title !== entry.navLabel ? `<span class="page-index-title">${ escapeHtml(entry.title) }</span>` : '' }
      <span class="page-index-meta">${ escapeHtml(metaParts.join(' · ')) }</span>
    </a>
  `
}

const renderPageCard = (entry) => {
  const { page, anchorId, source, title } = entry
  const statusTone = getStatusTone(page)
  const issuesTone = page.issues.length > 0
    ? getHighestSeverity(page.issues)
    : 'success'
  const robotsBadgeValue = page.seo?.meta.robots || page.headers.xRobotsTag || null
  const rawJson = escapeHtml(JSON.stringify(page, null, 2))

  return `
    <section
      class="page-card report-page-card"
      id="${ escapeHtml(anchorId) }"
      data-page-card
      data-nav-card
      data-nav-tab="pages"
      data-source-key="${ escapeHtml(source.key) }"
    >
      <header class="page-card-header">
        <div class="page-card-title">
          <h2>${ escapeHtml(title) }</h2>
          <p class="page-url"><code>${ escapeHtml(page.finalUrl || page.requestedUrl) }</code></p>
        </div>
        <div class="badge-row">
          ${ source.badge ? renderBadge(source.badge, 'info') : '' }
          ${ page.variant ? renderBadge(page.variant, 'neutral') : '' }
          ${ renderBadge(page.error ? 'error' : `status ${ page.status ?? 'n/a' }`, statusTone) }
          ${ page.redirectChain.length > 1 ? renderBadge(`redirects ${ page.redirectChain.length - 1 }`, 'neutral') : '' }
          ${ page.issues.length > 0 ? renderBadge(`issues ${ page.issues.length }`, issuesTone) : renderBadge('clean', 'success') }
          ${ robotsBadgeValue ? renderBadge(robotsBadgeValue, robotsBadgeValue.toLowerCase().includes('noindex') ? 'warning' : 'neutral') : '' }
        </div>
      </header>

      ${ page.error ? `<p class="error-text">${ escapeHtml(page.error) }</p>` : '' }
      ${ page.parseSkippedReason ? `<p class="muted">${ escapeHtml(page.parseSkippedReason) }</p>` : '' }

      <div class="subsection">
        <h3>Audit Issues</h3>
        ${ renderIssues(page.issues) }
      </div>

      <dl class="kv-grid">
        ${ renderKeyValueRow('Target Path', page.targetPath) }
        ${ renderKeyValueRow('Source', getPageSourceDetails(source)) }
        ${ renderKeyValueRow('Requested URL', page.requestedUrl) }
        ${ renderKeyValueRow('Final URL', page.finalUrl) }
        ${ renderKeyValueRow('Content-Type', page.headers.contentType) }
        ${ renderKeyValueRow('Content-Length', page.headers.contentLength) }
        ${ renderKeyValueRow('Charset', page.seo?.meta.charset) }
        ${ renderKeyValueRow('Title', page.seo?.document.title) }
        ${ renderKeyValueRow('Description', page.seo?.meta.description) }
        ${ renderKeyValueRow('Meta robots', page.seo?.meta.robots) }
        ${ renderKeyValueRow('X-Robots-Tag', page.headers.xRobotsTag) }
        ${ renderKeyValueRow('Link header', page.headers.link) }
        ${ renderKeyValueRow('Canonical', page.seo?.links.canonical) }
        ${ renderKeyValueRow('Header canonical', page.headers?.links?.canonical) }
        ${ renderKeyValueRow('Header llms', page.headers?.links?.llms) }
        ${ renderKeyValueRow('Lang', page.seo?.document.lang) }
        ${ renderKeyValueRow('Content-Language', page.seo?.document.contentLanguage) }
        ${ renderKeyValueRow('Viewport', page.seo?.meta.viewport) }
        ${ renderKeyValueRow('Application name', page.seo?.meta.applicationName) }
        ${ renderKeyValueRow('Theme color', page.seo?.meta.themeColor) }
        ${ renderKeyValueRow('Manifest', page.seo?.links.manifest) }
        ${ renderKeyValueRow('Favicon', page.seo?.links.favicon) }
        ${ renderKeyValueRow('Prev', page.seo?.links.prev) }
        ${ renderKeyValueRow('Next', page.seo?.links.next) }
        ${ renderKeyValueRow('OpenGraph type', page.seo?.meta.openGraph.type) }
        ${ renderKeyValueRow('OpenGraph site name', page.seo?.meta.openGraph.siteName) }
        ${ renderKeyValueRow('OpenGraph locale', page.seo?.meta.openGraph.locale) }
        ${ renderKeyValueRow('OpenGraph URL', page.seo?.meta.openGraph.url) }
        ${ renderKeyValueRow('OpenGraph Image', page.seo?.meta.openGraph.image) }
        ${ renderKeyValueRow('OpenGraph Image Alt', page.seo?.meta.openGraph.imageAlt) }
        ${ renderKeyValueRow('OpenGraph Video', page.seo?.meta.openGraph.video) }
        ${ renderKeyValueRow('Twitter URL', page.seo?.meta.twitter.url) }
        ${ renderKeyValueRow('Twitter Image', page.seo?.meta.twitter.image) }
        ${ renderKeyValueRow('Twitter Image Alt', page.seo?.meta.twitter.imageAlt) }
        ${ renderKeyValueRow('Apple iTunes app', page.seo?.meta.appleItunesApp) }
        ${ renderKeyValueRow('iOS deep link', page.seo?.meta.appLinks?.iosUrl) }
        ${ renderKeyValueRow('iOS App Store ID', page.seo?.meta.appLinks?.iosAppStoreId) }
        ${ renderKeyValueRow('Android deep link', page.seo?.meta.appLinks?.androidUrl) }
        ${ renderKeyValueRow('Android package', page.seo?.meta.appLinks?.androidPackage) }
        ${ renderKeyValueRow('Android app store URL', page.seo?.meta.appLinks?.androidAppStoreUrl) }
      </dl>

      <div class="subsection">
        <h3>H1</h3>
        ${ renderList(page.seo?.document.h1) }
      </div>

      <div class="subsection">
        <h3>hreflang</h3>
        ${ renderAlternateLinks(page.seo?.links.alternates) }
      </div>

      <div class="subsection">
        <h3>Alternate Resources</h3>
        ${ renderAlternateResources(page.seo?.links.alternateResources) }
      </div>

      <div class="subsection">
        <h3>Response Link Header</h3>
        ${ renderAlternateResources(page.headers?.links?.entries) }
      </div>

      <div class="subsection">
        <h3>Icons</h3>
        ${ renderIconLinks(page.seo?.links.icons) }
      </div>

      <div class="subsection">
        <h3>OpenGraph Locale Alternates</h3>
        ${ renderList(page.seo?.meta.openGraph.localeAlternates) }
      </div>

      <div class="subsection">
        <h3>JSON-LD types</h3>
        ${ renderList(page.seo?.jsonLd.types) }
        <div class="kv-grid">
          ${ renderKeyValueRow('Has WebSite', page.seo?.jsonLd?.hasWebSite === undefined ? null : String(Boolean(page.seo?.jsonLd?.hasWebSite))) }
          ${ renderKeyValueRow('Has Organization', page.seo?.jsonLd?.hasOrganization === undefined ? null : String(Boolean(page.seo?.jsonLd?.hasOrganization))) }
        </div>
      </div>

      <div class="subsection">
        <h3>JSON-LD blocks</h3>
        ${ renderJsonLdBlocks(page.seo?.jsonLd?.blocks) }
      </div>

      <div class="subsection">
        <h3>Head duplicates</h3>
        ${ renderHeadDuplicates(page.seo?.head?.duplicates) }
      </div>

      <div class="subsection">
        <h3>Redirect chain</h3>
        ${ renderRedirectChain(page.redirectChain) }
      </div>

      <details class="raw-details">
        <summary>Raw JSON</summary>
        <pre>${ rawJson }</pre>
      </details>
    </section>
  `
}

const renderIndexFilter = ({
  filters,
  totalCount,
  allLabel,
  fieldLabel = 'Domain',
  filterDataAttr,
  filterAriaLabel,
}) => {
  if (!filters.length) {
    return ''
  }

  return `
    <label class="field-group">
      <span class="field-label">${ escapeHtml(fieldLabel) }</span>
      <select class="field-select" ${ filterDataAttr } aria-label="${ escapeHtml(filterAriaLabel) }">
        <option value="all">${ escapeHtml(allLabel) } (${ totalCount })</option>
        ${ filters.map(filter => `<option value="${ escapeHtml(filter.key) }">${ escapeHtml(filter.label) } (${ escapeHtml(filter.count) })</option>`).join('') }
      </select>
    </label>
  `
}

const renderIndexedSection = ({
  cardsHtml,
  description,
  emptyDataAttr,
  emptyHidden = true,
  emptyMessage,
  filterAriaLabel,
  filterDataAttr,
  filters = [],
  itemsHtml,
  navAriaLabel,
  title,
  totalCount,
  visibleCountDataAttr,
  visibleLabel,
}) => {
  return `
    <section class="pages-shell">
      <aside class="page-card pages-sidebar">
        <div class="pages-sidebar-header">
          <h3>${ escapeHtml(title) }</h3>
          <p class="muted">${ escapeHtml(description) }</p>
        </div>

        ${ renderIndexFilter({
          filters,
          totalCount,
          allLabel: visibleLabel.all,
          filterDataAttr,
          filterAriaLabel,
        }) }

        <div class="pages-counter-row">
          <p class="pages-counter muted"><span ${ visibleCountDataAttr }>${ totalCount }</span> of ${ totalCount } ${ escapeHtml(visibleLabel.items) } shown</p>
        </div>

        <nav class="page-index-nav" aria-label="${ escapeHtml(navAriaLabel) }">
          ${ itemsHtml }
        </nav>
      </aside>

      <div class="pages-content">
        <p class="page-index-empty muted${ emptyHidden ? ' hidden' : '' }" ${ emptyDataAttr }>${ escapeHtml(emptyMessage) }</p>
        ${ cardsHtml }
      </div>
    </section>
  `
}

const renderComparisonVariantGroupedCards = (comparisonEntries, variantLabels) => {
  return variantLabels.map((variantLabel) => {
    const groupEntries = comparisonEntries.filter(e => e.comparison.variant === variantLabel)

    if (groupEntries.length === 0) {
      return ''
    }

    return `
      <details class="variant-group" open>
        <summary class="variant-group-title">${ escapeHtml(variantLabel) }</summary>
        <section class="page-list">${ groupEntries.map(renderComparisonCard).join('') }</section>
      </details>
    `
  }).join('')
}

const renderComparisonTab = (comparison) => {
  const withDiffs = comparison.comparisons.filter(c =>
    c.differences.length > 0 ||
    (c.issueDelta && (c.issueDelta.onlyOnLeft.length || c.issueDelta.onlyOnRight.length))
  )
  const comparisonEntries = buildComparisonEntries(withDiffs)
  const hasVariants = Boolean(comparison.variants?.length)
  const comparisonProblemFilter = renderIndexFilter({
    filters: comparison.differenceBreakdown,
    totalCount: comparisonEntries.length,
    allLabel: 'All problems',
    fieldLabel: 'Problem',
    filterDataAttr: 'data-comparison-difference-filter',
    filterAriaLabel: 'Filter changed paths by problem',
  })

  const cardsHtml = comparisonEntries.length > 0
    ? (hasVariants
      ? renderComparisonVariantGroupedCards(comparisonEntries, comparison.variants)
      : `<section class="page-list">${ comparisonEntries.map(renderComparisonCard).join('') }</section>`)
    : ''

  return `
    <section class="summary-grid">
      ${ renderSummaryCard(comparison.targetCount, 'Compared paths') }
      ${ renderSummaryCard(comparison.targetsWithDifferences, 'Paths with differences', comparison.targetsWithDifferences > 0 ? 'warning' : 'neutral') }
      ${ renderSummaryCard(comparison.totalDifferences, 'Total field differences', comparison.totalDifferences > 0 ? 'warning' : 'neutral') }
    </section>

    <section class="page-card">
      <div class="subsection">
        <h3>Difference Breakdown</h3>
        ${ renderComparisonBreakdown(comparison) }
      </div>
      ${ comparisonProblemFilter ? `
        <div class="subsection">
          ${ comparisonProblemFilter }
          <p class="muted">Show only paths affected by the selected problem.</p>
        </div>
      ` : '' }
    </section>

    ${ renderIndexedSection({
      cardsHtml,
      description: 'Jump to any changed path. Each card shows the concrete left and right URL for that page.',
      emptyDataAttr: 'data-comparison-empty',
      emptyHidden: comparisonEntries.length > 0,
      emptyMessage: comparisonEntries.length > 0
        ? 'No changed paths match the selected problem.'
        : 'No differences found between the two sources.',
      itemsHtml: hasVariants
        ? renderVariantGroupedNavItems(comparisonEntries, e => e.comparison.variant, renderComparisonIndexItem)
        : comparisonEntries.map(renderComparisonIndexItem).join(''),
      navAriaLabel: 'Comparison navigation',
      title: 'Comparison Index',
      totalCount: comparisonEntries.length,
      visibleCountDataAttr: 'data-comparison-visible-count',
      visibleLabel: {
        all: 'All paths',
        items: 'changed paths',
      },
    }) }
  `
}

const renderVariantGroupedNavItems = (entries, getVariant, renderItem) => {
  const groups = new Map()

  for (const entry of entries) {
    const key = getVariant(entry) ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(entry)
  }

  return [ ...groups.entries() ].map(([ variantLabel, groupEntries ]) => `
    <details class="nav-variant-group" open>
      <summary class="nav-variant-label">${ escapeHtml(variantLabel || 'Default') }</summary>
      <div class="nav-variant-items">${ groupEntries.map(renderItem).join('') }</div>
    </details>
  `).join('')
}

const buildVariantGroups = (entries) => {
  const groups = new Map()

  for (const entry of entries) {
    const key = entry.variant ?? ''

    if (!groups.has(key)) {
      groups.set(key, [])
    }

    groups.get(key).push(entry)
  }

  return groups
}

const renderVariantGroupedCards = (pageEntries) => {
  const groups = buildVariantGroups(pageEntries)

  return [ ...groups.entries() ].map(([ variantLabel, entries ]) => `
    <details class="variant-group" open>
      <summary class="variant-group-title">${ escapeHtml(variantLabel || 'Default') }</summary>
      <section class="page-list">${ entries.map(renderPageCard).join('') }</section>
    </details>
  `).join('')
}

const renderPagesTab = (pageEntries, comparison) => {
  const hasVariants = pageEntries.some(entry => entry.variant !== null)
  const sourceFilters = comparison ? buildSourceFilters(pageEntries, entry => entry.source) : []

  const cardsHtml = hasVariants
    ? renderVariantGroupedCards(pageEntries)
    : `<section class="page-list">${ pageEntries.map(renderPageCard).join('') }</section>`

  return renderIndexedSection({
    cardsHtml,
    description: comparison
      ? 'Jump to any page card. Comparison mode also lets you filter by source domain.'
      : 'Jump to any page card. Use the anchor list to move through long reports faster.',
    emptyDataAttr: 'data-pages-empty',
    emptyHidden: true,
    emptyMessage: 'No pages match the selected domain.',
    filterAriaLabel: 'Filter pages by domain',
    filterDataAttr: 'data-page-domain-filter',
    filters: sourceFilters,
    itemsHtml: hasVariants
      ? renderVariantGroupedNavItems(pageEntries, e => e.variant, renderPageIndexItem)
      : pageEntries.map(renderPageIndexItem).join(''),
    navAriaLabel: 'Pages navigation',
    title: 'Page Index',
    totalCount: pageEntries.length,
    visibleCountDataAttr: 'data-pages-visible-count',
    visibleLabel: {
      all: 'All domains',
      items: 'pages',
    },
  })
}

export const renderHtmlReport = (report) => {
  const summary = report.summary ?? buildSummary(report.pages)
  const comparison = report.comparison ?? null
  const pageEntries = buildPageEntries(report.pages)
  const generatedAtLabel = new Date(report.generatedAt).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
  const defaultTab = comparison ? 'comparison' : 'overview'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SEO Snapshot ${ escapeHtml(generatedAtLabel) }</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --bg-elevated: #111111;
      --bg-muted: #151515;
      --bg-code: #0f0f0f;
      --border: #2a2a2a;
      --border-strong: #3a3a3a;
      --text: #f1f1f1;
      --muted: #a1a1a1;
      --tone-strong: #d4d4d4;
      --tone-soft: #b8b8b8;
      --success: #34d399;
      --warning: #fbbf24;
      --error: #f87171;
      --info: #60a5fa;
      --shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
    }
    html { scroll-behavior: smooth; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      line-height: 1.55;
      background: linear-gradient(180deg, #0d0d0d 0%, var(--bg) 100%);
      min-height: 100vh;
    }
    main {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 1280px;
      margin: 0 auto;
      padding: 28px 20px 56px;
    }
    h1, h2, h3, p { margin: 0; }
    code {
      word-break: break-word;
      font-family: "IBM Plex Mono", "SFMono-Regular", "Consolas", monospace;
    }
    .page-header {
      padding: 24px;
      border: 1px solid var(--border);
      border-radius: 24px;
      background: rgba(17, 17, 17, 0.92);
      box-shadow: var(--shadow);
      display: grid;
      gap: 12px;
    }
    .page-header-top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .eyebrow::before {
      content: "";
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--tone-soft);
    }
    .page-header h1 {
      font-size: clamp(34px, 5vw, 54px);
      line-height: 0.94;
      letter-spacing: -0.05em;
      font-weight: 650;
    }
    .page-header p,
    .header-time {
      color: var(--muted);
    }
    .page-header-description {
      max-width: 760px;
    }
    .header-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .header-meta-item {
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--bg-muted);
      display: grid;
      gap: 4px;
    }
    .header-meta-item strong {
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .tab-nav {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--border);
    }
    .tab-btn {
      padding: 10px 20px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      color: var(--muted);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      letter-spacing: 0.01em;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active {
      color: var(--text);
      border-bottom-color: var(--info);
      font-weight: 600;
    }
    .hidden { display: none !important; }
    .tab-panel { display: contents; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
    }
    .summary-card, .page-card {
      border: 1px solid var(--border);
      border-radius: 20px;
      background: rgba(17, 17, 17, 0.94);
      box-shadow: var(--shadow);
    }
    .summary-card {
      padding: 18px;
    }
    .summary-card strong {
      display: block;
      font-size: 30px;
      line-height: 1;
      margin-bottom: 8px;
      font-weight: 650;
      letter-spacing: -0.04em;
    }
    .summary-card span {
      color: var(--muted);
    }
    .summary-card.tone-error strong { color: var(--error); }
    .summary-card.tone-warning strong { color: var(--warning); }
    .summary-card.tone-success strong { color: var(--success); }
    .summary-card.tone-info strong { color: var(--info); }
    .page-list {
      display: grid;
      gap: 14px;
    }
    .variant-group {
      display: grid;
      gap: 14px;
    }
    .variant-group + .variant-group {
      margin-top: 8px;
    }
    .variant-group-title {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      padding: 8px 0 6px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--bg);
    }
    .variant-group-title::-webkit-details-marker {
      display: none;
    }
    .variant-group-title::after {
      content: '▾';
      font-size: 0.85em;
      color: var(--muted);
      transition: transform 200ms ease;
      flex-shrink: 0;
      margin-left: 8px;
    }
    details.variant-group:not([open]) > .variant-group-title::after {
      transform: rotate(-90deg);
    }
    .report-page-card {
      scroll-margin-top: 24px;
    }
    .page-card {
      padding: 22px;
    }
    .page-card-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 18px;
    }
    .page-card-title {
      display: grid;
      gap: 6px;
    }
    .page-card-header h2 {
      font-size: 22px;
      line-height: 1.15;
      letter-spacing: -0.02em;
      word-break: break-word;
    }
    .page-url {
      color: var(--muted);
      word-break: break-word;
    }
    .page-url code {
      color: var(--tone-strong);
    }
    .badge-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.03em;
      white-space: nowrap;
      border: 1px solid var(--border-strong);
      background: var(--bg-muted);
      color: var(--tone-strong);
    }
    .badge-success {
      background: rgba(52, 211, 153, 0.12);
      border-color: rgba(52, 211, 153, 0.28);
      color: var(--success);
    }
    .badge-warning {
      background: rgba(251, 191, 36, 0.12);
      border-color: rgba(251, 191, 36, 0.28);
      color: var(--warning);
    }
    .badge-error {
      background: rgba(248, 113, 113, 0.12);
      border-color: rgba(248, 113, 113, 0.28);
      color: var(--error);
    }
    .badge-info {
      background: rgba(96, 165, 250, 0.12);
      border-color: rgba(96, 165, 250, 0.28);
      color: var(--info);
    }
    .badge-neutral {
      background: #181818;
      border-color: var(--border-strong);
      color: var(--tone-strong);
    }
    .pages-shell {
      display: grid;
      grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .pages-sidebar {
      position: sticky;
      top: 20px;
      display: grid;
      gap: 16px;
      padding: 18px;
    }
    .pages-sidebar-header {
      display: grid;
      gap: 8px;
    }
    .field-group {
      display: grid;
      gap: 8px;
    }
    .field-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .field-select {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--bg-muted);
      color: var(--text);
      font: inherit;
    }
    .pages-counter {
      font-size: 13px;
    }
    .pages-counter-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .page-index-nav {
      display: grid;
      gap: 8px;
      max-height: calc(100vh - 220px);
      overflow: auto;
      padding-right: 4px;
    }
    .nav-variant-group {
      display: block;
    }
    .nav-variant-items {
      display: grid;
      gap: 8px;
      padding-top: 8px;
    }
    .nav-variant-group + .nav-variant-group {
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }
    .nav-variant-label {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      padding: 4px 4px 6px;
      cursor: pointer;
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      position: sticky;
      top: 0;
      z-index: 1;
      background: rgb(17, 17, 17);
    }
    .nav-variant-label::-webkit-details-marker {
      display: none;
    }
    .nav-variant-label::after {
      content: '▾';
      font-size: 0.85em;
      transition: transform 200ms ease;
      flex-shrink: 0;
      margin-left: 6px;
    }
    details.nav-variant-group:not([open]) > .nav-variant-label::after {
      transform: rotate(-90deg);
    }
    .page-index-link {
      display: grid;
      gap: 4px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--bg-muted);
      color: inherit;
      text-decoration: none;
      transition: border-color 120ms ease, transform 120ms ease, background 120ms ease;
    }
    .page-index-link:hover {
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }
    .page-index-link.active {
      border-color: rgba(96, 165, 250, 0.38);
      background: rgba(96, 165, 250, 0.08);
    }
    .page-index-link strong {
      font-size: 14px;
      line-height: 1.3;
      word-break: break-word;
    }
    .page-index-title,
    .page-index-meta {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
      word-break: break-word;
    }
    .pages-content {
      display: grid;
      gap: 14px;
    }
    .page-index-empty {
      padding: 12px 2px 0;
    }
    .kv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    .kv-row {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--bg-muted);
    }
    .kv-row dt {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .kv-row dd {
      margin: 0;
      word-break: break-word;
    }
    .subsection:not(:only-child) {
      margin-top: 16px;
    }
    .subsection h3 {
      font-size: 13px;
      margin-bottom: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .stack-list, .inline-list, .issue-list {
      margin: 0;
      padding-left: 20px;
    }
    .inline-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 14px;
      padding-left: 0;
      list-style: none;
    }
    .inline-list li {
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-muted);
    }
    .issue-list {
      display: grid;
      gap: 10px;
      padding-left: 0;
      list-style: none;
    }
    .issue-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: start;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--bg-muted);
      border: 1px solid var(--border);
    }
    .muted {
      color: var(--muted);
    }
    .error-text {
      color: var(--error);
      margin-bottom: 12px;
      font-weight: 600;
    }
    .raw-details {
      margin-top: 16px;
    }
    .raw-details summary {
      cursor: pointer;
      color: var(--muted);
      font-weight: 600;
    }
    .raw-details pre {
      margin: 12px 0 0;
      padding: 16px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--bg-code);
      color: var(--tone-strong);
      font-size: 12px;
    }
    .diff-inline-list {
      display: grid;
    }
    .diff-inline-row {
      display: grid;
      grid-template-columns: 130px 1fr auto 1fr;
      gap: 10px;
      align-items: start;
      padding: 10px 14px;
      border-top: 1px solid var(--border);
      font-size: 13px;
    }
    .diff-inline-row:first-child { border-top: none; }
    .diff-inline-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      padding-top: 3px;
    }
    .diff-inline-old {
      text-decoration: line-through;
      color: var(--muted);
      word-break: break-word;
    }
    .diff-arrow {
      color: var(--muted);
      padding-top: 2px;
      font-size: 12px;
    }
    .diff-inline-new {
      background: rgba(52, 211, 153, 0.1);
      color: var(--success);
      padding: 2px 8px;
      border-radius: 4px;
      word-break: break-word;
    }
    .diff-issue-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      grid-column: 2 / -1;
    }
    .diff-issue-badge {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
    }
    .diff-issue-left {
      background: rgba(96, 165, 250, 0.1);
      border-color: rgba(96, 165, 250, 0.2);
      color: var(--info);
    }
    .diff-issue-right {
      background: rgba(248, 113, 113, 0.1);
      border-color: rgba(248, 113, 113, 0.2);
      color: var(--error);
    }
    .scroll-top-btn {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 20;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 48px;
      min-height: 48px;
      padding: 0 16px;
      border-radius: 999px;
      border: 1px solid rgba(96, 165, 250, 0.32);
      background: rgba(17, 17, 17, 0.92);
      color: var(--text);
      box-shadow: var(--shadow);
      cursor: pointer;
      font: inherit;
      transition: transform 120ms ease, opacity 120ms ease, border-color 120ms ease;
    }
    .scroll-top-btn:hover {
      transform: translateY(-1px);
      border-color: rgba(96, 165, 250, 0.48);
    }
    .scroll-top-btn.hidden {
      opacity: 0;
      pointer-events: none;
    }
    @media (max-width: 1040px) {
      .pages-shell {
        grid-template-columns: 1fr;
      }
      .pages-sidebar {
        position: static;
      }
      .page-index-nav {
        max-height: 320px;
      }
    }
    @media (max-width: 720px) {
      main { padding: 16px 14px 40px; }
      .page-card-header { flex-direction: column; }
      .badge-row { justify-content: flex-start; }
      .page-header { padding: 20px; }
      .diff-inline-row { grid-template-columns: 1fr; }
      .diff-issue-badges { grid-column: 1; }
      .page-index-nav {
        max-height: none;
      }
    }
  </style>
</head>
<body>
  <main>
    <header class="page-header">
      <div class="page-header-top">
        <span class="eyebrow">Minimal Audit View</span>
        <span class="header-time">${ escapeHtml(generatedAtLabel) }</span>
      </div>
      <h1>SEO Snapshot</h1>
      <p class="page-header-description">A compact crawl report for status codes, indexation signals, metadata coverage, and page-level SEO issues.</p>
      <div class="header-meta">
        <div class="header-meta-item">
          <strong>Config</strong>
          <code>${ escapeHtml(report.options.configPath) }</code>
        </div>
        <div class="header-meta-item">
          <strong>${ comparison ? 'Compare' : 'Base URL' }</strong>
          <code>${ comparison ? escapeHtml(comparison.sources.map(source => source.label).join(' vs ')) : escapeHtml(report.options.baseUrl || '-') }</code>
        </div>
        <div class="header-meta-item">
          <strong>${ comparison ? 'Requests' : 'Targets' }</strong>
          <code>${ escapeHtml(report.options.targetCount) }</code>
        </div>
        <div class="header-meta-item">
          <strong>Formats</strong>
          <code>${ escapeHtml(report.options.formats.join(', ')) }</code>
        </div>
      </div>
      <details class="raw-details">
        <summary>Full config</summary>
        <dl class="kv-grid" style="margin-top: 12px;">
          <div class="kv-row"><dt>Timeout</dt><dd>${ escapeHtml(report.options.timeoutMs) } ms</dd></div>
          <div class="kv-row"><dt>Max redirects</dt><dd>${ escapeHtml(report.options.maxRedirects) }</dd></div>
          <div class="kv-row"><dt>Concurrency</dt><dd>${ escapeHtml(report.options.concurrency) }</dd></div>
          <div class="kv-row"><dt>User-Agent</dt><dd><code>${ escapeHtml(report.options.userAgent || '-') }</code></dd></div>
          <div class="kv-row"><dt>Output dir</dt><dd><code>${ escapeHtml(report.options.outputDir) }</code></dd></div>
          ${ report.options.audit ? `
          <div class="kv-row"><dt>Min title length</dt><dd>${ escapeHtml(report.options.audit.minTitleLength) }</dd></div>
          <div class="kv-row"><dt>Max title length</dt><dd>${ escapeHtml(report.options.audit.maxTitleLength) }</dd></div>
          <div class="kv-row"><dt>Min description length</dt><dd>${ escapeHtml(report.options.audit.minDescriptionLength) }</dd></div>
          <div class="kv-row"><dt>Max description length</dt><dd>${ escapeHtml(report.options.audit.maxDescriptionLength) }</dd></div>
          <div class="kv-row"><dt>Min body text length</dt><dd>${ escapeHtml(report.options.audit.minBodyTextLength) }</dd></div>
          ` : '' }
        </dl>
      </details>
    </header>

    <nav class="tab-nav">
      <button class="${ defaultTab === 'overview' ? 'tab-btn active' : 'tab-btn' }" data-tab="overview">Overview</button>
      ${ comparison ? `<button class="${ defaultTab === 'comparison' ? 'tab-btn active' : 'tab-btn' }" data-tab="comparison">Comparison</button>` : '' }
      <button class="tab-btn" data-tab="pages">Pages</button>
    </nav>

    <div class="tab-panel${ defaultTab !== 'overview' ? ' hidden' : '' }" id="tab-overview">
      <section class="summary-grid">
        ${ renderSummaryCard(summary.total, 'Total pages') }
        ${ renderSummaryCard(summary.pagesWithIssues, 'Pages with issues', summary.pagesWithIssues > 0 ? 'error' : 'success') }
        ${ renderSummaryCard(summary.totalIssues, 'Total issues', summary.totalIssues > 0 ? 'error' : 'success') }
        ${ renderSummaryCard(summary.failedPages, 'Failed pages', summary.failedPages > 0 ? 'error' : 'neutral') }
        ${ renderSummaryCard(summary.redirected, 'Redirected', summary.redirected > 0 ? 'info' : 'neutral') }
        ${ renderSummaryCard(summary.noindex, 'Noindex', summary.noindex > 0 ? 'warning' : 'neutral') }
        ${ renderSummaryCard(summary.severityCounts.error, 'Error issues', summary.severityCounts.error > 0 ? 'error' : 'neutral') }
        ${ renderSummaryCard(summary.severityCounts.warning, 'Warning issues', summary.severityCounts.warning > 0 ? 'warning' : 'neutral') }
      </section>

      ${ comparison ? `
        <section class="summary-grid">
          ${ renderSummaryCard(comparison.targetCount, 'Compared paths') }
          ${ renderSummaryCard(comparison.targetsWithDifferences, 'Paths with differences', comparison.targetsWithDifferences > 0 ? 'warning' : 'neutral') }
          ${ renderSummaryCard(comparison.totalDifferences, 'Total field differences', comparison.totalDifferences > 0 ? 'warning' : 'neutral') }
        </section>
      ` : '' }

      <section class="page-card">
        <div class="subsection">
          <h3>Issue Breakdown</h3>
          ${ renderIssueBreakdown(summary) }
        </div>
      </section>
    </div>

    ${ comparison ? `
      <div class="tab-panel${ defaultTab !== 'comparison' ? ' hidden' : '' }" id="tab-comparison">
        ${ renderComparisonTab(comparison) }
      </div>
    ` : '' }

    <div class="tab-panel${ defaultTab !== 'pages' ? ' hidden' : '' }" id="tab-pages">
      ${ renderPagesTab(pageEntries, comparison) }
    </div>
  </main>

  <button class="scroll-top-btn hidden" type="button" data-scroll-top aria-label="Back to top">Top</button>

  <script>
    (function () {
      var defaultTab = ${ JSON.stringify(defaultTab) }
      var btns = Array.from(document.querySelectorAll('.tab-btn'))
      var panels = Array.from(document.querySelectorAll('.tab-panel'))
      var scrollTopBtn = document.querySelector('[data-scroll-top]')

      function createNavGroup(config) {
        return {
          cards: Array.from(document.querySelectorAll(config.cardSelector)),
          emptyState: document.querySelector(config.emptySelector),
          filter: config.filterSelector ? document.querySelector(config.filterSelector) : null,
          filterAttr: config.filterAttr || '',
          filterMatchMode: config.filterMatchMode || 'single',
          links: Array.from(document.querySelectorAll(config.linkSelector)),
          nav: document.querySelector(config.navSelector),
          tabName: config.tabName,
          visibleCount: document.querySelector(config.visibleCountSelector),
        }
      }

      var navGroups = [
        createNavGroup({
          cardSelector: '[data-page-card]',
          emptySelector: '[data-pages-empty]',
          filterSelector: '[data-page-domain-filter]',
          filterAttr: 'sourceKey',
          linkSelector: '[data-page-link]',
          navSelector: '#tab-pages .page-index-nav',
          tabName: 'pages',
          visibleCountSelector: '[data-pages-visible-count]',
        }),
        createNavGroup({
          cardSelector: '[data-comparison-card]',
          emptySelector: '[data-comparison-empty]',
          filterSelector: '[data-comparison-difference-filter]',
          filterAttr: 'differenceKeys',
          filterMatchMode: 'multi',
          linkSelector: '[data-comparison-link]',
          navSelector: '#tab-comparison .page-index-nav',
          tabName: 'comparison',
          visibleCountSelector: '[data-comparison-visible-count]',
        }),
      ]

      function activate(name, updateHash) {
        btns.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name) })
        panels.forEach(function (p) { p.classList.toggle('hidden', p.id !== 'tab-' + name) })
        if (updateHash) {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#tab-' + name)
          } else {
            location.hash = 'tab-' + name
          }
        }
      }

      function syncNavGroupFilter(group) {
        if (!group || !group.cards.length) {
          return
        }

        var selectedFilter = group.filter ? group.filter.value : 'all'
        var count = 0

        group.cards.forEach(function (card) {
          var matches = matchesNavGroupFilter(card, group, selectedFilter)
          card.classList.toggle('hidden', !matches)
          if (matches) {
            count += 1
          }
        })

        group.links.forEach(function (link) {
          var matches = matchesNavGroupFilter(link, group, selectedFilter)
          link.classList.toggle('hidden', !matches)
        })

        if (group.visibleCount) {
          group.visibleCount.textContent = String(count)
        }

        if (group.emptyState) {
          group.emptyState.classList.toggle('hidden', count > 0)
        }
      }

      function matchesNavGroupFilter(element, group, selectedFilter) {
        if (selectedFilter === 'all' || !group.filterAttr) {
          return true
        }

        var rawValue = element.dataset[group.filterAttr] || ''

        if (!rawValue) {
          return false
        }

        if (group.filterMatchMode === 'multi') {
          return rawValue.split('|').indexOf(selectedFilter) !== -1
        }

        return rawValue === selectedFilter
      }

      function scrollNavLinkIntoView(group, link) {
        if (!group || !group.nav || !link || link.classList.contains('hidden')) {
          return
        }

        var navRect = group.nav.getBoundingClientRect()
        var linkRect = link.getBoundingClientRect()
        var isAboveViewport = linkRect.top < navRect.top
        var isBelowViewport = linkRect.bottom > navRect.bottom
        var scrollPadding = 8

        if (!isAboveViewport && !isBelowViewport) {
          return
        }

        if (isAboveViewport) {
          group.nav.scrollTop -= (navRect.top - linkRect.top) + scrollPadding
          return
        }

        group.nav.scrollTop += (linkRect.bottom - navRect.bottom) + scrollPadding
      }

      function setActiveLinkState(links, anchorId) {
        links.forEach(function (link) {
          var isActive = Boolean(anchorId) && link.dataset.navAnchor === anchorId
          link.classList.toggle('active', isActive)
          if (isActive) {
            link.setAttribute('aria-current', 'location')
          } else {
            link.removeAttribute('aria-current')
          }
        })
      }

      function setActiveGroupLink(group, anchorId) {
        if (!group) {
          return
        }

        setActiveLinkState(group.links, anchorId)
        scrollNavLinkIntoView(group, getActiveNavLink(group))
      }

      function getNavGroupByTab(tabName) {
        return navGroups.find(function (group) {
          return group.tabName === tabName
        }) || null
      }

      function getActiveNavLink(group) {
        if (!group) {
          return null
        }

        return group.links.find(function (link) {
          return link.classList.contains('active') && !link.classList.contains('hidden')
        }) || null
      }

      function clearInactiveNavLinks(activeTab) {
        navGroups.forEach(function (group) {
          if (group.tabName !== activeTab) {
            setActiveGroupLink(group, '')
          }
        })
      }

      function isNavGroupActive(group) {
        var tab = document.getElementById('tab-' + group.tabName)

        return Boolean(tab) && !tab.classList.contains('hidden')
      }

      function getVisibleCards(group) {
        return group.cards.filter(function (card) {
          return !card.classList.contains('hidden')
        })
      }

      function getActiveNavGroup() {
        return navGroups.find(function (group) {
          return isNavGroupActive(group)
        }) || null
      }

      function syncActiveNavLinkFromScroll() {
        var activeGroup = getActiveNavGroup()

        if (!activeGroup) {
          clearInactiveNavLinks('')
          return
        }

        var visibleCards = getVisibleCards(activeGroup)

        if (!visibleCards.length) {
          setActiveGroupLink(activeGroup, '')
          clearInactiveNavLinks(activeGroup.tabName)
          return
        }

        var threshold = Math.min(window.innerHeight * 0.35, 220)
        var activeCard = visibleCards[0]

        visibleCards.forEach(function (card) {
          if (card.getBoundingClientRect().top <= threshold) {
            activeCard = card
          }
        })

        setActiveGroupLink(activeGroup, activeCard.id)
        clearInactiveNavLinks(activeGroup.tabName)
      }

      var scrollTicking = false

      function requestScrollSync() {
        if (scrollTicking) {
          return
        }

        scrollTicking = true
        window.requestAnimationFrame(function () {
          scrollTicking = false
          syncActiveNavLinkFromScroll()
        })
      }

      function syncScrollTopButton() {
        if (!scrollTopBtn) {
          return
        }

        scrollTopBtn.classList.toggle('hidden', window.scrollY < 320)
      }

      function readHashState() {
        var hash = location.hash.replace(/^#/, '')

        if (!hash) {
          return { tab: defaultTab, anchorId: '' }
        }

        if (hash.indexOf('tab-') === 0 && document.getElementById(hash)) {
          return { tab: hash.slice(4), anchorId: '' }
        }

        if (document.getElementById(hash)) {
          var anchorTab = getTabForAnchorId(hash)

          if (anchorTab) {
            return { tab: anchorTab, anchorId: hash }
          }
        }

        if (document.getElementById('tab-' + hash)) {
          return { tab: hash, anchorId: '' }
        }

        return { tab: defaultTab, anchorId: '' }
      }

      function getTabForAnchorId(anchorId) {
        var anchorTarget = document.getElementById(anchorId)

        if (!anchorTarget) {
          return ''
        }

        if (anchorTarget.hasAttribute('data-comparison-card')) {
          return 'comparison'
        }

        if (anchorTarget.hasAttribute('data-page-card')) {
          return 'pages'
        }

        return ''
      }

      function syncFromHash() {
        var state = readHashState()
        var navGroup = getNavGroupByTab(state.tab)

        activate(state.tab, false)

        if (state.anchorId) {
          setActiveGroupLink(navGroup, state.anchorId)
          clearInactiveNavLinks(state.tab)
          window.requestAnimationFrame(function () {
            var target = document.getElementById(state.anchorId)

            if (target && !target.classList.contains('hidden')) {
              target.scrollIntoView({ block: 'start' })
            }
          })
          return
        }

        syncActiveNavLinkFromScroll()
      }

      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          activate(b.dataset.tab, true)

          if (getNavGroupByTab(b.dataset.tab)) {
            requestScrollSync()
          } else {
            clearInactiveNavLinks('')
          }
        })
      })

      navGroups.forEach(function (group) {
        if (!group.filter) {
          return
        }

        group.filter.addEventListener('change', function () {
          syncNavGroupFilter(group)
          var currentAnchor = location.hash.replace(/^#/, '')
          var currentTarget = document.getElementById(currentAnchor)

          if (currentTarget && currentTarget.classList.contains('hidden')) {
            setActiveGroupLink(group, '')
          } else {
            requestScrollSync()
          }
        })
      })

      if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
      }

      window.addEventListener('hashchange', syncFromHash)
      window.addEventListener('scroll', requestScrollSync, { passive: true })
      window.addEventListener('scroll', syncScrollTopButton, { passive: true })
      window.addEventListener('resize', requestScrollSync)

      navGroups.forEach(syncNavGroupFilter)
      syncFromHash()
      syncScrollTopButton()
    })()
  </script>
</body>
</html>
`
}

export const renderJsonReport = (report) => {
  const summary = report.summary ?? buildSummary(report.pages)

  return JSON.stringify({
    ...report,
    summary,
  }, null, 2)
}
