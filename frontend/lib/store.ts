import { create } from 'zustand'
import type {
  SupplyChainState,
  LambdaWeights,
  OptimizeOut,
  AllocationResult,
  ReoptimizeOut,
} from './types'

export interface MarkdownEntry {
  batchId: string
  discount: number
  scenario: 'fixed' | 'elastic'
  appliedAt: string
}

export interface AttemptLogEntry {
  attempt: number
  label: string
  what_changed: string
  objective_score: number
  spoilage_pct: number
  fulfillment_pct: number
  runtime_s: number
}

interface AppState {
  state: SupplyChainState | null
  numBatches: number
  seed: number
  lambdaWeights: LambdaWeights
  optimizeResult: OptimizeOut | null
  baselineResults: AllocationResult[]
  disruptedState: SupplyChainState | null
  disruptionDesc: string
  reoptimizeResult: ReoptimizeOut | null
  attemptLog: AttemptLogEntry[]
  markdownConfig: Record<string, MarkdownEntry>

  setNumBatches(n: number): void
  setSeed(s: number): void
  setLambdaWeights(w: Partial<LambdaWeights>): void
  setState(s: SupplyChainState): void
  setOptimizeResult(r: OptimizeOut): void
  setDisruptedState(s: SupplyChainState, desc: string): void
  setReoptimizeResult(r: ReoptimizeOut): void
  addAttempt(e: AttemptLogEntry): void
  applyMarkdown(entry: MarkdownEntry): void
  clearMarkdowns(): void
  reset(): void
}

const defaultState: Omit<AppState, keyof {
  setNumBatches: any; setSeed: any; setLambdaWeights: any; setState: any;
  setOptimizeResult: any; setDisruptedState: any; setReoptimizeResult: any;
  addAttempt: any; reset: any;
}> = {
  state: null,
  numBatches: 10,
  seed: 42,
  lambdaWeights: { spoilage: 10, cost: 0.15, unmet: 15, risk: 5 },
  optimizeResult: null,
  baselineResults: [],
  disruptedState: null,
  disruptionDesc: '',
  reoptimizeResult: null,
  attemptLog: [],
  markdownConfig: {},
}

export const useStore = create<AppState>()((set) => ({
  ...defaultState,

  setNumBatches: (n) => set({ numBatches: n }),
  setSeed: (s) => set({ seed: s }),
  setLambdaWeights: (w) =>
    set((prev) => ({ lambdaWeights: { ...prev.lambdaWeights, ...w } })),
  setState: (s) => set({ state: s }),
  setOptimizeResult: (r) =>
    set({ optimizeResult: r, baselineResults: r.baseline_results }),
  setDisruptedState: (s, desc) => set({ disruptedState: s, disruptionDesc: desc }),
  setReoptimizeResult: (r) => set({ reoptimizeResult: r }),
  addAttempt: (e) => set((prev) => ({ attemptLog: [...prev.attemptLog, e] })),
  applyMarkdown: (entry) =>
    set((prev) => ({ markdownConfig: { ...prev.markdownConfig, [entry.batchId]: entry } })),
  clearMarkdowns: () => set({ markdownConfig: {} }),
  reset: () => set({ ...defaultState }),
}))
