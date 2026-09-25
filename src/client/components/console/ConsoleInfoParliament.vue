<template>
  <!--
    «ПАРЛАМЕНТ» — ONE SEAT'S STANDING (Information workspace, Turmoil Redux).
    The Parliament workspace shows the table; this reads the same table from
    one seat, and answers the questions the table never does:

      ВЛИЯНИЕ   — what the number the seat votes with is MADE of (the Agenda
                  track, and every bonus on top of it by name);
      ПОВЕСТКА  — where the marker stands and what the next step pays;
      ДЕЛЕГАТЫ  — the lobby, the reserve, and every resolution the seat's
                  cubes stand on (with the lead);
      НА СТОЛЕ  — what each resolution up for the vote would pay THIS seat,
                  in the vote panel's own grammar, and what the last
                  enactment already paid it.

    It never restates what another zone already says: the party effects and
    the enacted law's action are «Эффекты», the full Agenda track and the
    chairman's quest are the workspace's own. Nothing here computes — the
    reading is `seatParliamentReadingOf`.
  -->
  <div class="con-info__parl" data-info-parliament>
    <div v-if="!reading.participates" class="con-info__empty con-info__empty--big" data-parl-info-absent>{{ $t(botNote) }}</div>
    <template v-else>
      <!-- ── ВЛИЯНИЕ — «Повестка 2 + бонусы 1 = 3»; a seat whose influence is
           the track's alone has no «бонусы 0» line to print. -->
      <section class="con-info__parl-sec" data-parl-info-section="influence">
        <h4 class="con-info__parl-title">{{ $t('Influence') }}</h4>
        <div class="con-info__parl-sum" data-parl-info-influence>
          <span class="con-info__parl-term"><span>{{ $t('Agenda') }}</span><b>{{ reading.influence.track }}</b></span>
          <template v-if="reading.influence.bonus > 0">
            <span class="con-info__parl-op" aria-hidden="true">+</span>
            <span class="con-info__parl-term"><span>{{ $t('Bonuses') }}</span><b>{{ reading.influence.bonus }}</b></span>
          </template>
          <span class="con-info__parl-op" aria-hidden="true">=</span>
          <b class="con-info__parl-total con-info__mint" data-parl-info-total>{{ reading.influence.total }}</b>
          <i class="con-info__parl-inf" aria-hidden="true"></i>
        </div>
        <!-- …and WHO gave each part, where the server knows. An entry with no giver reads «прочее». -->
        <div v-if="reading.influence.sources.length > 0" class="con-info__stat-lines" data-parl-info-sources>
          <div v-for="(entry, i) in reading.influence.sources" :key="i" class="con-info__stat-line">
            <span>{{ entry.source === undefined ? $t(otherSource) : $t(entry.source) }}</span><b>+{{ entry.amount }}</b>
          </div>
        </div>
      </section>

      <!-- ── ПОВЕСТКА — the step and what the NEXT one pays. -->
      <section class="con-info__parl-sec" data-parl-info-section="agenda">
        <h4 class="con-info__parl-title">{{ $t('Agenda') }}</h4>
        <div class="con-info__stat-lines">
          <div class="con-info__stat-line"><span>{{ $t('Step') }}</span><b data-parl-info-step>{{ stepText }}</b></div>
          <div v-if="reading.agenda.next !== undefined" class="con-info__stat-line">
            <span>{{ $t('Next') }}</span><b data-parl-info-next>{{ $t(nextStepKey) }}</b>
          </div>
        </div>
      </section>

      <!-- ── ДЕЛЕГАТЫ — the places, then every card the seat's cubes stand on. -->
      <section class="con-info__parl-sec" data-parl-info-section="delegates">
        <h4 class="con-info__parl-title">{{ $t('Delegates') }}</h4>
        <div class="con-info__stat-lines">
          <div class="con-info__stat-line"><span>{{ $t('In the lobby') }}</span><b>{{ $t(reading.delegates.lobby ? 'yes' : 'no') }}</b></div>
          <div class="con-info__stat-line"><span>{{ $t('Reserve') }}</span><b>{{ reading.delegates.reserve }}</b></div>
          <div class="con-info__stat-line"><span>{{ $t('On resolutions') }}</span><b>{{ reading.delegates.onResolutions }}</b></div>
          <div v-if="reading.chairman" class="con-info__stat-line"><span>{{ $t('Chairman') }}</span><b class="con-info__mint">{{ $t('yes') }}</b></div>
          <!-- ACCESS is a COUNT here and nothing more: the effects themselves are the «Эффекты» zone's,
               and this zone never restates another one (guard: `console-info-parliament.spec.ts`). -->
          <div class="con-info__stat-line"><span>{{ $t('Access') }}</span><b>{{ reading.access.held }}</b></div>
          <div class="con-info__stat-line"><span>{{ $t('Actions used') }}</span><b>{{ reading.access.partyActionsUsed + reading.access.resolutionActionsUsed }}</b></div>
        </div>
        <div v-for="slot in reading.delegates.onSlots" :key="slot.instance" class="con-info__parl-slot" :data-parl-info-slot="slot.instance">
          <img class="con-info__parl-emblem" :src="emblemUrl(slot.party)" alt="" />
          <span class="con-info__parl-slot-name">{{ $t(nameOf(slot.resolution)) }}</span>
          <b class="con-info__parl-slot-votes">{{ slot.votes }}</b>
          <span v-if="slot.leads" class="con-info__parl-lead">{{ $t('Leader') }}</span>
        </div>
      </section>

      <!-- ── НА СТОЛЕ — the seat's own reading of every resolution up for the
           vote, and what the last enactment paid it. -->
      <section class="con-info__parl-sec con-info__parl-sec--table" data-parl-info-section="table">
        <h4 class="con-info__parl-title">{{ $t('On the voting table') }}</h4>
        <div v-for="entry in reading.table" :key="entry.instance" class="con-info__parl-row" :data-parl-info-row="entry.instance">
          <div class="con-info__parl-row-head">
            <img class="con-info__parl-emblem" :src="emblemUrl(entry.party)" alt="" />
            <span class="con-info__parl-slot-name">{{ $t(nameOf(entry.resolution)) }}</span>
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
        <div v-if="reading.enacted !== undefined" class="con-info__parl-row con-info__parl-row--enacted" data-parl-info-enacted>
          <div class="con-info__parl-row-head">
            <img class="con-info__parl-emblem" :src="emblemUrl(reading.enacted.party)" alt="" />
            <span class="con-info__parl-slot-name">{{ $t(nameOf(reading.enacted.resolution)) }}</span>
            <span class="con-info__parl-win con-info__parl-win--past">{{ $t('Enacted resolution') }}</span>
          </div>
          <ConsoleInfluenceYield class="con-info__parl-yield"
                                 :yields="reading.enacted.yields"
                                 :formula="false"
                                 :captions="false"
                                 size="compact"
                                 data-parl-info-received />
        </div>
      </section>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {AgendaStep, PARLIAMENT_AGENDA_STEPS, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {SeatParliamentReadingVm} from '@/client/console/parliament/seatParliamentReading';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import {translateTextWithParams} from '@/client/directives/i18n';

/** The bot's one honest line — the existing key the workspace already uses for it. */
const BOT_NOTE = 'MarsBot takes no part in the parliament';
/** An influence entry whose giver the server does not name (an older save). */
const OTHER_SOURCE = 'other';

export default defineComponent({
  name: 'ConsoleInfoParliament',
  components: {ConsoleInfluenceYield},
  props: {
    reading: {type: Object as PropType<SeatParliamentReadingVm>, required: true},
  },
  computed: {
    botNote(): string {
      return BOT_NOTE;
    },
    otherSource(): string {
      return OTHER_SOURCE;
    },
    /** «5 / 12» — where the marker stands on the track. */
    stepText(): string {
      return translateTextWithParams('${0} of ${1}', [String(this.reading.agenda.position), String(PARLIAMENT_AGENDA_STEPS)]);
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
  },
  methods: {
    nameOf(resolution: string): string {
      return resolutionName(resolution as never);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
  },
});
</script>
