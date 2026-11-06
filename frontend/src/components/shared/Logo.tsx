import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M6 17c0-6 4.5-10 10-10s10 4 10 10c0 1-.7 1.5-1.6 1.5H7.6C6.7 18.5 6 18 6 17z" fill="#E9DDC8" />
      <path d="M13.5 18.5h5l.9 6.5h-6.8z" fill="#72A879" />
      <path d="M22 9.5c2.5-2 5-2 6-1.5-.5 2.5-2.5 4.5-5 5" fill="none" stroke="#E8833A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className={cn('text-lg font-bold tracking-tight', light ? 'text-white' : 'text-foreground')}>
        Myco<span className={light ? 'text-beige' : 'text-primary'}>Farm</span>
      </span>
    </span>
  )
}
