<template>
  <span class="con-impact-rows" :class="'con-impact-rows--' + layout" data-impact-rows>
    <span v-for="(row, ri) in rows" :key="ri" class="con-impact-row"
          :class="{'con-impact-row--prod': row.prod}" :data-impact-scope="row.scope">
      <TagComponent v-if="row.tag !== undefined" :tag="row.tag" size="small" type="secondary" class="con-impact-row__tag" />
      <i v-else :class="row.iconClass" class="con-impact-row__icon" aria-hidden="true"></i>
      <span class="con-impact-row__num">{{ row.from }} → {{ row.to }}</span>
      <span v-if="row.steps !== undefined && row.steps > 0" class="con-impact-row__steps">−{{ row.steps }}</span>
    </span>
  </span>
</template>

<script setup vapor lang="ts">
/*
 * THE ONE RENDERER of a target's server rows (`TargetImpactChange` — `current → resulting`): a pill per row, the
 * resource icon or — for a MarsBot production hit — the TRACK's identity tag, the step count beside a production /
 * track row. The SAME layout for a human row and a bot's track row (the server decides what a row is; this never
 * branches on the bot). Hosts: the player target list (`ConsoleTaskHost`), the table-impact block of a play that
 * hits every opponent (`ConsoleTableImpact`).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import TagComponent from '@/client/components/Tag.vue';
import {Tag} from '@/common/cards/Tag';
import {TargetImpactChange} from '@/common/models/TargetImpactModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

type RowView = {scope: TargetImpactChange['scope'], tag?: Tag, iconClass: string, from: number, to: number, steps?: number, prod: boolean};

defineOptions({name: 'ConsoleTargetImpactRows'});
const props = defineProps({
  /** The server's rows, verbatim. */
  changes: {type: Array as PropType<ReadonlyArray<TargetImpactChange>>, required: true},
  /** `stack` — one pill under another (a list row's right edge); `line` — side by side (a one-line reading). */
  layout: {type: String as PropType<'stack' | 'line'>, default: 'stack'},
});

const rows = computed((): Array<RowView> => {
  return props.changes.map((r) => {
    const isTrack = r.scope === 'track';
    return {
      scope: r.scope,
      tag: isTrack ? (r.icon as Tag) : undefined,
      iconClass: isTrack ? '' : iconClassFor(r.icon) + ' con-task__opt-res',
      from: r.from,
      to: r.to,
      // The track's divisions are counted on the pill; a production row's «1 → 0» already says its step.
      steps: isTrack ? r.steps : undefined,
      // A production row and a track row (the bot's production) wear the production plate.
      prod: r.scope !== 'stock',
    };
  });
});
</script>
