import { Client } from 'node-appwrite';

function getEndpoint(): string {
  return process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || '';
}

function getProjectId(): string {
  return process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || '';
}

function getApiKey(): string {
  return process.env.APPWRITE_API_KEY || '';
}

const _loggedOnce = { done: false };
function logConfigOnce(): void {
  if (_loggedOnce.done) return;
  _loggedOnce.done = true;
  const ep = getEndpoint();
  const pid = getProjectId();
  const hasKey = !!getApiKey();
  console.info(`[AUTH_AUDIT_BE] Appwrite config → endpoint=${ep || '(empty)'}, projectId=${pid || '(empty)'}, hasApiKey=${hasKey}`);
}

export function isCoreConfigured(): boolean {
  return Boolean(getEndpoint() && getProjectId() && getApiKey());
}

export function createServerClient(): Client {
  const endpoint = getEndpoint();
  const projectId = getProjectId();
  const key = getApiKey();
  if (!endpoint || !projectId || !key) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY are required');
  }
  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(key);
}

export function createUserContextClient(jwt: string): Client {
  logConfigOnce();
  const endpoint = getEndpoint();
  const projectId = getProjectId();
  if (!endpoint || !projectId || !jwt) {
    throw new Error(`Appwrite session JWT config missing: endpoint=${!!endpoint}, projectId=${!!projectId}, jwt=${!!jwt}`);
  }
  return new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
}
