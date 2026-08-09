"""Style-BERT-VITS2 wrapper for the Kanji Quest TTS service.

Loads JP-Extra models and synthesizes Japanese speech to WAV bytes,
with an on-disk cache keyed by the full synthesis request.
"""
from __future__ import annotations

import hashlib
import io
import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from scipy.io import wavfile
from style_bert_vits2.constants import Languages
from style_bert_vits2.nlp import bert_models
from style_bert_vits2.tts_model import TTSModel

logger = logging.getLogger("tts_service")

# --- Paths -------------------------------------------------------------
# All model assets live under backend/tts_service/models/<voice_id>/.
# Each voice folder holds the *_e*_s*.safetensors checkpoint, config.json,
# and style_vectors.npy that Style-BERT-VITS2 exports/expects together.
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)


@dataclass(frozen=True)
class VoiceConfig:
    """One installed voice: a JP-Extra model checkpoint + its assets."""

    voice_id: str
    model_file: str
    config_file: str = "config.json"
    style_vectors_file: str = "style_vectors.npy"
    # Index into this checkpoint's speaker embedding table — only meaningful
    # for multi-speaker models. Single-speaker checkpoints ignore it (id 0).
    speaker_id: int = 0

    @property
    def dir(self) -> Path:
        return MODELS_DIR / self.voice_id


# Register installed voices here. Add one entry per downloaded model folder.
# Get JP-Extra checkpoints from the project's HF releases, e.g.
# https://huggingface.co/litagin/style_bert_vits2_jvnv (JP-Extra variants).
VOICES: dict[str, VoiceConfig] = {
    "jvnv-F1": VoiceConfig(voice_id="jvnv-F1", model_file="jvnv-F1-jp_e160_s14000.safetensors"),
    "rikka-cool": VoiceConfig(voice_id="rikka-cool", model_file="rikka_botan_cool.safetensors"),
    "rikka-sweet": VoiceConfig(voice_id="rikka-sweet", model_file="rikka_botan_mokyumokyu.safetensors"),
    # NotAnimeJPManySpeaker pack — 5 speakers sharing one checkpoint:
    # 0=amazinGood, 1=calmCloud, 2=coolcute, 3=fineCrystal, 4=lightFire(male)
    "not-anime-calm": VoiceConfig(
        voice_id="not-anime", model_file="NotAnimeJPManySpeaker_e120_s22200.safetensors", speaker_id=1
    ),
    "not-anime-cool": VoiceConfig(
        voice_id="not-anime", model_file="NotAnimeJPManySpeaker_e120_s22200.safetensors", speaker_id=2
    ),
    "not-anime-lightfire": VoiceConfig(
        voice_id="not-anime", model_file="NotAnimeJPManySpeaker_e120_s22200.safetensors", speaker_id=4
    ),
}
DEFAULT_VOICE = "not-anime-calm"


