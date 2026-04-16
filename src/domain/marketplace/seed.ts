import type { CatalogListingProduct, ProductDetail, ProductReview, DeveloperProfile, UserProfile } from './types';

export const CATALOG_LISTING_PRODUCTS: CatalogListingProduct[] = [
  // ── Apps ──
  {
    id: '1', name: 'Karma Tracker',
    description: 'Daily habit & goal tracker with 30+ mindfulness templates, streak analytics, and TON reward challenges for consistent practice',
    price: 3.5, rating: 4.4, downloads: 7800,
    image: 'https://images.pexels.com/photos/5082579/pexels-photo-5082579.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Android', developer: 'Dharma Tech', isFeatured: true, donationAmount: 6.7,
    platforms: ['iOS', 'Android', 'Web'], tags: ['Habits', 'Mindfulness', 'Productivity', 'TON Rewards'], reviewCount: 312, releaseDate: '2025-03-10',
  },
  {
    id: '2', name: 'Task Zen Planner',
    description: 'Minimalist planner with Pomodoro focus timer, Eisenhower matrix, and cross-device sync — plan less, accomplish more',
    price: 4.2, rating: 4.6, downloads: 9400,
    image: 'https://images.pexels.com/photos/3243090/pexels-photo-3243090.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Android', developer: 'FlowState Labs', isFeatured: false, donationAmount: 3.1,
    platforms: ['iOS', 'Android'], tags: ['Planner', 'Pomodoro', 'Productivity'], reviewCount: 187, releaseDate: '2025-01-22',
  },
  {
    id: '3', name: 'Expense Monk',
    description: 'Expense tracker with TON wallet auto-import, budget heatmaps, and monthly spending reports — see where every coin goes',
    price: 2.8, rating: 4.3, downloads: 5200,
    image: 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Android', developer: 'CoinWise Studio', isFeatured: false, donationAmount: 2.4,
    platforms: ['Android', 'Web'], tags: ['Finance', 'Budget', 'TON'], reviewCount: 94, releaseDate: '2024-11-05',
  },
  // ── Games ──
  {
    id: '4', name: 'Neon Arena: Battle Royale',
    description: '60-player cyberpunk battle royale — earn NFT skins, trade loot on TON, and climb ranked leaderboards each season',
    price: 12.0, rating: 4.8, downloads: 24300,
    image: 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games', developer: 'Volt Games', isFeatured: true, donationAmount: 42.5,
    platforms: ['Windows', 'macOS', 'Android', 'iOS'], tags: ['Battle Royale', 'NFT', 'Multiplayer', 'Cyberpunk', 'Esports'], reviewCount: 1420, releaseDate: '2025-03-01',
  },
  {
    id: '5', name: 'Chakra Quest RPG',
    description: 'Open-world RPG with 7 realms, 200+ quests, and a karma-based story engine — your choices reshape the universe',
    price: 8.5, rating: 4.5, downloads: 11200,
    image: 'https://images.pexels.com/photos/163036/mario-luigi-yoshi-trio-163036.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games', developer: 'Enlightened Games', isFeatured: true, donationAmount: 31.2,
    platforms: ['Windows', 'macOS', 'Android'], tags: ['RPG', 'Open World', 'Story', 'Karma'], reviewCount: 580, releaseDate: '2025-02-15',
  },
  {
    id: '6', name: 'Puzzle Galaxy',
    description: '500+ spatial puzzles across procedurally generated galaxies with daily challenges and a global time-attack board',
    price: 5.0, rating: 4.7, downloads: 8900,
    image: 'https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games', developer: 'Stellar Minds', isFeatured: false, donationAmount: 7.3,
    platforms: ['iOS', 'Android', 'Web'], tags: ['Puzzle', 'Casual', 'Daily Challenge'], reviewCount: 245, releaseDate: '2024-12-18',
  },
  // ── AI Services ──
  {
    id: '7', name: 'AI Wisdom Oracle',
    description: 'LLM-powered research assistant with source citations, 40+ knowledge domains, voice mode, and a developer API',
    price: 22.0, rating: 4.9, downloads: 15600,
    image: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services', developer: 'Dharma AI', isFeatured: true, donationAmount: 55.0,
    platforms: ['Web', 'iOS', 'Android'], tags: ['AI', 'Knowledge', 'Research', 'API'], reviewCount: 640, releaseDate: '2025-02-20',
  },
  {
    id: '8', name: 'Voice Clone Studio',
    description: 'Clone any voice in 30 seconds — create narration, podcasts, and audiobooks with 24 emotional presets and SSML control',
    price: 18.0, rating: 4.6, downloads: 6700,
    image: 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services', developer: 'SonicAI Labs', isFeatured: false, donationAmount: 12.0,
    platforms: ['Web', 'macOS', 'Windows'], tags: ['Voice', 'TTS', 'Podcasts', 'Audio'], reviewCount: 178, releaseDate: '2025-01-10',
  },
  {
    id: '9', name: 'Neural Translate Pro',
    description: 'Real-time translation for 120+ languages with document mode, context memory, and offline packs for 30 core languages',
    price: 9.5, rating: 4.7, downloads: 19800,
    image: 'https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services', developer: 'LinguaNet', isFeatured: false, donationAmount: 8.4,
    platforms: ['iOS', 'Android', 'Web', 'macOS'], tags: ['Translation', 'AI', 'Offline', 'Documents'], reviewCount: 423, releaseDate: '2024-10-30',
  },
  // ── Developer Tools ──
  {
    id: '10', name: 'Cosmic Code Editor Pro',
    description: 'Code editor with GPT-4 completions, 50+ language grammars, built-in terminal, git UI, and cosmic color schemes',
    price: 15.5, rating: 4.9, downloads: 12500,
    image: 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Developer Tools', developer: 'Sacred Devs', isFeatured: true, donationAmount: 25.8,
    platforms: ['macOS', 'Windows', 'Linux'], tags: ['Editor', 'AI', 'Productivity', 'Git', 'LSP'], reviewCount: 892, releaseDate: '2025-01-15',
  },
  {
    id: '11', name: 'Sacred Terminal',
    description: 'GPU-accelerated terminal with split panes, 60+ themes, ligature fonts, and SSH/SFTP manager built in',
    price: 5.9, rating: 4.6, downloads: 15200,
    image: 'https://images.pexels.com/photos/5077047/pexels-photo-5077047.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Developer Tools', developer: 'Mindful Apps', isFeatured: false, donationAmount: 8.1,
    platforms: ['macOS', 'Windows', 'Linux'], tags: ['Terminal', 'SSH', 'DevOps'], reviewCount: 356, releaseDate: '2024-09-12',
  },
  // ── Design & Creative ──
  {
    id: '12', name: 'PixelForge Designer',
    description: 'Vector + raster design tool with GPU canvas, 1000+ templates, Figma import, and real-time collaboration for teams',
    price: 19.0, rating: 4.8, downloads: 8400,
    image: 'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design', developer: 'CreativeForge Inc.', isFeatured: true, donationAmount: 28.0,
    platforms: ['macOS', 'Windows', 'Web'], tags: ['Design', 'Vector', 'Figma', 'Collaboration'], reviewCount: 410, releaseDate: '2025-03-05',
  },
  {
    id: '13', name: 'Photo Remaster AI',
    description: 'Upscale photos to 4x, restore old images, remove backgrounds, and enhance portraits — all in one click with batch mode',
    price: 7.5, rating: 4.5, downloads: 11300,
    image: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design', developer: 'PixelMind Studio', isFeatured: false, donationAmount: 5.2,
    platforms: ['Web', 'macOS', 'Windows'], tags: ['Photo', 'AI Upscale', 'Restore'], reviewCount: 267, releaseDate: '2024-11-20',
  },
  {
    id: '14', name: '3D Model Forge',
    description: 'Sculpt, texture, and render 3D models with PBR materials, HDRI lighting, and one-click export to glTF/USDZ/FBX',
    price: 24.0, rating: 4.7, downloads: 4200,
    image: 'https://images.pexels.com/photos/5011647/pexels-photo-5011647.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design', developer: 'VoxelWorks', isFeatured: false, donationAmount: 15.0,
    platforms: ['Windows', 'macOS'], tags: ['3D', 'Modeling', 'PBR', 'glTF'], reviewCount: 132, releaseDate: '2025-01-28',
  },
  // ── Finance & DeFi ──
  {
    id: '15', name: 'TON Wallet Shield',
    description: 'Multi-sig wallet with 2FA, transaction scanning, whale alerts, and portfolio analytics across TON, ETH, and BTC',
    price: 14.0, rating: 4.8, downloads: 18700,
    image: 'https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'DeFi', developer: 'ShieldLabs', isFeatured: true, donationAmount: 38.0,
    platforms: ['iOS', 'Android', 'Web'], tags: ['Wallet', 'Security', 'Multi-sig', 'Portfolio'], reviewCount: 920, releaseDate: '2025-03-12',
  },
  {
    id: '16', name: 'DeFi Portfolio Pro',
    description: 'Track LP positions, yields, and impermanent loss across 12 chains — auto-harvest alerts and tax report generator',
    price: 11.0, rating: 4.6, downloads: 7300,
    image: 'https://images.pexels.com/photos/6771985/pexels-photo-6771985.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'DeFi', developer: 'YieldMaster', isFeatured: false, donationAmount: 9.5,
    platforms: ['Web', 'iOS'], tags: ['DeFi', 'Yield', 'Tax', 'Multi-chain'], reviewCount: 201, releaseDate: '2024-12-03',
  },
  // ── Education ──
  {
    id: '17', name: 'Quantum Learning Hub',
    description: '80+ interactive courses on blockchain, Solidity, FunC, and Web3 — earn verifiable NFT certificates on completion',
    price: 8.0, rating: 4.7, downloads: 13500,
    image: 'https://images.pexels.com/photos/4145153/pexels-photo-4145153.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Education', developer: 'EduChain Academy', isFeatured: true, donationAmount: 21.0,
    platforms: ['Web', 'iOS', 'Android'], tags: ['Education', 'Blockchain', 'Web3', 'Certificates'], reviewCount: 680, releaseDate: '2025-02-28',
  },
  {
    id: '18', name: 'Language Master Pro',
    description: 'Learn 45 languages with AI tutoring, real-time pronunciation scoring, spaced repetition, and gamified daily streaks',
    price: 6.5, rating: 4.5, downloads: 22100,
    image: 'https://images.pexels.com/photos/267669/pexels-photo-267669.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Education', developer: 'LingoStar', isFeatured: false, donationAmount: 4.0,
    platforms: ['iOS', 'Android'], tags: ['Languages', 'AI Tutor', 'Gamification'], reviewCount: 1150, releaseDate: '2024-08-15',
  },
  // ── Security & Privacy ──
  {
    id: '19', name: 'CyberGuard VPN',
    description: 'Decentralized VPN on 200+ nodes — zero-knowledge architecture, WireGuard protocol, and pay-per-GB with TON',
    price: 6.0, rating: 4.6, downloads: 31200,
    image: 'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Security', developer: 'PrivacyFirst', isFeatured: false, donationAmount: 14.0,
    platforms: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'], tags: ['VPN', 'Privacy', 'WireGuard', 'Decentralized'], reviewCount: 890, releaseDate: '2024-07-20',
  },
  {
    id: '20', name: 'CryptoGuard Firewall',
    description: 'Smart contract firewall that simulates every transaction before signing — flag rug-pulls, phishing, and drainers',
    price: 10.0, rating: 4.8, downloads: 9800,
    image: 'https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Security', developer: 'ChainShield', isFeatured: false, donationAmount: 17.0,
    platforms: ['Web', 'iOS', 'Android'], tags: ['Firewall', 'Anti-scam', 'Smart Contract'], reviewCount: 345, releaseDate: '2025-01-06',
  },
  // ── Media & Entertainment ──
  {
    id: '21', name: 'StreamVault',
    description: 'Creator-first streaming platform with TON tips, subscriber NFT passes, VOD library, and 4K adaptive bitrate',
    price: 16.0, rating: 4.7, downloads: 14300,
    image: 'https://images.pexels.com/photos/1117132/pexels-photo-1117132.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Media', developer: 'VaultMedia', isFeatured: false, donationAmount: 33.0,
    platforms: ['Web', 'iOS', 'Android'], tags: ['Streaming', 'Creator', 'NFT Pass', '4K'], reviewCount: 512, releaseDate: '2024-10-10',
  },
  {
    id: '22', name: 'Podcast Studio Pro',
    description: 'Record multi-track, remove noise with AI, auto-generate transcripts and chapters — publish to Spotify and Apple in one tap',
    price: 13.0, rating: 4.5, downloads: 6100,
    image: 'https://images.pexels.com/photos/6953870/pexels-photo-6953870.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Media', developer: 'AudioCraft', isFeatured: false, donationAmount: 8.0,
    platforms: ['macOS', 'Windows'], tags: ['Podcast', 'Audio', 'AI Noise Removal'], reviewCount: 189, releaseDate: '2024-11-30',
  },
  // ── Social & Communication ──
  {
    id: '23', name: 'NeonChat Messenger',
    description: 'E2E encrypted messenger with TON micropayments, disappearing chats, group polls, and 10 GB free cloud storage',
    price: 0, rating: 4.4, downloads: 41200,
    image: 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Social', developer: 'CipherComm', isFeatured: false, donationAmount: 1.8,
    platforms: ['iOS', 'Android', 'Web', 'macOS', 'Windows'], tags: ['Messenger', 'E2E', 'TON Payments'], reviewCount: 2340, releaseDate: '2024-05-18',
  },
  {
    id: '24', name: 'TeamSync Hub',
    description: 'Workspace for Web3 teams — Kanban boards, video calls, shared vaults, and on-chain milestone payments',
    price: 9.0, rating: 4.6, downloads: 7500,
    image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Social', developer: 'SyncLabs', isFeatured: false, donationAmount: 6.0,
    platforms: ['Web', 'macOS', 'Windows'], tags: ['Teamwork', 'Kanban', 'Video Calls', 'Web3'], reviewCount: 156, releaseDate: '2025-02-05',
  },
  // ── Health & Wellness ──
  {
    id: '25', name: 'MindBody Scanner',
    description: 'Meditation coach with 500+ guided sessions, HRV biofeedback, mood journal, and weekly progress insights',
    price: 7.0, rating: 4.7, downloads: 16800,
    image: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Health', developer: 'WellBeing AI', isFeatured: false, donationAmount: 11.0,
    platforms: ['iOS', 'Android'], tags: ['Meditation', 'HRV', 'Mental Health'], reviewCount: 720, releaseDate: '2024-09-25',
  },
  {
    id: '26', name: 'Sleep Optimizer',
    description: 'Smart sleep tracker with adaptive soundscapes, smart alarm, sleep debt calculator, and Apple Health / Google Fit sync',
    price: 4.5, rating: 4.3, downloads: 28400,
    image: 'https://images.pexels.com/photos/3771069/pexels-photo-3771069.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Health', developer: 'DreamTech', isFeatured: false, donationAmount: 3.5,
    platforms: ['iOS', 'Android'], tags: ['Sleep', 'Soundscapes', 'Health Sync'], reviewCount: 1580, releaseDate: '2024-06-10',
  },
  // ── Utilities & System ──
  {
    id: '27', name: 'SystemPulse Monitor',
    description: 'Monitor servers, validators, and nodes in real time — uptime SLA dashboards, Telegram/Discord alerts, and incident logs',
    price: 8.5, rating: 4.6, downloads: 5400,
    image: 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Utilities', developer: 'InfraOps', isFeatured: false, donationAmount: 7.0,
    platforms: ['Web', 'Linux'], tags: ['Monitoring', 'DevOps', 'Alerts'], reviewCount: 134, releaseDate: '2024-10-22',
  },
  {
    id: '28', name: 'CloudBackup Pro',
    description: 'AES-256 encrypted backups to decentralized storage on TON — auto-schedule, versioning, and one-click restore',
    price: 6.0, rating: 4.4, downloads: 9100,
    image: 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Utilities', developer: 'VaultSync', isFeatured: false, donationAmount: 5.5,
    platforms: ['Windows', 'macOS', 'Linux'], tags: ['Backup', 'Encryption', 'TON Storage'], reviewCount: 278, releaseDate: '2024-08-30',
  },
  {
    id: '29', name: 'TON Explorer Pro',
    description: 'Blockchain explorer with contract source viewer, gas estimator, whale tracker, and real-time mempool visualizer',
    price: 0, rating: 4.8, downloads: 35600,
    image: 'https://images.pexels.com/photos/844124/pexels-photo-844124.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'DeFi', developer: 'ChainVision', isFeatured: false, donationAmount: 2.1,
    platforms: ['Web'], tags: ['Explorer', 'Blockchain', 'Analytics'], reviewCount: 1670, releaseDate: '2024-04-15',
  },
  {
    id: '30', name: 'AI Art Generator',
    description: 'Text-to-image with 15 style models (anime, oil, photo-real), inpainting, outpainting, and batch generation API',
    price: 10.0, rating: 4.8, downloads: 27300,
    image: 'https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services', developer: 'ArtifactAI', isFeatured: false, donationAmount: 19.0,
    platforms: ['Web', 'macOS', 'Windows'], tags: ['AI Art', 'Text-to-Image', 'Inpainting', 'API'], reviewCount: 1340, releaseDate: '2024-12-20',
  },
  // ── God's Creations ──
  {
    id: '31', name: 'Genesis Engine',
    description: 'Universal creation framework for building entire digital worlds — terrain gen, NPC AI, real-time multiplayer networking, and TON economy integration',
    price: 29.0, rating: 5.0, downloads: 47200,
    image: 'https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Developer Tools', developer: 'God', isFeatured: true, donationAmount: 88.0,
    platforms: ['Windows', 'macOS', 'Linux', 'Web'], tags: ['Engine', 'Game Dev', 'Multiplayer', 'World Building'], reviewCount: 2340, releaseDate: '2024-01-01',
  },
  {
    id: '32', name: 'Omniscient AI',
    description: 'AGI-class reasoning engine with unlimited context, self-improving prompts, and divine-tier code generation across 120+ languages',
    price: 42.0, rating: 4.9, downloads: 63100,
    image: 'https://images.pexels.com/photos/2004161/pexels-photo-2004161.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services', developer: 'God', isFeatured: true, donationAmount: 120.0,
    platforms: ['Web', 'iOS', 'Android', 'macOS', 'Windows'], tags: ['AGI', 'Reasoning', 'Code Gen', 'Self-improving'], reviewCount: 4210, releaseDate: '2024-03-15',
  },
  {
    id: '33', name: 'Divine Shield',
    description: 'Impenetrable security suite — quantum-resistant encryption, zero-day exploit prediction, and autonomous threat neutralization',
    price: 19.0, rating: 4.8, downloads: 38500,
    image: 'https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Security', developer: 'God', isFeatured: true, donationAmount: 66.0,
    platforms: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'], tags: ['Security', 'Quantum', 'Zero-day', 'Autonomous'], reviewCount: 1890, releaseDate: '2024-06-20',
  },
  {
    id: '34', name: 'Celestial Canvas',
    description: 'AI design suite that reads creative intent — sketch rough ideas and watch them transform into production-ready masterpieces instantly',
    price: 25.0, rating: 4.9, downloads: 28900,
    image: 'https://images.pexels.com/photos/3075993/pexels-photo-3075993.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design', developer: 'God', isFeatured: true, donationAmount: 55.0,
    platforms: ['macOS', 'Windows', 'Web', 'iOS'], tags: ['Design', 'AI', 'Creative', 'Auto-design'], reviewCount: 1560, releaseDate: '2024-09-10',
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
    authorAvatar: 'https://i.pravatar.cc/64?u=zencoder',
    userId: 'user-1',
    rating: 5,
    date: '2025-01-10',
    comment: 'The GPT-4 completions are the best I have used — they understand multi-file context. Cosmic theme is gorgeous at night.',
    helpful: 23,
  },
  {
    id: 'rev-product-10-b',
    author: 'MindfulDev',
    authorAvatar: 'https://i.pravatar.cc/64?u=mindfuldev',
    userId: 'user-2',
    rating: 5,
    date: '2025-01-08',
    comment: 'Switched from VS Code for the git diff viewer alone. The plugin ecosystem is growing fast and the editor feels lighter.',
    helpful: 18,
  },
  {
    id: 'rev-product-10-c',
    author: 'EnlightenedProgrammer',
    authorAvatar: 'https://i.pravatar.cc/64?u=enlightened',
    userId: 'user-3',
    rating: 4,
    date: '2025-01-05',
    comment: 'Solid editor with beautiful UI. AI assist is top-notch. Minor lag on 10k+ line files, but the team ships fixes fast.',
    helpful: 12,
  },
  {
    id: 'rev-product-10-d',
    author: 'CryptoNomad',
    authorAvatar: 'https://i.pravatar.cc/64?u=cryptonomad',
    userId: 'user-4',
    rating: 5,
    date: '2025-01-02',
    comment: 'Finally an editor that gets Web3 development. Built-in Solidity and FunC support saved me hours.',
    helpful: 15,
  },
  {
    id: 'rev-product-10-e',
    author: 'NeonHunter',
    authorAvatar: 'https://i.pravatar.cc/64?u=neonhunter',
    userId: 'user-5',
    rating: 4,
    date: '2024-12-28',
    comment: 'Beautiful themes and great terminal integration. Would love to see split-diff view improved.',
    helpful: 9,
  },
  {
    id: 'rev-product-10-f',
    author: 'QuantumDrifter',
    authorAvatar: 'https://i.pravatar.cc/64?u=qdrifter',
    userId: 'user-6',
    rating: 5,
    date: '2024-12-20',
    comment: 'This replaced three tools for me. The AI understands context across files better than anything I\'ve tried.',
    helpful: 27,
  },
  {
    id: 'rev-product-10-g',
    author: 'VoidWalker_42',
    authorAvatar: 'https://i.pravatar.cc/64?u=voidwalker',
    userId: 'user-7',
    rating: 5,
    date: '2024-12-15',
    comment: 'Rock solid on Linux. SSH remote development works flawlessly. The cosmic dark theme is pure art.',
    helpful: 21,
  },
  {
    id: 'rev-product-10-h',
    author: 'TON_Maximalist',
    authorAvatar: 'https://i.pravatar.cc/64?u=tonmax',
    userId: 'user-9',
    rating: 5,
    date: '2024-12-10',
    comment: 'Best investment I made this year. FunC autocomplete alone is worth the price. Sacred Devs ships fast.',
    helpful: 33,
  },
];

