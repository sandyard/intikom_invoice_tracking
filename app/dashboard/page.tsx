import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Truck, CheckCircle, AlertTriangle, Clock, Users } from 'lucide-react'
import type { User, InvoiceStatus } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/types'

interface StatusCount {
  status: InvoiceStatus
  count: number
}

async function getDashboardStats(supabase: Awaited<ReturnType<typeof createClient>>, user: User) {
  // Get invoice counts by status
  const { data: statusCounts } = await supabase
    .from('invoices')
    .select('status')
  
  const counts: Record<InvoiceStatus, number> = {
    draft: 0,
    ready_to_pickup: 0,
    assigned: 0,
    on_delivery: 0,
    delivered: 0,
    failed: 0,
    revision: 0,
  }
  
  statusCounts?.forEach(inv => {
    counts[inv.status as InvoiceStatus]++
  })

  // Get total customers
  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  // Get total couriers
  const { count: courierCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'kurir')

  // For kurir, get their assigned deliveries
  let myDeliveries = 0
  if (user.role === 'kurir') {
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .in('status', ['assigned', 'on_delivery'])
    myDeliveries = count || 0
  }

  return {
    counts,
    totalInvoices: statusCounts?.length || 0,
    customerCount: customerCount || 0,
    courierCount: courierCount || 0,
    myDeliveries,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!user) redirect('/auth/login')

  const stats = await getDashboardStats(supabase, user as User)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user.name}</h1>
        <p className="text-muted-foreground">Here&apos;s an overview of your invoice tracking system</p>
      </div>

      {/* Role-specific stats */}
      {user.role === 'finance' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.counts.delivered}</div>
              <p className="text-xs text-muted-foreground">Successfully delivered</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revisions</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.counts.revision}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.customerCount}</div>
              <p className="text-xs text-muted-foreground">Active customers</p>
            </CardContent>
          </Card>
        </div>
      )}

      {user.role === 'ga_admin' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ready for Pickup</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.counts.ready_to_pickup}</div>
              <p className="text-xs text-muted-foreground">Waiting assignment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.counts.assigned}</div>
              <p className="text-xs text-muted-foreground">To couriers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">On Delivery</CardTitle>
              <Truck className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.counts.on_delivery}</div>
              <p className="text-xs text-muted-foreground">In transit</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Couriers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.courierCount}</div>
              <p className="text-xs text-muted-foreground">Active couriers</p>
            </CardContent>
          </Card>
        </div>
      )}

      {user.role === 'kurir' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Deliveries</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.myDeliveries}</div>
              <p className="text-xs text-muted-foreground">Pending deliveries</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Delivered Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Keep it up!</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Needs follow-up</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status overview */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Status Overview</CardTitle>
          <CardDescription>Current distribution of invoices by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(stats.counts) as [InvoiceStatus, number][]).map(([status, count]) => (
              <div
                key={status}
                className={`flex items-center justify-between p-3 rounded-lg ${STATUS_CONFIG[status].bgColor}`}
              >
                <span className={`text-sm font-medium ${STATUS_CONFIG[status].color}`}>
                  {STATUS_CONFIG[status].label}
                </span>
                <span className={`text-lg font-bold ${STATUS_CONFIG[status].color}`}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
