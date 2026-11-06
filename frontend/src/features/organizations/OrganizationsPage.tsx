import { useState } from 'react'
import { z } from 'zod'
import { Ban, Building2, CheckCircle2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { FormDialog } from '@/components/shared/FormDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useList, useMutate } from '@/hooks/useApi'
import { useTableState } from '@/hooks/useTableState'
import { fmtDate, fmtMoney } from '@/lib/format'

export function OrganizationsPage() {
  const ctl = useTableState({ sort: 'created_at', order: 'desc' })
  const list = useList('/organizations', ctl.params)
  const create = useMutate('post', ['/organizations', '/users'])
  const update = useMutate('patch', ['/organizations'])
  const [open, setOpen] = useState(false)
  const totals = (list.data?.items ?? []).reduce((a, o) => ({ farms: a.farms + o.farms, users: a.users + o.users, revenue: a.revenue + o.revenue }), { farms: 0, users: 0, revenue: 0 })

  return (
    <div>
      <PageHeader eyebrow="Platform" title="Organizations"
        description="Each organization is an isolated tenant: its farms, users, customers, varieties, production and sales are invisible to other organizations."
        actions={<Button onClick={() => setOpen(true)}><Plus /> New organization</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Organizations', list.data?.meta.total ?? 0], ['Farms (this page)', totals.farms], ['Users (this page)', totals.users], ['Revenue (this page)', fmtMoney(totals.revenue)]].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>
      <DataTable ctl={ctl} rows={list.data?.items} meta={list.data?.meta} loading={list.isFetching && !list.data}
        searchPlaceholder="Search organizations…" emptyTitle="No organizations yet"
        filters={[{ key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }] }]}
        columns={[
          { key: 'name', header: 'Organization', sortable: true, cell: (r) => (
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-4" /></span>
              <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">Since {fmtDate(r.created_at)}</p></div>
            </div>
          ) },
          { key: 'owner_name', header: 'Owner', hideOnMobile: true, cell: (r) => r.owner_name ? <div><p>{r.owner_name}</p><p className="text-xs text-muted-foreground">{r.owner_email}</p></div> : '—' },
          { key: 'farms', header: 'Farms' },
          { key: 'users', header: 'Users', hideOnMobile: true },
          { key: 'customers', header: 'Customers', hideOnMobile: true },
          { key: 'active_batches', header: 'Active batches', hideOnMobile: true },
          { key: 'revenue', header: 'Revenue', cell: (r) => <span className="tabular-nums">{fmtMoney(r.revenue)}</span> },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge value={r.status} tone={r.status === 'active' ? 'green' : 'red'} /> },
          { key: '_a', header: '', className: 'text-right', cell: (r) => r.status === 'active' ? (
            <ConfirmDialog title={`Suspend ${r.name}?`} description="All of its users are signed out and blocked from signing in until the organization is reactivated. No data is deleted." confirmLabel="Suspend"
              onConfirm={() => update.mutateAsync({ path: `/organizations/${r.id}`, body: { status: 'suspended' } })}
              trigger={<Button size="xs" variant="destructive"><Ban /> Suspend</Button>} />
          ) : (
            <Button size="xs" variant="outline" onClick={() => update.mutate({ path: `/organizations/${r.id}`, body: { status: 'active' } })}><CheckCircle2 /> Reactivate</Button>
          ) },
        ]} />
      <FormDialog open={open} onOpenChange={setOpen} title="New organization"
        description="Creates an isolated tenant with starter mushroom varieties and its owner account. The owner can then add farms and staff."
        schema={z.object({ name: z.string().min(2, 'Required'), owner_name: z.string().min(2, 'Required'), owner_email: z.string().email('Invalid email'), owner_password: z.string().min(8, 'At least 8 characters') })}
        defaults={{ name: '', owner_name: '', owner_email: '', owner_password: '' }}
        fields={[
          { name: 'name', label: 'Organization name', span: 2, placeholder: 'e.g. Rubavu Mushroom Co-op' },
          { name: 'owner_name', label: 'Owner full name' }, { name: 'owner_email', label: 'Owner email', type: 'email' },
          { name: 'owner_password', label: 'Temporary password', type: 'password', span: 2, hint: 'Share it with the owner; they can change it from their profile.' },
        ]}
        onSubmit={(v) => create.mutateAsync({ path: '/organizations', body: v })} />
    </div>
  )
}
