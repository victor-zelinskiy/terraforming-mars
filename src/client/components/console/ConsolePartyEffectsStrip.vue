<template>
  <!-- THE PARTY EFFECTS a seat holds (Turmoil Redux) — the Information
       workspace's «ЭФФЕКТЫ» zone shows them beside the card effects, in the
       same premium rendering the Parliament and the inspector use (the party
       banner as a face), each with WHY the seat holds it. Read-only: the
       inspector for a party is one X away in the Parliament. -->
  <section v-if="rows.length > 0" class="con-pfx" :aria-label="$t('Party effects')">
    <header class="con-pfx__head">
      <span class="con-pfx__kicker">{{ $t('Party effects') }}</span>
      <span class="con-pfx__sub">{{ $t('Held through the Mars Parliament — the ruling party and every party with two of this player\'s delegates') }}</span>
    </header>
    <div class="con-pfx__row">
      <div v-for="row in rows" :key="row.party" class="con-pfx__item" :data-party="row.party">
        <div class="con-pfx__face">
          <premium-card-face v-if="row.vm !== undefined" :vmOverride="row.vm" :lightweight="true" :inert="true" />
        </div>
        <div class="con-pfx__why">
          <b>{{ $t(row.party) }}</b>
          <span v-for="(reason, i) in row.reasons" :key="i" class="con-pfx__reason">{{ $t(reason) }}</span>
          <span v-if="row.action !== undefined" class="con-pfx__uses">{{ $t(row.action) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {partyEffectPremiumVmOf} from '@/client/components/premiumCard/resolutionPremiumVm';

type Row = {party: ReduxParty, vm: PremiumCardVM | undefined, reasons: Array<string>, action: string | undefined};

export default defineComponent({
  name: 'ConsolePartyEffectsStrip',
  props: {
    parliament: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    /** The seat whose effects are shown. */
    color: {type: String as PropType<Color>, required: true},
  },
  computed: {
    rows(): Array<Row> {
      const model = this.parliament;
      if (model === undefined) {
        return [];
      }
      const seat = model.players.find((p) => p.color === this.color);
      if (seat === undefined || !seat.participates) {
        return [];
      }
      const out: Array<Row> = [];
      for (const party of REDUX_PARTIES) {
        const access = seat.access.find((a) => a.party === party);
        if (access === undefined || !access.hasEffect) {
          continue;
        }
        const reasons: Array<string> = [];
        if (access.ruling) {
          reasons.push('Ruling party — every player has this effect');
        }
        if (access.byDelegates) {
          reasons.push('Two delegates on its resolution');
        }
        if (access.granted.length > 0) {
          reasons.push('Granted by a card');
        }
        const uses = seat.partyActionUses[party] ?? 0;
        const vm = partyEffectPremiumVmOf(party);
        const hasAction = ['Unity', 'Scientists', 'Industrialists', 'Reds'].includes(party);
        out.push({
          party,
          vm,
          reasons,
          action: hasAction ? (uses > 0 ? 'Action used this generation' : 'Action available this generation') : undefined,
        });
      }
      return out;
    },
  },
});
</script>
