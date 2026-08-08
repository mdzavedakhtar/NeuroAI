"use client"

import Link from "next/link"
import { Menu } from "lucide-react"

import { NeuroStackLogo } from "@/components/common/neurostack-logo"
import { ThemeToggle } from "@/components/common/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const navigation = [
  { name: "Features", href: "#features" },
  { name: "AI Search", href: "#ai-search" },
  { name: "Code Intelligence", href: "#code-intelligence" },
  { name: "Security", href: "#security" },
  { name: "Docs", href: "/docs" },
]

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/75 backdrop-blur-xl">
      <div className="ns-container flex h-16 items-center justify-between">
        <NeuroStackLogo />

        <nav className="hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />

        <Button
  variant="ghost"
  nativeButton={false}
  render={<Link href="/login" />}
>
  Sign in
</Button>

        <Button
  nativeButton={false}
  render={<Link href="/register" />}
>
  Get Started
</Button>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>

            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>
                  <NeuroStackLogo />
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-2 px-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {item.name}
                  </Link>
                ))}

                <div className="my-3 h-px bg-border" />

               <Button
  variant="outline"
  className="w-full"
  nativeButton={false}
  render={<Link href="/login" />}
>
  Sign in
</Button>
              <Button
  className="w-full"
  nativeButton={false}
  render={<Link href="/register" />}
>
  Get Started
</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}