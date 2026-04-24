import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourierList } from '@/components/couriers/courier-list'

export default async function CouriersPage() {
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!user || (user.role !== 'ga_admin' && user.role !== 'admin')) {
    redirect('/dashboard')
  }

  // Get all couriers with their delivery stats
  const { data: couriers } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'kurir')
    .order('name')

  // Get delivery counts for each courier
  const { data: deliveryCounts } = await supabase
    .from('invoices')
    .select('assigned_to, status')
    .in('status', ['assigned', 'on_delivery', 'delivered', 'failed'])

  // Calculate stats per courier
  const courierStats: Record<string, { assigned: number; on_delivery: number; delivered: number; failed: number }> = {}
  
  deliveryCounts?.forEach((inv) => {
    if (!inv.assigned_to) return
    if (!courierStats[inv.assigned_to]) {
      courierStats[inv.assigned_to] = { assigned: 0, on_delivery: 0, delivered: 0, failed: 0 }
    }
    if (inv.status === 'assigned') courierStats[inv.assigned_to].assigned++
    if (inv.status === 'on_delivery') courierStats[inv.assigned_to].on_delivery++
    if (inv.status === 'delivered') courierStats[inv.assigned_to].delivered++
    if (inv.status === 'failed') courierStats[inv.assigned_to].failed++
  })

  const couriersWithStats = couriers?.map((c) => ({
    ...c,
    stats: courierStats[c.id] || { assigned: 0, on_delivery: 0, delivered: 0, failed: 0 },
  })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Couriers</h1>
        <p className="text-muted-foreground">
          View courier performance and delivery statistics
        </p>
      </div>

      <CourierList couriers={couriersWithStats} />
    </div>
  )
}
