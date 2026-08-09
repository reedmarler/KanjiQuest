"""Fetches the model assets this deployment actually uses.

Run at Docker build time so the image is self-contained — no downloads (and
no dependency on Hugging Face being reachable) at container startup.
"""
from __future__ import annotations

from pathlib import Path

from huggingface_hub import hf_hub_download

MODELS_DIR = Path(__file__).resolve().parent / "models"


def fetch(repo_id: str, filename: str, dest_dir: str) -> None:
    target_dir = MODELS_DIR / dest_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    path = hf_hub_download(repo_id=repo_id, filename=filename, local_dir=str(target_dir))
    print(f"fetched {filename} -> {path}")


if __name__ == "__main__":
    # Only the voice pack the frontend actually offers (girl/boy toggle).
    # Add more fetch() calls here if VOICES in tts_engine.py grows.
    fetch("Mofa-Xingche/girl-style-bert-vits2-JPExtra-models", "NotAnimeJPManySpeaker_e120_s22200.safetensors", "not-anime")
    fetch("Mofa-Xingche/girl-style-bert-vits2-JPExtra-models", "config.json", "not-anime")
    fetch("Mofa-Xingche/girl-style-bert-vits2-JPExtra-models", "style_vectors.npy", "not-anime")
