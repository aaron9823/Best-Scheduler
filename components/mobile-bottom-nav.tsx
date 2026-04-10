"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, House } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto grid max-w-3xl grid-cols-2">
        {items.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-blue-600")} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
