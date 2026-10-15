'use client'

import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/lib/store'
import * as api from '@/lib/api'
import MetricCard from '@/components/ui/MetricCard'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import NetworkMap from '@/components/ui/NetworkMap'
import type { Batch, NodeWeather, WeatherRiskOut } from '@/lib/types'

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function batchStatus(b: Batch): { label: string; status: 'bad' | 'warn' | 'good' } {
  if (b.remaining_shelf_life_hours < 24) return { label: 'Urgent', status: 'bad' }
  if (b.remaining_shelf_life_hours < 48) return { label: 'Ship Soon', status: 'warn' }
  return { label: 'Fresh', status: 'good' }
}

export default function DashboardPage() {
  const { state, setState } = useStore()
  const [weatherRisk, setWeatherRisk] = useState<WeatherRiskOut | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherApplying, setWeatherApplying] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)

  useEffect(() => {
    if (!state) {
      api.fetchState().then((s) => setState(s)).catch(() => {})
    }
  }, [state, setState])

  const fetchWeather = useCallback(async () => {
    if (!state) return
    setWeatherLoading(true)
    setWeatherError(null)
    try {
      const risk = await api.fetchWeatherRisk(state)
      setWeatherRisk(risk)
    } catch {
      setWeatherError('Failed to fetch weather data')
    } finally {
      setWeatherLoading(false)
    }
  }, [state])

  useEffect(() => {
    if (state) fetchWeather()
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  async function applyWeatherDisruption() {
    if (!state) return
    setWeatherApplying(true)
    try {
      const result = await api.applyWeatherDisruption(state)
      setState(result.disrupted_state)
      setWeatherRisk(null)
    } catch {
      setWeatherError('Failed to apply weather disruption')
    } finally {
      setWeatherApplying(false)
    }
  }

  const batches = state ? Object.values(state.batches) : []
  const farms = state ? Object.values(state.farms) : []
  const markets = state ? Object.values(state.markets) : []

  const totalSupply = batches.reduce((s, b) => s + b.quantity, 0)
  const totalDemand = markets.reduce((s, m) => s + m.demand, 0)
  const avgShelfLife = batches.length > 0 ? batches.reduce((s, b) => s + b.remaining_shelf_life_hours, 0) / batches.length : 0
  const atRiskCount = batches.filter((b) => b.remaining_shelf_life_hours < 24).length

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
        <MetricCard label="Total Supply" value={fmt(totalSupply)} unit="kg across all batches" />
        <MetricCard label="Total Demand" value={fmt(totalDemand)} unit="kg across all markets" />
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

      {/* Live Weather Panel */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">Live Weather</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">Open-Meteo · India network nodes</div>
          </div>
          <button
            onClick={fetchWeather}
            disabled={weatherLoading}
            className="h-7 px-3 text-xs font-semibold border border-[var(--border-2)] text-[var(--text-2)] rounded hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-150 disabled:opacity-40"
          >
            {weatherLoading ? 'Fetching...' : '↻ Refresh'}
          </button>
        </div>

        {weatherError && <div className="text-xs text-red-400">{weatherError}</div>}

        {weatherRisk && (
          <>
            {weatherRisk.any_heat_risk && (
              <div className="flex items-center justify-between bg-amber-950/40 border border-amber-800/50 rounded px-3 py-2">
                <div>
                  <div className="text-xs font-semibold text-amber-400">⚠ Heat Alert Detected</div>
                  <div className="text-xs text-amber-200/70 mt-0.5">
                    {weatherRisk.auto_disruption_suggested
                      ? `Temperatures exceed 36°C — disruption recommended (+${weatherRisk.suggested_delta_temp.toFixed(0)}°C above threshold)`
                      : 'Elevated temperatures may accelerate spoilage'}
                  </div>
                </div>
                {weatherRisk.auto_disruption_suggested && (
                  <button
                    onClick={applyWeatherDisruption}
                    disabled={weatherApplying}
                    className="shrink-0 h-7 px-3 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-black rounded transition-colors duration-150 disabled:opacity-40 ml-4"
                  >
                    {weatherApplying ? 'Applying...' : 'Auto-Disrupt'}
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {weatherRisk.nodes.map((n: NodeWeather) => (
                <div
                  key={n.node_id}
                  className={`rounded px-3 py-2 border text-xs ${
                    n.heat_risk
                      ? 'bg-amber-950/30 border-amber-800/40'
                      : 'bg-[var(--surface-2)] border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`w-2 h-2 rounded-full inline-block ${
                        n.node_type === 'farm'
                          ? 'bg-green-400'
                          : n.node_type === 'storage'
                          ? 'bg-blue-400'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span className="font-mono text-[var(--text)] font-semibold">{n.node_id}</span>
                    {n.heat_risk && <span className="text-amber-400 text-[10px]">🔥</span>}
                  </div>
                  <div className="text-[var(--text-2)] truncate">{n.city}</div>
                  <div className={`font-mono font-semibold mt-0.5 ${n.heat_risk ? 'text-amber-400' : 'text-[var(--text)]'}`}>
                    {n.current_temp_c.toFixed(1)}°C
                  </div>
                  <div className="text-[var(--text-3)] text-[10px]">max {n.max_24h_temp_c.toFixed(1)}°C</div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 text-[10px] text-[var(--text-3)]">
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />Farm</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />Storage</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Market</span>
              <span className="ml-auto">🔥 = heat risk (&gt;32°C)</span>
            </div>
          </>
        )}
      </div>

      {/* Network Map */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          Network Map — India
        </div>
        <div className="border border-[var(--border)] rounded-md overflow-hidden">
          <NetworkMap state={state} weather={weatherRisk?.nodes} height="440px" />
        </div>
        <div className="mt-1.5 flex gap-4 text-[10px] text-[var(--text-3)]">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />Farm</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />Storage</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Market</span>
          <span><span className="inline-block w-3 h-0.5 bg-green-600 mr-1 align-middle" />Active route</span>
          <span><span className="inline-block w-3 h-0.5 bg-red-500 mr-1 align-middle" />Offline route</span>
          <span className="ml-auto">Click markers for details</span>
        </div>
      </div>

      {/* Batches table */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">Batches</div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Batch ID', 'Farm', 'Commodity', 'Qty (kg)', 'Shelf Life', 'Status'].map((col) => (
                  <th key={col} className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] pb-2 border-b border-[var(--border)] text-left px-4 pt-3">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const { label, status } = batchStatus(b)
                return (
                  <tr key={b.batch_id}>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">{b.batch_id}</td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">{b.farm_id}</td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">{b.commodity}</td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">{fmt(b.quantity)}</td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">{Math.round(b.remaining_shelf_life_hours)}h</td>
                    <td className="py-2 px-4 border-b border-[var(--border)]"><StatusBadge status={status}>{label}</StatusBadge></td>
                  </tr>
                )
              })}
              {batches.length === 0 && (
                <tr><td colSpan={6} className="py-6 px-4 text-center text-xs text-[var(--text-3)]">No batches in current state</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Farms + Markets grid */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">Network Setup</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">Farms</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] text-left px-4 pt-2 pb-2 border-b border-[var(--border)]">Farm ID</th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] text-right px-4 pt-2 pb-2 border-b border-[var(--border)]">Available (kg)</th>
                </tr>
              </thead>
              <tbody>
                {farms.map((f) => (
                  <tr key={f.farm_id}>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">{f.farm_id}</td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono text-right">{fmt(f.available_quantity)}</td>
                  </tr>
                ))}
                {farms.length === 0 && <tr><td colSpan={2} className="py-4 px-4 text-center text-xs text-[var(--text-3)]">No farms</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">Markets</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] text-left px-4 pt-2 pb-2 border-b border-[var(--border)]">Market ID</th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] text-right px-4 pt-2 pb-2 border-b border-[var(--border)]">Demand (kg)</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => (
                  <tr key={m.market_id}>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono">{m.market_id}</td>
                    <td className="py-2 px-4 border-b border-[var(--border)] text-[var(--text-2)] font-mono text-right">{fmt(m.demand)}</td>
                  </tr>
                ))}
                {markets.length === 0 && <tr><td colSpan={2} className="py-4 px-4 text-center text-xs text-[var(--text-3)]">No markets</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
