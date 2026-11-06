import { z } from 'zod'
import { Droplets, Thermometer } from 'lucide-react'
import { ResourcePage } from '@/components/shared/ResourcePage'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useOptions } from '@/hooks/useApi'
import { fmtMoney, fmtNum } from '@/lib/format'
import { ADMINS, MANAGERS } from '@/stores/auth'

const opts = (xs: string[]) => xs.map((v) => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))
const num = (msg = 'Required') => z.coerce.number({ message: msg })
const optStr = z.string().optional().nullable()

export function FarmsPage() {
  return (
    <ResourcePage
      path="/farms" title="Farms" singular="Farm" eyebrow="Farm management"
      description="Production sites and their key details."
      writeRoles={ADMINS}
      initial={{ sort: 'name', order: 'asc' }}
      filters={[{ key: 'status', label: 'Status', options: opts(['active', 'inactive', 'maintenance']) }]}
      columns={[
        { key: 'name', header: 'Farm', sortable: true, cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.code}</p></div> },
        { key: 'location', header: 'Location', hideOnMobile: true },
        { key: 'size_sqm', header: 'Size', sortable: true, hideOnMobile: true, cell: (r) => `${fmtNum(r.size_sqm, 0)} m²` },
        { key: 'rooms_count', header: 'Rooms', cell: (r) => r.rooms_count },
        { key: 'active_batches', header: 'Active batches', cell: (r) => r.active_batches },
        { key: 'manager', header: 'Manager', hideOnMobile: true },
        { key: 'status', header: 'Status', cell: (r) => <StatusBadge value={r.status} /> },
      ]}
      schema={z.object({
        name: z.string().min(2, 'Required'), code: z.string().min(2, 'Required').max(20), location: z.string().min(1, 'Required'),
        description: optStr, size_sqm: num().min(0), manager: optStr, contact_phone: optStr,
        contact_email: z.union([z.literal(''), z.string().email('Invalid email')]).optional(), status: z.string(),
      })}
      defaults={(r) => ({ name: r?.name ?? '', code: r?.code ?? '', location: r?.location ?? '', description: r?.description ?? '', size_sqm: r?.size_sqm ?? 0,
        manager: r?.manager ?? '', contact_phone: r?.contact_phone ?? '', contact_email: r?.contact_email ?? '', status: r?.status ?? 'active' })}
      fields={[
        { name: 'name', label: 'Farm name' }, { name: 'code', label: 'Farm code', placeholder: 'e.g. MHF01' },
        { name: 'location', label: 'Location', span: 2 }, { name: 'size_sqm', label: 'Size (m²)', type: 'number' },
        { name: 'status', label: 'Status', type: 'select', options: opts(['active', 'inactive', 'maintenance']) },
        { name: 'manager', label: 'Manager', optional: true }, { name: 'contact_phone', label: 'Phone', optional: true },
        { name: 'contact_email', label: 'Email', type: 'email', optional: true, span: 2 },
        { name: 'description', label: 'Description', type: 'textarea', span: 2, optional: true },
      ]}
    />
  )
}

export function RoomsPage() {
  const farms = useOptions('/farms')
  const varieties = useOptions('/varieties')
  return (
    <ResourcePage
      path="/rooms" title="Cultivation Rooms" singular="Room" eyebrow="Farm management"
      description="Grow rooms with current conditions and occupancy."
      writeRoles={MANAGERS}
      initial={{ sort: 'code', order: 'asc' }}
      filters={[{ key: 'farm_id', label: 'Farm', options: farms }, { key: 'status', label: 'Status', options: opts(['active', 'idle', 'cleaning', 'maintenance']) }]}
      columns={[
        { key: 'code', header: 'Room', sortable: true, cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.code} · {r.farm_name}</p></div> },
        { key: 'variety_name', header: 'Variety', hideOnMobile: true },
        { key: 'env', header: 'Conditions', cell: (r) => <span className="inline-flex gap-3 text-xs tabular-nums"><span className="inline-flex items-center gap-1"><Thermometer className="size-3.5 text-cta" />{r.temperature}°C</span><span className="inline-flex items-center gap-1"><Droplets className="size-3.5 text-sky-600" />{r.humidity}%</span></span> },
        { key: 'occupancy', header: 'Occupancy', hideOnMobile: true, cell: (r) => {
          const pct = r.capacity_bags ? Math.min(100, (100 * r.bags_in_use) / r.capacity_bags) : 0
          return <div className="w-28"><div className="flex justify-between text-xs"><span>{r.bags_in_use}/{r.capacity_bags}</span><span className="text-muted-foreground">{fmtNum(pct, 0)}%</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div></div>
        } },
        { key: 'active_batches', header: 'Batches' },
        { key: 'ventilation', header: 'Ventilation', hideOnMobile: true, cell: (r) => <StatusBadge value={r.ventilation} tone={r.ventilation === 'off' ? 'gray' : 'blue'} /> },
        { key: 'status', header: 'Status', cell: (r) => <StatusBadge value={r.status} /> },
      ]}
      schema={z.object({
        farm_id: z.string().min(1, 'Select a farm'), name: z.string().min(1, 'Required'), code: z.string().min(1, 'Required'),
        capacity_bags: num().int().min(0), variety_id: optStr, temperature: num(), humidity: num().min(0).max(100),
        ventilation: z.string(), status: z.string(),
      })}
      defaults={(r) => ({ farm_id: r?.farm_id ?? '', name: r?.name ?? '', code: r?.code ?? '', capacity_bags: r?.capacity_bags ?? 500, variety_id: r?.variety_id ?? '',
        temperature: r?.temperature ?? 20, humidity: r?.humidity ?? 85, ventilation: r?.ventilation ?? 'auto', status: r?.status ?? 'active' })}
      toBody={(v) => ({ ...v, variety_id: v.variety_id || null })}
      fields={[
        { name: 'farm_id', label: 'Farm', type: 'select', options: farms, span: 2 },
        { name: 'name', label: 'Room name' }, { name: 'code', label: 'Room code' },
        { name: 'capacity_bags', label: 'Capacity (bags)', type: 'number' },
        { name: 'variety_id', label: 'Main variety', type: 'select', options: varieties, optional: true },
        { name: 'temperature', label: 'Temperature (°C)', type: 'number' }, { name: 'humidity', label: 'Humidity (%)', type: 'number' },
        { name: 'ventilation', label: 'Ventilation', type: 'select', options: opts(['auto', 'on', 'off']) },
        { name: 'status', label: 'Status', type: 'select', options: opts(['active', 'idle', 'cleaning', 'maintenance']) },
      ]}
    />
  )
}

