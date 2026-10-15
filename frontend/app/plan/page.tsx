'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { useStore } from '@/lib/store'
import * as api from '@/lib/api'
import MetricCard from '@/components/ui/MetricCard'
import PageHeader from '@/components/ui/PageHeader'
import StepProgress from '@/components/layout/StepProgress'
import type { AllocationDecision, AllocationResult } from '@/lib/types'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const LAYOUT_BASE = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#6b8c70', family: 'var(--font-geist-mono), monospace', size: 11 },
  margin: { l: 40, r: 20, t: 32, b: 40 },
  xaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  yaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  legend: { bgcolor: 'transparent' },
}

const PLOT_CONFIG = { displayModeBar: false, responsive: true }

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

function SliderRow({ label, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-2)]">{label}</span>
        <span className="font-mono text-sm text-[var(--text)]">{value}</span>
      </div>
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="relative flex items-center w-full h-5 select-none touch-none"
      >
        <SliderPrimitive.Track className="relative h-px flex-1 bg-[var(--border-2)]">
          <SliderPrimitive.Range className="absolute h-full bg-[var(--accent)]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block w-4 h-4 rounded-full bg-[var(--accent)] focus:outline-none cursor-grab transition-opacity duration-150 hover:opacity-80" />
      </SliderPrimitive.Root>
    </div>
  )
}

function buildSankeyData(allocations: AllocationDecision[]) {
  const nodeSet: { id: string; type: 'farm' | 'storage' | 'market' }[] = []
  const seen = new Set<string>()

  function addNode(id: string, type: 'farm' | 'storage' | 'market') {
    if (!seen.has(id)) {
      seen.add(id)
      nodeSet.push({ id, type })
    }
  }

  for (const a of allocations) {
    addNode(a.farm_id, 'farm')
    if (a.storage_id) addNode(a.storage_id, 'storage')
    addNode(a.market_id, 'market')
  }

  const nodeIndex = new Map(nodeSet.map((n, i) => [n.id, i]))

  const colorMap = {
    farm: '#22c55e',
    storage: '#3b82f6',
    market: '#f59e0b',
  }

  const nodeColors = nodeSet.map((n) => colorMap[n.type])

  // Aggregate links to avoid duplicates
  const linkMap = new Map<string, { source: number; target: number; value: number }>()

  function addLink(sourceId: string, targetId: string, value: number) {
    const key = `${sourceId}|${targetId}`
    if (linkMap.has(key)) {
      linkMap.get(key)!.value += value
    } else {
      linkMap.set(key, {
        source: nodeIndex.get(sourceId)!,
        target: nodeIndex.get(targetId)!,
        value,
      })
    }
  }

  for (const a of allocations) {
    if (a.storage_id) {
      addLink(a.farm_id, a.storage_id, a.quantity)
      addLink(a.storage_id, a.market_id, a.delivered_qty)
    } else {
      addLink(a.farm_id, a.market_id, a.quantity)
    }
  }

  const links = Array.from(linkMap.values())

  return {
    data: [
      {
        type: 'sankey' as const,
        orientation: 'h' as const,
        node: {
          pad: 15,
          thickness: 14,
          line: { color: '#1c2b1e', width: 0.5 },
          label: nodeSet.map((n) => n.id),
          color: nodeColors,
        },
        link: {
          source: links.map((l) => l.source),
          target: links.map((l) => l.target),
          value: links.map((l) => l.value),
          color: links.map(() => 'rgba(34,197,94,0.15)'),
        },
      },
    ],
  }
}

