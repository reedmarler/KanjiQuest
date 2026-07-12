from __future__ import annotations

import argparse
import json
import random
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

JLPT_RANK = {"N5": 1, "N4": 2, "N3": 3, "N2": 4, "N1": 5}
RANK_JLPT = {rank: level for level, rank in JLPT_RANK.items()}

PACKAGE_DIR = Path(__file__).resolve().parent
DEFAULT_FRAMES_PATH = PACKAGE_DIR / "frames.n5n4.json"
DEFAULT_VOCAB_PATH = PACKAGE_DIR / "sample_vocab.json"
DEFAULT_DB_PATH = PACKAGE_DIR / "sentence_generator.sqlite3"


class GenerationError(RuntimeError):
    """Raised when no natural, level-safe sentence can be generated."""


@dataclass(frozen=True)
class VocabItem:
    id: str
    surface: str
    reading: str
    english: str
    pos: str
    jlpt: str
    semantic_tags: tuple[str, ...]
    conjugation_class: str | None = None
    transitivity: str | None = None
    object_tags: tuple[str, ...] = ()
    is_user_vocab: bool = False


@dataclass(frozen=True)
class SlotResult:
    slot: str
    item: VocabItem
    surface: str
    reading: str
    english: str
    conjugation: str | None


@dataclass(frozen=True)
class GeneratedSentence:
    frame_id: str
    jlpt: str
    japanese: str
    reading: str
    english: str
    slots: dict[str, dict[str, Any]]
    furigana: list[dict[str, str]]
    grammar_breakdown: list[dict[str, str]]
    validation: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "frame_id": self.frame_id,
            "jlpt": self.jlpt,
            "japanese": self.japanese,
            "reading": self.reading,
            "english": self.english,
            "slots": self.slots,
            "furigana": self.furigana,
            "grammar_breakdown": self.grammar_breakdown,
            "validation": self.validation,
        }


def load_frames(path: Path | str = DEFAULT_FRAMES_PATH) -> list[dict[str, Any]]:
    with Path(path).open("r", encoding="utf-8") as f:
        return json.load(f)


def load_vocab(path: Path | str = DEFAULT_VOCAB_PATH) -> list[dict[str, Any]]:
    with Path(path).open("r", encoding="utf-8") as f:
        return json.load(f)


def init_database(
    db_path: Path | str = DEFAULT_DB_PATH,
    vocab_path: Path | str = DEFAULT_VOCAB_PATH,
) -> sqlite3.Connection:
    """Create a tiny SQLite vocab database and load JSON vocab into it."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS vocab (
          id TEXT PRIMARY KEY,
          surface TEXT NOT NULL,
          reading TEXT NOT NULL,
          english TEXT NOT NULL,
          pos TEXT NOT NULL,
          jlpt TEXT NOT NULL,
          semantic_tags TEXT NOT NULL DEFAULT '[]',
          conjugation_class TEXT,
          transitivity TEXT,
          object_tags TEXT NOT NULL DEFAULT '[]',
          is_user_vocab INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.execute("DELETE FROM vocab")
    for item in load_vocab(vocab_path):
        conn.execute(
            """
            INSERT INTO vocab (
              id, surface, reading, english, pos, jlpt, semantic_tags,
              conjugation_class, transitivity, object_tags, is_user_vocab
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item["id"],
                item["surface"],
                item.get("reading", item["surface"]),
                item["english"],
                item["pos"],
                item["jlpt"],
                json.dumps(item.get("semantic_tags", []), ensure_ascii=False),
                item.get("conjugation_class"),
                item.get("transitivity"),
                json.dumps(item.get("object_tags", []), ensure_ascii=False),
                1 if item.get("is_user_vocab") else 0,
            ),
        )
    conn.commit()
    return conn


def _item_from_row(row: sqlite3.Row) -> VocabItem:
    return VocabItem(
        id=row["id"],
        surface=row["surface"],
        reading=row["reading"],
        english=row["english"],
        pos=row["pos"],
        jlpt=row["jlpt"],
        semantic_tags=tuple(json.loads(row["semantic_tags"])),
        conjugation_class=row["conjugation_class"],
        transitivity=row["transitivity"],
        object_tags=tuple(json.loads(row["object_tags"])),
        is_user_vocab=bool(row["is_user_vocab"]),
    )


