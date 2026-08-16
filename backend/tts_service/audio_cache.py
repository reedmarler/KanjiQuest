"""Disk cache shared by every TTS provider.

Keyed by the full synthesis request, so changing the text, voice, or speed
produces a different entry and identical requests never re-synthesize. This
sits above the provider layer rather than inside any one of them, so a hosted
provider gets the same "generate once" guarantee the local model already had
— which on a paid API is the difference between one charge and one per replay.
"""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path

logger = logging.getLogger("tts_service")

# Extension <-> media type. The extension on disk is what tells us how to
# serve a cached hit, since providers differ (local WAV, hosted MP3).
MEDIA_TYPE_BY_SUFFIX = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
}
SUFFIX_BY_MEDIA_TYPE = {media: suffix for suffix, media in MEDIA_TYPE_BY_SUFFIX.items()}


def cache_key(*parts: object) -> str:
    raw = "|".join(str(part) for part in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class AudioCache:
    def __init__(self, directory: Path) -> None:
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)

    def get(self, key: str) -> tuple[bytes, str] | None:
        """Returns (audio_bytes, media_type) for a hit, else None."""
        for suffix, media_type in MEDIA_TYPE_BY_SUFFIX.items():
            path = self.directory / f"{key}{suffix}"
            if path.exists():
                return path.read_bytes(), media_type
        return None

    def put(self, key: str, audio: bytes, media_type: str) -> None:
        suffix = SUFFIX_BY_MEDIA_TYPE.get(media_type)
        if suffix is None:
            # Unknown container — skip caching rather than write a file we
            # can't identify on the way back out.
            logger.warning("Not caching unknown media type %s", media_type)
            return
        # Write via a temp file so a crash mid-write can't leave a truncated
        # entry that later reads would happily serve as valid audio.
        path = self.directory / f"{key}{suffix}"
        temp_path = path.with_suffix(f"{suffix}.part")
        temp_path.write_bytes(audio)
        temp_path.replace(path)
