import type { InvoiceStatus } from '@/lib/types'

export type InvoiceStatusHistoryInsert = {
  invoice_id: string
  old_status: InvoiceStatus | null
  new_status: InvoiceStatus
  changed_by: string | null
  changed_at?: string
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

export async function appendInvoiceStatusHistory(
  supabase: {
    from: (table: string) => {
      insert: (values: unknown) => Promise<{ error: { message: string } | null }>
    }
  },
  row: InvoiceStatusHistoryInsert,
) {
  const payload = {
    changed_at: new Date().toISOString(),
    latitude: null,
    longitude: null,
    notes: null,
    metadata: null,
    ...row,
  }

  return await supabase.from('invoice_status_history').insert(payload)
}

