import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';
import { connectorConfig } from './dataconnect-admin';

let adminApp;
if (getApps().length === 0) {
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && privateKeyRaw) {
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKeyRaw,
      })
    });
  } else {
    adminApp = initializeApp();
  }
} else {
  adminApp = getApp();
}

export const adminDc = getDataConnect(connectorConfig);
