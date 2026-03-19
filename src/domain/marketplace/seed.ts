import type { CatalogListingProduct, ProductDetail, ProductReview } from './types';

/** Единый демо-каталог; заменяется запросами к Appwrite при появлении backend. */
export const CATALOG_LISTING_PRODUCTS: CatalogListingProduct[] = [
  {
    id: '1',
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
    id: '2',
    name: 'Meditation Game: Inner Peace',
    description: 'Immersive meditation experience with sacred sounds and visuals',
    price: 8.2,
    rating: 4.8,
    downloads: 8900,
    image: 'https://images.pexels.com/photos/3408744/pexels-photo-3408744.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games',
    developer: 'Zen Studios',
    isFeatured: true,
    donationAmount: 18.5,
  },
  {
    id: '3',
    name: 'AI Wisdom Oracle',
    description: 'Advanced AI assistant trained on ancient wisdom texts',
    price: 22.0,
    rating: 4.7,
    downloads: 5600,
    image: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services',
    developer: 'Dharma AI',
    isFeatured: false,
    donationAmount: 12.3,
  },
  {
    id: '4',
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
  {
    id: '5',
    name: 'Chakra Game Adventure',
    description: 'RPG focused on spiritual growth and consciousness expansion',
    price: 12.0,
    rating: 4.5,
    downloads: 3200,
    image: 'https://images.pexels.com/photos/442150/pexels-photo-442150.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games',
    developer: 'Enlightened Games',
    isFeatured: true,
    donationAmount: 31.2,
  },
  {
    id: '6',
    name: 'Karma Tracker',
    description: 'Track your good deeds and spiritual progress in daily life',
    price: 3.5,
    rating: 4.4,
    downloads: 7800,
    image: 'https://images.pexels.com/photos/1181719/pexels-photo-1181719.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Apps',
    developer: 'Dharma Tech',
    isFeatured: false,
    donationAmount: 6.7,
  },
];

const PRODUCT_DETAIL_BY_ID: Record<string, ProductDetail> = {
  '1': {
    ...CATALOG_LISTING_PRODUCTS[0],
    longDescription: `Cosmic Code Editor Pro represents the next evolution in development tools, combining cutting-edge AI assistance with spiritual design principles.

    ✨ **Mystical Features:**
    - AI-powered code completion blessed by ancient algorithms
    - Sacred syntax highlighting with cosmic color schemes
    - Meditation timer integrated into your workflow
    - Karma tracking for code quality improvements
    - Buddhist principles applied to clean code architecture

    🚀 **Technical Specifications:**
    - Supports 50+ programming languages
    - Built-in terminal with zen mode
    - Advanced debugging with enlightened insights
    - Plugin ecosystem for extended consciousness
    - Cross-platform support (macOS, Windows, Linux)

    This editor isn't just a tool—it's a pathway to coding enlightenment.`,
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
};

export const REVIEWS_PRODUCT_1: ProductReview[] = [
  {
    id: 'rev-product-1-a',
    author: 'ZenCoder',
    rating: 5,
    date: '2025-01-10',
    comment:
      'This editor has transformed my coding practice! The meditation integration helps me stay focused and the AI suggestions are incredibly intuitive. Truly enlightened software! 🙏',
    helpful: 23,
  },
  {
    id: 'rev-product-1-b',
    author: 'MindfulDev',
    rating: 5,
    date: '2025-01-08',
    comment:
      'Finally, a code editor that understands the spiritual aspect of programming. The cosmic themes are beautiful and the karma tracking motivates me to write better code.',
    helpful: 18,
  },
  {
    id: 'rev-product-1-c',
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
