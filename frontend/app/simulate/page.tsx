'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as Select from '@radix-ui/react-select'

import { useStore } from '@/lib/store'
import * as api from '@/lib/api'
import type { SimulateOut } from '@/lib/types'
import MetricCard from '@/components/ui/MetricCard'
import PageHeader from '@/components/ui/PageHeader'
import StepProgress from '@/components/layout/StepProgress'
import NetworkMap from '@/components/ui/NetworkMap'

const WORKFLOW_STEPS = ['Configure', 'Plan', 'Simulate', 'Re-Optimize']

const DISRUPTION_OPTIONS = [
  { value: 'truck_breakdown', label: 'Truck Breaks Down', needsTarget: 'truck' },
  { value: 'cold_storage_failure', label: 'Cold Storage Loses Power', needsTarget: 'storage' },
  { value: 'demand_shock', label: 'Demand Shock — Market Surge', needsTarget: 'market' },
  { value: 'heatwave', label: 'Heatwave — Temperature Shock', needsTarget: null },
  { value: 'road_closure', label: 'Road Closure', needsTarget: 'route' },
]

const DISRUPTION_DESCRIPTIONS: Record<string, string> = {
  truck_breakdown: 'Marks the selected truck as unavailable, forcing rerouting of its allocated batches.',
  cold_storage_failure: 'Takes the selected cold storage facility offline, impacting all batches staged there.',
  demand_shock: 'Doubles demand at the selected market, straining supply and increasing unmet demand.',
  heatwave: 'Raises ambient temperature across the network, accelerating spoilage for all in-transit batches.',
  road_closure: 'Closes the selected route, forcing all allocations to find alternate paths.',
}

const chevronDown = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const checkIcon = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Select.Item
      value={value}
      className="flex items-center justify-between px-3 py-1.5 text-sm text-[var(--text)] cursor-pointer hover:bg-[var(--border)] outline-none data-[highlighted]:bg-[var(--border)] rounded-sm"
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="text-[var(--accent)]">{checkIcon}</Select.ItemIndicator>
    </Select.Item>
  )
}


