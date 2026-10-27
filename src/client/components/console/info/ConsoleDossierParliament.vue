<template>
  <!--
    THE DOSSIER'S PARLIAMENT PLATE (TR60): the seat's standing as OBJECTS in the Parliament's own vocabulary
    (`docs/claude/parliament-glossary.md`): the INFLUENCE badge with the number the seat votes with, the CAREER as a
    ladder of twelve steps (passed · the marker's own · the next, wearing what it pays — the track's printed symbols),
    and the DELEGATES as tokens — the lobby's socket (the free delegate is there or not), the reserve as one cube
    ×N, and every resolution the seat's cubes stand on as its party's emblem with the cubes on it (✓ when the seat
    leads it). The chairman wears the chair. One line built from objects — it cannot wrap a word into the next row
    (the old «● · Резерв 6 · На / резолюциях 0»). Read-only; the zone's detail is one A away. MarsBot's fill is its
    one honest line.
  -->
  <div class="con-dparl" data-dossier-parliament>
    <span v-if="!reading.participates" class="con-dparl__absent" data-parl-zone-absent>{{ $t(botNote) }}</span>
    <template v-else>
      <div class="con-dparl__lead">
        <span class="con-dparl__inf" data-parl-zone-influence-badge>
          <i class="con-dparl__inficon" aria-hidden="true"></i>
          <b class="con-dparl__infval" data-parl-zone-influence>{{ reading.influence.total }}</b>
          <ConsoleInfluenceMod :reading="reading.influence" />
          <span class="con-dparl__inflabel">{{ $t('Influence') }}</span>
        </span>
        <span v-if="reading.chairman" class="con-dparl__chair" data-parl-zone-chairman>
          <PremiumChairGlyph class="con-dparl__chairicon" />
          <span>{{ $t('Chairman') }}</span>
        </span>
      </div>
      <div class="con-dparl__career" data-parl-zone-career>
        <span class="con-dparl__kicker"><i class="career-step-glyph" aria-hidden="true"></i>{{ $t('Agenda track') }} <b>{{ reading.agenda.position }}/{{ steps }}</b></span>
        <span class="con-dparl__ladder" aria-hidden="true">
          <span v-for="pip in ladder" :key="pip.step" class="con-dparl__pip" :class="'con-dparl__pip--' + pip.state">
            <i v-if="pip.state === 'next' && nextIcon !== ''" class="con-dparl__nexticon" :class="nextIcon"></i>
          </span>
        </span>
      </div>
      <div class="con-dparl__delegates" data-parl-zone-delegates>
        <span class="con-dparl__token" :class="{'con-dparl__token--empty': !reading.delegates.lobby}" data-parl-zone-token="lobby">
          <span class="con-dparl__socket"><PlayerDelegate v-if="reading.delegates.lobby" :color="color" :size="figurePx" :glow="false" /></span>
          <span class="con-dparl__tokenlabel">{{ $t('Lobby') }}</span>
        </span>
        <span class="con-dparl__token" data-parl-zone-token="reserve">
          <span class="con-dparl__socket"><PlayerDelegate :color="color" :size="figurePx" :glow="false" /><b class="con-dparl__times">×{{ reading.delegates.reserve }}</b></span>
          <span class="con-dparl__tokenlabel">{{ $t('Reserve') }}</span>
        </span>
        <span class="con-dparl__token con-dparl__token--slots" data-parl-zone-token="slots">
          <span class="con-dparl__socket">
            <span v-for="slot in reading.delegates.onSlots" :key="slot.instance" class="con-dparl__slot" :class="{'con-dparl__slot--lead': slot.leads}" :data-parl-zone-slot="slot.party">
              <img class="con-dparl__emblem" :src="emblemUrl(slot.party)" alt="" />
              <b class="con-dparl__times">×{{ slot.votes }}</b>
              <span v-if="slot.leads" class="con-dparl__leadmark" aria-hidden="true">✓</span>
            </span>
            <b v-if="reading.delegates.onSlots.length === 0" class="con-dparl__times con-dparl__times--none">0</b>
          </span>
          <span class="con-dparl__tokenlabel">{{ $t('On resolutions') }}</span>
        </span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PARLIAMENT_AGENDA_STEPS, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {SeatParliamentReadingVm, BOT_PARLIAMENT_NOTE} from '@/client/console/parliament/seatParliamentReading';
import {dossierLadder, DossierLadderPip} from '@/client/console/infoDossierModel';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import ConsoleInfluenceMod from '@/client/components/console/parliament/ConsoleInfluenceMod.vue';
import PremiumChairGlyph from '@/client/components/premiumCard/PremiumChairGlyph.vue';


export default defineComponent({
  name: 'ConsoleDossierParliament',
  components: {PlayerDelegate, PremiumChairGlyph, ConsoleInfluenceMod},
  props: {
    reading: {type: Object as PropType<SeatParliamentReadingVm>, required: true},
    color: {type: String as PropType<Color>, required: true},
  },
  computed: {
    botNote(): string {
      return BOT_PARLIAMENT_NOTE;
    },
    steps(): number {
      return PARLIAMENT_AGENDA_STEPS;
    },
    ladder(): ReadonlyArray<DossierLadderPip> {
      return dossierLadder(this.reading.agenda.position, PARLIAMENT_AGENDA_STEPS);
    },
    /** What the NEXT step pays, as the track's printed symbol (never a bare numeral — that reads as an ordinal). */
    nextIcon(): string {
      const next = this.reading.agenda.next;
      if (next === undefined) {
        return '';
      }
      return next.kind === 'tr' ? 'resource_icon resource_icon--rating' :
        next.kind === 'card' ? 'resource_icon resource_icon--cards' : 'con-dparl__nexticon--influence';
    },
    /** The figure's height at the scene's scale — the Information's size (28 logical). */
    figurePx(): number {
      return delegateFigurePx(28);
    },
  },
  methods: {
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
  },
});
</script>
