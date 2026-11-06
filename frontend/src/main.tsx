import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import App from './App'
import './index.css'
import { useThemeStore } from '@/stores/theme'

document.documentElement.classList.toggle('dark', useThemeStore.getState().theme === 'dark')
// invoices and reports always print in light colours
window.addEventListener('beforeprint', () => document.documentElement.classList.remove('dark'))
window.addEventListener('afterprint', () => document.documentElement.classList.toggle('dark', useThemeStore.getState().theme === 'dark'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <App />
        <Toaster position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
