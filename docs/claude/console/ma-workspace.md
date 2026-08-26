# The MILESTONES/AWARDS workspace — one flow, one emblem

**Status: SHIPPED 2026-08-12; browse-grammar iteration (P33) 2026-08-26.**
The console «Награды»/«Достижения» screens are a full North-Star workspace:
`Overview → Hero Detail → Commit → Ceremony inside the workspace → Settle →
Close`. The old `ConsoleMaConfirm` modal is GONE from the console-native flow
(the desktop `MaConfirmContent` path is untouched); the per-item CTA is gone
from the overview.

## The BROWSE GRAMMAR (iteration P33) — availability ≠ focus, two identities

Guard: `tests/e2e/console-ma-states.spec.ts` (the staged state matrix at 4K —
structural asserts + screenshots); unit: the race-tier matrix in
`consoleMaModel.spec.ts`.

**TWO CHANNELS, NEVER ONE.** Focus answers «where is the controller» and owns
the tile's RING (`box-shadow` — cyan, semantic-blind, identical on every
tile). Availability answers «what can I take right now» and owns the tile's
GROUND (mint wash), the EMBLEM's activation optics and the metric's word —
so the two states coexist on one tile by construction. The old compound rule
(`--focused--go` repainting the ring mint) made the two strongest signals
fight for one border; whichever lost simply vanished. ⚠ A KIND SCOPE that
re-states the card's base `box-shadow` (the awards' warm hairline) raises
specificity past the bare `--focused` rule — the focus ring and hover must be
RE-ASSERTED inside that scope, or FHD/Deck lose the ring while the
profile-scoped TV rule keeps it (shipped once, caught by screenshot).

**The availability language is the STRATEGY RAIL's, verbatim** (one grammar in
both places): GREEN = the requirement is met (drawn ✓ stroke, value, meter,
mint metric rim — «yours, waiting» when it is not your turn), GOLD-WHITE =
the action is offered THIS frame (`.con-ma__actring` rim + bottom `__spark`
crystal on the emblem + «ДОСТУПНО» in the metric's fixed-height foot + the
`--now` metric rim), PLAYER COLOUR = owner/sponsor only. The workspace rim is
STATIC (the peripheral HUD keeps the breathing — a decision surface the
player is already reading does not blink). The one-shot availability REVEAL
(`--arriving`, the rail's own `strat-activate-*` keyframes) plays only on a
LIVE rising edge (seed-then-diff in the component; mount/category switch
seed silently). Milestone-only, by the P29 decision: a fundable award is a
normal economy action — its accent is the DOOR's (the header tray's next
slot arms gold, `__slot--next`), never a per-row glow.

**TWO SIBLING IDENTITIES.** Milestones = PROGRESS AND THRESHOLD: the family's
cool cyan/mint axis, progress instruments (meter → drawn ✓ → «ДОСТУПНО»),
the flag emblem tinted mint. Awards = COMPETITION AND SPONSORSHIP: a warm
podium atmosphere (gold-shifted card grounds/hairlines/pedestal light, the
warm backdrop radial), and the status column is a RACE CASSETTE — the trophy
rail's two-level grammar at tile scale: crown-capped leader cluster (tier I,
gold tread) over the chaser tier (silver tread ONLY for a rules-paid 2nd:
single leader and >2 players — `secondRanked`, mirroring `giveAwards`), the
viewer's enamel cube ringed white, and ONE word underneath for where YOU
stand («Вы лидируете» / «Делите лидерство» / «Вы: N» / «Нет гонки» — colour
alone never carries it). The funded award mounts the SPONSOR's cube in a
gold socket at the emblem's ribbon corner (`__gem`) and keeps the race live
(funder ≠ scorer). A taken milestone recomposes its column to the quiet
OWNER SEAL (enamel cube + neutral engraved ✓ on a gold hairline) — words
stay in the body's owner line. Race tiers are derived ONCE in
`consoleMaModel` (`maScoreGroups` + `awardLeaders`) and shared with
`consoleMaHudModel` — never a second grouping.

