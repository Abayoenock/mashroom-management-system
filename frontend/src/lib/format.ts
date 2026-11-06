export const CURRENCY = 'RWF'

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const fmtMoney = (v?: number | null) => `${CURRENCY} ${money.format(v ?? 0)}`
export const fmtCompact = (v?: number | null) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v ?? 0)
export const fmtNum = (v?: number | null, d = 1) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(v ?? 0)
export const fmtKg = (v?: number | null) => `${fmtNum(v)} kg`

export const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
export const fmtMonth = (v: string) => {
  const [y, m] = v.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
}
export const toInputDate = (v?: string | Date | null) => {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toISOString().slice(0, 10)
}
export const today = () => new Date().toISOString().slice(0, 10)
export const timeAgo = (v: string) => {
  const s = (Date.now() - new Date(v + (v.endsWith('Z') ? '' : 'Z')).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
export const titleCase = (s?: string) => (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
export const daysUntil = (v?: string) => (v ? Math.ceil((new Date(v).getTime() - Date.now()) / 86400000) : 0)
