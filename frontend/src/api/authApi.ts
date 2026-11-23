import type { LearnerUser, PortalKind } from '../types'
import { buildHeaders, requestJson, setAuthToken } from './httpClient'

export async function apiLogin(
  username: string,
  password: string,
  portal: PortalKind = 'learner',
): Promise<{ user: LearnerUser; access_token: string }> {
  const data = await requestJson<{ user: LearnerUser; access_token: string }>(
    '/api/v1/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password, portal }),
    },
    'Đăng nhập thất bại. Vui lòng kiểm tra lại tên đăng nhập và mật khẩu.',
  )
  if (data.access_token) {
    setAuthToken(data.access_token)
  }
  return data
}

export async function apiRegister(
  username: string,
  displayName: string,
  password: string,
): Promise<{ user: LearnerUser; access_token: string }> {
  const data = await requestJson<{ user: LearnerUser; access_token: string }>(
    '/api/v1/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ username, display_name: displayName, password }),
    },
    'Đăng ký thất bại. Vui lòng thử tên đăng nhập khác.',
  )
  if (data.access_token) {
    setAuthToken(data.access_token)
  }
  return data
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: buildHeaders(),
      credentials: 'include',
    })
  } finally {
    setAuthToken(null)
  }
}

export async function apiGetMe(): Promise<LearnerUser | null> {
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: buildHeaders(),
      credentials: 'include',
    })
    if (!res.ok) return null
    return (await res.json()) as LearnerUser
  } catch {
    return null
  }
}
