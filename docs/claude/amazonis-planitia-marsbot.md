# Amazonis Planitia — phase 2: MarsBot on the EXTENDED board · design record

**Status: shipped 2026-11-07.** The official eleven-row Amazonis Planitia (`BoardName.AMAZONIS_PLANITIA`) is in
`AUTOMA_SUPPORTED_BOARDS`, in the campaign's pool (weighted), and plays with MarsBot on a board of its own format.
Phase 1 (the human's premium adaptation, no bot) is `docs/claude/amazonis-planitia-phase-1.md`; the data tables are
`docs/AUTOMA_DATA_AUDIT.md` §2k (the board) and §24 (the rules, the clock, the balance, the campaign). The owner's
direction (2026-11-07): «redesign the whole bot board and the bot's balance to cope with the extended terraforming
tracks — the late bonuses especially strong, to keep the bot in tone late; widen the dynamic-balance scales to later
generations; adapt the bot to the map's milestones and awards and put the non-duplicates into the ALL pool; then the
random-set case; then enable the map for the bot and in the campaign, more likely than other maps, especially as the
finale». Every decision below is HOME-MADE unless a rulebook page is named; the owner's own calls are marked.

## 1. The problem — measured, not felt

The map's global parameters are longer: 11 oceans (9), +14 °C (+8 — 22 steps for 19), 18 % oxygen (14), Venus 33 %
(30 — 1 % steps above 30, 18 steps for 15). That is 51 Martian steps for 42, and the rulebook gives the solo game one
extra generation on this map. A 19-cell MarsBot track is built for the standard game.

The bench (`tests/automa/marsBotBench.ts` — the same seeded card sequences resolved by the bot; 3 project cards = 1
generation; 12 sequences × 72 cards = 24 generations) on the THARSIS board:

| band (generations) | 1–6 | 7–12 | 13–18 | 19–24 |
| --- | --- | --- | --- | --- |
| TR gained | 11.7 | 18.5 | 25.4 | 33.3 |
| Failed Actions | 0.92 | 1.42 | 3.25 | 8.08 |
| tracks at their end (of 84) | — | at gen 16: 4 | at gen 20: 14 | at gen 24: 37 |

Past the 18th generation the Failed Actions are SIX TIMES the mid-game's: every tag landing on a finished track pays
5 M€ and terraforms nothing. The human's engine accelerates late; the bot's pace is linear and then stalls. On a map
that runs a quarter longer that is where the bot falls behind — the owner's hypothesis, confirmed.

## 2. The design — ONE format: 25-cell tracks (`src/server/automa/boards/AmazonisPlanitiaMarsBot.ts`)

**The body (cells 0–18) is the Tharsis board, cell for cell** — the base the Awards & Milestones module itself hands any
map it does not know (RB-C p.12), the law of the six official boards (10 oceans · 13 + 1 temperature · 15 greeneries ·
10 cities · 4 + 4 milestone / award cells · 37 empty · ΣTR 82 · the ends tr5 / tr6 / tr5 / tr7 / tr8 / tr7 / tr6),
and the topology the row wants by the law of pairs: Physicist reads science + space tags, so the science row carries
NO Jovian (it rides Power); Terran counts Earth tags on the Earth / City row; Manufacturer reads the steel and energy
badges; Collector and Merchant read every track. The first two thirds of a game therefore pace EXACTLY as on the
official boards — the pace calibrated by hand and by the owner's field games. A hotter body would have made the early
bot stronger, which is the one complaint the October balance work answered (`marsbot-second-shift.md`).

One touch on the body: **Constructor's colony cubes** («cities and colonies owned», RB-C p.14) — the module backs it by
three colony cubes; printed here as `colony5` cells («MarsBot loses 5 MC and builds a colony», Adding Expansions p.14)
on the body's empty cells nearest the module's own places: **space 4, space 10, power 8** — exactly the cells the
random-set generator would repair them onto, so the fixed row re-assembles with zero repairs (the golden test). Inert
without Colonies, like every expansion icon.

**The late reserve (cells 19–24) — no cell is empty:**

| row | 19 | 20 | 21 | 22 | 23 | 24 |
| --- | --- | --- | --- | --- | --- | --- |
| building | advance | city | tr3 | temperature | greenery | tr6 |
| space | advance | temperature×2 | tr3 | ocean | temperature | tr7 |
| event | advance | greenery | tr3 | temperature | ocean | tr6 |
| science | advance | temperature | tr4 | ocean | temperature×2 | tr8 |
| power | advance | greenery | tr4 | city | temperature | tr8 |
| earth | advance | temperature | tr3 | greenery | ocean | tr8 |
| bio | advance | greenery | tr3 | greenery | temperature | tr7 |

- **Cell 19 is an «advance» on every row**: a track that crosses its old end is PUSHED into the reserve on the spot — the
  crossing itself is an event, never a dead cell. (On Easy the rulebook ignores «advance», so the track stops on 19.)
- **Cell 21 a mid-reserve TR** (3–4), **cell 24 the new end TR** (6–8, the pattern of the body's ends).
- The three cells between carry what the longer game needs: 4 more oceans (14 printed for 11), 6 more greeneries (21 for
  18 % oxygen), 7 single + 2 double temperature steps (26 for 22), 2 more cities.
- **ΣTR of the reserve = 73** — the body's 82 again, in six cells a row: reached rarely, late, and only by a track the bot
  has driven all game — the «strong late bonus» the owner asked for. The whole board prints ΣTR 155.
- The milestone / award cells are the body's — the first-claim and criterion windows are unchanged.

**The reserve's law** (`matLaw.tailViolations`): same length on every row, no empty cell, opens with `advance`, ends on
tr5–tr8, no milestone / award / colony / token / tag cells, the bands ocean 3–5 · greenery 5–7 · city 1–3 · temperature
6–8 · temperature×2 1–3 · advance 7–9 · ΣTR 60–80. `matViolations` is format-aware: body law + reserve law, mixed
formats rejected. `MARSBOT_EXTENDED_TRACK_POSITION = 24`, `MAT_BODY_LENGTH = 19`.

**The Venus row** (`amazonisPlanitiaVenusTrackFor`): the printed 13-cell row with its end re-cut for a Venus that runs
to 33 % — cell 12's «+5 TR» moves to 15; the three new cells are a Venus step, an «advance» and a DOUBLE Venus step:
7 Venus steps for 18 on the scale (the standard row: 4 for 15). The cell-9 microbe icon still follows the mat's
Microbe track (`MarsBotMapProfile.venusTrackFor` — the generator asks the map for the row of ITS mat).

**What the engine already knew**: a track's length is `maxPosition` (the Venus row has used it since the start) — the
resolver, the regress, the corporation cubes (C13 Cheung Shing's silver cubes sit at `MARSBOT_EXTENDED_TRACK_POSITION − 3`
on this map), the client's mat (`--mb-cols` = the widest row + 1 → 25 columns) and the generator read it.

## 3. The clock — the bot's pace runs three generations later (`src/common/automa/botPace.ts`)

The M€ → VP ladder (8 M€ a point through the 12th generation, then 7 … 1) and the instant win (entering the 20th
generation, 18th with Prelude) are the SOLO game's clock — a game that ends around the 13th–14th generation. This map's
game runs ~3 generations longer (51 steps for 42 ≈ +21 %; the rulebook's own +1 solo generation). Both read the
map's **pace offset**: `BOT_PACE_OFFSETS[AMAZONIS_PLANITIA] = 3` — `mcPerVp(generation, prelude, humans, paceOffset)`
normalizes `generation − paceOffset` (8 M€ through the 15th, 7 in the 16th …; Prelude and the extra-human shift compose
as everywhere), `getAutomaMaxGeneration(prelude, paceOffset)` → the instant win enters the 23rd generation (21st with
Prelude). A standard-length map has offset 0 (the fan «Amazonis Planitia» included). Alternatives weighed: a flat
+4 (over-generous — the bench's 48-card run on the extended board is INSIDE the printed band, so the body needs no
help), reading the generation off the parameters' progress (a lie after a stall).

## 4. The second shift — the ladder runs to the long game (`SecondShift.ts`)

The dynamic-balance cap was five bands, the last «10+» — designed for games that end by the 13th. Two bands added FOR
EVERY MAP (the rule is the game's, not the map's — a long Tharsis game needs them too):

| difficulty | 1–4 | 5–6 | 7–8 | 9 | 10–12 | 13–15 | 16+ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 0 | 0 | 1 | 1 | 2 | 2 | 3 |
| Normal | 0 | 1 | 1 | 2 | 3 | 3 | 4 |
| Hard | 0 | 1 | 2 | 3 | 4 | 4 | 5 |
| Brutal | 0 | 2 | 3 | 4 | 4 | 4 | 4 |

The bot that earned four extra cards in the 10th generation earns no fewer in the 16th; Brutal stays at 4 (its +1 VP a
card compounds). Through the 12th the ladder is byte-identical to the shipped one.

## 5. The map's milestones and awards for the bot (`ma/botMARules.ts` — one row each)

| name | bot rule | source |
| --- | --- | --- |
| Terran (5) | the Earth / City track at 5 | RB-C p.14 (the 5-tag twin) |
| Landshaper | a city AND a greenery AND the building track at 5 | RB-C p.13 |
| Merchant (3) | every Martian track at 3 (the Venus row not counted); shown as a flag | HOME — RB-C p.13's Merchant read at 3 for the 3-of-each clone; law `tags-single` |
| Sponsor | three cards of ≥ 20 M€ in the played pile | RB-C p.14 |
| Activist (Redux) / Terraformer (29, no Parliament) | as usual — the bot's own Agenda marker / its real rating | Redux home rule / Tharsis R4 |
| Collector | the tracks at ≥ 3 | RB-C p.14 |
| Innovator | the played pile, events included, at **two thirds** (`floor(n × 2 ÷ 3)`) | HOME — Celebrity / Incorporator count the pile (B10, B11); the handicap law `award-offset` (Botanist −2): the bot resolves every card it draws and pays for none, so its pile outruns a strong human's table by about a third (~57 cards by the 13th generation vs 35–45; the bench read 48 of 48 at 16 generations) |
| Constructor | as usual — the bot's real cities + colonies | RB-C p.14 (the module's colony cubes = the body's `colony5` cells) |
| Manufacturer | the building + power tracks summed | RB-C p.15 |
| Physicist | the Science-tag + Space-tag tracks summed | HOME — Planetologist's shape (B12: two tag tracks summed, no offset); on this body the science row carries no Jovian, so the sum is the two tags alone |

The registry grew one predicate (`pilePredicates.any`) and one criterion form (`pile` with `times` / `div` — the face
says «× 2 ÷ 3» in its own words). **Innovator and Physicist joined the RANDOM pools** (`PENDING_ADAPTATION_MA` is gone
from `MilestoneAwardSelector.ts`); Merchant3 stays excluded as a clone of Merchant (`UNIFIED_POOL_EXCLUSIONS`).

## 6. BF5 Corporate Competition (Amazonis Planitia)

The fork's fifth card: Collector → the least-advanced track (the module's helper) · Physicist → the lower of science and
space · Manufacturer → the lower of building and power (RB-C p.15) · Innovator → the deck's top project card resolved
(one more card in the pile, B03's shape) · Constructor → a city (RB-C p.14) · Venuphile (every version) · pays 5 · with
no funded award it can help draws another bonus card. Face: `BonusCardData.ts`; RU «Корпоративная конкуренция (Большая
Амазония)»; cross-player coverage: `touchesHumans` (Innovator's reveal reaches human reactors, Constructor's city
fans out).

## 7. The map's cells for the bot (§24.5)

- **A «standard resource of your choice» cell** (E3 · E9 · K3) is an ORDINARY icon: counted once by the tiebreakers,
  paid 1 M€ when covered, nobody asked (the bot receives no prompts).
- **A delegate cell** (B2 · H7 Olympus Mons — TWO icons · H9): Vastitas Nova's Viking rule generalized to «one delegate
  per PRINTED icon» — the bot places each from its reserve, free, on top of the generation's mandate, re-checking the
  reserve before the second; counted as that many icons while a delegate can land, «considered empty» (0 icons, 0 M€)
  without the Redux Parliament or with an empty reserve.
- The five volcanoes are plain land; no Noctis reservation; tiebreakers the base pair (oceans → reward icons) — no
  criterion of the row counts where a tile stands, so no placement step of its own (the law of §A of the checklist).

## 8. The random set on the extended base (§22 applied)

The generator assembles the law-formed BODY (`matBody`) from the row library and hands the map's reserve back to every
row (`matTail` — by row index, the role order is fixed), so a random-set mat on this map is 25-cell rows with the map's
own reserve, lawful whole; the Venus row is the map's 16-cell one following the mat's Microbe track. The golden test
re-assembles the printed row with zero repairs and the printed topology. A random-set game plays B14 (never BF5).

## 9. The campaign — the large map comes up more often, and as the finale (`src/server/campaign/campaignRoute.ts`)

`drawCampaignRoute(pool, 4, rng)`: a weighted draw without replacement (`CAMPAIGN_BOARD_WEIGHTS` — Amazonis Planitia
2, every other board 1), then — if the favourite is on the route and not last — a coin (`CAMPAIGN_FINALE_FAVOURITE.chance`
= 0.5) moves it to the last slot. Measured over 3000 seeded routes from the bot's pool of 13 boards: on ~50 % of routes
(a board's share is 4 / 13 ≈ 31 %), the finale of ~62 % of those (the slot's own share is 25 %) — more likely, never
guaranteed, every other board still drawn. `CAMPAIGN_GENERATOR_VERSION = 2`. The mission card already renders the
11-row fingerprint by its real cell count (`PremiumMapFingerprint` → `miniRowsOf`).

## 10. The bench — what the reserve buys (`tests/automa/MarsBotExtendedBoardBalance.dev.spec.ts`, TM_BOT_BALANCE=1)

Tharsis vs the Amazonis Planitia extended board, 12 sequences × 72 cards (24 generations), the bench's flow:

| | 1–6 | 7–12 | 13–18 | 19–24 | total |
| --- | --- | --- | --- | --- | --- |
| TR — Tharsis | 11.7 | 18.5 | 25.4 | 33.3 | 88.9 |
| TR — Amazonis Planitia | 11.7 | 18.3 | 26.4 | **46.5** | **102.9** |
| Failed — Tharsis | 0.92 | 1.42 | 3.25 | **8.08** | |
| Failed — Amazonis Planitia | 0.83 | 1.42 | 2.17 | **2.00** | |
| tracks at their end (of 84), gen 16 / 20 / 24 — Tharsis | | | 4 / 14 / 37 | | |
| — Amazonis Planitia (end = 24) | | | 0 / 2 / 9 | | |

The first twelve generations are identical (the body IS Tharsis); the reserve turns the 20th–24th generations' Failed
Actions back into terraforming (+40 % late TR). At the standard 48 cards against the ten printed boards' band every
metric is INSIDE except `failed` BELOW (3.75 < 4.08 — benign: fewer stalls) and `awardScore` ABOVE before the Innovator
handicap (22.9 vs 18.9 — the raw pile of 48), inside with it. Phase 1's premium quality was re-read on the two 4K
frames (`screenshots/amazonis-planitia/01-field.png`, `21-terraformed.png`) and the official wrap
(`TM_AV_WRAP_ENG.pdf`): all ten milestone / award texts match the implementations; Lobbyist → Activist with the fixed
Terraformer29 replacement without the Parliament is the owner's phase-1 decision.

## 11. What the player sees

- «Планшет бота»: 25 columns (the Venus row 16, ending early as the shorter row always did); the readout «20/24»; the
  reserve's cells draw the ordinary glyphs. Verified on the box at 4K: e2e `console-amazonis-planitia-marsbot` measures
  every cell wider than its icon + 6 px.
- The creator seats the bot on the map (no `map` issue — `consoleCreateModel.spec`); the campaign overview draws the
  11-row miniature.

## 12. Tests

`tests/automa/AmazonisPlanitiaMarsBotBoard.spec.ts` (every cell, both laws, the Venus row, the profile — the ONLY
extended board), `tests/automa/AmazonisPlanitiaMarsBot.spec.ts` (setup, the reserve's resolution, the Venus row, the
colony cubes, the cells, every milestone / award rule, BF5, the clock in units and in a game, 30 advances with every
expansion, the model and the save, the random set), `tests/campaign/campaignRoute.spec.ts`, `BonusCardView.spec` (BF5
face), `SecondShift.spec` (7 bands), `botMARegistry*.spec`, `matGenerator.spec` (golden on the extended base),
`ApiCreateGame.spec` / `AutomaCompatibility.spec` (the pool), `crossPlayerCoverageGuard` (BF5), the dev bench; e2e
`console-amazonis-planitia-marsbot` (fixture `amazonis-planitia-marsbot`).

## 13. Decisions taken by the author (reversible — named in the report)

1. Body = Tharsis + three `colony5` cells (not a hotter home-made body) — the early pace stays calibrated.
2. The reserve's exact cells (§2) — the parameter counts follow the map's maxima; the end TRs follow the body's pattern.
3. Pace offset +3 for the ladder AND the instant win (not +4, not parameter-driven).
4. The second-shift ladder extended for every map (two bands), Brutal capped at 4.
5. Innovator at ⅔ of the pile; Physicist = science + space tag tracks; Merchant3 = every Martian track ≥ 3.
6. BF5's helper set; base tiebreak pair; a delegate per printed icon; the standard-resource cell = 1 M€.
7. Campaign weight 2 + finale chance 0.5; generator version 2 (saved campaigns keep their routes).

## 14. Left open

- Field calibration: the pace offset and the reserve's TR were set on the bench; the owner's real games on the box
  (`npx tsx scripts/marsbot-pace-bench.ts`) are the next reading — the natural lever is `BOT_PACE_OFFSETS` (one number)
  and the reserve's cells 21 / 24.
- The bot's corporations' track-based clauses (C13, C15, C19, C29 …) read the body's numbers and are untouched by the
  reserve; a corporation whose cube sits at «the last cell» reads `maxPosition` (C13 does).
