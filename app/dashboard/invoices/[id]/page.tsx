import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, MapPin, Calendar, User, FileText, Clock, Truck } from 'lucide-react'
import { STATUS_CONFIG, type InvoiceStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { InvoiceStatusActions } from '@/components/invoices/invoice-status-actions'
import { InvoiceTimeline } from '@/components/invoices/invoice-timeline'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!user) redirect('/auth/login')

  // Fetch invoice with related data
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      assigned_user:users!invoices_assigned_to_fkey(id, name, email, phone),
      assigned_by_user:users!invoices_assigned_by_fkey(id, name),
      failure_reason:failure_reasons(id, code, description),
      customer:customers(id, name, address, city, phone, email, pic_name)
    `)
    .eq('id', id)
    .single()

  if (error || !invoice) {
    notFound()
  }

  // Fetch status history
  const { data: history } = await supabase
    .from('invoice_status_history')
    .select(`
      *,
      changed_by_user:users!invoice_status_history_changed_by_fkey(id, name)
    `)
    .eq('invoice_id', id)
    .order('changed_at', { ascending: false })

  const statusConfig = STATUS_CONFIG[invoice.status as InvoiceStatus]

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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
              <Badge 
                variant="secondary"
                className={cn(statusConfig.bgColor, statusConfig.color, 'border-0')}
              >
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">{invoice.customer_name}</p>
          </div>
        </div>
        {(user.role === 'finance' || user.role === 'admin') && (
          <Button asChild>
            <Link href={`/dashboard/invoices/${id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Invoice
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Date</p>
                    <p className="font-medium">{format(new Date(invoice.invoice_date), 'dd MMMM yyyy')}</p>
                  </div>
                </div>
                {invoice.due_date && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium">{format(new Date(invoice.due_date), 'dd MMMM yyyy')}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium text-lg">{formatAmount(invoice.amount)}</p>
                  </div>
                </div>
              </div>

              {invoice.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p>{invoice.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{invoice.customer_name}</p>
                  {invoice.customer_pic && (
                    <p className="text-sm text-muted-foreground">PIC: {invoice.customer_pic}</p>
                  )}
                  {invoice.pic && (
                    <p className="text-sm text-muted-foreground">PIC Internal: {invoice.pic}</p>
                  )}
                </div>
              </div>
              {invoice.customer_address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p>{invoice.customer_address}</p>
                    {invoice.customer_city && (
                      <p className="text-muted-foreground">{invoice.customer_city}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Info */}
          {(invoice.assigned_user || invoice.status === 'delivered' || invoice.status === 'failed') && (
            <Card>
              <CardHeader>
                <CardTitle>Delivery Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice.assigned_user && (
                  <div className="flex items-start gap-3">
                    <Truck className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned Courier</p>
                      <p className="font-medium">{invoice.assigned_user.name}</p>
                      {invoice.assigned_user.phone && (
                        <p className="text-sm text-muted-foreground">{invoice.assigned_user.phone}</p>
                      )}
                    </div>
                  </div>
                )}

                {invoice.status === 'delivered' && (
                  <>
                    {invoice.receiver_name && (
                      <div>
                        <p className="text-sm text-muted-foreground">Received By</p>
                        <p className="font-medium">{invoice.receiver_name}</p>
                      </div>
                    )}
                    {invoice.delivered_at && (
                      <div>
                        <p className="text-sm text-muted-foreground">Delivered At</p>
                        <p className="font-medium">
                          {format(new Date(invoice.delivered_at), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                    )}
                    {invoice.pod_photo_url && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Proof of Delivery</p>
                        <img 
                          src={invoice.pod_photo_url} 
                          alt="Proof of Delivery"
                          className="max-w-sm rounded-lg border"
                        />
                      </div>
                    )}
                    {invoice.signature_url && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Signature</p>
                        <img 
                          src={invoice.signature_url} 
                          alt="Signature"
                          className="max-w-xs rounded-lg border bg-white p-2"
                        />
                      </div>
                    )}
                  </>
                )}

                {invoice.status === 'failed' && invoice.failure_reason && (
                  <div className="p-4 bg-destructive/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Failure Reason</p>
                    <p className="font-medium text-destructive">{invoice.failure_reason.description}</p>
                    {invoice.failure_notes && (
                      <p className="mt-2 text-sm">{invoice.failure_notes}</p>
                    )}
                  </div>
                )}

                {invoice.status === 'revision' && invoice.revision_notes && (
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Revision Notes</p>
                    <p className="font-medium">{invoice.revision_notes}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Revision count: {invoice.revision_count}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Actions */}
          <InvoiceStatusActions 
            invoice={invoice} 
            userRole={user.role} 
            userId={user.id}
          />

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceTimeline history={history || []} currentStatus={invoice.status} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
