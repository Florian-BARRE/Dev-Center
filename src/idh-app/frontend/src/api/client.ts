export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      errorDetail = await res.text();
    } catch (_e) {
      // Fall back to statusText if body can't be read
    }
    throw new ApiError(res.status, errorDetail);
  }
  return res.json() as Promise<T>;
}
