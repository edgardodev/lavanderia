const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiBlob(path: string): Promise<Blob> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('La foto tardó demasiado en cargar.');
    }
    throw new Error('No se pudo cargar la foto.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'No se pudo cargar la foto.' }));
    throw new Error(error.message ?? 'No se pudo cargar la foto.');
  }

  return response.blob();
}

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
  const method = String(options.method ?? 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const csrf = getCookie('csrf_token');
  if (isMutation && csrf) headers.set('X-CSRF-Token', csrf);

  const controller = new AbortController();
  const timeoutMs = isFormData ? 45_000 : 20_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });

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
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error inesperado' }));

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;

      if (response.status === 401) {
        if (pathname.startsWith('/admin/')) {
          window.location.assign(`/login?role=admin&next=${encodeURIComponent(pathname)}&expired=1`);
        } else if (pathname.startsWith('/client/')) {
          window.location.assign(`/login?next=${encodeURIComponent(pathname)}&expired=1`);
        }
      }

      if (response.status === 403 && error?.message === 'No tienes permisos para esta acción.') {
        if (pathname.startsWith('/admin/')) {
          window.location.assign(`/login?role=admin&next=${encodeURIComponent(pathname)}&wrongRole=1`);
        } else if (pathname.startsWith('/client/')) {
          window.location.assign(`/login?next=${encodeURIComponent(pathname)}&wrongRole=1`);
        }
      }
    }

    throw new ApiError(error.message ?? 'Error inesperado', response.status, error);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
