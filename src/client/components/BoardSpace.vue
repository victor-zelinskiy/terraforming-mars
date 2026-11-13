<template>
  <div v-if="space !== undefined" :class="mainClass" :style="stackStyle" :data_space_id="space.id" :data-stack-height="stackHeight > 1 ? stackHeight : undefined"
       :data-peek="peekPiece" :data-bonus-times="bonusTimes">
    <!-- THE CITY STACK (Turmoil Redux — Skyscrapers): the LOWER TIERS paint under
         the top tile, each one stepped down, so the stack reads by its silhouette
         (a pile of tokens); the counter below names the height outright. Drawn
         inside the hex (never onto a neighbour) — the whole pile is scaled to fit
         the cell, the top tile rides the lift. At most two lower tiers are drawn;
         the counter is the truth for any height.
         THE PILE IS DRAWN AS THE PIECES LIE (`common/boards/cityStack.ts`): every
         tier above the base is a PLAIN city — that is the tile a stack is built
         with — and the cell's own tile (the Capital, an Ocean City) is the BASE:
         the lowest drawn tier wears its art, the top wears a plain city's. -->
    <div v-for="k in tierLayers" :key="'tier-' + k"
         class="board-space board-stack__tier"
         :class="tierArtClassOf(k)"
         :style="{'--stack-k': k}"
         :data-stack-piece="pieceUnder !== undefined && k === pile.length - 1 ? 'under' : undefined"
         data-stack-tier></div>
    <board-space-tile
      :space="space"
      :aresExtension="aresExtension"
      :tileView="tileView"
      :placementCleared="placementCleared"
      :topArt="topArt"
    ></board-space-tile>
    <!-- THE DEFLECTION ZONE'S GROUND (Hollandia) — right over the cell's type layer and UNDER the printed bonus and
         every piece. Its clip-path makes it a painted layer of its own, so its place in the DOM is its place in the
         paint: standing last (the legacy overlay did) it washed the bonus icons with the zone's colour. Over a TILE only
         its kant comes up — the rule counts the tiles inside. -->
    <div v-if="space.spaceType === SpaceType.DEFLECTION_ZONE" class="board-space-type-deflection-zone"
         :class="{'board-space-type-deflection-zone--covered': space.tileType !== undefined && tileView === 'show'}" data-deflection-zone></div>
    <div class="board-space-text" v-if="text" v-i18n>{{ text }}</div>
    <bonus :bonus="space.bonus" v-if="showBonus"></bonus>
    <!-- THE CELL'S REWARD, ON THE CELL (P74): while a MULTIPLIED placement stands, a legal candidate that prints a bonus
         says how many times it will pay — the server's whole count (the law's repeat included), never a client product.
         Absolute (the cluster never moves), material not light, an ATTRIBUTE on the cell beside it (never a class). -->
    <span v-if="bonusTimes !== undefined && showBonus" class="board-space-bonus-times" data-bonus-times-mark>×{{ bonusTimes }}</span>
    <template v-if="tileView === 'coords'">
      <div class="board-space-coords">{{ space.a9 ?? getSpaceName(space.id) }}</div>
    </template>
    <template v-if="tileView === 'show'">
      <player-cube
        v-if="cubeColor !== undefined && cubePhase !== 'hidden'"
        class="board-owner-cube"
        :color="cubeColor"
        :size="12"
        :animate-in="cubePhase === 'dropping'"></player-cube>
      <!-- The stack's COUNTER: the height, named — «two» and «three» must be told apart at a glance,
           never guessed from the pile's thickness. Lower-left, the owner cube's mirror. While a tier
           HANGS over this cell (the landing scene's `loading`) it already shows the current height
           («×1»), so the tick at contact reads 1 → 2 — the frame the real tile paints. The mirror for a
           tier that LEFT (a move's `released`): the counter names the lower height once more — «×1»
           included — ticks, and at height 1 goes. -->
      <span v-if="(stackHeight > 1 || stackLoading || stackReleased) && pileDrawn" class="board-stack__count" data-stack-count>×{{ stackHeight }}</span>
      <!-- THE BURIED TILE's mark: a special city under a tier is no longer what the top of the pile shows
           (the top is a plain city), and only a strip of it peeks out below — so a MINIATURE of the tile
           lying underneath stands at the foot of the pile, nested in the hex's lower vertex. A single
           Capital and a pile of plain cities carry none. -->
      <span v-if="buriedArtClass !== ''" class="board-stack__under" data-stack-under :data-stack-under-tile="buriedArtClass">
        <i class="board-stack__under-art" :class="buriedArtClass"></i>
      </span>
      <template v-if="space.gagarin !== undefined">
        <div v-if="space.gagarin === 0" class='gagarin'></div>
        <div v-else class='gagarin visited'></div>
      </template>
      <!-- An OVERLAY MARKER lands ON the existing city tile, so it has its own
           arrival beat (markerPlacementAnimation) — without it the cathedral
           popped into the board in the same frame as the prompt it causes. -->
      <template v-if="space.cathedral === true">
        <div class='board-cube--cathedral'
             :class="{'board-cube--placing': cathedralPlacing}"
             :style="markerPlacementStyle"></div>
      </template>
      <!-- The Mars Nomads camp — the premium NomadToken. Flow A (the first
           landing) plays via the shared marker framework (nomadPlacing);
           during a MOVE the cell may be reveal-HELD (destination commits
           hidden until the hop's touchdown) or carry a GHOST (the source
           keeps the token after the commit until its proxy lifts off). -->
      <template v-if="showNomadToken">
        <div class='board-nomad' :style="nomadLandingStyle">
          <nomad-token :size="16" :landing="nomadPlacing ? 'drop' : 'none'"></nomad-token>
        </div>
      </template>
      <underground-token v-if="claimedToken !== undefined" :token="claimedToken" location="board"></underground-token>
      <div v-if="space.excavator !== undefined" class="underground-excavator" :class="'underground-excavator--' + space.excavator"></div>
    </template>
    <div class="board-log-highlight" :data_log_highlight_id="space.id"></div>
    </div>
</template>

<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import Bonus from '@/client/components/Bonus.vue';
import BoardSpaceTile from '@/client/components/board/BoardSpaceTile.vue';
import {tileCssClassOf} from '@/client/components/board/boardSpaceTileModel';
import PlayerCube from '@/client/components/PlayerCube.vue';
import NomadToken from '@/client/components/NomadToken.vue';
import UndergroundToken from '@/client/components/underworld/UndergroundToken.vue';
import {TileView} from '@/client/components/board/TileView';
import {SpaceModel} from '@/common/models/SpaceModel';
import {Color} from '@/common/Color';
import {ClaimedToken} from '@/common/underworld/UnderworldPlayerData';
import {getSpaceName} from '@/common/boards/spaces';
import {SpaceType} from '@/common/boards/SpaceType';
import {placementRenderState, peekPieceAt, bonusTimesAt, PlacementPeekPiece} from '@/client/components/board/placementRenderState';
import {isRemoteRevealHeld, heldPrevTileOf, heldPrevColorOf, heldPrevUnderOf, heldStackHeightOf} from '@/client/console/tilePlacement/remoteRevealHold';
import {nomadCellHidden, nomadGhostAt} from '@/client/console/nomads/consoleNomadMove';
import {observeCube, cubePhase as cubePhaseForSpace, CubePhase} from '@/client/components/board/cubeDropState';
import {stackLoadingAt, stackContactAt, stackReleasedAt, stackUnloadingAt, stackDriedAt} from '@/client/console/tilePlacement/cityStackScene';
import {stackBuriedTile, stackTopTile} from '@/common/boards/cityStack';
import {buriedTileOf} from '@/common/boards/cellPieces';
import {TileType} from '@/common/TileType';
import {clearActiveMarker, observeMarkerPlacement} from '@/client/components/board/markerPlacementAnimation';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'board-space'});
const props = defineProps({
  space: {
    type: Object as () => SpaceModel,
    required: true,
  },
  text: {
    type: String,
    default: '',
  },
  aresExtension: {
    type: Boolean,
  },
  tileView: {
    type: String as () => TileView,
    required: true,
  },
});

