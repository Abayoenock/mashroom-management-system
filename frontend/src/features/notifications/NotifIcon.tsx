import { AlertTriangle, Bell, Bug, ClipboardCheck, CreditCard, Package, ShoppingCart, Sprout, Thermometer, Wheat } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAP = {
  contamination: [Bug, 'bg-red-500/10 text-red-600'],
  environment: [Thermometer, 'bg-amber-500/10 text-amber-600'],
  approval: [ClipboardCheck, 'bg-cta/10 text-cta'],
  harvest: [Wheat, 'bg-fresh/15 text-primary'],
  production: [Sprout, 'bg-primary/10 text-primary'],
  inventory: [Package, 'bg-amber-500/10 text-amber-600'],
  sale: [ShoppingCart, 'bg-sky-500/10 text-sky-600'],
  payment: [CreditCard, 'bg-emerald-500/10 text-emerald-600'],
  task: [AlertTriangle, 'bg-violet-500/10 text-violet-600'],
} as const

export function NotifIcon({ type }: { type: string }) {
  const [Icon, cls] = (MAP as Record<string, readonly [typeof Bell, string]>)[type] ?? [Bell, 'bg-muted text-muted-foreground']
  return <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', cls)}><Icon className="size-4" /></span>
}
