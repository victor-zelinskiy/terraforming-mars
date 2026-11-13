<template>
  <div class="mb-tracks"
       :class="{'mb-tracks--large': large, 'mb-tracks--reminders': reminderColumns.size > 0}"
       :style="{'--mb-cols': maxCells}">
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
            'mb-cell--reminder': reminderColumns.has(cell.index),
            'mb-cell--threshold': cell.thresholds !== undefined,
          }"
          :data-threshold="cell.thresholds?.join(',')"
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
            <span v-else-if="glyphFor(cell).kind === 'colony'" class="mb-glyph mb-glyph--ma">◉<span v-if="colonyPrice(cell) !== undefined" class="mb-glyph__multi">−{{ colonyPrice(cell) }}</span></span>
            <span v-else-if="glyphFor(cell).kind === 'ma'" class="mb-glyph mb-glyph--ma">{{ maGlyph(cell) }}</span>
            <span v-else-if="glyphFor(cell).kind === 'token'" class="mb-glyph" :data-token-cell="tokenKind(cell)">
              <i class="mb-ico" :class="'mb-ico--' + tokenKind(cell)" aria-hidden="true"></i>
              <span v-if="tokenCount(cell) === 2" class="mb-glyph__multi">×2</span>
            </span>
          </template>
          <!-- The THRESHOLD a milestone of this game needs on this track (decision R6) — a kant on the cell, never a
               glow: the cell the bot must REACH to meet the criterion, the same number the player's row shows. -->
          <span v-if="cell.thresholds !== undefined" class="mb-cell__threshold" aria-hidden="true">🏆</span>
          <span v-if="cell.regressed" class="mb-cell__regress" aria-hidden="true">✕</span>
          <!-- A corporation CUBE seeded on this space (RB-B special cubes).
               Corner-pinned so the cell's own bonus glyph stays readable; a
               SPENT cube keeps its place as a hollow outline — the mark of a
               cube that has FIRED, whether it stayed on the mat or (C43)
               moved onto the corporation card. -->
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
          <!-- The corporation's SETUP put a reminder cube ABOVE a COLUMN
               (C29). The column itself is tinted on every row; the physical
               cube is drawn once, over the TOP row, which is where «above the
               column» actually is on a mat whose tracks are the rows. -->
          <span v-if="ti === 0 && reminderColumns.has(cell.index)"
                class="mb-cell__colcube" aria-hidden="true"></span>
        </div>
      </div>
      <div class="mb-track__pos">{{ track.position }}<span class="mb-track__pos-max">/{{ track.maxPosition }}</span></div>
    </div>
    <!-- The corporation's cube legend — what each colour does, in the printed
         card's own words, so a cube on the mat explains itself. -->
    <!-- The bot's TOKENS off its token cells (decision R8) — the count its «resources on cards» milestone reads. -->
    <div v-if="tokenRows.length > 0" class="mb-tokens">
      <span v-for="row in tokenRows" :key="row.kind" class="mb-tokens__item" :data-bot-tokens="row.kind">
        <i class="mb-ico" :class="'mb-ico--' + row.kind" aria-hidden="true"></i>
        <span class="mb-tokens__count">{{ row.count }}</span>
      </span>
    </div>
    <div v-if="legendRows.length > 0" class="mb-cubelegend">
      <div v-for="row in legendRows" :key="row.key" class="mb-cubelegend__row">
        <span v-if="row.marker" class="mb-cell__marker mb-cell__marker--legend" aria-hidden="true"></span>
        <span v-for="cubeType in row.cubeTypes" v-else :key="cubeType"
              class="mb-cell__cube" :class="'mb-cell__cube--' + cubeType" aria-hidden="true"></span>
        <span class="mb-cubelegend__text">{{ row.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/**
 * The MarsBot board tracks — one row per track: the identity TAGS on the
 * left, the printed cell strip (action icons, the bot's cube on the current
 * space, regressed-space markers) and the position readout. Reused by the
 * desktop bot-board overlay AND the console info-mode detail (`large`), so
 * the two presentations never diverge. Pure presentation over the SERVER
 * `MarsBotTrackModel` — no rules re-derived here.
 */
import {computed, PropType} from 'vue';
import {Color} from '@/common/Color';
import {Tag as CardTag} from '@/common/cards/Tag';
import {MarsBotCorpCubeModel, MarsBotCorpModel, MarsBotCubeType, marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {BotMilestoneThreshold, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {BotTokenKind} from '@/common/automa/AutomaTypes';
import {TrackCell, TrackActionGlyph, trackActionGlyph, trackActionLabel, trackCells} from './marsBotView';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import Tag from '@/client/components/Tag.vue';

defineOptions({name: 'MarsBotTracks'});
const props = defineProps({
  tracks: {type: Array as PropType<ReadonlyArray<MarsBotTrackModel>>, required: true},
  botColor: {type: String as PropType<Color>, required: true},
  /** TV-readable sizing for the console info mode. */
  large: {type: Boolean, default: false},
  /** The bot's corporation — its seeded cubes are drawn on the tracks
   *  (RB-B special cubes) and its legend explains them. */
  corporation: {type: Object as PropType<MarsBotCorpModel | undefined>, default: undefined},
  /** The game's milestone thresholds on the bot's tracks (decision R6 — `MarsBotModel.thresholds`). */
  thresholds: {type: Array as PropType<ReadonlyArray<BotMilestoneThreshold>>, default: () => []},
  /** The bot's tokens (decision R8 — `MarsBotModel.tokens`), present when its mat prints token cells. */
  tokens: {type: Object as PropType<Partial<Record<BotTokenKind, number>> | undefined>, default: undefined},
});

/** The bot's token counts, one row per kind its mat prints (decision R8). */
const tokenRows = computed((): Array<{kind: BotTokenKind, count: number}> => {
  if (props.tokens === undefined) {
    return [];
  }
  const kinds = new Set<BotTokenKind>();
  for (const track of props.tracks) {
    for (const action of track.layout) {
      if (action !== undefined && action !== null && action.startsWith('token')) {
        kinds.add(action.split('_')[1] as BotTokenKind);
      }
    }
  }
  return [...kinds].map((kind) => ({kind, count: props.tokens?.[kind] ?? 0}));
});
/** Tracks whose TRACKER the corporation's setup paints white (C04). */
const whiteMarkerTracks = computed((): Set<number> => {
  return new Set(props.corporation?.whiteMarkerTracks ?? []);
});
/** What those white trackers remind of, in the card's own words. */
const markerLegendText = computed((): string | undefined => {
  const id = props.corporation?.id;
  const key = id === undefined ? undefined : marsBotCorpInfo(id).markerLegend;
  return key === undefined ? undefined : translateText(key);
});
/**
 * COLUMNS the corporation's setup marked with a reminder cube (C29). A
 * column crosses every track, and the rows all share one grid template,
 * so a cell index IS the column — no board resolution needed, unlike the
 * per-track white markers above.
 */
const reminderColumns = computed((): Set<number> => {
  const id = props.corporation?.id;
  return new Set(id === undefined ? [] : marsBotCorpInfo(id).reminderColumns ?? []);
});
/** What those marked columns remind of, in the card's own words. */
const columnLegendText = computed((): string | undefined => {
  const id = props.corporation?.id;
  const key = id === undefined ? undefined : marsBotCorpInfo(id).columnLegend;
  return key === undefined ? undefined : translateText(key);
});
/** The corporation's cubes, grouped by the track they sit on. */
const cubesByTrack = computed((): Map<number, Array<MarsBotCorpCubeModel>> => {
  const map = new Map<number, Array<MarsBotCorpCubeModel>>();
  for (const cube of props.corporation?.cubes ?? []) {
    const list = map.get(cube.trackIndex);
    if (list === undefined) {
      map.set(cube.trackIndex, [cube]);
    } else {
      list.push(cube);
    }
  }
  return map;
});
/**
 * One legend row per printed MEANING — not per colour. Colours that share
 * a legend text share a row and show ALL their swatches (C30 seeds white
 * and black cubes for one sentence: there the colour is a component, not
 * a rule, and two identical rows would state a difference the card does
 * not print). Plus one row for the white TRACKERS when it paints any, and
 * one for the marked COLUMNS.
 */
const legendRows = computed((): Array<{key: string, cubeTypes?: Array<MarsBotCubeType>, marker?: boolean, text: string}> => {
  const seeded = new Set((props.corporation?.cubes ?? []).map((c) => c.cubeType));
  const rows: Array<{key: string, cubeTypes?: Array<MarsBotCubeType>, marker?: boolean, text: string}> = [];
  for (const cubeType of ['white', 'black', 'credit'] as const) {
    if (!seeded.has(cubeType)) {
      continue;
    }
    const text = legendText(cubeType);
    if (text === undefined) {
      continue;
    }
    const sameMeaning = rows.find((row) => row.cubeTypes !== undefined && row.text === text);
    if (sameMeaning?.cubeTypes !== undefined) {
      sameMeaning.cubeTypes.push(cubeType);
    } else {
      rows.push({key: cubeType, cubeTypes: [cubeType], text});
    }
  }
  const marker = markerLegendText.value;
  if (marker !== undefined && whiteMarkerTracks.value.size > 0) {
    rows.push({key: 'marker', marker: true, text: marker});
  }
  // …and one for the marked COLUMNS, which seed no cubes of their own and
  // so are never reached by the loop above (C29).
  const column = columnLegendText.value;
  if (column !== undefined && reminderColumns.value.size > 0) {
    rows.push({key: 'columns', cubeTypes: ['black'], text: column});
  }
  return rows;
});
/**
 * The widest track's cell count — every row renders on the SAME grid
 * template (`--mb-cols` columns), so cell k sits in the same column in
 * every row and a shorter track (Venus, 13 cells) simply ends early
 * instead of stretching its cells wider.
 */
const maxCells = computed((): number => {
  return Math.max(1, ...props.tracks.map((t) => t.maxPosition + 1));
});
function cellsFor(track: MarsBotTrackModel, trackIndex: number): Array<TrackCell> {
  return trackCells(track, cubesByTrack.value.get(trackIndex) ?? [], props.thresholds.filter((t) => t.trackIndex === trackIndex));
}
function glyphFor(cell: TrackCell): TrackActionGlyph {
  return cell.action !== undefined ? trackActionGlyph(cell.action) : {kind: 'advance'};
}
function trSteps(cell: TrackCell): number {
  const g = glyphFor(cell);
  return g.kind === 'tr' ? g.steps : 0;
}
function targetTag(cell: TrackCell): CardTag | undefined {
  const g = glyphFor(cell);
  if (g.kind !== 'tag') {
    return undefined;
  }
  return props.tracks[g.trackIndex]?.tags[0];
}
function paramIcon(cell: TrackCell): string {
  const g = glyphFor(cell);
  return g.kind === 'param' ? g.icon : 'temperature';
}
function paramCount(cell: TrackCell): number {
  const g = glyphFor(cell);
  return g.kind === 'param' ? g.count : 1;
}
function tileKind(cell: TrackCell): string {
  const g = glyphFor(cell);
  return g.kind === 'tile' ? g.tile : 'greenery';
}
function floaterCount(cell: TrackCell): number {
  const g = glyphFor(cell);
  return g.kind === 'floater' ? g.count : 1;
}
/** The M€ a colony cell charges once its colony is built (the fan-made Amazonis board's `colony5`). */
function colonyPrice(cell: TrackCell): number | undefined {
  const g = glyphFor(cell);
  return g.kind === 'colony' ? g.price : undefined;
}
function tokenKind(cell: TrackCell): BotTokenKind | undefined {
  const g = glyphFor(cell);
  return g.kind === 'token' ? g.token : undefined;
}
function tokenCount(cell: TrackCell): number {
  const g = glyphFor(cell);
  return g.kind === 'token' ? g.count : 0;
}
function maGlyph(cell: TrackCell): string {
  const g = glyphFor(cell);
  return g.kind === 'ma' && g.which === 'award' ? '🏅' : '🏆';
}
/** The printed meaning of a cube colour (the corporation's own words). */
function legendText(cubeType: MarsBotCubeType): string | undefined {
  const id = props.corporation?.id;
  const key = id === undefined ? undefined : marsBotCorpInfo(id).cubeLegend?.[cubeType];
  return key === undefined ? undefined : translateText(key);
}
function cubeLabel(cubeType: MarsBotCubeType): string {
  switch (cubeType) {
  case 'white': return translateText('White cube');
  case 'black': return translateText('Black cube');
  // 'credit' is the printed SILVER resource cube (C13) — the bot takes it
  // as M€ at its component value.
  default: return translateText('Silver resource cube');
  }
}
function hintFor(cell: TrackCell, trackIndex: number): string {
  if (cell.regressed) {
    return translateText('Regressed — this action will not trigger again');
  }
  const parts: Array<string> = [];
  if (cell.action !== undefined && !cell.current) {
    const label = trackActionLabel(cell.action);
    parts.push(translateTextWithParams(label.message, label.params));
  }
  if (cell.cube !== undefined) {
    const legend = legendText(cell.cube.cubeType);
    parts.push(legend !== undefined ?
      `${cubeLabel(cell.cube.cubeType)} — ${legend}` :
      cubeLabel(cell.cube.cubeType));
    if (cell.cube.spent) {
      parts.push(translateText('This cube has already been used'));
    }
  }
  const marker = markerLegendText.value;
  if (cell.current && marker !== undefined && whiteMarkerTracks.value.has(trackIndex)) {
    parts.push(`${translateText('White tracker')} — ${marker}`);
  }
  const column = columnLegendText.value;
  if (column !== undefined && reminderColumns.value.has(cell.index)) {
    parts.push(`${translateText('Marked column')} — ${column}`);
  }
  for (const milestone of cell.thresholds ?? []) {
    parts.push(translateTextWithParams('The bot meets ${0} here', [translateText(milestone)]));
  }
  return parts.join(' · ');
}
</script>