def _level_allows(item_level: str, target_level: str) -> bool:
    return JLPT_RANK[item_level] <= JLPT_RANK[target_level]


def _query_vocab(
    conn: sqlite3.Connection,
    *,
    pos: str,
    target_jlpt: str,
    semantic_tags: list[str] | None = None,
    required_tags: list[str] | None = None,
    blocked_tags: list[str] | None = None,
    transitivity: str | None = None,
    exclude_ids: set[str] | None = None,
) -> list[VocabItem]:
    rows = conn.execute(
        "SELECT * FROM vocab WHERE pos = ?",
        (pos,),
    ).fetchall()
    semantic_tags = semantic_tags or []
    required_tags = required_tags or []
    blocked_tags = blocked_tags or []
    exclude_ids = exclude_ids or set()

    out: list[VocabItem] = []
    for row in rows:
        item = _item_from_row(row)
        item_tags = set(item.semantic_tags)
        if item.id in exclude_ids:
            continue
        if not _level_allows(item.jlpt, target_jlpt):
            continue
        if transitivity and transitivity != "either" and item.transitivity != transitivity:
            continue
        if required_tags and not set(required_tags).issubset(item_tags):
            continue
        if blocked_tags and set(blocked_tags).intersection(item_tags):
            continue
        if semantic_tags and not set(semantic_tags).intersection(item_tags):
            continue
        out.append(item)

    # User app vocab is preferred, but not forced.
    out.sort(key=lambda x: (not x.is_user_vocab, JLPT_RANK[x.jlpt], len(x.surface), x.id))
    return out


def _stem_ichidan(surface: str) -> str:
    return surface[:-1]


GODAN_MASU = {
    "godan_u": ("い", "って", "った", "わない"),
    "godan_ku": ("き", "いて", "いた", "かない"),
    "godan_ku_iku": ("き", "って", "った", "かない"),
    "godan_gu": ("ぎ", "いで", "いだ", "がない"),
    "godan_su": ("し", "して", "した", "さない"),
    "godan_tsu": ("ち", "って", "った", "たない"),
    "godan_nu": ("に", "んで", "んだ", "なない"),
    "godan_bu": ("び", "んで", "んだ", "ばない"),
    "godan_mu": ("み", "んで", "んだ", "まない"),
    "godan_ru": ("り", "って", "った", "らない"),
}


def conjugate_verb(item: VocabItem, form: str | None) -> tuple[str, str]:
    form = form or "dictionary"
    surface = item.surface
    reading = item.reading
    klass = item.conjugation_class

    if form == "dictionary":
        return surface, reading

    if klass == "suru":
        base = surface[:-2]
        read_base = reading[:-2]
        endings = {
            "masu": ("します", "します"),
            "masen": ("しません", "しません"),
            "mashita": ("しました", "しました"),
            "te": ("して", "して"),
            "ta": ("した", "した"),
            "nai": ("しない", "しない"),
            "tai": ("したい", "したい"),
        }
        end = endings.get(form)
        if end:
            return base + end[0], read_base + end[1]

    if klass == "kuru":
        endings = {
            "masu": ("来ます", "きます"),
            "masen": ("来ません", "きません"),
            "mashita": ("来ました", "きました"),
            "te": ("来て", "きて"),
            "ta": ("来た", "きた"),
            "nai": ("来ない", "こない"),
            "tai": ("来たい", "きたい"),
        }
        end = endings.get(form)
        if end:
            return end

    if klass == "ichidan":
        stem = _stem_ichidan(surface)
        read_stem = _stem_ichidan(reading)
        endings = {
            "masu": "ます",
            "masen": "ません",
            "mashita": "ました",
            "te": "て",
            "ta": "た",
            "nai": "ない",
            "tai": "たい",
        }
        ending = endings.get(form)
        if ending:
            return stem + ending, read_stem + ending

    if klass in GODAN_MASU:
        masu_stem, te_end, ta_end, nai_end = GODAN_MASU[klass]
        stem = surface[:-1]
        read_stem = reading[:-1]
        if form == "masu":
            return stem + masu_stem + "ます", read_stem + masu_stem + "ます"
        if form == "masen":
            return stem + masu_stem + "ません", read_stem + masu_stem + "ません"
        if form == "mashita":
            return stem + masu_stem + "ました", read_stem + masu_stem + "ました"
        if form == "te":
            return stem + te_end, read_stem + te_end
        if form == "ta":
            return stem + ta_end, read_stem + ta_end
        if form == "nai":
            return stem + nai_end, read_stem + nai_end
        if form == "tai":
            return stem + masu_stem + "たい", read_stem + masu_stem + "たい"

    raise GenerationError(f"Unsupported conjugation: {item.id} as {form}")


