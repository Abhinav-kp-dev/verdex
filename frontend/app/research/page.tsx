'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import * as api from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'

export default function ResearchPage() {
  const {
    state,
    setState,
    lambdaWeights,
    optimizeResult,
    reoptimizeResult,
    attemptLog,
  } = useStore()

  useEffect(() => {
    if (!state) {
      api.fetchState().then((s) => setState(s)).catch(() => {})
    }
  }, [])

  const result = reoptimizeResult?.result ?? optimizeResult?.result ?? null

  const nPaths = result
    ? result.allocations.length
    : null
  const nMarkets = state ? Object.keys(state.markets).length : null
  const nBatches = state ? Object.keys(state.batches).length : null
  const nStorage = state ? Object.keys(state.storage_facilities).length : null
  const decisionVars =
    nPaths !== null && nMarkets !== null ? nPaths + nMarkets : null
  const constraints =
    nBatches !== null && nStorage !== null && nMarkets !== null
      ? nBatches + nStorage + nMarkets
      : null

  function exportJSON() {
    const storeSnap = {
      state,
      lambdaWeights,
      optimizeResult,
      reoptimizeResult,
      attemptLog,
    }
    const blob = new Blob([JSON.stringify(storeSnap, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'freshroute-results.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCSV() {
    if (attemptLog.length === 0) return
    const headers = [
      'attempt',
      'label',
      'what_changed',
      'objective_score',
      'spoilage_pct',
      'fulfillment_pct',
      'runtime_s',
    ]
    const rows = attemptLog.map((e) =>
      [
        e.attempt,
        JSON.stringify(e.label),
        JSON.stringify(e.what_changed),
        e.objective_score,
        e.spoilage_pct,
        e.fulfillment_pct,
        e.runtime_s,
      ].join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'freshroute-attempt-log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasResults = !!(optimizeResult || reoptimizeResult)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Research Mode"
        description="Optimizer internals, solver configuration, and experiment parameters."
      />

      {/* Optimizer Configuration */}
      <section>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          Optimizer Configuration
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider w-1/3">
                  Parameter
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="px-4 py-2.5 text-[var(--text-2)]">
                  <span className="font-mono">&lambda;&#8321;</span> spoilage weight
                </td>
                <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                  {lambdaWeights.spoilage}
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="px-4 py-2.5 text-[var(--text-2)]">
                  <span className="font-mono">&lambda;&#8322;</span> cost weight
                </td>
                <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                  {lambdaWeights.cost}
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="px-4 py-2.5 text-[var(--text-2)]">
                  <span className="font-mono">&lambda;&#8323;</span> unmet demand weight
                </td>
                <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                  {lambdaWeights.unmet}
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="px-4 py-2.5 text-[var(--text-2)]">
                  <span className="font-mono">&lambda;&#8324;</span> risk weight
                </td>
                <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                  {lambdaWeights.risk}
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="px-4 py-2.5 text-[var(--text-2)]">Solver</td>
                <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                  SciPy HiGHS (LP, interior-point)
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="px-4 py-2.5 text-[var(--text-2)]">Problem type</td>
                <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                  Multi-objective Linear Program
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-[var(--text-2)]">Feasibility</td>
                <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                  Always feasible (unmet demand slack variables)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* LP Problem Structure */}
      <section>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          LP Problem Structure
        </div>
        {result ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider w-1/3">
                    Property
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--text-2)]">Decision variables</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                    {decisionVars !== null ? decisionVars : '—'}{' '}
                    <span className="text-[var(--text-2)] text-xs">
                      ({nPaths} paths + {nMarkets} markets)
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--text-2)]">Constraints</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                    {constraints !== null ? constraints : '—'}{' '}
                    <span className="text-[var(--text-2)] text-xs">
                      ({nBatches} batches + {nStorage} storage + {nMarkets} markets)
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--text-2)]">Solver status</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                    {result.solver_status}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--text-2)]">Feasible</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                    {result.is_feasible ? 'true' : 'false'}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--text-2)]">Objective value J</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                    {result.objective_value.toFixed(4)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-[var(--text-2)]">Runtime</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text)]">
                    {(result.runtime_seconds * 1000).toFixed(1)} ms
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-8 text-center">
            <div className="text-sm text-[var(--text-2)] mb-1">No optimization result yet</div>
            <div className="text-xs text-[var(--text-3)]">Run the optimizer to see LP problem details</div>
          </div>
        )}
      </section>

      {/* Parameter Reference */}
      <section>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          Parameter Reference
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider w-16">
                  Symbol
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider w-48">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider w-24">
                  Default
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  symbol: 'λ₁',
                  name: 'Spoilage weight',
                  default: '10.0',
                  desc: 'Penalty per unit of spoilage fraction in the objective. Higher values bias the solver toward fresher routes.',
                },
                {
                  symbol: 'λ₂',
                  name: 'Cost weight',
                  default: '0.15',
                  desc: 'Penalty per unit of transport cost. Kept low relative to spoilage to avoid sacrificing freshness for marginal cost savings.',
                },
                {
                  symbol: 'λ₃',
                  name: 'Unmet demand weight',
                  default: '15.0',
                  desc: 'Penalty per unit of unmet market demand. Must exceed spoilage weight to ensure demand satisfaction dominates.',
                },
                {
                  symbol: 'λ₄',
                  name: 'Risk weight',
                  default: '5.0',
                  desc: 'Penalty per unit of route risk score. Discourages high-risk routes when safer alternatives exist at comparable cost.',
                },
                {
                  symbol: 'f_p',
                  name: 'Spoilage fraction',
                  default: 'computed',
                  desc: 'Per-path spoilage fraction derived from remaining shelf life and travel time. Serves as a constraint coefficient in the LP.',
                },
                {
                  symbol: 'c_p',
                  name: 'Unit transport cost',
                  default: 'computed',
                  desc: 'Cost per unit shipped along path p, summed over constituent route segments. Used directly in the cost term of the objective.',
                },
                {
                  symbol: 'r_p',
                  name: 'Risk score',
                  default: 'computed',
                  desc: 'Aggregate risk factor for path p, derived from route risk_factor values. Ranges [0, 1]; higher means more disruption-prone.',
                },
                {
                  symbol: 'u_m',
                  name: 'Unmet demand slack',
                  default: '≥ 0',
                  desc: 'Non-negative slack variable per market that absorbs infeasible demand. Enables a feasible solution even when supply is insufficient.',
                },
              ].map((row) => (
                <tr key={row.symbol} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-2.5 font-mono text-[var(--accent)] text-xs">
                    {row.symbol}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text)]">{row.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--text-2)] text-xs">
                    {row.default}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-2)] text-xs leading-relaxed">
                    {row.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Data Export */}
      <section>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          Data Export
        </div>
        {hasResults ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 flex flex-wrap gap-3">
            <button
              onClick={exportJSON}
              className="h-8 px-3 text-sm font-semibold bg-[var(--accent)] text-black rounded hover:bg-[var(--accent-dim)] transition-colors duration-150"
            >
              Export Results (JSON)
            </button>
            <button
              onClick={exportCSV}
              disabled={attemptLog.length === 0}
              className="h-8 px-3 text-sm font-semibold border border-[var(--border-2)] text-[var(--text-2)] rounded hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export Attempt Log (CSV)
            </button>
            {attemptLog.length === 0 && (
              <span className="self-center text-xs text-[var(--text-3)]">
                No attempt log entries recorded yet.
              </span>
            )}
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-8 text-center">
            <div className="text-sm text-[var(--text-2)] mb-1">No results to export</div>
            <div className="text-xs text-[var(--text-3)]">Complete the previous step first</div>
          </div>
        )}
      </section>
    </div>
  )
}
