# First Light: playable Ink Realm chapter

The September 19 implementation uses the Ink Realm setting and the existing
cherry-blossom samurai, with an adventure interaction loop rather than a sequence
of study tools. Open the Quest tab or `/#quests`.

## Playable scope

Tsuzuri Village has three stops: the gate, stone bridge, and ferry landing.
The keeper gives the player a letter. Japanese clues identify a courier and
their boat. The player presents the letter, receives a lantern seal, and uses
the seal at the gate to restore its light. Following the wrong traveler or
boarding the wrong boat adds a clue without blocking completion.

Belongings are selected and then offered through the encounter's contextual
action. Furigana, optional meanings, and the existing speech player support
reading the authored messages. The journal retains encountered clues.

The world journey shows the proposed nine regions. Only First Light is playable;
other region descriptions explicitly state that their chapters are unavailable.
The first restoration reveals the Market Road on the journey.

## Progress boundary

Story state lives under `kanji-quest-ink-realm-v1`, covered by the existing backup
export. It records phase, location, encountered clues, and the first completion
time. Replay preserves the earned stamp. Every reachable state can reach the
ending, and prerequisite checks prevent collecting or using items out of order.

Story completion is not evidence of vocabulary mastery: it does not write SRS
ratings, mark old drill quests complete, or grant duplicate rewards. This is an
intentional departure from the older document's single SRS-derived map model.
The existing study-derived Ink Road is left intact. A later curriculum pass can
connect independently measured mastery to regional access.

## Assets

- Existing player: `public/generated/sakura-sprint-static-v3.png`.
- New background: `public/quest-art/tsuzuri-village.png`.
- Restored background: `public/quest-art/tsuzuri-village-restored.png`.
- New transparent NPC atlas: `public/quest-art/tsuzuri-travelers.png`.
- Village keeper: `public/quest-art/tsuzuri-keeper.png`.

The new assets were produced using the built-in imagegen tool. Exact generation
prompts and reference roles are in [the artwork log](ink-realm-art-prompts.md).

## Validation

Run `npm run audit:ink-realm`, `npm run build`, and `npm run lint`.
The state audit explores every reachable phase/location/detour combination,
checks completion remains possible, and tests saves, invalid data, prerequisites,
and replay. Browser verification covers desktop/mobile playthroughs and reload.

`scripts/audit-ink-realm-browser.mjs` uses an installed Playwright and Chrome.
Set `PLAYWRIGHT_MODULE` to a bundled Playwright module directory when it is not
available through normal Node resolution. `QUEST_PREVIEW_URL` defaults to
`http://127.0.0.1:5174`. It verifies 1440, 768, 390, and 320 pixel viewports,
keyboard notebook tabs, missing/corrupt storage, and screenshots under
`outputs/ink-realm-verification/` (ignored generated output).
