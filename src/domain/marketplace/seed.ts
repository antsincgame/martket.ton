import type { CatalogListingProduct, ProductDetail, ProductReview } from './types';

export const CATALOG_LISTING_PRODUCTS: CatalogListingProduct[] = [
  // ── Apps ──
  {
    id: '1',
    name: 'Karma Tracker',
    description: 'Daily habit & goal tracker with 30+ mindfulness templates, streak analytics, and TON reward challenges for consistent practice',
    price: 3.5,
    rating: 4.4,
    downloads: 7800,
    image: 'https://images.pexels.com/photos/5082579/pexels-photo-5082579.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Apps',
    developer: 'Dharma Tech',
    isFeatured: true,
    donationAmount: 6.7,
  },
  {
    id: '2',
    name: 'Task Zen Planner',
    description: 'Minimalist planner with Pomodoro focus timer, Eisenhower matrix, and cross-device sync — plan less, accomplish more',
    price: 4.2,
    rating: 4.6,
    downloads: 9400,
    image: 'https://images.pexels.com/photos/3243090/pexels-photo-3243090.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Apps',
    developer: 'FlowState Labs',
    isFeatured: false,
    donationAmount: 3.1,
  },
  {
    id: '3',
    name: 'Expense Monk',
    description: 'Expense tracker with TON wallet auto-import, budget heatmaps, and monthly spending reports — see where every coin goes',
    price: 2.8,
    rating: 4.3,
    downloads: 5200,
    image: 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Apps',
    developer: 'CoinWise Studio',
    isFeatured: false,
    donationAmount: 2.4,
  },

  // ── Games ──
  {
    id: '4',
    name: 'Neon Arena: Battle Royale',
    description: '60-player cyberpunk battle royale — earn NFT skins, trade loot on TON, and climb ranked leaderboards each season',
    price: 12.0,
    rating: 4.8,
    downloads: 24300,
    image: 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games',
    developer: 'Volt Games',
    isFeatured: true,
    donationAmount: 42.5,
  },
  {
    id: '5',
    name: 'Chakra Quest RPG',
    description: 'Open-world RPG with 7 realms, 200+ quests, and a karma-based story engine — your choices reshape the universe',
    price: 8.5,
    rating: 4.5,
    downloads: 11200,
    image: 'https://images.pexels.com/photos/163036/mario-luigi-yoshi-trio-163036.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games',
    developer: 'Enlightened Games',
    isFeatured: true,
    donationAmount: 31.2,
  },
  {
    id: '6',
    name: 'Puzzle Galaxy',
    description: '500+ spatial puzzles across procedurally generated galaxies with daily challenges and a global time-attack board',
    price: 5.0,
    rating: 4.7,
    downloads: 8900,
    image: 'https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games',
    developer: 'Stellar Minds',
    isFeatured: false,
    donationAmount: 7.3,
  },

  // ── AI Services ──
  {
    id: '7',
    name: 'AI Wisdom Oracle',
    description: 'LLM-powered research assistant with source citations, 40+ knowledge domains, voice mode, and a developer API',
    price: 22.0,
    rating: 4.9,
    downloads: 15600,
    image: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services',
    developer: 'Dharma AI',
    isFeatured: true,
    donationAmount: 55.0,
  },
  {
    id: '8',
    name: 'Voice Clone Studio',
    description: 'Clone any voice in 30 seconds — create narration, podcasts, and audiobooks with 24 emotional presets and SSML control',
    price: 18.0,
    rating: 4.6,
    downloads: 6700,
    image: 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services',
    developer: 'SonicAI Labs',
    isFeatured: false,
    donationAmount: 12.0,
  },
  {
    id: '9',
    name: 'Neural Translate Pro',
    description: 'Real-time translation for 120+ languages with document mode, context memory, and offline packs for 30 core languages',
    price: 9.5,
    rating: 4.7,
    downloads: 19800,
    image: 'https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services',
    developer: 'LinguaNet',
    isFeatured: false,
    donationAmount: 8.4,
  },

  // ── Developer Tools ──
  {
    id: '10',
    name: 'Cosmic Code Editor Pro',
    description: 'Code editor with GPT-4 completions, 50+ language grammars, built-in terminal, git UI, and cosmic color schemes',
    price: 15.5,
    rating: 4.9,
    downloads: 12500,
    image: 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Developer Tools',
    developer: 'Sacred Devs',
    isFeatured: true,
    donationAmount: 25.8,
  },
  {
    id: '11',
    name: 'Sacred Terminal',
    description: 'GPU-accelerated terminal with split panes, 60+ themes, ligature fonts, and SSH/SFTP manager built in',
    price: 5.9,
    rating: 4.6,
    downloads: 15200,
    image: 'https://images.pexels.com/photos/5077047/pexels-photo-5077047.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Developer Tools',
    developer: 'Mindful Apps',
    isFeatured: false,
    donationAmount: 8.1,
  },

  // ── Design & Creative ──
  {
    id: '12',
    name: 'PixelForge Designer',
    description: 'Vector + raster design tool with GPU canvas, 1000+ templates, Figma import, and real-time collaboration for teams',
    price: 19.0,
    rating: 4.8,
    downloads: 8400,
    image: 'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design',
    developer: 'CreativeForge Inc.',
    isFeatured: true,
    donationAmount: 28.0,
  },
  {
    id: '13',
    name: 'Photo Remaster AI',
    description: 'Upscale photos to 4x, restore old images, remove backgrounds, and enhance portraits — all in one click with batch mode',
    price: 7.5,
    rating: 4.5,
    downloads: 11300,
    image: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design',
    developer: 'PixelMind Studio',
    isFeatured: false,
    donationAmount: 5.2,
  },
  {
    id: '14',
    name: '3D Model Forge',
    description: 'Sculpt, texture, and render 3D models with PBR materials, HDRI lighting, and one-click export to glTF/USDZ/FBX',
    price: 24.0,
    rating: 4.7,
    downloads: 4200,
    image: 'https://images.pexels.com/photos/5011647/pexels-photo-5011647.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design',
    developer: 'VoxelWorks',
    isFeatured: false,
    donationAmount: 15.0,
  },

  // ── Finance & DeFi ──
  {
    id: '15',
    name: 'TON Wallet Shield',
    description: 'Multi-sig wallet with 2FA, transaction scanning, whale alerts, and portfolio analytics across TON, ETH, and BTC',
    price: 14.0,
    rating: 4.8,
    downloads: 18700,
    image: 'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'DeFi',
    developer: 'ShieldLabs',
    isFeatured: true,
    donationAmount: 38.0,
  },
  {
    id: '16',
    name: 'DeFi Portfolio Pro',
    description: 'Track LP positions, yields, and impermanent loss across 12 chains — auto-harvest alerts and tax report generator',
    price: 11.0,
    rating: 4.6,
    downloads: 7300,
    image: 'https://images.pexels.com/photos/6771985/pexels-photo-6771985.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'DeFi',
    developer: 'YieldMaster',
    isFeatured: false,
    donationAmount: 9.5,
  },

  // ── Education ──
  {
    id: '17',
    name: 'Quantum Learning Hub',
    description: '80+ interactive courses on blockchain, Solidity, FunC, and Web3 — earn verifiable NFT certificates on completion',
    price: 8.0,
    rating: 4.7,
    downloads: 13500,
    image: 'https://images.pexels.com/photos/4145153/pexels-photo-4145153.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Education',
    developer: 'EduChain Academy',
    isFeatured: true,
    donationAmount: 21.0,
  },
  {
    id: '18',
    name: 'Language Master Pro',
    description: 'Learn 45 languages with AI tutoring, real-time pronunciation scoring, spaced repetition, and gamified daily streaks',
    price: 6.5,
    rating: 4.5,
    downloads: 22100,
    image: 'https://images.pexels.com/photos/267669/pexels-photo-267669.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Education',
    developer: 'LingoStar',
    isFeatured: false,
    donationAmount: 4.0,
  },

  // ── Security & Privacy ──
  {
    id: '19',
    name: 'CyberGuard VPN',
    description: 'Decentralized VPN on 200+ nodes — zero-knowledge architecture, WireGuard protocol, and pay-per-GB with TON',
    price: 6.0,
    rating: 4.6,
    downloads: 31200,
    image: 'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Security',
    developer: 'PrivacyFirst',
    isFeatured: false,
    donationAmount: 14.0,
  },
  {
    id: '20',
    name: 'CryptoGuard Firewall',
    description: 'Smart contract firewall that simulates every transaction before signing — flag rug-pulls, phishing, and drainers',
    price: 10.0,
    rating: 4.8,
    downloads: 9800,
    image: 'https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Security',
    developer: 'ChainShield',
    isFeatured: false,
    donationAmount: 17.0,
  },

  // ── Media & Entertainment ──
  {
    id: '21',
    name: 'StreamVault',
    description: 'Creator-first streaming platform with TON tips, subscriber NFT passes, VOD library, and 4K adaptive bitrate',
    price: 16.0,
    rating: 4.7,
    downloads: 14300,
    image: 'https://images.pexels.com/photos/1117132/pexels-photo-1117132.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Media',
    developer: 'VaultMedia',
    isFeatured: false,
    donationAmount: 33.0,
  },
  {
    id: '22',
    name: 'Podcast Studio Pro',
    description: 'Record multi-track, remove noise with AI, auto-generate transcripts and chapters — publish to Spotify and Apple in one tap',
    price: 13.0,
    rating: 4.5,
    downloads: 6100,
    image: 'https://images.pexels.com/photos/6953870/pexels-photo-6953870.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Media',
    developer: 'AudioCraft',
    isFeatured: false,
    donationAmount: 8.0,
  },

  // ── Social & Communication ──
  {
    id: '23',
    name: 'NeonChat Messenger',
    description: 'E2E encrypted messenger with TON micropayments, disappearing chats, group polls, and 10 GB free cloud storage',
    price: 0,
    rating: 4.4,
    downloads: 41200,
    image: 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Social',
    developer: 'CipherComm',
    isFeatured: false,
    donationAmount: 1.8,
  },
  {
    id: '24',
    name: 'TeamSync Hub',
    description: 'Workspace for Web3 teams — Kanban boards, video calls, shared vaults, and on-chain milestone payments',
    price: 9.0,
    rating: 4.6,
    downloads: 7500,
    image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Social',
    developer: 'SyncLabs',
    isFeatured: false,
    donationAmount: 6.0,
  },

  // ── Health & Wellness ──
  {
    id: '25',
    name: 'MindBody Scanner',
    description: 'Meditation coach with 500+ guided sessions, HRV biofeedback, mood journal, and weekly progress insights',
    price: 7.0,
    rating: 4.7,
    downloads: 16800,
    image: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Health',
    developer: 'WellBeing AI',
    isFeatured: false,
    donationAmount: 11.0,
  },
  {
    id: '26',
    name: 'Sleep Optimizer',
    description: 'Smart sleep tracker with adaptive soundscapes, smart alarm, sleep debt calculator, and Apple Health / Google Fit sync',
    price: 4.5,
    rating: 4.3,
    downloads: 28400,
    image: 'https://images.pexels.com/photos/3771069/pexels-photo-3771069.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Health',
    developer: 'DreamTech',
    isFeatured: false,
    donationAmount: 3.5,
  },

  // ── Utilities & System ──
  {
    id: '27',
    name: 'SystemPulse Monitor',
    description: 'Monitor servers, validators, and nodes in real time — uptime SLA dashboards, Telegram/Discord alerts, and incident logs',
    price: 8.5,
    rating: 4.6,
    downloads: 5400,
    image: 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Utilities',
    developer: 'InfraOps',
    isFeatured: false,
    donationAmount: 7.0,
  },
  {
    id: '28',
    name: 'CloudBackup Pro',
    description: 'AES-256 encrypted backups to decentralized storage on TON — auto-schedule, versioning, and one-click restore',
    price: 6.0,
    rating: 4.4,
    downloads: 9100,
    image: 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Utilities',
    developer: 'VaultSync',
    isFeatured: false,
    donationAmount: 5.5,
  },
  {
    id: '29',
    name: 'TON Explorer Pro',
    description: 'Blockchain explorer with contract source viewer, gas estimator, whale tracker, and real-time mempool visualizer',
    price: 0,
    rating: 4.8,
    downloads: 35600,
    image: 'https://images.pexels.com/photos/844124/pexels-photo-844124.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'DeFi',
    developer: 'ChainVision',
    isFeatured: false,
    donationAmount: 2.1,
  },
  {
    id: '30',
    name: 'AI Art Generator',
    description: 'Text-to-image with 15 style models (anime, oil, photo-real), inpainting, outpainting, and batch generation API',
    price: 10.0,
    rating: 4.8,
    downloads: 27300,
    image: 'https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services',
    developer: 'ArtifactAI',
    isFeatured: false,
    donationAmount: 19.0,
  },
];

