import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');

const readRootFile = relPath => readFileSync(resolve(rootDir, relPath), 'utf8');

const extractJsonLd = html => {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(match, 'Expected JSON-LD script tag').toBeTruthy();
  return JSON.parse(match[1]);
};

const stripTags = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('SEO landing pages, metadata, sitemaps, and structured data', () => {
  const categoryPages = [
    {
      file: 't-shirts.html',
      slug: '/t-shirts',
      defaultCategory: 'tees',
      expectedTitle: 'LA VAGUE T-Shirts'
    },
    {
      file: 'hoodies.html',
      slug: '/hoodies',
      defaultCategory: 'hoodies',
      expectedTitle: 'LA VAGUE Hoodies'
    },
    {
      file: 'bottoms.html',
      slug: '/bottoms',
      defaultCategory: 'bottoms',
      expectedTitle: 'LA VAGUE Bottoms'
    },
    {
      file: 'accessories.html',
      slug: '/accessories',
      defaultCategory: 'accessories',
      expectedTitle: 'LA VAGUE Accessories'
    }
  ];

  it('provides dedicated static category pages with unique metadata, canonicals, JSON-LD, and editorial copy', () => {
    const titles = new Set();
    const descriptions = new Set();

    for (const page of categoryPages) {
      const fullPath = resolve(rootDir, page.file);
      expect(existsSync(fullPath), `${page.file} should exist`).toBe(true);

      const html = readRootFile(page.file);
      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
      const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);

      expect(titleMatch?.[1]).toContain(page.expectedTitle);
      expect(descMatch?.[1].length).toBeGreaterThan(80);
      expect(canonicalMatch?.[1]).toBe(`https://la-vague.store${page.slug}`);
      expect(html).toContain(`data-default-category="${page.defaultCategory}"`);

      titles.add(titleMatch[1]);
      descriptions.add(descMatch[1]);

      const schema = extractJsonLd(html);
      const graphTypes = schema['@graph'].map(node => node['@type']);
      expect(graphTypes).toContain('CollectionPage');
      expect(graphTypes).toContain('BreadcrumbList');

      const editorialMatch = html.match(/<section class="category-editorial"[\s\S]*?<\/section>/);
      expect(editorialMatch, `${page.file} should include editorial copy section`).toBeTruthy();
      const wordCount = stripTags(editorialMatch[0]).split(' ').length;
      expect(wordCount).toBeGreaterThanOrEqual(80);
    }

    expect(titles.size).toBe(categoryPages.length);
    expect(descriptions.size).toBe(categoryPages.length);
  });

  it('registers all category landing pages in Vite build config, static sitemap, and dynamic sitemap', () => {
    const viteConfig = readRootFile('vite.config.js');
    const staticSitemap = readRootFile('public/sitemap.xml');
    const serverSource = readRootFile('server.js');

    for (const page of categoryPages) {
      expect(viteConfig).toContain(`page('${page.file}')`);
      expect(staticSitemap).toContain(`<loc>https://la-vague.store${page.slug}</loc>`);
      expect(serverSource).toContain(`'${page.slug}'`);
    }
  });

  it('sharpens homepage brand metadata, JSON-LD alternateName, About copy, and category links', () => {
    const html = readRootFile('index.html');
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    expect(titleMatch?.[1]).toContain('Official Website');
    expect(titleMatch?.[1]).toContain('Nigerian Streetwear');

    const schema = extractJsonLd(html);
    const org = schema['@graph'].find(node => node['@type'] === 'Organization');
    expect(org.alternateName).toContain('The Wave');
    expect(org.foundingLocation?.name).toBe('Lagos, Nigeria');

    expect(html).toContain('French for "The Wave"');
    for (const page of categoryPages) {
      expect(html).toContain(`href="${page.slug}"`);
    }
  });

  it('publishes valid FAQPage JSON-LD in faq.html matching every visible FAQ question', () => {
    const html = readRootFile('faq.html');
    const schema = extractJsonLd(html);
    expect(schema['@type']).toBe('FAQPage');

    const visibleQuestions = [...html.matchAll(/<button class="faq-question">([\s\S]*?)<\/button>/g)]
      .map(match => stripTags(match[1]));

    expect(visibleQuestions.length).toBe(14);
    expect(schema.mainEntity).toHaveLength(visibleQuestions.length);

    const schemaQuestions = schema.mainEntity.map(item => item.name);
    expect(schemaQuestions).toEqual(visibleQuestions);
  });

  it('maps every shop category to its canonical URL in src/scripts/shop.js', () => {
    const shopScript = readRootFile('src/scripts/shop.js');
    expect(shopScript).toContain('CATEGORY_SEO');
    expect(shopScript).toContain('updateCategorySEO');
    expect(shopScript).toContain('document.body.dataset.defaultCategory');
    for (const page of categoryPages) {
      expect(shopScript).toContain(`https://la-vague.store${page.slug}`);
    }
  });
});
