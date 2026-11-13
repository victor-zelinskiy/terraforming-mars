<template>
    <div ref="root" :class="getGameBoardClassName()">
        <!--
          "Show/Hide tiles" toggle removed for this fork — not used. The
          `toggleTileView` emit is preserved at the component contract
          level so upstream merges don't conflict; tileView simply stays
          at its default (full tiles) for the duration of the game.
        -->
        <!-- Single global overlay for the special-cell hover-info system.
             Renders the popup panel + connector line whenever any marker
             on the page is hovered/focused. Lives inside Board.vue (rather
             than App) because it's coupled to the board UI feature set. -->
        <special-cell-info-overlay />
        <!-- General BoardInformation hover inspector: for every cell WITHOUT a
             curated special-cell entry (printed bonuses, ocean adjacency, who
             scores at endgame, Deflection Zone / restricted rules). Driven by the
             same hex-wide hover delegation below. -->
        <board-cell-info-popover />
        <!-- Unified scale-HUD tooltip host (rail / identity / indicator / marker
             chips all route through it). Teleports to body; one instance. -->
        <scale-tooltip />
        <!--
          Outer (off-Mars) special cells. Persistent text labels removed —
          info is delivered via the hover-marker framework
          (SpecialCellMarker → SpecialCellInfoOverlay) for the cells that
          opted in via specialCellInfo.ts. Cells without a config entry
          render as bare tiles, same as before, just without the label.
        -->
        <div class="board-outer-spaces" id="colony_spaces">
          <board-space v-if="hasSpace(SpaceName.GANYMEDE_COLONY)" :space="getSpace(SpaceName.GANYMEDE_COLONY)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.PHOBOS_SPACE_HAVEN)" :space="getSpace(SpaceName.PHOBOS_SPACE_HAVEN)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.STANFORD_TORUS)" :space="getSpace(SpaceName.STANFORD_TORUS)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.LUNA_METROPOLIS)" :space="getSpace(SpaceName.LUNA_METROPOLIS)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.DAWN_CITY)" :space="getSpace(SpaceName.DAWN_CITY)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.STRATOPOLIS)" :space="getSpace(SpaceName.STRATOPOLIS)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.MAXWELL_BASE)" :space="getSpace(SpaceName.MAXWELL_BASE)" :tileView="tileView"></board-space>
          <!-- Turmoil Redux TR27 — «next to the Venus track»: the fifth cell of the Venus flank. -->
          <board-space v-if="hasSpace(SpaceName.AURORA_STATION)" :space="getSpace(SpaceName.AURORA_STATION)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.CERES_SPACEPORT)" :space="getSpace(SpaceName.CERES_SPACEPORT)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.DYSON_SCREENS)" :space="getSpace(SpaceName.DYSON_SCREENS)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.LUNAR_EMBASSY)" :space="getSpace(SpaceName.LUNAR_EMBASSY)" :tileView="tileView"></board-space>
          <board-space v-if="hasSpace(SpaceName.VENERA_BASE)" :space="getSpace(SpaceName.VENERA_BASE)" :tileView="tileView"></board-space>

          <!-- Markers for outer special cells. Mounted as siblings (not
               children) so they sit outside any per-cell clip-path. Each
               marker reuses its hex's .board-space-XX class for absolute
               positioning. -->
          <special-cell-marker
            v-for="space in outerMarkerSpaces"
            :key="'marker-' + space.id"
            :space="space"
            :boardName="boardName"
          />
        </div>

        <div class="global-numbers">
            <!--
              DYNAMIC global-parameter bands (DEFAULT). The colour arcs are no
              longer baked into mars.png — these render O₂ / temperature / Venus
              in code in the unified premium language. They paint FIRST (behind
              the existing digits / indicator / bonus chips, which are already
              dynamic). Venus only renders with the expansion (the planet PNG is
              now venus-agnostic; the Venus arc is purely dynamic). Ocean is
              fully code-rendered below (OceanArcScale).
            -->
            <!--
              Every DIRECT child here wears `global-numbers-shell` — the console's
              Planet Focus fades the shells by that class (console.less), never by
              a universal `> *`, which restyled the whole board on every camera
              move (PL-777; guard `planetFocusRestyleGuard`). A new shell wears it too.
            -->
            <arc-scale class="global-numbers-shell" :theme="arcThemes.temperature" :config="temperatureArc" :value="temperature" />
            <arc-scale class="global-numbers-shell" :theme="arcThemes.oxygen" :config="oxygenArc" :value="oxygen_level" />
            <arc-scale v-if="expansions.venus" class="global-numbers-shell" :theme="arcThemes.venus" :config="venusArc" :value="venusScaleLevel" :identityOutside="layoutKind === 'large'" />
            <!--
              The 1–N digit anchors (`.global-numbers-value.val-N`) and the
              gliding <AnimatedScaleMarker> are rendered INSIDE each <arc-scale>
              above (as its own children), positioned from arcScaleConfigs.ts. The
              marker walks those anchors via WAAPI so the current value glides
              along the arc. The per-scale containers below host ONLY the bonus
              reward chips. See AnimatedScaleMarker.vue / ArcScale.vue.
            -->
            <!--
              SCALE reward zones are rendered INSIDE each scale's number
              container so they share the EXACT coordinate origin with the
              digits (the `@*-vals` anchors). That makes the anchor geometry
              (scaleBonusZones.ts) pixel-accurate relative to each division —
              a separate container would carry a per-scale origin offset.
            -->
            <!--
              The colour band, the 1–N digits, the gliding indicator and the
              identity badge are all rendered by the dynamic <arc-scale> above.
              These per-scale containers now host ONLY the bonus reward chips
              (BonusZone), which keep their existing scaleBonusZones positioning.
            -->
            <div class="global-numbers-temperature global-numbers-shell">
                <bonus-zone v-for="zone in temperatureZones" :key="zone.key" v-bind="bonusZoneProps(zone)" :style="zone.style" />
                <scale-event-marker
                  v-for="m in temperatureEventMarkers"
                  :key="m.marker.id"
                  :marker="m.marker"
                  surface="temperature"
                  :top="m.top" :left="m.left" :size="m.size"
                  :point="m.point" :pointerDist="m.pointerDist" :pointerLen="m.pointerLen"
                  :reached="m.reached" :players="players" />
            </div>

            <div class="global-numbers-oxygen global-numbers-shell">
                <bonus-zone v-for="zone in oxygenZones" :key="zone.key" v-bind="bonusZoneProps(zone)" :style="zone.style" />
                <scale-event-marker
                  v-for="m in oxygenEventMarkers"
                  :key="m.marker.id"
                  :marker="m.marker"
                  surface="oxygen"
                  :top="m.top" :left="m.left" :size="m.size"
                  :point="m.point" :pointerDist="m.pointerDist" :pointerLen="m.pointerLen"
                  :reached="m.reached" :players="players" />
            </div>

            <div class="global-numbers-venus global-numbers-shell" v-if="expansions.venus">
                <bonus-zone v-for="zone in venusZones" :key="zone.key" v-bind="bonusZoneProps(zone)" :style="zone.style" />
            </div>

            <!--
              OCEANS — the first scale drawn entirely in code (no PNG band).
              A compact premium arc in the free bottom window, concentric with
              the scales above. See OceanArcScale.vue / arcScaleGeometry.ts.
            -->
            <ocean-arc-scale class="global-numbers-shell" :value="oceans_count" :aresMarkers="oceanAresMarkers" :players="players"
              :config="arcs.oceans" :eventsOutside="layoutKind === 'large'" />
        </div>

        <div class="board" id="main_board">
            <board-space
              v-for="curSpace in spacesOnMars"
              :key="curSpace.id"
              :space="curSpace"
              :aresExtension="expansions.ares"
              :tileView="tileView"
              data-test="board-space"
            />

            <!-- Markers for Mars-surface special cells (e.g. Noctis City,
                 Tharsis Tholus). Same sibling-of-hex strategy as the
                 outer-cell markers above. -->
            <special-cell-marker
              v-for="space in surfaceMarkerSpaces"
              :key="'marker-' + space.id"
              :space="space"
              :boardName="boardName"
            />

            <svg id="board_legend" height="550" width="630" class="board-legend">
              <g v-for="(key, idx) of LEGENDS[boardName]" :key="idx" :transform="`translate(${key.position[0]}, ${key.position[1]})`">
                <text class="board-caption">
                  <tspan y="0">{{key.text[0]}}</tspan>
                  <tspan :x="key.secondRowX || 0" y="1.1em">{{key.text[1]}}</tspan>
                </text>
                <template v-if="key.line !== undefined">
                  <line :x1="key.line.from[0]" :y1="key.line.from[1]" :x2="key.line.to[0]" :y2="key.line.to[1]" class="board-line"></line>
                  <circle :cx="key.line.to[0]" :cy="key.line.to[1]" r="2" class="board-caption board_caption--black"/>
                </template>
              </g>
            </svg>
        </div>
    </div>
