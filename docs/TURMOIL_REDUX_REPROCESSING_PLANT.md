# TR58 Reprocessing Plant («Перерабатывающий завод») + the iteration «КУРСОР — ОДИН ЖИВОЙ ОБЪЕКТ»

**Status.** Shipped 2026-10-16. The prompt: `docs/claude/prompts/project-tr58-reprocessing-plant.md`. The cursor's
contract: `docs/claude/console/cursor.md`; the rule: `.claude/rules/console-ui.md` § THE CURSOR IS ONE LIVING OBJECT
(+ a line in `animations.md`). Ledger: section AW (`docs/claude/gameplay-polish-ledger.md`, PL-490…). Decisions 1–7 were
taken at their defaults; 4, 5, 6, 7 went to the owner in one batch.

## 1 · The card

Blue, 8 M€, a Building tag, the INDUSTRIALISTS' plate (they rule, or 2 of the player's own delegates on their
resolution — the TR15 class; TR36 lowers no requirement), no VP, no resource of its own. «Action: Pay 3 plants or 5 heat
to add 3 floater resources to ANY card.» Lore: «Whatever floats your boat.» (RU «Что угодно — лишь бы держалось на
плаву.»). Art: Adam Taylor (`Mars Arts/TR58.png`, imported — it arrived after the prompt was written).

