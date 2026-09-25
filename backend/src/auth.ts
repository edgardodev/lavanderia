import argon2 from 'argon2';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import type { Express, Request, Response } from 'express';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { PrismaClient, Role } from '@prisma/client';

const CLIENT_SESSION_HOURS = 8;
const ADMIN_SESSION_HOURS = 2;
const ADMIN_PREAUTH_MINUTES = 10;
const MAX_FAILED_ATTEMPTS = 5;
const CLIENT_LOCK_MINUTES = 15;
const ADMIN_LOCK_MINUTES = 30;
const POLICY_VERSION = process.env.PRIVACY_POLICY_VERSION ?? '2026-09-15';
const TERMS_VERSION = process.env.TERMS_VERSION ?? '2026-09-15';

const PRIVACY_AUTHORIZATION_TEXT =
  'Autorizo el tratamiento de mis datos personales para crear y administrar mi cuenta, gestionar reservas, pagos, domicilios, soporte, notificaciones operativas y cumplimiento legal, de acuerdo con la política de tratamiento de datos personales.';
const TERMS_ACCEPTANCE_TEXT =
  'Acepto los términos y condiciones del servicio y las reglas aplicables a reservas, pagos, cancelaciones, domicilios y uso de la plataforma.';
const AGE_CONFIRMATION_TEXT =
  'Declaro que soy mayor de edad y tengo capacidad para aceptar estos términos y autorizar el tratamiento de mis datos personales.';
const MARKETING_AUTHORIZATION_TEXT =
  'Autorizo de manera opcional el envío de promociones, novedades y comunicaciones comerciales. Puedo retirar esta autorización posteriormente.';

export type SessionPayload = {
  sub?: string;
  role?: Role;
  ver?: number;
  mfa?: boolean;
  purpose?: 'session' | 'admin-setup';
};

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  canManageAdmins: boolean;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  sessionVersion: number;
};

export type RequireUser = (
  req: Request,
  res: Response,
  role?: Role,
) => Promise<AuthenticatedUser | undefined>;

function jwtSecret(): Secret {
  return process.env.JWT_SECRET ?? 'local_development_secret_change_me';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function cookieDomain() {
  const value = String(process.env.COOKIE_DOMAIN ?? '').trim();
  return value || undefined;
}

function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction(),
    maxAge,
    path: '/',
    ...(cookieDomain() ? { domain: cookieDomain() } : {}),
  };
}

function csrfCookieOptions(maxAge: number) {
  return {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: isProduction(),
    maxAge,
    path: '/',
    ...(cookieDomain() ? { domain: cookieDomain() } : {}),
  };
}

function signSession(user: { id: string; role: Role; sessionVersion: number }, mfa: boolean) {
  const hours = user.role === Role.ADMIN ? ADMIN_SESSION_HOURS : CLIENT_SESSION_HOURS;
  const options: SignOptions = { expiresIn: `${hours}h`, algorithm: 'HS256' };
  return jwt.sign(
    { sub: user.id, role: user.role, ver: user.sessionVersion, mfa, purpose: 'session' },
    jwtSecret(),
    options,
  );
}

function signAdminPreauth(user: { id: string; sessionVersion: number }) {
  return jwt.sign(
    { sub: user.id, role: Role.ADMIN, ver: user.sessionVersion, mfa: false, purpose: 'admin-setup' },
    jwtSecret(),
    { expiresIn: `${ADMIN_PREAUTH_MINUTES}m`, algorithm: 'HS256' },
  );
}

function issueSession(res: Response, user: { id: string; role: Role; sessionVersion: number }, mfa: boolean) {
  const hours = user.role === Role.ADMIN ? ADMIN_SESSION_HOURS : CLIENT_SESSION_HOURS;
  const maxAge = hours * 60 * 60 * 1000;
  res.cookie('auth_token', signSession(user, mfa), authCookieOptions(maxAge));
  res.cookie('csrf_token', nanoid(32), csrfCookieOptions(maxAge));
  res.clearCookie('admin_preauth', authCookieOptions(0));
}

function issueAdminPreauth(res: Response, user: { id: string; sessionVersion: number }) {
  res.cookie(
    'admin_preauth',
    signAdminPreauth(user),
    authCookieOptions(ADMIN_PREAUTH_MINUTES * 60 * 1000),
  );
}

