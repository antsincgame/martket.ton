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

function renderHtml(title, desc, img, url) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
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
</head><body></body></html>`;
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

router.get('/', async (req, res) => {
  const rawPath = (req.query.path || '/').replace(/\?.*$/, '');
  let title = SITE + ' — Decentralized Digital Marketplace';
  let desc = DEFAULT_DESC;
  let img = ICON;
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
  } else if (prodMatch) {
    const slug = prodMatch[1];
    const product = await resolveProduct(slug);
    if (product) {
      title = `${product.name} — ${SITE}`;
      desc = product.shortDescription || product.description || DEFAULT_DESC;
      img = product.image || ICON;
    } else {
      title = `Product — ${SITE}`;
    }
  } else if (catMatch) {
    const slug = catMatch[1];
    const name = CATEGORIES[slug] || slugToName(slug);
    title = `${name} — ${SITE}`;
    desc = `Browse ${name} on ${SITE} — decentralized digital marketplace on TON blockchain.`;
  }

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(renderHtml(title, desc, img, url));
});

module.exports = router;
