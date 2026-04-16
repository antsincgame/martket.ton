/**
 * OG Meta Tag Generator — serves pre-rendered HTML with Open Graph tags
 * for social media crawlers (Telegram, Twitter, Facebook, etc.)
 * that don't execute JavaScript.
 *
 * Nginx detects bot user agents and proxies to GET /api/og?path=/developer/god
 */
const express = require('express');
const router = express.Router();

const ORIGIN = (process.env.CORS_ORIGIN || 'https://tonforge.org').replace(/\/$/, '');
const SITE = 'TON Web Store';
const ICON = `${ORIGIN}/app-icon.png`;
const DEFAULT_DESC =
  'Decentralized marketplace for digital goods on TON blockchain. Discover apps, games, AI tools, developer utilities, and more.';

// ── Developer profiles: slug → [displayName, bio, bannerUrl] ──
const DEVS = {
  'god':              ['God', 'Architect of Digital Realms. Creator of impossible experiences.', 'https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'dharma-tech':      ['Dharma Tech', 'Mindful productivity tools for the TON ecosystem', 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'flowstate-labs':   ['FlowState Labs', 'Minimalist productivity — less planning, more doing', 'https://images.pexels.com/photos/3243090/pexels-photo-3243090.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'coinwise-studio':  ['CoinWise Studio', 'Financial clarity for crypto-native users', 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'volt-games':       ['Volt Games', 'AAA battle royale & competitive games on TON', 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'enlightened-games':['Enlightened Games', 'Story-driven RPGs where karma shapes destiny', 'https://images.pexels.com/photos/163036/mario-luigi-yoshi-trio-163036.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'stellar-minds':    ['Stellar Minds', 'Brain-teasing puzzle experiences for all ages', 'https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'dharma-ai':        ['Dharma AI', 'AI research tools with respect for truth and sources', 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'sonicai-labs':     ['SonicAI Labs', 'Voice AI — clone, narrate, create', 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'linguanet':        ['LinguaNet', 'Breaking language barriers with neural translation', 'https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'sacred-devs':      ['Sacred Devs', 'Code editors built by developers, for developers', 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'mindful-apps':     ['Mindful Apps', 'GPU-accelerated dev tools with zen aesthetics', 'https://images.pexels.com/photos/5077047/pexels-photo-5077047.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'creativeforge-inc':['CreativeForge Inc.', 'Design tools that empower creative teams', 'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'pixelmind-studio': ['PixelMind Studio', 'AI-powered photo enhancement and restoration', 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'voxelworks':       ['VoxelWorks', '3D modeling and sculpting for the modern artist', 'https://images.pexels.com/photos/5011647/pexels-photo-5011647.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'shieldlabs':       ['ShieldLabs', 'Multi-chain wallet security — because your keys matter', 'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'yieldmaster':      ['YieldMaster', 'DeFi portfolio analytics across 12+ chains', 'https://images.pexels.com/photos/6771985/pexels-photo-6771985.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'educhain-academy': ['EduChain Academy', 'Web3 education with verifiable on-chain certificates', 'https://images.pexels.com/photos/4145153/pexels-photo-4145153.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'lingostar':        ['LingoStar', 'Learn languages with AI tutoring and gamification', 'https://images.pexels.com/photos/267669/pexels-photo-267669.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'privacyfirst':     ['PrivacyFirst', 'Decentralized VPN — zero-knowledge, zero compromise', 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'chainshield':      ['ChainShield', 'Smart contract security — simulate before you sign', 'https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'vaultmedia':       ['VaultMedia', 'Creator-first streaming with TON tips and NFT passes', 'https://images.pexels.com/photos/1117132/pexels-photo-1117132.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'audiocraft':       ['AudioCraft', 'Professional podcast production made effortless', 'https://images.pexels.com/photos/6953870/pexels-photo-6953870.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'ciphercomm':       ['CipherComm', 'E2E encrypted communication for the post-privacy era', 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'synclabs':         ['SyncLabs', 'Workspaces for Web3 teams — ship faster together', 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'wellbeing-ai':     ['WellBeing AI', 'AI-powered mental health and meditation coaching', 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'dreamtech':        ['DreamTech', 'Smart sleep technology for better rest and recovery', 'https://images.pexels.com/photos/3771069/pexels-photo-3771069.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'infraops':         ['InfraOps', 'Server monitoring and incident management for Web3 infra', 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'vaultsync':        ['VaultSync', 'AES-256 encrypted backups to decentralized storage', 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'chainvision':      ['ChainVision', 'Blockchain analytics and explorer tools for TON', 'https://images.pexels.com/photos/844124/pexels-photo-844124.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  'artifactai':       ['ArtifactAI', 'AI art generation — from text to masterpiece in seconds', 'https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=1200'],
};

// ── Products: id → [name, description, imageUrl] ──
const PRODUCTS = {
  '1':  ['Karma Tracker', 'Daily habit & goal tracker with mindfulness templates and TON reward challenges', 'https://images.pexels.com/photos/5082579/pexels-photo-5082579.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '2':  ['Task Zen Planner', 'Minimalist planner with Pomodoro timer and cross-device sync', 'https://images.pexels.com/photos/3243090/pexels-photo-3243090.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '3':  ['Expense Monk', 'Expense tracker with TON wallet auto-import and budget heatmaps', 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '4':  ['Neon Arena: Battle Royale', '60-player cyberpunk battle royale with NFT skins and TON prize pools', 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '5':  ['Chakra Quest RPG', 'Open-world RPG with karma-based story engine and 200+ quests', 'https://images.pexels.com/photos/163036/mario-luigi-yoshi-trio-163036.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '6':  ['Puzzle Galaxy', '500+ spatial puzzles across procedurally generated galaxies', 'https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '7':  ['AI Wisdom Oracle', 'LLM-powered research assistant with source citations and 40+ knowledge domains', 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '8':  ['Voice Clone Studio', 'Clone any voice in 30 seconds with 24 emotional presets', 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '9':  ['Neural Translate Pro', 'Real-time translation for 120+ languages with offline packs', 'https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '10': ['Cosmic Code Editor Pro', 'Code editor with GPT-4 completions, 50+ languages, and cosmic themes', 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '11': ['Sacred Terminal', 'GPU-accelerated terminal with split panes and 60+ themes', 'https://images.pexels.com/photos/5077047/pexels-photo-5077047.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '12': ['PixelForge Designer', 'Vector + raster design tool with GPU canvas and real-time collaboration', 'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '13': ['Photo Remaster AI', 'Upscale photos to 4x, restore old images, remove backgrounds in one click', 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '14': ['3D Model Forge', 'Sculpt, texture, and render 3D models with PBR materials', 'https://images.pexels.com/photos/5011647/pexels-photo-5011647.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '15': ['TON Wallet Shield', 'Multi-sig wallet with 2FA, transaction scanning, and portfolio analytics', 'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '16': ['DeFi Portfolio Pro', 'Track LP positions, yields, and impermanent loss across 12 chains', 'https://images.pexels.com/photos/6771985/pexels-photo-6771985.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '17': ['Quantum Learning Hub', '80+ interactive courses on blockchain and Web3 with NFT certificates', 'https://images.pexels.com/photos/4145153/pexels-photo-4145153.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '18': ['Language Master Pro', 'Learn 45 languages with AI tutoring and gamified streaks', 'https://images.pexels.com/photos/267669/pexels-photo-267669.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '19': ['CyberGuard VPN', 'Decentralized VPN on 200+ nodes with zero-knowledge architecture', 'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '20': ['CryptoGuard Firewall', 'Smart contract firewall that simulates every transaction before signing', 'https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '21': ['StreamVault', 'Creator-first streaming platform with TON tips and 4K adaptive bitrate', 'https://images.pexels.com/photos/1117132/pexels-photo-1117132.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '22': ['Podcast Studio Pro', 'Record, denoise, transcribe, and publish podcasts in one tap', 'https://images.pexels.com/photos/6953870/pexels-photo-6953870.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '23': ['NeonChat Messenger', 'E2E encrypted messenger with TON micropayments and 10 GB cloud', 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '24': ['TeamSync Hub', 'Workspace for Web3 teams — Kanban, video calls, and on-chain payments', 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '25': ['MindBody Scanner', 'Meditation coach with 500+ guided sessions and HRV biofeedback', 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '26': ['Sleep Optimizer', 'Smart sleep tracker with adaptive soundscapes and smart alarm', 'https://images.pexels.com/photos/3771069/pexels-photo-3771069.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '27': ['SystemPulse Monitor', 'Monitor servers and validators with uptime dashboards and alerts', 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '28': ['CloudBackup Pro', 'AES-256 encrypted backups to decentralized TON storage', 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '29': ['TON Explorer Pro', 'Blockchain explorer with contract viewer, gas estimator, and whale tracker', 'https://images.pexels.com/photos/844124/pexels-photo-844124.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '30': ['AI Art Generator', 'Text-to-image with 15 style models, inpainting, and batch API', 'https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '31': ['Genesis Engine', 'Universal creation framework for building entire digital worlds', 'https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '32': ['Omniscient AI', 'AGI-class reasoning engine with unlimited context and divine-tier code generation', 'https://images.pexels.com/photos/2004161/pexels-photo-2004161.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '33': ['Divine Shield', 'Impenetrable security suite with quantum-resistant encryption', 'https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  '34': ['Celestial Canvas', 'AI design suite that reads creative intent and transforms sketches into masterpieces', 'https://images.pexels.com/photos/3075993/pexels-photo-3075993.jpeg?auto=compress&cs=tinysrgb&w=1200'],
};

// ── Categories ──
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

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

router.get('/', (req, res) => {
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
    const d = DEVS[slug];
    const name = d ? d[0] : slugToName(slug);
    title = `${name} — ${SITE}`;
    desc = d ? `${d[1]} — explore products by ${name} on ${SITE}.` : `Developer profile on ${SITE}`;
    img = d && d[2] ? d[2] : ICON;
  } else if (prodMatch) {
    const id = prodMatch[1];
    const p = PRODUCTS[id];
    if (p) {
      title = `${p[0]} — ${SITE}`;
      desc = p[1];
      img = p[2];
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
