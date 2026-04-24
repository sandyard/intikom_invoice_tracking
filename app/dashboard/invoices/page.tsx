import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InvoiceList } from '@/components/invoices/invoice-list'
import { InvoiceFilters } from '@/components/invoices/invoice-filters'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { InvoiceStatus } from '@/lib/types'

interface PageProps {
  searchParams: Promise<{
    status?: string
    search?: string
    page?: string
  }>
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!user || (user.role !== 'finance' && user.role !== 'ga_admin' && user.role !== 'admin')) {
    redirect('/dashboard')
  }

  // Build query
  let query = supabase
    .from('invoices')
    .select('*, assigned_user:users!invoices_assigned_to_fkey(id, name, email)')
    .order('created_at', { ascending: false })

  // Apply status filter
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status as InvoiceStatus)
  }

  // Apply search filter
  if (params.search) {
    query = query.or(`invoice_number.ilike.%${params.search}%,customer_name.ilike.%${params.search}%`)
  }

  // Pagination
  const page = parseInt(params.page || '1')
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.range(from, to)

  const { data: invoices, error, count } = await query

  // Get all customers for the filter
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage and track all invoices</p>
        </div>
        {(user.role === 'finance' || user.role === 'admin') && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/import">
                Import CSV/Excel
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/invoices/new">
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Link>
            </Button>
          </div>
        )}
      </div>

      <InvoiceFilters 
        currentStatus={params.status || 'all'} 
        currentSearch={params.search || ''} 
      />

      <Suspense fallback={<div>Loading invoices...</div>}>
        <InvoiceList 
          invoices={invoices || []} 
          userRole={user.role}
          currentPage={page}
          pageSize={pageSize}
        />
      </Suspense>
    </div>
  )
}
