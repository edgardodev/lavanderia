import { randomUUID } from 'crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

function operationTimeoutMs() {
  const value = Number(process.env.FIREBASE_OPERATION_TIMEOUT_MS ?? 15000);
  if (!Number.isFinite(value)) return 15000;
  return Math.min(30000, Math.max(5000, Math.trunc(value)));
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = operationTimeoutMs()): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} excedió el tiempo permitido.`)), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  await withTimeout(file.save(params.buffer, {
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
  }), 'La carga a Firebase Storage', 20_000);
  return path;
}

export async function deleteEvidenceImage(path: string) {
  const app = ensureFirebase();
  if (!app) return;
  await withTimeout(
    getStorage(app).bucket().file(path).delete({ ignoreNotFound: true }),
    'La eliminación en Firebase Storage',
    10_000,
  );
}

export async function signedEvidenceUrl(path: string) {
  const app = ensureFirebase();
  if (!app) return undefined;
  const [url] = await withTimeout(
    getStorage(app).bucket().file(path).getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000,
    }),
    'La firma de URL de evidencia',
    8_000,
  );
  return url;
}

export async function sendPush(tokens: string[], title: string, body: string, data: Record<string, string> = {}) {
  const app = ensureFirebase();
  if (!app || tokens.length === 0) return { sent: 0, invalidTokens: [] as string[] };

  const uniqueTokens = [...new Set(tokens)].slice(0, 500);
  const response = await withTimeout(getMessaging(app).sendEachForMulticast({
    tokens: uniqueTokens,
    notification: { title, body },
    data,
    webpush: {
      notification: { icon: '/logo.png' },
      fcmOptions: { link: data.url || '/client/assisted' },
    },
  }), 'El envío de notificaciones Firebase', 12_000);

  const invalidTokens = response.responses.flatMap((item, index) => {
    if (item.success) return [];
    const code = item.error?.code ?? '';
    return code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')
      ? [uniqueTokens[index]]
      : [];
  });

  return { sent: response.successCount, invalidTokens };
}
