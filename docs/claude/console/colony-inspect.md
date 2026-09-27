# THE COLONY DOSSIER — X = «Осмотреть» в воркспейсе колоний (2026-09-27)

`ConsoleColonyInspect.vue` + `ConsoleColonyTrackInstrument.vue` +
`ConsolePlanetDisc.vue` + `src/client/colonies/colonyLore.ts` + the
`.con-colinspect` / `.con-planet` blocks in `console.less` / `console_tv.less`.
This is the FOUNDATION for the Turmoil Redux colonies and the community
colonies: they join by adding a `lore` line to their own metadata and by
rendering the same instrument — never by a second dossier.

---

## 1 · What was wrong

- **X was A without the form.** The colony workspace's X called
  `enterFocus('inspect')`, which mounted the very same `ConsoleColonyFocusStage`
  the A press mounts, in its `inspect` mode: the trade scene with the
  configuration cut out, a red «✕ не ваш ход» verdict under the planet and a
  short summary rail. A read is not a truncated action.
- **The real dossier had one door.** `ConsoleColonyInspect.vue` — the full
  7-position track, both bonuses, owners, fleet, availability, payment paths,
  where a card resource lands — opened only from the JOURNAL (`X` on a colony
  row), as a `con-task-host` band with its own kicker («◈ КОЛОНИЯ»). Two
  inspections of one colony, two compositions, two places to drift.
- **The planet art had outgrown its frames.** The 1024² alpha discs
  (`scripts/import-planet-art.mjs`) were still rendered by rules tuned for the
  old cropped 150 px crops: a hard white inset ring on every medallion, no
  key light on the tile, per-surface copies of the same disc CSS in four
  places (`.con-coltile__planet`, `.con-colfocus__planet`,
  `.con-colinspect__planet`, `.con-cledger__planet`).
- **No lore anywhere.** The physical tiles print a flavour line under the
  name («Our own moon is the natural gate…»); the console had no place for it
  and no data for it.

