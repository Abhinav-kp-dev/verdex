'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { fetchState } from '@/lib/api'

const EPSILON = -1.2          // price elasticity of demand
const BASE_PRICE_PER_KG = 30  // ₹ per kg (indicative)

type Tier = 'critical' | 'proactive' | 'healthy'

interface BatchAnalysis {
  batchId: string
  farmId: string
  quantity: number
  remainingHours: number
  initialHours: number
  pctUsed: number
  tier: Tier
  discount: number
  baseSellThrough: number      // % sold at full price before expiry
  // Scenario A — fixed demand
  fixedSellThrough: number
  fixedRevenue: number
  fixedWaste: number
  // Scenario B — demand-responsive
  elasticSellThrough: number
  elasticRevenue: number
  elasticWaste: number
  elasticWasteAvoided: number  // vs fixed
  // No-markdown baseline (same sell-through, full price)
  baseRevenue: number
  baseWaste: number
}

function computeAnalysis(batches: Record<string, any>): BatchAnalysis[] {
  return Object.values(batches)
    .map((b: any) => {
      const remaining = b.remaining_shelf_life_hours ?? 72
      const initial = b.initial_shelf_life_hours ?? 120
      const pctUsed = 1 - remaining / initial

      let tier: Tier = 'healthy'
      let discount = 0
      if (remaining < 48) { tier = 'critical'; discount = 0.25 }
      else if (remaining < 96) { tier = 'proactive'; discount = 0.15 }

      if (tier === 'healthy') return null

      // base sell-through: how much sells at full price before expiry
      // higher shelf-life used → lower natural sell-through
      const baseSell = Math.max(0.25, Math.min(0.90, 1.0 - pctUsed * 0.75))

      // Scenario A: fixed demand — markdown lowers price, same sell-through
      const fixedSell = baseSell
      const fixedRev = fixedSell * b.quantity * BASE_PRICE_PER_KG * (1 - discount)
      const fixedWaste = (1 - fixedSell) * b.quantity

      // Scenario B: demand-responsive — ε = −1.2
      const demandBoost = 1 + Math.abs(EPSILON) * discount
      const elasticSell = Math.min(1.0, baseSell * demandBoost)
      const elasticRev = elasticSell * b.quantity * BASE_PRICE_PER_KG * (1 - discount)
      const elasticWaste = (1 - elasticSell) * b.quantity
      const elasticWasteAvoided = fixedWaste - elasticWaste

      // No-markdown baseline
      const baseRev = baseSell * b.quantity * BASE_PRICE_PER_KG
      const baseWaste = (1 - baseSell) * b.quantity

      return {
        batchId: b.batch_id,
        farmId: b.farm_id,
        quantity: b.quantity,
        remainingHours: remaining,
        initialHours: initial,
        pctUsed,
        tier,
        discount,
        baseSellThrough: baseSell,
        fixedSellThrough: fixedSell,
        fixedRevenue: fixedRev,
        fixedWaste,
        elasticSellThrough: elasticSell,
        elasticRevenue: elasticRev,
        elasticWaste,
        elasticWasteAvoided,
        baseRevenue: baseRev,
        baseWaste,
      } as BatchAnalysis
    })
    .filter(Boolean) as BatchAnalysis[]
}

