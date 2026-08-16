"""Provider selection.

Which backend answers /speak is an environment decision (TTS_PROVIDER), so
moving between a local checkpoint and a hosted cloning API needs no code
change on either side of the wire.
"""
from __future__ import annotations

import logging

from config import Settings

from .base import Synthesis, TTSProvider

logger = logging.getLogger("tts_service")

__all__ = ["Synthesis", "TTSProvider", "build_provider"]


def build_provider(settings: Settings) -> TTSProvider:
    if settings.provider == "elevenlabs":
        from .elevenlabs import ElevenLabsProvider

        logger.info("TTS provider: elevenlabs (model=%s)", settings.model_id)
        return ElevenLabsProvider(
            api_key=settings.api_key,
            model_id=settings.model_id,
            default_voice=settings.default_voice,
        )

    from .local import LocalProvider

    logger.info("TTS provider: local (Style-BERT-VITS2)")
    return LocalProvider(default_voice=settings.default_voice)
