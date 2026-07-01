# AGENTS.md

## Role of Codex in this repository

Codex is a secondary coding agent for this repository.

Claude is the primary coding agent and primary architectural/design assistant for this project. Codex should usually act as:

* a secondary reviewer;
* a focused implementer for small or medium isolated changes;
* a bug investigator;
* a performance reviewer;
* a regression checker;
* an alternative implementation reviewer;
* a code quality and maintainability reviewer.

Codex should not behave as if it owns the overall direction of the project unless explicitly asked.

Before starting any task, read:

1. `AGENTS.md`
2. `CLAUDE.md`

`CLAUDE.md` contains the broader project direction and must be treated as important project context.

If `CLAUDE.md` and `AGENTS.md` conflict, use this rule:

* `AGENTS.md` defines how Codex should behave.
* `CLAUDE.md` defines broader project/product/UI direction.
* If there is still ambiguity, prefer minimal, safe, reversible changes.

---

## Project context

This is a custom premium fork of the open-source Terraforming Mars web implementation.

The project goal is not only functional correctness. The goal is to create a polished, modern, premium-feeling web version of Terraforming Mars with:

* smoother UX;
* better visual hierarchy;
* modern modal and overlay design;
* clearer game flow;
* premium board-game presentation;
* better animations and transitions;
* improved responsiveness;
* less visual clutter;
* fewer confusing legacy UI patterns.

The project should still preserve the real Terraforming Mars game logic. Visual upgrades must not break rules, turn order, card behavior, corporation behavior, generation flow, or expansion-specific mechanics.

---

## General working style

Prefer focused, high-confidence changes.

Avoid large rewrites unless explicitly requested.

Before changing code, understand the existing flow and component structure. This project has a lot of interconnected game logic, so apparently simple UI changes can accidentally affect turn flow, action availability, pending actions, corporation activation, Prelude flow, overlays, or player state.

When reviewing or implementing, always consider:

* whether the change can break game flow;
* whether it can break multiplayer synchronization;
* whether it can break pending actions;
* whether it can create stale UI state;
* whether it can cause unnecessary rerenders or remounts;
* whether it can worsen responsiveness;
* whether it preserves the current premium UI direction.

When asked to review changes, first inspect the local diff and return findings grouped by severity.

Recommended severity groups:

* Critical
* Major
* Minor
* Polish
* Optional improvement

When asked to implement, keep the patch focused and explain what changed.

---

## Codex default behavior

Unless the user explicitly asks for implementation, prefer review first.

For review tasks:

* inspect the relevant files;
* inspect current uncommitted changes if present;
* identify regressions and risks;
* explain likely root causes;
* suggest precise fixes;
* avoid broad speculative rewrites.

For implementation tasks:

* make the smallest safe change that solves the problem;
* preserve existing architecture where reasonable;
* avoid touching unrelated files;
* avoid reformatting unrelated code;
* avoid renaming things unless necessary;
* keep behavior compatible with existing game state and multiplayer flow.

For performance tasks:

* look for unnecessary remounts;
* look for unstable keys;
* look for expensive recalculations inside render paths;
* look for derived data recomputed too often;
* look for large components rerendering because props are unstable;
* look for avoidable state updates;
* look for overlay/card/board components that rerender during unrelated game changes.

---

## Product direction: premium UI

This fork should feel premium, modern, atmospheric, and polished.

UI improvements should generally move toward:

* clearer hierarchy;
* better spacing;
* less clutter;
* softer but readable contrast;
* premium sci-fi board-game atmosphere;
* restrained glassmorphism where appropriate;
* clean hover/focus states;
* better typography;
* smoother transitions;
* better modal composition;
* more consistent buttons and status badges;
* strong visual feedback for completed/applied states;
* layouts that feel intentional rather than legacy/technical.

Avoid:

* cheap-looking gradients;
* random neon overload;
* excessive glow;
* inconsistent border radii;
* cramped controls;
* text-heavy panels without hierarchy;
* hover popups that cover important nearby content;
* visual effects that hurt readability;
* animations that feel slow or heavy;
* UI that looks like a debug/admin panel instead of a premium game interface.

