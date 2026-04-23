import { buildSummary } from './audit.mjs'
import { escapeHtml, getHighestSeverity } from './utils.mjs'

const renderBadge = (label, tone = 'neutral') => {
  return `<span class="badge badge-${ tone }">${ escapeHtml(label) }</span>`
}

const getTtfbMs = (page) => {
  return page.ttfbMs ?? null
}

const getFinalResponseTtfbMs = (page) => {
  return page.finalResponseTtfbMs ?? null
}

const renderKeyValueRow = (label, value, hint) => {
  const normalizedValue = (value === null || value === undefined || value === '')
    ? '<span class="muted">-</span>'
    : escapeHtml(value)

  const dtAttrs = hint ? ` title="${ escapeHtml(hint) }"` : ''
  return `<div class="kv-row"><dt${ dtAttrs }>${ escapeHtml(label) }</dt><dd>${ normalizedValue }</dd></div>`
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

const renderPreloadLinks = (preloads) => {
  if (!Array.isArray(preloads) || preloads.length === 0) {
    return '<span class="muted">-</span>'
  }

  return `<ul class="stack-list">${ preloads.map((preload) => {
    const parts = [ preload.as || 'preload' ]

    if (preload.type) {
      parts.push(preload.type)
    }

    return `<li><strong>${ escapeHtml(parts.join('/')) }</strong>: ${ escapeHtml(preload.href || '-') }</li>`
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

  return `<ul class="stack-list jsonld-block-list">${ blocks.map((block) => {
    const fullJson = typeof block.json === 'string' && block.json.trim() ? block.json : null
    const fallbackPreview = !fullJson && block.preview ? String(block.preview) : null
    const schemaDetails = fullJson || fallbackPreview
      ? `
        <details class="jsonld-details">
          <summary>${ fullJson ? 'Full schema' : 'Preview' }</summary>
          <pre>${ escapeHtml(fullJson ?? fallbackPreview) }</pre>
        </details>
      `
      : ''

    return `
    <li class="jsonld-block-item">
      <strong>${ escapeHtml(block.hash || 'unknown') }</strong>: ${ escapeHtml(block.summary || 'Unknown JSON-LD block') }
      ${ schemaDetails }
    </li>
  `
  }).join('') }</ul>`
}

const renderRedirectChain = (redirectChain) => {
  if (!Array.isArray(redirectChain) || redirectChain.length === 0) {
    return '<span class="muted">-</span>'
  }

  return `<ol class="stack-list">${ redirectChain.map((step) => {
    const location = step.location ? ` → ${ escapeHtml(step.location) }` : ''
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

const stringifyReportJson = (value) => {
  const seen = new WeakSet()

  return JSON.stringify(value, (key, item) => {
    if (typeof item === 'function') {
      return `[Function ${ item.name || 'anonymous' }]`
    }

    if (typeof item === 'object' && item !== null) {
      if (seen.has(item)) {
        return '[Circular]'
      }

      seen.add(item)
    }

    return item
  }, 2)
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

const buildComparisonSideKey = ({ targetPath, variantId, sourceUrl }) => {
  return JSON.stringify([
    String(targetPath || '').trim(),
    variantId ?? '',
    sourceUrl ?? '',
  ])
}

const buildPageEntries = (pages) => {
  return pages.map((page, index) => {
    const source = getPageSourceMeta(page)
    const targetPath = String(page.targetPath || page.input || '').trim()
    const variantId = page.variantId ?? page.variant ?? null

    return {
      anchorId: buildPageAnchorId(page, index),
      comparisonAnchorId: null,
      comparisonLabel: null,
      index,
      navLabel: getPageNavLabel(page),
      source,
      sourceUrl: page.source?.url ?? null,
      targetPath,
      title: getPageTitle(page),
      variant: page.variant ?? null,
      variantId,
      page,
    }
  })
}

const buildPageEntryLookup = (pageEntries) => {
  return new Map(pageEntries.map(entry => [
    buildComparisonSideKey({
      targetPath: entry.targetPath,
      variantId: entry.variantId,
      sourceUrl: entry.sourceUrl,
    }),
    entry,
  ]))
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

const buildComparisonEntries = (comparisons, pageEntries = []) => {
  const pageEntryLookup = buildPageEntryLookup(pageEntries)

  return comparisons.map((comparison, index) => {
    const navLabel = getComparisonNavLabel(comparison)
    const diffCount = getComparisonDifferenceCount(comparison)
    const differenceKeys = [ ...new Set(comparison.differences.map(difference => difference.key)) ]
    const variantId = comparison.variantId ?? comparison.variant ?? null
    const leftPageEntry = pageEntryLookup.get(buildComparisonSideKey({
      targetPath: comparison.targetPath,
      variantId,
      sourceUrl: comparison.left.baseUrl,
    })) ?? null
    const rightPageEntry = pageEntryLookup.get(buildComparisonSideKey({
      targetPath: comparison.targetPath,
      variantId,
      sourceUrl: comparison.right.baseUrl,
    })) ?? null

    return {
      anchorId: buildComparisonAnchorId(comparison, index),
      comparison,
      differenceKeys,
      diffCount,
      index,
      navLabel,
      pageLinks: [
        {
          anchorId: leftPageEntry?.anchorId ?? null,
          label: comparison.left.label,
          url: comparison.left.finalUrl || comparison.left.requestedUrl || null,
        },
        {
          anchorId: rightPageEntry?.anchorId ?? null,
          label: comparison.right.label,
          url: comparison.right.finalUrl || comparison.right.requestedUrl || null,
        },
      ].filter(link => link.anchorId),
    }
  })
}

const attachComparisonLinksToPageEntries = (pageEntries, comparisonEntries) => {
  const comparisonLookup = new Map()

  for (const entry of comparisonEntries) {
    const variantId = entry.comparison.variantId ?? entry.comparison.variant ?? null

    comparisonLookup.set(buildComparisonSideKey({
      targetPath: entry.comparison.targetPath,
      variantId,
      sourceUrl: entry.comparison.left.baseUrl,
    }), entry)
    comparisonLookup.set(buildComparisonSideKey({
      targetPath: entry.comparison.targetPath,
      variantId,
      sourceUrl: entry.comparison.right.baseUrl,
    }), entry)
  }

  return pageEntries.map((entry) => {
    const comparisonEntry = comparisonLookup.get(buildComparisonSideKey({
      targetPath: entry.targetPath,
      variantId: entry.variantId,
      sourceUrl: entry.sourceUrl,
    })) ?? null

    if (!comparisonEntry) {
      return entry
    }

    return {
      ...entry,
      comparisonAnchorId: comparisonEntry.anchorId,
      comparisonLabel: comparisonEntry.navLabel,
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

const parseJsonLdBlockSignature = (value) => {
  const signature = String(value ?? '').trim()

  if (!signature) {
    return null
  }

  const separator = ' | '
  const separatorIndex = signature.indexOf(separator)

  if (separatorIndex === -1) {
    return {
      hash: 'unknown',
      signature,
      summary: signature,
    }
  }

  const hash = signature.slice(0, separatorIndex).trim() || 'unknown'
  const summary = signature.slice(separatorIndex + separator.length).trim() || 'Unknown JSON-LD block'

  return {
    hash,
    signature,
    summary,
  }
}

const parseJsonLdBlockSignatures = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(parseJsonLdBlockSignature)
    .filter(Boolean)
}

const buildJsonLdBlockComparisonRows = (leftValue, rightValue) => {
  const leftBlocks = parseJsonLdBlockSignatures(leftValue)
  const rightBlocks = parseJsonLdBlockSignatures(rightValue)
  const usedRightIndexes = new Set()
  const rows = []
  const findUnusedRightIndex = predicate => rightBlocks.findIndex((block, index) => !usedRightIndexes.has(index) && predicate(block))

  for (const leftBlock of leftBlocks) {
    let rightIndex = findUnusedRightIndex(block => block.summary === leftBlock.summary)

    if (rightIndex === -1 && leftBlock.hash !== 'unknown') {
      rightIndex = findUnusedRightIndex(block => block.hash === leftBlock.hash)
    }

    if (rightIndex === -1) {
      rows.push({
        left: leftBlock,
        right: null,
        status: 'removed',
      })
      continue
    }

    const rightBlock = rightBlocks[rightIndex]
    usedRightIndexes.add(rightIndex)

    rows.push({
      left: leftBlock,
      right: rightBlock,
      status: leftBlock.signature === rightBlock.signature ? 'same' : 'changed',
    })
  }

  for (const [ index, rightBlock ] of rightBlocks.entries()) {
    if (!usedRightIndexes.has(index)) {
      rows.push({
        left: null,
        right: rightBlock,
        status: 'added',
      })
    }
  }

  return rows
}

const renderJsonLdBlockSide = (block) => {
  if (!block) {
    return '<span class="muted">—</span>'
  }

  return `
    <span class="jsonld-block-summary">${ escapeHtml(block.summary) }</span>
    <span class="jsonld-block-hash">${ escapeHtml(block.hash) }</span>
  `
}

const renderJsonLdComparisonField = (field) => {
  const rows = buildJsonLdBlockComparisonRows(field.left, field.right)
  const statusLabels = {
    added: 'Added',
    changed: 'Changed',
    removed: 'Removed',
    same: 'Same',
  }

  const renderedRows = rows.length === 0
    ? '<span class="muted">—</span>'
    : rows.map(row => `
      <div class="jsonld-compare-row jsonld-compare-row-${ row.status }">
        <span class="jsonld-compare-status">${ statusLabels[row.status] }</span>
        <div class="jsonld-compare-sides">
          <div class="jsonld-compare-side jsonld-compare-side-old">${ renderJsonLdBlockSide(row.left) }</div>
          <span class="jsonld-compare-arrow">→</span>
          <div class="jsonld-compare-side jsonld-compare-side-new">${ renderJsonLdBlockSide(row.right) }</div>
        </div>
      </div>
    `).join('')

  return `
    <div
      class="${ field.changed ? 'diff-inline-row diff-inline-row-jsonld' : 'diff-inline-row diff-inline-row-jsonld diff-inline-row-unchanged' }"
      data-comparison-field-changed="${ field.changed ? 'true' : 'false' }"
    >
      <span class="diff-inline-label"${ field.hint ? ` title="${ escapeHtml(field.hint) }"` : '' }>${ escapeHtml(field.label) }</span>
      <div class="jsonld-compare">${ renderedRows }</div>
    </div>
  `
}

const maxInlineDiffCells = 80000
const inlineDiffExcludedKeys = new Set([
  'issueCodes',
  'jsonLdBlocks',
])

const isNumericDiffValue = (value) => {
  return typeof value === 'number' && Number.isFinite(value)
}

const shouldRenderInlineDiff = (field) => {
  return field.changed &&
    !inlineDiffExcludedKeys.has(field.key) &&
    !isNumericDiffValue(field.left) &&
    !isNumericDiffValue(field.right)
}

const normalizeDiffTextValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value.join(', ')
  }
  return String(value)
}

const buildCommonSubsequenceMatrix = (leftChars, rightChars) => {
  const matrix = Array.from({ length: leftChars.length + 1 }, () => Array(rightChars.length + 1).fill(0))

  for (let leftIndex = leftChars.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightChars.length - 1; rightIndex >= 0; rightIndex -= 1) {
      matrix[leftIndex][rightIndex] = leftChars[leftIndex] === rightChars[rightIndex]
        ? matrix[leftIndex + 1][rightIndex + 1] + 1
        : Math.max(matrix[leftIndex + 1][rightIndex], matrix[leftIndex][rightIndex + 1])
    }
  }

  return matrix
}

const pushDiffSegment = (segments, text, changed) => {
  if (!text) {
    return
  }

  const previous = segments.at(-1)
  if (previous?.changed === changed) {
    previous.text += text
    return
  }

  segments.push({ text, changed })
}

const buildInlineDiffSegments = (leftValue, rightValue) => {
  const leftText = normalizeDiffTextValue(leftValue)
  const rightText = normalizeDiffTextValue(rightValue)

  if (leftText === null || rightText === null) {
    return null
  }

  const leftChars = [ ...leftText ]
  const rightChars = [ ...rightText ]

  if (leftChars.length * rightChars.length > maxInlineDiffCells) {
    return null
  }

  const matrix = buildCommonSubsequenceMatrix(leftChars, rightChars)
  const leftSegments = []
  const rightSegments = []
  let leftIndex = 0
  let rightIndex = 0

  while (leftIndex < leftChars.length && rightIndex < rightChars.length) {
    if (leftChars[leftIndex] === rightChars[rightIndex]) {
      pushDiffSegment(leftSegments, leftChars[leftIndex], false)
      pushDiffSegment(rightSegments, rightChars[rightIndex], false)
      leftIndex += 1
      rightIndex += 1
    } else if (matrix[leftIndex + 1][rightIndex] >= matrix[leftIndex][rightIndex + 1]) {
      pushDiffSegment(leftSegments, leftChars[leftIndex], true)
      leftIndex += 1
    } else {
      pushDiffSegment(rightSegments, rightChars[rightIndex], true)
      rightIndex += 1
    }
  }

  while (leftIndex < leftChars.length) {
    pushDiffSegment(leftSegments, leftChars[leftIndex], true)
    leftIndex += 1
  }

  while (rightIndex < rightChars.length) {
    pushDiffSegment(rightSegments, rightChars[rightIndex], true)
    rightIndex += 1
  }

  return {
    left: leftSegments,
    right: rightSegments,
  }
}

const renderDiffSegments = (segments, side) => {
  return segments.map(segment => {
    const text = escapeHtml(segment.text)
    return segment.changed ? `<span class="diff-inline-change diff-inline-change-${ side }">${ text }</span>` : text
  }).join('')
}

const renderComparedDiffValue = (value, segments, side) => {
  if (!segments) {
    return renderDiffValue(value)
  }

  return renderDiffSegments(segments, side)
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
    <div class="diff-inline-row" data-comparison-field-changed="true">
      <span class="diff-inline-label">Issues delta</span>
      <div class="diff-issue-badges">${ [ ...leftBadges, ...rightBadges ].join('') }</div>
    </div>
  `
}

const renderComparisonFields = (comparison) => {
  const fields = comparison.fields ?? comparison.differences.map(difference => ({ ...difference, changed: true }))

  if (fields.length === 0) {
    return '<p class="muted" data-comparison-no-fields>No compared fields found.</p>'
  }

  return fields.map((field) => {
    if (field.key === 'jsonLdBlocks') {
      return renderJsonLdComparisonField(field)
    }

    const diffSegments = shouldRenderInlineDiff(field) ? buildInlineDiffSegments(field.left, field.right) : null

    return `
    <div
      class="${ field.changed ? 'diff-inline-row' : 'diff-inline-row diff-inline-row-unchanged' }"
      data-comparison-field-changed="${ field.changed ? 'true' : 'false' }"
    >
      <span class="diff-inline-label"${ field.hint ? ` title="${ escapeHtml(field.hint) }"` : '' }>${ escapeHtml(field.label) }</span>
      <span class="diff-inline-old">${ renderComparedDiffValue(field.left, diffSegments?.left, 'old') }</span>
      <span class="diff-arrow">→</span>
      <span class="diff-inline-new">${ renderComparedDiffValue(field.right, diffSegments?.right, 'new') }</span>
    </div>
    `
  }).join('')
}

const renderCardLinks = (links) => {
  const availableLinks = links.filter(link => link?.href && link?.label)

  if (availableLinks.length === 0) {
    return ''
  }

  return `
    <div class="card-link-row">
      ${ availableLinks.map(link => `
        <a class="card-link" href="${ escapeHtml(link.href) }"${ link.title ? ` title="${ escapeHtml(link.title) }"` : '' }><span class="card-link-icon" aria-hidden="true">→</span><span>${ escapeHtml(link.label) }</span></a>
      `).join('') }
    </div>
  `
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
      data-has-differences="${ entry.diffCount > 0 ? 'true' : 'false' }"
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
  const pageLinks = entry.pageLinks.map(link => ({
    href: `#${ link.anchorId }`,
    label: `Go to ${ link.label } page`,
    title: link.url,
  }))

  return `
    <section
      class="page-card"
      id="${ escapeHtml(anchorId) }"
      data-comparison-card
      data-nav-card
      data-nav-tab="comparison"
      data-difference-keys="${ escapeHtml(entry.differenceKeys.join('|')) }"
      data-has-differences="${ diffCount > 0 ? 'true' : 'false' }"
    >
      <header class="page-card-header">
        <div class="page-card-title">
          <h2>${ escapeHtml(navLabel) }</h2>
          <p class="page-url"><code>${ escapeHtml(leftUrl) }</code> → <code>${ escapeHtml(rightUrl) }</code></p>
          ${ renderCardLinks(pageLinks) }
        </div>
        <div class="badge-row">
          ${ renderBadge(`${ comparison.left.label } ${ comparison.left.status ?? 'n/a' }`, getComparisonSideTone(comparison.left)) }
          ${ renderBadge(`${ comparison.right.label } ${ comparison.right.status ?? 'n/a' }`, getComparisonSideTone(comparison.right)) }
          ${ renderBadge(`${ diffCount } difference${ diffCount !== 1 ? 's' : '' }`, 'warning') }
        </div>
      </header>

      <div class="diff-inline-list">
        ${ renderComparisonFields(comparison) }
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

  const issues = entry.page.issues ?? []
  const issueCount = issues.length
  const issueTone = issueCount > 0 ? getHighestSeverity(issues) : null
  const issueIndicator = issueTone
    ? `<span class="page-index-issues page-index-issues-${ issueTone }">${ issueCount } issue${ issueCount !== 1 ? 's' : '' }</span>`
    : ''

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
      ${ issueIndicator }
    </a>
  `
}

const renderPageCard = (entry, options = {}) => {
  const { page, anchorId, source, title } = entry
  const statusTone = getStatusTone(page)
  const issuesTone = page.issues.length > 0
    ? getHighestSeverity(page.issues)
    : 'success'
  const robotsBadgeValue = page.seo?.meta.robots || page.headers.xRobotsTag || null
  const rawJson = escapeHtml(JSON.stringify(page, null, 2))
  const comparisonLinks = entry.comparisonAnchorId
    ? [{
      href: `#${ entry.comparisonAnchorId }`,
      label: 'Go to comparison',
      title: entry.comparisonLabel,
    }]
    : []

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
          ${ renderCardLinks(comparisonLinks) }
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
        ${ renderKeyValueRow('Source', getPageSourceDetails(source), 'How the page was discovered (sitemap, direct list, etc.)') }
        ${ renderKeyValueRow('Requested URL', page.requestedUrl, 'The URL that was originally requested') }
        ${ renderKeyValueRow('Final URL', page.finalUrl, 'The URL after all redirects have been followed') }
        ${ renderKeyValueRow('Content-Type', page.headers.contentType, 'HTTP response MIME type, e.g. text/html') }
        ${ renderKeyValueRow('Content-Length', page.headers.contentLength, 'Response body size in bytes') }
        ${ options.hideTtfb ? '' : renderKeyValueRow('TTFB', getTtfbMs(page) !== null ? `${ getTtfbMs(page) } ms` : null, 'Time to First Byte — time from sending the request to receiving the first byte of the response') }
        ${ options.hideTtfb ? '' : renderKeyValueRow('Final response TTFB', getFinalResponseTtfbMs(page) !== null ? `${ getFinalResponseTtfbMs(page) } ms` : null, 'TTFB measured for the final URL after all redirects') }
        ${ renderKeyValueRow('Charset', page.seo?.meta.charset, 'Character encoding declared in the meta tag or HTTP header') }
        ${ renderKeyValueRow('Title', page.seo?.document.title, '<title> tag content — shown in browser tabs and search result headlines') }
        ${ renderKeyValueRow('Description', page.seo?.meta.description, '<meta name="description"> — page summary shown in search result snippets') }
        ${ renderKeyValueRow('Meta robots', page.seo?.meta.robots, '<meta name="robots"> — crawler directives: index/noindex, follow/nofollow') }
        ${ renderKeyValueRow('X-Robots-Tag', page.headers.xRobotsTag, 'HTTP header version of robots directives — equivalent to meta robots but set server-side') }
        ${ renderKeyValueRow('Content-Security-Policy', page.headers?.contentSecurityPolicy, 'HTTP header restricting allowed resource origins to mitigate XSS attacks') }
        ${ renderKeyValueRow('X-Frame-Options', page.headers?.xFrameOptions, 'HTTP header preventing the page from being embedded in a frame — protects against clickjacking') }
        ${ renderKeyValueRow('Link header', page.headers.link, 'HTTP Link response header — may carry canonical, pagination, preload and other relations') }
        ${ renderKeyValueRow('Canonical', page.seo?.links.canonical, '<link rel="canonical"> — declares the preferred URL for this content to avoid duplicates') }
        ${ renderKeyValueRow('Header canonical', page.headers?.links?.canonical, 'Canonical URL specified via HTTP Link header instead of an in-page tag') }
        ${ renderKeyValueRow('Header llms', page.headers?.links?.llms, 'Link to llms.txt via HTTP Link header — hints for LLM crawlers') }
        ${ renderKeyValueRow('Lang', page.seo?.document.lang, 'lang attribute on the <html> element — declares the language of the page content') }
        ${ renderKeyValueRow('Content-Language', page.seo?.document.contentLanguage, 'Page language from the HTTP Content-Language header or meta tag') }
        ${ renderKeyValueRow('Body text length', page.seo?.document.bodyTextLength, 'Number of visible characters in the page body (excluding HTML tags)') }
        ${ renderKeyValueRow('Images', page.seo?.document.imageCount ?? '-', 'Total number of <img> elements on the page') }
        ${ renderKeyValueRow('Images without alt', page.seo?.document.imagesWithoutAlt ?? '-', 'Images missing the alt attribute entirely — accessibility and SEO issue') }
        ${ renderKeyValueRow('Images with empty alt', page.seo?.document.imagesWithEmptyAlt ?? '-', 'Images with alt="" — treated as decorative, not indexed by text') }
        ${ renderKeyValueRow('Internal links', page.seo?.document.internalLinkCount ?? '-', 'Number of links pointing to the same domain') }
        ${ renderKeyValueRow('Heading hierarchy', page.seo?.document.headingHierarchy?.length > 0 ? page.seo.document.headingHierarchy.map(level => `H${ level }`).join(' → ') : null, 'Order of heading levels on the page — should be sequential with no skipped levels') }
        ${ renderKeyValueRow('Viewport', page.seo?.meta.viewport, '<meta name="viewport"> — controls scaling and layout on mobile devices') }
        ${ renderKeyValueRow('Application name', page.seo?.meta.applicationName, '<meta name="application-name"> — name of the web application') }
        ${ renderKeyValueRow('Theme color', page.seo?.meta.themeColor, '<meta name="theme-color"> — browser UI color on mobile devices') }
        ${ renderKeyValueRow('Manifest', page.seo?.links.manifest, '<link rel="manifest"> — link to the PWA manifest JSON file') }
        ${ renderKeyValueRow('Favicon', page.seo?.links.favicon, 'URL of the site favicon') }
        ${ renderKeyValueRow('Prev', page.seo?.links.prev, '<link rel="prev"> — link to the previous pagination page') }
        ${ renderKeyValueRow('Next', page.seo?.links.next, '<link rel="next"> — link to the next pagination page') }
        ${ renderKeyValueRow('OpenGraph type', page.seo?.meta.openGraph.type, 'og:type — object type for Open Graph: website, article, product, etc.') }
        ${ renderKeyValueRow('OpenGraph site name', page.seo?.meta.openGraph.siteName, 'og:site_name — site name shown in social media link previews') }
        ${ renderKeyValueRow('OpenGraph locale', page.seo?.meta.openGraph.locale, 'og:locale — language and region of the content, e.g. en_US') }
        ${ renderKeyValueRow('OpenGraph URL', page.seo?.meta.openGraph.url, 'og:url — canonical URL of the page for Open Graph') }
        ${ renderKeyValueRow('OpenGraph Image', page.seo?.meta.openGraph.image, 'og:image — image used when the page is shared on social media') }
        ${ renderKeyValueRow('OpenGraph Image Alt', page.seo?.meta.openGraph.imageAlt, 'og:image:alt — alternative text for the og:image') }
        ${ renderKeyValueRow('OpenGraph Video', page.seo?.meta.openGraph.video, 'og:video — video URL for Open Graph previews') }
        ${ renderKeyValueRow('Twitter URL', page.seo?.meta.twitter.url, 'twitter:url — canonical URL of the page for Twitter Card') }
        ${ renderKeyValueRow('Twitter Image', page.seo?.meta.twitter.image, 'twitter:image — image shown in Twitter/X link previews') }
        ${ renderKeyValueRow('Twitter Image Alt', page.seo?.meta.twitter.imageAlt, 'twitter:image:alt — alternative text for the twitter:image') }
        ${ renderKeyValueRow('Apple iTunes app', page.seo?.meta.appleItunesApp, '<meta name="apple-itunes-app"> — Smart App Banner configuration for iOS') }
        ${ renderKeyValueRow('Facebook domain verification', page.seo?.meta.facebookDomainVerification, '<meta name="facebook-domain-verification"> — domain verification for Facebook Business Manager') }
        ${ renderKeyValueRow('iOS deep link', page.seo?.meta.appLinks?.iosUrl, 'al:ios:url — deep link to open this page in the iOS app') }
        ${ renderKeyValueRow('iOS App Store ID', page.seo?.meta.appLinks?.iosAppStoreId, 'al:ios:app_store_id — App Store identifier of the iOS app') }
        ${ renderKeyValueRow('Android deep link', page.seo?.meta.appLinks?.androidUrl, 'al:android:url — deep link to open this page in the Android app') }
        ${ renderKeyValueRow('Android package', page.seo?.meta.appLinks?.androidPackage, 'al:android:package — package name of the Android app') }
        ${ renderKeyValueRow('Android app store URL', page.seo?.meta.appLinks?.androidAppStoreUrl, 'al:android:app_name or link to the app on Google Play') }
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

      ${ options.hidePreloadLinks ? '' : `<div class="subsection">
        <h3>Preload Links</h3>
        ${ renderPreloadLinks(page.seo?.links.preloads) }
      </div>` }

      ${ options.hidePreconnectLinks ? '' : `<div class="subsection">
        <h3>Preconnect Links</h3>
        ${ renderList(page.seo?.links.preconnects) }
      </div>` }

      ${ options.hideDnsPrefetchLinks ? '' : `<div class="subsection">
        <h3>DNS-prefetch Links</h3>
        ${ renderList(page.seo?.links.dnsPrefetches) }
      </div>` }

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

const renderComparisonTab = (comparison, comparisonEntries) => {
  const hasVariants = Boolean(comparison.variants?.length)
  const comparisonProblemFilter = renderIndexFilter({
    filters: comparison.differenceBreakdown,
    totalCount: comparisonEntries.length,
    allLabel: 'All compared paths',
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
        </div>
      ` : '' }
      <div class="subsection">
        <label class="toggle-switch">
          <input type="checkbox" data-comparison-diff-only>
          <span class="toggle-switch-control" aria-hidden="true"></span>
          <span class="toggle-switch-label">Only differences</span>
        </label>
      </div>
    </section>

    ${ renderIndexedSection({
      cardsHtml,
      description: 'Jump to any compared path. Each card shows the concrete left and right URL for that page.',
      emptyDataAttr: 'data-comparison-empty',
      emptyHidden: comparisonEntries.length > 0,
      emptyMessage: comparisonEntries.length > 0
        ? 'No compared paths match the selected filters.'
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
        items: 'compared paths',
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

const renderVariantGroupedCards = (pageEntries, options = {}) => {
  const groups = buildVariantGroups(pageEntries)

  return [ ...groups.entries() ].map(([ variantLabel, entries ]) => `
    <details class="variant-group" open>
      <summary class="variant-group-title">${ escapeHtml(variantLabel || 'Default') }</summary>
      <section class="page-list">${ entries.map(entry => renderPageCard(entry, options)).join('') }</section>
    </details>
  `).join('')
}

const renderPagesTab = (pageEntries, comparison, options = {}) => {
  const hasVariants = pageEntries.some(entry => entry.variant !== null)
  const sourceFilters = comparison ? buildSourceFilters(pageEntries, entry => entry.source) : []

  const cardsHtml = hasVariants
    ? renderVariantGroupedCards(pageEntries, options)
    : `<section class="page-list">${ pageEntries.map(entry => renderPageCard(entry, options)).join('') }</section>`

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
  const basePageEntries = buildPageEntries(report.pages)
  const comparisonEntries = comparison ? buildComparisonEntries(comparison.comparisons, basePageEntries) : []
  const pageEntries = comparison ? attachComparisonLinksToPageEntries(basePageEntries, comparisonEntries) : basePageEntries
  const pageCardOptions = {
    hideTtfb: Boolean(report.options?.hideTtfb),
    hidePreloadLinks: Boolean(report.options?.hidePreloadLinks),
    hidePreconnectLinks: Boolean(report.options?.hidePreconnectLinks),
    hideDnsPrefetchLinks: Boolean(report.options?.hideDnsPrefetchLinks),
  }
  const fullConfig = report.options?.fullConfig ?? report.options ?? {}
  const fullConfigJson = escapeHtml(stringifyReportJson(fullConfig))
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
      --bg: #000;
      --bg-elevated: #0b0b0b;
      --bg-muted: #151515;
      --bg-code: #0f0f0f;
      --bg-success: #10231c;
      --bg-warning: #2a220f;
      --bg-error: #2a1515;
      --bg-info: #142033;
      --border: #1c1c1c;
      --border-strong: #3a3a3a;
      --text: #f1f1f1;
      --muted: #a1a1a1;
      --tone-strong: #d4d4d4;
      --tone-soft: #b8b8b8;
      --success: #34d399;
      --warning: #fbbf24;
      --error: #f87171;
      --info: #60a5fa;
      --anchor-scroll-offset: 56px;
    }
    html {
      scroll-behavior: smooth;
      scroll-padding-top: var(--anchor-scroll-offset);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      line-height: 1.55;
      background: var(--bg);
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
      background: var(--bg-elevated);
      display: grid;
      gap: 12px;
      min-width: 0;
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
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
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
      background: var(--bg-elevated);
      min-width: 0;
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
      min-width: 0;
    }
    .variant-group {
      display: grid;
      gap: 14px;
      min-width: 0;
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
      padding: 8px 6px 6px 0px;
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
      content: "";
      width: 12px;
      height: 8px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a1a1a1' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
      transition: transform 80ms ease;
      flex-shrink: 0;
      margin-left: 8px;
      transform: rotate(180deg);
    }
    details.variant-group:not([open]) > .variant-group-title::after {
      transform: rotate(0);
    }
    .report-page-card {
      scroll-margin-top: var(--anchor-scroll-offset);
    }
    .page-card {
      padding: 22px;
      min-width: 0;
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
      min-width: 0;
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
    .card-link-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 2px;
    }
    .card-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 24px;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--border-strong);
      background: var(--bg-muted);
      color: var(--info);
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
    }
    .card-link-icon {
      line-height: 1;
    }
    .card-link:hover {
      border-color: var(--info);
      background: var(--bg-info);
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
      padding: 4px 10px;
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
      background: var(--bg-success);
      border-color: #1f4a3c;
      color: var(--success);
    }
    .badge-warning {
      background: var(--bg-warning);
      border-color: #5a4618;
      color: var(--warning);
    }
    .badge-error {
      background: var(--bg-error);
      border-color: #5a2a2a;
      color: var(--error);
    }
    .badge-info {
      background: var(--bg-info);
      border-color: #284766;
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
      padding: 12px 38px 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--bg-muted) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='6' viewBox='0 0 18 6'%3E%3Ccircle cx='3' cy='3' r='1.4' fill='%23a1a1a1'/%3E%3Ccircle cx='9' cy='3' r='1.4' fill='%23a1a1a1'/%3E%3Ccircle cx='15' cy='3' r='1.4' fill='%23a1a1a1'/%3E%3C/svg%3E") no-repeat right 12px center;
      color: var(--text);
      font: inherit;
      appearance: none;
      -webkit-appearance: none;
    }
    .toggle-switch {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--text);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
    }
    .toggle-switch input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .toggle-switch-control {
      width: 42px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid var(--border-strong);
      background: #262626;
      display: inline-flex;
      align-items: center;
      padding: 2px;
      transition: background 120ms ease, border-color 120ms ease;
      flex-shrink: 0;
    }
    .toggle-switch-control::before {
      content: "";
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: var(--tone-strong);
      transition: transform 160ms ease, background 160ms ease;
    }
    .toggle-switch input:checked + .toggle-switch-control {
      border-color: var(--info);
      background: var(--bg-info);
    }
    .toggle-switch input:checked + .toggle-switch-control::before {
      transform: translateX(18px);
      background: var(--info);
    }
    .toggle-switch input:focus-visible + .toggle-switch-control {
      outline: 2px solid var(--info);
      outline-offset: 2px;
    }
    .toggle-switch-label {
      line-height: 1.2;
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
    .page-index-nav .nav-variant-group {
      border: none;
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
      background: var(--bg-elevated);
    }
    .nav-variant-label::-webkit-details-marker {
      display: none;
    }
    .nav-variant-label::after {
      content: "";
      width: 12px;
      height: 8px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a1a1a1' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
      transition: transform 80ms ease;
      flex-shrink: 0;
      margin-left: 6px;
      transform: rotate(180deg);
    }
    details.nav-variant-group:not([open]) > .nav-variant-label::after {
      transform: rotate(0);
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
      transition: border-color 120ms ease, background 120ms ease;
    }
    .page-index-link:hover {
      border-color: var(--border-strong);
    }
    .page-index-link.active {
      border-color: var(--info);
      background: var(--bg-info);
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
    .page-index-issues {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 20px;
      width: fit-content;
    }
    .page-index-issues-error {
      background: var(--bg-error);
      color: var(--error);
    }
    .page-index-issues-warning {
      background: var(--bg-warning);
      color: var(--warning);
    }
    .page-index-issues-info {
      background: var(--bg-info);
      color: var(--info);
    }
    .pages-content {
      display: grid;
      gap: 14px;
      min-width: 0;
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
    .kv-row dt[title] {
      cursor: help;
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }
    .kv-row dd {
      margin: 0;
      word-break: break-word;
    }
    .subsection > .muted {
      margin-top: 8px;
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
      max-width: 100%;
      min-width: 0;
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
      max-width: 100%;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--bg-code);
      color: var(--tone-strong);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .jsonld-block-list {
      display: grid;
      gap: 10px;
    }
    .jsonld-details {
      margin-top: 8px;
      max-width: 100%;
      min-width: 0;
    }
    .jsonld-details summary {
      cursor: pointer;
      color: var(--muted);
      font-weight: 600;
    }
    .jsonld-details pre {
      margin: 10px 0 0;
      padding: 12px;
      overflow: auto;
      max-width: 100%;
      max-height: 420px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-code);
      color: var(--tone-strong);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
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
    .diff-inline-label[title] {
      cursor: help;
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }
    .diff-inline-old {
      text-decoration: line-through;
      color: var(--muted);
      word-break: break-word;
    }
    .diff-arrow {
      color: var(--muted);
      padding-top: 4px;
      font-size: 12px;
    }
    .diff-inline-new,
    .diff-inline-old {
      padding: 2px 8px;
    }
    .diff-inline-new {
      background: var(--bg-success);
      color: var(--success);
      border-radius: 4px;
      word-break: break-word;
    }
    .diff-inline-change {
      border-radius: 3px;
      padding: 0 2px;
      font-weight: 700;
    }
    .diff-inline-change-old {
      background: #3a1717;
      color: #fca5a5;
    }
    .diff-inline-change-new {
      background: #064e3b;
      color: #a7f3d0;
    }
    .diff-inline-row-jsonld {
      grid-template-columns: 130px 1fr;
    }
    .jsonld-compare {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .jsonld-compare-row {
      display: grid;
      grid-template-columns: 84px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-muted);
    }
    .jsonld-compare-status {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      padding-top: 3px;
    }
    .jsonld-compare-row-added .jsonld-compare-status,
    .jsonld-compare-row-same .jsonld-compare-status {
      color: var(--success);
    }
    .jsonld-compare-row-changed .jsonld-compare-status {
      color: var(--warning);
    }
    .jsonld-compare-row-removed .jsonld-compare-status {
      color: var(--error);
    }
    .jsonld-compare-sides {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      min-width: 0;
    }
    .jsonld-compare-side {
      min-width: 0;
      word-break: break-word;
    }
    .jsonld-compare-arrow {
      color: var(--muted);
      font-size: 12px;
      padding-top: 3px;
    }
    .jsonld-block-summary {
      display: block;
      color: var(--tone-strong);
    }
    .jsonld-block-hash {
      display: inline-block;
      margin-top: 3px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
    }
    .diff-inline-row-unchanged .diff-inline-old,
    .diff-inline-row-unchanged .diff-inline-new {
      color: var(--tone-soft);
      background: transparent;
      text-decoration: none;
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
      background: var(--bg-info);
      border-color: #284766;
      color: var(--info);
    }
    .diff-issue-right {
      background: var(--bg-error);
      border-color: #5a2a2a;
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
      border: 1px solid var(--border-strong);
      background: var(--bg-elevated);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      transition: opacity 120ms ease, border-color 120ms ease;
    }
    .scroll-top-btn:hover {
      border-color: var(--info);
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
      .jsonld-compare-sides,
      .jsonld-compare-row {
        grid-template-columns: 1fr;
      }
      .jsonld-compare {
        grid-column: 1;
      }
      .jsonld-compare-arrow {
        display: none;
      }
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
        <span class="eyebrow">SEO Snapshot</span>
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
        <pre>${ fullConfigJson }</pre>
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
        ${ renderComparisonTab(comparison, comparisonEntries) }
      </div>
    ` : '' }

    <div class="tab-panel${ defaultTab !== 'pages' ? ' hidden' : '' }" id="tab-pages">
      ${ renderPagesTab(pageEntries, comparison, pageCardOptions) }
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
          diffOnlyToggle: config.diffOnlyToggleSelector ? document.querySelector(config.diffOnlyToggleSelector) : null,
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
          diffOnlyToggleSelector: '[data-comparison-diff-only]',
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
        updateAnchorScrollOffset()
        if (updateHash) {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#tab-' + name)
          } else {
            location.hash = 'tab-' + name
          }
        }
      }

      function updateAnchorScrollOffset() {
        var stickyTitles = Array.from(document.querySelectorAll('.variant-group-title'))
        var maxStickyTitleHeight = stickyTitles.reduce(function (height, title) {
          var rect = title.getBoundingClientRect()

          return Math.max(height, rect.height)
        }, 0)
        var offset = maxStickyTitleHeight > 0 ? Math.ceil(maxStickyTitleHeight + 16) : 24

        document.documentElement.style.setProperty('--anchor-scroll-offset', offset + 'px')

        return offset
      }

      function scrollToAnchorTarget(target) {
        if (!target || target.classList.contains('hidden')) {
          return
        }

        var offset = updateAnchorScrollOffset()
        var top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset)

        window.scrollTo({ top: top, behavior: 'smooth' })
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

        syncComparisonFieldRows(group)
      }

      function matchesNavGroupFilter(element, group, selectedFilter) {
        if (group.diffOnlyToggle && group.diffOnlyToggle.checked && element.dataset.hasDifferences !== 'true') {
          return false
        }

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

      function syncComparisonFieldRows(group) {
        if (!group || !group.diffOnlyToggle) {
          return
        }

        var diffOnly = group.diffOnlyToggle.checked

        group.cards.forEach(function (card) {
          Array.from(card.querySelectorAll('[data-comparison-field-changed]')).forEach(function (row) {
            var changed = row.dataset.comparisonFieldChanged === 'true'

            row.classList.toggle('hidden', diffOnly && !changed)
          })
        })
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

      function ensureAnchorVisible(anchorId) {
        var target = document.getElementById(anchorId)

        if (!target || !target.classList.contains('hidden')) {
          return
        }

        var group = getNavGroupByTab(getTabForAnchorId(anchorId))

        if (!group) {
          return
        }

        if (group.filter) {
          group.filter.value = 'all'
        }

        if (group.diffOnlyToggle) {
          group.diffOnlyToggle.checked = false
        }

        syncNavGroupFilter(group)
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
          ensureAnchorVisible(state.anchorId)
          setActiveGroupLink(navGroup, state.anchorId)
          clearInactiveNavLinks(state.tab)
          window.requestAnimationFrame(function () {
            var target = document.getElementById(state.anchorId)

            scrollToAnchorTarget(target)
          })
          return
        }

        syncActiveNavLinkFromScroll()
      }

      function handleInternalAnchorClick(event) {
        var link = event.target.closest('a[href^="#"]')

        if (!link) {
          return
        }

        var anchorId = link.getAttribute('href').slice(1)

        if (!anchorId || !document.getElementById(anchorId)) {
          return
        }

        event.preventDefault()

        if (location.hash === '#' + anchorId) {
          syncFromHash()
          return
        }

        location.hash = anchorId
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
        if (group.filter) {
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
        }

        if (group.diffOnlyToggle) {
          group.diffOnlyToggle.addEventListener('change', function () {
            syncNavGroupFilter(group)
            var currentAnchor = location.hash.replace(/^#/, '')
            var currentTarget = document.getElementById(currentAnchor)

            if (currentTarget && currentTarget.classList.contains('hidden')) {
              setActiveGroupLink(group, '')
            } else {
              requestScrollSync()
            }
          })
        }
      })

      if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
      }

      window.addEventListener('hashchange', syncFromHash)
      window.addEventListener('scroll', requestScrollSync, { passive: true })
      window.addEventListener('scroll', syncScrollTopButton, { passive: true })
      window.addEventListener('resize', function () {
        updateAnchorScrollOffset()
        requestScrollSync()
      })
      document.addEventListener('click', handleInternalAnchorClick)

      navGroups.forEach(syncNavGroupFilter)
      updateAnchorScrollOffset()
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
