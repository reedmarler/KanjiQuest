from __future__ import annotations

import json
import sys

from generator import DEFAULT_DB_PATH, generate_variant, init_database


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    init_database(DEFAULT_DB_PATH)

    previous_slots: dict[str, str] | None = None
    for seed in range(4):
        sentence = generate_variant(
            target_jlpt="N5",
            frame_id="n5-topic-object-verb",
            previous_slots=previous_slots,
            swap_slots=["object", "verb"],
            seed=seed,
        )
        previous_slots = {name: value["id"] for name, value in sentence.slots.items()}
        print(json.dumps(sentence.to_dict(), ensure_ascii=False, indent=2))

    n4 = generate_variant(target_jlpt="N4", seed=42)
    print(json.dumps(n4.to_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