const flow = useFlowScope('board-space');
const cathedralPlacing = ref(false);
const markerDurationMs = ref(0);
const markerDelayMs = ref(0);
let cancelMarker: () => void = () => {};
const nomadPlacing = ref(false);
const nomadDurationMs = ref(0);
const nomadDelayMs = ref(0);
let cancelNomad: () => void = () => {};

const mainClass = computed((): string => {
  let css = 'board-space board-space-' + props.space?.id.toString();
  css += ' board-space-selectable';
  if (pile.value.length > 1 && pileDrawn.value) {
    css += ' board-space--stack';
  }
  // A RESTRICTED cell (Amazonis's centre) never takes a tile: it is drawn by FORM — a hatch and a dashed contour —
  // so it reads as closed at couch distance, before any hover or placement asks it. A fixed fact of the cell.
  if (props.space.spaceType === SpaceType.RESTRICTED) {
    css += ' board-space--restricted';
  }
  // A SPECIAL city's cell (the tile a tier would bury): its counter stands clear of the buried tile's mark. A fact
  // of the cell's own tile, never of the height — so the counter does not move when the mark appears or goes.
  // A city OVER AN OCEAN (TR44) is such a cell too: the water is the piece its mark names.
  if (stackBuriedTile(props.space.tileType, 2) !== undefined || pieceUnder.value !== undefined) {
    css += ' board-space--stack-special';
  }
  // TWO TILES ON ONE CELL (TR44): the pile's base is WATER — the seam under the city is a shoreline, not a token's edge.
  if (pieceUnder.value === TileType.OCEAN && pileDrawn.value) {
    css += ' board-space--afloat';
  }
  // …and the water LEFT from under the city (a move, a removal): the city settles onto the ground, once.
  if (stackDriedAt(props.space.id)) {
    css += ' board-space--dried';
  }
  // THE SEE-THROUGH («ПРОСВЕТ», TR47) is NOT a class here — it is the root's `data-peek` ATTRIBUTE. The focus
  // ring (`con-cell-sel`), the availability classes and the move's source mark are written IMPERATIVELY on this
  // element by the board section, and Vue rewrites `className` wholesale whenever this binding changes: a class
  // that toggles exactly while the cursor stands on the cell wiped the focus it was standing with (measured on
  // TR39's source level — `focusedSpaceId` read «» with the reticle plainly on 33). A separate attribute is patched
  // on its own and leaves `className` alone.
  // THE LANDING SCENE's two states of this cell (cityStackScene): a tier hangs over it — the base
  // takes the load; a tier just touched down — the counter ticks and the cell jolts once.
  if (stackLoading.value) {
    css += ' board-space--stack-loading';
  }
  if (stackContactAt(props.space.id)) {
    css += ' board-space--stack-contact';
  }
  // …and their mirrors — a MOVE took the top tier off this cell: the counter ticks down, the base returns to the full hex.
  if (stackReleased.value) {
    css += ' board-space--stack-release';
  }
  if (stackUnloadingAt(props.space.id)) {
    css += ' board-space--stack-unloading';
  }
  return css;
});
/** A move just lifted the top tier off THIS cell (the scene's `released`). */
const stackReleased = computed((): boolean => {
  return stackReleasedAt(props.space.id);
});
/** A city tier is descending onto THIS cell (the landing scene's `loading`). */
const stackLoading = computed((): boolean => {
  return stackLoadingAt(props.space.id);
});
/** The city STACK's height (Skyscrapers) — 1 for any ordinary cell. A MOVE somebody else made off this
 *  stack keeps the height it HAD until the scene's proxy takes the top tier over (`heldStackHeightOf`). */
