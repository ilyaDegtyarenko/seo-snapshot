export default {
  baseUrl: 'http://127.0.0.1:3000',
  targetsFile: './targets.txt',
  targets: [
    // '/',
    // '/news',
  ],
  output: {
    dir: '../reports',
    formats: [ 'html', 'json' ],
  },
  request: {
    timeoutMs: 15_000,
    maxRedirects: 10,
    concurrency: 4,
    userAgent: 'Mozilla/5.0 (compatible; SEO-Snapshot/1.0)',
  },
  audit: {
    minTitleLength: 15,
    maxTitleLength: 60,
    minDescriptionLength: 70,
    maxDescriptionLength: 160,
    minBodyTextLength: 250,
  },
}