export function readSession(req: Request): SessionPayload | undefined {
  const token = req.cookies?.auth_token;
  if (!token) return undefined;
  try {
    return jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as SessionPayload;
  } catch {
    return undefined;
  }
}

function readAdminPreauth(req: Request): SessionPayload | undefined {
  const token = req.cookies?.admin_preauth;
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as SessionPayload;
    if (payload.purpose !== 'admin-setup' || payload.role !== Role.ADMIN) return undefined;
    return payload;
  } catch {
    return undefined;
  }
}

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function cleanPhone(value: unknown) {
  const phone = String(value ?? '').trim();
  return phone ? phone.slice(0, 30) : undefined;
}

function passwordError(password: string, context: { email?: string; name?: string; admin?: boolean }) {
  const minimum = context.admin ? 16 : 12;
  if (password.length < minimum || password.length > 128) {
    return `La contraseña debe tener entre ${minimum} y 128 caracteres.`;
  }

  const lower = password.toLowerCase();
  const common = ['password', 'contraseña', '123456', 'qwerty', 'admin', 'lavanderia', 'lalavanderia'];
  if (common.some((item) => lower.includes(item))) {
    return 'La contraseña contiene una palabra o secuencia demasiado predecible.';
  }

  const emailLocal = context.email?.split('@')[0]?.toLowerCase();
  if (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) {
    return 'La contraseña no debe contener tu correo.';
  }

  const firstName = context.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstName && firstName.length >= 4 && lower.includes(firstName)) {
    return 'La contraseña no debe contener tu nombre.';
  }

  const categories = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (categories < 3) {
    return 'Usa una combinación de mayúsculas, minúsculas, números y símbolos.';
  }

  return undefined;
}

function hashText(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function mfaEncryptionKey() {
  const raw = process.env.MFA_ENCRYPTION_KEY ?? '';
  if (raw) {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  }
  if (isProduction()) throw new Error('MFA_ENCRYPTION_KEY debe ser una clave base64 de 32 bytes.');
  return createHash('sha256').update(String(jwtSecret())).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', mfaEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptSecret(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split('.');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Secreto MFA inválido.');
  const decipher = createDecipheriv('aes-256-gcm', mfaEncryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(value: string) {
  const clean = value.toUpperCase().replace(/=|\s|-/g, '');
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Secreto MFA inválido.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret: string, time = Date.now()) {
  const counter = Math.floor(time / 30_000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

function safeTextEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyTotp(secret: string, value: unknown) {
  const code = String(value ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((offset) => safeTextEqual(totpCode(secret, Date.now() + offset * 30_000), code));
}

function recoveryHash(code: string) {
  return createHmac('sha256', mfaEncryptionKey()).update(code.trim().toUpperCase()).digest('hex');
}

function generateRecoveryCodes() {
  return Array.from({ length: 8 }, () => {
    const raw = randomBytes(8).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
  });
}

async function registerFailure(prisma: PrismaClient, userId: string, admin: boolean) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { failedLoginAttempts: true } });
  if (!current) return;
  const attempts = current.failedLoginAttempts + 1;
  const lockMinutes = admin ? ADMIN_LOCK_MINUTES : CLIENT_LOCK_MINUTES;
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
      lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + lockMinutes * 60_000) : undefined,
    },
  });
}

async function verifyPasswordLogin(prisma: PrismaClient, email: string, password: string, role: Role) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== role || !user.isActive) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return undefined;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return undefined;

  const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!valid) {
    await registerFailure(prisma, user.id, role === Role.ADMIN);
    return undefined;
  }
  return user;
}

async function consumeRecoveryCode(prisma: PrismaClient, userId: string, otp: string, hashes: unknown) {
  if (!Array.isArray(hashes)) return false;
  const target = recoveryHash(otp);
  const values = hashes.filter((item): item is string => typeof item === 'string');
  const index = values.findIndex((hash) => safeTextEqual(hash, target));
  if (index < 0) return false;
  const next = values.filter((_, position) => position !== index);
  await prisma.user.update({ where: { id: userId }, data: { mfaRecoveryHashes: next } });
  return true;
}