</template>

<script setup vapor lang="ts">
import {computed, onBeforeUnmount, onMounted, useTemplateRef} from 'vue';
import * as constants from '@/common/constants';
import BoardSpace from '@/client/components/BoardSpace.vue';
import SpecialCellMarker from '@/client/components/board/SpecialCellMarker.vue';
import SpecialCellInfoOverlay from '@/client/components/board/SpecialCellInfoOverlay.vue';
import OceanArcScale from '@/client/components/board/OceanArcScale.vue';
import ArcScale from '@/client/components/board/ArcScale.vue';
import ScaleEventMarker from '@/client/components/board/ScaleEventMarker.vue';
import {aresThresholdMarkers, aresDynamicMarkerView, ScaleEventMarkerView} from '@/client/components/board/aresThresholdMarkers';
import {GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';
import {glidedThreshold} from '@/client/components/board/aresMarkerGlide';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {BoardArcConfigs, DynamicArcConfig} from '@/client/components/board/arcScaleConfigs';
import {BoardLayoutKind, arcConfigsFor, boardLayoutKind} from '@/client/components/board/largeBoardLayout';
import BonusZone from '@/client/components/board/BonusZone.vue';
import {scaleBonusZoneViews, ScaleBonusZoneView, ScaleBonusClaim, resolveScaleBonusClaim} from '@/client/components/board/scaleBonusZones';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';
import BoardCellInfoPopover from '@/client/components/board/BoardCellInfoPopover.vue';
import {hoverBoardCell, clearBoardCellHover, configureBoardInfo} from '@/client/components/board/boardInfoState';
import {placementRenderState} from '@/client/components/board/placementRenderState';
import ScaleTooltip from '@/client/components/board/ScaleTooltip.vue';
import {AresData} from '@/common/ares/AresData';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {SpaceId} from '@/common/Types';
import {TileView} from '@/client/components/board/TileView';
import {BoardName} from '@/common/boards/BoardName';
import {LEGENDS} from '@/client/components/Legends';
import {Expansion} from '@/common/cards/GameModule';
import {SpaceName} from '@/common/boards/SpaceName';

defineOptions({name: 'board'});
const props = defineProps({
  spaces: {
    type: Array as () => ReadonlyArray<SpaceModel>,
    required: true,
  },
  venusScaleLevel: {
    type: Number,
    required: true,
  },
  altVenusBoard: {
    type: Boolean,
  },
  // Who claimed each global-parameter SCALE bonus (`<scale>-<step>` → colour /
  // 'neutral'). Drives the premium claimed/government node states.
  scaleBonusClaims: {
    type: Object as () => Record<string, Color>,
    default: () => ({}),
  },
  players: {
    type: Array as () => ReadonlyArray<PublicPlayerModel>,
    default: () => [],
  },
  boardName: {
    type: String as () => BoardName,
    required: true,
  },
  oceans_count: {
    type: Number,
    default: 0,
  },
  oxygen_level: {
    type: Number,
    default: 0,
  },
  temperature: {
    type: Number,
    default: constants.MIN_TEMPERATURE,
  },
  expansions: {
    type: Object as () => Record<Expansion, boolean>,
    required: true,
  },
  aresData: {
    type: Object as () => AresData | undefined,
    default: undefined,
  },
  tileView: {
    type: String as () => TileView,
    default: 'show',
  },
});

const root = useTemplateRef<HTMLElement>('root');
// Dynamic global-parameter bands (default) — themed code bands for the
// O₂ / temperature / Venus scales (mars.png is now planet-only). Constants.
const arcThemes = ARC_SCALE_THEMES;

// BRD-1 (docs/PERFORMANCE_AUDIT.md): spaceMap was once built ONCE, at creation, and never updated when
// `spaces` changed — it only "refreshed" because the board full-remounts on every
// poll (a latent staleness bug). As a computed it tracks `props.spaces` correctly,
// with zero behavior change today, and unblocks moving the board off the remount.
/** The board's layout family (`largeBoardLayout.ts` — Amazonis Planitia's eleven rows). */
const layoutKind = computed((): BoardLayoutKind => {
  return boardLayoutKind(props.boardName);
});
/** The board's four dials — the classic ring or the eleven-row field's own circles (`LARGE_ARCS`). */
const arcs = computed((): BoardArcConfigs => {
  return arcConfigsFor(props.boardName);
});
const temperatureArc = computed((): DynamicArcConfig => {
  return arcs.value.temperature;
});
const oxygenArc = computed((): DynamicArcConfig => {
  return arcs.value.oxygen;
});
const venusArc = computed((): DynamicArcConfig => {
  return arcs.value.venus;
});
const spaceMap = computed((): Map<string, SpaceModel> => {
  return new Map<string, SpaceModel>(props.spaces.map((s) => [s.id, s]));
});
/**
 * Sorted, colony-filtered Mars surface cells for the main `<board-space>`
 * v-for. Cached as a computed (depends only on `props.spaces`) so an
 * unrelated re-render of `<board>` — e.g. the in-place global-parameter
 * preview mutation that only bumps `temperature` — does NOT re-allocate
 * the array + re-diff all ~60 board cells. The board-space children keep
 * stable prop identities and skip re-render. (perf B11)
 */
const spacesOnMars = computed((): Array<SpaceModel> => {
  return getAllSpacesOnMars();
});
/**
 * Render-ready global-parameter scale reward zones, filtered to the active
 * expansions (Venus base bonuses need Venus; the resource/gold bonuses need
 * the Alternative Venus Board; oxygen/temperature bonuses are base game).
 */
const scaleBonusZones = computed((): ReadonlyArray<ScaleBonusZoneView & ScaleBonusClaim> => {
  const views = scaleBonusZoneViews({
    venus: props.expansions.venus === true,
    altVenus: props.altVenusBoard === true,
  }, props.boardName);
  return views.map((z) => ({
    ...z,
    ...resolveScaleBonusClaim(props.scaleBonusClaims, z.scale, z.step, props.players),
  }));
});
// Per-scale slices — each rendered INSIDE its own number container so the
// anchor geometry shares the digits' coordinate origin (pixel-accurate).
const venusZones = computed((): ReadonlyArray<ScaleBonusZoneView & ScaleBonusClaim> => {
  return scaleBonusZones.value.filter((z) => z.scale === 'venus');
});
const oxygenZones = computed((): ReadonlyArray<ScaleBonusZoneView & ScaleBonusClaim> => {
  return scaleBonusZones.value.filter((z) => z.scale === 'oxygen');
});
const temperatureZones = computed((): ReadonlyArray<ScaleBonusZoneView & ScaleBonusClaim> => {
  return scaleBonusZones.value.filter((z) => z.scale === 'temperature');
});
/**
 * Premium PLANETARY-EVENT markers (Ares) — built from the LIVE hazard
 * thresholds so they sit on the real digit (extreme-variant safe). Empty
 * (so nothing renders) outside an Ares game — no leak.
 */
const aresMarkers = computed((): ReadonlyArray<GlobalParameterThresholdMarker> => {
  if (props.expansions.ares !== true || props.aresData === undefined) {
    return [];
  }
  return aresThresholdMarkers(props.aresData);
});
const oceanAresMarkers = computed((): ReadonlyArray<GlobalParameterThresholdMarker> => {
  return aresMarkers.value.filter((m) => m.parameter === 'oceans');
});
const temperatureEventMarkers = computed((): ReadonlyArray<ScaleEventMarkerView> => {
  return aresMarkers.value
    .filter((m) => m.parameter === 'temperature')
    .map((m) => aresDynamicMarkerView(m, props.temperature, glidedThreshold(m.id, m.value), arcs.value));
});
const oxygenEventMarkers = computed((): ReadonlyArray<ScaleEventMarkerView> => {
  return aresMarkers.value
    .filter((m) => m.parameter === 'oxygen')
    .map((m) => aresDynamicMarkerView(m, props.oxygen_level, glidedThreshold(m.id, m.value), arcs.value));
});
/**
 * Mars-surface cells (non-colony) for which a special-cell info entry
 * exists. The marker component itself gates rendering on
 * `tileType === undefined` — listing them here just narrows the
 * candidate set so we don't iterate the full board.
 */
const surfaceMarkerSpaces = computed((): Array<SpaceModel> => {
  return props.spaces.filter((s) =>
    s.spaceType !== SpaceType.COLONY && getSpecialCellInfo(s.id, props.boardName) !== undefined);
});
/**
 * Colony / off-Mars cells with a special-cell info entry. These are
 * rendered in the .board-outer-spaces container alongside their
 * matching <board-space>.
 */
const outerMarkerSpaces = computed((): Array<SpaceModel> => {
  return props.spaces.filter((s) =>
    s.spaceType === SpaceType.COLONY && getSpecialCellInfo(s.id, props.boardName) !== undefined);
});

function onHexHoverEnter(e: MouseEvent): void {
  const cell = (e.target as HTMLElement | null)?.closest('[data_space_id]') as HTMLElement | null;
  if (cell === null) {
    return;
  }
  const related = e.relatedTarget as Node | null;
  // Moves from a child of the same cell don't count as "entering" the cell.
  if (related !== null && cell.contains(related)) {
    return;
  }
  // During a tile placement the per-cell reason popover (ConsoleBoardInput.vue)
  // owns whole-cell hover, so the hex-wide info path is suppressed
  // ENTIRELY — showing the special-cell info on every cell the cursor
  // crosses would double up with the reason popover and overload the
  // player. The `i` marker keeps its own @mouseenter, so a deliberate
  // hover on the badge still opens the info even during placement. Outside
  // placement, hex-wide hover behaves exactly as before.
  if (placementActive()) {
    return;
  }
  const spaceId = cell.getAttribute('data_space_id') as SpaceId | null;
  if (spaceId === null) {
    return;
  }
  // EVERY cell — named special cells (volcanoes / Noctis / colonies) included
  // — gets the general BoardInformation inspector. The curated lore is folded
  // INTO that popover (BoardCellInfoPopover reads getSpecialCellInfo), so a
  // named cell shows its lore AND its tile bonuses / owner / scoring, and an
  // OCCUPIED named cell (where the lore marker isn't rendered) still informs.
  // Pass the cell rect we already hold (BRD-3) so the popover doesn't
  // re-query the DOM + force layout in its position computed.
  hoverBoardCell(spaceId, cell.getBoundingClientRect());
}
// True while a tile-placement prompt is on the board. ConsoleBoardInput marks its
// legal cells with `.board-space--available` (added in `animateSpaces`,
// removed in `disableAnimation`) and mirrors that into `placementRenderState`
// — read the reactive flag instead of a full-DOM `querySelector` on every
// mouseover (BRD-3, docs/PERFORMANCE_AUDIT.md).
function placementActive(): boolean {
  return placementRenderState.highlightActive;
}
function onHexHoverLeave(e: MouseEvent): void {
  const cell = (e.target as HTMLElement | null)?.closest('[data_space_id]') as HTMLElement | null;
  if (cell === null) {
    return;
  }
  const related = e.relatedTarget as Node | null;
  // Moves to a child of the same cell don't count as "leaving" the cell.
  if (related !== null && cell.contains(related)) {
    return;
  }
  const spaceId = cell.getAttribute('data_space_id') as SpaceId | null;
  if (spaceId === null) {
    return;
  }
  clearBoardCellHover(spaceId);
}
function getAllSpacesOnMars(): Array<SpaceModel> {
  const boardSpaces: Array<SpaceModel> = [...props.spaces];
  boardSpaces.sort(
    (space1: SpaceModel, space2: SpaceModel) => {
      return parseInt(space1.id) - parseInt(space2.id);
    },
  );
  return boardSpaces.filter((s: SpaceModel) => {
    return s.spaceType !== SpaceType.COLONY;
  });
}
function hasSpace(spaceId: SpaceId): boolean {
  return spaceMap.value.has(spaceId);
}
function getSpace(spaceId: SpaceId): SpaceModel {
  const space = spaceMap.value.get(spaceId);
  if (space === undefined) {
    // For some reason Vue still calls getSpace when hasSpace is false. I thought it didn't.
    // Returning undefined as SpaceModel satisfies the type checker, but the value isn't
    // used.
    return undefined as unknown as SpaceModel;
  }
  return space;
}
function getGameBoardClassName(): string {
  // mars.png is now PLANET-ONLY (the parameter arcs are rendered in code,
  // see the ArcScale / OceanArcScale bands), so the planet image is the same
  // whether or not Venus is in play — the Venus SCALE is toggled dynamically
  // by `expansions.venus` on its <arc-scale> + digit container. The legacy
  // `board-without-venus` (mars-without-venus.png) variant is retired.
  // The ELEVEN-ROW field (Amazonis Planitia) scopes its own hex positions and planet (`board_large_positions.less`).
  return layoutKind.value === 'large' ? 'board-cont board-with-venus board-cont--large' : 'board-cont board-with-venus';
}
// The full BonusZone prop set for a scale-bonus view (bound via v-bind so
// the same markup serves all three scale containers). The return type is
// inferred as the literal (NOT Record<string, unknown>) so vue-tsc can match
// it against BonusZone's props in the template.
function bonusZoneProps(zone: ScaleBonusZoneView & ScaleBonusClaim) {
  return {
    icon: zone.icon,
    reward: zone.reward,
    tier: zone.tier,
    point: zone.point,
    pointerDist: zone.pointerDist,
    pointerLen: zone.pointerLen,
    surface: zone.scale,
    state: zone.state,
    claimColor: zone.claimColor,
    claimedBy: zone.claimedBy,
    claimKey: `${zone.scale}-${zone.step}`,
  };
}

onMounted(() => {
  // Hex-wide hover delegation for the special-cell info system.
  // Listening on .board-cont catches any hover inside the planet AND
  // the .board-outer-spaces overlay (both descend from .board-cont).
  // mouseover/mouseout bubble; mouseenter/mouseleave don't, so we use
  // the bubbling pair with `relatedTarget` dedupe to ignore intra-cell
  // moves. The shared store no-ops when the spaceId isn't a registered
  // marker (= ordinary cell, or occupied special cell).
  (root.value as HTMLElement).addEventListener('mouseover', onHexHoverEnter);
  (root.value as HTMLElement).addEventListener('mouseout', onHexHoverLeave);
  // Tell the BoardInformation layer which board this is, so the hover popover
  // can fold in the curated special-cell lore (getSpecialCellInfo needs the board name).
  configureBoardInfo({boardName: props.boardName});
});
onBeforeUnmount(() => {
  (root.value as HTMLElement).removeEventListener('mouseover', onHexHoverEnter);
  (root.value as HTMLElement).removeEventListener('mouseout', onHexHoverLeave);
});
</script>
