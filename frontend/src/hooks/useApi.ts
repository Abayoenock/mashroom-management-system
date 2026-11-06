import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { ApiResponse, Meta, Row } from '@/types'

export type Params = Record<string, string | number | boolean | undefined | null>

const clean = (p: Params = {}) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all'))

/** Paginated list from a resource endpoint. */
export function useList<T = Row>(path: string, params: Params = {}, enabled = true) {
  const farmId = useAuth((s) => s.farmId)
  return useQuery({
    queryKey: [path, clean(params), farmId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<T[]>>(path, { params: clean(params) })
      return { items: data.data, meta: data.meta as Meta }
    },
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Single object (or any GET payload). */
export function useGet<T = Row>(path: string | null, params: Params = {}) {
  const farmId = useAuth((s) => s.farmId)
  return useQuery({
    queryKey: [path, clean(params), farmId],
    queryFn: async () => (await api.get<ApiResponse<T>>(path!, { params: clean(params) })).data.data,
    enabled: !!path,
  })
}

/** Options for selects: all rows of a resource (up to 500). */
export function useOptions(path: string, params: Params = {}, label = 'name') {
  const q = useList(path, { limit: 500, sort: label, order: 'asc', ...params })
  return (q.data?.items ?? []).map((r) => ({ value: r.id, label: String(r[label]), row: r }))
}

type Method = 'post' | 'put' | 'patch' | 'delete'

export function useMutate<TBody = unknown, TRes = Row>(method: Method, invalidate: string[] = [], opts: { silent?: boolean } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: TBody }) => {
      const { data } = await api.request<ApiResponse<TRes>>({ url: path, method, data: body })
      return data
    },
    onSuccess: (data) => {
      // invalidate by prefix so lists, details and dashboard refresh
      qc.invalidateQueries({ predicate: (q) => invalidate.some((p) => String(q.queryKey[0]).startsWith(p)) || String(q.queryKey[0]).startsWith('/dashboard') || String(q.queryKey[0]).startsWith('/notifications') })
      if (!opts.silent && data.message) toast.success(data.message)
    },
    onError: (e) => { if (!opts.silent) toast.error(errorMessage(e)) },
  })
}
