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
      <div class="con-dcmp__tp con-info__cmp-tprow">
        <span v-if="titles.length > 0" class="con-info__ctitles">
          <img v-for="(t, i) in titles" :key="i" class="con-info__ctitle" :src="t.art" :alt="t.label">
        </span>
        <b class="con-info__cmp-tp">{{ tpText }}</b>
      </div>
      <span class="con-info__note con-info__note--tp con-dcmp__tpnote">{{ $t(tpNote) }}</span>
      <span class="con-dcmp__corps"><b>{{ corpCount }}</b> {{ $t('Corporations') }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';

export default defineComponent({
  name: 'ConsoleDossierCampaign',
  components: {PremiumMapFingerprint},
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
  },
});
</script>
