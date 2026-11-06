import { useState } from 'react'
import { z } from 'zod'
import { ArrowDownToLine, ArrowUpFromLine, Ban, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/DataTable'
import { FormDialog } from '@/components/shared/FormDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { ResourcePage } from '@/components/shared/ResourcePage'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { useGet, useList, useMutate, useOptions } from '@/hooks/useApi'
import { useTableState } from '@/hooks/useTableState'
import { fmtDate, fmtDateTime, fmtKg, fmtMoney, fmtNum, titleCase } from '@/lib/format'
import { MANAGERS, can, useRole } from '@/stores/auth'
import type { Row } from '@/types'

const CATS = ['substrate', 'spawn', 'bags', 'packaging', 'cleaning', 'other']
const opts = (xs: string[]) => xs.map((v) => ({ value: v, label: titleCase(v) }))

type Txn = { target: Row; kind: 'item' | 'lot'; type: string } | null

function TxnDialog({ txn, onClose }: { txn: Txn; onClose: () => void }) {
  const mut = useMutate('post', ['/inventory'])
  const unit = txn?.kind === 'lot' ? 'kg' : txn?.target.unit
  const labels: Record<string, string> = { received: 'Record stock received', consumed: 'Record stock consumed', adjustment: 'Stock adjustment', damaged: 'Record damaged stock', expired: 'Write off expired stock' }
  return (
    <FormDialog open={!!txn} onOpenChange={(o) => !o && onClose()} title={txn ? labels[txn.type] : ''}
      description={txn ? `${txn.kind === 'lot' ? `${txn.target.variety_name} lot from ${txn.target.batch_code}` : txn.target.name} · currently ${fmtNum(txn.kind === 'lot' ? txn.target.available_kg : txn.target.quantity)} ${unit}` : ''}
      schema={z.object({ quantity: z.coerce.number().positive('Must be positive'), direction: z.string(), notes: z.string().optional() })}
      defaults={{ quantity: '', direction: 'in', notes: '' }}
      fields={[
        { name: 'quantity', label: `Quantity (${unit})`, type: 'number' },
        ...(txn?.type === 'adjustment' ? [{ name: 'direction', label: 'Direction', type: 'select' as const, options: [{ value: 'in', label: 'Increase' }, { value: 'out', label: 'Decrease' }] }] : []),
        { name: 'notes', label: 'Notes', type: 'textarea', span: 2, optional: true },
      ]}
      onSubmit={(v) => mut.mutateAsync({ path: '/inventory/transactions', body: { ...v, type: txn!.type, [txn!.kind === 'lot' ? 'lot_id' : 'item_id']: txn!.target.id } })} />
  )
}

function FreshStock({ onTxn }: { onTxn: (t: Txn) => void }) {
  const role = useRole()
  const ctl = useTableState({ sort: 'harvest_date', order: 'desc', filters: { available: 'true' } })
  const lots = useList('/inventory/stock', ctl.params)
  const summary = useGet<Row[]>('/inventory/stock/summary')
  const varieties = useOptions('/varieties')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) :
          summary.data?.length === 0 ? <p className="col-span-full rounded-xl border bg-card p-4 text-sm text-muted-foreground">No fresh stock available. Approve harvests to add stock.</p> :
            summary.data?.map((s) => (
              <div key={s.id} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{s.variety_name}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{fmtKg(s.available_kg)}</p>
                <p className="text-xs text-muted-foreground">{s.lots} lot(s) · ≈ {fmtMoney(s.available_kg * s.price_per_kg)}</p>
              </div>
            ))}
      </div>
      <DataTable ctl={ctl} rows={lots.data?.items} meta={lots.data?.meta} loading={lots.isFetching && !lots.data}
        searchPlaceholder="Search batch, location…" emptyTitle="No stock lots"
        filters={[{ key: 'available', label: 'Lots', options: [{ value: 'true', label: 'In stock only' }] }, { key: 'variety_id', label: 'Variety', options: varieties }]}
        columns={[
          { key: 'variety_name', header: 'Variety', cell: (r) => <div><p className="font-medium">{r.variety_name}</p><p className="text-xs text-muted-foreground">{r.batch_code} · {r.farm_name}</p></div> },
          { key: 'grade', header: 'Grade', cell: (r) => `Grade ${r.grade}` },
          { key: 'harvest_date', header: 'Harvested', sortable: true, hideOnMobile: true, cell: (r) => fmtDate(r.harvest_date) },
          { key: 'expiry_date', header: 'Expires', sortable: true, cell: (r) => <div><p>{fmtDate(r.expiry_date)}</p>{r.expired ? <StatusBadge value="expired" /> : r.expiring_soon && <StatusBadge value="soon" tone="amber" label="Expiring soon" />}</div> },
          { key: 'quantity_kg', header: 'Harvested qty', hideOnMobile: true, cell: (r) => fmtKg(r.quantity_kg) },
          { key: 'available_kg', header: 'Available', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{fmtKg(r.available_kg)}</span> },
          { key: 'location', header: 'Location', hideOnMobile: true },
          ...(can(role, ...MANAGERS) ? [{ key: '_a', header: '', cell: (r: Row) => r.available_kg > 0 && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="xs" variant="outline" onClick={() => onTxn({ target: r, kind: 'lot', type: r.expired ? 'expired' : 'damaged' })}><Ban /> {r.expired ? 'Write off' : 'Damaged'}</Button>
            </div>
          ) }] : []),
        ]} />
    </div>
  )
}

