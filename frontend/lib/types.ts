// lib/types.ts — all shared TypeScript types

export interface Farm { farm_id: string; location_x: number; location_y: number; lat: number; lon: number; available_quantity: number; harvest_time: number }
export interface StorageFacility { storage_id: string; location_x: number; location_y: number; lat: number; lon: number; capacity: number; current_load: number; temperature_capacity: number; available: boolean }
export interface Market { market_id: string; location_x: number; location_y: number; lat: number; lon: number; demand: number; priority: number }
export interface TransportRoute { route_id: string; source: string; destination: string; distance_km: number; travel_time_hours: number; transport_cost_per_unit: number; available: boolean; risk_factor: number; co2_kg_per_km: number }
export interface Batch { batch_id: string; farm_id: string; commodity: string; quantity: number; harvest_time: number; initial_shelf_life_hours: number; remaining_shelf_life_hours: number; temperature: number; quality_level: number }
export interface Truck { truck_id: string; capacity: number; available: boolean; current_location: string; travel_time_factor: number }

export interface SupplyChainState {
  farms: Record<string, Farm>
  storage_facilities: Record<string, StorageFacility>
  markets: Record<string, Market>
  routes: Record<string, TransportRoute>
  batches: Record<string, Batch>
  trucks: Record<string, Truck>
  current_time_hours: number
  disruptions_applied: any[]
}

export interface LambdaWeights { spoilage: number; cost: number; unmet: number; risk: number; carbon: number }

export interface AllocationDecision { batch_id: string; farm_id: string; storage_id: string | null; market_id: string; quantity: number; spoilage_fraction: number; spoiled_qty: number; delivered_qty: number; transport_cost: number; travel_time_hours: number; risk_score: number; route_ids: string[] }
export interface AllocationResult { method_name: string; allocations: AllocationDecision[]; total_dispatched: number; total_delivered: number; total_spoilage: number; spoilage_percentage: number; demand_fulfillment_percentage: number; unmet_demand: number; total_transport_cost: number; total_risk_score: number; runtime_seconds: number; solver_status: string; is_feasible: boolean; objective_value: number; total_co2_kg: number }

export interface OptimizeOut { result: AllocationResult; baseline_results: AllocationResult[] }
export interface SimulateOut { disrupted_state: SupplyChainState; description: string; affected_count: number }
export interface ReoptimizeOut { result: AllocationResult; recovery_stats: { affected_batches: number; rerouted: number; recovery_time_s: number; delivered_fresh_pct: number } }

export interface NodeWeather { node_id: string; node_type: string; city: string; lat: number; lon: number; current_temp_c: number; max_24h_temp_c: number; heat_risk: boolean }
export interface WeatherRiskOut { nodes: NodeWeather[]; any_heat_risk: boolean; auto_disruption_suggested: boolean; suggested_delta_temp: number }

export interface ParetoPoint { lambda_spoilage: number; lambda_cost: number; spoilage_pct: number; total_cost: number; fulfillment_pct: number; total_co2_kg: number }
export interface ParetoOut { points: ParetoPoint[] }
