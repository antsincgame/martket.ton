import type { CatalogListingProduct, ProductDetail, ProductReview } from './types';

/** Единый демо-каталог; заменяется запросами к Appwrite при появлении backend. */
export const CATALOG_LISTING_PRODUCTS: CatalogListingProduct[] = [
  // ── Apps ──
  {
    id: '1',
    name: 'Karma Tracker',
    description: 'Track your good deeds and spiritual progress in daily life',
    price: 3.5,
    rating: 4.4,
    downloads: 7800,
    image: 'https://images.pexels.com/photos/1181719/pexels-photo-1181719.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Apps',
    developer: 'Dharma Tech',
    isFeatured: true,
    donationAmount: 6.7,
  },
  {
    id: '2',
    name: 'Task Zen Planner',
    description: 'Minimalist productivity planner with focus timers and habit streaks',
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
    description: 'Simple expense tracker with TON wallet integration and budget insights',
    price: 2.8,
    rating: 4.3,
    downloads: 5200,
    image: 'https://images.pexels.com/photos/6693661/pexels-photo-6693661.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Apps',
    developer: 'CoinWise',
    isFeatured: false,
  },

  // ── Games ──
  {
    id: '4',
    name: 'Neon Arena: Battle Royale',
    description: 'Fast-paced cyberpunk battle royale with NFT character skins',
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
    description: 'RPG focused on spiritual growth and consciousness expansion',
    price: 8.5,
    rating: 4.5,
    downloads: 11200,
    image: 'https://images.pexels.com/photos/442150/pexels-photo-442150.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games',
    developer: 'Enlightened Games',
    isFeatured: true,
    donationAmount: 31.2,
  },
  {
    id: '6',
    name: 'Puzzle Galaxy',
    description: 'Mind-bending spatial puzzles across procedurally generated galaxies',
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
    description: 'Advanced AI assistant trained on ancient wisdom and modern science',
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
    description: 'Create realistic voice clones for podcasts, narration, and content',
    price: 18.0,
    rating: 4.6,
    downloads: 6700,
    image: 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services',
    developer: 'SonicAI',
    isFeatured: false,
    donationAmount: 12.0,
  },
  {
    id: '9',
    name: 'Neural Translate Pro',
    description: 'Real-time AI translation for 120+ languages with context awareness',
    price: 9.5,
    rating: 4.7,
    downloads: 19800,
    image: 'https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services',
    developer: 'LinguaNet',
    isFeatured: false,
  },

  // ── Developer Tools ──
  {
    id: '10',
    name: 'Cosmic Code Editor Pro',
    description: 'Advanced code editor with AI assistance and mystical themes',
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
    description: 'Terminal emulator with mindful productivity and beautiful themes',
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
    description: 'Vector and raster design tool with GPU-accelerated canvas',
    price: 19.0,
    rating: 4.8,
    downloads: 8400,
    image: 'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design',
    developer: 'CreativeForge',
    isFeatured: true,
    donationAmount: 28.0,
  },
  {
    id: '13',
    name: 'Photo Remaster AI',
    description: 'Restore and upscale old photos using neural network enhancement',
    price: 7.5,
    rating: 4.5,
    downloads: 11300,
    image: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Design',
    developer: 'PixelMind',
    isFeatured: false,
    donationAmount: 5.2,
  },
  {
    id: '14',
    name: '3D Model Forge',
    description: 'Sculpt and render 3D models with real-time PBR preview',
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
    description: 'Multi-sig wallet manager with transaction analytics and alerts',
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
    description: 'Track DeFi positions, yields, and impermanent loss across chains',
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
    description: 'Interactive courses on blockchain, Web3, and decentralized tech',
    price: 8.0,
    rating: 4.7,
    downloads: 13500,
    image: 'https://images.pexels.com/photos/5905700/pexels-photo-5905700.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Education',
    developer: 'EduChain',
    isFeatured: true,
    donationAmount: 21.0,
  },
  {
    id: '18',
    name: 'Language Master Pro',
    description: 'Learn any language with AI tutoring, speech recognition, and gamification',
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
    description: 'Decentralized VPN with zero-knowledge proof and TON payments',
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
    description: 'Smart contract firewall that scans transactions before signing',
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
    description: 'Decentralized streaming platform for creators with TON monetization',
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
    description: 'Record, edit, and distribute podcasts with AI noise removal',
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
    description: 'End-to-end encrypted messenger with TON micropayments',
    price: 0,
    rating: 4.4,
    downloads: 41200,
    image: 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Social',
    developer: 'CipherComm',
    isFeatured: false,
  },
  {
    id: '24',
    name: 'TeamSync Hub',
    description: 'Collaboration workspace for Web3 teams with task boards and calls',
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
    description: 'AI-powered meditation coach with biofeedback and progress analytics',
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
    description: 'Smart sleep tracking with adaptive soundscapes and wake optimization',
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
    description: 'Real-time server and node monitoring with Telegram alerts',
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
    description: 'Encrypted cloud backup with decentralized storage on TON',
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
    description: 'Advanced blockchain explorer with contract analytics and gas tracker',
    price: 0,
    rating: 4.8,
    downloads: 35600,
    image: 'https://images.pexels.com/photos/844124/pexels-photo-844124.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'DeFi',
    developer: 'ChainVision',
    isFeatured: false,
  },
  {
    id: '30',
    name: 'AI Art Generator',
    description: 'Generate stunning artwork from text prompts with style transfer',
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
  '10': {
    ...CATALOG_LISTING_PRODUCTS[9],
    longDescription: `Cosmic Code Editor Pro represents the next evolution in development tools, combining cutting-edge AI assistance with spiritual design principles.

    **Features:**
    - AI-powered code completion blessed by ancient algorithms
    - Sacred syntax highlighting with cosmic color schemes
    - Meditation timer integrated into your workflow
    - Supports 50+ programming languages
    - Built-in terminal with zen mode
    - Cross-platform support (macOS, Windows, Linux)

    This editor isn't just a tool — it's a pathway to coding enlightenment.`,
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
    tags: ['Editor', 'AI', 'Productivity', 'Sacred', 'Mindfulness'],
  },
  '4': {
    ...CATALOG_LISTING_PRODUCTS[3],
    longDescription: `Neon Arena: Battle Royale drops you into a cyberpunk megacity where 60 players fight for supremacy. Earn NFT skins, trade loot on the TON blockchain, and climb seasonal leaderboards.

    **Highlights:**
    - 60-player battle royale matches
    - NFT character skins tradeable on TON
    - Seasonal ranked leagues
    - Cross-platform: PC, Mobile, Web
    - Built-in voice chat and squad system`,
    reviewStatsCount: 1420,
    images: [
      'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/442150/pexels-photo-442150.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '3.2.0',
    size: '512 MB',
    platforms: ['Windows', 'macOS', 'Android', 'iOS'],
    requirements: '4 GB RAM, GPU recommended',
    lastUpdated: '2025-03-01',
    tags: ['Battle Royale', 'NFT', 'Multiplayer', 'Cyberpunk'],
  },
  '7': {
    ...CATALOG_LISTING_PRODUCTS[6],
    longDescription: `AI Wisdom Oracle combines large language models with curated knowledge bases spanning philosophy, science, and ancient wisdom traditions.

    **Capabilities:**
    - Context-aware conversations across 40+ disciplines
    - Source citation for every claim
    - Custom knowledge bases
    - Voice interaction mode
    - API for developers`,
    reviewStatsCount: 640,
    images: [
      'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ],
    version: '4.0.0',
    size: 'Cloud',
    platforms: ['Web', 'API'],
    requirements: 'Internet connection',
    lastUpdated: '2025-02-20',
    tags: ['AI', 'Knowledge', 'Assistant', 'Wisdom'],
  },
};

export const REVIEWS_PRODUCT_1: ProductReview[] = [
  {
    id: 'rev-product-10-a',
    author: 'ZenCoder',
    rating: 5,
    date: '2025-01-10',
    comment:
      'This editor has transformed my coding practice! The meditation integration helps me stay focused and the AI suggestions are incredibly intuitive.',
    helpful: 23,
  },
  {
    id: 'rev-product-10-b',
    author: 'MindfulDev',
    rating: 5,
    date: '2025-01-08',
    comment:
      'Finally, a code editor that understands the spiritual aspect of programming. The cosmic themes are beautiful and the karma tracking motivates me to write better code.',
    helpful: 18,
  },
  {
    id: 'rev-product-10-c',
    author: 'EnlightenedProgrammer',
    rating: 4,
    date: '2025-01-05',
    comment:
      'Great features and beautiful interface. The AI assistance is top-notch. Only minor issue is occasional lag with very large files, but overall excellent product.',
    helpful: 12,
  },
];

export function getSeedDetailOrNull(productId: string): ProductDetail | null {
  return PRODUCT_DETAIL_BY_ID[productId] ?? null;
}
