'use client'

import { useState, useEffect, useRef } from 'react'
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

type Tab = 'attempt-log' | 'robustness' | 'scalability' | 'components' | 'ai-report'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai-report', label: 'AI Report' },
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

interface KpiHighlight {
  label: string
  value: string
  status: 'good' | 'warning' | 'critical'
  insight: string
}

interface RouteItem {
  route_id: string
  reason?: string
  metrics?: string
  issue?: string
  recommendation?: string
}

interface ActionItem {
  action: string
  urgency: 'immediate' | 'short_term' | 'long_term'
  expected_benefit: string
}

interface SpoilageStrategy {
  strategy: string
  expected_impact: string
  priority: 'high' | 'medium' | 'low'
}

interface AiReport {
  executive_summary: string
  kpi_highlights: KpiHighlight[]
  best_routes: RouteItem[]
  worst_routes: RouteItem[]
  spoilage_analysis: {
    summary: string
    top_risks: string[]
    reduction_strategies: SpoilageStrategy[]
  }
  carbon_insights: {
    summary: string
    emission_breakdown: string
    green_recommendations: string[]
  }
  cost_analysis: {
    summary: string
    optimization_opportunities: string[]
  }
  weather_impact: string
  action_items: ActionItem[]
  generated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  good: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
}

const URGENCY_LABELS: Record<string, string> = {
  immediate: 'Immediate',
  short_term: 'Short-term',
  long_term: 'Long-term',
}

