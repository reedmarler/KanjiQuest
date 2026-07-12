from __future__ import annotations

from pathlib import Path
from typing import Any

from generator import DEFAULT_DB_PATH, generate_variant, init_database

try:
    from fastapi import FastAPI
    from pydantic import BaseModel, Field
except ImportError as exc:  # pragma: no cover - helpful local error
    raise SystemExit(
        "FastAPI is optional. Install it with: pip install fastapi uvicorn"
    ) from exc


class GenerateRequest(BaseModel):
    target_jlpt: str = Field(default="N5", pattern="^N[1-5]$")
    frame_id: str | None = None
    previous_slots: dict[str, str] | None = None
    swap_slots: list[str] | None = None
    seed: int | None = None


app = FastAPI(title="Kanji Quest Sentence Generator")


@app.on_event("startup")
def startup() -> None:
    if not Path(DEFAULT_DB_PATH).exists():
        init_database(DEFAULT_DB_PATH)


@app.post("/generate")
def generate(req: GenerateRequest) -> dict[str, Any]:
    return generate_variant(
        target_jlpt=req.target_jlpt,
        frame_id=req.frame_id,
        previous_slots=req.previous_slots,
        swap_slots=req.swap_slots,
        seed=req.seed,
    ).to_dict()


@app.post("/reload-vocab")
def reload_vocab() -> dict[str, str]:
    init_database(DEFAULT_DB_PATH)
    return {"status": "ok"}