const stackHeight = computed((): number => {
  return heldStackHeightOf(props.space.id) ?? props.space.stackHeight ?? 1;
});
/** The owner marker: the model's — or, on a cell still painting a city that has LEFT it (a remote move's
 *  held source), that city's own. */
const cubeColor = computed((): Color | undefined => {
  return props.space.color ?? heldPrevColorOf(props.space.id);
});
/**
 * THE PILE, bottom-up — every physical piece on the cell (`common/boards/cellPieces.ts`): the plain OCEAN a TR44
 * city stands on (if any), the cell's own tile (the base of a city stack), then a plain city per further tier.
 * Empty for an empty cell. The picture is drawn from this list and nothing else: the top is its last piece, the
 * lower tiers the pieces under it.
 */
const pile = computed((): ReadonlyArray<TileType> => {
  const tileType = pieceTop.value;
  if (tileType === undefined) {
    return [];
  }
  const pieces: Array<TileType> = pieceUnder.value !== undefined ? [pieceUnder.value] : [];
  pieces.push(tileType);
  for (let tier = 1; tier < stackHeight.value; tier++) {
    pieces.push(stackTopTile(tileType, stackHeight.value));
  }
  return pieces;
});
/**
 * THE PIECES AS PAINTED: the model's — or, while a remote scene HOLDS this cell at what stood here before the
 * commit (a move or a removal out from under a city, a city leaving its water), the held pieces: the cell keeps
 * painting its whole pile until the proxy takes one piece over 1:1.
 */
