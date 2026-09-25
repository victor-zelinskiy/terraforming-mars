<template>
  <!--
    THE LEDGER OF OUTCOMES — the vote panel's row of chips (Turmoil Redux).

    One chip per participating seat: the seat's cube and, beside it, what THIS
    card would pay THAT seat at THEIR influence right now. It is the answer to
    «who does this favour» in zero presses — the other half of the vote, which
    the one-number panel above deliberately does not ask.

    IT IS NUMBERS, NOT A SECOND READING: no kicker, no captions, no «if you
    win» (a scenario belongs to the full reading), and the only word on the
    whole row is «вы» on the viewer's own chip, which stands first. Nothing is
    computed here — `voteLedgerModel.ts` decides, this draws.
  -->
  <div v-if="chips.length > 0" class="con-vledger" data-parl-vote-ledger-row>
    <span v-for="chip in chips" :key="chip.color"
          class="con-vledger__chip"
          :class="{'con-vledger__chip--you': chip.you, 'con-vledger__chip--subject': chip.color === subject}"
          :data-ledger-seat="chip.color"
          :data-ledger-you="chip.you ? 'true' : undefined"
          :data-ledger-subject="chip.color === subject ? 'true' : undefined">
      <PlayerCube :color="chip.color" :size="cube" :glow="false" />
      <span v-if="chip.you" class="con-vledger__you">{{ $t(youWord) }}</span>
      <!-- A seat this card does nothing for says so with a dash — never an empty cube the eye reads as «unknown». -->
      <span v-if="chip.parts.length === 0" class="con-vledger__none" aria-hidden="true">—</span>
      <span v-for="part in chip.parts" :key="part.key"
            class="con-vledger__part"
            :class="'con-vledger__part--' + part.tone"
            :data-ledger-part="part.key"
            :data-ledger-amount="part.amount"
            :data-ledger-tone="part.tone">
        <b v-if="text(part) !== ''">{{ text(part) }}</b>
        <i v-if="part.kind === 'tile'" class="con-vledger__tile" aria-hidden="true"></i>
        <ConsoleYieldUnit v-if="part.icon !== undefined" :classes="iconClasses(part.icon)" />
      </span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {YieldIcon, yieldIconClasses} from '@/client/console/parliament/influenceYieldModel';
import {LedgerChipVm, LedgerPart, ledgerPartText} from '@/client/console/parliament/voteLedgerModel';
import ConsoleYieldUnit from '@/client/components/console/parliament/ConsoleYieldUnit.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';

/** The one word the row prints — the viewer's own chip (the same key the facts use for the viewer). */
const YOU_WORD = 'you';

export default defineComponent({
  name: 'ConsoleVoteLedger',
  components: {ConsoleYieldUnit, PlayerCube},
  props: {
    chips: {type: Array as PropType<ReadonlyArray<LedgerChipVm>>, required: true},
    /**
     * WHOSE chip the big reading above is currently about — the cursor of the
     * bumpers, marked here so the row and the block can never say two different
     * things about whose number is on screen.
     */
    subject: {type: String as PropType<Color | undefined>, default: undefined},
    /** The cube's logical size (the host's own scale — 11 px beside a compact reading). */
    cubeLogicalPx: {type: Number, default: 11},
  },
  computed: {
    youWord(): string {
      return YOU_WORD;
    },
    cube(): number {
      return conLogicalPx(this.cubeLogicalPx);
    },
  },
  methods: {
    text(part: LedgerPart): string {
      return ledgerPartText(part);
    },
    iconClasses(icon: YieldIcon): Array<string> {
      return yieldIconClasses(icon);
    },
  },
});
</script>
