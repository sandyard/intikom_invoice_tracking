'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Users, Package, Truck } from 'lucide-react'
import type { Invoice, User } from '@/lib/types'
import { appendInvoiceStatusHistory } from '@/lib/invoice-history'

interface InvoiceWithAssignee extends Invoice {
  assigned_user?: { id: string; name: string; phone: string | null } | null
}

interface AssignmentQueueProps {
  readyInvoices: Invoice[]
  assignedInvoices: InvoiceWithAssignee[]
  couriers: User[]
}

export function AssignmentQueue({
  readyInvoices,
  assignedInvoices,
  couriers,
}: AssignmentQueueProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedCourier, setSelectedCourier] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

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
    if (selectedIds.size === readyInvoices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(readyInvoices.map((i) => i.id)))
    }
  }

  const handleAssign = async () => {
    if (selectedIds.size === 0 || !selectedCourier) {
      setError('Please select invoices and a courier')
      return
    }

    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('Authentication required')
      return
    }

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'assigned',
        assigned_to: selectedCourier,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
      })
      .in('id', Array.from(selectedIds))

    if (error) {
      setError(error.message)
      return
    }

    await supabase.from('invoice_status_history').insert(
      Array.from(selectedIds).map((invoiceId) => ({
        invoice_id: invoiceId,
        old_status: 'ready_to_pickup',
        new_status: 'assigned',
        changed_by: user.id,
        changed_at: new Date().toISOString(),
        notes: `Assigned to courier ${selectedCourier}`,
        metadata: { action: 'assign_to_courier', assigned_to: selectedCourier },
      })),
    )

    setSelectedIds(new Set())
    setSelectedCourier('')
    startTransition(() => {
      router.refresh()
    })
  }

  const handleUnassign = async (invoiceId: string) => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'ready_to_pickup',
        assigned_to: null,
        assigned_by: null,
        assigned_at: null,
      })
      .eq('id', invoiceId)

    if (error) {
      setError(error.message)
      return
    }

    await appendInvoiceStatusHistory(supabase as any, {
      invoice_id: invoiceId,
      old_status: 'assigned',
      new_status: 'ready_to_pickup',
      changed_by: user?.id ?? null,
      notes: 'Unassigned and returned to pickup queue',
      metadata: { action: 'unassign' },
    })

    startTransition(() => {
      router.refresh()
    })
  }

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ready for Pickup</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readyInvoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Truck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedInvoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Couriers</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{couriers.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ready" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ready">
            Ready for Pickup ({readyInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="assigned">
            Assigned ({assignedInvoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="space-y-4">
          {/* Bulk assignment */}
          {readyInvoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Assign to Courier</CardTitle>
                <CardDescription>
                  Select invoices and assign them to a courier for delivery
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Select Courier</label>
                  <Select value={selectedCourier} onValueChange={setSelectedCourier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a courier" />
                    </SelectTrigger>
                    <SelectContent>
                      {couriers.map((courier) => (
                        <SelectItem key={courier.id} value={courier.id}>
                          <div className="flex items-center gap-2">
                            <span>{courier.name}</span>
                            {courier.phone && (
                              <span className="text-muted-foreground text-xs">
                                ({courier.phone})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAssign}
                  disabled={selectedIds.size === 0 || !selectedCourier || isPending}
                >
                  {isPending ? 'Assigning...' : `Assign ${selectedIds.size} Invoice(s)`}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Ready invoices table */}
          {readyInvoices.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No invoices ready for pickup</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === readyInvoices.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readyInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(invoice.id)}
                          onCheckedChange={() => toggleSelect(invoice.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>{invoice.customer_city || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>{formatAmount(invoice.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assigned" className="space-y-4">
          {assignedInvoices.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No assigned invoices</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Assigned At</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>{invoice.customer_city || '-'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.assigned_user?.name}</p>
                          {invoice.assigned_user?.phone && (
                            <p className="text-xs text-muted-foreground">
                              {invoice.assigned_user.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {invoice.assigned_at &&
                          format(new Date(invoice.assigned_at), 'dd MMM HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassign(invoice.id)}
                          disabled={isPending}
                        >
                          Unassign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