const pieceTop = computed((): TileType | undefined => {
  const held = placementCleared.value ? heldPrevTileOf(props.space.id) : undefined;
  return held ?? props.space.tileType;
});
const pieceUnder = computed((): TileType | undefined => {
  if (placementCleared.value) {
    return heldPrevTileOf(props.space.id) !== undefined ? heldPrevUnderOf(props.space.id) : undefined;
  }
  return props.space.under;
});
/** The pile is DRAWN: an ordinary cell, or a held cell still painting the pieces that stood on it. */
const pileDrawn = computed((): boolean => {
  return !placementCleared.value || heldPrevTileOf(props.space.id) !== undefined;
});
/** The lower tiers drawn under the top tile, nearest first (`--stack-k` 1 = right under it); at most two. */
const tierLayers = computed((): ReadonlyArray<number> => {
  if (pile.value.length <= 1 || !pileDrawn.value || props.tileView !== 'show') {
    return [];
  }
  const drawn = Math.min(2, pile.value.length - 1);
  return Array.from({length: drawn}, (_, i) => i + 1);
});
/**
 * The art the TOP of this cell wears when it is NOT the cell's own tile: a plain city, once a tier stands on a
 * special city (the Capital is underneath then). Undefined for every single tile and for a pile of plain cities.
 */
const topArt = computed((): TileType | undefined => {
  const tileType = pieceTop.value;
  if (tileType === undefined) {
    return undefined;
  }
  const top = stackTopTile(tileType, stackHeight.value);
  return top === tileType ? undefined : top;
});
/**
 * The piece lying UNDER the top that the top no longer shows — its miniature marks the pile ('' = nothing buried,
 * or nothing drawn): the plain OCEAN under a TR44 city, else a special city under a tier (`buriedTileOf`).
 */
const buriedArtClass = computed((): string => {
  if (!pileDrawn.value || props.tileView !== 'show') {
    return '';
  }
  const buried = buriedTileOf({tileType: pieceTop.value, under: pieceUnder.value, stackHeight: stackHeight.value});
  return buried === undefined ? '' : artClassOf(buried);
});
/** `--stack-n` drives the lift of the top tile and the step of every tier (board px, under the board's zoom). */
const stackStyle = computed((): Record<string, string> => {
  return pile.value.length > 1 ? {'--stack-n': String(Math.min(3, pile.value.length))} : {};
});
// True while this occupied cell is a remove-and-replace placement target
// OR a console remote-placement reveal hold (the committed tile is hidden
// until its flight's touchdown): its tile graphic is suppressed and its
// placement bonus is shown instead — the cell keeps reading as untouched.
const placementCleared = computed((): boolean => {
  return placementRenderState.hiddenTiles.has(props.space.id) || isRemoteRevealHeld(props.space.id);
});
const showBonus = computed((): boolean => {
  // A held OCEAN COVER keeps painting the covered water (never the bare
  // hex), so the printed bonuses stay hidden exactly as they were under
  // the real ocean — and so does a REMOVAL in flight (an EMPTY committed
  // cell still painting the tile that is about to lift): the bonuses
  // surface only once the tile has gone.
  if (placementCleared.value && heldPrevTileOf(props.space.id) !== undefined) {
    return false;
  }
  if (props.space.tileType === undefined || props.tileView === 'hide' || placementCleared.value) {
    return true;
  }
  // THE SEE-THROUGH of a lone piece (TR47): the bonus the cell will pay again is painted under the translucent
  // tile. A piece that leaves a pile (the water under a city, a stack's tier) uncovers nothing — no icons.
  return peekPiece.value === 'top' && pile.value.length === 1;
});
/** Which piece of this cell a lifting pick sees through right now (undefined = none — `placementPeek.ts`). */
/** The «×N» of a multiplied placement on this candidate (`placementRenderState.bonusTimes`) — undefined = none. */
const bonusTimes = computed((): number | undefined => {
  if (props.tileView !== 'show') {
    return undefined;
  }
  return bonusTimesAt(props.space.id);
});
const peekPiece = computed((): PlacementPeekPiece | undefined => {
  if (props.tileView !== 'show' || placementCleared.value) {
    return undefined;
  }
  return peekPieceAt(props.space.id);
});
// Cube reveal phase for this space (`hidden` during the tile placement
// animation, `dropping` while the cube lands, `rest` otherwise). PlayerCube
// reads the `symbol_overlay` preference itself for the colour-blind glyph.
const cubePhase = computed((): CubePhase => {
  return cubePhaseForSpace(props.space.id);
});
// Inline duration/delay for the marker keyframe (negative delay resumes a
// beat interrupted by a remount) — same contract as `--placement-duration`.
const markerPlacementStyle = computed((): Record<string, string> => {
  if (!cathedralPlacing.value) {
    return {};
  }
  return {
    '--marker-placement-duration': `${markerDurationMs.value}ms`,
    '--marker-placement-delay': `${markerDelayMs.value}ms`,
  };
});
/**
 * The camp renders while the flag stands AND the cell is not reveal-held
 * (a move commits the destination hidden until its proxy's touchdown) —
 * OR while the cell carries the move scene's source GHOST (the flag is
 * already gone, but the hop hasn't physically lifted off yet).
 */
