'use client'

import { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { fetchState } from '@/lib/api'

// ─── Static enrichment maps ──────────────────────────────────────────────────

const FARM_META: Record<string, { location: string; commodity: string; category: string }> = {
  F1: { location: 'Nashik', commodity: 'Tomatoes', category: 'Vegetables' },
  F2: { location: 'Kolar', commodity: 'Onions', category: 'Vegetables' },
  F3: { location: 'Guntur', commodity: 'Green Chillies', category: 'Spices' },
}

const GRADE_FOR_TEMP: Record<number, string> = {}

function deriveMeta(farmId: string, batchId: string) {
  const fm = FARM_META[farmId] ?? { location: 'Unknown', commodity: 'Mixed Produce', category: 'Vegetables' }
  const num = parseInt(batchId.replace(/\D/g, ''), 10) || 0
  const grade = num % 3 === 0 ? 'A' : num % 3 === 1 ? 'B' : 'C'
  const costPerKg = fm.category === 'Spices' ? 45 : fm.commodity === 'Tomatoes' ? 18 : 12
  const storageTemp = fm.category === 'Spices' ? 8 : fm.commodity === 'Onions' ? 15 : 12
  const handlingHours = 1.5 + (num % 3) * 0.5
  return { ...fm, grade, costPerKg, storageTemp, handlingHours }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BatchRow {
  batchId: string
  farmId: string
  commodity: string
  category: string
  quantity: number
  remainingShelfLife: number
  initialShelfLife: number
  temperature: number
  arrivalDate: string      // ISO
  handlingHours: number
  storageTemp: number
  grade: string
  costPerKg: number
  isCustom: boolean
  isAllocated: boolean
}

type Status = 'Fresh' | 'At Risk' | 'Low Shelf Life' | 'Critical'

function getStatus(h: number): Status {
  if (h < 24) return 'Critical'
  if (h < 48) return 'Low Shelf Life'
  if (h < 96) return 'At Risk'
  return 'Fresh'
}

const STATUS_COLOR: Record<Status, string> = {
  Fresh: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  'At Risk': 'bg-amber-900/60 text-amber-300 border-amber-700',
  'Low Shelf Life': 'bg-orange-900/60 text-orange-300 border-orange-700',
  Critical: 'bg-red-900/60 text-red-300 border-red-700',
}

const SHELF_BAR: Record<Status, string> = {
  Fresh: 'bg-emerald-500',
  'At Risk': 'bg-amber-400',
  'Low Shelf Life': 'bg-orange-500',
  Critical: 'bg-red-500',
}

const CATEGORIES = ['All', 'Vegetables', 'Fruits', 'Spices', 'Grains', 'Dairy']
const STATUSES: (Status | 'All')[] = ['All', 'Fresh', 'At Risk', 'Low Shelf Life', 'Critical']

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  commodity: '',
  category: 'Vegetables',
  farmId: '',
  quantity: '',
  initialShelfLifeHours: '',
  remainingShelfLifeHours: '',
  arrivalDate: '',
  handlingHours: '',
  storageTemp: '',
  grade: 'A',
  costPerKg: '',
  temperature: '',
}

type FormData = typeof EMPTY_FORM

// ─── Component ───────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { state, optimizeResult, setState: setStoreState } = useStore()
  const [rows, setRows] = useState<BatchRow[]>([])
  const [customBatches, setCustomBatches] = useState<BatchRow[]>([])

  // UI state
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All')
  const [sortBy, setSortBy] = useState<'shelf_life' | 'quantity' | 'batchId'>('shelf_life')

  // Modal state
  const [modal, setModal] = useState<'none' | 'add' | 'view' | 'edit'>('none')
  const [selectedRow, setSelectedRow] = useState<BatchRow | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<FormData>>({})

  // Load custom batches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('verdex_custom_batches')
      if (saved) setCustomBatches(JSON.parse(saved))
    } catch {}
  }, [])

  // Build rows from state
  useEffect(() => {
    async function load() {
      let s = state
      if (!s) { try { s = await fetchState() } catch {} }
      if (!s?.batches) return

      const allocatedIds = new Set(
        (optimizeResult?.result?.allocations ?? []).map((a: any) => a.batch_id)
      )

      const stateRows: BatchRow[] = Object.values(s.batches).map((b: any) => {
        const meta = deriveMeta(b.farm_id, b.batch_id)
        const now = new Date()
        const arrival = new Date(now.getTime() - b.harvest_time * 3600 * 1000)
        return {
          batchId: b.batch_id,
          farmId: b.farm_id,
          commodity: meta.commodity,
          category: meta.category,
          quantity: b.quantity,
          remainingShelfLife: b.remaining_shelf_life_hours,
          initialShelfLife: b.initial_shelf_life_hours,
          temperature: b.temperature ?? meta.storageTemp,
          arrivalDate: arrival.toISOString(),
          handlingHours: meta.handlingHours,
          storageTemp: meta.storageTemp,
          grade: meta.grade,
          costPerKg: meta.costPerKg,
          isCustom: false,
          isAllocated: allocatedIds.has(b.batch_id),
        }
      })
      setRows(stateRows)
    }
    load()
  }, [state, optimizeResult])

  // Merge + filter + sort
  const allRows = useMemo(() => [...rows, ...customBatches], [rows, customBatches])

  const filtered = useMemo(() => {
    let r = allRows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(
        (b) =>
          b.batchId.toLowerCase().includes(q) ||
          b.commodity.toLowerCase().includes(q) ||
          b.farmId.toLowerCase().includes(q)
      )
    }
    if (catFilter !== 'All') r = r.filter((b) => b.category === catFilter)
    if (statusFilter !== 'All') r = r.filter((b) => getStatus(b.remainingShelfLife) === statusFilter)
    if (sortBy === 'shelf_life') r = [...r].sort((a, b) => a.remainingShelfLife - b.remainingShelfLife)
    if (sortBy === 'quantity') r = [...r].sort((a, b) => b.quantity - a.quantity)
    if (sortBy === 'batchId') r = [...r].sort((a, b) => a.batchId.localeCompare(b.batchId))
    return r
  }, [allRows, search, catFilter, statusFilter, sortBy])

  // Stats
  const atRisk = allRows.filter((b) => getStatus(b.remainingShelfLife) !== 'Fresh').length
  const totalKg = allRows.reduce((s, b) => s + b.quantity, 0)
  const allocatedKg = allRows.filter((b) => b.isAllocated).reduce((s, b) => s + b.quantity, 0)

  // Form helpers
  function openAdd() {
    setForm({ ...EMPTY_FORM, arrivalDate: new Date().toISOString().slice(0, 16) })
    setErrors({})
    setModal('add')
  }

  function openView(row: BatchRow) {
    setSelectedRow(row)
    setModal('view')
  }

  function openEdit(row: BatchRow) {
    if (row.isAllocated) return
    setSelectedRow(row)
    setForm({
      commodity: row.commodity,
      category: row.category,
      farmId: row.farmId,
      quantity: String(row.quantity),
      initialShelfLifeHours: String(row.initialShelfLife),
      remainingShelfLifeHours: String(row.remainingShelfLife),
      arrivalDate: row.arrivalDate.slice(0, 16),
      handlingHours: String(row.handlingHours),
      storageTemp: String(row.storageTemp),
      grade: row.grade,
      costPerKg: String(row.costPerKg),
      temperature: String(row.temperature),
    })
    setErrors({})
    setModal('edit')
  }

  function handleDelete(row: BatchRow) {
    if (row.isAllocated) return
    if (!row.isCustom) return
    const next = customBatches.filter((b) => b.batchId !== row.batchId)
    setCustomBatches(next)
    localStorage.setItem('verdex_custom_batches', JSON.stringify(next))
  }

  function validate(f: FormData): Partial<FormData> {
    const e: Partial<FormData> = {}
    if (!f.commodity.trim()) e.commodity = 'Required'
    if (!f.farmId.trim()) e.farmId = 'Required'
    if (!f.quantity || isNaN(Number(f.quantity)) || Number(f.quantity) <= 0) e.quantity = 'Must be > 0'
    if (!f.initialShelfLifeHours || isNaN(Number(f.initialShelfLifeHours))) e.initialShelfLifeHours = 'Required'
    if (!f.remainingShelfLifeHours || isNaN(Number(f.remainingShelfLifeHours))) e.remainingShelfLifeHours = 'Required'
    if (!f.costPerKg || isNaN(Number(f.costPerKg))) e.costPerKg = 'Required'
    if (!f.storageTemp || isNaN(Number(f.storageTemp))) e.storageTemp = 'Required'
    if (!f.handlingHours || isNaN(Number(f.handlingHours))) e.handlingHours = 'Required'
    return e
  }

  function handleSubmit() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }

    const newRow: BatchRow = {
      batchId: modal === 'add'
        ? `CB${Date.now().toString().slice(-4)}`
        : selectedRow!.batchId,
      farmId: form.farmId,
      commodity: form.commodity,
      category: form.category,
      quantity: Number(form.quantity),
      remainingShelfLife: Number(form.remainingShelfLifeHours),
      initialShelfLife: Number(form.initialShelfLifeHours),
      temperature: Number(form.temperature) || Number(form.storageTemp),
      arrivalDate: new Date(form.arrivalDate).toISOString(),
      handlingHours: Number(form.handlingHours),
      storageTemp: Number(form.storageTemp),
      grade: form.grade,
      costPerKg: Number(form.costPerKg),
      isCustom: true,
      isAllocated: false,
    }

    let next: BatchRow[]
    if (modal === 'add') {
      next = [...customBatches, newRow]
    } else {
      next = customBatches.map((b) => b.batchId === newRow.batchId ? newRow : b)
    }
    setCustomBatches(next)
    localStorage.setItem('verdex_custom_batches', JSON.stringify(next))
    setModal('none')
  }

  function fmt(n: number) { return n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
  function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) }
    catch { return iso }
  }

  return (
    <div className="p-6 space-y-5 max-w-[1300px]">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Produce Inventory</h1>
          <p className="text-sm text-[var(--text-2)] mt-1">
            Live batch tracking with shelf-life monitoring, grade, and cost management.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
        >
          + Register New Produce Batch
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Batches', value: allRows.length, color: 'text-[var(--text)]' },
          { label: 'Total Volume', value: fmt(totalKg) + ' kg', color: 'text-emerald-400' },
          { label: 'Allocated (Locked)', value: fmt(allocatedKg) + ' kg', color: 'text-blue-400' },
          { label: 'At-Risk Batches', value: atRisk, color: atRisk > 0 ? 'text-amber-400' : 'text-emerald-400' },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--text-2)] mb-1">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search batch ID, commodity, farm…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 px-3 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-emerald-600 w-64"
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] focus:outline-none"
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] focus:outline-none"
        >
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] focus:outline-none"
        >
          <option value="shelf_life">Sort: Most Urgent First</option>
          <option value="quantity">Sort: Quantity (High→Low)</option>
          <option value="batchId">Sort: Batch ID</option>
        </select>
        <span className="text-xs text-[var(--text-3)] ml-auto">{filtered.length} of {allRows.length} batches</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                {['Batch ID', 'Commodity', 'Category', 'Available / Total', 'Shelf Life', 'Arrival', 'Handling', 'Storage °C', 'Grade', '₹/kg', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-2)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-[var(--text-3)]">
                    No batches match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const status = getStatus(row.remainingShelfLife)
                const shelfPct = Math.max(0, Math.min(100, (row.remainingShelfLife / row.initialShelfLife) * 100))
                return (
                  <tr key={row.batchId} className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-[var(--text)]">{row.batchId}</span>
                        {row.isAllocated && (
                          <span title="Allocated — locked" className="text-blue-400 text-xs">🔒</span>
                        )}
                        {row.isCustom && (
                          <span className="text-xs px-1 rounded bg-purple-900/40 text-purple-400 border border-purple-700">custom</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text)]">{row.commodity}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text-2)]">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text)] whitespace-nowrap">
                      {row.quantity.toLocaleString('en-IN')} kg
                    </td>
                    <td className="px-3 py-2.5 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div className={`h-full rounded-full ${SHELF_BAR[status]}`} style={{ width: shelfPct + '%' }} />
                        </div>
                        <span className="text-xs text-[var(--text-2)] whitespace-nowrap">
                          {row.remainingShelfLife.toFixed(0)}h
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-2)] whitespace-nowrap">{fmtDate(row.arrivalDate)}</td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-2)]">{row.handlingHours}h</td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-2)]">{row.storageTemp}°C</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${
                        row.grade === 'A' ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' :
                        row.grade === 'B' ? 'bg-amber-900/50 text-amber-300 border-amber-700' :
                        'bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)]'
                      }`}>{row.grade}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text)]">₹{row.costPerKg}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_COLOR[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openView(row)} className="text-xs text-[var(--text-2)] hover:text-[var(--text)] px-1.5 py-0.5 rounded hover:bg-[var(--surface)]" title="View">👁</button>
                        {!row.isAllocated && row.isCustom && (
                          <>
                            <button onClick={() => openEdit(row)} className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded hover:bg-blue-900/20" title="Edit">✏️</button>
                            <button onClick={() => handleDelete(row)} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-900/20" title="Delete">🗑</button>
                          </>
                        )}
                        {row.isAllocated && (
                          <span className="text-xs text-blue-400/60" title="Locked — already allocated to route">locked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl w-full max-w-xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text)]">
                {modal === 'add' ? 'Register New Produce Batch' : modal === 'edit' ? `Edit ${selectedRow?.batchId}` : `Batch — ${selectedRow?.batchId}`}
              </h2>
              <button onClick={() => setModal('none')} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg leading-none">×</button>
            </div>

            {modal === 'view' && selectedRow && (
              <div className="p-5 grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Batch ID', selectedRow.batchId],
                  ['Commodity', selectedRow.commodity],
                  ['Category', selectedRow.category],
                  ['Farm / Origin', selectedRow.farmId],
                  ['Quantity', `${selectedRow.quantity.toLocaleString('en-IN')} kg`],
                  ['Shelf Life Remaining', `${selectedRow.remainingShelfLife.toFixed(1)} h`],
                  ['Initial Shelf Life', `${selectedRow.initialShelfLife.toFixed(1)} h`],
                  ['Arrival Date', fmtDate(selectedRow.arrivalDate)],
                  ['Handling Time', `${selectedRow.handlingHours} h`],
                  ['Storage Temp', `${selectedRow.storageTemp} °C`],
                  ['Batch Temp', `${selectedRow.temperature} °C`],
                  ['Grade', selectedRow.grade],
                  ['Cost per kg', `₹${selectedRow.costPerKg}`],
                  ['Status', getStatus(selectedRow.remainingShelfLife)],
                  ['Allocated', selectedRow.isAllocated ? 'Yes — locked' : 'No'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="text-xs text-[var(--text-3)]">{label}</div>
                    <div className="text-[var(--text)] font-medium mt-0.5">{val}</div>
                  </div>
                ))}
              </div>
            )}

            {(modal === 'add' || modal === 'edit') && (
              <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Commodity *" error={errors.commodity}>
                    <input className={input()} value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} placeholder="e.g. Tomatoes" />
                  </Field>
                  <Field label="Category *">
                    <select className={input()} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {['Vegetables', 'Fruits', 'Spices', 'Grains', 'Dairy'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Farm / Origin *" error={errors.farmId}>
                    <input className={input()} value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })} placeholder="e.g. F1 or Nashik Farm" />
                  </Field>
                  <Field label="Quantity (kg) *" error={errors.quantity}>
                    <input className={input()} type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
                  </Field>
                  <Field label="Initial Shelf Life (hours) *" error={errors.initialShelfLifeHours}>
                    <input className={input()} type="number" min="1" value={form.initialShelfLifeHours} onChange={(e) => setForm({ ...form, initialShelfLifeHours: e.target.value })} placeholder="120" />
                  </Field>
                  <Field label="Remaining Shelf Life (hours) *" error={errors.remainingShelfLifeHours}>
                    <input className={input()} type="number" min="0" value={form.remainingShelfLifeHours} onChange={(e) => setForm({ ...form, remainingShelfLifeHours: e.target.value })} placeholder="96" />
                  </Field>
                  <Field label="Arrival Date *">
                    <input className={input()} type="datetime-local" value={form.arrivalDate} onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })} />
                  </Field>
                  <Field label="Handling Time (hours) *" error={errors.handlingHours}>
                    <input className={input()} type="number" step="0.5" min="0" value={form.handlingHours} onChange={(e) => setForm({ ...form, handlingHours: e.target.value })} placeholder="1.5" />
                  </Field>
                  <Field label="Storage Temperature (°C) *" error={errors.storageTemp}>
                    <input className={input()} type="number" value={form.storageTemp} onChange={(e) => setForm({ ...form, storageTemp: e.target.value })} placeholder="12" />
                  </Field>
                  <Field label="Batch Temperature (°C)">
                    <input className={input()} type="number" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} placeholder="same as storage" />
                  </Field>
                  <Field label="Grade *">
                    <select className={input()} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                      {['A', 'B', 'C'].map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </Field>
                  <Field label="Cost per kg (₹) *" error={errors.costPerKg}>
                    <input className={input()} type="number" step="0.5" min="0" value={form.costPerKg} onChange={(e) => setForm({ ...form, costPerKg: e.target.value })} placeholder="18" />
                  </Field>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors">
                    {modal === 'add' ? 'Register Batch' : 'Save Changes'}
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-2)] mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  )
}

function input() {
  return 'w-full h-8 px-2.5 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] focus:outline-none focus:border-emerald-600'
}
