# THE PROMPT-MODAL FAMILY — one plate, and the decision's CHARACTER on it (2026-10-15)

> `src/client/console/promptTone.ts` · `src/client/console/promptSequence.ts` ·
> `src/client/components/console/foundation/ConsolePromptHead.vue` · `ConsolePromptOutcome.vue` · `ConsolePromptEmblem.vue` ·
> `src/client/console/surfaceMotion/promptHandoffModel.ts` + `promptHandoffMotion.ts` (the handoff) ·
> `src/client/components/console/ConsoleActionConfirm.vue` (the wheel's confirm) · `src/styles/console_prompt.less`
> Guards: `tests/console/promptTone.spec.ts` · `tests/console/promptSequence.spec.ts` · `tests/console/promptHandoffModel.spec.ts` ·
> `tests/e2e/console-prompt-family.spec.ts` (fhd + tv4k — the chain with the HANDOFF WITNESS, the gallery) ·
> `tests/e2e/console-action-confirm.spec.ts` (fhd + tv4k — the confirm, its R3 layer)

## The defect (the owner's case)

ONE tile placement by a «Philares» player beside an Ares hazard asks the same player, in one response chain:
the Ares adjacency card pick (a reward), Philares' «gain a standard resource of your choice» (a reward) and — LAST, by the
deferred queue's own priorities (`Priority.GAIN_RESOURCE_OR_PRODUCTION` 21 runs before `LOSE_RESOURCE_OR_PRODUCTION` 22) —
the hazard's «reduce a production» (a penalty). The reward rendered in `ConsoleTaskHost`, the penalty in
`ConsoleProductionLoss`: two different plates (44rem each, but different paddings, a 1.3rem sentence title against a 1.7rem
uppercase gradient, different counters), both in the SAME cyan frame, both six resource rows, both answered A → X. They
differed where nothing mattered and agreed where it did: nothing on screen said «this one TAKES». A player who took the
reward by rhythm gave an income away by the same rhythm — and the loss was the one with a lone row pre-selected.

The audit found the same drift across the whole family (seven paddings, three radii, three frame colours, two title
families, six kicker sizes, seven focus dialects, whole-element `opacity` on disabled rows, a gain mint and a second
«lanes» mint, two identical local «loss» oranges, a generic «Ожидает решения» kicker, a bot-attack verb drawn on the d-pad
glyph by list index).

## The family

| Surface | Tone | Size | Footer |
| --- | --- | --- | --- |
| `ConsoleTaskHost` (standalone; every kind) | read off the prompt | `promptSize` (s / m / l / xl) | DISTRIBUTE only |
| `ConsoleProductionLoss` | loss | m | yes (+ meter) |
| `ConsoleEffectDecision` (standalone) | read off the prompt | l with a source, m without | — (options carry their chips) |
| `ConsoleBotAttack` | loss | fit (content-sized up to l) | — (the commit row is the panel's foot) |
| `ConsoleVenusBonus` | gain | m, xl for the wild card's pick | placement stage (+ meter unless one unit) |
| `ConsoleSpendHeat` | neutral (a bill the player chose) | m | yes, label «ПОКРЫТО» (+ meter) |
| `ConsoleAresGlobals` | neutral | m | — (each row states its consequence) |
| `ConsoleGovernmentSupport` | neutral | l (a 2×2 briefing) | — (each tile states `current → resulting`) |
| `ConsoleMandatoryAnnounce` | the announced prompt's | — | — (emblem + tag only) |
| `ConsoleActionConfirm` (the quick wheel's «Пас» / heat conversion) | neutral | s, m with the pass's list | — (the operation block + «Сработает») |

**Outside the family, on purpose:** the composers (play / action / corp-first — the workspace grammar), every EMBEDDED stage
(it hands its stage name up, it never titles itself — `ConsoleWsStageHead`), `ConsoleDeckPick` (a workspace stage), and
the system surfaces (`.con-stranded`, `.con-alert`, `.con-quit`). `ConsoleConfirmDialog.vue` is imported by nothing.

## The anatomy (top → bottom)

1. **The plate** — `.con-prompt` (`.con-prompt-panel()`): the family's cold glass, a NEUTRAL steel rim (cyan is the focus
   colour and nothing else), one radius, one padding, `gap: 0` (the head's margin and the footer's are the one rhythm).
   The plate is never tinted by a tone (the bot-attack iteration's law).
2. **The crest** — the plate's top edge: a mint band (gain), HAZARD TAPE hatching (loss — the pattern says «careful» in
   greyscale too), a quiet cyan hairline (neutral). Positioned against the PANEL (the head is not a positioned box).
3. **The kicker row** — `[emblem] CATEGORY [extra…] ……… [РЕШЕНИЕ N] [▲ ВЫГОДА | ▼ УБЫТОК]`. The emblem is a SHAPE per tone
   (circle + plus / warning triangle + minus / the ◈ diamond); the category is the `consoleTaskSummary` kicker (the deferred
   chip and the command bar read the same key) in the tone's ink; the tag is a pill (gain) or a squared tag with a hatched
   lead (loss) — the same corner of every modal; a neutral decision has no tag.
4. **The ask** — the server's sentence in the READING face (`.con-read-text(640)`, `--con-prompt-title-fs`), the optional
   choice's decline plate at the far end of the same line.
5. **The trigger** — why the decision appeared, reading face, dim.
6. **The body** — the surface's own rows / options / scene, beside the shared source dock.
7. **The consequence footer** (`ConsolePromptOutcome`) — for a decision whose answer is a DISTRIBUTION (a sum of lanes):
   `[emblem] ВЫ ПОЛУЧИТЕ | ВЫ ПОТЕРЯЕТЕ | ИТОГ` · the chosen pools as `[icon] ±N current → resulting` · the budget meter. One
   reserved line; nothing chosen yet → the honest «what is still owed». A decision between OPTIONS states each option's
   consequence on the option and has no footer.
8. **The verbs** — only on the ONE command bar. A loss is ACCEPTED: «Принять убыток» in the bar's danger ink; a gain is
   COLLECTED: «Забрать» with the claimable glow once ready; a neutral decision keeps its own verb.

## The tone — structural, never a title (`promptTone.ts`)

In priority order: `botAttackPrompt` → loss · `productionToLose` → loss · a `discardPrompt` with no `exchange` and `min > 0`
→ loss · `choiceContext.mode === 'attack'` → NEUTRAL (the viewer AIMS it; the victim's prompt is the loss) · `mode ===
'reward'` → gain · `resources` (only ever «gain N standard resources») → gain · a card pick with `resourceGainPrompt` → gain ·
the Venus / colony / delta bonus markers → gain · an `or` whose every real answer (the decline excluded) carries effects that
only GIVE → gain, only TAKE → loss, anything mixed or unreadable → neutral. A wizard step keeps its own character when it
has one (`promptToneWithin`). A payment, an amount, a deck pick, a target list are neutral.

## Sizes — content decides the TIER (`--con-prompt-w-*`)

| Tier | 1080 | TV | Deck | When |
| --- | --- | --- | --- | --- |
| s | 34rem | 42rem | 30rem | a dial, a resource pick, ≤ 3 options — with no source |
| m | 44rem | 54rem | 38rem | rows / lanes / a list beside a COMPACT source |
| l | 54rem | 66rem | 46rem | a FULL source card beside options; a 2×2 briefing |
| xl | 78rem | 92rem | 100% | a card browser; a pick with a card row |
| fit | auto ≤ 56rem | ≤ 58rem | ≤ 46rem | a causal row that centres itself (the bot attack) — a dialog with board on both sides |

Height is content-sized up to the band. Profiles override TOKENS only (`html.con-profile-tv / -large / -handheld` in
`console_prompt.less`) — never a per-surface width, never a `vw` cap.

## A NEW decision is seen as new (`promptSequence.ts`)

- **The chain** opens on every submit through the transport funnel (`submitInput` / `submitBatch` → `notePromptSubmit`) and
  closes when the player is idle again — no prompt or the action menu (`applyPlayerView` → `notePromptView`). The decision
  on screen (the ONE head registered it) joins the chain when answered; a placement or a play opens it without being one.
- **The presentation** (`presentPrompt`, called by `ConsolePromptHead` on mount / key change): the ordinal («РЕШЕНИЕ 2» from
  the second decision of a press on), and the TONE SHIFT — gain ↔ loss against the decision answered just before it (a
  neutral step between them is its own kind of screen, not a reversal). A shift plays ONE beat after the plate has
  materialized: the crest wipes in, the emblem lands, the tag rings.
- **The settle** — the inertia guard. For a short window the shell swallows the DECIDING presses (A, X, the bumpers, the
  triggers — `promptSettleAbsorbs`, ONE gate in `ConsoleShell.handleIntent` in front of every prompt surface) and the bar
  greys those verbs (`consolePanelUi.panelCommands` — one place for every panel); navigation, B, Y and the stick presses
  always pass. 300 ms for a decision that opens a chain or stands alone (a double-tap guard), 650 ms for a follow-up of the
  same character, **1100 ms when the character flipped** — with the meter running along the crest. A swallowed press
  pulses the tag once, so it is never silently lost. The window is a SAFETY, not motion: it does not scale with
  `--motion-scale`, and the gate compares timestamps (the timer only repaints the bar).
- **Identity** — `promptSequenceKey(wf, identity, step)`: the server's own `promptId` serial beside `promptIdentityKey`,
  so two Ares adjacency picks with one title are two decisions and a re-render of one is not.
- ⚠ The transport's start resets only the CHAIN (`notePromptView(undefined)`): the shell mounts a standing modal's head
  BEFORE the board binder starts the transport, and wiping the presentation there left the next decision with no
  predecessor to differ from (caught by the e2e on a reload).

## Rows — one chassis (`.con-prompt-row*` mixins)

Plate, the one cyan cursor (`.con-focus()` — its couch weight rides the ring tokens), a row holding part of the answer in
the DECISION's tone (mint / the loss ink), cursor + answer = the tone's inner ring + the cyan outer ring, a refused row dims
its CONTENT and keeps an opaque plate (`> * { opacity }` — never the whole element, never `filter`). Worn by the production
loss rows, the task host's distribution lanes, the spend-heat / Venus lanes and options, the Ares rows; the Government
Support tiles take the same cursor (their accent stays their identity: the wash and the preview ink). One resource
vocabulary: `compositePrompts.LANE_LABELS` names a pool on every row (the loss rows printed «сталь», the lanes «Сталь»).

## The answers are the VARIANT GRAMMAR (PL-383)

A decision between OPTIONS on a family plate renders `ConsoleVariantChoice` — the task host's choice and targets (TR51) and,
since PL-383, the effect decision's answers too: `layout="column"` for results (with «ИЛИ» between ≤ 3 exclusive ones),
`list` when a seat is the subject (an attack's targets — the seat dot, no «ИЛИ»), the refused targets as the grammar's own
`off` rows under «НЕДОСТУПНЫЕ ЦЕЛИ». The cursor is the cold lift, the press is the SEAL (A resolves on the spot, so the seal
is the press's acknowledgement until the server moves on), a door says so (`›` + the lead line). The body slot carries the
decision's own reading (lead · the server's sub-line · the price → result chips · a downside); a YES / NO's decline keeps
a calm graphite tile (`[data-decision-role="decline"]`). E2E hooks: `[data-decision-action]` / `[data-decision-role]` on
the tile, `.con-vchoice__opt--focused`, `.con-vchoice__door`, `.con-vchoice__title`. Chips: `.con-decision` is a
chip-token root — never a `zoom` × `--con-ui-scale` around a chip inside one (that DOUBLES it on the couch: the task host's
`.con-task__opt-effects` printed 97 px type at 4K until PL-396). A stacked group's «ИЛИ» stands on its seam's centre —
the seam's width is the token `--vchoice-or-w`, never a profile `width` rule (PL-399: one pinned it to the column's left
edge on the TV and the Deck).

## One decision gives way to the next — THE HANDOFF (PL-384)

One press routinely answers a decision AND raises the next. The two plates used to swap as a ~110 ms cross-fade (two band
surfaces: the task host's reward → the production loss) or a plain out-in fade (a keyed panel inside one surface): the
answered plate and the new one were briefly the same blur, and the new question arrived the way a re-render does. Now ONE
phrase in both hosts (`promptHandoffModel.ts` — the pure timings, `promptHandoffMotion.ts` — the GSAP half):

1. **RELEASE** (130 ms) — the answered plate lets go ON THE SPOT: a hair of scale back (.975), opacity out, no travel.
2. **ARRIVE** (300 ms, from .965) — the next plate materializes where decisions stand, starting 40 ms BEFORE the release has
   gone: the stage is never empty, and the two plates are never both legible (the release is at ~⅓ when the arrival starts).
3. **COMPOSE** — its head lines (category · the ask · why) and then its blocks rise 6 px into place in reading order (70 ms
   in, 45 ms apart, 240 ms each, at most six): the eye is led back to the top of a NEW question. A tone flip's beat
   (crest · emblem · tag) starts once the plate has arrived (`--con-prompt-beat-at`, read by the head at render).

Measured (e2e witness, the Philares → hazard chain): from the release to the next plate fully legible **234 ms (fhd) /
283 ms (4K)**, an empty stage **0 ms**, two legible plates **never**. Where it runs: the director (`PROMPT_SURFACES` — a
closed table: a family plate entering ≤ 450 ms after another let go waits out the release; an ordinary OPEN of a family
plate keeps the workspace materialize and composes its blocks the same way), and the keyed `<transition mode="out-in">` of
the task host and the effect decision (`promptSwap*Hook` — an EMBEDDED panel, which has no `.con-prompt`, keeps the
stage's quiet swap). The plate's own CSS opacity transition (the task host's table-beat release) is off for the episode —
it would trail every frame the tween writes. Reduced motion: a short opacity beat, no cascade.

## The quick wheel's CONFIRM (PL-385, PL-394)

`ConsoleActionConfirm` — «Пас» always, the heat conversion when the table answers it (PL-067) or its step is empty. The
family's head («БАЗОВЫЕ ДЕЙСТВИЯ» · «Пас до следующего поколения» / «Повысить температуру за тепло»), then the OPERATION as
one object (the wheel slot's symbol on a medallion — `data-wheel-anchor="confirm"`, the flight's landing anchor — beside
the server's formula, one step louder than the chip token; a pass's consequence sentence in its place), then «Сработает» at
the plate's chip scale (`--con-chip-c-*` rebound to the token) with its R3 key at full size, then the pass's unused
opportunities as rows under «ЕЩЁ ДОСТУПНО В ЭТОМ ПОКОЛЕНИИ». No verb in the panel: A «Пас» (danger ink when something is
left unused) / «Конвертировать», R3 «Эффекты» (only when `forecastLayerAvailable`), B «Отмена». **R3 opens the «Эффекты»
layer** (the `'confirm'` forecast host): the plate parks in place, the explorer unfolds out of the row into a room centred
in the band (`--con-confirm-stage-w/-h`), the bar's context reads «ПОДТВЕРЖДЕНИЕ · ЭФФЕКТЫ», B / R3 fold it back; the
layer folds instantly with the surface. Before PL-394 the row drew the key and nothing answered it, and the formula chips
were the 13 px desktop chips on a 4K TV (`.con-confirm` was no chip-token root).

## Adding the next prompt modal

1. The plate: `class="… con-prompt con-prompt--<size> con-prompt--<tone>"` + `data-prompt-panel` on the panel; no own
   width / padding / radius / fill / rim.
2. The head: `<ConsolePromptHead :tone :kicker :title :trigger :prompt-key="promptSequenceKey(wf, promptIdentityKey(wf))">`
   (slots: `kicker-extra`, `decline`, default for extra rows). Never a hand-written kicker.
3. The tone: `promptToneOf(wf).tone` — extend `promptTone.ts` (+ its spec) with the prompt's STRUCTURAL marker if it is not
   read yet; never a title.
4. A distribution → `<ConsolePromptOutcome>`; options → their own chips.
5. The commit verb toned on the bar (loss → `promptCommitLabelKey` + `tone: 'danger'`, gain → `highlight` when ready).
6. A row → the `.con-prompt-row*` mixins.
7. Route its intents through the shell AFTER the settle gate (the branch order in `handleIntent`).
8. A row in this file's table, and the surface in `console-prompt-family.spec.ts`'s gallery.
9. Its `data-motion-surface` id in `PROMPT_SURFACES` (`promptHandoffModel.ts`) — or it cross-fades with its neighbours; a
   keyed panel inside it rides `promptSwap*Hook`.
10. Options → `ConsoleVariantChoice`; chips inside a chip-token root (add the root to the list in `console.less`), never
    a `zoom` × `--con-ui-scale` around them.
