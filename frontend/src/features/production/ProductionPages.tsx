/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { ArrowLeft, Bug, Check, ChevronRight, Droplets, Eye, Plus, Thermometer, Wheat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/DataTable'
import { FormDialog } from '@/components/shared/FormDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useGet, useList, useMutate, useOptions } from '@/hooks/useApi'
import { useTableState } from '@/hooks/useTableState'
import { daysUntil, fmtDate, fmtDateTime, fmtKg, fmtMoney, fmtNum, titleCase, today } from '@/lib/format'
import { cn } from '@/lib/utils'
import { MANAGERS, can, useRole } from '@/stores/auth'
import { STAGES, STAGE_LABELS, type Row, type Stage } from '@/types'
import { HarvestDialog } from '../harvests/HarvestsPage'

const FLAG: Record<string, [string, 'red' | 'amber' | 'blue']> = {
  incubation_overdue: ['Overdue', 'red'], contamination: ['Contaminated', 'red'], environment: ['Env alert', 'amber'], harvest_soon: ['Harvest soon', 'blue'],
}

export function Flags({ flags }: { flags?: string[] }) {
  if (!flags?.length) return null
  return <span className="flex flex-wrap gap-1">{flags.map((f) => <StatusBadge key={f} value={f} tone={FLAG[f]?.[1]} label={FLAG[f]?.[0]} />)}</span>
}

function BatchForm({ open, onOpenChange, batch }: { open: boolean; onOpenChange: (o: boolean) => void; batch?: Row }) {
  const farms = useOptions('/farms')
  const rooms = useOptions('/rooms')
  const varieties = useOptions('/varieties')
  const create = useMutate('post', ['/production'])
  const update = useMutate('put', ['/production'])
  const navigate = useNavigate()
  const d = (v?: string) => (v ? v.slice(0, 10) : today())
  return (
    <FormDialog
      open={open} onOpenChange={onOpenChange} wide
      title={batch ? `Edit ${batch.code}` : 'New production batch'}
      description="Expected incubation end, first harvest and yield are calculated from the variety."
      schema={z.object({
        variety_id: z.string().min(1, 'Select a variety'), farm_id: z.string().min(1, 'Select a farm'), room_id: z.string().min(1, 'Select a room'),
        substrate_type: z.string().min(1, 'Required'), substrate_prep_date: z.string().min(1), spawning_date: z.string().min(1),
        bags: z.coerce.number().int().min(1, 'At least 1'), substrate_kg: z.coerce.number().min(0), spawn_kg: z.coerce.number().min(0),
        worker: z.string().optional(), notes: z.string().optional(),
      }).refine((v) => v.spawning_date >= v.substrate_prep_date, { message: 'Must be on/after substrate prep', path: ['spawning_date'] })}
      defaults={{
        variety_id: batch?.variety_id ?? '', farm_id: batch?.farm_id ?? '', room_id: batch?.room_id ?? '', substrate_type: batch?.substrate_type ?? 'Wheat straw + bran',
        substrate_prep_date: d(batch?.substrate_prep_date), spawning_date: d(batch?.spawning_date), bags: batch?.bags ?? 200,
        substrate_kg: batch?.substrate_kg ?? 360, spawn_kg: batch?.spawn_kg ?? 18, worker: batch?.worker ?? '', notes: batch?.notes ?? '',
      }}
      fields={[
        { name: 'variety_id', label: 'Mushroom variety', type: 'select', options: varieties },
        { name: 'farm_id', label: 'Farm', type: 'select', options: farms },
        { name: 'room_id', label: 'Cultivation room', type: 'select', options: rooms.map((r) => ({ value: r.value, label: `${r.label} (${r.row.farm_name})` })) },
        { name: 'substrate_type', label: 'Substrate type' },
        { name: 'substrate_prep_date', label: 'Substrate preparation date', type: 'date' }, { name: 'spawning_date', label: 'Spawning date', type: 'date' },
        { name: 'bags', label: 'Number of growing bags', type: 'number' }, { name: 'substrate_kg', label: 'Substrate quantity (kg)', type: 'number' },
        { name: 'spawn_kg', label: 'Spawn quantity (kg)', type: 'number' }, { name: 'worker', label: 'Responsible worker', optional: true },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 2, optional: true },
      ]}
      onSubmit={async (v) => {
        if (batch) return update.mutateAsync({ path: `/production/batches/${batch.id}`, body: v })
        const r = await create.mutateAsync({ path: '/production/batches', body: v })
        navigate(`/app/production/${r.data.id}`)
      }}
    />
  )
}