def conjugate_i_adjective(item: VocabItem, form: str | None) -> tuple[str, str]:
    form = form or "dictionary"
    if form in ("dictionary", "i_present"):
        return item.surface, item.reading
    stem = item.surface[:-1]
    read_stem = item.reading[:-1]
    if form == "i_past":
        return stem + "かった", read_stem + "かった"
    if form == "i_negative":
        return stem + "くない", read_stem + "くない"
    raise GenerationError(f"Unsupported i-adjective conjugation: {form}")


def conjugate_item(item: VocabItem, slot_spec: dict[str, Any]) -> tuple[str, str]:
    form = slot_spec.get("conjugation")
    if item.pos == "verb":
        return conjugate_verb(item, form)
    if item.pos == "i_adjective":
        return conjugate_i_adjective(item, form)
    return item.surface, item.reading


def _compatible_object_and_verb(object_item: VocabItem, verb_item: VocabItem) -> bool:
    if verb_item.pos != "verb" or verb_item.transitivity != "transitive":
        return True
    if not verb_item.object_tags:
        return True
    return bool(set(object_item.semantic_tags).intersection(verb_item.object_tags))


def _pick(rng: random.Random, candidates: list[VocabItem]) -> VocabItem:
    if not candidates:
        raise GenerationError("No candidates available")
    # Bias toward user vocab in the first half of the sorted pool.
    top = candidates[: max(1, min(len(candidates), 6))]
    return rng.choice(top)


def _choose_frame(
    frames: list[dict[str, Any]],
    *,
    target_jlpt: str,
    rng: random.Random,
    frame_id: str | None = None,
) -> dict[str, Any]:
    if frame_id:
        matches = [f for f in frames if f["id"] == frame_id]
        if not matches:
            raise GenerationError(f"Unknown frame id: {frame_id}")
        frame = matches[0]
        if frame["jlpt"] != target_jlpt:
            raise GenerationError(f"{frame_id} is {frame['jlpt']}, not {target_jlpt}")
        return frame

    pool = [f for f in frames if f["jlpt"] == target_jlpt]
    if not pool:
        raise GenerationError(f"No frames for {target_jlpt}")
    return rng.choice(pool)


def _fill_slots(
    conn: sqlite3.Connection,
    frame: dict[str, Any],
    *,
    target_jlpt: str,
    rng: random.Random,
    previous_slots: dict[str, str] | None = None,
    swap_slots: list[str] | None = None,
) -> dict[str, SlotResult]:
    previous_slots = previous_slots or {}
    swap_slots = swap_slots or list(frame["slots"].keys())
    results: dict[str, SlotResult] = {}

    for slot_name, spec in frame["slots"].items():
        exclude = set()
        if slot_name in swap_slots and previous_slots.get(slot_name):
            exclude.add(previous_slots[slot_name])

        candidates = _query_vocab(
            conn,
            pos=spec["pos"],
            target_jlpt=target_jlpt,
            semantic_tags=spec.get("semantic_tags"),
            required_tags=spec.get("required_tags"),
            blocked_tags=spec.get("blocked_tags"),
            transitivity=spec.get("transitivity"),
            exclude_ids=exclude,
        )
        item = _pick(rng, candidates)
        surface, reading = conjugate_item(item, spec)
        results[slot_name] = SlotResult(
            slot=slot_name,
            item=item,
            surface=surface,
            reading=reading,
            english=item.english,
            conjugation=spec.get("conjugation"),
        )

    return results


def _render(frame: dict[str, Any], slots: dict[str, SlotResult]) -> tuple[str, str, list[dict[str, str]]]:
    japanese_parts: list[str] = []
    reading_parts: list[str] = []
    furigana: list[dict[str, str]] = []

    for token in frame["tokens"]:
        if token["type"] == "literal":
            text = token["text"]
            japanese_parts.append(text)
            reading_parts.append(text)
            furigana.append({"text": text, "reading": text, "type": "literal"})
        else:
            slot = slots[token["slot"]]
            japanese_parts.append(slot.surface)
            reading_parts.append(slot.reading)
            furigana.append(
                {
                    "slot": token["slot"],
                    "text": slot.surface,
                    "reading": slot.reading,
                    "type": "slot",
                }
            )

    return "".join(japanese_parts), "".join(reading_parts), furigana


