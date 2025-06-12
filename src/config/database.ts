import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tonwebstore';
const DB_NAME = process.env.DB_NAME || 'tonwebstore';

let client: MongoClient | null = null;

export async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client.db(DB_NAME);
}

export async function closeDatabaseConnection() {
  if (client) {
    await client.close();
    client = null;
  }
}

export const collections = {
  users: 'users',
  products: 'products',
  categories: 'categories',
  orders: 'orders',
  auditLogs: 'audit_logs'
}; 