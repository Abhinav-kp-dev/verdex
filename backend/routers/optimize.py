"""Optimize router: POST /api/optimize/ and POST /api/optimize/pareto."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.schemas import (
    OptimizeIn,
    OptimizeOut,
    ParetoOut,
    ParetoPointOut,
    SupplyChainStateOut,
    LambdaWeightsIn,
    allocation_result_to_schema,
    schema_to_state,
)
from src.spoilage_model import SpoilageModel
from src.optimizer import DynamicPerishableOptimizer
from src.baseline_nearest import solve_nearest_market
from src.baseline_cheapest import solve_cheapest_route

router = APIRouter()


def _total_co2(result, state) -> float:
    """Compute total CO2 kg for an allocation result using route co2_kg_per_km."""
    total = 0.0
    for alloc in result.allocations:
        for rid in alloc.route_ids:
            r = state.routes.get(rid)
            if r:
                total += r.co2_kg_per_km * r.distance_km * (alloc.quantity / 1000.0)
    return round(total, 1)


@router.post("/", response_model=OptimizeOut)
def optimize(body: OptimizeIn) -> OptimizeOut:
    """Run DPSRO optimizer plus baselines on the provided supply chain state."""
    state = schema_to_state(body.state)
    lw = body.lambda_weights

    spoilage_model = SpoilageModel()
    optimizer = DynamicPerishableOptimizer(
        spoilage_model=spoilage_model,
        lambda_spoilage=lw.spoilage,
        lambda_cost=lw.cost,
        lambda_unmet_demand=lw.unmet,
        lambda_risk=lw.risk,
        lambda_carbon=lw.carbon,
    )

    try:
        dpsro_result = optimizer.solve(state)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Optimizer error: {exc}") from exc

    try:
        nearest_result = solve_nearest_market(state, spoilage_model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Nearest baseline error: {exc}") from exc

    try:
        cheapest_result = solve_cheapest_route(state, spoilage_model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cheapest baseline error: {exc}") from exc

    dpsro_out = allocation_result_to_schema(dpsro_result)
    dpsro_out.total_co2_kg = _total_co2(dpsro_result, state)

    nearest_out = allocation_result_to_schema(nearest_result)
    nearest_out.total_co2_kg = _total_co2(nearest_result, state)

    cheapest_out = allocation_result_to_schema(cheapest_result)
    cheapest_out.total_co2_kg = _total_co2(cheapest_result, state)

    return OptimizeOut(
        result=dpsro_out,
        baseline_results=[nearest_out, cheapest_out],
    )


class ParetoIn(BaseModel):
    state: SupplyChainStateOut
    resolution: int = 5  # grid is resolution x resolution


@router.post("/pareto", response_model=ParetoOut)
def pareto(body: ParetoIn) -> ParetoOut:
    """Sweep (lambda_spoilage, lambda_cost) grid and return Pareto-non-dominated points."""
    state = schema_to_state(body.state)
    spoilage_model = SpoilageModel()
    res = max(2, min(body.resolution, 8))

    # Build grid: spoilage weight 1–20, cost weight 0.05–0.5
    spoilage_vals = [1.0 + (19.0 * i / (res - 1)) for i in range(res)]
    cost_vals = [0.05 + (0.45 * j / (res - 1)) for j in range(res)]

    raw_points = []
    for ls in spoilage_vals:
        for lc in cost_vals:
            try:
                opt = DynamicPerishableOptimizer(
                    spoilage_model=spoilage_model,
                    lambda_spoilage=ls,
                    lambda_cost=lc,
                    lambda_unmet_demand=15.0,
                    lambda_risk=5.0,
                )
                result = opt.solve(state)
                if not result.is_feasible:
                    continue
                co2 = _total_co2(result, state)
                raw_points.append({
                    "lambda_spoilage": round(ls, 2),
                    "lambda_cost": round(lc, 3),
                    "spoilage_pct": round(result.spoilage_percentage, 2),
                    "total_cost": round(result.total_transport_cost, 1),
                    "fulfillment_pct": round(result.demand_fulfillment_percentage, 2),
                    "total_co2_kg": co2,
                })
            except Exception:
                continue

    # Keep Pareto-non-dominated points (minimize both spoilage_pct and total_cost)
    pareto_pts = []
    for p in raw_points:
        dominated = False
        for q in raw_points:
            if q is p:
                continue
            if q["spoilage_pct"] <= p["spoilage_pct"] and q["total_cost"] <= p["total_cost"]:
                if q["spoilage_pct"] < p["spoilage_pct"] or q["total_cost"] < p["total_cost"]:
                    dominated = True
                    break
        if not dominated:
            pareto_pts.append(p)

    # Sort by total_cost ascending for a clean curve
    pareto_pts.sort(key=lambda x: x["total_cost"])

    return ParetoOut(points=[ParetoPointOut(**p) for p in pareto_pts])
