import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function KpiCard({ label, value, hint, icon: Icon, loading, tone = 'forest', index = 0 }: {
  label: string; value: string; hint?: string; icon: LucideIcon; loading?: boolean; tone?: 'forest' | 'fresh' | 'beige' | 'cta'; index?: number
}) {
  const tones = {
    forest: 'bg-primary/10 text-primary',
    fresh: 'bg-fresh/15 text-fresh',
    beige: 'bg-beige/60 text-[#7A6440] dark:bg-beige/10 dark:text-beige',
    cta: 'bg-cta/10 text-cta',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn('grid size-8 place-items-center rounded-lg', tones[tone])}><Icon className="size-4" /></span>
      </div>
      {loading ? <Skeleton className="mt-2 h-7 w-24" /> : <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>}
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </motion.div>
  )
}
