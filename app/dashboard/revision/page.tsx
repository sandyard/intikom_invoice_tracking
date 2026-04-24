import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, Eye, RotateCcw } from 'lucide-react'
import { RevisionActions } from '@/components/invoices/revision-actions'

export default async function RevisionPage() {
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!user || (user.role !== 'finance' && user.role !== 'admin')) {
    redirect('/dashboard')
  }

  // Get invoices in revision or failed status
  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      *,
      failure_reason:failure_reasons(id, code, description),
      assigned_user:users!invoices_assigned_to_fkey(id, name)
    `)
    .in('status', ['failed', 'revision'])
    .order('updated_at', { ascending: false })

  const failedInvoices = invoices?.filter(i => i.status === 'failed') || []
  const revisionInvoices = invoices?.filter(i => i.status === 'revision') || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revision Queue</h1>
        <p className="text-muted-foreground">
          Handle failed deliveries and invoices needing revision
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Deliveries</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedInvoices.length}</div>
            <p className="text-xs text-muted-foreground">Needs review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Revision</CardTitle>
            <RotateCcw className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revisionInvoices.length}</div>
            <p className="text-xs text-muted-foreground">Being processed</p>
          </CardContent>
        </Card>
      </div>

      {/* Failed deliveries */}
      <Card>
        <CardHeader>
          <CardTitle>Failed Deliveries</CardTitle>
          <CardDescription>
            Review failed deliveries and decide next steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failedInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No failed deliveries
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Failure Reason</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Failed At</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Link 
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-destructive">
                            {invoice.failure_reason?.description || 'Unknown'}
                          </p>
                          {invoice.failure_notes && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {invoice.failure_notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{invoice.assigned_user?.name || '-'}</TableCell>
                      <TableCell>
                        {invoice.failed_at && 
                          format(new Date(invoice.failed_at), 'dd MMM HH:mm')}
                      </TableCell>
                      <TableCell>
                        <RevisionActions invoiceId={invoice.id} currentStatus="failed" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* In revision */}
      <Card>
        <CardHeader>
          <CardTitle>In Revision</CardTitle>
          <CardDescription>
            Invoices being processed for re-delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          {revisionInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices in revision
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Revision Notes</TableHead>
                    <TableHead>Revision Count</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisionInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Link 
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>
                        <p className="text-sm truncate max-w-xs">
                          {invoice.revision_notes || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invoice.revision_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <RevisionActions invoiceId={invoice.id} currentStatus="revision" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