function Movements() {
  const ctl = useTableState({ sort: 'created_at', order: 'desc' })
  const list = useList('/inventory/transactions', ctl.params)
  return (
    <DataTable ctl={ctl} rows={list.data?.items} meta={list.data?.meta} loading={list.isFetching && !list.data} searchPlaceholder="Search reference, notes, user…"
      filters={[{ key: 'type', label: 'Type', options: opts(['harvest', 'sale', 'return', 'received', 'consumed', 'adjustment', 'damaged', 'expired']) }, { key: 'direction', label: 'Direction', options: [{ value: 'in', label: 'In' }, { value: 'out', label: 'Out' }] }]}
      columns={[
        { key: 'created_at', header: 'When', sortable: true, cell: (r) => fmtDateTime(r.created_at) },
        { key: 'item', header: 'Item', cell: (r) => r.item_name ?? (r.lot_batch ? `Fresh mushrooms · ${r.lot_batch}` : '—') },
        { key: 'type', header: 'Type', cell: (r) => <StatusBadge value={r.type} tone={r.direction === 'in' ? 'green' : 'amber'} /> },
        { key: 'quantity', header: 'Quantity', cell: (r) => <span className={`tabular-nums ${r.direction === 'in' ? 'text-emerald-600' : 'text-amber-700 dark:text-amber-400'}`}>{r.direction === 'in' ? '+' : '−'}{fmtNum(r.quantity)} {r.unit}</span> },
        { key: 'reference', header: 'Reference', hideOnMobile: true, cell: (r) => r.reference ?? r.notes ?? '—' },
        { key: 'by', header: 'By', hideOnMobile: true },
      ]} />
  )
}

export function InventoryPage() {
  const [txn, setTxn] = useState<Txn>(null)
  const farms = useOptions('/farms')
  return (
    <div>
      <PageHeader eyebrow="Production" title="Inventory" description="Fresh mushroom stock (updated automatically by harvests and sales) and farm supplies." />
      <Tabs defaultValue="fresh">
        <TabsList className="mb-4"><TabsTrigger value="fresh">Fresh mushrooms</TabsTrigger><TabsTrigger value="supplies">Farm supplies</TabsTrigger><TabsTrigger value="moves">Stock movements</TabsTrigger></TabsList>
        <TabsContent value="fresh"><FreshStock onTxn={setTxn} /></TabsContent>
        <TabsContent value="supplies">
          <ResourcePage embedded path="/inventory/items" title="Supplies" singular="Item" description="Substrate, spawn, bags, packaging and cleaning supplies."
            writeRoles={MANAGERS} initial={{ sort: 'name', order: 'asc' }}
            filters={[{ key: 'category', label: 'Category', options: opts(CATS) }, { key: 'farm_id', label: 'Farm', options: farms }]}
            rowActions={(r) => (<>
              <DropdownMenuItem onClick={() => setTxn({ target: r, kind: 'item', type: 'received' })}><ArrowDownToLine /> Stock received</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTxn({ target: r, kind: 'item', type: 'consumed' })}><ArrowUpFromLine /> Stock consumed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTxn({ target: r, kind: 'item', type: 'adjustment' })}><SlidersHorizontal /> Adjust</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTxn({ target: r, kind: 'item', type: 'damaged' })}><Ban /> Damaged / expired</DropdownMenuItem>
            </>)}
            columns={[
              { key: 'name', header: 'Item', sortable: true, cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.sku} · {r.farm_name}</p></div> },
              { key: 'category', header: 'Category', cell: (r) => <StatusBadge value={r.category} tone="beige" /> },
              { key: 'quantity', header: 'In stock', sortable: true, cell: (r) => <span className="tabular-nums">{fmtNum(r.quantity)} {r.unit}</span> },
              { key: 'min_level', header: 'Min level', hideOnMobile: true, cell: (r) => `${fmtNum(r.min_level)} ${r.unit}` },
              { key: 'unit_cost', header: 'Unit cost', hideOnMobile: true, cell: (r) => fmtMoney(r.unit_cost) },
              { key: 'location', header: 'Location', hideOnMobile: true },
              { key: 'low_stock', header: 'Status', cell: (r) => <StatusBadge value={r.low_stock ? 'low' : 'ok'} label={r.low_stock ? 'Low stock' : 'OK'} /> },
            ]}
            schema={z.object({ farm_id: z.string().min(1, 'Select a farm'), name: z.string().min(1, 'Required'), sku: z.string().min(1, 'Required'), category: z.string(),
              unit: z.string().min(1, 'Required'), quantity: z.coerce.number().min(0), min_level: z.coerce.number().min(0), unit_cost: z.coerce.number().min(0), location: z.string().optional() })}
            defaults={(r) => ({ farm_id: r?.farm_id ?? '', name: r?.name ?? '', sku: r?.sku ?? '', category: r?.category ?? 'substrate', unit: r?.unit ?? 'kg',
              quantity: r?.quantity ?? 0, min_level: r?.min_level ?? 0, unit_cost: r?.unit_cost ?? 0, location: r?.location ?? 'Main Store' })}
            fields={[
              { name: 'name', label: 'Item name' }, { name: 'sku', label: 'SKU' },
              { name: 'category', label: 'Category', type: 'select', options: opts(CATS) }, { name: 'farm_id', label: 'Farm', type: 'select', options: farms },
              { name: 'quantity', label: 'Quantity', type: 'number' }, { name: 'unit', label: 'Unit', placeholder: 'kg, pcs, L…' },
              { name: 'min_level', label: 'Minimum stock level', type: 'number' }, { name: 'unit_cost', label: 'Unit cost (RWF)', type: 'number' },
              { name: 'location', label: 'Storage location', span: 2, optional: true },
            ]} />
        </TabsContent>
        <TabsContent value="moves"><Movements /></TabsContent>
      </Tabs>
      <TxnDialog txn={txn} onClose={() => setTxn(null)} />
    </div>
  )
}
