import { z } from 'zod'
import { CheckCircle2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ResourcePage } from '@/components/shared/ResourcePage'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useMutate, useOptions } from '@/hooks/useApi'
import { fmtDate, toInputDate, today } from '@/lib/format'
import { ADMINS, MANAGERS, useAuth } from '@/stores/auth'
import { ROLE_LABELS, type Role, type Row } from '@/types'

const opts = (xs: string[]) => xs.map((v) => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))
const optStr = z.string().optional().nullable()

export function EmployeesPage() {
  const farms = useOptions('/farms')
  const rooms = useOptions('/rooms')
  return (
    <ResourcePage
      path="/employees" title="Staff" singular="Employee" eyebrow="Team"
      description="Farm employees, their positions and assignments."
      writeRoles={MANAGERS} initial={{ sort: 'name', order: 'asc' }}
      filters={[{ key: 'farm_id', label: 'Farm', options: farms }, { key: 'status', label: 'Status', options: opts(['active', 'on_leave', 'terminated']) }]}
      columns={[
        { key: 'name', header: 'Name', sortable: true, cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.position}</p></div> },
        { key: 'farm_name', header: 'Farm', hideOnMobile: true },
        { key: 'room_name', header: 'Room', hideOnMobile: true, cell: (r) => r.room_name ?? '—' },
        { key: 'phone', header: 'Contact', hideOnMobile: true, cell: (r) => <div className="text-xs"><p>{r.phone}</p><p className="text-muted-foreground">{r.email}</p></div> },
        { key: 'status', header: 'Status', cell: (r) => <StatusBadge value={r.status} /> },
      ]}
      schema={z.object({ farm_id: z.string().min(1, 'Select a farm'), name: z.string().min(2, 'Required'), position: z.string().min(1, 'Required'),
        phone: optStr, email: optStr, room_id: optStr, status: z.string(), hired_on: optStr })}
      defaults={(r) => ({ farm_id: r?.farm_id ?? '', name: r?.name ?? '', position: r?.position ?? '', phone: r?.phone ?? '', email: r?.email ?? '',
        room_id: r?.room_id ?? '', status: r?.status ?? 'active', hired_on: toInputDate(r?.hired_on) })}
      toBody={(v) => ({ ...v, room_id: v.room_id || null, hired_on: v.hired_on || null })}
      fields={[
        { name: 'name', label: 'Full name' }, { name: 'position', label: 'Position' },
        { name: 'farm_id', label: 'Farm', type: 'select', options: farms },
        { name: 'room_id', label: 'Assigned room', type: 'select', options: rooms, optional: true },
        { name: 'phone', label: 'Phone', optional: true }, { name: 'email', label: 'Email', optional: true },
        { name: 'status', label: 'Status', type: 'select', options: opts(['active', 'on_leave', 'terminated']) },
        { name: 'hired_on', label: 'Hired on', type: 'date', optional: true },
      ]}
    />
  )
}

export function TasksPage() {
  const farms = useOptions('/farms')
  const emps = useOptions('/employees')
  const rooms = useOptions('/rooms')
  const done = useMutate('put', ['/tasks'])
  return (
    <ResourcePage
      path="/tasks" title="Tasks" singular="Task" eyebrow="Team"
      description="Assign and follow up daily farm work."
      writeRoles={[...MANAGERS, 'farm_worker']} deleteRoles={MANAGERS}
      initial={{ sort: 'due_date', order: 'asc' }}
      filters={[
        { key: 'status', label: 'Status', options: opts(['todo', 'in_progress', 'done']) },
        { key: 'priority', label: 'Priority', options: opts(['low', 'medium', 'high']) },
        { key: 'employee_id', label: 'Assignee', options: emps },
      ]}
      rowActions={(r) => r.status !== 'done' ? (
        <DropdownMenuItem onClick={() => done.mutate({ path: `/tasks/${r.id}`, body: { ...r, status: 'done', due_date: toInputDate(r.due_date) } })}><CheckCircle2 /> Mark done</DropdownMenuItem>
      ) : null}
      columns={[
        { key: 'title', header: 'Task', sortable: true, cell: (r) => <div><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.farm_name}{r.room_name ? ` · ${r.room_name}` : ''}</p></div> },
        { key: 'employee_name', header: 'Assignee', hideOnMobile: true, cell: (r) => r.employee_name ?? 'Unassigned' },
        { key: 'due_date', header: 'Due', sortable: true, cell: (r) => {
          const late = r.status !== 'done' && new Date(r.due_date) < new Date(today())
          return <span className={late ? 'font-medium text-destructive' : ''}>{fmtDate(r.due_date)}{late && ' · overdue'}</span>
        } },
        { key: 'priority', header: 'Priority', cell: (r) => <StatusBadge value={r.priority} tone={r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'amber' : 'gray'} /> },
        { key: 'status', header: 'Status', cell: (r) => <StatusBadge value={r.status} /> },
      ]}
      schema={z.object({ farm_id: z.string().min(1, 'Select a farm'), title: z.string().min(2, 'Required'), description: optStr, employee_id: optStr, room_id: optStr,
        due_date: z.string().min(1, 'Required'), priority: z.string(), status: z.string() })}
      defaults={(r) => ({ farm_id: r?.farm_id ?? '', title: r?.title ?? '', description: r?.description ?? '', employee_id: r?.employee_id ?? '', room_id: r?.room_id ?? '',
        due_date: toInputDate(r?.due_date) || today(), priority: r?.priority ?? 'medium', status: r?.status ?? 'todo' })}
      toBody={(v) => ({ ...v, employee_id: v.employee_id || null, room_id: v.room_id || null })}
      fields={[
        { name: 'title', label: 'Title', span: 2, placeholder: 'e.g. Inspect growing bags in Room A' },
        { name: 'farm_id', label: 'Farm', type: 'select', options: farms }, { name: 'employee_id', label: 'Assignee', type: 'select', options: emps, optional: true },
        { name: 'room_id', label: 'Room', type: 'select', options: rooms, optional: true }, { name: 'due_date', label: 'Due date', type: 'date' },
        { name: 'priority', label: 'Priority', type: 'select', options: opts(['low', 'medium', 'high']) },
        { name: 'status', label: 'Status', type: 'select', options: opts(['todo', 'in_progress', 'done']) },
        { name: 'description', label: 'Notes', type: 'textarea', span: 2, optional: true },
      ]}
    />
  )
}

