import { useEffect, useState } from 'react'

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export interface TableState {
  page: number; limit: number; q: string; sort?: string; order: 'asc' | 'desc'; filters: Record<string, string>
}

export function useTableState(init: Partial<TableState> = {}) {
  const [state, setState] = useState<TableState>({ page: 1, limit: 10, q: '', order: 'desc', filters: {}, ...init })
  const q = useDebounced(state.q)
  const params = { page: state.page, limit: state.limit, q, sort: state.sort, order: state.order, ...state.filters }
  return {
    state,
    params,
    setPage: (page: number) => setState((s) => ({ ...s, page })),
    setLimit: (limit: number) => setState((s) => ({ ...s, limit, page: 1 })),
    setSearch: (q: string) => setState((s) => ({ ...s, q, page: 1 })),
    setFilter: (k: string, v: string) => setState((s) => ({ ...s, filters: { ...s.filters, [k]: v }, page: 1 })),
    toggleSort: (key: string) => setState((s) => ({ ...s, sort: key, order: s.sort === key && s.order === 'desc' ? 'asc' : 'desc' })),
  }
}
export type TableCtl = ReturnType<typeof useTableState>