export function getSeedDetailOrNull(productId: string): ProductDetail | null {
  return PRODUCT_DETAIL_BY_ID[productId] ?? null;
}

export const SEED_DEVELOPERS: DeveloperProfile[] = [
  {
    id: 'dev-1', name: 'Dharma Tech',
    avatar: 'https://i.pravatar.cc/128?u=dharma-tech',
    bio: 'Mindful productivity tools for the TON ecosystem',
    website: 'https://dharmatech.ton', tonWallet: 'EQDa...x1R7',
    joinedDate: '2024-03-15', productCount: 1, totalDownloads: 7800,
    bannerUrl: 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=1200',
    telegram: 'dharmatech', twitter: 'DharmaTechTON',
    aboutLong: 'We build tools that help you build better habits. Our philosophy: technology should serve your well-being, not drain it. Every feature in Karma Tracker is designed with mindfulness at its core — from the 30+ templates curated by meditation teachers to the TON reward challenges that turn consistency into tangible value.',
  },
  {
    id: 'dev-2', name: 'FlowState Labs',
    avatar: 'https://i.pravatar.cc/128?u=flowstate',
    bio: 'Minimalist productivity — less planning, more doing',
    website: 'https://flowstate.app', joinedDate: '2024-01-10', productCount: 1, totalDownloads: 9400,
    bannerUrl: 'https://images.pexels.com/photos/3243090/pexels-photo-3243090.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'flowstate-labs', telegram: 'flowstatelabs',
    aboutLong: 'FlowState Labs was born from a simple frustration: every planner app tries to do too much. Task Zen Planner strips away the noise and gives you exactly what you need — a Pomodoro timer, an Eisenhower matrix, and seamless sync across devices. We believe the best productivity system is the one you actually use.',
  },
  {
    id: 'dev-3', name: 'CoinWise Studio',
    avatar: 'https://i.pravatar.cc/128?u=coinwise',
    bio: 'Financial clarity for crypto-native users',
    website: 'https://coinwise.ton', joinedDate: '2024-06-22', productCount: 1, totalDownloads: 5200,
    bannerUrl: 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=1200',
    twitter: 'CoinWiseStudio', telegram: 'coinwise_ton',
    aboutLong: 'Managing crypto expenses shouldn\'t require a spreadsheet and three browser tabs. CoinWise Studio builds financial tools that auto-import TON wallet transactions, visualize spending patterns with heatmaps, and generate clean monthly reports. We help you see exactly where every coin goes — so you can make smarter financial decisions.',
  },
  {
    id: 'dev-4', name: 'Volt Games',
    avatar: 'https://i.pravatar.cc/128?u=volt-games',
    bio: 'AAA battle royale & competitive games on TON',
    website: 'https://voltgames.gg', tonWallet: 'EQBv...k8Qf',
    joinedDate: '2023-11-05', productCount: 1, totalDownloads: 24300,
    bannerUrl: 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'volt-games', twitter: 'VoltGamesGG', telegram: 'voltgames',
    aboutLong: 'Volt Games is a AAA game studio building the future of competitive gaming on TON blockchain. Our flagship title Neon Arena has attracted over 24,000 players in its first season. We believe in fair play, true ownership of in-game assets, and tournaments with real stakes. Every NFT skin you earn is yours — trade it, sell it, or flex it across seasons.',
  },
  {
    id: 'dev-5', name: 'Enlightened Games',
    avatar: 'https://i.pravatar.cc/128?u=enlightened',
    bio: 'Story-driven RPGs where karma shapes destiny',
    website: 'https://enlightenedgames.ton', joinedDate: '2024-02-18', productCount: 1, totalDownloads: 11200,
    bannerUrl: 'https://images.pexels.com/photos/163036/mario-luigi-yoshi-trio-163036.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'enlightened-games', twitter: 'EnlightenedRPG', telegram: 'enlightenedgames',
    aboutLong: 'We create worlds where your choices truly matter. Chakra Quest RPG features a karma engine that tracks every dialogue choice, every NPC interaction, and every quest decision — weaving them into dozens of unique story endings. With 7 hand-crafted realms and 200+ quests, no two playthroughs are the same. We believe games can be art.',
  },
  {
    id: 'dev-6', name: 'Stellar Minds',
    avatar: 'https://i.pravatar.cc/128?u=stellar-minds',
    bio: 'Brain-teasing puzzle experiences for all ages',
    website: 'https://stellarminds.io', joinedDate: '2024-05-30', productCount: 1, totalDownloads: 8900,
    bannerUrl: 'https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=1200',
    twitter: 'StellarMindsHQ', telegram: 'stellarminds',
    aboutLong: 'Stellar Minds crafts puzzle games that challenge your spatial reasoning and reward creative thinking. Puzzle Galaxy features 500+ procedurally generated levels across infinite galaxies, daily challenges with global leaderboards, and a time-attack mode that tests your speed. Our puzzles are designed by mathematicians and loved by everyone from 8 to 80.',
  },
  {
    id: 'dev-7', name: 'Dharma AI',
    avatar: 'https://i.pravatar.cc/128?u=dharma-ai',
    bio: 'AI research tools with respect for truth and sources',
    website: 'https://dharma-ai.ton', tonWallet: 'EQCx...m4Tp',
    joinedDate: '2023-09-12', productCount: 1, totalDownloads: 15600,
    bannerUrl: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'dharma-ai', twitter: 'DharmaAI_', telegram: 'dharma_ai',
    aboutLong: 'At Dharma AI, we build AI systems that cite their sources and respect truth. AI Wisdom Oracle is used by 15,000+ researchers, lawyers, and engineers who demand verifiable knowledge. Every factual claim comes with a source citation you can check. We are committed to transparent AI that augments human intelligence without replacing human judgment.',
  },
  {
    id: 'dev-8', name: 'SonicAI Labs',
    avatar: 'https://i.pravatar.cc/128?u=sonicai',
    bio: 'Voice AI — clone, narrate, create',
    website: 'https://sonicai.dev', joinedDate: '2024-04-01', productCount: 1, totalDownloads: 6700,
    bannerUrl: 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'sonicai-labs', twitter: 'SonicAILabs', telegram: 'sonicai',
    aboutLong: 'SonicAI Labs pushes the boundaries of voice synthesis. Voice Clone Studio can replicate any voice from just 30 seconds of audio, with 24 emotional presets that bring narrations to life. We serve podcasters, audiobook creators, and content producers who need professional-quality voice without a recording studio. SSML control gives power users total precision.',
  },
  {
    id: 'dev-9', name: 'LinguaNet',
    avatar: 'https://i.pravatar.cc/128?u=linguanet',
    bio: 'Breaking language barriers with neural translation',
    website: 'https://linguanet.ai', joinedDate: '2024-01-20', productCount: 1, totalDownloads: 19800,
    bannerUrl: 'https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'linguanet', twitter: 'LinguaNetAI', telegram: 'linguanet_app',
    aboutLong: 'LinguaNet exists to make language barriers a thing of the past. Neural Translate Pro supports 120+ languages with context-aware translation that understands idioms, technical jargon, and cultural nuances. Our offline packs for 30 core languages mean you\'re never stranded without translation — even without internet. Used by travelers, businesses, and UN translators alike.',
  },
  {
    id: 'dev-10', name: 'Sacred Devs',
    avatar: 'https://i.pravatar.cc/128?u=sacred-devs',
    bio: 'Code editors built by developers, for developers',
    website: 'https://sacreddevs.io', tonWallet: 'EQAf...r2Wn',
    joinedDate: '2023-08-01', productCount: 1, totalDownloads: 12500,
    bannerUrl: 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'sacred-devs', twitter: 'SacredDevs', telegram: 'sacreddevs',
    aboutLong: 'We are a small team of passionate developers who believe that the tools you use shape the code you write. Cosmic Code Editor Pro is our love letter to every developer who has ever dreamed of a faster, smarter, more beautiful editor. Built with Rust core, GPU-rendered canvas, and AI that truly understands your codebase. 50+ language grammars, 200+ plugins, and cosmic color schemes that make late nights feel like stardust.',
  },
  {
    id: 'dev-11', name: 'Mindful Apps',
    avatar: 'https://i.pravatar.cc/128?u=mindful-apps',
    bio: 'GPU-accelerated dev tools with zen aesthetics',
    website: 'https://mindfulapps.dev', joinedDate: '2024-03-10', productCount: 1, totalDownloads: 15200,
    bannerUrl: 'https://images.pexels.com/photos/5077047/pexels-photo-5077047.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'mindful-apps', twitter: 'MindfulAppsDev', telegram: 'mindfulapps',
    aboutLong: 'Mindful Apps merges performance engineering with zen aesthetics. Sacred Terminal renders every frame on the GPU — no lag, no jank, just buttery-smooth scrolling through 10,000-line logs. With split panes, 60+ themes, ligature fonts, and a built-in SSH/SFTP manager, it\'s the terminal experience developers deserve. Beauty and speed are not mutually exclusive.',
  },
  {
    id: 'dev-12', name: 'CreativeForge Inc.',
    avatar: 'https://i.pravatar.cc/128?u=creativeforge',
    bio: 'Design tools that empower creative teams',
    website: 'https://creativeforge.design', joinedDate: '2023-12-15', productCount: 1, totalDownloads: 8400,
    bannerUrl: 'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'creativeforge', twitter: 'CreativeForgeHQ', telegram: 'creativeforge',
    aboutLong: 'CreativeForge Inc. builds the design tools that creative teams actually want. PixelForge Designer handles both vector and raster on a GPU-accelerated infinite canvas. Import your Figma files, collaborate with up to 10 teammates in real-time, and export to any format. 1,000+ templates, boolean operations, non-destructive filters, and a design token system that keeps your brand consistent.',
  },
  {
    id: 'dev-13', name: 'PixelMind Studio',
    avatar: 'https://i.pravatar.cc/128?u=pixelmind',
    bio: 'AI-powered photo enhancement and restoration',
    website: 'https://pixelmind.ai', joinedDate: '2024-07-08', productCount: 1, totalDownloads: 11300,
    bannerUrl: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'pixelmind-studio', twitter: 'PixelMindAI', telegram: 'pixelmind',
    aboutLong: 'PixelMind Studio specializes in AI-powered image enhancement. Photo Remaster AI can upscale photos to 4x resolution, restore damaged vintage images, remove backgrounds with pixel-perfect precision, and enhance portraits — all in one click. Batch mode processes hundreds of images overnight. Used by photographers, e-commerce stores, and archives restoring historical photos.',
  },
  {
    id: 'dev-14', name: 'VoxelWorks',
    avatar: 'https://i.pravatar.cc/128?u=voxelworks',
    bio: '3D modeling and sculpting for the modern artist',
    website: 'https://voxelworks.art', joinedDate: '2024-04-20', productCount: 1, totalDownloads: 4200,
    bannerUrl: 'https://images.pexels.com/photos/5011647/pexels-photo-5011647.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'voxelworks', twitter: 'VoxelWorksArt',
    aboutLong: 'VoxelWorks brings professional 3D modeling to independent artists. 3D Model Forge lets you sculpt, texture, and render with PBR materials, HDRI lighting, and real-time viewport shading. One-click export to glTF, USDZ, and FBX means your models are ready for games, AR, or 3D printing. No subscription — buy once, create forever.',
  },
  {
    id: 'dev-15', name: 'ShieldLabs',
    avatar: 'https://i.pravatar.cc/128?u=shieldlabs',
    bio: 'Multi-chain wallet security — because your keys matter',
    website: 'https://shieldlabs.ton', tonWallet: 'EQDk...a9Bw',
    joinedDate: '2023-10-28', productCount: 1, totalDownloads: 18700,
    bannerUrl: 'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'shieldlabs', twitter: 'ShieldLabsTON', telegram: 'shieldlabs_ton',
    aboutLong: 'Your keys, your crypto, your rules. ShieldLabs builds the most secure multi-signature wallets in the TON ecosystem. Our pre-sign transaction simulator detects drainers, phishing contracts, and rug-pulls before you sign. Portfolio analytics track P&L across TON, ETH, and BTC. Our scanner has prevented over $2M in potential scam losses since launch.',
  },
  {
    id: 'dev-16', name: 'YieldMaster',
    avatar: 'https://i.pravatar.cc/128?u=yieldmaster',
    bio: 'DeFi portfolio analytics across 12+ chains',
    website: 'https://yieldmaster.fi', joinedDate: '2024-06-15', productCount: 1, totalDownloads: 7300,
    bannerUrl: 'https://images.pexels.com/photos/6771985/pexels-photo-6771985.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'yieldmaster-fi', twitter: 'YieldMasterFi', telegram: 'yieldmaster',
    aboutLong: 'YieldMaster takes the guesswork out of DeFi farming. Track LP positions, yields, and impermanent loss across 12 chains in one dashboard. Auto-harvest alerts notify you when it\'s profitable to compound. Our tax report generator exports everything in formats accepted by major tax authorities. Built by DeFi degens who got tired of spreadsheets.',
  },
  {
    id: 'dev-17', name: 'EduChain Academy',
    avatar: 'https://i.pravatar.cc/128?u=educhain',
    bio: 'Web3 education with verifiable on-chain certificates',
    website: 'https://educhain.ton', joinedDate: '2024-02-01', productCount: 1, totalDownloads: 13500,
    bannerUrl: 'https://images.pexels.com/photos/4145153/pexels-photo-4145153.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'educhain-academy', twitter: 'EduChainAcademy', telegram: 'educhain',
    aboutLong: 'EduChain Academy is the largest Web3 education platform on TON. 80+ interactive courses teach blockchain development from beginner to advanced — Solidity, FunC, Tact, tokenomics, and product design. Complete a course and earn a verifiable NFT certificate on-chain that proves your skills to employers. 5,000+ graduates and counting.',
  },
  {
    id: 'dev-18', name: 'LingoStar',
    avatar: 'https://i.pravatar.cc/128?u=lingostar',
    bio: 'Learn languages with AI tutoring and gamification',
    website: 'https://lingostar.app', joinedDate: '2024-05-10', productCount: 1, totalDownloads: 22100,
    bannerUrl: 'https://images.pexels.com/photos/267669/pexels-photo-267669.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'lingostar', twitter: 'LingoStarApp', telegram: 'lingostar_app',
    aboutLong: 'LingoStar makes language learning addictive — in a good way. AI tutoring adapts to your level in real-time, pronunciation scoring uses speech recognition to perfect your accent, and spaced repetition ensures you never forget what you\'ve learned. 45 languages, gamified daily streaks, and a community of 22,000+ learners. Duolingo wishes it had this.',
  },
  {
    id: 'dev-19', name: 'PrivacyFirst',
    avatar: 'https://i.pravatar.cc/128?u=privacyfirst',
    bio: 'Decentralized VPN — zero-knowledge, zero compromise',
    website: 'https://privacyfirst.ton', joinedDate: '2023-07-14', productCount: 1, totalDownloads: 31200,
    bannerUrl: 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'privacyfirst', twitter: 'PrivacyFirstVPN', telegram: 'privacyfirst_vpn',
    aboutLong: 'PrivacyFirst runs a truly decentralized VPN on 200+ independent nodes worldwide. Zero-knowledge architecture means we literally cannot see your traffic — even if we wanted to. WireGuard protocol ensures blazing-fast speeds. Pay per GB with TON, no subscriptions, no accounts, no logs. Your internet connection, your business. 31,000+ users trust us with their privacy.',
  },
  {
    id: 'dev-20', name: 'ChainShield',
    avatar: 'https://i.pravatar.cc/128?u=chainshield',
    bio: 'Smart contract security — simulate before you sign',
    website: 'https://chainshield.io', joinedDate: '2024-01-06', productCount: 1, totalDownloads: 9800,
    bannerUrl: 'https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'chainshield', twitter: 'ChainShieldIO', telegram: 'chainshield',
    aboutLong: 'ChainShield acts as your personal smart contract bodyguard. CryptoGuard Firewall simulates every transaction in a sandboxed environment before you sign — flagging rug-pulls, phishing attempts, and wallet drainers in real-time. We\'ve analyzed over 50,000 contracts and caught 2,300+ malicious ones. Never blindly sign a transaction again.',
  },
  // ── Media & Entertainment ──
  {
    id: 'dev-21', name: 'VaultMedia',
    avatar: 'https://i.pravatar.cc/128?u=vaultmedia',
    bio: 'Creator-first streaming with TON tips and NFT passes',
    website: 'https://vaultmedia.live', joinedDate: '2024-04-10', productCount: 1, totalDownloads: 14300,
    bannerUrl: 'https://images.pexels.com/photos/1117132/pexels-photo-1117132.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'vaultmedia', twitter: 'VaultMediaLive', telegram: 'vaultmedia',
    aboutLong: 'VaultMedia is building the streaming platform creators deserve. StreamVault puts creators first: TON tips go directly to your wallet with zero platform cut, subscriber NFT passes give fans true ownership, and 4K adaptive bitrate ensures buttery-smooth playback worldwide. VOD library, live chat, and analytics — everything you need to build your audience.',
  },
  {
    id: 'dev-22', name: 'AudioCraft',
    avatar: 'https://i.pravatar.cc/128?u=audiocraft',
    bio: 'Professional podcast production made effortless',
    website: 'https://audiocraft.studio', joinedDate: '2024-06-01', productCount: 1, totalDownloads: 6100,
    bannerUrl: 'https://images.pexels.com/photos/6953870/pexels-photo-6953870.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'audiocraft-studio', twitter: 'AudioCraftHQ',
    aboutLong: 'AudioCraft removes every barrier between your ideas and a published podcast. Record multi-track audio, let AI remove background noise and generate transcripts with timestamps, auto-generate chapter markers, and publish to Spotify and Apple Podcasts in one tap. Used by 6,000+ independent podcasters who refuse to compromise on quality.',
  },
  // ── Social & Communication ──
  {
    id: 'dev-23', name: 'CipherComm',
    avatar: 'https://i.pravatar.cc/128?u=ciphercomm',
    bio: 'E2E encrypted communication for the post-privacy era',
    website: 'https://ciphercomm.ton', joinedDate: '2024-01-18', productCount: 1, totalDownloads: 41200,
    bannerUrl: 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'ciphercomm', twitter: 'CipherCommApp', telegram: 'ciphercomm',
    aboutLong: 'CipherComm believes privacy is a human right. NeonChat Messenger uses end-to-end encryption for every message, call, and file. TON micropayments let you tip friends or split bills natively. Disappearing chats, group polls, and 10 GB free cloud storage — all without a phone number. 41,000+ users who value their privacy chose NeonChat.',
  },
  {
    id: 'dev-24', name: 'SyncLabs',
    avatar: 'https://i.pravatar.cc/128?u=synclabs',
    bio: 'Workspaces for Web3 teams — ship faster together',
    website: 'https://synclabs.dev', joinedDate: '2024-08-05', productCount: 1, totalDownloads: 7500,
    bannerUrl: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'synclabs', twitter: 'SyncLabsDev', telegram: 'synclabs',
    aboutLong: 'SyncLabs builds the workspace Web3 teams actually need. TeamSync Hub combines Kanban boards, video calls, shared encrypted vaults, and on-chain milestone payments in one platform. No more juggling Discord, Notion, and Google Meet. Set milestones, deliver work, and get paid — all within the same tool. Built by a remote Web3 team, for remote Web3 teams.',
  },
  // ── Health & Wellness ──
  {
    id: 'dev-25', name: 'WellBeing AI',
    avatar: 'https://i.pravatar.cc/128?u=wellbeing-ai',
    bio: 'AI-powered mental health and meditation coaching',
    website: 'https://wellbeing-ai.app', joinedDate: '2024-03-25', productCount: 1, totalDownloads: 16800,
    bannerUrl: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=1200',
    twitter: 'WellBeingAIApp', telegram: 'wellbeing_ai',
    aboutLong: 'WellBeing AI combines ancient meditation wisdom with modern biofeedback technology. MindBody Scanner offers 500+ guided sessions from world-class teachers, HRV biofeedback that measures your calm in real-time, a mood journal with AI-generated insights, and weekly progress reports. 16,800+ users have logged over 2 million minutes of mindfulness.',
  },
  {
    id: 'dev-26', name: 'DreamTech',
    avatar: 'https://i.pravatar.cc/128?u=dreamtech',
    bio: 'Smart sleep technology for better rest and recovery',
    website: 'https://dreamtech.health', joinedDate: '2024-02-10', productCount: 1, totalDownloads: 28400,
    bannerUrl: 'https://images.pexels.com/photos/3771069/pexels-photo-3771069.jpeg?auto=compress&cs=tinysrgb&w=1200',
    twitter: 'DreamTechSleep', telegram: 'dreamtech_app',
    aboutLong: 'DreamTech is on a mission to fix the global sleep crisis. Sleep Optimizer tracks your sleep stages with clinical-grade accuracy, generates adaptive soundscapes that evolve with your sleep cycle, and wakes you during your lightest sleep phase. Sleep debt calculator shows your cumulative deficit. Syncs with Apple Health and Google Fit. 28,000+ people sleeping better every night.',
  },
  // ── Utilities & System ──
  {
    id: 'dev-27', name: 'InfraOps',
    avatar: 'https://i.pravatar.cc/128?u=infraops',
    bio: 'Server monitoring and incident management for Web3 infra',
    website: 'https://infraops.io', joinedDate: '2024-05-22', productCount: 1, totalDownloads: 5400,
    bannerUrl: 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'infraops', twitter: 'InfraOpsIO', telegram: 'infraops',
    aboutLong: 'InfraOps keeps your validators, nodes, and servers running. SystemPulse Monitor tracks uptime, latency, and resource usage in real-time with beautiful SLA dashboards. Instant alerts via Telegram and Discord when something goes wrong. Incident logs with post-mortem templates. Built by ex-Google SREs who understand that five nines uptime is not optional.',
  },
  {
    id: 'dev-28', name: 'VaultSync',
    avatar: 'https://i.pravatar.cc/128?u=vaultsync',
    bio: 'AES-256 encrypted backups to decentralized storage',
    website: 'https://vaultsync.ton', joinedDate: '2024-04-30', productCount: 1, totalDownloads: 9100,
    bannerUrl: 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'vaultsync', telegram: 'vaultsync_ton',
    aboutLong: 'VaultSync protects your data with military-grade AES-256 encryption and stores it on TON\'s decentralized storage — no single point of failure, no corporate gatekeeper. Auto-scheduled backups, file versioning with 30-day history, and one-click restore. Your data is encrypted before it ever leaves your device. Even we can\'t read it. 9,100+ users trusting their data to math, not corporations.',
  },
  // ── DeFi & Blockchain ──
  {
    id: 'dev-29', name: 'ChainVision',
    avatar: 'https://i.pravatar.cc/128?u=chainvision',
    bio: 'Blockchain analytics and explorer tools for TON',
    website: 'https://chainvision.ton', joinedDate: '2024-01-15', productCount: 1, totalDownloads: 35600,
    bannerUrl: 'https://images.pexels.com/photos/844124/pexels-photo-844124.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'chainvision', twitter: 'ChainVisionTON', telegram: 'chainvision',
    aboutLong: 'ChainVision makes the TON blockchain transparent and accessible. TON Explorer Pro lets you view any contract\'s source code, estimate gas costs, track whale movements in real-time, and visualize the mempool as transactions flow. Used by 35,000+ developers, traders, and researchers who need to understand what\'s happening on-chain. Free forever — because transparency should be free.',
  },
  {
    id: 'dev-30', name: 'ArtifactAI',
    avatar: 'https://i.pravatar.cc/128?u=artifactai',
    bio: 'AI art generation — from text to masterpiece in seconds',
    website: 'https://artifactai.art', joinedDate: '2024-08-20', productCount: 1, totalDownloads: 27300,
    bannerUrl: 'https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'artifactai', twitter: 'ArtifactAI_', telegram: 'artifactai',
    aboutLong: 'ArtifactAI turns words into visual art. AI Art Generator offers 15 style models — from anime and oil painting to photorealistic renders — with inpainting, outpainting, and batch generation. Our developer API powers 500+ apps and websites. 27,000+ artists, designers, and developers use ArtifactAI to create 100,000+ images daily. Art should have no gatekeepers.',
  },
  // ── God ──
  {
    id: 'dev-god', name: 'God',
    avatar: 'https://i.pravatar.cc/128?u=god-creator',
    bio: 'Architect of Digital Realms. Creator of impossible experiences.',
    website: 'https://god.ton', tonWallet: 'EQGo...d000',
    joinedDate: '2024-01-01', productCount: 4, totalDownloads: 177700,
    bannerUrl: 'https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=1200',
    github: 'god-creator', telegram: 'god_creator', twitter: 'god_creates',
    aboutLong: `I forge digital universes from pure mathematics. Each product is a world unto itself — a self-contained ecosystem of logic, beauty, and function.

From the Genesis Engine that powers hundreds of indie games to Omniscient AI that pushes the boundaries of machine reasoning, every creation embodies a simple philosophy: technology should amplify human potential, not constrain it.

My tools are built for creators, dreamers, and builders who refuse to accept "impossible" as an answer. Join 170,000+ developers and creators who have chosen to build with divine-grade tools.

"The best code is indistinguishable from magic."`,
  },
];

