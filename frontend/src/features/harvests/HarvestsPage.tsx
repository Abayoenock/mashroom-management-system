/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/DataTable'
import { FormDialog } from '@/components/shared/FormDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Bars, ChartCard } from '@/components/charts/Charts'
import { useGet, useList, useMutate, useOptions } from '@/hooks/useApi'
import { useTableState } from '@/hooks/useTableState'
import { fmtDate, fmtKg, fmtMonth, fmtNum, today } from '@/lib/format'
import { MANAGERS, can, useAuth, useRole } from '@/stores/auth'
import type { Row } from '@/types'

export function HarvestDialog({ open, onOpenChange, batch }: { open: boolean; onOpenChange: (o: boolean) => void; batch?: Row }) {
  const user = useAuth((s) => s.user)
  const batches = useList('/production/batches', { limit: 500, active: 'true' }, open && !batch)
  const ready = (batches.data?.items ?? []).filter((b) => ['fruiting', 'harvesting'].includes(b.stage))
  const mut = useMutate('post', ['/harvests', '/production', '/inventory'])
  const nextFlush = batch ? (batch.harvests?.filter((h: Row) => h.status !== 'rejected').length ?? 0) + 1 : 1
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Record harvest"
      description="Submitted harvests go to a manager for approval. Approved weight is added to mushroom stock."
      schema={z.object({ batch_id: z.string().min(1, 'Select a batch'), date: z.string().min(1), flush: z.coerce.number().int().min(1),
        bags_harvested: z.coerce.number().int().min(1, 'At least 1'), weight_kg: z.coerce.number().positive('Must be positive'), grade: z.string(),
        rejected_kg: z.coerce.number().min(0), worker: z.string().optional(), notes: z.string().optional() })}
      defaults={{ batch_id: batch?.id ?? '', date: today(), flush: nextFlush, bags_harvested: batch?.bags ?? '', weight_kg: '', grade: 'A', rejected_kg: 0, worker: user?.name ?? '', notes: '' }}
      fields={[
        ...(batch ? [] : [{ name: 'batch_id', label: 'Production batch', type: 'select' as const, span: 2 as const, options: ready.map((b) => ({ value: b.id, label: `${b.code} · ${b.variety_name} · ${b.room_name}` })),
          hint: ready.length ? 'Only batches in fruiting or harvesting are listed' : 'No batches are currently fruiting' }]),
        { name: 'date', label: 'Harvest date', type: 'date' },
        { name: 'flush', label: 'Harvest cycle (flush #)', type: 'number', hint: '1 = first flush, 2 = second…' },
        { name: 'bags_harvested', label: 'Bags harvested', type: 'number' }, { name: 'weight_kg', label: 'Total weight (kg)', type: 'number' },
        { name: 'grade', label: 'Grade / quality', type: 'select', options: [{ value: 'A', label: 'Grade A (premium)' }, { value: 'B', label: 'Grade B (standard)' }, { value: 'C', label: 'Grade C (processing)' }] },
        { name: 'rejected_kg', label: 'Rejected quantity (kg)', type: 'number' },
        { name: 'worker', label: 'Responsible worker', span: 2, optional: true }, { name: 'notes', label: 'Notes', type: 'textarea', span: 2, optional: true },
      ]}
      onSubmit={(v) => mut.mutateAsync({ path: '/harvests', body: v })} />
  )
}

function ReviewDialog({ harvest, action, onClose }: { harvest: Row | null; action: 'approve' | 'reject'; onClose: () => void }) {
  const mut = useMutate('patch', ['/harvests', '/production', '/inventory'])
  return (
    <FormDialog open={!!harvest} onOpenChange={(o) => !o && onClose()}
      title={`${action === 'approve' ? 'Approve' : 'Reject'} ${harvest?.code ?? ''}`}
      description={harvest ? `${harvest.batch_code} · flush ${harvest.flush} · ${fmtKg(harvest.weight_kg)} grade ${harvest.grade}` : ''}
      submitLabel={action === 'approve' ? 'Approve & add to stock' : 'Reject harvest'}
      schema={z.object({ storage_location: z.string().optional(), shelf_life_days: z.coerce.number().int().min(1).max(60), notes: z.string().optional() })}
      defaults={{ storage_location: 'Cold Room 1', shelf_life_days: 7, notes: '' }}
      fields={action === 'approve' ? [
        { name: 'storage_location', label: 'Storage location' }, { name: 'shelf_life_days', label: 'Shelf life (days)', type: 'number' },
        { name: 'notes', label: 'Review notes', type: 'textarea', span: 2, optional: true },
      ] : [{ name: 'notes', label: 'Reason for rejection', type: 'textarea', span: 2 }]}
      onSubmit={(v) => mut.mutateAsync({ path: `/harvests/${harvest!.id}/approve`, body: { ...v, action } })} />
  )
}

