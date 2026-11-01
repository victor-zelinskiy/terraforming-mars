# THE CARD ALBUM CHASSIS — one album for every «choose N cards from a hand» (P87 · DR, 2026-11-01)

The owner (2026-11-01), about the campaign's «Наследие проектов»: «сейчас он сделан как будто на отдельном движке и имеет
слабую подачу, выглядит плохо на большом количестве карт, и карты ставить назад неудобно (надо нажимать на пустую ячейку).
Его визуал сильно отличается от «карт в руке», хотя задачу решает ту же — надо перевести на понятный для пользователя
премиум-язык». The picker solved the hand's task in a language of its own: the ws-stage engine of the target scene (made
for 2–8 cards — 15 of them shrank into one frame), two keep-slots, empty sockets, its own cursor frame and a halo.

## The chassis — three pieces, one source each

| Piece | Source | Consumers |
| --- | --- | --- |
| **The planner** | `components/console/consoleHandAlbum.ts` — `albumSpecFor(profile, layout)`, `planHandAlbum` (the box + the profile grid, NEVER the card count), `planAlbumPage` (the showcase composition 1–5 → one row, 6–10 balanced), `stepHandAlbum` (the d-pad: across the page edge IS the turn), `pageJumpIndex` (LB / RB) | `ConsoleHandSection` (the hand), `foundation/ConsoleCardAlbum` |
| **The geometry** | `styles/console_card_album.less` — `.con-album-viewport()` · `.con-album-strip()` (`--live` / `--turning`) · `.con-album-page()` · `.con-album-row()` · `.con-album-slot()` (zoom, `--con-hand-fx`, the ONE cursor `.con-cursor()`, the margin kill, `--selected`, the pick band's counter-zoom) · `.con-album-slot-picked(@tone)` (a KANT, never a glow) | `.con-hand__*` (the hand applies the mixins — its CSS is declaration-for-declaration what it was) and `.con-album__*` |
| **The spine** | `foundation/ConsoleAlbumSpine.vue` — the dock's page instrument («LB ‹ 2 / 4 › RB», the progress hairline, the fired side chip), extracted; the class tree stays `con-handdock__pager*` (one LESS, one look); `variant: 'dock' \| 'foot'` only seats it | `ConsoleHandDock` (its plate), the carryover stage's foot |

`foundation/ConsoleCardAlbum.vue` is the HOST-AGNOSTIC album: `entries` (name · card · `picked` · `band` · `disabled` +
`reason`), `index` (the focus — the page is DERIVED from it, no second page state), `heldNames` (a flight owns the face).
It emits `pick` (a click) and `position` (what the spine reads); the host steps the focus with `step(from, dir)` /
`jumpPage(from, dir)` (an explicit origin — the prop is stale until the next render) and flies with `slotEl` / `faceEl` /
`activePageNames`.

## A choice is a TOGGLE IN PLACE

A on a card stands it in its OWN slot with the kant (`--picked`, mint) and its band; A on it again lets it go — the same
key on the same object. Nothing leaves the album before the host commits; an empty socket does not exist as a concept. A
full set of seats is a NAMED refusal on the status line — never a dimmed hand (a dim says «this card is wrong»).

## The first consumer — «Наследие проектов» (`campaign/ConsoleCarryoverPicker.vue`)

- **Head**: `ConsoleWsHead` — the host's root («Итоги партии» in the endgame's scene, «Кампания» on the map) › «Миссия K»
  (where the cards travel) › НАСЛЕДИЕ ПРОЕКТОВ (cyan → amber once confirmed).
- **Question line** (the hand's `.con-hand__question`): «Оставьте до N карт проектов — они бесплатно перейдут в миссию K»
  — N and K are PARAMETERS; the summary (the sale bar's shape, mint): «Оставляю 1 / 2 · бесплатно», «Ничего не выбрано»
  at zero.
- **Seat manifest**: one plaque per seat of the limit — the number, and the kept card's NAME (a label — the face stands
  once, in the album); a returned card frees its seat and the next moves up (the seat IS the pick order, and the POST
  carries the cards in that order).
- **Foot**: the spine + ONE status line (the armed zero-carry warning · a refusal · «выбор подтверждён» · an error) at
  the workspace foot height.
- **Verbs** (the host's ONE bar): d-pad Выбрать · A Оставить / Вернуть в руку (by focus — the picker's `bar` event) ·
  X Осмотреть (the one zoom pipeline, the card lifts out of its slot; A there is the same toggle) · RT the confirm (a
  zero-carry over a real hand is ARMED first; B disarms) · B Закрыть. LB / RB turn the page — the SPINE says so, the bar
  does not (one action, one hint).
- **Entry**: the host deals the active page FROM the viewer's seat row (`dealIn` — clones, each slot held until its
  touchdown); a revision (Y) opens with the kept cards already in their kant and deals nothing.
- **Confirm**: ARM (the kept faces measured) → POST → DETECT (only a confirmed answer flies): the kept cards fly into the
  next mission's card (`.cmap__card--current`), which answers each touch (`cmap__card--receiving`, a one-shot), the seat
  row's «переносит: N» ticks per touchdown (`carryHeldCount`); the stage folds at once (the destination must be in sight).

## The limit is a variable of the SEAT

`server/campaign/carryoverLimit.ts`: `carryoverLimitFor(campaign, seat, modifiers)` is the ONE writer (today the default
`CARRYOVER_MAX_CARDS` — the modifier point is named there: a title, a `MissionModifier`, a corporation perk);
`CarryoverSeatState.limit` is written when the window opens; `carryoverLimitOf` reads it (an older save without one reads
the default). Public: `CarryoverSeatPublic.limit`, `CampaignCarryoverModel.yourLimit` → the client's ONE reader
`CampaignMapVm.yourCarryLimit`. The client never knows the default (guard). Dev: `devCommit(…, {carryoverLimits})`.

## Guards

- `tests/console/albumChassisParity.spec.ts` — the compiled stylesheet: every geometry piece of `.con-album__*` declares
  the hand's `.con-hand__*` byte for byte; both components plan through `consoleHandAlbum.ts`; the picker knows no second
  engine and no keep-slots; no `CARRYOVER_MAX_CARDS` under `src/client`.
- `tests/client/components/console/consoleCarryoverPicker.spec.ts` — the toggle in place, the named refusal, the seat
  limit, LB / RB, the armed confirm, the empty hand, the bar facts.
- `tests/campaign/carryoverPicker.spec.ts` — the pure readings; `tests/campaign/CampaignManager.spec.ts` § the carry
  limit is a VARIABLE OF THE SEAT.
- e2e `console-carryover-album.spec.ts` (tv4k) — A (14 cards, limit 2: the deal, pages, keep / refuse / return, X, RT →
  the flight, Y), B (limit 3), D (empty hand); `console-campaign.spec.ts` § interlude ONE FLOW.

## Tails

- **The hand itself does not mount `ConsoleCardAlbum` yet** — its bodies, reveal episodes and pick bridges are its own
  physics; it shares the planner, the mixins and the spine. Migrating its markup onto the component is a separate task.
- **The modifiers of the limit** — the point is named in `carryoverLimitFor`, nothing writes another number yet.
- The embedded host (the endgame's map scene) mounts the SAME component; its live walk is `console-campaign-endgame`'s.
