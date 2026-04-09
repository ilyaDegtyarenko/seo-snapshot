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

export const fetchWithRedirects = async (url, options) => {
  let currentUrl = url
  const redirectChain = []

  for (let step = 0; step <= options.maxRedirects; step += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        'user-agent': options.userAgent,
        'accept': 'text/html,application/xhtml+xml',
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
      return {
        finalUrl: currentUrl,
        redirectChain,
        response,
        body: await response.text(),
      }
    }

    if (step === options.maxRedirects) {
      throw new Error(`Exceeded max redirects (${ options.maxRedirects }) for ${ url }.`)
    }

    currentUrl = resolvedLocation
  }

  throw new Error(`Failed to resolve ${ url }.`)
}
