"""Reoptimize router: POST /api/reoptimize."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter, HTTPException

from backend.schemas import (
    ReoptimizeIn,
    ReoptimizeOut,
    RecoveryStats,
    allocation_result_to_schema,
    schema_to_state,
)
from src.spoilage_model import SpoilageModel
from src.optimizer import DynamicPerishableOptimizer
from src.dynamic_optimizer import DynamicReoptimizer

router = APIRouter()


@router.post("/", response_model=ReoptimizeOut)
def reoptimize(body: ReoptimizeIn) -> ReoptimizeOut:
    """Run dynamic re-optimization on a disrupted supply chain state."""
    disrupted_state = schema_to_state(body.disrupted_state)
    lw = body.lambda_weights

    spoilage_model = SpoilageModel()
    optimizer = DynamicPerishableOptimizer(
        spoilage_model=spoilage_model,
        lambda_spoilage=lw.spoilage,
        lambda_cost=lw.cost,
        lambda_unmet_demand=lw.unmet,
        lambda_risk=lw.risk,
    )

    # We need a prior result as baseline — run the optimizer on the disrupted state
    # directly to get a prior, then re-optimize using DynamicReoptimizer.
    try:
        prior_result = optimizer.solve(disrupted_state)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prior solve error: {exc}") from exc

    reoptimizer = DynamicReoptimizer(optimizer=optimizer)

    try:
        result, recovery_summary = reoptimizer.reoptimize_after_disruption(
            post_disruption_state=disrupted_state,
            prior_result=prior_result,
            elapsed_hours_during_disruption=2.0,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Reoptimizer error: {exc}") from exc

    # Compute recovery stats from the merged result and recovery summary
    affected_batches = recovery_summary.get("affected_batch_count", len(recovery_summary.get("affected_batches", [])))
    rerouted = len(recovery_summary.get("affected_batches", []))
    recovery_time_s = recovery_summary.get("recovery_time_seconds", result.runtime_seconds)
    delivered_fresh_pct = result.demand_fulfillment_percentage

    recovery_stats = RecoveryStats(
        affected_batches=affected_batches,
        rerouted=rerouted,
        recovery_time_s=recovery_time_s,
        delivered_fresh_pct=delivered_fresh_pct,
    )

    return ReoptimizeOut(
        result=allocation_result_to_schema(result),
        recovery_stats=recovery_stats,
    )
