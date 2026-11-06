/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from 'react'
import type { z } from 'zod'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DataTable, type Column, type FilterDef } from './DataTable'
import { FormDialog, type FieldDef } from './FormDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { PageHeader } from './PageHeader'
import { useList, useMutate } from '@/hooks/useApi'
import { useTableState, type TableState } from '@/hooks/useTableState'
import { can, useRole } from '@/stores/auth'
import type { Role, Row } from '@/types'

export interface ResourceConfig {
  path: string
  title: string
  singular: string
  description?: string
  eyebrow?: string
  columns: Column[]
  filters?: FilterDef[]
  fields: FieldDef[] | ((row?: Row) => FieldDef[])
  schema: z.ZodType<any, any>
  defaults: (row?: Row) => Record<string, any>
  toBody?: (values: any) => any
  writeRoles: Role[]
  deleteRoles?: Role[]
  initial?: Partial<TableState>
  onRowClick?: (row: Row) => void
  rowActions?: (row: Row) => ReactNode
  headerExtra?: ReactNode
  above?: ReactNode
  wide?: boolean
  embedded?: boolean
}

export function ResourcePage(cfg: ResourceConfig) {
  const role = useRole()
  const ctl = useTableState({ sort: undefined, ...cfg.initial })
  const list = useList(cfg.path, ctl.params)
  const create = useMutate('post', [cfg.path])
  const update = useMutate('put', [cfg.path])
  const remove = useMutate('delete', [cfg.path])
  const [editing, setEditing] = useState<Row | undefined>()
  const [open, setOpen] = useState(false)

  const canWrite = can(role, ...cfg.writeRoles)
  const canDelete = can(role, ...(cfg.deleteRoles ?? cfg.writeRoles))
  const fields = typeof cfg.fields === 'function' ? cfg.fields(editing) : cfg.fields

  const columns: Column[] = [
    ...cfg.columns,
    ...(canWrite || cfg.rowActions ? [{
      key: '_actions', header: '', className: 'w-10 text-right',
      cell: (r: Row) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Row actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {cfg.rowActions?.(r)}
              {canWrite && <DropdownMenuItem onClick={() => { setEditing(r); setOpen(true) }}><Pencil /> Edit</DropdownMenuItem>}
              {canDelete && (
                <ConfirmDialog
                  title={`Delete ${cfg.singular.toLowerCase()}?`}
                  description="This removes it from active lists. The record is kept in the audit trail."
                  onConfirm={() => remove.mutateAsync({ path: `${cfg.path}/${r.id}` })}
                  trigger={<DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}><Trash2 /> Delete</DropdownMenuItem>}
                />
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }] : []),
  ]

  return (
    <div>
      {cfg.embedded ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{cfg.description}</p>
          <div className="flex gap-2">{cfg.headerExtra}{canWrite && <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> New {cfg.singular.toLowerCase()}</Button>}</div>
        </div>
      ) : <PageHeader
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        description={cfg.description}
        actions={<>
          {cfg.headerExtra}
          {canWrite && <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> New {cfg.singular.toLowerCase()}</Button>}
        </>}
      />}
      {cfg.above}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        meta={list.data?.meta}
        loading={list.isFetching && !list.data}
        ctl={ctl}
        filters={cfg.filters}
        onRowClick={cfg.onRowClick}
        emptyTitle={`No ${cfg.title.toLowerCase()} yet`}
        emptyAction={canWrite ? <Button size="sm" onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> Add {cfg.singular.toLowerCase()}</Button> : undefined}
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        wide={cfg.wide}
        title={editing ? `Edit ${cfg.singular.toLowerCase()}` : `New ${cfg.singular.toLowerCase()}`}
        schema={cfg.schema}
        defaults={cfg.defaults(editing)}
        fields={fields}
        onSubmit={(values) => {
          const body = cfg.toBody ? cfg.toBody(values) : values
          return editing ? update.mutateAsync({ path: `${cfg.path}/${editing.id}`, body }) : create.mutateAsync({ path: cfg.path, body })
        }}
      />
    </div>
  )
}
