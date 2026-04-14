require('dotenv').config();
const { logger } = require('./logger');
const { isCoreConfigured } = require('./core/appwriteServer');
const repo = require('./core/repository');
const { generateId } = require('./core/generateId');

async function seed() {
  if (!isCoreConfigured()) {
    logger.error('Задайте APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
    process.exit(1);
  }

  const existing = await repo.countUsers();
  if (existing > 0) {
    logger.info(`В core уже есть ${existing} профилей — сид пропущен`);
    return;
  }

  logger.info('Seeding Appwrite core (Demiurge model)...');

  const adminId = generateId();
  const demiurge1Id = generateId();
  const demiurge2Id = generateId();
  const demiurge3Id = generateId();

  await repo.insertUser({
    id: adminId,
    email: 'admin@tonstore.io',
    ton_address: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
    name: 'Admin',
    display_name: 'Platform Admin',
    role: 'admin',
    bio: 'Platform administrator',
    security_level: 'high',
    is_active: true,
  });

  await repo.insertUser({
    id: demiurge1Id,
    email: 'zen@tonstore.io',
    ton_address: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX17_AND_EXAMPLE_1',
    name: 'ZenCoder',
    display_name: 'ZenCoder',
    role: 'demiurge',
    bio: 'Meditation app creator & mindfulness enthusiast',
    security_level: 'medium',
    is_active: true,
  });

  await repo.insertUser({
    id: demiurge2Id,
    email: 'trade@tonstore.io',
    ton_address: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX17_AND_EXAMPLE_2',
    name: 'TradeMaster',
    display_name: 'TradeMaster',
    role: 'demiurge',
    bio: 'Crypto trading tools creator',
    security_level: 'medium',
    is_active: true,
  });

  await repo.insertUser({
    id: demiurge3Id,
    email: 'user@tonstore.io',
    ton_address: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX17_AND_EXAMPLE_3',
    name: 'Explorer',
    display_name: 'Explorer',
    role: 'demiurge',
    bio: 'Digital realm explorer',
    security_level: 'low',
    is_active: true,
  });

  const products = [
    {
      id: generateId(),
      creator_id: demiurge1Id,
      name: 'Sacred Meditation App',
      description: 'A comprehensive meditation app with guided sessions, breathing exercises, and progress tracking. Built natively for the TON ecosystem.',
      short_description: 'Find inner peace with guided meditation',
      price_ton: 10,
      category: 'wellness',
      image: '/images/meditation.webp',
      status: 'published',
      rating: 4.5,
      reviews_count: 12,
      downloads: 100,
    },
    {
      id: generateId(),
      creator_id: demiurge2Id,
      name: 'Crypto Trading Bot',
      description: 'Automated trading bot for TON DeFi protocols. Supports limit orders, stop-loss, and portfolio rebalancing with real-time analytics.',
      short_description: 'Automated trading for TON ecosystem',
      price_ton: 25,
      category: 'finance',
      image: '/images/trading-bot.webp',
      status: 'published',
      rating: 4.2,
      reviews_count: 8,
      downloads: 50,
    },
    {
      id: generateId(),
      creator_id: demiurge1Id,
      name: 'TON Wallet Tracker',
      description: 'Track your TON wallet portfolio, NFTs, and DeFi positions in one place. Push notifications for significant changes.',
      short_description: 'Track your TON portfolio in real-time',
      price_ton: 5,
      category: 'finance',
      image: '/images/wallet-tracker.webp',
      status: 'published',
      rating: 4.7,
      reviews_count: 20,
      downloads: 200,
    },
    {
      id: generateId(),
      creator_id: demiurge2Id,
      name: 'NFT Gallery Creator',
      description: 'Create beautiful 3D galleries for your NFT collection. Share with friends or embed on your website.',
      short_description: 'Showcase your NFTs in 3D galleries',
      price_ton: 15,
      category: 'creative',
      image: '/images/nft-gallery.webp',
      status: 'published',
      rating: 4.0,
      reviews_count: 5,
      downloads: 30,
    },
    {
      id: generateId(),
      creator_id: demiurge1Id,
      name: 'Decentralized Messenger',
      description: 'End-to-end encrypted messaging built on TON blockchain. No central servers, no data collection, full privacy.',
      short_description: 'Private messaging on TON blockchain',
      price_ton: 0,
      category: 'social',
      image: '/images/messenger.webp',
      status: 'published',
      rating: 4.8,
      reviews_count: 40,
      downloads: 500,
    },
    {
      id: generateId(),
      creator_id: demiurge2Id,
      name: 'Smart Contract IDE',
      description: 'Full-featured IDE for writing, testing, and deploying FunC and Tact smart contracts. Includes debugger and gas estimator.',
      short_description: 'Build smart contracts for TON',
      price_ton: 30,
      category: 'developer-tools',
      image: '/images/ide.webp',
      status: 'published',
      rating: 4.6,
      reviews_count: 15,
      downloads: 80,
    },
  ];

  for (const product of products) {
    await repo.insertProduct(product);
  }

  await repo.insertAuditLog({
    id: generateId(),
    user_id: adminId,
    action: 'seed',
    resource: 'database',
    resource_id: null,
    result: 'success',
    metadata: JSON.stringify({ message: 'Initial Appwrite core seed (Demiurge model)' }),
    ip_address: '127.0.0.1',
    user_agent: 'seed-script',
  });

  const finalCount = await repo.countUsers();
  logger.info(`Seed complete: ${finalCount} demiurges, ${products.length} products created`);
}

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
