'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/lib/store'
import * as api from '@/lib/api'
import MetricCard from '@/components/ui/MetricCard'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Batch, Farm, Market, StorageFacility, TransportRoute } from '@/lib/types'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const PLOTLY_LAYOUT_BASE = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#6b8c70', family: 'var(--font-geist-mono), monospace', size: 11 },
  margin: { l: 40, r: 20, t: 32, b: 40 },
  xaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  yaxis: { gridcolor: '#1c2b1e', linecolor: '#1c2b1e', zerolinecolor: '#1c2b1e' },
  legend: { bgcolor: 'transparent' },
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function DashboardPage() {
  const { state, setState } = useStore()

  useEffect(() => {
    if (!state) {
      api.fetchState().then((s) => setState(s)).catch(() => {})
    }
  }, [state, setState])

  // Derived metrics
  const batches = state ? Object.values(state.batches) : []
  const farms = state ? Object.values(state.farms) : []
  const markets = state ? Object.values(state.markets) : []
  const storage = state ? Object.values(state.storage_facilities) : []
  const routes = state ? Object.values(state.routes) : []

  const totalSupply = batches.reduce((s, b) => s + b.quantity, 0)
  const totalDemand = markets.reduce((s, m) => s + m.demand, 0)
  const avgShelfLife =
    batches.length > 0
      ? batches.reduce((s, b) => s + b.remaining_shelf_life_hours, 0) / batches.length
      : 0
  const atRiskCount = batches.filter((b) => b.remaining_shelf_life_hours < 24).length

  // Build Plotly traces
  const farmTrace = {
    x: farms.map((f) => f.location_x),
    y: farms.map((f) => f.location_y),
    mode: 'markers',
    type: 'scatter' as const,
    name: 'Farms',
    marker: { symbol: 'triangle-up', size: 10, color: '#22c55e' },
    text: farms.map((f) => `${f.farm_id}<br>Supply: ${fmt(f.available_quantity)} kg`),
    hoverinfo: 'text' as const,
  }

  const storageTrace = {
    x: storage.map((s) => s.location_x),
    y: storage.map((s) => s.location_y),
    mode: 'markers',
    type: 'scatter' as const,
    name: 'Storage',
    marker: { symbol: 'square', size: 9, color: '#3b82f6' },
    text: storage.map(
      (s) => `${s.storage_id}<br>Load: ${fmt(s.current_load)}/${fmt(s.capacity)}`
    ),
    hoverinfo: 'text' as const,
  }

  const marketTrace = {
    x: markets.map((m) => m.location_x),
    y: markets.map((m) => m.location_y),
    mode: 'markers',
    type: 'scatter' as const,
    name: 'Markets',
    marker: { symbol: 'circle', size: 10, color: '#f59e0b' },
    text: markets.map((m) => `${m.market_id}<br>Demand: ${fmt(m.demand)} kg`),
    hoverinfo: 'text' as const,
  }

  // Build a lookup map for node coordinates
  const nodeCoords: Record<string, { x: number; y: number }> = {}
  farms.forEach((f) => { nodeCoords[f.farm_id] = { x: f.location_x, y: f.location_y } })
  storage.forEach((s) => { nodeCoords[s.storage_id] = { x: s.location_x, y: s.location_y } })
  markets.forEach((m) => { nodeCoords[m.market_id] = { x: m.location_x, y: m.location_y } })

  // Route lines — one trace per route to allow coloring
  const routeTraces = routes.map((r) => {
    const src = nodeCoords[r.source]
    const dst = nodeCoords[r.destination]
    if (!src || !dst) return null
    return {
      x: [src.x, dst.x, null],
      y: [src.y, dst.y, null],
      mode: 'lines',
      type: 'scatter' as const,
      showlegend: false,
      hoverinfo: 'skip' as const,
      line: {
        color: r.available ? '#253428' : '#ef4444',
        width: r.available ? 1 : 1.5,
      },
    }
  }).filter(Boolean) as any[]

  const plotData = [...routeTraces, farmTrace, storageTrace, marketTrace]

  const plotLayout = {
    ...PLOTLY_LAYOUT_BASE,
    height: 400,
    legend: {
      ...PLOTLY_LAYOUT_BASE.legend,
      orientation: 'h' as const,
      x: 0,
      y: -0.08,
      font: { color: '#6b8c70', size: 11 },
    },
    xaxis: {
      ...PLOTLY_LAYOUT_BASE.xaxis,
      title: { text: 'X Coordinate', font: { color: '#3d5240', size: 10 } },
    },
    yaxis: {
      ...PLOTLY_LAYOUT_BASE.yaxis,
      title: { text: 'Y Coordinate', font: { color: '#3d5240', size: 10 } },
    },
  }

  function batchStatus(b: Batch): { label: string; status: 'bad' | 'warn' | 'good' } {
    if (b.remaining_shelf_life_hours < 24) return { label: 'Urgent', status: 'bad' }
    if (b.remaining_shelf_life_hours < 48) return { label: 'Ship Soon', status: 'warn' }
    return { label: 'Fresh', status: 'good' }
  }

  if (!state) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader title="Dashboard" description="Live view of your supply network." />
        <div className="text-sm text-[var(--text-2)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Dashboard" description="Live view of your supply network." />

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total Supply"
          value={fmt(totalSupply)}
          unit="kg across all batches"
        />
        <MetricCard
          label="Total Demand"
          value={fmt(totalDemand)}
          unit="kg across all markets"
        />
        <MetricCard
          label="Avg Shelf Life"
          value={`${Math.round(avgShelfLife)}h`}
          unit="remaining across batches"
          status={avgShelfLife < 24 ? 'bad' : avgShelfLife < 48 ? 'warn' : 'good'}
        />
        <MetricCard
          label="At Risk"
          value={`${atRiskCount} batches`}
          unit="shelf life under 24h"
          status={atRiskCount > 0 ? 'bad' : 'good'}
        />
      </div>

      {/* Network map */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          Network
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
          <Plot
            data={plotData}
            layout={plotLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Batches table */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          Batches
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Batch ID', 'Farm', 'Commodity', 'Qty (kg)', 'Shelf Life', 'Status'].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] pb-2 border-b border-[var(--border)] text-left px-4 pt-3"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const { label, status } = batchStatus(b)
                return (
                  <tr key={b.batch_id}>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">
                      {b.batch_id}
                    </td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">
                      {b.farm_id}
                    </td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">
                      {b.commodity}
                    </td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">
                      {fmt(b.quantity)}
                    </td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">
                      {Math.round(b.remaining_shelf_life_hours)}h
                    </td>
                    <td className="py-2 px-4 border-b border-[var(--border)]">
                      <StatusBadge status={status}>{label}</StatusBadge>
                    </td>
                  </tr>
                )
              })}
              {batches.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 px-4 text-center text-xs text-[var(--text-3)]"
                  >
                    No batches in current state
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Network setup: farms + markets */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          Network Setup
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Farms */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Farms
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] text-left px-4 pt-2 pb-2 border-b border-[var(--border)]">
                    Farm ID
                  </th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] text-right px-4 pt-2 pb-2 border-b border-[var(--border)]">
                    Available (kg)
                  </th>
                </tr>
              </thead>
              <tbody>
                {farms.map((f) => (
                  <tr key={f.farm_id}>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">
                      {f.farm_id}
                    </td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono text-right">
                      {fmt(f.available_quantity)}
                    </td>
                  </tr>
                ))}
                {farms.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-4 px-4 text-center text-xs text-[var(--text-3)]"
                    >
                      No farms
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Markets */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Markets
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] text-left px-4 pt-2 pb-2 border-b border-[var(--border)]">
                    Market ID
                  </th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] text-right px-4 pt-2 pb-2 border-b border-[var(--border)]">
                    Demand (kg)
                  </th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => (
                  <tr key={m.market_id}>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">
                      {m.market_id}
                    </td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono text-right">
                      {fmt(m.demand)}
                    </td>
                  </tr>
                ))}
                {markets.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-4 px-4 text-center text-xs text-[var(--text-3)]"
                    >
                      No markets
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