**CONTEXTUAL VERBS.** The overview's A names the INTENT when the focused
item's action is genuinely offered — «Заявить» (`Claim milestone`) /
«Спонсировать» (`Fund`), highlighted — and the READING verb «Осмотреть»
(`Inspect`) on a blocked/taken item; the universal «Выбрать» promised the
same thing for a dead race and a live claim. The detail stage's commit uses
the same intent verbs. A still opens EVERY item (the press only descends;
the ARM keeps a double-tap from buying).

**Mouse parity**: a click focuses a tile, a second click on the focused tile
descends (`@pick` → the shell's `onMaPick`); hover is a soft hairline that
never out-specifies the focus ring.

**LB/RB is an ARRIVE beat, not a remount**: the browse content slides in from
the pressed bumper's side (one-shot class + timer, transform/opacity only,
240 ms) while the frame, head and status rail stand still; the reveal ledger
reseeds per category.

Guard: `tests/e2e/console-ma-workspace.spec.ts` (the full flow on a real
human+MarsBot game). Unit: `tests/client/components/console/consoleMaFocus.spec.ts`,
the embed-claim cases in `tests/client/components/ma/maCeremonyState.spec.ts`.

## The pieces

| Concern | File |
| --- | --- |
| Flow state (phases, draft, commit outcome, commit ARM — PURE) | `src/client/console/consoleMaFocus.ts` |
| The STATUS RAIL model (projection / blocker — PURE) | `src/client/components/console/consoleMaRail.ts` |
| The status rail renderer (over the shared `ActionEffectChip`) | `ConsoleMaRail.vue` |
| Descend/fold + ceremony choreography | `src/client/console/consoleMaFocusMotion.ts` |
| The detail stage (renderer over 3 view-models) | `ConsoleMaFocusStage.vue` |
| The screen (browse layer + stage host + `ConsoleWsHead`) | `ConsoleMaScreen.vue` |
| Input / commands / submit / watchers / restore | `ConsoleShell.vue` (the `maFocus*` family) |
| The ceremony queue + the EMBED CLAIM | `src/client/components/ma/maCeremonyState.ts` |

## PRICE in the header · PROJECTION in the rail (iteration 2)

One action must read as ONE statement, so the two halves live in two places
and never in both:

- **The header states the SYSTEM**: the slot tray, the tally, and a compact
  PRICE chip («ЦЕНА 8 M€» / «ЦЕНА БЕСПЛАТНО»). No wallet, no `−8 → 454`. The
  price is the ENGINE's own — `PlayerViewModel.maCosts` = `player.milestoneCost()`
  / `player.awardFundingCost()` — so Van Allen and Nirgal (free), Staged
  Protests (+8) and the 8 → 14 → 20 award ladder are already in it. **Never
  re-derive it from `AWARD_COSTS` in the UI** (that is a degrade default only,
  for a model that predates the field): the workspace would go on offering a
  number the server refuses.
- **The rail states the TRANSACTION** — `M€ 462 → 454` + `0 → 1 спонсировано`,
  in the shared `ActionEffectChip`s every composer speaks. The list's context
  strip and the detail stage's bottom band are the SAME component over the
  SAME pure model (`buildMaRail`), so there is no second preview dialect and
  no «БУДЕТ ПОТРАЧЕНО» band any more.
- **A blocked item NEVER renders a success preview.** Money is the one blocker
  the shared chip states natively (`current < amount` → «6 / 8» in the
  insufficient style); every other blocker is a sentence and is the only thing
  the rail says (a milestone short of its threshold states the GAP, since its
  `blocker` is empty by design). The price chip stays — a price is information,
  a projection is a promise.

