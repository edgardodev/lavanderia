import { createHash, timingSafeEqual } from 'crypto';

export type WompiEnvironment = 'sandbox' | 'production';

type WompiConfig = {
  environment: WompiEnvironment;
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
  currency: 'COP';
  apiBaseUrl: string;
  redirectUrl: string;
  checkoutTtlMinutes: number;
};

function required(name: string) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} no está configurado.`);
  return value;
}

function assertPrefix(value: string, prefix: string, name: string) {
  if (!value.startsWith(prefix)) {
    throw new Error(`${name} no corresponde al ambiente de Wompi configurado.`);
  }
}

export function getWompiConfig(): WompiConfig {
  const environment = (process.env.WOMPI_ENVIRONMENT ?? 'sandbox') as WompiEnvironment;
  if (!['sandbox', 'production'].includes(environment)) {
    throw new Error('WOMPI_ENVIRONMENT debe ser sandbox o production.');
  }

  const publicKey = required('WOMPI_PUBLIC_KEY');
  const privateKey = required('WOMPI_PRIVATE_KEY');
  const integritySecret = required('WOMPI_INTEGRITY_SECRET');
  const eventsSecret = required('WOMPI_EVENTS_SECRET');
  const currency = 'COP' as const;
  const redirectUrl = required('WOMPI_REDIRECT_URL');
  const checkoutTtlMinutes = Math.min(60, Math.max(5, Number(process.env.WOMPI_CHECKOUT_TTL_MINUTES ?? 15)));

  const production = environment === 'production';
  assertPrefix(publicKey, production ? 'pub_prod_' : 'pub_test_', 'WOMPI_PUBLIC_KEY');
  assertPrefix(privateKey, production ? 'prv_prod_' : 'prv_test_', 'WOMPI_PRIVATE_KEY');
  assertPrefix(integritySecret, production ? 'prod_integrity_' : 'test_integrity_', 'WOMPI_INTEGRITY_SECRET');
  assertPrefix(eventsSecret, production ? 'prod_events_' : 'test_events_', 'WOMPI_EVENTS_SECRET');

  return {
    environment,
    publicKey,
    privateKey,
    integritySecret,
    eventsSecret,
    currency,
    redirectUrl,
    checkoutTtlMinutes,
    apiBaseUrl: production ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1',
  };
}

export function wompiConfigured() {
  try {
    getWompiConfig();
    return true;
  } catch {
    return false;
  }
}

export function createWompiIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  expirationTime?: string,
) {
  const config = getWompiConfig();
  const source = `${reference}${amountInCents}${currency}${expirationTime ?? ''}${config.integritySecret}`;
  return createHash('sha256').update(source).digest('hex');
}

function nestedValue(input: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, input);
}

function safeEqualHex(a: string, b: string) {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedA) || !/^[a-f0-9]{64}$/.test(normalizedB)) return false;
  const left = Buffer.from(normalizedA, 'hex');
  const right = Buffer.from(normalizedB, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyWompiEvent(body: any, headerChecksum?: string) {
  const config = getWompiConfig();
  if (!body || typeof body !== 'object') return false;

  const expectedEnvironment = config.environment === 'production' ? 'prod' : 'test';
  if (body.environment !== expectedEnvironment) return false;

  const properties = body.signature?.properties;
  const checksum = String(headerChecksum || body.signature?.checksum || '');
  const timestamp = body.timestamp;
  if (!Array.isArray(properties) || properties.length === 0 || !Number.isInteger(timestamp) || !checksum) return false;

  const propertyString = properties.map((property: unknown) => {
    if (typeof property !== 'string') throw new Error('Propiedad de firma de Wompi inválida.');
    const value = nestedValue(body.data, property);
    if (value === undefined || value === null) throw new Error('Evento Wompi incompleto.');
    return String(value);
  }).join('');

  const calculated = createHash('sha256')
    .update(`${propertyString}${timestamp}${config.eventsSecret}`)
    .digest('hex');

  return safeEqualHex(calculated, checksum);
}

export async function fetchWompiTransaction(transactionId: string) {
  const config = getWompiConfig();
  const response = await fetch(`${config.apiBaseUrl}/transactions/${encodeURIComponent(transactionId)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.privateKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Wompi respondió ${response.status} al consultar la transacción.`);
  }

  const payload = await response.json() as { data?: Record<string, unknown> };
  if (!payload.data) throw new Error('Wompi no devolvió la transacción esperada.');
  return payload.data;
}
