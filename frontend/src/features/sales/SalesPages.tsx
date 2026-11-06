/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Ban, CreditCard, Loader2, Plus, Printer, RotateCcw, Trash2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/shared/DataTable'
import { Field, FormDialog, applyServerErrors } from '@/components/shared/FormDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LogoMark } from '@/components/shared/Logo'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useGet, useList, useMutate, useOptions } from '@/hooks/useApi'
import { useTableState } from '@/hooks/useTableState'
import { fmtDate, fmtDateTime, fmtKg, fmtMoney, titleCase, today } from '@/lib/format'
import { SALES, can, useAuth, useRole } from '@/stores/auth'
import type { Row } from '@/types'

const METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'credit']
const opts = (xs: string[]) => xs.map((v) => ({ value: v, label: titleCase(v) }))

export function SalesPage() {
  const role = useRole()
  const ctl = useTableState({ sort: 'date', order: 'desc' })
  const list = useList('/sales', ctl.params)
  const navigate = useNavigate()
  return (
    <div>
      <PageHeader eyebrow="Sales" title="Sales Orders" description="Orders, payments and deliveries. Stock is deducted automatically when an order is created."
        actions={can(role, ...SALES, 'farm_manager') && <Button asChild><Link to="/app/sales/new"><Plus /> New order</Link></Button>} />
      <DataTable ctl={ctl} rows={list.data?.items} meta={list.data?.meta} loading={list.isFetching && !list.data}
        onRowClick={(r) => navigate(`/app/sales/${r.id}`)} searchPlaceholder="Search order number or customer…"
        filters={[
          { key: 'payment_status', label: 'Payment', options: opts(['paid', 'partial', 'unpaid']) },
          { key: 'delivery_status', label: 'Delivery', options: opts(['pending', 'dispatched', 'delivered']) },
          { key: 'status', label: 'Order status', options: opts(['confirmed', 'cancelled', 'returned']) },
        ]}
        columns={[
          { key: 'number', header: 'Order', sortable: true, cell: (r) => <div><p className="font-medium">{r.number}</p><p className="text-xs text-muted-foreground">{r.customer_name}</p></div> },
          { key: 'date', header: 'Date', sortable: true, cell: (r) => fmtDate(r.date) },
          { key: 'items', header: 'Products', hideOnMobile: true, cell: (r) => <span className="text-xs">{r.items.map((i: Row) => `${i.variety_name} ${i.quantity_kg}kg`).join(', ')}</span> },
          { key: 'total', header: 'Total', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{fmtMoney(r.total)}</span> },
          { key: 'balance', header: 'Balance', sortable: true, hideOnMobile: true, cell: (r) => <span className={r.balance > 0 ? 'text-destructive tabular-nums' : 'text-muted-foreground tabular-nums'}>{fmtMoney(r.balance)}</span> },
          { key: 'payment_status', header: 'Payment', cell: (r) => r.status === 'confirmed' ? <StatusBadge value={r.payment_status} /> : <StatusBadge value={r.status} /> },
          { key: 'delivery_status', header: 'Delivery', hideOnMobile: true, cell: (r) => <StatusBadge value={r.delivery_status} /> },
        ]} />
    </div>
  )
}

const lineSchema = z.object({ variety_id: z.string().min(1, 'Select'), grade: z.string().optional(), quantity_kg: z.coerce.number().positive('> 0'), unit_price: z.coerce.number().min(0) })
const orderSchema = z.object({
  customer_id: z.string().min(1, 'Select a customer'), farm_id: z.string().min(1, 'Select a farm'), date: z.string().min(1),
  items: z.array(lineSchema).min(1), discount: z.coerce.number().min(0), payment_method: z.string(), amount_paid: z.coerce.number().min(0), notes: z.string().optional(),
})

