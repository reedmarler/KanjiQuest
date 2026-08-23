# The Ink Realm — World Map & Traversal Design

Design document for the Kanji Quest world map, replacing the current quest panel
(`src/components/QuestHub.tsx` + `src/data/questCampaign.ts`).

---

## 1. Overview & Philosophy

### The premise, in three sentences

Kanji are the threads that hold the Ink Realm together. Where people stop
reading, the ink thins: signs go blank, roads fade, whole districts drift under
fog. You are a travelling scribe walking north along the **Ink Road**, restoring
what you can read and re-inking what you can write.

That's the whole story. It gets told two sentences at a time, at the top of each
region, and then it gets out of the way.

### Shape of the world

One road, running **south to north**, drawn as a single continuous brush stroke
on a handscroll. South is warm, small, and simple (kana, first kanji, N5). North
is cold, vast, and dense (N1, classical forms, rare readings). Difficulty *is*
geography — the player never has to ask what "level" they are on, they look at
how far up the scroll they've walked.

```
                                       無字の都  The Unwritten Capital  (N1 finale)
                                          │
                              三国文庫  Mikuni Archive        N1
                                          │
                              潮見港  Shiomi Port             N2
                                          │
                              峠原  Tōgehara Highlands       N3–N2
                                          │
                              陽炎市  Kagerō City             N3
                                          │
                              雫谷  Shizukudani Springs      N4
                                          │
                              白門学舎  Hakumon Academy       N4
                                          │
                              汽線駅  Kisen Station           N5→N4
                                          │
                              市の道  The Market Road         N5
                                          │
                     ▲ start   綴村  Tsuzuri Village          kana + first kanji
```

### Four structural layers

| Layer | What it is | Roughly equals today |
|---|---|---|
| **Realm** | the whole scroll, N5 → N1 | the campaign |
| **Region** | 6–10 waypoints sharing a theme and a JLPT band | `CAMPAIGN_ARCS` |
| **Waypoint** | one place with one situation and one thread-set | a `QuestDefinition` |
| **Step** | one study session at that waypoint | a `QuestStep` |

### Design principles

1. **The map answers one question in three seconds: where do I go today?** One
   node is lit. One button says *Continue*. Everything else is optional
   scenery.
2. **The map is a readout, not a second currency.** Node state is *derived* from
   real SRS data (`src/lib/srs.ts`), never from a separate "completed" flag.
   Ink on the map and knowledge in the player's head must never disagree.
3. **Study is movement.** Answering an item moves the traveller token. A session
   isn't "then you also get progress" — the session *is* the walk.
4. **Fog is honest.** Fog means *you have not learned this yet*, everywhere,
   without exception. Never fog something as artificial pacing.
5. **The road never takes ground back.** Lapsed material makes ink look thin, it
   never re-locks a region. Punishment is not a mechanic here.
6. **Flavour rides second.** Every button reads `Writing · Inscribe the
   signpost`. The function is first, the story is the subtitle. A player who
   ignores the fiction entirely still has a perfectly clear study app.

---

## 2. The Regions

### 綴村 — Tsuzuri Village · *the binding village*
**Band:** kana + first ~80 kanji · **Waypoints:** 6

The road starts at the bottom of the scroll in a village small enough to hold in
one hand. Dawn, wet stone, knee-high fog that burns off as you work. Paper
lanterns with no names on them. The people are patient with you; nobody explains
the world, they just hand you a brush.

- **Kanji focus:** 一二三四五, 人日月火水木金土, 山川田口目手, 上下中大小, 円年時
- **Vocabulary:** family, home, numbers, days and dates, greetings, basic verbs
- **Grammar:** です／ます, は／が／を, これ・それ・あれ, time words
- **You are restoring:** the village nameboard, the six lantern-posts along the
  main street, and the first road marker pointing north. Each lantern you
  re-ink lights a house, and the village goes from grey to warm across the
  region — the most visible before/after in the game, on purpose.
- **Side path:** *The Tally Path* (counters — 個・本・枚・人), unlocked the
  first time the player misses a counter question.
- **Gate out:** the road marker at the north edge. Read it, and the Market Road
  appears out of the fog.

### 市の道 — The Market Road · *ichi-no-michi*
**Band:** N5 · **Waypoints:** 7

A kilometre of stalls under mismatched awnings, loud and cluttered, every price
tag blank. This is the first region that feels *busy* — the fiction's excuse to
put a lot of nouns in front of the player at once.

