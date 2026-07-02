# BRIEF — Premium Gamepad (W3C Gamepad API) support for the modern-premium UI

> **This is a brief for a senior front-end / game-UX architect (Claude Fable 5).**
> Your job in this task is to **audit the codebase and produce an implementation
> PLAN + design document**, NOT to write the production feature. Do a rigorous
> architectural audit, research the ecosystem, and design the right approach
> yourself. This brief tells you WHAT the product must be, WHAT to study, and the
> quality bar — it deliberately does **NOT** tell you HOW to build it. The "how" is
> your deliverable.

---

## 0. Mission in one sentence

Design a **first-class, premium controller experience** — full W3C Gamepad API
(`https://www.w3.org/TR/gamepad/`) support — for the `terraforming-mars` fork's
**modern-premium UI**, so the entire game is comfortably playable end-to-end with
an **Xbox controller** and *feels* like a native console port, not a bolt-on.

---

## 1. Product vision — what "premium gamepad" means HERE

The bar is the same as the rest of this fork (see `CLAUDE.md` §"Project Goals":
single-screen no-scroll play, Steam-version density, Ark Nova / BGA animation feel,
active premium visual refresh). The gamepad experience must live up to that. It is
**not** "make Tab-focus reachable with a d-pad". It is a designed mode:

- **The mouse cursor disappears** the moment the player uses the controller, and
  comes back the instant they touch the mouse (seamless input-mode switching —
  gamepad ↔ mouse ↔ keyboard coexist; the *active* mode drives the presentation).
- **Every actionable on-screen element shows the contextual controller glyph** it
  responds to — Xbox button badges (A / B / X / Y / LB / RB / LT / RT / d-pad /
  sticks / View / Menu). The glyphs are contextual (they change with the current
  screen / focused element / available actions), premium-styled, and consistent
  everywhere. (Xbox layout only for now — but the design must not hard-code "Xbox"
  so PlayStation / Switch glyph sets can be added later without a rewrite.)
- **Native, comfortable navigation** of the Mars board (cell-by-cell across a hex
  grid, with placement), of every card grid / card selection, of the resource &
  tag clusters, and of every overlay and modal — no dead ends, no "you must grab
  the mouse for this one step".
- **Convenient overlay control** — opening / switching / closing the bottom-bar
  overlays (Log/Journal, Played, Cards, Effects, Actions, VP, Milestones, Awards,
  Standard Projects, Colonies) and the top-bar chrome feels fast and native
  (bumpers? a radial? a quick-menu? — *your* call from the audit).
