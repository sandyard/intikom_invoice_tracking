'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MapPin, Phone, Clock, CheckCircle, XCircle, Truck, Package } from 'lucide-react'
import { STATUS_CONFIG, type Invoice, type FailureReason } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DeliveryModal } from './delivery-modal'

interface DeliveryListProps {
  deliveries: Invoice[]
  completedToday: Invoice[]
  failureReasons: FailureReason[]
  userId: string
}

export function DeliveryList({ deliveries, completedToday, failureReasons, userId }: DeliveryListProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [modalAction, setModalAction] = useState<'start' | 'complete' | 'fail' | null>(null)

  const pendingDeliveries = deliveries.filter(d => d.status === 'assigned')
  const activeDeliveries = deliveries.filter(d => d.status === 'on_delivery')

  const openModal = (invoice: Invoice, action: 'start' | 'complete' | 'fail') => {
    setSelectedInvoice(invoice)
    setModalAction(action)
  }

  const closeModal = () => {
    setSelectedInvoice(null)
    setModalAction(null)
  }

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const DeliveryCard = ({ invoice, showActions = true }: { invoice: Invoice; showActions?: boolean }) => {
    const statusConfig = STATUS_CONFIG[invoice.status]
    const isActive = invoice.status === 'on_delivery'

    return (
      <Card className={cn(isActive && 'border-orange-300 bg-orange-50/50')}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{invoice.invoice_number}</CardTitle>
              <CardDescription>{invoice.customer_name}</CardDescription>
            </div>
            <Badge 
              variant="secondary"
              className={cn(statusConfig.bgColor, statusConfig.color, 'border-0')}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Address */}
          {invoice.customer_address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p>{invoice.customer_address}</p>
                {invoice.customer_city && (
                  <p className="text-muted-foreground">{invoice.customer_city}</p>
                )}
              </div>
            </div>
          )}

          {/* PIC */}
          {invoice.customer_pic && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>PIC: {invoice.customer_pic}</span>
            </div>
          )}

          {/* Amount */}
          <div className="flex items-center justify-between text-sm p-2 bg-muted rounded-lg">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{formatAmount(invoice.amount)}</span>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 pt-2">
              {invoice.status === 'assigned' && (
                <Button 
                  className="flex-1"
                  onClick={() => openModal(invoice, 'start')}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Start Delivery
                </Button>
              )}
              {invoice.status === 'on_delivery' && (
                <>
                  <Button 
                    className="flex-1"
                    onClick={() => openModal(invoice, 'complete')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => openModal(invoice, 'fail')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Failed
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="gap-1">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Pending</span>
            <span className="text-xs">({pendingDeliveries.length})</span>
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Active</span>
            <span className="text-xs">({activeDeliveries.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Done</span>
            <span className="text-xs">({completedToday.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingDeliveries.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending deliveries</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back later for new assignments
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingDeliveries.map((delivery) => (
                <DeliveryCard key={delivery.id} invoice={delivery} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeDeliveries.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No active deliveries</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a delivery from the Pending tab
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeDeliveries.map((delivery) => (
                <DeliveryCard key={delivery.id} invoice={delivery} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedToday.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No deliveries completed today</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {completedToday.map((delivery) => (
                <DeliveryCard key={delivery.id} invoice={delivery} showActions={false} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delivery Modal */}
      {selectedInvoice && modalAction && (
        <DeliveryModal
          invoice={selectedInvoice}
          action={modalAction}
          failureReasons={failureReasons}
          onClose={closeModal}
        />
      )}
    </>
  )
}
