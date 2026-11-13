<template>
  <aside class="con-paccess" :class="['con-paccess--' + tone, {'con-paccess--closing': closing}]"
         :style="partner === undefined ? undefined : {'--paccess-ally-accent': partnerAccent}"
         :aria-label="$t('Access')" data-parl-access-panel :data-access-tone="tone" :data-party="party">
    <!-- ══ «ДОСТУП» — the PARTY's dossier names the viewer's access to its effect as an OBJECT (Парламент v8 § 7): the
         party's seal in a ring (gold — it rules and its effect is everyone's · mint — the effect is yours · slate — not
         yours), the viewer's PLACES on its resolution (the seat's own threshold: the printed two, one under TR36) with the
         count, and the state in the glossary's words (`accessReasonRows` — the one reading the «ДЛЯ ВАС» group used to
         print; the rules panel under it no longer repeats it). It stands ABOVE «§ ПРАВИЛА» in the side column, exactly as
         a card's «ДОСТУПНОСТЬ» stands above its rules: this game's state first, the party's permanent rules after. ══ -->
    <div class="con-paccess__head">
      <span class="con-paccess__ring" aria-hidden="true">
        <img class="con-paccess__seal" :src="emblem" alt="" />
        <span v-if="tone === 'rules'" class="con-paccess__ring-mark"><svg class="con-paccess__crown" viewBox="0 0 24 16"><path d="M2 13 3.5 4l5 4.5L12 1.5l3.5 7L20.5 4 22 13z" /><rect x="2" y="13.6" width="20" height="2" rx="1" /></svg></span>
        <!-- BY THE ALLIANCE (TR62): the ring borrows the PARTNER's accent and its emblem stands in the mark's place, linked. -->
        <span v-else-if="tone === 'allied' && partner !== undefined" class="con-paccess__ring-mark con-paccess__ring-mark--ally" :data-parl-access-via="partner">
          <img class="con-paccess__ally-seal" :src="partnerEmblem" alt="" />
        </span>
        <span v-else-if="tone === 'holds'" class="con-paccess__ring-mark">✓</span>
      </span>
      <span class="con-paccess__headtext">
        <span class="con-paccess__kicker">{{ $t('Access') }}</span>
        <b class="con-paccess__state" data-parl-access-state>{{ stateText }}</b>
      </span>
    </div>
    <!-- THE PLACES — only where delegates are the road (never for the ruler: its effect is everyone's by the rule). -->
    <div v-if="placesShown" class="con-paccess__places" data-parl-access-places :data-parl-access-count="mine" :data-parl-access-threshold="threshold">
      <span class="con-paccess__places-label">{{ $t('Your delegates') }}</span>
      <span class="con-paccess__sockets">
        <span v-for="n in places" :key="n" class="con-paccess__socket"
              :class="{'con-paccess__socket--on': n <= mine, 'con-paccess__socket--void': n > threshold}">
          <PlayerDelegate v-if="n <= mine && viewer !== undefined" :color="viewer" :size="figurePx(19)" :glow="false" />
        </span>
      </span>
      <b class="con-paccess__count">{{ mine }} / {{ threshold }}</b>
    </div>
    <p v-for="row in notes" :key="row.key" class="con-paccess__note">{{ rowText(row) }}</p>
  </aside>
</template>

<script setup lang="ts">
import {computed, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ParliamentModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {AccessReasonRow, accessReasonRows, accessRoadOf, allianceOf, effectDelegatesOf, PARTY_EFFECT_PLACES} from '@/client/console/parliament/consoleParliamentModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';

export type PartyAccessTone = 'rules' | 'holds' | 'allied' | 'lacks';

defineOptions({name: 'ConsolePartyAccessPanel'});
const props = defineProps({
  party: {type: String as PropType<ReduxParty>, required: true},
  parliament: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
  /** The player the dossier is opened AS (never the player whose turn it is). */
  viewer: {type: String as PropType<Color | undefined>, default: undefined},
  closing: {type: Boolean, default: false},
});

const access = computed((): PartyAccessModel | undefined => {
  return props.parliament?.players.find((p) => p.color === props.viewer)?.access.find((a) => a.party === props.party);
});
const emblem = computed((): string => {
  return partyEmblemUrl(props.party);
});
const tone = computed((): PartyAccessTone => {
  const road = accessRoadOf(access.value);
  if (road === 'ruling') {
    return 'rules';
  }
  if (road === 'alliance') {
    return 'allied';
  }
  return road !== undefined ? 'holds' : 'lacks';
});
/** The alliance's PARTNER when the effect is held through it (TR62) — the ring's mark. */
const partner = computed((): ReduxParty | undefined => {
  return allianceOf(access.value)?.via;
});
const partnerEmblem = computed((): string => {
  return partner.value === undefined ? '' : partyEmblemUrl(partner.value);
});
const partnerAccent = computed((): string => {
  return partner.value === undefined ? '' : partyAccent(partner.value);
});
/** The glossary's rows (`accessReasonRows`): the FIRST is the state, the rest are notes (the card requirement). */
const rows = computed((): ReadonlyArray<AccessReasonRow> => {
  const model = props.parliament;
  if (model === undefined) {
    return [];
  }
  const enacted = model.enacted === undefined ? undefined : getResolution(model.enacted.resolution)?.text.name ?? model.enacted.resolution;
  return accessReasonRows(access.value, {
    party: props.party,
    enactedEmpty: model.enacted === undefined,
    enactedName: enacted === undefined ? undefined : translateText(enacted),
    inArea: model.slots.some((slot) => slot.party === props.party),
    waiver: model.players.find((p) => p.color === props.viewer)?.partyRequirementWaiver,
  }).filter((row) => row.key !== 'Card requirement of this party: met');
});
const stateText = computed((): string => {
  const first = rows.value[0];
  return first === undefined ? translateText('You do not have it') : rowText(first);
});
const notes = computed((): ReadonlyArray<AccessReasonRow> => {
  return rows.value.slice(1);
});
const threshold = computed((): number => {
  return effectDelegatesOf(access.value);
});
/** The PRINTED places (two) — a place past the seat's own threshold is VOID (its room kept), as on the bill's tally. */
const places = PARTY_EFFECT_PLACES;
const mine = computed((): number => {
  return Math.min(access.value?.delegates ?? 0, threshold.value);
});
/** The places stand where the viewer's OWN cubes are the road — or would be (never for the crown, a grant or an alliance). */
const placesShown = computed((): boolean => {
  const road = accessRoadOf(access.value);
  return access.value !== undefined && (road === undefined || road === 'delegates');
});

function rowText(row: AccessReasonRow): string {
  return row.params.length === 0 ? translateText(row.key) : translateTextWithParams(row.key, row.params.map((p) => translateText(p)));
}
const figurePx = delegateFigurePx;
</script>