The design should feel like a high-quality digital board game UI, not a generic web form.

---

## Raster asset / icon processing

When updating PNG game assets from generated references, treat the work as precision asset processing, not a loose redesign.

Effective workflow proven on `assets/global-parameters/venus.png`:

* Start from the cleanest reference in `assets/generated/refs/` and write candidates to `assets/generated/...`; do not overwrite the target asset until a candidate is visually checked.
* First identify the background type. Some references are composited over a transparency checkerboard, not a plain white background. Simple white/gray thresholding on those files leaves checkerboard fringes and can cut holes into light metallic art.
* For difficult cutouts, use the AlphaBanana/Gemini pipeline as a candidate generator with an explicit "preserve exact source artwork, remove only background/fringe" prompt. If the MCP server does not see a newly set environment variable, do not persist API keys in config unless explicitly approved; run the same package pipeline directly from the shell with the key inherited from the user/process environment.
* Compare model tiers. For preservation cutouts, a faster model can be better than a higher-fidelity model if the latter redraws or simplifies the source. Reject candidates that change the crop, geometry, bevels, texture, colors, or icon proportions even if their alpha is clean.
* Always inspect previews on both dark and light backgrounds, plus 2x focus crops around inner holes, metallic borders, bottom edges, and any area the user flagged. Use nearest-neighbor enlargement for edge inspection so stair-steps and leftover fringe are obvious.
* After chroma-key/model transparency, clean only semi-transparent edge RGB when needed: replace edge-pixel RGB from the nearest fully opaque source color to remove magenta/white/gray fringe, without changing alpha or fully opaque art pixels.
* Finish with lossless PNG optimization only. Do not apply lossy compression or destructive smoothing that can blur small icons.

Acceptance bar:

* no white/gray checkerboard lines or chroma-key fringe on dark backgrounds;
* smooth antialiased contours without visible pixel stairs;
* no missing chunks, holes, or damaged texture inside the art;
* original frame/border art preserved rather than cropped away;
* final dimensions and placement match the consuming asset.

---

## Important current UI areas

Pay special attention to these areas when reviewing or changing code.

### Startup / new game modal

The new start-of-game modal is intended to replace older legacy startup/corporation activation flows where appropriate.

Important expectations:

* The new modal should provide a premium start-of-game experience.
* It should clearly guide players through Prelude, corporation, and initial flow.
* It should avoid showing old legacy corporation activation modals when the new flow is supposed to handle that.
* Waiting states should be accurate and should describe the real current game state.
* If player A has finished startup actions and it is now player B's relevant corporation/startup action, the UI should not misleadingly say that player B is still waiting for player A to play starting cards.
* Applied Prelude/corporation indicators should be consistent.
* If Prelude cards get green “applied” markers, corporation cards should also have consistent applied state markers after being applied.

### Corporation activation

Be careful with mandatory corporation actions and activation modals.

Known risk area:

* A player can finish Prelude/start cards.
* Another player can still be in a waiting/startup state.
* Turn can move after the first player presses pass.
* The old corporation activation modal may appear even though the new startup modal should fully replace it.

When touching this area, verify:

* first player / second player startup flow;
* corporation mandatory actions;
* pass/end-turn interaction;
* waiting-state text;
* modal visibility conditions;
* pending action ownership;
* active player vs waiting player state;
* whether the old modal can appear unexpectedly.

### Prelude cards

Prelude cards need clear applied/completed feedback.

Known visual risk:

* green applied markers can render under or conflict with card symbols/icons.

When adjusting this:

* preserve readability of card icons;
* avoid covering important card content;
* ensure badge layering is correct;
* ensure consistent behavior between Prelude cards and corporation cards.

### Player selection UI

The player selection screen/modal should feel premium and match the rest of the new UI direction.

Improve:

* layout hierarchy;
* selected player state;
* hover and focus states;
* player card presentation;
* readability;
* spacing;
* responsive behavior;
* visual consistency with the new modal system.