**Iteration 2 (2026-09-27, the owner's review of the 4K screenshots):**

- **The rules panel scrolled at 4K while the lower-left quarter of the
  surface was EMPTY.** Seven groups (build + seats, trade + «СЕЙЧАС», bonus +
  owners, fleet, availability + payment rows, targets, the track note) stood
  in one column; the payment rows were cut off under a 297 px overflow, and
  the lore column had nothing under the archive entry.
- **The panel restated the instrument.** A seats row beside the berths, a
  «СЕЙЧАС +4» line beside the highlighted cell, the fleet group beside the
  orbit and the status line — three places for one fact each.
- **Rules and planning were one bag.** «ДОСТУПНОСТЬ» (a verdict about THIS
  player's turn and purse) and «КУДА ПОПАДУТ РЕСУРСЫ» (the shared preview)
  stood under «§ ПРАВИЛА» as though they were printed on the tile.
- **A was gated.** The bar's «Торговать» was disabled whenever the server did
  not offer the trade — but the dossier does not validate the act; it reads.
  The stage is where the refusal belongs, with its reason.
- **The right stick did nothing.** `handleIntent` handled only `nav` and
  `press`; the stick's `scroll` intents fell through.

## 2 · The decisions

### 2.1 ONE dossier, TWO hosts
`ConsoleColonyInspect` is host-agnostic (embed rule 1: one `embedded` prop
strips the shell — frame plate, `ConsoleWsHead`, `con-ws` marker,
`data-motion-surface`). It stands in two places:

| door | host | crumb | B | A |
| --- | --- | --- | --- | --- |
| **X in the colony workspace** (standalone section AND every embedded step — a SelectColony pick inside the start / hand / card-actions / std-projects flows) | `ConsoleColoniesSection`'s stagewrap, the SAME region the focus stage opens in; `embedded` | the host's: `КОЛОНИИ › ЛУНА › ОСМОТР` (`setColonyFocusStage('Inspection')`) | fold back to the grid (`closeColonyFocus`) | **enter the action** — the trade / build / pick stage for THIS colony, with the planet, the track and the berths physically carried over (§4) |
| **X on a journal colony row** | the shell, over the journal drawer; standalone band (`.con-ws-stage-band()` + plate + `ConsoleWsHead`) | `ЖУРНАЛ › ЛУНА › ОСМОТР` | close (back to the journal) | — (history is read-only; the bar offers B only) |

The workspace door is what the brief asked for; the journal door keeps its
read-only semantics (`readonly`: no verdict, no target planning — history,
not planning) but gains the whole new composition for free.

### 2.2 The composition — LORE + THE ACT · PLANET · RULES
The fullscreen card viewer's three-zone grammar, transposed to a colony. The
dossier has three jobs — the LORE, the RULES and the BIG ART — and, since the
player is one press from acting, a fourth reading: WHAT THE ACT WOULD GIVE
AND COST. Four zones, and the whole budget is «fits at 4K and 1080 with no
scroll»:

```
                            ┌──────────────────┐
 ✦ ЗАПИСЬ ИЗ АРХИВА ──◇     │                  │      § ПРАВИЛА
   ❝                        │     PLANET       │   ┌────────────────────────┐
   Наш собственный          │   min(22rem,     │   │ СТРОИТЕЛЬСТВО  [glyph]  │
   спутник — естественные   │    50cqh)        │   │  Повысьте доход на 2    │
   ворота между богатствами │                  │   │                         │
   Земли и остальной        └──────────────────┘   │ ТОРГОВЫЙ ДОХОД [glyph]  │
   Солнечной системой         ● АКТИВНА · флот      │  Получите N M€          │
                        ❞                           │                         │
 ┌────────────────────────┐                        │ БОНУС ВЛАДЕЛЬЦА [glyph] │
 │ ТОРГОВЛЯ  ⏳ не ваш ход│   ТОРГОВЫЙ ТРЕК         │  Получите 2 M€          │
 │ ВЫ ПОЛУЧИТЕ            │  ┌─┬─┬─┬─┬─┬─┬─┐        │  ● admin ×2 → +4        │
 │  +8 [M€]               │  │1│2│4│7│…│…│…│        │  ● Bo → +2              │
 └────────────────────────┘  └─┴─┴─┴─┴─┴─┴─┘        │  маркер возвращается…   │
                             [berth][berth][berth]  └────────────────────────┘
                              + owner-bonus lane
   (the two wings — lore + act, and the rules — hang CENTRED on the column)
```

- **LEFT — the SIDE column: the archive entry with the ACT BLOCK right
  under it, the two centred as one group.** The lore is the SAME block as the fullscreen viewer
  (`CardLoreAside`, warm ivory / muted gold, upright Literata, the two drawn
  quotation marks, no panel, no border). A third resolver hands it the model:
  `src/client/colonies/colonyLore.ts` → `buildColonyLoreModel(name, translate)`
  — the same `LoreModel` a card or a Redux party builds, the same length
  ladder. The block reveals on its settle `nonce` once the dossier's own
  entrance has stopped moving (words last — the descend grammar's order).
  Right under it, the **ACT BLOCK «ТОРГОВЛЯ»** (`.con-colinspect__act`, the
  rules panel's material — one family of panels on the surface — with the
  act's name in the pre-commit cyan): what A leads to, as a READING. Its
  parts, top to bottom: the act's NAME beside the server's VERDICT stated as
  information in the `AvailabilityBlocker` register («● Доступна торговля» /
  «⏳ Сейчас не ваш ход» / «✕ Нет свободного флота») — it gates nothing;
  «ВЫ ПОЛУЧИТЕ» — the totals from the ONE reward derivation every colony
  surface shares (`tradeOutcome` → `colonyRewardPackage`: the track's
  income at the level the act reads PLUS the viewer's own settlements'
  bonuses, merged per type and destination — «+8 M€» for Luna at level 3
  with two own cubes, never «+4» and «+2 ×2» in two places), with the card
  targets under a card destination and the honest «ресурс пропадёт» when
  there is none. No payment is dialed here, so no `current → resulting` is
  claimed on a GAIN — the stage owns that once a path is chosen. **The
  payment paths are deliberately NOT listed** (iteration 3): they are the
  trade stage's own configuration, and a card can add paths without limit —
  a list that grows crowds the archive entry above it. A BUILD names the
  block «СТРОИТЕЛЬСТВО» and reads the next free berth's grant (in the
  production frame when it is production); a pick names it with the pick's
  own verb. The journal door keeps only «НА ТЕКУЩЕМ УРОВНЕ» + the totals
  (history plans nothing).
  **The lore and the act block are ONE GROUP, centred on the column** — the
  left wing; the rules panel is the right wing, centred the same way. Four
  blocks pinned to four corners read as four things; two wings level with
  the hero read as one composition.
- **CENTRE — the colony as a physical object.** The planet disc at
  `min(22rem, 50cqh)` (the hero column is a size container, so the disc is
  sized against the room it actually has: 852 device px at 4K, 435 at
  1080p, smaller on a short embedded host — never a crop, never a scroll),
  the state chip + the fleet line under it, and the TRADE-TRACK INSTRUMENT
  pinned to the column's foot: the 7-cell track with the marker rail, the
  guard bars, the return stop, the three berths with their latches and the
  owner-bonus lane — the exact object the trade stage draws, because it is
  the same component (§2.3).
- **RIGHT — the rules, and ONLY the rules.** The cold-cyan reading panel of
  the card viewer (`.con-zoom-rules` grammar: «§ ПРАВИЛА» head, one GROUP
  per rule with a colour-coded kind chip, sentences in the reading face at
  the STANDARD reading token `--con-t-read`, glyphs at 1.3×). Three
  groups — the three lines printed on the physical tile: СТРОИТЕЛЬСТВО ·
  ТОРГОВЫЙ ДОХОД · БОНУС ВЛАДЕЛЬЦА (the printed rule + WHO receives what,
  the viewer's own row marked — the instrument shows the mechanism, the
  panel the recipients: two panels share a subject only when they answer
  different questions) · the track rule as a muted closing note. NOTHING the
  instrument or the status line already says is restated: no seats row (the
  berths), no «СЕЙЧАС» (the lit cell), no fleet group (the orbit + the fleet
  line under the planet), no availability and no targets (the act block).
  That is what makes the panel FIT on both TV profiles; the scroll area under
  it is a safety net for a starved host (the Deck), reached by ↑/↓ AND the
  right stick (`scroll` intents → `scrollByPx`), never the design.

**Hierarchy is typographic.** The name lives in the crumb (the line's
brightest voice) and nowhere in the body; «ЗАПИСЬ ИЗ АРХИВА» and «§ ПРАВИЛА»
are section kickers at the service floor; the lore is warm, the rules are
cold, the planet is the only saturated object.

### 2.3 ONE instrument — `ConsoleColonyTrackInstrument.vue`
The trade stage's `.con-colfocus__trackzone` markup (zone head · `__xtrack`
· `__berths` · `__ownerbonus`) is EXTRACTED verbatim into a component the
stage and the dossier both render. Class names, data anchors
(`data-colony-focus-track`, `data-colony-focus-slots`,
`data-colony-track-cell`, `data-colony-build-slot/-seat`,
`data-colony-bonus-source/-cell`, `data-colony-card-cell`) and the
`data-unfold-*` motion marks are unchanged, so the trade layers' anchor
ladders, the descend hooks, `console_tv.less` and every e2e probe read the
same DOM. The stage passes its transient beats (`latchCell`, `settledCell`,
`buildPreview`, `gliding`); the dossier passes none and reads as the resting
object. A future colony surface (the Redux colonies screen, the community
tiles) renders THIS component or it is not the same object.

### 2.4 ONE planet — `ConsolePlanetDisc.vue` (`.con-planet`)
The disc grammar the art was regenerated for, stated once: `background-size:
cover` + `center` inside `border-radius: 50%`, and the CSS paints the light
— a key sheen top-left (`__light`), a thin cyan atmosphere rim (`__rim`),
an inset terminator bottom-right, a depth shadow. Sizes are the host's
(`--con-planet-size`); `lit` opts into the sheen + rim (the tile keeps a
quieter version; the hero and the dossier the full one). The tile, the
focus-stage hero and the dossier hero all render it; the parliament ledger's
1.15 rem medallion stays its own rule (a different context, a different
density). The legacy per-planet `background-size` / `background-position` in
`colonies.less` — tuned for the 150 px crops, effective only on the debug
`/cards` page — are deleted for the eleven base planets.

### 2.5 LORE lives IN THE COLONY'S METADATA
`ColonyMetadata.lore?: string`, set in each base colony class next to its
`trade.description` (`src/server/colonies/Luna.ts` …). It rides
`make:cards` → `src/genfiles/colonies.json` → `getColony(name).lore` — the
existing pipeline, no new plumbing. Co-location is the invariant: when
upstream changes a colony, the lore is in the same diff. The English
sentence IS the i18n key; the Russian lives in `src/locales/ru/lore_texts.json`
beside the cards' and the parties' entries. The text is the PHYSICAL TILE's
printed flavour line, transcribed from the scans (`Mars Arts/for_lore/*.png`)
— one sentence per colony, terminal punctuation added where the print has
none. A colony without lore (the community set today) renders the honest
fallback («Архивная запись отсутствует.»); the guard
`tests/client/components/colonies/colonyLore.spec.ts` enumerates the base
eleven and fails the moment one loses its sentence or its translation.

## 3 · The verbs (the command bar is the ONLY hint surface)

| where | A | B | X | ↑/↓ |
| --- | --- | --- | --- | --- |
| grid (browse) | act (trade / build / pick — descends into the stage) | close | **inspect** → the dossier | d-pad over the tiles |
| dossier (workspace door) | **go on** — «К торговле» / «К строительству» / «К выбору» (`To trade` / `To building` / `To selection`), ALWAYS enabled: the dossier does not validate the act, the STAGE does — its verdict stands in the act block as information, and the stage carries the refusal with its reason | back to the grid | — | ↑/↓ and the right stick scroll the rules panel (a safety net; the TV never needs it) |
| dossier (journal door) | — | close | — | ↑/↓ and the right stick scroll the rules panel |

A dossier is READ-ONLY by construction: it submits nothing, it captures
nothing, and A only re-routes into the stage the grid's A would have opened.

## 4 · Motion — the same object, three times

- **Grid → dossier (X)**: the workspace descend phrase the focus stage
  speaks (`colonyFocusEnterHook`, unchanged): the pressed tile answers,
  its neighbours yield, the tile's content releases in place, the surface
  UNFOLDS from the tile's rect, and the three carried identities FLIP from
  their compact twins — the medallion into the big disc (`power3.inOut`,
  the sphere's light drifting against the body, the rim coming up with the
  size), the track strip into the instrument's track, the build row into the
  berths. Structure (`[data-unfold-item]`: the rules panel, the instrument)
  surfaces from inside; the fine print (`[data-unfold-late]`: the lore block,
  the chips, the sentences) last; the edge forms last of all. The dossier
  publishes exactly the marks the hook reads — no dossier-specific director.
- **Dossier → grid (B)**: the reverse phrase (`colonyFocusLeaveHook`): fine
  print lets go, the panel folds into the tile it opened from, the planet
  FLIPs home into the medallion, the grid breathes back.
- **Dossier → stage (A)**: a HANDOFF, not a fold-and-reopen.
  `enterFocusFromInspect(intent)` arms the descend registers from the
  DOSSIER's live rects (its surface, its planet, its track, its berths) and
  arms `armColonyFocusHandoff()`; the dossier leaves with a short quiet
  recession (no fold, no grid return — the same quick-exit shape a
  resolution hand-off uses) while the stage enters with its ordinary hook:
  the disc shrinks and slides into the hero seat, the instrument re-seats
  into the working area, the configuration surfaces from inside. The fold
  HOME stays the tile's rect (the hand-off keeps `unfoldedFrom`), so B from
  the stage still folds into the tile. One planet on screen at every frame.

## 5 · Sizes (rem — the TV profile scales the rem base)

| element | base | notes |
| --- | --- | --- |
| dossier planet | `min(22rem, 50cqh)` | 852 dp at 4K — the art's 1024² is ~1:1 there, the resolution ceiling the import script documents; the hero column is `container-type: size`, and the surface's ONE row is `minmax(0, 1fr)` (an `auto` row sizes by the rules panel's content and `cqh` then reads 28rem instead of the room) |
| stage hero planet | 10.9 / 13.6 (TV) | unchanged; `.con-planet--lit` |
| tile medallion | 3.1 (was 2.7) | the head row grows with it; the mid band gives the .4rem back |
| columns | `minmax(16rem, 1fr) · minmax(24rem, 32rem) · minmax(18rem, 1.15fr)` | side (lore + the act block) · centre · rules; the side carries payment rows now, so it is no longer the narrowest column. Below 60 rem of host width (`@container colinspect-host` — NAMED on the frame, and a SIZE container so `cqh` resolves against the host's room; an unnamed query resolves against the nearest container, which for the planet is the hero column itself) the SIDE moves UNDER THE RULES (`max-height: 62cqh`, the lore yields first, the payment rows last) and the hero keeps the whole height (the instrument alone needs ~13rem; a row under the hero left an 80 px planet on the Deck) |
| rules type | `--con-t-read` (was `-sm`) | the rules are one of the dossier's three jobs; the panel affords it because it carries only the three printed rules |
| act block | `.con-colinspect__act` under the lore, the two centred as one group (`justify-content: center` on the side column) | the amount (`__gain-amount`, 1.35rem / `--con-t-section` on TV) is the block's loudest voice; the coin is 1.25rem at zoom 1 so the number leads |
| rules panel | hugs its content, `align-self: center` | the right wing, level with the left one; a stretched panel read half-empty, a top-pinned one left the column's foot empty |
| tile glyph in a rule | `.benefit-glyph__tile` inside `__glyph`: 26×30 px, matching `background-size`, zero margin | the base `.tile` is 40×46 with fixed background-size + margins — inside the 32 px glyph box the ocean lost its left half (Europa, 4K) |

## 6 · Where things live

| concern | file |
| --- | --- |
| the dossier | `src/client/components/console/ConsoleColonyInspect.vue` |
| the track instrument | `src/client/components/console/ConsoleColonyTrackInstrument.vue` |
| the planet disc | `src/client/components/console/ConsolePlanetDisc.vue` |
| lore resolver | `src/client/colonies/colonyLore.ts` |
| lore data | `src/server/colonies/<Name>.ts` (`lore`), `src/common/colonies/ColonyMetadata.ts`, `src/locales/ru/lore_texts.json` |
| workspace wiring | `ConsoleColoniesSection.vue` (mount, handoff), `ConsoleShell.vue` (bar verbs, the journal door), `consoleColoniesModel.ts` (`switchColonyFocusIntent`) |
| motion | `consoleColonyFocusMotion.ts` (`armColonyFocusHandoff`, the hand-off branches) |
| styles | `console.less` (`.con-planet`, `.con-colinspect`), `console_tv.less` |
| guards | `tests/client/components/colonies/colonyLore.spec.ts`, `tests/client/components/console/consoleColoniesModel.spec.ts`, `tests/client/components/console/ConsoleColonyInspect.spec.ts`, `tests/e2e/console-colony-inspect-probe.spec.ts` |

## 7 · Verified on screen (2026-09-27, `tests/e2e/console-colony-inspect-probe.spec.ts`)

Iteration 1 (the first composition, superseded):

| profile | surface | hero column | planet | rules overflow | notes |
| --- | --- | --- | --- | --- | --- |
| TV 4K (3840×2160) | 1772 px | 1704 px | **852 px** | 297 px (scrolled on ↓) | bar «A Торговать · B Назад» — A disabled when not offered |
| TV 1080 (1920×1080) | 904 | 870 | 435 | 0 | — |
| Deck (1280×800) | 646 | 612 | 220 | 348 | the archive entry under the rules |

Iteration 2 (the shipped composition — lore + act block · planet · rules only):

| profile | surface | hero column | planet | rules panel | rules overflow | archive seat | act block | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TV 4K (3840×2160) | 1772 px | 1704 px | **852 px** | 1104 px (hugs) | **0** | side | «ТОРГОВЛЯ · ● Доступна торговля · ВЫ ПОЛУЧИТЕ +2 M€ · ОПЛАТА ×3 (500 → 497 / 497 / 491)», top at 1162 px, below the entry (1097) | crumb «КОЛОНИИ › ЛУНА › ОСМОТР»; bar «A К торговле · B Назад»; grid bar «A Выбрать · X Осмотреть · B На поле» |
| TV 1080 (1920×1080) | 904 | 870 | 435 | 447 (hugs) | **0** | side | same, top at 716 | — |
| Deck (1280×800) | 646 | 612 | 220 | 332 (stretched) | 333 (scrolls; the archive entry is the scroll's last block) | inline | same, top at 462 | the narrow host: the rules take the row, the act block stands under them whole |

- **One planet per frame** through the whole entrance (`1111…`) and through the
  hand-off (`1111…` — the dossier's disc goes dark the instant the stage's
  hero starts its FLIP out of it). B from the stage folds into the tile; the
  tile's medallion is lit again (opacity .97).
- **Three defects the screen found that the code did not:** ① the crumb had
  no «ОСМОТР» tail — the dossier never published its stage (fixed: `mounted`
  → `setColonyFocusStage('Inspection')` when hosted); ② the planet was
  560 px on a 4K band: the grid's `auto` row sized itself by the rules
  panel's content and `cqh` read that (fixed: `minmax(0, 1fr)`); ③ the
  planet was 480 px after that: the unnamed `@container (max-width: 60rem)`
  resolved, for the planet, against the HERO column (a size container ≤34rem)
  and applied the narrow size on every profile (fixed: the query is named on
  the frame). Plus: the terminator drawn as a dark radial ON the dark side
  read as a blot on an 850 px disc (now a gradient growing away from the
  key light), and the EMPTY orbital berth's dark plate did the same (now a
  whisper of a ring; the plate returns with a docked fleet — on the stage too).
- A pre-existing translation error surfaced by the rules panel:
  `Gain n M€` (Luna's trade income) read «Повысьте производство M€ на X» —
  the key is used by that one description only and now reads «Получите X M€».
- **Iteration 2 — what the screen found that the code did not:** ① a rules
  panel STRETCHED over the column read as a half-empty box on both TV
  profiles once it carried only the three rules (→ it hugs its content,
  `align-self: start; max-height: 100%`, the narrow host stretches it back);
  ② the act block's coin was drawn at ~70 px beside a 52 px «+2» (→ the glyph
  at 1.25rem, zoom 1 — the number leads); ③ on the Deck the capped side
  column clipped the archive entry to ONE line («Наша собственная Луна —
  есте-») — a cut archive entry is worse than one a scroll reaches (→ the
  entry's second seat inside the rules scroll, the container query picks
  one); ④ the probe assumed a REFUSED payment path exists — test mode fills
  the purse, so all three stand (→ logged, the row shape is the unit spec's
  claim); ⑤ the rAF planet sampler starved to two frames on a loaded runner
  and judged «one planet at rest» on a mid-crossfade frame (→ a
  `setInterval` sampler with a liveness floor).
- **Iteration 3 (the owner's review of the Europa 4K screenshot):** ① the
  ocean glyph in «Разместите 1 океан» was cut in half — the base `.tile`
  (40×46, fixed background-size, margins) inside the 32 px glyph box (→ the
  berths' own tile fix, explicit 26×30 + matching background-size); ② the
  payment table was REDUNDANT here — the trade stage is where a path is
  chosen, and a card can add paths until the list crowds the lore (→ gone
  from the dossier; the act block is name · verdict · «ВЫ ПОЛУЧИТЕ»); ③ a
  top-pinned rules panel left the column's foot empty and read inorganic
  (→ both wings centred on the column: lore + act as one group on the left,
  the rules on the right; the probe asserts their centres agree within 12 %
  of the surface). Measured after: 4K — left wing centre 1144 = right wing
  centre 1144 (surface 1772), rules panel 592 → 1696, act block 1366 → 1708;
  1080 — 566 = 566; Europa's ocean glyph 68×78 px fully inside its 83 px box
  (`08-europa-ocean-4k.png`); the Deck unchanged (rules scroll 195, the
  archive entry the scroll's last block, the act block whole under it).
