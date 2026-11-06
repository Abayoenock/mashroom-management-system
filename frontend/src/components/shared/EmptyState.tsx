import type { ReactNode } from 'react'

export function MushroomArt({ className = 'h-24 w-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <ellipse cx="60" cy="104" rx="40" ry="6" className="fill-muted" />
      <path d="M50 70h20l4 32H46z" className="fill-beige" />
      <path d="M14 66c0-26 20-44 46-44s46 18 46 44c0 4-3 6-7 6H21c-4 0-7-2-7-6z" className="fill-primary" />
      <circle cx="42" cy="46" r="6" className="fill-beige/80" />
      <circle cx="70" cy="38" r="4" className="fill-beige/80" />
      <circle cx="84" cy="54" r="5" className="fill-beige/80" />
      <path d="M86 92c0-9 6-15 13-15s13 6 13 15c0 2-1 3-3 3H89c-2 0-3-1-3-3z" className="fill-fresh" />
      <path d="M96 95h6l1 9h-8z" className="fill-beige" />
    </svg>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <MushroomArt />
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
