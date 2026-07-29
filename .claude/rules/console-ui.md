---
description: Console-native shell contracts (input, overflow, scale, motion, perf, prompt gating). Console native is THE product of this fork.
paths:
  - "src/client/console/**"
  - "src/client/components/console/**"
  - "src/styles/console*.less"
  - "tests/client/components/console/**"
  - "tests/e2e/**"
---

# Console-native rules

Console native (`?console=1` → `ConsoleShell.vue`) is **the default shell and THE product**. A UI feature is done when it works here; a desktop counterpart is never required. Concept doc: `docs/CONSOLE_MODE_CONCEPT.md`.

## Settings placement
Persistent console SETTINGS live in the main-menu → «Настройки» (`ConsoleOptionsPanel`) as a row (value on the right rail, subtitle describes the SETTING, not its value). The in-game `ConsoleSystemMenu` is a **FIXED-SHAPE list of actions** on purpose — a value that relabels in place or a conditional block re-lays it out under the d-pad cursor. Never add a setting there.

## Leak detector (breaks silently if skipped)
A new console surface that renders its OWN root class is invisible to `consoleLeakDetector.ts` and gets masked by the amber stranded guard even though it renders underneath. **Register its root selector**: general surface → `SERVING_SURFACES`; kind-specific section → `KIND_SURFACES[<kind>]`. The root must have layout. No spec enumerates the list — a miss fails only at runtime.

**A hand-off to an ALWAYS-MOUNTED surface (board placement, hand carousel) has no registrable selector** — it needs a module-level MIRROR + early-return instead (`setConsoleTaskSpacePlacement`, `setConsoleTaskDeferred`, `isConsoleHandPickActive`, …) plus a spec row. This is how the final-greenery placement stranded (a nested `SelectSpace` branch keeps `waitingFor` classified as `choice` while every task surface unmounts). Full table: `docs/claude/console/leak-detector-contract.md`.

## Input — semantic, never raw
Physical input → `GamepadIntent` → `ConsoleAction` (`consoleActionModel.ts`). The ONE keyboard map lives there; the global `consoleKeyBridge` feeds the same dispatch. **Never add a component-local `keydown` listener or a new physical binding at a call site** — new screens use `useConsoleInput({onAction, onNav, overrides})`. `useGamepad`/`useMagicKeys` from VueUse are deliberately not used.

## Controller glyphs — never a literal button name
The player picks a glyph set (Options → «Контроллер»: Auto / Xbox / PlayStation / Steam) and an A↔B layout; `activeGlyphSet()` resolves both. Three sanctioned ways to show a button, in order of preference:
1. **`<GamepadGlyph control="triggerL"/>`** — the badge. Default for all markup.
2. **Interpolate the label** when the string is plain text with no glyph slot: `translateTextWithParams('Press ${0} …', [activeGlyphSet().stickL.label])`, and keep the English key parameterized.
3. **`content: var(--gp-label-<control>)`** (+ `var(--gp-tone-<control>)`) — ONLY for a badge on DOM we don't own (the `simple-keyboard` virtual keys). Published onto `<html>` by `glyphCssBridge.ts`, republished by `GamepadLayer`.

A literal `LT` / `RB` / `L3` / `Y` is a bug — including inside a **RU translation value**, where the English key looks clean («колесе LT/RT» shipped that way). Comments may name buttons freely. `tests/gamepad/glyphLiteralGuard.spec.ts` fails on any non-comment literal in `console/**`, `gamepad/**`, `console*.less` and `console.json`.

**Auto-detect cannot see through Steam Input** — it virtualizes every pad as an Xbox 360 controller, so `detectGlyphSet` returns `xbox` and the player must pick Steam/PlayStation manually. When a glyph "looks wrong", check Options → «Контроллер» (Auto shows what it resolved to) BEFORE hunting for a hardcode.

## Overflow — a native scrollbar is a BUG
Every console-native SCREEN root calls `useConsoleNativeSurface()`. Overflowing content lives ONLY inside `ConsoleScrollArea.vue` — never a hand-rolled `overflow-y: auto`. Animations use `.con-motion-clip` (outer clip) + `.con-motion-layer` (inner transform/opacity). `transition: all` and animating width/height/top/left are banned. Treat every dev `[console-overflow]` warn as a bug.

## Viewport / reduced motion
Read `useConsoleViewport()` (profile / isHandheld / isTv / uiScale). No manual `matchMedia` / `innerWidth` / resize listeners. JS-side reduced motion: `useConsoleReducedMotion()` / `consoleMotionMs(base)`.

## Scale model (TV profile) — rem discipline
All `console*.less` is authored in **rem (1rem = 20px logical, a 1920×1080 logical layout)**; `--con-ui-scale` maps it onto the viewport, JS mirror `conUiScale()`. New console styles must be rem. Two traps that shipped as bugs:
- A JS reader of a length-valued custom property MUST use `cssUnits.cssLengthPx()` — `getComputedStyle().getPropertyValue('--x')` returns the unresolved `"18.3rem"` string.
- Anything positioned inside the planet's `transform: scale(var(--board-scale))` px-space (off-Mars `.board-space-XX` margins, cell spotlight inset, arc-marker ring) stays **px + a `keep-px` marker**.
- A new px constant in console JS (fit engines, director offsets, scroll steps) must multiply by `conUiScale()` or content stops growing on 4K.
- Embedded px content integrates via `zoom:` multiplied by `var(--con-ui-scale, 1)`.

