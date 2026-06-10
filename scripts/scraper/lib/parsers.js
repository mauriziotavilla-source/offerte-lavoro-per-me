const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const { compactText, makeAbsoluteUrl, parseDateLoose } = require('./utils');

function keywordMatch(text, keywords = []) {
  if (!keywords.length) return true;
  const hay = compactText(text).toLowerCase();
  return keywords.some((word) => hay.includes(String(word).toLowerCase()));
}

function keywordExcluded(text, keywords = []) {
  if (!keywords.length) return false;
  const hay = compactText(text).toLowerCase();
  return keywords.some((word) => hay.includes(String(word).toLowerCase()));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'LavoroConcorsiScraper/1.0 (+GitHub Actions)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.url}::${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function parseHtmlSectionLinks(source) {
  const html = await fetchText(source.url);
  const $ = cheerio.load(html);
  const sectionNeedle = compactText(source.sectionHeading || '').toLowerCase();
  const headingSelector = source.headingSelector || 'h5';
  const items = [];

  $(headingSelector).each((_, headingEl) => {
    const heading = compactText($(headingEl).text()).toLowerCase();
    if (!sectionNeedle || !heading.includes(sectionNeedle)) return;

    $(headingEl)
      .parent()
      .find('a')
      .each((_, el) => {
        const title = compactText($(el).text());
        const href = makeAbsoluteUrl(source.url, $(el).attr('href'));
        const context = compactText($(el).closest('article, li, div, tr').text());
        const text = `${title} ${context} ${heading}`;
        if (!title || !href) return;
        if (!keywordMatch(text, source.includeKeywords)) return;
        if (keywordExcluded(text, source.excludeKeywords)) return;
        items.push({
          title: title.includes('messina') ? title : `${title} (CPI Messina)`,
          url: href,
          summary: `Avviso L.68/99 — CPI Messina e Villafranca Tirrena. ${context}`.slice(0, 280),
          publishedAt: parseDateLoose(text),
          rawText: text,
        });
      });
  });

  return dedupeItems(items);
}

async function parseHtmlLinks(source) {
  const html = await fetchText(source.url);
  const $ = cheerio.load(html);
  const selectors = source.selectors?.length ? source.selectors : ['a'];
  const items = [];
  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const title = compactText($(el).text());
      const href = makeAbsoluteUrl(source.url, $(el).attr('href'));
      const context = compactText($(el).closest('article, li, div, tr').text());
      const text = `${title} ${context}`;
      if (!title || !href) return;
      if (!keywordMatch(text, source.includeKeywords)) return;
      if (keywordExcluded(text, source.excludeKeywords)) return;
      items.push({
        title,
        url: href,
        summary: context.slice(0, 280),
        publishedAt: parseDateLoose(text),
        rawText: text,
      });
    });
  });
  return dedupeItems(items);
}

async function parseLinkedInJobs(source) {
  const searches = source.searches?.length
    ? source.searches
    : [{ keywords: 'contabile', location: source.location || 'Messina' }];
  const items = [];

  for (const query of searches) {
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(query.keywords)}&location=${encodeURIComponent(query.location)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    $('li, .base-card').each((_, el) => {
      const card = $(el);
      const linkEl = card.find('a.base-card__full-link, a[href*="/jobs/view/"]').first();
      const title = compactText(card.find('h3').first().text() || linkEl.text());
      const company = compactText(card.find('h4').first().text());
      const location = compactText(
        card.find('.job-search-card__location, .artdeco-entity-lockup__caption, .job-search-card__location').first().text()
      );
      const href = makeAbsoluteUrl('https://www.linkedin.com', linkEl.attr('href'));
      if (!title || !href || !href.includes('/jobs/view/')) return;

      const nome = company ? `${title} — ${company}` : title;
      const text = `${nome} ${location}`;
      if (!keywordMatch(text, source.includeKeywords)) return;
      if (keywordExcluded(text, source.excludeKeywords)) return;

      items.push({
        title: nome,
        url: href.split('?')[0],
        summary: location ? `Sede: ${location}` : '',
        publishedAt: '',
        rawText: text,
      });
    });
  }

  return dedupeItems(items);
}

async function parseRss(source) {
  const xml = await fetchText(source.url);
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const channel = parsed.rss?.channel || parsed.feed || {};
  const entries = channel.item || channel.entry || [];
  const arr = Array.isArray(entries) ? entries : [entries];
  return dedupeItems(
    arr
      .map((entry) => ({
        title: compactText(entry.title?.['#text'] || entry.title),
        url: compactText(entry.link?.href || entry.link || entry.guid),
        summary: compactText(entry.description || entry.summary || entry.content || ''),
        publishedAt: parseDateLoose(entry.pubDate || entry.updated || entry.published || ''),
        rawText: compactText(`${entry.title?.['#text'] || entry.title || ''} ${entry.description || entry.summary || ''}`),
      }))
      .filter((item) => item.title && item.url)
  );
}

async function collectFromSource(source) {
  if (source.parser === 'rss') return parseRss(source);
  if (source.parser === 'linkedinJobs') return parseLinkedInJobs(source);
  if (source.parser === 'htmlSectionLinks') return parseHtmlSectionLinks(source);
  return parseHtmlLinks(source);
}

module.exports = { collectFromSource, dedupeItems, keywordExcluded, keywordMatch };
