'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import ChatBot from '@/components/ui/ChatBot'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inventory', label: 'Produce Inventory' },
  { href: '/destinations', label: 'Destinations & Demand' },
  { href: '/plan', label: 'Plan Delivery' },
  { href: '/simulate', label: 'Simulate Disruption' },
  { href: '/reoptimize', label: 'Re-Optimize' },
  { href: '/results', label: 'Results & Reports' },
  { href: '/carbon', label: 'Carbon Emissions' },
  { href: '/markdown', label: 'Markdown Pricing' },
  { href: '/research', label: 'Research Mode' },
]

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={
        isActive
          ? 'flex items-center h-8 px-3 text-sm text-[var(--text)] bg-[var(--surface)] border-l-2 border-[var(--accent)] pl-[10px] rounded transition-colors duration-150 cursor-pointer'
          : 'flex items-center h-8 px-3 text-sm text-[var(--text-2)] rounded transition-colors duration-150 cursor-pointer hover:text-[var(--text)] hover:bg-[var(--surface)]'
      }
    >
      {label}
    </Link>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const state = useStore((s) => s.state)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light') setTheme('light')
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 h-full w-60 flex flex-col border-r border-[var(--border)]"
        style={{ background: 'var(--bg)' }}
      >
        {/* Logo */}
        <div className="px-4 py-5">
          <div className="text-base font-semibold text-[var(--text)]">Verdex</div>
          <div className="text-2xs text-[var(--text-3)] mt-0.5">Supply Chain Optimizer</div>
        </div>

        {/* Separator */}
        <div className="border-t border-[var(--border)]" />

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* Separator */}
        <div className="border-t border-[var(--border)]" />

        {/* Bottom controls */}
        <div className="px-4 py-3 space-y-3">
          {/* Theme toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-2)]">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium border border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors duration-150"
              title="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* Data source indicator */}
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: state ? 'var(--accent)' : 'var(--text-3)' }}
            />
            <span className="text-xs text-[var(--text-2)]">
              {state ? 'Demo data' : 'No data loaded'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 min-h-screen" style={{ background: 'var(--bg)' }}>
        {children}
      </main>

      {/* Floating chatbot — visible on all pages */}
      <ChatBot />
    </div>
  )
}
