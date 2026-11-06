import { Link } from 'react-router'
import {
  AlertTriangle, Boxes, CalendarClock, CircleDollarSign, Clock, Layers, PackageOpen, Repeat, Scale, ShoppingBag,
  Sprout, Wheat,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { KpiCard } from '@/components/shared/KpiCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Bars, ChartCard, Donut, TrendArea } from '@/components/charts/Charts'
import { useGet } from '@/hooks/useApi'
import { daysUntil, fmtCompact, fmtDate, fmtKg, fmtMoney, fmtMonth, fmtNum, timeAgo, titleCase } from '@/lib/format'
import { useAuth } from '@/stores/auth'
import { STAGE_LABELS, type Row, type Stage } from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Overview = Record<string, any>

const FLAG_LABEL: Record<string, string> = {
  incubation_overdue: 'Incubation overdue', contamination: 'Contamination', environment: 'Env. out of range', harvest_soon: 'Harvest soon',
}

function ListCard({ title, icon: Icon, children, empty, to }: { title: string; icon: typeof Clock; children: React.ReactNode; empty?: boolean; to?: string }) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{title}</CardTitle>
        {to && <Link to={to} className="text-xs font-medium text-primary hover:underline">View all</Link>}
      </CardHeader>
      <CardContent className="space-y-1">
        {empty ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing to show right now.</p> : children}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const user = useAuth((s) => s.user)
  const { data: d, isLoading } = useGet<Overview>('/dashboard/overview')
  const k = d?.kpis ?? {}
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const kpis = [
    { label: 'Active production batches', value: fmtNum(k.active_batches, 0), icon: Sprout, tone: 'forest' as const },
    { label: 'Growing bags', value: fmtNum(k.growing_bags, 0), icon: Layers, tone: 'fresh' as const },
    { label: 'Current production cycles', value: fmtNum(k.production_cycles, 0), icon: Repeat, tone: 'beige' as const, hint: 'Incubating → harvesting' },
    { label: 'Expected harvest', value: fmtKg(k.expected_harvest_kg), icon: Scale, tone: 'forest' as const, hint: 'Active batches' },
    { label: 'Actual harvest', value: fmtKg(k.actual_harvest_kg), icon: Wheat, tone: 'fresh' as const, hint: k.expected_harvest_kg ? `${fmtNum(100 * k.actual_harvest_kg / k.expected_harvest_kg)}% of expected so far` : undefined },
    { label: 'Mushroom stock', value: fmtKg(k.stock_kg), icon: Boxes, tone: 'beige' as const, hint: 'Fresh, unexpired' },
    { label: 'Sales revenue', value: `RWF ${fmtCompact(k.revenue)}`, icon: CircleDollarSign, tone: 'cta' as const, hint: `Last 12 months · ${fmtMoney(k.outstanding)} outstanding` },
    { label: 'Pending orders', value: fmtNum(k.pending_orders, 0), icon: ShoppingBag, tone: 'cta' as const, hint: k.pending_harvests ? `${k.pending_harvests} harvest(s) awaiting approval` : 'Not yet delivered' },
  ]

  const s = d?.summary ?? {}
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Dashboard" title={`${greet}, ${user?.name.split(' ')[0]}`} description="Here's what's happening across your farms today." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((c, i) => <KpiCard key={c.label} {...c} loading={isLoading} index={i} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Production overview" description="Approved harvest weight per month (kg)" loading={isLoading}>
          <TrendArea data={d?.production ?? []} x="month" xFmt={fmtMonth} fmt={(v) => fmtKg(v)}
            series={[{ key: 'harvested', name: 'Harvested' }, { key: 'rejected', name: 'Rejected', color: 'var(--chart-2)' }]} />
        </ChartCard>
        <ChartCard title="Production distribution" description="Batches by growth stage" loading={isLoading}>
          <Bars layout="vertical" data={(d?.stage_distribution ?? []).map((r: Row) => ({ ...r, label: STAGE_LABELS[r.stage as Stage] }))} x="label"
            series={[{ key: 'count', name: 'Batches' }]} height={260} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Harvest performance" description="Expected vs actual yield by variety (kg), batches with harvests" loading={isLoading}>
          <Bars data={d?.harvest_performance ?? []} x="name" fmt={fmtKg}
            series={[{ key: 'expected', name: 'Expected', color: 'var(--chart-muted)' }, { key: 'actual', name: 'Actual' }]} />
        </ChartCard>
        <ChartCard title="Sales analytics" description="Revenue per month (RWF)" loading={isLoading}>
          <TrendArea data={d?.sales_trend ?? []} x="month" xFmt={fmtMonth} fmt={fmtMoney} series={[{ key: 'revenue', name: 'Revenue', color: 'var(--chart-3)' }]} />
        </ChartCard>
        <ChartCard title="Mushroom variety distribution" description="Growing bags in active batches" loading={isLoading}>
          <Donut data={d?.variety_distribution ?? []} nameKey="name" valueKey="bags" fmt={(v) => `${fmtNum(v, 0)}`} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Monthly farm performance" description="Revenue, expenses and profit (RWF)" loading={isLoading}>
          <Bars data={d?.monthly_performance ?? []} x="month" xFmt={fmtMonth} fmt={fmtMoney}
            series={[{ key: 'revenue', name: 'Revenue' }, { key: 'expenses', name: 'Expenses', color: 'var(--chart-2)' }, { key: 'profit', name: 'Profit', color: 'var(--chart-3)' }]} />
        </ChartCard>
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Farm performance summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <Skeleton className="h-48" /> : (
              <>
                {[
                  ['Total harvested', fmtKg(s.total_harvested_kg)],
                  ['Average yield per bag', `${fmtNum(s.avg_yield_per_bag, 2)} kg`],
                  ['Total expenses', fmtMoney(s.total_expenses)],
                  ['Cost per kg produced', fmtMoney(s.cost_per_kg)],
                ].map(([l, v]) => (
                  <div key={l} className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{l}</span><span className="font-medium tabular-nums">{v}</span></div>
                ))}
                <div>
                  <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted-foreground">Production success rate</span><span className="font-medium">{fmtNum(s.success_rate)}%</span></div>
                  <Progress value={s.success_rate ?? 0} />
                  <p className="mt-1.5 text-xs text-muted-foreground">Sellable weight as a share of everything harvested (incl. rejects).</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ListCard title="Upcoming harvests" icon={CalendarClock} empty={!d?.upcoming_harvests?.length} to="/app/production">
          {d?.upcoming_harvests?.map((b: Row) => {
            const days = daysUntil(b.expected_first_harvest)
            return (
              <Link key={b.id} to={`/app/production/${b.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/60">
                <div><p className="text-sm font-medium">{b.code}</p><p className="text-xs text-muted-foreground">{b.variety_name} · {b.room_name} · ~{fmtKg(b.expected_yield_kg)}</p></div>
                <span className={`text-xs font-medium ${days < 0 ? 'text-destructive' : 'text-primary'}`}>{days < 0 ? `${-days}d late` : days === 0 ? 'Today' : `in ${days}d`}</span>
              </Link>
            )
          })}
        </ListCard>
        <ListCard title="Batches requiring attention" icon={AlertTriangle} empty={!d?.attention?.length} to="/app/production">
          {d?.attention?.map((b: Row) => (
            <Link key={b.id} to={`/app/production/${b.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/60">
              <div className="min-w-0"><p className="text-sm font-medium">{b.code}</p><p className="truncate text-xs text-muted-foreground">{b.variety_name} · {STAGE_LABELS[b.stage as Stage]}</p></div>
              <div className="flex flex-wrap justify-end gap-1">{b.flags.filter((f: string) => f !== 'harvest_soon').map((f: string) => <StatusBadge key={f} value={f} tone={f === 'environment' ? 'amber' : 'red'} label={FLAG_LABEL[f]} />)}</div>
            </Link>
          ))}
        </ListCard>
        <ListCard title="Low-stock alerts" icon={PackageOpen} empty={!d?.low_stock?.length} to="/app/inventory">
          {d?.low_stock?.map((i: Row) => (
            <div key={i.id} className="px-2 py-2">
              <div className="flex justify-between text-sm"><span className="font-medium">{i.name}</span><span className="text-xs text-destructive tabular-nums">{fmtNum(i.quantity)} / {fmtNum(i.min_level)} {i.unit}</span></div>
              <Progress value={Math.min(100, (100 * i.quantity) / (i.min_level || 1))} className="mt-1.5 h-1.5 [&>div]:bg-destructive" />
            </div>
          ))}
        </ListCard>
        <ListCard title="Recent sales" icon={ShoppingBag} empty={!d?.recent_sales?.length} to="/app/sales">
          {d?.recent_sales?.map((s: Row) => (
            <Link key={s.id} to={`/app/sales/${s.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/60">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{s.customer_name}</p><p className="text-xs text-muted-foreground">{s.number} · {fmtDate(s.date)}</p></div>
              <div className="text-right"><p className="text-sm font-medium tabular-nums">{fmtMoney(s.total)}</p><StatusBadge value={s.payment_status} /></div>
            </Link>
          ))}
        </ListCard>
        <ListCard title="Recent activity" icon={Clock} empty={!d?.activities?.length}>
          {d?.activities?.map((a: Row, i: number) => (
            <Link key={i} to={a.link} className="flex gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-fresh" />
              <div className="min-w-0"><p className="text-sm">{titleCase(a.text.split(' ')[0]) + a.text.slice(a.text.split(' ')[0].length)}</p><p className="text-xs text-muted-foreground">{a.by} · {timeAgo(a.at)}</p></div>
            </Link>
          ))}
        </ListCard>
      </div>
    </div>
  )
}
