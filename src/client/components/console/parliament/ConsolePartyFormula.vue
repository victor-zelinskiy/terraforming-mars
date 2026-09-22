<template>
  <!-- THE PARTY'S PRINTED FORMULA — the board banner's own graphic (the same
       render DSL nodes the premium face, the inspector and the action menu's
       tile draw), hosted outside a card. ONE drawing per party: nothing here
       composes a second formula that could drift from the face. The host
       decides the plate around it; this block decides only the graphic. -->
  <div class="con-pformula" :class="['con-pformula--' + size, {'con-pformula--dim': dim}]" :data-party="party">
    <img v-if="emblem" class="con-pformula__emblem" :src="emblemUrl" alt="" />
    <div class="con-pformula__mech" :class="{'con-pformula__mech--empty': mechanics.textOnly}">
      <PremiumMechanicsPanel v-if="!mechanics.textOnly" :mechanics="mechanics" />
      <span v-else class="con-pformula__none">{{ $t('No printed effect') }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {IClientPartyEffect} from '@/common/parliament/IClientResolution';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {PARLIAMENT_GRAPHIC} from '@/client/components/premiumCard/resolutionPremiumVm';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {partyFormulaRender} from '@/client/console/parliament/consoleParliamentModel';

export default defineComponent({
  name: 'ConsolePartyFormula',
  components: {PremiumMechanicsPanel},
  props: {
    party: {type: String as PropType<ReduxParty>, required: true},
    /** The effect to draw (defaults to the party's catalog entry). */
    effect: {type: Object as PropType<IClientPartyEffect | undefined>, default: undefined},
    /** Draw ONLY this root (the action rows alone — the action menu's tile). */
    renderRoot: {type: Object as PropType<ICardRenderRoot | undefined>, default: undefined},
    emblem: {type: Boolean, default: false},
    /** `compact` — a tile; `wide` — the detail zone / the inspector strip. */
    size: {type: String as PropType<'compact' | 'wide'>, default: 'wide'},
    /** The viewer does not hold this effect — the graphic recedes (colour + weight, never a filter). */
    dim: {type: Boolean, default: false},
  },
  computed: {
    resolvedEffect(): IClientPartyEffect | undefined {
      return this.effect ?? getPartyEffect(this.party);
    },
    mechanics(): MechanicsVM {
      const root = this.renderRoot ?? (this.resolvedEffect === undefined ? undefined : partyFormulaRender(this.resolvedEffect));
      return buildMechanics(root, PARLIAMENT_GRAPHIC);
    },
    emblemUrl(): string {
      return partyEmblemUrl(this.party);
    },
  },
});
</script>
