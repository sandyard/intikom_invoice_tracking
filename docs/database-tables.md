# Dokumentasi Database (Per Table)

Dokumen ini menjelaskan struktur tabel utama untuk **Intikom Invoice Tracker**, mengacu pada `scripts/001_create_schema.sql`.

## 1) `public.users`
**Tujuan**: Profil aplikasi yang memperluas `auth.users` (role, nama, status aktif).

**Primary Key**
- `id` (uuid): PK, FK ke `auth.users(id)` (on delete cascade)

**Kolom**
- `email` (text, not null)
- `name` (text, not null)
- `role` (`user_role`, not null, default `'kurir'`)
- `phone` (text, nullable)
- `is_active` (boolean, default true)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**Relasi**
- `users.id` → `auth.users.id`

**RLS/Policy ringkas**
- Select: semua user bisa membaca (`users_select_all`)
- Update: user hanya bisa update profil sendiri (`users_update_own`)
- Insert: mengikuti policy di schema (untuk bootstrap disarankan izinkan insert self)

**Trigger**
- `users_updated_at`: auto update `updated_at` sebelum update.

---

## 2) `public.customers`
**Tujuan**: Master data customer.

**Primary Key**
- `id` (uuid): PK (default `uuid_generate_v4()`)

**Kolom**
- `name` (text, not null)
- `address` (text, nullable)
- `city` (text, nullable)
- `phone` (text, nullable)
- `email` (text, nullable)
- `pic_name` (text, nullable)
- `created_by` (uuid, nullable, FK ke `public.users(id)`)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**Relasi**
- `customers.created_by` → `users.id`

**RLS/Policy ringkas**
- Select: semua user terautentikasi (`customers_select_all`)
- Insert/Update/Delete: hanya role `finance`

**Trigger**
- `customers_updated_at`: auto update `updated_at`.

---

## 3) `public.failure_reasons`
**Tujuan**: Master alasan gagal delivery.

**Primary Key**
- `id` (uuid): PK (default `uuid_generate_v4()`)

**Kolom**
- `code` (text, not null, unique) — contoh: `CLOSED`, `WRONG_ADDRESS`, `OTHER`
- `description` (text, not null)
- `is_active` (boolean, default true)
- `created_at` (timestamptz, default now())

**RLS/Policy ringkas**
- Select: semua user terautentikasi
- Manage (insert/update/delete): hanya role `finance`

**Seed default**
- Terdapat seed termasuk `OTHER` (UI kurir biasanya mewajibkan notes untuk `OTHER`).

---

## 4) `public.invoices`
**Tujuan**: Data invoice + status tracking + assignment + delivery proof (POD).

**Primary Key**
- `id` (uuid): PK (default `uuid_generate_v4()`)

**Kolom identitas & customer (snapshot)**
- `invoice_number` (text, not null, unique)
- `customer_id` (uuid, nullable, FK `customers.id`)
- `customer_name` (text, not null)
- `customer_address` (text, nullable)
- `customer_city` (text, nullable)
- `customer_pic` (text, nullable)

**Kolom invoice**
- `pic` (text, nullable) — PIC internal/penanggung jawab invoice
- `invoice_date` (date, not null)
- `due_date` (date, nullable)
- `amount` (decimal(15,2), nullable)
- `description` (text, nullable)

**Kolom status & assignment**
- `status` (`invoice_status`, default `'draft'`)
- `assigned_to` (uuid, nullable, FK `users.id`) — kurir yang ditugaskan
- `assigned_at` (timestamptz, nullable)
- `assigned_by` (uuid, nullable, FK `users.id`) — GA Admin yang assign

**Kolom delivery**
- `pickup_at` (timestamptz, nullable)
- `delivered_at` (timestamptz, nullable)
- `delivery_latitude` (decimal(10,8), nullable)
- `delivery_longitude` (decimal(11,8), nullable)

**Kolom gagal & revision**
- `failure_reason_id` (uuid, nullable, FK `failure_reasons.id`)
- `failure_notes` (text, nullable)
- `failed_at` (timestamptz, nullable)
- `revision_count` (int, default 0)
- `revision_notes` (text, nullable)