export default function PlanPage() {
  const {
    state,
    optimizeResult,
    disruptedState,
    reoptimizeResult,
    setState,
    setOptimizeResult,
  } = useStore()

  const [spoilage, setSpoilage] = useState(10)
  const [cost, setCost] = useState(0.15)
  const [unmet, setUnmet] = useState(15)
  const [risk, setRisk] = useState(5)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state) {
      api.fetchState().then(setState).catch(() => {})
    }
  }, [state, setState])

  const completedSteps: number[] = []
  if (optimizeResult) completedSteps.push(0)
  if (disruptedState) completedSteps.push(1)
  if (reoptimizeResult) completedSteps.push(2)

  async function runOptimizer() {
    if (!state) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.optimize({
        state,
        lambda_weights: { spoilage, cost, unmet, risk },
      })
      setOptimizeResult(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Optimization failed')
    } finally {
      setLoading(false)
    }
  }

  const result = optimizeResult?.result ?? null
  const baselines = optimizeResult?.baseline_results ?? []

  const allMethods: AllocationResult[] = result
    ? [result, ...baselines]
    : []

  const dpsro = result
  const nearest = baselines.find((b) => b.method_name.toLowerCase().includes('nearest'))
  const cheapest = baselines.find((b) => b.method_name.toLowerCase().includes('cheapest'))

  const comparisonMethods = [
    { name: 'DPSRO', color: '#22c55e', data: dpsro },
    { name: 'Nearest', color: '#ef4444', data: nearest },
    { name: 'Cheapest', color: '#f59e0b', data: cheapest },
  ].filter((m) => m.data != null) as { name: string; color: string; data: AllocationResult }[]

  const sankeyData = result ? buildSankeyData(result.allocations) : null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Step progress */}
      <StepProgress
        steps={['Plan Delivery', 'Simulate', 'Re-Optimize', 'Reports']}
        currentStep={0}
        completedSteps={completedSteps}
      />

      <PageHeader
        title="Plan Delivery"
        description="Run the LP optimizer to find the optimal allocation."
      />

      {/* Controls panel */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 space-y-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
            Optimizer Weights
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SliderRow
              label="Spoilage weight (λ₁)"
              value={spoilage}
              min={0}
              max={50}
              step={0.5}
              onChange={setSpoilage}
            />
            <SliderRow
              label="Cost weight (λ₂)"
              value={cost}
              min={0}
              max={2}
              step={0.01}
              onChange={setCost}
            />
            <SliderRow
              label="Unmet demand (λ₃)"
              value={unmet}
              min={0}
              max={50}
              step={0.5}
              onChange={setUnmet}
            />
            <SliderRow
              label="Risk weight (λ₄)"
              value={risk}
              min={0}
              max={20}
              step={0.1}
              onChange={setRisk}
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-[var(--red)]">{error}</div>
        )}

        <button
          onClick={runOptimizer}
          disabled={loading}
          className="w-full h-9 bg-[var(--accent)] text-black font-semibold rounded text-sm transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && (
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {loading ? 'Running...' : 'Run Optimizer'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Dispatched"
              value={result.total_dispatched.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              unit="kg"
            />
            <MetricCard
              label="Delivered"
              value={result.total_delivered.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              unit="kg"
              status={result.demand_fulfillment_percentage >= 80 ? 'good' : result.demand_fulfillment_percentage >= 50 ? 'warn' : 'bad'}
            />
            <MetricCard
              label="Spoilage"
              value={`${result.spoilage_percentage.toFixed(1)}%`}
              status={result.spoilage_percentage <= 10 ? 'good' : result.spoilage_percentage <= 25 ? 'warn' : 'bad'}
            />
            <MetricCard
              label="Transport Cost"
              value={`$${result.total_transport_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
          </div>

          {/* Sankey */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
              Allocation Flow
            </div>
            {sankeyData && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
                <Plot
                  data={sankeyData.data as any}
                  layout={{
                    ...LAYOUT_BASE,
                    height: 380,
                    margin: { l: 20, r: 20, t: 20, b: 20 },
                  } as any}
                  config={PLOT_CONFIG}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          {/* Allocation table */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
              Allocation Detail
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                        Batch
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                        Route
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                        Qty Sent
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                        Delivered
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                        Spoilage
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.allocations.map((a, i) => (
                      <tr
                        key={i}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-2)]">
                          {a.batch_id}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[var(--text-2)]">
                          <span className="text-green-400">{a.farm_id}</span>
                          {a.storage_id && (
                            <>
                              <span className="text-[var(--text-3)] mx-1">&rarr;</span>
                              <span className="text-blue-400">{a.storage_id}</span>
                            </>
                          )}
                          <span className="text-[var(--text-3)] mx-1">&rarr;</span>
                          <span className="text-amber-400">{a.market_id}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-right text-[var(--text)]">
                          {a.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-right text-[var(--text)]">
                          {a.delivered_qty.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-right">
                          <span
                            className={
                              a.spoilage_fraction <= 0.1
                                ? 'text-green-400'
                                : a.spoilage_fraction <= 0.25
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }
                          >
                            {(a.spoilage_fraction * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-right text-[var(--text-2)]">
                          ${a.transport_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Method comparison */}
          {comparisonMethods.length > 1 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
                Method Comparison
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
                <Plot
                  data={comparisonMethods.map((m) => ({
                    type: 'bar' as const,
                    name: m.name,
                    x: ['Spoilage %', 'Demand Fulfillment %'],
                    y: [
                      m.data.spoilage_percentage,
                      m.data.demand_fulfillment_percentage,
                    ],
                    marker: { color: m.color },
                  }))}
                  layout={{
                    ...LAYOUT_BASE,
                    barmode: 'group',
                    height: 300,
                    yaxis: {
                      ...LAYOUT_BASE.yaxis,
                      ticksuffix: '%',
                    },
                  } as any}
                  config={PLOT_CONFIG}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