- **Real premium transitions and a real mode**, not a checkbox. Entering / exiting
  gamepad mode, moving focus, opening overlays, confirming, going back — all smooth,
  calm, on-brand (reuse the fork's motion system), with a clear but unobtrusive
  "controller mode" presentation. **Haptics** (the Gamepad Haptic Actuator) are on
  the table as premium feedback if it fits.

**The acceptance feeling:** a player picks up an Xbox controller, the cursor
vanishes, button hints appear over everything, and they play a *complete* game of
Terraforming Mars — draft, play cards, place tiles, pay, fund awards, claim
milestones, trade colonies, read the journal, reach the endgame screen, start a
rematch — without ever touching the mouse or keyboard, and it feels premium.

---

## 2. THE hard constraint — modern-premium UI ONLY

This fork spent a long migration replacing upstream's generic radio-button / inline
input UI with a **modern-premium** surface (dedicated action buttons, centered
mandatory-input modals, premium overlays, the fullscreen card browser, the
start-game flow, etc. — all documented at length in `CLAUDE.md`).

- **Gamepad support targets the modern-premium UI EXCLUSIVELY.**
- The **legacy UI is dead**: the old radio stack (`WaitingFor.vue`'s inline radio
  rendering, `OrOptions.vue`, `SelectOption.vue`, the legacy `SelectCard.vue`
  checkbox list, `AndOptions.vue`, the `.legacy-ui-overlay`, `GameEnd.vue`) is
  `display:none` and **the player can no longer complete a normal game flow through
  it**. Its files remain in the repo but are not engaged. **Do NOT add gamepad
  affordances to legacy components.** Do NOT try to make the legacy radio UI
  controller-navigable.
- ⚠️ **Nuance to resolve in your audit:** the *submission plumbing* is shared —
  e.g. `WaitingFor.onsave()` / `onsaveBatch()` (POST `/api/player-input`) is the
  single submit path used by BOTH the dead legacy UI and the modern surfaces. So
  "legacy is dead" means the legacy **rendering** is out of scope, not that
  `WaitingFor.vue` as a whole is untouchable. Also: a *few* cards still fall back to
  a legacy-rendered input **inside** the otherwise-modern flow (e.g. the nested
  `AndOptions.vue` for `FocusedOrganization` / `AeronGenomics`, per `CLAUDE.md`).
  **Find every such residual-legacy-in-modern-flow case during the audit and flag
  it with a scope recommendation** (cover it, or declare it a known gap) — do not
  silently leave a dead end.

---

## 3. What to STUDY (audit targets) — read before you design

You must understand this codebase deeply before proposing anything. Start from
`CLAUDE.md` (it is a dense, authoritative map of every premium subsystem), then read
the code. Catalog, for every surface below, its **current mouse + keyboard
affordances**, what "focusable / actionable" means on it, and how it mounts /
unmounts / re-renders.

**3a. The modern-premium interactive surfaces (the things a controller must drive):**
- `src/client/components/PlayerHome.vue` — the main game view + the `activeOverlay`
  state machine (how overlays open/close/switch), the dedicated action buttons
  (milestone claim, award fund, convert plants/heat, standard projects, colony
  trade, sell patents, pass, end turn), the placement-lock system, the pill/minimize
  system.
- The Mars board: `src/client/components/Board.vue`, `SelectSpace.vue`, the board
  hover inspector (`board/BoardCellInfoPopover.vue`, `board/boardInfoState.ts`),
  the placement preview + `PlacementBanner.vue`, per-cell "why not here" popover.
- The bottom-bar overlays (each is a premium surface with its own internal nav):
  `handCards/HandCardsOverlay.vue`, `playedCards/PlayedCardsOverlay.vue`,
  `actions/ActionsOverlay.vue` (master-detail, already arrow-key navigable — study
  it), `effects/EffectsOverlay.vue` (master-detail), `overview/VictoryPointsOverlay.vue`,
  `colonies/ColoniesOverlay.vue`, `awards/AwardsOverlay.vue`,
  `MilestonesOverlay.vue`, `StandardProjectsOverlay.vue`,
  `journal/JournalPanel.vue`.
- The mandatory-input modal + the modern input components:
  `MandatoryInputModal.vue`, `modalInputs/ModalInputHost.vue`, and every
  `Modern*` input (`ModernOptionPicker`, `ModernPlayerPicker`, `ModernAmountSelector`,
  `ModernResourcePicker`, `ModernResourcesPicker`, `ModernProductionToLose`,
  `ModernConfirm`, `ContextualChoiceContent`, `CardSelectionContent`), plus the
  bespoke `ColonyTradePaymentModal` and the payment widgets.
- Card flows: `card/CardZoomModal.vue` + `CardZoomCard.vue` (the fullscreen browser,
  already ←/→ navigable — study it), `Card.vue` (click-to-zoom, the `cardInstance`
  computed), the hand-play flow (`HandCardPaymentContent.vue`), the action-confirm
  flow (`CardActionConfirmContent.vue`), and the play-modal target pickers
  (`ActionTargetCard`, the played/hand board-pick modes).
- Orchestration flows: `startGameFlow/StartGameFlowOverlay.vue`,
  `DraftFlowOverlay.vue`, `initialDraft/InitialDraftFlowOverlay.vue`.
- App-level layers: `notifications/NotificationLayer.vue` (+ `NotificationCard`),
  the endgame experience (`endgame/EndgameExperience.vue` + tabs), `rematch/RematchLayer.vue`,
  the drawn-cards reveal, the reveal viewers.
- The resource / tag clusters (`overview/PlayerResource(s).vue`) and the
  convert-action affordances.
- `card_action_buttons.less` (`cab-*`) — the shared button design system, and the
  premium tooltip system (`.premium-tooltip` / `data-hint`).

**3b. Existing keyboard / focus / input infrastructure (reconcile with, don't fight):**
- `HomeMixin.navigatePage` (owns `KeyA`/`KeyD` = jump to board / hand, on a window
  listener that ignores open dialogs).
- The per-component keyboard handlers already present: `CardZoomModal` (←/→,
  animating guard), `ActionsOverlay` (arrow/Home/End/Enter/Space master-detail nav),
  Esc-to-close across overlays/modals, the modern inputs' select→confirm + Enter/Space,
  the modal picker-mode / minimize.
- How submission works: the action-detection contracts (walk the `playerView.waitingFor`
  tree to find the option; dedicated buttons mirror the option's presence; submit via
  `WaitingFor.onsave()` / `onsaveBatch()` byte-identically to the radio UI). A gamepad
  "confirm" MUST go through this same path — never a parallel submit.
- The i18n system (`v-i18n`, `translateText`), the premium-tooltip rule (**native
  `title` is banned** — §"Premium tooltips" in `CLAUDE.md`), the icon system
  (`BarButtonIcon`, resource/tag sprite classes).

**3c. The load-bearing ARCHITECTURE facts (a focus/mode system must respect these):**
- **NO-REMOUNT + structural sharing + reset-epoch** (`CLAUDE.md` §"Update model"):
  `<player-home>` is NOT remounted per response; a fresh `playerView` is applied
  reactively via structural sharing (`utils/viewSnapshotShare.ts`), and transient UI
  resets ride a `reset-epoch` (`PlayerHome.resetTransientUi()`), not a `:key`. A
  focus manager keyed on DOM/Vue state must survive structural-sharing re-renders,
  overlay mount/unmount, and the reset-epoch — without losing or mis-placing focus.
- **Teleports everywhere:** most overlays / modals / popovers / pills
  `Teleport to body`, with a deliberate z-index stack (documented in `CLAUDE.md`).
  Focus/navigation must work across teleported DOM, not just the in-tree hierarchy.
- **The unified motion system** (`components/motion/motionTokens.ts`: `motionMs()`,
  `--motion-scale`, `MOTION_EASE`, `createFrameGate` FPS cap, presets, and a separate
  `prefers-reduced-motion` axis). Any gamepad animation/timing MUST route through it,
  not hand-rolled durations. The rAF gamepad poll loop should be mindful of the same
  FPS-gate discipline.
- **Performance context:** a large perf pass just shipped (`PERFORMANCE_AUDIT.md`) —
  the app is rendering/compositing-bound, and there is an Electron GPU-tuning +
  webp + no-remount baseline. The gamepad poll loop and any focus-driven re-renders
  must not reintroduce jank (no per-frame layout thrash, no per-frame Vue re-renders).
- **Browser AND Electron:** the app ships as a web build and an Electron 43 desktop
  shell (`electron/`, `ELECTRON_MIGRATION_PLAN.md`). Both are Chromium, so the
  Gamepad API is available in both — but call out any Electron-specific
  considerations (focus, fullscreen, the `app://` origin, gamepad permission/gesture
  gating) you find.

---

## 4. Coverage the plan MUST address (framed as requirements, not solutions)

Your plan must show how EVERY item below is handled on the controller. (How = your
design.) A checklist / coverage matrix in the deliverable is expected.

1. **Input-mode detection & cursor hiding** — gamepad activity hides the cursor +
   switches presentation to "controller mode"; mouse/keyboard activity restores their
   mode instantly; the three modes coexist without fighting.
2. **A focus / spatial-navigation model** for a complex, dynamic, teleported,
   structural-sharing UI — the central design problem. What is focusable, how focus
   moves (d-pad / sticks), how it's scoped per surface, how it survives re-renders and
   overlay transitions, how it never gets lost or trapped.
3. **Contextual controller glyphs on every actionable element** — a consistent,
   premium, extensible glyph layer (Xbox now; PS/Switch later) that reflects the
   *current* action mapping and updates as context changes.
4. **Board navigation + tile placement** — moving across the hex grid, understanding
   legal/illegal cells, previewing, and committing a placement with the controller
   (reconcile with `SelectSpace.vue` + the placement banner + cancel flows).
5. **Card navigation** — every card grid (hand, played, draft/buy/research selection,
   target pickers) and the fullscreen card browser, fully controller-driven
   (select / confirm / page / zoom).
6. **Overlay control** — open / switch / close every bottom-bar overlay + top-bar
   chrome, plus scroll long content (journal, long lists) via the sticks.
7. **Every mandatory / modal prompt** — payment, option pickers, player/amount/resource
   pickers, contextual choices, colony-trade payment, WGT, etc. — navigable, confirmable,
   and (where allowed) cancellable/minimizable on the controller, with focus trapping.
8. **The orchestration flows** — start-of-game (prelude + corp first action), draft,
   initial draft — controller-complete.
9. **The standard turn actions** (the full `Player.getActions()` list in `CLAUDE.md`
   §"UI Philosophy": play card, trade colony, fund award, claim milestone, convert
   plants/heat, standard project, blue-card action, CEO action, delegate, pass, sell
   patents, end turn) — each reachable and executable on the controller.
10. **Confirm / back / cancel semantics** — a coherent global grammar (e.g. what A
    and B mean everywhere) that maps onto the existing select→confirm, Esc-to-close,
    minimize, and placement-cancel behaviors.
11. **Notifications, reveals, endgame, rematch** — the app-level layers reachable /
    dismissable / actionable on the controller.
12. **Connect / disconnect / multiple gamepads / reconnection** — graceful handling
    per the W3C spec, including the privacy gesture-gate (gamepads only appear after a
    button press) and deadzones.
13. **Accessibility & settings** — interplay with `prefers-reduced-motion`; a way to
    enable/disable/tune (deadzone, sensitivity, glyph set later); never break the
    existing mouse/keyboard players.
14. **The residual-legacy-in-modern-flow cases** (§2) — flagged with a scope decision.

---

## 5. Research mandate (do this as part of the audit)

- **Master the W3C Gamepad API standard** (`https://www.w3.org/TR/gamepad/`) —
  `navigator.getGamepads()`, `gamepadconnected` / `gamepaddisconnected`, the
  **"standard" mapping** (button/axis indices — Xbox maps to standard), the
  **poll-based model** (no button events → rAF polling), analog trigger values,
  stick **deadzones**, the **Gamepad Haptic Actuator** (`vibrationActuator.playEffect`),
  secure-context + **user-activation gating**, and how Chromium (browser + Electron)
  exposes all of the above.
- **Survey the existing ecosystem** for anything that would let us implement this
  *well* rather than reinventing it: libraries / patterns for (a) spatial / directional
  focus navigation, (b) gamepad input abstraction & mapping, (c) focus management in a
  Vue 3 Options-API app with heavy teleporting. For each candidate: what it does, its
  maintenance/health, license, bundle cost, how it would (or wouldn't) fit THIS app's
  constraints (§3c), and a clear **build-vs-adopt recommendation with justification**.
  Do not adopt a dependency without a cost/benefit case; do not reinvent a solved
  problem without a reason.
- Look at how other **premium web games / console-ports of board games** solve
  cursorless controller navigation + glyph layers, and extract the patterns worth
  reusing (conceptually — cite what's transferable).

---

## 6. Invariants / non-negotiables (the plan must honor all of these)

1. **Modern-premium UI only; legacy untouched** (§2).
2. **Additive & coexisting** — mouse and keyboard players must be 100% unaffected;
   gamepad is a third mode, active-mode-detected, never a regression to the others.
3. **Browser AND Electron** both first-class; call out Electron specifics.
4. **No dead ends** — every modern-premium flow must be *completable with the
   controller alone*, start of game to rematch. This is the headline quality gate.
5. **Premium visual + motion language** — reuse the fork's design system
   (`cab-*` buttons, dark glass, cyan accents, L-corner ticks) and the motion system
   (`motionTokens.ts`); **native `title` tooltips are banned**; honor
   `prefers-reduced-motion`.
6. **Survive the architecture** — structural sharing / no-remount / reset-epoch /
   teleports / the `activeOverlay` machine, without breaking or leaking focus.
7. **Submit through the existing contracts** — controller confirmations go through
   `WaitingFor.onsave()` / the dedicated-action-button paths, never a parallel submit.
8. **Performance** — the poll loop + focus system must not reintroduce jank (respect
   the just-shipped perf baseline; no per-frame layout thrash / Vue re-renders).
9. **i18n** — any controller-mode text follows the fork's ru localization rules
   (`CLAUDE.md` §Internationalization; `make:json` duplicate-key rule); glyphs are
   icons, but hints/labels are localized. Xbox-first, extensible to other pads.
10. **Testable** — the plan must say how each layer is guarded (this repo guards every
    subsystem with tests; e.g. pure mapping/nav logic unit-tested under the runner,
    components under mochapack).

---

## 7. Deliverables (what to hand back)

Produce a **design document** in the style of this repo's planning docs
(`REMOUNT_ANIMATION_REWORK_DESIGN.md`, `ELECTRON_MIGRATION_PLAN.md` — phased,
opinionated, with invariants + risks). It must contain:

1. **Architecture audit** — a catalog of every modern-premium interactive surface and
   its current mouse/keyboard affordances + "what is actionable" (a table), plus how
   the input/focus/submission/overlay machinery works today. Include the
   residual-legacy-in-modern-flow findings.
2. **The chosen design** — the focus/navigation model, the input-mode/cursor system,
   the glyph layer, the confirm/back grammar, the mode-entry/exit UX — with the
   *rationale* (why this over the alternatives you considered). This is where you
   commit to an approach; own it.
3. **Library recommendation** — build-vs-adopt, per §5, with justification.
4. **A phased implementation plan** — ordered phases, each shippable and verifiable,
   with a clear "done" per phase and a rollback/coexistence story (mirror how the
   Electron and remount plans are staged). Identify the load-bearing first phase.
5. **Coverage matrix** — every §4 item × how the design covers it (and the scope
   calls on the §2 residual cases).
6. **Risk register + hard problems** — the genuinely tricky parts (focus across
   teleports + structural sharing; hex-grid spatial nav; glyph context correctness;
   the poll-loop/perf; the privacy gesture-gate; etc.) and your proposed mitigations.
7. **Test strategy** and an i18n/asset plan (glyph assets, localized hints).

Write the doc into the repo (e.g. `GAMEPAD_SUPPORT_DESIGN.md`).

---

## 8. Explicit NON-goals for THIS task

- **Do NOT write the production feature.** This is a plan + design. A tiny throwaway
  spike is fine ONLY if you need it to de-risk a claim (say so, keep it out of the
  shipping paths).
- **Do NOT let me (this brief) dictate the "how".** The focus model, the library
  choice, the navigation grammar, the glyph system, the mode UX — all are YOURS to
  design from the audit. Where this brief lists a mechanism as a question ("bumpers?
  a radial?"), that's a prompt to decide, not a hint to obey.
- **Do NOT touch the legacy UI** or try to make it controller-navigable.
- **Do NOT regress mouse/keyboard.**
- **Do NOT add a dependency without a written cost/benefit case.**
- Non-Xbox glyph sets, on-screen/virtual keyboards for text entry (if any exist),
  and haptics-heavy choreography are secondary — design so they *can* be added, but
  don't gold-plate them in the plan.

---

## 9. The quality bar (how a good plan is judged)

A good plan makes it obvious that a player will pick up an Xbox controller, watch the
cursor vanish and premium button hints appear over a UI that stays true to this
fork's look, and play a *complete, comfortable* game without the mouse — and that the
design is honest about the hard problems (focus across teleports + structural sharing,
hex-grid navigation, glyph-context correctness, performance) rather than hand-waving
them. Depth of the audit, soundness of the focus model, and a credible phased path
matter more than breadth of features listed.
