import { cn } from '@/lib/utils'
import { titleCase } from '@/lib/format'

const TONES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300',
  gray: 'bg-muted text-muted-foreground ring-border',
  beige: 'bg-[#F4EDE0] text-[#6E5B3B] ring-[#C9B48F]/40 dark:bg-[#2A2620] dark:text-beige',
  forest: 'bg-accent text-accent-foreground ring-primary/15',
}

const MAP: Record<string, keyof typeof TONES> = {
  active: 'green', approved: 'green', paid: 'green', delivered: 'green', done: 'green', completed: 'gray', ok: 'green',
  confirmed: 'forest', excellent: 'green', good: 'green',
  pending: 'amber', partial: 'amber', in_progress: 'blue', dispatched: 'blue', todo: 'gray', medium: 'amber',
  fair: 'amber', on_leave: 'amber', maintenance: 'amber', cleaning: 'blue', idle: 'gray', low: 'red',
  rejected: 'red', unpaid: 'red', cancelled: 'red', returned: 'red', inactive: 'gray', terminated: 'red', poor: 'red',
  high: 'red', expired: 'red',
  substrate_preparation: 'beige', sterilization: 'beige', spawning: 'blue', incubation: 'blue',
  pinning: 'forest', fruiting: 'forest', harvesting: 'green',
}

export function StatusBadge({ value, tone, className, label }: { value?: string; tone?: keyof typeof TONES; className?: string; label?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const t = tone ?? MAP[value] ?? 'gray'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', TONES[t], className)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label ?? titleCase(value)}
    </span>
  )
}
