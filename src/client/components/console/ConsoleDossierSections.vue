<template>
  <!--
    THE DOSSIER'S SECTIONS — ONE markup for every reading of the board column
    (TR67 «КЛЕТКА — ОДНО ДОСЬЕ»): the placement's sections (`placementDossier`)
    and the inspection's (`cellDossier`) are the same `DossierSection` shapes,
    so they render through the same heads, the same groups and the same rows —
    one rhythm, one chip, one type system in all four modes.
    A fragment: the host's `.con-context__body` / foot is the container.
    ⚠️ NO transition of any kind (the dossier law): only VALUES flick.
  -->
  <section v-for="section in sections" :key="section.key"
           class="con-context__sec" :class="'con-context__sec--' + section.key" :data-dossier-section="section.key">
    <h3 class="con-context__sec-head">
      <span>{{ $t(section.titleKey) }}</span>
      <!-- THE CELL'S OWN FORECAST — the sum of the rows below (placement's endgame block only). -->
      <span v-if="section.total !== undefined" :key="section.total" class="con-context__sec-total">
        {{ section.total < 0 ? '−' : '+' }}{{ Math.abs(section.total) }} <i>{{ $t('VP') }}</i>
      </span>
    </h3>
    <template v-if="section.groups !== undefined">
      <div v-for="group in section.groups" :key="group.key" class="con-context__grp">
        <div class="con-context__grp-head">
          <span v-if="groupDot(group) !== undefined" class="con-context__grp-dot"
                :class="'player_bg_color_' + groupDot(group)"></span>
          <span v-i18n>{{ groupLabel(group) }}</span>
        </div>
        <console-placement-fact-row v-for="row in group.rows" :key="row.key" :row="row" />
      </div>
    </template>
    <template v-else>
      <console-placement-fact-row v-for="row in section.rows" :key="row.key" :row="row" />
    </template>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsolePlacementFactRow from '@/client/components/console/ConsolePlacementFactRow.vue';
import {DossierRecipientGroup, DossierSection} from '@/client/console/placementDossier';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';

export default defineComponent({
  name: 'ConsoleDossierSections',
  components: {ConsolePlacementFactRow},
  props: {
    sections: {type: Array as PropType<ReadonlyArray<DossierSection>>, required: true},
    viewerColor: {type: String as PropType<Color>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  computed: {
    Math(): Math {
      return Math;
    },
  },
  methods: {
    groupDot(group: DossierRecipientGroup): Color | undefined {
      const r = group.recipient;
      if (r.kind === 'current-player') {
        return this.viewerColor;
      }
      if (r.kind === 'player' || r.kind === 'tile-owner') {
        return r.color;
      }
      return undefined;
    },
    groupLabel(group: DossierRecipientGroup): string {
      const r = group.recipient;
      switch (r.kind) {
      case 'current-player': return 'You';
      case 'player':
      case 'tile-owner': {
        // A colour with no seat behind it must never leak raw («NEUTRAL» over
        // a solo game's setup city) — name it through the i18n key.
        const name = displayNameForColor(this.players, r.color);
        return name === 'neutral' ? 'Neutral' : name;
      }
      case 'neutral': return 'Field rule';
      case 'nobody': return 'Reserved';
      }
    },
  },
});
</script>
