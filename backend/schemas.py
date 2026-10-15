"""Pydantic v2 schemas for FreshRoute FastAPI backend."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from src.models import (
    AllocationDecision,
    AllocationResult,
    Batch,
    Farm,
    Market,
    StorageFacility,
    SupplyChainState,
    TransportRoute,
    Truck,
)


# ---------------------------------------------------------------------------
# Entity schemas
# ---------------------------------------------------------------------------

class FarmOut(BaseModel):
    farm_id: str
    location_x: float
    location_y: float
    lat: float
    lon: float
    available_quantity: float
    harvest_time: float


class StorageFacilityOut(BaseModel):
    storage_id: str
    location_x: float
    location_y: float
    lat: float
    lon: float
    capacity: float
    current_load: float
    temperature_capacity: float
    available: bool


class MarketOut(BaseModel):
    market_id: str
    location_x: float
    location_y: float
    lat: float
    lon: float
    demand: float
    priority: float


class TransportRouteOut(BaseModel):
    route_id: str
    source: str
    destination: str
    distance_km: float
    travel_time_hours: float
    transport_cost_per_unit: float
    available: bool
    risk_factor: float
    co2_kg_per_km: float = 0.9


class BatchOut(BaseModel):
    batch_id: str
    farm_id: str
    commodity: str
    quantity: float
    harvest_time: float
    initial_shelf_life_hours: float
    remaining_shelf_life_hours: float
    temperature: float
    quality_level: float


class TruckOut(BaseModel):
    truck_id: str
    capacity: float
    available: bool
    current_location: str
    travel_time_factor: float


# ---------------------------------------------------------------------------
# Supply chain state
# ---------------------------------------------------------------------------

class SupplyChainStateOut(BaseModel):
    farms: Dict[str, FarmOut]
    storage_facilities: Dict[str, StorageFacilityOut]
    markets: Dict[str, MarketOut]
    routes: Dict[str, TransportRouteOut]
    batches: Dict[str, BatchOut]
    trucks: Dict[str, TruckOut]
    current_time_hours: float = 0.0
    disruptions_applied: List[Dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Allocation schemas
# ---------------------------------------------------------------------------

class AllocationDecisionOut(BaseModel):
    batch_id: str
    farm_id: str
    storage_id: Optional[str]
    market_id: str
    quantity: float
    spoilage_fraction: float
    spoiled_qty: float
    delivered_qty: float
    transport_cost: float
    travel_time_hours: float
    risk_score: float
    route_ids: List[str] = Field(default_factory=list)


class AllocationResultOut(BaseModel):
    method_name: str
    allocations: List[AllocationDecisionOut]
    total_dispatched: float
    total_delivered: float
    total_spoilage: float
    spoilage_percentage: float
    demand_fulfillment_percentage: float
    unmet_demand: float
    total_transport_cost: float
    total_risk_score: float
    runtime_seconds: float
    solver_status: str
    is_feasible: bool
    objective_value: float = 0.0
    extra_metrics: Dict[str, Any] = Field(default_factory=dict)
    total_co2_kg: float = 0.0


class ParetoPointOut(BaseModel):
    lambda_spoilage: float
    lambda_cost: float
    spoilage_pct: float
    total_cost: float
    fulfillment_pct: float
    total_co2_kg: float


class ParetoOut(BaseModel):
    points: List[ParetoPointOut]


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class LambdaWeightsIn(BaseModel):
    spoilage: float = 10.0
    cost: float = 0.15
    unmet: float = 15.0
    risk: float = 5.0
    carbon: float = 0.0


class RegenerateIn(BaseModel):
    num_batches: int = 10
    seed: int = 42


class OptimizeIn(BaseModel):
    state: SupplyChainStateOut
    lambda_weights: LambdaWeightsIn = Field(default_factory=LambdaWeightsIn)


class OptimizeOut(BaseModel):
    result: AllocationResultOut
    baseline_results: List[AllocationResultOut]


class SimulateIn(BaseModel):
    state: SupplyChainStateOut
    disruption_type: str
    target_id: Optional[str] = None


class SimulateOut(BaseModel):
    disrupted_state: SupplyChainStateOut
    description: str
    affected_count: int


class ReoptimizeIn(BaseModel):
    disrupted_state: SupplyChainStateOut
    lambda_weights: LambdaWeightsIn = Field(default_factory=LambdaWeightsIn)


class RecoveryStats(BaseModel):
    affected_batches: int
    rerouted: int
    recovery_time_s: float
    delivered_fresh_pct: float


class ReoptimizeOut(BaseModel):
    result: AllocationResultOut
    recovery_stats: RecoveryStats


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------

def state_to_schema(state: SupplyChainState) -> SupplyChainStateOut:
    """Convert a SupplyChainState dataclass to SupplyChainStateOut Pydantic model."""

    farms_out: Dict[str, FarmOut] = {}
    for fid, farm in state.farms.items():
        farms_out[fid] = FarmOut(
            farm_id=farm.farm_id,
            location_x=farm.location[0],
            location_y=farm.location[1],
            lat=farm.location[0],
            lon=farm.location[1],
            available_quantity=farm.available_quantity,
            harvest_time=farm.harvest_time,
        )

    storage_out: Dict[str, StorageFacilityOut] = {}
    for sid, sf in state.storage_facilities.items():
        storage_out[sid] = StorageFacilityOut(
            storage_id=sf.storage_id,
            location_x=sf.location[0],
            location_y=sf.location[1],
            lat=sf.location[0],
            lon=sf.location[1],
            capacity=sf.capacity,
            current_load=sf.current_load,
            temperature_capacity=sf.temperature_capacity,
            available=sf.available,
        )

    markets_out: Dict[str, MarketOut] = {}
    for mid, market in state.markets.items():
        markets_out[mid] = MarketOut(
            market_id=market.market_id,
            location_x=market.location[0],
            location_y=market.location[1],
            lat=market.location[0],
            lon=market.location[1],
            demand=market.demand,
            priority=market.priority,
        )

    routes_out: Dict[str, TransportRouteOut] = {}
    for rid, route in state.routes.items():
        routes_out[rid] = TransportRouteOut(
            route_id=route.route_id,
            source=route.source,
            destination=route.destination,
            distance_km=route.distance_km,
            travel_time_hours=route.travel_time_hours,
            transport_cost_per_unit=route.transport_cost_per_unit,
            available=route.available,
            risk_factor=route.risk_factor,
            co2_kg_per_km=route.co2_kg_per_km,
        )

    batches_out: Dict[str, BatchOut] = {}
    for bid, batch in state.batches.items():
        batches_out[bid] = BatchOut(
            batch_id=batch.batch_id,
            farm_id=batch.farm_id,
            commodity=batch.commodity,
            quantity=batch.quantity,
            harvest_time=batch.harvest_time,
            initial_shelf_life_hours=batch.initial_shelf_life_hours,
            remaining_shelf_life_hours=batch.remaining_shelf_life_hours,
            temperature=batch.temperature,
            quality_level=batch.quality_level,
        )

    trucks_out: Dict[str, TruckOut] = {}
    for tid, truck in state.trucks.items():
        trucks_out[tid] = TruckOut(
            truck_id=truck.truck_id,
            capacity=truck.capacity,
            available=truck.available,
            current_location=truck.current_location,
            travel_time_factor=truck.travel_time_factor,
        )

    return SupplyChainStateOut(
        farms=farms_out,
        storage_facilities=storage_out,
        markets=markets_out,
        routes=routes_out,
        batches=batches_out,
        trucks=trucks_out,
        current_time_hours=state.current_time_hours,
        disruptions_applied=list(state.disruptions_applied),
    )


def schema_to_state(s: SupplyChainStateOut) -> SupplyChainState:
    """Convert a SupplyChainStateOut Pydantic model back to SupplyChainState dataclass."""

    farms: Dict[str, Farm] = {}
    for fid, f in s.farms.items():
        farms[fid] = Farm(
            farm_id=f.farm_id,
            location=(f.location_x, f.location_y),
            available_quantity=f.available_quantity,
            harvest_time=f.harvest_time,
        )

    storage_facilities: Dict[str, StorageFacility] = {}
    for sid, sf in s.storage_facilities.items():
        storage_facilities[sid] = StorageFacility(
            storage_id=sf.storage_id,
            location=(sf.location_x, sf.location_y),
            capacity=sf.capacity,
            current_load=sf.current_load,
            temperature_capacity=sf.temperature_capacity,
            available=sf.available,
        )

    markets: Dict[str, Market] = {}
    for mid, m in s.markets.items():
        markets[mid] = Market(
            market_id=m.market_id,
            location=(m.location_x, m.location_y),
            demand=m.demand,
            priority=m.priority,
        )

    routes: Dict[str, TransportRoute] = {}
    for rid, r in s.routes.items():
        routes[rid] = TransportRoute(
            route_id=r.route_id,
            source=r.source,
            destination=r.destination,
            distance_km=r.distance_km,
            travel_time_hours=r.travel_time_hours,
            transport_cost_per_unit=r.transport_cost_per_unit,
            available=r.available,
            risk_factor=r.risk_factor,
            co2_kg_per_km=r.co2_kg_per_km,
        )

    batches: Dict[str, Batch] = {}
    for bid, b in s.batches.items():
        batches[bid] = Batch(
            batch_id=b.batch_id,
            farm_id=b.farm_id,
            commodity=b.commodity,
            quantity=b.quantity,
            harvest_time=b.harvest_time,
            initial_shelf_life_hours=b.initial_shelf_life_hours,
            remaining_shelf_life_hours=b.remaining_shelf_life_hours,
            temperature=b.temperature,
            quality_level=b.quality_level,
        )

    trucks: Dict[str, Truck] = {}
    for tid, t in s.trucks.items():
        trucks[tid] = Truck(
            truck_id=t.truck_id,
            capacity=t.capacity,
            available=t.available,
            current_location=t.current_location,
            travel_time_factor=t.travel_time_factor,
        )

    return SupplyChainState(
        farms=farms,
        storage_facilities=storage_facilities,
        markets=markets,
        routes=routes,
        batches=batches,
        trucks=trucks,
        current_time_hours=s.current_time_hours,
        disruptions_applied=list(s.disruptions_applied),
    )


def allocation_result_to_schema(result: AllocationResult) -> AllocationResultOut:
    """Convert AllocationResult dataclass to AllocationResultOut schema."""
    allocations_out = [
        AllocationDecisionOut(
            batch_id=a.batch_id,
            farm_id=a.farm_id,
            storage_id=a.storage_id,
            market_id=a.market_id,
            quantity=a.quantity,
            spoilage_fraction=a.spoilage_fraction,
            spoiled_qty=a.spoiled_qty,
            delivered_qty=a.delivered_qty,
            transport_cost=a.transport_cost,
            travel_time_hours=a.travel_time_hours,
            risk_score=a.risk_score,
            route_ids=list(a.route_ids),
        )
        for a in result.allocations
    ]
    return AllocationResultOut(
        method_name=result.method_name,
        allocations=allocations_out,
        total_dispatched=result.total_dispatched,
        total_delivered=result.total_delivered,
        total_spoilage=result.total_spoilage,
        spoilage_percentage=result.spoilage_percentage,
        demand_fulfillment_percentage=result.demand_fulfillment_percentage,
        unmet_demand=result.unmet_demand,
        total_transport_cost=result.total_transport_cost,
        total_risk_score=result.total_risk_score,
        runtime_seconds=result.runtime_seconds,
        solver_status=result.solver_status,
        is_feasible=result.is_feasible,
        objective_value=result.objective_value,
        extra_metrics=dict(result.extra_metrics),
    )
