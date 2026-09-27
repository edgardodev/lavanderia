export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

export function safeId(value: unknown, label = 'Identificador', maxLength = 191) {
  const clean = String(value ?? '').trim();
  if (!clean || clean.length > maxLength || !/^[A-Za-z0-9._:-]+$/.test(clean)) {
    throw new RequestValidationError(`${label} inválido.`);
  }
  return clean;
}

export function optionalFilterId(value: unknown, label = 'Filtro') {
  const clean = String(value ?? 'all').trim();
  if (clean === 'all') return clean;
  return safeId(clean, label);
}

export function isoDate(value: unknown) {
  const clean = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new RequestValidationError('Fecha inválida.');
  const parsed = new Date(`${clean}T12:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) throw new RequestValidationError('Fecha inválida.');
  const [year, month, day] = clean.split('-').map(Number);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    throw new RequestValidationError('Fecha inválida.');
  }
  return clean;
}

export function timeSlot(value: unknown) {
  const clean = String(value ?? '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(clean)) {
    throw new RequestValidationError('Franja horaria inválida.');
  }
  return clean;
}

export function boundedQueryText(value: unknown, maxLength = 120) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function boundedLimit(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(max, parsed);
}
