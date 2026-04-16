import { Client, Databases, Storage, ID, Query } from 'node-appwrite';

function getServerClient(): Client {
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !key) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY обязательны для commerce');
  }
  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(key);
}

let _databases: Databases | null = null;
export function databases(): Databases {
  if (!_databases) {
    _databases = new Databases(getServerClient());
  }
  return _databases;
}

let _storage: Storage | null = null;
export function storageClient(): Storage {
  if (!_storage) {
    _storage = new Storage(getServerClient());
  }
  return _storage;
}

export { ID, Query };