Avoid purely functional/basic list styling.

### Achievements UI

Achievement descriptions should not obscure other rows in an awkward way.

When improving hover behavior:

* prefer side popovers/tooltips where space allows;
* avoid covering the next row of achievements;
* keep descriptions readable;
* preserve quick scanability;
* avoid layout jumps;
* ensure keyboard/mouse usability remains reasonable.

---

## Board and gameplay UI direction

The board is central to the premium feel.

When working on board UI, prioritize:

* clear available-hex highlighting;
* readable tile placement feedback;
* smooth tile animations;
* stable board scaling;
* premium map palette;
* avoiding dimming important tokens too aggressively;
* keeping resource labels readable;
* preserving spatial clarity;
* avoiding visual noise.

Known desired areas:

* improved board-space glow;
* better placement expected banner;
* better hover info for named cells;
* premium map/background treatment;
* responsive scaling for fullscreen/F11 play;
* avoiding heavy layout shifts during tile placement;
* avoiding unnecessary rerenders when tracks move or tiles are placed.

---

## Overlay and card UI direction

Card overlays and hand overlays should be premium, fast, and stable.

Important areas:

* cards in hand overlay;
* selected cards panel;
* draft overlay;
* fullscreen card viewer;
* per-card choose buttons;
* card overflow handling;
* sci-fi scrollbar styling;
* discount/price display areas;
* microcredit icon and cost presentation;
* resource icon placement;
* card hover and focus behavior.

When reviewing card overlays, check:

* unnecessary rerenders;
* expensive recalculations;
* remounting during game actions;
* unstable component keys;
* scroll position loss;
* hover flicker;
* layout jumps;
* poor mobile/tablet behavior;
* whether buttons remain easy to access.

---

## Performance priorities

Performance issues are especially noticeable during:

* board view updates;
* tile placement;
* global parameter track movement;
* card overlays;
* cards in hand;
* draft overlay;
* animations;
* large player/card state updates.

When investigating performance, look for:

* full remounts of large UI sections;
* component keys that change too often;
* derived arrays/objects recreated every render;
* selectors that return new references unnecessarily;
* large components receiving broad game state instead of narrow props;
* expensive filtering/sorting/calculation in render;
* repeated parsing or formatting;
* unnecessary deep cloning;
* unnecessary watchers/subscriptions;
* excessive CSS effects on large DOM areas;
* expensive shadows/backdrop filters applied to many elements;
* animations that trigger layout instead of transform/opacity.

Prefer architectural fixes when the root cause is broad rerendering, but keep the patch focused.

Good directions:

* memoize derived data where safe;
* stabilize props;
* split large components;
* pass narrower state;
* avoid remounting overlays;
* preserve component identity;
* use transform/opacity for animations;
* reduce heavy CSS effects on frequently updating elements.

Be careful not to hide real game-state updates behind incorrect memoization.

---

## Game logic safety

The project is a game. UI changes must not break game logic.

Always be careful with:

* active player;
* player order;
* generation transitions;
* pending actions;
* pass/end-turn behavior;
* corporation activation;
* Prelude phase;
* draft phase;
* standard projects;
* card actions;
* blue card passive effects;
* colony trade flow;
* Venus/Colonies/Prelude expansion logic;
* server-client synchronization;
* multiplayer waiting states;
* undo/redo or rollback-sensitive flows if present.

Never assume a UI flag is only visual without checking whether it also affects game flow.

When changing modal visibility, action buttons, or pending-action UI, verify the server-side meaning of the state.

---

## Logging / game journal direction

The game journal/log should eventually capture all meaningful effects, not only direct player actions.

Important desired improvement:

* all effects should be represented in the journal where appropriate;
* passive effects from blue cards should be logged when they trigger;
* if a passive effect modifies resources, production, cost, tags, draw, placement, or other state, the journal should make that visible;
* the user currently observes that many passive blue-card triggers are not clearly logged.