def _english_value(slot: SlotResult, frame: dict[str, Any]) -> str:
    # Keep demo English simple; later we can add tense-aware English inflection.
    if slot.item.pos == "verb":
        conjugation = slot.conjugation or "dictionary"
        if "ことがあります" in "".join(t.get("text", "") for t in frame["tokens"]):
            return slot.item.english
        if conjugation == "ta":
            return slot.item.english
        if conjugation == "te":
            return slot.item.english
        return slot.item.english
    return slot.english


PAST_PARTICIPLE = {
    "eat": "eaten",
    "drink": "drunk",
    "read": "read",
    "watch": "watched",
    "study": "studied",
    "go": "gone",
    "return": "returned",
    "buy": "bought",
    "make": "made",
}

GERUND = {
    "eat": "eating",
    "drink": "drinking",
    "read": "reading",
    "watch": "watching",
    "study": "studying",
    "go": "going",
    "return": "returning",
    "buy": "buying",
    "make": "making",
}


def _third_person_present(verb: str, subject: str) -> str:
    if subject.lower() in {"i", "we", "you", "they"}:
        return verb
    if verb.endswith("y"):
        return verb[:-1] + "ies"
    if verb.endswith(("ch", "sh", "s", "x", "z", "o")):
        return verb + "es"
    return verb + "s"


def _aux_have(subject: str) -> str:
    return "have" if subject.lower() in {"i", "we", "you", "they"} else "has"


def _verb_for_english(slot: SlotResult) -> str:
    return slot.item.english


def _render_english(frame: dict[str, Any], slots: dict[str, SlotResult]) -> str:
    frame_id = frame["id"]

    subject = slots.get("subject")
    subject_en = subject.english if subject else ""

    if frame_id in {"n5-topic-object-verb", "n5-place-action"}:
        verb = _third_person_present(_verb_for_english(slots["verb"]), subject_en)
        object_en = slots["object"].english
        if frame_id == "n5-place-action":
            return f"{subject_en} {verb} {object_en} at {slots['place'].english}."
        return f"{subject_en} {verb} {object_en}."

    if frame_id == "n5-time-movement":
        verb = _third_person_present(_verb_for_english(slots["verb"]), subject_en)
        place = slots["place"].english
        place_phrase = "home" if place == "home" else f"to {place}"
        return f"{subject_en} {verb} {place_phrase} {slots['time'].english}."

    if frame_id == "n5-i-adj-noun":
        return f"{subject_en} likes {slots['adjective'].english} {slots['noun'].english}."

    if frame_id == "n4-before-after":
        main = _third_person_present(_verb_for_english(slots["main_verb"]), subject_en)
        before = GERUND.get(slots["before_action"].item.english, slots["before_action"].item.english)
        return f"{subject_en} {main} {slots['object'].english} before {before}."

    if frame_id == "n4-te-kudasai":
        return f"Please {_verb_for_english(slots['verb'])} {slots['object'].english}."

    if frame_id == "n4-past-experience":
        participle = PAST_PARTICIPLE.get(slots["verb"].item.english, slots["verb"].item.english)
        return f"{subject_en} {_aux_have(subject_en)} {participle} {slots['object'].english} before."

    if frame_id == "n4-intention":
        verb = "intend" if subject_en.lower() == "i" else "intends"
        return f"{subject_en} {verb} to {_verb_for_english(slots['verb'])} {slots['object'].english} {slots['time'].english}."

    values = {name: _english_value(slot, frame) for name, slot in slots.items()}
    return frame["english_template"].format(**values)


def _has_rule(frame: dict[str, Any], rule: str) -> bool:
    return rule in frame.get("naturalness_rules", [])


