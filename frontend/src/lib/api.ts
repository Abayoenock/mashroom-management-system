import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuth } from '@/stores/auth'
import type { ApiResponse } from '@/types'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api/v1' })

api.interceptors.request.use((config) => {
  const { accessToken, farmId } = useAuth.getState()
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  if (farmId && farmId !== 'all') config.headers['X-Farm-Id'] = farmId
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccess(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuth.getState()
  if (!refreshToken) return null
  try {
    const { data } = await axios.post<ApiResponse<{ access_token: string; refresh_token: string }>>(
      `${api.defaults.baseURL}/auth/refresh`, {}, { headers: { Authorization: `Bearer ${refreshToken}` } })
    setTokens(data.data.access_token, data.data.refresh_token)
    return data.data.access_token
  } catch {
    logout()
    return null
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true
      refreshing ??= refreshAccess().finally(() => { refreshing = null })
      const token = await refreshing
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)

export function errorMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string }>
  return err?.response?.data?.message ?? err?.message ?? 'Something went wrong'
}

export function fieldErrors(e: unknown): Record<string, string> {
  return (e as AxiosError<{ errors?: Record<string, string> }>)?.response?.data?.errors ?? {}
}
