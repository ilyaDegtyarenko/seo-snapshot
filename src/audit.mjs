import { getLength, isSourceLocalUrl, sortByCountDesc } from './utils.mjs'

const HOMEPAGE_PATH_PATTERN = /^\/(?:[a-z]{2}(?:-[a-z]{2})?)?\/?$/i
const ISO_639_1_LANGUAGE_CODES = new Set(`
  aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz
  ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik
  io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml
  mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd
  se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi
  vo wa wo xh yi yo za zh zu
`.trim().split(/\s+/))
const ISO_3166_1_ALPHA_2_REGION_CODES = new Set(`
  ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw
  by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi
  fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in
  io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me
  mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf
  pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv
  sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws ye
  yt za zm zw
`.trim().split(/\s+/))
const ISO_15924_SCRIPT_CODES = new Set(`
  adlm afak aghb ahom arab aran armi armn avst bali bamu bass batk beng berf bhks blis bopo brah brai bugi
  buhd cakm cans cari cham cher chis chrs cirt copt cpmn cprt cyrl cyrs deva diak dogr dsrt dupl egyd egyh
  egyp elba elym ethi gara geok geor glag gong gonm goth gran grek gujr gukh guru hanb hang hani hano hans
  hant hatr hebr hira hluw hmng hmnp hntl hrkt hung inds ital jamo java jpan jurc kali kana kawi khar khmr
  khoj kitl kits knda kore kpel krai kthi lana laoo latf latg latn leke lepc limb lina linb lisu loma lyci
  lydi mahj maka mand mani marc maya medf mend merc mero mlym modi mong moon mroo mtei mult mymr nagm nand
  narb nbat newa nkdb nkgb nkoo nshu ogam olck onao orkh orya osge osma ougr palm pauc pcun pelm perm phag
  phli phlp phlv phnx plrd piqd prti psin qaaa qabx ranj rjng rohg roro runr samr sara sarb saur seal sgnw
  shaw shrd shui sidd sidt sind sinh sogd sogo sora soyo sund sunu sylo syrc syre syrj syrn tagb takr tale
  talu taml tang tavt tayo telu teng tfng tglg thaa thai tibt tirh tnsa todr tols toto tutg ugar vaii visp
  vith wara wcho wole xpeo xsux yezi yiii zanb zinh zmth zsye zsym zxxx zyyy zzzz
`.trim().split(/\s+/))

const pushIssue = (issues, severity, code, message) => {
  issues.push({
    severity,
    code,
    message,
  })
}

const filterIgnoredIssues = (issues, rules) => {
  const ignoredCodes = new Set((rules.ignore ?? []).map(code => String(code || '').trim()).filter(Boolean))

  if (ignoredCodes.size === 0) {
    return issues
  }

  return issues.filter(issue => !ignoredCodes.has(issue.code))
}