export function ProductionPage() {
  const role = useRole()
  const ctl = useTableState({ sort: 'spawning_date', order: 'desc', filters: { active: 'true' } })
  const list = useList('/production/batches', ctl.params)
  const varieties = useOptions('/varieties')
  const rooms = useOptions('/rooms')
  const all = useList('/production/batches', { limit: 500, active: 'true' })
  const counts = Object.fromEntries(STAGES.map((s) => [s, (all.data?.items ?? []).filter((b) => b.stage === s).length]))
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader eyebrow="Production" title="Production Batches" description="Track every batch from substrate preparation to completion."
        actions={can(role, ...MANAGERS) && <Button onClick={() => setOpen(true)}><Plus /> New batch</Button>} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {STAGES.filter((s) => s !== 'completed').map((s, i) => (
          <button key={s} onClick={() => ctl.setFilter('stage', ctl.state.filters.stage === s ? 'all' : s)}
            className={cn('flex min-w-[118px] flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50',
              ctl.state.filters.stage === s && 'border-primary bg-accent')}>
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
            <span className="min-w-0"><span className="block truncate text-[11px] text-muted-foreground">{STAGE_LABELS[s]}</span><span className="block text-lg leading-tight font-semibold">{counts[s] ?? 0}</span></span>
          </button>
        ))}
      </div>

      <DataTable
        ctl={ctl} rows={list.data?.items} meta={list.data?.meta} loading={list.isFetching && !list.data}
        onRowClick={(r) => navigate(`/app/production/${r.id}`)}
        searchPlaceholder="Search batch code, substrate, worker…"
        filters={[
          { key: 'active', label: 'Batches', options: [{ value: 'true', label: 'Active only' }] },
          { key: 'stage', label: 'Stage', options: STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] })) },
          { key: 'variety_id', label: 'Variety', options: varieties },
          { key: 'room_id', label: 'Room', options: rooms },
        ]}
        emptyTitle="No production batches" emptyAction={can(role, ...MANAGERS) ? <Button size="sm" onClick={() => setOpen(true)}><Plus /> Start a batch</Button> : undefined}
        columns={[
          { key: 'code', header: 'Batch', sortable: true, cell: (r) => <div><p className="font-medium">{r.code}</p><p className="text-xs text-muted-foreground">{r.variety_name} · {r.room_name}</p></div> },
          { key: 'stage', header: 'Stage', cell: (r) => <StatusBadge value={r.stage} label={STAGE_LABELS[r.stage as Stage]} /> },
          { key: 'bags', header: 'Bags', sortable: true, hideOnMobile: true },
          { key: 'spawning_date', header: 'Spawned', sortable: true, hideOnMobile: true, cell: (r) => fmtDate(r.spawning_date) },
          { key: 'expected_first_harvest', header: 'First harvest', sortable: true, hideOnMobile: true, cell: (r) => {
            const dd = daysUntil(r.expected_first_harvest)
            return <div><p>{fmtDate(r.expected_first_harvest)}</p>{!['harvesting', 'completed'].includes(r.stage) && <p className={cn('text-xs', dd < 0 ? 'text-destructive' : 'text-muted-foreground')}>{dd < 0 ? `${-dd}d overdue` : `in ${dd}d`}</p>}</div>
          } },
          { key: 'yield', header: 'Yield', cell: (r) => (
            <div className="w-32"><div className="flex justify-between text-xs tabular-nums"><span>{fmtNum(r.harvested_kg)} / {fmtNum(r.expected_yield_kg, 0)} kg</span></div>
              <Progress value={Math.min(100, r.yield_pct)} className="mt-1 h-1.5" /></div>
          ) },
          { key: 'flags', header: '', hideOnMobile: true, cell: (r) => <Flags flags={r.flags} /> },
        ]}
      />
      <BatchForm open={open} onOpenChange={setOpen} />
    </div>
  )
}

