export type Role = 'super_admin' | 'farm_owner' | 'farm_manager' | 'farm_worker' | 'sales_manager'

export interface FarmRef { id: string; name: string; code: string; org_id?: string; org_name?: string }
export interface OrgRef { id: string; name: string; status: 'active' | 'suspended' }

export interface User {
  id: string
  name: string
  email: string
  role: Role
  phone?: string
  email_verified?: boolean
  organization?: OrgRef | null
  farms: FarmRef[]
}

export interface Meta { page: number; limit: number; total: number; pages: number; unread?: number }

export interface ApiResponse<T> { success: boolean; data: T; meta?: Meta; message?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any> & { id: string }

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  farm_owner: 'Farm Owner',
  farm_manager: 'Farm Manager',
  farm_worker: 'Farm Worker',
  sales_manager: 'Sales Manager',
}

export const STAGES = [
  'substrate_preparation', 'sterilization', 'spawning', 'incubation',
  'pinning', 'fruiting', 'harvesting', 'completed',
] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABELS: Record<Stage, string> = {
  substrate_preparation: 'Substrate Prep',
  sterilization: 'Sterilization',
  spawning: 'Spawning',
  incubation: 'Incubation',
  pinning: 'Pinning',
  fruiting: 'Fruiting',
  harvesting: 'Harvesting',
  completed: 'Completed',
}
