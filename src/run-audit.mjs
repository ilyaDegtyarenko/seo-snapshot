import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { buildPageIssues } from './audit.mjs'
import { buildRuntimeOptions, readSeoConfig, resolveTargets } from './config.mjs'
import { extractSeoInfoFromHtml } from './extract-seo.mjs'
import { fetchWithRedirects, isHtmlResponse } from './fetch-page.mjs'
import { renderHtmlReport, renderJsonReport } from './reporters.mjs'
import { formatTimestamp } from './utils.mjs'

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

const buildPageReport = async (target, requestOptions) => {
  try {
    const fetched = await fetchWithRedirects(target.url, requestOptions)
    const contentType = fetched.response.headers.get('content-type')
    const xRobotsTag = fetched.response.headers.get('x-robots-tag')
    const report = {
      input: target.input,
      requestedUrl: target.url,
      finalUrl: fetched.finalUrl,
      status: fetched.response.status,
      ok: fetched.response.ok,
      redirectChain: fetched.redirectChain,
      headers: {
        contentType,
        contentLength: fetched.response.headers.get('content-length'),
        xRobotsTag,
      },
      seo: null,
      parseSkippedReason: null,
      error: null,
      issues: [],
    }

    if (!isHtmlResponse(contentType, fetched.body)) {
      report.parseSkippedReason = 'Response is not HTML.'
      return report
    }

    report.seo = extractSeoInfoFromHtml(fetched.body, fetched.finalUrl)

    return report
  } catch (error) {
    return {
      input: target.input,
      requestedUrl: target.url,
      finalUrl: null,
      status: null,
      ok: false,
      redirectChain: [],
      headers: {
        contentType: null,
        contentLength: null,
        xRobotsTag: null,
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
  })
  const targets = await resolveTargets(config, configDir)
  const pages = await mapWithConcurrency(targets, runtimeOptions.request.concurrency, async (target) => {
    const page = await buildPageReport(target, runtimeOptions.request)

    return {
      ...page,
      issues: buildPageIssues(page, runtimeOptions.audit),
    }
  })

  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      configPath: configLabel,
      baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : null,
      timeoutMs: runtimeOptions.request.timeoutMs,
      maxRedirects: runtimeOptions.request.maxRedirects,
      concurrency: runtimeOptions.request.concurrency,
      targetCount: targets.length,
      formats: runtimeOptions.output.formats,
      outputDir: runtimeOptions.output.dir,
    },
    pages,
  }
  const outputPaths = await writeReports(report, runtimeOptions.output)

  return {
    report,
    outputPaths,
    hasFailures: pages.some(page => page.error || page.status >= 400),
  }
}
