import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role, User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  farmId: string // 'all' or a farm id
  setSession: (user: User, access: string, refresh: string) => void
  setTokens: (access: string, refresh: string) => void
  setUser: (user: User) => void
  setFarm: (id: string) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      farmId: 'all',
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken, farmId: 'all' }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      setFarm: (farmId) => set({ farmId }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, farmId: 'all' }),
    }),
    { name: 'mf-auth' },
  ),
)

export const can = (role: Role | undefined, ...roles: Role[]) => !!role && roles.includes(role)
export const ADMINS: Role[] = ['super_admin', 'farm_owner']
export const MANAGERS: Role[] = ['super_admin', 'farm_owner', 'farm_manager']
export const SALES: Role[] = ['super_admin', 'farm_owner', 'sales_manager']
export const useRole = () => useAuth((s) => s.user?.role)
