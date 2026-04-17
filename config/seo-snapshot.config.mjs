export default {
  baseUrl: 'http://127.0.0.1:3000',
  // compare: {
  //   baseUrl: { label: 'stage', url: 'https://stage.example.com' },
  // },
  // profiles: {
  //   staging: {
  //     baseUrl: { label: 'staging', url: 'https://staging.example.com' },
  //     compare: {
  //       baseUrl: { label: 'prod', url: 'https://www.example.com' },
  //     },
  //   },
  // },
  targetsFile: './targets.txt', // Local file. You can also point this to ./targets.local.xml from a sitemap export.
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
    // Or multiple variants:
    // userAgent: [
    //   { label: 'Desktop', userAgent: 'Mozilla/5.0 (Macintosh...)' },
    //   { label: 'Mobile', userAgent: 'Mozilla/5.0 (iPhone...)' },
    // ],
    // headers: { Authorization: 'Bearer token' },
    // cookies: 'session=abc123; token=xyz',  // Or: { session: 'abc123', token: 'xyz' }
  },
  audit: {
    minTitleLength: 15,
    maxTitleLength: 60,
    minDescriptionLength: 70,
    maxDescriptionLength: 160,
    minBodyTextLength: 250,
    // ignore: [ 'missing_twitter_card', 'missing_og_image' ],
  },
}
