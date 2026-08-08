"use client"

export function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121]">
      {children}
    </div>
  )
}