'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import * as Select from '@radix-ui/react-select'

import { useStore } from '@/lib/store'
import * as api from '@/lib/api'
import type { SimulateOut } from '@/lib/types'
import MetricCard from '@/components/ui/MetricCard'
import PageHeader from '@/components/ui/PageHeader'
import StepProgress from '@/components/layout/StepProgress'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

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

const PLOTLY_LAYOUT_BASE = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#6b8c70', family: 'var(--font-geist-mono), monospace', size: 11 },
  margin: { l: 40, r: 20, t: 32, b: 40 },
  xaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  yaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  legend: { bgcolor: 'transparent' },
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

  // Build network chart data from disrupted state
  function buildNetworkChart() {
    const s = disruptedState
    if (!s) return null

    const farmX: number[] = []
    const farmY: number[] = []
    const farmText: string[] = []

    Object.values(s.farms).forEach((f) => {
      farmX.push(f.location_x)
      farmY.push(f.location_y)
      farmText.push(f.farm_id)
    })

    const storX: number[] = []
    const storY: number[] = []
    const storText: string[] = []
    const storColor: string[] = []

    Object.values(s.storage_facilities).forEach((sf) => {
      storX.push(sf.location_x)
      storY.push(sf.location_y)
      storText.push(sf.storage_id)
      storColor.push(sf.available ? '#3b82f6' : '#ef4444')
    })

    const mktX: number[] = []
    const mktY: number[] = []
    const mktText: string[] = []

    Object.values(s.markets).forEach((m) => {
      mktX.push(m.location_x)
      mktY.push(m.location_y)
      mktText.push(m.market_id)
    })

    // Route lines
    const routeShapes: Partial<Plotly.Shape>[] = []
    Object.values(s.routes).forEach((r) => {
      // Find endpoints
      const allNodes: Record<string, { x: number; y: number }> = {}
      Object.values(s.farms).forEach((f) => { allNodes[f.farm_id] = { x: f.location_x, y: f.location_y } })
      Object.values(s.storage_facilities).forEach((sf) => { allNodes[sf.storage_id] = { x: sf.location_x, y: sf.location_y } })
      Object.values(s.markets).forEach((m) => { allNodes[m.market_id] = { x: m.location_x, y: m.location_y } })

      const src = allNodes[r.source]
      const dst = allNodes[r.destination]
      if (!src || !dst) return

      routeShapes.push({
        type: 'line',
        x0: src.x, y0: src.y,
        x1: dst.x, y1: dst.y,
        line: {
          color: r.available ? '#1c2b1e' : '#ef444480',
          width: r.available ? 1 : 2,
          dash: r.available ? 'solid' : 'dot',
        },
      })
    })

    const data: Partial<Plotly.PlotData>[] = [
      {
        type: 'scatter',
        mode: 'markers+text',
        name: 'Farms',
        x: farmX,
        y: farmY,
        text: farmText,
        textposition: 'top center',
        marker: { color: '#22c55e', size: 10, symbol: 'square' },
      },
      {
        type: 'scatter',
        mode: 'markers+text',
        name: 'Storage',
        x: storX,
        y: storY,
        text: storText,
        textposition: 'top center',
        marker: { color: storColor, size: 10, symbol: 'diamond' },
      },
      {
        type: 'scatter',
        mode: 'markers+text',
        name: 'Markets',
        x: mktX,
        y: mktY,
        text: mktText,
        textposition: 'top center',
        marker: { color: '#f59e0b', size: 10, symbol: 'circle' },
      },
    ]

    const layout = {
      ...PLOTLY_LAYOUT_BASE,
      title: { text: 'Disrupted Network State', font: { color: '#6b8c70', size: 12 }, x: 0.02 },
      shapes: routeShapes,
      showlegend: true,
    }

    return { data, layout }
  }

  const networkChart = buildNetworkChart()
  const targetOptions = getTargetOptions()

  const completedSteps = optimizeResult ? [0, 1] : disruptedState ? [0, 1, 2] : optimizeResult ? [0, 1] : []

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
          {disruptedState && (
            <>
              <div className="border-t border-[var(--border)]" />

              {/* Metric cards */}
              <div className="grid grid-cols-3 gap-4">
                <MetricCard
                  label="Disruption Type"
                  value={selected.label}
                  status="bad"
                />
                <MetricCard
                  label="Affected Nodes"
                  value={
                    (() => {
                      // Count unavailable nodes/routes
                      const unavailRoutes = Object.values(disruptedState.routes).filter((r) => !r.available).length
                      const unavailStorage = Object.values(disruptedState.storage_facilities).filter((sf) => !sf.available).length
                      const unavailTrucks = Object.values(disruptedState.trucks).filter((t) => !t.available).length
                      return unavailRoutes + unavailStorage + unavailTrucks
                    })()
                  }
                  unit="nodes / routes unavailable"
                  status="warn"
                />
                <MetricCard
                  label="Description"
                  value={disruptionDesc.length > 40 ? disruptionDesc.slice(0, 40) + '...' : disruptionDesc || 'N/A'}
                  unit={disruptionDesc.length > 40 ? disruptionDesc : undefined}
                />
              </div>

              {/* Network chart */}
              {networkChart && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                    Disrupted Network
                  </div>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
                    <Plot
                      data={networkChart.data as any}
                      layout={networkChart.layout as any}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="text-xs text-[var(--text-3)]">
                    Red markers = offline storage. Dashed red lines = closed routes.
                  </div>
                </div>
              )}

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
                  Re-Optimize
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
