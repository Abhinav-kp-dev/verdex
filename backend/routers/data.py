"""Data router: GET /api/data/templates, POST /api/data/upload."""

from __future__ import annotations

import io
import os
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from backend.schemas import SupplyChainStateOut, state_to_schema
from src.data_generator import generate_supply_chain
from src.data_loader import export_state_to_csv, load_state_from_csv

router = APIRouter()

_CSV_FILES = ["farms.csv", "storage.csv", "markets.csv", "batches.csv", "routes.csv"]


@router.get("/templates")
def download_templates() -> StreamingResponse:
    """Generate a default supply chain state, export to CSV files, and return as a ZIP."""
    state = generate_supply_chain(
        num_farms=3,
        num_storage=2,
        num_markets=3,
        num_batches=10,
        num_trucks=5,
        seed=42,
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        export_state_to_csv(state, tmpdir)

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for csv_name in _CSV_FILES:
                csv_path = os.path.join(tmpdir, csv_name)
                if os.path.exists(csv_path):
                    zf.write(csv_path, arcname=csv_name)

        zip_buffer.seek(0)
        # Copy buffer contents because TemporaryDirectory will be deleted after the with block.
        zip_bytes = io.BytesIO(zip_buffer.read())

    zip_bytes.seek(0)
    return StreamingResponse(
        zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=freshroute_templates.zip"},
    )


@router.post("/upload", response_model=SupplyChainStateOut)
async def upload_data(
    farms: UploadFile = File(...),
    storage: UploadFile = File(...),
    markets: UploadFile = File(...),
    batches: UploadFile = File(...),
    routes: UploadFile = File(...),
) -> SupplyChainStateOut:
    """Accept CSV uploads for each entity type and return the parsed supply chain state."""
    file_map = {
        "farms.csv": farms,
        "storage.csv": storage,
        "markets.csv": markets,
        "batches.csv": batches,
        "routes.csv": routes,
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        for filename, upload in file_map.items():
            dest_path = os.path.join(tmpdir, filename)
            contents = await upload.read()
            with open(dest_path, "wb") as f:
                f.write(contents)

        try:
            state = load_state_from_csv(tmpdir)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"CSV parsing error: {exc}") from exc

    return state_to_schema(state)
