'use strict';

const express = require('express');
const router = express.Router();

const ORIGIN = (process.env.CORS_ORIGIN || 'https://tonforge.org').replace(/\/$/, '');
const SITE = 'TON Web Store';
const ICON = `${ORIGIN}/app-icon.png`;
const DEFAULT_DESC =
  'Decentralized marketplace for digital goods on TON blockchain. Discover apps, games, AI tools, developer utilities, and more.';

const CATEGORIES = {
  'apps': 'Apps',
  'games': 'Games',
  'ai': 'AI Services',
  'developer-tools': 'Developer Tools',
  'design': 'Design & Creative',
  'defi': 'DeFi & Finance',
  'education': 'Education',
  'security': 'Security & Privacy',
  'media': 'Media & Entertainment',
  'social': 'Social & Communication',
  'health': 'Health & Wellness',
  'utilities': 'Utilities & System',
};

let repo = null;
try {
  repo = require('../core/repository');
} catch { /* core not available — fall back to static */ }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugToName(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderHtml({ title, desc, img, url, body }) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="${img !== ICON ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
</head><body>
${body || `<h1>${esc(title)}</h1><p>${esc(desc)}</p>`}
</body></html>`;
}

async function resolveProduct(slug) {
  if (!repo) return null;
  try {
    const product = await repo.findProductById(slug);
    if (product) return product;
    const products = await repo.listProductsByStatus('published');
    const { slugify } = await import('../utils/slugify.js').catch(() => ({ slugify: null }));
    if (slugify) {
      return products.find((p) => slugify(p.name) === slug) ?? null;
    }
    return products.find((p) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug) ?? null;
  } catch { return null; }
}

async function resolveProfile(slug) {
  if (!repo) return null;
  try {
    return await repo.findProfileBySlug(slug);
  } catch { return null; }
}

async function listPublished(limit = 24) {
  if (!repo) return [];
  try {
    const products = await repo.listProductsByStatus('published');
    return Array.isArray(products) ? products.slice(0, limit) : [];
  } catch { return []; }
}

function productSlug(p) {
  return (p.slug || p.id || p.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '').toString();
}

function productLink(p) {
  const slug = productSlug(p);
  return slug ? `${ORIGIN}/product/${slug}` : ORIGIN;
}

function renderProductCard(p) {
  const link = productLink(p);
  const name = esc(p.name || 'Untitled');
  const desc = esc(p.shortDescription || p.description || '');
  const cat = p.category ? `<span> &middot; ${esc(CATEGORIES[p.category] || slugToName(p.category))}</span>` : '';
  const price = p.price !== undefined && p.price !== null ? `<span> &middot; ${esc(String(p.price))} TON</span>` : '';
  return `<li><a href="${esc(link)}"><strong>${name}</strong></a>${cat}${price}<br>${desc}</li>`;
}

router.get('/', async (req, res) => {
  const rawPath = (req.query.path || '/').replace(/\?.*$/, '');
  let title = SITE + ' — Decentralized Digital Marketplace';
  let desc = DEFAULT_DESC;
  let img = ICON;
  let body = '';
  const url = ORIGIN + rawPath;

  const devMatch = rawPath.match(/^\/developer\/([^/]+)/);
  const prodMatch = rawPath.match(/^\/product\/([^/]+)/);
  const catMatch = rawPath.match(/^\/category\/([^/]+)/);

  if (devMatch) {
    const slug = devMatch[1];
    const profile = await resolveProfile(slug);
    const name = profile?.displayName || slugToName(slug);
    title = `${name} — ${SITE}`;
    desc = profile?.bio
      ? `${profile.bio} — explore products by ${name} on ${SITE}.`
      : `Developer profile on ${SITE}`;
    img = profile?.bannerUrl || profile?.avatar || ICON;

    const all = await listPublished(200);
    const own = all.filter((p) => p.authorSlug === slug || p.author === slug || p.developerSlug === slug);
    body = `<h1>${esc(name)}</h1>` +
      (profile?.bio ? `<p>${esc(profile.bio)}</p>` : '') +
      (own.length ? `<h2>Products by ${esc(name)}</h2><ul>${own.map(renderProductCard).join('')}</ul>` : '');
  } else if (prodMatch) {
    const slug = prodMatch[1];
    const product = await resolveProduct(slug);
    if (product) {
      title = `${product.name} — ${SITE}`;
      desc = product.shortDescription || product.description || DEFAULT_DESC;
      img = product.image || ICON;
      const fullDesc = product.description ? `<p>${esc(product.description)}</p>` : '';
      const shortDesc = product.shortDescription && product.shortDescription !== product.description
        ? `<p><em>${esc(product.shortDescription)}</em></p>` : '';
      const cat = product.category
        ? `<p>Category: <a href="${ORIGIN}/category/${esc(product.category)}">${esc(CATEGORIES[product.category] || slugToName(product.category))}</a></p>` : '';
      const price = product.price !== undefined && product.price !== null
        ? `<p>Price: ${esc(String(product.price))} TON</p>` : '';
      const tags = Array.isArray(product.tags) && product.tags.length
        ? `<p>Tags: ${product.tags.map((t) => esc(t)).join(', ')}</p>` : '';
      body = `<h1>${esc(product.name)}</h1>${shortDesc}${fullDesc}${cat}${price}${tags}`;
    } else {
      title = `Product — ${SITE}`;
      body = `<h1>Product not found</h1><p><a href="${ORIGIN}/">Back to ${SITE}</a></p>`;
    }
  } else if (catMatch) {
    const slug = catMatch[1];
    const name = CATEGORIES[slug] || slugToName(slug);
    title = `${name} — ${SITE}`;
    desc = `Browse ${name} on ${SITE} — decentralized digital marketplace on TON blockchain.`;

    const all = await listPublished(200);
    const inCat = all.filter((p) => p.category === slug);
    body = `<h1>${esc(name)}</h1><p>${esc(desc)}</p>` +
      (inCat.length ? `<ul>${inCat.map(renderProductCard).join('')}</ul>` : '<p>No products yet.</p>');
  } else if (rawPath === '/' || rawPath === '') {
    const featured = await listPublished(24);
    const cats = Object.entries(CATEGORIES)
      .map(([k, v]) => `<li><a href="${ORIGIN}/category/${esc(k)}">${esc(v)}</a></li>`).join('');
    body = `<h1>${esc(title)}</h1><p>${esc(desc)}</p>` +
      `<h2>Categories</h2><ul>${cats}</ul>` +
      (featured.length ? `<h2>Featured products</h2><ul>${featured.map(renderProductCard).join('')}</ul>` : '');
  }

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=600');
  res.send(renderHtml({ title, desc, img, url, body }));
});

module.exports = router;
