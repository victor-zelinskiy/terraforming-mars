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
read-only semantics (`readonly`: no verdict, no payment, no target planning —
history, not planning) but gains the whole new composition for free.

### 2.2 The composition — LORE · PLANET · RULES
The fullscreen card viewer's three-zone grammar, transposed to a colony:

```
 ✦ ЗАПИСЬ ИЗ АРХИВА ──◇     ┌──────────────────┐      § ПРАВИЛА
   ❝                        │                  │   ┌────────────────────────┐
   Наш собственный          │     PLANET       │   │ ПОСТРОЙКА   [glyph]     │
   спутник — естественные   │   min(22rem,     │   │  Повысьте доход на 2    │
   ворота между богатствами │    50cqh)        │   │  места 1/3              │
   Земли и остальной        │                  │   │ ТОРГОВЫЙ ДОХОД [glyph]  │
   Солнечной системой       └──────────────────┘   │  Получите N M€          │
                        ❞     ● АКТИВНА · флот      │  сейчас +4 M€ · поз. 3  │
                                                    │ БОНУС ВЛАДЕЛЬЦА [glyph] │
                             ТОРГОВЫЙ ТРЕК          │  +2 M€ · admin ×2 → +4  │
                            ┌─┬─┬─┬─┬─┬─┬─┐         │ ФЛОТ                    │
                            │1│2│4│7│…│…│…│         │  здесь стоит ваш флот   │
                            └─┴─┴─┴─┴─┴─┴─┘         │ ДОСТУПНОСТЬ             │
                            [berth][berth][berth]   │  ⏳ не ваш ход          │
                             + owner-bonus lane     │  оплата: 9 M€ · 3 ⚡    │
                                                    └────────────────────────┘
```

- **LEFT — the archive entry.** The SAME block as the fullscreen viewer
  (`CardLoreAside`, warm ivory / muted gold, upright Literata, the two drawn
  quotation marks, no panel, no border). A third resolver hands it the model:
  `src/client/colonies/colonyLore.ts` → `buildColonyLoreModel(name, translate)`
  — the same `LoreModel` a card or a Redux party builds, the same length
  ladder. The block reveals on its settle `nonce` once the dossier's own
  entrance has stopped moving (words last — the descend grammar's order).
- **CENTRE — the colony as a physical object.** The planet disc at
  `min(22rem, 50cqh)` (the hero column is a size container, so the disc is
  sized against the room it actually has: 852 device px at 4K, 435 at
  1080p, smaller on a short embedded host — never a crop, never a scroll),
  the state chip + the fleet line under it, and the TRADE-TRACK INSTRUMENT
  pinned to the column's foot: the 7-cell track with the marker rail, the
  guard bars, the return stop, the three berths with their latches and the
  owner-bonus lane — the exact object the trade stage draws, because it is
  the same component (§2.3).
- **RIGHT — the rules.** The cold-cyan reading panel of the card viewer
  (`.con-zoom-rules` grammar: «§ ПРАВИЛА» head, one GROUP per rule with a
  colour-coded kind chip, sentences in the reading face at the reading
  tokens). Groups, in the order a player asks: ПОСТРОЙКА (the grant + the
  seats) · ТОРГОВЫЙ ДОХОД (the printed rule + what a trade reads RIGHT NOW,
  with the standing offset) · БОНУС ВЛАДЕЛЬЦА (the printed rule + WHO
  receives what — the instrument shows the mechanism, the panel the
  recipients: two panels share a subject only when they answer different
  questions) · ФЛОТ · ДОСТУПНОСТЬ (interactive door only: the server's
  verdict with its `AvailabilityBlocker` tone + every payment path,
  affordable and not) · КУДА ПОПАДУТ РЕСУРСЫ (interactive door only, when a
  card resource is in play) · the track rule as a muted closing note. The
  panel scrolls INSIDE its column (d-pad ↑/↓ → `scrollByPx`); nothing else
  on the dossier ever scrolls.

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
| dossier (workspace door) | **enter the action**: labelled with the act verb («Торговать» / «Построить» / the pick's label), `enabled` = the server offers it — a blocked colony keeps the verb DISABLED and the reason stands in the ДОСТУПНОСТЬ group (never hidden, never a notice) | back to the grid | — | scroll the rules panel |
| dossier (journal door) | — | close | — | scroll the rules panel |

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
| columns | `minmax(13rem, 1fr) · minmax(24rem, 34rem) · minmax(18rem, 1.15fr)` | lore · centre · rules; below 60 rem of host width (`@container colinspect-host` — NAMED on the frame: an unnamed query resolves against the nearest container, which for the planet is the hero column itself) the lore moves UNDER THE RULES and the hero keeps the whole height (the instrument alone needs ~13rem; a lore row under the hero left an 80 px planet on the Deck) |

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

| profile | surface | hero column | planet | rules overflow | notes |
| --- | --- | --- | --- | --- | --- |
| TV 4K (3840×2160) | 1772 px | 1704 px | **852 px** | 297 px (scrolls on ↓) | crumb «КОЛОНИИ › ЛУНА › ОСМОТР»; bar «A Торговать · B Назад»; grid bar «A Выбрать · X Осмотреть · B На поле» |
| TV 1080 (1920×1080) | 904 | 870 | 435 | 0 | — |
| Deck (1280×800) | 646 | 612 | 220 | 348 | the narrow host: the archive entry under the rules, the hero keeps the whole height |

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