export function UsersPage() {
  const farms = useAuth((s) => s.user?.farms ?? [])
  const me = useAuth((s) => s.user)
  const isSuper = me?.role === 'super_admin'
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter((r) => isSuper || r !== 'super_admin')
  const farmOptions = [
    ...(isSuper ? [] : [{ value: '__all', label: 'All my farms' }]),
    ...farms.map((f) => ({ value: f.id, label: isSuper && f.org_name ? `${f.name} · ${f.org_name}` : f.name })),
  ]
  return (
    <ResourcePage
      path="/users" title="Users & Access" singular="User" eyebrow="Team"
      description={isSuper ? 'All platform users. Assigning a farm also places the user in that farm\u2019s organization.' : 'People in your organization, their roles and which farms they can access. New users get the password you set (default: password123).'}
      writeRoles={ADMINS} initial={{ sort: 'name', order: 'asc' }}
      filters={[{ key: 'role', label: 'Role', options: roles.map((r) => ({ value: r, label: ROLE_LABELS[r] })) }]}
      columns={[
        { key: 'name', header: 'User', sortable: true, cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></div> },
        { key: 'role', header: 'Role', cell: (r) => <StatusBadge value={r.role} tone="forest" label={ROLE_LABELS[r.role as Role]} /> },
        ...(isSuper ? [{ key: 'org_name', header: 'Organization', cell: (r: Row) => r.org_name ?? <span className="text-muted-foreground">Platform</span> }] : []),
        { key: 'farm_names', header: 'Farms', hideOnMobile: true, cell: (r) => r.role === 'super_admin' ? 'All farms' : (r.farm_names?.join(', ') || '—') },
        { key: 'last_login', header: 'Last login', hideOnMobile: true, cell: (r) => fmtDate(r.last_login) },
        { key: 'active', header: 'Status', cell: (r) => <StatusBadge value={r.active ? 'active' : 'inactive'} /> },
      ]}
      schema={z.object({ name: z.string().min(2, 'Required'), email: z.string().email('Invalid email'), role: z.string().min(1, 'Required'),
        farm_id: z.string().optional(), active: z.boolean(), password: z.union([z.literal(''), z.string().min(8, 'At least 8 characters')]).optional() })}
      defaults={(r) => ({ name: r?.name ?? '', email: r?.email ?? '', role: r?.role ?? 'farm_worker', farm_id: (r?.farm_ids?.length ?? 0) > 1 && !isSuper ? '__all' : (r?.farm_ids?.[0] ?? farms[0]?.id ?? ''), active: r?.active ?? true, password: '' })}
      toBody={(v) => ({ name: v.name, email: v.email, role: v.role, active: v.active, farm_ids: v.farm_id === '__all' ? farms.map((f) => f.id) : v.farm_id ? [v.farm_id] : [], password: v.password || undefined })}
      fields={(r) => [
        { name: 'name', label: 'Full name' }, { name: 'email', label: 'Email', type: 'email' },
        { name: 'role', label: 'Role', type: 'select', options: roles.map((x) => ({ value: x, label: ROLE_LABELS[x] })) },
        { name: 'farm_id', label: 'Farm access', type: 'select', options: farmOptions, hint: isSuper ? 'Not needed for super admins' : undefined },
        { name: 'password', label: r ? 'New password' : 'Password', type: 'password', optional: true, hint: r ? 'Leave blank to keep current' : 'Defaults to password123' },
        { name: 'active', label: 'Account active', type: 'switch' },
      ]}
    />
  )
}
