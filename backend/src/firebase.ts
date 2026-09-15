import { randomUUID } from 'crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON válido.');
  }
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
      cacheControl: 'private, no-store, max-age=0',
      metadata: {
        orderId: params.orderId,
        generatedBy: 'laundry-api',
      },
    },
  });
  return path;
}

export async function deleteEvidenceImage(path: string) {
  const app = ensureFirebase();
  if (!app) return;
  await getStorage(app).bucket().file(path).delete({ ignoreNotFound: true });
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

  const uniqueTokens = [...new Set(tokens)].slice(0, 500);
  const response = await getMessaging(app).sendEachForMulticast({
    tokens: uniqueTokens,
    notification: { title, body },
    data,
    webpush: {
      notification: { icon: '/logo.png' },
      fcmOptions: { link: data.url || '/client/dashboard' },
    },
  });

  const invalidTokens = response.responses.flatMap((item, index) => {
    if (item.success) return [];
    const code = item.error?.code ?? '';
    return code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')
      ? [uniqueTokens[index]]
      : [];
  });

  return { sent: response.successCount, invalidTokens };
}
