"""State router: GET /api/state, POST /api/state/regenerate."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter

from backend.schemas import RegenerateIn, SupplyChainStateOut, state_to_schema
from src.data_generator import generate_supply_chain

router = APIRouter()

# Module-level store so state persists across requests within one process lifetime.
_store: dict = {"state": None}


def _get_or_create_state() -> SupplyChainStateOut:
    if _store["state"] is None:
        raw = generate_supply_chain(
            num_farms=3,
            num_storage=2,
            num_markets=3,
            num_batches=10,
            num_trucks=5,
            seed=42,
        )
        _store["state"] = state_to_schema(raw)
    return _store["state"]


@router.get("/", response_model=SupplyChainStateOut)
def get_state() -> SupplyChainStateOut:
    """Return the current supply chain state, generating a default one on first call."""
    return _get_or_create_state()


@router.post("/regenerate", response_model=SupplyChainStateOut)
def regenerate_state(body: RegenerateIn) -> SupplyChainStateOut:
    """Generate a fresh supply chain state with the given parameters."""
    raw = generate_supply_chain(
        num_farms=3,
        num_storage=2,
        num_markets=3,
        num_batches=body.num_batches,
        num_trucks=5,
        seed=body.seed,
    )
    _store["state"] = state_to_schema(raw)
    return _store["state"]
