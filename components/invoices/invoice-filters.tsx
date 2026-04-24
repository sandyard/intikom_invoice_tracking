'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { STATUS_CONFIG, type InvoiceStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useState, useTransition } from 'react'

interface InvoiceFiltersProps {
  currentStatus: string
  currentSearch: string
}

export function InvoiceFilters({ currentStatus, currentSearch }: InvoiceFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentSearch)

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    
    // Reset to page 1 when filters change
    params.delete('page')
    
    startTransition(() => {
      router.push(`/dashboard/invoices?${params.toString()}`)
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search })
  }

  const clearSearch = () => {
    setSearch('')
    updateFilters({ search: null })
  }

  const statuses: (InvoiceStatus | 'all')[] = [
    'all',
    'draft',
    'ready_to_pickup',
    'assigned',
    'on_delivery',
    'delivered',
    'failed',
    'revision',
  ]

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={isPending}>
          Search
        </Button>
      </form>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => {
          const isActive = currentStatus === status
          const config = status === 'all' 
            ? { label: 'All', bgColor: 'bg-secondary', color: 'text-secondary-foreground' }
            : STATUS_CONFIG[status]
          
          return (
            <button
              key={status}
              onClick={() => updateFilters({ status })}
              disabled={isPending}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                isActive
                  ? `${config.bgColor} ${config.color} ring-2 ring-offset-2 ring-primary`
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {config.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
