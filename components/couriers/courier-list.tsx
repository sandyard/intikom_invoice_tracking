'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Users, Package, Truck, CheckCircle, XCircle } from 'lucide-react'
import type { User } from '@/lib/types'

interface CourierWithStats extends User {
  stats: {
    assigned: number
    on_delivery: number
    delivered: number
    failed: number
  }
}

interface CourierListProps {
  couriers: CourierWithStats[]
}

export function CourierList({ couriers }: CourierListProps) {
  if (couriers.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/20">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No couriers registered yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Couriers will appear here when they sign up with the Kurir role
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {couriers.map((courier) => {
        const totalDeliveries = courier.stats.delivered + courier.stats.failed
        const successRate = totalDeliveries > 0 
          ? Math.round((courier.stats.delivered / totalDeliveries) * 100) 
          : 100
        const activeCount = courier.stats.assigned + courier.stats.on_delivery

        return (
          <Card key={courier.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {courier.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">{courier.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{courier.email}</p>
                </div>
                <Badge variant={courier.is_active ? 'default' : 'secondary'}>
                  {courier.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact */}
              {courier.phone && (
                <p className="text-sm text-muted-foreground">{courier.phone}</p>
              )}

              {/* Active deliveries */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Active Deliveries</span>
                </div>
                <span className="text-lg font-bold">{activeCount}</span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Package className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                  <p className="text-lg font-bold text-blue-700">{courier.stats.assigned}</p>
                  <p className="text-xs text-blue-600">Assigned</p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="h-4 w-4 mx-auto text-green-500 mb-1" />
                  <p className="text-lg font-bold text-green-700">{courier.stats.delivered}</p>
                  <p className="text-xs text-green-600">Delivered</p>
                </div>
                <div className="p-2 bg-red-50 rounded-lg">
                  <XCircle className="h-4 w-4 mx-auto text-red-500 mb-1" />
                  <p className="text-lg font-bold text-red-700">{courier.stats.failed}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>

              {/* Success rate */}
              {totalDeliveries > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Success Rate</span>
                    <span className="font-medium">{successRate}%</span>
                  </div>
                  <Progress value={successRate} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