const showNomadToken = computed((): boolean => {
  if (props.tileView !== 'show') {
    return false;
  }
  if (nomadGhostAt(props.space.id)) {
    return true;
  }
  return props.space.nomads === true && !nomadCellHidden(props.space.id);
});
// The landing keyframe's duration/delay (same resume contract as the
// cathedral marker above).
const nomadLandingStyle = computed((): Record<string, string> => {
  if (!nomadPlacing.value) {
    return {};
  }
  return {
    '--nomad-landing-duration': `${nomadDurationMs.value}ms`,
    '--nomad-landing-delay': `${nomadDelayMs.value}ms`,
  };
});
const claimedToken = computed((): ClaimedToken | undefined => {
  if (props.space.undergroundResource === undefined) {
    return undefined;
  }
  return {token: props.space.undergroundResource, shelter: false, active: false};
});

function artClassOf(tileType: TileType): string {
  const suffix = tileCssClassOf(tileType, props.aresExtension);
  return suffix === '' ? '' : 'board-space-tile--' + suffix;
}
/**
 * A lower tier's art, by where the piece LIES (`pile`, bottom-up): `--stack-k` 1 is the piece right under the
 * top, 2 the one under that. The lowest piece of a cell is its OWN tile — or, on a TR44 cell, the plain OCEAN the
 * city stands on; every tier between the base and the top is a plain city (a stack is built by putting plain
 * city tiles on top).
 */
function tierArtClassOf(k: number): string {
  const piece = pile.value[pile.value.length - 1 - k];
  return piece === undefined ? '' : artClassOf(piece);
}
function refreshMarkerPlacement(): void {
  cancelMarker();
  const result = observeMarkerPlacement(props.space);
  if (result === null) {
    cathedralPlacing.value = false;
    return;
  }
  cathedralPlacing.value = true;
  markerDurationMs.value = result.durationMs;
  markerDelayMs.value = result.delayMs;
  const spaceId = props.space.id;
  const remaining = Math.max(0, result.durationMs + result.delayMs) + 40;
  // PACING, owned by this cell (flow kernel — PLAN §10 · C1): taken back at unmount ON PURPOSE, as the cleared
  // timer was — a landing in flight stays in the module's ledger so a mid-beat remount resumes the keyframe.
  cancelMarker = flow.after(remaining, 'the overlay marker\'s landing ends', () => {
    cathedralPlacing.value = false;
    clearActiveMarker(spaceId);
  });
}
function refreshNomadPlacement(): void {
  cancelNomad();
  const result = observeMarkerPlacement(props.space, 'nomads');
  if (result === null) {
    nomadPlacing.value = false;
    return;
  }
  nomadPlacing.value = true;
  nomadDurationMs.value = result.durationMs;
  nomadDelayMs.value = result.delayMs;
  const spaceId = props.space.id;
  const remaining = Math.max(0, result.durationMs + result.delayMs) + 40;
  cancelNomad = flow.after(remaining, 'the nomads\' first landing ends', () => {
    nomadPlacing.value = false;
    clearActiveMarker(spaceId, 'nomads');
  });
}

// Drive the cube-drop state machine: on mount (immediate) and whenever this
// space gains/loses an owner. The cube is held hidden during the tile
// placement animation and dropped in only after it finishes.
watch(() => props.space.color, (): void => {
  observeCube(props.space);
}, {immediate: true});
// The overlay-marker landing (mirrors BoardSpaceTile's placement watcher:
// immediate, module-tracked, so a mid-beat remount RESUMES the keyframe).
watch(() => props.space.cathedral, (): void => {
  refreshMarkerPlacement();
}, {immediate: true});
// The Mars Nomads FIRST LANDING (Flow A) — the same framework, its own
// richer descent. A MOVE never reaches this beat: the move scene
// pre-adopts both cells in the marker baseline before flipping flags.
watch(() => props.space.nomads, (): void => {
  refreshNomadPlacement();
}, {immediate: true});
</script>

