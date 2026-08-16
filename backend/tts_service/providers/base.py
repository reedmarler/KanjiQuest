"""The contract every TTS backend implements.

Keeping this narrow is what makes the app voice-agnostic: /speak, the client
cache, and the UI buttons all talk in (text, voice_id, speed) and never learn
whether a local model or a hosted cloning API produced the bytes. Swapping
providers is an environment-variable change, not a code change.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Synthesis:
    audio: bytes
    media_type: str


class TTSProvider(ABC):
    """A source of Japanese speech audio."""

    name: str

    @abstractmethod
    def voices(self) -> list[str]:
        """Voice ids this provider can synthesize, most preferred first."""

    @abstractmethod
    def synthesize(
        self,
        text: str,
        *,
        voice_id: str,
        speed: float,
        options: Mapping[str, float | str] | None = None,
    ) -> Synthesis:
        """Renders `text` as speech.

        `speed` is UI-intuitive: 1.0 is the voice's natural pace, below 1.0 is
        slower. Providers are responsible for translating that into whatever
        their own engine wants, and for clamping to what it supports.

        `options` carries engine-specific knobs (Style-BERT-VITS2's style and
        noise scales, say). A provider that doesn't recognise a key ignores
        it, so callers can pass the superset without branching on provider.
        """

    def cache_fingerprint(self) -> str:
        """Extra cache-key material identifying this provider's output.

        Two providers rendering the same text at the same speed produce
        different audio, so their cache entries must not collide.
        """
        return self.name
