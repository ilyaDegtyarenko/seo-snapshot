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

const getPageSourceMeta = (page) => {
  const sourceUrl = page.source?.url ?? null
  const sourceLabel = page.source?.label ?? null
  const host = getHostname(sourceUrl || page.finalUrl || page.requestedUrl)
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
      page,
    }
  })
}

const buildPageSourceFilters = (pageEntries) => {
  const filters = new Map()

  for (const entry of pageEntries) {
    if (filters.has(entry.source.key)) {
      filters.get(entry.source.key).count += 1
      continue
    }

    filters.set(entry.source.key, {
      key: entry.source.key,
      label: entry.source.display || entry.source.badge || 'Primary source',
      count: 1,
    })
  }

  return [ ...filters.values() ]
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
      <div class="diff-issue-badges">${ [...leftBadges, ...rightBadges].join('') }</div>
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

const renderComparisonCard = (comparison) => {
  const totalDiff = comparison.differences.length +
    (comparison.issueDelta?.onlyOnLeft?.length ?? 0) +
    (comparison.issueDelta?.onlyOnRight?.length ?? 0)

  return `
    <section class="page-card">
      <header class="page-card-header">
        <div class="page-card-title">
          <h2>${ escapeHtml(comparison.targetPath) }</h2>
        </div>
        <div class="badge-row">
          ${ renderBadge(`${ comparison.left.label } ${ comparison.left.status ?? 'n/a' }`, getComparisonSideTone(comparison.left)) }
          ${ renderBadge(`${ comparison.right.label } ${ comparison.right.status ?? 'n/a' }`, getComparisonSideTone(comparison.right)) }
          ${ renderBadge(`${ totalDiff } difference${ totalDiff !== 1 ? 's' : '' }`, 'warning') }
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
    statusLabel,
  ].filter(Boolean)

  return `
    <a
      class="page-index-link"
      href="#${ escapeHtml(entry.anchorId) }"
      data-page-link
      data-page-anchor="${ escapeHtml(entry.anchorId) }"
      data-source-key="${ escapeHtml(entry.source.key) }"
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
  const robotsValue = page.seo?.meta.robots || page.headers.xRobotsTag || null
  const rawJson = escapeHtml(JSON.stringify(page, null, 2))

  return `
    <section
      class="page-card report-page-card"
      id="${ escapeHtml(anchorId) }"
      data-page-card
      data-source-key="${ escapeHtml(source.key) }"
    >
      <header class="page-card-header">
        <div class="page-card-title">
          <h2>${ escapeHtml(title) }</h2>
          <p class="page-url"><code>${ escapeHtml(page.finalUrl || page.requestedUrl) }</code></p>
        </div>
        <div class="badge-row">
          ${ source.badge ? renderBadge(source.badge, 'info') : '' }
          ${ renderBadge(page.error ? 'error' : `status ${ page.status ?? 'n/a' }`, statusTone) }
          ${ page.redirectChain.length > 1 ? renderBadge(`redirects ${ page.redirectChain.length - 1 }`, 'neutral') : '' }
          ${ page.issues.length > 0 ? renderBadge(`issues ${ page.issues.length }`, issuesTone) : renderBadge('clean', 'success') }
          ${ robotsValue ? renderBadge(robotsValue, robotsValue.toLowerCase().includes('noindex') ? 'warning' : 'neutral') : '' }
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
        ${ renderKeyValueRow('Title', page.seo?.document.title) }
        ${ renderKeyValueRow('Description', page.seo?.meta.description) }
        ${ renderKeyValueRow('Canonical', page.seo?.links.canonical) }
        ${ renderKeyValueRow('Lang', page.seo?.document.lang) }
        ${ renderKeyValueRow('Prev', page.seo?.links.prev) }
        ${ renderKeyValueRow('Next', page.seo?.links.next) }
        ${ renderKeyValueRow('OpenGraph URL', page.seo?.meta.openGraph.url) }
        ${ renderKeyValueRow('OpenGraph Image', page.seo?.meta.openGraph.image) }
        ${ renderKeyValueRow('Twitter Image', page.seo?.meta.twitter.image) }
        ${ renderKeyValueRow('Content-Type', page.headers.contentType) }
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
        <h3>JSON-LD types</h3>
        ${ renderList(page.seo?.jsonLd.types) }
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

const renderComparisonTab = (comparison) => {
  const withDiffs = comparison.comparisons.filter(c =>
    c.differences.length > 0 ||
    (c.issueDelta && (c.issueDelta.onlyOnLeft.length || c.issueDelta.onlyOnRight.length))
  )

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
    </section>

    ${ withDiffs.length > 0
      ? `<section class="page-list">${ withDiffs.map(renderComparisonCard).join('') }</section>`
      : '<p class="muted" style="padding: 8px 0;">No differences found between the two sources.</p>'
    }
  `
}

const renderPagesTab = (pageEntries, comparison) => {
  const sourceFilters = comparison ? buildPageSourceFilters(pageEntries) : []

  return `
    <section class="pages-shell">
      <aside class="page-card pages-sidebar">
        <div class="pages-sidebar-header">
          <h3>Page Index</h3>
          <p class="muted">Jump to any page card. ${ comparison ? 'Comparison mode also lets you filter by source domain.' : 'Use the anchor list to move through long reports faster.' }</p>
        </div>

        ${ sourceFilters.length > 0 ? `
          <label class="field-group">
            <span class="field-label">Domain</span>
            <select class="field-select" data-page-domain-filter aria-label="Filter pages by domain">
              <option value="all">All domains (${ pageEntries.length })</option>
              ${ sourceFilters.map(filter => `<option value="${ escapeHtml(filter.key) }">${ escapeHtml(filter.label) } (${ escapeHtml(filter.count) })</option>`).join('') }
            </select>
          </label>
        ` : '' }

        <p class="pages-counter muted"><span data-pages-visible-count>${ pageEntries.length }</span> of ${ pageEntries.length } pages shown</p>

        <nav class="page-index-nav" aria-label="Pages navigation">
          ${ pageEntries.map(renderPageIndexItem).join('') }
        </nav>
      </aside>

      <div class="pages-content">
        <p class="page-index-empty muted hidden" data-pages-empty>No pages match the selected domain.</p>
        <section class="page-list">
          ${ pageEntries.map(renderPageCard).join('') }
        </section>
      </div>
    </section>
  `
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
    .page-index-nav {
      display: grid;
      gap: 8px;
      max-height: calc(100vh - 220px);
      overflow: auto;
      padding-right: 4px;
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

  <script>
    (function () {
      var defaultTab = ${ JSON.stringify(defaultTab) }
      var btns = Array.from(document.querySelectorAll('.tab-btn'))
      var panels = Array.from(document.querySelectorAll('.tab-panel'))
      var pageFilter = document.querySelector('[data-page-domain-filter]')
      var pageCards = Array.from(document.querySelectorAll('[data-page-card]'))
      var pageLinks = Array.from(document.querySelectorAll('[data-page-link]'))
      var visibleCount = document.querySelector('[data-pages-visible-count]')
      var emptyState = document.querySelector('[data-pages-empty]')

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

      function syncPageFilter() {
        if (!pageCards.length) {
          return
        }

        var selectedSource = pageFilter ? pageFilter.value : 'all'
        var count = 0

        pageCards.forEach(function (card) {
          var matches = selectedSource === 'all' || card.dataset.sourceKey === selectedSource
          card.classList.toggle('hidden', !matches)
          if (matches) {
            count += 1
          }
        })

        pageLinks.forEach(function (link) {
          var matches = selectedSource === 'all' || link.dataset.sourceKey === selectedSource
          link.classList.toggle('hidden', !matches)
        })

        if (visibleCount) {
          visibleCount.textContent = String(count)
        }

        if (emptyState) {
          emptyState.classList.toggle('hidden', count > 0)
        }
      }

      function setActivePageLink(anchorId) {
        pageLinks.forEach(function (link) {
          var isActive = Boolean(anchorId) && link.dataset.pageAnchor === anchorId
          link.classList.toggle('active', isActive)
          if (isActive) {
            link.setAttribute('aria-current', 'location')
          } else {
            link.removeAttribute('aria-current')
          }
        })
      }

      function isPagesTabActive() {
        var pagesTab = document.getElementById('tab-pages')

        return Boolean(pagesTab) && !pagesTab.classList.contains('hidden')
      }

      function getVisiblePageCards() {
        return pageCards.filter(function (card) {
          return !card.classList.contains('hidden')
        })
      }

      function syncActivePageLinkFromScroll() {
        if (!pageCards.length || !isPagesTabActive()) {
          return
        }

        var visibleCards = getVisiblePageCards()

        if (!visibleCards.length) {
          setActivePageLink('')
          return
        }

        var threshold = Math.min(window.innerHeight * 0.35, 220)
        var activeCard = visibleCards[0]

        visibleCards.forEach(function (card) {
          if (card.getBoundingClientRect().top <= threshold) {
            activeCard = card
          }
        })

        setActivePageLink(activeCard.id)
      }

      var scrollTicking = false

      function requestScrollSync() {
        if (scrollTicking) {
          return
        }

        scrollTicking = true
        window.requestAnimationFrame(function () {
          scrollTicking = false
          syncActivePageLinkFromScroll()
        })
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
          return { tab: 'pages', anchorId: hash }
        }

        if (document.getElementById('tab-' + hash)) {
          return { tab: hash, anchorId: '' }
        }

        return { tab: defaultTab, anchorId: '' }
      }

      function syncFromHash() {
        var state = readHashState()

        activate(state.tab, false)

        if (state.anchorId) {
          setActivePageLink(state.anchorId)
          window.requestAnimationFrame(function () {
            var target = document.getElementById(state.anchorId)

            if (target && !target.classList.contains('hidden')) {
              target.scrollIntoView({ block: 'start' })
            }
          })
          return
        }

        syncActivePageLinkFromScroll()
      }

      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          activate(b.dataset.tab, true)

          if (b.dataset.tab !== 'pages') {
            setActivePageLink('')
          }
        })
      })

      if (pageFilter) {
        pageFilter.addEventListener('change', function () {
          syncPageFilter()
          var currentAnchor = location.hash.replace(/^#/, '')
          var currentTarget = document.getElementById(currentAnchor)

          if (currentTarget && currentTarget.classList.contains('hidden')) {
            setActivePageLink('')
          }
        })
      }

      window.addEventListener('hashchange', syncFromHash)
      window.addEventListener('scroll', requestScrollSync, { passive: true })
      window.addEventListener('resize', requestScrollSync)

      syncPageFilter()
      syncFromHash()
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
