import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Intenta nuevamente en unos minutos.' },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function mutationGuard(allowedOrigins: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = req.get('origin');
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ message: 'Origen no permitido.' });
    }

    // Login/register are protected by origin checks and their own rate limit.
    if (req.path === '/auth/login' || req.path === '/auth/register') return next();

    const authCookie = req.cookies?.auth_token;
    if (!authCookie) return next();

    const cookieToken = String(req.cookies?.csrf_token ?? '');
    const headerToken = String(req.get('X-CSRF-Token') ?? '');
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      return res.status(403).json({ message: 'Solicitud rechazada por protección CSRF.' });
    }

    return next();
  };
}

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32 || jwtSecret.includes('change_me') || jwtSecret.includes('development')) {
    throw new Error('JWT_SECRET inseguro para producción. Usa un secreto aleatorio de al menos 32 caracteres.');
  }

  if (!process.env.WEB_ORIGIN?.startsWith('https://')) {
    throw new Error('WEB_ORIGIN debe usar HTTPS en producción.');
  }
}