function StageStepper({ batch, canEdit }: { batch: Row; canEdit: boolean }) {
  const idx = STAGES.indexOf(batch.stage)
  const [target, setTarget] = useState<Stage | null>(null)
  const mut = useMutate('patch', ['/production'])
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm font-semibold">Production lifecycle</CardTitle>
        {canEdit && idx < STAGES.length - 1 && <Button size="sm" onClick={() => setTarget(STAGES[idx + 1])}>Move to {STAGE_LABELS[STAGES[idx + 1]]} <ChevronRight /></Button>}
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-4 gap-y-4 sm:grid-cols-8">
          {STAGES.map((s, i) => (
            <li key={s} className="relative flex flex-col items-center text-center">
              {i > 0 && <span className={cn('absolute top-3.5 right-1/2 -z-0 h-0.5 w-full', i <= idx ? 'bg-primary' : 'bg-border')} />}
              <button disabled={!canEdit || i <= idx} onClick={() => setTarget(s)}
                className={cn('relative z-10 grid size-7 place-items-center rounded-full border-2 text-[11px] font-semibold transition-colors',
                  i < idx && 'border-primary bg-primary text-primary-foreground', i === idx && 'border-cta bg-cta text-white ring-4 ring-cta/20',
                  i > idx && 'border-border bg-card text-muted-foreground enabled:hover:border-primary')}>
                {i < idx ? <Check className="size-3.5" /> : i + 1}
              </button>
              <span className={cn('mt-1.5 text-[11px] leading-tight', i === idx ? 'font-semibold' : 'text-muted-foreground')}>{STAGE_LABELS[s]}</span>
            </li>
          ))}
        </ol>
      </CardContent>
      <FormDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)} title={`Move ${batch.code} to ${target ? STAGE_LABELS[target] : ''}`}
        description="The transition is recorded in the batch history with your name and time." submitLabel="Update stage"
        schema={z.object({ notes: z.string().optional() })} defaults={{ notes: '' }}
        fields={[{ name: 'notes', label: 'Notes', type: 'textarea', span: 2, optional: true, placeholder: 'e.g. Full colonisation observed' }]}
        onSubmit={(v) => mut.mutateAsync({ path: `/production/batches/${batch.id}/stage`, body: { stage: target, notes: v.notes } })} />
    </Card>
  )
}

function ObservationDialog({ open, onOpenChange, batch }: { open: boolean; onOpenChange: (o: boolean) => void; batch: Row }) {
  const mut = useMutate('post', ['/production'])
  const v = batch.variety ?? {}
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Record growth observation"
      description={`Recommended: ${v.temp_min}–${v.temp_max}°C, ${v.humidity_min}–${v.humidity_max}% humidity. Readings outside this range raise an alert.`}
      schema={z.object({ date: z.string().min(1), temperature: z.coerce.number(), humidity: z.coerce.number().min(0).max(100), condition: z.string(),
        contamination: z.boolean(), affected_bags: z.coerce.number().int().min(0), notes: z.string().optional() })
        .refine((x) => !x.contamination || x.affected_bags > 0, { message: 'How many bags are affected?', path: ['affected_bags'] })}
      defaults={{ date: today(), temperature: '', humidity: '', condition: 'good', contamination: false, affected_bags: 0, notes: '' }}
      fields={[
        { name: 'date', label: 'Observation date', type: 'date' },
        { name: 'condition', label: 'Visual growth condition', type: 'select', options: ['excellent', 'good', 'fair', 'poor'].map((x) => ({ value: x, label: titleCase(x) })) },
        { name: 'temperature', label: 'Temperature (°C)', type: 'number' }, { name: 'humidity', label: 'Humidity (%)', type: 'number' },
        { name: 'contamination', label: 'Contamination observed', type: 'switch' }, { name: 'affected_bags', label: 'Affected bags', type: 'number' },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 2, optional: true },
      ]}
      onSubmit={(x) => mut.mutateAsync({ path: `/production/batches/${batch.id}/observations`, body: x })} />
  )
}

