<template>
  <!-- THE PARTIES — every party is ONE DOM instance (the same tile chassis
       and size): the five OPPOSITION tiles stand in this row, the RULING
       party's tile is TELEPORTED into the government's ruler slot (v2). A
       change of government therefore never re-creates a tile: the new
       ruler's element rises into the slot, the old one comes back into the
       row — the director FLIPs both from where they stood. -->
  <div class="con-parl__parties" data-parl-parties>
    <template v-for="(p, i) in view.parties" :key="p.party">
      <Teleport defer to="[data-parl-ruler-slot]" :disabled="p.party !== rulerShown">
        <div class="con-parl__party"
             :class="[
               'con-parl__party--' + partyStates[i].kind,
               {
                 'con-parl__party--ruler': p.party === rulerShown,
                 'con-parl__party--focus': focusedIndex === i,
                 'con-parl__party--held': partyStates[i].held,
                 'con-parl__party--pulse': accessPulse === p.party || usedPulse === p.party,
                 'con-parl__party--lost': accessLost === p.party,
               },
             ]"
             :data-party="p.party"
             :data-party-state="partyStates[i].kind"
             :data-action-state="partyActionStates[i].kind"
             :data-parl-ruler-tile="p.party === rulerShown ? '' : undefined"
             @animationend="onPulseEnd($event, p.party)">
          <ConsolePartyPlaque :party="p.party"
                              size="tile"
                              :state="partyStates[i]"
                              :actionState="partyActionStates[i]"
                              :support="supportShown(p)"
                              :viewerColor="viewerColor"
                              :formula="true"
                              :focused="focusedIndex === i"
                              :ruling="p.party === rulerSettled"
                              :rulesByCard="rulerSettledByCard"
                              :roll="rollWord(p.party)"
                              :pick="pickOf(p.party)"
                              :supportOutgoing="outgoingOf(p.party, i)"
                              :supportCounted="rallyCountedPlaces(p.party)"
                              :reason="focusedIndex === i ? partyLine : ''"
                              :reasonTone="partyLineTone" />
        </div>
      </Teleport>
    </template>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {parliamentFlow, parliamentSupportUp} from '@/client/console/parliament/consoleParliamentFlow';
