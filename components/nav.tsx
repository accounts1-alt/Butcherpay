"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  RefreshCw,
  Wallet,
  Settings,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entries/new", label: "Add entry", icon: PlusCircle },
  { href: "/lifecycle", label: "Lifecycle", icon: RefreshCw },
  { href: "/money-held", label: "Money held", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/connections", label: "Connections", icon: Plug },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="w-60 shrink-0 border-r border-border bg-card/50 p-4 flex flex-col gap-6">
      <div className="flex items-center gap-2 px-2 pt-1">
        <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
          B
        </div>
        <span className="font-semibold text-base tracking-tight">Butcherpay</span>
      </div>
      <ul className="space-y-0.5">
        {navLinks.map((link) => {
          const active = pathname?.startsWith(link.href);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
