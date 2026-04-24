-- Intikom Invoice Tracking System Database Migration
-- Version: 002
-- Description: Add internal PIC field to invoices

alter table public.invoices
  add column if not exists pic text;