const DUPLICATE_SIGNAL_ISSUE_MAP = {
  title: {
    code: 'duplicate_title',
    message: count => `Multiple <title> tags found (${ count }).`,
  },
  description: {
    code: 'duplicate_description',
    message: count => `Multiple meta description tags found (${ count }).`,
  },
  robots: {
    code: 'duplicate_robots',
    message: count => `Multiple meta robots tags found (${ count }).`,
  },
  canonical: {
    code: 'duplicate_canonical',
    message: count => `Multiple canonical links found (${ count }).`,
  },
  viewport: {
    code: 'duplicate_viewport',
    message: count => `Multiple viewport meta tags found (${ count }).`,
  },
  ogTitle: {
    code: 'duplicate_og_title',
    message: count => `Multiple og:title tags found (${ count }).`,
  },
  ogDescription: {
    code: 'duplicate_og_description',
    message: count => `Multiple og:description tags found (${ count }).`,
  },
  ogType: {
    code: 'duplicate_og_type',
    message: count => `Multiple og:type tags found (${ count }).`,
  },
  ogUrl: {
    code: 'duplicate_og_url',
    message: count => `Multiple og:url tags found (${ count }).`,
  },
  ogImage: {
    code: 'duplicate_og_image',
    message: count => `Multiple og:image tags found (${ count }).`,
  },
  twitterCard: {
    code: 'duplicate_twitter_card',
    message: count => `Multiple twitter:card tags found (${ count }).`,
  },
  twitterTitle: {
    code: 'duplicate_twitter_title',
    message: count => `Multiple twitter:title tags found (${ count }).`,
  },
  twitterDescription: {
    code: 'duplicate_twitter_description',
    message: count => `Multiple twitter:description tags found (${ count }).`,
  },
  twitterImage: {
    code: 'duplicate_twitter_image',
    message: count => `Multiple twitter:image tags found (${ count }).`,
  },
  manifest: {
    code: 'duplicate_manifest',
    message: count => `Multiple manifest links found (${ count }).`,
  },
  appleItunesApp: {
    code: 'duplicate_apple_itunes_app',
    message: count => `Multiple apple-itunes-app tags found (${ count }).`,
  },
}

const normalizeLocaleCode = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
}

const resolvePagePathname = (page) => {
  for (const candidate of [ page.targetPath, page.finalUrl, page.requestedUrl, page.input ]) {
    if (!candidate) {
      continue
    }

    try {
      return new URL(String(candidate), 'https://seo-snapshot.local').pathname
    } catch {
      continue
    }
  }

  return null
}

const isHomepageLikePage = (page) => {
  const pathname = resolvePagePathname(page)

  if (!pathname) {
    return false
  }

  return HOMEPAGE_PATH_PATTERN.test(pathname)
}

