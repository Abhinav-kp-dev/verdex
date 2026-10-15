'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import * as api from '@/lib/api'
import type { AllocationDecision } from '@/lib/types'
import MetricCard from '@/components/ui/MetricCard'
import PageHeader from '@/components/ui/PageHeader'
import StepProgress from '@/components/layout/StepProgress'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const STEPS = ['Load Data', 'Optimize', 'Simulate', 'Re-Optimize']

const PLOT_LAYOUT_BASE = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#6b8c70', family: 'var(--font-geist-mono), monospace', size: 11 },
  margin: { l: 40, r: 20, t: 32, b: 40 },
  xaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  yaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  legend: { bgcolor: 'transparent' },
}

const PLOT_CONFIG = { displayModeBar: false, responsive: true }

export default function ReoptimizePage() {
  const {
    state,
    disruptedState,
    reoptimizeResult,
    optimizeResult,
    lambdaWeights,
    setReoptimizeResult,
  } = useStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completedSteps = []
  if (state) completedSteps.push(0)
  if (optimizeResult) completedSteps.push(1)
  if (disruptedState) completedSteps.push(2)
  if (reoptimizeResult) completedSteps.push(3)

  async function handleRunRecovery() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.reoptimize({
        disrupted_state: disruptedState,
        lambda_weights: lambdaWeights,
      })
      setReoptimizeResult(result)
    } catch (e: any) {
      setError(e.message ?? 'Recovery failed')
    } finally {
      setLoading(false)
    }
  }

  // Build network chart data from disrupted+recovered state
  function buildNetworkData() {
    if (!disruptedState || !reoptimizeResult) return null
    const allocs = reoptimizeResult.result.allocations

    const farms = Object.values(disruptedState.farms)
    const storages = Object.values(disruptedState.storage_facilities)
    const markets = Object.values(disruptedState.markets)

    // Node positions
    const nodeX: number[] = []
    const nodeY: number[] = []
    const nodeText: string[] = []
    const nodeColor: string[] = []

    farms.forEach((f) => {
      nodeX.push(f.location_x)
      nodeY.push(f.location_y)
      nodeText.push(f.farm_id)
      nodeColor.push('#22c55e')
    })
    storages.forEach((s) => {
      nodeX.push(s.location_x)
      nodeY.push(s.location_y)
      nodeText.push(s.storage_id)
      nodeColor.push(s.available ? '#3b82f6' : '#ef4444')
    })
    markets.forEach((m) => {
      nodeX.push(m.location_x)
      nodeY.push(m.location_y)
      nodeText.push(m.market_id)
      nodeColor.push('#f59e0b')
    })

    // Build edge lookup maps
    const farmPos: Record<string, { x: number; y: number }> = {}
    farms.forEach((f) => (farmPos[f.farm_id] = { x: f.location_x, y: f.location_y }))
    const storagePos: Record<string, { x: number; y: number }> = {}
    storages.forEach((s) => (storagePos[s.storage_id] = { x: s.location_x, y: s.location_y }))
    const marketPos: Record<string, { x: number; y: number }> = {}
    markets.forEach((m) => (marketPos[m.market_id] = { x: m.location_x, y: m.location_y }))

    const edgeX: (number | null)[] = []
    const edgeY: (number | null)[] = []

    allocs.forEach((a) => {
      const f = farmPos[a.farm_id]
      const m = marketPos[a.market_id]
      if (a.storage_id) {
        const s = storagePos[a.storage_id]
        if (f && s) { edgeX.push(f.x, s.x, null); edgeY.push(f.y, s.y, null) }
        if (s && m) { edgeX.push(s.x, m.x, null); edgeY.push(s.y, m.y, null) }
      } else if (f && m) {
        edgeX.push(f.x, m.x, null)
        edgeY.push(f.y, m.y, null)
      }
    })

    return { nodeX, nodeY, nodeText, nodeColor, edgeX, edgeY }
  }

  // Build Sankey data
  function buildSankeyData() {
    if (!reoptimizeResult) return null
    const allocs = reoptimizeResult.result.allocations

    const labelSet = new Set<string>()
    allocs.forEach((a) => {
      labelSet.add(`F:${a.farm_id}`)
      if (a.storage_id) labelSet.add(`S:${a.storage_id}`)
      labelSet.add(`M:${a.market_id}`)
    })
    const labels = Array.from(labelSet)
    const idx = (l: string) => labels.indexOf(l)

    const sourceArr: number[] = []
    const targetArr: number[] = []
    const valueArr: number[] = []

    allocs.forEach((a) => {
      if (a.storage_id) {
        sourceArr.push(idx(`F:${a.farm_id}`))
        targetArr.push(idx(`S:${a.storage_id}`))
        valueArr.push(a.quantity)
        sourceArr.push(idx(`S:${a.storage_id}`))
        targetArr.push(idx(`M:${a.market_id}`))
        valueArr.push(a.delivered_qty)
      } else {
        sourceArr.push(idx(`F:${a.farm_id}`))
        targetArr.push(idx(`M:${a.market_id}`))
        valueArr.push(a.delivered_qty)
      }
    })

    const nodeColors = labels.map((l) =>
      l.startsWith('F:') ? '#22c55e' : l.startsWith('S:') ? '#3b82f6' : '#f59e0b'
    )

    return { labels, sourceArr, targetArr, valueArr, nodeColors }
  }

  const networkData = buildNetworkData()
  const sankeyData = buildSankeyData()
  const result = reoptimizeResult?.result
  const stats = reoptimizeResult?.recovery_stats
  const preResult = optimizeResult?.result

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Step progress */}
      <StepProgress steps={STEPS} currentStep={3} completedSteps={completedSteps} />

      <PageHeader
        title="Re-Optimize"
        description="Recover from the disruption with dynamic re-routing."
        actions={
          disruptedState ? (
            <button
              onClick={handleRunRecovery}
              disabled={loading}
              className="inline-flex items-center gap-2 h-8 px-3 text-sm font-semibold bg-[var(--accent)] text-black rounded disabled:opacity-50 transition-opacity duration-150"
            >
              {loading && (
                <span className="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? 'Running...' : 'Run Recovery'}
            </button>
          ) : null
        }
      />

      {error && (
        <div className="text-sm text-[var(--red)]">{error}</div>
      )}

      {/* Empty state */}
      {!disruptedState && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-8 text-center">
          <div className="text-sm text-[var(--text-2)] mb-1">No disruption simulated yet</div>
          <div className="text-xs text-[var(--text-3)] mb-4">Simulate a disruption first</div>
          <Link
            href="/simulate"
            className="inline-flex items-center h-8 px-3 text-sm font-semibold bg-[var(--accent)] text-black rounded transition-opacity duration-150 hover:opacity-90"
          >
            Go to Simulate
          </Link>
        </div>
      )}

      {/* Results */}
      {disruptedState && reoptimizeResult && result && stats && (
        <>
          {/* Metrics */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
              Recovery Metrics
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Affected Batches"
                value={stats.affected_batches}
                status={stats.affected_batches > 0 ? 'warn' : 'good'}
              />
              <MetricCard
                label="Rerouted"
                value={stats.rerouted}
                status={stats.rerouted > 0 ? 'good' : 'warn'}
              />
              <MetricCard
                label="Delivered Fresh"
                value={`${stats.delivered_fresh_pct.toFixed(1)}%`}
                status={stats.delivered_fresh_pct >= 80 ? 'good' : stats.delivered_fresh_pct >= 50 ? 'warn' : 'bad'}
              />
              <MetricCard
                label="Recovery Time"
                value={stats.recovery_time_s.toFixed(3)}
                unit="seconds"
              />
            </div>
          </div>

          {/* Network chart */}
          {networkData && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
                Recovery Network
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
                <Plot
                  data={[
                    {
                      type: 'scatter',
                      mode: 'lines',
                      x: networkData.edgeX,
                      y: networkData.edgeY,
                      line: { color: '#253428', width: 1 },
                      hoverinfo: 'skip',
                    },
                    {
                      type: 'scatter',
                      mode: 'markers+text',
                      x: networkData.nodeX,
                      y: networkData.nodeY,
                      text: networkData.nodeText,
                      textposition: 'top center',
                      marker: {
                        size: 10,
                        color: networkData.nodeColor,
                      },
                      hoverinfo: 'text',
                    },
                  ]}
                  layout={{
                    ...PLOT_LAYOUT_BASE,
                    height: 340,
                    showlegend: false,
                    xaxis: { ...PLOT_LAYOUT_BASE.xaxis, showticklabels: false, title: '' },
                    yaxis: { ...PLOT_LAYOUT_BASE.yaxis, showticklabels: false, title: '' },
                  }}
                  config={PLOT_CONFIG}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-2)]"><span className="w-2 h-2 rounded-full bg-[#22c55e]" />Farm</span>
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-2)]"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" />Storage (available)</span>
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-2)]"><span className="w-2 h-2 rounded-full bg-[#ef4444]" />Storage (disrupted)</span>
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-2)]"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" />Market</span>
              </div>
            </div>
          )}

          {/* Sankey */}
          {sankeyData && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
                Allocation Flow
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
                <Plot
                  data={[
                    {
                      type: 'sankey',
                      orientation: 'h',
                      node: {
                        pad: 12,
                        thickness: 16,
                        line: { color: '#1c2b1e', width: 0.5 },
                        label: sankeyData.labels.map((l) =>
                          l.startsWith('F:') ? l.slice(2) : l.startsWith('S:') ? l.slice(2) : l.slice(2)
                        ),
                        color: sankeyData.nodeColors,
                      },
                      link: {
                        source: sankeyData.sourceArr,
                        target: sankeyData.targetArr,
                        value: sankeyData.valueArr,
                        color: 'rgba(34,197,94,0.12)',
                      },
                    },
                  ]}
                  layout={{
                    ...PLOT_LAYOUT_BASE,
                    height: 320,
                  }}
                  config={PLOT_CONFIG}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* Recovery Report table */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
              Recovery Report
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Batch</th>
                    <th className="text-left p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Route</th>
                    <th className="text-right p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Qty</th>
                    <th className="text-right p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Delivered</th>
                    <th className="text-right p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Spoilage %</th>
                  </tr>
                </thead>
                <tbody>
                  {result.allocations.map((a: AllocationDecision, i: number) => {
                    const route = a.storage_id
                      ? `${a.farm_id} → ${a.storage_id} → ${a.market_id}`
                      : `${a.farm_id} → ${a.market_id}`
                    const spoilagePct = (a.spoilage_fraction * 100).toFixed(1)
                    const spoilageNum = parseFloat(spoilagePct)
                    return (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0">
                        <td className="p-3 font-mono text-xs text-[var(--text-2)]">{a.batch_id}</td>
                        <td className="p-3 text-xs text-[var(--text-2)]">{route}</td>
                        <td className="p-3 font-mono text-xs text-right text-[var(--text)]">{a.quantity.toFixed(0)}</td>
                        <td className="p-3 font-mono text-xs text-right text-[var(--text)]">{a.delivered_qty.toFixed(0)}</td>
                        <td className="p-3 font-mono text-xs text-right">
                          <span className={
                            spoilageNum >= 20
                              ? 'text-[var(--red)]'
                              : spoilageNum >= 10
                              ? 'text-[var(--amber)]'
                              : 'text-[var(--accent)]'
                          }>
                            {spoilagePct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparison table */}
          {preResult && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
                Pre-Disruption vs Recovery
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Metric</th>
                      <th className="text-right p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Pre-Disruption</th>
                      <th className="text-right p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Recovery</th>
                      <th className="text-right p-3 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border)]">
                      <td className="p-3 text-xs text-[var(--text-2)]">Spoilage %</td>
                      <td className="p-3 font-mono text-xs text-right text-[var(--text)]">
                        {preResult.spoilage_percentage.toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono text-xs text-right text-[var(--text)]">
                        {result.spoilage_percentage.toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono text-xs text-right">
                        {(() => {
                          const d = result.spoilage_percentage - preResult.spoilage_percentage
                          return (
                            <span className={d > 0 ? 'text-[var(--red)]' : 'text-[var(--accent)]'}>
                              {d > 0 ? '+' : ''}{d.toFixed(1)}%
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border)]">
                      <td className="p-3 text-xs text-[var(--text-2)]">Demand Fulfillment %</td>
                      <td className="p-3 font-mono text-xs text-right text-[var(--text)]">
                        {preResult.demand_fulfillment_percentage.toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono text-xs text-right text-[var(--text)]">
                        {result.demand_fulfillment_percentage.toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono text-xs text-right">
                        {(() => {
                          const d = result.demand_fulfillment_percentage - preResult.demand_fulfillment_percentage
                          return (
                            <span className={d < 0 ? 'text-[var(--red)]' : 'text-[var(--accent)]'}>
                              {d > 0 ? '+' : ''}{d.toFixed(1)}%
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-xs text-[var(--text-2)]">Transport Cost</td>
                      <td className="p-3 font-mono text-xs text-right text-[var(--text)]">
                        ${preResult.total_transport_cost.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono text-xs text-right text-[var(--text)]">
                        ${result.total_transport_cost.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono text-xs text-right">
                        {(() => {
                          const d = result.total_transport_cost - preResult.total_transport_cost
                          return (
                            <span className={d > 0 ? 'text-[var(--red)]' : 'text-[var(--accent)]'}>
                              {d > 0 ? '+' : ''}${d.toFixed(2)}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Disrupted state present but no result yet */}
      {disruptedState && !reoptimizeResult && !loading && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-8 text-center">
          <div className="text-sm text-[var(--text-2)] mb-1">Ready to recover</div>
          <div className="text-xs text-[var(--text-3)]">Click "Run Recovery" to re-optimize the disrupted network</div>
        </div>
      )}
    </div>
  )
}
