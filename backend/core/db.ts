import { Databases } from 'node-appwrite';
import { createServerClient } from './appwriteServer.js';

let _databases: Databases | null = null;

export function databases(): Databases {
  if (!_databases) {
    _databases = new Databases(createServerClient());
  }
  return _databases;
}
