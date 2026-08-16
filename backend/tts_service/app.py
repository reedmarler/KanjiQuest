"""FastAPI endpoint for Japanese speech synthesis.

Run with:
    uvicorn app:app --host 127.0.0.1 --port 8001

The frontend POSTs text to /speak and plays the returned audio bytes. Which
engine produces them — a local Style-BERT-VITS2 checkpoint or a hosted
cloning provider — is set by TTS_PROVIDER in this process's environment, so
the browser never handles a credential and never learns which one answered.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from audio_cache import AudioCache, cache_key
from budget import SpendBudget
from config import settings
from providers import TTSProvider, build_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tts_service")

provider: TTSProvider | None = None
cache = AudioCache(settings.cache_dir)
budget = SpendBudget(settings.cache_dir / "spend.json", settings.monthly_character_budget)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global provider
    settings.validate()
    provider = build_provider(settings)
    yield


app = FastAPI(title="Kanji Quest TTS Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Naive in-memory per-IP rate limit. Synthesis is either CPU-bound (local) or
# billed per character (hosted), so an unlimited public /speak lets anyone
# spend your compute or your money. Good enough for a hobby app's traffic;
# swap for something Redis-backed if this ever runs on more than one instance.
_request_log: dict[str, deque[float]] = defaultdict(deque)


def _check_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    log = _request_log[client_ip]
    while log and now - log[0] > settings.rate_limit_window_seconds:
        log.popleft()
    if len(log) >= settings.rate_limit_requests:
        raise HTTPException(status_code=429, detail="Too many requests, slow down.")
    log.append(now)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    voice_id: str = Field(default="", description="Provider voice id; empty uses the configured default")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="1.0 = natural pace; <1 slower, >1 faster")
    # Style-BERT-VITS2 knobs. Honoured by the local provider and ignored by
    # hosted ones, so a caller can send the same body to either.
    style: str = Field(default="Neutral")
    style_weight: float = Field(default=1.0, ge=0.0, le=20.0)
    noise_scale: float = Field(default=0.6, ge=0.0, le=1.0)
    noise_scale_w: float = Field(default=0.8, ge=0.0, le=1.0)

    def engine_options(self) -> dict[str, float | str]:
        return {
            "style": self.style,
            "style_weight": self.style_weight,
            "noise_scale": self.noise_scale,
            "noise_scale_w": self.noise_scale_w,
        }


@app.get("/health")
def health() -> dict[str, object]:
    # Deliberately reports the provider *name* and nothing about its
    # credentials. Used by the frontend to decide whether real speech is
    # available before falling back to the browser voice.
    return {"ok": provider is not None, "provider": settings.provider, "budget": budget.status()}


@app.get("/voices")
def list_voices() -> dict[str, list[str]]:
    assert provider is not None, "provider not initialized"
    try:
        return {"voices": provider.voices()}
    except Exception as exc:
        logger.exception("Listing voices failed")
        raise HTTPException(status_code=502, detail="Could not list voices") from exc


@app.post("/speak")
def speak(req: SpeakRequest, request: Request) -> Response:
    assert provider is not None, "provider not initialized"

    options = req.engine_options()
    key = cache_key(
        provider.cache_fingerprint(),
        req.text,
        req.voice_id,
        round(req.speed, 3),
        *(f"{name}={value}" for name, value in sorted(options.items())),
    )

    # Serve cache hits before the rate limiter: a replay costs nothing to
    # produce, so counting it against the budget would punish exactly the
    # usage pattern the cache exists to make cheap.
    cached = cache.get(key)
    if cached is not None:
        audio, media_type = cached
        return _audio_response(audio, media_type, key)

    _check_rate_limit(request.client.host if request.client else "unknown")

    # Refuse rather than overspend. The frontend treats a failure here as
    # "no service" and falls back to the browser voice, so the app keeps
    # working — it just stops sounding like the paid voice.
    if not budget.can_afford(len(req.text)):
        logger.warning("Monthly synthesis budget exhausted; refusing new synthesis")
        raise HTTPException(status_code=402, detail="Monthly synthesis budget reached")

    try:
        result = provider.synthesize(req.text, voice_id=req.voice_id, speed=req.speed, options=options)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        # Never surface the provider's own error text — it can contain
        # request echoes and account details.
        logger.exception("Synthesis failed")
        raise HTTPException(status_code=502, detail="Speech synthesis failed") from exc

    budget.record(len(req.text))
    cache.put(key, result.audio, result.media_type, text=req.text, speed=req.speed)
    return _audio_response(result.audio, result.media_type, key)


def _require_admin(token: str | None) -> None:
    if not settings.admin_token:
        raise HTTPException(status_code=404, detail="Not enabled")
    if token != settings.admin_token:
        raise HTTPException(status_code=401, detail="Bad admin token")


@app.get("/cache/entries")
def cache_entries(x_admin_token: str | None = Header(default=None)) -> dict[str, object]:
    """Everything synthesized so far, for `npm run harvest:audio` to promote
    into permanent static files. Off unless TTS_ADMIN_TOKEN is set."""
    _require_admin(x_admin_token)
    return {"entries": cache.entries()}


@app.get("/cache/audio/{key}")
def cache_audio(key: str, x_admin_token: str | None = Header(default=None)) -> Response:
    _require_admin(x_admin_token)
    # Keys are hex digests; anything else is a path-traversal attempt.
    if not key.isalnum():
        raise HTTPException(status_code=400, detail="Bad key")
    found = cache.get(key)
    if found is None:
        raise HTTPException(status_code=404, detail="Not cached")
    audio, media_type = found
    return Response(content=audio, media_type=media_type)


def _audio_response(audio: bytes, media_type: str, key: str) -> Response:
    return Response(
        content=audio,
        media_type=media_type,
        headers={
            # The key is a hash of the full request, so a given URL+body
            # always maps to identical bytes — safe to cache hard and
            # revalidate with a strong ETag.
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": f'"{key}"',
        },
    )
