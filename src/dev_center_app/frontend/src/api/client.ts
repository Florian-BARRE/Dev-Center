// ====== Code Summary ======
// Base HTTP client and WebSocket URL helper for all API calls.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typed fetch wrapper. Throws ApiError on non-2xx responses.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // 1. Execute request with JSON default headers.
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  // 2. Convert non-2xx responses into ApiError.
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = await res.text(); } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, detail);
  }

  // 3. Handle empty success responses (for example 204 No Content).
  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }

  // 4. If backend sent no body, return undefined instead of throwing JSON parse errors.
  const rawBody = await res.text();
  if (!rawBody) {
    return undefined as T;
  }

  // 5. Parse JSON payload for standard API responses.
  return JSON.parse(rawBody) as T;
}

/**
 * Build a WebSocket URL from a relative API path.
 * Converts http(s) to ws(s) and prefixes with window.location.origin.
 */
export function wsUrl(path: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}