export function HarvestsPage() {
  const role = useRole()
  const ctl = useTableState({ sort: 'date', order: 'desc' })
  const list = useList('/harvests', ctl.params)
  const pending = useList('/harvests', { status: 'pending', limit: 1 })
  const report = useGet<any>('/harvests/reports')
  const varieties = useOptions('/varieties')
  const [open, setOpen] = useState(false)
  const [review, setReview] = useState<{ h: Row | null; a: 'approve' | 'reject' }>({ h: null, a: 'approve' })
  const isMgr = can(role, ...MANAGERS)
  const canRecord = can(role, ...MANAGERS, 'farm_worker')

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Production" title="Harvests" description="Flush-by-flush harvest records with approval workflow."
        actions={canRecord && <Button onClick={() => setOpen(true)}><Plus /> Record harvest</Button>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Harvest by month" description="Approved and rejected weight (kg)" loading={report.isLoading}>
          <Bars data={report.data?.by_month ?? []} x="id" xFmt={fmtMonth} fmt={fmtKg} stacked height={220}
            series={[{ key: 'kg', name: 'Approved' }, { key: 'rejected', name: 'Rejected', color: 'var(--chart-2)' }]} />
        </ChartCard>
        <ChartCard title="By variety" description="Total kg · yield per bag" loading={report.isLoading}>
          <div className="space-y-3">
            {(report.data?.by_variety ?? []).map((v: Row) => (
              <div key={v.id ?? v.name} className="flex items-center justify-between text-sm">
                <span>{v.name}</span>
                <span className="text-right tabular-nums"><span className="font-medium">{fmtKg(v.kg)}</span><span className="block text-xs text-muted-foreground">{fmtNum(v.yield_per_bag, 3)} kg/bag · {v.count} flushes</span></span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <Tabs value={ctl.state.filters.status ?? 'all'} onValueChange={(v) => ctl.setFilter('status', v)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending approval {pending.data?.meta.total ? <span className="ml-1 rounded-full bg-cta px-1.5 text-[10px] text-white">{pending.data.meta.total}</span> : null}</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable ctl={ctl} rows={list.data?.items} meta={list.data?.meta} loading={list.isFetching && !list.data}
        searchPlaceholder="Search harvest code, worker…"
        filters={[{ key: 'variety_id', label: 'Variety', options: varieties }, { key: 'grade', label: 'Grade', options: ['A', 'B', 'C'].map((g) => ({ value: g, label: `Grade ${g}` })) }]}
        emptyTitle="No harvests found"
        columns={[
          { key: 'code', header: 'Harvest', sortable: true, cell: (r) => <div><p className="font-medium">{r.code}</p><Link onClick={(e) => e.stopPropagation()} to={`/app/production/${r.batch_id}`} className="text-xs text-primary hover:underline">{r.batch_code}</Link></div> },
          { key: 'date', header: 'Date', sortable: true, cell: (r) => fmtDate(r.date) },
          { key: 'variety_name', header: 'Variety', hideOnMobile: true },
          { key: 'flush', header: 'Flush', sortable: true, hideOnMobile: true, cell: (r) => `#${r.flush}` },
          { key: 'weight_kg', header: 'Weight', sortable: true, cell: (r) => <div className="tabular-nums"><p className="font-medium">{fmtKg(r.weight_kg)}</p><p className="text-xs text-muted-foreground">{fmtNum(r.weight_kg / r.bags_harvested, 3)} kg/bag</p></div> },
          { key: 'grade', header: 'Grade', hideOnMobile: true, cell: (r) => <StatusBadge value={r.grade} tone={r.grade === 'A' ? 'green' : r.grade === 'B' ? 'beige' : 'gray'} label={`Grade ${r.grade}`} /> },
          { key: 'rejected_kg', header: 'Rejected', hideOnMobile: true, cell: (r) => fmtKg(r.rejected_kg) },
          { key: 'worker', header: 'Worker', hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (r) => r.status === 'pending' && isMgr ? (
            <div className="flex gap-1">
              <Button size="xs" onClick={() => setReview({ h: r, a: 'approve' })}><Check /> Approve</Button>
              <Button size="xs" variant="destructive" onClick={() => setReview({ h: r, a: 'reject' })} aria-label="Reject"><X /></Button>
            </div>
          ) : <StatusBadge value={r.status} /> },
        ]} />
      <HarvestDialog open={open} onOpenChange={setOpen} />
      <ReviewDialog harvest={review.h} action={review.a} onClose={() => setReview({ h: null, a: 'approve' })} />
    </div>
  )
}
