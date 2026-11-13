<!--
@console-shared LIVE — the console's ONE board-input binder.

THE BOARD CELL-BINDER (the successor of the upstream SelectSpace.vue — the
last legacy file the console stood on). Headless by construction: it renders
NO title, NO warning strip, NO save button — only the placement-confirm
dialog and the two premium hover popovers. Its real work is DOM wiring on
the always-mounted board:
 - paints `.board-space--available` on the prompt's legal cells and
   `.board-space--illegal` (+ the DATA_ILLEGAL_MARKER attribute) on the
   server-reported off-limits cells, mirroring presence into
   `placementRenderState` (BRD-3 — hover handlers must not DOM-query);
 - attaches per-cell `onclick` handlers — the console's one tile-submit
   path (a pad A-press on a focused cell drives the same click);
 - hover: an ILLEGAL cell shows the premium reason popover, a LEGAL cell
   the placement PREVIEW (cost / gains / endgame VP) — the same component
   family the hand overlay uses, never a native `title`;
 - click → the placement-confirm dialog (with the SAME preview facts) or,
   behind the hide_tile_confirmation preference, straight through;
 - `saveData()` ARMS the console tile-placement hero BEFORE the submit —
   every console placement source funnels through this one binder (card
   follow-up / standard project / card action / WGT ocean / convert-plants),
   so this is the single arming point; the transport gate then verifies the
   server's word before anything visual happens;
 - teardown is surgical and idempotent (the binder can unmount mid-pick —
   e.g. convert-plants toggled off — and no highlight/onclick may linger).
