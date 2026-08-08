# Style-BERT-VITS2 TTS service

Replaces the browser's Web Speech API with natural Japanese speech from
[Style-BERT-VITS2](https://github.com/litagin02/Style-Bert-VITS2), served
over a local FastAPI endpoint.

## 1. Install

```bash
cd backend/tts_service
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
```

GPU (recommended): install a CUDA-matched `torch` build first (see
https://pytorch.org/get-started/locally/), then `pip install -r requirements.txt`.
CPU works but synthesis is noticeably slower — fine for iterating, weak for
snappy in-app playback.

## 2. Get a JP-Extra model

Style-BERT-VITS2 doesn't ship weights — download a JP-Extra checkpoint
(pitch-accent aware, best naturalness) from the project's Hugging Face
releases, e.g. `litagin/style_bert_vits2_jvnv`. Each voice needs three files:

```
backend/tts_service/models/<voice_id>/
  <name>_e<epoch>_s<step>.safetensors   # the checkpoint
  config.json
  style_vectors.npy
```

Register the folder in `tts_engine.py`'s `VOICES` dict (`voice_id` →
`model_file` name). Two example entries are already there — update the
filenames to match what you actually downloaded.

## 3. Run

```bash
uvicorn app:app --host 127.0.0.1 --port 8001
```

Check `GET http://127.0.0.1:8001/voices` lists your configured voices, then:

```bash
curl -X POST http://127.0.0.1:8001/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "私は学校へ向かっています", "speed": 1.0}' \
  --output out.wav
```

## API

`POST /speak`

| field           | default     | notes                                            |
|-----------------|-------------|---------------------------------------------------|
| `text`          | required    | up to 400 chars — keep to sentence-length input   |
| `voice_id`      | first voice | key from `VOICES` in `tts_engine.py`              |
| `style`         | `"Neutral"` | must exist in the model's `style_vectors.npy`     |
| `style_weight`  | `1.0`       | 0 = ignore style embedding, higher = stronger      |
| `speed`         | `1.0`       | >1 = faster, <1 = slower (UI-intuitive)            |
| `noise_scale`   | `0.6`       | prosody/pronunciation variation                    |
| `noise_scale_w` | `0.8`       | duration variation                                 |

Returns raw `audio/wav` bytes.

## Notes

- **Caching**: every synthesis is cached to `cache/<hash>.wav` keyed by the
  full parameter set, so repeated playback of the same sentence/settings is
  instant. The cache is unbounded — for a small learning-content set this is
  fine; add an eviction policy (LRU by mtime, or a size cap) if content grows
  large or `style`/`speed` vary per user.
- **Model loading is the expensive step** (safetensors + BERT feature
  extractor onto the device). `preload()` runs at startup so the first
  `/speak` call isn't slow; loading additional voices still lazy-loads on
  first use of that `voice_id`.
- **GPU vs CPU**: `SpeechSynthesizer` auto-detects `cuda`. On CPU, expect
  roughly 1-3s per short sentence depending on hardware — acceptable for
  pre-generating/caching content, marginal for live "tap to hear" UX. If CPU
  latency is a problem, pre-warm the cache for known content (quests,
  vocab lists) via a batch script instead of synthesizing on demand.
- **Multiple voices/styles**: add entries to `VOICES` in `tts_engine.py` and
  pass a different `voice_id`/`style` per request — no code changes needed
  beyond that. Style names come from whatever the model's
  `style_vectors.npy` was trained with (`Neutral` always exists; check the
  model card for others like `Happy`, `Sad`).
- This process is separate from the existing `sentence_generator` FastAPI
  service — run both, on different ports, if you want them side by side.
