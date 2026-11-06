import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, FlaskConical, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { ROLE_LABELS, type Role } from '@/types'

interface DemoAccount { name: string; email: string; role: Role; farms: string[]; organization?: string }
interface DemoInfo { enabled: boolean; password?: string; accounts: DemoAccount[] }

const ROLE_HINT: Partial<Record<Role, string>> = {
  farm_owner: 'Runs the organization: farms, finance, staff and users',
  farm_manager: 'Daily operations, stage changes, harvest approvals',
  farm_worker: 'Record observations and submit harvests',
  sales_manager: 'Customers, orders, payments and invoices',
}

/** Floating "Demo accounts" button + drawer. Renders nothing when the API has demo mode off. */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  const [open, setOpen] = useState(false)
  const q = useQuery({
    queryKey: ['demo-accounts'],
    queryFn: async () => (await api.get('/public/demo-accounts')).data.data as DemoInfo,
    staleTime: Infinity,
  })
  if (q.data && !q.data.enabled) return null

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
        <Button onClick={() => setOpen(true)} className="h-11 rounded-full bg-cta px-5 text-white shadow-lg shadow-cta/25 hover:bg-cta-hover">
          <FlaskConical /> Demo accounts
        </Button>
      </motion.div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Try a demo account</SheetTitle>
            <SheetDescription>Pick a role to fill in the sign-in form. Each organization is a separate tenant, so users only see their own organization’s data.</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 overflow-y-auto px-4">
            {q.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            {q.data && Object.entries(q.data.accounts.reduce<Record<string, DemoAccount[]>>((g, a) => { (g[a.organization ?? 'Other'] ??= []).push(a); return g }, {})).map(([org, accts]) => (
              <div key={org} className="space-y-2 pb-2">
                <p className="eyebrow pt-1 text-[10px] text-muted-foreground">{org}</p>
                {accts.map((a) => (
              <button key={a.email} onClick={() => { onPick(a.email, q.data!.password ?? ''); setOpen(false) }}
                className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent/40">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {a.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="text-sm font-semibold">{ROLE_LABELS[a.role]}</span></span>
                  <span className="block truncate text-xs text-muted-foreground">{a.name} · {a.email}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{ROLE_HINT[a.role] ?? a.farms.join(', ')}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
                ))}
              </div>
            ))}
            {q.isError && <p className="text-sm text-destructive">Couldn't load demo accounts. Is the API running?</p>}
          </div>
          {q.data?.password && (
            <p className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <KeyRound className="size-3.5" /> All demo accounts use the password <code className="font-mono text-foreground">{q.data.password}</code>
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
