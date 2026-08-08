import {
  DashboardShell,
} from "@/components/dashboard/dashboard-shell"

import {
  AuthGuard,
} from "@/components/dashboard/auth-guard"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <DashboardShell>
        {children}
      </DashboardShell>
    </AuthGuard>
  )
}