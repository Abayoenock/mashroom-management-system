/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, type ReactNode } from 'react'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { fieldErrors } from '@/lib/api'
import { cn } from '@/lib/utils'

export type Option = { value: string; label: string }
export interface FieldDef {
  name: string
  label: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'switch'
  options?: Option[]
  placeholder?: string
  span?: 1 | 2
  hint?: string
  step?: string
  optional?: boolean
}

const NONE = '__none__'

export function Field({ def, form }: { def: FieldDef; form: UseFormReturn<any> }) {
  const err = def.name.split('.').reduce<any>((o, k) => o?.[k], form.formState.errors)?.message as string | undefined
  const id = `f-${def.name}`
  const type = def.type ?? 'text'
  return (
    <div className={cn('grid gap-1.5', def.span === 2 && 'sm:col-span-2', type === 'switch' && 'flex items-center justify-between gap-3 rounded-lg border p-3')}>
      <Label htmlFor={id} className="text-xs font-medium">{def.label}{def.optional && <span className="font-normal text-muted-foreground"> (optional)</span>}</Label>
      {type === 'select' ? (
        <Controller control={form.control} name={def.name} render={({ field }) => (
          <Select value={field.value ? String(field.value) : (def.optional ? NONE : '')} onValueChange={(v) => field.onChange(v === NONE ? '' : v)}>
            <SelectTrigger id={id} className="w-full" aria-invalid={!!err}><SelectValue placeholder={def.placeholder ?? `Select ${def.label.toLowerCase()}`} /></SelectTrigger>
            <SelectContent>
              {def.optional && <SelectItem value={NONE}>None</SelectItem>}
              {(def.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )} />
      ) : type === 'textarea' ? (
        <Textarea id={id} rows={3} placeholder={def.placeholder} aria-invalid={!!err} {...form.register(def.name)} />
      ) : type === 'switch' ? (
        <Controller control={form.control} name={def.name} render={({ field }) => (
          <Switch id={id} checked={!!field.value} onCheckedChange={field.onChange} />
        )} />
      ) : (
        <Input id={id} type={type} step={def.step ?? (type === 'number' ? 'any' : undefined)} placeholder={def.placeholder} aria-invalid={!!err}
          {...form.register(def.name)} />
      )}
      {err ? <p className="text-xs text-destructive">{err}</p> : def.hint ? <p className="text-xs text-muted-foreground">{def.hint}</p> : null}
    </div>
  )
}

/** Apply server-side validation errors (from a 422/409 response) to form fields. */
export function applyServerErrors(form: UseFormReturn<any>, e: unknown) {
  Object.entries(fieldErrors(e)).forEach(([k, msg]) => form.setError(k as any, { message: msg }))
}

export function FormDialog({ open, onOpenChange, title, description, schema, defaults, fields, onSubmit, submitLabel = 'Save', children, wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; schema: z.ZodType<any, any>
  defaults: Record<string, any>; fields: FieldDef[]; onSubmit: (values: any) => Promise<unknown>; submitLabel?: string; children?: ReactNode; wide?: boolean
}) {
  const form = useForm<any>({ resolver: zodResolver(schema as any) as any, defaultValues: defaults })
  useEffect(() => { if (open) form.reset(defaults) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values)
      onOpenChange(false)
    } catch (e) {
      applyServerErrors(form, e)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => <Field key={f.name} def={f} form={form} />)}
          </div>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}{submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
