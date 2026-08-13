# The STANDARD PROJECTS workspace — one flow, from the row to the board

`?console=1` → «СТАНДАРТНЫЕ ПРОЕКТЫ» (`ConsoleStdProjectsScreen.vue`, frame kind
`standard-projects`). This is the North-Star migration of the last decision
surface that still behaved like a menu: a screen that submitted, closed itself,
and let whatever the server asked next open as a NEW top-level screen.

## What was wrong (the shape, not the pixels)

`useStandardProject` called `closeConsoleLayers()` **before** the submit. That
one line is the whole bug: it pops the sheet-shaped frame, so by the time the
project's own follow-up arrived there was no parent left to host it.

- «Колония» → `SelectColony` → `openColoniesForPrompt` found no host and
  `enterWorkspace('colonies')` — a LATERAL screen. Crumb «КОЛОНИИ», no trace of
  the project. B там meant «minimize», so the player could not get back to the
  list they came from.
- «Продажа патентов» → `enterWorkspace('hand')` — the same lateral move, plus
  the sale mode set on the way out.
- Город / Океан / Озеленение → the board's placement mode, with the list gone.

Everything the server needed was ALREADY right: `payAndExecute` on those four
projects is **pay-on-commit** (`cancellablePlacement` + `commit(space|colony)`),
so nothing is spent until the target commits and a cancel costs nothing. Only
the client threw its own context away.

## The model

`consoleStdProjects.ts` — the flow's own state (the frame carries navigation;
this carries the pending decision):

| state | meaning | frame phase |
| --- | --- | --- |
| `idle` | browse | `browse` |
| `submitting` | the projectCard response is on the wire | `executing` |
| `target` | the project's follow-up is up (colony step / board placement) — **still reversible** | `configure` |
| `commit` | a TERMINAL project's answer arrived; the row plays its beat | `completing` |

Plus `frozenItems` (the rows the live model would have dropped the moment
`waitingFor` moved on — the deck-pick precedent) and `boardExcursion` (the draft
that lets a CANCELLED placement reopen the list on the very row the player left).

**`standard-projects` hosts steps** (`hosts: 'inFlow'`) and publishes
`[data-embed-slot="stdp-step"]`. The nested surfaces are the existing ones,
unchanged: `ConsoleColoniesSection`, `ConsoleHandSection`, `ConsoleTaskHost`
(the alt-resource payment). Nesting cost them nothing — they were already
host-agnostic (embed rules 1–3).

## Terminal vs target — the server's own two shapes

- **TERMINAL** (Asteroid, Power Plant, Air Scrapping, Buffer Gas, Excavate, the
  Moon set): the A-press IS the commit. Submit → `executing` (input absorbed BY
  PHASE — a double press cannot exist) → the response → a short committed beat
  on the row (`STDP_COMMIT_BEAT_MS`, the amber `--committed` pose while the HUD
  ticks its own delta chips) → the workspace leaves. **No second confirm, and
  no resource flights** (§13): the counter's own tick is the acknowledgement.
- **TARGET** (City / Greenery / Aquifer → `space`, Build Colony → `colony`):
  A submits the project, the follow-up opens as a STEP, and the step's own
  confirm is the single atomic commit. B before it cancels server-side for free.

Which one a project is, is **declared beside its own `payAndExecute`**
(`IStandardProjectCard.standardProjectTarget?(player)`), never guessed by name —
Aquifer answers `undefined` when oceans are maxed, on the same condition its
`payAndExecute` falls back to the committed legacy path.

## B, at every depth

| where | B |
| --- | --- |
| browse | close the workspace (or minimize, for the mandatory std-project prompt) |
| payment step | fold one level — nothing committed, same row, same focus |
| sale step | fold one level — nothing sold |
| colony step (pre-commit) | `cancelResponse()` → the response folds the step back to the row |
| board placement (pre-commit) | `cancelPlacement()` → the response REOPENS the list on that row |
| any beat in flight | absorbed (`acceptsInput`) |
| past the commit | collapse (the standard verb) |

The cancel legs are marked (`requestStdProjectCancel`) and resolved by the
flow's own reconciler — the RESPONSE is what folds, never an optimistic
client-side fold that would have to be undone if the server refused.

## The ONE ending

Every ending routes through `endStdProjectsFlow()` → the shared guarded
`concludeWorkspaceFlow('standard-projects')`. Two traps this cost:

