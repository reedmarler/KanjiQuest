# Japanese TTS service

Replaces the browser's Web Speech API with natural Japanese speech, served
over a FastAPI endpoint. Two interchangeable engines sit behind the same
`/speak` contract:

| `TTS_PROVIDER` | Engine | Voice cloning | Secrets |
|----------------|--------|---------------|---------|
| `local` (default) | [Style-BERT-VITS2](https://github.com/litagin02/Style-Bert-VITS2) in-process | Train your own checkpoint; audio never leaves the machine | none |
| `elevenlabs` | Hosted ElevenLabs API | Clone in their dashboard; recordings are uploaded to them | `TTS_API_KEY` |

The frontend never learns which one answered, and never handles a
credential — it only knows this service's public URL. Copy `.env.example`
to `.env` (or set the same keys as host secrets) to configure.

> **Cloning someone's voice** requires that person's consent, and hosted
> providers enforce it: ElevenLabs will not create a voice clone without a
> recorded verbal consent statement from the speaker. The `local` provider
> has no such gate, which makes the consent question yours to honour rather
> than the vendor's to check.

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

| field           | default          | notes                                                      |
|-----------------|------------------|------------------------------------------------------------|
| `text`          | required         | up to 400 chars — keep to sentence-length input             |
| `voice_id`      | `TTS_DEFAULT_VOICE` | `local`: a key from `VOICES`. `elevenlabs`: a dashboard voice id |
| `speed`         | `1.0`            | >1 = faster, <1 = slower (UI-intuitive). Accepted range 0.5–2.0 |
| `style`         | `"Neutral"`      | local only — must exist in the model's `style_vectors.npy`  |
| `style_weight`  | `1.0`            | local only — 0 = ignore style embedding, higher = stronger  |
| `noise_scale`   | `0.6`            | local only — prosody/pronunciation variation                |
| `noise_scale_w` | `0.8`            | local only — duration variation                             |

Returns `audio/wav` (local) or `audio/mpeg` (elevenlabs) with a strong
`ETag` and a long `Cache-Control`. The local-only fields are accepted and
ignored by hosted providers, so one request body works against either.

`GET /voices` lists the configured voices (default first).
`GET /health` reports `{ok, provider}` — the frontend uses it to decide
whether to use real speech or fall back to the browser voice.

## Pre-rendering audio (no service in production)

The app's fixed vocabulary is a finite list, so it can be spoken once and
shipped as static files instead of synthesized on demand:

```bash
uvicorn app:app --host 127.0.0.1 --port 8001    # in one terminal
npm run generate:audio -- --dry-run              # count and price it first
npm run generate:audio                           # render into public/audio/
```

`--scope=focus` limits it to the 342 focus-set words; `--scope=all` (the
default) covers every study card. Re-running skips clips already on disk, so
adding vocabulary later only renders — and only bills — the new words.

The output deploys with the site, so on GitHub Pages the fixed vocabulary
plays in the real voice with no service running, no API key anywhere, and no
per-play cost. Only the hero sentence generator, whose text is built at
runtime, still needs the live service.

Changing voice or model means the committed clips are stale: delete
`public/audio/` and re-render, or the app keeps serving the old voice.

## Deploying

The Dockerfile targets Hugging Face Spaces (port 7860). Set the environment
variables from `.env.example` as **repository secrets** on the host — never
in a committed file, and never as a `VITE_` variable in the frontend, which
would inline them into the public JS bundle.

`TTS_ALLOWED_ORIGINS` must list the exact browser origin of the deployed
app. It defaults to `https://bunpou.app`; an origin that isn't listed gets
a CORS rejection that surfaces in the app as a silent fallback to the
robotic browser voice.

On an ephemeral host, point `TTS_CACHE_DIR` at a mounted volume. Otherwise
the cache is wiped on every restart and — on a per-character-billed hosted
provider — every sentence is paid for again.

## Notes

- **Caching** happens at three levels, so a replayed sentence costs nothing:
  1. `src/lib/speechCache.ts` — the browser holds recent clips in memory and
     in Cache Storage, so a repeat tap makes no network request at all.
  2. `audio_cache.py` — this service stores every result under
     `cache/<hash>.<ext>`, keyed by provider + text + voice + speed +
     engine options. Cache hits are served *before* the rate limiter, since
     a replay costs nothing to produce.
  3. `Cache-Control: immutable` + `ETag` on the response.

  The disk cache is unbounded — fine for a fixed learning-content set; add
  an eviction policy (LRU by mtime, or a size cap) if content grows large or
  `style`/`speed` vary per user.
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
