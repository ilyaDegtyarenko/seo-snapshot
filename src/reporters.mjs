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

const renderIssueDelta = (issueDelta, comparison) => {
  if (!issueDelta || (!issueDelta.onlyOnLeft.length && !issueDelta.onlyOnRight.length)) {
    return ''
  }

  return `
    <div class="subsection">
      <h3>Issue Delta</h3>
      <div class="diff-columns">
        <div class="diff-column">
          <span class="diff-column-label">${ escapeHtml(comparison.left.label) } only</span>
          ${ renderValue(issueDelta.onlyOnLeft) }
        </div>
        <div class="diff-column">
          <span class="diff-column-label">${ escapeHtml(comparison.right.label) } only</span>
          ${ renderValue(issueDelta.onlyOnRight) }
        </div>
      </div>
    </div>
  `
}

const renderComparisonDifferences = (comparison) => {
  if (comparison.differences.length === 0) {
    return '<p class="muted">No SEO differences detected for this path.</p>'
  }

  return `<div class="diff-list">${ comparison.differences.map(difference => `
    <article class="diff-row">
      <strong>${ escapeHtml(difference.label) }</strong>
      <div class="diff-columns">
        <div class="diff-column">
          <span class="diff-column-label">${ escapeHtml(comparison.left.label) }</span>
          <div>${ renderValue(difference.left) }</div>
        </div>
        <div class="diff-column">
          <span class="diff-column-label">${ escapeHtml(comparison.right.label) }</span>
          <div>${ renderValue(difference.right) }</div>
        </div>
      </div>
    </article>
  `).join('')}</div>`
}

const renderComparisonCard = (comparison) => {
  return `
    <section class="page-card">
      <header class="page-card-header">
        <div class="page-card-title">
          <h2>${ escapeHtml(comparison.targetPath) }</h2>
          <p class="page-url"><code>${ escapeHtml(comparison.left.label) }</code> vs <code>${ escapeHtml(comparison.right.label) }</code></p>
        </div>
        <div class="badge-row">
          ${ comparison.differences.length > 0 ? renderBadge(`differences ${ comparison.differences.length }`, 'warning') : renderBadge('matching', 'success') }
        </div>
      </header>

      <div class="comparison-grid">
        <div class="comparison-side">
          <strong>${ escapeHtml(comparison.left.label) }</strong>
          <p><code>${ escapeHtml(comparison.left.requestedUrl) }</code></p>
          <p class="muted">Status: ${ escapeHtml(comparison.left.status ?? 'n/a') }</p>
          <p class="muted">Final: ${ comparison.left.finalUrl ? `<code>${ escapeHtml(comparison.left.finalUrl) }</code>` : '<span class="muted">-</span>' }</p>
        </div>
        <div class="comparison-side">
          <strong>${ escapeHtml(comparison.right.label) }</strong>
          <p><code>${ escapeHtml(comparison.right.requestedUrl) }</code></p>
          <p class="muted">Status: ${ escapeHtml(comparison.right.status ?? 'n/a') }</p>
          <p class="muted">Final: ${ comparison.right.finalUrl ? `<code>${ escapeHtml(comparison.right.finalUrl) }</code>` : '<span class="muted">-</span>' }</p>
        </div>
      </div>

      <div class="subsection">
        <h3>Field Differences</h3>
        ${ renderComparisonDifferences(comparison) }
      </div>

      ${ renderIssueDelta(comparison.issueDelta, comparison) }
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

const renderPageCard = (page) => {
  const statusTone = getStatusTone(page)
  const issuesTone = page.issues.length > 0
    ? getHighestSeverity(page.issues)
    : 'success'
  const title = page.seo?.document.title || page.input
  const robotsValue = page.seo?.meta.robots || page.headers.xRobotsTag || null
  const rawJson = escapeHtml(JSON.stringify(page, null, 2))

  return `
    <section class="page-card">
      <header class="page-card-header">
        <div class="page-card-title">
          <h2>${ escapeHtml(title) }</h2>
          <p class="page-url"><code>${ escapeHtml(page.finalUrl || page.requestedUrl) }</code></p>
        </div>
        <div class="badge-row">
          ${ page.source ? renderBadge(page.source.label, 'info') : '' }
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
        ${ renderKeyValueRow('Source', page.source ? `${ page.source.label } (${ page.source.baseUrl })` : null) }
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

export const renderHtmlReport = (report) => {
  const summary = report.summary ?? buildSummary(report.pages)
  const comparison = report.comparison ?? null
  const generatedAtLabel = new Date(report.generatedAt).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })

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
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
    }
    .comparison-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }
    .comparison-side,
    .diff-column {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--bg-muted);
      display: grid;
      gap: 6px;
    }
    .comparison-side strong {
      font-size: 15px;
      letter-spacing: -0.01em;
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
    .page-list {
      display: grid;
      gap: 14px;
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
    .diff-list {
      display: grid;
      gap: 12px;
    }
    .diff-row {
      display: grid;
      gap: 12px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--bg-muted);
    }
    .diff-columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .diff-column-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
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
    @media (max-width: 720px) {
      main { padding: 16px 14px 40px; }
      .page-card-header { flex-direction: column; }
      .badge-row { justify-content: flex-start; }
      .page-header { padding: 20px; }
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
    </header>

    <section class="summary-grid">
      <article class="summary-card"><strong>${ escapeHtml(summary.total) }</strong><span>Total pages</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.pagesWithIssues) }</strong><span>Pages with issues</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.totalIssues) }</strong><span>Total issues</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.failedPages) }</strong><span>Failed pages</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.redirected) }</strong><span>Redirected</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.noindex) }</strong><span>Noindex</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.severityCounts.error) }</strong><span>Error issues</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.severityCounts.warning) }</strong><span>Warning issues</span></article>
    </section>

    ${ comparison ? `
      <section class="summary-grid">
        <article class="summary-card"><strong>${ escapeHtml(comparison.targetCount) }</strong><span>Compared paths</span></article>
        <article class="summary-card"><strong>${ escapeHtml(comparison.targetsWithDifferences) }</strong><span>Paths with differences</span></article>
        <article class="summary-card"><strong>${ escapeHtml(comparison.totalDifferences) }</strong><span>Total field differences</span></article>
      </section>

      <section class="page-card">
        <div class="subsection">
          <h3>Difference Breakdown</h3>
          ${ renderComparisonBreakdown(comparison) }
        </div>
      </section>

      <section class="page-list">
        ${ comparison.comparisons.map(renderComparisonCard).join('') }
      </section>
    ` : '' }

    <section class="page-card">
      <div class="subsection">
        <h3>Issue Breakdown</h3>
        ${ renderIssueBreakdown(summary) }
      </div>
    </section>

    <section class="page-list">
      ${ report.pages.map(renderPageCard).join('') }
    </section>
  </main>
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
