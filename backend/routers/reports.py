"""Reports router: GET /api/reports/scalability, GET /api/reports/robustness."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/scalability", response_model=List[Dict[str, Any]])
def scalability_report() -> List[Dict[str, Any]]:
    """Run the scalability experiment and return results as a list of records."""
    try:
        from src.experiments import run_scalability_study
        df = run_scalability_study()
        return df.to_dict(orient="records")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scalability experiment error: {exc}") from exc


@router.get("/robustness", response_model=List[Dict[str, Any]])
def robustness_report() -> List[Dict[str, Any]]:
    """Run the robustness study and return results as a list of records."""
    try:
        from src.experiments import run_robustness_study
        # Use a small number of scenarios to keep response time reasonable for the API.
        df = run_robustness_study(num_scenarios=20)
        return df.to_dict(orient="records")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Robustness experiment error: {exc}") from exc
