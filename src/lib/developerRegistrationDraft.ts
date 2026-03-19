const STORAGE_KEY = 'ton-web-store-developer-registration-draft';

export interface DeveloperRegistrationDraftPayload {
  wallet: string;
  email: string;
  name: string;
}

export function persistDeveloperRegistrationDraft(payload: DeveloperRegistrationDraftPayload): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage недоступен (privacy mode) — игнорируем */
  }
}

export function readDeveloperRegistrationDraft(): DeveloperRegistrationDraftPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDraftPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDeveloperRegistrationDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function isDraftPayload(value: unknown): value is DeveloperRegistrationDraftPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.wallet === 'string' &&
    typeof record.email === 'string' &&
    typeof record.name === 'string'
  );
}
