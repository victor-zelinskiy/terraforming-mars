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
               'con-parl__party--' + shownStates[i].kind,
               {
                 'con-parl__party--ruler': p.party === rulerShown,
                 'con-parl__party--focus': focusedIndex === i,
                 'con-parl__party--held': shownStates[i].held,
                 'con-parl__party--pulse': accessPulse === p.party || usedPulse === p.party || allyPulse === p.party,
                 'con-parl__party--lost': accessLost === p.party,
               },
             ]"
             :data-party="p.party"
             :data-party-state="shownStates[i].kind"
             :data-action-state="partyActionStates[i].kind"
             :data-parl-ruler-tile="p.party === rulerShown ? '' : undefined"
             @animationend="onPulseEnd($event, p.party)">
          <!-- «Зал» v7: the MEDALLION — the ruler's in the government (`ruler`), the five of the column as ROWS; no formula
               on the overview (the dossier prints it, the reading line names the state). -->
          <ConsolePartyPlaque :party="p.party"
                              :size="p.party === rulerShown ? 'ruler' : 'row'"
                              :state="shownStates[i]"
                              :actionState="partyActionStates[i]"
                              :support="supportShown(p)"
                              :viewerColor="viewerColor"
                              :formula="false"
                              :focused="focusedIndex === i"
                              :ruling="p.party === rulerSettled"
                              :rulesByCard="rulerSettledByCard"
                              :roll="rollOf(p.party)"
                              :pick="pickOf(p.party)"
                              :supportOutgoing="outgoingOf(p.party, i)"
                              :supportCounted="rallyCountedPlaces(p.party)"
                              reason="" />
        </div>
      </Teleport>
    </template>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import {parliamentFlow, parliamentSupportUp} from '@/client/console/parliament/consoleParliamentFlow';
