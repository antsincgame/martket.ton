const Database = require('better-sqlite3');
const path = require('path');
const { logger } = require('./logger');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'store.db');

const dir = path.dirname(DB_PATH);
const fs = require('fs');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email TEXT UNIQUE,
      ton_address TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      avatar TEXT,
      bio TEXT,
      security_level TEXT NOT NULL DEFAULT 'low',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS developers (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      description TEXT,
      ton_address TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      developer_id TEXT REFERENCES developers(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      short_description TEXT,
      price_ton REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'other',
      image TEXT,
      rating REAL NOT NULL DEFAULT 0,
      reviews_count INTEGER NOT NULL DEFAULT 0,
      downloads INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      result TEXT NOT NULL DEFAULT 'success',
      metadata TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_ton_address ON users(ton_address);
    CREATE INDEX IF NOT EXISTS idx_developers_email ON developers(email);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);

  logger.info('Database schema initialized');
}

initSchema();

const queries = {
  users: {
    findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    findByTonAddress: db.prepare('SELECT * FROM users WHERE ton_address = ?'),
    findById: db.prepare('SELECT * FROM users WHERE id = ?'),
    getAll: db.prepare('SELECT * FROM users ORDER BY created_at DESC'),
    insert: db.prepare(`
      INSERT INTO users (id, email, ton_address, name, role, avatar, bio, security_level)
      VALUES (@id, @email, @ton_address, @name, @role, @avatar, @bio, @security_level)
    `),
    update: db.prepare(`
      UPDATE users SET name = @name, role = @role, avatar = @avatar, bio = @bio,
        security_level = @security_level, updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare('DELETE FROM users WHERE id = ?'),
    count: db.prepare('SELECT COUNT(*) as count FROM users'),
  },

  developers: {
    getAll: db.prepare('SELECT * FROM developers ORDER BY created_at DESC'),
    findById: db.prepare('SELECT * FROM developers WHERE id = ?'),
    findByEmail: db.prepare('SELECT * FROM developers WHERE email = ?'),
    insert: db.prepare(`
      INSERT INTO developers (id, user_id, name, email, description, ton_address, status)
      VALUES (@id, @user_id, @name, @email, @description, @ton_address, @status)
    `),
    update: db.prepare(`
      UPDATE developers SET name = @name, email = @email, description = @description,
        status = @status, updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare('DELETE FROM developers WHERE id = ?'),
  },

  products: {
    getAll: db.prepare('SELECT * FROM products WHERE status = ? ORDER BY created_at DESC'),
    getAllAny: db.prepare('SELECT * FROM products ORDER BY created_at DESC'),
    findById: db.prepare('SELECT * FROM products WHERE id = ?'),
    findByCategory: db.prepare('SELECT * FROM products WHERE category = ? AND status = ? ORDER BY created_at DESC'),
    findByDeveloper: db.prepare('SELECT * FROM products WHERE developer_id = ? ORDER BY created_at DESC'),
    insert: db.prepare(`
      INSERT INTO products (id, developer_id, name, description, short_description,
        price_ton, category, image, status)
      VALUES (@id, @developer_id, @name, @description, @short_description,
        @price_ton, @category, @image, @status)
    `),
    update: db.prepare(`
      UPDATE products SET name = @name, description = @description,
        price_ton = @price_ton, category = @category, image = @image,
        status = @status, updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare('DELETE FROM products WHERE id = ?'),
  },

  auditLogs: {
    getAll: db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?'),
    findByUserId: db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'),
    insert: db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource, resource_id, result, metadata, ip_address, user_agent)
      VALUES (@id, @user_id, @action, @resource, @resource_id, @result, @metadata, @ip_address, @user_agent)
    `),
  },

  sessions: {
    findByToken: db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')'),
    insert: db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent)
      VALUES (@id, @user_id, @token, @expires_at, @ip_address, @user_agent)
    `),
    deleteByToken: db.prepare('DELETE FROM sessions WHERE token = ?'),
    deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
    deleteByUserId: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  },
};

function generateId() {
  const bytes = require('crypto').randomBytes(16);
  return bytes.toString('hex');
}

module.exports = { db, queries, generateId };
