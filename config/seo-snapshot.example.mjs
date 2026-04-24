export default {
  baseUrl: { url: 'http://127.0.0.1:3000', label: 'Local' },
  compareUrl: { url: 'https://www.example.com', label: 'Prod' }, // if set, will compare the base URL against the given URL
  profiles: {
    staging: {
      baseUrl: { url: 'https://staging.example.com', label: 'Staging' },
      compareUrl: null,
      targets: [ '/' ],
    },
    stagingVsProd: {
      baseUrl: { url: 'https://staging.example.com', label: 'Staging' },
      compareUrl: { url: 'https://www.example.com', label: 'Prod' },
    },
  },
  // targetsFile: null, // auto-detects targets.json/txt/xml in config dir; set only for a non-default path
  targets: [
    '/',
    '/about',
    '/contact',
  ],
  output: {
    dir: '../reports',
    formats: [ 'html', 'json' ],
    hideTtfb: false, // set to true to hide TTFB from the report
    hidePreloadLinks: false, // set to true to hide Preload links from the report
    hidePreconnectLinks: false, // set to true to hide Preconnect links from the report
    hideDnsPrefetchLinks: false, // set to true to hide DNS-prefetch links from the report
    compress: false, // set to true to save the HTML report as .html.gz
  },
  request: {
    timeoutMs: 15_000,
    maxRedirects: 10,
    concurrency: 4,
    userAgent: [
      { label: 'Desktop', userAgent: 'Mozilla/5.0 (Macintosh...)' },
      { label: 'Mobile', userAgent: 'Mozilla/5.0 (iPhone...)' },
    ],
    headers: { Authorization: 'Bearer token' },
    cookies: { session: 'abc123', token: 'xyz' },
  },
  audit: {
    minTitleLength: 15,
    maxTitleLength: 60,
    minDescriptionLength: 70,
    maxDescriptionLength: 160,
    minBodyTextLength: 250,
    flagEmptyAlt: true, // set to true to warn on images with alt=""
    ignore: [ 'missing_twitter_card', 'missing_og_image' ],
  },
}
