import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Butcherpay",
  description: "Payment reconciliation for the business",
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/entries/new", label: "Add entry" },
  { href: "/lifecycle", label: "Lifecycle" },
  { href: "/money-held", label: "Money held" },
  { href: "/settings", label: "Settings" },
  { href: "/connections", label: "Connections" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex min-h-full">
          <nav className="w-56 shrink-0 border-r border-black/10 dark:border-white/10 p-4">
            <div className="font-semibold text-lg mb-6">Butcherpay</div>
            <ul className="space-y-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