function fmt(n: number) { return n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
function fmtPct(n: number) { return (n * 100).toFixed(1) + '%' }
function fmtRs(n: number) { return '₹' + fmt(n) }

function TierBadge({ tier }: { tier: Tier }) {
  if (tier === 'critical')
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900/60 text-red-300 border border-red-700">CRITICAL — 25% off</span>
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-900/60 text-amber-300 border border-amber-700">PROACTIVE — 15% off</span>
}

function Delta({ val, better }: { val: number; better: 'positive' | 'negative' }) {
  const isGood = better === 'positive' ? val >= 0 : val <= 0
  const sign = val >= 0 ? '+' : ''
  return (
    <span className={isGood ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
      {sign}{fmtPct(val)}
    </span>
  )
}

export default function MarkdownPage() {
  const { state, markdownConfig, applyMarkdown, clearMarkdowns } = useStore()
  const [analyses, setAnalyses] = useState<BatchAnalysis[]>([])
  const [applied, setApplied] = useState<Record<string, 'fixed' | 'elastic'>>({})
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function load() {
      let s = state
      if (!s) {
        try { s = await fetchState() } catch {}
      }
      if (s?.batches) setAnalyses(computeAnalysis(s.batches))
    }
    load()
  }, [state])

  // sync from store on mount
  useEffect(() => {
    const init: Record<string, 'fixed' | 'elastic'> = {}
    Object.values(markdownConfig).forEach((m) => { init[m.batchId] = m.scenario })
    setApplied(init)
  }, [])

  function handleApply(a: BatchAnalysis, scenario: 'fixed' | 'elastic') {
    const next = { ...applied, [a.batchId]: scenario }
    setApplied(next)
    applyMarkdown({
      batchId: a.batchId,
      discount: a.discount,
      scenario,
      appliedAt: new Date().toISOString(),
    })
    showToast(`Markdown applied to ${a.batchId} (${scenario === 'elastic' ? 'demand-responsive' : 'fixed demand'})`)
  }

  function handleClearAll() {
    setApplied({})
    clearMarkdowns()
    showToast('All markdowns cleared')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const totalAtRisk = analyses.reduce((s, a) => s + a.quantity, 0)
  const totalWasteBase = analyses.reduce((s, a) => s + a.baseWaste, 0)
  const totalWasteElastic = analyses.reduce((s, a) => s + a.elasticWaste, 0)
  const totalWastePrevented = totalWasteBase - totalWasteElastic
  const criticalCount = analyses.filter((a) => a.tier === 'critical').length
  const proactiveCount = analyses.filter((a) => a.tier === 'proactive').length
  const appliedCount = Object.keys(applied).length

  if (analyses.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-[var(--text)] mb-2">Markdown Pricing</h1>
        <p className="text-[var(--text-2)] text-sm">
          {state ? 'No at-risk batches detected — all batches have &gt; 96 h shelf life remaining.' : 'Load the dashboard first to fetch supply chain state.'}
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-emerald-900 border border-emerald-600 text-emerald-200 text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Dynamic Markdowns & Spoilage Prevention</h1>
          <p className="text-sm text-[var(--text-2)] mt-1">
            Per-batch markdown recommendations driven by shelf-life rules. Compare fixed demand vs. demand-responsive
            scenarios using price elasticity ε&nbsp;=&nbsp;−1.2.
          </p>
        </div>
        {appliedCount > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-red-400 border border-red-800 px-3 py-1.5 rounded hover:bg-red-900/30 transition-colors"
          >
            Clear all markdowns ({appliedCount})
          </button>
        )}
      </div>

      {/* Rules legend */}
      <div className="flex gap-3 text-xs text-[var(--text-2)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          &lt; 48 h remaining → Critical → 25% markdown
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          48–96 h remaining → Proactive → 15% markdown
        </span>
        <span className="flex items-center gap-1.5 ml-4 italic">
          Base price: ₹{BASE_PRICE_PER_KG}/kg · ε = −1.2
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'At-Risk Volume', value: fmt(totalAtRisk) + ' kg', sub: `${criticalCount} critical · ${proactiveCount} proactive`, color: 'text-amber-400' },
          { label: 'Projected Waste (no action)', value: fmt(totalWasteBase) + ' kg', sub: fmtPct(totalWasteBase / totalAtRisk) + ' of at-risk volume', color: 'text-red-400' },
          { label: 'Waste Prevented (elastic)', value: fmt(totalWastePrevented) + ' kg', sub: fmtPct(totalWastePrevented / totalAtRisk) + ' reduction', color: 'text-emerald-400' },
          { label: 'Markdowns Applied', value: `${appliedCount} / ${analyses.length}`, sub: appliedCount > 0 ? 'Synced with optimizer' : 'None applied yet', color: appliedCount > 0 ? 'text-emerald-400' : 'text-[var(--text-3)]' },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--text-2)] mb-1">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-[var(--text-3)] mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Per-batch cards */}
      <div className="space-y-5">
        {analyses.map((a) => {
          const isApplied = !!applied[a.batchId]
          const appliedScenario = applied[a.batchId]

          return (
            <div
              key={a.batchId}
              className={`rounded-xl border bg-[var(--surface)] overflow-hidden ${
                isApplied ? 'border-emerald-700' : a.tier === 'critical' ? 'border-red-800' : 'border-amber-800'
              }`}
            >
              {/* Batch header */}
              <div className={`px-5 py-3 flex items-center justify-between ${
                a.tier === 'critical' ? 'bg-red-950/40' : 'bg-amber-950/30'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[var(--text)]">{a.batchId}</span>
                  <span className="text-xs text-[var(--text-3)]">Farm {a.farmId}</span>
                  <TierBadge tier={a.tier} />
                  {isApplied && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                      ✓ Markdown Applied
                    </span>
                  )}
                </div>
                <div className="text-right text-xs text-[var(--text-2)]">
                  <span className="font-semibold text-[var(--text)]">{fmt(a.quantity)} kg</span>
                  <span className="ml-2">{a.remainingHours.toFixed(0)} h remaining</span>
                  <span className="ml-2 text-[var(--text-3)]">({fmtPct(a.pctUsed)} shelf life used)</span>
                </div>
              </div>

              {/* Three scenario columns */}
              <div className="grid grid-cols-3 divide-x divide-[var(--border)]">

                {/* Baseline */}
                <div className="p-4 space-y-3">
                  <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide">No Markdown (baseline)</div>
                  <Row label="Sell-through" value={fmtPct(a.baseSellThrough)} />
                  <Row label="Revenue" value={fmtRs(a.baseRevenue)} />
                  <Row label="Waste" value={fmt(a.baseWaste) + ' kg'} highlight="red" />
                  <Row label="Waste avoided" value="—" />
                  <Row label="Net salvage" value={fmtRs(a.baseRevenue)} />
                </div>

                {/* Scenario A */}
                <div className={`p-4 space-y-3 ${appliedScenario === 'fixed' ? 'ring-1 ring-inset ring-emerald-700' : ''}`}>
                  <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                    Scenario A — Fixed Demand
                  </div>
                  <Row label="Sell-through" value={fmtPct(a.fixedSellThrough)} delta={0} />
                  <Row
                    label="Revenue"
                    value={fmtRs(a.fixedRevenue)}
                    delta={(a.fixedRevenue - a.baseRevenue) / a.baseRevenue}
                    better="positive"
                  />
                  <Row label="Waste" value={fmt(a.fixedWaste) + ' kg'} highlight="red" />
                  <Row label="Waste avoided" value="0 kg (demand unchanged)" dimmed />
                  <Row label="Net salvage" value={fmtRs(a.fixedRevenue)} />
                  <button
                    onClick={() => handleApply(a, 'fixed')}
                    disabled={appliedScenario === 'fixed'}
                    className={`w-full mt-2 py-1.5 rounded text-xs font-semibold transition-colors ${
                      appliedScenario === 'fixed'
                        ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700 cursor-default'
                        : 'bg-blue-900/40 text-blue-300 border border-blue-700 hover:bg-blue-900/60'
                    }`}
                  >
                    {appliedScenario === 'fixed' ? '✓ Applied' : 'Apply Markdown (Fixed)'}
                  </button>
                </div>

                {/* Scenario B */}
                <div className={`p-4 space-y-3 ${appliedScenario === 'elastic' ? 'ring-1 ring-inset ring-emerald-700' : ''}`}>
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                    Scenario B — Demand-Responsive (ε = −1.2)
                  </div>
                  <Row
                    label="Sell-through"
                    value={fmtPct(a.elasticSellThrough)}
                    delta={(a.elasticSellThrough - a.baseSellThrough) / a.baseSellThrough}
                    better="positive"
                  />
                  <Row
                    label="Revenue"
                    value={fmtRs(a.elasticRevenue)}
                    delta={(a.elasticRevenue - a.baseRevenue) / a.baseRevenue}
                    better="positive"
                  />
                  <Row label="Waste" value={fmt(a.elasticWaste) + ' kg'} highlight={a.elasticWaste < a.baseWaste * 0.5 ? 'green' : 'amber'} />
                  <Row label="Waste avoided" value={fmt(a.elasticWasteAvoided) + ' kg'} highlight="green" />
                  <Row label="Net salvage" value={fmtRs(a.elasticRevenue)} />
                  <button
                    onClick={() => handleApply(a, 'elastic')}
                    disabled={appliedScenario === 'elastic'}
                    className={`w-full mt-2 py-1.5 rounded text-xs font-semibold transition-colors ${
                      appliedScenario === 'elastic'
                        ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700 cursor-default'
                        : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700 hover:bg-emerald-900/70'
                    }`}
                  >
                    {appliedScenario === 'elastic' ? '✓ Applied' : 'Apply Markdown (Elastic) ★'}
                  </button>
                </div>
              </div>

              {/* Insight bar */}
              <div className="px-5 py-2 border-t border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text-2)]">
                {a.tier === 'critical'
                  ? `⚡ Critical batch: a 25% markdown boosts demand by ${(Math.abs(EPSILON) * 0.25 * 100).toFixed(0)}% (ε = −1.2), salvaging ${fmtRs(a.elasticRevenue)} vs ${fmtRs(a.baseRevenue)} at full price — ${fmtRs(a.elasticRevenue - a.baseRevenue)} ${a.elasticRevenue >= a.baseRevenue ? 'more' : 'less'} and ${fmt(a.elasticWasteAvoided)} kg less waste.`
                  : `💡 Proactive batch: a 15% markdown boosts demand by ${(Math.abs(EPSILON) * 0.15 * 100).toFixed(0)}% (ε = −1.2). Net revenue ${a.elasticRevenue >= a.baseRevenue ? `increases by ${fmtRs(a.elasticRevenue - a.baseRevenue)}` : `changes by ${fmtRs(a.elasticRevenue - a.baseRevenue)}`} while preventing ${fmt(a.elasticWasteAvoided)} kg of spoilage.`
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Optimizer sync notice */}
      {appliedCount > 0 && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          <span className="font-semibold">✓ {appliedCount} markdown{appliedCount > 1 ? 's' : ''} applied</span>
          {' '}— demand-boost adjustments are synced with the Zustand store. Head to{' '}
          <a href="/plan" className="underline hover:text-emerald-100">Plan Delivery</a>{' '}
          and re-run the optimizer to reflect these markdowns in route allocations.
        </div>
      )}
    </div>
  )
}

function Row({
  label, value, delta, better, highlight, dimmed,
}: {
  label: string
  value: string
  delta?: number
  better?: 'positive' | 'negative'
  highlight?: 'red' | 'amber' | 'green'
  dimmed?: boolean
}) {
  const valColor =
    highlight === 'red' ? 'text-red-400' :
    highlight === 'amber' ? 'text-amber-400' :
    highlight === 'green' ? 'text-emerald-400' :
    dimmed ? 'text-[var(--text-3)]' :
    'text-[var(--text)]'

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-[var(--text-2)]">{label}</span>
      <span className={`text-xs font-semibold ${valColor} flex items-center gap-1`}>
        {value}
        {delta !== undefined && better && !isNaN(delta) && (
          <Delta val={delta} better={better} />
        )}
      </span>
    </div>
  )
}
