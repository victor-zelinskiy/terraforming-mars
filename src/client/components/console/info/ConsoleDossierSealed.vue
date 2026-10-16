<template>
  <!--
    THE SEALED SCORE (TR60, decision 7a): another seat's score that the game's options keep hidden is a SEALED CELL at
    the scene's scale — the award shield under its seal, the one sentence of what is sealed and WHY (the game's
    settings, never a bare «hidden») — and, beside it, what that seat has already put ON THE TABLE for everybody: its
    rating (the rail prints it), the milestones it claimed and the awards it funded (the strategy rail shows them), as
    objects. Not one VP number, no total, no share: `vpVisible` is the only gate and it said no; the facts here are
    `dossierSealedFacts`, which reads no score at all.
  -->
  <div class="con-dsealed" data-dossier-sealed>
    <div class="con-dsealed__cell">
      <span class="con-dsealed__seal" aria-hidden="true">
        <ConsoleVpBadge class="con-dsealed__shield" :label="$t('VP')" />
        <span class="con-dsealed__lock"><PrivateScoreMask /></span>
      </span>
      <span class="con-dsealed__title">{{ $t('The score opens at the final scoring') }}</span>
      <span class="con-dsealed__why">{{ $t('The game settings keep other players\' points hidden until the end') }}</span>
    </div>
    <div class="con-dsealed__public" data-dossier-public>
      <span class="con-dsealed__kicker">{{ $t('Already on the table') }}</span>
      <div class="con-dsealed__facts">
        <div class="con-dsealed__fact" data-dossier-public-fact="rating">
          <span class="con-dsealed__disc"><i class="con-dsealed__glyph" :class="iconClass('tr')" aria-hidden="true"></i></span>
          <b class="con-dsealed__value">{{ facts.rating }}</b>
          <span class="con-dsealed__label">{{ $t('TR') }}</span>
        </div>
        <div class="con-dsealed__fact" data-dossier-public-fact="milestones">
          <span class="con-dsealed__disc con-dsealed__disc--ma">
            <img v-for="m in facts.milestones.slice(0, 3)" :key="m.slug" class="con-dsealed__emblem" :src="maArt(m.slug)" :alt="$t(m.name)" />
            <i v-if="facts.milestones.length === 0" class="con-dsealed__glyph con-dsealed__glyph--none" aria-hidden="true"></i>
          </span>
          <b class="con-dsealed__value">{{ facts.milestones.length }}</b>
          <span class="con-dsealed__label">{{ $t('Milestones') }}</span>
        </div>
        <div class="con-dsealed__fact" data-dossier-public-fact="awards">
          <span class="con-dsealed__disc con-dsealed__disc--ma">
            <img v-for="a in facts.awards.slice(0, 3)" :key="a.slug" class="con-dsealed__emblem" :src="maArt(a.slug)" :alt="$t(a.name)" />
            <i v-if="facts.awards.length === 0" class="con-dsealed__glyph con-dsealed__glyph--none" aria-hidden="true"></i>
          </span>
          <b class="con-dsealed__value">{{ facts.awards.length }}</b>
          <span class="con-dsealed__label">{{ $t('Awards') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {DossierSealedFacts} from '@/client/console/infoDossierModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import PrivateScoreMask from '@/client/components/overview/PrivateScoreMask.vue';

export default defineComponent({
  name: 'ConsoleDossierSealed',
  components: {ConsoleVpBadge, PrivateScoreMask},
  props: {
    facts: {type: Object as PropType<DossierSealedFacts>, required: true},
  },
  methods: {
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    maArt(slug: string): string {
      return `assets/ma/${slug}.png`;
    },
  },
});
</script>
