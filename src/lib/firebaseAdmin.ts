import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminAuth() {
  if (getApps().length > 0) return getAuth();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getAuth();
}

// Returns { uid } if valid, null otherwise.
// If firebase-admin credentials are not configured, falls back to
// decoding (without verifying) the JWT payload — less secure but
// functional without a service-account key.
export async function verifyIdToken(token: string): Promise<{ uid: string } | null> {
  const auth = getAdminAuth();

  if (!auth) {
    try {
      const part = token.split('.')[1];
      const payload = JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
      const uid: string | undefined = payload.user_id ?? payload.sub;
      return uid ? { uid } : null;
    } catch {
      return null;
    }
  }

  try {
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}
