export default {
  baseUrl: { url: 'http://127.0.0.1:3000', label: 'Local' },
  compare: {
    baseUrl: { url: 'https://www.example.com', label: 'Prod' },
  },
  profiles: {
    staging: {
      baseUrl: { url: 'https://staging.example.com', label: 'Staging' },
      compare: {
        baseUrl: { url: 'https://www.example.com', label: 'Prod' },
      },
    },
  },
  // targetsFile: './targets.txt',
  // targetsFile: './targets.xml',
  targets: [
    '/',
    '/news',
  ],
  output: {
    dir: '../reports',
    formats: [ 'html', 'json' ],
    // hideTtfb: true,
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
    flagEmptyAlt: false, // set to true to warn on images with alt=""
    ignore: [ 'missing_twitter_card', 'missing_og_image' ],
  },
}
