'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  LayoutDashboard,
  Upload,
  Users,
  Truck,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  Building2,
  AlertTriangle,
  History,
} from 'lucide-react'
import type { User, UserRole } from '@/lib/types'
import { ROLE_CONFIG } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: UserRole[]
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['admin', 'finance', 'ga_admin', 'kurir'],
  },
  {
    href: '/dashboard/invoices',
    label: 'Invoices',
    icon: <FileText className="h-5 w-5" />,
    roles: ['admin', 'finance', 'ga_admin'],
  },
  {
    href: '/dashboard/import',
    label: 'Import Invoices',
    icon: <Upload className="h-5 w-5" />,
    roles: ['admin', 'finance'],
  },
  {
    href: '/dashboard/customers',
    label: 'Customers',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['admin', 'finance'],
  },
  {
    href: '/dashboard/assignments',
    label: 'Assignments',
    icon: <ClipboardList className="h-5 w-5" />,
    roles: ['admin', 'ga_admin'],
  },
  {
    href: '/dashboard/couriers',
    label: 'Couriers',
    icon: <Users className="h-5 w-5" />,
    roles: ['admin', 'ga_admin'],
  },
  {
    href: '/dashboard/deliveries',
    label: 'My Deliveries',
    icon: <Truck className="h-5 w-5" />,
    roles: ['admin', 'kurir'],
  },
  {
    href: '/dashboard/revision',
    label: 'Revision Queue',
    icon: <AlertTriangle className="h-5 w-5" />,
    roles: ['admin', 'finance'],
  },
  {
    href: '/dashboard/history',
    label: 'Audit History',
    icon: <History className="h-5 w-5" />,
    roles: ['admin', 'finance'],
  },
  {
    href: '/dashboard/users',
    label: 'User Management',
    icon: <Users className="h-5 w-5" />,
    roles: ['admin', 'finance'],
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['admin', 'finance'],
  },
]

interface DashboardNavProps {
  user: User
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const filteredNavItems = navItems.filter(item => item.roles.includes(user.role))

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Intikom</h1>
            <p className="text-xs text-muted-foreground">Invoice Tracker</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_CONFIG[user.role].label}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">Intikom</span>
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop nav */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:border-r lg:bg-background">
        <NavContent />
      </aside>

      {/* Mobile spacer */}
      <div className="h-16 lg:hidden" />
    </>
  )
}