import {SupportPromptMeta} from '@/common/models/PlayerInputModel';
import {supportAreaOf} from '@/client/console/parliament/supportPickModel';
import {supportDiscardStanding} from '@/client/console/parliament/supportDiscard';
import {rallyCountedPlaces, rallySupportIncoming, rallySupportReading} from '@/client/console/parliament/neutralRally';
import {rivalSupportIncoming} from '@/client/console/parliament/parliamentRivalVotes';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {supportStatusKey} from '@/client/console/parliament/supportScene';
import {ParliamentPartyVm, PartyActionStateVm, PartyStateVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';

/**
 * The PARTIES tier: six tiles whose centre is their printed mechanic (the
 * ruler's teleported into the government), with the viewer's access state,
 * the focused party's one-line reason, and the pulses of an access gained,
 * lost or a party action used this generation.
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
    /**
     * THE SUPPORT-AREA MODE's projection (TR12 Party Sanctions — the server's six areas): every plaque reads
     * «N → 0» or its refusal, the focused candidate outlines the cubes that would leave. Undefined outside the mode.
     */
    supportMeta: {type: Object as PropType<SupportPromptMeta | undefined>, default: undefined},
  },
  data() {
    return {
      accessPulse: undefined as ReduxParty | undefined,
      accessLost: undefined as ReduxParty | undefined,
      usedPulse: undefined as ReduxParty | undefined,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    /**
     * THE ROLL CALL's word for a party (v3 В3): while the support scene names the parties, each tile says
     * WHY it stands where it stands, in its own reserved row — «принимается» / «не принята» /
     * «не на голосовании» / «правит». Empty outside the scene: the tile keeps its live state.
     */
    rollWord(): (party: ReduxParty) => string {
      const roll = parliamentHolds.rollStatus;
      return (party: ReduxParty) => {
        const status = roll.get(party);
        return status === undefined ? '' : translateText(supportStatusKey(status));
      };
    },
    /** THE RULER AS SHOWN: the previous ruling party until the enactment's beat has changed the plaques' places. */
    rulerShown(): ReduxParty {
      return parliamentHolds.rulerBefore ?? this.view.rulingParty;
    },
    /**
     * THE RULER AS SETTLED — which tile WEARS the ruler's state. `rulerShown` answers WHERE each tile
     * stands (the teleport must move a frame before the FLIP, or there is nothing to invert), and the two
     * answers differ for exactly the length of the swap: a plaque in the air still shows the state of the
     * place it left, and changes in the frame it ARRIVES in («подпись не опережает объект» — the rising
     * tile keeps its empty support sockets until it has landed in the government, the descending one gets
     * its own back on the row; the cubes of a standing stock ride with the tile both ways).
     */
    rulerSettled(): ReduxParty {
      return parliamentHolds.rulerSettling ?? this.rulerShown;
    },
    /**
     * …AND WHETHER THAT SETTLED RULER RULES BY AN ENACTED CARD — the fact the support sockets stand on.
     * While the old ruler is still shown or still in the air, the answer is the OLD government's (seeded
     * with the sitting: `rulerBeforeByCard`); at rest it is the live one. Generation 1's starting-rule
     * Greens are the one ruler without a card: their empty sockets stay drawn, and the support step's cube
     * for them lands there.
     */
    rulerSettledByCard(): boolean {
      const holds = parliamentHolds;
      if (holds.rulerBefore !== undefined || holds.rulerSettling !== undefined) {
        return holds.rulerBeforeByCard ?? true;
      }
      return this.view.enacted !== undefined;
    },
    /** The focused tile's index in `view.parties`: the row's cursor, or the ruler when the government's tile is the focus zone. */
    focusedIndex(): number {
      // The overview's cursor — and the SUPPORT-AREA mode's (TR12), which walks the same six plaques by the same record.
      if (parliamentFlow.stage !== 'browse' && !parliamentSupportUp()) {
        return -1;
      }
      if (parliamentFlow.zone === 'ruler') {
        return this.view.parties.findIndex((p) => p.party === this.rulerShown);
      }
      return parliamentFlow.zone === 'parties' ? parliamentFlow.partyIndex : -1;
    },
    partyLine(): string {
      const index = this.focusedIndex;
      // In the support-area mode the plaque's row reads the AREA (`pick`) — never the party action's state.
      if (index === -1 || parliamentSupportUp()) {
        return '';
      }
      const state = this.partyActionStates[index];
      if (state === undefined) {
        return '';
      }
      switch (state.kind) {
      case 'used': return translateText('Action used this generation');
      case 'blocked': return state.reason !== undefined ? this.reasonText(state.reason) : translateText('Unavailable right now');
      case 'not-now': return translateText(this.awaitingInput ? 'Finish your current action first' : 'Not your turn — you can read the Parliament');
      // No access: a party IN the vote says it by its places (0/2) — a party outside the vote has no places, so
      // its foot says the server's reason.
      case 'no-access': return this.partyStates[index]?.kind === 'absent' && state.reason !== undefined ? this.reasonText(state.reason) : '';
      default: return '';
      }
    },
    partyLineTone(): 'dim' | 'warn' {
      const state = this.partyActionStates[this.focusedIndex];
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
      // CSS one-shots (`con-parl-access-gain` / `-lost`): each flag is cleared
      // by its own animation's end, never by a timer guessing its length.
      this.accessPulse = gained;
      this.accessLost = lost;
    },
    usedKey(now: string, was: string): void {
      const before = new Set(was.split('|').filter((s) => s !== ''));
      const used = now.split('|').find((p) => p !== '' && !before.has(p)) as ReduxParty | undefined;
      if (used === undefined) {
        return;
      }
      this.usedPulse = used;
    },
  },
  methods: {
    /** A plaque's one-shot pulse played out — clear exactly the flag that raised it (one plaque may run two). */
    onPulseEnd(event: AnimationEvent, party: ReduxParty): void {
      if (event.animationName === 'con-parl-access-gain') {
        if (this.accessPulse === party) {
          this.accessPulse = undefined;
        }
        if (this.usedPulse === party) {
          this.usedPulse = undefined;
        }
      } else if (event.animationName === 'con-parl-access-lost' && this.accessLost === party) {
        this.accessLost = undefined;
      }
    },
    /**
     * A party's popular support as SHOWN: what the sitting still keeps on the plaque (a cube the renewal's beat
     * has not moved onto its fresh card yet) and minus what has not ARRIVED yet (the support beat's cubes in the air).
     */
    supportShown(p: ParliamentPartyVm): number {
      // …PLUS the cubes a support-area pick (TR12) emptied that have not LIFTED off this plaque yet, and MINUS the
      // cubes a card's rally (TR31) granted that have not LANDED here yet (each touchdown lands one).
      return Math.max(0, Math.min(3, p.support + (parliamentHolds.support.get(p.party) ?? 0) - (parliamentHolds.supportIncoming.get(p.party) ?? 0) +
        supportDiscardStanding(p.party) - rallySupportIncoming(p.party) - rivalSupportIncoming(p.party)));
    },
    /** The recount's marks on this plaque's places (TR31) — 0 outside a rally. */
    rallyCountedPlaces(party: ReduxParty): number {
      return rallyCountedPlaces(party);
    },
    /** The support-area mode's reading of a plaque — the server's row (undefined outside the mode); the rally's reading of an area it reached (TR31). */
    pickOf(party: ReduxParty): {current: number, resulting: number, available: boolean, reason?: string} | undefined {
      const rally = rallySupportReading(party);
      if (rally !== undefined) {
        return rally;
      }
      if (this.supportMeta === undefined || !parliamentSupportUp()) {
        return undefined;
      }
      const area = supportAreaOf(this.supportMeta, party);
      return area === undefined ? undefined :
        {current: area.current, resulting: area.resulting, available: area.available, ...(area.reason === undefined ? {} : {reason: area.reason})};
    },
    /** The cubes the FOCUSED candidate would send away — outlined while the pick is open, never past the press. */
    outgoingOf(party: ReduxParty, index: number): number {
      if (index !== this.focusedIndex || parliamentFlow.stage !== 'support' || parliamentFlow.supportCommitted) {
        return 0;
      }
      const area = supportAreaOf(this.supportMeta, party);
      return area?.available === true ? Math.max(0, area.current - area.resulting) : 0;
    },
    reasonText(reason: string | Message): string {
      return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
    },
  },
});
</script>