export function BatchDetailPage() {
  const { id } = useParams()
  const role = useRole()
  const { data: b, isLoading } = useGet<Row>(`/production/batches/${id}`)
  const [obs, setObs] = useState(false)
  const [edit, setEdit] = useState(false)
  const [harvest, setHarvest] = useState(false)
  if (isLoading || !b) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
  const isMgr = can(role, ...MANAGERS)
  const canObserve = can(role, ...MANAGERS, 'farm_worker')
  const canHarvest = canObserve && ['fruiting', 'harvesting'].includes(b.stage)
  const info: [string, React.ReactNode][] = [
    ['Variety', b.variety_name], ['Farm', b.farm_name], ['Room', b.room_name], ['Substrate', b.substrate_type],
    ['Substrate prepared', fmtDate(b.substrate_prep_date)], ['Spawned', fmtDate(b.spawning_date)], ['Growing bags', fmtNum(b.bags, 0)],
    ['Substrate / spawn', `${fmtNum(b.substrate_kg)} kg / ${fmtNum(b.spawn_kg)} kg`], ['Responsible worker', b.worker || '—'],
    ['Expected incubation end', fmtDate(b.expected_incubation_end)], ['Expected first harvest', fmtDate(b.expected_first_harvest)],
    ['Contaminated bags', b.contaminated_bags ? <span className="text-destructive">{b.contaminated_bags}</span> : '0'],
  ]
  const batchCost = (b.expenses ?? []).reduce((a: number, e: Row) => a + e.amount, 0)
  return (
    <div className="space-y-4">
      <Link to="/app/production" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Production batches</Link>
      <PageHeader eyebrow={b.variety_name} title={b.code} description={`${b.farm_name} · ${b.room_name}`}
        actions={<>
          <Flags flags={b.flags} />
          {canObserve && b.stage !== 'completed' && <Button variant="outline" onClick={() => setObs(true)}><Eye /> Observation</Button>}
          {canHarvest && <Button variant="outline" onClick={() => setHarvest(true)}><Wheat /> Record harvest</Button>}
          {isMgr && <Button variant="secondary" onClick={() => setEdit(true)}>Edit</Button>}
        </>} />

      <StageStepper batch={b} canEdit={isMgr} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Harvested', fmtKg(b.harvested_kg), `${fmtNum(b.yield_pct)}% of ${fmtKg(b.expected_yield_kg)} expected`],
          ['Yield per bag', `${fmtNum(b.yield_per_bag, 3)} kg`, `Expected ${b.variety?.expected_yield_kg_per_bag} kg`],
          ['Flushes approved', String(b.approved_flushes), `${fmtKg(b.rejected_kg)} rejected (losses)`],
          ['Success rate', b.success_rate == null ? '—' : `${b.success_rate}%`, batchCost ? `Linked costs ${fmtMoney(batchCost)}` : 'Sellable / total harvested'],
        ].map(([l, v, h]) => (
          <div key={l} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{h}</p></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-sm font-semibold">Batch details</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">{info.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>
            {b.notes && <p className="mt-3 rounded-lg bg-muted p-3 text-xs">{b.notes}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <Tabs defaultValue="observations">
            <CardHeader>
              <TabsList><TabsTrigger value="observations">Growth history ({b.observations.length})</TabsTrigger><TabsTrigger value="harvests">Harvests ({b.harvests.length})</TabsTrigger><TabsTrigger value="history">Stage history</TabsTrigger></TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="observations" className="space-y-2">
                {!b.observations.length && <EmptyState title="No observations yet" description="Record temperature, humidity and growth condition regularly." />}
                {b.observations.map((o: Row) => (
                  <div key={o.id} className={cn('flex flex-wrap items-start gap-x-4 gap-y-1 rounded-lg border p-3', o.contamination && 'border-destructive/40 bg-destructive/5')}>
                    <div className="w-24"><p className="text-sm font-medium">{fmtDate(o.date)}</p><p className="text-xs text-muted-foreground">{STAGE_LABELS[o.stage as Stage]}</p></div>
                    <div className="flex gap-3 text-sm tabular-nums"><span className="inline-flex items-center gap-1"><Thermometer className="size-3.5 text-cta" />{o.temperature}°C</span><span className="inline-flex items-center gap-1"><Droplets className="size-3.5 text-sky-600" />{o.humidity}%</span></div>
                    <StatusBadge value={o.condition} />
                    {o.contamination && <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><Bug className="size-3.5" />{o.affected_bags} bags contaminated</span>}
                    <p className="w-full text-xs text-muted-foreground">{o.notes && <>{o.notes} · </>}by {o.by}</p>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="harvests">
                {!b.harvests.length ? <EmptyState title="No harvests yet" description={canHarvest ? 'Record the first flush when mushrooms are ready.' : 'Harvests can be recorded once the batch is fruiting.'} /> : (
                  <div className="divide-y rounded-lg border">
                    {b.harvests.map((h: Row) => (
                      <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                        <div><p className="font-medium">Flush {h.flush} · {h.code}</p><p className="text-xs text-muted-foreground">{fmtDate(h.date)} · {h.bags_harvested} bags · grade {h.grade}</p></div>
                        <div className="flex items-center gap-3"><span className="tabular-nums">{fmtKg(h.weight_kg)}</span><StatusBadge value={h.status} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="history">
                <ol className="relative ml-2 border-l pl-5">
                  {b.history.map((h: Row) => (
                    <li key={h.id} className="mb-4 last:mb-0">
                      <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-primary" />
                      <p className="text-sm font-medium">{h.from ? `${STAGE_LABELS[h.from as Stage]} → ` : ''}{STAGE_LABELS[h.to as Stage]}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(h.at)} · {h.by}</p>
                      {h.notes && <p className="mt-0.5 text-xs">{h.notes}</p>}
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
      <ObservationDialog open={obs} onOpenChange={setObs} batch={b} />
      <BatchForm open={edit} onOpenChange={setEdit} batch={b} />
      <HarvestDialog open={harvest} onOpenChange={setHarvest} batch={b} />
    </div>
  )
}