1. **`isCommitted` is true for `executing`.** Concluding there closed the
   workspace MID-SUBMIT, and the follow-up it had just asked for opened as a
   lateral screen with no parent — the exact bug being removed. The conclusion
   fires on `committed` (a step's atomic commit) only.
2. **`completing` owns its own dismissal.** The terminal beat has a timer whose
   whole purpose is that the player can READ the committed row; concluding from
   the watcher swallowed the beat.

And because a step lets go on ITS OWN schedule (a colony's payout settles a
second after the server moved on), the conclusion cannot be asked only on the
response: `stdpConclusionSignal` watches the ingredients (phase · nested ·
outcome stage · task kind · parked · colony resolution · placement) and re-asks
exactly when one of them changes. Without it the parent list stood on screen,
committed and empty, until something else happened.

## The STATUS RAIL is the whole projected transaction (iteration 2)

One action must read as one statement. It did not: the M€ half lived in a
header block of its own shape («У ВАС 442 −14 → 428») while everything else
lived as chips in the status rail, so a single move looked like two unrelated
readouts. The header block is **gone** and the M€ change is now an ordinary
chip — the SERVER's own cost effect, `current → resulting`, rendered by the
same `ActionEffectChip` every composer uses:

```
ОЧИСТКА ВОЗДУХА │ [🪙 500 → 486] [Венера 0% → 2%]
ГОРОД           │ [🪙 500 → 475] [M€ 0 → 1 производство] › ДАЛЕЕ: ВЫБЕРИТЕ МЕСТО НА ПОЛЕ
```

Nothing is duplicated: the **row** says what the project costs and what it is;
the **rail** says where the player lands. The viewer's balance already lives on
the always-visible player rail, so the header stays quiet — deliberately not
back-filled with decoration.

Order is fixed and meaningful (money → production/parameter → the rest), and
the set CROSSFADES on a focus change (`transition-group`, keyed by
`direction:icon:note`) so the M€ chip stays put while the parameter beside it
swaps — no height change, no re-flow, never two projects' previews at once.

PATENT SALE is the one row with no honest projection before its step: the
payout depends on cards nobody has picked. The row states the RULE («+1 M€ /
карта»), the rail states the STEP, and the real `current → resulting` money
appears INSIDE the hand step, computed from the actual picks.

## The TERMINAL COMMIT is a phrase, not a class swap (iteration 2)

`consoleStdProjectCommit.ts` — four named phases, one motif:

| phase | what the player sees | who ends it |
| --- | --- | --- |
| `press` | the row COMPRESSES (~2 %) and its ring tightens — the tactile «принято», on the press frame, owing nothing to the network | the answer arrives |
| `committing` | a gold WAVE crosses the whole row once (the rail is re-forged with it): the projected green physically becomes committed gold | the wave's peak |
| `committed` | the fixed gold holds while the delta chips land, then the flow leaves | the hold (`STDP_HOLD_MS`) |
| `idle` | released — either the flow concluded, or a refusal rolled the press back | — |

**The HUD is HELD to the sweep's peak.** The response carries the new numbers,
so applying it on arrival paints the result BEFORE its own cause: the rail's
colour used to flip on whatever render won the race and the counters ticked
underneath it. `WaitingFor` now holds the commit (`holdingForStdProject`,
beside the patent sale's own gate) and `runStdProjectCommit()` resolves at the
crest — the counters and their delta chips land ON the confirmation. A fast
server cannot cut the beat; a slow one cannot stall it (the press already
answered, and the gate carries its own ceiling).

**Only terminal projects.** A project that turns out to need a target releases
the phrase the moment its follow-up arrives (`releaseStdProjectCommit`) — the
root list never flashes gold at a move that is not finished; the colony / hand
/ placement steps commit inside their own workspaces exactly as before.

**A refusal never shows gold.** `abortStdProjectCommit()` unwinds the press,
bumps `abortNonce`, and the shell's watcher rolls the FLOW back to `browse`
(otherwise the workspace would sit in its sealed `executing` beat with B dead).
Nothing is credited and the row is immediately usable again.

**Three things this animation cost, all general:**
1. **A 2 px rail is not a state change.** The first cut ran the gold along the
   rail alone and read as «просто поменялся цвет». The ROW is what changed
   state, so the row is what the light crosses; the rail brightens with it, one
   motif, one pass.
2. **A press pose must be FAST to exist at all.** At a 110 ms transition the
   server's ~100 ms answer took the next phase before the compression ever
   reached its own pose. 70 ms in, spring out.
3. **The phase change STOPS the animation.** With the release at the wave's
   midpoint the gold pass was truncated in the middle — so the peak sits near
   the wave's END (`STDP_SWEEP_PEAK_MS`), where the change still overlaps the
   crest without cutting it.

**Budget:** the phrase is bounded by the flat 950 ms timer it replaced
(`stdProjectCommitBeatMs()` is asserted against that ceiling) — press and sweep
overlap, the chips ride the crest, and the hold that follows is the read.

## The hosted step's ONE entry (the blink that was reported)

Entering the colony pick / the sale's hand made the WHOLE embedded surface
blink. The cause was a double reveal, and the frame trace named it exactly:
content up at t≈360 ms (`opacity 1`) → **hidden at t≈556 ms** → cascaded back
in. A teleported surface is already painted on the frame it mounts, so a JS
reveal has to hide it first — and that hide is the blink.

The entry is therefore CSS and belongs to the surface itself
(`.con-stdp__step > *`, `animation … backwards`): `backwards` means the content
is transparent BEFORE its own animation starts, so its very first painted frame
is already the beginning of the entry. One reveal, never two, whatever order
the mount and the phase change happen in. A short delay lets the browse layer
release first, so the two read as one movement inward.

Guard: the acceptance spec samples the step's opacity per frame and asserts
both that the FIRST painted frame is transparent and that the surface never
dips once it has risen.

## Preview — the shared chip language, from the real rule sources

`CardModel.standardProjectPreview` (`server/models/standardProjectPreview.ts`),
built from what the card already declares: the adjusted cost, `canPlayOptions`'s
reserve units and the `tr` bump, clamped through the shared
`cards/actionPreviews.ts` builders — so a maxed scale renders the chip's own
honest «no effect» instead of a fake gain. Anything beyond that comes from a
co-located `standardProjectPreviewEffects?(player)` hook (Power Plant's energy
step, City's M€ step). Read-only, purity-guarded like every preview builder.

The screen renders them with **`ActionEffectChip`** — the same component the
composers use (`.con-stdp` is in the doubled-class token block in
`console.less`). The M€ cost chip is filtered out on purpose: the price already
reads twice (row + wallet), and a third copy is duplication.

Target-DEPENDENT results are deliberately NOT guessed before a target exists —
the row names the next step («› ДАЛЕЕ: ВЫБЕРИТЕ МЕСТО НА ПОЛЕ»), and the exact
consequences arrive with the step's own preview surfaces (the board cell
preview, the colony focus stage).

## Discount

`printedCost − calculatedCost`, computed once in `buildStdProjectItems` — one
subtraction that covers every source (Air Scrapping's Venus tags, Standard
Technology's override, Excavator Leasing). Rendered as the compact `−N` capsule
in the SAME language as the premium card face's `.pcard__cost-delta`, absolutely
positioned: zero row growth, zero layout shift, nothing at all at zero discount.

## Spatial hint

The focused project's affected HUD readout carries a quiet ring
(`.con-status__param--ghost`, `box-shadow` — perf-lite safe, padding offset by a
negative margin so the strip cannot move). Browse only, and never for a maxed
parameter — the chip already says «no effect», and ringing a dial that will not
move would be the same lie.

## Occlusion

The hand dock is never hidden (its presence contract), but a full band panel
was being PAINTED OVER by the dock's card pack (z11704 vs the band's 11480–520).
The surface declares `con-ws--dockcover` beside its `con-ws` (the
`con-flight-to-board` precedent — the layer declares itself, no central list)
and the pack takes the one gap in the ladder (z11469: over the shade, under the
band) — covered where the panel reaches it, never dimmed, never hidden, and it
surfaces for physical arrivals (`--receiving`).

## The server-side fix this uncovered

`SelectColony.toModel` never serialized `placementContext`, so
`colonyCancellable` was false for every colony pick and the client's own cancel
branch — supported by the server since pay-on-commit shipped — was
**unreachable**. It now rides the input's own `toModel` (nesting-safe), exactly
as `SelectSpace` carries it.

## Guards

- `tests/models/standardProjectPreview.spec.ts` — the chips, the clamps, the
  target declarations, purity.
- `tests/client/components/console/consoleStdProjects.spec.ts` — the flow model.
- `tests/client/components/console/consoleQuickModel.spec.ts` — rows, the
  generic discount, preview/warning pass-through.
- `tests/e2e/console-stdp-workspace.spec.ts` — the acceptance walk: nested steps
  inside `.con-stdp`, every B-return with the wallet untouched, the colony build
  with a stack-shape trace asserting **no frame in which the parent list stands
  alone**, the covered dock pack, the terminal beat and the double-press.
