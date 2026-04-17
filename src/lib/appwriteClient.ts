import { Account, Client, Databases } from 'appwrite';
import { logger } from './logger';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT ?? '';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID ?? '';

export const isAppwriteConfigured = Boolean(endpoint && projectId);

const client = new Client();

if (isAppwriteConfigured) {
  client.setEndpoint(endpoint).setProject(projectId);
} else {
  logger.warn(
    '[marketplace] Appwrite not configured: set VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID, ' +
      'then run scripts/provision-appwrite.mjs to provision the database.'
  );
}

export const appwriteClient = client;
export const appwriteDatabases: Databases | null = isAppwriteConfigured ? new Databases(client) : null;
export const appwriteAccount: Account | null = isAppwriteConfigured ? new Account(client) : null;