export function VarietiesPage() {
  return (
    <ResourcePage
      path="/varieties" title="Mushroom Varieties" singular="Variety" eyebrow="Production"
      description="Growing parameters used to forecast harvest dates, yields and environmental alerts."
      writeRoles={ADMINS} wide
      initial={{ sort: 'name', order: 'asc' }}
      columns={[
        { key: 'name', header: 'Variety', sortable: true, cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground italic">{r.scientific_name}</p></div> },
        { key: 'cycle', header: 'Cycle', cell: (r) => <span className="text-xs">{r.incubation_days}d incubation · {r.fruiting_days}d fruiting</span> },
        { key: 'expected_yield_kg_per_bag', header: 'Yield / bag', sortable: true, cell: (r) => `${r.expected_yield_kg_per_bag} kg` },
        { key: 'conditions', header: 'Conditions', hideOnMobile: true, cell: (r) => <span className="text-xs">{r.temp_min}–{r.temp_max}°C · {r.humidity_min}–{r.humidity_max}% RH</span> },
        { key: 'price_per_kg', header: 'Price / kg', sortable: true, cell: (r) => fmtMoney(r.price_per_kg) },
      ]}
      schema={z.object({
        name: z.string().min(1, 'Required'), scientific_name: z.string().min(1, 'Required'), description: optStr,
        incubation_days: num().int().min(1), fruiting_days: num().int().min(1), expected_yield_kg_per_bag: num().positive(),
        temp_min: num(), temp_max: num(), humidity_min: num().min(0).max(100), humidity_max: num().min(0).max(100), price_per_kg: num().min(0),
      }).refine((v) => v.temp_max >= v.temp_min, { message: 'Must be ≥ min', path: ['temp_max'] })
        .refine((v) => v.humidity_max >= v.humidity_min, { message: 'Must be ≥ min', path: ['humidity_max'] })}
      defaults={(r) => ({ name: r?.name ?? '', scientific_name: r?.scientific_name ?? '', description: r?.description ?? '',
        incubation_days: r?.incubation_days ?? 21, fruiting_days: r?.fruiting_days ?? 10, expected_yield_kg_per_bag: r?.expected_yield_kg_per_bag ?? 0.8,
        temp_min: r?.temp_min ?? 18, temp_max: r?.temp_max ?? 24, humidity_min: r?.humidity_min ?? 80, humidity_max: r?.humidity_max ?? 90, price_per_kg: r?.price_per_kg ?? 3000 })}
      fields={[
        { name: 'name', label: 'Name' }, { name: 'scientific_name', label: 'Scientific name' },
        { name: 'incubation_days', label: 'Incubation (days)', type: 'number' }, { name: 'fruiting_days', label: 'Fruiting (days)', type: 'number' },
        { name: 'expected_yield_kg_per_bag', label: 'Expected yield (kg/bag)', type: 'number' }, { name: 'price_per_kg', label: 'Price per kg (RWF)', type: 'number' },
        { name: 'temp_min', label: 'Min temp (°C)', type: 'number' }, { name: 'temp_max', label: 'Max temp (°C)', type: 'number' },
        { name: 'humidity_min', label: 'Min humidity (%)', type: 'number' }, { name: 'humidity_max', label: 'Max humidity (%)', type: 'number' },
        { name: 'description', label: 'Description', type: 'textarea', span: 2, optional: true },
      ]}
    />
  )
}
