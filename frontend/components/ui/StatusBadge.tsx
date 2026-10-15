import { clsx } from 'clsx'

interface StatusBadgeProps {
  status: 'good' | 'warn' | 'bad' | 'neutral'
  children: React.ReactNode
}

export default function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border',
        {
          'bg-green-950 text-green-400 border-green-800': status === 'good',
          'bg-amber-950 text-amber-400 border-amber-800': status === 'warn',
          'bg-red-950 text-red-400 border-red-800': status === 'bad',
          'bg-[var(--surface-2)] text-[var(--text-2)] border-[var(--border)]': status === 'neutral',
        }
      )}
    >
      {children}
    </span>
  )
}
