import {
  BarChart3, Bell, Boxes, Building2, ClipboardList, DoorOpen, FileText, LayoutDashboard, Leaf, Receipt, ShoppingCart,
  Sprout, Tractor, UserCog, Users, Wallet, Wheat,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/types'

export interface NavItem { to: string; label: string; icon: LucideIcon; roles?: Role[] }
export interface NavGroup { label: string; items: NavItem[] }

const M: Role[] = ['super_admin', 'farm_owner', 'farm_manager']
const S: Role[] = ['super_admin', 'farm_owner', 'sales_manager', 'farm_manager']

export const NAV: NavGroup[] = [
  { label: 'Overview', items: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/organizations', label: 'Organizations', icon: Building2, roles: ['super_admin'] },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
  ] },
  { label: 'Farm', items: [
    { to: '/app/farms', label: 'Farms', icon: Tractor },
    { to: '/app/rooms', label: 'Cultivation Rooms', icon: DoorOpen },
    { to: '/app/varieties', label: 'Varieties', icon: Leaf },
  ] },
  { label: 'Production', items: [
    { to: '/app/production', label: 'Production Batches', icon: Sprout },
    { to: '/app/harvests', label: 'Harvests', icon: Wheat },
    { to: '/app/inventory', label: 'Inventory', icon: Boxes },
  ] },
  { label: 'Business', items: [
    { to: '/app/sales', label: 'Sales Orders', icon: ShoppingCart, roles: S },
    { to: '/app/customers', label: 'Customers', icon: Users, roles: S },
    { to: '/app/expenses', label: 'Expenses', icon: Wallet, roles: M },
    { to: '/app/reports', label: 'Reports', icon: BarChart3, roles: [...M, 'sales_manager'] },
  ] },
  { label: 'Team', items: [
    { to: '/app/employees', label: 'Staff', icon: ClipboardList, roles: M },
    { to: '/app/tasks', label: 'Tasks', icon: FileText },
    { to: '/app/users', label: 'Users & Access', icon: UserCog, roles: ['super_admin', 'farm_owner'] },
  ] },
]

export const ICONS = { Receipt }
