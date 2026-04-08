// Клиент Appwrite с API key для серверных операций (Databases, Storage, Account по JWT пользователя).
'use strict';

const { Client } = require('node-appwrite');

function getEndpoint() {
  return process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || '';
}

function getProjectId() {
  return process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || '';
}

function getApiKey() {
  return process.env.APPWRITE_API_KEY || '';
}

function isCoreConfigured() {
  return Boolean(getEndpoint() && getProjectId() && getApiKey());
}

function createServerClient() {
  const endpoint = getEndpoint();
  const projectId = getProjectId();
  const key = getApiKey();
  if (!endpoint || !projectId || !key) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY обязательны');
  }
  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(key);
}

function createUserContextClient(jwt) {
  const endpoint = getEndpoint();
  const projectId = getProjectId();
  if (!endpoint || !projectId || !jwt) {
    throw new Error('Appwrite session JWT отсутствует');
  }
  return new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
}

module.exports = {
  getEndpoint,
  getProjectId,
  getApiKey,
  isCoreConfigured,
  createServerClient,
  createUserContextClient,
};