const isFullyQualifiedHttpUrl = (value) => {
  if (!value) {
    return false
  }

  try {
    const parsed = new URL(String(value))

    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const isSupportedHreflangValue = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()

  if (normalizedValue === 'x-default') {
    return true
  }

  if (!normalizedValue || normalizedValue.includes('_')) {
    return false
  }

  const parts = normalizedValue.split('-')
  const [ language ] = parts
  let cursor = 1

  if (!ISO_639_1_LANGUAGE_CODES.has(language)) {
    return false
  }

  if (parts[cursor] && /^[a-z]{4}$/.test(parts[cursor])) {
    if (!ISO_15924_SCRIPT_CODES.has(parts[cursor])) {
      return false
    }

    cursor += 1
  }

  if (parts[cursor] && /^[a-z]{2}$/.test(parts[cursor])) {
    if (!ISO_3166_1_ALPHA_2_REGION_CODES.has(parts[cursor])) {
      return false
    }

    cursor += 1
  }

  return cursor === parts.length
}

const isValidHreflangLink = (link) => {
  return isSupportedHreflangValue(link?.hreflang)
    && isFullyQualifiedHttpUrl(link?.rawHref ?? link?.href)
    && isFullyQualifiedHttpUrl(link?.href)
}

const countInvalidHreflangLinks = (alternates) => {
  if (!Array.isArray(alternates)) {
    return 0
  }

  return alternates.filter(link => !isValidHreflangLink(link)).length
}

const hasSelfHreflang = (lang, alternates) => {
  const normalizedLang = normalizeLocaleCode(lang)

  if (!normalizedLang || !Array.isArray(alternates) || alternates.length === 0) {
    return false
  }

  return alternates.some((link) => {
    const hreflang = normalizeLocaleCode(link?.hreflang)

    if (!isValidHreflangLink(link) || !hreflang || hreflang === 'x-default') {
      return false
    }

    return hreflang === normalizedLang
      || hreflang.startsWith(`${ normalizedLang }-`)
      || normalizedLang.startsWith(`${ hreflang }-`)
  })
}

export const buildPageIssues = (page, rules) => {
  const issues = []

  if (page.error) {
    pushIssue(issues, 'error', 'fetch_error', page.error)
    return filterIgnoredIssues(issues, rules)
  }

  if (page.status >= 500) {
    pushIssue(issues, 'error', 'http_5xx', `Server returned ${ page.status }.`)
  } else if (page.status >= 400) {
    pushIssue(issues, 'warning', 'http_4xx', `Page returned ${ page.status }.`)
  }

  if (page.parseSkippedReason) {
    pushIssue(issues, 'warning', 'non_html', page.parseSkippedReason)
    return filterIgnoredIssues(issues, rules)
  }

  const title = page.seo?.document.title
  const description = page.seo?.meta.description
  const h1 = page.seo?.document.h1 ?? []
  const lang = page.seo?.document.lang
  const canonical = page.seo?.links.canonical
  const headerCanonical = page.headers?.links?.canonical
  const headerLlms = page.headers?.links?.llms
  const robots = `${ page.seo?.meta.robots || '' } ${ page.headers?.xRobotsTag || '' }`.toLowerCase()
  const openGraph = page.seo?.meta.openGraph ?? {}
  const twitter = page.seo?.meta.twitter ?? {}
  const jsonLd = page.seo?.jsonLd ?? { scriptCount: 0, parseErrors: 0 }
  const hreflangLinks = page.seo?.links.alternates ?? []
  const bodyTextLength = page.seo?.document.bodyTextLength ?? 0
  const hasHomepagePath = isHomepageLikePage(page)

  const titleLength = getLength(title)
  const descriptionLength = getLength(description)

  if (!title) {
    pushIssue(issues, 'error', 'missing_title', 'Missing <title>.')
  } else if (titleLength < rules.minTitleLength) {
    pushIssue(issues, 'warning', 'short_title', `Title is too short (${ titleLength }).`)
  } else if (titleLength > rules.maxTitleLength) {
    pushIssue(issues, 'warning', 'long_title', `Title is too long (${ titleLength }).`)
  }

  if (!description) {
    pushIssue(issues, 'warning', 'missing_description', 'Missing meta description.')
  } else if (descriptionLength < rules.minDescriptionLength) {
    pushIssue(issues, 'warning', 'short_description', `Meta description is too short (${ descriptionLength }).`)
  } else if (descriptionLength > rules.maxDescriptionLength) {
    pushIssue(issues, 'warning', 'long_description', `Meta description is too long (${ descriptionLength }).`)
  }

  if (h1.length === 0) {
    pushIssue(issues, 'warning', 'missing_h1', 'Missing H1.')
  } else if (h1.length > 1) {
    pushIssue(issues, 'warning', 'multiple_h1', `Page contains ${ h1.length } H1 headings.`)
  }

  if (!lang) {
    pushIssue(issues, 'warning', 'missing_lang', 'Missing lang attribute on <html>.')
  }

  const contentLanguage = page.headers?.contentLanguage ?? page.seo?.document.contentLanguage

  if (lang && contentLanguage) {
    const normalizedLang = normalizeLocaleCode(lang)
    const normalizedContentLanguages = String(contentLanguage)
      .split(',')
      .map(value => normalizeLocaleCode(value))
      .filter(Boolean)
    const hasCompatibleContentLanguage = normalizedContentLanguages.some(contentLanguageValue =>
      normalizedLang === contentLanguageValue
      || normalizedLang.startsWith(`${ contentLanguageValue }-`)
      || contentLanguageValue.startsWith(`${ normalizedLang }-`)
    )

    if (normalizedLang && normalizedContentLanguages.length > 0 && !hasCompatibleContentLanguage) {
      pushIssue(issues, 'warning', 'lang_content_language_mismatch', `html lang "${ lang }" does not match Content-Language "${ contentLanguage }".`)
    }
  }

  for (const duplicate of page.seo?.head?.duplicates ?? []) {
    const duplicateIssue = DUPLICATE_SIGNAL_ISSUE_MAP[duplicate.key]

    if (!duplicateIssue) {
      continue
    }

    pushIssue(issues, 'warning', duplicateIssue.code, duplicateIssue.message(duplicate.count))
  }

  if (!canonical) {
    pushIssue(issues, 'warning', 'missing_canonical', 'Missing canonical link.')
  } else if (isSourceLocalUrl(canonical, page) === false) {
    pushIssue(issues, 'warning', 'canonical_cross_domain', 'Canonical points to a different host.')
  }

  if (canonical && page.finalUrl) {
    try {
      const canonicalPath = new URL(canonical).pathname
      const finalPath = new URL(page.finalUrl).pathname
      const canonicalHasTrailing = canonicalPath.length > 1 && canonicalPath.endsWith('/')
      const finalHasTrailing = finalPath.length > 1 && finalPath.endsWith('/')

      if (canonicalHasTrailing !== finalHasTrailing) {
        pushIssue(issues, 'warning', 'canonical_trailing_slash_mismatch', 'Canonical URL trailing slash does not match the page URL.')
      }
    } catch {
      // skip if either URL is unparseable
    }
  }

  if (headerCanonical && canonical) {
    let normalizedHeaderCanonical = headerCanonical
    let normalizedHtmlCanonical = canonical

    try {
      normalizedHeaderCanonical = new URL(headerCanonical).toString()
      normalizedHtmlCanonical = new URL(canonical).toString()
    } catch {
      // fall back to raw string comparison
    }

    if (normalizedHeaderCanonical !== normalizedHtmlCanonical) {
      pushIssue(issues, 'warning', 'header_canonical_mismatch', 'Response Link canonical does not match HTML canonical.')
    }
  }

  if (robots.includes('noindex')) {
    pushIssue(issues, 'warning', 'noindex', 'Page is marked as noindex.')
  }

  if (!page.seo?.meta.robots) {
    pushIssue(issues, 'info', 'missing_meta_robots', 'Missing meta robots tag.')
  }

  const invalidHreflangCount = countInvalidHreflangLinks(hreflangLinks)

  if (hasHomepagePath && hreflangLinks.length === 0) {
    pushIssue(issues, 'info', 'missing_hreflang', 'Missing hreflang alternate links on a homepage-like route.')
  }

  if (invalidHreflangCount > 0) {
    pushIssue(issues, 'warning', 'invalid_hreflang', `${ invalidHreflangCount } hreflang link(s) have a missing or invalid fully-qualified href or hreflang value.`)
  }

  if (hreflangLinks.length > 0 && !hreflangLinks.some(link => normalizeLocaleCode(link?.hreflang) === 'x-default' && isValidHreflangLink(link))) {
    pushIssue(issues, 'warning', 'hreflang_missing_x_default', 'hreflang links do not include x-default.')
  }

  if (hreflangLinks.length > 0 && lang && !hasSelfHreflang(lang, hreflangLinks)) {
    pushIssue(issues, 'warning', 'hreflang_missing_self', `hreflang links do not include a self entry for ${ lang }.`)
  }

  if (!openGraph.title) {
    pushIssue(issues, 'info', 'missing_og_title', 'Missing og:title.')
  }

  if (!openGraph.description) {
    pushIssue(issues, 'info', 'missing_og_description', 'Missing og:description.')
  }

  if (!openGraph.image) {
    pushIssue(issues, 'info', 'missing_og_image', 'Missing og:image.')
  }

  if (!twitter.card) {
    pushIssue(issues, 'info', 'missing_twitter_card', 'Missing twitter:card.')
  }

  if (jsonLd.scriptCount === 0) {
    pushIssue(issues, 'info', 'missing_jsonld', 'No JSON-LD structured data found.')
  }

  if (jsonLd.parseErrors > 0) {
    pushIssue(issues, 'warning', 'invalid_jsonld', `${ jsonLd.parseErrors } JSON-LD block(s) could not be parsed.`)
  }

  if (hasHomepagePath && !jsonLd.hasWebSite) {
    pushIssue(issues, 'info', 'missing_schema_website', 'Homepage-like route is missing WebSite JSON-LD.')
  }

  if (hasHomepagePath && !jsonLd.hasOrganization) {
    pushIssue(issues, 'info', 'missing_schema_organization', 'Homepage-like route is missing Organization JSON-LD.')
  }

  const missingSchemaProperties = page.seo?.jsonLd?.missingRequiredProperties ?? []

  if (missingSchemaProperties.length > 0) {
    const summary = missingSchemaProperties
      .map(issue => `${ issue.type }.${ issue.property }`)
      .join(', ')

    pushIssue(issues, 'warning', 'schema_missing_properties', `JSON-LD is missing required properties: ${ summary }.`)
  }

  if (headerLlms && isSourceLocalUrl(headerLlms, page) === false) {
    pushIssue(issues, 'warning', 'llms_link_cross_domain', 'Response Link llms target points to a different host.')
  }

  if (bodyTextLength < rules.minBodyTextLength) {
    pushIssue(issues, 'warning', 'thin_content', `Visible text is too short (${ bodyTextLength } chars).`)
  }

  const imagesWithoutAlt = page.seo?.document.imagesWithoutAlt ?? 0

  if (imagesWithoutAlt > 0) {
    pushIssue(issues, 'warning', 'images_missing_alt', `${ imagesWithoutAlt } image(s) missing alt attribute.`)
  }

  if (rules.flagEmptyAlt) {
    const imagesWithEmptyAlt = page.seo?.document.imagesWithEmptyAlt ?? 0

    if (imagesWithEmptyAlt > 0) {
      pushIssue(issues, 'warning', 'images_empty_alt', `${ imagesWithEmptyAlt } image(s) have an empty alt attribute.`)
    }
  }

  const headingHierarchy = page.seo?.document.headingHierarchy ?? []

  for (let index = 1; index < headingHierarchy.length; index += 1) {
    const current = headingHierarchy[index]
    const previous = headingHierarchy[index - 1]

    if (current > previous + 1) {
      pushIssue(issues, 'warning', 'heading_hierarchy_skip', `Heading hierarchy skips from H${ previous } to H${ current }.`)
      break
    }
  }

  return filterIgnoredIssues(issues, rules)
}

export const buildSummary = (pages) => {
  const issueCounts = new Map()
  const severityCounts = {
    error: 0,
    warning: 0,
    info: 0,
  }

  const summary = pages.reduce((accumulator, page) => {
    accumulator.total += 1
    accumulator.totalIssues += page.issues.length

    if (page.issues.length > 0) {
      accumulator.pagesWithIssues += 1
    }

    if (page.error) {
      accumulator.errors += 1
    }

    if (page.error || (page.status && page.status >= 400)) {
      accumulator.failedPages += 1
    }

    if (page.redirectChain.length > 1) {
      accumulator.redirected += 1
    }

    if (page.status && page.status >= 400) {
      accumulator.httpErrors += 1
    }

    if (page.issues.some(issue => issue.code === 'noindex')) {
      accumulator.noindex += 1
    }

    if (page.parseSkippedReason) {
      accumulator.skipped += 1
    }

    for (const issue of page.issues) {
      issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1)
      severityCounts[issue.severity] += 1
    }

    return accumulator
  }, {
    total: 0,
    errors: 0,
    failedPages: 0,
    redirected: 0,
    httpErrors: 0,
    noindex: 0,
    skipped: 0,
    pagesWithIssues: 0,
    totalIssues: 0,
  })

  return {
    ...summary,
    severityCounts,
    issueBreakdown: sortByCountDesc(
      [ ...issueCounts.entries() ].map(([ code, count ]) => ({ code, count })),
    ),
  }
}
