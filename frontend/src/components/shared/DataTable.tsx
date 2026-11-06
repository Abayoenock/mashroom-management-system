import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from './EmptyState'
import type { TableCtl } from '@/hooks/useTableState'
import type { Meta, Row } from '@/types'
import { cn } from '@/lib/utils'

export interface Column<T = Row> {
  key: string
  header: string
  cell?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
  hideOnMobile?: boolean
}

export interface FilterDef { key: string; label: string; options: { value: string; label: string }[] }

export function FilterSelect({ value, onChange, label, options, className }: { value?: string; onChange: (v: string) => void; label: string; options: { value: string; label: string }[]; className?: string }) {
  return (
    <Select value={value || 'all'} onValueChange={onChange}>
      <SelectTrigger className={cn('h-9 w-full sm:w-40', className)}><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function DataTable<T extends Row>({
  columns, rows, meta, loading, ctl, filters = [], toolbar, onRowClick, emptyTitle = 'Nothing here yet', emptyDescription, emptyAction, searchPlaceholder = 'Search…',
}: {
  columns: Column<T>[]; rows?: T[]; meta?: Meta; loading?: boolean; ctl: TableCtl; filters?: FilterDef[]; toolbar?: ReactNode
  onRowClick?: (row: T) => void; emptyTitle?: string; emptyDescription?: string; emptyAction?: ReactNode; searchPlaceholder?: string
}) {
  const { state } = ctl
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={state.q} onChange={(e) => ctl.setSearch(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8 sm:max-w-xs" />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <FilterSelect key={f.key} label={f.label} options={f.options} value={state.filters[f.key]} onChange={(v) => ctl.setFilter(f.key, v)} />
          ))}
          {toolbar}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.key} className={cn('h-10 text-xs font-medium text-muted-foreground', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                  {c.sortable ? (
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => ctl.toggleSort(c.key)}>
                      {c.header}
                      {state.sort === c.key && (state.order === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !rows?.length
              ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{columns.map((c) => <TableCell key={c.key} className={cn(c.hideOnMobile && 'hidden md:table-cell')}><Skeleton className="h-4 w-full max-w-28" /></TableCell>)}</TableRow>
              ))
              : rows?.map((r) => (
                <TableRow key={r.id} className={cn(onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(r)}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn('py-2.5', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                      {c.cell ? c.cell(r) : (r[c.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {!loading && rows?.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription ?? (state.q ? 'Try a different search term or filter.' : undefined)} action={emptyAction} />}
      </div>
      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </span>
          <div className="flex items-center gap-1">
            <Select value={String(state.limit)} onValueChange={(v) => ctl.setLimit(Number(v))}>
              <SelectTrigger size="sm" className="h-7 w-[72px]"><SelectValue /></SelectTrigger>
              <SelectContent>{[10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon-sm" disabled={meta.page <= 1} onClick={() => ctl.setPage(meta.page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="px-1 tabular-nums">{meta.page} / {meta.pages}</span>
            <Button variant="ghost" size="icon-sm" disabled={meta.page >= meta.pages} onClick={() => ctl.setPage(meta.page + 1)} aria-label="Next page"><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