## Performance mode (`con-perf-lite`) — every new overlay/animation must support it
The profile cuts `filter` and `text-shadow` globally; `box-shadow` is deliberately KEPT. Therefore:
1. Motion lives in `transform` / `opacity` only.
2. **Functional state indicators — focus, selection, cursor, availability — use `box-shadow`/`outline`, NEVER `filter`/`drop-shadow`/`text-shadow`** (they vanish in perf mode and the player loses navigation cues; the colour carries state).
3. Decorative-only glow via `filter` is fine.
4. Verify by toggling «Производительность» ON: every cue still visible and correctly coloured, motion identical.

## Surface motion (band surfaces)
Orchestrated by `src/client/console/surfaceMotion/` behind `<transition :css="false">`. Markup contract: `data-motion-surface="<id>"` on the root (absent → hooks pass through, the gradual-migration path), `data-motion-panel` on the animated panel, `data-motion-anchor="card:<name>"` for phase FLIPs. ONE shared `.con-shade` dims behind every migrated surface — a migrated surface renders no own backdrop div. **Before deleting a now-dead backdrop CSS rule, grep the `.vue`s — chassis classes are SHARED** (two dim-less regressions came from this). FLIP transforms inside a CSS `zoom:` context need `effZoom` compensation. **Never re-close a composer at submit time** — use the awaiting handoff (`beginAwaitingHandoff`), else the "confirm → bare board → reveal" gap returns. Migration checklist: `docs/CONSOLE_SURFACE_MOTION.md`.

## Mandatory prompt gating
An INTERRUPTIVE mandatory DECISION is ANNOUNCED, not auto-opened: surface stays closed, `ConsoleMandatoryAnnounce` names it, **B opens it** (`consoleMandatoryGate.ts`). Scope: `corpFirstAction` + forced `handSelect` always; host sub-prompts only when the viewer's status is an off-turn forced reaction. The viewer's own turn is never gated. **Never gate a cinematic ENDPOINT** (a drawn-cards reveal is the continuation of a draw animation — gating splits one cinematic). New interruptive kind → add it to the gate's scope set + a fixture row.

A DEFERRED (minimized) task is reachable **only from the board home** — its `.con-mandatory` card renders nowhere else, and `handleSectionBack`'s restore branch sits AFTER the section-close branches on purpose. Putting it first (it once was, as a "global fallback") makes B inside the hand/colonies/hydro yank the prompt back instead of closing that screen, so B stops meaning "one calm step back" the moment anything is deferred.

## Prompt admission — one response, one demand
ONE server response routinely carries a finished EFFECT and the NEXT prompt (the executor draws synchronously and only DEFERS a tile — Experimental Forest answers with the drawn-cards reveal AND `SelectSpace`). Every surface family derived from `waitingFor` asks `this.admits('<family>')` (`consolePromptAdmission.ts`) — **never hand-roll a gate expression**; four hand-copied ones had already drifted and the fifth (board placement) was never written, which is how the reveal and the live board arrived together. `PromptSurface` is exhaustive over the policy record, so a new family fails the compile until it declares what it waits for; a new signal goes into `ConsoleShell.admissionSignals`, the single collection point. **A draw's prompt ends only when the LAST card lands in the dock** (search → reveal → take → intake flight), not when the modal closes. Board placement has no `v-if` (the board is always mounted) — the verdict IS the suppression, mirrored to the legacy `WaitingFor` via `setConsolePlacementHeld` so the hex highlight holds with it. Client-side pickers (convert-plants, a task's nested space) are deliberately NOT gated — holding them strands the prompt. Full contract: `docs/claude/console/prompt-admission.md`.

A surface that hands a pick to an ALWAYS-MOUNTED host (the board) and unmounts must also hold itself down across the SUBMIT round-trip — `waitingFor` still names the old prompt until the server answers, so it re-mounts and blinks over the cinematic the commit just started (`finalGreeneryCommitting` is the reference; release a tick after the response, when the hero has the foreground).

## Payment — ONE panel, two densities
Every payment prompt (card play, blue action, standalone `SelectPayment`, colony trade) renders `ConsolePaymentPanel` over `buildPaymentView` (`paymentPlan.ts`) — the SINGLE source of every payment number. `mode="compact"` is the in-composer summary, `mode="expanded"` is the LT editor: **same rows, same order, same values, same geometry**. Never fork the markup for a new payment context — pass `titleKey` / `hintMode` instead.

**Layout-shift contract (load-bearing):** the M€ row is always rendered even at 0 spent; rows reserve `--con-pay-row-h` (sized for the expanded two-line cell); numeric columns have fixed widths; `.con-paystatus` is unconditional and reserves `--con-pay-status-h`. **`.con-pay--expanded` may change PAINT ONLY** — no padding/gap/height, or the LT switch starts moving the CTA. Full contract: `docs/claude/console/payment-panel.md`.

## Prompt copy
`consoleTaskSummary.ts` is the ONE source of pending-decision copy (deferred chip / command bar / task host kicker). It is pure and key-based; the SERVER title wins over a per-kind key unless boilerplate. **Never hardcode a pending label at a call site.** The union is exhaustive with a `never` guard — a new `TaskKind` fails the compile until it gets copy + a fixture row.

## Deep reference (read on demand, not auto-loaded)
`docs/claude/console/` — task-summary copy contract, start-scene summary, leak detector, mandatory gate, VueUse foundation, surface motion, TV display profile, performance mode. Plus `docs/CONSOLE_MODE_CONCEPT.md`, `docs/CONSOLE_FOUNDATION.md`, `docs/CONSOLE_SURFACE_MOTION.md`.
