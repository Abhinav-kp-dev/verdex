interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  status?: 'good' | 'warn' | 'bad'
}

export default function MetricCard({ label, value, unit, status }: MetricCardProps) {
  const statusDot = status
    ? {
        good: 'bg-green-400',
        warn: 'bg-amber-400',
        bad: 'bg-red-400',
      }[status]
    : null

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-[var(--text-2)]">{label}</div>
        {statusDot && <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />}
      </div>
      <div className="font-mono text-xl font-semibold text-[var(--text)]">{value}</div>
      {unit && <div className="text-xs text-[var(--text-2)] mt-1">{unit}</div>}
    </div>
  )
}