- **ONE declaration, no hook** — Electro Catapult's shape (two prices, ONE good): `action: {or: {behaviors: [{spend:
  {plants: 3}, addResourcesToAnyCard: {type: FLOATER, count: 3, mustHaveCard: true}, title}, {spend: {heat: 5}, …}],
  autoSelect: true}}`, no `optional` (else an action with no holder would be offered and do nothing).
- **The target** is ANY own floater holder (`AddResourcesToCard.getCards`), never auto-selected, Stormcraft included —
  its floaters can come back to it after paying the heat.
- **Stormcraft's heat is asked BEFORE the commit** (the pre-select law): `models/actionPreview.ts` gained
  `branchHeatSteps` — a sub-branch that spends heat carries `actionPreviews.spendHeatStep` among its OWN steps, in the
  live order (OrOptions → the heat split → the target). It also fixes Directed Heat Usage. Two defects surfaced on the
  way, both fixed: `spendHeatStep` lost the prompt's `choiceContext`, so its address could not name Stormcraft
  (Meltworks, Caretaker, Plasma Fans, Directed Heat Usage were all affected), and the CLIENT dropped a branch's heat
  answer from the batch (`orderedStepResponses` / `plannedStepResponses` forwarded only `input` / `tabbedTargets` — the
  composer SHOWED the split and the server asked it again after A; caught by the e2e (C), guarded in
  `preselectStamp.spec` § every step the composer draws as a row is posted).
- **The reason** — a reason shared by EVERY variant goes first (`actionUnavailableReasons`: the `or` branch collects per
  sub, then orders): with no holder the tile reads «Нет карты для добавления ресурса», never «Недостаточно растений».
- **Frontier Labs** (found by the new Stormcraft profile of `actionPromptCoverage`): its action preview had no payment
  step — fixed (`actionPreviews.paymentStep`).
- `floaterCards.ts` lists TR58 (it prints floaters).

Spec: `tests/cards/turmoilRedux/ReprocessingPlant.spec.ts` (rules 1–10). Fixtures: `reprocessing-plant`,
`-stormcraft`, `-none`, `-locked`. e2e: `tests/e2e/console-reprocessing-plant.spec.ts` (fhd + tv4k, A–E).

## 2 · The composer — two PRICES, ONE good (decision 4a)

The face prints ONE row «3 [plant] OR 5 [heat] → 3 [floater]*» — the «OR» on the PRICE side, the reverse of PL-074.

- **The slice reads the side** (`actionBranchView.printedAlternativesSide`): a seam on the result row slices the
  goods (PL-074), else a seam on the PRICE row slices the prices; `printedSharedResult` hands the group the result's
  own nodes — the same references for every branch (`BranchView.printedShared`). The corpus guard
  (`actionBranchPrinted.spec`) slices TR58 and checks the shared result is ONE set of face references; TR58 left
  `KNOWN_UNSLICED`.
- **The tiles are the prices**: each tile's hero is its printed price; the good every price buys is taken off the tiles
  (`commonVariantGain`, the mirror of `commonVariantCost`) and printed ONCE after the last tile
  (`ConsoleVariantChoice` `shared` → `.con-vchoice__arrow` + `.con-vchoice__shared`) with the addresses ONCE
  (`sharedVariantDestinations` — the TR56 law: the variants share their holders, no tile repeats them). It is not an
  option: no cursor stop, no seal.
- **The formula states the good before the choice** and reserves the PRICE side (`heroPricePending`,
  `data-hero-pending="price"`) — choosing fills a slot that stood there; nothing re-flows.
- **Stormcraft**: sealing the heat tile brings «Источники тепла» as a row of the composer (the split dial), its
  default the least floaters that cover the price; the answer rides the ONE POST, addressed to Stormcraft.
- **The commit** is the ordinary ACTION COMMIT: the price leaves its rail row sideways into the printed price icon
  (PL-099 / PL-104), «+3» is born on the hero's printed floater and lands on the chosen card's miniature in the target
  row (PL-162). Witnessed in e2e (A) / (B): `rail:plants` / `rail:heat` → `hero` → `composer-card:Dirigibles`.

## 3 · КУРСОР — ОДИН ЖИВОЙ ОБЪЕКТ (≈ 70 % of the iteration)

The owner's 4K report: «фокус по умолчанию появляется одним кадром; карта делает микро-прыжок». The full grammar is
`docs/claude/console/cursor.md`; what changed, surface by surface:

| Surface | Was | Is |
| --- | --- | --- |
| Hand album — open | the first card born ringed + lifted under the copies (opacity 0) and revealed with them in one frame; the copies faded 180 ms OVER the slot (two different pictures); the blocker chip blinked; targets measured on the enlarged slot | the slot stands at REST under identical copies (playable hairline, corner, fx); show-then-remove on the next frame; `flightVisuals` cleared after; the cursor ARRIVES the frame after (`handCursor`) |
| Hand album — step | ring on `.pcard` with no transition, lift 150 ms on the slot; z-index dropped at once (the enlarged card dived under its neighbour) | `.con-cursor()` on the slot — ring layer + lift on one clock; z held until the lift settles |
| «Действия карт» | tile and group: no transition; the TV ring list out-painted `--rules / --soft / --activated` | tile ring + focus gradient as a layer under the content; the group's live glass a layer; steel paints for the composite states on every profile |
| Colonies | ring + lift 150 ms ease; `scrollIntoView({smooth})` on every index change | `.con-cursor-shadow()` (the tile clips its glyphs) on the cursor's clock; `cursorEnsureVisible` |
| Standard projects | row: no transition, gradient snapped; mounted with the last visit's index and re-seated on `$nextTick`; unavailable rows 1 → .62 in one frame at the end of the entry | `.con-cursor()` + opacity on the clock; seeded before the first render (`seedSheetCursor`) |
| Variant tiles | rest `[inset, inset, outer]` vs focus `[inset, outer, outer]` — snapped under a declared 160 ms | ring + cold glass as a layer under the content; the answer's mint glass a `::before` of its own |
| Composer rows | no transition; the action composer re-seated the cursor on `$nextTick`; a same-shape refetch reset it | `.con-cursor()` rows; ONE synchronous seed; `samePreviewShape` keeps the cursor |
| Target step | slot lift 150 ms, ring on `.pcard` snapped; the «Эта карта» proxy's shadow lists incompatible | `.con-cursor(@pseudo: before)` on the slot; the proxy's layer under its content |
| Stage rows (draw / deck pick / reveal / draft / task host) | opacity outside the transition; `--has-focus` dimmed the neighbours at the handoff; `finishDeal` refitted the row in the arrival frame; the reveal centred each step with `scrollIntoView` | transform, ring and the neighbour dim scaled by the arrival gate; fit BEFORE the cursor; `cursorEnsureVisible(align: center)` |
| Start | the deal animation ended at `translateY(0)`, then the focus pose snapped; TV rings INSET under the card face | the deal keyframes animate `translate` (the pose composes); outer rings de-zoomed; the cursor gated until the pane's animations end |
| All | 140 / 150 / 160 / 240 / 260 ms; in-game reduced motion untouched; a dead `ConsoleCardFocusFrame` + docs saying it was the main indicator | ONE token; reduced motion stills the lift and keeps a 90 ms fade; the dead frame and its docs gone |

## 4 · Measurements (GPU, `--workers=1`; before = snapshot `.e2e-tr58b`, build `a6a4187a34`; after = `.e2e-tr58`)

The SAME witness and the SAME spec (`console-cursor.spec`) on both builds; the summaries in
`test-results/cursor/witness.txt` (copies `C:/tmp/tr58-witness-{before,after}.txt` at the time of writing).

| Measurement (fhd · tv4k) | Before | After |
| --- | --- | --- |
| Hand open — `bornHidden` | 1 · 1 | 0 · 0 |
| Hand open — the copy and the card painted together | 89–101 ms · 89–481 ms (a cross-fade) | 0 ms · 0 ms |
| Hand open — handoff Δ (face to face) | 0 px | 0 px |
| Hand open — the ring's arrival (first ring → 80 %) | 0 ms (born full) | a ramp after the handoff |
| «Действия карт» / colonies / std projects open — `bornHidden` | 1 · 1 each | 0 · 0 each |
| … the arrival (first ring → 80 %) | 0 ms each | 89 / 44 / 59 ms · 74 / 44 / 66 ms |
| Every step — `snaps` · `jumps` · `zFlips` · `scrollJumps` | (not reached — the open failed first) | 0 · 0 · 0 · 0 |
| Hand-painted focus rules (the ratchet) | 142 | 116 |
| Non-interpolable focus shadow transitions | 6 | 0 |
| `scrollIntoView` in the console | 9 call sites | 0 |

**The 4K storyboard** (CDP screencast on the GPU, the first album card's ring edge, green over red):
before `4.8 → 59.4` between two consecutive painted frames — the ring snapped on, a whole second after the card
landed; after `6.5 → 30.2 → 61.0` over three painted frames — the ring ARRIVES. The resting pose at the end is the same
picture (`screenshots/tr58/tv4k/crop-hand-first-card-end.jpg`); the sheets `sheet-hand-open-{before,after}.jpg`.

## 5 · Traps

- **A row the composer DRAWS is an answer the batch must CARRY.** The step builders forwarded two kinds and the
  composer drew three; nothing compared the two lists. Now a spec does (`preselectStamp.spec`).
- **Less cannot interpolate `::@{pseudo}`** — the layer mixin pattern-matches `after|before`; a mixin argument holding a
  comma list needs a trailing `;`; `~"…"` does not evaluate `fade()`.
- **`calc()` unit algebra**: `length × length / length` is invalid — scale a length by the unitless `--con-cursor-on`.
- **A host that clips its children** loses a layer's outer halo — paint its own box-shadow as a function of
  `--con-cursor-on` (one list, one shape) instead.
- **Keyframes that animate `transform` overwrite the focus pose** — animate `translate` (the individual property), and
  the pose composes.
- **Gate the pose, never the focused class** — withholding `--focused` in the reveal while a scene staged its batch
  hid the cursor itself for a whole colony resolution (`console-colony-miranda-bonus`, `console-card-trade-resume` —
  caught by the regression, fixed before the commit: `revealPoseHeld` → the root's `data-cursor-pending`).
- **The witness must measure FACE to FACE** — the copy's wrapper and the slot differ by the pick band (558 × 781 vs
  558 × 802 at 4K); and a 26 % mint hairline is not a ring (alpha ≥ .4, spread ≥ .9 × ui scale).
