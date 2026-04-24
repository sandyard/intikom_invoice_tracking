'use client'

import { format } from 'date-fns'
import { STATUS_CONFIG, type InvoiceStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CheckCircle, Circle } from 'lucide-react'

interface HistoryItem {
  id: string
  old_status: InvoiceStatus | null
  new_status: InvoiceStatus
  changed_at: string
  notes: string | null
  changed_by_user?: { id: string; name: string } | null
}

interface InvoiceTimelineProps {
  history: HistoryItem[]
  currentStatus: InvoiceStatus
}

export function InvoiceTimeline({ history, currentStatus }: InvoiceTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No status changes yet
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {history.map((item, index) => {
        const config = STATUS_CONFIG[item.new_status]
        const isFirst = index === 0
        
        return (
          <div key={item.id} className="relative flex gap-3">
            {/* Line connector */}
            {index < history.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />
            )}
            
            {/* Icon */}
            <div className={cn(
              'relative z-10 flex-shrink-0 rounded-full p-1',
              isFirst ? config.bgColor : 'bg-muted'
            )}>
              {isFirst ? (
                <CheckCircle className={cn('h-4 w-4', config.color)} />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span className={cn('font-medium text-sm', isFirst && config.color)}>
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(item.changed_at), 'dd MMM yyyy, HH:mm')}
              </p>
              {item.changed_by_user && (
                <p className="text-xs text-muted-foreground">
                  by {item.changed_by_user.name}
                </p>
              )}
              {item.notes && (
                <p className="mt-1 text-sm text-muted-foreground italic">
                  &quot;{item.notes}&quot;
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
