let authToken: string | null = null

export interface ApiErrorDetail<T = Record<string, unknown>> {
  error_code?: string
  message?: string
  cycle_path?: string[]
  missing_prerequisites?: string[]
  test_results?: Array<Record<string, unknown>>
  details?: T
  [key: string]: unknown
}

export class ApiDomainError<T = Record<string, unknown>> extends Error {
  readonly status: number
  readonly errorCode: string
  readonly detail: ApiErrorDetail<T>

  constructor(
    status: number,
    errorCode: string,
    message: string,
    detail: ApiErrorDetail<T> = {},
  ) {
    super(message)
    this.name = 'ApiDomainError'
    this.status = status
    this.errorCode = errorCode
    this.detail = detail
  }
}

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

  let rawData: unknown = null
  const contentType = res.headers.get('content-type') || ''
  try {
    if (res.status !== 204) {
      if (contentType.includes('application/json')) {
        rawData = await res.json()
      } else {
        const text = await res.text()
        if (text) {
          try {
            rawData = JSON.parse(text)
          } catch {
            rawData = { message: text }
          }
        }
      }
    }
  } catch {
    rawData = null
  }

  if (!res.ok) {
    const obj = (rawData && typeof rawData === 'object' ? rawData : {}) as Record<string, unknown>
    const rawDetail = obj.detail
    const detailObj: ApiErrorDetail =
      rawDetail && typeof rawDetail === 'object' && !Array.isArray(rawDetail)
        ? (rawDetail as ApiErrorDetail)
        : typeof rawDetail === 'string'
          ? { message: rawDetail }
          : {}

    const errorCode =
      (typeof detailObj.error_code === 'string' && detailObj.error_code) ||
      (typeof obj.error_code === 'string' && obj.error_code) ||
      `HTTP_${res.status}`

    const baseMessage =
      (typeof detailObj.message === 'string' && detailObj.message) ||
      (typeof obj.message === 'string' && obj.message) ||
      (res.status === 502 || res.status === 503 || res.status === 504
        ? 'Hệ thống đang bận hoặc tạm thời gián đoạn. Vui lòng thử lại sau giây lát.'
        : fallbackError)

    throw new ApiDomainError(res.status, errorCode, baseMessage, {
      ...detailObj,
      error_code: errorCode,
      message: baseMessage,
    })
  }

  return rawData as T
}
