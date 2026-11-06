/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, applyServerErrors, type FieldDef } from '@/components/shared/FormDialog'
import { Logo } from '@/components/shared/Logo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { DemoAccounts } from './DemoAccounts'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import hero from '@/assets/img/racks.jpg'

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-forest lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/60 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link to="/"><Logo light /></Link>
          <div>
            <p className="eyebrow text-beige">Grow smarter</p>
            <p className="mt-3 max-w-md text-3xl leading-tight font-bold">Every batch, harvest and sale in one place.</p>
            <p className="mt-3 max-w-md text-sm text-white/70">Built for mushroom farms: flush tracking, contamination alerts, stock and sales all connected.</p>
          </div>
        </div>
      </div>
      <div className="relative flex items-center justify-center px-4 py-16 sm:px-8">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

function useAuthForm(schema: z.ZodType<any, any>, defaults: Record<string, any>) {
  return useForm<any>({ resolver: zodResolver(schema as any) as any, defaultValues: defaults })
}

const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Password is required') })

export function LoginPage() {
  const form = useAuthForm(loginSchema, { email: '', password: '' })
  const setSession = useAuth((s) => s.setSession)
  const navigate = useNavigate()
  const loc = useLocation()
  const submit = form.handleSubmit(async (v) => {
    try {
      const { data } = await api.post('/auth/login', v)
      setSession(data.data.user, data.data.access_token, data.data.refresh_token)
      toast.success(`Welcome back, ${data.data.user.name.split(' ')[0]}`)
      navigate((loc.state as any)?.from ?? '/app', { replace: true })
    } catch (e) {
      form.setError('password', { message: errorMessage(e) })
    }
  })
  const fields: FieldDef[] = [{ name: 'email', label: 'Email', type: 'email', span: 2 }, { name: 'password', label: 'Password', type: 'password', span: 2 }]
  return (
    <AuthShell title="Sign in" subtitle="Welcome back to MycoFarm." footer={<>New here? <Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {fields.map((f) => <Field key={f.name} def={f} form={form} />)}
        <div className="-mt-2 text-right"><Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link></div>
        <Button type="submit" className="h-10" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Sign in</Button>
      </form>
      <DemoAccounts onPick={(email, password) => {
        form.setValue('email', email, { shouldValidate: true })
        form.setValue('password', password, { shouldValidate: true })
        form.setFocus('password')
      }} />
    </AuthShell>
  )
}

const registerSchema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  farm_name: z.string().min(2, 'Enter your farm name'),
  password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })

export function RegisterPage() {
  const form = useAuthForm(registerSchema, { name: '', email: '', farm_name: '', password: '', confirm: '' })
  const setSession = useAuth((s) => s.setSession)
  const navigate = useNavigate()
  const submit = form.handleSubmit(async (v) => {
    try {
      const { data } = await api.post('/auth/register', v)
      setSession(data.data.user, data.data.access_token, data.data.refresh_token)
      toast.success('Account created. Your farm is ready.')
      navigate(`/verify-email?token=${data.data.dev_verify_token}&next=/app`)
    } catch (e) {
      applyServerErrors(form, e); toast.error(errorMessage(e))
    }
  })
  const fields: FieldDef[] = [
    { name: 'name', label: 'Full name', span: 2 }, { name: 'email', label: 'Email', type: 'email', span: 2 },
    { name: 'farm_name', label: 'Farm name', span: 2, placeholder: 'e.g. Green Valley Mushrooms' },
    { name: 'password', label: 'Password', type: 'password' }, { name: 'confirm', label: 'Confirm', type: 'password' },
  ]
  return (
    <AuthShell title="Create your account" subtitle="You'll be the farm owner. Invite your team afterwards." footer={<>Already registered? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-4" noValidate>
        {fields.map((f) => <Field key={f.name} def={f} form={form} />)}
        <Button type="submit" className="col-span-2 h-10" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Create account</Button>
      </form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const form = useAuthForm(z.object({ email: z.string().email('Enter a valid email') }), { email: '' })
  const [token, setToken] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const submit = form.handleSubmit(async (v) => {
    try {
      const { data } = await api.post('/auth/forgot-password', v)
      setSent(true); setToken(data.data?.dev_reset_token ?? null)
    } catch (e) { toast.error(errorMessage(e)) }
  })
  return (
    <AuthShell title="Reset your password" subtitle="We'll send a reset link to your email." footer={<Link to="/login" className="text-primary hover:underline">Back to sign in</Link>}>
      {sent ? (
        <div className="rounded-lg border bg-accent/40 p-4 text-sm">
          <p>If an account exists for that email, a reset link is on its way.</p>
          {token && (
            <p className="mt-3 text-xs text-muted-foreground">
              Prototype mode (no mail server): <Link className="font-medium text-primary underline" to={`/reset-password?token=${token}`}>open the reset link</Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field def={{ name: 'email', label: 'Email', type: 'email' }} form={form} />
          <Button type="submit" className="h-10" disabled={form.formState.isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const form = useAuthForm(z.object({ password: z.string().min(8, 'At least 8 characters'), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] }), { password: '', confirm: '' })
  const submit = form.handleSubmit(async (v) => {
    try {
      const { data } = await api.post('/auth/reset-password', { token: params.get('token'), password: v.password })
      toast.success(data.message); navigate('/login')
    } catch (e) { toast.error(errorMessage(e)) }
  })
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field def={{ name: 'password', label: 'New password', type: 'password' }} form={form} />
        <Field def={{ name: 'confirm', label: 'Confirm password', type: 'password' }} form={form} />
        <Button type="submit" className="h-10" disabled={form.formState.isSubmitting}>Update password</Button>
      </form>
    </AuthShell>
  )
}

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const verify = async () => {
    try { await api.post('/auth/verify-email', { token: params.get('token') }); setState('ok') } catch { setState('err') }
  }
  return (
    <AuthShell title="Verify your email" subtitle="Confirm your address to secure your account.">
      {state === 'idle' && <Button className="h-10 w-full" onClick={verify}>Verify email address</Button>}
      {state === 'ok' && <div className="space-y-4"><p className="text-sm">Your email is verified. 🎉</p><Button className="w-full" onClick={() => navigate(params.get('next') ?? '/app')}>Continue to dashboard</Button></div>}
      {state === 'err' && <p className="text-sm text-destructive">This verification link is invalid or already used.</p>}
      <Button variant="link" className="mt-2 w-full" onClick={() => navigate(params.get('next') ?? '/app')}>Skip for now</Button>
    </AuthShell>
  )
}
