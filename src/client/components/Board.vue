<template>
    <div :class="getGameBoardClassName()">
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
            <arc-scale :theme="arcThemes.temperature" :config="temperatureArc" :value="temperature" />
            <arc-scale :theme="arcThemes.oxygen" :config="oxygenArc" :value="oxygen_level" />
            <arc-scale v-if="expansions.venus" :theme="arcThemes.venus" :config="venusArc" :value="venusScaleLevel" />
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
            <div class="global-numbers-temperature">
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

            <div class="global-numbers-oxygen">
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

            <div class="global-numbers-venus" v-if="expansions.venus">
                <bonus-zone v-for="zone in venusZones" :key="zone.key" v-bind="bonusZoneProps(zone)" :style="zone.style" />
            </div>

            <!--
              OCEANS — the first scale drawn entirely in code (no PNG band).
              A compact premium arc in the free bottom window, concentric with
              the scales above. See OceanArcScale.vue / arcScaleGeometry.ts.
            -->
            <ocean-arc-scale :value="oceans_count" :aresMarkers="oceanAresMarkers" :players="players" />
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

                <template v-if="boardName === BoardName.VASTITAS_BOREALIS_NOVA">
                  <g id="hectates_tholius_vastitas_borealis_novus"  transform="translate(270, 70)">
                      <text class="board-caption">
                          <tspan dy="15">Hectates</tspan>
                          <tspan x="5" dy="12">Tholius</tspan>
                      </text>
                  </g>

                  <g id="elysium_mons_vastitas_borealis_novus" transform="translate(480, 145)">
                      <text class="board-caption">
                          <tspan x="-5" dy="15">Elysium</tspan>
                          <tspan x="4" dy="12">Mons</tspan>
                      </text>
                  </g>

                  <g id="alba_mons_vastitas_borealis_novus" transform="translate(105, 230)">
                      <text class="board-caption">
                          <tspan x="0" dy="15">Alba</tspan>
                          <tspan x="-1" dy="12">Mons</tspan>
                      </text>
                  </g>

                  <g id="viking_2_vastitas_borealis_novus" transform="translate(530, 235)">
                      <text class="board-caption">
                          <tspan x="-5" dy="15">Viking 2</tspan>
                      </text>
                  </g>

                  <g id="uranius_tholus_vastitas_borealis_novus" transform="translate(115, 370)">
                      <text class="board-caption">
                          <tspan x="0" dy="0">Uranius</tspan>
                          <tspan x="2" dy="12">Tholus</tspan>
                      </text>
                  </g>

                  <g id="viking_1_vastitas_borealis_novus" transform="translate(164, 445)">
                      <text class="board-caption">
                          <tspan x="-5" dy="15">Viking 1</tspan>
                      </text>
                  </g>
                </template>

                <template v-if="boardName === BoardName.ARABIA_TERRA">
                  <g id="tikhonarov" transform="translate(487, 185)">
                      <text class="board-caption">
                          <tspan>Tikhonarov</tspan>
                      </text>
                      <line x1="15" y1="5" x2="3" y2="20" class="board-line"></line>
                      <text x="1" y="22" class="board-caption board_caption--black">&#x25cf;</text>
                  </g>
                  <g id="ladon" transform="translate(286, 496)">
                      <text class="board-caption">
                          <tspan>Ladon</tspan>
                      </text>
                      <line x1="20" y1="-12" x2="17" y2="-70" class="board-line"></line>
                      <text x="14" y="-68" class="board-caption board_caption--black">&#x25cf;</text>
                  </g>
                  <g id="flaugergues" transform="translate(480, 405)">
                      <text class="board-caption">
                          <tspan>Flaugergues</tspan>
                      </text>
                      <line x1="0" y1="2" x2="-15" y2="10" class="board-line"></line>
                      <text x="-17" y="12" class="board-caption board_caption--black">&#x25cf;</text>
                  </g>
                  <g id="charybdis" transform="translate(455, 450)">
                      <text class="board-caption">
                          <tspan>Charybdis</tspan>
                      </text>
                      <line x1="0" y1="2" x2="-15" y2="10" class="board-line"></line>
                      <text x="-17" y="12" class="board-caption board_caption--black">&#x25cf;</text>
                  </g>
                </template>
            </svg>
        </div>
    </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
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
import {OXYGEN_ARC, TEMPERATURE_ARC, VENUS_ARC} from '@/client/components/board/arcScaleConfigs';
import BonusZone from '@/client/components/board/BonusZone.vue';
import {scaleBonusZoneViews, ScaleBonusZoneView, ScaleBonusClaim, resolveScaleBonusClaim} from '@/client/components/board/scaleBonusZones';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';
import BoardCellInfoPopover from '@/client/components/board/BoardCellInfoPopover.vue';
import {hoverBoardCell, clearBoardCellHover, configureBoardInfo} from '@/client/components/board/boardInfoState';
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

