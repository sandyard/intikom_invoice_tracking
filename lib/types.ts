// Database types for Intikom Invoice Tracking System

export type UserRole = 'admin' | 'finance' | 'ga_admin' | 'kurir'

export type InvoiceStatus = 
  | 'draft'
  | 'ready_to_pickup'
  | 'assigned'
  | 'on_delivery'
  | 'delivered'
  | 'failed'
  | 'revision'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  pic_name: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FailureReason {
  id: string
  code: string
  description: string
  is_active: boolean
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string | null
  customer_name: string
  customer_address: string | null
  customer_city: string | null
  customer_pic: string | null
  pic: string | null
  invoice_date: string
  due_date: string | null
  amount: number | null
  description: string | null
  status: InvoiceStatus
  assigned_to: string | null
  assigned_at: string | null
  assigned_by: string | null
  pickup_at: string | null
  delivered_at: string | null
  delivery_latitude: number | null
  delivery_longitude: number | null
  failure_reason_id: string | null
  failure_notes: string | null
  failed_at: string | null
  revision_count: number
  revision_notes: string | null
  pod_photo_url: string | null
  signature_url: string | null
  receiver_name: string | null
  invoice_file_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceWithRelations extends Invoice {
  assigned_user?: User | null
  assigned_by_user?: User | null
  failure_reason?: FailureReason | null
  customer?: Customer | null
}

export interface InvoiceStatusHistory {
  id: string
  invoice_id: string
  old_status: InvoiceStatus | null
  new_status: InvoiceStatus
  changed_by: string | null
  changed_at: string
  latitude: number | null
  longitude: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
}

export interface Attachment {
  id: string
  invoice_id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  uploaded_by: string | null
  uploaded_at: string
}

// Status configuration for UI display
export const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  ready_to_pickup: { label: 'Ready to Pickup', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  assigned: { label: 'Assigned', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  on_delivery: { label: 'On Delivery', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  delivered: { label: 'Delivered', color: 'text-green-700', bgColor: 'bg-green-100' },
  failed: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-100' },
  revision: { label: 'Revision', color: 'text-amber-700', bgColor: 'bg-amber-100' },
}

export const ROLE_CONFIG: Record<UserRole, { label: string; description: string }> = {
  admin: { label: 'Admin', description: 'Full access to all pages and management features' },
  finance: { label: 'Finance', description: 'Manage invoices, customers, and reports' },
  ga_admin: { label: 'GA Admin', description: 'Assign couriers and manage deliveries' },
  kurir: { label: 'Kurir', description: 'Deliver invoices and record POD' },
}
