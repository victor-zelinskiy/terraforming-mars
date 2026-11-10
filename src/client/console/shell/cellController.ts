/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE BOARD CELL CONTROLLER — what the shell says about the cell under the cursor: its legality for the standing
 * placement and the reason when it is not legal, its lore and info, and the server's preview of placing there.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template still lives in the shell and reads these members by name.
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {placementReasonToUnplayable} from '@/client/components/board/placementReason';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';
import {SpaceId} from '@/common/Types';
import {consoleState} from '@/client/console/consoleRouter';
import {translateTextWithParams} from '@/client/directives/i18n';
import {boardInfoState, fetchBoardCellPreview} from '@/client/components/board/boardInfoState';
import {BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import type {MaController} from '@/client/console/shell/maController';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type CellPort = {
  game: UnwrapRef<MaController['game']>,
  readonly placementActive: boolean,
  readonly placementMoveFrom: SpaceId | undefined,
  readonly placementSpaceModel: SelectSpaceModel | undefined,
  readonly placementStaged: boolean,
};

export function createCellController(shell: CellPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The focused cell's PLACEMENT preview (cost / gains / who else receives
   * / endgame VP). Fetched per focused cell while a placement is active —
   * `boardInfoState.info` (the hover facts) deliberately carries none of the
   * placement CONSEQUENCES, so the panel needs this second read.
   */
  const cellPreview = ref(undefined as BoardPlacementPreview | undefined);
  const cellPreviewToken = ref(0);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const cellPreviewKey = computed((): string => {
    const prompt = shell.placementSpaceModel;
    const id = consoleState.boardSpaceId;
    if (!shell.placementActive || prompt === undefined || id === undefined || prompt.placementType === undefined) {
      return '';
    }
    const cleared = (prompt.hiddenTiles ?? []).includes(id as SpaceId) ? 'c' : '';
    // A move's lifted city and the staged flag change what the server answers for the SAME cell.
    return `${id}|${prompt.placementType}|${prompt.tileType ?? ''}|${cleared}|${prompt.sourceCard ?? ''}|${shell.placementMoveFrom ?? ''}|${shell.placementStaged ? 's' : ''}`;
  });

  /**
   * IS THE FOCUSED CELL A LEGAL DESTINATION — off the SERVER'S OWN LIST.
   *
   * ⚠️⚠️ THIS USED TO READ THE DOM, AND A COMPUTED THAT READS THE DOM IS A
   * CACHED SNAPSHOT OF IT. `document.querySelector(...).classList.contains(
   * 'board-space--available')` has no reactive dependency, so Vue froze the
   * answer against the only reactive term in the expression — the focused
   * cell id. The availability classes are painted IMPERATIVELY by the board
   * binder a beat after the prompt lands, so whenever the cursor was seeded
   * onto its cell BEFORE that paint, the cached verdict was `false` and
   * stayed false for as long as the player kept the cursor there: A was
   * refused with «Нельзя разместить здесь» on a cell the board itself was
   * drawing as available, and the only way out was to move the cursor away
   * and back. A mouse click on the very same hex committed normally, which
   * is what made it read as «the keyboard is dead».
   *
   * `spaces` is the same list the response is validated against (cross-cutting
   * invariant 2: availability is server-authoritative), and it is reactive
   * because it is part of `playerView` — so the verdict now cannot outlive
   * the prompt it describes.
   */
  const selectedCellLegal = computed((): boolean => {
    const id = consoleState.boardSpaceId;
    const spaces = shell.placementSpaceModel?.spaces;
    if (id === undefined || spaces === undefined) {
      return false;
    }
    return spaces.includes(id as SpaceId);
  });

  /** The SERVER's per-cell illegal reason (+M€ deficit), translated. */
  const selectedCellIllegalReason = computed((): string => {
    const prompt = shell.placementSpaceModel;
    const id = consoleState.boardSpaceId;
    if (prompt === undefined || id === undefined || selectedCellLegal.value) {
      return '';
    }
    const entry = prompt.illegalSpaces?.find((s) => s.spaceId === id);
    if (entry === undefined) {
      return '';
    }
    const reason = placementReasonToUnplayable(entry.reason, entry.deficit, entry.committed);
    return translateTextWithParams(reason.message, (reason.params ?? []).map(String));
  });

  /** P27b: the curated LORE for the inspected special cell (Ganymede,
   *  volcanoes, Noctis…) — shown in INSPECTION, deliberately not during
   *  placement (it would crowd the task panel). */
  const selectedCellLore = computed((): {title: string, description: string} | undefined => {
    const id = consoleState.boardSpaceId;
    if (id === undefined) {
      return undefined;
    }
    const info = getSpecialCellInfo(id as SpaceId, shell.game.gameOptions.boardName);
    return info !== undefined ? {title: info.title, description: info.description} : undefined;
  });

  const selectedCellInfo = computed(() => {
    const info = boardInfoState.info;
    return info !== undefined && info.space === consoleState.boardSpaceId ? info : undefined;
  });

  /**
   * The placement preview, shown only for a LEGAL cell — mirrors the desktop
   * hover popover (an illegal cell shows the server's reason instead of the
   * consequences of a placement that cannot happen).
   */
  const selectedCellPreview = computed((): BoardPlacementPreview | undefined => {
    return selectedCellLegal.value ? cellPreview.value : undefined;
  });

  const cellInfoLoading = computed((): boolean => {
    return boardInfoState.loading && boardInfoState.spaceId === consoleState.boardSpaceId;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Titles of the inner SelectOptions — the server's claimable/fundable set. */
  /**
   * Fetch the focused cell's placement preview (the same bounded read-only
   * `/api/game/board-cell-preview?kind=` the desktop hover popover uses, so
   * the two surfaces can never diverge). Only `boardCellPreview` carries the
   * placement CONSEQUENCES — the M€ cost, the Ares hazard-adjacency "reduce a
   * production" penalty, the adjacency bonuses and who else receives them;
   * `boardCellInfo` (the hover facts the panel already had) describes the cell
   * as it stands and would never mention them.
   */
  function loadCellPreview(): void {
    const token = ++cellPreviewToken.value;
    const prompt = shell.placementSpaceModel;
    const id = consoleState.boardSpaceId;
    if (cellPreviewKey.value === '' || prompt?.placementType === undefined || id === undefined) {
      cellPreview.value = undefined;
      return;
    }
    const spaceId = id as SpaceId;
    const cleared = (prompt.hiddenTiles ?? []).includes(spaceId);
    // `staged` — the unpaid card's price folds into every affordability fact
    // (the route always could; no client ever sent it, so a staged dossier
    // judged «affordable» against the whole wallet). `movedFrom` — a move's
    // lifted city: the cell is read as that city's DESTINATION.
    fetchBoardCellPreview(spaceId, prompt.placementType, cleared, prompt.tileType, prompt.sourceCard, prompt.placementEffect,
      shell.placementStaged, shell.placementMoveFrom, prompt.printedBonusMultiplier, prompt.governmentPlacement === true).then((preview) => {
      if (token === cellPreviewToken.value) {
        cellPreview.value = preview;
      }
    });
  }

  /** The focused cell (or the placed tile) changed → refetch its preview. */
  function whenCellPreviewKeyChanges(): void {
    loadCellPreview();
  }

  return {
    cellPreview,
    cellPreviewToken,
    cellPreviewKey,
    selectedCellLegal,
    selectedCellIllegalReason,
    selectedCellLore,
    selectedCellInfo,
    selectedCellPreview,
    cellInfoLoading,
    loadCellPreview,
    whenCellPreviewKeyChanges,
  };
}

export type CellController = ReturnType<typeof createCellController>;
