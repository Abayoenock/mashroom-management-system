/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useGet } from '@/hooks/useApi'
import { fmtDate, fmtMoney, fmtNum, titleCase } from '@/lib/format'
import { useRole } from '@/stores/auth'

const KINDS = [
  ['production', 'Production'], ['harvest', 'Harvest'], ['sales', 'Sales'], ['financial', 'Financial'], ['inventory', 'Inventory'],
] as const

const MONEY = new Set(['subtotal', 'discount', 'total', 'paid', 'balance', 'revenue', 'expenses', 'profit', 'cost_per_kg', 'value', 'outstanding', 'stock_value'])
const DATE = new Set(['date', 'spawning_date'])
const STATUS = new Set(['stage', 'status', 'payment_status', 'grade'])

function cell(col: string, v: any) {
  if (v === null || v === undefined || v === '') return '—'
  if (MONEY.has(col)) return fmtMoney(v)
  if (DATE.has(col)) return fmtDate(v)
  if (STATUS.has(col)) return <StatusBadge value={String(v)} />
  if (typeof v === 'number') return fmtNum(v, 2)
  return String(v)
}

function toCsv(cols: string[], rows: any[]) {
  const esc = (v: any) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(DATE.has(c) && r[c] ? String(r[c]).slice(0, 10) : r[c])).join(','))].join('\n')
}

export function ReportsPage() {
  const role = useRole()
  const kinds = role === 'sales_manager' ? KINDS.filter(([k]) => ['sales', 'inventory'].includes(k)) : KINDS
  const [kind, setKind] = useState<string>(kinds[0][0])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, isFetching } = useGet<any>(`/reports/${kind}`, { from, to })

  const download = () => {
    const blob = new Blob([toCsv(data.columns, data.rows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Analytics" title="Reports" description="Filter by date and export to CSV (opens in Excel) or print to PDF."
        actions={data && <>
          <Button variant="outline" onClick={() => window.print()} className="no-print"><Printer /> Print / PDF</Button>
          <Button onClick={download} className="no-print"><Download /> Export CSV</Button>
        </>} />
      <div className="no-print flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-end">
        <Tabs value={kind} onValueChange={setKind} className="flex-1"><TabsList className="flex-wrap">{kinds.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList></Tabs>
        {kind !== 'inventory' && (
          <div className="flex gap-2">
            <div className="grid gap-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" /></div>
            <div className="grid gap-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" /></div>
          </div>
        )}
      </div>
      {!data ? <Skeleton className="h-96" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {Object.entries(data.summary).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{titleCase(k)}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{MONEY.has(k) ? fmtMoney(v as number) : k.endsWith('pct') ? `${v}%` : fmtNum(v as number)}</p>
              </div>
            ))}
          </div>
          {data.summary.by_category && (
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Expenses by category</p>
              <div className="space-y-2">
                {Object.entries(data.summary.by_category as Record<string, number>).map(([c, v]) => {
                  const max = Math.max(...Object.values(data.summary.by_category as Record<string, number>))
                  return (
                    <div key={c} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{titleCase(c)}</span>
                      <div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(100 * v) / max}%` }} /></div>
                      <span className="tabular-nums">{fmtMoney(v)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className={`overflow-x-auto rounded-xl border bg-card ${isFetching ? 'opacity-60' : ''}`}>
            {data.rows.length === 0 ? <EmptyState title="No data for this period" description="Try widening the date range." /> : (
              <Table>
                <TableHeader><TableRow>{data.columns.map((c: string) => <TableHead key={c} className="text-xs whitespace-nowrap">{titleCase(c)}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{data.rows.map((r: any, i: number) => (
                  <TableRow key={i}>{data.columns.map((c: string) => <TableCell key={c} className="whitespace-nowrap tabular-nums">{cell(c, r[c])}</TableCell>)}</TableRow>
                ))}</TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
