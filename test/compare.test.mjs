import test from 'node:test'
import assert from 'node:assert/strict'
import { buildComparisonReport } from '../src/compare.mjs'

test('buildComparisonReport highlights SEO field differences across two domains', () => {
  const comparison = buildComparisonReport([
    {
      input: '/news',
      targetPath: '/news',
      source: {
        label: 'prod',
        url: 'https://www.example.com/',
      },
      requestedUrl: 'https://www.example.com/news',
      finalUrl: 'https://www.example.com/news',
      status: 200,
      error: null,
      parseSkippedReason: null,
      headers: {
        xRobotsTag: null,
      },
      seo: {
        document: {
          title: 'Prod title',
          h1: [ 'News' ],
          lang: 'en',
          bodyTextLength: 800,
        },
        meta: {
          description: 'Prod description',
          robots: 'index,follow',
          openGraph: {
            title: 'Prod OG title',
            description: 'Prod OG description',
            url: 'https://www.example.com/news',
            image: 'https://www.example.com/og.jpg',
          },
          twitter: {
            card: 'summary_large_image',
            title: 'Prod twitter title',
            description: 'Prod twitter description',
            image: 'https://www.example.com/twitter.jpg',
          },
        },
        links: {
          canonical: 'https://www.example.com/news',
          alternates: [
            { hreflang: 'en', href: 'https://www.example.com/news' },
          ],
        },
        jsonLd: {
          types: [ 'NewsArticle' ],
        },
      },
      issues: [
        { code: 'missing_og_image', severity: 'info' },
      ],
    },
    {
      input: '/news',
      targetPath: '/news',
      source: {
        label: 'stage',
        url: 'https://stage.example.com/',
      },
      requestedUrl: 'https://stage.example.com/news',
      finalUrl: 'https://stage.example.com/latest-news',
      status: 200,
      error: null,
      parseSkippedReason: null,
      headers: {
        xRobotsTag: 'noindex',
      },
      seo: {
        document: {
          title: 'Stage title',
          h1: [ 'Latest News' ],
          lang: 'en',
          bodyTextLength: 620,
        },
        meta: {
          description: 'Stage description',
          robots: null,
          openGraph: {
            title: 'Stage OG title',
            description: 'Stage OG description',
            url: 'https://stage.example.com/latest-news',
            image: 'https://stage.example.com/og.jpg',
          },
          twitter: {
            card: 'summary',
            title: 'Stage twitter title',
            description: 'Stage twitter description',
            image: 'https://stage.example.com/twitter.jpg',
          },
        },
        links: {
          canonical: 'https://stage.example.com/latest-news',
          alternates: [
            { hreflang: 'en', href: 'https://stage.example.com/latest-news' },
          ],
        },
        jsonLd: {
          types: [ 'Article' ],
        },
      },
      issues: [
        { code: 'noindex', severity: 'warning' },
      ],
    },
  ], {
    sources: [
      { label: 'prod', url: 'https://www.example.com/' },
      { label: 'stage', url: 'https://stage.example.com/' },
    ],
  })

  assert.equal(comparison.targetCount, 1)
  assert.equal(comparison.targetsWithDifferences, 1)
  assert.equal(comparison.totalDifferences > 0, true)
  assert.deepEqual(comparison.comparisons[0].issueDelta, {
    onlyOnLeft: [ 'missing_og_image' ],
    onlyOnRight: [ 'noindex' ],
  })
  assert.deepEqual(comparison.differenceBreakdown.map(entry => entry.key), [
    'bodyTextLength',
    'canonical',
    'description',
    'finalUrl',
    'h1',
    'hreflang',
    'issueCodes',
    'jsonLdTypes',
    'ogDescription',
    'ogImage',
    'ogTitle',
    'ogUrl',
    'robots',
    'title',
    'twitterCard',
    'twitterDescription',
    'twitterImage',
    'twitterTitle',
  ])
})
