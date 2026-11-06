import { z } from 'zod'
import { ResourcePage } from '@/components/shared/ResourcePage'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useGet, useOptions } from '@/hooks/useApi'
import { fmtDate, fmtMoney, titleCase, toInputDate, today } from '@/lib/format'
import { MANAGERS } from '@/stores/auth'

const CATS = ['spawn', 'substrate', 'labor', 'electricity', 'water', 'packaging', 'transportation', 'equipment', 'maintenance', 'other']
const METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card']
const opts = (xs: string[]) => xs.map((v) => ({ value: v, label: titleCase(v) }))

function Summary() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = useGet<any>('/reports/financial')
  const s = data?.summary
  if (!s) return null
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Revenue', fmtMoney(s.revenue)], ['Expenses', fmtMoney(s.expenses)], ['Net profit', fmtMoney(s.profit)], ['Cost per kg produced', fmtMoney(s.cost_per_kg)]].map(([l, v]) => (
        <div key={l} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-lg font-semibold tabular-nums">{v}</p></div>
      ))}
    </div>
  )
}

export function ExpensesPage() {
  const farms = useOptions('/farms')
  const batches = useOptions('/production/batches', {}, 'code')
  return (
    <ResourcePage
      path="/expenses" title="Expenses" singular="Expense" eyebrow="Finance"
      description="Operational costs. Link an expense to a batch to include it in that batch's production cost."
      writeRoles={MANAGERS} deleteRoles={['super_admin', 'farm_owner']}
      initial={{ sort: 'date', order: 'desc' }}
      above={<Summary />}
      filters={[{ key: 'category', label: 'Category', options: opts(CATS) }, { key: 'farm_id', label: 'Farm', options: farms }]}
      columns={[
        { key: 'date', header: 'Date', sortable: true, cell: (r) => fmtDate(r.date) },
        { key: 'description', header: 'Description', cell: (r) => <div><p className="font-medium">{r.description}</p><p className="text-xs text-muted-foreground">{r.farm_name}{r.batch_code ? ` · ${r.batch_code}` : ''}</p></div> },
        { key: 'category', header: 'Category', cell: (r) => <StatusBadge value={r.category} tone="beige" /> },
        { key: 'payment_method', header: 'Paid via', hideOnMobile: true, cell: (r) => titleCase(r.payment_method) },
        { key: 'responsible', header: 'By', hideOnMobile: true },
        { key: 'amount', header: 'Amount', sortable: true, className: 'text-right', cell: (r) => <span className="font-medium tabular-nums">{fmtMoney(r.amount)}</span> },
      ]}
      schema={z.object({ farm_id: z.string().min(1, 'Select a farm'), description: z.string().min(2, 'Required'), category: z.string(),
        amount: z.coerce.number().positive('Must be positive'), date: z.string().min(1, 'Required'), payment_method: z.string(),
        responsible: z.string().optional(), batch_id: z.string().optional().nullable() })}
      defaults={(r) => ({ farm_id: r?.farm_id ?? '', description: r?.description ?? '', category: r?.category ?? 'other', amount: r?.amount ?? '',
        date: toInputDate(r?.date) || today(), payment_method: r?.payment_method ?? 'bank_transfer', responsible: r?.responsible ?? '', batch_id: r?.batch_id ?? '' })}
      toBody={(v) => ({ ...v, batch_id: v.batch_id || null })}
      fields={[
        { name: 'description', label: 'Description', span: 2 }, { name: 'category', label: 'Category', type: 'select', options: opts(CATS) },
        { name: 'amount', label: 'Amount (RWF)', type: 'number' }, { name: 'date', label: 'Date', type: 'date' },
        { name: 'payment_method', label: 'Payment method', type: 'select', options: opts(METHODS) },
        { name: 'farm_id', label: 'Farm', type: 'select', options: farms }, { name: 'batch_id', label: 'Production batch', type: 'select', options: batches, optional: true },
        { name: 'responsible', label: 'Responsible person', span: 2, optional: true },
      ]}
    />
  )
}