- **Kanji focus:** 食飲買売店, 百千万円安高, 米魚肉茶酒, 男女子父母, 新古多少
- **Vocabulary:** food, drink, money, prices, shops, adjectives, quantities
- **Grammar:** ～が好きです, ～をください, ～はいくらですか, い/な-adjectives
- **You are restoring:** menus, price tags, and the noren over each shop door.
  Restored stalls start selling — a cleared stall visibly gains goods, smoke, a
  vendor, a queue.
- **Side path:** *The Tea House* — a slow-reading nook where the player can
  re-read any scene they've cleared, with audio. No new material, no pressure.
- **Gate out:** the market gate ledger — a mixed drill over the whole region.

### 汽線駅 — Kisen Station · *the steam line*
**Band:** N5 → N4 bridge · **Waypoints:** 7

An echoing platform, a departure board flickering between legible and blank,
steam that reads like fog but isn't. The first region about *going somewhere* —
and the region that hands the player fast travel, which is why it sits third.

- **Kanji focus:** 駅電車道行来出入, 東西南北, 前後左右外内, 何時分半毎
- **Vocabulary:** transport, directions, schedules, tickets, travel verbs
- **Grammar:** ～へ行きます, ～に乗ります, ～から～まで, ～ています
- **You are restoring:** the timetable, the platform signs, and finally the line
  map itself — restoring the line map is what unlocks **the Iron Line**, the
  first fast-travel system.
- **Side path:** *The Night Train* — a timed reading run for players who want
  speed. Optional forever.
- **Gate out:** buy a ticket north by reading the fare board unaided.

### 白門学舎 — Hakumon Academy · *the white gate*
**Band:** N4 · **Waypoints:** 8

A school with a library that has lost its index. Chalk dust, cedar floors,
afternoon light. Warmer and more social than it sounds: the region's waypoints
are conversations, not lectures. This is where verbs stop being vocabulary and
start being grammar.

- **Kanji focus:** 学校先生友聞話読書, 教室図書, 思言知答問, 曜週始終
- **Vocabulary:** school, study, work, opinions, describing people
- **Grammar:** ～て form, plain form, ～たり～たり, ～と思います, ～ながら
- **You are restoring:** the library index — the single biggest restoration in
  the game so far. Every shelf you re-ink adds real, readable content to the
  in-app Library, so the reward is a bigger reading pool, not just a cutscene.
- **Side path:** *The Calligraphy Room* — pure stroke-order practice, mastery for
  its own sake, awards the finest stamps in the book.
- **Gate out:** write a short entry into the index yourself (sentence building).

### 雫谷 — Shizukudani Springs · *droplet valley*
**Band:** N4 · **Waypoints:** 7

Steam, cedar, rain on a tin roof, a valley that is genuinely restful. Placed
here deliberately: it follows the hardest region so far and it's the game's
designated exhale. Slower pacing, shorter waypoints, more listening.

- **Kanji focus:** 体病医薬痛気持, 雨雪風晴曇雲, 春夏秋冬暑寒暖冷, 湯泉山谷
- **Vocabulary:** body, health, weather, seasons, feelings, advice
- **Grammar:** ～ので, ～たら, ～た方がいい, ～すぎる, ～そうです
- **You are restoring:** bathhouse rules, apothecary labels, and the weather
  shrine's forecast boards. Restoring the shrine boards is what unlocks
  **paper cranes** — point-to-point fast travel.
- **Side path:** *The Listening Well* — audio-only comprehension, unlocked here
  and available everywhere afterwards.
- **Gate out:** describe a symptom well enough to be understood.

### 陽炎市 — Kagerō City · *heat-haze city*
**Band:** N3 · **Waypoints:** 9

Concrete, neon smeared by rain, a city that generates more written language in
an hour than the whole south does in a year — and is losing it faster. The tone
shifts here: less pastoral, more urgent, the first region where the fog is
actively *spreading* rather than just sitting.

- **Kanji focus:** 会社仕事議報告, 経済政治法律, 情報記事新聞, 関係影響必要
- **Vocabulary:** work, news, systems, abstract nouns, formal and casual register
- **Grammar:** passive, causative, ～ようだ／らしい, ～ばかり, keigo basics
- **You are restoring:** the newspaper. Each cleared waypoint prints one more
  column of a front page the player can actually read at the end.
- **Side path:** *The Broadcast Tower* — daily rotating real-length reading.
- **Gate out:** read the full front page unaided.

### Sketched: the northern three

- **峠原 Tōgehara Highlands** (N3–N2) — thin air, stone markers, nature and
  travel kanji at high density; restoring the pass markers so the road survives
  winter.
