import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { buildPageIssues, buildSummary } from './audit.mjs'
import { buildComparisonReport } from './compare.mjs'
import { buildRuntimeOptions, readSeoConfig, resolveTargets } from './config.mjs'
import { extractSeoInfoFromHtml } from './extract-seo.mjs'
import { fetchWithRedirects, isHtmlResponse } from './fetch-page.mjs'
import { renderHtmlReport, renderJsonReport } from './reporters.mjs'
import { parseLinkHeader, formatTimestamp } from './utils.mjs'

const mapWithConcurrency = async (items, concurrency, worker) => {
  const results = new Array(items.length)
  let cursor = 0

  const runWorker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor

      cursor += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }

  const poolSize = Math.max(1, Math.min(concurrency, items.length))

  await Promise.all(Array.from({ length: poolSize }, runWorker))

  return results
}

const buildHeaderDetails = (response, finalUrl) => {
  const contentType = response.headers.get('content-type')
  const contentLength = response.headers.get('content-length')
  const contentLanguage = response.headers.get('content-language')
  const xRobotsTag = response.headers.get('x-robots-tag')
  const contentSecurityPolicy = response.headers.get('content-security-policy')
  const xFrameOptions = response.headers.get('x-frame-options')
  const link = response.headers.get('link')
  const linkEntries = parseLinkHeader(link, finalUrl)
  const findLinkByRel = rel => linkEntries.find(entry => entry.relTokens?.includes(rel))?.href ?? null

  return {
    contentType,
    contentLength,
    contentLanguage,
    xRobotsTag,
    contentSecurityPolicy,
    xFrameOptions,
    link,
    links: {
      entries: linkEntries,
      canonical: findLinkByRel('canonical'),
      llms: findLinkByRel('llms'),
    },
  }
}

const buildPageReport = async (target, requestOptions) => {
  const effectiveOptions = target.variant
    ? { ...requestOptions, userAgent: target.variant.userAgent }
    : requestOptions

  try {
    const fetched = await fetchWithRedirects(target.url, effectiveOptions)
    const headers = buildHeaderDetails(fetched.response, fetched.finalUrl)
    const report = {
      input: target.input,
      targetPath: target.path ?? target.input,
      source: target.source ?? null,
      variant: target.variant?.label ?? null,
      variantId: target.variant?.id ?? null,
      requestedUrl: target.url,
      finalUrl: fetched.finalUrl,
      status: fetched.response.status,
      ok: fetched.response.ok,
      redirectChain: fetched.redirectChain,
      ttfbMs: fetched.ttfbMs,
      finalResponseTtfbMs: fetched.finalResponseTtfbMs,
      headers,
      seo: null,
      parseSkippedReason: null,
      error: null,
      issues: [],
    }

    if (!isHtmlResponse(headers.contentType, fetched.body)) {
      report.parseSkippedReason = 'Response is not HTML.'
      return report
    }

    report.seo = extractSeoInfoFromHtml(fetched.body, fetched.finalUrl)

    return report
  } catch (error) {
    return {
      input: target.input,
      targetPath: target.path ?? target.input,
      source: target.source ?? null,
      variant: target.variant?.label ?? null,
      variantId: target.variant?.id ?? null,
      requestedUrl: target.url,
      finalUrl: null,
      status: null,
      ok: false,
      redirectChain: [],
      ttfbMs: null,
      finalResponseTtfbMs: null,
      headers: {
        contentType: null,
        contentLength: null,
        contentLanguage: null,
        xRobotsTag: null,
        contentSecurityPolicy: null,
        xFrameOptions: null,
        link: null,
        links: {
          entries: [],
          canonical: null,
          llms: null,
        },
      },
      seo: null,
      parseSkippedReason: null,
      error: error instanceof Error ? error.message : String(error),
      issues: [],
    }
  }
}

const writeReports = async (report, outputOptions) => {
  const generatedAt = new Date(report.generatedAt)
  const reportTimestamp = formatTimestamp(generatedAt)
  const reportBasePath = path.join(outputOptions.dir, `seo-report-${ reportTimestamp }`)
  const outputPaths = []

  await mkdir(outputOptions.dir, { recursive: true })

  for (const format of outputOptions.formats) {
    const filePath = `${ reportBasePath }.${ format }`
    const fileContent = format === 'html'
      ? renderHtmlReport(report)
      : renderJsonReport(report)

    await writeFile(filePath, fileContent, 'utf8')
    outputPaths.push(filePath)
  }

  return outputPaths
}

export const runAudit = async (cliOptions, runtime = {}) => {
  const cwd = runtime.cwd ?? process.cwd()
  const {
    config,
    configDir,
    configLabel,
  } = await readSeoConfig(cliOptions.configPath, cwd, runtime.env ?? process.env)
  const runtimeOptions = buildRuntimeOptions({
    config,
    configDir,
    cliOptions,
    cwd,
  })
  const baseTargets = await resolveTargets(config, configDir)
  const targets = runtimeOptions.variants
    ? baseTargets.flatMap(target => runtimeOptions.variants.map(variant => ({ ...target, variant })))
    : baseTargets
  const onProgress = runtime.onProgress ?? null
  let completedCount = 0
  const totalCount = targets.length

  const pages = await mapWithConcurrency(targets, runtimeOptions.request.concurrency, async (target) => {
    const page = await buildPageReport(target, runtimeOptions.request)
    completedCount += 1

    if (onProgress) {
      const label = target.path ?? target.input ?? target.url

      onProgress(`[${ completedCount }/${ totalCount }] ${ label }`)
    }

    return {
      ...page,
      issues: buildPageIssues(page, runtimeOptions.audit),
    }
  })
  const summary = buildSummary(pages)
  const comparison = buildComparisonReport(pages, runtimeOptions.compare, runtimeOptions.output.hideTtfb)
  const fullConfig = {
    ...config,
    request: runtimeOptions.request,
    output: runtimeOptions.output,
    compare: runtimeOptions.compare,
    variants: runtimeOptions.variants,
    audit: runtimeOptions.audit,
    targetCount: targets.length,
  }

  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      configPath: configLabel,
      fullConfig,
      baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : null,
      compare: runtimeOptions.compare,
      timeoutMs: runtimeOptions.request.timeoutMs,
      maxRedirects: runtimeOptions.request.maxRedirects,
      concurrency: runtimeOptions.request.concurrency,
      userAgent: runtimeOptions.request.userAgent,
      variants: runtimeOptions.variants ? runtimeOptions.variants.map(v => v.label) : null,
      targetCount: targets.length,
      formats: runtimeOptions.output.formats,
      outputDir: runtimeOptions.output.dir,
      hideTtfb: runtimeOptions.output.hideTtfb,
      audit: runtimeOptions.audit,
    },
    summary,
    comparison,
    pages,
  }
  const outputPaths = await writeReports(report, runtimeOptions.output)
  const htmlOutputPath = outputPaths.find(outputPath => outputPath.endsWith('.html')) ?? null

  return {
    report,
    summary,
    outputPaths,
    htmlOutputPath,
    hasFailures: pages.some(page => page.error || page.status >= 400),
  }
}
