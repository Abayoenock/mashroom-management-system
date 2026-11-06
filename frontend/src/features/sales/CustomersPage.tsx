import { useState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { History } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ResourcePage } from '@/components/shared/ResourcePage'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useGet } from '@/hooks/useApi'
import { fmtDate, fmtMoney } from '@/lib/format'
import { SALES } from '@/stores/auth'
import type { Row } from '@/types'

const TYPES = ['individual', 'retailer', 'wholesaler', 'restaurant', 'distributor']
const opts = (xs: string[]) => xs.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))
const optStr = z.string().optional().nullable()

function CustomerHistory({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useGet<{ customer: Row; sales: Row[] }>(id ? `/customers/${id}/history` : null)
  const c = data?.customer
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{c?.name ?? 'Customer'}</SheetTitle>
          <SheetDescription>Purchase history</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {isLoading || !c ? <Skeleton className="h-40" /> : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Orders', c.orders], ['Total spent', fmtMoney(c.total_spent)], ['Outstanding', fmtMoney(c.outstanding)]].map(([l, v]) => (
                  <div key={l} className="rounded-lg border p-2"><p className="text-[11px] text-muted-foreground">{l}</p><p className="text-sm font-semibold">{v}</p></div>
                ))}
              </div>
              <div className="divide-y rounded-lg border">
                {data!.sales.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No orders yet.</p>}
                {data!.sales.map((s) => (
                  <Link key={s.id} to={`/app/sales/${s.id}`} className="flex items-center justify-between p-3 hover:bg-muted/50">
                    <div><p className="text-sm font-medium">{s.number}</p><p className="text-xs text-muted-foreground">{fmtDate(s.date)} · {s.items.map((i: Row) => i.variety_name).join(', ')}</p></div>
                    <div className="text-right"><p className="text-sm tabular-nums">{fmtMoney(s.total)}</p><StatusBadge value={s.status === 'confirmed' ? s.payment_status : s.status} /></div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function CustomersPage() {
  const [hist, setHist] = useState<string | null>(null)
  return (
    <>
      <ResourcePage
        path="/customers" title="Customers" singular="Customer" eyebrow="Sales"
        description="Who buys your mushrooms, what they've spent and what they owe."
        writeRoles={SALES} initial={{ sort: 'name', order: 'asc' }}
        filters={[{ key: 'type', label: 'Type', options: opts(TYPES) }, { key: 'status', label: 'Status', options: opts(['active', 'inactive']) }]}
        onRowClick={(r) => setHist(r.id)}
        rowActions={(r) => <DropdownMenuItem onClick={() => setHist(r.id)}><History /> Purchase history</DropdownMenuItem>}
        columns={[
          { key: 'name', header: 'Customer', sortable: true, cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.address}</p></div> },
          { key: 'type', header: 'Type', cell: (r) => <StatusBadge value={r.type} tone="beige" /> },
          { key: 'phone', header: 'Contact', hideOnMobile: true, cell: (r) => <div className="text-xs"><p>{r.phone}</p><p className="text-muted-foreground">{r.email}</p></div> },
          { key: 'orders', header: 'Orders', hideOnMobile: true },
          { key: 'total_spent', header: 'Total spent', cell: (r) => <span className="tabular-nums">{fmtMoney(r.total_spent)}</span> },
          { key: 'outstanding', header: 'Outstanding', hideOnMobile: true, cell: (r) => <span className={r.outstanding > 0 ? 'text-destructive tabular-nums' : 'text-muted-foreground'}>{fmtMoney(r.outstanding)}</span> },
          { key: 'status', header: 'Status', hideOnMobile: true, cell: (r) => <StatusBadge value={r.status} /> },
        ]}
        schema={z.object({ name: z.string().min(2, 'Required'), type: z.string(), phone: optStr, email: optStr, address: optStr, status: z.string(), notes: optStr })}
        defaults={(r) => ({ name: r?.name ?? '', type: r?.type ?? 'retailer', phone: r?.phone ?? '', email: r?.email ?? '', address: r?.address ?? '', status: r?.status ?? 'active', notes: r?.notes ?? '' })}
        fields={[
          { name: 'name', label: 'Customer name', span: 2 }, { name: 'type', label: 'Type', type: 'select', options: opts(TYPES) },
          { name: 'status', label: 'Status', type: 'select', options: opts(['active', 'inactive']) },
          { name: 'phone', label: 'Phone', optional: true }, { name: 'email', label: 'Email', optional: true },
          { name: 'address', label: 'Address', span: 2, optional: true }, { name: 'notes', label: 'Notes', type: 'textarea', span: 2, optional: true },
        ]}
      />
      <CustomerHistory id={hist} onClose={() => setHist(null)} />
    </>
  )
}