async function verifyAdminSecondFactor(prisma: PrismaClient, user: {
  id: string;
  mfaSecretEncrypted: string | null;
  mfaRecoveryHashes: unknown;
}, otp: unknown) {
  const value = String(otp ?? '').trim();
  if (!value) return false;
  if (user.mfaSecretEncrypted && /^\d{6}$/.test(value)) {
    return verifyTotp(decryptSecret(user.mfaSecretEncrypted), value);
  }
  return consumeRecoveryCode(prisma, user.id, value, user.mfaRecoveryHashes);
}

async function preauthAdmin(prisma: PrismaClient, req: Request, res: Response) {
  const payload = readAdminPreauth(req);
  if (!payload?.sub || typeof payload.ver !== 'number') {
    res.status(401).json({ message: 'La verificación administrativa expiró. Inicia sesión nuevamente.' });
    return undefined;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.role !== Role.ADMIN || !user.isActive || user.sessionVersion !== payload.ver) {
    res.status(401).json({ message: 'La verificación administrativa expiró. Inicia sesión nuevamente.' });
    return undefined;
  }
  return user;
}

function adminSetupResponse(user: { mustChangePassword: boolean; mfaEnabled: boolean }) {
  return {
    setupRequired: user.mustChangePassword || !user.mfaEnabled,
    mustChangePassword: user.mustChangePassword,
    mustConfigureMfa: !user.mfaEnabled,
  };
}