def validate_generated_sentence(
    frame: dict[str, Any],
    slots: dict[str, SlotResult],
    *,
    target_jlpt: str,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if frame["jlpt"] != target_jlpt:
        errors.append(f"Frame {frame['id']} is {frame['jlpt']}, not {target_jlpt}.")

    for point in frame["grammar_points"]:
        if not _level_allows(point["jlpt"], target_jlpt):
            errors.append(f"Grammar point {point['pattern']} is above {target_jlpt}.")

    exact_level_seen = frame["jlpt"] == target_jlpt
    for slot in slots.values():
        if not _level_allows(slot.item.jlpt, target_jlpt):
            errors.append(f"{slot.item.surface} is {slot.item.jlpt}, above {target_jlpt}.")
        if slot.item.jlpt == target_jlpt:
            exact_level_seen = True

    if not exact_level_seen:
        warnings.append("No exact target-level item was selected; sentence is safe but easy.")

    object_slot = slots.get("object")
    verb_slot = slots.get("verb") or slots.get("main_verb")
    if object_slot and verb_slot and not _compatible_object_and_verb(object_slot.item, verb_slot.item):
        errors.append(
            f"Unnatural object/verb pair: {object_slot.item.surface} + {verb_slot.item.surface}."
        )

    if _has_rule(frame, "verb_must_be_movement") and slots.get("verb"):
        if "movement" not in slots["verb"].item.semantic_tags:
            errors.append("Movement frame requires a movement verb.")

    if _has_rule(frame, "time_should_be_future") and slots.get("time"):
        if "future_time" not in slots["time"].item.semantic_tags:
            errors.append("Intention frame requires a future time expression.")

    if "before_action" in slots and "main_verb" in slots:
        before = slots["before_action"].item
        main = slots["main_verb"].item
        if before.id == main.id:
            warnings.append("Before-action and main verb are identical; valid but repetitive.")

    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "level_policy": "frame must match target; vocab and grammar must not exceed target; prefer exact target-level content",
    }


def generate_variant(
    *,
    target_jlpt: str = "N5",
    db_path: Path | str = DEFAULT_DB_PATH,
    frames_path: Path | str = DEFAULT_FRAMES_PATH,
    frame_id: str | None = None,
    previous_slots: dict[str, str] | None = None,
    swap_slots: list[str] | None = None,
    seed: int | None = None,
    max_attempts: int = 80,
) -> GeneratedSentence:
    if target_jlpt not in JLPT_RANK:
        raise GenerationError(f"Unsupported JLPT level: {target_jlpt}")

    rng = random.Random(seed)
    frames = load_frames(frames_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    last_validation: dict[str, Any] | None = None
    for _ in range(max_attempts):
        frame = _choose_frame(frames, target_jlpt=target_jlpt, rng=rng, frame_id=frame_id)
        slots = _fill_slots(
            conn,
            frame,
            target_jlpt=target_jlpt,
            rng=rng,
            previous_slots=previous_slots,
            swap_slots=swap_slots,
        )
        validation = validate_generated_sentence(frame, slots, target_jlpt=target_jlpt)
        last_validation = validation
        if not validation["ok"]:
            continue

        japanese, reading, furigana = _render(frame, slots)
        english = _render_english(frame, slots)
        return GeneratedSentence(
            frame_id=frame["id"],
            jlpt=target_jlpt,
            japanese=japanese,
            reading=reading,
            english=english,
            slots={
                name: {
                    "id": slot.item.id,
                    "surface": slot.surface,
                    "dictionary_form": slot.item.surface,
                    "reading": slot.reading,
                    "english": slot.english,
                    "pos": slot.item.pos,
                    "jlpt": slot.item.jlpt,
                    "semantic_tags": list(slot.item.semantic_tags),
                    "conjugation": slot.conjugation,
                }
                for name, slot in slots.items()
            },
            furigana=furigana,
            grammar_breakdown=frame["grammar_points"],
            validation=validation,
        )

    raise GenerationError(f"Could not generate a valid sentence. Last validation: {last_validation}")


def _main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Kanji Quest sentence generator demo")
    parser.add_argument("--init-db", action="store_true", help="Reload sample vocab into SQLite")
    parser.add_argument("--level", default="N5", choices=list(JLPT_RANK))
    parser.add_argument("--frame-id")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--count", type=int, default=5)
    args = parser.parse_args()

    if args.init_db or not DEFAULT_DB_PATH.exists():
        init_database()

    previous: dict[str, str] | None = None
    for i in range(args.count):
        result = generate_variant(
            target_jlpt=args.level,
            frame_id=args.frame_id,
            seed=args.seed + i,
            previous_slots=previous,
        )
        previous = {name: data["id"] for name, data in result.slots.items()}
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