**Roles, one each** (the duplication this iteration removed): the BADGE says
which state («МОЖНО ПОЛУЧИТЬ» / «СЕЙЧАС НЕДОСТУПНО» / «ПОЛУЧЕНО») and is
bounded by the hero column — the copy stays short by contract, `max-width` +
ellipsis is the structural net (the clipped «ПОРОГ ДОСТИГНУТ — МОЖНО ВЗЯТЬ
СЕЙЧАС» is what it was built against); the PROGRESS block says how much
(`20/29` + meter); the RAIL says what happens or why not; the FOOTER says what
A does. Nothing is said twice.

**`X Осмотреть` is gone** — from the bar, the input branch, the shell state and
the component tree (`ConsoleMaInspect.vue` deleted; its pure model survives as
the detail stage's standings source). A opens EVERY item, including blocked and
already-taken ones, so a second reading surface has nothing to show.

**The commit ARM** (`COMMIT_ARM_MS`): A is the list's «open» and the stage's
«claim», so a double-tap would buy a strategic irreversible thing the player
never saw — the stage refuses its own commit until it has been readable.

## The detail stage is an EXHIBITION, and it is TOKEN-SCALED

Two columns that both occupy the stage: the ARTEFACT (the carried emblem, its
name, the state badge, and the viewer's OWN reading of it — «ВЫ 20/29» + the
meter) beside the DOSSIER (a condition plate carrying the rule and the
category's mechanic truth, then the race plate). The player's number lives with
the artefact, not as one row among the rules — that is what left the identity
column ending at a badge over a void.

**Plates, not naked lines.** Each dossier block is the console's grouped-block
material (own ground + one inset edge light + real padding). Content-sized, the
group centred: a two-player race stretched to fill 700 px is emptier than the
space it filled — inflated boxes are not composition.

**Every size is a `--mafocus-*` token on the root, and a profile retunes ONLY
the token set** (`--mafocus-hero`, `-side-w`, `-name`, `-you`, `-desc`,
`-note`, `-label`, `-plate-pad`, `-row-h`, `-rowname`, `-rowscore`, `-gap`,
`-pad`, `-cere-frame`). The TV profile's pass is a real recomposition — a
19rem artefact, couch type off `--con-t-*`, standings rows at `--con-hit-min`
— because the uniform rem scale alone reproduces a 1080 card blown up: the
stage used a quarter of a 4K panel and read as small and poor. The Deck's
block is the same tokens one size down. Never add a per-element font ladder
here.

⚠️ **THE CEREMONY SEAT IS DERIVED FROM THE ARTEFACT, never a size of its
own**: `--mafocus-cere-slot = --mafocus-hero × --mafocus-cere-gain` (the
emblem GAINS a touch of size at the coronation), and the seat is that plus
`--mafocus-cere-frame` on each side for the ring. They are the same physical
object, so a hard-coded seat beside a token-scaled hero makes the culmination
SHRINK what it celebrates — which is exactly what the first TV pass shipped
(a 19rem hero gliding into a 10.4rem slot). The e2e measures it: the emblem's
box during the ceremony may never be smaller than its static one, and its
centre must land in the seat (a fade is not a glide).

## The flow contract

- **Overview**: items are selectable WHOLES — no per-item CTA; the bar reads
  `A Выбрать · X Осмотреть · LB/RB категория · B Закрыть/Свернуть`. EVERY
  item is enterable (taken/blocked ones explain themselves on the stage).
- **Descend** (`enterFocus` on the screen): arms the pressed card's rect (the
  unfold source) + the emblem pedestal's rect (the FLIP source) and opens
  `maFocusState`. The browse layer is PARKED (selection/scroll survive); the
  card's own emblem goes `opacity: 0` the instant the hero carries it — ONE
  physical object. Crumb: `НАГРАДЫ › <ИМЯ> › СПОНСОРСТВО` (milestones:
  `ПОЛУЧЕНИЕ`); the stage word goes amber + `ЦЕРЕМОНИЯ` past the commit.
- **The stage is the confirmation context**: condition, race/standings
  (`buildMaInspect`), economy + slots (`buildMaConfirm`), ONE decision band,
  ONE reserved status line (committing pulse / inline refusal / blocker).
  `A` commits only when the LIVE waitingFor offers the option; a blocked `A`
  writes the concrete inline reason (never a mute no-op, never a toast).
- **Commit** (`submitMaFocusCommit`): re-resolves the option path, submits the
  byte-identical nested OR response, `claimMaCeremonyEmbed` +
  `armMaCeremony`, phase → `committing` (input absorbed by construction —
  `maFocusAcceptsInput`). Deliberately NOT `submitInnerOption` (that helper
  closes the console layers; the workspace must stay up). The stage PINS its
  view at the commit (`heldView` — the live rebuild would repaint the paid
  price with the NEXT one and drop the free flag with the consumed task).
- **The verdict** is a pure decision (`maFocusCommitOutcome`), executed by
  watchers on the ceremony queue AND on `gameAge`/`undoCount`:
  `ceremony` (own beat current) · `payment` (Helion/Stormcraft — the claim's
  own `SelectPayment`: the workspace yields, the still-armed ceremony plays
  globally after) · `refused` (raced / stale → reversible detail + reason) ·
  `wait`. A 15 s backstop (`MA_COMMIT_SAFETY_MS`) can never hang the beat.
- **The ceremony plays ON the stage** (`runMaCeremonyStage`): detail releases
  in place → the hero GLIDES (same DOM node) into the ceremony seat's inner
  slot (the ring must FRAME the emblem — the slot is smaller than the ring) →
  dressing + lines rise → the shared `playCeremonyBurst` fires over the seat →
  dwell. The `ma-ceremony-own` hold keeps notifications queued as before.
- **Close** rides the ceremony's OWN completion (`ceremony-done` →
  `onMaCeremonyDone`): consume the beat (`abandonMaCeremonyEmbed`),
  `leaveWorkspace()`; the screen's unmount hook does the final reset. Never a
  parallel timeout.

