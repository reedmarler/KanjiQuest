"""Hard ceiling on paid synthesis.

A metered provider behind a public endpoint has no natural spending limit —
the per-IP rate limit slows one visitor down but does nothing about a
thousand of them, or one determined one on a new address. This counts the
characters actually sent to the provider each month and refuses to spend past
the configured budget, at which point the app falls back to the browser voice.

Cache hits never reach here, so replaying is always free and never counts.
"""
from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("tts_service")


class SpendBudget:
    """Month-to-date character counter, persisted so restarts don't reset it."""

    def __init__(self, state_path: Path, monthly_characters: int) -> None:
        self.state_path = state_path
        self.monthly_characters = monthly_characters
        self._lock = threading.Lock()
        self._period = self._current_period()
        self._used = 0
        self._load()

    @staticmethod
    def _current_period() -> str:
        now = datetime.now(timezone.utc)
        return f"{now.year:04d}-{now.month:02d}"

    def _load(self) -> None:
        try:
            state = json.loads(self.state_path.read_text())
        except (OSError, ValueError):
            return
        if state.get("period") == self._period:
            self._used = int(state.get("used", 0))

    def _save(self) -> None:
        try:
            self.state_path.write_text(json.dumps({"period": self._period, "used": self._used}))
        except OSError:
            # An unwritable state file must not take synthesis down; the
            # in-process counter still holds for this run.
            logger.warning("Could not persist spend state to %s", self.state_path)

    def _roll_period(self) -> None:
        period = self._current_period()
        if period != self._period:
            self._period = period
            self._used = 0

    @property
    def enabled(self) -> bool:
        return self.monthly_characters > 0

    def status(self) -> dict[str, object]:
        with self._lock:
            self._roll_period()
            return {
                "enabled": self.enabled,
                "period": self._period,
                "used": self._used,
                "limit": self.monthly_characters,
                "remaining": max(0, self.monthly_characters - self._used) if self.enabled else None,
            }

    def can_afford(self, characters: int) -> bool:
        if not self.enabled:
            return True
        with self._lock:
            self._roll_period()
            return self._used + characters <= self.monthly_characters

    def record(self, characters: int) -> None:
        """Counts spend *after* a successful synthesis, so a provider error
        doesn't burn budget the account was never charged for."""
        if not self.enabled:
            return
        with self._lock:
            self._roll_period()
            self._used += characters
            self._save()