This may require changes beyond UI. It may require server-side logic updates so that effect execution emits proper log entries.

When asked to work on the journal/log:

* inspect both UI and server-side logging paths;
* identify where passive effects are executed;
* check whether log entries are emitted there;
* avoid solving only in the UI if the server does not provide the necessary events;
* make log messages readable and useful, not spammy;
* preserve multiplayer correctness.

---

## Modal design principles

Modals should feel intentional and premium.

Good modal qualities:

* clear title and subtitle;
* obvious current state;
* strong primary action;
* muted secondary actions;
* good spacing;
* readable card/action grouping;
* consistent close/minimize behavior;
* clear waiting state;
* smooth appearance/disappearance;
* no unexpected legacy modal competing with the new modal;
* no hidden mandatory action.

Avoid:

* stacked competing modals;
* old and new modal systems showing for the same flow;
* unclear waiting messages;
* controls jumping around;
* large empty areas;
* dense text walls;
* cheap-looking buttons;
* inconsistent applied/completed markers.

---

## Animation guidelines

Animations should support clarity and premium feel.

Prefer:

* short transitions;
* transform and opacity;
* subtle scale/slide/fade;
* smooth hover feedback;
* reduced layout thrashing;
* consistent easing.

Avoid:

* long blocking animations;
* animation of width/height/top/left where transform can be used;
* heavy blur/backdrop-filter on frequently updating large surfaces;
* effects that make the UI feel laggy;
* excessive glowing/pulsing;
* animation that hides important state changes.

Respect reduced motion if the project already supports it.

---

## Accessibility and usability

Even though premium visuals are important, the UI must remain usable.

Check:

* text contrast;
* button hit areas;
* focus states;
* keyboard usability where relevant;
* visible selected states;
* readable font sizes;
* tooltips/popovers not covering critical content;
* responsive behavior on smaller screens;
* fullscreen use;
* Xbox/TV-style large-screen usability when relevant.

The UI should be beautiful but still practical for real gameplay.

---

## Code review checklist

When reviewing a change, check:

1. Does it preserve game logic?
2. Does it preserve multiplayer flow?
3. Does it preserve pending action behavior?
4. Does it introduce old/new modal conflicts?
5. Does it create unnecessary rerenders or remounts?
6. Does it make board/card overlays slower?
7. Does it preserve responsive layout?
8. Does it improve or at least preserve premium visual quality?
9. Does it introduce visual inconsistency?
10. Does it cover edge cases?
11. Does it need server-side changes instead of only UI changes?
12. Does it require tests or manual verification steps?

Return review findings with concrete file/function/component references where possible.

---

## Implementation checklist

Before editing:

* read the relevant files;
* understand the current state flow;
* identify the smallest safe change;
* check whether the problem is UI-only or server-driven;
* check whether there are existing helpers/styles/components to reuse.

After editing:

* explain what changed;
* explain why it is safe;
* mention any manual verification needed;
* mention any remaining risks.

If tests/build commands are known and relevant, suggest or run them when appropriate.

---

## Styling conventions

Follow the existing project style.

Do not introduce a completely separate styling system unless explicitly requested.

Prefer reusing existing variables, mixins, design tokens, or component conventions if present.

When adding new styles:

* keep names clear;
* avoid overly generic class names;
* avoid global side effects;
* avoid breaking existing themes;
* ensure styles are scoped appropriately;
* consider dark/premium backgrounds;
* test hover/focus/disabled states.

---

## Russian localization conventions

When editing Russian localization, follow the existing Russian terminology used in this project first. Before choosing a Russian term, search `src/locales/ru/` for the same English term, related forms, or the same game concept, and keep wording consistent with existing translations.

If a game term has not been translated anywhere in the project yet, check the official Russian tabletop localization of Terraforming Mars where possible. Surface those cases to the user instead of silently inventing a new term, especially for card names, resource names, tags, milestones, awards, colonies, corporations, expansion-specific mechanics, and log/action text.

