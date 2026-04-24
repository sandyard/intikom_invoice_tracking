'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { appendInvoiceStatusHistory } from '@/lib/invoice-history'
import type { Invoice } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

const schema = z.object({
  invoice_number: z.string().trim().min(1, 'Invoice number is required'),
  customer_name: z.string().trim().min(1, 'Customer name is required'),
  customer_address: z.string().trim().optional(),
  customer_city: z.string().trim().optional(),
  customer_pic: z.string().trim().optional(),
  pic: z.string().trim().optional(),
  invoice_date: z.string().trim().min(1, 'Invoice date is required'),
  due_date: z.string().trim().optional(),
  amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'number') return v
      const cleaned = v.replace(/[^0-9.-]/g, '')
      if (!cleaned) return undefined
      const n = Number.parseFloat(cleaned)
      return Number.isFinite(n) ? n : undefined
    }),
  description: z.string().trim().optional(),
})

type FormValues = z.infer<typeof schema>

type Mode = 'create' | 'edit'

interface InvoiceFormProps {
  mode: Mode
  invoice?: Partial<Invoice>
}

export function InvoiceForm({ mode, invoice }: InvoiceFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const defaults = useMemo<FormValues>(() => {
    return {
      invoice_number: invoice?.invoice_number ?? '',
      customer_name: invoice?.customer_name ?? '',
      customer_address: invoice?.customer_address ?? '',
      customer_city: invoice?.customer_city ?? '',
      customer_pic: invoice?.customer_pic ?? '',
      pic: invoice?.pic ?? '',
      invoice_date: (invoice?.invoice_date ?? new Date().toISOString().split('T')[0]) as string,
      due_date: invoice?.due_date ?? '',
      amount: invoice?.amount ?? undefined,
      description: invoice?.description ?? '',
    }
  }, [invoice])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })

  const onSubmit = async (values: FormValues) => {
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Authentication required')
      return
    }

    const payload = {
      invoice_number: values.invoice_number.trim(),
      customer_name: values.customer_name.trim(),
      customer_address: values.customer_address?.trim() || null,
      customer_city: values.customer_city?.trim() || null,
      customer_pic: values.customer_pic?.trim() || null,
      pic: values.pic?.trim() || null,
      invoice_date: values.invoice_date,
      due_date: values.due_date?.trim() || null,
      amount: values.amount ?? null,
      description: values.description?.trim() || null,
    }

    if (mode === 'create') {
      const { data, error: insertError } = await supabase
        .from('invoices')
        .insert({
          ...payload,
          status: 'draft',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (insertError) {
        setError(insertError.message)
        return
      }

      if (data?.id) {
        await appendInvoiceStatusHistory(supabase as any, {
          invoice_id: data.id,
          old_status: null,
          new_status: 'draft',
          changed_by: user.id,
          notes: 'Invoice created',
          metadata: { action: 'create_invoice' },
        })
      }

      startTransition(() => router.push('/dashboard/invoices'))
      return
    }

    if (!invoice?.id) {
      setError('Missing invoice id')
      return
    }

    const { data: current } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', invoice.id)
      .single()

    const { error: updateError } = await supabase
      .from('invoices')
      .update(payload)
      .eq('id', invoice.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    const currentStatus = (current?.status ?? 'draft') as any
    await appendInvoiceStatusHistory(supabase as any, {
      invoice_id: invoice.id,
      old_status: currentStatus,
      new_status: currentStatus,
      changed_by: user.id,
      notes: 'Invoice details updated',
      metadata: { action: 'edit_invoice' },
    })

    startTransition(() => router.push(`/dashboard/invoices/${invoice.id}`))
  }

  const submitLabel = mode === 'create' ? 'Create Invoice' : 'Save Changes'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'New Invoice' : 'Edit Invoice'}</CardTitle>
        <CardDescription>
          {mode === 'create'
            ? 'Create a new invoice in draft status.'
            : 'Update invoice details (status is managed separately).'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => {
            startTransition(() => {
              void onSubmit(v)
            })
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice # *</Label>
              <Input id="invoice_number" {...form.register('invoice_number')} />
              {form.formState.errors.invoice_number && (
                <p className="text-sm text-destructive">{form.formState.errors.invoice_number.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice date *</Label>
              <Input id="invoice_date" type="date" {...form.register('invoice_date')} />
              {form.formState.errors.invoice_date && (
                <p className="text-sm text-destructive">{form.formState.errors.invoice_date.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer name *</Label>
              <Input id="customer_name" {...form.register('customer_name')} />
              {form.formState.errors.customer_name && (
                <p className="text-sm text-destructive">{form.formState.errors.customer_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_pic">Customer PIC</Label>
              <Input id="customer_pic" {...form.register('customer_pic')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_city">City</Label>
              <Input id="customer_city" {...form.register('customer_city')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" {...form.register('due_date')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pic">PIC (Internal)</Label>
              <Input id="pic" {...form.register('pic')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_address">Address</Label>
            <Textarea id="customer_address" {...form.register('customer_address')} rows={3} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (IDR)</Label>
              <Input id="amount" inputMode="decimal" {...form.register('amount' as any)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

