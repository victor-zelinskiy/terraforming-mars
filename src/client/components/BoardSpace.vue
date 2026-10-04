<template>
  <div v-if="space !== undefined" :class="mainClass" :style="stackStyle" :data_space_id="space.id" :data-stack-height="stackHeight > 1 ? stackHeight : undefined">
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
         data-stack-tier></div>
    <board-space-tile
      :space="space"
      :aresExtension="aresExtension"
      :tileView="tileView"
      :placementCleared="placementCleared"
      :topArt="topArt"
    ></board-space-tile>
    <div class="board-space-text" v-if="text" v-i18n>{{ text }}</div>
    <bonus :bonus="space.bonus" v-if="showBonus"></bonus>
    <template v-if="tileView === 'coords'">
      <div class="board-space-coords">{{ getSpaceName(space.id) }}</div>
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
      <span v-if="(stackHeight > 1 || stackLoading || stackReleased) && !placementCleared" class="board-stack__count" data-stack-count>×{{ stackHeight }}</span>
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
      <div v-if="space.spaceType === SpaceType.DEFLECTION_ZONE" class="board-space-type-deflection-zone"></div>
    </template>
    <div class="board-log-highlight" :data_log_highlight_id="space.id"></div>
    </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import Bonus from '@/client/components/Bonus.vue';
import BoardSpaceTile, {tileCssClassOf} from '@/client/components/board/BoardSpaceTile.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import NomadToken from '@/client/components/NomadToken.vue';
import UndergroundToken from '@/client/components/underworld/UndergroundToken.vue';
import {TileView} from '@/client/components/board/TileView';
import {SpaceModel} from '@/common/models/SpaceModel';
import {Color} from '@/common/Color';
import {ClaimedToken} from '@/common/underworld/UnderworldPlayerData';
import {getSpaceName} from '@/common/boards/spaces';
import {SpaceType} from '@/common/boards/SpaceType';
import {placementRenderState} from '@/client/components/board/placementRenderState';
import {isRemoteRevealHeld, heldPrevTileOf, heldPrevColorOf, heldStackHeightOf} from '@/client/console/tilePlacement/remoteRevealHold';
import {nomadCellHidden, nomadGhostAt} from '@/client/console/nomads/consoleNomadMove';
import {observeCube, cubePhase as cubePhaseForSpace, CubePhase} from '@/client/components/board/cubeDropState';
import {stackLoadingAt, stackContactAt, stackReleasedAt, stackUnloadingAt} from '@/client/console/tilePlacement/cityStackScene';
import {stackBuriedTile, stackTopTile} from '@/common/boards/cityStack';
import {TileType} from '@/common/TileType';
import {clearActiveMarker, observeMarkerPlacement} from '@/client/components/board/markerPlacementAnimation';

type Data = {
  cathedralPlacing: boolean;
  markerDurationMs: number;
  markerDelayMs: number;
  markerTimer: number | null;
  nomadPlacing: boolean;
  nomadDurationMs: number;
  nomadDelayMs: number;
  nomadTimer: number | null;
};