-->
<template>
  <div class="con-board-input">
    <confirm-dialog
        message="Place your tile here?"
        :enableDontShowAgainCheckbox="true"
        ref="confirmation"
        v-on:accept="confirmPlacement"
        v-on:dismiss="cancelPlacement"
        v-on:hide="hideDialog">
      <board-placement-preview-content
        v-if="confirmPreview !== undefined"
        :preview="confirmPreview"
        :viewerColor="playerView.thisPlayer?.color"
        :players="playerView.players ?? []" />
    </confirm-dialog>
    <placement-reason-popover :reasons="hoverReasons" :anchor="hoverAnchor" />
    <board-placement-preview-popover
      :preview="previewData"
      :anchor="previewAnchor"
      :viewerColor="playerView.thisPlayer?.color"
      :players="playerView.players ?? []" />
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {getPreferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {SelectSpaceResponse} from '@/common/inputs/InputResponse';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import {SpaceId} from '@/common/Types';
import {PlacementIllegalSpace} from '@/common/inputs/PlacementIllegalReason';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import PlacementReasonPopover from '@/client/components/board/PlacementReasonPopover.vue';
import {placementReasonToUnplayable} from '@/client/components/board/placementReason';
import {bonusTimesMarks, setPlacementBonusTimes, setPlacementHighlightActive} from '@/client/components/board/placementRenderState';
import BoardPlacementPreviewPopover from '@/client/components/board/BoardPlacementPreviewPopover.vue';
import BoardPlacementPreviewContent from '@/client/components/board/BoardPlacementPreviewContent.vue';
import {fetchBoardCellPreview} from '@/client/components/board/boardInfoState';
import {BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {armTilePlacement} from '@/client/console/tilePlacement/consoleTilePlacement';
import type {PlacementPrice} from '@/client/console/tilePlacement/tilePlacementModel';
import {armNomadMove} from '@/client/console/nomads/consoleNomadMove';
import {
  beginPlacementCommit,
  lockPlacementCell,
  placementCommitReady,
  placementFlowState,
  registerPlacementRearm,
} from '@/client/console/tilePlacement/placementFlow';
import {consoleState} from '@/client/console/consoleRouter';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {pickUpMoveSource, placementMoveLevel, placementMoveState} from '@/client/console/tilePlacement/placementMove';

/**
 * Marker attribute on cells we annotated with an illegal-reason tooltip.
 * Used so cleanup only touches cells we actually modified, leaving any
 * existing `title` / data attributes on other elements untouched.
 */
const DATA_ILLEGAL_MARKER = 'data-placement-illegal';

defineOptions({name: 'ConsoleBoardInput'});
const props = defineProps({
  playerView: {
    type: Object as () => PlayerViewModel,
    required: true,
  },
  playerinput: {
    type: Object as () => SelectSpaceModel,
    required: true,
  },
  onsave: {
    type: Function as unknown as () => (out: SelectSpaceResponse) => void,
    required: true,
  },
  /**
   * A STAGED pick (the cell is chosen before `sourceCard` is paid): the hover
   * preview asks the server to fold the card's unpaid price into every
   * affordability fact — the same flag the dossier's fetch sends.
   */
  staged: {
    type: Boolean,
    default: false,
  },
  /**
   * The tile is BOUGHT with a resource off the rail (PL-306 — the shell's conversion of plants into a greenery, the
   * standard action and the final greenery): the arm carries it, and the hero opens with the price leaving its row
   * for the cell before the tile grows out of it. Undefined for every other placement.
   */
  price: {
    type: Object as () => PlacementPrice | undefined,
    default: undefined,
  },
});

const flow = useFlowScope('board-input');
const confirmation = useTemplateRef<ExposedOf<typeof ConfirmDialog>>('confirmation');
const spaces = ref<Set<SpaceId>>(new Set(props.playerinput.spaces));
let selectedTile: HTMLElement | undefined;
const spaceId = ref<SpaceId | undefined>(undefined);
/** The placement-rearm hook's unregister (placementFlow). */
let unregisterRearm: (() => void) | undefined;
/** Strips the one-shot availability entry wave once it has played — the disarm of a guaranteed release of `flow`
 *  (`undefined` when no wave stands). */
let waveTimer: (() => void) | undefined;
// Premium placement-reason popover state (replaces the native `title`).
const hoverReasons = ref<ReadonlyArray<UnplayableReason>>([]);
const hoverAnchor = ref<DOMRect | undefined>(undefined);
const hoverSpaceId = ref<SpaceId | undefined>(undefined);
// Premium placement PREVIEW state for LEGAL cells (cost / gains / endgame VP).
const previewData = ref<BoardPlacementPreview | undefined>(undefined);
const previewAnchor = ref<DOMRect | undefined>(undefined);
const previewSpaceId = ref<SpaceId | undefined>(undefined);
const previewToken = ref(0);
// Preview shown INSIDE the placement confirm dialog (the selected cell).
const confirmPreview = ref<BoardPlacementPreview | undefined>(undefined);
const confirmToken = ref(0);

// spaceId → structured illegal payload (reason + optional M€ deficit).
const illegalBySpace = computed((): Map<SpaceId, PlacementIllegalSpace> => {
  const map = new Map<SpaceId, PlacementIllegalSpace>();
  for (const entry of props.playerinput.illegalSpaces ?? []) {
    map.set(entry.spaceId, entry);
  }
  return map;
});

function animateSpace(tile: Element, activate: boolean) {
  if (activate) {
    tile.classList.add('board-space--available');
  } else {
    tile.classList.remove('board-space--available');
  }
}
function animateSpaces(tiles: Array<Element>) {
  let highlighted = 0;
  const lit: Array<HTMLElement> = [];
  tiles.forEach((tile: Element) => {
    const spaceId = tile.getAttribute('data_space_id') as SpaceId;
    if (spaceId !== null && spaces.value.has(spaceId)) {
      animateSpace(tile, true);
      lit.push(tile as HTMLElement);
      highlighted++;
    }
  });
  // BRD-3: mirror "`.board-space--available` now exists" into the reactive
  // store so hover handlers don't DOM-query on every mouseover.
  setPlacementHighlightActive(highlighted > 0);
  // THE CELL'S REWARD ON THE CELL (P74): a multiplied placement marks «×N» (the server's whole count) on every legal
  // candidate that prints a bonus — the same bit as the grid: it comes with it and goes with it.
  setPlacementBonusTimes(highlighted > 0 ? bonusTimesMarks(props.playerinput.printedBonusTimes, [...spaces.value],
    (id) => props.playerView.game.spaces.find((space) => space.id === id)?.bonus) : undefined);
  playAvailabilityWave(lit);
}
/**
 * The AVAILABILITY WAVE — a one-shot presentation of the legal set: each
 * cell's contour blooms in on a short radial stagger from the group's
 * own centre, then rests calm (the resting look is the static contour —
 * no ambient pulse). The classes are STRIPPED once played, because the
 * board is `v-show`n and a display flip would replay every CSS animation
 * still declared on it (the known v-show restart trap).
 */
function playAvailabilityWave(lit: ReadonlyArray<HTMLElement>) {
  if (waveTimer !== undefined || lit.length === 0 || typeof window === 'undefined') {
    return;
  }
  const rects = lit.map((el) => el.getBoundingClientRect());
  const cx = rects.reduce((s, r) => s + r.left + r.width / 2, 0) / rects.length;
  const cy = rects.reduce((s, r) => s + r.top + r.height / 2, 0) / rects.length;
  let maxDist = 1;
  const dists = rects.map((r) => {
    const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
    maxDist = Math.max(maxDist, d);
    return d;
  });
  lit.forEach((el, i) => {
    el.style.setProperty('--con-wave-d', `${Math.round((dists[i] / maxDist) * 220)}ms`);
    el.classList.add('con-avail-in');
  });
  // A RELEASE: the wave's classes sit on the BOARD's cells — they come off at the wave's end, or when the binder leaves.
  waveTimer = flow.guarantee(consoleMotionMs(560), 'the availability wave\'s classes come off the cells', () => {
    waveTimer = undefined;
    clearAvailabilityWave();
  });
}
function clearAvailabilityWave() {
  if (waveTimer !== undefined) {
    waveTimer();
    waveTimer = undefined;
  }
  document.querySelectorAll('.con-avail-in').forEach((el) => {
    el.classList.remove('con-avail-in');
    (el as HTMLElement).style.removeProperty('--con-wave-d');
  });
}
/**
 * Mark every cell the server reported as off-limits for this placement
 * with `.board-space--illegal` (dim + cursor) + a `data-placement-illegal`
 * marker. The marker drives BOTH surgical cleanup AND the premium
 * hover popover (see `onBoardMouseOver`) — NO native `title` tooltip; the
 * reason text is rendered by `PlacementReasonPopover`, the same component
 * family the hand overlay uses, so the two read as one system.
 */
function applyIllegalTooltips(tiles: Array<Element>) {
  const illegal = illegalBySpace.value;
  if (illegal.size === 0) {
    return;
  }
  for (const tile of tiles) {
    const spaceId = tile.getAttribute('data_space_id') as SpaceId;
    if (spaceId === null || !illegal.has(spaceId)) {
      continue;
    }
    tile.setAttribute(DATA_ILLEGAL_MARKER, '1');
    tile.classList.add('board-space--illegal');
  }
}
function removeIllegalTooltips() {
  // Use the marker so we only revert cells WE annotated. Also clears any
  // stray `title` (older builds set one) so nothing lingers.
  const marked = document.querySelectorAll('[' + DATA_ILLEGAL_MARKER + ']');
  marked.forEach((el) => {
    el.removeAttribute('title');
    el.removeAttribute(DATA_ILLEGAL_MARKER);
    el.classList.remove('board-space--illegal');
  });
  clearHover();
}
// Delegated board hover (covers every board region without per-cell
// listeners). An ILLEGAL cell shows the premium reason popover; a LEGAL cell
// shows the placement PREVIEW (cost / gains / who-gets-what / endgame VP).
function onBoardMouseOver(e: MouseEvent) {
  const target = e.target as Element | null;
  const cell = target?.closest?.('[data_space_id]') as HTMLElement | null;
  if (cell === null || cell === undefined) {
    clearHover();
    return;
  }
  const spaceId = cell.getAttribute('data_space_id') as SpaceId | null;
  if (spaceId === null) {
    clearHover();
    return;
  }
  const illegal = illegalBySpace.value.get(spaceId);
  if (illegal !== undefined) {
    clearPreview();
    if (spaceId !== hoverSpaceId.value) {
      hoverSpaceId.value = spaceId;
      hoverReasons.value = [placementReasonToUnplayable(illegal.reason, illegal.deficit, illegal.committed)];
      hoverAnchor.value = cell.getBoundingClientRect();
    }
    return;
  }
  if (spaces.value.has(spaceId)) {
    clearReasonHover();
    showPreview(spaceId, cell);
    return;
  }
  clearHover();
}
// A "remove-and-replace" target (KaguyaTech): its existing tile is removed
// before the new tile is placed, so the preview must grant the cell bonus +
// treat the cell as a legal placement (not "occupied / no bonus").
function isClearedTarget(spaceId: SpaceId): boolean {
  return (props.playerinput.hiddenTiles ?? []).includes(spaceId);
}
/** A MOVE's lifted city — the cell the hover / confirm previews are asked about as a destination OF. */
function movedFrom(): SpaceId | undefined {
  return placementMoveLevel(props.playerinput) === 'cell' ? placementMoveState.from : undefined;
}
function showPreview(spaceId: SpaceId, cell: HTMLElement) {
  if (spaceId === previewSpaceId.value) {
    return;
  }
  const kind = props.playerinput.placementType;
  previewSpaceId.value = spaceId;
  previewAnchor.value = cell.getBoundingClientRect();
  previewData.value = undefined;
  // No placement kind (custom SelectSpace path) → highlight only, no preview.
  if (kind === undefined) {
    return;
  }
  const myToken = ++previewToken.value;
  fetchBoardCellPreview(spaceId, kind, isClearedTarget(spaceId), props.playerinput.tileType, props.playerinput.sourceCard, props.playerinput.placementEffect, props.staged, movedFrom(), props.playerinput.printedBonusMultiplier,
    props.playerinput.governmentPlacement === true).then((preview) => {
    if (myToken === previewToken.value && previewSpaceId.value === spaceId) {
      previewData.value = preview;
    }
  });
}
function clearReasonHover() {
  hoverSpaceId.value = undefined;
  hoverReasons.value = [];
  hoverAnchor.value = undefined;
}
function clearPreview() {
  previewSpaceId.value = undefined;
  previewData.value = undefined;
  previewAnchor.value = undefined;
  previewToken.value++;
}
function clearHover() {
  clearReasonHover();
  clearPreview();
}
function cancelPlacement() {
  confirmPreview.value = undefined;
  confirmToken.value++;
  if (selectedTile === undefined) {
    throw new Error('unexpected, no tile selected!');
  }
  animateSpace(selectedTile, false);
  const tiles = getSelectableSpaces();
  animateSpaces(tiles);
  applyIllegalTooltips(tiles);
}
function confirmPlacement() {
  confirmPreview.value = undefined;
  confirmToken.value++;
  const tiles = getSelectableSpaces();
  tiles.forEach((tile) => {
    tile.onclick = null;
  });

  if (selectedTile === undefined) {
    throw new Error('unexpected, no tile selected!');
  }
  const spaceIdNow = selectedTile.getAttribute('data_space_id') as SpaceId;
  if (spaceIdNow === null) {
    throw new Error('unexpected, space has no id');
  }
  spaceId.value = spaceIdNow;
  // THE POINT OF NO RETURN — every placement source (pad, mouse, the
  // legacy dialog) funnels through here, so this is where the flow
  // enters `committing`: board input is absorbed until the server
  // answers, and a refusal rolls back to the locked phase + re-arms
  // the wiring this function just tore down.
  beginPlacementCommit(spaceIdNow);
  // PL-039 (T15 · CD): the legacy `board-space--selected` amber is NOT painted at the commit any more. In the console
  // the held place is the reticle's own (the lock contour, then the landing MARKER of the tile language's W1, let go
  // in the frame of contact) — the class was a second, desktop-era outline nobody removed until the binder unmounted,
  // so it stood ~60 ms over the landed tile (longer for a move). The selection's state ends with the commit.
  saveData();
}
function disableAnimation() {
  const tiles = getSelectableSpaces();
  tiles.forEach((tile) => {
    tile.classList.remove('board-space--available');
  });
  removeIllegalTooltips();
  // BRD-3: the `.board-space--available` set is gone (pre-mount clear, a tile
  // was picked, or unmount) → clear the reactive placement-mode flag.
  setPlacementHighlightActive(false);
  setPlacementBonusTimes(undefined);
}
function getSelectableSpaces(): Array<HTMLElement> {
  const spaces: Array<HTMLElement> = [];

  const regions = ['main_board', 'moon_board', 'colony_spaces', 'moon_board_outer_spaces'];
  for (const region of regions) {
    const board = document.getElementById(region);
    if (board !== null) {
      const array = board.getElementsByClassName('board-space-selectable');
      for (let i = 0, length = array.length; i < length; i++) {
        spaces.push(array[i] as HTMLElement);
      }
    }
  }

  return spaces;
}
function hideDialog(hide: boolean) {
  PreferencesManager.INSTANCE.set('hide_tile_confirmation', hide);
}
/**
 * (Re)attach the whole board wiring: availability highlight + illegal
 * marks + per-cell click handlers. Runs at mount and again on a refused
 * commit's rollback (`registerPlacementRearm`) — `disableAnimation` and
 * re-adding an `onclick` are both idempotent, so a double call is safe.
 */
function wireBoard() {
  disableAnimation();
  const tiles = getSelectableSpaces();
  animateSpaces(tiles);
  applyIllegalTooltips(tiles);
  for (let i = 0, length = tiles.length; i < length; i++) {
    const tile = tiles[i];
    const spaceId = tile.getAttribute('data_space_id') as SpaceId;

    if (spaceId === null || spaces.value.has(spaceId) === false) {
      continue;
    }

    tile.onclick = () => onTileSelected(tile);
  }
}
/**
 * Re-hang the wiring on a NEW legal set (a move prompt's level change):
 * the old set's clicks are detached first — `wireBoard` only attaches —
 * and the played wave is cleared so the new set's own wave may play.
 */
function rewire() {
  for (const tile of getSelectableSpaces()) {
    tile.onclick = null;
  }
  spaces.value = new Set(props.playerinput.spaces);
  clearHover();
  clearAvailabilityWave();
  wireBoard();
}
function onTileSelected(tile: HTMLElement) {
  // A MOVE's SOURCE LEVEL (Turmoil Redux TR14 / TR39): the click LIFTS the
  // tile — one press of pure presentation in BOTH confirm modes (nothing is
  // sent, B puts it down). The legal set then becomes that tile's
  // destinations (the `playerinput.spaces` watcher re-hangs the wiring),
  // and from there the pick is an ordinary placement: lock → confirm, or
  // one press.
  if (placementMoveLevel(props.playerinput) === 'source') {
    const spaceId = tile.getAttribute('data_space_id') as SpaceId | null;
    if (spaceId !== null && placementFlowState.phase !== 'committing') {
      pickUpMoveSource(spaceId);
    }
    return;
  }
  // TWO-PHASE CONFIRM (the console default, placementFlow.ts): the pad
  // path locks in the shell BEFORE ever clicking, so a click landing
  // here is either the pad's verified COMMIT (locked + released +
  // dwelled — re-checked here, the last gate) or a MOUSE press: a mouse
  // click on the locked cell confirms, on any other legal cell it moves
  // the lock — the same two-decision shape as the pad, one setting.
  if (placementFlowState.twoStep) {
    const spaceId = tile.getAttribute('data_space_id') as SpaceId | null;
    if (spaceId === null || placementFlowState.phase === 'committing') {
      return;
    }
    const isCommit = placementFlowState.phase === 'locked' &&
      placementFlowState.lockedSpaceId === spaceId && placementCommitReady();
    if (!isCommit) {
      consoleState.boardSpaceId = spaceId;
      lockPlacementCell(spaceId);
      return;
    }
    selectedTile = tile;
    disableAnimation();
    clearHover();
    confirmPlacement();
    return;
  }
  selectedTile = tile;
  disableAnimation();
  clearHover();
  animateSpace(tile, true);
  tile.classList.remove('board-space--available');
  const hideTileConfirmation = getPreferences().hide_tile_confirmation;
  if (hideTileConfirmation) {
    confirmPlacement();
  } else {
    loadConfirmPreview(tile);
    confirmation.value?.show();
  }
}
// Populate the confirm dialog with the SELECTED cell's preview so the player
// confirms against the SAME facts they saw on hover (usually cached → instant).
function loadConfirmPreview(tile: HTMLElement) {
  confirmPreview.value = undefined;
  const spaceId = tile.getAttribute('data_space_id') as SpaceId | null;
  const kind = props.playerinput.placementType;
  if (spaceId === null || kind === undefined) {
    return;
  }
  const myToken = ++confirmToken.value;
  fetchBoardCellPreview(spaceId, kind, isClearedTarget(spaceId), props.playerinput.tileType, props.playerinput.sourceCard, props.playerinput.placementEffect, props.staged, movedFrom(), props.playerinput.printedBonusMultiplier,
    props.playerinput.governmentPlacement === true).then((preview) => {
    if (myToken === confirmToken.value) {
      confirmPreview.value = preview;
    }
  });
}
function saveData() {
  if (spaceId.value === undefined) {
    // Headless: there is no warning strip to show — an id-less save is a
    // programming error upstream (onTileSelected always sets it).
    console.warn('[board-input] save without a selected space — ignored');
    return;
  }
  // CONSOLE PLACEMENT HERO: ARM the matching premium transaction BEFORE
  // the submit. Every console placement source funnels through this ONE
  // binder (card follow-up / standard project / card action / WGT ocean /
  // convert-plants), so this is the single arming point. WHICH scene owns
  // the pick is the SERVER's own declaration (`placementEffect`), never a
  // client guess:
  //  - 'bonus-only' (Mars Nomads moving its camp) → the nomad-move hop;
  //  - 'marker' (Land Claim / Arcadian / the nomads' FIRST placement) →
  //    no hero at all — those are plain landings served by the shared
  //    marker/owner-cube frameworks, and they grant NOTHING;
  //  - default → the tile-flight hero.
  // The transport gate then verifies the server's word before anything
  // visual happens — a refused pick unwinds with zero trace.
  const effect = props.playerinput.placementEffect ?? 'tile';
  if (effect === 'move') {
    saveMove(spaceId.value);
    return;
  }
  if (effect === 'bonus-only') {
    armNomadMove({toSpaceId: spaceId.value});
  } else if (effect === 'remove') {
    // A REMOVAL (Water Export's ocean, the Reds' action): nothing lands, so
    // there is no hero to arm. The tile's DEPARTURE is a BOARD EVENT every
    // viewer sees alike — the shared remote-placement scene stages it from
    // the response's own diff (`stageRemotePlacements` → the removal
    // branch), for the chooser and the observers through one path.
  } else if (effect !== 'marker') {
    // …and WHETHER the cell already carries a tile that this placement
    // REMOVES first is the server's declaration too (`hiddenTiles` — the
    // remove-and-replace marker Kaguya Tech / Lunar Mine Urbanization
    // set). It is what licenses the hero to read a tile→tile diff as a
    // placement at all, and it opens the scene with the removal beat.
    // …and whether the tile is a CITY TIER onto the player's own city is
    // the server's declaration too (`placementType: 'city-tier'` —
    // Skyscrapers): it licenses the hero to read a stack growing as a
    // landing, and selects the crane descent over the ordinary flight.
    // …and whether the city lands ON TOP OF an ocean as a second piece (TR44 — `placementType:
    // 'city-over-ocean'`): it selects the landing INTO the pile's lift over the water, the splash at contact.
    armTilePlacement({
      spaceId: spaceId.value,
      replacing: isClearedTarget(spaceId.value),
      stacking: props.playerinput.placementType === 'city-tier',
      overOcean: props.playerinput.placementType === 'city-over-ocean',
      // …and whether the tile is BOUGHT off the rail (PL-306) is the shell's declaration: the conversion's price.
      ...(props.price !== undefined ? {price: props.price} : {}),
    });
  }
  props.onsave({type: 'space', spaceId: spaceId.value});
}
/**
 * A MOVE's answer (`placementEffect: 'move'`, Turmoil Redux TR14): ONE
 * response names both cells — the city that leaves and the cell it comes
 * to — because the server never holds a «lifted, not placed» state. The
 * lifted city is the move level's own state; a save with none is a
 * programming error upstream (the cell level cannot exist without it).
 */
function saveMove(spaceId: SpaceId) {
  const from = placementMoveState.from;
  if (from === undefined) {
    console.warn('[board-input] a move saved with no city lifted — ignored');
    return;
  }
  // THE FOURTH CASE of the one arm: the pick DECLARES the pair, which is
  // what licenses the hero to read «the city left `from` · a city stands on
  // `spaceId`» as ONE relocation. A staged play whose tail PARKS proves no
  // such pair in its response — the arm then unwinds with zero trace and
  // the landing, when it comes, is the remote stage's (by the server's record).
  armTilePlacement({spaceId, movedFrom: from});
  props.onsave({type: 'space', spaceId, movedFrom: from});
}

/**
 * THE LEGAL SET CHANGED UNDER A STANDING BINDER — a MOVE prompt's levels
 * (which city → which cell; `placementMove.moveLevelPrompt`) are one prompt
 * read twice, so the binder is not remounted between them: it re-hangs the
 * highlight, the illegal marks and the per-cell clicks on the new set, and
 * the availability wave plays once for each level.
 */
watch(() => props.playerinput.spaces, (now: ReadonlyArray<SpaceId>, before: ReadonlyArray<SpaceId>): void => {
  if (now.length === before.length && now.every((id) => before.includes(id))) {
    return;
  }
  rewire();
});
/** …and the per-cell reasons follow the level too (a level change always moves `spaces`, but not vice versa). */
watch(() => props.playerinput.illegalSpaces, (): void => {
  if (placementFlowState.phase !== 'committing') {
    removeIllegalTooltips();
    applyIllegalTooltips(getSelectableSpaces());
  }
});

onMounted(() => {
  // NOTE: the doomed tile of a remove-and-replace target is deliberately NOT
  // hidden here. The board must show what is physically standing on it while
  // the player CHOOSES which of their tiles to sacrifice — pre-hiding turned
  // every candidate greenery into an identical bare hex, and spent the
  // uncovering (the card's own "gain placement bonuses as usual") before the
  // card had done anything. What the cell is worth is the dossier panel's
  // job; the removal itself is a beat of the placement scene, which is the
  // one owner of `placementRenderState.hiddenTiles` now.
  wireBoard();
  // A REFUSED commit re-arms this very wiring (confirmPlacement tears the
  // per-cell handlers down before posting; without the hook a server «нет»
  // left the whole board click-dead for the rest of the prompt).
  unregisterRearm = registerPlacementRearm(() => wireBoard());
  // Delegated hover for the premium reason popover; clear it on scroll so a
  // stale anchor never floats over the wrong cell.
  document.addEventListener('mouseover', onBoardMouseOver);
  window.addEventListener('scroll', clearHover, true);
});
// Cleanup is critical when the binder can be UNMOUNTED without a tile
// being picked first — e.g. when the dedicated Convert-Plants button is
// toggled off mid-pick. Without this, `board-space--available` lingers
// (tiles keep blinking) and the `onclick` handlers stay attached
// (clicking a tile after toggling off would still submit a space pick).
// Safe to run on every unmount because `disableAnimation` is idempotent
// and clearing `onclick` on an already-cleared tile is a no-op.
onBeforeUnmount(() => {
  unregisterRearm?.();
  unregisterRearm = undefined;
  clearAvailabilityWave();
  disableAnimation();
  const tiles = getSelectableSpaces();
  for (const tile of tiles) {
    tile.onclick = null;
  }
  document.removeEventListener('mouseover', onBoardMouseOver);
  window.removeEventListener('scroll', clearHover, true);
  clearHover();
});
</script>
