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

const renderPageCard = (page) => {
  const tone = page.error
    ? 'error'
    : page.status && page.status >= 400
      ? 'warning'
      : getHighestSeverity(page.issues)
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
          ${ renderBadge(page.error ? 'error' : `status ${ page.status ?? 'n/a' }`, tone) }
          ${ page.redirectChain.length > 1 ? renderBadge(`redirects ${ page.redirectChain.length - 1 }`, 'neutral') : '' }
          ${ page.issues.length > 0 ? renderBadge(`issues ${ page.issues.length }`, tone) : renderBadge('clean', 'success') }
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
  const summary = buildSummary(report.pages)
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
      --bg: #f3efe7;
      --bg-accent: #dbe7df;
      --panel: rgba(255, 252, 247, 0.86);
      --panel-strong: #fffaf2;
      --panel-border: rgba(47, 63, 51, 0.15);
      --text: #1d2a1f;
      --muted: #5d6d60;
      --success: #2f7d4a;
      --warning: #b75d14;
      --error: #b23a34;
      --info: #2c698d;
      --shadow: 0 24px 80px rgba(51, 58, 47, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      line-height: 1.55;
      background:
        radial-gradient(circle at top left, rgba(205, 225, 214, 0.9), transparent 38%),
        radial-gradient(circle at top right, rgba(246, 217, 179, 0.7), transparent 30%),
        linear-gradient(180deg, var(--bg-accent) 0%, var(--bg) 22%, #efe5d8 100%);
      min-height: 100vh;
    }
    main {
      max-width: 1440px;
      margin: 0 auto;
      padding: 32px 24px 64px;
    }
    h1, h2, h3, p { margin: 0; }
    code {
      word-break: break-word;
      font-family: "SFMono-Regular", "Consolas", monospace;
    }
    .page-header {
      padding: 28px;
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(255, 250, 242, 0.95), rgba(246, 241, 230, 0.82));
      box-shadow: var(--shadow);
      display: grid;
      gap: 10px;
    }
    .page-header h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(34px, 4vw, 56px);
      line-height: 0.96;
      letter-spacing: -0.03em;
    }
    .page-header p {
      color: var(--muted);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 14px;
      margin: 22px 0 28px;
    }
    .summary-card, .page-card {
      border: 1px solid var(--panel-border);
      border-radius: 22px;
      background: var(--panel);
      backdrop-filter: blur(14px);
      box-shadow: var(--shadow);
    }
    .summary-card {
      padding: 18px;
    }
    .summary-card strong {
      display: block;
      font-size: 30px;
      line-height: 1;
      margin-bottom: 6px;
      font-family: Georgia, "Times New Roman", serif;
    }
    .page-list {
      display: grid;
      gap: 18px;
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
      font-size: 24px;
      line-height: 1.1;
      word-break: break-word;
    }
    .page-url {
      color: var(--muted);
      word-break: break-word;
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
      font-weight: 700;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .badge-success { background: rgba(47, 125, 74, 0.14); color: var(--success); }
    .badge-warning { background: rgba(183, 93, 20, 0.14); color: var(--warning); }
    .badge-error { background: rgba(178, 58, 52, 0.14); color: var(--error); }
    .badge-info, .badge-neutral { background: rgba(44, 105, 141, 0.12); color: var(--info); }
    .kv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    .kv-row {
      padding: 14px;
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.55);
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
    .subsection {
      margin-top: 16px;
    }
    .subsection h3 {
      font-size: 13px;
      margin-bottom: 8px;
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
      gap: 8px 18px;
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
      background: rgba(255, 255, 255, 0.55);
      border: 1px solid var(--panel-border);
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
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      background: rgba(250, 247, 241, 0.9);
      font-size: 12px;
    }
    @media (max-width: 720px) {
      main { padding: 18px 14px 44px; }
      .page-card-header { flex-direction: column; }
      .badge-row { justify-content: flex-start; }
      .page-header { padding: 22px; }
    }
  </style>
</head>
<body>
  <main>
    <header class="page-header">
      <h1>SEO Snapshot</h1>
      <p>Generated at ${ escapeHtml(generatedAtLabel) }</p>
      <p>Config: <code>${ escapeHtml(report.options.configPath) }</code></p>
      <p>Base URL: <code>${ escapeHtml(report.options.baseUrl || '-') }</code></p>
      <p>Output formats: <code>${ escapeHtml(report.options.formats.join(', ')) }</code></p>
    </header>

    <section class="summary-grid">
      <article class="summary-card"><strong>${ escapeHtml(summary.total) }</strong><span>Total pages</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.pagesWithIssues) }</strong><span>Pages with issues</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.totalIssues) }</strong><span>Total issues</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.httpErrors) }</strong><span>HTTP 4xx/5xx</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.redirected) }</strong><span>Redirected</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.noindex) }</strong><span>Noindex</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.severityCounts.error) }</strong><span>Error issues</span></article>
      <article class="summary-card"><strong>${ escapeHtml(summary.severityCounts.warning) }</strong><span>Warning issues</span></article>
    </section>

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
  const summary = buildSummary(report.pages)

  return JSON.stringify({
    ...report,
    summary,
  }, null, 2)
}
