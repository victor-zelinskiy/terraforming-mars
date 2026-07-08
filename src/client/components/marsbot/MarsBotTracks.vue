<template>
  <div class="mb-tracks" :class="{'mb-tracks--large': large}" :style="{'--mb-cols': maxCells}">
    <div v-for="(track, ti) in tracks" :key="ti" class="mb-track">
      <div class="mb-track__id">
        <Tag v-for="tag in track.tags" :key="tag" :tag="tag" :size="large ? 'big' : 'med'" type="secondary" />
      </div>
      <div class="mb-track__cells">
        <div
          v-for="cell in cellsFor(track)"
          :key="cell.index"
          class="mb-cell"
          :class="{
            'mb-cell--current': cell.current,
            'mb-cell--passed': cell.index < track.position,
            'mb-cell--regressed': cell.regressed,
            'mb-cell--start': cell.index === 0,
          }"
          :data-hint="hintFor(cell)"
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
        </div>
      </div>
      <div class="mb-track__pos">{{ track.position }}<span class="mb-track__pos-max">/{{ track.maxPosition }}</span></div>
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
  },
  methods: {
    cellsFor(track: MarsBotTrackModel): Array<TrackCell> {
      return trackCells(track);
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
    hintFor(cell: TrackCell): string {
      if (cell.regressed) {
        return translateText('Regressed — this action will not trigger again');
      }
      if (cell.action !== undefined && !cell.current) {
        const label = trackActionLabel(cell.action);
        return translateTextWithParams(label.message, label.params);
      }
      return '';
    },
  },
  computed: {
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
