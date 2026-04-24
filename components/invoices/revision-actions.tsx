'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { appendInvoiceStatusHistory } from '@/lib/invoice-history'
import type { InvoiceStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface RevisionActionsProps {
  invoiceId: string
  currentStatus: Extract<InvoiceStatus, 'failed' | 'revision'>
}

export function RevisionActions({ invoiceId, currentStatus }: RevisionActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')

  const close = () => {
    setOpen(false)
    setNotes('')
    setError(null)
  }

  const handleSendToRevision = async () => {
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Authentication required')
      return
    }

    const { data: current } = await supabase
      .from('invoices')
      .select('status, revision_count')
      .eq('id', invoiceId)
      .single()

    const oldStatus = (current?.status as InvoiceStatus | undefined) ?? 'failed'

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'revision',
        revision_notes: notes.trim() || null,
        revision_count: (current?.revision_count ?? 0) + 1,
      })
      .eq('id', invoiceId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await appendInvoiceStatusHistory(supabase as any, {
      invoice_id: invoiceId,
      old_status: oldStatus === 'revision' ? null : oldStatus,
      new_status: 'revision',
      changed_by: user.id,
      notes: notes.trim() || null,
      metadata: { action: 'revision_queue_send_to_revision' },
    })

    startTransition(() => {
      router.refresh()
      close()
    })
  }

  const handleMarkReady = async () => {
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Authentication required')
      return
    }

    const { data: current } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', invoiceId)
      .single()

    const oldStatus = (current?.status as InvoiceStatus | undefined) ?? 'revision'

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'ready_to_pickup',
        assigned_to: null,
        assigned_by: null,
        assigned_at: null,
        pickup_at: null,
      })
      .eq('id', invoiceId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await appendInvoiceStatusHistory(supabase as any, {
      invoice_id: invoiceId,
      old_status: oldStatus === 'revision' ? 'revision' : oldStatus,
      new_status: 'ready_to_pickup',
      changed_by: user.id,
      notes: 'Marked ready for pickup after revision',
      metadata: { action: 'revision_queue_mark_ready' },
    })

    startTransition(() => router.refresh())
  }

  if (currentStatus === 'failed') {
    return (
      <>
        <Button size="sm" onClick={() => setOpen(true)} disabled={isPending}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Send to Revision
        </Button>

        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send to Revision</DialogTitle>
              <DialogDescription>
                Add optional notes for the revision process.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="revision-notes">Revision notes</Label>
              <Textarea
                id="revision-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Customer asked to reschedule delivery..."
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSendToRevision} disabled={isPending}>
                Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button size="sm" variant="outline" onClick={handleMarkReady} disabled={isPending}>
        Mark Ready to Pickup
      </Button>
    </div>
  )
}

