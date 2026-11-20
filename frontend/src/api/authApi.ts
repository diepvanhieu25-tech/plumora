import type { LearnerUser, PortalKind } from '../types'
import { buildHeaders, setAuthToken } from './httpClient'

export async function apiLogin(
  username: string,
  password: string,
  portal: PortalKind = 'learner',
): Promise<{ user: LearnerUser; access_token: string }> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: JSON.stringify({ username, password, portal }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Đăng nhập thất bại')
  }
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
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: JSON.stringify({ username, display_name: displayName, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Đăng ký thất bại')
  }
  if (data.access_token) {
    setAuthToken(data.access_token)
  }
  return data
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
  })
  setAuthToken(null)
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
