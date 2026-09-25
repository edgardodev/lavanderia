import { createHmac, randomBytes } from 'node:crypto';
import { PaymentStatus, PrismaClient } from '@prisma/client';

const API_URL = String(process.env.TEST_API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const ORIGIN = process.env.TEST_WEB_ORIGIN ?? 'http://localhost:3000';
const ADMIN_EMAIL = String(process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '');
const prisma = new PrismaClient();

class CookieJar {
  cookies = new Map();
  absorb(headers) {
    const list = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
    for (const raw of list) {
      const [pair] = raw.split(';');
      const i = pair.indexOf('=');
      if (i < 1) continue;
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
  }
  get(name) { return this.cookies.get(name); }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(jar, path, { method = 'GET', body, headers = {}, expected = [200] } = {}) {
  const finalHeaders = { Accept: 'application/json', Origin: ORIGIN, ...headers };
  if (jar?.header()) finalHeaders.Cookie = jar.header();
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && jar?.get('csrf_token') && !finalHeaders['X-CSRF-Token']) {
    finalHeaders['X-CSRF-Token'] = jar.get('csrf_token');
  }
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  jar?.absorb(response.headers);
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} -> ${response.status}: ${data?.message ?? String(data ?? '')}`);
  }
  return { status: response.status, data };
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function decodeBase32(value) {
  let bits = '';
  for (const char of value.toUpperCase().replace(/=|\s|-/g, '')) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Secreto MFA inválido.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 255) << 16) | ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, '0');
}

function futureBogotaDate(days = 2) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + days * 86_400_000));
}

function randomPassword() {
  return `Z9!${randomBytes(12).toString('hex')}aA`;
}

async function main() {
  assert(ADMIN_EMAIL && ADMIN_PASSWORD, 'Faltan credenciales bootstrap admin para smoke test.');
  const anon = new CookieJar();
  await api(anon, '/health');
  await api(anon, '/ready');
  await api(anon, '/admin/orders', { expected: [401] });

  const unique = `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
  const clientEmail = `cliente.integration.${unique}@example.com`;
  const clientPassword = randomPassword();
  const client = new CookieJar();

  await api(client, '/auth/register', {
    method: 'POST', expected: [201],
    body: { name: 'Cliente Integración', email: clientEmail, phone: '3001234567', password: clientPassword, privacyConsent: true, termsConsent: true, ageConfirmed: true, marketingConsent: false },
  });
  const login = await api(client, '/auth/login', { method: 'POST', body: { email: clientEmail, password: clientPassword } });
  assert(login.data?.user?.role === 'CLIENT' && client.get('csrf_token'), 'Login cliente incompleto.');

  const branches = await api(client, '/branches');
  const branch = branches.data?.branches?.[0];
  const machine = branch?.machines?.[0];
  assert(branch?.id && machine?.id, 'Seed sin sede/máquina disponible.');

  const reservationKey = `ci_res_${unique}`;
  const reservationBody = { branchId: branch.id, machineId: machine.id, cycleType: 'FULL', date: futureBogotaDate(), slot: '09:00-11:00', notes: 'Smoke idempotencia' };
  const reservation1 = await api(client, '/reservations', { method: 'POST', expected: [201], headers: { 'Idempotency-Key': reservationKey }, body: reservationBody });
  const reservation2 = await api(client, '/reservations', { method: 'POST', headers: { 'Idempotency-Key': reservationKey }, body: reservationBody });
  assert(reservation1.data?.reservation?.id === reservation2.data?.reservation?.id && reservation2.data?.idempotentReplay === true, 'Falló idempotencia de reservas.');
  const reservationHistory = await api(client, '/client/reservations');
  assert(reservationHistory.data?.reservations?.some((r) => r.id === reservation1.data.reservation.id), 'Reserva ausente del historial.');

  const orderKey = `ci_ord_${unique}`;
  const orderBody = { branchId: branch.id, cycleType: 'FULL', pickupType: 'STORE', pieces: 12, stainService: true, notes: 'Smoke servicio asistido' };
  const order1 = await api(client, '/orders', { method: 'POST', expected: [201], headers: { 'Idempotency-Key': orderKey }, body: orderBody });
  const order2 = await api(client, '/orders', { method: 'POST', headers: { 'Idempotency-Key': orderKey }, body: orderBody });
  assert(order1.data?.order?.id === order2.data?.order?.id && order2.data?.idempotentReplay === true, 'Falló idempotencia de órdenes.');

  const admin = new CookieJar();
  const firstAdminLogin = await api(admin, '/auth/admin/login', { method: 'POST', expected: [428], body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  assert(firstAdminLogin.data?.setupRequired && admin.get('admin_preauth'), 'Bootstrap admin no inició configuración segura.');
  const status = await api(admin, '/auth/admin/security/status');
  assert(status.data?.mustChangePassword === true, 'Bootstrap admin no exige cambio de contraseña.');

  await api(admin, '/auth/admin/security/password', { method: 'POST', body: { password: randomPassword() } });
  const mfa = await api(admin, '/auth/admin/security/mfa');
  assert(mfa.data?.secret, 'No se generó secreto MFA.');
  const mfaConfirmed = await api(admin, '/auth/admin/security/mfa', { method: 'POST', body: { otp: totp(mfa.data.secret) } });
  assert(mfaConfirmed.data?.configured && mfaConfirmed.data?.recoveryCodes?.length === 8 && admin.get('csrf_token'), 'MFA admin incompleto.');

  await api(admin, '/admin/clients');
  await api(admin, '/admin/reservations');
  const adminOrders = await api(admin, '/admin/orders');
  assert(adminOrders.data?.orders?.some((o) => o.id === order1.data.order.id), 'Admin no ve orden creada.');

  await api(admin, `/admin/orders/${order1.data.order.id}/status`, { method: 'PATCH', expected: [403], headers: { 'X-CSRF-Token': 'invalid-csrf-smoke' }, body: { status: 'PRE_WASH' } });
  await api(admin, `/admin/orders/${order1.data.order.id}/status`, { method: 'PATCH', expected: [409], body: { status: 'PRE_WASH' } });

  const persistedOrder = await prisma.laundryOrder.findUnique({
    where: { id: order1.data.order.id },
    select: { amountCents: true },
  });
  assert(persistedOrder, 'No se encontró la orden creada para probar el pago.');

  const approvedPayment = await prisma.payment.create({
    data: {
      provider: 'WOMPI',
      externalReference: `CI-APPROVED-${unique}`,
      status: PaymentStatus.APPROVED,
      amountCents: persistedOrder.amountCents,
      currency: 'COP',
      environment: 'sandbox',
      resourceType: 'order',
      resourceId: order1.data.order.id,
      processedAt: new Date(),
    },
  });
  await prisma.laundryOrder.update({
    where: { id: order1.data.order.id },
    data: { paymentId: approvedPayment.id },
  });

  const advanced = await api(admin, `/admin/orders/${order1.data.order.id}/status`, { method: 'PATCH', body: { status: 'PRE_WASH' } });
  assert(advanced.data?.order?.status === 'PRE_WASH', 'Admin no pudo avanzar orden pagada.');
  await api(admin, `/admin/orders/${order1.data.order.id}/messages`, { method: 'POST', expected: [201], body: { message: 'Mensaje smoke visible al cliente.', isInternal: false } });

  const clientOrders = await api(client, '/client/orders');
  const refreshed = clientOrders.data?.orders?.find((o) => o.id === order1.data.order.id);
  assert(refreshed?.status === 'PRE_WASH', 'Cliente no ve estado actualizado.');
  assert(refreshed?.messages?.some((m) => m.message.includes('Mensaje smoke')), 'Cliente no ve mensaje admin.');

  console.log(JSON.stringify({ ok: true, checks: ['health', 'auth', 'migrations-seed', 'reservation-idempotency', 'order-idempotency', 'admin-mfa', 'csrf', 'payment-gate', 'admin-workflow'] }));
}

main()
  .catch((error) => {
    console.error('Integration smoke FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
