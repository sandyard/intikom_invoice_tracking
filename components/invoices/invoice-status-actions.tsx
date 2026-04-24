'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowRight, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react'
import type { Invoice, InvoiceStatus, UserRole } from '@/lib/types'
import { appendInvoiceStatusHistory } from '@/lib/invoice-history'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface InvoiceStatusActionsProps {
  invoice: Invoice
  userRole: UserRole
  userId: string
}

const STATUS_TRANSITIONS: Record<InvoiceStatus, { next: InvoiceStatus[]; roles: UserRole[] }> = {
  draft: { next: ['ready_to_pickup'], roles: ['finance'] },
  ready_to_pickup: { next: ['assigned'], roles: ['ga_admin'] },
  assigned: { next: ['on_delivery'], roles: ['kurir'] },
  on_delivery: { next: ['delivered', 'failed'], roles: ['kurir'] },
  delivered: { next: [], roles: [] },
  failed: { next: ['revision'], roles: ['finance'] },
  revision: { next: ['ready_to_pickup'], roles: ['finance'] },
}

export function InvoiceStatusActions({ invoice, userRole, userId }: InvoiceStatusActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [pendingStatus, setPendingStatus] = useState<InvoiceStatus | null>(null)

  const transitions = STATUS_TRANSITIONS[invoice.status]
  const canTransition = transitions.roles.includes(userRole)
  const nextStatuses = transitions.next

  const closeRevisionDialog = () => {
    setRevisionDialogOpen(false)
    setRevisionNotes('')
    setPendingStatus(null)
  }

  const applyStatusChange = async (newStatus: InvoiceStatus, notes?: string | null) => {
    setError(null)
    const supabase = createClient()

    const updateData: Partial<Invoice> = {
      status: newStatus,
    }

    // Add specific fields based on status
    if (newStatus === 'revision') {
      updateData.revision_count = (invoice.revision_count || 0) + 1
      updateData.revision_notes = notes?.trim() || null
    }

    const { error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoice.id)

    if (error) {
      setError(error.message)
      return
    }

    await appendInvoiceStatusHistory(supabase as any, {
      invoice_id: invoice.id,
      old_status: invoice.status,
      new_status: newStatus,
      changed_by: userId,
      notes: notes ?? null,
      metadata: { action: 'status_action_button' },
    })

    startTransition(() => {
      router.refresh()
    })
  }

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (newStatus === 'revision') {
      setPendingStatus(newStatus)
      setRevisionDialogOpen(true)
      return
    }

    await applyStatusChange(newStatus)
  }

  const getStatusLabel = (status: InvoiceStatus): string => {
    const labels: Record<InvoiceStatus, string> = {
      draft: 'Draft',
      ready_to_pickup: 'Ready to Pickup',
      assigned: 'Assigned',
      on_delivery: 'On Delivery',
      delivered: 'Delivered',
      failed: 'Failed',
      revision: 'Send to Revision',
    }
    return labels[status]
  }

  const getButtonVariant = (status: InvoiceStatus) => {
    if (status === 'delivered') return 'default'
    if (status === 'failed' || status === 'revision') return 'destructive'
    return 'outline'
  }

  const getButtonIcon = (status: InvoiceStatus) => {
    if (status === 'delivered') return <CheckCircle className="h-4 w-4 mr-2" />
    if (status === 'revision') return <RotateCcw className="h-4 w-4 mr-2" />
    return <ArrowRight className="h-4 w-4 mr-2" />
  }

  if (!canTransition || nextStatuses.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {nextStatuses.map((status) => (
          <Button
            key={status}
            variant={getButtonVariant(status)}
            className="w-full justify-start"
            onClick={() => handleStatusChange(status)}
            disabled={isPending}
          >
            {getButtonIcon(status)}
            {getStatusLabel(status)}
          </Button>
        ))}

        {userRole === 'finance' && invoice.status === 'draft' && (
          <p className="text-xs text-muted-foreground text-center">
            Mark as ready when the invoice is prepared for pickup
          </p>
        )}
        
        {userRole === 'ga_admin' && invoice.status === 'ready_to_pickup' && (
          <p className="text-xs text-muted-foreground text-center">
            Assign this invoice to a courier from the Assignments page
          </p>
        )}
      </CardContent>

      <Dialog open={revisionDialogOpen} onOpenChange={(v) => (v ? setRevisionDialogOpen(true) : closeRevisionDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Revision</DialogTitle>
            <DialogDescription>
              Add notes to help Finance prepare the next delivery attempt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="revision-notes">Revision notes</Label>
            <Textarea
              id="revision-notes"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="e.g. Customer not available, reschedule to tomorrow..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRevisionDialog} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pendingStatus) return
                void applyStatusChange(pendingStatus, revisionNotes.trim() || null)
                closeRevisionDialog()
              }}
              disabled={isPending}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