export default defineComponent({
  name: 'board',
  props: {
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
  },
  components: {
    BoardSpace,
    SpecialCellMarker,
    SpecialCellInfoOverlay,
    BoardCellInfoPopover,
    OceanArcScale,
    ArcScale,
    ScaleEventMarker,
    BonusZone,
    ScaleTooltip,
  },
  data() {
    return {
      constants,
      spaceMap: new Map<string, SpaceModel>(this.spaces.map((s) => [s.id, s])),
      // Dynamic global-parameter bands (default) — themed code bands for the
      // O₂ / temperature / Venus scales (mars.png is now planet-only). Constants.
      arcThemes: ARC_SCALE_THEMES,
      oxygenArc: OXYGEN_ARC,
      temperatureArc: TEMPERATURE_ARC,
      venusArc: VENUS_ARC,
    };
  },
  mounted() {
    // Hex-wide hover delegation for the special-cell info system.
    // Listening on .board-cont catches any hover inside the planet AND
    // the .board-outer-spaces overlay (both descend from .board-cont).
    // mouseover/mouseout bubble; mouseenter/mouseleave don't, so we use
    // the bubbling pair with `relatedTarget` dedupe to ignore intra-cell
    // moves. The shared store no-ops when the spaceId isn't a registered
    // marker (= ordinary cell, or occupied special cell).
    this.$el.addEventListener('mouseover', this.onHexHoverEnter);
    this.$el.addEventListener('mouseout', this.onHexHoverLeave);
    // Tell the BoardInformation layer which board this is, so the hover popover
    // can fold in the curated special-cell lore (getSpecialCellInfo needs the board name).
    configureBoardInfo({boardName: this.boardName});
  },
  beforeUnmount() {
    this.$el.removeEventListener('mouseover', this.onHexHoverEnter);
    this.$el.removeEventListener('mouseout', this.onHexHoverLeave);
  },
  methods: {
    onHexHoverEnter(e: MouseEvent): void {
      const cell = (e.target as HTMLElement | null)?.closest('[data_space_id]') as HTMLElement | null;
      if (cell === null) {
        return;
      }
      const related = e.relatedTarget as Node | null;
      // Moves from a child of the same cell don't count as "entering" the cell.
      if (related !== null && cell.contains(related)) {
        return;
      }
      // During a tile placement the per-cell reason popover (SelectSpace.vue)
      // owns whole-cell hover, so the hex-wide info path is suppressed
      // ENTIRELY — showing the special-cell info on every cell the cursor
      // crosses would double up with the reason popover and overload the
      // player. The `i` marker keeps its own @mouseenter, so a deliberate
      // hover on the badge still opens the info even during placement. Outside
      // placement, hex-wide hover behaves exactly as before.
      if (this.placementActive()) {
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
      hoverBoardCell(spaceId);
    },
    // True while a tile-placement prompt is on the board — SelectSpace marks
    // its legal cells with `.board-space--available`, which exists ONLY during
    // placement, so its presence anywhere is a reliable "placement mode" flag.
    placementActive(): boolean {
      return document.querySelector('.board-space--available') !== null;
    },
    onHexHoverLeave(e: MouseEvent): void {
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
    },
    getAllSpacesOnMars(): Array<SpaceModel> {
      const boardSpaces: Array<SpaceModel> = [...this.spaces];
      boardSpaces.sort(
        (space1: SpaceModel, space2: SpaceModel) => {
          return parseInt(space1.id) - parseInt(space2.id);
        },
      );
      return boardSpaces.filter((s: SpaceModel) => {
        return s.spaceType !== SpaceType.COLONY;
      });
    },
    hasSpace(spaceId: SpaceId): boolean {
      return this.spaceMap.has(spaceId);
    },
    getSpace(spaceId: SpaceId): SpaceModel {
      const space = this.spaceMap.get(spaceId);
      if (space === undefined) {
        // For some reason Vue still calls getSpace when hasSpace is false. I thought it didn't.
        // Returning undefined as SpaceModel satisfies the type checker, but the value isn't
        // used.
        return undefined as unknown as SpaceModel;
      }
      return space;
    },
    getGameBoardClassName(): string {
      // mars.png is now PLANET-ONLY (the parameter arcs are rendered in code,
      // see the ArcScale / OceanArcScale bands), so the planet image is the same
      // whether or not Venus is in play — the Venus SCALE is toggled dynamically
      // by `expansions.venus` on its <arc-scale> + digit container. The legacy
      // `board-without-venus` (mars-without-venus.png) variant is retired.
      return 'board-cont board-with-venus';
    },
    // The full BonusZone prop set for a scale-bonus view (bound via v-bind so
    // the same markup serves all three scale containers). The return type is
    // inferred as the literal (NOT Record<string, unknown>) so vue-tsc can match
    // it against BonusZone's props in the template.
    bonusZoneProps(zone: ScaleBonusZoneView & ScaleBonusClaim) {
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
    },
  },
  computed: {
    /**
     * Sorted, colony-filtered Mars surface cells for the main `<board-space>`
     * v-for. Cached as a computed (depends only on `this.spaces`) so an
     * unrelated re-render of `<board>` — e.g. the in-place global-parameter
     * preview mutation that only bumps `temperature` — does NOT re-allocate
     * the array + re-diff all ~60 board cells. The board-space children keep
     * stable prop identities and skip re-render. (perf B11)
     */
    spacesOnMars(): Array<SpaceModel> {
      return this.getAllSpacesOnMars();
    },
    /**
     * Render-ready global-parameter scale reward zones, filtered to the active
     * expansions (Venus base bonuses need Venus; the resource/gold bonuses need
     * the Alternative Venus Board; oxygen/temperature bonuses are base game).
     */
    scaleBonusZones(): ReadonlyArray<ScaleBonusZoneView & ScaleBonusClaim> {
      const views = scaleBonusZoneViews({
        venus: this.expansions.venus === true,
        altVenus: this.altVenusBoard === true,
      });
      return views.map((z) => ({
        ...z,
        ...resolveScaleBonusClaim(this.scaleBonusClaims, z.scale, z.step, this.players),
      }));
    },
    // Per-scale slices — each rendered INSIDE its own number container so the
    // anchor geometry shares the digits' coordinate origin (pixel-accurate).
    venusZones(): ReadonlyArray<ScaleBonusZoneView & ScaleBonusClaim> {
      return this.scaleBonusZones.filter((z) => z.scale === 'venus');
    },
    oxygenZones(): ReadonlyArray<ScaleBonusZoneView & ScaleBonusClaim> {
      return this.scaleBonusZones.filter((z) => z.scale === 'oxygen');
    },
    temperatureZones(): ReadonlyArray<ScaleBonusZoneView & ScaleBonusClaim> {
      return this.scaleBonusZones.filter((z) => z.scale === 'temperature');
    },
    /**
     * Premium PLANETARY-EVENT markers (Ares) — built from the LIVE hazard
     * thresholds so they sit on the real digit (extreme-variant safe). Empty
     * (so nothing renders) outside an Ares game — no leak.
     */
    aresMarkers(): ReadonlyArray<GlobalParameterThresholdMarker> {
      if (this.expansions.ares !== true || this.aresData === undefined) {
        return [];
      }
      return aresThresholdMarkers(this.aresData);
    },
    oceanAresMarkers(): ReadonlyArray<GlobalParameterThresholdMarker> {
      return this.aresMarkers.filter((m) => m.parameter === 'oceans');
    },
    temperatureEventMarkers(): ReadonlyArray<ScaleEventMarkerView> {
      return this.aresMarkers
        .filter((m) => m.parameter === 'temperature')
        .map((m) => aresDynamicMarkerView(m, this.temperature, glidedThreshold(m.id, m.value)));
    },
    oxygenEventMarkers(): ReadonlyArray<ScaleEventMarkerView> {
      return this.aresMarkers
        .filter((m) => m.parameter === 'oxygen')
        .map((m) => aresDynamicMarkerView(m, this.oxygen_level, glidedThreshold(m.id, m.value)));
    },
    /**
     * Mars-surface cells (non-colony) for which a special-cell info entry
     * exists. The marker component itself gates rendering on
     * `tileType === undefined` — listing them here just narrows the
     * candidate set so we don't iterate the full board.
     */
    surfaceMarkerSpaces(): Array<SpaceModel> {
      return this.spaces.filter((s) =>
        s.spaceType !== SpaceType.COLONY && getSpecialCellInfo(s.id, this.boardName) !== undefined);
    },
    /**
     * Colony / off-Mars cells with a special-cell info entry. These are
     * rendered in the .board-outer-spaces container alongside their
     * matching <board-space>.
     */
    outerMarkerSpaces(): Array<SpaceModel> {
      return this.spaces.filter((s) =>
        s.spaceType === SpaceType.COLONY && getSpecialCellInfo(s.id, this.boardName) !== undefined);
    },
    BoardName(): typeof BoardName {
      return BoardName;
    },
    LEGENDS(): typeof LEGENDS {
      return LEGENDS;
    },
    SpaceName(): typeof SpaceName {
      return SpaceName;
    },
  },
});
</script>
