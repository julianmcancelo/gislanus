export async function verifyIdToken(token: string): Promise<{ uid: string } | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    try {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      if (getApps().length === 0) {
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      }
      return await getAuth().verifyIdToken(token);
    } catch {
      // fall through to basic decode
    }
  }

  // Fallback: decode without signature verification
  try {
    const part = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
    const uid: string | undefined = payload.user_id ?? payload.sub;
    return uid ? { uid } : null;
  } catch {
    return null;
  }
}
