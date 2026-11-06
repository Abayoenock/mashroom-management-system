import { useNavigate } from 'react-router'
import { CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { useList, useMutate } from '@/hooks/useApi'
import { fmtDateTime, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { NotifIcon } from './NotifIcon'

export function NotificationsPage() {
  const [tab, setTab] = useState('all')
  const q = useList('/notifications', { limit: 100, unread: tab === 'unread' ? 'true' : undefined })
  const read = useMutate('patch', ['/notifications'], { silent: true })
  const readAll = useMutate('post', ['/notifications'])
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Overview" title="Notifications" description="Alerts about production, harvests, stock, sales and tasks."
        actions={<Button variant="outline" onClick={() => readAll.mutate({ path: '/notifications/read-all' })}><CheckCheck /> Mark all read</Button>} />
      <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="unread">Unread ({q.data?.meta?.unread ?? 0})</TabsTrigger></TabsList></Tabs>
      <div className="divide-y rounded-xl border bg-card">
        {q.isLoading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="p-4"><Skeleton className="h-10" /></div>)}
        {q.data?.items.length === 0 && <EmptyState title="You're all caught up" description="New alerts will appear here." />}
        {q.data?.items.map((n) => (
          <button key={n.id} className={cn('flex w-full gap-3 p-4 text-left hover:bg-muted/50', !n.read && 'bg-accent/30')}
            onClick={() => { if (!n.read) read.mutate({ path: `/notifications/${n.id}/read` }); if (n.link) navigate(n.link) }}>
            <NotifIcon type={n.type} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><p className="font-medium">{n.title}</p><span className="shrink-0 text-xs text-muted-foreground" title={fmtDateTime(n.created_at)}>{timeAgo(n.created_at)}</span></div>
              <p className="text-sm text-muted-foreground">{n.message}</p>
            </div>
            {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-cta" />}
          </button>
        ))}
      </div>
    </div>
  )
}
