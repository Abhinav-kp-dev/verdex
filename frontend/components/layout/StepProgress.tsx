'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore } from '@/lib/store'

interface Step {
  id: number
  label: string
  sublabel: string
  href: string
  isDone: (s: ReturnType<typeof useStore.getState>) => boolean
  blockedBy?: string   // tooltip shown when not done
}

const STEPS: Step[] = [
  {
    id: 1,
    label: 'Load Data',
    sublabel: 'Dashboard',
    href: '/dashboard',
    isDone: (s) => !!s.state,
    blockedBy: 'Open Dashboard to load the supply chain state',
  },
  {
    id: 2,
    label: 'Plan',
    sublabel: 'Run Optimizer',
    href: '/plan',
    isDone: (s) => !!s.optimizeResult,
    blockedBy: 'Run the LP optimizer on the Plan Delivery page first',
  },
  {
    id: 3,
    label: 'Simulate',
    sublabel: 'Inject Disruption',
    href: '/simulate',
    isDone: (s) => !!s.disruptedState,
    blockedBy: 'Apply a disruption on the Simulate page first',
  },
  {
    id: 4,
    label: 'Recover',
    sublabel: 'Re-Optimize',
    href: '/reoptimize',
    isDone: (s) => !!s.reoptimizeResult,
    blockedBy: 'Run the re-optimizer after simulating a disruption',
  },
  {
    id: 5,
    label: 'Report',
    sublabel: 'Results & AI',
    href: '/results',
    isDone: (s) => !!s.optimizeResult,
    blockedBy: 'Run the optimizer first to generate reports',
  },
]

// Pages where we don't show the bar (supporting/utility pages)
const HIDDEN_ON = ['/research']

export default function StepProgress() {
  const pathname = usePathname()
  const store = useStore()

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null

  const activeIdx = STEPS.findIndex((s) => pathname.startsWith(s.href))
  const totalDone = STEPS.filter((s) => s.isDone(store)).length

  return (
    <div
      className="sticky top-0 z-30 border-b border-[var(--border)] px-6 py-0"
      style={{ background: 'var(--surface-2)' }}
    >
      <div className="flex items-center gap-0 max-w-[900px] py-3">
        {STEPS.map((step, i) => {
          const done = step.isDone(store)
          const active = i === activeIdx
          const isLast = i === STEPS.length - 1

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none min-w-0">
              {/* Step node */}
              <Link
                href={step.href}
                className="flex flex-col items-center group shrink-0"
                title={!done && !active ? step.blockedBy : step.sublabel}
              >
                {/* Circle */}
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                    transition-all duration-200 ring-offset-[var(--bg)]
                    ${active
                      ? 'bg-[var(--accent)] text-white shadow-[0_0_0_3px_var(--surface-2),0_0_0_5px_var(--accent)] scale-110'
                      : done
                      ? 'bg-[var(--accent)] text-white opacity-80 group-hover:opacity-100'
                      : 'border-2 border-[var(--border-2)] text-[var(--text-3)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]'
                    }
                  `}
                >
                  {done && !active ? (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    mt-1 text-[10px] font-medium leading-tight text-center whitespace-nowrap
                    transition-colors duration-150
                    ${active
                      ? 'text-[var(--accent)]'
                      : done
                      ? 'text-[var(--text-2)]'
                      : 'text-[var(--text-3)] group-hover:text-[var(--text-2)]'
                    }
                  `}
                >
                  {step.label}
                </span>
              </Link>

              {/* Connector */}
              {!isLast && (
                <div className="flex-1 mx-1.5 mt-[-10px] relative h-px min-w-[12px]">
                  <div className="absolute inset-0 bg-[var(--border-2)]" />
                  {/* Fill based on whether the left step is done */}
                  <div
                    className="absolute inset-0 bg-[var(--accent)] transition-all duration-500 origin-left"
                    style={{ transform: `scaleX(${done ? 1 : 0})` }}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Progress label */}
        <div className="ml-4 shrink-0 text-right hidden sm:block">
          <div className="text-[10px] text-[var(--text-3)] leading-tight">Progress</div>
          <div className="text-xs font-semibold text-[var(--text-2)]">{totalDone}/{STEPS.length}</div>
        </div>
      </div>
    </div>
  )
}
