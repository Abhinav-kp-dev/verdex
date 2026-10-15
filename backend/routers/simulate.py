"""Simulate router: POST /api/simulate."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter, HTTPException

from backend.schemas import SimulateIn, SimulateOut, schema_to_state, state_to_schema
from src.disruption import (
    TruckFailureDisruption,
    StorageOutageDisruption,
    DemandShockDisruption,
    TemperatureShockDisruption,
    RouteClosureDisruption,
)

router = APIRouter()

_DISRUPTION_MAP = {
    "Truck Breaks Down": "truck",
    "Cold Storage Loses Power": "storage",
    "Demand Shock — Market Surge": "demand",
    "Heatwave — Temperature Shock": "heatwave",
    "Road Closure": "route",
}


def _build_disruption(disruption_type: str, target_id: str | None):
    dtype = disruption_type.strip()

    if dtype == "Truck Breaks Down":
        return TruckFailureDisruption(truck_id=target_id)
    elif dtype == "Cold Storage Loses Power":
        return StorageOutageDisruption(storage_id=target_id)
    elif dtype == "Demand Shock — Market Surge":
        return DemandShockDisruption(market_id=target_id, multiplier=2.5)
    elif dtype == "Heatwave — Temperature Shock":
        return TemperatureShockDisruption(delta_temp_c=12.0)
    elif dtype == "Road Closure":
        return RouteClosureDisruption(route_id=target_id)
    else:
        # Fallback: truck failure
        return TruckFailureDisruption()


@router.post("/", response_model=SimulateOut)
def simulate(body: SimulateIn) -> SimulateOut:
    """Apply a disruption to the supply chain state and return the disrupted state."""
    state = schema_to_state(body.state)
    disrupted = state.clone()

    # Count availability before disruption
    trucks_before = sum(1 for t in disrupted.trucks.values() if t.available)
    routes_before = sum(1 for r in disrupted.routes.values() if r.available)
    storage_before = sum(1 for s in disrupted.storage_facilities.values() if s.available)

    disruption = _build_disruption(body.disruption_type, body.target_id)

    try:
        disrupted = disruption.apply(disrupted)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Disruption error: {exc}") from exc

    # Count availability after disruption
    trucks_after = sum(1 for t in disrupted.trucks.values() if t.available)
    routes_after = sum(1 for r in disrupted.routes.values() if r.available)
    storage_after = sum(1 for s in disrupted.storage_facilities.values() if s.available)

    affected_count = (
        (trucks_before - trucks_after)
        + (routes_before - routes_after)
        + (storage_before - storage_after)
    )

    return SimulateOut(
        disrupted_state=state_to_schema(disrupted),
        description=disruption.describe(),
        affected_count=affected_count,
    )
