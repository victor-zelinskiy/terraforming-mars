# TR65 Strategic Shift («Смена стратегии») + the iteration «СТОЛ — ЭТО СТОЛ»

**Status.** Shipped 2026-10-17. The prompt: `docs/claude/prompts/project-tr65-strategic-shift.md`. The law: `.claude/rules/console-ui.md`
§ THE PLAYED TABLE IS A TABLE; the table's contract: `docs/claude/console/played-table.md`. Ledger: section BC
(`docs/claude/gameplay-polish-ledger.md`, PL-610…625). Decisions 1–3, 5, 6, 10 were taken at their defaults; 4 (the discard
skin), 7 (the chassis), 8 (shelves + pages, and whether the focus walks by CATEGORY or by CARD) and 9 (the physics) are the owner's
batch, built at the recommended option. **Art imported** (`Mars Arts/TR65.png` existed → `assets/card-images/TR65.webp` + thumb).

## 1 · The card

Red (EVENT), 2 M€, no tags, no requirement, no VP (`StrategicShift.ts`): «Discard as many cards with a requirement from your hand as
you like. Then gain the same amount of M€ and draw that many cards.» — word for word on the face; the graphic
`−[card with REQ] X → +[M€] X · +[card] X` (`b.minus().cards(1, {secondaryTag: AltSecondaryTag.REQ, text: 'X'}).plus()
.megacredits(1, {text: 'X'}).plus().cards(1, {text: 'X'})`); two `infoText` blocks (the guard refuses sequencing words in a
description that stands alone): «Discard any number of cards with a requirement from your hand.» · «Gain 1 M€ and draw 1 card for
each card discarded.». RU «Смена стратегии»; lore key `TR65` (EN in `assets/text/lore_texts.json`, RU in `src/locales/ru/lore_texts.json`).

**«A card with a requirement» is the SERVER's fact** — `card.requirements.length > 0` (`eligibleCards(player)`: the hand minus the
card itself), never a text match, never a client derivation; the candidates and the reasons ride the prompt. Three known pieces:

- **The pick is a `DiscardCards` with a CANDIDATE SET** (`deferredActions/DiscardCards.ts` gains `cards?` + `disabled?` +
  `showSelectAll?`): the auto-shortcut and the `SelectCard` are built over `options.cards ?? hand`, the ineligible cards stand DISABLED
  with «No requirement on this card» (`STRATEGIC_SHIFT_NO_REQUIREMENT_REASON`), «select all» is the server's own flag. The prompt
  keeps the `discardPrompt` marker (the album wears the discard skin by the RAW marker — the hand-pick law), `min 0`, `max` = the
  candidate count, title `STRATEGIC_SHIFT_DISCARD_TITLE` («Discard any number of cards with a requirement»), priority
  `DISCARD_AND_DRAW`.
