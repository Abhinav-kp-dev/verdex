'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/lib/store'
import * as api from '@/lib/api'
import MetricCard from '@/components/ui/MetricCard'
import PageHeader from '@/components/ui/PageHeader'
import type { AllocationDecision, AllocationResult } from '@/lib/types'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const CITY_LABELS: Record<string, string> = {
  F1: 'Nashik', F2: 'Kolar', F3: 'Guntur',
  S1: 'Pune', S2: 'Bengaluru',
  M1: 'Mumbai', M2: 'Chennai', M3: 'Hyderabad',
}

const LAYOUT_BASE = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#6b8c70', family: 'monospace', size: 11 },
  margin: { l: 48, r: 20, t: 28, b: 48 },
  xaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  yaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  legend: { bgcolor: 'transparent', font: { color: '#6b8c70', size: 10 } },
}

const PLOT_CONFIG = { displayModeBar: false, responsive: true }

function co2ForAllocation(a: AllocationDecision, routes: Record<string, any>): number {
  let total = 0
  for (const rid of a.route_ids) {
    const r = routes[rid]
    if (r) total += r.co2_kg_per_km * r.distance_km
  }
  return total
}

function routeLabel(a: AllocationDecision): string {
  const parts = [a.farm_id]
  if (a.storage_id) parts.push(a.storage_id)
  parts.push(a.market_id)
  return parts.map(p => CITY_LABELS[p] ?? p).join(' → ')
}