**Kolom POD**
- `pod_photo_url` (text, nullable)
- `signature_url` (text, nullable)
- `receiver_name` (text, nullable)

**Kolom file & audit**
- `invoice_file_url` (text, nullable)
- `created_by` (uuid, nullable, FK `users.id`)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**Relasi**
- `invoices.customer_id` → `customers.id`
- `invoices.assigned_to` → `users.id`
- `invoices.assigned_by` → `users.id`
- `invoices.failure_reason_id` → `failure_reasons.id`
- `invoices.created_by` → `users.id`

**Index penting**
- `idx_invoices_status` (status)
- `idx_invoices_assigned_to` (assigned_to)
- `idx_invoices_customer_id` (customer_id)
- `idx_invoices_invoice_date` (invoice_date)
- `idx_invoices_invoice_number` (invoice_number)

**RLS/Policy ringkas**
- Select: semua user terautentikasi
- Insert: `finance`
- Update: `finance` (semua), `ga_admin` (assignment), `kurir` (hanya invoice yang `assigned_to = auth.uid()`)

**Trigger**
- `invoices_updated_at`: auto update `updated_at`.

---

## 5) `public.invoice_status_history`
**Tujuan**: Audit trail/timeline perubahan status invoice.

**Primary Key**
- `id` (uuid): PK (default `uuid_generate_v4()`)

**Kolom**
- `invoice_id` (uuid, FK `invoices.id` on delete cascade)
- `old_status` (`invoice_status`, nullable)
- `new_status` (`invoice_status`, not null)
- `changed_by` (uuid, nullable, FK `users.id`)
- `changed_at` (timestamptz, default now())
- `latitude` (decimal(10,8), nullable)
- `longitude` (decimal(11,8), nullable)
- `notes` (text, nullable)
- `metadata` (jsonb, nullable)

**Relasi**
- `invoice_status_history.invoice_id` → `invoices.id` (cascade delete)
- `invoice_status_history.changed_by` → `users.id`

**Index penting**
- `idx_history_invoice_id` (invoice_id)
- `idx_history_changed_at` (changed_at)

**RLS/Policy ringkas**
- Select: semua user terautentikasi
- Insert: semua user terautentikasi (disarankan tetap batasi via app/role bila diperlukan)

**Catatan implementasi**
- Aplikasi melakukan insert ke tabel ini saat:
  - create/import invoice
  - bulk mark ready to pickup
  - assignment/unassign
  - kurir start/complete/fail
  - finance revision actions

---

## 6) `public.attachments`
**Tujuan**: Lampiran file per invoice (opsional, selain POD/signature URL).

**Primary Key**
- `id` (uuid): PK (default `uuid_generate_v4()`)

**Kolom**
- `invoice_id` (uuid, FK `invoices.id` on delete cascade)
- `file_name` (text, not null)
- `file_url` (text, not null)
- `file_type` (text, nullable) — contoh: `invoice`, `pod_photo`, `signature`, `other`
- `file_size` (int, nullable)
- `uploaded_by` (uuid, nullable, FK `users.id`)
- `uploaded_at` (timestamptz, default now())

**Relasi**
- `attachments.invoice_id` → `invoices.id`
- `attachments.uploaded_by` → `users.id`

**Index penting**
- `idx_attachments_invoice_id` (invoice_id)

**RLS/Policy ringkas**
- Select/Insert: semua user terautentikasi (sesuaikan bila ingin lebih ketat)

---

## 7) Enums
### `user_role`
- `finance`
- `ga_admin`
- `kurir`

### `invoice_status`
- `draft`
- `ready_to_pickup`
- `assigned`
- `on_delivery`
- `delivered`
- `failed`
- `revision`

---

## 8) Auth trigger penting
### `public.handle_new_user()` (trigger di `auth.users`)
Saat user signup, sistem mencoba membuat row pada `public.users` (id/email/name/role dari metadata).

Jika signup gagal karena RLS pada `public.users`, perbaiki policy insert agar mengizinkan user melakukan insert untuk dirinya sendiri (bootstrap).

