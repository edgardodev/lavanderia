const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  return parts.length === 2 ? parts.pop()?.split(';').shift() ?? '' : '';
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;
  if (!isFormData) headers.set('Content-Type', 'application/json');
  const csrf = getCookie('csrf_token');
  if (csrf) headers.set('X-CSRF-Token', csrf);

  const controller = new AbortController();
  const timeoutMs = isFormData ? 45_000 : 20_000;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado y fue cancelada. Intenta nuevamente.');
    }
    throw new Error(`No se pudo conectar con el servidor (${API_URL}). Verifica tu conexión e intenta nuevamente.`);
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error inesperado' }));
    throw new ApiError(error.message ?? 'Error inesperado', response.status, error);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
