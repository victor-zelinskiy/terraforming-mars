<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

## Action UI Rework (in progress)

This fork is migrating the per-action UI away from upstream's generic `wf-action` + `btn-submit` radio-button form and toward **dedicated styled buttons** on each game element (milestones first, awards / standard projects / convert-plants / colonies to follow). The radio UI still exists and works — once every action type is migrated it will be hidden, not removed.

When you add a new dedicated action button, follow this contract:

1. **Tie the button to the server's action-availability logic, not to the radio render.** Walk the `playerView.waitingFor` tree (recursively, since the prompt can be nested) to find the `OrOptions` whose `title` matches the action prompt (e.g. `'Claim a milestone'`, `'Convert 8 plants into greenery'`). The server has already filtered options by every rule (cost, prerequisites, phase, opponents-have-passed, etc.) — **the option's presence in that tree IS the source of truth for "available right now."** Do not re-derive availability from raw player state on the client.
2. **Submit through `WaitingFor.onsave()`** with the nested `OrOptionsResponse` payload (`{type:'or', index:I, response:{...}}` wrapping recursively, with a `{type:'option'}` innermost). Bypasses the radio UI but is byte-for-byte identical to what `OrOptions.vue` would have sent — no server changes needed. The reference implementation lives in `PlayerHome.vue` → `findMilestoneOptionPath` + `claimMilestone`.
3. **Show the button as disabled, not hidden, when the player meets the conceptual prerequisite (e.g. score threshold) but can't act right now.** Use a `:title` tooltip with the blocker reason translated via i18n. Reasons we distinguish for milestones: insufficient M€ (`Not enough M€`), and not-your-turn / mid-sub-action (`Not your turn to take any actions`). Hiding the button is worse UX — the user is left guessing why an action they're entitled to disappeared.
4. **Don't refactor the existing radio-button stack** (`WaitingFor.vue`, `OrOptions.vue`, `SelectOption.vue`, server prompt code). They have to keep working unchanged while migration is in progress, and the eventual hide is a stylesheet flip — not a deletion.

The Milestones overlay (`MilestonesOverlay.vue` + `PlayerHome.vue` claim handlers) is the canonical example; mirror its detection + submission pattern when you wire up new action buttons.

## UI Philosophy: dedicated buttons vs. mandatory-input modals (DESKTOP — frozen; console-port design spec)

**Full spec moved to `docs/DESKTOP_UI_PHILOSOPHY.md`** (Action UI Rework contract, SelectPaymentV2 / WGT pilots, `CardSelectionContent` adaptive-fit `cardSelectionRowPlan`, client-side Standard-Projects payment preview, modal minimize / picker-mode, PlacementBanner + placement lock). It documents the FROZEN desktop surface — read it as the DESIGN SPEC for the console port (see the NORTH STAR banner), not as desktop to extend. The load-bearing cross-cutting INVARIANTS (they carry over to console):

- **Two prompt kinds, two surfaces.** (A) VOLUNTARY top-level actions (`Player.getActions()`: play card / trade colony / fund award / claim milestone / convert plants·heat / standard project / blue-card action / CEO action / send delegate / pass / sell patents / end turn) → each gets a DEDICATED, persistently-visible button. (B) MANDATORY sub-prompts (payment / discard / steal-from / place-tile / colour pick / Reds tax) → a centered MODAL over a darkened backdrop, not dismissible by outside-click.
- **Availability is SERVER-authoritative, never re-derived client-side.** A dedicated button's enabled state mirrors the matching option's PRESENCE in the `waitingFor` `OrOptions` tree (the server already filtered by every rule). Submit via `WaitingFor.onsave()` with the nested `OrOptionsResponse` payload — byte-identical to the radio UI (no server change). Show DISABLED with a premium-tooltip reason (not hidden) when the player meets the conceptual prerequisite but can't act right now.
- **⚠️ Placement lock — keep `PLACEMENT_LOCKED_SELECTORS` in sync in TWO places** when adding a turn-ending button: the array in `PlayerHome.vue` (JS capture-phase click-block + tooltip) AND the selector list in `src/styles/placement_banner.less` (visual dim). CSS alone won't block clicks; JS alone won't dim. Left-panel Pass / End-turn are the exception — HIDE with `visibility: hidden` (NOT `display: none`, which reflows the panel).
- **Don't refactor the legacy radio stack** (`WaitingFor.vue` / `OrOptions.vue` / `SelectOption.vue`) — it stays working under the modern surfaces until a stylesheet flip hides it.

