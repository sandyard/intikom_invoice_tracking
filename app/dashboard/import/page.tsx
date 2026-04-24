import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportForm } from '@/components/invoices/import-form'

export default async function ImportPage() {
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

  // Get customers for mapping
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Invoices</h1>
        <p className="text-muted-foreground">
          Upload a CSV or Excel file to bulk import invoices
        </p>
      </div>

      <ImportForm customers={customers || []} />
    </div>
  )
}
