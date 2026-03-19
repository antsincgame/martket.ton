import { Client, Databases } from 'appwrite';
import { logger } from './logger';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT ?? '';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID ?? '';

export const isAppwriteConfigured = Boolean(endpoint && projectId);

const client = new Client();

if (isAppwriteConfigured) {
  client.setEndpoint(endpoint).setProject(projectId);
} else {
  logger.warn(
    '[marketplace] Appwrite не настроен: задайте VITE_APPWRITE_ENDPOINT и VITE_APPWRITE_PROJECT_ID, ' +
      'затем выполните scripts/provision-appwrite.mjs для развёртывания БД.'
  );
}

export const appwriteDatabases: Databases | null = isAppwriteConfigured ? new Databases(client) : null;
