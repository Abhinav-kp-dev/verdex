'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import PageHeader from '@/components/ui/PageHeader'
import { useStore } from '@/lib/store'
import * as api from '@/lib/api'

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

const PLOTLY_CONFIG = { displayModeBar: false, responsive: true }

type Tab = 'attempt-log' | 'robustness' | 'scalability' | 'components'

const TABS: { id: Tab; label: string }[] = [
  { id: 'attempt-log', label: 'Attempt Log' },
  { id: 'robustness', label: '100-Run Study' },
  { id: 'scalability', label: 'Benchmarks' },
  { id: 'components', label: 'Component Analysis' },
]

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-8 text-center">
      <div className="text-sm text-[var(--text-2)] mb-1">{message}</div>
      {hint && <div className="text-xs text-[var(--text-3)]">{hint}</div>}
    </div>
  )
}

function AttemptLogTab() {
  const { attemptLog } = useStore()

  if (attemptLog.length === 0) {
    return <EmptyState message="No attempts recorded yet." hint="Run an optimization to start logging results." />
  }

  const chartData = [
    {
      x: attemptLog.map((e) => e.attempt),
      y: attemptLog.map((e) => e.objective_score),
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: 'Objective Score J',
      line: { color: '#22c55e', width: 1.5 },
      marker: { color: '#22c55e', size: 5 },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {['#', 'Label', 'What Changed', 'Obj Score J', 'Spoilage %', 'Demand %', 'Runtime (s)'].map((col) => (
                <th
                  key={col}
                  className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] px-4 py-3"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attemptLog.map((entry) => (
              <tr key={entry.attempt} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-2)]">{entry.attempt}</td>
                <td className="px-4 py-3 text-xs text-[var(--text)]">{entry.label}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-2)] max-w-xs truncate">{entry.what_changed}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text)]">{entry.objective_score.toFixed(3)}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-2)]">{entry.spoilage_pct.toFixed(1)}%</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-2)]">{entry.fulfillment_pct.toFixed(1)}%</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-2)]">{entry.runtime_s.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
          Objective Score over Attempts
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
          <Plot
            data={chartData}
            layout={{
              ...PLOTLY_LAYOUT_BASE,
              height: 260,
              xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: 'Attempt', standoff: 8 } },
              yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: 'J', standoff: 8 } },
              showlegend: false,
            }}
            config={PLOTLY_CONFIG}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  )
}