export default defineComponent({
  name: 'board-space',
  props: {
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
  },
  data(): Data {
    return {
      cathedralPlacing: false,
      markerDurationMs: 0,
      markerDelayMs: 0,
      markerTimer: null,
      nomadPlacing: false,
      nomadDurationMs: 0,
      nomadDelayMs: 0,
      nomadTimer: null,
    };
  },
  components: {
    'bonus': Bonus,
    'board-space-tile': BoardSpaceTile,
    'player-cube': PlayerCube,
    'nomad-token': NomadToken,
    'underground-token': UndergroundToken,
  },
  watch: {
    // Drive the cube-drop state machine: on mount (immediate) and whenever this
    // space gains/loses an owner. The cube is held hidden during the tile
    // placement animation and dropped in only after it finishes.
    'space.color': {
      immediate: true,
      handler(): void {
        observeCube(this.space);
      },
    },
    // The overlay-marker landing (mirrors BoardSpaceTile's placement watcher:
    // immediate, module-tracked, so a mid-beat remount RESUMES the keyframe).
    'space.cathedral': {
      immediate: true,
      handler(): void {
        this.refreshMarkerPlacement();
      },
    },
    // The Mars Nomads FIRST LANDING (Flow A) — the same framework, its own
    // richer descent. A MOVE never reaches this beat: the move scene
    // pre-adopts both cells in the marker baseline before flipping flags.
    'space.nomads': {
      immediate: true,
      handler(): void {
        this.refreshNomadPlacement();
      },
    },
  },
  beforeUnmount() {
    if (this.markerTimer !== null) {
      clearTimeout(this.markerTimer);
      this.markerTimer = null;
    }
    if (this.nomadTimer !== null) {
      clearTimeout(this.nomadTimer);
      this.nomadTimer = null;
    }
  },
  methods: {
    artClassOf(tileType: TileType): string {
      const suffix = tileCssClassOf(tileType, this.aresExtension);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
    /**
     * A lower tier's art, by where the piece LIES: the lowest drawn tier is the pile's BASE and wears the cell's own
     * tile; every tier between it and the top is a plain city (a stack is built by putting plain city tiles on top).
     */
    tierArtClassOf(k: number): string {
      const tileType = this.space.tileType;
      if (tileType === undefined) {
        return '';
      }
      const base = k === this.tierLayers.length;
      return this.artClassOf(base ? tileType : stackTopTile(tileType, this.stackHeight));
    },
    refreshMarkerPlacement(): void {
      if (this.markerTimer !== null) {
        clearTimeout(this.markerTimer);
        this.markerTimer = null;
      }
      const result = observeMarkerPlacement(this.space);
      if (result === null) {
        this.cathedralPlacing = false;
        return;
      }
      this.cathedralPlacing = true;
      this.markerDurationMs = result.durationMs;
      this.markerDelayMs = result.delayMs;
      const spaceId = this.space.id;
      const remaining = Math.max(0, result.durationMs + result.delayMs) + 40;
      this.markerTimer = window.setTimeout(() => {
        this.cathedralPlacing = false;
        this.markerTimer = null;
        clearActiveMarker(spaceId);
      }, remaining);
    },
    refreshNomadPlacement(): void {
      if (this.nomadTimer !== null) {
        clearTimeout(this.nomadTimer);
        this.nomadTimer = null;
      }
      const result = observeMarkerPlacement(this.space, 'nomads');
      if (result === null) {
        this.nomadPlacing = false;
        return;
      }
      this.nomadPlacing = true;
      this.nomadDurationMs = result.durationMs;
      this.nomadDelayMs = result.delayMs;
      const spaceId = this.space.id;
      const remaining = Math.max(0, result.durationMs + result.delayMs) + 40;
      this.nomadTimer = window.setTimeout(() => {
        this.nomadPlacing = false;
        this.nomadTimer = null;
        clearActiveMarker(spaceId, 'nomads');
      }, remaining);
    },
  },
  computed: {
    mainClass(): string {
      let css = 'board-space board-space-' + this.space?.id.toString();
      css += ' board-space-selectable';
      if (this.stackHeight > 1 && !this.placementCleared) {
        css += ' board-space--stack';
      }
      // A SPECIAL city's cell (the tile a tier would bury): its counter stands clear of the buried tile's mark. A fact
      // of the cell's own tile, never of the height — so the counter does not move when the mark appears or goes.
      if (stackBuriedTile(this.space.tileType, 2) !== undefined) {
        css += ' board-space--stack-special';
      }
      // THE LANDING SCENE's two states of this cell (cityStackScene): a tier hangs over it — the base
      // takes the load; a tier just touched down — the counter ticks and the cell jolts once.
      if (this.stackLoading) {
        css += ' board-space--stack-loading';
      }
      if (stackContactAt(this.space.id)) {
        css += ' board-space--stack-contact';
      }
      // …and their mirrors — a MOVE took the top tier off this cell: the counter ticks down, the base returns to the full hex.
      if (this.stackReleased) {
        css += ' board-space--stack-release';
      }
      if (stackUnloadingAt(this.space.id)) {
        css += ' board-space--stack-unloading';
      }
      return css;
    },
    /** A move just lifted the top tier off THIS cell (the scene's `released`). */
    stackReleased(): boolean {
      return stackReleasedAt(this.space.id);
    },
    /** A city tier is descending onto THIS cell (the landing scene's `loading`). */
    stackLoading(): boolean {
      return stackLoadingAt(this.space.id);
    },
    /** The city STACK's height (Skyscrapers) — 1 for any ordinary cell. A MOVE somebody else made off this
     *  stack keeps the height it HAD until the scene's proxy takes the top tier over (`heldStackHeightOf`). */
    stackHeight(): number {
      return heldStackHeightOf(this.space.id) ?? this.space.stackHeight ?? 1;
    },
    /** The owner marker: the model's — or, on a cell still painting a city that has LEFT it (a remote move's
     *  held source), that city's own. */
    cubeColor(): Color | undefined {
      return this.space.color ?? heldPrevColorOf(this.space.id);
    },
    /** The lower tiers drawn under the top tile, nearest first (`--stack-k` 1 = right under it); at most two. */
    tierLayers(): ReadonlyArray<number> {
      if (this.stackHeight <= 1 || this.placementCleared || this.tileView !== 'show') {
        return [];
      }
      const drawn = Math.min(2, this.stackHeight - 1);
      return Array.from({length: drawn}, (_, i) => i + 1);
    },
    /**
     * The art the TOP of this cell wears when it is NOT the cell's own tile: a plain city, once a tier stands on a
     * special city (the Capital is underneath then). Undefined for every single tile and for a pile of plain cities.
     */
    topArt(): TileType | undefined {
      const tileType = this.space.tileType;
      if (tileType === undefined) {
        return undefined;
      }
      const top = stackTopTile(tileType, this.stackHeight);
      return top === tileType ? undefined : top;
    },
    /** The special tile lying UNDER the tiers — its miniature marks the pile ('' = nothing buried, or nothing drawn). */
    buriedArtClass(): string {
      if (this.placementCleared || this.tileView !== 'show') {
        return '';
      }
      const buried = stackBuriedTile(this.space.tileType, this.stackHeight);
      return buried === undefined ? '' : this.artClassOf(buried);
    },
    /** `--stack-n` drives the lift of the top tile and the step of every tier (board px, under the board's zoom). */
    stackStyle(): Record<string, string> {
      return this.stackHeight > 1 ? {'--stack-n': String(Math.min(3, this.stackHeight))} : {};
    },
    // True while this occupied cell is a remove-and-replace placement target
    // OR a console remote-placement reveal hold (the committed tile is hidden
    // until its flight's touchdown): its tile graphic is suppressed and its
    // placement bonus is shown instead — the cell keeps reading as untouched.
    placementCleared(): boolean {
      return placementRenderState.hiddenTiles.has(this.space.id) || isRemoteRevealHeld(this.space.id);
    },
    showBonus(): boolean {
      // A held OCEAN COVER keeps painting the covered water (never the bare
      // hex), so the printed bonuses stay hidden exactly as they were under
      // the real ocean — and so does a REMOVAL in flight (an EMPTY committed
      // cell still painting the tile that is about to lift): the bonuses
      // surface only once the tile has gone.
      if (this.placementCleared && heldPrevTileOf(this.space.id) !== undefined) {
        return false;
      }
      return this.space.tileType === undefined || this.tileView === 'hide' || this.placementCleared;
    },
    // Cube reveal phase for this space (`hidden` during the tile placement
    // animation, `dropping` while the cube lands, `rest` otherwise). PlayerCube
    // reads the `symbol_overlay` preference itself for the colour-blind glyph.
    cubePhase(): CubePhase {
      return cubePhaseForSpace(this.space.id);
    },
    // Inline duration/delay for the marker keyframe (negative delay resumes a
    // beat interrupted by a remount) — same contract as `--placement-duration`.
    markerPlacementStyle(): Record<string, string> {
      if (!this.cathedralPlacing) {
        return {};
      }
      return {
        '--marker-placement-duration': `${this.markerDurationMs}ms`,
        '--marker-placement-delay': `${this.markerDelayMs}ms`,
      };
    },
    /**
     * The camp renders while the flag stands AND the cell is not reveal-held
     * (a move commits the destination hidden until its proxy's touchdown) —
     * OR while the cell carries the move scene's source GHOST (the flag is
     * already gone, but the hop hasn't physically lifted off yet).
     */
    showNomadToken(): boolean {
      if (this.tileView !== 'show') {
        return false;
      }
      if (nomadGhostAt(this.space.id)) {
        return true;
      }
      return this.space.nomads === true && !nomadCellHidden(this.space.id);
    },
    // The landing keyframe's duration/delay (same resume contract as the
    // cathedral marker above).
    nomadLandingStyle(): Record<string, string> {
      if (!this.nomadPlacing) {
        return {};
      }
      return {
        '--nomad-landing-duration': `${this.nomadDurationMs}ms`,
        '--nomad-landing-delay': `${this.nomadDelayMs}ms`,
      };
    },
    claimedToken(): ClaimedToken | undefined {
      if (this.space.undergroundResource === undefined) {
        return undefined;
      }
      return {token: this.space.undergroundResource, shelter: false, active: false};
    },

    getSpaceName(): typeof getSpaceName {
      return getSpaceName;
    },
    SpaceType(): typeof SpaceType {
      return SpaceType;
    },
  },
});

</script>

