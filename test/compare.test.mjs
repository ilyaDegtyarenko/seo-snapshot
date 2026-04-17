import test from 'node:test'
import assert from 'node:assert/strict'
import { buildComparisonReport } from '../src/compare.mjs'

const comparisonSources = [
  { label: 'prod', url: 'https://www.example.com/' },
  { label: 'stage', url: 'https://stage.example.com/' },
]

const createComparablePage = ({
  alternates = [],
  responseTimeMs = 100,
  bodyTextLength = 400,
  imageCount = 0,
  imagesWithoutAlt = 0,
  internalLinkCount = 0,
  headingHierarchy = [ 1, 2 ],
  canonical,
  description = 'Catalog description',
  finalUrl,
  headerCanonical = null,
  headerLinkEntries = [],
  headerLlms = null,
  h1 = [ 'Catalog' ],
  input = '/catalog',
  issues = [],
  lang = 'en',
  ogImage = null,
  ogTitle = null,
  ogDescription = null,
  ogUrl = null,
  robots = 'index,follow',
  source,
  status = 200,
  targetPath = input,
  title = 'Catalog',
  variant = null,
  variantId = null,
  jsonLdHasOrganization = undefined,
  jsonLdHasWebSite = undefined,
  jsonLdMissingRequiredProperties = [],
  jsonLdTypes = [],
  twitterCard = null,
  twitterDescription = null,
  twitterImage = null,
  twitterTitle = null,
  contentSecurityPolicy = null,
  xFrameOptions = null,
  xRobotsTag = null,
}) => ({
  input,
  targetPath,
  source,
  variant,
  variantId,
  requestedUrl: finalUrl,
  finalUrl,
  status,
  responseTimeMs,
  error: null,
  parseSkippedReason: null,
  headers: {
    contentSecurityPolicy,
    xFrameOptions,
    xRobotsTag,
    links: {
      canonical: headerCanonical,
      llms: headerLlms,
      entries: headerLinkEntries,
    },
  },
  seo: {
    document: {
      title,
      h1,
      lang,
      bodyTextLength,
      imageCount,
      imagesWithoutAlt,
      internalLinkCount,
      headingHierarchy,
    },
    meta: {
      description,
      robots,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        url: ogUrl,
        image: ogImage,
      },
      twitter: {
        card: twitterCard,
        title: twitterTitle,
        description: twitterDescription,
        image: twitterImage,
      },
    },
    links: {
      canonical,
      alternates,
    },
    jsonLd: {
      hasWebSite: jsonLdHasWebSite,
      hasOrganization: jsonLdHasOrganization,
      missingRequiredProperties: jsonLdMissingRequiredProperties,
      types: jsonLdTypes,
    },
  },
  issues,
})

