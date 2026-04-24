import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AssignmentQueue } from '@/components/assignments/assignment-queue'

export default async function AssignmentsPage() {
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

  // Get invoices ready for pickup
  const { data: readyInvoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('status', 'ready_to_pickup')
    .order('invoice_date', { ascending: true })

  // Get assigned but not yet picked up
  const { data: assignedInvoices } = await supabase
    .from('invoices')
    .select(`
      *,
      assigned_user:users!invoices_assigned_to_fkey(id, name, phone)
    `)
    .eq('status', 'assigned')
    .order('assigned_at', { ascending: false })

  // Get active couriers
  const { data: couriers } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'kurir')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoice Assignments</h1>
        <p className="text-muted-foreground">
          Assign invoices to couriers for delivery
        </p>
      </div>

      <AssignmentQueue
        readyInvoices={readyInvoices || []}
        assignedInvoices={assignedInvoices || []}
        couriers={couriers || []}
      />
    </div>
  )
}
