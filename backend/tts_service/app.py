"""FastAPI endpoint for Style-BERT-VITS2 speech synthesis.

Run with:
    uvicorn app:app --host 127.0.0.1 --port 8001

Frontend calls POST /speak and plays the returned audio/wav bytes directly
(e.g. via an <audio> element or the Web Audio API) — same shape as calling
Web Speech API today, just async over HTTP instead of synchronous in-browser.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from tts_engine import DEFAULT_VOICE, VOICES, SpeechSynthesizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tts_service")

app = FastAPI(title="Kanji Quest TTS Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://bunou.app",
        "https://www.bunou.app",
    ],
    allow_methods=["POST"],
    allow_headers=["*"],
)

# Naive in-memory per-IP rate limit — this is a free CPU-bound public
# endpoint, so an unlimited /speak would let anyone run up compute for free.
# Good enough for a hobby app's traffic; swap for something Redis-backed if
# this ever runs on more than one instance.
RATE_LIMIT_REQUESTS = 20
RATE_LIMIT_WINDOW_SECONDS = 60
_request_log: dict[str, deque[float]] = defaultdict(deque)


def _check_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    log = _request_log[client_ip]
    while log and now - log[0] > RATE_LIMIT_WINDOW_SECONDS:
        log.popleft()
    if len(log) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests, slow down.")
    log.append(now)

synthesizer: SpeechSynthesizer | None = None


@app.on_event("startup")
def startup() -> None:
    global synthesizer
    synthesizer = SpeechSynthesizer()
    # Preload the default voice so the first request isn't slow; comment
    # this out (or pass specific voice_ids) if you have many voices and
    # want lazy loading instead.
    synthesizer.preload([DEFAULT_VOICE])


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    voice_id: str = Field(default=DEFAULT_VOICE)
    style: str = Field(default="Neutral")
    style_weight: float = Field(default=1.0, ge=0.0, le=20.0)
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="1.0 = normal; >1 slower")
    noise_scale: float = Field(default=0.6, ge=0.0, le=1.0)
    noise_scale_w: float = Field(default=0.8, ge=0.0, le=1.0)


@app.get("/voices")
def list_voices() -> dict[str, list[str]]:
    return {"voices": list(VOICES)}


@app.post("/speak")
def speak(req: SpeakRequest, request: Request) -> Response:
    assert synthesizer is not None, "synthesizer not initialized"
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)
    try:
        wav_bytes = synthesizer.synthesize(
            req.text,
            voice_id=req.voice_id,
            style=req.style,
            style_weight=req.style_weight,
            # UI "speed" is intuitive (higher = faster); VITS2's
            # length_scale is the inverse (higher = slower), so flip it.
            length_scale=1.0 / req.speed,
            noise_scale=req.noise_scale,
            noise_scale_w=req.noise_scale_w,
        )
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return Response(content=wav_bytes, media_type="audio/wav")
