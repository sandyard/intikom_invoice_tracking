'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import { STATUS_CONFIG, type Invoice, type UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface InvoiceWithAssignee extends Invoice {
  assigned_user?: { id: string; name: string; email: string } | null
}

interface InvoiceListProps {
  invoices: InvoiceWithAssignee[]
  userRole: UserRole
  currentPage: number
  pageSize: number
}

export function InvoiceList({ invoices, userRole, currentPage, pageSize }: InvoiceListProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(invoices.map((i) => i.id)))
    }
  }

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const markSelectedReady = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Mark ${selectedIds.size} invoice(s) as Ready to Pickup?`)) return

    const target = invoices.filter((i) => selectedIds.has(i.id) && i.status === 'draft')
    if (target.length === 0) return

    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const ids = target.map((i) => i.id)
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'ready_to_pickup' })
        .in('id', ids)
        .eq('status', 'draft')

      if (error) throw new Error(error.message)

      await supabase.from('invoice_status_history').insert(
        target.map((inv) => ({
          invoice_id: inv.id,
          old_status: 'draft',
          new_status: 'ready_to_pickup',
          changed_by: user.id,
          changed_at: new Date().toISOString(),
          notes: 'Bulk marked ready to pickup',
          metadata: { action: 'bulk_ready_to_pickup' },
        })),
      )

      setSelectedIds(new Set())
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to update invoices')
    } finally {
      setBusy(false)
    }
  }

  const deleteInvoices = async (ids: string[]) => {
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} invoice(s)? This cannot be undone.`)) return

    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', ids)
        .eq('status', 'draft')

      if (error) throw new Error(error.message)

      setSelectedIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })

      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to delete invoices')
    } finally {
      setBusy(false)
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/20">
        <p className="text-muted-foreground">No invoices found</p>
        {userRole === 'finance' && (
          <Button asChild className="mt-4">
            <Link href="/dashboard/import">Import your first invoice</Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {selectedIds.size > 0 && userRole === 'finance' && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button variant="outline" size="sm" onClick={markSelectedReady} disabled={busy}>
            Mark Ready to Pickup
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => deleteInvoices(Array.from(selectedIds))}
            disabled={busy}
          >
            Delete Selected
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {userRole === 'finance' && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === invoices.length && invoices.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Customer PIC</TableHead>
              <TableHead>PIC Internal</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const statusConfig = STATUS_CONFIG[invoice.status]
              return (
                <TableRow key={invoice.id}>
                  {userRole === 'finance' && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(invoice.id)}
                        onCheckedChange={() => toggleSelect(invoice.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link 
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{invoice.customer_name}</p>
                      {invoice.customer_city && (
                        <p className="text-xs text-muted-foreground">{invoice.customer_city}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {invoice.customer_pic ? (
                      <span className="text-sm">{invoice.customer_pic}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {invoice.pic ? (
                      <span className="text-sm">{invoice.pic}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>{formatAmount(invoice.amount)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={cn(statusConfig.bgColor, statusConfig.color, 'border-0')}
                    >
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invoice.assigned_user ? (
                      <span className="text-sm">{invoice.assigned_user.name}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/invoices/${invoice.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {userRole === 'finance' && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteInvoices([invoice.id])}
                              disabled={busy || invoice.status !== 'draft'}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
