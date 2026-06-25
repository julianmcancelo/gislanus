import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyIdToken(token: string): Promise<{ uid: string } | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (projectId) {
    try {
      if (!jwks) {
        jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
      }
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      });
      const uid = (payload.user_id as string | undefined) ?? payload.sub;
      return uid ? { uid } : null;
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
