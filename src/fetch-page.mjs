import { performance } from 'node:perf_hooks'
import { HTML_CONTENT_TYPE_PATTERN } from './constants.mjs'
import { resolveMaybeUrl } from './utils.mjs'

export const isHtmlResponse = (contentType, body) => {
  if (HTML_CONTENT_TYPE_PATTERN.test(String(contentType || ''))) {
    return true
  }

  const normalizedBody = String(body || '').trim().toLowerCase()

  return normalizedBody.startsWith('<!doctype html')
    || normalizedBody.startsWith('<html')
    || normalizedBody.includes('<head')
}

const toDurationMs = (startTime, endTime) => {
  return Math.max(0, Math.round(endTime - startTime))
}

export const fetchWithRedirects = async (url, options) => {
  let currentUrl = url
  const redirectChain = []
  const startTime = performance.now()
  let requestStartTime = startTime

  for (let step = 0; step <= options.maxRedirects; step += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        'user-agent': options.userAgent,
        'accept': 'text/html,application/xhtml+xml',
        ...(options.cookies ? { cookie: options.cookies } : {}),
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(options.timeoutMs),
    })

    const locationHeader = response.headers.get('location')
    const resolvedLocation = resolveMaybeUrl(locationHeader, currentUrl)

    redirectChain.push({
      url: currentUrl,
      status: response.status,
      location: resolvedLocation,
    })

    if (!locationHeader || ![ 301, 302, 303, 307, 308 ].includes(response.status)) {
      const responseHeadersTime = performance.now()
      const ttfbMs = toDurationMs(startTime, responseHeadersTime)
      const finalResponseTtfbMs = toDurationMs(requestStartTime, responseHeadersTime)

      return {
        finalUrl: currentUrl,
        redirectChain,
        response,
        body: await response.text(),
        ttfbMs,
        finalResponseTtfbMs,
      }
    }

    if (step === options.maxRedirects) {
      throw new Error(`Exceeded max redirects (${ options.maxRedirects }) for ${ url }.`)
    }

    currentUrl = resolvedLocation
    requestStartTime = performance.now()
  }

  throw new Error(`Failed to resolve ${ url }.`)
}