export function NewSalePage() {
  const user = useAuth((s) => s.user)
  const farmId = useAuth((s) => s.farmId)
  const customers = useOptions('/customers', { status: 'active' })
  const varieties = useOptions('/varieties')
  const stock = useGet<Row[]>('/inventory/stock/summary')
  const create = useMutate('post', ['/sales', '/inventory', '/customers'])
  const navigate = useNavigate()
  const form = useForm<any>({
    resolver: zodResolver(orderSchema as any) as any,
    defaultValues: { customer_id: '', farm_id: farmId !== 'all' ? farmId : (user?.farms[0]?.id ?? ''), date: today(), items: [{ variety_id: '', grade: '', quantity_kg: '', unit_price: '' }],
      discount: 0, payment_method: 'mobile_money', amount_paid: 0, notes: '' },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const items = useWatch({ control: form.control, name: 'items' }) as Row[]
  const discount = Number(useWatch({ control: form.control, name: 'discount' }) || 0)
  const subtotal = useMemo(() => (items ?? []).reduce((a, i) => a + Number(i.quantity_kg || 0) * Number(i.unit_price || 0), 0), [items])
  const total = Math.max(0, subtotal - discount)
  // default each line's unit price to the variety's list price when the variety is chosen
  const varietyKey = (items ?? []).map((i) => i.variety_id).join('|')
  useEffect(() => {
    (items ?? []).forEach((i, idx) => {
      const price = varieties.find((v) => v.value === i.variety_id)?.row.price_per_kg
      if (i.variety_id && price !== undefined && (i.unit_price === '' || i.unit_price === undefined)) form.setValue(`items.${idx}.unit_price`, price)
    })
  }, [varietyKey, varieties.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const avail = Object.fromEntries((stock.data ?? []).map((s) => [s.id, s.available_kg]))

  const submit = form.handleSubmit(async (v) => {
    try {
      const body = { ...v, items: v.items.map((i: Row) => ({ ...i, grade: i.grade || null })) }
      const r = await create.mutateAsync({ path: '/sales', body })
      navigate(`/app/sales/${r.data.id}`)
    } catch (e) { applyServerErrors(form, e) }
  })

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/app/sales" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Sales orders</Link>
      <PageHeader eyebrow="Sales" title="New sales order" description="Quantities are taken from the oldest unexpired stock first (FIFO)." />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Card><CardContent className="grid gap-3 sm:grid-cols-3">
          <Field form={form} def={{ name: 'customer_id', label: 'Customer', type: 'select', options: customers }} />
          <Field form={form} def={{ name: 'farm_id', label: 'Selling farm', type: 'select', options: (user?.farms ?? []).map((f) => ({ value: f.id, label: f.name })) }} />
          <Field form={form} def={{ name: 'date', label: 'Sale date', type: 'date' }} />
        </CardContent></Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Products</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {fields.map((f, idx) => {
              const vid = items?.[idx]?.variety_id
              return (
                <div key={f.id} className="grid items-start gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                  <div>
                    <Field form={form} def={{ name: `items.${idx}.variety_id`, label: 'Variety', type: 'select', options: varieties }} />
                    {vid && <p className="mt-1 text-xs text-muted-foreground">Available: <span className="font-medium text-foreground">{fmtKg(avail[vid] ?? 0)}</span> (all selected farms)</p>}
                  </div>
                  <Field form={form} def={{ name: `items.${idx}.grade`, label: 'Grade', type: 'select', optional: true, options: ['A', 'B', 'C'].map((g) => ({ value: g, label: `Grade ${g}` })), placeholder: 'Any' }} />
                  <QtyField form={form} idx={idx} />
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium" htmlFor={`price-${idx}`}>Unit price</label>
                    <input id={`price-${idx}`} type="number" step="any" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30" {...form.register(`items.${idx}.unit_price`)} />
                    <p className="text-xs text-muted-foreground tabular-nums">{fmtMoney(Number(items?.[idx]?.quantity_kg || 0) * Number(items?.[idx]?.unit_price || 0))}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="mt-5" disabled={fields.length === 1} onClick={() => remove(idx)} aria-label="Remove line"><Trash2 /></Button>
                </div>
              )
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ variety_id: '', grade: '', quantity_kg: '', unit_price: '' })}><Plus /> Add product</Button>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardContent className="grid gap-3 sm:grid-cols-2">
            <Field form={form} def={{ name: 'payment_method', label: 'Payment method', type: 'select', options: opts(METHODS) }} />
            <Field form={form} def={{ name: 'amount_paid', label: 'Amount paid now', type: 'number', hint: 'Leave 0 for credit' }} />
            <Field form={form} def={{ name: 'discount', label: 'Discount (RWF)', type: 'number' }} />
            <Field form={form} def={{ name: 'notes', label: 'Notes', optional: true }} />
          </CardContent></Card>
          <Card><CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmtMoney(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">− {fmtMoney(Math.min(discount, subtotal))}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{fmtMoney(total)}</span></div>
            <Button type="submit" className="mt-3 h-10 w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Create order</Button>
          </CardContent></Card>
        </div>
      </form>
    </div>
  )
}

function QtyField({ form, idx }: { form: any; idx: number }) {
  return <Field form={form} def={{ name: `items.${idx}.quantity_kg`, label: 'Quantity (kg)', type: 'number' }} />
}

export function SaleDetailPage() {
  const { id } = useParams()
  const role = useRole()
  const { data: s, isLoading } = useGet<Row>(`/sales/${id}`)
  const status = useMutate('patch', ['/sales', '/inventory'])
  const [pay, setPay] = useState(false)
  const payMut = useMutate('post', ['/sales', '/customers'])
  if (isLoading || !s) return <Skeleton className="h-96" />
  const canSell = can(role, ...SALES, 'farm_manager')
  const active = s.status === 'confirmed'
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link to="/app/sales" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Sales orders</Link>
        <div className="flex flex-wrap gap-2">
          {canSell && active && s.balance > 0 && can(role, ...SALES) && <Button onClick={() => setPay(true)}><CreditCard /> Record payment</Button>}
          {canSell && active && s.delivery_status !== 'delivered' && (
            <Button variant="outline" onClick={() => status.mutate({ path: `/sales/${s.id}/status`, body: { delivery_status: s.delivery_status === 'pending' ? 'dispatched' : 'delivered' } })}>
              <Truck /> Mark {s.delivery_status === 'pending' ? 'dispatched' : 'delivered'}
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}><Printer /> {s.balance > 0 ? 'Print invoice' : 'Print receipt'}</Button>
          {canSell && active && (
            <>
              <ConfirmDialog title="Record a return?" description="Returned stock goes back into inventory and the balance is cleared." confirmLabel="Record return"
                onConfirm={() => status.mutateAsync({ path: `/sales/${s.id}/status`, body: { status: 'returned' } })}
                trigger={<Button variant="outline"><RotateCcw /> Return</Button>} />
              <ConfirmDialog title="Cancel this order?" description="Allocated stock is released back to inventory." confirmLabel="Cancel order"
                onConfirm={() => status.mutateAsync({ path: `/sales/${s.id}/status`, body: { status: 'cancelled' } })}
                trigger={<Button variant="destructive"><Ban /> Cancel</Button>} />
            </>
          )}
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none print:ring-0">
        <CardContent className="space-y-8 p-6 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-3"><LogoMark className="size-10" /><div><p className="text-lg font-bold">{s.farm?.name}</p><p className="text-xs text-muted-foreground">{s.farm?.location}<br />{s.farm?.contact_phone} · {s.farm?.contact_email}</p></div></div>
            <div className="text-right">
              <p className="eyebrow text-[10px] text-muted-foreground">{s.balance > 0 ? 'Invoice' : 'Receipt'}</p>
              <p className="text-2xl font-semibold">{s.number}</p>
              <p className="text-sm text-muted-foreground">{fmtDate(s.date)}</p>
              <div className="mt-2 flex justify-end gap-1">{active ? <StatusBadge value={s.payment_status} /> : <StatusBadge value={s.status} />}<StatusBadge value={s.delivery_status} /></div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="eyebrow text-[10px] text-muted-foreground">Bill to</p><p className="mt-1 font-medium">{s.customer?.name}</p><p className="text-sm text-muted-foreground">{s.customer?.address}<br />{s.customer?.phone} · {s.customer?.email}</p></div>
            <div className="sm:text-right"><p className="eyebrow text-[10px] text-muted-foreground">Sales person</p><p className="mt-1 text-sm">{s.sales_person}</p><p className="text-sm text-muted-foreground">Payment: {titleCase(s.payment_method)}</p></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">Product</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Unit price</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
            <tbody>{s.items.map((i: Row, k: number) => (
              <tr key={k} className="border-b"><td className="py-2.5">Fresh {i.variety_name} mushrooms{i.grade ? ` · Grade ${i.grade}` : ''}</td><td className="py-2.5 text-right tabular-nums">{fmtKg(i.quantity_kg)}</td><td className="py-2.5 text-right tabular-nums">{fmtMoney(i.unit_price)}</td><td className="py-2.5 text-right tabular-nums">{fmtMoney(i.line_total)}</td></tr>
            ))}</tbody>
          </table>
          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmtMoney(s.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">− {fmtMoney(s.discount)}</span></div>
            <div className="flex justify-between border-t pt-1.5 font-semibold"><span>Total</span><span className="tabular-nums">{fmtMoney(s.total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="tabular-nums">{fmtMoney(s.paid)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Balance due</span><span className={`tabular-nums ${s.balance > 0 ? 'text-destructive' : ''}`}>{fmtMoney(s.balance)}</span></div>
          </div>
          {s.payments?.length > 0 && (
            <div><p className="eyebrow mb-2 text-[10px] text-muted-foreground">Payments</p>
              {s.payments.map((p: Row, k: number) => <p key={k} className="flex justify-between border-b py-1.5 text-sm last:border-0"><span>{fmtDateTime(p.at)} · {titleCase(p.method)}</span><span className="tabular-nums">{fmtMoney(p.amount)}</span></p>)}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">Thank you for your business.</p>
        </CardContent>
      </Card>
      <FormDialog open={pay} onOpenChange={setPay} title="Record payment" description={`Outstanding balance: ${fmtMoney(s.balance)}`}
        schema={z.object({ amount: z.coerce.number().positive().max(s.balance, `Max ${fmtMoney(s.balance)}`), method: z.string(), notes: z.string().optional() })}
        defaults={{ amount: s.balance, method: 'mobile_money', notes: '' }}
        fields={[{ name: 'amount', label: 'Amount (RWF)', type: 'number' }, { name: 'method', label: 'Method', type: 'select', options: opts(['cash', 'mobile_money', 'bank_transfer', 'card']) }, { name: 'notes', label: 'Notes', span: 2, optional: true }]}
        onSubmit={(v) => payMut.mutateAsync({ path: `/sales/${s.id}/payments`, body: v })} />
    </div>
  )
}
