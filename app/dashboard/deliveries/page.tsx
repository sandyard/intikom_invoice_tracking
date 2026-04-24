import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DeliveryList } from '@/components/deliveries/delivery-list'

export default async function DeliveriesPage() {
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!user || (user.role !== 'kurir' && user.role !== 'admin')) {
    redirect('/dashboard')
  }

  // Get invoices assigned to this courier
  const { data: deliveries } = await supabase
    .from('invoices')
    .select('*')
    .eq('assigned_to', user.id)
    .in('status', ['assigned', 'on_delivery'])
    .order('assigned_at', { ascending: true })

  // Get today's completed deliveries
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const { data: completedToday } = await supabase
    .from('invoices')
    .select('*')
    .eq('assigned_to', user.id)
    .in('status', ['delivered', 'failed'])
    .gte('updated_at', today.toISOString())
    .order('updated_at', { ascending: false })

  // Get failure reasons
  const { data: failureReasons } = await supabase
    .from('failure_reasons')
    .select('*')
    .eq('is_active', true)
    .order('code')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Deliveries</h1>
        <p className="text-muted-foreground">
          {deliveries?.length || 0} pending deliveries
        </p>
      </div>

      <DeliveryList
        deliveries={deliveries || []}
        completedToday={completedToday || []}
        failureReasons={failureReasons || []}
        userId={user.id}
      />
    </div>
  )
}