- **潮見港 Shiomi Port** (N2) — trade, contracts, formal written Japanese;
  restoring the harbour's shipping ledgers.
- **三国文庫 Mikuni Archive** (N1) — the great library, classical forms, rare
  readings; restoring the catalogue that names every other region.

The road ends at **無字の都**, the Unwritten Capital: a city with no signs at
all, restored one district at a time by everything the player has learned.

---

## 3. Traversal Rules

### 3.1 Node states

Every waypoint is in exactly one state, derived from SRS data on render:

| State | Meaning | Look |
|---|---|---|
| **Sealed** | region not yet unlocked | silhouette, no name |
| **Fogged** | reachable, not started | grey outline + name + thread count |
| **Open** | started, ink partial | outline filling from the bottom |
| **Inked** | cleared | solid ink + vermilion seal stamp |
| **Thin** | cleared, but items lapsed | inked with a dotted halo |

### 3.2 Threads and ink

Each waypoint owns a **thread-set**: 12–18 kanji, ~15 vocabulary items, 3–5
grammar patterns. Each thread has a state driven by the scheduler:

`unwritten` → `faint` (seen, interval < 1d) → `inked` (interval ≥ 3d) → `set` (mature)

- **Waypoint ink %** = share of its threads at `inked` or better.
- A waypoint **clears at 80%**, with no thread left `unwritten`.
- Region ink % is the mean of its waypoints. It's the number on the region banner.

80% is deliberate: demanding 100% turns the last two stubborn kanji into a wall,
and those two are exactly the ones the scheduler should be re-surfacing later
anyway.

### 3.3 Moving

- **Main road:** the next uncleared waypoint is the lit node. Tapping it opens
  it; the traveller token walks the segment as you answer.
- **Free travel:** any *cleared or open* node is tappable, any time, forever. No
  travel cost, no energy, no stamina. Backtracking to re-study is a thing the
  app should make trivially easy, not something the map taxes.
- **One step ahead only:** exactly one uncleared node is available at a time on
  the main road. This is the single most important usability rule on the map —
  it's what stops the screen from becoming the flat twelve-item to-do list the
  current panel is.

### 3.4 Gates

| Gate | Requirement |
|---|---|
| Waypoint → next waypoint | waypoint reaches 80% ink |
| Region → next region | all main waypoints cleared **and** the region's **Shrine Trial** passed |
| Side path opens | a trigger condition (see 3.5) |
| Fast travel | a specific waypoint restoration (see 3.7) |

**The Shrine Trial** is one per region, not one per waypoint. It's a mixed
challenge drawing from the *whole* region — recognition, writing, and one built
sentence — with no warning of what's coming. Passing stamps the region and lifts
the fog off the next one, which is the map's biggest visual moment and should be
spent sparingly. (Today's build has twelve guardian battles; folding them to one
per region gives each of them real weight. The existing guardians survive as the
Shrine keepers — **Fogbound**, shapes made out of forgotten writing.)

Fail a trial and nothing is lost: it names the three threads that let you down
and offers to walk you back to them.

### 3.5 Side paths

Side paths hang off the road as short branches, 2–4 nodes long.

- **They never gate the main road**, and they never contain material the main
  road later assumes. This is a hard rule; break it once and the player learns
  they can't trust the road.
- They open on **triggers**, not on level: missing three counters opens the
  Tally Path; favouriting five words opens the Field Journal route; a 7-day
  streak opens the Night Train.
- They reward **stamps** (see §5), **map utilities** (fast travel, the itinerary
  view), and **more content in tools the player already likes** — never stat
  boosts that make the main road easier. The main road should be beatable
  ignoring every side path, and richer if you don't.

### 3.6 Fog creep and upkeep

When threads at a cleared waypoint fall due, that node goes **thin** — dotted
halo, and a small drift of fog at its edge. Region banners show
`Ink 92% · 14 threads thinning`.

- Thin nodes are **never** re-locked and never block anything.
- Clearing the due reviews there restores the node in one session.
- Fog creep is capped: a node can look thin, it can't look fogged again. Nobody
  should open the app after a two-week break and see their village grey.

The daily due queue *is* upkeep. The map just shows you where it lives.

### 3.7 Fast travel

| Unlock | Where | What it does |
|---|---|---|
| **The Iron Line** | restore Kisen Station's line map | jump to any cleared *region* |
| **Paper cranes** | restore Shizukudani's shrine boards | jump to any single *node*, including thin ones |
| **The Lantern** | first 30-day streak | opens directly onto today's route, skipping the map |
| **Ink Gates** | Kagerō City onward | two-way shortcut between any two stamped shrines |