## The EMBED CLAIM (maCeremonyState)

`claimMaCeremonyEmbed(kind, name)` at submit → the global `ConsoleMaCeremony`
SKIPS the matching own beat (it would be a second emblem over the stage's).
The claimant advances the queue when its scene settles. **Every teardown path
must call `abandonMaCeremonyEmbed()`** — it releases the claim AND consumes an
already-current claimed beat (the global shell's one-shot nonce watch already
fired and skipped it; a bare release would strand the queue and pin the
`ma-ceremony-own` hold until the 35 s ceiling). Remote beats and foreign own
beats stay global (the top strip legally plays over the workspace).

## RESUME ≠ FRESH-OPEN

A lateral move / defer under a live PRE-COMMIT detail writes the
suspended-instance DRAFT (`maFocusState.draft`, screen `beforeUnmount`). ONLY
the task-restore door (`openShellTaskSurface` → `awardFunding`) re-seats it —
same item, same focus, stage mounts already open (no `appear` on the
transition = no re-entrance cinematic; `parkMaBrowse` in `mounted()` keeps the
browse parked). A wheel open never reads the draft; a plain B-close and the
task's end (`awardFundingActive` falling edge) discard it.

## Known forks and edges

- **True solo**: milestones/awards are DISABLED by the rules
  (`Game.allAwardsFunded()` → `players.length === 1`), so the commit path is
  testable only with ≥2 seats (the e2e uses `automa` — human + MarsBot).
- **Payment fork**: Helion (heat-as-M€) / Stormcraft answer the claim with a
  real `SelectPayment` — the workspace yields to the standard payment task
  (today's exact pre-rework behaviour) and the ceremony plays globally. An
  in-workspace «ОПЛАТА» step is future work.
- The stage teardown mid-commit degrades gracefully: the claim is abandoned,
  the beat (when it arrives) plays on the global shell.