export const SEED_USERS: UserProfile[] = [
  { id: 'user-1', username: 'ZenCoder', avatar: 'https://i.pravatar.cc/64?u=zencoder', joinedDate: '2024-06-15', reviewCount: 12 },
  { id: 'user-2', username: 'MindfulDev', avatar: 'https://i.pravatar.cc/64?u=mindfuldev', joinedDate: '2024-03-22', reviewCount: 8 },
  { id: 'user-3', username: 'EnlightenedProgrammer', avatar: 'https://i.pravatar.cc/64?u=enlightened', joinedDate: '2024-01-10', reviewCount: 15 },
  { id: 'user-4', username: 'CryptoNomad', avatar: 'https://i.pravatar.cc/64?u=cryptonomad', joinedDate: '2023-11-05', reviewCount: 24 },
  { id: 'user-5', username: 'NeonHunter', avatar: 'https://i.pravatar.cc/64?u=neonhunter', joinedDate: '2024-04-18', reviewCount: 6 },
  { id: 'user-6', username: 'QuantumDrifter', avatar: 'https://i.pravatar.cc/64?u=qdrifter', joinedDate: '2024-07-01', reviewCount: 19 },
  { id: 'user-7', username: 'VoidWalker_42', avatar: 'https://i.pravatar.cc/64?u=voidwalker', joinedDate: '2023-12-20', reviewCount: 31 },
  { id: 'user-8', username: 'SakuraByte', avatar: 'https://i.pravatar.cc/64?u=sakurabyte', joinedDate: '2024-02-14', reviewCount: 9 },
  { id: 'user-9', username: 'TON_Maximalist', avatar: 'https://i.pravatar.cc/64?u=tonmax', joinedDate: '2023-09-30', reviewCount: 42 },
  { id: 'user-10', username: 'DarkMatterDev', avatar: 'https://i.pravatar.cc/64?u=darkmatter', joinedDate: '2024-05-25', reviewCount: 14 },
  { id: 'user-11', username: 'PixelSamurai', avatar: 'https://i.pravatar.cc/64?u=pixelsamurai', joinedDate: '2024-08-03', reviewCount: 7 },
  { id: 'user-12', username: 'AstralCoder', avatar: 'https://i.pravatar.cc/64?u=astralcoder', joinedDate: '2024-01-28', reviewCount: 22 },
];

const DEVELOPER_BY_NAME = new Map(SEED_DEVELOPERS.map((d) => [d.name, d]));

export function getSeedDeveloper(name: string): DeveloperProfile | undefined {
  return DEVELOPER_BY_NAME.get(name);
}

export function getSeedUser(userId: string): UserProfile | undefined {
  return SEED_USERS.find((u) => u.id === userId);
}