function RobustnessTab() {
  const [data, setData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runStudy() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.fetchRobustness()
      setData(result)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch robustness data.')
    } finally {
      setLoading(false)
    }
  }

  const postDisruption = data ? data.filter((d: any) => d.stage === 'post_disruption') : []
  const methods = [...new Set(postDisruption.map((d: any) => d.method as string))]

  const boxData = methods.map((method) => ({
    y: postDisruption.filter((d: any) => d.method === method).map((d: any) => d.spoilage_pct),
    type: 'box' as const,
    name: method,
    marker: {
      color:
        method === 'DPSRO' ? '#22c55e' : method === 'Cheapest' ? '#f59e0b' : '#6b8c70',
    },
    line: {
      color:
        method === 'DPSRO' ? '#22c55e' : method === 'Cheapest' ? '#f59e0b' : '#6b8c70',
    },
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={runStudy}
          disabled={loading}
          className="h-8 px-3 text-sm font-semibold bg-[var(--accent)] text-black rounded cursor-pointer disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Running...' : 'Run Study'}
        </button>
        {error && <span className="text-xs text-[var(--red)]">{error}</span>}
      </div>

      {!data && !loading && (
        <EmptyState message="No robustness data loaded." hint="Click 'Run Study' to run 100 Monte Carlo scenarios." />
      )}

      {loading && <div className="text-sm text-[var(--text-2)]">Loading...</div>}

      {data && boxData.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
            Robustness: Spoilage % across 100 Monte Carlo scenarios
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
            <Plot
              data={boxData}
              layout={{
                ...PLOTLY_LAYOUT_BASE,
                height: 380,
                yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: 'Spoilage %', standoff: 8 } },
                xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: 'Method', standoff: 8 } },
              }}
              config={PLOTLY_CONFIG}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ScalabilityTab() {
  const [data, setData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runTest() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.fetchScalability()
      setData(result)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch scalability data.')
    } finally {
      setLoading(false)
    }
  }

  const lineData = data
    ? [
        {
          x: data.map((d: any) => d.num_batches),
          y: data.map((d: any) => d.runtime_dpsro_seconds),
          type: 'scatter' as const,
          mode: 'lines+markers' as const,
          name: 'DPSRO',
          line: { color: '#22c55e', width: 1.5 },
          marker: { color: '#22c55e', size: 5 },
        },
        {
          x: data.map((d: any) => d.num_batches),
          y: data.map((d: any) => d.runtime_cheapest_seconds),
          type: 'scatter' as const,
          mode: 'lines+markers' as const,
          name: 'Cheapest',
          line: { color: '#f59e0b', width: 1.5 },
          marker: { color: '#f59e0b', size: 5 },
        },
        {
          x: data.map((d: any) => d.num_batches),
          y: data.map((d: any) => d.runtime_nearest_seconds),
          type: 'scatter' as const,
          mode: 'lines+markers' as const,
          name: 'Nearest',
          line: { color: '#6b8c70', width: 1.5 },
          marker: { color: '#6b8c70', size: 5 },
        },
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={runTest}
          disabled={loading}
          className="h-8 px-3 text-sm font-semibold bg-[var(--accent)] text-black rounded cursor-pointer disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Running...' : 'Run Scalability Test'}
        </button>
        {error && <span className="text-xs text-[var(--red)]">{error}</span>}
      </div>

      {!data && !loading && (
        <EmptyState message="No scalability data loaded." hint="Click 'Run Scalability Test' to benchmark all three methods." />
      )}

      {loading && <div className="text-sm text-[var(--text-2)]">Loading...</div>}

      {data && lineData.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
            Runtime vs Problem Size (log scale)
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden">
            <Plot
              data={lineData}
              layout={{
                ...PLOTLY_LAYOUT_BASE,
                height: 360,
                xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: 'Num Batches', standoff: 8 } },
                yaxis: {
                  ...PLOTLY_LAYOUT_BASE.yaxis,
                  type: 'log' as const,
                  title: { text: 'Runtime (s)', standoff: 8 },
                },
                legend: { bgcolor: 'transparent', x: 0.02, y: 0.98 },
              }}
              config={PLOTLY_CONFIG}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ComponentAnalysisTab() {
  const components = [
    {
      title: 'EMBS Spoilage Kinetics',
      body: 'Models perishable decay using biophysical rate equations parameterized by temperature, humidity, and commodity type. Shelf-life consumption is computed at each routing step, enabling the optimizer to account for cumulative quality degradation along multi-hop supply chains.',
    },
    {
      title: 'CIS LP Optimizer',
      body: 'A multi-objective linear program solved with the HiGHS open-source solver. The objective function combines weighted spoilage loss, transport cost, unmet demand penalty, and route risk into a single scalar J, with weights configurable per run.',
    },
    {
      title: 'Dynamic Re-Optimizer',
      body: 'Monitors the active plan for real-time disruptions such as route closures, storage failures, or batch spoilage events. When a disruption is detected, it re-solves a reduced LP over affected allocations only, minimizing recovery latency without discarding intact assignments.',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
        System Architecture
      </div>
      <div className="grid grid-cols-1 gap-4">
        {components.map((comp) => (
          <div
            key={comp.title}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-4"
          >
            <div className="text-sm font-semibold text-[var(--text)] mb-2">{comp.title}</div>
            <p className="text-xs text-[var(--text-2)] leading-relaxed">{comp.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('attempt-log')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Results & Reports"
        description="Optimization history, scalability, and robustness analysis."
      />

      <div className="border-b border-[var(--border)]">
        <nav className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'text-sm border-b-2 pb-2 mr-6 cursor-pointer transition-colors',
                activeTab === tab.id
                  ? 'border-[var(--accent)] text-[var(--text)] font-medium'
                  : 'border-transparent text-[var(--text-2)] hover:text-[var(--text)]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'attempt-log' && <AttemptLogTab />}
        {activeTab === 'robustness' && <RobustnessTab />}
        {activeTab === 'scalability' && <ScalabilityTab />}
        {activeTab === 'components' && <ComponentAnalysisTab />}
      </div>
    </div>
  )
}