const URGENCY_COLORS: Record<string, string> = {
  immediate: '#ef4444',
  short_term: '#f59e0b',
  long_term: '#22c55e',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">{title}</div>
      {children}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-md p-4 ${className}`}>
      {children}
    </div>
  )
}

function AiReportTab() {
  const { state, optimizeResult } = useStore()
  const [report, setReport] = useState<AiReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  async function generateReport() {
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { state, optimizeResult } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate report')
      setReport(data.report)
      setModel(data.model)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function downloadPdf() {
    if (!report || !reportRef.current) return
    const { default: jsPDF } = await import('jspdf')
    const html2canvas = (await import('html2canvas')).default

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: '#0d1f0f',
      useCORS: true,
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgW = pageW
    const imgH = (canvas.height * pageW) / canvas.width
    let yOffset = 0
    let remainingH = imgH

    while (remainingH > 0) {
      pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH)
      remainingH -= pageH
      yOffset += pageH
      if (remainingH > 0) pdf.addPage()
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    pdf.save(`verdex-report-${dateStr}.pdf`)
  }

  if (!optimizeResult) {
    return (
      <EmptyState
        message="No optimization result available."
        hint="Run the optimizer on the Plan Delivery page first, then come back to generate a report."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={generateReport}
          disabled={loading}
          className="h-9 px-4 text-sm font-semibold bg-[var(--accent)] text-black rounded cursor-pointer disabled:opacity-50 transition-opacity flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full" />
              Generating…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              Generate AI Report
            </>
          )}
        </button>

        {report && (
          <button
            onClick={downloadPdf}
            className="h-9 px-4 text-sm font-semibold rounded cursor-pointer transition-opacity flex items-center gap-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
          </button>
        )}

        {model && (
          <span className="text-[10px] text-[var(--text-3)] font-mono">via {model}</span>
        )}

        {error && <span className="text-xs text-[var(--red)]">{error}</span>}
      </div>

      {loading && (
        <Card>
          <div className="flex items-center gap-3 py-4">
            <span className="animate-spin inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full flex-shrink-0" />
            <div>
              <div className="text-sm text-[var(--text)]">Analyzing your supply chain data…</div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">Gemini is reviewing routes, allocations, weather, and emissions. This may take 10–20 seconds.</div>
            </div>
          </div>
        </Card>
      )}

      {report && (
        <div ref={reportRef} className="space-y-6 p-1">

          {/* Header */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-lg font-bold text-[var(--text)]">Verdex Supply Chain Optimization Report</div>
                <div className="text-xs text-[var(--text-3)] mt-1">
                  Generated {new Date(report.generated_at).toLocaleString()} · Powered by Gemini AI
                </div>
              </div>
              <div className="text-xs font-mono text-[var(--accent)] border border-[var(--accent)] rounded px-2 py-1">
                AI-Generated
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <Section title="Executive Summary">
            <Card>
              <p className="text-sm text-[var(--text-2)] leading-relaxed whitespace-pre-line">{report.executive_summary}</p>
            </Card>
          </Section>

          {/* KPI Highlights */}
          {report.kpi_highlights?.length > 0 && (
            <Section title="KPI Highlights">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {report.kpi_highlights.map((kpi, i) => (
                  <Card key={i}>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">{kpi.label}</div>
                    <div className="text-xl font-bold font-mono" style={{ color: STATUS_COLORS[kpi.status] ?? 'var(--text)' }}>
                      {kpi.value}
                    </div>
                    <div className="text-[11px] text-[var(--text-2)] mt-1 leading-relaxed">{kpi.insight}</div>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* Best & Worst Routes */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {report.best_routes?.length > 0 && (
              <Section title="Best Performing Routes">
                <div className="space-y-2">
                  {report.best_routes.map((r, i) => (
                    <Card key={i}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono font-bold" style={{ color: '#22c55e' }}>{r.route_id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e22', color: '#22c55e' }}>Optimal</span>
                      </div>
                      <div className="text-xs text-[var(--text-2)] leading-relaxed">{r.reason}</div>
                      {r.metrics && <div className="text-[11px] font-mono text-[var(--text-3)] mt-1.5">{r.metrics}</div>}
                    </Card>
                  ))}
                </div>
              </Section>
            )}

            {report.worst_routes?.length > 0 && (
              <Section title="Routes Needing Attention">
                <div className="space-y-2">
                  {report.worst_routes.map((r, i) => (
                    <Card key={i}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono font-bold" style={{ color: '#ef4444' }}>{r.route_id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#ef444422', color: '#ef4444' }}>Risk</span>
                      </div>
                      <div className="text-xs text-[var(--text-2)] leading-relaxed">{r.issue}</div>
                      {r.recommendation && (
                        <div className="text-[11px] text-[var(--accent)] mt-1.5 leading-relaxed">→ {r.recommendation}</div>
                      )}
                    </Card>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Spoilage Analysis */}
          {report.spoilage_analysis && (
            <Section title="Spoilage Analysis & Reduction Strategies">
              <Card>
                <p className="text-sm text-[var(--text-2)] leading-relaxed mb-4">{report.spoilage_analysis.summary}</p>

                {report.spoilage_analysis.top_risks?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-2">Top Risk Factors</div>
                    <ul className="space-y-1">
                      {report.spoilage_analysis.top_risks.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-2)]">
                          <span style={{ color: '#ef4444' }}>▸</span> {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.spoilage_analysis.reduction_strategies?.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-2">Reduction Strategies</div>
                    <div className="space-y-2">
                      {report.spoilage_analysis.reduction_strategies.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <span
                            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                            style={{ background: PRIORITY_COLORS[s.priority] + '22', color: PRIORITY_COLORS[s.priority] }}
                          >
                            {s.priority}
                          </span>
                          <div>
                            <div className="text-xs text-[var(--text)] font-medium">{s.strategy}</div>
                            <div className="text-[11px] text-[var(--text-3)] mt-0.5">{s.expected_impact}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </Section>
          )}

          {/* Carbon Insights */}
          {report.carbon_insights && (
            <Section title="Carbon Emissions Insights">
              <Card>
                <p className="text-sm text-[var(--text-2)] leading-relaxed mb-3">{report.carbon_insights.summary}</p>
                <p className="text-xs text-[var(--text-2)] leading-relaxed mb-4">{report.carbon_insights.emission_breakdown}</p>
                {report.carbon_insights.green_recommendations?.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-2">Green Recommendations</div>
                    <ul className="space-y-1">
                      {report.carbon_insights.green_recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-2)]">
                          <span style={{ color: '#22c55e' }}>✓</span> {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </Section>
          )}

          {/* Cost Analysis */}
          {report.cost_analysis && (
            <Section title="Cost Analysis">
              <Card>
                <p className="text-sm text-[var(--text-2)] leading-relaxed mb-3">{report.cost_analysis.summary}</p>
                {report.cost_analysis.optimization_opportunities?.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-2">Optimization Opportunities</div>
                    <ul className="space-y-1">
                      {report.cost_analysis.optimization_opportunities.map((opp, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-2)]">
                          <span style={{ color: '#f59e0b' }}>◆</span> {opp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </Section>
          )}

          {/* Weather Impact */}
          {report.weather_impact && (
            <Section title="Weather Impact">
              <Card>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">{report.weather_impact}</p>
              </Card>
            </Section>
          )}

          {/* Action Items */}
          {report.action_items?.length > 0 && (
            <Section title="Recommended Action Items">
              <div className="space-y-2">
                {report.action_items.map((item, i) => (
                  <Card key={i}>
                    <div className="flex items-start gap-3">
                      <span
                        className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{ background: URGENCY_COLORS[item.urgency] + '22', color: URGENCY_COLORS[item.urgency] }}
                      >
                        {URGENCY_LABELS[item.urgency]}
                      </span>
                      <div>
                        <div className="text-xs text-[var(--text)] font-medium">{item.action}</div>
                        <div className="text-[11px] text-[var(--text-3)] mt-0.5">{item.expected_benefit}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* Footer */}
          <div className="text-center text-[10px] text-[var(--text-3)] pt-2 pb-1">
            Verdex AI Report · Generated by Gemini · {new Date(report.generated_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('ai-report')

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
        {activeTab === 'ai-report' && <AiReportTab />}
        {activeTab === 'attempt-log' && <AttemptLogTab />}
        {activeTab === 'robustness' && <RobustnessTab />}
        {activeTab === 'scalability' && <ScalabilityTab />}
        {activeTab === 'components' && <ComponentAnalysisTab />}
      </div>
    </div>
  )
}
