"""Style-BERT-VITS2 running in this process.

Keeps a cloned voice entirely on hardware you control — the recordings and
the checkpoint never leave the machine. Slower to set up than a hosted API
(you have to train the checkpoint yourself) but there is no API key to leak
and no per-character billing.

torch and style_bert_vits2 are imported lazily so an elevenlabs-only
deployment doesn't have to install ~2GB of ML dependencies it never uses.
"""
from __future__ import annotations

import logging
from collections.abc import Mapping

from .base import Synthesis, TTSProvider

logger = logging.getLogger("tts_service")


class LocalProvider(TTSProvider):
    name = "local"

    def __init__(self, default_voice: str = "") -> None:
        from tts_engine import DEFAULT_VOICE, VOICES, SpeechSynthesizer

        self._voices = list(VOICES)
        self._default_voice = default_voice or DEFAULT_VOICE
        self._synthesizer = SpeechSynthesizer()
        # Model loading is the expensive step (seconds + GPU memory), so pay
        # it at startup instead of on whoever taps 🔊 first.
        self._synthesizer.preload([self._default_voice])

    def voices(self) -> list[str]:
        # Default first so a caller that just takes voices()[0] gets the
        # configured voice rather than whichever dict key happened to be first.
        return [self._default_voice, *(v for v in self._voices if v != self._default_voice)]

    def synthesize(
        self,
        text: str,
        *,
        voice_id: str,
        speed: float,
        options: Mapping[str, float | str] | None = None,
    ) -> Synthesis:
        opts = options or {}
        audio = self._synthesizer.synthesize(
            text,
            voice_id=voice_id or self._default_voice,
            # UI speed is intuitive (higher = faster); VITS2's length_scale is
            # the inverse (higher = slower), so flip it.
            length_scale=1.0 / speed,
            style=str(opts.get("style", "Neutral")),
            style_weight=float(opts.get("style_weight", 1.0)),
            noise_scale=float(opts.get("noise_scale", 0.6)),
            noise_scale_w=float(opts.get("noise_scale_w", 0.8)),
            # The shared AudioCache above this layer already stores results,
            # so skip tts_engine's own copy rather than caching twice.
            use_cache=False,
        )
        return Synthesis(audio=audio, media_type="audio/wav")