export default function SimulatePage() {
  const { state, optimizeResult, disruptedState, disruptionDesc, setState, setDisruptedState } = useStore()

  const [disruptionType, setDisruptionType] = useState('truck_breakdown')
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state) {
      api.fetchState().then((s) => setState(s)).catch(() => {})
    }
  }, [])

  // Reset target when disruption type changes
  useEffect(() => {
    setTargetId('')
  }, [disruptionType])

  const selected = DISRUPTION_OPTIONS.find((d) => d.value === disruptionType)!
  const needsTarget = selected.needsTarget

  function getTargetOptions(): { id: string; label: string }[] {
    if (!state) return []
    if (needsTarget === 'truck') {
      return Object.values(state.trucks).map((t) => ({ id: t.truck_id, label: t.truck_id }))
    }
    if (needsTarget === 'storage') {
      return Object.values(state.storage_facilities).map((s) => ({ id: s.storage_id, label: s.storage_id }))
    }
    if (needsTarget === 'market') {
      return Object.values(state.markets).map((m) => ({ id: m.market_id, label: m.market_id }))
    }
    if (needsTarget === 'route') {
      return Object.values(state.routes).map((r) => ({ id: r.route_id, label: `${r.route_id} (${r.source} → ${r.destination})` }))
    }
    return []
  }

  async function applyDisruption() {
    if (!state) return
    setLoading(true)
    setError(null)
    try {
      const result: SimulateOut = await api.simulate({
        state,
        disruption_type: disruptionType,
        target_id: needsTarget && targetId ? targetId : undefined,
      })
      setDisruptedState(result.disrupted_state, result.description)
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const targetOptions = getTargetOptions()

  const completedSteps = optimizeResult ? [0, 1] : []

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Step progress */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4">
        <StepProgress
          steps={WORKFLOW_STEPS}
          currentStep={2}
          completedSteps={optimizeResult ? [0, 1] : []}
        />
      </div>

      <PageHeader
        title="Simulate Disruption"
        description="Inject a real-world event into the network."
      />

      {/* Gate: require optimize result */}
      {!optimizeResult ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-8 text-center">
          <div className="text-sm text-[var(--text-2)] mb-1">Run the optimizer first</div>
          <div className="text-xs text-[var(--text-3)] mb-4">You need an optimized plan before simulating a disruption.</div>
          <Link
            href="/plan"
            className="inline-flex items-center h-8 px-3 text-sm font-semibold bg-[var(--accent)] text-black rounded hover:bg-[var(--accent-dim)] transition-colors duration-150"
          >
            Go to Plan
          </Link>
        </div>
      ) : (
        <>
          {/* Controls card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
              Disruption Controls
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Disruption type select */}
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-2)]">Disruption type</label>
                <Select.Root value={disruptionType} onValueChange={setDisruptionType}>
                  <Select.Trigger className="flex items-center justify-between bg-[var(--surface-2)] border border-[var(--border-2)] rounded text-sm text-[var(--text)] h-8 px-3 w-full outline-none focus:border-[var(--accent)] transition-colors duration-150 data-[placeholder]:text-[var(--text-3)]">
                    <Select.Value />
                    <Select.Icon className="text-[var(--text-2)]">{chevronDown}</Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-[var(--surface-2)] border border-[var(--border-2)] rounded py-1 min-w-[220px]">
                      <Select.Viewport>
                        {DISRUPTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>

              {/* Conditional target select */}
              {needsTarget && (
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-2)]">
                    {needsTarget === 'truck' && 'Select truck'}
                    {needsTarget === 'storage' && 'Select storage facility'}
                    {needsTarget === 'market' && 'Select market'}
                    {needsTarget === 'route' && 'Select route'}
                  </label>
                  <Select.Root value={targetId} onValueChange={setTargetId}>
                    <Select.Trigger className="flex items-center justify-between bg-[var(--surface-2)] border border-[var(--border-2)] rounded text-sm text-[var(--text)] h-8 px-3 w-full outline-none focus:border-[var(--accent)] transition-colors duration-150 data-[placeholder]:text-[var(--text-3)]">
                      <Select.Value placeholder="Choose target..." />
                      <Select.Icon className="text-[var(--text-2)]">{chevronDown}</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="z-50 bg-[var(--surface-2)] border border-[var(--border-2)] rounded py-1 min-w-[220px] max-h-52 overflow-y-auto">
                        <Select.Viewport>
                          {targetOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-[var(--text-3)]">No options available</div>
                          ) : (
                            targetOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.label}
                              </SelectItem>
                            ))
                          )}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              )}
            </div>

            {/* Helper text */}
            <div className="text-xs text-[var(--text-2)]">
              {DISRUPTION_DESCRIPTIONS[disruptionType]}
            </div>

            {error && (
              <div className="text-xs text-[var(--red)]">{error}</div>
            )}

            <button
              onClick={applyDisruption}
              disabled={loading || (!!needsTarget && !targetId)}
              className="h-8 px-3 text-sm font-semibold bg-red-900 hover:bg-red-800 text-red-200 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {loading ? 'Applying...' : 'Apply Disruption'}
            </button>
          </div>

          {/* Results after disruption */}
          {disruptedState && state && (
            <>
              <div className="border-t border-[var(--border)]" />

              {/* KPI Cards */}
              <div className="grid grid-cols-3 gap-4">
                <MetricCard label="Disruption Type" value={selected.label} status="bad" />
                <MetricCard
                  label="Offline Routes"
                  value={Object.values(disruptedState.routes).filter((r) => !r.available).length}
                  unit={`of ${Object.values(disruptedState.routes).length} routes`}
                  status="warn"
                />
                <MetricCard
                  label="Offline Assets"
                  value={
                    Object.values(disruptedState.trucks).filter((t) => !t.available).length +
                    Object.values(disruptedState.storage_facilities).filter((s) => !s.available).length
                  }
                  unit="trucks + storage offline"
                  status="warn"
                />
              </div>

              {/* Scenario-specific impact panel */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                  <div className="text-sm font-semibold text-[var(--text)]">{disruptionDesc}</div>
                </div>

                {/* Truck breakdown: show which trucks and routes are now offline */}
                {disruptionType === 'truck_breakdown' && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Offline Trucks</div>
                      {Object.values(disruptedState.trucks).filter(t => !t.available).length === 0 ? (
                        <div className="text-xs text-[var(--text-3)]">None</div>
                      ) : (
                        Object.values(disruptedState.trucks).filter(t => !t.available).map(t => (
                          <div key={t.truck_id} className="text-xs font-mono text-red-400 mb-1">
                            {t.truck_id} — was at {t.current_location}
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Blocked Routes</div>
                      {Object.values(disruptedState.routes).filter(r => !r.available).map(r => (
                        <div key={r.route_id} className="text-xs font-mono text-red-400 mb-1">
                          {r.route_id}: {r.source} → {r.destination}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cold storage: show offline facility and all closed routes */}
                {disruptionType === 'cold_storage_failure' && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Offline Storage</div>
                      {Object.values(disruptedState.storage_facilities).filter(s => !s.available).map(s => (
                        <div key={s.storage_id} className="text-xs font-mono text-red-400 mb-1">
                          {s.storage_id} — capacity {s.capacity.toLocaleString()} kg now unavailable
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Closed Routes</div>
                      {Object.values(disruptedState.routes).filter(r => !r.available).map(r => (
                        <div key={r.route_id} className="text-xs font-mono text-red-400 mb-1">
                          {r.route_id}: {r.source} → {r.destination}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Demand shock: compare demand before vs after */}
                {disruptionType === 'demand_shock' && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-2">Demand Surge (×2.5)</div>
                    <div className="grid grid-cols-3 gap-3">
                      {Object.values(disruptedState.markets).map(m => {
                        const original = state.markets[m.market_id]
                        const changed = original && m.demand !== original.demand
                        return (
                          <div key={m.market_id} className="p-2 rounded" style={{ background: 'var(--surface-2)', border: `1px solid ${changed ? '#ef4444' : 'var(--border)'}` }}>
                            <div className="text-[10px] font-mono text-[var(--text-3)]">{m.market_id}</div>
                            {changed ? (
                              <>
                                <div className="text-xs line-through text-[var(--text-3)]">{original.demand.toLocaleString()} kg</div>
                                <div className="text-sm font-bold text-red-400">{m.demand.toLocaleString()} kg</div>
                              </>
                            ) : (
                              <div className="text-sm font-bold text-[var(--text)]">{m.demand.toLocaleString()} kg</div>
                            )}
                            <div className="text-[10px] text-[var(--text-3)]">priority {m.priority}×</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Heatwave: show batch temperature increases */}
                {disruptionType === 'heatwave' && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-2">Temperature Impact (+12°C)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] text-[var(--text-3)] mb-1.5">Batch temperatures raised</div>
                        {Object.values(disruptedState.batches).slice(0, 6).map(b => {
                          const orig = state.batches[b.batch_id]
                          return (
                            <div key={b.batch_id} className="flex justify-between text-xs mb-1">
                              <span className="font-mono text-[var(--text-2)]">{b.batch_id}</span>
                              <span className="text-[var(--text-3)]">{orig?.temperature ?? '?'}°C</span>
                              <span style={{ color: '#ef4444' }}>→ {b.temperature}°C</span>
                            </div>
                          )
                        })}
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-3)] mb-1.5">Route risk factors elevated</div>
                        {Object.values(disruptedState.routes).slice(0, 6).map(r => {
                          const orig = state.routes[r.route_id]
                          return (
                            <div key={r.route_id} className="flex justify-between text-xs mb-1">
                              <span className="font-mono text-[var(--text-2)]">{r.route_id}</span>
                              <span className="text-[var(--text-3)]">{((orig?.risk_factor ?? 0) * 100).toFixed(0)}%</span>
                              <span style={{ color: '#f59e0b' }}>→ {(r.risk_factor * 100).toFixed(0)}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Road closure: show closed route details */}
                {disruptionType === 'road_closure' && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-2">Closed Routes</div>
                    {Object.values(disruptedState.routes).filter(r => !r.available).map(r => {
                      const orig = state.routes[r.route_id]
                      return (
                        <div key={r.route_id} className="p-2 rounded mb-2" style={{ background: 'var(--surface-2)', border: '1px solid #ef4444' }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-red-400">{r.route_id}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#ef444422', color: '#ef4444' }}>CLOSED</span>
                          </div>
                          <div className="text-xs text-[var(--text-2)]">
                            {r.source} → {r.destination} · {r.distance_km} km · {orig?.travel_time_hours.toFixed(1)}h transit
                          </div>
                          <div className="text-[11px] text-[var(--text-3)] mt-0.5">
                            CO₂ {r.co2_kg_per_km} kg/km · Risk was {((orig?.risk_factor ?? 0) * 100).toFixed(0)}%
                          </div>
                        </div>
                      )
                    })}
                    {Object.values(disruptedState.routes).filter(r => !r.available).length === 0 && (
                      <div className="text-xs text-[var(--text-3)]">No routes closed (select a route target first).</div>
                    )}
                  </div>
                )}
              </div>

              {/* Disrupted Network Map */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                  Disrupted Network
                </div>
                <div className="border border-[var(--border)] rounded-md overflow-hidden">
                  <NetworkMap state={disruptedState} height="380px" />
                </div>
                <div className="flex gap-4 flex-wrap text-[10px] text-[var(--text-3)]">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />Farm</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />Storage (active)</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />Storage (offline)</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Market</span>
                  <span className="ml-auto">Dashed red lines = closed routes</span>
                </div>
              </div>

              {/* Info note */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-[var(--text-2)]">
                    Disruption applied. Proceed to Re-Optimize to recover.
                  </div>
                  <div className="text-xs text-[var(--text-3)] mt-0.5">
                    The re-optimizer will adapt routes and allocations given current constraints.
                  </div>
                </div>
                <Link
                  href="/reoptimize"
                  className="shrink-0 inline-flex items-center h-8 px-3 text-sm font-semibold bg-[var(--accent)] text-black rounded hover:bg-[var(--accent-dim)] transition-colors duration-150"
                >
                  Re-Optimize →
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