export function registerAuthRoutes(
  app: Express,
  prisma: PrismaClient,
  requireUser: RequireUser,
) {
  app.post('/api/auth/register', async (req, res) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      const email = normalizeEmail(req.body?.email);
      const phone = cleanPhone(req.body?.phone);
      const password = String(req.body?.password ?? '');
      const privacyConsent = req.body?.privacyConsent === true || req.body?.consent === true;
      const termsConsent = req.body?.termsConsent === true;
      const ageConfirmed = req.body?.ageConfirmed === true;
      const marketingConsent = req.body?.marketingConsent === true;

      if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Nombre inválido.' });
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 190) return res.status(400).json({ message: 'Correo inválido.' });
      if (!privacyConsent || !termsConsent || !ageConfirmed) {
        return res.status(400).json({ message: 'Debes aceptar la autorización de datos, los términos y confirmar que eres mayor de edad.' });
      }
      const invalidPassword = passwordError(password, { email, name });
      if (invalidPassword) return res.status(400).json({ message: invalidPassword });

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const userAgent = String(req.get('user-agent') ?? '').slice(0, 300) || undefined;

      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name,
            email,
            phone,
            passwordHash,
            role: Role.CLIENT,
            passwordChangedAt: new Date(),
          },
          select: { id: true, name: true, email: true, phone: true, role: true },
        });

        await tx.userConsent.createMany({
          data: [
            {
              userId: created.id,
              consentType: 'PRIVACY_POLICY',
              policyVersion: POLICY_VERSION,
              accepted: true,
              textHash: hashText(PRIVACY_AUTHORIZATION_TEXT),
              source: 'WEB_REGISTRATION',
              userAgent,
            },
            {
              userId: created.id,
              consentType: 'TERMS_OF_SERVICE',
              policyVersion: TERMS_VERSION,
              accepted: true,
              textHash: hashText(TERMS_ACCEPTANCE_TEXT),
              source: 'WEB_REGISTRATION',
              userAgent,
            },
            {
              userId: created.id,
              consentType: 'AGE_CONFIRMATION',
              policyVersion: TERMS_VERSION,
              accepted: true,
              textHash: hashText(AGE_CONFIRMATION_TEXT),
              source: 'WEB_REGISTRATION',
              userAgent,
            },
            {
              userId: created.id,
              consentType: 'MARKETING',
              policyVersion: POLICY_VERSION,
              accepted: marketingConsent,
              textHash: hashText(MARKETING_AUTHORIZATION_TEXT),
              source: 'WEB_REGISTRATION',
              userAgent,
            },
          ],
        });

        await tx.auditLog.create({
          data: {
            actorId: created.id,
            action: 'CLIENT_REGISTERED',
            entity: 'USER',
            entityId: created.id,
            metadata: { policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, marketingConsent },
          },
        });
        return created;
      });

      return res.status(201).json({ user });
    } catch (error: any) {
      if (error?.code === 'P2002') return res.status(409).json({ message: 'Este correo ya está registrado.' });
      console.error('Error de registro', error);
      return res.status(500).json({ message: 'No se pudo crear la cuenta.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password ?? '');
      const user = await verifyPasswordLogin(prisma, email, password, Role.CLIENT);
      if (!user) return res.status(401).json({ message: 'Credenciales inválidas o acceso temporalmente bloqueado.' });

      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      issueSession(res, user, false);
      return res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
    } catch (error) {
      console.error('Error de login cliente', error);
      return res.status(500).json({ message: 'No se pudo iniciar sesión.' });
    }
  });

  app.post('/api/auth/admin/login', async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password ?? '');
      const otp = req.body?.otp;
      const user = await verifyPasswordLogin(prisma, email, password, Role.ADMIN);
      if (!user) return res.status(401).json({ message: 'Credenciales inválidas o acceso temporalmente bloqueado.' });

      if (user.mustChangePassword || !user.mfaEnabled) {
        issueAdminPreauth(res, user);
        return res.status(428).json(adminSetupResponse(user));
      }

      const validMfa = await verifyAdminSecondFactor(prisma, user, otp);
      if (!validMfa) {
        await registerFailure(prisma, user.id, true);
        return res.status(401).json({ message: 'Credenciales inválidas o acceso temporalmente bloqueado.' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      issueSession(res, user, true);
      await prisma.auditLog.create({
        data: { actorId: user.id, action: 'ADMIN_LOGIN_SUCCESS', entity: 'USER', entityId: user.id },
      });
      return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      console.error('Error de login administrador', error);
      return res.status(500).json({ message: 'No se pudo iniciar sesión.' });
    }
  });

  app.get('/api/auth/admin/security/status', async (req, res) => {
    const user = await preauthAdmin(prisma, req, res);
    if (!user) return;
    return res.json(adminSetupResponse(user));
  });

  app.post('/api/auth/admin/security/password', async (req, res) => {
    const user = await preauthAdmin(prisma, req, res);
    if (!user) return;
    const newPassword = String(req.body?.password ?? '');
    const invalidPassword = passwordError(newPassword, { email: user.email, name: user.name, admin: true });
    if (invalidPassword) return res.status(400).json({ message: invalidPassword });

    const reused = await argon2.verify(user.passwordHash, newPassword).catch(() => false);
    if (reused) return res.status(400).json({ message: 'La nueva contraseña debe ser diferente a la actual.' });

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        sessionVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    issueAdminPreauth(res, updated);
    await prisma.auditLog.create({
      data: { actorId: user.id, action: 'ADMIN_PASSWORD_CHANGED', entity: 'USER', entityId: user.id },
    });
    return res.json(adminSetupResponse(updated));
  });

  app.get('/api/auth/admin/security/mfa', async (req, res) => {
    const user = await preauthAdmin(prisma, req, res);
    if (!user) return;
    if (user.mustChangePassword) return res.status(409).json({ message: 'Primero debes cambiar la contraseña temporal.' });
    if (user.mfaEnabled) return res.json({ configured: true });

    let encrypted = user.mfaPendingSecretEncrypted;
    let secret: string;
    if (encrypted) {
      secret = decryptSecret(encrypted);
    } else {
      secret = base32Encode(randomBytes(20));
      encrypted = encryptSecret(secret);
      await prisma.user.update({ where: { id: user.id }, data: { mfaPendingSecretEncrypted: encrypted } });
    }

    const issuer = encodeURIComponent(process.env.APP_NAME ?? 'La Lavandería & Bakery');
    const label = encodeURIComponent(`${process.env.APP_NAME ?? 'La Lavandería & Bakery'}:${user.email}`);
    const otpauthUri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    return res.json({ configured: false, secret, otpauthUri });
  });

  app.post('/api/auth/admin/security/mfa', async (req, res) => {
    const user = await preauthAdmin(prisma, req, res);
    if (!user) return;
    if (user.mustChangePassword) return res.status(409).json({ message: 'Primero debes cambiar la contraseña temporal.' });
    if (user.mfaEnabled) return res.status(409).json({ message: 'MFA ya está configurado.' });
    if (!user.mfaPendingSecretEncrypted) return res.status(409).json({ message: 'Inicia primero la configuración MFA.' });

    const secret = decryptSecret(user.mfaPendingSecretEncrypted);
    if (!verifyTotp(secret, req.body?.otp)) return res.status(400).json({ message: 'Código de autenticación inválido.' });

    const recoveryCodes = generateRecoveryCodes();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
        mfaPendingSecretEncrypted: null,
        mfaRecoveryHashes: recoveryCodes.map(recoveryHash),
        sessionVersion: { increment: 1 },
        lastLoginAt: new Date(),
      },
    });
    issueSession(res, updated, true);
    await prisma.auditLog.create({
      data: { actorId: user.id, action: 'ADMIN_MFA_ENABLED', entity: 'USER', entityId: user.id },
    });
    return res.json({ configured: true, recoveryCodes });
  });

  app.post('/api/auth/logout', async (_req, res) => {
    res.clearCookie('auth_token', authCookieOptions(0));
    res.clearCookie('csrf_token', csrfCookieOptions(0));
    res.clearCookie('admin_preauth', authCookieOptions(0));
    return res.status(204).send();
  });

  app.get('/api/account/consents', async (req, res) => {
    const user = await requireUser(req, res, Role.CLIENT);
    if (!user) return;
    const consents = await prisma.userConsent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, consentType: true, policyVersion: true, accepted: true, createdAt: true },
    });
    return res.json({ consents });
  });

  app.post('/api/account/consents/marketing', async (req, res) => {
    const user = await requireUser(req, res, Role.CLIENT);
    if (!user) return;
    const accepted = req.body?.accepted === true;
    const record = await prisma.userConsent.create({
      data: {
        userId: user.id,
        consentType: 'MARKETING',
        policyVersion: POLICY_VERSION,
        accepted,
        textHash: hashText(MARKETING_AUTHORIZATION_TEXT),
        source: 'ACCOUNT_SETTINGS',
        userAgent: String(req.get('user-agent') ?? '').slice(0, 300) || undefined,
      },
    });
    return res.status(201).json({ consent: record });
  });

  app.get('/api/admin/security/users', async (req, res) => {
    const admin = await requireUser(req, res, Role.ADMIN);
    if (!admin) return;
    if (!admin.canManageAdmins) return res.status(403).json({ message: 'No tienes permiso para administrar accesos.' });

    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        canManageAdmins: true,
        mfaEnabled: true,
        mustChangePassword: true,
        lockedUntil: true,
        lastLoginAt: true,
      },
    });
    return res.json({ admins });
  });

  app.post('/api/admin/security/users', async (req, res) => {
    const admin = await requireUser(req, res, Role.ADMIN);
    if (!admin) return;
    if (!admin.canManageAdmins) return res.status(403).json({ message: 'No tienes permiso para crear administradores.' });

    const name = String(req.body?.name ?? '').trim();
    const email = normalizeEmail(req.body?.email);
    if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Nombre o correo inválido.' });
    }

    const temporaryPassword = `A!9a${randomBytes(14).toString('base64url')}`;
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });
    try {
      const created = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: Role.ADMIN,
          mustChangePassword: true,
          canManageAdmins: false,
        },
        select: { id: true, name: true, email: true },
      });
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: 'ADMIN_ACCOUNT_CREATED',
          entity: 'USER',
          entityId: created.id,
          metadata: { email: created.email },
        },
      });
      return res.status(201).json({ admin: created, temporaryPassword });
    } catch (error: any) {
      if (error?.code === 'P2002') return res.status(409).json({ message: 'Ese correo ya existe.' });
      throw error;
    }
  });

  app.patch('/api/admin/security/users/:userId/active', async (req, res) => {
    const admin = await requireUser(req, res, Role.ADMIN);
    if (!admin) return;
    if (!admin.canManageAdmins) return res.status(403).json({ message: 'No tienes permiso para administrar accesos.' });
    const userId = String(req.params.userId);
    if (userId === admin.id && req.body?.isActive === false) {
      return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta desde esta sesión.' });
    }
    const target = await prisma.user.findFirst({ where: { id: userId, role: Role.ADMIN } });
    if (!target) return res.status(404).json({ message: 'Administrador no encontrado.' });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: req.body?.isActive === true,
        sessionVersion: { increment: 1 },
      },
      select: { id: true, name: true, email: true, isActive: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: updated.isActive ? 'ADMIN_ACCOUNT_ENABLED' : 'ADMIN_ACCOUNT_DISABLED',
        entity: 'USER',
        entityId: userId,
      },
    });
    return res.json({ admin: updated });
  });
}
