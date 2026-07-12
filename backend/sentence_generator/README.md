# Kanji Quest sentence generator

This is a small hybrid rule-based prototype for the sentence rotation engine.

It includes:

- `frame.schema.json` — JSON schema for sentence frames.
- `frames.n5n4.json` — starter N5/N4 frame set.
- `sample_vocab.json` — starter vocabulary with JLPT, POS, semantic tags, conjugation class, and object compatibility.
- `generator.py` — SQLite vocab loader, conjugation, slot filling, validation, and `generate_variant()`.
- `app.py` — optional FastAPI wrapper.

Run the demo:

```powershell
cd C:\Users\Reed\kanji-quest\backend\sentence_generator
python .\generator.py --init-db --level N5 --count 3
python .\generator.py --level N4 --count 3
```

Optional API:

```powershell
pip install fastapi uvicorn
uvicorn app:app --reload --port 8000
```

Then POST to:

```text
http://127.0.0.1:8000/generate
```

Example request:

```json
{
  "target_jlpt": "N5",
  "frame_id": "n5-topic-object-verb",
  "swap_slots": ["object", "verb"],
  "seed": 12
}
```
