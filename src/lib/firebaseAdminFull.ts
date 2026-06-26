import { SignJWT, importPKCS8 } from 'jose';

export async function createCustomToken(uid: string): Promise<string> {
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKeyRaw) {
    throw new Error(
      'Faltan variables de entorno de Firebase Admin (FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY)'
    );
  }

  const privateKey = await importPKCS8(privateKeyRaw, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ uid })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience('https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}