Do not translate corporation names or other proper names unless the project already has an explicit exception for that exact name, such as `Beginner Corporation`.

---

## TypeScript / frontend code expectations

When working in TypeScript/frontend code:

* prefer explicit, readable logic;
* avoid clever abstractions unless they reduce complexity;
* keep components reasonably small;
* avoid passing huge state objects when only a few fields are needed;
* keep derived data stable where performance matters;
* avoid mutating props/state;
* use existing patterns in the repo;
* be careful with nullable/undefined game state;
* handle waiting/transition states explicitly.

---

## Server-side expectations

When working server-side:

* preserve game rules;
* preserve serialization compatibility;
* preserve save/load compatibility where relevant;
* be careful with logs and action resolution;
* do not emit duplicate log entries;
* ensure passive effects are logged at the source of the effect when possible;
* consider multiplayer synchronization.

For journal/logging tasks, server-side changes may be necessary.

---

## How to respond to the user

The user prefers practical, direct, high-signal output.

Good response style:

* be specific;
* group findings clearly;
* separate critical issues from polish;
* provide concrete next steps;
* give complete prompts/files when asked;
* avoid vague advice;
* avoid excessive theory;
* use examples when useful.

When asked for a prompt for another agent, provide a ready-to-copy prompt.

When asked for a full file, provide the full file content.

When asked for review, do not only praise. Be strict and useful.

---

## Common useful Codex prompts for this repo

### Review current changes

Read `AGENTS.md` and `CLAUDE.md` first.

Claude is the primary agent for this repository. You are the secondary reviewer.

Review the current uncommitted changes. Focus on:

* regressions in game flow;
* startup modal / corporation activation edge cases;
* pending action ownership;
* old/new modal conflicts;
* unnecessary rerenders or remounts;
* performance issues in board/card overlays;
* premium UI consistency;
* responsive behavior.

Do not modify files yet.

Return findings grouped by severity: Critical, Major, Minor, Polish.

### Performance investigation

Read `AGENTS.md` and `CLAUDE.md` first.

Investigate client-side performance issues during board actions, especially when tiles are placed, global parameter tracks move, or card overlays update.

Look for:

* unnecessary remounts;
* unstable keys;
* broad rerenders;
* expensive derived data in render;
* unstable props;
* heavy CSS effects;
* overlay/card hand rerender problems.

Do not implement yet. Return a diagnosis with likely root causes and a focused fix plan.

### Focused implementation

Read `AGENTS.md` and `CLAUDE.md` first.

Implement only the requested focused change.

Keep the patch minimal and safe. Preserve game logic and multiplayer flow. Avoid unrelated refactors.

After editing, summarize:

* changed files;
* what changed;
* why it is safe;
* what should be manually verified.

### Startup modal regression review

Read `AGENTS.md` and `CLAUDE.md` first.

Review the startup modal and corporation activation flow.

Focus on this scenario:

1. Player 1 plays Prelude/startup cards.
2. Player 2 plays Prelude/startup cards.
3. Player 1 has no corporation effect and can start.
4. Player 1 starts their turn.
5. Player 2 still sees a waiting startup modal.
6. Player 1 presses pass.
7. Turn moves to Player 2.
8. The old corporation activation modal appears even though the new startup modal should replace it.

Find the root cause. Do not implement yet unless explicitly asked.

### Journal/logging investigation

Read `AGENTS.md` and `CLAUDE.md` first.

Investigate the game journal/logging system.

Goal: all meaningful effects should be logged, especially passive effects from blue cards when they trigger.

Check both UI and server-side logic. Determine where passive effects execute and whether log entries are emitted there.

Do not implement yet. Return a diagnosis and a focused implementation plan.

---

## Final principle

This repository should move toward a premium, smooth, modern Terraforming Mars experience while preserving correct game logic.

When in doubt, prefer:

* correctness over visual flair;
* focused changes over broad rewrites;
* stable game flow over clever UI;
* readable code over clever abstractions;
* premium consistency over isolated decoration;
* server-side source-of-truth fixes over UI-only illusions.
