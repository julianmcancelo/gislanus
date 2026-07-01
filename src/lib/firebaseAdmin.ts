import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyIdToken(token: string): Promise<{ uid: string } | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

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

  return null;
}
