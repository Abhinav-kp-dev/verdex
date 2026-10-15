import type { SupplyChainState, OptimizeOut, SimulateOut, ReoptimizeOut, LambdaWeights, WeatherRiskOut, ParetoOut } from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function fetchState(): Promise<SupplyChainState> {
  return apiFetch<SupplyChainState>('/api/state')
}

export async function regenerateState(params: {
  num_batches?: number
  seed?: number
}): Promise<SupplyChainState> {
  return apiFetch<SupplyChainState>('/api/state/regenerate', {
    method: 'POST',
    body: JSON.stringify({ num_batches: params.num_batches ?? 10, seed: params.seed ?? 42 }),
  })
}

export async function optimize(params: {
  state: SupplyChainState
  lambda_weights?: LambdaWeights
}): Promise<OptimizeOut> {
  return apiFetch<OptimizeOut>('/api/optimize/', {
    method: 'POST',
    body: JSON.stringify({ state: params.state, lambda_weights: params.lambda_weights }),
  })
}

export async function simulate(params: {
  state: SupplyChainState
  disruption_type: string
  target_id?: string
}): Promise<SimulateOut> {
  return apiFetch<SimulateOut>('/api/simulate/', {
    method: 'POST',
    body: JSON.stringify({ state: params.state, disruption_type: params.disruption_type, target_id: params.target_id }),
  })
}

export async function reoptimize(params: {
  disrupted_state: SupplyChainState
  lambda_weights?: LambdaWeights
}): Promise<ReoptimizeOut> {
  return apiFetch<ReoptimizeOut>('/api/reoptimize/', {
    method: 'POST',
    body: JSON.stringify({ disrupted_state: params.disrupted_state, lambda_weights: params.lambda_weights }),
  })
}

export async function fetchWeatherRisk(state: SupplyChainState): Promise<WeatherRiskOut> {
  return apiFetch<WeatherRiskOut>('/api/weather/network-risk', {
    method: 'POST',
    body: JSON.stringify(state),
  })
}

export async function applyWeatherDisruption(state: SupplyChainState): Promise<SimulateOut> {
  return apiFetch<SimulateOut>('/api/weather/apply-disruption', {
    method: 'POST',
    body: JSON.stringify(state),
  })
}

export async function fetchPareto(params: { state: SupplyChainState; resolution?: number }): Promise<ParetoOut> {
  return apiFetch<ParetoOut>('/api/optimize/pareto', {
    method: 'POST',
    body: JSON.stringify({ state: params.state, resolution: params.resolution ?? 5 }),
  })
}

export async function fetchScalability(): Promise<any[]> {
  return apiFetch<any[]>('/api/reports/scalability')
}

export async function fetchRobustness(): Promise<any[]> {
  return apiFetch<any[]>('/api/reports/robustness')
}

export async function uploadData(formData: FormData): Promise<SupplyChainState> {
  const res = await fetch(`${BASE_URL}/api/data/upload`, { method: 'POST', body: formData })
  if (!res.ok) { const text = await res.text(); throw new Error(`Upload error ${res.status}: ${text}`) }
  return res.json() as Promise<SupplyChainState>
}

export async function downloadTemplates(): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/api/data/templates`)
  if (!res.ok) { const text = await res.text(); throw new Error(`Download error ${res.status}: ${text}`) }
  return res.blob()
}