- **The pay-off is the play's own**: `.andThen(cards => payOff(player, cards.length))` — M€ through `stock.add` with `{log: true,
  from: {card: this}}`, then `drawCard(owed, {source: {type: 'card', cardName}})`; a short deck is NAMED («Only ${0} of ${1} card(s)
  were left in the deck …»).
- **Zero candidates is a NAMED skip, not a silence** (invariant 4): `recordSkippedEffect(player, SKIP_REASON.noRequirementCard, {label:
  SKIPPED_LABEL.discardCards})` → the `effect-skipped` event, the journal / notification line «Сброс карт с руки — в руке нет карт с
  требованием»; the preview says it BEFORE the press (`warningNote` — «Нечего сбросить: в руке нет карт с требованием.»), and the play
  asks nothing (e2e C). A single candidate keeps the MULTI album (A marks, R3 stands, RT carries the count) — a `min 0 / max 1` pick
  is still a choice of how many — the composer reads a step the server DECLARES as a multi pick (`multiSelect`) as one at any `max` (`isMultiCardChoice`; PL-624 — at `max 1` the row read a bare name with no payouts).

`cardPlayPreview`: `selectCardStep({min: 0, max, showSelectAll: true, disabled: [the card itself «This card is being played», …the
no-requirement cards], multiSelect: {countLabel: «Cards to discard», revealGain: {resource: MEGACREDITS, amount: 1}, drawPerCard: 1},
for: {role: 'discard', source: this}, discard: {min: 0, max, …}})` — the step is ADDRESSED (law 27), its answer lands on the
`DiscardCards` prompt by the address, the whole play is ONE POST. **No counted chip in `effects`** (`countedPlayForecast` guard — the
count is the player's, not the table's). New in the preview model: `multiSelect.drawPerCard` (`ActionPreviewModel.ts`) — the second
per-card pay-out in CARDS beside the M€ `revealGain`.

Spec `tests/cards/turmoilRedux/StrategicShift.spec.ts` (13): the candidates are exactly the requirement cards and never the card
itself; the ineligible ones disabled with the reason; zero candidates → the skip event, no prompt; N discarded → N M€ + N cards; the
deck shortfall logged; the prompt's bounds and `showSelectAll`; the preview's step and its address; the warning note; render items;
save / load. Fixtures: `strategic-shift` (hand DECLARED — Lichen, Fish, Birds, Fusion Power, Research, Tardigrades, Acquired Company;
30 M€), `strategic-shift-none`, `strategic-shift-one` (the deal of the start was stripping the declared hand → `cardsInHand.splice`).

## 2 · «ПУБЛИЧНЫЕ ПЛАНЫ × СБРОС × ВСТРОЕННЫЙ ДОБОР» (decision 4a, the owner's accent)

The owner: «like Public Plans, only the requirement cards are candidates, and then an EMBEDDED draw step». Nothing new was built —
three existing pieces compose:

1. **The multi hand album of Public Plans**, in the DISCARD skin (the raw `discardPrompt` marker): the head «СБРОСЬТЕ ДО N КАРТ ·
   Смена стратегии · −N → +N [M€] · +N [card]», the non-candidates behind the «Только подходящие» filter («Показано 4 из 7»; LT shows
   them with «Без требования» as the reason), A marks / unmarks, **R3 selects all**, RT «Сбросить · N». The card being played is NOT in
   the album (the 2026-10-14 law). The album's discard swap line reads BOTH pay-outs (`discardIntent.ts`: `DiscardExchange.draw`,
   `discardExchangeFor` multiplies `draw` by the picked count; `ConsoleHandSection` prints «· +N [cards]» — `data-hand-discard-draw`).
2. **The composer's answered row** reads «Сбросить: Lichen, Fish» with its impact «+2 [M€] · +2 [card]» (`ConsolePlayCardConfirm`:
   `gainPerCard.cards` ← `multiSelect.drawPerCard`, `chosenImpactDraw`, `[data-impact-draw]`), and the claim sizes the arrival by the
   picks (`multiPickDraws` summed into the play claim's `draws` — `claimPlayOutcome(card, expectedCards)`).
3. **The draw lands INSIDE the hand workspace** — the embedded reveal (`.con-hand .con-reveal--embedded`), never a standalone band
   (e2e B asserts no `.con-reveal:not(.con-reveal--embedded)` for the whole episode): «КАРТЫ В РУКЕ › СМЕНА СТРАТЕГИИ › СБРОС КАРТЫ
   → ДОБОР КАРТ», the discarded cards leave by the discard tray onto the table's ONE pile, the hand reads −n + n, the M€ −2 + n, the
   event lies on the events stack of the table (its count +1 after the reveal).

**PL-259 closed by class** (decision 5): `consoleHandSelectModel.multiPickConfirmCommand(verb, bounds, picked)` — at zero on a
`min 0` pick RT is the REFUSAL in the decline grammar's own words (`zeroPickLabel`: «Не сбрасывать» · «Не показывать» · «Не
оставлять» · «Не выбирать»; `priority: 1` so a crowded bar drops it no earlier than X), never «Сбросить · 0»; from the first pick on,
the verb with its count. Both RT sites of the shell (the composer's client pick and the live `handSelect` task) read it. **And R3
«Выбрать все» outranks the generic hints** (`priority: 1`): with the filter's LT beside it the fhd / 4K bar overflowed by a few rem
and the fit dropped the stick hint FIRST — the one verb this card is for; the verb with its count (the surface's COMMIT — A only
marks) rides `priority: 0`, and both pick bars speak the source verb in its SHORT form («L3 Источник», the inspection grammar's own
word) — the long «Осмотреть источник» was the widest verb of the bar, and Public Plans' 4K bar lost it to the refusal's words alone.

## 3 · «СТОЛ — ЭТО СТОЛ» — the iteration (≈ 85 %)

**The diagnosis (the 4K walk, GPU; `screenshots/tr65/tv4k/before/`, `w5-probe.jsonl`).** «Разыграно» (X) was a DRAWER: 53 % of the
screen over the dimmed board; every zone a pile of NAME STRIPS (a 371 px face with an 87 px peek, names 13–17 px → **51 texts under the
TV floor** on a 20-card table, 92 in the descent); the right third of the band empty (content right 87 %); the corporation one strip
among the strips; the player had to DESCEND into a category to see any face (faces 441 px there — that part, and the physics of the
lift and the landing, were right). The hand album on the same screen: faces 520 px. The whole fix is in `docs/claude/console/played-table.md`;
the shape of it:

- **А · the chassis** — a workspace SCREEN in the central opening (`.con-ws-stage-band()`, the `con-ws` marker, `con-root--rail-replaced`,
  the opening's own dim, an opaque stage surface, the surface-motion id `'played'`), ONE `ConsoleWsHead` («РАЗЫГРАНО › PLAYER1 ›
  АКТИВНЫЕ» — the category view titles nothing), the satellite lane.
- **Б · the planner** — the identity column (the corporation HERO ×1.35 of the shelf face; the events stack ×0.8, its box reserved
  always) + the shelf album at the hand album's density (`cols − 1` of the profile page: 4×2 TV / FHD, 3×1 handheld; the same
  constants; a box fact, never the count), zones as SHELF RUNS packed on rows, strict transform PAGES derived from the focus, LT / RT
  and the edge turn them, off-page cards have a packet HOME.
- **В · the physics** — kept and re-anchored: the category lifts off held slots (one instance), X out of the real slot over the
  standing table, the played card lands on its planned slot (`providePlayedHeroTarget`), the event on the stack.
- **Г · the seats** — LB / RB on one chassis (never an empty frame), the rival's public faces, the bot's corporation + pile with its
  provenance, the early table (hero alone, an honest shelf line), the prepared corporation place, the embedded table in «Информация»
  on the same planner (`fitEmbeddedRoom` / `roomGain` deleted).

**The share table (4K TV, GPU; the stand `screenshots/tr65/table.stand.spec.ts`, `probe.jsonl` before / after):**

| what | BEFORE (the drawer) | AFTER (the table) |
| --- | --- | --- |
| the surface | 3358 × 1315 px over the dimmed board — 53 % of the viewport | 3358 × 1948 px — the whole opening, 79 % |
| content right / bottom | 87 % / 97 % | 98 % / 99 % |
| a zone's card | a name strip (face 371 px, peek 87 px, name 13–17 px) | a full face 528–551 px (the hand album ≈ 520) |
| the corporation | one strip | the hero 565–604 px in a 605–644 px column |
| texts under the TV floor (20 cards) | 51 | 0 |
| 20 cards / 50 cards | one drawer, every zone a pile | 3 pages / 6 pages (4 × 2 shelves) |
| the rival (4 cards) | a 897 px drawer, 36 % | the same screen; content bottom 61–64 % (the events box reserved) |

Frames: `screenshots/tr65/tv4k/{before,after}/` (T1 — open, focus, the lift ×10, the category, the viewer, the return ×10, the
rival, the events focus, close; T2 — page 0, the turn, page 1, the focus walk; T3 — the early table, the bot), the sheets
`screenshots/tr65/sheet-before-*.jpg`, `sheet-after-t1-*.jpg`.

**What the walk judged by eye.** A 20-card table reads from the couch without a descent — every face a card, the corporation the
anchor, the events a stack with its count. Three things to put to the owner (ledger BC, open): the CATEGORY grid's faces are now
SMALLER than the shelf's (the descent used to be the way to see a face; now it reads as a shrink — the grid's own fit is the older
iteration's), the empty events plate on a rival who has played none is heavy, and 20 cards at 4 columns are 3 pages (5 columns would be
2 at a face ≈ 440 px — the hand's density or fewer pages).

## 4 · Decisions (1–10)

| # | decision | taken |
| --- | --- | --- |
| 1 | the candidate rule | **a** — `card.requirements.length > 0` on the server; the party plate's requirement counts (it lives there) |
| 2 | the pick's bounds | **a** — `min 0`, `max` = the candidates; zero candidates = a named skip, no prompt |
| 3 | the pay-off's order | **a** — M€ then the draw, both from the play's own `.andThen` |
| 4 | the pick's skin | **a** (recommended, built) — the multi album in the DISCARD skin; (b) the reveal skin was refused: it cancels the discard physics |
| 5 | RT at zero | **a** — the refusal in words, no badge (PL-259 closed by class for every `min 0` multi pick) |
| 6 | the draw's surface | **a** — embedded in the hand workspace (the play's claim sizes it by the picks) |
| 7 | the table's chassis | **a** (recommended, built) — a workspace screen in the opening; (b) the drawer kept — refused by the diagnosis |
| 8 | the table's composition | **a** (recommended, built) — shelves at the album's density + strict pages; the focus walks by ZONE (a d-pad step lands on the next zone's run; A / X open it) — the alternative «by card» is the owner's question |
| 9 | the physics | **a** — kept: the lift off held slots, the landing on the planned slot, X out of the real slot |
| 10 | the e2e translation | **a** — the 35 `con-played` specs re-pointed where their hook changed (`console-info-workspace` step 9: the subject reads «Бот»); the liveness guard green |

## 5 · Guards and regression

Server: `StrategicShift.spec` (13), `cardInformation` (the two blocks), `countedPlayForecast` (no counted chip), `cardPlayReplayCoverage`
(the addressed discard replays — nothing asked twice), `e2eFixturesLoad` (the four fixtures). Client: `consoleHandSelectModel.spec`
(`multiPickConfirmCommand`, `zeroPickLabel`), `discardIntent.spec` (the draw pay-out), the table's three specs (§ `played-table.md`
§ 7). e2e: `console-strategic-shift` (**A+B** per profile: the filtered album with both pay-outs and the refusal at zero, ONE POST,
the embedded draw, the event on the table; **C** zero candidates; **the single candidate** keeps the multi album),
`console-played-table` (A–C, E–G × profiles), `console-info-workspace` (the embedded table), the neighbours of the pick bar
(`console-public-plans`, `console-hand-pick-preselect`, `console-sponsored-academies`), the band family (`console-workspace-band`),
the landing (`console-play-landing-geometry` / `-probe`, `console-played-zoom-return`). Static: `e2eLiveness`, `glyphLiteralGuard`,
`consoleTvTypeFloor`, `universalSiblingSelectorGuard`, `cursorGrammarGuard`. The run tallies: ledger BC.

## 6 · What not to break

- The candidates and the reasons come from the SERVER's prompt — the album never decides «has a requirement».
- The pick is a PRE-SELECT (nothing leaves the hand before the commit) and ONE POST; a second POST for the draw is the defect.
- The draw is the hand workspace's own (embedded reveal); a standalone band over the workspace is the defect.
- The table's shelf face is a BOX fact; one instance per card; pages are transforms; the category view never titles itself.
