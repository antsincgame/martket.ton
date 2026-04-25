// Описание env расширено, чтобы фронт типобезопасно работал с новым TonForge API и существующими сервисами.
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPWRITE_ENDPOINT: string;
  readonly VITE_APPWRITE_PROJECT_ID: string;
  readonly VITE_COMMERCE_API_URL: string;
  readonly VITE_TONFORGE_API_URL: string;
  readonly VITE_APP_ORIGIN: string;
  readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

