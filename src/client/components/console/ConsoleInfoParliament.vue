<template>
  <!--
    «ПАРЛАМЕНТ» — ONE SEAT'S STANDING (Information workspace, Turmoil Redux), as OBJECTS (TR60, decision 9a). The
    Parliament workspace shows the table; this reads the same table from one seat, and answers the questions the
    table never does — in the Parliament's own vocabulary (`docs/claude/parliament-glossary.md`):

      ВЛИЯНИЕ   — the influence badge with the number the seat votes with, and what it is MADE of as a sum
                  («Карьера 2 + бонусы 1 = 3» — every giver by name where the server knows it);
      КАРЬЕРА   — the track as its twelve printed steps (influence level · TR · card), the marker on the seat's
                  step, the NEXT step lit with what it pays;
      ДЕЛЕГАТЫ  — tokens: the lobby's socket, the reserve, the chair; every resolution the seat's cubes stand on as
                  its party's emblem with the cubes on it (the lead marked);
      НА СТОЛЕ  — each resolution up for the vote as a TILE: its party's emblem, its name, «принимается» when it
                  would be, and what it would pay THIS seat in the vote panel's own grammar; then what the last
                  enactment paid it.

    It never restates what another zone already says: the party effects and the enacted law's action are «Эффекты»;
    ACCESS is a COUNT here and nothing more. Nothing here computes — the reading is `seatParliamentReadingOf`.
  -->
  <div class="con-info__parl con-iparl" data-info-parliament>
    <div v-if="!reading.participates" class="con-info__empty con-info__empty--big" data-parl-info-absent>{{ $t(botNote) }}</div>
    <template v-else>
      <div class="con-iparl__top">
        <!-- ── ВЛИЯНИЕ — the badge, then the sum; a seat whose influence is the track's alone has no «бонусы 0». -->
        <section class="con-info__parl-sec con-iparl__sec con-iparl__sec--influence" data-parl-info-section="influence">
          <h4 class="con-info__parl-title">{{ $t('Influence') }}</h4>
          <div class="con-iparl__badge">
            <i class="con-iparl__inficon" aria-hidden="true"></i>
            <b class="con-iparl__infval con-info__mint" data-parl-info-total>{{ reading.influence.total }}</b>
          </div>
          <div class="con-info__parl-sum con-iparl__sum" data-parl-info-influence>
            <span class="con-info__parl-term"><span>{{ $t('Agenda track') }}</span><b>{{ reading.influence.track }}</b></span>
            <template v-if="reading.influence.bonus > 0">
              <span class="con-info__parl-op" aria-hidden="true">+</span>
              <span class="con-info__parl-term"><span>{{ $t('Bonuses') }}</span><b>{{ reading.influence.bonus }}</b></span>
            </template>
            <span class="con-info__parl-op" aria-hidden="true">=</span>
            <b class="con-iparl__sumtotal">{{ reading.influence.total }}</b>
          </div>
          <!-- …and WHO gave each part, where the server knows. An entry with no giver reads «прочее». -->
          <div v-if="reading.influence.sources.length > 0" class="con-iparl__sources" data-parl-info-sources>
            <span v-for="(entry, i) in reading.influence.sources" :key="i" class="con-iparl__source">
              <span>{{ entry.source === undefined ? $t(otherSource) : $t(entry.source) }}</span><b>+{{ entry.amount }}</b>
            </span>
          </div>
        </section>

        <!-- ── КАРЬЕРА — the printed track: every step with its reward symbol; the seat's step, the next one lit. -->
        <section class="con-info__parl-sec con-iparl__sec con-iparl__sec--agenda" data-parl-info-section="agenda">
          <h4 class="con-info__parl-title">{{ $t('Agenda track') }} <b class="con-iparl__step" data-parl-info-step>{{ stepText }}</b></h4>
          <div class="con-iparl__ladder" aria-hidden="true">
            <span v-for="(step, i) in track" :key="i" class="con-iparl__rung" :class="'con-iparl__rung--' + rungState(i + 1)">
              <span class="con-iparl__rungnode">
                <template v-if="step.kind === 'influence'"><i class="con-iparl__rungicon con-iparl__rungicon--inf"></i><b class="con-iparl__runglevel">{{ step.influence }}</b></template>
                <i v-else-if="step.kind === 'tr'" class="con-iparl__rungicon resource_icon resource_icon--rating"></i>
                <i v-else class="con-iparl__rungicon resource_icon resource_icon--cards"></i>
              </span>
              <span class="con-iparl__rungmark"><PlayerCube v-if="i + 1 === reading.agenda.position" :color="reading.color" :size="cubePx" :glow="false" /></span>
            </span>
          </div>
          <div v-if="reading.agenda.next !== undefined" class="con-iparl__next">
            <span>{{ $t('Next') }}</span><b data-parl-info-next>{{ $t(nextStepKey) }}</b>
          </div>
        </section>
      </div>

      <!-- ── ДЕЛЕГАТЫ — tokens, then every card the seat's cubes stand on. -->
      <section class="con-info__parl-sec con-iparl__sec con-iparl__sec--delegates" data-parl-info-section="delegates">
        <h4 class="con-info__parl-title">{{ $t('Delegates') }}</h4>
        <div class="con-iparl__tokens">
          <span class="con-iparl__token" :class="{'con-iparl__token--empty': !reading.delegates.lobby}">
            <span class="con-iparl__socket"><PlayerCube v-if="reading.delegates.lobby" :color="reading.color" :size="cubePx" :glow="false" /></span>
            <span class="con-iparl__tokenlabel">{{ $t('In the lobby') }}</span>
          </span>
          <span class="con-iparl__token">
            <span class="con-iparl__socket"><PlayerCube :color="reading.color" :size="cubePx" :glow="false" /><b>×{{ reading.delegates.reserve }}</b></span>
            <span class="con-iparl__tokenlabel">{{ $t('Reserve') }}</span>
          </span>
          <span class="con-iparl__token">
            <span class="con-iparl__socket"><b>{{ reading.delegates.onResolutions }}</b></span>
            <span class="con-iparl__tokenlabel">{{ $t('On resolutions') }}</span>
          </span>
          <span v-if="reading.chairman" class="con-iparl__token">
            <span class="con-iparl__socket"><PremiumChairGlyph class="con-iparl__chair" /></span>
            <span class="con-iparl__tokenlabel">{{ $t('Chairman') }}</span>
          </span>
          <!-- ACCESS is a COUNT here and nothing more: the effects themselves are the «Эффекты» zone's, and this zone
               never restates another one (guard: `console-info-parliament.spec.ts`). -->
          <span class="con-iparl__token">
            <span class="con-iparl__socket"><b>{{ reading.access.held }}</b></span>
            <span class="con-iparl__tokenlabel">{{ $t('Access') }}</span>
          </span>
          <span class="con-iparl__token">
            <span class="con-iparl__socket"><b>{{ reading.access.partyActionsUsed + reading.access.resolutionActionsUsed }}</b></span>
            <span class="con-iparl__tokenlabel">{{ $t('Actions used') }}</span>
          </span>
        </div>
        <div v-if="reading.delegates.onSlots.length > 0" class="con-iparl__slots">
          <span v-for="slot in reading.delegates.onSlots" :key="slot.instance" class="con-info__parl-slot con-iparl__slot" :data-parl-info-slot="slot.instance">
            <img class="con-info__parl-emblem con-iparl__slotemblem" :src="emblemUrl(slot.party)" alt="" />
            <span class="con-info__parl-slot-name">{{ $t(nameOf(slot.resolution)) }}</span>
            <PlayerCube :color="reading.color" :size="cubePx" :glow="false" />
            <b class="con-info__parl-slot-votes">×{{ slot.votes }}</b>
            <span v-if="slot.leads" class="con-info__parl-lead">{{ $t('Leader') }}</span>
          </span>
        </div>
      </section>

      <!-- ── НА СТОЛЕ — the seat's own reading of every resolution up for the vote, and what the last enactment paid it. -->
      <section class="con-info__parl-sec con-iparl__sec con-info__parl-sec--table" data-parl-info-section="table">
        <h4 class="con-info__parl-title">{{ $t('On the voting table') }}</h4>
        <div class="con-iparl__table">
          <div v-for="entry in reading.table" :key="entry.instance" class="con-info__parl-row con-iparl__res" :data-parl-info-row="entry.instance">
            <div class="con-info__parl-row-head">
              <img class="con-info__parl-emblem con-iparl__resemblem" :src="emblemUrl(entry.party)" alt="" />
              <span class="con-info__parl-slot-name con-iparl__resname">{{ $t(nameOf(entry.resolution)) }}</span>
              <span v-if="entry.winning" class="con-info__parl-win">{{ $t('Winning') }}</span>
            </div>
            <ConsoleInfluenceYield v-if="entry.reading.yields.length > 0"
                                   class="con-info__parl-yield"
                                   :yields="entry.reading.yields"
                                   :suffixes="entry.reading.suffixes"
                                   :levy="entry.reading.levy"
                                   :person="entry.reading.person"
                                   :formula="false"
                                   :captions="false"
                                   :oneNumber="true"
                                   :note="entry.reading.note"
                                   size="compact"
                                   data-parl-info-reading />
            <span v-else class="con-info__parl-nothing">{{ $t('Nothing at the enactment') }}</span>
          </div>
          <div v-if="reading.enacted !== undefined" class="con-info__parl-row con-info__parl-row--enacted con-iparl__res con-iparl__res--enacted" data-parl-info-enacted>
            <div class="con-info__parl-row-head">
              <img class="con-info__parl-emblem con-iparl__resemblem" :src="emblemUrl(reading.enacted.party)" alt="" />
              <span class="con-info__parl-slot-name con-iparl__resname">{{ $t(nameOf(reading.enacted.resolution)) }}</span>
              <span class="con-info__parl-win con-info__parl-win--past">{{ $t('Enacted resolution') }}</span>
            </div>
            <ConsoleInfluenceYield class="con-info__parl-yield"
                                   :yields="reading.enacted.yields"
                                   :formula="false"
                                   :captions="false"
                                   size="compact"
                                   data-parl-info-received />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {AGENDA_TRACK, AgendaStep, PARLIAMENT_AGENDA_STEPS, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {SeatParliamentReadingVm, BOT_PARLIAMENT_NOTE, BOT_POLITICS_NOTE} from '@/client/console/parliament/seatParliamentReading';
import {dossierLadder} from '@/client/console/infoDossierModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import PremiumChairGlyph from '@/client/components/premiumCard/PremiumChairGlyph.vue';
import {translateTextWithParams} from '@/client/directives/i18n';

/** An influence entry whose giver the server does not name (an older save). */
const OTHER_SOURCE = 'other';

export default defineComponent({
  name: 'ConsoleInfoParliament',
  components: {ConsoleInfluenceYield, PlayerCube, PremiumChairGlyph},
  props: {
    reading: {type: Object as PropType<SeatParliamentReadingVm>, required: true},
  },
  computed: {
    botNote(): string {
      return this.reading.botPolitical ? BOT_POLITICS_NOTE : BOT_PARLIAMENT_NOTE;
    },
    otherSource(): string {
      return OTHER_SOURCE;
    },
    /** «5 / 12» — where the marker stands on the track. */
    stepText(): string {
      return translateTextWithParams('${0} of ${1}', [String(this.reading.agenda.position), String(PARLIAMENT_AGENDA_STEPS)]);
    },
    /** The printed track — the steps' own rewards (the Parliament's symbols). */
    track(): ReadonlyArray<AgendaStep> {
      return AGENDA_TRACK;
    },
    /** WHAT the next step pays, in the track's own vocabulary (never a bare numeral — that reads as an ordinal). */
    nextStepKey(): string {
      const step: AgendaStep | undefined = this.reading.agenda.next;
      if (step === undefined) {
        return '';
      }
      switch (step.kind) {
      case 'influence': return 'Influence';
      case 'tr': return 'TR';
      case 'card': return 'Card';
      }
    },
    cubePx(): number {
      return Math.round(20 * conUiScale());
    },
  },
  methods: {
    nameOf(resolution: string): string {
      return resolutionName(resolution as never);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    rungState(step: number): string {
      return dossierLadder(this.reading.agenda.position, PARLIAMENT_AGENDA_STEPS)[step - 1]?.state ?? 'ahead';
    },
  },
});
</script>
