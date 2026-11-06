import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/theme'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useThemeStore()
  const dark = theme === 'dark'
  return (
    <Button variant="ghost" size="icon" onClick={toggle} className={cn('relative', className)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      <Sun className={cn('transition-all', dark ? 'scale-100 rotate-0' : 'absolute scale-0 -rotate-90')} />
      <Moon className={cn('transition-all', dark ? 'absolute scale-0 rotate-90' : 'scale-100 rotate-0')} />
    </Button>
  )
}
