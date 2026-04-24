'use client'

import { useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, UserRole } from '@/lib/types'
import { ROLE_CONFIG } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2 } from 'lucide-react'

interface UserManagementProps {
  currentUser: User
  users: User[]
}

export function UserManagement({ currentUser, users }: UserManagementProps) {
  const supabase = useMemo(() => createClient(), [])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const roleOptions = useMemo(() => Object.keys(ROLE_CONFIG) as UserRole[], [])

  const updateUser = async (id: string, patch: Partial<Pick<User, 'role' | 'is_active'>>) => {
    setError(null)
    setBusyUserId(id)
    try {
      const { error } = await supabase
        .from('users')
        .update(patch)
        .eq('id', id)
      if (error) throw new Error(error.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user')
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users</CardTitle>
          <Button
            variant="outline"
            onClick={() => startTransition(() => window.location.reload())}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser.id
                  const busy = busyUserId === u.id
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Select
                            value={u.role}
                            onValueChange={(value) => void updateUser(u.id, { role: value as UserRole })}
                            disabled={busy}
                          >
                            <SelectTrigger className="w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_CONFIG[r].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isSelf && <Badge variant="secondary">You</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.is_active}
                          onCheckedChange={(checked) => void updateUser(u.id, { is_active: checked })}
                          disabled={busy || isSelf}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Note: you can&apos;t deactivate your own account.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