import {SupportPromptMeta} from '@/common/models/PlayerInputModel';
import {supportAreaOf} from '@/client/console/parliament/supportPickModel';
import {supportDiscardStanding} from '@/client/console/parliament/supportDiscard';
import {rallyCountedPlaces, rallySupportIncoming, rallySupportReading} from '@/client/console/parliament/neutralRally';
import {rivalSupportIncoming} from '@/client/console/parliament/parliamentRivalVotes';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {
  accessRoadOf, alliancePartnerOf, ParliamentPartyVm, PartyActionStateVm, PartyStateVm, ParliamentViewVm,
} from '@/client/console/parliament/consoleParliamentModel';
import {rectOf, sendAllianceSpark} from '@/client/console/parliament/parliamentFlights';
import {partyAccent} from '@/client/components/premiumCard/partyEmblems';
import {
  allianceImpulseState, alliedPartiesOf, noteAllianceImpulseSeen, owedAllianceImpulses,
} from '@/client/console/parliament/allianceImpulse';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {transferEndVerdict} from '@/client/console/resourceTransfer/transferEndVisible';
import {probeTick} from '@/client/console/probeTick';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** How long an owed impulse waits for its two seals to be seen before it stays owed for the next mount (named, bounded). */
const ALLIANCE_IMPULSE_WAIT_MS = 6_000;

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
      /** THE ALLY's answer (TR62): raised on the ARRIVAL of the impulse from its partner's seal, never with the change. */
      allyPulse: undefined as ReduxParty | undefined,
      /** An owed impulse is waiting for its seals / in the air (one at a time). */
      impulseRunning: false,
      /** The tier is still mounted (a wait outliving it gives up — the impulse stays owed). */
      impulseAlive: true,
      /**
       * THE ACCESS AS SHOWN — the live key, FROZEN while the sitting holds the old government: the response that carries
       * the new ruler arrives at the sitting's start, and the gain/loss pulses fired then (the 1080 storyboard: the new
       * ruler's tile flashed mint and the old one's lost-pulse ran under the Agenda beat) — they belong to the moment the
       * medallions have changed places.
       */
      accessKeyShown: '',
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    /**
     * THE ROLL CALL's mark for a party (v3 В3 → Парламент v8 Р2 «объект вместо подписи»): while the support scene names
     * the parties, each medallion WEARS why it stands where it stands — a mark on its seal, never a phrase (a word in the
     * row's foot was cut to «НЕ ПРИНЯ…» beside the sockets on every profile but 4K, and the band already says the wave's
     * rule in full). Empty outside the scene.
     */
    rollOf(): (party: ReduxParty) => string {
      const roll = parliamentHolds.rollStatus;
      return (party: ReduxParty) => roll.get(party) ?? '';
    },
    /**
     * THE STATE AS SHOWN — by the ruler the plaques STAND by, not by the live view. A sitting's response already carries
     * the new government, while the walk shows the old one until the enactment's beat: the new ruler's tile still on the
     * bench must not say «ПРАВИТ» beside the old ruler's crown (the 1080 storyboard read both for the whole Agenda beat),
     * and the old ruler's keeps its ribbon until it has left the dais. At rest the two answers are one.
     */
    shownStates(): ReadonlyArray<PartyStateVm> {
      const settled = this.rulerSettled;
      if (settled === this.view.rulingParty) {
        return this.partyStates;
      }
      const byCard = this.rulerSettledByCard;
      return this.view.parties.map((p, i) => {
        const state = this.partyStates[i];
        const rules = state.kind === 'ruling' || state.kind === 'ruling-default';
        if (p.party === settled && !rules) {
          return {...state, kind: byCard ? 'ruling' : 'ruling-default', label: byCard ? 'Ruling' : 'Rules by the starting rule', params: [], tone: 'gold', ring: 'ruling'};
        }
        if (p.party !== settled && rules) {
          // Its card is the one being enacted: until the plaques change places it is a party IN THE VOTE.
          return {...state, kind: 'in-area', label: 'In the vote', params: [], tone: 'cyan', ring: state.delegates >= state.effectDelegates ? 'own' : 'none'};
        }
        return state;
      });
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
    accessKey(): string {
      return (this.view.viewer?.access ?? []).filter((a) => a.hasEffect).map((a) => a.party).join('|');
    },
    /** The sitting still shows a government other than the live one (the swap has not settled). */
    swapHeld(): boolean {
      return this.rulerSettled !== this.view.rulingParty;
    },
    usedKey(): string {
      return this.view.parties.filter((_, i) => this.partyActionStates[i]?.kind === 'used').map((p) => p.party).join('|');
    },
  },
  watch: {
    accessKey(now: string): void {
      if (!this.swapHeld) {
        this.accessKeyShown = now;
      }
    },
    swapHeld(held: boolean): void {
      if (!held) {
        this.accessKeyShown = this.accessKey;
      }
    },
    accessKeyShown(now: string, was: string): void {
      const before = new Set(was.split('|').filter((s) => s !== ''));
      const after = new Set(now.split('|').filter((s) => s !== ''));
      const gainedAll = [...after].filter((p) => !before.has(p)) as Array<ReduxParty>;
      // THE ALLIANCE (TR62): a party gained by the alliance road answers only when the impulse from its PARTNER's
      // seal ARRIVES — «реагирует только то, чего коснулись»: the partner's change is the cause, the ally its effect.
      const allied = gainedAll.find((p) => accessRoadOf(this.accessOf(p)) === 'alliance');
      const gained = gainedAll.find((p) => p !== allied);
      const lost = [...before].find((p) => !after.has(p)) as ReduxParty | undefined;
      // CSS one-shots (`con-parl-access-gain` / `-lost`): each flag is cleared
      // by its own animation's end, never by a timer guessing its length.
      this.accessPulse = gained;
      this.accessLost = lost;
      if (allied !== undefined) {
        this.playOwedAllianceImpulses();
      }
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
  created() {
    this.accessKeyShown = this.accessKey;
  },
  mounted() {
    // An activation that happened where the chamber was not on screen (the card played from the hand, the vote panel
    // over the benches) is OWED to the first time the seals are seen.
    this.playOwedAllianceImpulses();
  },
  beforeUnmount() {
    this.impulseAlive = false;
  },
  methods: {
    accessOf(party: ReduxParty) {
      return this.view.viewer?.access.find((a) => a.party === party);
    },
    /** A party's seal on screen — on the bench, or on the dais (the ruler's tile is teleported there). */
    sealRect(party: ReduxParty) {
      return rectOf(document.querySelector(`.con-parl__party[data-party="${party}"] .con-pseal__seal`));
    },
    /**
     * Is `party`'s seal SEEN — painted, at least half opaque, on screen, and the topmost thing at its centre (a vote
     * panel over the benches is in the chamber's own band surface, so the shared verdict alone cannot tell)?
     */
    sealSeen(party: ReduxParty): boolean {
      const tile = document.querySelector(`.con-parl__party[data-party="${party}"]`);
      const seal = tile?.querySelector('.con-pseal__seal');
      if (tile === null || tile === undefined || seal === null || seal === undefined || !transferEndVerdict(seal).visible) {
        return false;
      }
      const r = seal.getBoundingClientRect();
      const top = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((e) => e.closest('.con-parl-flightlayer, .con-transfer') === null);
      return top !== undefined && tile.contains(top);
    },
    /** The chamber at REST: no beat of a sitting playing, no old government still standing in for the new one. */
    chamberAtRest(): boolean {
      return sittingMotion.beat === '' && parliamentHolds.rulerBefore === undefined && parliamentHolds.rulerSettling === undefined &&
        parliamentHolds.govBefore === undefined;
    },
    /**
     * THE ALLIANCE'S ACTIVATION (TR62): ONE impulse of light leaves the PARTNER's seal for the ally's, and the ally's
     * borrowed ring answers on its arrival (`allyPulse`, the same one-shot family as an access gained) — played the
     * first time BOTH seals are seen with the chamber at rest (never over a panel, never before the beat that caused
     * it), one party at a time; owed again on the next mount if the chamber leaves first (`allianceImpulse.ts`).
     */
    playOwedAllianceImpulses(): void {
      if (this.impulseRunning) {
        return;
      }
      const owed = owedAllianceImpulses(alliedPartiesOf(this.view.viewer?.access));
      const party = owed[0];
      if (party === undefined) {
        return;
      }
      const partner = alliancePartnerOf(this.accessOf(party));
      if (partner === undefined || consoleReducedMotionActive()) {
        noteAllianceImpulseSeen(party);
        return;
      }
      this.impulseRunning = true;
      const started = Date.now();
      const attempt = () => {
        if (!this.impulseAlive) {
          this.impulseRunning = false;
          return;
        }
        if (!(this.chamberAtRest() && this.sealSeen(partner) && this.sealSeen(party))) {
          if (Date.now() - started < ALLIANCE_IMPULSE_WAIT_MS) {
            probeTick(attempt);
          } else {
            // Never seen in the window (the chamber stayed covered): still owed — the next mount or change plays it.
            this.impulseRunning = false;
          }
          return;
        }
        allianceImpulseState.flying++;
        noteAllianceImpulseSeen(party);
        sendAllianceSpark({
          from: this.sealRect(partner),
          to: this.sealRect(party),
          accent: partyAccent(partner),
          onLanded: () => {
            allianceImpulseState.flying = Math.max(0, allianceImpulseState.flying - 1);
            this.impulseRunning = false;
            if (this.impulseAlive) {
              this.allyPulse = party;
              this.playOwedAllianceImpulses();
            }
          },
        });
      };
      attempt();
    },
    /** A plaque's one-shot pulse played out — clear exactly the flag that raised it (one plaque may run two). */
    onPulseEnd(event: AnimationEvent, party: ReduxParty): void {
      if (event.animationName === 'con-parl-access-gain') {
        if (this.accessPulse === party) {
          this.accessPulse = undefined;
        }
        if (this.allyPulse === party) {
          this.allyPulse = undefined;
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
  },
});
</script>
