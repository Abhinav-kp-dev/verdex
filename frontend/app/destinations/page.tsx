'use client'

import { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { fetchState } from '@/lib/api'

// ─── Static enrichment ────────────────────────────────────────────────────────

const MARKET_META: Record<string, {
  name: string; hubType: 'wholesale' | 'cold_hub' | 'food_bank'
  contact: string; phone: string
  dockDeadline: string; vehicleCapacity: number; dockTimeHours: number
  commodityDemands: { commodity: string; pricePerKg: number; minShelfLifeHours: number }[]
}> = {
  M1: {
    name: 'Mumbai APMC Wholesale Terminal',
    hubType: 'wholesale',
    contact: 'Rajesh Patil',
    phone: '+91 98200 12345',
    dockDeadline: '06:00',
    vehicleCapacity: 5000,
    dockTimeHours: 2,
    commodityDemands: [
      { commodity: 'Tomatoes', pricePerKg: 28, minShelfLifeHours: 36 },
      { commodity: 'Onions', pricePerKg: 20, minShelfLifeHours: 48 },
      { commodity: 'Green Chillies', pricePerKg: 60, minShelfLifeHours: 24 },
    ],
  },
  M2: {
    name: 'Chennai Cold Distribution Hub',
    hubType: 'cold_hub',
    contact: 'Priya Sharma',
    phone: '+91 94440 67890',
    dockDeadline: '07:30',
    vehicleCapacity: 3000,
    dockTimeHours: 1.5,
    commodityDemands: [
      { commodity: 'Tomatoes', pricePerKg: 32, minShelfLifeHours: 48 },
      { commodity: 'Green Chillies', pricePerKg: 65, minShelfLifeHours: 36 },
    ],
  },
  M3: {
    name: 'Hyderabad Community Food Bank',
    hubType: 'food_bank',
    contact: 'Arun Kumar',
    phone: '+91 96660 34567',
    dockDeadline: '09:00',
    vehicleCapacity: 2000,
    dockTimeHours: 1,
    commodityDemands: [
      { commodity: 'Tomatoes', pricePerKg: 22, minShelfLifeHours: 24 },
      { commodity: 'Onions', pricePerKg: 15, minShelfLifeHours: 36 },
    ],
  },
}

const HUB_TYPE_STYLE: Record<string, { label: string; color: string; icon: string }> = {
  wholesale: { label: 'Wholesale Terminal', color: 'bg-blue-900/40 text-blue-300 border-blue-700', icon: '🏪' },
  cold_hub: { label: 'Cold Hub', color: 'bg-cyan-900/40 text-cyan-300 border-cyan-700', icon: '🧊' },
  food_bank: { label: 'Food Bank', color: 'bg-purple-900/40 text-purple-300 border-purple-700', icon: '🤝' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DestinationCard {
  marketId: string
  name: string
  hubType: 'wholesale' | 'cold_hub' | 'food_bank'
  contact: string
  phone: string
  demand: number
  priority: number
  dockDeadline: string
  vehicleCapacity: number
  dockTimeHours: number
  transitTimeHours: number
  distanceKm: number
  transportRatePerKm: number
  commodityDemands: { commodity: string; pricePerKg: number; minShelfLifeHours: number }[]
  isCustom: boolean
}

const EMPTY_FORM = {
  name: '',
  hubType: 'wholesale' as const,
  contact: '',
  phone: '',
  distanceKm: '',
  transitTimeHours: '',
  transportRatePerKm: '',
  vehicleCapacity: '',
  dockTimeHours: '',
  dockDeadline: '',
  demand: '',
  priority: '1.0',
  commodityDemands: [{ commodity: '', pricePerKg: '', minShelfLifeHours: '' }] as { commodity: string; pricePerKg: string; minShelfLifeHours: string }[],
}
type FormData = typeof EMPTY_FORM

// ─── Component ────────────────────────────────────────────────────────────────

export default function DestinationsPage() {
  const { state } = useStore()
  const [destinations, setDestinations] = useState<DestinationCard[]>([])
  const [customDests, setCustomDests] = useState<DestinationCard[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [modal, setModal] = useState<'none' | 'add' | 'view' | 'edit'>('none')
  const [selectedDest, setSelectedDest] = useState<DestinationCard | null>(null)
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [search, setSearch] = useState('')
  const [hubFilter, setHubFilter] = useState('All')

  // Load custom destinations from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('verdex_custom_destinations')
      if (saved) setCustomDests(JSON.parse(saved))
    } catch {}
  }, [])

  // Build destination cards from state
  useEffect(() => {
    async function load() {
      let s = state
      if (!s) { try { s = await fetchState() } catch {} }
      if (!s?.markets) return

      const cards: DestinationCard[] = Object.values(s.markets).map((m: any) => {
        const meta = MARKET_META[m.market_id]

        // Get distance/transport from routes to this market
        const toMarketRoutes = Object.values(s.routes ?? {}).filter(
          (r: any) => r.destination === m.market_id
        )
        const avgDist = toMarketRoutes.length
          ? toMarketRoutes.reduce((sum: number, r: any) => sum + r.distance_km, 0) / toMarketRoutes.length
          : 0
        const avgCost = toMarketRoutes.length
          ? toMarketRoutes.reduce((sum: number, r: any) => sum + r.transport_cost_per_unit, 0) / toMarketRoutes.length
          : 0
        const avgTransit = avgDist > 0 ? avgDist / 60 : 8 // ~60 km/h average

        return {
          marketId: m.market_id,
          name: meta?.name ?? `Market ${m.market_id}`,
          hubType: meta?.hubType ?? 'wholesale',
          contact: meta?.contact ?? '—',
          phone: meta?.phone ?? '—',
          demand: m.demand,
          priority: m.priority,
          dockDeadline: meta?.dockDeadline ?? '08:00',
          vehicleCapacity: meta?.vehicleCapacity ?? 3000,
          dockTimeHours: meta?.dockTimeHours ?? 1.5,
          transitTimeHours: parseFloat(avgTransit.toFixed(1)),
          distanceKm: parseFloat(avgDist.toFixed(0)),
          transportRatePerKm: parseFloat(avgCost.toFixed(2)),
          commodityDemands: meta?.commodityDemands ?? [],
          isCustom: false,
        } as DestinationCard
      })
      setDestinations(cards)
    }
    load()
  }, [state])

  const allDests = useMemo(() => [...destinations, ...customDests], [destinations, customDests])

  const filtered = useMemo(() => {
    let r = allDests
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((d) => d.name.toLowerCase().includes(q) || d.marketId.toLowerCase().includes(q) || d.contact.toLowerCase().includes(q))
    }
    if (hubFilter !== 'All') r = r.filter((d) => d.hubType === hubFilter)
    return r
  }, [allDests, search, hubFilter])

  function fmt(n: number) { return n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setErrors({})
    setModal('add')
  }

  function openView(d: DestinationCard) { setSelectedDest(d); setModal('view') }

  function openEdit(d: DestinationCard) {
    setSelectedDest(d)
    setForm({
      name: d.name,
      hubType: d.hubType,
      contact: d.contact,
      phone: d.phone,
      distanceKm: String(d.distanceKm),
      transitTimeHours: String(d.transitTimeHours),
      transportRatePerKm: String(d.transportRatePerKm),
      vehicleCapacity: String(d.vehicleCapacity),
      dockTimeHours: String(d.dockTimeHours),
      dockDeadline: d.dockDeadline,
      demand: String(d.demand),
      priority: String(d.priority),
      commodityDemands: d.commodityDemands.length > 0
        ? d.commodityDemands.map((cd) => ({ commodity: cd.commodity, pricePerKg: String(cd.pricePerKg), minShelfLifeHours: String(cd.minShelfLifeHours) }))
        : [{ commodity: '', pricePerKg: '', minShelfLifeHours: '' }],
    })
    setErrors({})
    setModal('edit')
  }

  function handleDelete(d: DestinationCard) {
    if (!d.isCustom) return
    const next = customDests.filter((c) => c.marketId !== d.marketId)
    setCustomDests(next)
    localStorage.setItem('verdex_custom_destinations', JSON.stringify(next))
  }

  function validate(f: FormData): Record<string, string> {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = 'Required'
    if (!f.contact.trim()) e.contact = 'Required'
    if (!f.distanceKm || isNaN(Number(f.distanceKm))) e.distanceKm = 'Required'
    if (!f.transitTimeHours || isNaN(Number(f.transitTimeHours))) e.transitTimeHours = 'Required'
    if (!f.transportRatePerKm || isNaN(Number(f.transportRatePerKm))) e.transportRatePerKm = 'Required'
    if (!f.vehicleCapacity || isNaN(Number(f.vehicleCapacity))) e.vehicleCapacity = 'Required'
    if (!f.demand || isNaN(Number(f.demand))) e.demand = 'Required'
    return e
  }

  function handleSubmit() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }

    const newDest: DestinationCard = {
      marketId: modal === 'add' ? `CM${Date.now().toString().slice(-4)}` : selectedDest!.marketId,
      name: form.name,
      hubType: form.hubType,
      contact: form.contact,
      phone: form.phone,
      demand: Number(form.demand),
      priority: Number(form.priority) || 1,
      dockDeadline: form.dockDeadline || '08:00',
      vehicleCapacity: Number(form.vehicleCapacity),
      dockTimeHours: Number(form.dockTimeHours) || 1.5,
      transitTimeHours: Number(form.transitTimeHours),
      distanceKm: Number(form.distanceKm),
      transportRatePerKm: Number(form.transportRatePerKm),
      commodityDemands: form.commodityDemands
        .filter((cd) => cd.commodity.trim())
        .map((cd) => ({
          commodity: cd.commodity,
          pricePerKg: Number(cd.pricePerKg) || 0,
          minShelfLifeHours: Number(cd.minShelfLifeHours) || 24,
        })),
      isCustom: true,
    }

    let next: DestinationCard[]
    if (modal === 'add') {
      next = [...customDests, newDest]
    } else {
      next = customDests.map((d) => d.marketId === newDest.marketId ? newDest : d)
    }
    setCustomDests(next)
    localStorage.setItem('verdex_custom_destinations', JSON.stringify(next))
    setModal('none')
  }

  function addCommodityRow() {
    setForm({ ...form, commodityDemands: [...form.commodityDemands, { commodity: '', pricePerKg: '', minShelfLifeHours: '' }] })
  }

  function removeCommodityRow(i: number) {
    setForm({ ...form, commodityDemands: form.commodityDemands.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Destinations & Demand</h1>
          <p className="text-sm text-[var(--text-2)] mt-1">
            Hub management — wholesale terminals, cold hubs, and food banks with per-commodity demand and shelf-life requirements.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
        >
          + Register Destination Market
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Destinations', value: allDests.length },
          { label: 'Total Demand', value: fmt(allDests.reduce((s, d) => s + d.demand, 0)) + ' kg' },
          { label: 'Avg Transit Time', value: allDests.length ? (allDests.reduce((s, d) => s + d.transitTimeHours, 0) / allDests.length).toFixed(1) + ' h' : '—' },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--text-2)] mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-emerald-400">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search name, ID, contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 px-3 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-emerald-600 w-64"
        />
        <select
          value={hubFilter}
          onChange={(e) => setHubFilter(e.target.value)}
          className="h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] focus:outline-none"
        >
          <option value="All">All Types</option>
          <option value="wholesale">Wholesale Terminal</option>
          <option value="cold_hub">Cold Hub</option>
          <option value="food_bank">Food Bank</option>
        </select>
        <span className="text-xs text-[var(--text-3)] ml-auto">{filtered.length} destination{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Hub cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((d) => {
          const hs = HUB_TYPE_STYLE[d.hubType]
          const isExpanded = expandedId === d.marketId

          return (
            <div key={d.marketId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden">
              {/* Card header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{hs.icon}</span>
                    <div>
                      <div className="font-semibold text-[var(--text)] text-sm leading-tight">{d.name}</div>
                      <div className="text-xs text-[var(--text-3)] mt-0.5 font-mono">{d.marketId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.isCustom && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400 border border-purple-700">custom</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${hs.color}`}>
                      {hs.label}
                    </span>
                  </div>
                </div>

                {/* Key metrics grid */}
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <MetricRow label="Distance" value={d.distanceKm > 0 ? `${d.distanceKm} km` : '—'} />
                  <MetricRow label="Transit Time" value={`${d.transitTimeHours} h`} />
                  <MetricRow label="Transport Rate" value={d.transportRatePerKm > 0 ? `₹${d.transportRatePerKm}/km` : '—'} />
                  <MetricRow label="Vehicle Capacity" value={`${fmt(d.vehicleCapacity)} kg`} />
                  <MetricRow label="Dock Deadline" value={d.dockDeadline} />
                  <MetricRow label="Dock Time" value={`${d.dockTimeHours} h`} />
                  <MetricRow label="Total Demand" value={`${fmt(d.demand)} kg`} />
                  <MetricRow label="Priority" value={`${d.priority}×`} />
                </div>

                {/* Contact */}
                <div className="mt-3 flex items-center justify-between text-xs border-t border-[var(--border)] pt-2">
                  <span className="text-[var(--text-2)]">👤 {d.contact}</span>
                  {d.phone !== '—' && <span className="text-[var(--text-3)]">{d.phone}</span>}
                </div>
              </div>

              {/* Per-commodity demand (expandable) */}
              {d.commodityDemands.length > 0 && (
                <>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : d.marketId)}
                    className="px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors flex items-center justify-between"
                  >
                    <span>Per-commodity demand ({d.commodityDemands.length} items)</span>
                    <span>{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] bg-[var(--bg)]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th className="px-4 py-2 text-left text-[var(--text-3)] font-semibold">Commodity</th>
                            <th className="px-4 py-2 text-right text-[var(--text-3)] font-semibold">Price/kg</th>
                            <th className="px-4 py-2 text-right text-[var(--text-3)] font-semibold">Min Shelf Life</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.commodityDemands.map((cd) => (
                            <tr key={cd.commodity} className="border-b border-[var(--border)]">
                              <td className="px-4 py-2 text-[var(--text)]">{cd.commodity}</td>
                              <td className="px-4 py-2 text-right text-emerald-400 font-semibold">₹{cd.pricePerKg}</td>
                              <td className="px-4 py-2 text-right text-[var(--text-2)]">{cd.minShelfLifeHours}h on arrival</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="px-4 py-2.5 border-t border-[var(--border)] flex gap-2 mt-auto">
                <button onClick={() => openView(d)} className="text-xs text-[var(--text-2)] hover:text-[var(--text)] px-2 py-1 rounded hover:bg-[var(--surface)] transition-colors">
                  View Details
                </button>
                {d.isCustom && (
                  <>
                    <button onClick={() => openEdit(d)} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-900/20 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(d)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20 transition-colors ml-auto">
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-3 py-12 text-center text-sm text-[var(--text-3)]">
            No destinations match the current filters.
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text)]">
                {modal === 'add' ? 'Register Destination Market' : modal === 'edit' ? `Edit ${selectedDest?.name}` : selectedDest?.name}
              </h2>
              <button onClick={() => setModal('none')} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg leading-none">×</button>
            </div>

            {modal === 'view' && selectedDest && (
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ['Market ID', selectedDest.marketId],
                    ['Hub Type', HUB_TYPE_STYLE[selectedDest.hubType]?.label],
                    ['Contact', selectedDest.contact],
                    ['Phone', selectedDest.phone],
                    ['Distance', `${selectedDest.distanceKm} km`],
                    ['Transit Time', `${selectedDest.transitTimeHours} h`],
                    ['Transport Rate', `₹${selectedDest.transportRatePerKm}/km`],
                    ['Vehicle Capacity', `${fmt(selectedDest.vehicleCapacity)} kg`],
                    ['Dock Deadline', selectedDest.dockDeadline],
                    ['Dock Time', `${selectedDest.dockTimeHours} h`],
                    ['Total Demand', `${fmt(selectedDest.demand)} kg`],
                    ['Priority', `${selectedDest.priority}×`],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div className="text-xs text-[var(--text-3)]">{label}</div>
                      <div className="text-[var(--text)] font-medium mt-0.5">{val}</div>
                    </div>
                  ))}
                </div>
                {selectedDest.commodityDemands.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide mb-2">Per-Commodity Demand</div>
                    <table className="w-full text-xs border border-[var(--border)] rounded-lg overflow-hidden">
                      <thead><tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                        <th className="px-3 py-2 text-left text-[var(--text-3)]">Commodity</th>
                        <th className="px-3 py-2 text-right text-[var(--text-3)]">Price/kg</th>
                        <th className="px-3 py-2 text-right text-[var(--text-3)]">Min Shelf Life on Arrival</th>
                      </tr></thead>
                      <tbody>
                        {selectedDest.commodityDemands.map((cd) => (
                          <tr key={cd.commodity} className="border-b border-[var(--border)]">
                            <td className="px-3 py-2 text-[var(--text)]">{cd.commodity}</td>
                            <td className="px-3 py-2 text-right text-emerald-400">₹{cd.pricePerKg}</td>
                            <td className="px-3 py-2 text-right text-[var(--text-2)]">{cd.minShelfLifeHours} h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {(modal === 'add' || modal === 'edit') && (
              <form className="p-5 space-y-5" onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
                <Section title="Hub Information">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Field label="Destination Name *" error={errors.name}>
                        <input className={inp()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mumbai APMC Wholesale Terminal" />
                      </Field>
                    </div>
                    <Field label="Hub Type">
                      <select className={inp()} value={form.hubType} onChange={(e) => setForm({ ...form, hubType: e.target.value as any })}>
                        <option value="wholesale">Wholesale Terminal</option>
                        <option value="cold_hub">Cold Hub</option>
                        <option value="food_bank">Food Bank</option>
                      </select>
                    </Field>
                    <Field label="Priority (1.0 = standard)">
                      <input className={inp()} type="number" step="0.1" min="0.5" max="3" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                    </Field>
                    <Field label="Contact Name *" error={errors.contact}>
                      <input className={inp()} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="e.g. Rajesh Patil" />
                    </Field>
                    <Field label="Phone">
                      <input className={inp()} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98200 12345" />
                    </Field>
                  </div>
                </Section>

                <Section title="Logistics">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Distance (km) *" error={errors.distanceKm}>
                      <input className={inp()} type="number" min="0" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} placeholder="850" />
                    </Field>
                    <Field label="Travel Time (hours) *" error={errors.transitTimeHours}>
                      <input className={inp()} type="number" step="0.5" min="0" value={form.transitTimeHours} onChange={(e) => setForm({ ...form, transitTimeHours: e.target.value })} placeholder="14" />
                    </Field>
                    <Field label="Transport Rate (₹/km) *" error={errors.transportRatePerKm}>
                      <input className={inp()} type="number" step="0.1" min="0" value={form.transportRatePerKm} onChange={(e) => setForm({ ...form, transportRatePerKm: e.target.value })} placeholder="2.5" />
                    </Field>
                    <Field label="Vehicle Capacity (kg) *" error={errors.vehicleCapacity}>
                      <input className={inp()} type="number" min="0" value={form.vehicleCapacity} onChange={(e) => setForm({ ...form, vehicleCapacity: e.target.value })} placeholder="5000" />
                    </Field>
                    <Field label="Dock Handling Time (hours)">
                      <input className={inp()} type="number" step="0.5" min="0" value={form.dockTimeHours} onChange={(e) => setForm({ ...form, dockTimeHours: e.target.value })} placeholder="1.5" />
                    </Field>
                    <Field label="Dock Deadline (HH:MM)">
                      <input className={inp()} type="time" value={form.dockDeadline} onChange={(e) => setForm({ ...form, dockDeadline: e.target.value })} />
                    </Field>
                    <Field label="Total Demand (kg) *" error={errors.demand}>
                      <input className={inp()} type="number" min="0" value={form.demand} onChange={(e) => setForm({ ...form, demand: e.target.value })} placeholder="3500" />
                    </Field>
                  </div>
                </Section>

                <Section title="Per-Commodity Demand">
                  <div className="space-y-2">
                    {form.commodityDemands.map((cd, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input className={inp()} placeholder="Commodity (e.g. Tomatoes)" value={cd.commodity}
                            onChange={(e) => {
                              const next = [...form.commodityDemands]; next[i] = { ...next[i], commodity: e.target.value }
                              setForm({ ...form, commodityDemands: next })
                            }} />
                        </div>
                        <div className="w-28">
                          <input className={inp()} placeholder="₹/kg" type="number" min="0" value={cd.pricePerKg}
                            onChange={(e) => {
                              const next = [...form.commodityDemands]; next[i] = { ...next[i], pricePerKg: e.target.value }
                              setForm({ ...form, commodityDemands: next })
                            }} />
                        </div>
                        <div className="w-32">
                          <input className={inp()} placeholder="Min shelf (h)" type="number" min="0" value={cd.minShelfLifeHours}
                            onChange={(e) => {
                              const next = [...form.commodityDemands]; next[i] = { ...next[i], minShelfLifeHours: e.target.value }
                              setForm({ ...form, commodityDemands: next })
                            }} />
                        </div>
                        {form.commodityDemands.length > 1 && (
                          <button type="button" onClick={() => removeCommodityRow(i)} className="text-red-400 hover:text-red-300 text-xs px-1.5 py-1.5 rounded hover:bg-red-900/20">✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addCommodityRow} className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded border border-emerald-800 hover:bg-emerald-900/20 transition-colors">
                      + Add Commodity
                    </button>
                  </div>
                </Section>

                <div className="flex gap-3">
                  <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors">
                    {modal === 'add' ? 'Register Destination' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setModal('none')} className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-2)] text-sm hover:text-[var(--text)] transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[var(--text-3)]">{label}</span>
      <span className="text-[var(--text)] font-medium">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide mb-3 pb-1.5 border-b border-[var(--border)]">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-2)] mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  )
}

function inp() {
  return 'w-full h-8 px-2.5 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] focus:outline-none focus:border-emerald-600'
}