test('buildComparisonReport highlights SEO field differences across two domains', () => {
  const comparison = buildComparisonReport([
    createComparablePage({
      input: '/news',
      targetPath: '/news',
      source: comparisonSources[0],
      finalUrl: 'https://www.example.com/news',
      title: 'Prod title',
      description: 'Prod description',
      responseTimeMs: 100,
      bodyTextLength: 800,
      imageCount: 5,
      imagesWithoutAlt: 0,
      internalLinkCount: 24,
      headingHierarchy: [ 1, 2 ],
      h1: [ 'News' ],
      canonical: 'https://www.example.com/news',
      alternates: [
        { hreflang: 'en', href: 'https://www.example.com/news' },
      ],
      ogTitle: 'Prod OG title',
      ogDescription: 'Prod OG description',
      ogUrl: 'https://www.example.com/news',
      ogImage: 'https://www.example.com/og.jpg',
      twitterCard: 'summary_large_image',
      twitterTitle: 'Prod twitter title',
      twitterDescription: 'Prod twitter description',
      twitterImage: 'https://www.example.com/twitter.jpg',
      contentSecurityPolicy: "default-src 'self'",
      xFrameOptions: 'SAMEORIGIN',
      headerCanonical: 'https://www.example.com/news',
      headerLlms: 'https://www.example.com/llms.txt',
      headerLinkEntries: [
        { rel: 'canonical', href: 'https://www.example.com/news' },
        { rel: 'llms', type: 'text/plain', href: 'https://www.example.com/llms.txt' },
      ],
      jsonLdHasWebSite: true,
      jsonLdHasOrganization: true,
      jsonLdMissingRequiredProperties: [],
      jsonLdTypes: [ 'NewsArticle' ],
      issues: [
        { code: 'missing_og_image', severity: 'info' },
      ],
    }),
    createComparablePage({
      input: '/news',
      targetPath: '/news',
      source: comparisonSources[1],
      finalUrl: 'https://stage.example.com/latest-news',
      title: 'Stage title',
      description: 'Stage description',
      responseTimeMs: 220,
      bodyTextLength: 620,
      imageCount: 3,
      imagesWithoutAlt: 2,
      internalLinkCount: 18,
      headingHierarchy: [ 1, 3 ],
      h1: [ 'Latest News' ],
      canonical: 'https://stage.example.com/latest-news',
      alternates: [
        { hreflang: 'en', href: 'https://stage.example.com/latest-news' },
      ],
      ogTitle: 'Stage OG title',
      ogDescription: 'Stage OG description',
      ogUrl: 'https://stage.example.com/latest-news',
      ogImage: 'https://stage.example.com/og.jpg',
      twitterCard: 'summary',
      twitterTitle: 'Stage twitter title',
      twitterDescription: 'Stage twitter description',
      twitterImage: 'https://stage.example.com/twitter.jpg',
      contentSecurityPolicy: "default-src 'none'",
      xFrameOptions: 'DENY',
      robots: null,
      xRobotsTag: 'noindex',
      headerCanonical: 'https://www.example.com/news',
      headerLlms: 'https://stage.example.com/llms.txt',
      headerLinkEntries: [
        { rel: 'canonical', href: 'https://www.example.com/news' },
        { rel: 'llms', type: 'text/plain', href: 'https://stage.example.com/llms.txt' },
      ],
      jsonLdHasWebSite: false,
      jsonLdHasOrganization: false,
      jsonLdMissingRequiredProperties: [ { type: 'Article', property: 'author' } ],
      jsonLdTypes: [ 'Article' ],
      issues: [
        { code: 'noindex', severity: 'warning' },
      ],
    }),
  ], {
    sources: comparisonSources,
  })

  assert.equal(comparison.targetCount, 1)
  assert.equal(comparison.targetsWithDifferences, 1)
  assert.equal(comparison.totalDifferences > 0, true)
  assert.deepEqual(comparison.comparisons[0].issueDelta, {
    onlyOnLeft: [ 'missing_og_image' ],
    onlyOnRight: [ 'noindex' ],
  })
  const differenceKeys = comparison.differenceBreakdown.map(entry => entry.key)

  assert.equal(differenceKeys.includes('bodyTextLength'), true)
  assert.equal(differenceKeys.includes('canonical'), true)
  assert.equal(differenceKeys.includes('contentSecurityPolicy'), true)
  assert.equal(differenceKeys.includes('description'), true)
  assert.equal(differenceKeys.includes('finalUrl'), true)
  assert.equal(differenceKeys.includes('h1'), true)
  assert.equal(differenceKeys.includes('hreflang'), true)
  assert.equal(differenceKeys.includes('imageCount'), true)
  assert.equal(differenceKeys.includes('imagesWithoutAlt'), true)
  assert.equal(differenceKeys.includes('internalLinkCount'), true)
  assert.equal(differenceKeys.includes('issueCodes'), true)
  assert.equal(differenceKeys.includes('jsonLdTypes'), true)
  assert.equal(differenceKeys.includes('jsonLdHasOrganization'), true)
  assert.equal(differenceKeys.includes('jsonLdHasWebSite'), true)
  assert.equal(differenceKeys.includes('jsonLdMissingRequiredProperties'), true)
  assert.equal(differenceKeys.includes('linkHeaderCanonical'), true)
  assert.equal(differenceKeys.includes('linkHeaderCanonicalCrossDomain'), true)
  assert.equal(differenceKeys.includes('linkHeaderEntries'), true)
  assert.equal(differenceKeys.includes('linkHeaderLlms'), true)
  assert.equal(differenceKeys.includes('metaRobots'), true)
  assert.equal(differenceKeys.includes('ogDescription'), true)
  assert.equal(differenceKeys.includes('ogImage'), true)
  assert.equal(differenceKeys.includes('ogTitle'), true)
  assert.equal(differenceKeys.includes('ogUrl'), true)
  assert.equal(differenceKeys.includes('responseTimeMs'), true)
  assert.equal(differenceKeys.includes('title'), true)
  assert.equal(differenceKeys.includes('twitterCard'), true)
  assert.equal(differenceKeys.includes('twitterDescription'), true)
  assert.equal(differenceKeys.includes('twitterImage'), true)
  assert.equal(differenceKeys.includes('twitterTitle'), true)
  assert.equal(differenceKeys.includes('xFrameOptions'), true)
  assert.equal(differenceKeys.includes('xRobotsTag'), true)
})

