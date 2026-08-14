<template>
  <div class="con-verdict" :class="reveal.conditionMet ? 'con-verdict--met' : 'con-verdict--miss'">
    <div class="con-verdict__head">
      <span class="con-verdict__badge" aria-hidden="true">{{ reveal.conditionMet ? '✓' : '✕' }}</span>
      <span class="con-verdict__title">{{ $t(reveal.conditionMet ? 'Condition met' : 'Condition not met') }}</span>
    </div>
    <!-- WHAT THE ACTION WAS LOOKING FOR, and whether the card had it. The
         ✓/✕ alone states the outcome without ever stating the RULE — «Условие
         не выполнено» is true of a card the player has never seen the check
         for. The tag icon is the same sprite the card face prints. -->
    <div v-if="reveal.check !== undefined" class="con-verdict__row">
      <span class="con-verdict__label">{{ $t('Checked') }}</span>
      <span class="con-verdict__value">
        <i v-if="checkIcon" class="con-verdict__tagicon" :style="{backgroundImage: 'url(' + checkIcon + ')'}"></i>
        <span>{{ $t(reveal.check.label) }}</span>
        <span class="con-verdict__found"
              :class="reveal.conditionMet ? 'con-verdict__found--yes' : 'con-verdict__found--no'">
          {{ $t(reveal.conditionMet ? 'found' : 'not found') }}
        </span>
      </span>
    </div>
    <!-- The REWARD — gained on a match, explicitly NOT received on a miss. A
         missing row would read as «nothing was at stake», which is the one
         thing the player most wants to know here (invariant: no silent loss). -->
    <div class="con-verdict__row">
      <span class="con-verdict__label">{{ $t('Reward') }}</span>
      <span class="con-verdict__value">
        <ActionEffectChip v-if="reveal.reward !== undefined" :effect="reveal.reward" />
        <span v-else class="con-verdict__none">{{ $t('Not received') }}</span>
      </span>
    </div>
    <div v-if="vpGain > 0" class="con-verdict__row">
      <span class="con-verdict__label">{{ $t('Victory points') }}</span>
      <span class="con-verdict__value"><span class="con-verdict__vp">+{{ vpGain }} {{ $t('VP') }}</span></span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {tagIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {RevealResultModel} from '@/common/models/RevealResultModel';

/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DECK-CHECK VERDICT PANEL — one component, every place a reveal result is
 * read (Search For Life / Asteroid Deflection System).
 *
 * WHY A COMPONENT. The verdict had TWO renderings that told the player
 * different amounts about the same event: the embedded workspace stage
 * («Действия карт › <карта> › РЕЗУЛЬТАТ ВСКРЫТИЯ») showed a single pill — a
 * ✓/✕ and four words — while the legacy standalone modal showed the full
 * breakdown: what was checked, whether it was found, what the reward was (or
 * that it was NOT received) and the VP delta. The embedded flow is the product;
 * it cannot be the poorer of the two, and a shared class would still leave two
 * markup trees to drift apart (every past divergence in this family was a
 * markup divergence, not a style one — see ConsoleWsStageHead).
 *
 * So the panel exists ONCE and both hosts mount it: the composer's reveal stage
 * and — until the stylesheet flip retires it — the standalone overlay. The host
 * owns the surrounding geometry (a reserved-width slot beside the revealed
 * card); this owns the content and the hierarchy.
 *
 * NAMES ITSELF NOTHING. There is no kicker and no heading of its own: inside a
 * workspace the stage is named by the breadcrumb, which is what keeps an
 * embedded surface from reading as a modal that arrived.
 */
export default defineComponent({
  name: 'ConsoleRevealVerdict',
  components: {ActionEffectChip},
  props: {
    reveal: {type: Object as PropType<RevealResultModel>, required: true},
  },
  computed: {
    /** The checked tag's icon URL ('' when the check is absent / iconless). */
    checkIcon(): string {
      const check = this.reveal.check;
      return check !== undefined ? tagIconUrl(check.tag) : '';
    },
    /**
     * The VP the source card GAINED. `to === from` (a match on an already-maxed
     * card) is deliberately not a row: «+0 ПО» is noise, and the reward row has
     * already said what happened.
     */
    vpGain(): number {
      const vp = this.reveal.vp;
      return vp !== undefined ? Math.max(0, vp.to - vp.from) : 0;
    },
  },
});
</script>
