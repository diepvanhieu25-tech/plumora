let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  return headers
}

export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  fallbackError: string = 'Lỗi kết nối máy chủ',
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(),
      ...(options.headers ?? {}),
    },
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) {
    const errCode = data.detail?.error_code ? `${data.detail.error_code}: ` : ''
    throw new Error(`${errCode}${data.detail?.message || data.message || fallbackError}`)
  }
  return data as T
}
