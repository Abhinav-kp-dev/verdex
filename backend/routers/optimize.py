"""Optimize router: POST /api/optimize."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter, HTTPException

from backend.schemas import (
    OptimizeIn,
    OptimizeOut,
    allocation_result_to_schema,
    schema_to_state,
)
from src.spoilage_model import SpoilageModel
from src.optimizer import DynamicPerishableOptimizer
from src.baseline_nearest import solve_nearest_market
from src.baseline_cheapest import solve_cheapest_route

router = APIRouter()


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

    return OptimizeOut(
        result=allocation_result_to_schema(dpsro_result),
        baseline_results=[
            allocation_result_to_schema(nearest_result),
            allocation_result_to_schema(cheapest_result),
        ],
    )
