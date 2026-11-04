<template>
  <!-- «WHOM THE PLAY HITS» (P59 Recession) — a play that hits every opponent WITHOUT a choice shows them BEFORE the
       press (invariant 3): one quiet line per seat — the seat's dot and name, the server's `current → resulting` rows
       through the ONE row renderer, and a part the seat is spared NAMED in the near-miss grammar («✕ …», struck chip
       + its reason). Read-only: no cursor, no focus stop, no verb — the command bar is untouched. State by material
       (a dot, a hairline, a struck chip), never by light. -->
  <div class="con-tblimpact" :class="{'con-tblimpact--line': layout === 'line'}" data-table-impact role="list"
       :aria-label="$t(view.title)">
    <span class="con-tblimpact__head">{{ $t(view.title) }}</span>
    <span v-for="row in view.rows" :key="row.color" class="con-tblimpact__row" role="listitem"
          :data-table-impact-seat="row.color">
      <span :class="'con-status__dot player_bg_color_' + row.color" aria-hidden="true"></span>
      <span class="con-tblimpact__name">{{ row.name }}</span>
      <ConsoleTargetImpactRows v-if="row.changes.length > 0" :changes="row.changes" layout="line" />
      <span v-if="row.spared !== undefined" class="con-tblimpact__spared" data-table-impact-spared :data-spared-scope="row.spared.scope">
        <span class="con-tblimpact__spared-mark" aria-hidden="true">✕</span>
        <ActionEffectChip :effect="sparedChip(row.spared)" skipped />
        <span class="con-tblimpact__spared-reason">{{ $t(row.spared.reason) }}</span>
      </span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsoleTargetImpactRows from './ConsoleTargetImpactRows.vue';
import {TableImpactRowView, TableImpactView} from '@/client/console/tableImpact/tableImpactModel';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';

export default defineComponent({
  name: 'ConsoleTableImpact',
  components: {ConsoleTargetImpactRows, ActionEffectChip},
  props: {
    view: {type: Object as PropType<TableImpactView>, required: true},
    /** `rows` — a seat per line (a composer's block); `line` — every seat on ONE line (a status rail). */
    layout: {type: String as PropType<'rows' | 'line'>, default: 'rows'},
  },
  methods: {
    /** The spared part as the ONE struck-chip grammar (the skipped warning's own chip — never a second drawing). */
    sparedChip(spared: NonNullable<TableImpactRowView['spared']>): ActionEffect {
      return {direction: 'cost', icon: spared.icon, amount: spared.amount, note: spared.scope === 'production' ? 'production' : undefined};
    },
  },
});
</script>
