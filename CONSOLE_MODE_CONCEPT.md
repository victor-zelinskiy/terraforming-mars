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

**Honest gaps (P2+):** colonies trade / hydro / sell patents = disabled
Turn-Menu rows with «Пока доступно в режиме рабочего стола» (hold-Menu is
one gesture away); >3-candidate / multi-card target picks inside the play
modal abort with the same notice (desktop overlay bridges don't exist
here); Table/Journal sections not built (View toggles the desktop journal
panel as interim); mandatory prompts still render as the desktop modal
driven by the fallback engine (the console task system is the next big
build); notifications/turn-handoff render desktop-styled; no per-section
right-stick scrolling yet. Gates: 39 pure specs, ESLint, vue-tsc, make:css,
make:json, build:client — green.
