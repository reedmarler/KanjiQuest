"""Hosted cloning provider (ElevenLabs).

The API key lives in this process's environment and is used only to sign
outbound requests. It is never returned in a response, never logged, and
never reaches the browser — the frontend's only credential-free job is to
POST text to /speak.

Cloning a real person's voice here means uploading their recordings to a
third party. ElevenLabs requires a recorded verbal consent statement from
the speaker before it will create an Instant/Professional Voice Clone; that
step happens in their dashboard, not in this code.
"""
from __future__ import annotations

import logging
from collections.abc import Mapping

import httpx

from .base import Synthesis, TTSProvider

logger = logging.getLogger("tts_service")

API_ROOT = "https://api.elevenlabs.io/v1"
REQUEST_TIMEOUT_SECONDS = 30.0

# The API accepts a narrower speed range than our UI slider implies; going
# outside it is a 422 rather than a clamp, so clamp on this side.
MIN_SPEED = 0.7
MAX_SPEED = 1.2


class ElevenLabsProvider(TTSProvider):
    name = "elevenlabs"

    def __init__(self, api_key: str, model_id: str, default_voice: str = "") -> None:
        if not api_key:
            raise ValueError("ElevenLabsProvider requires an API key")
        self._api_key = api_key
        self._model_id = model_id
        self._default_voice = default_voice
        self._client = httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS)
        self._cached_voices: list[str] | None = None

    def cache_fingerprint(self) -> str:
        # The model affects the audio, so a model change must miss the cache
        # rather than replay output from the previous one.
        return f"{self.name}:{self._model_id}"

    def voices(self) -> list[str]:
        if self._cached_voices is None:
            response = self._client.get(f"{API_ROOT}/voices", headers={"xi-api-key": self._api_key})
            response.raise_for_status()
            payload = response.json()
            self._cached_voices = [voice["voice_id"] for voice in payload.get("voices", [])]
        if self._default_voice:
            return [self._default_voice, *(v for v in self._cached_voices if v != self._default_voice)]
        return list(self._cached_voices)

    def synthesize(
        self,
        text: str,
        *,
        voice_id: str,
        speed: float,
        options: Mapping[str, float | str] | None = None,
    ) -> Synthesis:
        # Style-BERT-VITS2's style/noise knobs have no hosted equivalent;
        # ignoring them keeps one call signature across providers.
        del options
        voice = voice_id or self._default_voice
        if not voice:
            available = self.voices()
            if not available:
                raise ValueError("No ElevenLabs voices available on this account")
            voice = available[0]

        response = self._client.post(
            f"{API_ROOT}/text-to-speech/{voice}",
            headers={"xi-api-key": self._api_key, "accept": "audio/mpeg"},
            json={
                "text": text,
                "model_id": self._model_id,
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "speed": max(MIN_SPEED, min(MAX_SPEED, speed)),
                },
            },
        )
        if response.status_code >= 400:
            # Log the status but not the body — provider errors can echo
            # request details, and this log may not be private.
            logger.error("ElevenLabs synthesis failed with status %s", response.status_code)
            response.raise_for_status()

        return Synthesis(audio=response.content, media_type="audio/mpeg")
