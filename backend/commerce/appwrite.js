'use strict';

const { Client, Databases, Storage, ID, Query } = require('node-appwrite');

function getServerClient() {
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !key) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY обязательны для commerce');
  }
  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(key);
}

let _databases;
function databases() {
  if (!_databases) {
    _databases = new Databases(getServerClient());
  }
  return _databases;
}

let _storage;
function storageClient() {
  if (!_storage) {
    _storage = new Storage(getServerClient());
  }
  return _storage;
}

module.exports = {
  getServerClient,
  databases,
  storageClient,
  ID,
  Query,
};
