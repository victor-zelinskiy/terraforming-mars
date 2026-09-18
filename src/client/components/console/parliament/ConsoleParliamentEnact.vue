<template>
  <!-- ══ THE ENACTMENT (Turmoil Redux) — the political phase pays the enacted
       resolution's effect and asks THIS seat where its share goes. ALWAYS
       MOUNTED (the vote layer's law): the press builds nothing, and the
       teleport targets exist from the first frame. One scene over the field:
       the ENACTED CARD itself (carried from the government) with the payout
       reading under it — influence → the server's own amount — and the
       SHARED recipient picker in its own zone (the very `ConsoleTaskHost`
       every add-resource prompt uses, teleported by the shell). The crumb
       names the stage; nothing here titles itself. B minimizes the whole
       workspace (the hosted picker's own verb). ══ -->
  <div class="con-parl__enact"
       :class="{'con-parl__enact--up': enactUp}"
       :style="{'--parl-accent': view.enacted !== undefined ? partyAccent(view.enacted.party) : undefined}"
       :aria-hidden="enactUp ? undefined : 'true'"
       data-parl-enact>
    <div class="con-parl__enact-hero">
      <div class="con-parl__enact-card" data-parl-enact-hero></div>
      <ConsoleInfluenceYield v-if="enactYields.length > 0" class="con-parl__enact-yield" :yields="enactYields" size="hero" data-parl-enact-yield data-parl-enact-item />
      <ConsolePartyReaction v-for="r in enactReactions" :key="r.reaction.id"
                            class="con-parl__enact-reaction"
                            :reading="r"
                            size="normal"
                            data-parl-enact-reaction
                            data-parl-enact-item />
    </div>
    <div class="con-parl__enact-zone" data-parl-enact-item>
      <div class="con-parl__embed con-parl__embed--enact" data-embed-slot="parliament-enact"></div>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';
import {partyAccent} from '@/client/components/premiumCard/partyEmblems';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {enactedYieldsOf, resolvingYieldOf, scaledEffectForCardResource} from '@/client/console/parliament/influenceYieldModel';
import {PartyReactionReading, partyReactionsOf, viewerHasSeat} from '@/client/console/parliament/partyReactionModel';
import {ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';

/**
 * The ENACTMENT layer — the payout stage's hero column (the carried card's
 * slot, the reading, the ruling party's answer) and the recipient zone the
 * shell teleports the shared picker / the take surface into. The stage's
 * opening and folding are the section's (they move the stage machine); this
 * layer only reads the live ask.
 */
export default defineComponent({
  name: 'ConsoleParliamentEnact',
  components: {ConsoleInfluenceYield, ConsolePartyReaction},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** THE ENACTED RESOLUTION'S LIVE ASK for this seat (the section's own marker-based read), or undefined. */
    prompt: {type: Object as PropType<PlayerInputModel | undefined>, default: undefined},
  },
  computed: {
    /** The ENACTMENT layer stands over the field (the payout). */
    enactUp(): boolean {
      return parliamentFlow.stage === 'enact';
    },
    /**
     * THE PAYOUT ON THE STAGE. A card-resource pick states the SERVER's own
     * amount (the pick's own marker); every other ask — a chained effect whose
     * halves are already recorded (Climate Research's raise and its draw) —
     * reads the phase's OWN outcomes for this seat, so the stage shows the
     * fixed parameters of the chain being resolved and never re-adds the
     * influence to a production the server has already raised.
     */
    enactYields(): Array<InfluenceYield> {
      const wf = this.prompt as SelectCardModel | undefined;
      const id = wf?.choiceContext?.source?.resolution;
      if (id === undefined) {
        return [];
      }
      const resolution = getResolution(id);
      const meta = wf?.resourceGainPrompt;
      if (meta !== undefined) {
        const effect = scaledEffectForCardResource(resolution, meta.cardResource);
        if (effect !== undefined) {
          return [resolvingYieldOf(effect, meta.amount, this.model, this.viewerColor)];
        }
      }
      return resolution === undefined ? [] : enactedYieldsOf(resolution, this.model, this.viewerColor, {live: true});
    },
    /** …and the ruling party's answer to it, on the same stage. */
    enactReactions(): Array<PartyReactionReading> {
      const id = (this.prompt as SelectCardModel | undefined)?.choiceContext?.source?.resolution;
      return id === undefined ? [] : this.reactionsFor(getResolution(id), this.enactYields);
    },
  },
  methods: {
    partyAccent(party: ReduxParty): string {
      return partyAccent(party);
    },
    /**
     * The ruling party's answer to a resolution's readings — only for a seat
     * that takes part (a spectator is told nothing about a table they are not
     * at), and only where the party's DECLARED reaction says there is one.
     */
    reactionsFor(resolution: IClientResolution | undefined, yields: ReadonlyArray<InfluenceYield>): Array<PartyReactionReading> {
      return viewerHasSeat(this.model, this.viewerColor) ? partyReactionsOf(resolution, yields) : [];
    },
  },
});
</script>