test('buildComparisonReport compares source-local URLs by path but still catches foreign-host leaks', () => {
  const noLeakComparison = buildComparisonReport([
    createComparablePage({
      source: comparisonSources[0],
      finalUrl: 'https://www.example.com/catalog',
      canonical: 'https://www.example.com/catalog',
      headerCanonical: 'https://www.example.com/catalog',
      ogUrl: 'https://www.example.com/catalog',
    }),
    createComparablePage({
      source: comparisonSources[1],
      finalUrl: 'https://stage.example.com/catalog',
      canonical: 'https://stage.example.com/catalog',
      headerCanonical: 'https://stage.example.com/catalog',
      ogUrl: 'https://stage.example.com/catalog',
    }),
  ], {
    sources: comparisonSources,
  })

  assert.deepEqual(noLeakComparison.comparisons[0].differences, [])

  const leakComparison = buildComparisonReport([
    createComparablePage({
      source: comparisonSources[0],
      finalUrl: 'https://www.example.com/catalog',
      canonical: 'https://www.example.com/catalog',
      headerCanonical: 'https://www.example.com/catalog',
      ogUrl: 'https://www.example.com/catalog',
    }),
    createComparablePage({
      source: comparisonSources[1],
      finalUrl: 'https://stage.example.com/catalog',
      canonical: 'https://www.example.com/catalog',
      headerCanonical: 'https://www.example.com/catalog',
      ogUrl: 'https://www.example.com/catalog',
    }),
  ], {
    sources: comparisonSources,
  })

  const leakKeys = leakComparison.comparisons[0].differences.map(entry => entry.key)

  assert.equal(leakKeys.includes('canonical'), true)
  assert.equal(leakKeys.includes('canonicalCrossDomain'), true)
  assert.equal(leakKeys.includes('linkHeaderCanonical'), true)
  assert.equal(leakKeys.includes('linkHeaderCanonicalCrossDomain'), true)
  assert.equal(leakKeys.includes('ogUrl'), true)
  assert.equal(leakKeys.includes('ogUrlCrossDomain'), true)
})

test('buildComparisonReport treats identical absolute linkHeaderLlms URLs as equal across different source domains', () => {
  const sharedLlmsUrl = 'https://www.example.com/llms.txt'

  const comparison = buildComparisonReport([
    createComparablePage({
      source: comparisonSources[0],
      finalUrl: 'https://www.example.com/catalog',
      headerLlms: sharedLlmsUrl,
    }),
    createComparablePage({
      source: comparisonSources[1],
      finalUrl: 'https://stage.example.com/catalog',
      headerLlms: sharedLlmsUrl,
    }),
  ], {
    sources: comparisonSources,
  })

  const differenceKeys = comparison.comparisons[0].differences.map(entry => entry.key)

  assert.equal(differenceKeys.includes('linkHeaderLlms'), false)
})

test('buildComparisonReport keeps duplicate variant labels as separate comparisons when variant ids differ', () => {
  const comparison = buildComparisonReport([
    createComparablePage({
      source: comparisonSources[0],
      finalUrl: 'https://www.example.com/catalog',
      title: 'Desktop prod',
      variant: 'Bot',
      variantId: 'variant-1',
    }),
    createComparablePage({
      source: comparisonSources[1],
      finalUrl: 'https://stage.example.com/catalog',
      title: 'Desktop stage',
      variant: 'Bot',
      variantId: 'variant-1',
    }),
    createComparablePage({
      source: comparisonSources[0],
      finalUrl: 'https://www.example.com/catalog',
      title: 'Mobile prod',
      variant: 'Bot',
      variantId: 'variant-2',
    }),
    createComparablePage({
      source: comparisonSources[1],
      finalUrl: 'https://stage.example.com/catalog',
      title: 'Mobile stage',
      variant: 'Bot',
      variantId: 'variant-2',
    }),
  ], {
    sources: comparisonSources,
  })

  assert.equal(comparison.targetCount, 2)
  assert.equal(comparison.targetsWithDifferences, 2)
  assert.equal(comparison.totalDifferences, 2)
  assert.deepEqual(comparison.comparisons.map(entry => entry.variantId), [
    'variant-1',
    'variant-2',
  ])
  assert.deepEqual(comparison.variants, [ 'Bot' ])
})
