# Console-First Gamepad / TV Mode Concept for Terraforming Mars Premium UI

> Iteration 2 of controller support. Iteration 1 (`GAMEPAD_SUPPORT_DESIGN.md`,
> phases 1–4 shipped) made the EXISTING desktop UI drivable with a pad; this
> document designs a **separate, console-first interface mode** — a native
> "couch port" of the game, not a mouse replacement. Product/UX concept only:
> **nothing here is implemented**, and nothing here changes the desktop
> modern-premium UI.
>
> Quality reference class: console digital board games (Wingspan, the Steam
> Deck UI idiom, BG3's controller mode) — not to copy, but as evidence that a
> controller UI needs *different layout, different information architecture,
> fewer-but-bigger surfaces, task-focused screens, and command-driven input*.

---

## 1. Executive summary

Console Mode is a **second shell over the same game brain**. The data layer,
server contracts, submission path, preview endpoints, module states and the
premium visual language stay shared; the *rendered interface* is swapped for
a TV-scale console shell built around three ideas:

1. **Context + commands, not focusable elements.** The player never focuses
   a button. They select GAME OBJECTS (a card, a hex, an action, a colony)
   inside the active zone; the object's available verbs appear on a fixed
   bottom **command bar** mapped to face buttons. On-screen buttons cease to
   exist as navigation targets — commands are finite (≤4 + menu) and always
   labeled. This kills the "walk focus across 50 elements" problem at the
   root.
2. **Sections + tasks, not overlays.** The desktop's ~10 bar-overlays +
   dropdowns + pills collapse into **4–5 console sections** (Board · Hand ·
   Table · Journal · [Colonies]) switched by bumpers, a **Turn Menu** (one
   list of every verb the server currently offers, with availability and
   reasons), and a **task system** that turns every mandatory prompt into a
   focused, step-by-step, one-decision-per-screen flow.
3. **TV-first presentation.** A dedicated type/spacing scale (10-foot UI:
   ~24 px minimum body at 1080p), overscan-safe margins, one stable
   **inspector panel** replacing every hover popover, spotlight selection
   instead of a thin focus ring, and fewer simultaneous surfaces.

Iteration 1's input core (poll model, mode machine, glyphs, kill switch)
survives as the low-level plumbing. Its DOM-driving focus engine is demoted
to a fallback for un-migrated corners and development — it is explicitly
**not** the UX of this mode.

---

## 2. Why the previous gamepad plan is not enough

Honest assessment of iteration 1 against the new goal:

1. **It preserves desktop information architecture.** The bottom-bar rails,
   corner chrome, ten overlays, dropdowns and pills are a *mouse* IA — small
   targets at screen edges, meaning delivered by hover. A pad can reach them
   (iteration 1 proves it), but reaching is not the same as belonging.
2. **It preserves desktop density.** 12 px chips, 300 px-wide cards at 0.5–0.8
   zoom, 6-column tableaus. At 2.5–3 m from a TV this is unreadable no matter
   how good the focus ring is.
3. **Focus-walking is tabbing.** Spatial nav across a 20-card hand grid or a
   61-hex board is better than Tab, but it is still "move an invisible cursor
   N times, then click". Every element being a target is precisely the
   mouse-replacement feel the brief bans.
4. **Hover parity is a crutch.** Synthetic `mouseover` + `.gp-focus` tooltip
   gates re-create *cursor-anchored popovers* — a pointer pattern. TV wants
   details in ONE stable, large place, not floating at the focused element.
5. **It cannot restructure flows.** Payment steppers as six +/− button pairs,
   selection grids inside a 660 px modal, dense master-detail splits — a
   focus engine can only traverse what exists. Console-grade UX for these is
   a *layout* problem, unreachable from the interaction layer.
6. **What it got right** (and what we keep): the input core is solid; the
   "submit through existing contracts via the same handlers" invariant is
   correct and carries over; the scope-stack idea survives conceptually as
   the console mode's own context stack; glyphs/i18n/kill-switch/test
   discipline carry over unchanged.

---

## 3. Current architecture audit

Classification legend: **REUSE** (as-is in console mode) · **ADAPT**
(console-specific layout, same logic/data) · **REPLACE** (dedicated console
component) · **FALLBACK** (kept only as safety net) · **SKIP** (not touched).

| # | Area | Key files | Today | Console-mode classification |
| --- | --- | --- | --- | --- |
| 1 | Modern-premium entry | `App.vue` (screen router, App-level layers), `PlayerHome.vue` (~4160 ln: chrome + `activeOverlay` machine + action detection + submission handlers + guards) | One shell for everything | **SPLIT**: App gains a `consoleMode` branch mounting `ConsoleShell` instead of `PlayerHome`; PlayerHome's *detection/submission logic* is extracted to a shared turn-intent layer (§13), its *rendering* is not used |
| 2 | Board rendering + placement | `Board.vue`/`BoardSpace.vue` (stable `data_space_id`, delegated hover), `useBoardAutoScale` (`--board-scale`), `SelectSpace.vue` (per-cell onclick, illegal reasons), `PlacementBanner`, `placementContext` cancellability, `BoardInformationEngine` + `/api/game/board-cell-preview` | Mouse hover inspector + click-confirm | **REUSE render + data** (board component, facts engine, previews, cancel marker); **REPLACE interaction chrome** (banner/popovers → console dossier panel + placement task, §7) |
| 3 | Hand / card grids / draft / buy | `HandCardsOverlay` (+fit engine), `CardSelectionContent` (+fit), `DraftFlowOverlay`, `InitialDraftFlowOverlay`, server `unplayableReasons`, `getPlayableCards` | Dense adaptive grids in overlays/modals | **REPLACE layout** with carousel + inspector + task screens (§8); **REUSE** `Card.vue` rendering, playability/reason data, submission payloads |
| 4 | Actions overlay | `ActionsOverlay` master-detail, `actionPlayability`, `/api/action-preview`, `CardActionConfirmContent` | Master grid + detail + confirm modal | **ADAPT**: same entries/preview/stat data re-hosted as a Table-section tab with big rows + inspector; confirm becomes a task (§9, §10) |
| 5 | Effects overlay | `EffectsOverlay`, `effectExtraction`, `/api/game/effect-stats` | Master-detail analytics | **ADAPT** (read-only tab of the Table section; same extraction + stats) |
| 6 | Colonies | `ColoniesOverlay`, `ColonyTile`, `ColonyTradePaymentModal`, pay-on-commit build | Teleported overlay + bespoke trade modal | **ADAPT**: colony carousel + inspector + trade/build wizard tasks; trade payment options data reused |
| 7 | Journal / history | `JournalPanel` + feed/chips/popovers, `journalState`, `openJournalToEvent` | Side panel, hover chips | **ADAPT**: full-height Journal section, TV type, chip popovers → inspector; same data/feed logic |
| 8 | Victory / endgame | `VictoryPointsOverlay` (+pure model), `EndgameExperience`/`EndgameResultsOverlay` (tabs), `FinalScoringReveal`, `RematchLayer` | Premium full-screen already | **ADAPT** (closest to ready): TV type ramp + bumper tab nav + command bar; rematch controls → command bar verbs |
| 9 | Confirmation modals | `ConfirmDialog` (native dialog; fork default skips tile confirm), pass confirm, empty-warnings | Small dialogs | **REPLACE** with the task system's confirm step (consequence chips standard, §10) |
| 10 | Mandatory input system | `WaitingFor.vue` (routing: `MODAL_INPUT_TYPES`, suppressions, holds, `onsave/onsaveBatch`), `MandatoryInputModal` (minimize/pill/picker), `ModalInputHost` registry | Centered modal + minimize pill | **REUSE routing + transport entirely** (WaitingFor is the brain, keeps working headless); **REPLACE presentation** with the console task system (§10). Minimize concept survives as docked task chip |
| 11 | Card selection content | `CardSelectionContent` (draft/buy modes, disabled cards + filter, fullscreen bridge) | Adaptive grid in modal | **REPLACE presentation** (pick task: carousel + inspector + pick counter); reuse mode detection, payloads, disabled-reason data |
| 12 | Payment / resource flows | `SelectProjectCardToPlay`/PaymentFormV2/rows (button steppers, no native inputs), `ModernAmount/Resources/ProductionToLose`, reserve/discount rules | +/− button clusters in modals | **REPLACE presentation** with lane-based stepper screens (d-pad adjusts, §10); **REUSE all payment math/validation** (the V2 form logic is UI-separable) |
| 13 | Start game / corp / prelude | `StartGameFlowOverlay` (+`startGamePrompt` markers), `InitialDraftFlowOverlay` pipeline | Premium orchestration modals | **ADAPT**: same state/predicates; presentation becomes console task screens (these flows are ALREADY step-shaped — the closest existing thing to the console idiom) |
| 14 | Fullscreen card zoom | `CardZoomModal` (native dialog, ←/→, #actions slot, fit-to-viewport) | Click-to-zoom browser | **DEMOTE in console mode**: the persistent inspector makes ad-hoc zoom mostly obsolete; the navigable browser survives inside pick tasks ("compare dealt cards") — **ADAPT** (TV fit, command-bar actions) |
| 15 | State machines / overlay routing / teleports | `activeOverlay` machine, module states (`journalState`, `actionsOverlayState`, sale/select/pick states…), 48 body teleports, z-stack, outside-click | Desktop shell owns them | `activeOverlay` **NOT USED** by console shell (it has its own section/task state); module *data* states REUSE; teleport/z-stack conventions REUSE for console layers |
| 16 | Mobile/responsive | Scattered `max-width` breakpoints (1180/1080/880/760/640…) for overlay stacking + gaps; board auto-scale; no touch/mobile mode | Desktop-narrow adaptations only | **Not a foundation for TV** — confirms the need for a real layout mode; board auto-scale REUSED (it already eats resolution changes) |
| 17 | i18n / styling / motion | `$t`/`v-i18n` + `ru/*.json` (+dupe guard), LESS design system (`cab-*`, `.premium-tooltip`, dark glass), `motionTokens` (`motionMs`, `--motion-scale`, frame gate, reduced-motion) | Mature | **REUSE wholesale**; console adds its own LESS namespace + type scale on top (§12) |
| 18 | Existing gamepad plan | `src/client/gamepad/*` (poll model, core, input mode, settings, spatial nav, focus engine, scopes), `components/gamepad/*` (layer, ring, hints, glyphs) | Shipped, phases 1–4 | Split verdicts — full matrix in §14 |

---

## 4. Console UX principles

The rules everything below must obey:

1. **Commands over cursors.** Face buttons execute *labeled commands on the
   selected object*; navigation exists only between game objects, never
   between UI controls.
2. **One decision per screen.** Complex inputs become sequenced task screens
   (Wingspan idiom), not dense multi-widget modals. Each screen answers one
   question and shows its consequences.
3. **One place for details.** A single, large, stable inspector panel
   replaces every hover popover/tooltip. If information used to appear on
   hover, it now appears in the inspector when the object is selected.
4. **Always show the verbs.** The command bar is permanent; the Turn Menu
   lists everything the server offers *right now* with availability +
   reasons. Nothing is behind a memorized button; blocked verbs are shown
   disabled with the same server-derived reasons the desktop uses.
5. **Constrain by default, free on demand.** Where the game defines the
   legal set (placement cells, selectable cards), navigation walks the legal
   set; a held modifier widens to everything for inspection.
6. **The board is home.** Idle state is the board; every task returns there
   (or to the section it interrupted). The player can always answer "where
   am I" from the section strip and "what now" from the task banner.
7. **B always retreats one level and never destroys.** Command → object →
   section home; inside tasks: step back → minimize (never dismiss a
   mandatory prompt) — mirroring the server's own cancellability markers.
8. **TV-readable or it doesn't ship.** Nothing below the type floor (§12),
   no information that only exists at desktop density.
9. **Same brain, same truth.** Availability, reasons, previews, submissions
   — all from the existing server contracts and detection helpers. Console
   mode adds zero parallel game logic.
10. **Desktop untouched.** Console mode is additive; entering/leaving it
    never mutates desktop state beyond what a reload already does.

---

## 5. Proposed interaction model

### 5.1 The model: Zones → Objects → Commands (+ a Task Stack)

Three navigation levels, each with its own control:

- **Level 1 — Sections** (LB/RB + visible section strip): `Board` · `Hand` ·
  `Table` (tableaus: mine/opponents with Played/Actions/Effects tabs) ·
  `Journal` · `Colonies` (only when the expansion is on). Coarse, cyclic,
  instant. This replaces walking to bottom-bar buttons AND the entire
  `activeOverlay` zoo.
- **Level 2 — Objects** (left stick / d-pad): within a section the player
  moves between *game objects* — hexes, cards in the hand carousel, action
  rows, journal entries, colony tiles. Object counts are managed by design:
  carousels with sorted/filtered lanes, legal-set constraint in placement,
  trigger-jumps ("next playable"). Selection is remembered per section.
- **Level 3 — Commands** (face buttons, zero navigation): the selected
  object's verbs appear on the bottom command bar — e.g. hand card selected:
  `A Разыграть · X Продать (в режиме продажи) · Y Меню хода · B Назад`.
  Verbs never render as on-screen buttons to walk to.

Plus two cross-cutting surfaces:

- **The Turn Menu (Y)** — the console's answer to "what can I do": one
  vertical premium list of every verb derived from the CURRENT
  `waitingFor` action menu (the same detection contract the dedicated
  desktop buttons use): Play card · Standard projects · Claim milestone ·
  Fund award · Trade · Build colony · Convert plants/heat · Hydronetwork ·
  Sell patents · End turn · Pass. Each row: icon + name + cost chip +
  availability; blocked rows visible with the reason. Choosing a verb jumps
  to the right section/mode or opens a sheet/task. Evaluated against a
  radial wheel and rejected it (§15) — TM verbs need cost/reason annotations
  and long Russian labels; a list reads at 3 m, a radial doesn't.
- **The Task Stack** — every mandatory prompt is a *task* (§10). Tasks take
  input priority, render as focused screens/sheets, stack when nested
  (choiceContext names the source), and can be minimized to a docked chip
  when the player needs to inspect the world first (the audited minimize
  semantics, console-styled).

### 5.2 Answers to the model questions

- **Home state during a turn**: Board section + status strip + turn banner
  («Ваш ход — Y: действия») + command bar. Nothing else on screen.
- **Knowing what's available**: Turn Menu (complete, annotated) + turn
  banner + command bar. Between turns the banner says who acts.
- **Jumping between zones**: LB/RB sections; Y Turn Menu verbs deep-link
  (e.g. `Fund award` opens the Awards sheet directly); View toggles Journal
  peek; R3 recenters Board.
- **Returning to previous context**: B pops one level; sections remember
  their last selected object; finishing/минимизируя a task returns exactly
  where the player was (section + object restored).
- **Not getting lost**: max depth is 3 (section → object → task step); the
  section strip + task banner are always visible; there is exactly ONE modal
  surface at a time (the top task).
- **Invalid actions**: never hidden — Turn Menu rows and object commands
  render disabled with the server's reason strings (the same
  `unplayableReasons`/`actionReasons`/blocker-reason infrastructure),
  displayed inline (no hover needed).

---

## 6. Top-level console shell concept

Persistent chrome (everything else is contextual):

```
┌────────────────────────────────────────────────────────────┐
│ STATUS STRIP  °C · O₂ · океаны · [Венера] · поколение ·    │  ← top, always
│               игроки (мини-карточки: TR, ресурсы-суммарно) │
│        [TASK BANNER: ожидает решения / чей ход]            │  ← appears under strip
├────────────────────────────────────────────────────────────┤
│ SECTION STRIP  ДОСКА · РУКА · СТОЛ · ЖУРНАЛ · [КОЛОНИИ]    │  ← thin, LB/RB
│                                                            │
│                  ACTIVE SECTION VIEWPORT        ┌─────────┐ │
│                  (board / carousel / lists)     │INSPECTOR│ │  ← right dossier
│                                                 │  panel  │ │    (context obj)
│                                                 └─────────┘ │
├────────────────────────────────────────────────────────────┤
│ COMMAND BAR   контекст · Ⓐ verb · Ⓧ verb · Ⓨ Меню · Ⓑ back │  ← bottom, always
└────────────────────────────────────────────────────────────┘
```

- **Status strip** (top): global parameters with big markers, generation,
  compact player cards (color, TR, key resources, active-player glow). This
  *replaces* the desktop's scattered scale markers + player list for TV
  legibility. Selecting a player mini-card (up on d-pad from a section) =
  quick path to their Table view.
- **Section strip**: labels + glyph hints for LB/RB; active section
  highlighted. Thin — it's a wayfinder, not a menu.
- **Inspector panel** (right, ~28–30% width): THE detail surface. Cell
  dossier (BoardInformation facts), full-size card render + reasons, action
  details + per-game stats, journal entry expansion, colony detail. One
  location, always the same place to look. On tasks it shows consequences.
- **Command bar** (bottom): current context name (left) + up to 4 glyph +
  label commands (right) + scroll/trigger hints when relevant. It IS the
  hint system — iteration 1's hint bar generalized into the primary
  interaction surface.
- **Task banner / minimized task chips** (top-center under status): the
  current obligation or paused tasks («ОЖИДАЕТ РЕШЕНИЯ — Выбор карты», View
  restores).

Explicitly NOT in the shell (evaluated, rejected — §15): radial menu,
persistent quick-access grids, an action-history drawer (Journal section
covers it), a permanent notifications column (toasts become brief +
informational; actionable content always arrives as a task).

---

## 7. Board mode concept

- **Always visible, always home.** The Board section is the default and the
  return point. The board keeps its auto-scale machinery; on TV it grows
  into the freed space (the desktop chrome around it is gone).
- **Free inspection**: d-pad/stick walks hexes (geometric adjacency — the
  shipped `spatialNav` is reused as pure math for hex traversal only, inside
  the console's own router). The selected hex gets the spotlight treatment;
  its dossier (existing `boardCellInfo` facts: bonuses, owner, scoring, lore,
  zone protection) renders in the inspector — *the hover inspector's data,
  re-homed*. No popovers at the cell.
- **Placement mode (a task)**: when a `SelectSpace` task is active —
  - navigation is **constrained to legal cells** (fast, Wingspan-like);
    ordered geometrically so the stick still feels spatial;
  - **LT held = free-roam** over all cells to inspect *why* an illegal cell
    is illegal (the `PlacementIllegalReason` + deficit data renders in the
    dossier — the one-unavailability-system rule preserved without hover);
  - A on a legal cell → the **placement preview** (existing
    `BoardPlacementPreview` facts: cost / you get / others get / endgame /
    warnings) fills the inspector; command bar: `A Разместить · B Другая
    клетка · X Отменить размещение` (X present only when the server's
    `placementContext.cancellable` says so — reason shown otherwise);
  - A again commits through the same per-cell click contract.
- **Zoom/pan**: not required at 1080p (single-screen no-scroll goal already
  guarantees fit); optional right-stick pan + R3 recenter reserved for 4K
  polish. Decision deferred — not load-bearing.
- **Special surfaces**: off-Mars slots and colony/Venus cells are ordinary
  navigable objects with their dossier facts; Ares hazards/adjacency ride
  the same facts pipeline (already board-info-integrated).
- **After placement**: task pops; focus returns to the pre-task context;
  the placed cell pulses via the existing `boardCellHighlight`; the delta
  chips/journal/notifications behave as today.
- **Board command layer**: none beyond this — the board needs no radial; its
  two modes (inspect / place) + inspector + command bar cover it.

## 8. Card mode concept

- **The Hand section = filmstrip carousel + persistent inspector.**
  - Bottom half: one row of card thumbnails (readable art + name + cost),
    **sorted playable-first**, horizontally navigated with snap; selection
    centered and enlarged (~1.15×) with neighbors receding — a physical
    "fan" feel.
  - Right/center: the **inspector renders the selected card near-full-height**
    — at TV distance this IS the zoom, permanently. Below the render: the
    playability verdict (mint «Можно разыграть» / the server's reason list),
    cost after discounts, and (when known cheaply) the on-play result chips.
  - **Finding playable cards fast**: playable-first sort + RT/LT jump to
    next/previous *playable* + bumper-independent **filter lanes** cycled
    with X-hold or d-pad-up (Все / Можно разыграть / по тегам) — evaluated
    grid vs lanes vs piles: a 1-row carousel keeps object count per screen
    ~7 while the filters + jumps keep worst-case traversal ≤ a few presses;
    a "grid glance" (press up / X) shows the whole hand as a TV-safe coarse
    grid for orientation, selection returns to the carousel.
  - **Play**: A on a playable card starts the **play task** (§10): targets →
    payment → confirm, the card render docked throughout — re-hosting the
    exact preview/step/payment data `HandCardPaymentContent` uses today,
    presented as sequential screens instead of one dense modal.
  - Sell patents / mandatory select-from-hand: the same carousel in a
    *selection task skin* (amber/cyan strip, X toggles pick, counter
    «Выбрано N/M», A confirms when valid) — the desktop sale/select modes
    re-skinned, same payloads.
- **Draft / research / buy**: dealt sets are small (2–10) → a pick task:
  the same carousel+inspector with a pick counter and per-card cost badge;
  LT/RT compare quickly; X toggles; A confirms. The navigable zoom browser
  survives here as "compare view" if the player wants edge-to-edge art.
- **Source/target card flows** (add-resource targets, copy-production,
  played-card picks): the candidate set renders as a dedicated pick task
  (carousel of candidates + inspector showing the per-candidate
  `current → resulting` impact line the previews already provide);
  non-candidates available under LT free-roam with reasons. No more
  routing the player out to a different overlay mid-modal — the task
  brings the candidates to the player.
- **Opponent tableaus** (Table section): grouped **lanes** (corp/preludes ·
  active · automated · events) navigated as rows of compact cards +
  inspector; the played-cards analytics (table mode) becomes an inspector
  tab, not a separate view.
- **50-cards problem, answered**: sorted lanes + filters + playable-jumps +
  grid glance + remembered position. Traversal is never the primary tool;
  it's the last 2–3 presses after a jump.

## 9. Action / overlay mode concept

Per-surface disposition (desktop → console):

| Surface | Desktop today | Console problem | Console concept | Nav model | Fallback |
| --- | --- | --- | --- | --- | --- |
| **Actions** | Master-detail overlay, arrow-nav, confirm modal | Dense 3-col grid, small rows | **Table→Мои действия tab**: big rows (icon graphic + name + availability badge), inspector = details/stats/reason; A opens the activate task (branch → targets → confirm) | d-pad rows; A task; RT jump-to-available | DOM engine |
| **Effects** | Master-detail analytics overlay | Read-only, dense | **Table→Эффекты tab**, same rows + inspector stats; no verbs beyond inspect | d-pad; read-only | — |
| **Colonies** | Teleported overlay + trade modal | Tile grid + bespoke modal | **Colonies section** (present when expansion on): tile carousel + inspector (track, bonuses, who's there); verbs: `A Торговать` (payment step = lane stepper task) / `Построить` in build tasks; disabled reasons inline | carousel; tasks | DOM engine |
| **Standard projects** | Top dropdown rows | Small rows, hover hints | **Sheet** from Turn Menu: 8 big rows with cost/effect chips + reason; A starts (payment/placement tasks follow) | d-pad rows | — |
| **Milestones / Awards** | Dropdowns + badge strips | Same | **Sheets**: 3–6 big rows, per-player progress bars readable at distance; A claims/funds (confirm step) | d-pad rows | — |
| **Journal** | Side panel, hover chips, dropdown selectors | Hover-dependent chips, small text | **Journal section**: full-height feed, TV type, generation/filter via LT/RT + top selectors; selected entry's cards/colonies render in inspector; «показать на карте» = A on a space token (jumps Board + pulse) | stick scroll + d-pad entries | — |
| **Victory points** | Bar-overlay report | Fine structure, small | **Sheet/tab in Table→Я**: same pure model, bars re-scaled; segment↔legend cross-link driven by d-pad | d-pad segments | — |
| **Notifications** | Floating cards w/ CTAs, hover-pause | Hover/click CTAs conflict with global buttons | **Informational toasts only** (TV-size, auto-dismiss); anything actionable already arrives as a task/turn banner; «показать в журнале» becomes: open Journal section → the entry is pre-highlighted (deep-link kept) | none (passive) | — |
| **Drawn cards reveal** | Full-screen tray + take | Already close to console idiom | **Task screen**: carousel + inspector + `A Взять все` | carousel | — |
| **Endgame** | Premium full-screen tabs | Small tabs/чипы | **ADAPT in place**: TV type ramp, LB/RB tabs, command bar verbs (replay/rematch/home), story sections paged by stick | bumper tabs | — |
| **Rematch** | Modal + pill + toast | Small controls | Task (vote) + banner (status); verbs on command bar | task | — |
| **Start game / corp / prelude / initial draft** | Orchestration modals, already stepped | Density only | **Task chain**: corp pick → preludes (carousel+inspector each) → corp effect → «Начать партию» hero screen; the existing `startGamePrompt` markers drive it unchanged | carousel + A | — |

The **`activeOverlay` machine is not used** in console mode — sections/sheets/
tasks are the console shell's own state. Module data states (filters,
journal, stats caches) are shared so switching modes never loses state.

## 10. Mandatory prompt concept — the Task System

The console's replacement for `MandatoryInputModal` + `ModalInputHost`
*presentation* (their routing + transport are reused untouched):

- **Derivation**: the same `waitingFor` routing WaitingFor.vue performs
  today maps each input shape to a **TaskKind**: `choice` (OrOptions) ·
  `payment` · `board-target` · `card-pick` · `player-pick` · `amount` ·
  `distribute` · `wizard` (composite play/activate) · `info` (reveals).
- **Presentation by weight**, not one-size modal:
  - *Light* (≤5 options, confirm, player pick) → **center panel** over a
    dimmed board: big option rows with the existing metadata chips
    (`current → resulting`, tradeoffs, disabled targets w/ reasons), source
    card docked left when `choiceContext` names it. Select → A;
    risky options (tradeoff/warnings) require a second A on an inline
    «Подтвердить?» state — the confirmRisky semantics, console-skinned.
  - *Medium* (payment, distribute, amount) → **bottom-sheet task**: the
    stepper as horizontal **lanes** (one lane per resource: icon, big value,
    stock `current → after`); d-pad up/down picks lane, left/right ±1,
    LT/RT ±5, X = MAX; a live «Итог: 14/18 M€» readiness bar; A confirms
    when valid. No +/− buttons exist — adjustment is directional input.
  - *Heavy* (play card, blue action, trade, build colony, draft) →
    **task screens/wizards**: full-viewport steps with step dots
    («Цели 1/2 → Оплата → Подтверждение»), the source object docked, each
    step one decision, the final step always a consequence summary (the
    existing preview chips: result, VP, warnings, «после подтверждения»).
  - *Board/card hybrids*: the wizard step *changes the active section*
    (board-target step = placement mode; card-target step = pick carousel)
    while the task frame (banner + step dots + docked source) persists —
    the player never wonders why they're suddenly on the board.
- **B semantics**: inside a wizard — back one step; at the root of a
  mandatory task — **minimize** to the docked task chip (top-center), world
  becomes inspectable, all turn verbs naturally disabled (the server is
  still waiting — same invariant as today); View or A-on-chip restores.
  B never dismisses what the server can't cancel; where the server marks
  cancellable (`placementContext`, client-side previews), an explicit
  «Отменить» command appears on X — cancellation is always a labeled verb,
  never an ambiguous B.
- **Source & why**: every task header carries the trigger line + source
  chip (`choiceContext` / `startGamePrompt` / card being played) — reusing
  the exact markers built for the desktop contextual modal.
- **Nested prompts**: push onto the task stack; the banner shows depth
  («Шаг вызван: Pharmacy Union»); resolving pops back seamlessly.

## 11. Button model

Global grammar (stable spine — same muscle memory everywhere), with the
command bar always displaying the *current* meaning so nothing relies on
memory:

| Control | Global meaning | Contextual refinements (always labeled) |
| --- | --- | --- |
| **A** | Confirm / primary verb on selection | Play card · Place here · Trade · Claim · Take all · Choose option |
| **B** | Back one level; minimize a root mandatory task | Never destructive, never dismisses mandatory |
| **X** | The context's secondary verb | Toggle pick (multi-select) · MAX (payment) · Grid glance (hand) · Cancel placement (only when server-cancellable) · View toggle (played table) |
| **Y** | Turn Menu (on your turn) | In read-only contexts: full-card compare view |
| **LB / RB** | Section switching | Inside tasks/sheets/endgame: tab switching (the *container's* horizontal axis — consistent metaphor: bumpers always move between peer panes) |
| **LT / RT** | Fast modifier | Hand: prev/next *playable* · Payment: ±5 · Journal: prev/next generation · Board: LT-hold = free-roam over illegal cells |
| **Left stick / d-pad** | Object navigation (stick = continuous, d-pad = precise single steps) | Payment lanes: up/down lane, left/right adjust |
| **Right stick** | Scroll (feed, long lists); optional board pan | — |
| **R3** | Recenter board / jump to board | — |
| **L3** | (reserved — no default; candidate: toggle status-strip player detail) | — |
| **View** | Minimize/restore current task; long-press: quick Journal peek | — |
| **Menu** | System: controls legend, settings (deadzone, glyphs), mode exit | — |

Rationale highlights: A/B follow the universal console contract; X is the
"safe contextual slot" because it is always labeled and adjacent contexts
keep it in the same *family* (toggle/secondary); Y is reserved for the Turn
Menu because "what can I do" deserves a face button; bumpers = peer-pane
motion at every level (sections, tabs) so one metaphor covers all
horizontal container switching; triggers = "the same axis, faster/modified".
Alternatives considered: Menu for Turn Menu (too far for the most-used
verb), A-hold for quick-confirm (hidden, rejected), X as universal cancel
(conflicts with toggle semantics; cancel must be rarer and explicit).

Learnability plan: the command bar teaches passively; the Menu legend shows
the full map; the first console-mode session shows a one-time 3-step
premium orientation (skippable, never again).

## 12. TV / fullscreen visual design

- **Type ramp** (10-foot rules; all via a root `--console-scale` so 4K is a
  multiplier, not a redesign): body 24 px min @1080p (secondary floor
  20 px), command bar 26 px, section strip 22 px, panel titles 32–40 px,
  hero numbers (params, TR) 44–56 px. Desktop's 11–13 px chips do not
  survive — every datum that matters is re-set at scale or moved to the
  inspector.
- **Safe area**: 5% overscan margins (≈48 px @1080p / 96 px @4K) on every
  edge; nothing interactive or informational in the margin band.
- **Layout, not scaling**: the shell is a NEW composition (status strip /
  viewport+inspector / command bar). Cards render at inspector size
  (~55–65% viewport height) instead of dense grids; lists become big rows
  (≥64 px) with generous spacing; maximum two content panes + chrome at once.
- **Selection = spotlight, not ring**: the selected object scales ~1.05,
  gains the cyan frame + L-ticks + soft glow, siblings in the same lane dim
  ~15% — object-level treatment readable at 3 m (iteration 1's 1 px ring is
  a desktop instrument). Blocked/illegal = desaturate + red rim + inline
  reason line (never only color).
- **Contrast & noise**: dark glass stays, but console surfaces use higher
  text-contrast tokens (WCAG-ish ≥7:1 for body on glass), fewer
  simultaneous glows, board art slightly dimmed behind sheets/tasks.
- **Deltas & feedback**: the delta-chip system survives with a TV size
  variant; hostile/important notifications get the toast at TV scale;
  blocked input = the spotlight shake + a short reason toast near the
  command bar (+ haptic tick).
- **Motion**: everything through `motionTokens` (`motionMs`, eases,
  `--motion-scale`); section transitions are short slides/fades (≤180 ms
  base) — calm, no carousel physics beyond snap easing;
  `prefers-reduced-motion` collapses slides to fades/instant.
- **Tooltips**: do not exist. Their content is redistributed: object details
  → inspector; disabled reasons → inline lines; ambient help → Menu legend.

## 13. Architecture concept

- **Mode**: a runtime shell split, NOT a separate route. `consoleModeState`
  (module reactive + `tm_console_mode` persistence + `?console=1|0` URL
  override + the kill switch). Entry: manual toggle in settings/system menu
  + a **prompted entry** — first pad input while in desktop mode shows a
  premium «Перейти в режим контроллера?» card (A = yes, remembered);
  Electron fullscreen may auto-suggest once. NO silent auto-switch of
  layout (evaluated, rejected — a full-shell swap must be consented).
- **Mounting**: in `App.vue`, `screen === 'player-home' && consoleMode` →
  `<ConsoleShell :playerView …>` mounts **instead of** `<PlayerHome>`. The
  App-level layers are re-evaluated per-layer: `WaitingFor` logic must run
  in both (it is the transport/brain) — it already lives inside PlayerHome's
  tree today, so the shared piece is extracted or ConsoleShell hosts its own
  `<WaitingFor>` instance with rendering suppressed (concept-level: the
  transport must be exactly-once; resolve in prototype).
- **The turn-intent extraction** (the one real refactor): PlayerHome's
  detection/submission helpers (`findMilestoneOptionPath`,
  `playProjectCardAction`, `standardProjectsAction`, sell-patents/convert
  detection, `submitInnerActionResponse`, batch assembly…) move to shared
  pure modules (`src/client/turn/…`), consumed by BOTH shells. Low-risk:
  they are already near-pure functions over `playerView.waitingFor`;
  desktop behavior is unchanged by the move (guarded by existing specs).
- **Console component tree**: `src/client/components/console/`
  (`ConsoleShell`, `ConsoleStatusStrip`, `ConsoleCommandBar`,
  `ConsoleInspector`, `ConsoleTurnMenu`, sections, sheets,
  `consoleTasks/*`) + `src/styles/console/*.less` (own namespace, imported
  last; `--console-scale` root). Shared presentational components (Card,
  Board, BoardSpace, payment form internals, journal feed pieces, endgame
  tabs) are consumed with console props/wrappers — never forked.
- **Input routing**: iteration 1's core emits the same semantic intents; in
  console mode a **console command router** (an explicit state machine:
  `section × selection × taskStack`) consumes them FIRST; anything it marks
  unhandled falls through to the demoted DOM focus engine (fallback for
  un-migrated surfaces + `?gpDebug`). The router's state machine is pure and
  unit-testable (state + intent → state + effects), mirroring the fork's
  pure-model test discipline.
- **Command/verb abstraction**: one `ConsoleCommand` type
  `{glyph, label(i18nKey), enabled, reason?, execute}` produced by
  section/task providers; the command bar renders it, the router executes it
  — execution funnels into the SAME turn-intent helpers / existing handlers
  (invariant: no parallel submit).
- **Overlay/teleport/z conventions**: console layers use the same body
  teleports + a reserved z-band; desktop overlays never mount in console
  mode (their module states remain shared).
- **i18n**: all console strings через `ru/ui.json`/`console.json` (new
  file, same union build + dupe guard).
- **Settings/debug/kill**: `gamepad_enabled` still gates input; console
  mode adds `tm_console_mode`, `?console=0` hard-off, `?gpDebug` extended
  with router state; per-phase rollback = the mode flag itself (desktop
  path untouched).
- **Testing strategy**: pure router/state-machine + task-mapper + hint/command
  derivation specs under the server runner; component specs (mochapack) for
  command bar/inspector rendering; the shipped pure input specs stay.

## 14. Reuse/rework matrix from the previous plan

| Iteration-1 piece | Verdict | Why |
| --- | --- | --- |
| `gamepadPollModel` (edges/repeat/deadzone/hysteresis) | **Keep as-is** | Pure, tested, presentation-free |
| `gamepadCore` (rAF loop, connect/disconnect, active pad, visibility) | **Keep as-is** | The intent source for both modes |
| `inputModeState` (gp-mode class, isTrusted exit, hysteresis) | **Keep; extend** | Cursor hiding still right; in console mode pointer activity should *offer* exiting to desktop, not silently flip layout — the mode machine gains a "layout consent" layer |
| `gamepadSettings` (`?gp=0`, deadzone, debug) | **Keep; extend** | Add console-mode flags |
| `glyphSets` / `GamepadGlyph` | **Keep** | The command bar consumes them; PS/Switch path unchanged |
| Hint bar + `hintModel` | **Demote/absorb** | Superseded by the command bar (a hint bar that *is* the control surface); the pure-derivation pattern carries over |
| DOM focus engine + descriptors + synthetic hover + `.gp-focus` tooltip gate | **Demote to fallback** | Not the UX; kept for un-migrated corners (residual legacy AndOptions, dev), and as the safety net while console sections land incrementally |
| Focus ring | **Demote to fallback** | Console selection is the object spotlight; the ring only appears when the fallback engine drives |
| Scope resolver (`SCOPE_DEFS`) | **Conceptually reused, re-implemented** | The console router's context stack is its descendant; the DOM-query resolver itself stays only with the fallback engine |
| `spatialNav` geometry | **Keep as library** | Hex/board traversal + any geometric picking inside console sections |
| LB/RB overlay cycling via `data-gp-overlay` | **Replace** | Sections replace the overlay ring; attributes stay (harmless, used by fallback) |
| Kill switch / test strategy / i18n discipline | **Keep** | Unchanged |
| Haptics (planned, unbuilt) | **Carry over** | Now scoped to console feedback moments (confirm/deny/place) |

## 15. Options considered and rejected

| Option | Verdict |
| --- | --- |
| **Extend the DOM focus engine as the UX** | Rejected as target (kept as fallback): reaches everything, redesigns nothing; density/IA/hover problems unsolvable from the interaction layer |
| **Virtual cursor** | Rejected: the archetypal bolt-on; imprecise on hexes; banned by brief |
| **Separate route/view (`/console`)** | Rejected: duplicates the data/lifecycle layer (polling, holds, reset semantics), splits session URLs, invites drift; runtime shell split gives the same freedom without a second brain |
| **Silent auto-switch of layout on pad input** | Rejected: a full-shell swap mid-glance is disorienting; consented prompt instead (input-mode switching *within* a shell stays automatic) |
| **Radial wheel as the primary verb surface** | Rejected: TM verbs need cost/availability/reason annotations and long ru labels; ≤8 short-verb wheels don't fit; a vertical Turn Menu reads at 3 m. May return later as an optional power-user layer |
| **Preserving the overlay zoo with console skins** | Rejected: ten overlays is mouse IA; consolidation into sections/sheets/tasks is the point of the mode |
| **One universal modal for all mandatory inputs** | Rejected: weight-based presentation (panel/sheet/wizard) matches decision complexity; one-size was the desktop compromise |
| **Wholesale UI scaling (zoom desktop 2×)** | Rejected: density and hover-dependence scale with it; layout must change |
| **Command palette (text-filtered)** | Rejected: text entry has no place on a pad; the Turn Menu is its controller-native cousin |
| **Making every notification interactive on TV** | Rejected: CTA buttons on transient toasts conflict with global button meanings; tasks/journal carry the actionable content |

## 16. Open questions / risks

1. **Two-shell maintenance tax** — every future feature must ship in both
   shells. Mitigation: the shared turn-intent/data layer, shared
   presentational components, and a **console coverage checklist** appended
   to CLAUDE.md's expansion checklist (a guard test enumerating waitingFor
   shapes → task mappings, mirroring `cardPlayPreviewCoverage`). Residual
   risk: real; accepted consciously.
2. **`WaitingFor` exactly-once transport** — extracting/hosting it outside
   PlayerHome without double-polling or double-holds needs a careful
   prototype (holds/animation gates interplay).
3. **Animation gates in console layout** — energy-conversion/tile/WGT gates
   anchor to desktop DOM (`data-conversion-cell` rects). Console equivalents
   needed per gate; until then gates must degrade gracefully (they already
   no-op when anchors are absent).
4. **Board hex traversal feel** on stick (diagonal rows) — geometry is
   probably enough (iteration 1 tests pass on hex offsets), but the
   adjacency-graph fallback should stay on the table.
5. **Task-mapper completeness** — the long tail of prompt shapes
   (AndOptions legacy, exotic deferreds). Fallback engine covers the tail
   at reduced polish; the coverage guard test quantifies it.
6. **TV hardware validation** — real 1080p/4K TV + Xbox pad sessions are
   unscriptable; needs a human pass per prototype milestone (Electron
   fullscreen on a TV is the reference rig).
7. **Spectator & hot-seat** — out of scope v1; the shell split makes them
   additive later.
8. **Where does the inspector live on ultrawide/16:10** — layout QA item.
9. **Exit ergonomics** — leaving console mode back to desktop (Menu →
   «Режим рабочего стола») must restore desktop state losslessly (module
   states shared, so mostly free — verify overlay/pill edge cases).

## 17. Prototype plan (recommended validation order)

**P0 — the load-bearing slice (validates all three core bets):**
ConsoleShell skeleton (status strip + section strip + command bar +
inspector frame) · console command router (pure state machine + specs) ·
**Hand section** (carousel + inspector + playable-first + trigger jumps) ·
**Turn Menu** over the real waitingFor · **one heavy task end-to-end**: play
a card (targets → payment lanes → consequence confirm) submitting through
the existing batch path · fallback pass-through for everything else.
*Done =* a real turn: browse hand → play a card with payment → pass — on a
pad, on a TV, without the fallback engine engaging once.

**P1 — board placement**: placement task (constrained nav + LT free-roam +
dossier previews + cancellable X), convert-plants flow, focus-return.

**P2 — sections completion**: Table (tableaus/actions/effects tabs + activate
task), Journal, sheets (milestones/awards/standard projects), colonies task.

**P3 — orchestration + endgame**: start-game task chain, draft tasks,
endgame TV adaptation, rematch verbs; the coverage guard test; the
first-run orientation.

Each prototype ships behind `tm_console_mode` + `?console=0`, with desktop
byte-identical throughout. Go/no-go after P0 — if carousel+inspector+task
does not *feel* like a console game on a real TV, the concept iterates
before any breadth work.

---

# CONSOLE TASK SYSTEM (CTS) — the fallback-retirement plan

> **The authoritative plan for making EVERY user input console-native.**
> Status: PLANNED (this section). The fallback engine is hereby demoted
> from "the safety net the console leans on" to "a dev-only debugging
> instrument": no production input path may depend on it once CTS ships.

## CTS-0. Diagnosis — why the fallback foundation failed

The reported field bugs (initial-draft cards invisible — only the
«ТРЕБУЕТСЯ ДЕЙСТВИЕ» pill; colony build unreachable; inter-generation
draft breaking) share ONE root cause taxonomy, confirmed by audit:

| Class | Root cause | Concrete confirmed instances |
| --- | --- | --- |
| **C1 — Missing host** | Prompts whose dedicated premium surface is HOSTED BY PlayerHome — which is NOT mounted in console mode. The prompt becomes invisible; only the notification survives. | `InitialDraftFlowOverlay` (PlayerHome:651 → initial draft = pill-only, the reported bug), `ColoniesOverlay` (PlayerHome:661 → build-colony SelectColony dead end), hand overlay modes (mandatory select/sale/play-from-hand), `AwardsOverlay` free funding, Standard-Projects play prompt |
| **C2 — Suppression hand-off into the void** | App-level flows SELF-SUPPRESS in favor of C1 surfaces (`DraftFlowOverlay` yields to `handCardSelectionPrompt` / corp-selection — surfaces that don't exist in console) → both render nothing. | inter-generation draft / research-buy edge states |
| **C3 — Dead desktop event bridges** | Window-event contracts target PlayerHome listeners: `tm-notification-go-to-action` (the pill CTA on the screenshot does NOTHING in console), pick-bridges (`pick-card`/`pick-played-card`/`pick-action`), notification cancel. | action-required CTA, >3-candidate target picks |
| **C4 — Fallback fragility & alienness** | Even where the DOM focus engine drives a desktop modal successfully, the result is desktop-dense, hover-shaped, animation-gated (deal/entered flags) UI at TV distance — functional at best, never native, and brittle (scope resolution + suppression flags + teleport timing interplay). | every `MandatoryInputModal`-hosted premium input in console |
| **C5 — No completeness guard** | Nothing enumerates "every input shape × console surface", so every new prompt silently lands on C1–C4. | the whole class keeps regenerating |

**Conclusion:** the console must own a COMPLETE, first-class task layer for
all user input. Reuse stays at the DATA/CONTRACT level (walkers, models,
preview endpoints, submission payloads — byte-identical); reuse at the
SURFACE level (mounting desktop overlays/modals and driving them
synthetically) is what dies.

## CTS-1. Target architecture

```
playerView.waitingFor ──► consoleTaskRouter.taskFor(view)  ──► ConsoleTask
                                     │                            (typed)
        client-initiated flows ──────┘
        (play card, trade, sale, …)

ConsoleTask ──► ConsoleTaskHost (ONE mount point in ConsoleShell)
                   ├─ TaskFrame (title · source chip · step dots · banner)
                   ├─ task body = ONE console component per TaskKind
                   └─ TaskCommandBar contract (commands derived FROM the task)
```

1. **`consoleTaskRouter.ts`** — a PURE, exhaustively-tested mapper:
   `taskFor(playerView) → ConsoleTask | undefined`. It re-implements the
   ROUTING knowledge that today lives across `WaitingFor.
   useModalForCurrentInput` + PlayerHome's dedicated-surface predicates +
   the App-level flow gates — as one visible table. `ConsoleTask` is a
   discriminated union: `{kind: TaskKind, …typed payload…}`.
2. **`TaskKind` (the closed union — the completeness anchor):**
   `choice` (or/option) · `player` · `amount` · `resource` ·
   `distribute` (resources/productionToLose) · `payment` ·
   `cardSelect` (draft/buy/discard/keep/target — ONE browser, many modes) ·
   `projectCard` (play-from-hand / std-project prompt) · `space`
   (existing placement ✓) · `colony` (build/select) · `composite`
   (and-options) · `initialDraft` · `startSequence` · `reveal` (info) ·
   `aresGlobal` · `unknown` (guarded — see CTS-7).
3. **`ConsoleTaskHost.vue`** — the single surface: full-screen/sheet task
   frame in the console language; hosts the task body; owns focus (the
   console router feeds it intents directly — the DOM engine is NOT in the
   loop); submits via the SAME `WaitingFor.onsave/onsaveBatch` refs.
4. **WaitingFor stays the headless transport**, but in console mode its
   MODAL RENDERING is disabled entirely (a `headless` prop): no
   `MandatoryInputModal`, no `DraftFlowOverlay` hand-offs — the task router
   is the one consumer of `waitingFor` shape. (`SelectSpace` keeps its
   headless board-wiring role.)
5. **App-level flows in console:** `DraftFlowOverlay`,
   `InitialDraftFlowOverlay` (must ALSO move/duplicate its mount to App or
   be re-hosted — it currently dies with PlayerHome), `StartGameFlowOverlay`
   are gated OFF in console mode; their STATE modules (predicates, draw
   choices, `startGamePrompt` markers, pipelines) are consumed by the
   equivalent console tasks. Zero desktop surface mounts in console.
6. **Event-bridge re-targeting:** every `window` event contract
   (`tm-notification-go-to-action`, notification cancel, pick-bridges)
   gains a console listener in ConsoleShell/TaskHost; the pick-bridges
   RESOLVE INSIDE tasks (the card browser hosts the candidate pick — no
   cross-overlay round-trip at all).
7. **The fallback engine** remains ONLY for: `?gpDebug` diagnostics, the
   desktop-gamepad mode (non-console), and a temporary per-phase escape
   hatch behind `?ctsOff=<kind>` during rollout. It is never the shipping
   path for a console input.

## CTS-2. Complete input inventory (the routing table)

Every row = a user-input case; every row gets a console surface + a phase.
This table IS the coverage contract (mirrored by the guard test, CTS-7).

| # | Input case | Today in console | Console target (CTS) | Phase |
| --- | --- | --- | --- | --- |
| 1 | Action menu (`or` 'Take first/next action') | native (Turn verbs) ✓ | keep | — |
| 2 | Card-driven `or` / triggered choice (`choiceContext`) | fallback modal | **ChoiceTask**: option rows w/ metadata chips, source card docked, risky = two-step A | T1 |
| 3 | `option` confirm / warnings | fallback modal | ChoiceTask (single-row degenerate) | T1 |
| 4 | `player` target | fallback modal | **PlayerTask**: target cards w/ `current→resulting`, disabled+reasons | T1 |
| 5 | `amount` | fallback modal | **AmountTask**: lane stepper (d-pad ±, LT/RT ±5, X=MAX) | T1 |
| 6 | `resource` / `resources` / `productionToLose` | fallback modal | **DistributeTask**: resource lanes, live counter | T1 |
| 7 | `payment` (SelectPayment) | fallback modal (PaymentFormV2) | **PaymentTask**: payment lanes + readiness bar (reuses payment math/model utils) | T3 |
| 8 | Play-card flow (client, targets+payment+preview) | re-hosted desktop modal | **PlayCardWizard**: steps = targets → payment → consequence-confirm; reuses `/api/card-play-preview`, step order, batch assembly | T3 |
| 9 | Blue-card action confirm | direct submit (no preview) | **ActionWizard**: branch → targets → confirm w/ `/api/action-preview` chips | T3 |
| 10 | `card` — draft pick (inter-gen) | DraftFlow modal (fragile) | **CardBrowserTask** mode `draft` | T2 |
| 11 | `card` — research/buy | DraftFlow modal | CardBrowserTask mode `buy` (cost badges, M€ check) | T2 |
| 12 | `card` — mandatory hand select (discard/keep) | **DEAD END** (hand overlay missing) | CardBrowserTask mode `select` over `cardsInHand` | T2 |
| 13 | `card` — nested target pick (add-resource, Mars U…) | fallback modal grid | CardBrowserTask mode `target` (impact lines) | T2 |
| 14 | >3-candidate / multi-card pick bridges | **notice + abort** | resolved INSIDE CardBrowserTask (`dedupeFromSteps`, counts) — bridges retired | T2/T3 |
| 15 | Sell patents | console sale mode ✓ | fold into CardBrowserTask mode `sale` (one browser) | T2 |
| 16 | `projectCard` — play-from-hand prompt (EccentricSponsor…) | **DEAD END** | CardBrowserTask mode `play` → PlayCardWizard | T3 |
| 17 | `projectCard` — std-project prompt (EstablishedMethods) | **DEAD END** | Basics sheet auto-opened as task | T3 |
| 18 | `colony` — build/select | **DEAD END** (reported) | **ColonyTask**: the console colonies rail in pick mode (reuses `findBuildColonyContext` data: purpose, disabled reasons, cancellable) | T4 |
| 19 | Colony trade payment | re-hosted desktop modal | PaymentTask variant `tradeFee` (options = the trade OrOptions) | T4 |
| 20 | Awards FREE funding (Vitor) | **DEAD END** | Awards sheet in task mode (`awardFundingPrompt` marker) | T4 |
| 21 | `initialCards` — initial draft | **DEAD END (reported)** | **InitialDraftTask**: console wizard reusing the pipeline state (corp → preludes → CEO → projects → confirm), CardBrowserTask per step | T5 |
| 22 | Start sequence (preludes play, corp first action, begin) | fallback StartGameFlow modal | **StartSequenceTask** reusing `startGamePrompt` predicates/draw-choice state | T5 |
| 23 | `and` composite (FocusedOrganization/AeronGenomics; trade already covered) | double-fallback (legacy AndOptions) | **CompositeTask**: sequential sub-tasks, single combined submit | T7 |
| 24 | `aresGlobalParameters` | fallback modal | AresTask (lane stepper family) | T7 |
| 25 | Drawn-cards reveal / public reveals / reveal-result | fallback surfaces (work, desktop look) | **RevealTask** (info-only card browser + OK) | T6 |
| 26 | Notifications: action-required CTA | **dead button** (reported) | CTA → task focus (console listener); in console the TASK BANNER is primary, toasts informational | T6 |
| 27 | Minimize/pills | suppressed via CSS | tasks support console-native **defer** where server-cancellable/optional; banner chip restores (no desktop pills) | T6 |
| 28 | Energy-conversion / WGT / hazard holds | graceful no-op anchors | console anchors (`data-conversion-cell` on the resource rail) so the premium gates play | T6 |
| 29 | Endgame / rematch / final reveal | fallback-driven premium | console nav pass (tabs via bumpers, A/B, no minimize) — already close; formalize | T7 |
| 30 | Turmoil / Moon / Pathfinders / Underworld prompts | out of module scope | `unknown` task guard renders an honest "desktop required" panel + system-menu exit (NEVER silence) | T0 |

## CTS-3. Replacement rules (how every fallback dies)

1. **Data in, surface out.** A console task may import models, walkers,
   preview fetchers, pure fit/summary helpers and SUBMIT builders from the
   desktop flow — never mount its Vue surface. If logic is trapped inside a
   desktop component, extract it to a pure module first (the
   `paymentModelUtils` precedent), in the same PR.
2. **One browser, many modes.** ALL card-list inputs (10–16, 21 steps) go
   through ONE `CardBrowserTask` (carousel + inspector + pick counter +
   cost/impact badges + filters). No second card-selection system, ever.
3. **Submission byte-parity.** Every task's submit payload must equal what
   the desktop path sends (wrapped OR paths, batch order). Guarded per
   task by unit tests on the payload builders.
4. **Mandatory ≠ trapped.** B inside a wizard = step back; at the root:
   server-cancellable → labeled cancel; else defer-to-banner if the prompt
   tolerates it (minimize semantics), else honest «Требуется выбор». Never
   dismiss, never strand.
5. **No hover, no tooltips.** Disabled reasons, impacts, costs render
   inline or in the inspector column — always visible.
6. **Every task self-describes**: TaskFrame shows WHAT is asked, WHO asked
   (source card/corp via `choiceContext`/markers), WHAT happens on confirm
   (preview chips), and the exact button meanings (command bar contract).
7. **A new server prompt shape** must add: a `TaskKind` mapping OR an
   explicit `unknown`-guard entry — enforced by the coverage test (CTS-7).
   This rule goes into CLAUDE.md's expansion checklist when CTS lands.
8. **THE INFORMATION-PARITY CONTRACT (hard rule, user-mandated).** A
   console task must show EVERY piece of information its desktop
   counterpart shows — losing info the player used to have is a contract
   violation, not a simplification. Concretely: a SOURCE CARD is rendered
   as the actual `<Card>` (not just its name) wherever the desktop docks
   it (choiceContext source, effect source, play/action confirm, reveal
   source chips); card-target picks render the CANDIDATE CARDS themselves
   with their `current → resulting` impact lines; resource-holder lists
   render the holder CARD (the known Info-Mode extras gap — name-only —
   is the counter-example to never repeat; it gets fixed when that surface
   is next touched); costs/discounts/reasons/owners/warnings/VP-deltas all
   carry over. **Definition of done for every new task body includes a
   side-by-side parity pass against the desktop surface it replaces.**
9. **Organic integration & smooth switching (hard rule).** New console
   elements are part of ONE shell, not stacked pop-ins: task enter/leave
   and switches between console surfaces animate through `motionTokens`
   (short slide/fade ≤200ms base, `MOTION_EASE.enter/exit`), the shell
   behind stays composed (no layout jumps, no flash-of-empty), shared
   chrome (status strip / command bar) never remounts between tasks, and
   sequential tasks (wizard steps, prompt → follow-up prompt) transition
   with a keyed cross-fade instead of teardown+рop-in. Reduced-motion
   collapses travel to fades. A new element that visually "lands on top"
   of the console instead of "belonging to it" fails review.

## CTS-4. Gamepad navigation requirements (all tasks)

- Intents flow console-router → TaskHost directly; `resolveScope()` is not
  consulted for task input (the engine may still exist for `?gpDebug`).
- d-pad/stick = object navigation (rows / lanes / carousel); LB/RB = task
  pages or intra-task tabs ONLY; LT = Information Mode (allowed inside
  every non-placement task, snapshot includes the task's local selection);
  RT = task-local jump (next playable/affordable); A = select/confirm per
  frame contract; X = the labeled secondary (toggle/MAX/details); B = per
  rule CTS-3.4; Menu = system overlay (always).
- Focus is model-state (indices in the task payload), never DOM-derived;
  it survives server refreshes by key (card name / option index clamp).
- Every list is bounded-scroll with styled scrollbars; selection always
  visible (auto scroll-into-view).

## CTS-5. Visual language (task frame spec)

- **TaskFrame**: dark-glass full-bleed or bottom-sheet (by weight — the
  §10 weight rule stands), L-corner ticks, kicker (`ЗАДАЧА / ИСТОЧНИК`),
  title ≥26px, step dots for wizards, consequence strip (ActionEffect
  chips at TV scale), command footer with glyphs. Cyan = selection,
  mint = confirm/legal, amber = cost/defer, red = illegal/destructive.
- Cards render ≥1.1 zoom in browsers, selected ≥1.25 with inline Ⓐ chip;
  option rows ≥58px; body text ≥20px; overscan-safe.
- Motion via motionTokens only; reduced-motion honored; no deal-animation
  gates that can strand content (the C4 lesson): content visibility may
  never depend on an animation event.

## CTS-6. Phases (each shippable, each behind `tm_console_mode`)

| Phase | Scope | Done criteria |
| --- | --- | --- |
| **T0 — Router + guards** | `consoleTaskRouter` + `TaskKind` union + `unknown` guard panel + **leak detector** (console mode + a desktop scope resolves outside the allowed set → loud dev warning + telemetry log) + **coverage spec** (every `MODAL_INPUT_TYPES`/routing branch ↔ a TaskKind — fails listing gaps) | Router unit-tested over synthetic waitingFor fixtures for ALL rows of CTS-2; red list printed = the work queue |
| **T1 — Core primitives** | TaskHost + TaskFrame + Choice/Player/Amount/Distribute tasks (rows 2–6) | those types never mount MandatoryInputModal in console; payload-parity specs green |
| **T2 — Card browser** | CardBrowserTask modes draft/buy/select/target/sale (rows 10–15) + DraftFlow gated off in console | **the reported draft bugs are dead**: inter-gen draft, research buy, discard prompts fully console-native; sale folded in |
| **T3 — Payment & wizards** | PaymentTask, PlayCardWizard, ActionWizard, projectCard prompts (7–9, 14, 16–17) | play/action/std flows with previews + byte-parity specs; pick-bridges deleted |
| **T4 — Colonies & awards** | ColonyTask (build/select), trade PaymentTask variant, free award funding (18–20) | **colony build reported bug dead**; trade modal re-host removed |
| **T5 — Lifecycle wizards** | InitialDraftTask + StartSequenceTask (21–22); the PlayerHome-hosted overlays gated off in console | **initial-draft reported bug dead**; full new-game start on pad, zero desktop surfaces |
| **T6 — Prompt UX layer** | task banner/defer chips, notification CTA console listener, reveal tasks, console gate anchors (25–28) | pill CTA works; no desktop pills/toast CTAs in console |
| **T7 — Long tail** | CompositeTask (and), AresTask, endgame nav formalization, out-of-scope guard polish (23–24, 29–30) | coverage spec fully green (no `unknown` in in-scope modules) |
| **T8 — Fallback retirement** | remove in-game fallback claiming in console (`resolveScope` check deleted from shell input path; engine = dev-only), delete temporary CSS suppressions (minimize hides), QA matrix run | leak detector silent across the full QA matrix; the fallback engine unreachable in console gameplay |

Dependencies: T1 → T2/T3; T2 → T5; the rest parallelizable. Every phase
ends with: coverage spec re-run (shrinking red list is the progress
metric), builds, and the manual slice of the QA matrix it unlocks.

## CTS-7. No-tails mechanisms (how nothing resurfaces in production)

1. **Coverage guard spec** (`consoleTaskCoverage.spec.ts`): enumerates the
   full CTS-2 table as fixtures; FAILS with the exact missing list if a
   waitingFor shape maps to no task (mirrors the expansion-checklist guard
   philosophy). New input types cannot ship unmapped.
2. **Leak detector** (runtime, dev + `?gpDebug`): in console mode, any
   mounted desktop-surface selector from a deny-list (mandatory modal,
   bar overlays, DraftFlow, pills…) logs + overlays a visible dev badge.
   CI-adjacent: a mochapack smoke mounting ConsoleShell against fixture
   prompts asserts the deny-list is absent from the DOM.
3. **`unknown` task guard**: an unmapped prompt renders an honest,
   premium "этот запрос пока требует режима рабочего стола" panel with
   system-menu exit — the player is NEVER silently stranded with a pill.
4. **CLAUDE.md rule**: the expansion-adaptation checklist gains a
   "console task mapping" row when CTS lands.

## CTS-8. Risks

| Risk | Mitigation |
| --- | --- |
| Volume: ~15 task bodies | primitives first (T1) — most bodies are compositions; the card browser collapses 7 cases into one |
| Payload drift vs desktop | byte-parity specs on builders; walkers already shared |
| Desktop logic trapped in components (payment, initial-draft pipeline) | extract-to-pure-module rule (CTS-3.1), same-PR |
| Hidden-info regressions in shared browsers | browser modes declare their data source explicitly (hand vs dealt vs tableau); the Info-Mode hidden rules reused |
| Long rollout window with mixed surfaces | per-kind `?ctsOff=` escape hatch + the T0 leak detector making mixed states visible, not silent |
| Animation/hold gates (WGT, conversion) mis-firing in console | T6 anchors + the "content never gated on animation events" rule |

## CTS-9. Test strategy

- **Pure**: router mapping (full fixture set), payload builders parity,
  browser mode reducers (selection/counters/cost), lane steppers.
- **Component (mochapack)**: TaskFrame render, each task body against
  fixture prompts, deny-list smoke (leak detector assertion).
- **Manual QA matrix** (per phase + full at T8): the CTS-2 table as a
  checklist × pad-only × 1080p/4K × Electron; the standing full-game run:
  create → initial draft → corps/preludes → generations with every action
  family → colonies → endgame → rematch.

## CTS-10. Flags & rollback

`tm_console_mode` stays the master gate; `?console=0` the kill switch;
`?ctsOff=<kind>` the temporary per-task escape hatch (removed at T8);
`?gpDebug` shows router state + leak badges. Desktop modern-premium-ui and
the desktop-gamepad mode are untouched throughout.

---

## CTS STATUS LOG

- **T0 — SHIPPED (router + guards).** `consoleTaskRouter.ts` (the closed
  `TaskKind` union + `taskFor(view)` pure mapper; start-game/award/WGT
  MARKERS outrank raw types; every one of the 20 `PlayerInputModel`
  discriminators maps — out-of-scope families land on `unknown`).
  `consoleTaskRouter.spec.ts` = the CTS-2 table as 36 fixtures + the
  EXHAUSTIVE check + the **printed RED LIST** (currently all 14 non-native
  kinds — the work queue; `NATIVE_KINDS`/`EXPECTED_RED` must be updated in
  lock-step as phases land). `consoleLeakDetector.ts` (1 s tick while the
  shell lives): **stranded-prompt check** (waitingFor + not native + NO
  serving surface → state + warn-once) + desktop-surface rollout telemetry
  (`?gpDebug` shows both). `ConsoleStrandedPrompt.vue` — the honest amber
  guard panel (prompt title + «пока недоступен в консоли» + hold-Menu
  hint) replacing the silent-pill failure mode for the C1 dead ends
  (initial draft / colony build now IMPOSSIBLE to strand silently).
  New elements follow CTS-3.8/3.9 (info parity + `con-layer` shared
  enter/leave transition). Gates: 82 pure specs, eslint, vue-tsc,
  make:json/css, build:client — green.
- **T1 — SHIPPED (core task primitives).** `ConsoleTaskHost.vue` — the
  single console-native surface for `choice` / `player` / `amount`
  (incl. the `deltaProject` flavor) / `resource` / `distribute`
  (resources + productionToLose). The desktop `MandatoryInputModal` is
  SUPPRESSED exactly when `taskServedByHost(view)` serves (a new
  `modalSuppressed` prop on WaitingFor — rendering only; transport/holds
  untouched; desktop byte-identical). **Control grammar (user-mandated):**
  A = select/arm (A on armed = confirm; bare `option` confirms on one A),
  **X = confirm in ONE press from anywhere** (risky options — tradeoff/
  warnings — arm first with an amber «Нажмите ещё раз» bar), **B = defer**
  (the task docks as an amber banner chip, the board becomes inspectable,
  B returns; new prompt identity resets the defer), **LB/RB = −1/+1** on
  value lanes (←/→ mirror), **Y = MAX**. INFO PARITY (CTS-3.8): the
  choiceContext source renders as the REAL `<Card>` + trigger sentence;
  option metadata carries over completely (icons, player chips,
  `current → resulting` previews incl. the production frame, effect chips
  via the shared `ActionEffectChip`, tradeoffs, descriptions, skip-option
  separation, disabled targets with reasons, prompt warnings, the server
  `buttonLabel` as the confirm verb). Nested SPACE options (WGT ocean)
  route through the shell's headless SelectSpace (`taskSpacePending` →
  board placement → or-wrapped response; B returns to the task); choices
  nesting NON-leaf inputs (payment/card) honestly stay on the desktop
  modal until their phase (`taskServedByHost` carve-out). Submission
  byte-parity via pure `taskResponses.ts` (+spec). Transitions:
  `con-layer` enter/leave + keyed `con-task-swap` prompt→prompt cross-fade
  (CTS-3.9). RED LIST: 14 → **9**. Gates: 86 pure specs, eslint (one
  PRE-EXISTING baseline quote-props in WaitingFor untouched), vue-tsc,
  make:json/css, build:client — green.
- **T2 — SHIPPED (the card browser).** `cardSelect` (ALL four modes —
  draft `Keep` / research `buy` / hand `select` / nested-deferred
  `target`) is a native body inside `ConsoleTaskHost`: a TV
  inspector (the focused card LARGE — the real `<Card>` render) + a
  filmstrip of every candidate **including the DISABLED ones with their
  server reasons** (info parity; readable, never pickable), a live pick
  counter `Выбрано N / max`, and in buy mode the per-card cost badge
  (`cards[0].calculatedCost` — the desktop contract) + the running
  `−X M€ (У вас: Y)` economics line that BLOCKS an unaffordable confirm.
  Grammar: ←/→ = filmstrip, A = toggle pick (single-pick: A on the picked
  card confirms — the draft rhythm), X = one-press confirm with the
  server `buttonLabel` verb (gated on `min ≤ picks ≤ max` + affordability),
  B = defer (draft/buy/select are mandatory — the amber chip returns).
  Submission: the bare top-level `{type:'card', cards}` in pick order —
  byte-parity (`cardsResponse`). **`DraftFlowOverlay` is gated OFF in
  console mode** (App.vue `!consoleModeState.enabled`) — the double-render
  is impossible and the between-picks wait state is the console banner.
  This kills the REPORTED draft bug class: the between-generation draft,
  the research buy, and the initial-draft ROUND picks (type `card`) are
  all native now (only the final `initialCards` composite remains T5).
- **T3 — SHIPPED (payment + projectCard).** (a) `payment` prompts are a
  native LANES body in the host, backed by the PURE `paymentPlan.ts`
  which reuses the EXACT desktop ledger math (`GENERIC_PAYMENT_ORDER` +
  `paymentOptionsAllowResource` + `getSpendablePaymentAmounts` incl.
  Stormcraft heat, `steelValue`/`titaniumValue` incl. the Luna Trade
  Federation −1 rule, `reserveUnits` flags, and `computeDefaultPayment`
  for the opening mix — alternates first, M€ tops up). **M€ is an AUTO
  lane** (always exactly the uncovered remainder, like the desktop form's
  own auto-M€), so under/over-payment by M€ is impossible; `laneCap`
  stops pointless overpay dialing; the header shows `Стоимость` + a live
  `Итого X / N` readout; LB/RB = ±1, Y = MAX-lane, X = confirm (gated on
  coverage, honest ⚠ line when the player simply can't cover). (b) The
  SAME body hosts the CLIENT-built standard-project alt-resource payment
  via the new `promptOverride`/`deferLabel` host props — **B = Cancel**
  there (nothing committed; returns to the sheet), replacing the desktop
  `StandardProjectPaymentContent` re-host (one fallback surface RETIRED).
  (c) `projectCard` prompts are SHELL-SECTION tasks (`SHELL_SECTION_KINDS`):
  `playFromHand` auto-opens the HAND section (the walker already yields
  `{path: [], input}` for the top-level prompt, so РАЗЫГРАТЬ → play modal
  → batch flows unchanged); `standardProject` auto-opens a dedicated
  `standardProjects` SHEET (only the server's cards; A → pay-or-payment
  flow). Navigating away (wheel / other sheets / B) DEFERS the task to
  the amber chip; B on the chip re-opens the serving surface.
- **T4 — SHIPPED (colony pick + award funding).** `colony` prompts drive
  the colonies section in PICK MODE: the rail lists the in-game colonies
  (or ONLY the offered tiles for `purpose: 'addNewColonyToGame'` —
  Aridor), unpickable tiles stay VISIBLE with the SERVER's reason chip
  (`disabledColonies` — full/already-own/TR-affordability; info parity),
  A on a pickable tile submits the byte-identical `{type:'colony',
  colonyName}`, and **B honors the server `placementContext.cancellable`
  marker** (pay-on-commit Build Colony → `{type:'cancel'}`; else defer).
  The dossier panel shows the pick verdict + reason for the selected
  tile. Free award funding was verified ALREADY native via the T1 choice
  host (leaf options) and upgraded with each award's RULE description
  docked from the manifest (the desktop AwardsOverlay shows it → parity).
  Leak detector: kind-aware serving surfaces (`projectCard` →
  `.con-hand`/`.con-sheet`, `colony` → `.con-colonies`) + the
  **deferred amber chip now COUNTS as a serving surface** (also fixes the
  T1 gap where deferring a task tripped the stranded guard after 1 s).
  RED LIST: 9 → **5** (`composite`, `initialDraft`, `startSequence`,
  `aresGlobal`, `unknown`). Remaining known fallback surfaces (documented,
  work, driven by the demoted DOM engine): the play-card modal
  (`HandCardPaymentContent` re-host) and the colony-trade payment modal.
  Gates: 71 console pure specs (+`paymentPlan.spec` pinning the ledger
  rules), eslint, vue-tsc, make:json/css, build:client — green.
- **T5 — SHIPPED (the START SCENE — the game-opening experience).**
  `ConsoleStartScene.vue` — ONE full-screen premium scene (cinematic but
  calm: radial hero glow + iso-tech grid backdrop, a staggered deal-in on
  entry [`backwards` fill — a `both` fill would pin the keyframe transform
  and kill the focus lift], keyed cross-fades between steps/prompts,
  `prefers-reduced-motion` honored) replacing BOTH desktop start surfaces
  in console mode. **(a) The `initialCards` WIZARD**: corporation →
  preludes → (CEO) → project buy → summary. Steps are derived from the
  SERVER's options via the stable title constants
  (`common/inputs/SelectInitialCards` — the same identification the
  desktop overlay uses); the step rail shows numbered chips
  (done ✓ / active glow / pending); a LIVE budget capsule reuses the
  shared `initialDraftMoney` math (start M€ − buys × corp cardCost +
  corp×prelude extras — Manutech/Tharsis/Polaris/… never fork) and turns
  red on an unaffordable buy (X gated); each card step is the shared
  `.con-cards` inspector+filmstrip (extracted from the T2 host into a
  standalone family — one visual language); the summary shows the chosen
  corp hero + prelude/CEO/project minis + the money breakdown; a
  zero-projects submit ARMS an inline warning first (the desktop
  skip-confirm, console grammar). Picks + step live in MODULE STATE
  (`consoleStartState.ts`, keyed by player id + a deal signature) so a
  defer / re-render never loses them; the submit is the byte-identical
  `{type:'initialCards', responses}` (one `{type:'card'}` per PRESENT
  option, server order — pinned by `consoleStartState.spec.ts`).
  Grammar: ←/→ filmstrip · A toggle (single-pick: A on the picked card =
  continue — the draft rhythm) · X/RB continue · LB/B back a step
  (B on step 1 = defer). **(b) The `startSequence` CEREMONY**: the corp
  column (real `<Card>` renders + status badges — ✓ applied / «Применить
  эффект» / awaiting) beside the prelude progress rail (played ✓ /
  playable glow / awaiting dim / fizzle-blocked with the honest «Сначала
  разыграйте другой пролог» chip) and a dedicated candidate strip for the
  pick prompts (drew-N-choose-1 [records `recordDrawChoice` BEFORE submit
  — the only capture window], Double Down copy, Merger's corp choice with
  disabled-corp reasons). ALL predicates are REUSED from
  `startGameFlowState` (marker-driven, one brain). Sub-actions (payments /
  placements / targets) arrive as normal prompts → the scene yields to
  the T1–T4 native surfaces and returns (con-layer transitions).
  `StartGameFlowOverlay` is gated OFF in console (App.vue) — the
  WaitingFor corp-modal suppression still holds via the ELIGIBLE half of
  `startGameFlowActive`, plus the shell's `modal-suppressed` now also
  covers the scene. Initial-draft ROUND picks (type `card`) stay on the
  T2 browser (already native). RED LIST: 5 → **3** (`composite`,
  `aresGlobal`, `unknown`). Gates: 76 console pure specs, eslint,
  vue-tsc, make:json/css, build:client — green.
- **T6 — SHIPPED (the Prompt UX layer, rows 25–28).**
  **(25) `ConsoleRevealOverlay`** — ONE console-native reveal frame
  replacing the three desktop reveal modals (all gated off in console,
  desktop untouched): *drawn* («you received N cards» — the REAL source
  render: `<Card>` / `<ColonyTile>` via `simpleColonyModel` / tile-bonus
  label, a focusable untaken strip, A = take the focused card, X/B = take
  all; the take/ack semantics are the SHARED `drawnCardsState`
  `closeAndReleaseEvent`/`acknowledgeDraw` — extracted from the desktop
  flow per CTS-3.1 in the same pass, the flow now delegates —
  byte-identical dismiss-first/release-after-paint/ack sequencing);
  *result* (the SearchForLife / ADS deck-check outcome: source card + the
  revealed card in a green/red verdict frame + ✓/✗ + the reward chip +
  VP delta) — driven by the SERVER's `playerView.lastReveal` DIRECTLY,
  because the console submits card actions without the desktop confirm
  modal, so the desktop's client-side `beginReveal` trigger never fires
  here; «ОК» records a dismissed key in the shell until the server clears
  `lastReveal` (reset in the playerView watcher); *viewer* (another
  player's public reveal, opened by the notification CTA — read-only
  browse + close, actor/origin/result chips). Priority drawn > result >
  viewer; the overlay owns input ABOVE the task host (z 11520).
  **(26) Notification CTAs work in console**: the shell now answers
  `tm-notification-go-to-action` (un-defer + re-open the serving surface,
  snap to the board for a placement) and `tm-notification-cancel`
  (→ `cancelPlacement`) — PlayerHome's listeners don't exist in console;
  the dead-button class is closed.
  **(27) Desktop pills retired in console**: `.mandatory-input-modal-pill`
  / `.hand-select-pill` / `.initial-draft-pills` hidden (unreachable from
  the pad; the console defer CHIP is the one restore affordance) — the
  leak detector keeps reporting them as rollout telemetry.
  **(28) The premium end-of-generation energy→heat transition now PLAYS
  in console**: `ConsoleResourcePanel` carries the `data-conversion-cell`
  / `data-conversion-icon` anchors (set ONLY on the live conversion rows,
  mirroring PlayerResource) + the interpolated stock override (energy
  counts down / heat up in lock-step with the App-level overlay's arrow)
  + source/target row glow. WGT / hazard / placement holds already anchor
  to the real board. Gates: 76 pure specs, eslint, vue-tsc, make:json/css,
  build:client — green.
- **T7 — SHIPPED (the FEEDBACK-PARITY audit + gap closure).** T7 was
  re-scoped (user directive) to a systematic audit that EVERY desktop
  modern-premium feedback mechanism — delta chips, statuses, hints,
  notifications, resource changes, visual accents — reaches the console
  natively and organically (couch-port, not a desktop transplant). The
  audit table below IS the deliverable; the gaps it found were closed in
  the same pass:
  **(a) DELTA CHIPS in console** — the flagship gap: every resource
  stock/production row in `ConsoleResourcePanel` now hosts the SHARED
  `AnimatedMetricValue` with the SAME metric keys as the desktop
  `PlayerResource` (`<res>.stock` / `<res>.production`, scope = player
  color, epoch = `playerView.runId`) — so ±N chips fire on every change
  AND the T6 energy→heat baseline seeding keeps working (identical
  `${runId}|${color}` scope). `ConsoleStatusStrip` chips: every player's
  TR (`strip.tr`, variant score) + M€ (`strip.megacredits`) and the
  viewer's hand/actions totals (`bar.cards`/`bar.actions` — the desktop
  bar keys, safe: those hosts never co-mount). Anchors via positioned
  wrappers mirroring the desktop cells.
  **(b) Card actions are CONFIRM-FIRST again** — the console cardActions
  sheet used to submit on a bare A (a desktop-parity violation: the
  desktop NEVER executes without the confirm modal). A now opens a
  preview-backed console confirm (`.con-actconfirm`): the SAME
  `/api/action-preview` the desktop modal fetches → per-branch
  cost/gain `ActionEffectChip`s, unavailable branches dimmed with the
  server reason, a multi-branch note («Выбор варианта — после
  подтверждения» — the follow-up OR arrives as a native T1 task);
  A/X = execute, B = back to the sheet; stale-cleared on prompt change;
  fetch failure degrades to an honest generic confirm, never blocks.
  **(c) Pass-confirm parity** — the console pass confirmation now carries
  ALL five desktop PassConfirmContent warnings (unused actions count /
  free trade fleet / convert plants / convert heat / hydro advance),
  derived from the same walkers.
  **(d) Turn-notification dedup over console surfaces** — the desktop
  hides the action-required/your-turn card while its modal IS the prompt;
  console now applies the same rule via `body:has(.con-task-host /
  .con-start / .con-reveal / .con-confirm)` (console-only selectors).
  The notification layer drops below the status strip
  (`html.console-mode .notifications-layer{top:108px}`) — transient
  toasts (reveals / losses / milestones) stay, as informational.
  **(e) Journal as a console panel** — geometry override (flush right,
  z 11460: above sections, below task surfaces).
  **(f) Turn accent, console-native** — the ACTING player's strip chip
  glows + its dot pulses (`--active`, from `PublicPlayerModel.isActive`)
  — the couch equivalent of the desktop handoff beam / status chips
  (`TurnHandoffLayer` anchors to desktop panel geometry and no-ops
  gracefully in console; deliberately NOT retro-fitted onto the
  horizontal strip).

  **The T7 FEEDBACK-PARITY AUDIT TABLE** (desktop mechanism → console):
  | Feedback surface | Console status |
  | --- | --- |
  | Delta chips: resources/production | NATIVE (a — shared AMV, same keys) |
  | Delta chips: TR / M€ per player | NATIVE (a — strip chips) |
  | Delta chips: hand / action counts | NATIVE (a — strip intel chips) |
  | Energy→heat conversion animation | NATIVE (T6 anchors + interpolation) |
  | Tile placement / WGT / hazard / ares board animations | INHERITED (the real board) |
  | Notifications (turn / hostile / reveals / milestones) | INHERITED App-layer + (d) dedup + T6 CTAs |
  | Turn announce | NATIVE banner + notification + (f) strip accent |
  | Turn handoff beam / idle hint | graceful no-op; covered by (f) + banner |
  | Unplayable/unavailable reasons | NATIVE (inline, every surface T1–T5) |
  | Action confirm previews | NATIVE (b) + play modal (fallback, full preview) |
  | Pass safeguards | NATIVE (c — all five warnings) |
  | Reveal flows (drawn / result / public) | NATIVE (T6) |
  | Journal | INHERITED + (e) console geometry; rows are read-only from the pad (scroll peek) — chips/CTA inside are mouse-only, board-pulse works |
  | Board cell info / placement reasons | NATIVE (context panel dossier) |
  | Effects / actions / VP analytics | NATIVE (Info Mode details; per-game stats = Info Mode scope) |
  | Player timers | NOT SHOWN in console (minor; timers option — candidate for the strip) |
  | Endgame / final reveal / rematch | fallback-driven premium (App-level; scope defs drive it) — T8 candidate |
  | Card zoom / fullscreen browse | replaced by TV inspectors (deliberate) |
  Gates: 76 pure specs, eslint, vue-tsc, make:json/css, build:client —
  green.
- **T8 — SHIPPED (fallback retirement — the IN-GAME loop is fully
  console-native).** The two remaining in-game fallback modals are
  RETIRED from the shell (`MandatoryInputModal` / `HandCardPaymentContent`
  / `ColonyTradePaymentModal` imports are GONE):
  **(a) `ConsolePlayCardConfirm`** — the native play-card flow: the full
  premium card render + the on-play RESULT from the SAME
  `/api/card-play-preview` (branch chips, per-branch availability
  reasons, the multi-branch «после подтверждения» note) + the VERBATIM
  silent-loss warnings + an honest «После подтверждения» list of the
  follow-up decisions + native payment lanes with the DESKTOP
  project-card rules extracted PURE into `paymentPlan.ts`
  (`projectCardPaymentOptions`/`projectCardPaymentPrompt`: tag-gated
  alternates [steel=building, titanium/graphene=space, microbes/seeds=
  plant, floaters=venus, lunaArchives=moon, plants=building+server flag],
  the Last Resort Ingenuity exception, LTF-only titanium at −1 rate, and
  the project-card `subtractReserve` semantic — reserveUnits are
  SUBTRACTED from the spendable pool, mirroring the desktop; all pinned
  by paymentPlan.spec). Grammar: ↑/↓ lanes · ←/→ & LB/RB ±1 · Y MAX ·
  A/X play (coverage-gated) · B cancel. **The submit is the bare
  `{type:'projectCard', card, payment}`** (wrapped into the action-menu
  path; empty path for the mandatory play-from-hand prompt) — the
  legacy-supported SEQUENTIAL server contract: the choices the desktop
  modal pre-collects arrive as NATIVE follow-up tasks (T1–T5 serve them
  all, each with its premium metadata). One-decision-per-screen IS the
  console idiom — and the pick-bridge aborts («This card needs desktop
  mode») are gone from the play flow entirely.
  **(b) `ConsoleColonyTradeConfirm`** — the native trade confirm: the
  REAL `ColonyTile` render (track + reward — the tile is the source of
  truth), the fixed trade-bonus beneficiaries line (owners ×N), and the
  payment paths as T1-style option rows (resource icon + cost + the
  `current → resulting` stock preview from the SAME server
  `OptionMetadata`; unaffordable paths VISIBLE with their reason).
  A = select/arm → confirm, X = one-press trade, B = cancel. The
  and-response submit path in the shell is unchanged (byte-parity).
  Both layers reuse the FLAT con-task frame/lane/option/foot vocabulary
  (LESS BEM compiles flat — zero style duplication).
  **Honest remaining fallback (documented, deliberate):** the nested
  non-leaf choice carve-out (a payment/card nested inside an OrOptions →
  the desktop modal, by design — see taskServedByHost; **NARROWED by T9
  below to composites only**); the Hydronetwork overlay INTERNALS (its
  confirm submits natively; its pick bridges show the honest notice); the
  END-GAME surfaces (endgame experience / final reveal / rematch —
  App-level premium, driven by the demoted engine's scope defs;
  post-game, no game-state risk). Gates: 80 pure specs, eslint, vue-tsc,
  make:json/css, build:client — green.
- **T9 — SHIPPED (the nested ONE-LEVEL wizard — the carve-out shrinks to
  composites).** The T1 carve-out («an option nesting a non-leaf input →
  the desktop modal») existed because the native bodies didn't exist yet;
  after T2/T3 they all do, so the host now OPENS a nested option as a
  wizard step instead of deferring the whole prompt:
  `NESTABLE_OPTION_TYPES` (router) = leaves + `space` + every input the
  host has a body for (`card` / `payment` / `amount` / `player` /
  `resource` / `resources` / `productionToLose`). Confirming such an
  option sets `nested = {index, input}` — the host re-derives `wf` /
  `activeTask` from the nested input (the SAME bodies render it: the
  card browser for a nested SelectCard, the payment lanes for a nested
  SelectPayment, …), the keyed `con-task-swap` cross-fades list ↔ step,
  the header shows the nested ask with a `← <parent>` breadcrumb and the
  parent's choiceContext source card stays docked (info parity).
  **B returns to the branch list** (nothing submitted; B again = defer);
  every submit routes through `submitResponse`, which OR-WRAPS a nested
  step's answer (`{type:'or', index, response}` — byte-identical to the
  desktop ModernOptionPicker.nestedSave). A `baseKey` watcher discards an
  open step when a genuinely new server prompt arrives. Nested rows carry
  a `›` affordance in the list. This natively serves the console-frequent
  `gainOrAddResource` family (ImportedHydrogen / LargeConvoy /
  LocalHeatTrapping follow-ups — MORE common in console than desktop
  because T8 plays sequentially, without desktop pre-collection), Mars
  University-style discard-to-draw triggers, etc. **The remaining honest
  carve-out is exactly the composites:** an `and` option (combined
  multi-child submit — the same gap the desktop premium system defers to
  its legacy AndOptions.vue) and DEEPER `or` nesting. Gates: 80 pure
  specs (served/deferred matrix updated: nested payment/card SERVED,
  `and`/deep-`or` deferred), eslint, vue-tsc, build:client — green.
- **P10 — SHIPPED (the premium console-native PRE-GAME shell: menu /
  join / create / loading / Electron).** Scope discipline: the EXISTING
  flow was re-skinned for gamepad-first — no new game scenarios; the only
  new actions are the sanctioned ВЫЙТИ (Electron) + the loading screen.
  **(a) Runtime modes** — `runtimeMode.ts` (isElectronApp /
  supportsNativeQuit / supportsNativeFullscreen / quitApp /
  setNativeFullscreen / initialGamepadDetected) over the sandboxed
  `desktopBridge`; the bridge gained `quitApp` + `setFullscreen`
  (preload → `desktop:quitApp` / `desktop:setFullscreen` ipcMain
  handlers; feature-detected per method so an OLDER installed shell just
  hides the affordances; browser builds see no bridge → everything false).
  **(b) Electron auto console mode** — GamepadLayer bootstrap: launched
  with a pad connected → `setConsoleMode(true)` immediately (no prompt,
  no mouse); a pad connecting LATER (padsConnected watcher) does the same
  in the Electron shell; the browser keeps the consent prompt. The
  existing connect/disconnect toast covers the lifecycle messages.
  **(c) ВЫЙТИ** — a first-class main-menu item (power icon, normal focus
  order, Electron-only via supportsNativeQuit) → `ConsoleConfirmDialog`
  (reusable: a NATIVE `<dialog>` + showModal → the PLATFORM's focus trap
  + the generic `dialog[open]` pad scope; Cancel is FIRST in DOM so the
  initial focus lands on the safe action — a rapid double-press can never
  quit); confirm → the IPC quit, never a browser workaround.
  **(d) Premium loading screen** — `ConsoleLoadingScreen` +
  `loadingScreenState`: mars-glow scene + terraforming grid + a calm
  orbital scanner + staged messages (Подготовка экспедиции… →
  Синхронизация… → Загрузка карты… → Инициализация…; indeterminate,
  holds on the last stage) + the premium error/retry state (the player
  fetch failure under the curtain becomes Retry instead of a bare
  alert) + the fullscreen-restore prompt. **The game boundary stays the
  DELIBERATE full reload** (clean per-game module state — the documented
  architecture); `navigateWithCurtain(url)` makes it seamless: curtain
  painted FIRST (double-rAF), flags handed via sessionStorage
  (`tm_boot_curtain` + `tm_fs_restore`), the NEXT page raises the curtain
  in App.mounted BEFORE the first route resolution — no raw texture /
  white DOM ever. Wired at all three boundary sites (JoinGameCard.go,
  PremiumCreateGame create, the system-menu exit) + direct/reconnect
  loads of player/spectator/the-end URLs; the curtain drops on the
  `screen` watcher the moment real content resolved.
  **(e) Fullscreen stability** — Electron: window fullscreen is a WINDOW
  property (survives reloads) + the native `setFullscreen` restore;
  browser: fullscreen dies on navigation BY SPEC → the curtain offers the
  restore button (Xbox pads send real key events → A works), and a fast
  load hands the restore to the existing one-shot trusted-gesture retry
  (silent, non-blocking).
  **(f) Focus manager, pre-game** — a `screen` watcher in GamepadLayer
  drops the stale focus descriptor on every screen transition (the tick
  re-acquires the FIRST actionable of the new scope — never a hidden
  element, never an unfocusable state); a new top-priority
  `loadingScreen` scope drives the curtain's Retry/Restore buttons;
  `html.gp-mode .gp-focus` element-level glow/lift joins the floating
  ring on the menu / join / create surfaces (unmistakable at TV
  distance). **Native `<select>` audit:** the premium create/join/menu
  screens already use custom controls ONLY (segmented player count,
  expansion tiles, map overlay list, toggles — the earlier premium
  redesign); the two `<input type=text>` (player names / identity) keep
  keyboard fallback (a console text-input solution stays a documented
  follow-up); the legacy web form (`create-game-form`) is NOT part of the
  console path. Desktop/web untouched (everything runtime-gated). Gates:
  110 pure specs (console+gamepad) + 33 electron specs, electron tsc,
  eslint, vue-tsc, make:json/css, build:client — green.
- **P11 — SHIPPED (the two standing debts).** **(a) Info Mode extras
  parity** — the CTS-3.8 anti-example is closed: the «Доп. ресурсы»
  detail now renders the resource HOLDERS as REAL premium `<Card>`s (the
  LIVE tableau CardModel — the resource cubes draw on the card itself) in
  a wrapping grid, each with a mint `[icon] ×N` count chip for TV-distance
  readability; name-only rows are gone. **(b) Endgame console-nav
  formalization (row 29)** — LB/RB now cycle the endgame results TABS via
  a GENERIC `role="tablist"` fallback in the focus engine's
  `cycleOverlay` (aria-selected aware, scope-rooted; purely additive —
  the in-game `data-gp-overlay` ring always takes precedence, and any
  future fallback surface exposing a tablist gets bumper tabs for free).
  B on the endgame root stays a safe no-op in console (the minimize is
  hidden by design; leaving the results goes through the system menu's
  exit-to-menu, now curtained). Gates: 110 pure specs, eslint, vue-tsc,
  make:css, build:client — green.
- **P12 — SHIPPED (Steam Deck / handheld layout profiles).**
  **Profile model** — `consoleLayoutProfile.ts`: pure `resolveProfile(w,h)`
  (`h≤860 || w≤1366` → **handheld** — the Steam Deck 1280×800 flagship +
  similar small screens, deliberately NOT a device sniff; `w≥2400` →
  **large**; else **standard** = the shipped design, byte-identical),
  reactive + rAF-throttled resize; **debug override**
  `?consoleProfile=handheld|standard|large` (persisted to
  `tm_console_profile`, `=auto` clears) so the Deck layout is testable in
  any desktop window. GamepadLayer owns the `html.con-profile-<p>` class
  (next to `console-mode`); EVERY profile selector pairs with
  console-scoped blocks (the few desktop-class targets — journal,
  notifications, endgame, the carve-out modal, pre-game boosts — are
  additionally guarded by `&.console-mode`), so desktop premium + legacy
  are structurally unreachable.
  **Handheld = RECOMPOSITION, not a page scale** (one organized block in
  console.less, ordered by the audit's surface list): tighter root
  chrome; compact HUD (generation label + intel labels dropped to
  icon+numbers, player names ellipsized at 88px); denser command bar
  (14px labels, 17px glyphs); the RIGHT context panel narrowed
  340→248-282px and the LEFT resource rail 182→146px — the freed ~130px
  goes straight to the board (its fit is already dynamic); card
  HERO-zooms stepped down (hand inspector 1.32→0.95, browser big
  1.16→0.92, start-scene corp/preludes 0.92/0.86→0.74/0.62, play
  cardside 1.02→0.8, reveal 1.08→0.9, trade tile 1.05→0.85, colonies
  0.9) — cards stay larger-than-natural for arm's-length reading; the
  task host width 880→760 (wide 1560→1180); the start scene's rail +
  budget compress to one dense header row; wheel ring ×0.84; Info Mode
  paddings/blocks tightened (3 columns keep); sheets = list-density
  0.92 + 80vh; journal 340px / notifications repositioned under the
  compact HUD; endgame/final-reveal/rematch/the carve-out modal get a
  deliberate per-surface density (0.88–0.92 — fallback surfaces keep
  their own layouts); the pre-game console zoom boosts (1.18/1.12/1.3)
  return to ~1 on handheld; loading/quit/system/stranded compacted.
  **Large** — a gentle readability boost only (HUD/cmdbar/task fonts one
  step up, inspector max-width 520).
  **Known limitations (recorded):** the Hydronetwork overlay keeps its
  desktop-premium composition (fallback surface — untouched this pass);
  the endgame family is density-adjusted, not recomposed; `standard`
  IS the shipped design (no change by construction). Validation:
  `?consoleProfile=handheld` in a 1280×800 window walks the QA list;
  `?consoleProfile=standard` at 1920×1080 confirms zero drift. Gates:
  85 console specs (+5 profile), eslint, vue-tsc, make:css,
  build:client — green.
- **P13 — SHIPPED (the card-selection / start-flow REWORK).**
  **The global «X = fullscreen card» rule** — `consoleCardZoom.ts`
  (module state) + ONE reused desktop `CardZoomModal` mounted in the
  shell (native dialog: the generic `dialog[open]` pad scope drives it —
  d-pad to its arrows, A, B = close; closing restores the EXACT previous
  context because all selection state is module/component state). Wired
  in EVERY console card context: the card browser, the start wizard AND
  ceremony (corps/preludes/candidates), the hand (incl. sale mode),
  reveals (drawn/result/viewer), the play confirm. Every card-context
  hint row shows «X Карта».
  **The duplicate big-preview zones are GONE** (`.con-cards__big`, the
  hand inspector) — replaced by IN-PLACE emphasis: the focused slot
  scales ×1.12 and comes forward while neighbours calm down
  (`--has-focus` dim), and a compact VERDICT BAR under the strip carries
  the context that matters (card name, select state, unplayable reasons
  ×2, «X Карта», and a pulsing «Y Продолжить» when the step is
  complete) — never a duplicate card.
  **GRID mode** (>6 candidates): the strip wraps into centred comparison
  rows — the 10-card starting-projects purchase and the research buy
  stop being kilometre scrolls; ↑/↓ row-jumps are MEASURED from the DOM
  (offsetTop groups — robust to flex-wrap at any profile).
  **Clip-safe strips**: the paddings now CONTAIN the negative-offset
  badges and the focused lift/scale; scroll-padding + inline insets stop
  edge cards from hugging the mask. **The z LADDER**: badges (cost/
  reason) z4 < focus chips z5 < the SELECTED tick z6 — the selected
  marker always wins the corner.
  **The card grammar** (card contexts only; lanes/choices keep T1):
  A = select/unselect (single-pick: A on the picked = continue),
  X = fullscreen, Y = continue/buy/sell/take-all/begin, B = back.
  Applied to: host cardSelect (Y = the server verb), the start wizard
  (Y = Continue / Begin the game), sale (Y = Продать N), reveals
  (Y = take all / OK), the play confirm (A = play, X = card, Y = MAX
  stays lane-scoped). P12 handheld overrides retuned for the new
  structure. Known limitations: the summary minis and Info-Mode extras
  keep their existing semantics (X is the extras hotkey there); the old
  hand-inspector styles are inert CSS. Gates: 85 specs, eslint, vue-tsc,
  make:css, build:client — green.
- **P14 — SHIPPED (the Steam Deck critical: console-first Electron boot +
  no window scrollbar).** Field report from the Deck (Electron Linux
  AppImage): the app booted in DESKTOP mode (no auto console) and the
  main menu showed the browser scrollbar.
  **Root causes (both real):** (1) the P10 bootstrap keyed ONLY on
  `initialGamepadDetected()` — but Chromium HIDES a connected pad until
  its first button press (privacy), and Steam Input may present the Deck
  controls as an emulated mouse/keyboard, so `getGamepads()` is empty at
  launch; (2) in the resulting desktop posture the 5-item menu column
  (incl. the P10 ВЫЙТИ) sat at the very edge of the 800px budget → the
  window scrolled.
  **Fix (renderer-only, ships with the next desktop release):** the
  Electron shell now boots console-first on EITHER robust signal —
  a visible pad OR the Deck POSTURE (`isLinuxPlatform()` [new, in
  `runtimeMode.ts` — UA `Linux` and not `Android`] AND the `handheld`
  layout profile). The platform anchor keeps a small-screen WINDOWS
  laptop running the desktop shell out of the heuristic. An explicit
  player opt-out always wins: the new
  `consoleModeExplicitlyDisabled()` (`consoleModeState.ts`) vetoes the
  auto-enable on the `?console=0` session kill switch OR a stored `'0'`
  (hold-Menu → off persists across launches); the pad-connect watcher
  and the input-mode auto-enable respect the same veto. Scrollbar:
  `html.console-mode` hides the ROOT scroller chrome on both potential
  scrollers (html + body, `scrollbar-width: none` +
  `::-webkit-scrollbar`) — scrolling stays FUNCTIONAL for the genuinely
  long pre-game pages (create game; the pad focus engine scrolls via
  scrollIntoView) — and the handheld profile block COMPACTS the premium
  menu (MARS 76px, buttons 54px, tightened gaps ≈ 580px total) so the
  hero column FITS 800px with margin instead of borderline. Gates:
  90 console specs (+5 `consoleModeBoot.spec.ts` — kill switch / stored
  veto / UA anchor), eslint, vue-tsc, make:css, build:client — green.
- **P15 — SHIPPED (the start-flow / card-selection / fullscreen /
  notification REWORK).**
  **Controller-native fullscreen viewer:** `consoleCardZoom` carries an
  optional SELECT CONTEXT (`{isSelected, toggle}` — a pure pick flip,
  never a submit); the shell owns the pad while the viewer is open via a
  carve-out BEFORE `resolveScope()` (the generic dialog scope used to
  trap input in the DOM engine — the reason LB/RB never worked): LB/RB
  and ←/→ browse, A toggles the pick (selection contexts only — the
  ceremony / reveals / summary browse stay read-only), B **or X** closes.
  The `con-zoom` class (OUR instance only — desktop untouched) swaps the
  touch chevrons + desktop ЗАКРЫТЬ for a console command bar in the
  `#actions` slot: [✓ Выбрана] [A Выбрать/Снять] [LB·RB Листать]
  [B Закрыть]; the `:selected` halo shows the pick state. Contexts
  passing the select bridge: start-wizard steps, host cardSelect, hand
  SALE mode. Controller glyphs live ONLY in bars/hints — never on the
  card face (an expansion icon like Ares' «A» can't be confused).
  **Selection grammar (scene + host):** A = select/deselect ONLY
  (single-pick replaces; picked → deselect) — the hidden
  «A-on-picked = continue» is GONE, Y is the ONE continue/verb (the
  corp-screen A/Y duplicate is fixed); LB = «Пред. шаг» (STEP
  navigation, hidden on step 1 — never a generic «Назад»); B = Свернуть
  on EVERY wizard step (intentional board inspection; the amber chip
  returns; picks + step progress live in module state).
  **Strips:** the focused emphasis is clip-safe (1.08 / lift −6 — 1.12
  on a natural-size card overflowed the 26px padding = the reported
  clipping); `--few` (corp pick ≤3) adds 48px gaps + extra headroom +
  a 1.05 emphasis; the >6 GRID shrinks slots (×0.8, handheld ×0.62 —
  X fullscreen is the detailed read); the per-card COST OVERLAY is gone
  (it sat over the printed card cost) — buy math lives in the pickline
  («Покупка: N × 3 = −9 (У вас: 40)»); picks wear a strong mint
  «✓ ВЫБРАНА» top band (z6); at the pick max unpicked cards DE-EMPHASIZE
  (desktop parity, focused one lifts back to readable).
  **Economy:** the capsule is labelled columns (Начальные М€ / Покупка /
  Эффекты прологов / Останется) — never «40 −7 × 3»; the summary money
  block matches. **Summary:** compact two-column confirmation (one mini
  scale, identity cards a notch larger; money + pulsing «Y Начать
  партию» in a sticky side rail; X reviews the whole setup fullscreen).
  **Notifications:** the desktop TURN channel (action-required /
  your-turn) is hidden in console mode ENTIRELY (the old `body:has()`
  gating leaked the duplicate back whenever the start task was DEFERRED
  — the shell chip + task surfaces are the one pending-decision system);
  the amber chip's verb is CONTEXT-AWARE (`deferReturnLabel`: Вернуться
  к выбору / Продолжить стартовый выбор / Вернуться к драфту / Вернуться
  к решению — never «Вернуться в игру» mid-game).
  **Update prompt:** the blocking `desktop-update--cover` got its own
  TOP-priority focus scope (pad-operable buttons) + a console glyph row
  (A/dpad) + a console/handheld readability boost.
  Gates: 94 console specs (+4 `consoleCardZoom.spec.ts`), eslint,
  vue-tsc, make:json (10 new ru keys in console.json), make:css,
  build:client — green.
- **P16 — SHIPPED (console-native TRANSIENT notifications).** The last
  big desktop visual tail inside the in-game loop: the transient toasts
  (opponent plays, hostile losses, milestones/awards, generation, passes,
  reveals, coalesced bursts) rendered the desktop `NotificationCard`.
  **One brain, two shells** (the ConsoleShell-vs-PlayerHome pattern):
  `NotificationLayer` keeps ALL the logic (fetch/diff/state/TTL/
  suppression) and swaps only the PRESENTATION — in console mode the
  transient feed renders `ConsoleNotificationCard.vue` (`con-notif`),
  and the TURN channel is not rendered at all (the shell's task frames +
  amber chip own pending decisions; the P15 CSS stays as belt).
  The console card: con-font/glass chrome + a strong left rail; the
  variant ACCENT is INHERITED from the standalone
  `.notification-card--variant-*` rules (`var(--notif-accent)`) so the
  two shells share one accent vocabulary and can never diverge;
  actor-coloured rail for opponent-action variants (same rule set).
  **Non-interactive by design** (`pointer-events: none`): no ✕ / expand
  / CTA a pad can't reach — the journal (View) is the detail surface.
  The HOSTILE essentials render DIRECTLY (attacker + source-card NAME +
  the −X → +X flow + stock/production tag + before → after) — no expand
  step; prestige milestone/award = gold rim + one-shot glow; headline
  cards reuse `JournalTokenRenderer` (info parity) restyled to the
  console type scale and rendered inert; REVEAL toasts advertise the
  one pad-operable path to the card names: a `[View] Журнал` glyph
  hint. Auto-dismiss rides the same global `notif-progress` keyframes.
  Handheld profile: 320px density block. **Documented frontier:** the
  desktop `RevealedCardsModal` viewer (`revealViewerState`) is
  unreachable in console (its CTA was the only trigger) — the journal
  chips carry the card names; a console-native reveal-browser hotkey is
  a future iteration. Gates: 94 console + 45 notification specs,
  vue-tsc, eslint, make:css, build:client — green.
- **P17 — SHIPPED (start-flow HARDENING & premium polish).**
  **Clip-safe, globally:** the strip headroom is now COMPUTED (scale
  overhead + lift + the pick-band overhang) — base strips 40px top
  (handheld 32), `--few` 42, grid row-gap 38 (handheld 32); the hand
  carousel emphasis softened to 1.06/−10 inside a 26px headroom — no
  console surface clips a focused/selected card, band, glow or badge.
  **NO-SCROLLBAR PRINCIPLE:** the `.con-scrollbars()` mixin now HIDES
  the chrome everywhere in console (scrolling stays; a visible bar is a
  desktop smell) — and the RIGHT STICK scrolls the active console
  container globally (`scrollActiveConsole`: journal feed while open,
  else the topmost visible scrollable `.con-info__scroll`; 24px/frame —
  the DOM engine's own feel; fallback-owned surfaces keep the engine's
  stick). **Summary fits by design:** identity minirows WRAP (never a
  scroll strip — the tiny horizontal bars are gone); >5 bought projects
  flip `--dense` (mini ×0.5/id ×0.6; handheld ×0.36/×0.44) so the
  1280×800 confirmation never scrolls in the normal case; body scroll
  (chrome-less + right stick) remains the rare fallback. **Merger /
  second corporation is console-native:** ceremony candidates scale
  (×0.78; a CORPORATION pick ×0.64, handheld ×0.6/×0.5) — five corp
  cards read as a calm comparison row, never giant overflow; the
  duplicated section title (headTitle twice) is gone; owned corps keep
  «✓ Эффект применён», disabled candidates keep their reasons.
  **One megacredit language:** every money VALUE in the start flow
  carries the ICON (economy capsule columns, summary money block, the
  host buy pickline) — the «М€»-text label is gone («Starting funds» →
  «Начальные»). **GEN 1 removed** from the start scene (the in-game
  strip owns the generation display, localized «Поколение N»).
  **Fullscreen desktop parity:** `consoleCardZoom` gained an ACTION
  context (`labelFor / reasonsFor / execute`) — a PLAYABLE hand card
  shows [A Сыграть] in the viewer (closes first, hands off to the
  existing play-confirm flow — the viewer never submits); an UNPLAYABLE
  card shows the structured server «why not» lines (incl. «Сейчас: N»)
  in a red reasons panel — the fullscreen is never mute; selection
  contexts keep the A-toggle, read-only contexts stay read-only.
  Gates: 95 console specs (+1 action-context), vue-tsc, eslint,
  make:json (+1 ru key), make:css, build:client — green.
- **P18 — SHIPPED (the unified card-STATE badge system).** The last
  barely-visible legacy state markers are gone: card states across the
  console flows now ride ONE band system (the P15 pick band, extended):
  `--pickband` selected (mint) · `--played` (steel «✓ Разыграна» /
  «✓ Эффект применён») · `--awaiting` (neutral «Ожидает») ·
  `--disabled` (red «Недоступна») · `--sale` (amber «✓ Выбрана»).
  **The load-bearing rule: state dims apply to the CARD BODY
  (`> .card-container`), never the slot** — so a badge (a slot sibling)
  NEVER fades with the card it describes (the reported defect: the tiny
  played tick vanished into the dimmed prelude). Re-anchored dims:
  cardSelect disabled / pick-max `--dim` / prelude played+awaiting /
  corp done+pending (new) / hand unplayable. Replaced markers: the
  ceremony prelude's corner tick → the «✓ Разыграна» band over a
  clearly dimmed body; the corp column's under-card «Ожидает» /
  «✓ Эффект применён» chips → on-card badges (the under-card chip is
  reserved for the ACTION affordance — «Применить эффект» stays);
  disabled candidates (Merger, host browser) → the «Недоступна» badge
  + the concrete reason line kept; the hand sale corner tick → the
  amber «✓ Выбрана» band. Small-zoom contexts (hand ×0.8, prelude rail)
  scale the band back up (zoom 1.15) so it stays TV-readable; the
  prelude grid gained band headroom. Focus behaviour: played/pending
  cards were already excluded from the pad focusables; a FOCUSED
  unplayable hand card lightens for reading but never returns to the
  fully-active look. i18n: `Already played` → «Разыграна» (the existing
  `Card played` = «Карта сыграна» belongs to another context — never
  repurposed). Gates: 95 specs, vue-tsc, eslint, make:json, make:css,
  build:client — green.
- **P19 — SHIPPED (controller-first update modal / create game / join
  game).** **Text-input EDITING MODE (systemic, in the focus engine):**
  A on a text field is a REAL activation — `el.focus()` + caret to the
  end + a best-effort `navigator.virtualKeyboard.show()` (never a
  fake visual focus); while a real edit is in progress the engine's
  entry point goes inert (nav/scroll/A do nothing — the OSK/keyboard
  owns the keys) and B = blur (Done), staying on the field. New
  `FocusKind`s: `text-input` / `text-editing` / `disabled`. Covers
  EVERY text field generically (create-game player names, the identity
  modal, any future field) — no per-field hacks.
  **Exact-action hint grammar:** `focusState.focusVerb` reads the
  focused element's `data-gp-verb`; `hintsFor(scope, kind, verb)` shows
  the EXACT verb instead of a generic «Select» («Create game» / «Join
  game» / «Restart and install»), a text field says «Enter text»,
  editing mode collapses to the ONE honest hint (B = Done editing), a
  DISABLED control offers no A at all.
  **Inline [A] glyphs on primaries:** the global `.gp-btn-glyph`
  wrapper (gamepad.less) renders the pad glyph INSIDE the button —
  visible only under `html.gp-mode` / `html.console-mode`, so
  mouse/desktop users never see controller chrome. Wired: «Создать
  игру» (BriefingActions), «Подключиться» (JoinGameCard), the update
  prompt's «Перезапустить и установить» / «Install and close» (its
  static P15 hint row now shows only when MORE than one action exists —
  never a redundant generic A; the `desktopUpdate` scope got its own
  hint branch). A with no prior focus already ensures-and-activates the
  FIRST actionable, so on the one-button update panel A restarts
  immediately.
  **No native selects (verified):** create/join have NO `<select>` —
  the colour picker is a custom teleported button-grid popup; it was
  UNREACHABLE from the pad (teleported outside the `createGame` scope
  root) → a new `slotColorPop` scope (above createGame) makes the pad
  walk the cubes, A picks, B closes via the open trigger and the
  descriptor memory re-seats focus. Player count / rules / expansions
  were already console option-cards (P10) — untouched.
  **Honest limitation:** the OSK is a platform affordance — the
  VirtualKeyboard API fires where supported; on the Deck the Steam
  keyboard may still need Steam+X (the focus/caret is real either way).
  Gates: 34 gamepad specs (+4 hint grammar), vue-tsc, eslint,
  make:json (+2 ru keys), make:css, build:client — green.
- **P20 — SHIPPED (premium console-native tile placement).**
  **Active cell v2:** the selected-cell marker is now a HEX-shaped SVG
  overlay (matches the grid — never a floating circle): inner glow fill
  + a thick rim + a drop-shadow halo, pulsing SCALE/GLOW (the old
  0.55-opacity pulse read weak — opacity now stays constant). Placement
  states: legal = dominant MINT, inspect-illegal = RED, neutral = cyan;
  while placing, the amber AVAILABLE outlines calm to 0.72 so the
  active marker dominates at a glance. One animated element — Deck-cheap.
  **LT/RT are GLOBAL again:** LT = Information Mode even mid-placement
  (the free-roam HOLD is gone); RT = the action wheel from the board
  INCLUDING during placement — inspection is free, but STARTING another
  action (sheet rows: std projects / card actions / milestones / awards
  / basics, play-from-hand, colony trade) is gated with the honest
  «Сначала завершите текущее действие» notice. Placement shortcuts
  moved to the STICKS: **L3 = next available cell, R3 = TOGGLE
  inspect-all** (announced via notice; the top banner flips to
  «Осмотр всех клеток»; the toggle resets when the placement resolves).
  **B semantics:** cancellable → «Отменить размещение» (real cancel);
  mandatory → the command bar shows a MUTED «Размещение обязательно»
  (never an active-looking stub) and pressing B toasts «Это размещение
  обязательно — выберите клетку на карте»; the context panel adds the
  explanation line («Это действие требует выбора клетки. Отмена
  недоступна.»).
  **Context panel:** the P20 command map (A/L3/R3/LT/RT/B), an
  «Осмотр всех клеток» mode chip, and the illegal cell brief reads as
  a REASON («Клетка поля: Место под океан — этот тайл сюда разместить
  нельзя») — never a contradictory bare label.
  **Off-Mars zones (console-scoped):** the 7-cell arc pulls in to
  radius 338 (same angles/mirror symmetry; the scale bonus markers
  reach ~r318) and Dawn City lifts 7°→10° — clear of the 0°C/−4°C
  temperature bonus zone and the right panel at the console board
  scale; desktop positions untouched.
  Gates: 95 console specs, vue-tsc, eslint, make:json (+6 ru keys),
  make:css, build:client — green.
- **P21 — SHIPPED (placement layout polish: one-line footer, clean
  hints, taller panel + RS scroll).**
  **The footer is ONE ROW by contract:** `.con-cmdbar` has a fixed
  height (52px / handheld 38px) and `__cmds` is `flex-wrap: nowrap` +
  `overflow: hidden` — hint-set changes can never resize the board
  viewport. The placement hint set itself is CONTEXT-ONLY: LT/RT left
  the bar (they keep working globally — Info / Actions), a
  NON-cancellable B is no longer a hint at all (mandatory lives in the
  panel note + the B-toast; B appears ONLY as a real «Отменить
  размещение»), and the R3 label compacted («Все клетки» /
  «Только доступные»).
  **The banner left the layout flow:** `.con-banner` (and the deferred
  amber chip, stacked below it) is now an absolute OVERLAY under the
  status strip — toggling the prompt/inspect/turn banner used to push
  the whole board down (the biggest layout shift); the board keeps the
  freed height and the planet never moves.
  **The right panel:** gains the freed banner row (taller), is the RS
  scroll target (`con-info__scroll` on its root — the P17 global
  right-stick scroll picks it up; chrome-less overflow), resets its
  scroll to top whenever the inspected cell changes (the placement
  STATUS is always visible first), its command list shrank to the
  essentials (A + a real cancel — the footer owns the shortcut map),
  and the secondary lore/rule facts read one notch compact (zoom 0.86;
  the primary status/reason keeps its size).
  **The legend (Menu → Управление) is the home of the globals:** LT
  Information / RT Actions / L3 Next available / R3 Inspect all cells /
  RS Scroll — the footer stays compact and contextual.
  Gates: 129 console+gamepad specs, vue-tsc, eslint, make:json
  (+2 ru keys), make:css, build:client — green.
- **P22 — SHIPPED (premium console-native Milestones / Awards).**
  The MA sheets stop being cropped text lists and reach DESKTOP
  INFORMATION PARITY in a console-native composition. **Rich rows**
  (`ConsoleSheetRow.ma` payload → a dedicated grid branch in
  `ConsoleSheet`): the ART tile (the SAME `assets/ma/<slug>.png` the
  desktop overlays bind — recognition 1:1; the legacy `.ma-name--*`
  sprites are SCOPED to the legacy block and unusable standalone), the
  NAME, the rule text, **MY progress chip** («4 / 8» vs the per-game
  `threshold` the server populates; GREEN = claimable now — the
  server's `claimable` flag / the live option, never a client
  re-derivation; RED = not yet; awards: amber LEAD chip when I hold the
  top score), the **rivals' player-coloured score badges** (awards
  highlight the current leader with a gold rim), the cost chip, the
  taken state (owner chip + «Получено»/«Спонсировано» label) and the
  inline Ⓐ on an available row. **Near-fullscreen**: `--wide` panel
  (min(1520px, 96vw) × 90vh; handheld 96vw × 88vh) — the list owns the
  vertical; the head is one compact line with a **summary subtitle**
  («Получено: N/3 · 8 M€» / «Спонсировано: N/3 · <price>»).
  **Scroll done right**: the rows area is the RS scroll target
  (`con-info__scroll` — the P17 global right-stick scroll picks it up,
  chrome-less), d-pad navigation AUTO-SCROLLS the selected row into
  view, and a sheet/tab switch resets to the top; the foot advertises
  RS Scroll. Standard-project / basics / card-action sheets keep their
  existing rows untouched. Gates: 95 console specs, vue-tsc, eslint,
  make:css, build:client — green.
- **P23 — SHIPPED (the MA premium VISUAL rework + the 512×512 art
  format + desktop alignment).** The console MA sheet stopped being a
  grey list. **Header:** the category SYMBOL (`BarButtonIcon`
  milestones/awards) + the live status; all claimed/funded → a GOLD
  «Все получены / Все спонсированы» chip. **Overlay:** the backdrop
  dims far less for the MA sheet (a quick-glance STRATEGIC panel — the
  board stays readable), the panel lifts to the HUD line
  (`calc(100vh − 116px)`, handheld −92px) and got a lighter glass body.
  **Row v2** (grid: stage / hierarchy / progress / CTA): the ART STAGE
  is built for the incoming TRANSPARENT 512×512 icons — `contain`
  (never a crop) on a soft glass pedestal with an under-glow; the
  legacy 140×83 art letterboxes gracefully until replaced. Strong
  name/rule hierarchy (22px uppercase name). The MAJOR «Вы» chip
  (label + 21px number, green = eligible / red = not yet / amber LEAD
  on awards); the labelled «Соперники» strip shows OTHER players ONLY;
  the CTA zone renders [A Взять / Спонсировать + the M€ ICON cost]
  when available, a muted icon-cost when not, «✓ Получено/Спонсировано»
  when taken. **«Сейчас недоступно» spam is GONE** — availability
  reads from colour + CTA; the reason line renders ONLY on the focused
  row. **Desktop modern alignment:** both overlays' badge strips now
  show RIVALS only (`rivalSortedScores` — the viewer's own number is
  the big chip; leader ranking still counts everyone), and the art
  tiles switched to square `contain` stages (64×64) ready for the new
  transparent format. i18n: +3 ru keys (Rivals / All claimed / All
  funded). Gates: 95 console specs, vue-tsc, eslint, make:json,
  make:css, build:client — green.
- **P24 — SHIPPED (the console-native Hydronetwork).** The Delta
  Project board stops being an as-is desktop re-host (clunky DOM-engine
  focus + a browser scrollbar). **One brain kept:** the SAME overlay
  components / hydroNetworkState / delta-preview / `submitHydroAdvance`
  drive everything — payloads stay byte-identical. **Console fit:** the
  `.con-hydro-host` wrapper scales the two-row snake body (×0.92,
  handheld ×0.72 — the ANIMATED snake dashes untouched), compacts the
  hero (2-line lore clamp), hides the desktop ✕ (B owns closing), kills
  the inner scroll (`track-wrap: overflow visible`) — the host itself
  is the chrome-less RS fallback. **The shell owns the pad** (the
  fallback branch hands `overlay-hydro` to `handleHydroIntent` when
  hydro is the TOP surface; a desktop modal on top keeps its own scope;
  a CONSOLE layer on top — Info / sheet / wheel / confirm / reveal —
  falls through to the normal console flow): ←/→ inspect/plan stages
  (`onSelectPosition`), LB/RB spend −/+, Y = MAX, ↑/↓ cycle the reward
  choice on stages that offer one, **A = the smart primary** (a
  mandatory card pick first → then confirm; honest notice otherwise),
  X = open the pick, LT = Info, View = journal, B = board. The command
  bar mirrors it ([dpadH Этапы · LB/RB ±1 · Y MAX · A Confirm · B]).
  **The stage-7/9 card pick went CONSOLE-NATIVE** (it used to abort
  with «needs desktop mode»): a new `hydroPick` SHEET lists the
  overlay's own `eligibleCards` (name + manifest rule text + the live
  animal count), A writes `hydroNetworkState.selectedCard` (the same
  field the desktop pick-modes write — a pure plan write, never a
  submit) and the confirm flow proceeds natively; the overlay's mouse
  pick button routes to the same sheet. i18n: +2 ru keys (Stages /
  Select action). Gates: 95 console specs, vue-tsc, eslint, make:json,
  make:css, build:client — green.

---

## STATUS LOG (implementation)

**P0 + P1 core — SHIPPED (2026-07-03).** Files: `src/client/console/`
(`consoleModeState` — `tm_console_mode` / `?console=1|0` / consented entry
prompt; `turnIntents` — the pure waitingFor walkers mirroring PlayerHome's
audited contracts, 10 specs; `consoleRouter` — module state + intent
bridge), `src/client/components/console/` (`ConsoleShell` — headless
WaitingFor transport + submissions + intent handling; StatusStrip /
SectionStrip / CommandBar / TurnMenu / Sheet / BoardSection / HandSection /
EntryPrompt), `src/styles/console.less` (TV type ramp ≥18–26px, overscan
padding, spotlight selection, dark-glass premium).

Working on the pad end-to-end: consented entry (A/B) + hold-Menu shell
toggle both ways · Board section (hex traversal, cell dossier via
BoardInformation facts in the inspector, spotlight) · placement
(legal-constrained nav, LT free-roam, mint/red spotlight, A = the existing
per-cell submit, X = cancel when `placementContext.cancellable`) · Hand
section (playable-first carousel + big-card inspector + inline Ⓐ chip +
server unplayable-reasons + RT/LT next-playable via triggers) · Turn Menu
(Y; all verbs + reasons + counts) · sheets: standard projects (incl.
alt-resource payment modal re-host), milestones, awards · convert
plants/heat (heat maxtemp confirm; plants = client-side picker, nothing
committed until the space) · pass confirm / end turn · play-a-card via the
re-hosted premium payment modal (fallback engine drives it) · fallback
arbitration (`resolveScope() !== undefined` = a fallback surface owns
input; command bar switches to «Ожидает решения»); minimize affordances
hidden in console mode (a minimized fallback would be pad-unreachable).

**Feedback iteration 1 — SHIPPED.** (1) Board clipping fixed: the desktop
auto-scale engine (desktop-chrome reservations) replaced by a console-own
fit in `ConsoleBoardSection` (ResizeObserver on the stage → `--board-scale`
from the real stage box, natural 670×582). (2) `ConsoleResourcePanel` —
left rail visible in every section: the six resources (stock BIG +
brown production chips) + the premium tag cluster (shared `TagCount`
holders). (3) Icon pass: status-strip global parameters got real icon
boxes (the `wgt-icon--*` classes carry only background-images — size is
desktop-scoped, standalone use rendered nothing); standard-projects sheet
rows got `PROJECT_VISUAL` pictograms + descriptions; turn-menu resource
icons sized explicitly. (4) Styled scrollbars (`.con-scrollbars()` mixin)
on every console scroll surface — no native bars. (5) Duplicate-info
validation: the cursor-anchored `BoardCellInfoPopover` /
`SpecialCellInfoOverlay` are suppressed in console mode (the inspector is
THE cell surface; mouse hover still feeds it via the shared
boardInfoState). (6) Fullscreen on entry: `requestConsoleFullscreen()` on
mode-enable + on gamepad-mode entry — HONEST CAVEAT: gamepad input grants
no user activation in Chromium, so the direct call can fail on the web; a
one-shot trusted-gesture (mouse/keyboard) retry arms itself, and Electron
is fullscreen by default. Exit console mode → exitFullscreen.

**Feedback iteration 2 — SHIPPED (console command model).** The main board
became the real console HOME SCREEN. (a) **LB/RB are semantic on the
board**: LB = Milestones, RB = Awards — TV-size sheets, viewable ANY time
(rows from `game.milestones/awards`); claim/fund availability = the server
option tree; the command bar shows mint badges + glow when something is
claimable. Inside menus LB/RB are not reserved. (b) **Y = «Базовые
действия»**: standard projects (PROJECT_VISUAL pictograms + costs) + SELL
PATENTS (a console sale mode of the hand carousel: A toggles picks with
amber frames/ticks, X sells N, submission = the wrapped SelectCard payload)
+ conversions (costs from `plantsNeededForGreenery`/`heatNeededForTemperature`)
+ End Turn + Pass, in grouped sheet sections (header rows skipped by nav —
`stepSelectable`). (c) **LT = the category ACTION WHEEL** (polar ring +
hub): Cards → hand, Card actions → a sheet of every action source
(available NOW per the server's perform-action SelectCard; activation
submits the wrapped card response, follow-ups ride the fallback modals;
blocked rows show the server `actionReasons`), colonies/hydro/effects
honestly disabled; the Journal is NOT in the wheel (View owns it).
(d) **B grammar**: sheet/wheel → board; hand/sale → board; placement →
cancel when `placementContext.cancellable`, else «Требуется выбор»; board →
drops cell focus back to the turn summary; never destructive. (e) **Top
HUD action intelligence**: Карты playable/total + Действия
available/total (`availableBlueCardActionCount` / `playerActionSourceCount`
— the desktop buttons' own sources). (f) **Right panel = Context+Command
Panel** (`ConsoleContextPanel`): placement task state (title + legal/illegal
+ the SERVER's per-cell illegal reason from `SelectSpaceModel.illegalSpaces`
via `placementReasonToUnplayable` + facts + full command list), focused-cell
identity (header/name/OWNER chip/facts), or the idle HOME summary (counters
+ the LB/RB/Y/LT command map with badges). (g) **Board bigger**: the LB/RB
section strip is REMOVED, banner/status/left-rail/inspector slimmed — the
freed band goes to the board (its own fit engine picks it up). (h) RT is
now real: next legal cell (placement) / next playable card (hand).
Deleted: `ConsoleSectionStrip.vue`, `ConsoleTurnMenu.vue`.

**Feedback iteration 3 — SHIPPED (LT Information Mode · RT wheel ·
console Colonies/Hydro).** New philosophy: **RT = «что я могу сделать», LT
= «что мне нужно знать»**. (a) **LT Information Mode** (`infoModeState` +
`ConsoleInfoMode`): a read-only, full-screen TV dashboard per player —
resources+production (headline grid), tags (TagCount), extra card-resource
summary (X → per-card detail from PUBLIC tableaus), cards N/M (opponents:
`cardsInHandNbr` ONLY — contents never leak), actions N/M (Y → detail with
server availability + `actionReasons` for self, read-only for opponents),
effects count/discounts (RT → detail reusing the REAL desktop EffectBlock
graphics), VP summary+detail (A) through the SAME pure
`buildVictoryPointsModel` and the SAME visibility rule (self ‖
`showOtherPlayersVP`; hidden → «Очки скрыты до конца игры», A disabled).
LB/RB switch the viewed player (you/turn/passed chips). Opening captures a
CONTEXT SNAPSHOT (section/sheet/indices/cell/sale picks); closing restores
it exactly, degrading via the existing clamps; a placement arriving mid-Info
restores to the board. LT works from board/hand/sheets/colonies/sale and
(via a scope carve-out) from the fallback-driven Hydro surface; in
placement LT stays the free-roam hold (mandatory flow). (b) **RT wheel**:
RT opens the wheel from the board home ONLY (RT elsewhere keeps local
jumps); sectors carry DIRECT hotkey glyphs — A=highlighted/default Cards,
X=Card actions, Y=Hydronetwork, RB=Colonies, LB=Effects (→ Info Mode's
effects detail), B=close; RT is NOT an internal shortcut; Journal stays on
View. (c) **Console Colonies** (`ConsoleColoniesSection`): the real premium
ColonyTile renders in a selected rail + a dossier panel (track, markers,
fleet, trade legality from `findTradeColonyContext` — server truth — with
honest reasons incl. «уже посещена»); A opens the reused
`ColonyTradePaymentModal`; the and-response submission mirrors the desktop
byte-for-byte. (d) **Console Hydro**: the premium `HydroNetworkOverlay`
mounts as a console screen (wheel → Y), driven by the demoted focus engine
(its scope def), confirm → the mirrored `submitHydroAdvance` batch;
close/B → board. Hints updated everywhere (board: Y базовые · RT действия ·
LT инфо · LB/RB вехи/награды+badges · View журнал).

**Feedback iteration 4 — SHIPPED (full console lifecycle, first pass).**
(a) **GamepadLayer mounts on EVERY screen** (`:screen` prop) — the
controller works from the main menu through endgame; the consented console
entry prompt is available at the menu. The `console-mode` <html> class is
now OWNED by GamepadLayer (a `consoleModeState.enabled` watcher), so
lifecycle screens get console styling too. (b) **System overlay
(`ConsoleSystemMenu`)** — the Menu button in console mode opens a premium
system menu from ANY lifecycle context: Управление (the mapping legend),
Выйти в главное меню (calm confirm → the same safe `location.assign('/')`
the desktop corner button used; «партия сохранена»), Вернуться. Menu-hold
still toggles the shell. The desktop «МЕНЮ» corner FAB (`GameExitButton`)
is hidden in console mode — system actions never sit on the gameplay bar
(the board bar gained `Menu Система` as the labeled entry). (c) **Lifecycle
scope defs** (`mainMenu`/`createGame`/`lobby`/`joinPanel`/`finalReveal`) —
the premium main menu, create-game screen, GameHome lobby, join panel and
the final-scoring reveal are pad-drivable via the demoted engine with
per-scope hints (the iteration-1 hint bar now ALSO shows in console mode
whenever the ConsoleShell command bar isn't mounted —
`consoleState.shellMounted`). Console TV boost: menu actions ×1.18, join
panel ×1.12, lobby ×1.3. (d) **Lifecycle-aware fallback naming** — the
console command bar names the wrapped premium flows («Начало партии» /
«Итоги партии» / «Карты» / «Колонии») instead of a generic «Ожидает
решения» (`consoleState.fallbackScopeId`). Endgame minimize is hidden in
console (its pill would be pad-unreachable; the system menu owns exit).

**Scope calls (honest):** the initial draft / start-game / inter-generation
draft flows REMAIN the existing premium App-level wizards (already
step-shaped), driven by the fallback engine with lifecycle-named context —
a bespoke console re-skin of those wizards + a console-native create-game
form (the desktop form has text inputs → needs the input-overlay decision)
are the next iterations. Text entry on pad is out of scope (§14).

**Honest gaps (P2+):** hydro internals are fallback-engine-driven (not yet
fully console-native); colony BUILD prompts ride the fallback modal;
Info-Mode extra-resource rows have no per-card zoom yet; sell patents = disabled
Turn-Menu rows with «Пока доступно в режиме рабочего стола» (hold-Menu is
one gesture away); >3-candidate / multi-card target picks inside the play
modal abort with the same notice (desktop overlay bridges don't exist
here); Table/Journal sections not built (View toggles the desktop journal
panel as interim); mandatory prompts still render as the desktop modal
driven by the fallback engine (the console task system is the next big
build); notifications/turn-handoff render desktop-styled; no per-section
right-stick scrolling yet. Gates: 39 pure specs, ESLint, vue-tsc, make:css,
make:json, build:client — green.

### P27 — Main-board COMMAND MODEL rework (quick selectors / inspection / status chips)

**Mapping (board home):** `Y` = Information Mode (moved FROM LT; inside Info
Mode the actions detail is now LT, Y closes). `RT` = the ACTION-CATEGORY
quick selector (`ConsoleQuickSelector.vue`, cross layout, DIRECT input — a
d-pad direction activates its slot immediately, A = center): A Cards /
↑ Card actions / → **Trading** (the renamed Colonies entry; the desktop
bottom-bar button is renamed too) / ↓ Voting (reserved for Turmoil, honest
disabled reason) / ← Hydronetwork. `LT` = the BASIC-ACTIONS quick selector:
A Standard projects / ↑ Skip turn (End Turn) / ↓ Pass (ALWAYS confirmed,
desktop warning parity) / ← Plant conversion / → Heat conversion. `L3` =
BOARD INSPECTION MODE. LB/RB/View/Menu unchanged. The old action WHEEL is
deleted (`ConsoleActionWheel.vue`); Effects lives in Info Mode (Y → RT).
Entries + honest reasons are PURE (`consoleQuickModel.ts`, 15 specs).

**Standard projects** render on a premium screen
(`ConsoleStdProjectsScreen.vue`, `.con-stdp`, con-ma-style dashboard):
every server project + PATENT SALE as a first-class basic action (Steam
framing), costs, expected results, M€-deficit reasons, wallet
before→after; the same screen serves the T3 mandatory prompt (B =
Minimize). The old `basics` sheet is gone.

**Board inspection (L3):** on the board home the cells are NOT part of the
command loop (d-pad → an honest «Нажмите L3» notice); placement keeps its
automatic navigation. In inspection the candidate set adds the
global-parameter TRACK markers (`[data-arc-marker]` on ArcScaleMarkerChip;
focusing one dispatches a synthetic mouseenter → the SAME premium
ScaleTooltip + a `track` mode in the context panel reading
`scaleTooltipState.content`). The selection spotlight paints ONLY while
live (`.con-board--live`); inspection uses a distinct AMBER dashed hex
(`.con-board--inspecting`) vs cyan placement-browse / mint legal / red
illegal; markers get an amber scanner ring (`.con-marker-sel`).

**Top HUD:** the Cards/Actions intel counters and the players' TR/M€ are
GONE from the strip; chips = identity + live status (reuses
`playerLabels.actionLabelForPlayer` + `playerStatusPresenter` + the real
`actionsTakenThisRound` 1/2 counter; one-shot `con-turn-burst` when the
turn passes to the viewer). The central «ВАШ ХОД» pill is REMOVED — the
banner is reserved for mandatory/critical states.

**Right panel (idle):** the strategic home summary — playable cards /
available card actions (moved from the top bar) + Milestones/Awards race
(claimed/funded-by chips, my threshold progress, live award leaders, slots
left; `buildHomeMaSummary`). No blind command-bar duplication (LB/RB mini
glyphs only). Gates: vue-tsc, eslint, make:css, make:json, 123 console
specs (incl. 15 new consoleQuickModel) — green.

### P27b — command-model follow-ups (feedback pass)

(1) **Y = Info Mode ALWAYS** — every surface's former local Y verb moved to
RT: task-host MAX/confirm, start-scene Continue/Begin, play-confirm MAX,
reveal Take-all, sale-mode Sell, hydro Farthest-available (handlers + all
hint rows). (2) **Strict inspection traversal** — `pickStrictGrid`
(spatialNav.ts, pure + spec'd): left/right never leaves the ROW, up/down
anchors to the COLUMN (`colAnchor`; the half-hex offset tie is structural —
leftmost wins, the anchor pulls the run back); the fallback pick may only
LEAP to off-grid colony cells, never drift to a diagonal neighbour.
Track markers are OUT of the L3 candidate set — **R3 = SCALE INSPECTION**:
`trackMarkers()` sorted by angle around the board centre, prev/next walks
the ring cyclically («по кругу»), entry lands nearest 12 o'clock; the
focused bonus fires its ScaleTooltip + the panel's track mode now also
NAMES the owning scale (`trackInfo.accent`). The board-home bar gained
`R3 Осмотр шкал` and dropped `Menu Система` (universal knowledge).
(3) The right panel's idle «Ваш ход» kicker is gone (top chips own it).
(4) Console-only layout: LEFT off-Mars colony flank pulled to ~r322,
planet nudged `translate(10px, −6px)` + ~3% more scale (`STAGE_PAD_Y=5`).
(5) Status strip: player chips LEFT (desktop parity), parameters RIGHT,
generation reads «ПКЛ. N» (key `GEN.`). (6) Inspection cell mode shows the
curated special-cell LORE (`getSpecialCellInfo` → the panel's amber lore
block); placement stays lean. Gates: vue-tsc, build:client, 161 specs
(console + gamepad, incl. 4 new pickStrictGrid) — green.

### P27c — Deck polish pass

(1) **Board fill** — console-measured footprint replaces the desktop
constants (`BOARD_NATURAL 670×582 → 644×556`, `STAGE_PAD 16→10`,
`STAGE_PAD_Y 5→4`; the arc is compacted to r338/r322 so the true content
box is smaller); the planet nudge relaxed to `translate(6px, −4px)`.
(2) **Scale hover parity in R3** — the panel's track mode now mirrors the
owning SCALE's own hover-overview under the bonus (`.con-context__scale`:
scale name + current value + description — the exact
`ArcScale.overviewContent` shape, rebuilt from `ARC_SCALE_THEMES` + the
game model in `ConsoleShell.trackScaleOverview`); the redundant kicker
suffix is gone. (3) **Home-panel packing** — the first block hugs the top
(`:first-child { margin-top: 0 }`, no kickers in the info form), and the
handheld profile compacts the whole `.con-home__*` family + the new
`__pstatus` chips so cards/actions/milestones/awards INCLUDING the
«Свободных слотов» line fit the Deck height without scroll. Gates:
vue-tsc, build:client, 161 specs — green.
