/**
 * Firebase web configuration (phase 2).
 *
 * Values come from environment variables (see `.env.example`). When they are
 * absent the app runs in mock mode — no Firebase project is needed to run,
 * develop, or demo the product locally.
 *
 * NOTE ON SECRETS: Firebase web config values (apiKey, projectId, …) identify
 * the project and are public-safe by design — they are meant to ship in web
 * apps. Even so, we load them from env so the same repo runs in mock mode
 * anywhere. The App Check site key is likewise public-safe. What must NEVER
 * appear in this repo: App Check DEBUG TOKENS, service account keys, or any
 * `.env` file with real values. See README.md for the local debug-token flow.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** reCAPTCHA Enterprise site key (public-safe). Empty = App Check not configured. */
  appCheckSiteKey: string;
}

/** Returns the Firebase web config, or null when it is not configured. */
export function getFirebaseConfig(): FirebaseWebConfig | null {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY ?? '';
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? '';
  const appId = env.VITE_FIREBASE_APP_ID ?? '';
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId,
    appCheckSiteKey: env.VITE_FIREBASE_APPCHECK_SITE_KEY ?? '',
  };
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}
