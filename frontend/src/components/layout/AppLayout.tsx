import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { ChevronsLeft, ChevronsRight, LogOut, Menu, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Logo, LogoMark } from '@/components/shared/Logo'
import { NotificationBell } from './NotificationBell'
import { NAV, type NavItem } from './nav'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

function SidebarLink({ item: i, collapsed, onNavigate }: { item: NavItem; collapsed?: boolean; onNavigate?: () => void }) {
  // Resolve the active state here and pass a plain string className: Radix's Slot (used by TooltipTrigger asChild)
  // merges className as a string, which breaks NavLink's function-style className.
  const isActive = !!useMatch({ path: i.to, end: i.to === '/app' })
  const link = (
    <NavLink to={i.to} end={i.to === '/app'} onClick={onNavigate} aria-label={collapsed ? i.label : undefined}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        collapsed && 'justify-center px-0',
      )}>
      <i.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{i.label}</span>}
    </NavLink>
  )
  return collapsed ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{i.label}</TooltipContent></Tooltip> : link
}

function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const role = useAuth((s) => s.user?.role)
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => !i.roles || (role && i.roles.includes(role)))
        if (!items.length) return null
        return (
          <div key={g.label}>
            {!collapsed && <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{g.label}</p>}
            <div className="space-y-0.5">
              {items.map((i) => <SidebarLink key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />)}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

export function AppLayout() {
  const { user, farmId, setFarm, logout, accessToken } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const navigate = useNavigate()
  const loc = useLocation()
  const qc = useQueryClient()

  if (!user || !accessToken) return <Navigate to="/login" state={{ from: loc.pathname }} replace />

  const signOut = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    logout(); qc.clear(); navigate('/login')
  }
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')

  return (
    <div className="flex min-h-svh bg-background">
      <aside className={cn('sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex print:hidden', collapsed ? 'w-[68px]' : 'w-64')}>
        <div className={cn('flex h-16 items-center border-b px-4', collapsed && 'justify-center px-0')}>
          <Link to="/app">{collapsed ? <LogoMark /> : <Logo />}</Link>
        </div>
        <SidebarNav collapsed={collapsed} />
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground hover:text-foreground">
          {collapsed ? <ChevronsRight className="mx-auto size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
      </aside>

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
          <SheetTitle className="flex h-16 items-center border-b px-4"><Logo /></SheetTitle>
          <SidebarNav onNavigate={() => setMobile(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex print:hidden h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu /></Button>
          <Select value={farmId} onValueChange={(v) => { setFarm(v); qc.invalidateQueries() }}>
            <SelectTrigger className="h-9 w-44 sm:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{user.role === 'super_admin' ? 'All organizations' : 'All farms'}</SelectItem>
              {user.farms.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}{user.role === 'super_admin' && f.org_name ? <span className="text-muted-foreground"> · {f.org_name}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex items-center gap-2 rounded-lg p-1 hover:bg-muted">
                  <Avatar className="size-8"><AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback></Avatar>
                  <span className="hidden text-left md:block">
                    <span className="block text-sm leading-tight font-medium">{user.name}</span>
                    <span className="block text-xs leading-tight text-muted-foreground">{ROLE_LABELS[user.role]}{user.organization ? ` · ${user.organization.name}` : ' · Platform'}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal"><p className="text-sm font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p><p className="mt-1 text-xs text-muted-foreground">{user.organization?.name ?? 'Platform administration'}</p></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/app/profile')}><UserIcon /> Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}><LogOut /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 print:max-w-none print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const role = useAuth((s) => s.user?.role)
  if (role && !roles.includes(role)) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <p className="text-lg font-semibold">Access restricted</p>
        <p className="mt-1 text-sm text-muted-foreground">Your role doesn't have access to this section.</p>
      </div>
    )
  }
  return <>{children}</>
}