class SpeechSynthesizer:
    """Loads Style-BERT-VITS2 models once and reuses them across requests.

    One process-wide instance is expected (see app.py's startup hook) —
    model loading is the expensive part (~seconds, GPU memory), synthesis
    itself is fast once the model is resident.
    """

    def __init__(self, device: str | None = None) -> None:
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("SpeechSynthesizer using device=%s", self.device)
        self._models: dict[str, TTSModel] = {}
        # BERT feature extractor is shared across all voices/models. The
        # library expects this already downloaded to a local folder by
        # default; naming the Hugging Face repo here makes it fetch and
        # cache it automatically on first run instead.
        bert_repo = "ku-nlp/deberta-v2-large-japanese-char-wwm"
        bert_models.load_model(Languages.JP, bert_repo)
        bert_models.load_tokenizer(Languages.JP, bert_repo)

    def _config(self, voice_id: str) -> VoiceConfig:
        if voice_id not in VOICES:
            raise KeyError(f"Unknown voice_id: {voice_id!r}. Known: {list(VOICES)}")
        return VOICES[voice_id]

    def _load(self, voice_id: str) -> TTSModel:
        cfg = self._config(voice_id)
        # Two entries in VOICES can point at the same checkpoint (different
        # speaker_id within one multi-speaker model) — cache by the shared
        # checkpoint folder, not the voice key, so it's only loaded once.
        cache_key = cfg.voice_id
        if cache_key in self._models:
            return self._models[cache_key]

        if not cfg.dir.exists():
            raise FileNotFoundError(
                f"Model assets not found at {cfg.dir}. "
                "Download the JP-Extra checkpoint + config.json + style_vectors.npy "
                "into that folder before requesting this voice."
            )

        model = TTSModel(
            model_path=cfg.dir / cfg.model_file,
            config_path=cfg.dir / cfg.config_file,
            style_vec_path=cfg.dir / cfg.style_vectors_file,
            device=self.device,
        )
        self._models[cache_key] = model
        logger.info("Loaded checkpoint %s from %s", cache_key, cfg.dir)
        return model

    def preload(self, voice_ids: list[str] | None = None) -> None:
        """Eagerly load models at startup instead of on first request."""
        for voice_id in voice_ids or list(VOICES):
            self._load(voice_id)

    def synthesize(
        self,
        text: str,
        *,
        voice_id: str = DEFAULT_VOICE,
        style: str = "Neutral",
        style_weight: float = 1.0,
        length_scale: float = 1.0,
        sdp_ratio: float = 0.2,
        noise_scale: float = 0.6,
        noise_scale_w: float = 0.8,
        use_cache: bool = True,
    ) -> bytes:
        """Returns 16-bit PCM WAV bytes for `text`.

        Parameter meaning (Style-BERT-VITS2 / VITS2 conventions):
          length_scale  — inverse speaking speed. >1 slower, <1 faster.
                          0.8-1.2 covers natural learner-facing pacing.
          style_weight  — how strongly the chosen `style` embedding is
                          blended in. 0 = ignore style, higher = stronger.
          sdp_ratio     — mix of stochastic vs deterministic duration
                          predictor; raises prosody variety.
          noise_scale / noise_scale_w — VAE sampling noise; small values
                          keep pronunciation stable, larger add natural
                          variation at the cost of consistency.
        """
        cache_key = self._cache_key(
            text, voice_id, style, style_weight, length_scale, sdp_ratio, noise_scale, noise_scale_w
        )
        cache_path = CACHE_DIR / f"{cache_key}.wav"
        if use_cache and cache_path.exists():
            return cache_path.read_bytes()

        model = self._load(voice_id)
        speaker_id = self._config(voice_id).speaker_id
        sr, audio = model.infer(
            text=text,
            language=Languages.JP,
            speaker_id=speaker_id,
            style=style,
            style_weight=style_weight,
            length=length_scale,
            sdp_ratio=sdp_ratio,
            noise=noise_scale,
            noise_w=noise_scale_w,
        )

        wav_bytes = self._to_wav_bytes(sr, audio)
        if use_cache:
            cache_path.write_bytes(wav_bytes)
        return wav_bytes

    @staticmethod
    def _to_wav_bytes(sample_rate: int, audio: np.ndarray) -> bytes:
        # TTSModel.infer already returns int16 PCM (not normalized floats) —
        # scaling it again as if it were [-1, 1] float clips almost the
        # entire signal down to near-silence and re-blows it up to full
        # scale, which is exactly what "loud and distorted" sounds like.
        if np.issubdtype(audio.dtype, np.floating):
            pcm16 = np.clip(audio, -1.0, 1.0)
            pcm16 = (pcm16 * 32767).astype(np.int16)
        else:
            pcm16 = audio.astype(np.int16)
        buf = io.BytesIO()
        wavfile.write(buf, sample_rate, pcm16)
        return buf.getvalue()

    @staticmethod
    def _cache_key(*parts: object) -> str:
        raw = "|".join(str(p) for p in parts)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()
