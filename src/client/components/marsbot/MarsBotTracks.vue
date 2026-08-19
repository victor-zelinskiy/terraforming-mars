<template>
  <div class="mb-tracks" :class="{'mb-tracks--large': large}" :style="{'--mb-cols': maxCells}">
    <div v-for="(track, ti) in tracks" :key="ti" class="mb-track" :class="{'mb-track--whitemarker': whiteMarkerTracks.has(ti)}">
      <div class="mb-track__id">
        <Tag v-for="tag in track.tags" :key="tag" :tag="tag" :size="large ? 'big' : 'med'" type="secondary" />
      </div>
      <div class="mb-track__cells">
        <div
          v-for="cell in cellsFor(track, ti)"
          :key="cell.index"
          class="mb-cell"
          :class="{
            'mb-cell--current': cell.current,
            'mb-cell--passed': cell.index < track.position,
            'mb-cell--regressed': cell.regressed,
            'mb-cell--start': cell.index === 0,
            'mb-cell--cube': cell.cube !== undefined && !cell.cube.spent,
          }"
          :data-hint="hintFor(cell, ti)"
        >
          <!-- The current cell is marked by the bright `mb-cell--current`
               OUTLINE only — never a cube INSIDE it (a cube covered the cell's
               own bonus glyph, hiding WHICH bonus the bot is standing on). So
               the current cell still renders its action glyph like any other. -->
          <template v-if="cell.action !== undefined">
            <span v-if="glyphFor(cell).kind === 'tr'" class="mb-glyph mb-glyph--tr">+{{ trSteps(cell) }}</span>
            <span v-else-if="glyphFor(cell).kind === 'advance'" class="mb-glyph mb-glyph--advance" aria-hidden="true">»</span>
            <span v-else-if="glyphFor(cell).kind === 'tag'" class="mb-glyph mb-glyph--tag">
              <Tag v-if="targetTag(cell) !== undefined" :tag="targetTag(cell)!" size="small" type="secondary" />
            </span>
            <span v-else-if="glyphFor(cell).kind === 'param'" class="mb-glyph">
              <i class="mb-ico" :class="'mb-ico--' + paramIcon(cell)" aria-hidden="true"></i>
              <span v-if="paramCount(cell) === 2" class="mb-glyph__multi">×2</span>
            </span>
            <span v-else-if="glyphFor(cell).kind === 'tile'" class="mb-glyph">
              <i class="mb-ico" :class="'mb-ico--' + tileKind(cell)" aria-hidden="true"></i>
            </span>
            <span v-else-if="glyphFor(cell).kind === 'floater'" class="mb-glyph">
              <i class="mb-ico mb-ico--floater" aria-hidden="true"></i>
              <span v-if="floaterCount(cell) === 2" class="mb-glyph__multi">×2</span>
            </span>
            <span v-else-if="glyphFor(cell).kind === 'ma'" class="mb-glyph mb-glyph--ma">{{ maGlyph(cell) }}</span>
          </template>
          <span v-if="cell.regressed" class="mb-cell__regress" aria-hidden="true">✕</span>
          <!-- A corporation CUBE seeded on this space (RB-B special cubes).
               Corner-pinned so the cell's own bonus glyph stays readable; a
               SPENT cube keeps its place as a hollow outline (the physical
               cube is still on the mat, it just cannot fire again). -->
          <span v-if="cell.cube !== undefined"
                class="mb-cell__cube"
                :class="['mb-cell__cube--' + cell.cube.cubeType, {'mb-cell__cube--spent': cell.cube.spent}]"
                aria-hidden="true"></span>
          <!-- The corporation's SETUP replaced this track's TRACKER with a
               white cube (C04) — so the position marker itself wears one,
               reading exactly like the physical mat. Yields to a seeded cube
               on the same space (they would occupy the same corner). -->
          <span v-if="cell.current && cell.cube === undefined && whiteMarkerTracks.has(ti)"
                class="mb-cell__marker" aria-hidden="true"></span>
        </div>
      </div>
      <div class="mb-track__pos">{{ track.position }}<span class="mb-track__pos-max">/{{ track.maxPosition }}</span></div>
    </div>
    <!-- The corporation's cube legend — what each colour does, in the printed
         card's own words, so a cube on the mat explains itself. -->
    <div v-if="legendRows.length > 0" class="mb-cubelegend">
      <div v-for="row in legendRows" :key="row.key" class="mb-cubelegend__row">
        <span v-if="row.marker" class="mb-cell__marker mb-cell__marker--legend" aria-hidden="true"></span>
        <span v-else class="mb-cell__cube" :class="'mb-cell__cube--' + row.cubeType" aria-hidden="true"></span>
        <span class="mb-cubelegend__text">{{ row.text }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The MarsBot board tracks — one row per track: the identity TAGS on the
 * left, the printed cell strip (action icons, the bot's cube on the current
 * space, regressed-space markers) and the position readout. Reused by the
 * desktop bot-board overlay AND the console info-mode detail (`large`), so
 * the two presentations never diverge. Pure presentation over the SERVER
 * `MarsBotTrackModel` — no rules re-derived here.
 */
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {Tag as CardTag} from '@/common/cards/Tag';
import {MarsBotCorpCubeModel, MarsBotCorpModel, MarsBotCubeType, marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {TrackCell, TrackActionGlyph, trackActionGlyph, trackActionLabel, trackCells} from './marsBotView';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import Tag from '@/client/components/Tag.vue';

export default defineComponent({
  name: 'MarsBotTracks',
  components: {Tag},
  props: {
    tracks: {type: Array as PropType<ReadonlyArray<MarsBotTrackModel>>, required: true},
    botColor: {type: String as PropType<Color>, required: true},
    /** TV-readable sizing for the console info mode. */
    large: {type: Boolean, default: false},
    /** The bot's corporation — its seeded cubes are drawn on the tracks
     *  (RB-B special cubes) and its legend explains them. */
    corporation: {type: Object as PropType<MarsBotCorpModel | undefined>, default: undefined},
  },
  methods: {
    cellsFor(track: MarsBotTrackModel, trackIndex: number): Array<TrackCell> {
      return trackCells(track, this.cubesByTrack.get(trackIndex) ?? []);
    },
    glyphFor(cell: TrackCell): TrackActionGlyph {
      return cell.action !== undefined ? trackActionGlyph(cell.action) : {kind: 'advance'};
    },
    trSteps(cell: TrackCell): number {
      const g = this.glyphFor(cell);
      return g.kind === 'tr' ? g.steps : 0;
    },
    targetTag(cell: TrackCell): CardTag | undefined {
      const g = this.glyphFor(cell);
      if (g.kind !== 'tag') {
        return undefined;
      }
      return this.tracks[g.trackIndex]?.tags[0];
    },
    paramIcon(cell: TrackCell): string {
      const g = this.glyphFor(cell);
      return g.kind === 'param' ? g.icon : 'temperature';
    },
    paramCount(cell: TrackCell): number {
      const g = this.glyphFor(cell);
      return g.kind === 'param' ? g.count : 1;
    },
    tileKind(cell: TrackCell): string {
      const g = this.glyphFor(cell);
      return g.kind === 'tile' ? g.tile : 'greenery';
    },
    floaterCount(cell: TrackCell): number {
      const g = this.glyphFor(cell);
      return g.kind === 'floater' ? g.count : 1;
    },
    maGlyph(cell: TrackCell): string {
      const g = this.glyphFor(cell);
      return g.kind === 'ma' && g.which === 'award' ? '🏅' : '🏆';
    },
    /** The printed meaning of a cube colour (the corporation's own words). */
    legendText(cubeType: MarsBotCubeType): string | undefined {
      const id = this.corporation?.id;
      const key = id === undefined ? undefined : marsBotCorpInfo(id).cubeLegend?.[cubeType];
      return key === undefined ? undefined : translateText(key);
    },
    cubeLabel(cubeType: MarsBotCubeType): string {
      switch (cubeType) {
      case 'white': return translateText('White cube');
      case 'black': return translateText('Black cube');
      default: return translateText('Credit token');
      }
    },
    hintFor(cell: TrackCell, trackIndex: number): string {
      if (cell.regressed) {
        return translateText('Regressed — this action will not trigger again');
      }
      const parts: Array<string> = [];
      if (cell.action !== undefined && !cell.current) {
        const label = trackActionLabel(cell.action);
        parts.push(translateTextWithParams(label.message, label.params));
      }
      if (cell.cube !== undefined) {
        const legend = this.legendText(cell.cube.cubeType);
        parts.push(legend !== undefined ?
          `${this.cubeLabel(cell.cube.cubeType)} — ${legend}` :
          this.cubeLabel(cell.cube.cubeType));
        if (cell.cube.spent) {
          parts.push(translateText('This cube has already been used'));
        }
      }
      const marker = this.markerLegendText;
      if (cell.current && marker !== undefined && this.whiteMarkerTracks.has(trackIndex)) {
        parts.push(`${translateText('White tracker')} — ${marker}`);
      }
      return parts.join(' · ');
    },
  },
  computed: {
    /** Tracks whose TRACKER the corporation's setup paints white (C04). */
    whiteMarkerTracks(): Set<number> {
      return new Set(this.corporation?.whiteMarkerTracks ?? []);
    },
    /** What those white trackers remind of, in the card's own words. */
    markerLegendText(): string | undefined {
      const id = this.corporation?.id;
      const key = id === undefined ? undefined : marsBotCorpInfo(id).markerLegend;
      return key === undefined ? undefined : translateText(key);
    },
    /** The corporation's cubes, grouped by the track they sit on. */
    cubesByTrack(): Map<number, Array<MarsBotCorpCubeModel>> {
      const map = new Map<number, Array<MarsBotCorpCubeModel>>();
      for (const cube of this.corporation?.cubes ?? []) {
        const list = map.get(cube.trackIndex);
        if (list === undefined) {
          map.set(cube.trackIndex, [cube]);
        } else {
          list.push(cube);
        }
      }
      return map;
    },
    /** One legend row per cube colour this corporation actually seeded, plus
     *  one for its white TRACKERS when it paints any. */
    legendRows(): Array<{key: string, cubeType?: MarsBotCubeType, marker?: boolean, text: string}> {
      const seeded = new Set((this.corporation?.cubes ?? []).map((c) => c.cubeType));
      const rows: Array<{key: string, cubeType?: MarsBotCubeType, marker?: boolean, text: string}> = [];
      for (const cubeType of ['white', 'black', 'credit'] as const) {
        if (!seeded.has(cubeType)) {
          continue;
        }
        const text = this.legendText(cubeType);
        if (text !== undefined) {
          rows.push({key: cubeType, cubeType, text});
        }
      }
      const marker = this.markerLegendText;
      if (marker !== undefined && this.whiteMarkerTracks.size > 0) {
        rows.push({key: 'marker', marker: true, text: marker});
      }
      return rows;
    },
    /**
     * The widest track's cell count — every row renders on the SAME grid
     * template (`--mb-cols` columns), so cell k sits in the same column in
     * every row and a shorter track (Venus, 13 cells) simply ends early
     * instead of stretching its cells wider.
     */
    maxCells(): number {
      return Math.max(1, ...this.tracks.map((t) => t.maxPosition + 1));
    },
  },
});
</script>
