/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtCompact } from '@/lib/format'

export const C = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const axis = { stroke: 'var(--muted-foreground)', fontSize: 11, tickLine: false, axisLine: false }

export function ChartCard({ title, description, children, loading, action, className }: { title: string; description?: string; children: ReactNode; loading?: boolean; action?: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div><CardTitle className="text-sm font-semibold">{title}</CardTitle>{description && <CardDescription className="text-xs">{description}</CardDescription>}</div>
        {action}
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-[240px] w-full" /> : children}</CardContent>
    </Card>
  )
}

function Tip({ active, payload, label, fmt, labelFmt }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-medium">{labelFmt ? labelFmt(label) : label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}: <span className="font-medium text-foreground tabular-nums">{fmt ? fmt(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

const legend = <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span style={{ color: 'var(--muted-foreground)' }}>{v}</span>} />

export interface Series { key: string; name: string; color?: string }

export function TrendArea({ data, x, series, fmt, xFmt, height = 240 }: { data: any[]; x: string; series: Series[]; fmt?: (v: number) => string; xFmt?: (v: any) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? C[i]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={s.color ?? C[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey={x} {...axis} tickFormatter={xFmt} />
        <YAxis {...axis} tickFormatter={(v) => fmtCompact(v)} width={48} />
        <Tooltip content={<Tip fmt={fmt} labelFmt={xFmt} />} cursor={{ stroke: 'var(--chart-muted)' }} />
        {series.length > 1 && legend}
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? C[i]} strokeWidth={2} fill={`url(#g-${s.key})`}
            dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function Bars({ data, x, series, fmt, xFmt, height = 240, layout = 'horizontal', stacked }: { data: any[]; x: string; series: Series[]; fmt?: (v: number) => string; xFmt?: (v: any) => string; height?: number; layout?: 'horizontal' | 'vertical'; stacked?: boolean }) {
  const vertical = layout === 'vertical'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ left: vertical ? 8 : -8, right: 8, top: 8 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={vertical} horizontal={!vertical} stroke="var(--chart-grid)" />
        {vertical ? (
          <>
            <XAxis type="number" {...axis} allowDecimals={false} tickFormatter={(v) => fmtCompact(v)} />
            <YAxis type="category" dataKey={x} {...axis} width={96} tickFormatter={xFmt} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} {...axis} tickFormatter={xFmt} />
            <YAxis {...axis} tickFormatter={(v) => fmtCompact(v)} width={48} />
          </>
        )}
        <Tooltip content={<Tip fmt={fmt} labelFmt={xFmt} />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
        {series.length > 1 && legend}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color ?? C[i]} stackId={stacked ? 'a' : undefined}
            radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={vertical ? 18 : 28} stroke="var(--card)" strokeWidth={stacked ? 1 : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Donut({ data, nameKey, valueKey, fmt, height = 240, colors }: { data: any[]; nameKey: string; valueKey: string; fmt?: (v: number) => string; height?: number; colors?: string[] }) {
  const total = data.reduce((a, d) => a + (d[valueKey] ?? 0), 0)
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="var(--card)" strokeWidth={2} cornerRadius={4}>
            {data.map((_, i) => <Cell key={i} fill={(colors ?? C)[i % 5]} />)}
          </Pie>
          <Tooltip content={<Tip fmt={fmt} />} />
          {legend}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[calc(50%-22px)] -translate-y-1/2 text-center">
        <p className="text-xl font-semibold tabular-nums">{fmt ? fmt(total) : fmtCompact(total)}</p>
        <p className="text-[11px] text-muted-foreground">total</p>
      </div>
    </div>
  )
}
