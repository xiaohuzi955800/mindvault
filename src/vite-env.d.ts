/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_AI_PROVIDER?: 'mock' | 'firebase';
  /** UI variant: v1 (journal-first, default) | v2 | v3 | v4 | v5. */
  readonly VITE_VARIANT?: 'v1' | 'v2' | 'v3' | 'v4' | 'v5';
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
