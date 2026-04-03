const { db, queries, generateId } = require('./db');
const { logger } = require('./logger');

function seed() {
  const existingUsers = queries.users.count.get();
  if (existingUsers.count > 0) {
    logger.info(`Database already has ${existingUsers.count} users, skipping seed`);
    return;
  }

  logger.info('Seeding database...');

  const insertMany = db.transaction(() => {
    const adminId = generateId();
    const dev1Id = generateId();
    const dev2Id = generateId();
    const user1Id = generateId();

    queries.users.insert.run({
      id: adminId,
      email: 'admin@tonstore.io',
      ton_address: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
      name: 'Admin',
      role: 'admin',
      avatar: null,
      bio: 'Platform administrator',
      security_level: 'high',
    });

    queries.users.insert.run({
      id: dev1Id,
      email: 'zen@tonstore.io',
      ton_address: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX17_AND_EXAMPLE_1',
      name: 'ZenCoder',
      role: 'developer',
      avatar: null,
      bio: 'Meditation app developer',
      security_level: 'medium',
    });

    queries.users.insert.run({
      id: dev2Id,
      email: 'trade@tonstore.io',
      ton_address: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX17_AND_EXAMPLE_2',
      name: 'TradeMaster',
      role: 'developer',
      avatar: null,
      bio: 'Crypto trading tools',
      security_level: 'medium',
    });

    queries.users.insert.run({
      id: user1Id,
      email: 'user@tonstore.io',
      ton_address: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX17_AND_EXAMPLE_3',
      name: 'TestUser',
      role: 'user',
      avatar: null,
      bio: null,
      security_level: 'low',
    });

    const devReg1Id = generateId();
    const devReg2Id = generateId();

    queries.developers.insert.run({
      id: devReg1Id,
      user_id: dev1Id,
      name: 'ZenCoder',
      email: 'zen@tonstore.io',
      description: 'Building mindfulness and wellness apps for the TON ecosystem',
      ton_address: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX17_AND_EXAMPLE_1',
      status: 'approved',
    });

    queries.developers.insert.run({
      id: devReg2Id,
      user_id: dev2Id,
      name: 'TradeMaster',
      email: 'trade@tonstore.io',
      description: 'Automated trading tools for TON DeFi',
      ton_address: 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuFX17_AND_EXAMPLE_2',
      status: 'approved',
    });

    const products = [
      {
        id: generateId(),
        developer_id: devReg1Id,
        name: 'Sacred Meditation App',
        description: 'A comprehensive meditation app with guided sessions, breathing exercises, and progress tracking. Built natively for the TON ecosystem.',
        short_description: 'Find inner peace with guided meditation',
        price_ton: 10,
        category: 'wellness',
        image: '/images/meditation.webp',
        status: 'published',
      },
      {
        id: generateId(),
        developer_id: devReg2Id,
        name: 'Crypto Trading Bot',
        description: 'Automated trading bot for TON DeFi protocols. Supports limit orders, stop-loss, and portfolio rebalancing with real-time analytics.',
        short_description: 'Automated trading for TON ecosystem',
        price_ton: 25,
        category: 'finance',
        image: '/images/trading-bot.webp',
        status: 'published',
      },
      {
        id: generateId(),
        developer_id: devReg1Id,
        name: 'TON Wallet Tracker',
        description: 'Track your TON wallet portfolio, NFTs, and DeFi positions in one place. Push notifications for significant changes.',
        short_description: 'Track your TON portfolio in real-time',
        price_ton: 5,
        category: 'finance',
        image: '/images/wallet-tracker.webp',
        status: 'published',
      },
      {
        id: generateId(),
        developer_id: devReg2Id,
        name: 'NFT Gallery Creator',
        description: 'Create beautiful 3D galleries for your NFT collection. Share with friends or embed on your website.',
        short_description: 'Showcase your NFTs in 3D galleries',
        price_ton: 15,
        category: 'creative',
        image: '/images/nft-gallery.webp',
        status: 'published',
      },
      {
        id: generateId(),
        developer_id: devReg1Id,
        name: 'Decentralized Messenger',
        description: 'End-to-end encrypted messaging built on TON blockchain. No central servers, no data collection, full privacy.',
        short_description: 'Private messaging on TON blockchain',
        price_ton: 0,
        category: 'social',
        image: '/images/messenger.webp',
        status: 'published',
      },
      {
        id: generateId(),
        developer_id: devReg2Id,
        name: 'Smart Contract IDE',
        description: 'Full-featured IDE for writing, testing, and deploying FunC and Tact smart contracts. Includes debugger and gas estimator.',
        short_description: 'Build smart contracts for TON',
        price_ton: 30,
        category: 'developer-tools',
        image: '/images/ide.webp',
        status: 'published',
      },
    ];

    for (const product of products) {
      queries.products.insert.run(product);
    }

    queries.auditLogs.insert.run({
      id: generateId(),
      user_id: adminId,
      action: 'seed',
      resource: 'database',
      resource_id: null,
      result: 'success',
      metadata: JSON.stringify({ message: 'Initial database seed' }),
      ip_address: '127.0.0.1',
      user_agent: 'seed-script',
    });
  });

  insertMany();

  const finalCount = queries.users.count.get();
  logger.info(`Seed complete: ${finalCount.count} users, products and developers created`);
}

seed();
