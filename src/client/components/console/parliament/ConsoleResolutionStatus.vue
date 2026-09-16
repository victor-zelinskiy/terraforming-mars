<template>
  <!-- THE RESOLUTION'S STANDING in the fullscreen viewer's command bar
       (Turmoil Redux) — two facts, told apart on purpose:
         · WHERE THE CARD STANDS: up for the vote (and whether it is winning
           right now) or enacted;
         · THE VIEWER'S ACCESS TO ITS PARTY'S EFFECT: a compact indicator of
           the viewer's OWN delegates toward the threshold (two places, the
           player's cubes), and one word — held / not held / everyone's.
       Two delegates grant the PARTY effect; the resolution's own effect
       needs the enactment, which is why the chip names the party effect and
       never a bare «effect». Read-only: no focus stop, no verb. -->
  <span class="con-rstatus" :data-lifecycle="status.lifecycle" :data-access="accessKind" :data-mine="status.access?.mine ?? ''">
    <span class="con-rstatus__life" :class="'con-rstatus__life--' + status.lifecycle">
      <span class="con-rstatus__life-mark" aria-hidden="true"></span>
      <span class="con-rstatus__life-text">{{ $t(status.lifecycle === 'enacted' ? 'Enacted' : 'Up for the vote') }}</span>
      <span v-if="status.winning" class="con-rstatus__life-tail">· {{ $t('winning now') }}</span>
    </span>
    <template v-if="status.access !== undefined">
      <span class="con-rstatus__sep" aria-hidden="true"></span>
      <span class="con-rstatus__access" :class="'con-rstatus__access--' + accessKind">
        <span class="con-rstatus__access-key">{{ $t('Party effect') }}</span>
        <!-- The threshold indicator: two places, the viewer's own cubes in the
             filled ones — never a count of every delegate (three own delegates
             still show a full pair). Hidden where the count is not what decides. -->
        <span v-if="status.access.places && viewerColor !== undefined" class="con-rstatus__places" aria-hidden="true">
          <span v-for="n in status.access.threshold" :key="n" class="con-rstatus__place" :class="{'con-rstatus__place--on': n <= status.access.mine}">
            <PlayerCube v-if="n <= status.access.mine" :color="viewerColor" :size="cubePx" :glow="false" :shadow="false" />
          </span>
          <span class="con-rstatus__count">{{ Math.min(status.access.mine, status.access.threshold) }}/{{ status.access.threshold }}</span>
        </span>
        <span class="con-rstatus__access-val">{{ accessText }}</span>
        <span v-if="basisText !== undefined" class="con-rstatus__access-basis">· {{ basisText }}</span>
      </span>
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {ResolutionStatusVm} from '@/client/console/parliament/resolutionInspectModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleResolutionStatus',
  components: {PlayerCube},
  props: {
    status: {type: Object as PropType<ResolutionStatusVm>, required: true},
    /** The viewer's colour — their own cubes in the places. */
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  },
  computed: {
    accessKind(): string {
      return this.status.access?.kind ?? 'none';
    },
    cubePx(): number {
      return Math.round(11 * conUiScale());
    },
    accessText(): string {
      switch (this.status.access?.kind) {
      case 'everyone': return translateText('for every player');
      case 'held': return translateText('available to you');
      default: return translateText('not available to you');
      }
    },
    /** The live basis of a held effect — one short tail, only where it is not the places themselves. */
    basisText(): string | undefined {
      const access = this.status.access;
      if (access === undefined || access.kind !== 'held') {
        return undefined;
      }
      switch (access.basis) {
      case 'ruling': return translateText('the party rules');
      case 'granted': return translateText('granted by a card');
      default: return undefined;
      }
    },
  },
});
</script>
