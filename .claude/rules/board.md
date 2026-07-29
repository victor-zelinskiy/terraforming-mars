---
description: Board explainability layer (facts / previews / placement cancel) and the invariants that keep it honest.
paths:
  - "src/server/boards/**"
  - "src/common/boards/**"
  - "src/client/components/board/**"
  - "tests/boards/**"
---

# Board rules

The Mars board **explains itself** on three surfaces — hover, active placement, and the confirm modal. It is not a separate "analysis mode".

- **Vocabulary:** `src/common/boards/BoardInformationFacts.ts` — a `BoardFact` is ONE explainable statement with `category` / `timing` / `severity` / **`recipient`** (`current-player` / `player` / `tile-owner` / `neutral` / `nobody` — the load-bearing field) / title+description (English i18n keys) / an optional `delta` chip. `groupFactsByRecipient` is the ONE place the "who gets what" ordering lives.
- **Engine:** `src/server/boards/BoardInformationEngine.ts` — `boardCellInfo` (hover) + `boardCellPreview` (placement). It **never mutates state and never re-implements rules** — it reuses `MarsBoard.oceanAdjacencyBonus` (the same method `Game.grantPlacementBonuses` calls), the printed `space.bonus`, the `calculateVictoryPoints` adjacency predicates, `MarsBoard.placementCostInfo`, `MarsBoard.illegalReasonFor`. Purity is test-guarded.
- **Delivery:** the bounded read-only `GET /api/game/board-cell-preview` — facts are fetched lazily per cell, never attached to `SelectSpaceModel` (which rides every poll).
- **Location ≠ identity ≠ `countsAs` ≠ scoring.** On-grid is derived from the REAL adjacency graph (`getAdjacentSpaces(space).length > 0`); an off-Mars slot gets a neutral `external-area` fact instead of false 0-VP scoring. `countsAs` is shown but is NOT scoring. A special/composite tile never degrades to a bare "ОСОБЫЙ ТАЙЛ".
- **Cancellable placement** rides the server `placementContext` marker (`cancellablePlacement` / `committedPlacement`); `createMarsSelectSpace` DEFAULTS to committed (honest "the action is already underway"). The client never hardcodes cancellability — it reads the marker. Pay-on-commit standard projects apply cost/effects only in the commit callback, so a cancel emits nothing. Classification of what may/may not be cancelled: `docs/PENDING_ACTION_CANCEL_AUDIT.md`.
- **Preview ↔ commit can't diverge** — both go through the same grant logic (guarded by `placementPreviewConsistency.spec.ts`). Future/endgame VP is PREVIEW-ONLY; the journal is a commit log of what happened, never speculation.
- **The cell can't explain the CARD.** Two co-located read-only hooks close that gap (builders: `src/server/cards/placementPreviews.ts`, context: `boards/PlacementPreviewContext.ts`):
  `ICard.placementPreview?()` — what the card DRIVING the placement does about this cell (Solar Farm's energy production per plant bonus, Mining Area's steel-or-titanium, a `.andThen` production cost); `ICard.tilePlacedPreview?()` — the mirror of `onTilePlaced`, walked over EVERY player's tableau so an opponent's Arctic Algae / Tharsis Republic gain shows up under "Other players receive".
  Reached via `SelectSpace.sourceCard` → `SelectSpaceModel.sourceCard` → `?card=` on the preview endpoint. `PlaceTile` threads it from `tile.card`; the declarative city/greenery/ocean branches pass `card.name`; a bespoke `createMarsSelectSpace` passes `sourceCard` explicitly — **a bespoke placement that forgets it silently loses its own preview**.
  **The tile is not on the board yet**: a hook must never call `Board.isCitySpace(space)` — read `ctx.countsAsCity/countsAsOcean/countsAsGreenery/covering/cleared`.
- **Milestone / award progress** (`progressFacts`) is read from the REAL `getScore` via `withHypotheticalTile`, which installs the prospective tile, reads, and restores the exact three fields `simpleAddTile` writes. Never hand-compute "a greenery advances Gardener" — that would duplicate a rule that lives elsewhere.
- **To extend:** a new reason/bonus → add the `BoardFact` reusing the real rule source; a card-specific consequence → the co-located hook, never a central table; Ares facts → populate `aresAdjacencyFacts` from `space.adjacency` GENERICALLY (never hardcode "special tile = source"). i18n keys in `ru/board_info.json` (grep first).

Deep reference: `docs/claude/board-information.md`, `docs/SPECIAL_TILE_AUDIT.md`.