Fast travel arrives late enough that the early game teaches the shape of the map
by walking it, and early enough that nobody in the north is scrolling past six
regions to reach their reviews.

---

## 4. Study Tools, In-World

Every tool keeps its plain name. The in-world name is the subtitle.

| Tool (in the build) | In-world | What it looks like |
|---|---|---|
| Stroke practice (`TraceCanvas`, `StrokeOrderAnimation`) | **Inscribing** | a broken signpost re-inks stroke by stroke as you write; wrong strokes bleed and fade |
| Kanji recognition (`ChoiceDrill`, reading quiz) | **Reading the signs** | a faded sign at the waypoint gate; pick the reading, the sign sharpens |
| Vocabulary (`VocabPractice`, `FocusedVocabPractice`) | **Naming** | objects in the scene regain their labels one at a time |
| Compounds (`KanjiLab`) | **The Joinery** | two threads twisted into one word; shows what each kanji contributed |
| Sentence building (`SentenceBuilderView`) | **Bridge-laying** | words are planks laid across a gap in the road; a wrong order sags |
| Grammar drills (`GrammarPractice`) | **Joint stones** | particles set into a wall; the right stone locks with a click |
| Scene reading (`QuestScene`) | **The restored page** | read the thing you spent the whole waypoint preparing for |
| Listening (`speech`, audio) | **The Listening Well** | audio-only, the well repeats as often as you want |
| Picture practice (`PicturePractice`) | **The sketchbook** | image → word, the scribe's own field sketches |
| Counters (`CounterPractice`) | **The Tally Path** | a side path of market stalls counting stock |
| Speed run (`BeginnerSpeedRun`) | **The downhill run** | a timed descent through material you already own |
| Library / favourites (`LibraryPanel`, favourites) | **The satchel & field journal** | everything you've collected, re-readable |
| Achievements (`AchievementsPanel`) | **The stamp book** | a goshuin-style book; each shrine and side path stamps it |

The stamp book is worth calling out: a physical stamp collected at each shrine is
culturally apt, instantly readable as progress, and gives side paths a reward
that costs no balance.

**Framing rules**
1. Function first in the label, flavour second. Always.
2. Flavour text is capped at two lines per waypoint, one line per step.
3. No flavour text ever sits between the player and the first question. The
   *Continue* button goes straight into study; story is a panel you can read on
   the way, not a gate.

---

## 5. Visual Presentation

### The scroll

A vertical handscroll (emaki), panned with a thumb. Off-white paper with visible
grain and a faint deckle edge. Sumi-black ink. One accent colour — vermilion —
used for exactly three things: the traveller token, the *you are here* marker,
and seal stamps. Nothing else in the UI is allowed to be red.

The road itself is a single SVG path drawn as a brush stroke, revealed with
`stroke-dashoffset` as the player advances. It is literally *drawn* by their
progress, and the trail behind them stays inked — a map that reads as a record
of where they've been.

### Fog

A soft grey wash with the same paper grain, edges feathered, sitting *above* the
region art. Lifting it is a 900ms dissolve plus a slow drift upward. It's the
game's payoff animation; use it only for shrine clears.

### The traveller token

A brush-tip with a small lantern. It sits on the road at the exact position
implied by session progress, not at the last node — so opening the app mid-region
shows you standing between two places, which is a surprisingly strong pull to
finish the walk.

### Chrome

- **Top:** region name, JLPT band, ink %, due count. Nothing else.
- **Bottom:** one primary button — `Continue · <waypoint name>` — and a
  secondary `Today's route`.
- **Today's route** is an auto-planned card: due reviews first, then the next
  waypoint's new material, stated as distance: *"3 stops, about 12 minutes."*

### Node rendering

| State | Rendering |
|---|---|
| Sealed | grey silhouette, no label |
| Fogged | grey outline, name + `0/16 threads` |
| Open | outline with ink filling from the bottom to ink % |
| Inked | solid, with a vermilion seal |
| Thin | solid, dotted halo, small fog drift |

State is never signalled by colour alone — each carries a shape, a label, and an
icon.

### Practicalities

- Mobile-first: one column, thumb-panned, minimum 44px targets. A minimap rail on
  the right edge for jumping between regions.
- Render at most the current region plus one neighbour each way; regions further
  out are static thumbnails.
- Honour `prefers-reduced-motion`: fog cuts instead of dissolving, the token
  jumps instead of walking.