const PRODUCT_DETAIL_BY_ID: Record<string, ProductDetail> = {
  '1': {
    ...CATALOG_LISTING_PRODUCTS[0],
    longDescription: `Karma Tracker turns your daily intentions into measurable progress. Choose from 30+ mindfulness templates or create custom habits, track streaks with visual calendars, and earn TON micro-rewards for consistency.

**Core features:**
- 30+ habit templates (meditation, gratitude, exercise, reading)
- Streak engine with weekly/monthly analytics
- TON challenge system — stake & earn for hitting goals
- iCloud & Google sync, offline-first architecture
- Widget support for iOS and Android home screen`,
    reviewStatsCount: 312,
    images: [
      'https://images.pexels.com/photos/5082579/pexels-photo-5082579.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3243090/pexels-photo-3243090.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '3.1.0',
    size: '24 MB',
    platforms: ['iOS', 'Android', 'Web'],
    requirements: 'iOS 15+ / Android 10+',
    lastUpdated: '2025-03-10',
    tags: ['Habits', 'Mindfulness', 'Productivity', 'TON Rewards'],
  },
  '4': {
    ...CATALOG_LISTING_PRODUCTS[3],
    longDescription: `Neon Arena drops 60 players into a neon-lit cyberpunk megacity. Loot weapons, build cover, and fight to be the last squad standing. Every match earns XP and seasonal tokens tradeable on the TON marketplace.

**Highlights:**
- 60-player battle royale, solo or 4-player squads
- NFT character skins tradeable on TON
- Seasonal ranked leagues with TON prize pools
- Cross-platform: PC, Mobile, Web
- Built-in proximity voice chat and ping system
- Weekly tournaments with live spectator mode`,
    reviewStatsCount: 1420,
    images: [
      'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/163036/mario-luigi-yoshi-trio-163036.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '3.2.0',
    size: '512 MB',
    platforms: ['Windows', 'macOS', 'Android', 'iOS'],
    requirements: '4 GB RAM, GPU recommended',
    lastUpdated: '2025-03-01',
    tags: ['Battle Royale', 'NFT', 'Multiplayer', 'Cyberpunk', 'Esports'],
  },
  '5': {
    ...CATALOG_LISTING_PRODUCTS[4],
    longDescription: `Chakra Quest is an open-world action RPG spanning 7 elemental realms. Every dialogue choice, quest outcome, and NPC interaction feeds the karma engine, branching the story into dozens of unique endings.

**World:**
- 7 hand-crafted realms with distinct biomes and lore
- 200+ main and side quests
- Karma engine: choices alter world state and NPC behavior
- Crafting system with 400+ materials
- PvP arenas with seasonal rankings`,
    reviewStatsCount: 580,
    images: [
      'https://images.pexels.com/photos/163036/mario-luigi-yoshi-trio-163036.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '2.4.0',
    size: '380 MB',
    platforms: ['Windows', 'macOS', 'Android'],
    requirements: '3 GB RAM, 2 GB storage',
    lastUpdated: '2025-02-15',
    tags: ['RPG', 'Open World', 'Story', 'Karma'],
  },
  '7': {
    ...CATALOG_LISTING_PRODUCTS[6],
    longDescription: `AI Wisdom Oracle combines frontier language models with curated knowledge bases spanning philosophy, science, law, and engineering. Every answer includes source citations you can verify.

**Capabilities:**
- Context-aware conversations across 40+ disciplines
- Source citation for every factual claim
- Custom knowledge base uploads (PDF, EPUB, Markdown)
- Voice interaction with 8 natural voices
- REST API with streaming for developer integration
- On-device mode for sensitive data (no cloud)`,
    reviewStatsCount: 640,
    images: [
      'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '4.0.0',
    size: 'Cloud',
    platforms: ['Web', 'API', 'iOS', 'Android'],
    requirements: 'Internet connection',
    lastUpdated: '2025-02-20',
    tags: ['AI', 'Knowledge', 'Research', 'API'],
  },
  '10': {
    ...CATALOG_LISTING_PRODUCTS[9],
    longDescription: `Cosmic Code Editor Pro is a cross-platform editor built for speed and beauty. GPT-4 inline completions anticipate your next line, while cosmic color schemes keep your eyes comfortable during long sessions.

**Features:**
- GPT-4 code completions with multi-file context
- 50+ language grammars and LSP support
- Built-in terminal, git diff viewer, and merge tool
- Cosmic, Nebula, and Aurora color schemes
- Plugin marketplace with 200+ extensions
- Remote SSH editing and container dev support`,
    reviewStatsCount: 892,
    images: [
      'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/374074/pexels-photo-374074.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '2.1.0',
    size: '128 MB',
    platforms: ['macOS', 'Windows', 'Linux'],
    requirements: 'macOS 10.15+, Windows 10+, Ubuntu 18.04+',
    lastUpdated: '2025-01-15',
    tags: ['Editor', 'AI', 'Productivity', 'Git', 'LSP'],
  },
  '12': {
    ...CATALOG_LISTING_PRODUCTS[11],
    longDescription: `PixelForge Designer is a professional-grade design tool that handles both vector and raster workflows on a GPU-accelerated canvas. Import Figma files, collaborate in real time, and export to any format.

**Included:**
- Infinite vector canvas with boolean operations
- Non-destructive raster editing with 80+ filters
- 1,000+ design templates and UI kits
- Figma/Sketch import, PDF/SVG/PNG export
- Real-time multiplayer editing (up to 10 users)
- Design tokens and component library system`,
    reviewStatsCount: 410,
    images: [
      'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '5.0.2',
    size: '210 MB',
    platforms: ['macOS', 'Windows', 'Web'],
    requirements: '8 GB RAM, GPU recommended',
    lastUpdated: '2025-03-05',
    tags: ['Design', 'Vector', 'Figma', 'Collaboration'],
  },
  '15': {
    ...CATALOG_LISTING_PRODUCTS[14],
    longDescription: `TON Wallet Shield protects your assets with multi-signature authorization, real-time transaction scanning, and whale movement alerts. Track your portfolio across TON, Ethereum, and Bitcoin in a single dashboard.

**Security features:**
- Multi-sig with 2/3 or 3/5 approval schemes
- Pre-sign transaction simulation (detect drainers)
- Whale and smart-money movement alerts
- Portfolio analytics with P&L tracking
- Hardware wallet support (Ledger, Trezor)
- Biometric lock and auto-lock timer`,
    reviewStatsCount: 920,
    images: [
      'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '6.1.0',
    size: '45 MB',
    platforms: ['iOS', 'Android', 'Chrome Extension'],
    requirements: 'iOS 15+ / Android 11+',
    lastUpdated: '2025-03-12',
    tags: ['Wallet', 'Security', 'Multi-sig', 'Portfolio'],
  },
  '17': {
    ...CATALOG_LISTING_PRODUCTS[16],
    longDescription: `Quantum Learning Hub offers 80+ interactive courses on blockchain development, smart contracts, tokenomics, and Web3 product design. Complete courses to earn verifiable NFT certificates on TON.

**Platform:**
- 80+ courses from beginner to advanced
- Interactive code playgrounds for Solidity, FunC, Tact
- Verifiable NFT certificates on course completion
- Community forums and mentor matching
- Mobile-friendly with offline video downloads
- Corporate team plans with progress tracking`,
    reviewStatsCount: 680,
    images: [
      'https://images.pexels.com/photos/4145153/pexels-photo-4145153.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/267669/pexels-photo-267669.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '2.8.0',
    size: 'Cloud',
    platforms: ['Web', 'iOS', 'Android'],
    requirements: 'Internet connection',
    lastUpdated: '2025-02-28',
    tags: ['Education', 'Blockchain', 'Web3', 'Certificates'],
  },
};

export const REVIEWS_PRODUCT_1: ProductReview[] = [
  {
    id: 'rev-product-10-a',
    author: 'ZenCoder',
    rating: 5,
    date: '2025-01-10',
    comment:
      'The GPT-4 completions are the best I have used — they understand multi-file context. Cosmic theme is gorgeous at night.',
    helpful: 23,
  },
  {
    id: 'rev-product-10-b',
    author: 'MindfulDev',
    rating: 5,
    date: '2025-01-08',
    comment:
      'Switched from VS Code for the git diff viewer alone. The plugin ecosystem is growing fast and the editor feels lighter.',
    helpful: 18,
  },
  {
    id: 'rev-product-10-c',
    author: 'EnlightenedProgrammer',
    rating: 4,
    date: '2025-01-05',
    comment:
      'Solid editor with beautiful UI. AI assist is top-notch. Minor lag on 10k+ line files, but the team ships fixes fast.',
    helpful: 12,
  },
];

export function getSeedDetailOrNull(productId: string): ProductDetail | null {
  return PRODUCT_DETAIL_BY_ID[productId] ?? null;
}
