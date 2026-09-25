import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

const baseRateLimit = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
};

export const authLimiter = rateLimit({
  ...baseRateLimit,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: 'Demasiados intentos. Intenta nuevamente en unos minutos.' },
});

export const apiLimiter = rateLimit({
  ...baseRateLimit,
  windowMs: 60 * 1000,
  limit: 180,
  skip: (req) => req.path.endsWith('/payments/wompi/webhook'),
  message: { message: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
});

export const writeLimiter = rateLimit({
  ...baseRateLimit,
  windowMs: 60 * 1000,
  limit: 60,
  skip: (req) => req.path.endsWith('/payments/wompi/webhook'),
  message: { message: 'Demasiadas operaciones de escritura. Intenta nuevamente en un momento.' },
});

export const paymentLimiter = rateLimit({
  ...baseRateLimit,
  windowMs: 5 * 60 * 1000,
  limit: 30,
  message: { message: 'Demasiados intentos de pago. Espera unos minutos antes de intentar nuevamente.' },
});

export const uploadLimiter = rateLimit({
  ...baseRateLimit,
  windowMs: 5 * 60 * 1000,
  limit: 12,
  message: { message: 'Demasiadas cargas de archivos. Espera unos minutos antes de continuar.' },
});

export const webhookLimiter = rateLimit({
  ...baseRateLimit,
  windowMs: 60 * 1000,
  limit: 300,
  message: { message: 'Límite temporal de eventos alcanzado.' },
});

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function isSessionlessMutation(path: string) {
  return path.endsWith('/auth/login')
    || path.endsWith('/auth/register')
    || path.endsWith('/auth/admin/login')
    || path.includes('/auth/admin/security/')
    || path.endsWith('/payments/wompi/webhook');
}

export function mutationGuard(allowedOrigins: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = req.get('origin');
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ message: 'Origen no permitido.' });
    }

    if (isSessionlessMutation(req.path)) return next();

    const authCookie = String(req.cookies?.auth_token ?? '');
    if (!authCookie) return next();

    const cookieToken = String(req.cookies?.csrf_token ?? '');
    const headerToken = String(req.get('X-CSRF-Token') ?? '');
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      return res.status(403).json({ message: 'Solicitud rechazada por protección CSRF.' });
    }

    return next();
  };
}

function requireProductionValue(name: string) {
  const value = String(process.env[name] ?? '').trim();
  if (!value || value.includes('REEMPLAZAR') || value.includes('PENDIENTE')) {
    throw new Error(`${name} es obligatorio en producción.`);
  }
  return value;
}

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwtSecret = requireProductionValue('JWT_SECRET');
  if (jwtSecret.length < 32 || jwtSecret.includes('change_me') || jwtSecret.includes('development')) {
    throw new Error('JWT_SECRET inseguro para producción. Usa un secreto aleatorio de al menos 32 caracteres.');
  }

  const webOrigin = requireProductionValue('WEB_ORIGIN');
  if (!webOrigin.startsWith('https://')) {
    throw new Error('WEB_ORIGIN debe usar HTTPS en producción.');
  }

  const mfaKey = Buffer.from(requireProductionValue('MFA_ENCRYPTION_KEY'), 'base64');
  if (mfaKey.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY debe ser una clave base64 de exactamente 32 bytes.');
  }

  for (const name of [
    'LEGAL_ENTITY_NAME',
    'LEGAL_ENTITY_ID',
    'LEGAL_ADDRESS',
    'LEGAL_PHONE',
    'PRIVACY_CONTACT_EMAIL',
    'CUSTOMER_SERVICE_EMAIL',
  ]) {
    requireProductionValue(name);
  }

  const databaseUrl = requireProductionValue('DATABASE_URL');
  if (!databaseUrl.startsWith('mysql://')) {
    throw new Error('DATABASE_URL debe usar MySQL en producción.');
  }

  if (process.env.WOMPI_ENVIRONMENT !== 'production') {
    throw new Error('WOMPI_ENVIRONMENT debe ser production en un despliegue de producción.');
  }
  const publicKey = requireProductionValue('WOMPI_PUBLIC_KEY');
  const privateKey = requireProductionValue('WOMPI_PRIVATE_KEY');
  const integritySecret = requireProductionValue('WOMPI_INTEGRITY_SECRET');
  const eventsSecret = requireProductionValue('WOMPI_EVENTS_SECRET');
  const redirectUrl = requireProductionValue('WOMPI_REDIRECT_URL');
  if (!publicKey.startsWith('pub_prod_') || !privateKey.startsWith('prv_prod_')) {
    throw new Error('Las llaves Wompi de producción deben usar prefijos pub_prod_ y prv_prod_.');
  }
  if (!integritySecret.startsWith('prod_') || !eventsSecret.startsWith('prod_')) {
    throw new Error('Los secretos Wompi de producción deben corresponder al ambiente de producción.');
  }
  if (!redirectUrl.startsWith('https://')) {
    throw new Error('WOMPI_REDIRECT_URL debe usar HTTPS en producción.');
  }

  requireProductionValue('FIREBASE_STORAGE_BUCKET');
  const firebaseServiceAccount = requireProductionValue('FIREBASE_SERVICE_ACCOUNT_JSON');
  let parsedServiceAccount: Record<string, unknown>;
  try {
    parsedServiceAccount = JSON.parse(firebaseServiceAccount) as Record<string, unknown>;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON debe contener JSON válido en producción.');
  }
  if (
    !parsedServiceAccount
    || typeof parsedServiceAccount !== 'object'
    || typeof parsedServiceAccount.project_id !== 'string'
    || typeof parsedServiceAccount.client_email !== 'string'
    || typeof parsedServiceAccount.private_key !== 'string'
  ) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene los campos mínimos esperados.');
  }
}
