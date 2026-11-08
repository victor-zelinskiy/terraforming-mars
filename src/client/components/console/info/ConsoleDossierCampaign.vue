<template>
  <!--
    THE DOSSIER'S CAMPAIGN ZONE (the Information polish of 2026-10-19): the campaign as OBJECTS, never «label — number»
    rows — the mission's own BOARD in miniature (the campaign map's fingerprint, the same drawing as its mission card),
    the ROUTE of the campaign as nodes (the missions done, the one being played, the ones ahead), the seat's TITLES as
    their emblems beside the title points (a gold token, the scoring semantics AT the value), and the composition count
    in the ledger's quiet type. Read-only: the zone is the ring's stop, A opens the campaign overview.
  -->
  <div class="con-dcmp" data-dossier-campaign>
    <div v-if="board !== undefined" class="con-dcmp__board" aria-hidden="true">
      <PremiumMapFingerprint :map-id="board" variant="thumb" />
    </div>
    <div class="con-dcmp__read">
      <div class="con-dcmp__route" aria-hidden="true">
        <span v-for="i in missionCount" :key="i" class="con-dcmp__node"
              :class="{'con-dcmp__node--done': i - 1 < missionSlot, 'con-dcmp__node--now': i - 1 === missionSlot}"></span>
      </div>
      <span class="con-dcmp__mission" data-dossier-mission>{{ missionText }}</span>
      <!-- The «Тендеры» mode: the seat's holdings where the titles and the TP stood — each its CERTIFICATE in miniature
           (the one chassis, `.con-tmini`: the tier's metal, the art, the stamp read as material), the count in the
           ledger's register beside them. Read-only here like everything in the zone: A opens the overview, whose legacy
           layer walks the certificates like cards and X opens the viewer. -->
      <template v-if="tenders !== undefined">
        <div class="con-dcmp__tp con-info__cmp-tprow con-dcmp__tenders" data-dossier-tenders>
          <span v-if="tenders.length > 0" class="con-dcmp__tcards">
            <span v-for="t in tenders" :key="t.instance" class="con-tmini" :class="`con-tmini--${t.status}`"
                  :data-dossier-tender="t.instance" :data-dossier-tender-status="t.status" :aria-label="$t(tenderHoldingName(t.id))">
              <ConsoleTenderCard :id="t.id" size="table" :state="tenderCardStateOf(t.status)" />
            </span>
          </span>
          <b class="con-info__cmp-tp" data-dossier-tender-tally>{{ tenders.length === 0 ? $t('No tenders yet') : tenderTally }}</b>
        </div>
        <span class="con-info__note con-info__note--tp con-dcmp__tpnote">{{ $t(tpNote) }}</span>
      </template>
      <template v-else>
        <div class="con-dcmp__tp con-info__cmp-tprow">
          <span v-if="titles.length > 0" class="con-info__ctitles">
            <img v-for="(t, i) in titles" :key="i" class="con-info__ctitle" :src="t.art" :alt="t.label">
          </span>
          <b class="con-info__cmp-tp">{{ tpText }}</b>
        </div>
        <span class="con-info__note con-info__note--tp con-dcmp__tpnote">{{ $t(tpNote) }}</span>
      </template>
      <span class="con-dcmp__corps"><b>{{ corpCount }}</b> {{ $t('Corporations') }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import ConsoleTenderCard from '@/client/components/console/campaign/ConsoleTenderCard.vue';
import {tenderCardStateOf} from '@/client/console/campaign/tenderPortfolio';
import {tenderHoldingName, TenderHoldingView} from '@/client/console/campaign/tenderHoldings';
import {translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleDossierCampaign',
  components: {PremiumMapFingerprint, ConsoleTenderCard},
  props: {
    /** The mission being played, 0-based. */
    missionSlot: {type: Number, required: true},
    missionCount: {type: Number, required: true},
    /** The mission's board — its miniature (absent while the campaign model loads). */
    board: {type: String as PropType<BoardName | undefined>, default: undefined},
    /** «2 из 4 · Элизий» — the frame line, already translated. */
    missionText: {type: String, required: true},
    titles: {type: Array as PropType<ReadonlyArray<{art: string, label: string}>>, default: () => []},
    tpText: {type: String, required: true},
    /** The title points' scoring semantics (an i18n key). */
    tpNote: {type: String, required: true},
    corpCount: {type: String, required: true},
    /** The «Тендеры» mode: the viewed seat's holdings — present (even empty) only on a tenders campaign. */
    tenders: {type: Array as PropType<ReadonlyArray<TenderHoldingView> | undefined>, default: undefined},
  },
  computed: {
    /** The ledger's count of the holdings («3 тендера») — the TP's register in the tenders mode. */
    tenderTally(): string {
      return translateTextWithParams('${0} tender(s)', [String(this.tenders?.length ?? 0)]);
    },
  },
  methods: {
    tenderHoldingName,
    tenderCardStateOf,
  },
});
</script>
