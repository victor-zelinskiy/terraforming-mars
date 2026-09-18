<template>
  <!--
    THE RULING PARTY'S ANSWER (Turmoil Redux) — one graphic row for what the
    resolution's own party pays ON TOP of the resolution's effect, wherever a
    surface states the effect: the vote surface's own-effect block, the
    enactment stage, the fullscreen inspector's footer, the playground.

    It stands APART from the influence readings, and it says WHOSE rule it is
    (the party's emblem + name), because the two are different laws: the
    numbers above are the card's, this one belongs to the government the card
    brings to power. Enacting the card IS what puts that party in power, so
    the answer counts even while another party rules right now — the caption
    is what states which moment the number belongs to.

    Nothing here computes: the reading arrives from `partyReactionModel.ts`,
    built from the party's DECLARED reactions — the same rule the live hook
    pays by.
  -->
  <div class="con-preact"
       :class="['con-preact--' + size, 'con-preact--' + reading.moment]"
       data-party-reaction
       :data-reaction-party="reading.party"
       :data-reaction-moment="reading.moment"
       :data-reaction-units="reading.units"
       :data-reaction-amount="reading.amount">
    <span class="con-preact__who">
      <img class="con-preact__emblem" :src="emblemUrl" alt="" />
      <b class="con-preact__party">{{ $t(reading.party) }}</b>
    </span>
    <span class="con-preact__body">
      <!-- «+2 [M€ production]» — the gain in the game's own production frame,
           never a bare number and never the cash sprite. -->
      <b class="con-preact__amount">+{{ reading.amount }}</b>
      <i class="con-preact__unit" :class="gainClass" aria-hidden="true"></i>
      <span class="con-preact__per">
        <span class="con-preact__slash" aria-hidden="true">/</span>
        <i class="con-preact__unit con-preact__unit--trigger" :class="triggerClass" aria-hidden="true"></i>
      </span>
    </span>
    <!-- The moment's caption — off where the host's own heading already says
         it (the vote panel's «for you when enacted» kicker): the emblem and
         the name still say whose rule pays. -->
    <span v-if="withCaption" class="con-preact__caption" data-reaction-caption>{{ caption }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PartyReactionReading, reactionCaptionOf, reactionGainIcon, reactionTriggerIcon} from '@/client/console/parliament/partyReactionModel';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsolePartyReaction',
  props: {
    reading: {type: Object as PropType<PartyReactionReading>, required: true},
    /** `compact` under a dock / in a block, `normal` on a stage. */
    size: {type: String as PropType<'compact' | 'normal'>, default: 'compact'},
    /** Print the moment's caption (off inside a block whose own kicker states the moment). */
    withCaption: {type: Boolean, default: true},
  },
  computed: {
    emblemUrl(): string {
      return partyEmblemUrl(this.reading.party);
    },
    gainClass(): string {
      const icon = reactionGainIcon(this.reading.reaction);
      return iconClassFor(icon.resource) + (icon.production ? ' con-preact__unit--prod' : '');
    },
    /** What it ANSWERED («per heat production step») — the reading's own trigger, never the first of a list. */
    triggerClass(): string {
      const icon = reactionTriggerIcon(this.reading);
      return iconClassFor(icon.resource) + (icon.production ? ' con-preact__unit--prod' : '');
    },
    caption(): string {
      return translateText(reactionCaptionOf(this.reading));
    },
  },
});
</script>
