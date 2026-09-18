<template>
  <div class="con-parl__parties" data-parl-parties>
    <div v-for="(p, i) in view.parties" :key="p.party"
         class="con-parl__party"
         :class="[
           'con-parl__party--' + partyStates[i].kind,
           {
             'con-parl__party--focus': flow.zone === 'parties' && flow.partyIndex === i && flow.stage === 'browse',
             'con-parl__party--held': partyStates[i].held,
             'con-parl__party--recap': flow.stage === 'recap' && recapHighlight === 'support' && recapParties.includes(p.party),
             'con-parl__party--pulse': accessPulse === p.party || usedPulse === p.party,
             'con-parl__party--lost': accessLost === p.party,
           },
         ]"
         :data-party="p.party"
         :data-party-state="partyStates[i].kind"
         :data-action-state="partyActionStates[i].kind">
      <ConsolePartyPlaque :party="p.party"
                          size="tile"
                          :state="partyStates[i]"
                          :actionState="partyActionStates[i]"
                          :support="supportShown(p)"
                          :viewerColor="viewerColor"
                          :formula="true"
                          :focused="flow.zone === 'parties' && flow.partyIndex === i && flow.stage === 'browse'"
                          :reason="flow.zone === 'parties' && flow.partyIndex === i && flow.stage === 'browse' ? partyLine : ''"
                          :reasonTone="partyLineTone" />
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {ParliamentPartyVm, PartyActionStateVm, PartyStateVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';

/**
 * The PARTIES tier: six plaques whose centre is their printed mechanic, with
 * the viewer's access state, the focused party's one-line reason, and the
 * pulses of an access gained, lost or a party action used this generation.
 */
export default defineComponent({
  name: 'ConsoleParliamentParties',
  components: {ConsolePartyPlaque},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    partyStates: {type: Array as PropType<ReadonlyArray<PartyStateVm>>, required: true},
    partyActionStates: {type: Array as PropType<ReadonlyArray<PartyActionStateVm>>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    awaitingInput: {type: Boolean, default: false},
    /** The results scene's current focus ('' outside the scene) and the parties its support beat names. */
    recapHighlight: {type: String, default: ''},
    recapParties: {type: Array as PropType<ReadonlyArray<ReduxParty>>, default: () => []},
  },
  data() {
    return {
      accessPulse: undefined as ReduxParty | undefined,
      accessLost: undefined as ReduxParty | undefined,
      accessTimer: undefined as number | undefined,
      usedPulse: undefined as ReduxParty | undefined,
      usedTimer: undefined as number | undefined,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    partyLine(): string {
      if (parliamentFlow.zone !== 'parties') {
        return '';
      }
      const state = this.partyActionStates[parliamentFlow.partyIndex];
      if (state === undefined) {
        return '';
      }
      switch (state.kind) {
      case 'used': return translateText('Action used this generation');
      case 'blocked': return state.reason !== undefined ? this.reasonText(state.reason) : translateText('Unavailable right now');
      case 'not-now': return translateText(this.awaitingInput ? 'Finish your current action first' : 'Not your turn — you can read the Parliament');
      // No access: a party IN the vote says it by its places (0/2) — a party
      // outside the vote has no places, so its foot says the server's reason.
      case 'no-access': return this.partyStates[parliamentFlow.partyIndex]?.kind === 'absent' && state.reason !== undefined ? this.reasonText(state.reason) : '';
      default: return '';
      }
    },
    partyLineTone(): 'dim' | 'warn' {
      const state = this.partyActionStates[parliamentFlow.partyIndex];
      return state?.kind === 'blocked' ? 'warn' : 'dim';
    },
    accessKey(): string {
      return (this.view.viewer?.access ?? []).filter((a) => a.hasEffect).map((a) => a.party).join('|');
    },
    usedKey(): string {
      return this.view.parties.filter((_, i) => this.partyActionStates[i]?.kind === 'used').map((p) => p.party).join('|');
    },
  },
  watch: {
    accessKey(now: string, was: string): void {
      const before = new Set(was.split('|').filter((s) => s !== ''));
      const after = new Set(now.split('|').filter((s) => s !== ''));
      const gained = [...after].find((p) => !before.has(p)) as ReduxParty | undefined;
      const lost = [...before].find((p) => !after.has(p)) as ReduxParty | undefined;
      this.accessPulse = gained;
      this.accessLost = lost;
      if (this.accessTimer !== undefined) {
        window.clearTimeout(this.accessTimer);
      }
      this.accessTimer = window.setTimeout(() => {
        this.accessPulse = undefined;
        this.accessLost = undefined;
        this.accessTimer = undefined;
      }, consoleMotionMs(1400));
    },
    usedKey(now: string, was: string): void {
      const before = new Set(was.split('|').filter((s) => s !== ''));
      const used = now.split('|').find((p) => p !== '' && !before.has(p)) as ReduxParty | undefined;
      if (used === undefined) {
        return;
      }
      this.usedPulse = used;
      if (this.usedTimer !== undefined) {
        window.clearTimeout(this.usedTimer);
      }
      this.usedTimer = window.setTimeout(() => {
        this.usedPulse = undefined;
        this.usedTimer = undefined;
      }, consoleMotionMs(1400));
    },
  },
  beforeUnmount() {
    for (const timer of [this.accessTimer, this.usedTimer]) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    }
  },
  methods: {
    /** A party's popular support as SHOWN — the results scene keeps the cubes on their places until they have physically left. */
    supportShown(p: ParliamentPartyVm): number {
      return Math.min(3, p.support + (parliamentHolds.support.get(p.party) ?? 0));
    },
    reasonText(reason: string | Message): string {
      return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
    },
  },
});
</script>
