-- Intikom Invoice Tracking System Database Schema
-- Version: 001
-- Description: Creates all tables, enums, RLS policies, and triggers

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create enum for user roles
create type user_role as enum ('admin', 'finance', 'ga_admin', 'kurir');

-- Create enum for invoice status
create type invoice_status as enum (
  'draft',
  'ready_to_pickup',
  'assigned',
  'on_delivery',
  'delivered',
  'failed',
  'revision'
);

-- ============================================
-- USERS TABLE (extends auth.users)
-- ============================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role user_role not null default 'kurir',
  phone text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users enable row level security;

-- Users can read all users (needed for assignment dropdowns)
create policy "users_select_all" on public.users 
  for select using (true);

-- Users can only update their own profile
create policy "users_update_own" on public.users 
  for update using (auth.uid() = id);

-- Finance/Admin can update any user (for user management)
create policy "users_update_finance_admin" on public.users
  for update using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('finance', 'admin')
    )
  );

-- Only finance can insert new users
create policy "users_insert_finance" on public.users 
  for insert with check (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'finance'
    )
  );

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  city text,
  phone text,
  email text,
  pic_name text, -- Person in charge
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.customers enable row level security;

-- All authenticated users can read customers
create policy "customers_select_all" on public.customers 
  for select using (auth.uid() is not null);

-- Only finance can manage customers
create policy "customers_insert_finance" on public.customers 
  for insert with check (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'finance'
    )
  );

create policy "customers_update_finance" on public.customers 
  for update using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'finance'
    )
  );

create policy "customers_delete_finance" on public.customers 
  for delete using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'finance'
    )
  );

-- ============================================
-- FAILURE REASONS TABLE
-- ============================================
create table if not exists public.failure_reasons (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  description text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.failure_reasons enable row level security;

-- All authenticated users can read failure reasons
create policy "failure_reasons_select_all" on public.failure_reasons 
  for select using (auth.uid() is not null);

-- Only finance can manage failure reasons
create policy "failure_reasons_manage_finance" on public.failure_reasons 
  for all using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'finance'
    )
  );

-- Insert default failure reasons
insert into public.failure_reasons (code, description) values
  ('CLOSED', 'Office/recipient closed'),
  ('NO_PERSON', 'No authorized person available'),
  ('WRONG_ADDRESS', 'Wrong or incomplete address'),
  ('REFUSED', 'Recipient refused to accept'),
  ('DAMAGED', 'Invoice/document damaged'),
  ('OTHER', 'Other reason (requires notes)')
on conflict (code) do nothing;

-- ============================================
-- INVOICES TABLE
-- ============================================
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  customer_id uuid references public.customers(id),
  customer_name text not null, -- Denormalized for quick access
  customer_address text,
  customer_city text,
  customer_pic text,
  
  -- Invoice details
  pic text, -- Internal PIC (person in charge)
  invoice_date date not null,
  due_date date,
  amount decimal(15,2),
  description text,
  
  -- Status tracking
  status invoice_status default 'draft',
  assigned_to uuid references public.users(id), -- Kurir assignment
  assigned_at timestamptz,
  assigned_by uuid references public.users(id), -- GA Admin who assigned
  
  -- Delivery tracking
  pickup_at timestamptz,
  delivered_at timestamptz,
  delivery_latitude decimal(10,8),
  delivery_longitude decimal(11,8),
  
  -- Failure handling
  failure_reason_id uuid references public.failure_reasons(id),
  failure_notes text,
  failed_at timestamptz,
  
  -- Revision tracking
  revision_count int default 0,
  revision_notes text,
  
  -- POD (Proof of Delivery)
  pod_photo_url text,
  signature_url text,
  receiver_name text,
  
  -- File storage
  invoice_file_url text,
  
  -- Metadata
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.invoices enable row level security;

-- All authenticated users can read invoices
create policy "invoices_select_all" on public.invoices 
  for select using (auth.uid() is not null);

-- Finance can insert invoices
create policy "invoices_insert_finance" on public.invoices 
  for insert with check (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'finance'
    )
  );

-- Finance can update any invoice
create policy "invoices_update_finance" on public.invoices 
  for update using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'finance'
    )
  );

-- GA Admin can update invoices (for assignment)
create policy "invoices_update_ga_admin" on public.invoices 
  for update using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'ga_admin'
    )
  );

-- Kurir can update invoices assigned to them
create policy "invoices_update_kurir" on public.invoices 
  for update using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'kurir'
    ) and assigned_to = auth.uid()
  );

-- Create indexes for better performance
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_assigned_to on public.invoices(assigned_to);
create index if not exists idx_invoices_customer_id on public.invoices(customer_id);
create index if not exists idx_invoices_invoice_date on public.invoices(invoice_date);
create index if not exists idx_invoices_invoice_number on public.invoices(invoice_number);

-- ============================================
-- INVOICE STATUS HISTORY TABLE (Audit Trail)
-- ============================================
create table if not exists public.invoice_status_history (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  old_status invoice_status,
  new_status invoice_status not null,
  changed_by uuid references public.users(id),
  changed_at timestamptz default now(),
  latitude decimal(10,8),
  longitude decimal(11,8),
  notes text,
  metadata jsonb -- For additional data like failure reasons, signatures, etc.
);

alter table public.invoice_status_history enable row level security;

-- All authenticated users can read history
create policy "history_select_all" on public.invoice_status_history 
  for select using (auth.uid() is not null);

-- All authenticated users can insert history
create policy "history_insert_all" on public.invoice_status_history 
  for insert with check (auth.uid() is not null);

create index if not exists idx_history_invoice_id on public.invoice_status_history(invoice_id);
create index if not exists idx_history_changed_at on public.invoice_status_history(changed_at);

-- ============================================
-- ATTACHMENTS TABLE
-- ============================================
create table if not exists public.attachments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text, -- 'invoice', 'pod_photo', 'signature', 'other'
  file_size int,
  uploaded_by uuid references public.users(id),
  uploaded_at timestamptz default now()
);

alter table public.attachments enable row level security;

-- All authenticated users can read attachments
create policy "attachments_select_all" on public.attachments 
  for select using (auth.uid() is not null);

-- All authenticated users can insert attachments
create policy "attachments_insert_all" on public.attachments 
  for insert with check (auth.uid() is not null);

create index if not exists idx_attachments_invoice_id on public.attachments(invoice_id);

-- ============================================
-- TRIGGER: Auto-create user profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'kurir')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row
  execute function public.update_updated_at();

create trigger customers_updated_at
  before update on public.customers
  for each row
  execute function public.update_updated_at();

create trigger invoices_updated_at
  before update on public.invoices
  for each row
  execute function public.update_updated_at();

-- ============================================
-- TRIGGER: Auto-record status changes
-- ============================================
-- NOTE:
-- The application writes to `invoice_status_history` explicitly (and includes rich `metadata`).
-- If you also enable a database trigger that auto-records status changes, you'll get duplicate
-- timeline entries. For that reason, the auto-history trigger is intentionally NOT created here.
