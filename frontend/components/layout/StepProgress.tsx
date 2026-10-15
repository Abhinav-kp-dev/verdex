'use client'

interface StepProgressProps {
  steps: string[]
  currentStep: number
  completedSteps: number[]
}

export default function StepProgress({ steps, currentStep, completedSteps }: StepProgressProps) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isDone = completedSteps.includes(index)
        const isLast = index === steps.length - 1

        return (
          <div key={index} className="flex items-start flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                  isActive
                    ? 'bg-[var(--accent)] text-black font-semibold'
                    : isDone
                    ? 'border border-[var(--accent)] text-[var(--text-2)] bg-transparent'
                    : 'border border-[var(--border-2)] text-[var(--text-3)] bg-transparent'
                }`}
              >
                {isDone && !isActive ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className="text-2xs text-[var(--text-2)] mt-1 text-center max-w-[64px]">
                {step}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 h-px bg-[var(--border-2)] mt-3.5 mx-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}
