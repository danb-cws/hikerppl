import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.databaseURL && config.projectId);

const app = firebaseConfigured ? initializeApp(config) : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Database | null = app ? getDatabase(app, config.databaseURL) : null;
