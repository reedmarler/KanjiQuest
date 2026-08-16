"""Environment-driven settings for the TTS service.

Every secret arrives through the process environment — nothing sensitive is
committed here, and nothing sensitive is ever sent to the browser. The
frontend only learns this service's *URL*, which is public by nature.

See .env.example for the full list.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _split(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    # "local" runs Style-BERT-VITS2 in-process; "elevenlabs" proxies a hosted
    # cloning provider. Both expose the same /speak contract, so the frontend
    # never has to know which one is answering.
    provider: str = field(default_factory=lambda: os.environ.get("TTS_PROVIDER", "local").strip().lower())

    # The hosted provider's secret. Read from the environment only: it must
    # never appear in the repo, in a VITE_ variable, or in a response body.
    api_key: str = field(default_factory=lambda: os.environ.get("TTS_API_KEY", "").strip())

    # Which voice /speak uses when the caller doesn't name one. Empty means
    # "whatever the provider reports first", which keeps a not-yet-cloned
    # voice from hard-coding itself into the app.
    default_voice: str = field(default_factory=lambda: os.environ.get("TTS_DEFAULT_VOICE", "").strip())

    # Hosted-provider model. Japanese needs a multilingual model — the
    # English-only ones mangle kana.
    model_id: str = field(default_factory=lambda: os.environ.get("TTS_MODEL_ID", "eleven_multilingual_v2").strip())

    allowed_origins: list[str] = field(
        default_factory=lambda: _split(
            os.environ.get(
                "TTS_ALLOWED_ORIGINS",
                # Dev servers plus the production domain. Note bunpou.app —
                # earlier versions of this file listed "bunou.app", which
                # silently blocked every real browser request.
                "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5174,"
                "https://bunpou.app,https://www.bunpou.app",
            )
        )
    )

    cache_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("TTS_CACHE_DIR", str(BASE_DIR / "cache")))
    )

    rate_limit_requests: int = field(default_factory=lambda: _env_int("TTS_RATE_LIMIT_REQUESTS", 20))
    rate_limit_window_seconds: int = field(default_factory=lambda: _env_int("TTS_RATE_LIMIT_WINDOW", 60))

    def validate(self) -> None:
        """Fails fast at startup rather than on the first user request."""
        if self.provider not in {"local", "elevenlabs"}:
            raise ValueError(f"Unknown TTS_PROVIDER: {self.provider!r}. Use 'local' or 'elevenlabs'.")
        if self.provider != "local" and not self.api_key:
            raise ValueError(
                f"TTS_PROVIDER={self.provider} needs TTS_API_KEY set in the environment. "
                "Set it as a secret on the host (Spaces/Fly/Render), not in a file."
            )


settings = Settings()
