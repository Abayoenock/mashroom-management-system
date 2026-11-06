import { useState } from 'react'
import { z } from 'zod'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormDialog } from '@/components/shared/FormDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useMutate } from '@/hooks/useApi'
import { useAuth } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { ROLE_LABELS, type User } from '@/types'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const { theme, set } = useThemeStore()
  const [edit, setEdit] = useState(false)
  const mut = useMutate<unknown, User>('put', ['/auth/me'])
  if (!user) return null
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader eyebrow="Account" title="Profile & settings" actions={<Button onClick={() => setEdit(true)}>Edit profile</Button>} />
      <Card>
        <CardHeader><CardTitle className="text-sm">Account</CardTitle></CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {[['Name', user.name], ['Email', user.email], ['Phone', user.phone || '—'], ['Role', ROLE_LABELS[user.role]], ['Farms', user.role === 'super_admin' ? 'All farms' : user.farms.map((f) => f.name).join(', ') || '—']].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
            <div className="flex justify-between py-2.5"><dt className="text-muted-foreground">Email verified</dt><dd><StatusBadge value={user.email_verified ? 'active' : 'pending'} label={user.email_verified ? 'Verified' : 'Not verified'} /></dd></div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Appearance</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => set('light')}><Sun /> Light</Button>
          <Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => set('dark')}><Moon /> Dark</Button>
        </CardContent>
      </Card>
      <FormDialog open={edit} onOpenChange={setEdit} title="Edit profile"
        schema={z.object({ name: z.string().min(2), phone: z.string().optional(), current_password: z.string().optional(),
          new_password: z.union([z.literal(''), z.string().min(8, 'At least 8 characters')]).optional() })
          .refine((v) => !v.new_password || !!v.current_password, { message: 'Enter your current password', path: ['current_password'] })}
        defaults={{ name: user.name, phone: user.phone ?? '', current_password: '', new_password: '' }}
        fields={[{ name: 'name', label: 'Full name' }, { name: 'phone', label: 'Phone', optional: true },
          { name: 'current_password', label: 'Current password', type: 'password', optional: true }, { name: 'new_password', label: 'New password', type: 'password', optional: true }]}
        onSubmit={async (v) => { const r = await mut.mutateAsync({ path: '/auth/me', body: { ...v, new_password: v.new_password || null } }); setUser(r.data) }} />
    </div>
  )
}
