import { randomUUID } from 'crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function ensureFirebase() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = getServiceAccount();
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!serviceAccount || !storageBucket) return undefined;

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket,
  });
}

export function firebaseReady() {
  return Boolean(ensureFirebase());
}

export async function uploadEvidenceImage(params: {
  orderId: string;
  buffer: Buffer;
  mimeType: string;
  extension: string;
}) {
  const app = ensureFirebase();
  if (!app) throw new Error('Firebase Storage no está configurado.');

  const bucket = getStorage(app).bucket();
  const path = `evidence/${params.orderId}/${randomUUID()}.${params.extension}`;
  const file = bucket.file(path);
  await file.save(params.buffer, {
    resumable: false,
    validation: 'md5',
    metadata: {
      contentType: params.mimeType,
      cacheControl: 'private, max-age=300',
    },
  });
  return path;
}

export async function signedEvidenceUrl(path: string) {
  const app = ensureFirebase();
  if (!app) return undefined;
  const [url] = await getStorage(app).bucket().file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 10 * 60 * 1000,
  });
  return url;
}

export async function sendPush(tokens: string[], title: string, body: string, data: Record<string, string> = {}) {
  const app = ensureFirebase();
  if (!app || tokens.length === 0) return { sent: 0, invalidTokens: [] as string[] };

  const response = await getMessaging(app).sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    webpush: { notification: { icon: '/logo.png' } },
  });

  const invalidTokens = response.responses.flatMap((item, index) => {
    if (item.success) return [];
    const code = item.error?.code ?? '';
    return code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')
      ? [tokens[index]]
      : [];
  });

  return { sent: response.successCount, invalidTokens };
}
