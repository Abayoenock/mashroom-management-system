import { Bell, CheckCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useList, useMutate } from '@/hooks/useApi'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { NotifIcon } from '@/features/notifications/NotifIcon'

export function NotificationBell() {
  const q = useList('/notifications', { limit: 8 })
  const read = useMutate('patch', ['/notifications'], { silent: true })
  const readAll = useMutate('post', ['/notifications'])
  const navigate = useNavigate()
  const unread = q.data?.meta?.unread ?? 0
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-cta px-1 text-[10px] font-semibold text-white">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="xs" onClick={() => readAll.mutate({ path: '/notifications/read-all' })}><CheckCheck /> Mark all read</Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {q.data?.items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p>}
          {q.data?.items.map((n) => (
            <button key={n.id} className={cn('flex w-full gap-3 border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted/60', !n.read && 'bg-accent/40')}
              onClick={() => { if (!n.read) read.mutate({ path: `/notifications/${n.id}/read` }); if (n.link) navigate(n.link) }}>
              <NotifIcon type={n.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{n.title}</p>
                <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cta" />}
            </button>
          ))}
        </div>
        <Link to="/app/notifications" className="block border-t px-3 py-2 text-center text-xs font-medium text-primary hover:underline">View all</Link>
      </PopoverContent>
    </Popover>
  )
}