export default function CarbonPage() {
  const { state, optimizeResult, setState } = useStore()
  const [localResult, setLocalResult] = useState<AllocationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const result = optimizeResult?.result ?? localResult

  // Fetch state if not loaded (e.g. after full-page reload)
  useEffect(() => {
    if (!state) {
      api.fetchState().then(s => setState(s)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!optimizeResult && !localResult && state) {
      setLoading(true)
      api.optimize({ state, lambda_weights: { spoilage: 10, cost: 0.15, unmet: 15, risk: 5, carbon: 0 } })
        .then(r => setLocalResult(r.result))
        .catch(() => setError('Failed to load optimizer data'))
        .finally(() => setLoading(false))
    }
  }, [state])

  const allocs = result?.allocations ?? []
  const routes = state?.routes ?? {}

  // Per-allocation CO₂
  const allocCO2 = allocs.map(a => ({
    label: routeLabel(a),
    co2: co2ForAllocation(a, routes),
    batch: a.batch_id,
    qty: a.quantity,
    cost: a.transport_cost,
    spoilage: a.spoilage_fraction,
  })).sort((a, b) => b.co2 - a.co2)

  const totalCO2 = allocCO2.reduce((s, a) => s + a.co2, 0)
  const avgCO2PerKg = allocs.length > 0 ? totalCO2 / (result?.total_delivered ?? 1) : 0

  // CO₂ by destination (market)
  const marketCO2: Record<string, number> = {}
  allocs.forEach(a => {
    const key = CITY_LABELS[a.market_id] ?? a.market_id
    marketCO2[key] = (marketCO2[key] ?? 0) + co2ForAllocation(a, routes)
  })

  // CO₂ by route type (refrigerated vs direct)
  let refrigCO2 = 0, directCO2 = 0
  allocs.forEach(a => {
    for (const rid of a.route_ids) {
      const r = routes[rid]
      if (!r) continue
      const kg = r.co2_kg_per_km * r.distance_km
      if (r.co2_kg_per_km >= 0.8) refrigCO2 += kg
      else directCO2 += kg
    }
  })

  // CO₂ vs spoilage scatter
  const scatterCO2 = allocCO2.map(a => a.co2)
  const scatterSpoilage = allocs.map(a => (a.spoilage_fraction * 100).toFixed(2))
  const scatterQty = allocs.map(a => a.quantity)

  // CO₂ vs transport cost scatter
  const scatterCost = allocs.map(a => a.transport_cost)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Carbon Emissions"
        description="CO₂ footprint breakdown across all delivery routes in the current plan."
      />

      {!result && !loading && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-8 text-center">
          <div className="text-sm text-[var(--text-2)] mb-1">No plan loaded</div>
          <div className="text-xs text-[var(--text-3)]">Run the optimizer on the Plan Delivery page first, or wait — auto-loading…</div>
        </div>
      )}

      {loading && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-6 text-center text-sm text-[var(--text-2)]">
          Loading plan data…
        </div>
      )}

      {error && (
        <div className="text-xs text-[var(--red)] bg-[var(--surface)] border border-[var(--border)] rounded-md p-4">{error}</div>
      )}

      {result && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard
              label="Total CO₂ Emissions"
              value={Math.round(totalCO2).toLocaleString()}
              unit="kg CO₂"
              status={totalCO2 > 8000 ? 'bad' : totalCO2 > 5000 ? 'warn' : 'good'}
            />
            <MetricCard
              label="CO₂ per kg Delivered"
              value={avgCO2PerKg.toFixed(3)}
              unit="kg CO₂ / kg produce"
              status={avgCO2PerKg > 1 ? 'bad' : avgCO2PerKg > 0.7 ? 'warn' : 'good'}
            />
            <MetricCard
              label="Refrigerated Truck CO₂"
              value={Math.round(refrigCO2).toLocaleString()}
              unit={`kg · ${totalCO2 > 0 ? ((refrigCO2 / totalCO2) * 100).toFixed(0) : 0}% of total`}
              status="warn"
            />
            <MetricCard
              label="Direct / Express CO₂"
              value={Math.round(directCO2).toLocaleString()}
              unit={`kg · ${totalCO2 > 0 ? ((directCO2 / totalCO2) * 100).toFixed(0) : 0}% of total`}
              status="good"
            />
          </div>

          {/* Row 1: bar chart + pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Per-route bar chart */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
                CO₂ by Delivery Route
              </div>
              <Plot
                data={[{
                  type: 'bar',
                  x: allocCO2.map(a => a.co2.toFixed(1)),
                  y: allocCO2.map(a => a.label),
                  orientation: 'h',
                  marker: {
                    color: allocCO2.map(a => a.co2),
                    colorscale: [
                      [0, '#22c55e'],
                      [0.5, '#f59e0b'],
                      [1, '#ef4444'],
                    ],
                    showscale: false,
                  },
                  text: allocCO2.map(a => `${a.co2.toFixed(0)} kg`),
                  textposition: 'outside',
                  hovertemplate: '<b>%{y}</b><br>CO₂: %{x} kg<extra></extra>',
                }]}
                layout={{
                  ...LAYOUT_BASE,
                  height: 280,
                  margin: { l: 140, r: 60, t: 10, b: 30 },
                  xaxis: { ...LAYOUT_BASE.xaxis, title: { text: 'kg CO₂', font: { color: '#6b8c70', size: 10 } } },
                }}
                config={PLOT_CONFIG}
                style={{ width: '100%' }}
              />
            </div>

            {/* Market CO₂ donut */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
                CO₂ by Destination Market
              </div>
              <Plot
                data={[{
                  type: 'pie',
                  labels: Object.keys(marketCO2),
                  values: Object.values(marketCO2).map(v => +v.toFixed(1)),
                  hole: 0.5,
                  marker: {
                    colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'],
                  },
                  textinfo: 'label+percent',
                  hovertemplate: '<b>%{label}</b><br>CO₂: %{value} kg<br>(%{percent})<extra></extra>',
                }]}
                layout={{
                  ...LAYOUT_BASE,
                  height: 280,
                  margin: { l: 10, r: 10, t: 10, b: 10 },
                  showlegend: true,
                  legend: { ...LAYOUT_BASE.legend, orientation: 'h', x: 0, y: -0.1 },
                  annotations: [{
                    text: `${Math.round(totalCO2)}<br>kg CO₂`,
                    x: 0.5, y: 0.5,
                    font: { size: 12, color: '#e2f0e4' },
                    showarrow: false,
                    xanchor: 'center',
                  }],
                }}
                config={PLOT_CONFIG}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Row 2: CO₂ vs spoilage scatter + CO₂ vs cost scatter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CO₂ vs Spoilage */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-1">
                CO₂ vs Spoilage %
              </div>
              <div className="text-[10px] text-[var(--text-3)] mb-3">
                Does greener routing cause more spoilage? Ideal: bottom-left.
              </div>
              <Plot
                data={[{
                  type: 'scatter',
                  mode: 'markers',
                  x: scatterCO2,
                  y: scatterSpoilage,
                  marker: {
                    size: allocs.map(a => Math.max(6, Math.sqrt(a.quantity / 20))),
                    color: scatterCO2,
                    colorscale: 'YlOrRd',
                    showscale: true,
                    colorbar: { title: { text: 'CO₂ kg', font: { color: '#6b8c70', size: 9 } }, thickness: 10, tickfont: { color: '#6b8c70', size: 9 } },
                  },
                  text: allocs.map(a => routeLabel(a)),
                  hovertemplate: '<b>%{text}</b><br>CO₂: %{x:.0f} kg<br>Spoilage: %{y}%<extra></extra>',
                }]}
                layout={{
                  ...LAYOUT_BASE,
                  height: 260,
                  xaxis: { ...LAYOUT_BASE.xaxis, title: { text: 'CO₂ (kg)', font: { color: '#6b8c70', size: 10 } } },
                  yaxis: { ...LAYOUT_BASE.yaxis, title: { text: 'Spoilage %', font: { color: '#6b8c70', size: 10 } } },
                }}
                config={PLOT_CONFIG}
                style={{ width: '100%' }}
              />
            </div>

            {/* CO₂ vs Transport Cost */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-1">
                CO₂ vs Transport Cost
              </div>
              <div className="text-[10px] text-[var(--text-3)] mb-3">
                Cost-emission trade-off per batch. Bubble size = quantity dispatched.
              </div>
              <Plot
                data={[{
                  type: 'scatter',
                  mode: 'markers',
                  x: scatterCO2,
                  y: scatterCost,
                  marker: {
                    size: allocs.map(a => Math.max(6, Math.sqrt(a.quantity / 20))),
                    color: '#22c55e',
                    opacity: 0.7,
                    line: { color: '#16a34a', width: 1 },
                  },
                  text: allocs.map(a => routeLabel(a)),
                  hovertemplate: '<b>%{text}</b><br>CO₂: %{x:.0f} kg<br>Cost: $%{y:.0f}<extra></extra>',
                }]}
                layout={{
                  ...LAYOUT_BASE,
                  height: 260,
                  xaxis: { ...LAYOUT_BASE.xaxis, title: { text: 'CO₂ (kg)', font: { color: '#6b8c70', size: 10 } } },
                  yaxis: { ...LAYOUT_BASE.yaxis, title: { text: 'Transport Cost ($)', font: { color: '#6b8c70', size: 10 } } },
                }}
                config={PLOT_CONFIG}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Route type comparison */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
              Refrigerated vs Direct Express — Emissions Comparison
            </div>
            <Plot
              data={[
                {
                  type: 'bar',
                  name: 'Refrigerated (0.9 kg/km)',
                  x: ['Refrigerated Truck', 'Direct Express'],
                  y: [refrigCO2, directCO2],
                  marker: {
                    color: ['#f59e0b', '#22c55e'],
                  },
                  text: [`${Math.round(refrigCO2)} kg`, `${Math.round(directCO2)} kg`],
                  textposition: 'outside',
                  hovertemplate: '<b>%{x}</b><br>CO₂: %{y:.0f} kg<extra></extra>',
                },
              ]}
              layout={{
                ...LAYOUT_BASE,
                height: 220,
                yaxis: { ...LAYOUT_BASE.yaxis, title: { text: 'kg CO₂', font: { color: '#6b8c70', size: 10 } } },
                showlegend: false,
                margin: { l: 55, r: 20, t: 20, b: 40 },
                annotations: [
                  {
                    x: 'Refrigerated Truck',
                    y: refrigCO2 * 1.1,
                    text: `${totalCO2 > 0 ? ((refrigCO2 / totalCO2) * 100).toFixed(0) : 0}% of total`,
                    showarrow: false,
                    font: { color: '#f59e0b', size: 10 },
                  },
                  {
                    x: 'Direct Express',
                    y: directCO2 * 1.1,
                    text: `${totalCO2 > 0 ? ((directCO2 / totalCO2) * 100).toFixed(0) : 0}% of total`,
                    showarrow: false,
                    font: { color: '#22c55e', size: 10 },
                  },
                ],
              }}
              config={PLOT_CONFIG}
              style={{ width: '100%' }}
            />
          </div>

          {/* Per-batch table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">Per-Batch Emission Detail</span>
              <span className="text-[10px] text-[var(--text-3)]">{allocs.length} deliveries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-4 py-2 text-left text-[var(--text-3)] font-medium">Route</th>
                    <th className="px-4 py-2 text-right text-[var(--text-3)] font-medium">Qty (kg)</th>
                    <th className="px-4 py-2 text-right text-[var(--text-3)] font-medium">CO₂ (kg)</th>
                    <th className="px-4 py-2 text-right text-[var(--text-3)] font-medium">CO₂ / kg</th>
                    <th className="px-4 py-2 text-right text-[var(--text-3)] font-medium">Cost ($)</th>
                    <th className="px-4 py-2 text-right text-[var(--text-3)] font-medium">Spoilage</th>
                  </tr>
                </thead>
                <tbody>
                  {allocCO2.map((a, i) => {
                    const orig = allocs.find(x => routeLabel(x) === a.label && Math.abs(x.quantity - a.qty) < 0.1)
                    const co2PerKg = a.qty > 0 ? a.co2 / a.qty : 0
                    const isHigh = a.co2 > totalCO2 / allocs.length * 1.5
                    return (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors duration-75">
                        <td className="px-4 py-2 text-[var(--text)]">{a.label}</td>
                        <td className="px-4 py-2 text-right text-[var(--text-2)] font-mono">{a.qty.toLocaleString()}</td>
                        <td className={`px-4 py-2 text-right font-mono ${isHigh ? 'text-[var(--amber)]' : 'text-[var(--text)]'}`}>
                          {a.co2.toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-right text-[var(--text-2)] font-mono">{co2PerKg.toFixed(3)}</td>
                        <td className="px-4 py-2 text-right text-[var(--text-2)] font-mono">${a.cost.toFixed(0)}</td>
                        <td className={`px-4 py-2 text-right font-mono ${orig && orig.spoilage_fraction > 0.05 ? 'text-[var(--red)]' : 'text-[var(--accent)]'}`}>
                          {orig ? (orig.spoilage_fraction * 100).toFixed(1) + '%' : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border-2)] bg-[var(--surface-2)]">
                    <td className="px-4 py-2 text-[var(--text-2)] font-semibold">Total</td>
                    <td className="px-4 py-2 text-right font-mono text-[var(--text)]">{allocCO2.reduce((s,a)=>s+a.qty,0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono text-[var(--text)]">{totalCO2.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right font-mono text-[var(--text-2)]">{avgCO2PerKg.toFixed(3)}</td>
                    <td className="px-4 py-2 text-right font-mono text-[var(--text-2)]">${allocCO2.reduce((s,a)=>s+a.cost,0).toFixed(0)}</td>
                    <td className="px-4 py-2 text-right font-mono text-[var(--text-2)]">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tip banner */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">🌱</span>
            <div>
              <div className="text-sm text-[var(--text-2)]">
                Tip: raise <span className="font-mono text-[var(--accent)]">Carbon weight (λ₅)</span> on the Plan page to reduce emissions.
              </div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">
                Increasing λ₅ penalizes high-emission routes in the LP objective, nudging the optimizer toward greener paths — at the cost of slightly higher transport spend.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
