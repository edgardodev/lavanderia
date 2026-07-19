export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // El guardado local es una mejora de resiliencia; si el navegador lo bloquea, la app debe seguir funcionando.
  }
}

export function clearLocal(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // noop
  }
}

export function appendLocal<T extends { id?: string; createdAt?: string }>(key: string, record: T): T {
  const current = readLocal<T[]>(key, []);
  const enriched = {
    ...record,
    id: record.id ?? `${key}-${Date.now()}`,
    createdAt: record.createdAt ?? new Date().toISOString(),
  } as T;
  writeLocal(key, [enriched, ...current].slice(0, 100));
  return enriched;
}