- **Ship an itinerary view.** A plain vertical list of regions → waypoints →
  steps with the same state labels, one tap from the map. It's the accessible
  path, it's the fast path for power users, and it's what the current
  `QuestHub` list becomes rather than something thrown away.

---

## 6. What the First Two Regions Feel Like

**Day 1.** The app opens on a grey village at dawn. One lantern-post is lit,
vermilion, at the bottom of the scroll. Two lines of text: *"The village has
forgotten its own name. Start with the board at the gate."* One button:
`Continue · The Gate Board`.

It's kana. Twelve characters, recognition first, then tracing three of them. The
brush-tip walks a few centimetres up the road as she answers. At the end the gate
board fills in — 綴村 — and the sign is now legible on the map behind her. Ink 6%.
Two minutes have passed and something visibly changed.

**Day 2.** Opens on the map with a new line at the top: *2 threads thinning.*
Today's route says *2 stops, about 8 minutes*: yesterday's kana come back first,
then the second lantern-post — 一二三四五 and the days of the week. The village
now has two lit windows. Kana she got wrong yesterday come back faster; she
notices, without being told.

**Days 3–6.** Four more posts: home and family, basic verbs, time. Somewhere in
here she misses 三個 twice and a short branch unfurls off the main road — *The
Tally Path* — which she ignores, and nothing punishes her for it. By the sixth
post the village is warm all the way down its street, and the road marker at the
north edge is lit for the first time.

**The first Shrine.** No new material. Sixteen mixed questions from everything in
the region — read a sign, write two kanji, build one sentence — and a Fogbound
made of half-erased strokes standing at the marker. She misses two. It tells her
which two, offers to walk her back, and she takes the offer. Second attempt
clears.

The fog north of the marker dissolves upward over about a second, and a
kilometre of market stalls appears — greyed out, awnings blank, absolutely
nothing readable. Her stamp book gets its first stamp. This is the moment the
game is designed around, and it lands roughly a week in.

**Day 8, the Market Road.** Louder immediately: seven waypoints instead of six,
menus and prices instead of lanterns. The first stall's price tags are blank; she
learns 百千万円 and they fill in, then the stall gains a vendor and a queue. The
difference is that the reward is now *legibility* — she can read a menu she
couldn't read on day 7 — and the village behind her stays lit on the scroll,
which is a thing she scrolls back down to look at more than once.

**Day 12.** She opens the app on a train with four minutes. `Today's route: 1
stop, about 4 minutes.` It's all review. The brush-tip moves a centimetre. Two
thin nodes in Tsuzuri go solid again. That's a complete, honest session — and the
map said so before she started.

---

## 7. Fitting This to the Current Build

| Now | Becomes |
|---|---|
| `CAMPAIGN_ARCS` (2) | `REGIONS` (9), same shape plus band, palette, gate |
| `QUESTS` (12) | `WAYPOINTS`, ~60 across the realm; today's 12 map onto regions 1–5 |
| `QuestDefinition.guardian` | Shrine keeper — one per region, not per waypoint |
| `reward` / relics | Stamps in the stamp book |
| `QuestProgress` (step flags) | `deriveMapState(srsProgress)` — ink % computed, not stored |
| `isQuestUnlocked` | `isWaypointOpen` / `isRegionOpen`, same one-ahead rule |
| `QuestHub` | `MapView` (scroll) + `ItineraryView` (the current list, kept) |

The one migration that actually matters is **ink derived from SRS instead of
stored step flags**. Everything else is presentation; that one is what makes the
map tell the truth.

### Open decisions

1. **Thread-set authoring — bigger than it looked.** Measured by
   `npm run audit:map-state`: the twelve topics in use supply **204 threads
   total** (15 vocabulary cards each, plus a handful of kanji), and **156 of the
   characters in `kanjiFocusSets` have no card in `kanji.ts`**, so they cannot
   carry ink. At ~17 threads a topic that is *one* waypoint each, not six.
   Regions 2-6 need roughly 5x the current kanji card coverage before the road
   has enough stops to be a road.
2. **Existing players.** Derive their region from current SRS maturity and drop
   them in with the road behind them already inked. Never restart anyone.
3. **Shrine difficulty.** Start generous. A shrine that gates a fog-lift is the
   worst place in the app to be unfair.
4. **Northern volume — deferred.** The three northern regions are sketched, not
   scoped. Build regions 1–6 (kana through N3) against this spec; N2/N1 content
   lands later and may want a different node density or repeatable nodes.
   Nothing in the traversal rules changes either way.
