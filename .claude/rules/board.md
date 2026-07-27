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
- **To extend:** a new reason/bonus → add the `BoardFact` reusing the real rule source; Ares facts → populate `aresAdjacencyFacts` from `space.adjacency` GENERICALLY (never hardcode "special tile = source"). i18n keys in `ru/board_info.json` (grep first).

Deep reference: `docs/claude/board-information.md`, `docs/SPECIAL_TILE_AUDIT.md`.
