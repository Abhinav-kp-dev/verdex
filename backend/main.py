"""FreshRoute FastAPI backend entry point.

Run with:
    uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the project root is on sys.path so that src/ is importable.
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import state as state_router
from backend.routers import optimize as optimize_router
from backend.routers import simulate as simulate_router
from backend.routers import reoptimize as reoptimize_router
from backend.routers import reports as reports_router
from backend.routers import data as data_router
from backend.routers import weather as weather_router

app = FastAPI(
    title="FreshRoute API",
    description="Perishable supply-chain optimizer backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


app.include_router(state_router.router, prefix="/api/state", tags=["state"])
app.include_router(optimize_router.router, prefix="/api/optimize", tags=["optimize"])
app.include_router(simulate_router.router, prefix="/api/simulate", tags=["simulate"])
app.include_router(reoptimize_router.router, prefix="/api/reoptimize", tags=["reoptimize"])
app.include_router(reports_router.router, prefix="/api/reports", tags=["reports"])
app.include_router(data_router.router, prefix="/api/data", tags=["data"])
app.include_router(weather_router.router, prefix="/api/weather", tags=["weather"])
