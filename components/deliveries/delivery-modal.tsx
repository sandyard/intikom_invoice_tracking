'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Camera, Eraser, MapPin, Loader2 } from 'lucide-react'
import type { Invoice, FailureReason } from '@/lib/types'
import { appendInvoiceStatusHistory } from '@/lib/invoice-history'

interface DeliveryModalProps {
  invoice: Invoice
  action: 'start' | 'complete' | 'fail'
  failureReasons: FailureReason[]
  onClose: () => void
}

export function DeliveryModal({ invoice, action, failureReasons, onClose }: DeliveryModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gettingLocation, setGettingLocation] = useState(false)

  // For complete action
  const [receiverName, setReceiverName] = useState('')
  const [podPhoto, setPodPhoto] = useState<File | null>(null)
  const [podPreview, setPodPreview] = useState<string | null>(null)
  const signatureRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // For fail action
  const [failureReasonId, setFailureReasonId] = useState('')
  const [failureNotes, setFailureNotes] = useState('')

  // Get location on mount
  useEffect(() => {
    if (action === 'complete' || action === 'fail') {
      getLocation()
    }
  }, [action])

  // Setup signature canvas
  useEffect(() => {
    if (action === 'complete' && signatureRef.current) {
      const canvas = signatureRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
    }
  }, [action])

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setGettingLocation(false)
      },
      (err) => {
        console.error('Location error:', err)
        setGettingLocation(false)
        // Don't block the action if location fails
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPodPhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPodPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSignatureStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    const canvas = signatureRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e 
      ? e.touches[0].clientX - rect.left 
      : e.clientX - rect.left
    const y = 'touches' in e 
      ? e.touches[0].clientY - rect.top 
      : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handleSignatureMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = signatureRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e 
      ? e.touches[0].clientX - rect.left 
      : e.clientX - rect.left
    const y = 'touches' in e 
      ? e.touches[0].clientY - rect.top 
      : e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handleSignatureEnd = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = signatureRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const getSignatureDataUrl = (): string | null => {
    const canvas = signatureRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }

  const handleSubmit = async () => {
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const actorId = user?.id ?? null

    if (action === 'start') {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'on_delivery',
          pickup_at: new Date().toISOString(),
        })
        .eq('id', invoice.id)

      if (error) {
        setError(error.message)
        return
      }

      await appendInvoiceStatusHistory(supabase as any, {
        invoice_id: invoice.id,
        old_status: invoice.status,
        new_status: 'on_delivery',
        changed_by: actorId,
        notes: 'Courier started delivery',
        metadata: { action: 'courier_start_delivery' },
      })
    } else if (action === 'complete') {
      if (!receiverName.trim()) {
        setError('Please enter the receiver name')
        return
      }

      // Upload POD photo if provided
      let podPhotoUrl = null
      if (podPhoto) {
        const fileName = `pod/${invoice.id}/${Date.now()}.jpg`
        const { data, error } = await supabase.storage
          .from('invoices')
          .upload(fileName, podPhoto)

        if (error) {
          console.error('POD upload error:', error)
        } else {
          const { data: urlData } = supabase.storage
            .from('invoices')
            .getPublicUrl(fileName)
          podPhotoUrl = urlData.publicUrl
        }
      }

      // Get signature
      const signatureDataUrl = getSignatureDataUrl()

      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivery_latitude: location?.lat || null,
          delivery_longitude: location?.lng || null,
          receiver_name: receiverName,
          pod_photo_url: podPhotoUrl,
          signature_url: signatureDataUrl,
        })
        .eq('id', invoice.id)

      if (error) {
        setError(error.message)
        return
      }

      await appendInvoiceStatusHistory(supabase as any, {
        invoice_id: invoice.id,
        old_status: invoice.status,
        new_status: 'delivered',
        changed_by: actorId,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        notes: `Delivered to ${receiverName.trim()}`,
        metadata: { action: 'courier_complete_delivery', receiver_name: receiverName.trim(), pod_photo_url: podPhotoUrl },
      })
    } else if (action === 'fail') {
      if (!failureReasonId) {
        setError('Please select a failure reason')
        return
      }

      const selectedReason = failureReasons.find(r => r.id === failureReasonId)
      if (selectedReason?.code === 'OTHER' && !failureNotes.trim()) {
        setError('Please provide details for the failure')
        return
      }

      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          delivery_latitude: location?.lat || null,
          delivery_longitude: location?.lng || null,
          failure_reason_id: failureReasonId,
          failure_notes: failureNotes || null,
        })
        .eq('id', invoice.id)

      if (error) {
        setError(error.message)
        return
      }

      await appendInvoiceStatusHistory(supabase as any, {
        invoice_id: invoice.id,
        old_status: invoice.status,
        new_status: 'failed',
        changed_by: actorId,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        notes: failureNotes.trim() || null,
        metadata: { action: 'courier_fail_delivery', failure_reason_id: failureReasonId },
      })
    }

    startTransition(() => {
      router.refresh()
      onClose()
    })
  }

  const getTitle = () => {
    switch (action) {
      case 'start': return 'Start Delivery'
      case 'complete': return 'Complete Delivery'
      case 'fail': return 'Report Failed Delivery'
    }
  }

  const getDescription = () => {
    switch (action) {
      case 'start': return `Start delivery for ${invoice.invoice_number}`
      case 'complete': return 'Capture proof of delivery'
      case 'fail': return 'Report why delivery failed'
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Location indicator */}
        {(action === 'complete' || action === 'fail') && (
          <div className="flex items-center gap-2 text-sm p-2 bg-muted rounded-lg">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {gettingLocation ? (
              <span className="text-muted-foreground">Getting location...</span>
            ) : location ? (
              <span className="text-green-600">Location captured</span>
            ) : (
              <span className="text-muted-foreground">Location unavailable</span>
            )}
          </div>
        )}

        {/* Start delivery content */}
        {action === 'start' && (
          <div className="space-y-4">
            <p>
              Confirm that you are starting delivery for:
            </p>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{invoice.customer_name}</p>
              {invoice.customer_address && (
                <p className="text-sm text-muted-foreground">{invoice.customer_address}</p>
              )}
            </div>
          </div>
        )}

        {/* Complete delivery content */}
        {action === 'complete' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receiver">Receiver Name *</Label>
              <Input
                id="receiver"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Who received the invoice?"
              />
            </div>

            <div className="space-y-2">
              <Label>POD Photo (Optional)</Label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="pod-photo"
                />
                <label
                  htmlFor="pod-photo"
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-accent"
                >
                  <Camera className="h-4 w-4" />
                  {podPhoto ? 'Change Photo' : 'Take Photo'}
                </label>
              </div>
              {podPreview && (
                <img
                  src={podPreview}
                  alt="POD Preview"
                  className="w-full max-w-xs rounded-lg border"
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Signature</Label>
                <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                  <Eraser className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <canvas
                ref={signatureRef}
                width={300}
                height={150}
                className="border rounded-lg touch-none w-full bg-white"
                onMouseDown={handleSignatureStart}
                onMouseMove={handleSignatureMove}
                onMouseUp={handleSignatureEnd}
                onMouseLeave={handleSignatureEnd}
                onTouchStart={handleSignatureStart}
                onTouchMove={handleSignatureMove}
                onTouchEnd={handleSignatureEnd}
              />
              <p className="text-xs text-muted-foreground">
                Sign above to confirm delivery
              </p>
            </div>
          </div>
        )}

        {/* Fail delivery content */}
        {action === 'fail' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Failure Reason *</Label>
              <Select value={failureReasonId} onValueChange={setFailureReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {failureReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                Additional Notes
                {failureReasons.find(r => r.id === failureReasonId)?.code === 'OTHER' && ' *'}
              </Label>
              <Textarea
                id="notes"
                value={failureNotes}
                onChange={(e) => setFailureNotes(e.target.value)}
                placeholder="Provide more details..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {action === 'start' && 'Start Delivery'}
            {action === 'complete' && 'Complete Delivery'}
            {action === 'fail' && 'Report Failed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
