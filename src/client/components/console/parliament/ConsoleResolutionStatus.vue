<template>
  <!-- THE RESOLUTION'S STANDING in the fullscreen viewer's command bar
       (Turmoil Redux) — two facts, told apart on purpose (one line each):
         · WHERE THE CARD STANDS: up for the vote (and whether it is winning
           right now) or enacted;
         · THE VIEWER'S ACCESS TO ITS PARTY'S EFFECT: a compact indicator of
           the viewer's OWN delegates toward the threshold (two places, the
           player's cubes), and one word — held / not held / everyone's.
       Two delegates grant the PARTY effect; the resolution's own effect
       needs the enactment, which is why the chip names the party effect and
       never a bare «effect». Read-only: no focus stop, no verb.

       Each line is ONE grid cell: the live line and, invisible under it, the
       same line of every other card the viewer pages through (`reserve`). The
       chip therefore takes the widest REAL variant of this context — paging
       never resizes it and never moves the verbs beside it. -->
  <span class="con-rstatus" :data-lifecycle="status.lifecycle" :data-access="accessKindOf(status)" :data-mine="status.access?.mine ?? ''">
    <span class="con-rstatus__cell">
      <span v-for="(entry, i) in entries" :key="'life-' + i"
            class="con-rstatus__life"
            :class="['con-rstatus__life--' + entry.lifecycle, {'con-rstatus__sizer': i > 0}]"
            :aria-hidden="i > 0 ? 'true' : undefined">
        <span class="con-rstatus__life-mark" aria-hidden="true"></span>
        <span class="con-rstatus__life-text">{{ $t(entry.lifecycle === 'enacted' ? 'Enacted' : 'Up for the vote') }}</span>
        <span v-if="entry.winning" class="con-rstatus__life-tail">· {{ $t('Winning') }}</span>
      </span>
    </span>
    <span v-if="status.access !== undefined" class="con-rstatus__cell">
      <template v-for="(entry, i) in entries" :key="'access-' + i">
        <span v-if="entry.access !== undefined"
              class="con-rstatus__access"
              :class="['con-rstatus__access--' + accessKindOf(entry), {'con-rstatus__sizer': i > 0}]"
              :aria-hidden="i > 0 ? 'true' : undefined">
          <span class="con-rstatus__access-key">{{ $t('Party effect') }}</span>
          <!-- The threshold indicator: two places, the viewer's own cubes in the
               filled ones — never a count of every delegate (three own delegates
               still show a full pair). Hidden where the count is not what decides.
               A place is a fixed box, so a reserve line needs no cube inside. -->
          <span v-if="entry.access.places && viewerColor !== undefined" class="con-rstatus__places" aria-hidden="true">
            <span v-for="n in entry.access.threshold" :key="n" class="con-rstatus__place" :class="{'con-rstatus__place--on': n <= entry.access.mine}">
              <PlayerCube v-if="i === 0 && n <= entry.access.mine" :color="viewerColor" :size="cubePx" :glow="false" :shadow="false" />
            </span>
            <span class="con-rstatus__count">{{ Math.min(entry.access.mine, entry.access.threshold) }}/{{ entry.access.threshold }}</span>
          </span>
          <span class="con-rstatus__access-val">{{ accessTextOf(entry) }}</span>
          <span v-if="basisTextOf(entry) !== undefined" class="con-rstatus__access-basis">· {{ basisTextOf(entry) }}</span>
        </span>
      </template>
    </span>
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
    /**
     * The standing of every OTHER card the viewer pages through — laid out
     * invisibly under the live lines, so the chip is sized once for the whole
     * context (never for a variant that cannot occur here).
     */
    reserve: {type: Array as PropType<ReadonlyArray<ResolutionStatusVm>>, default: () => []},
  },
  computed: {
    /** The live standing first, then the reserve. */
    entries(): ReadonlyArray<ResolutionStatusVm> {
      return [this.status, ...this.reserve];
    },
    cubePx(): number {
      return Math.round(11 * conUiScale());
    },
  },
  methods: {
    accessKindOf(status: ResolutionStatusVm): string {
      return status.access?.kind ?? 'none';
    },
    accessTextOf(status: ResolutionStatusVm): string {
      switch (status.access?.kind) {
      case 'everyone': return translateText('for every player');
      case 'held': return translateText('available to you');
      default: return translateText('not available to you');
      }
    },
    /** The live basis of a held effect — one short tail, only where it is not the places themselves. */
    basisTextOf(status: ResolutionStatusVm): string | undefined {
      const access = status.access;
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
