<template>
  <!-- THE PARTY EFFECTS a seat holds (Turmoil Redux) — the Information
       workspace's «ЭФФЕКТЫ» zone shows them beside the card effects: the same
       printed formula the Parliament's party detail and the inspector draw
       (one render-DSL drawing per party), each with WHY the seat holds it by
       the CURRENT game state, and its action's use this generation. Read-only:
       the inspector for a party is one X away in the Parliament. -->
  <section v-if="rows.length > 0" class="con-pfx" :aria-label="$t('Party effects')">
    <header class="con-pfx__head">
      <span class="con-pfx__kicker">{{ $t('Party effects') }}</span>
      <span class="con-pfx__sub">{{ $t('Held through the Mars Parliament — the ruling party and every party with two of this player\'s delegates') }}</span>
    </header>
    <div class="con-pfx__row">
      <div v-for="row in rows" :key="row.key" class="con-pfx__item" :class="{'con-pfx__item--resolution': row.resolution !== undefined}" :data-party="row.party" :data-resolution="row.resolution" :style="{'--parl-accent': row.accent}">
        <img class="con-pfx__emblem" :src="row.emblem" alt="" />
        <div class="con-pfx__why">
          <!-- The law's own kicker: a resolution row is titled by the card's NAME, so the kind is said above it. -->
          <span v-if="row.resolution !== undefined" class="con-pfx__law" v-i18n>Enacted resolution</span>
          <b>{{ $t(row.title) }}</b>
          <ConsolePartyFormula class="con-pfx__formula" :party="row.party" :renderRoot="row.renderRoot" size="wide" />
          <span v-for="(reason, i) in row.reasons" :key="i" class="con-pfx__reason" :class="'con-pfx__reason--' + reason.tone">{{ reasonText(reason) }}</span>
          <span v-if="row.action !== undefined" class="con-pfx__uses">{{ $t(row.action) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty, partyActionOf} from '@/common/parliament/ParliamentTypes';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {accessReasonRows, AccessReasonRow} from '@/client/console/parliament/consoleParliamentModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import {ICardRenderRoot} from '@/common/cards/render/Types';

type Row = {
  key: string,
  party: ReduxParty,
  /** The row is the ENACTED RESOLUTION's own passive effect (its id), not a party's. */
  resolution?: string,
  /** The name key: the party, or the resolution's printed name. */
  title: string,
  /** Draw ONLY this root (a resolution's printed effect) — absent: the party's catalog formula. */
  renderRoot?: ICardRenderRoot,
  emblem: string,
  accent: string,
  reasons: Array<AccessReasonRow>,
  action: string | undefined,
};

export default defineComponent({
  name: 'ConsolePartyEffectsStrip',
  components: {ConsolePartyFormula},
  props: {
    parliament: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    /** The seat whose effects are shown. */
    color: {type: String as PropType<Color>, required: true},
  },
  computed: {
    rows(): Array<Row> {
      const model = this.parliament;
      if (model === undefined) {
        return [];
      }
      const seat = model.players.find((p) => p.color === this.color);
      if (seat === undefined || !seat.participates) {
        return [];
      }
      const enactedName = model.enacted === undefined ? undefined : translateText(getResolution(model.enacted.resolution)?.text.name ?? model.enacted.resolution);
      const inArea = new Set(model.slots.map((slot) => slot.party));
      const out: Array<Row> = [];
      for (const party of REDUX_PARTIES) {
        const access = seat.access.find((a) => a.party === party);
        if (access === undefined || !access.hasEffect) {
          continue;
        }
        // Only the HOLDS reasons + the requirement footnote (the effect IS held here).
        const reasons = accessReasonRows(access, {party, enactedEmpty: model.enacted === undefined, enactedName, inArea: inArea.has(party)})
          .filter((row) => row.tone !== 'lacks');
        const uses = seat.partyActionUses[party] ?? 0;
        const hasAction = partyActionOf(party) !== undefined;
        out.push({
          key: party,
          party,
          title: party,
          emblem: partyEmblemUrl(party),
          accent: partyAccent(party),
          reasons,
          action: hasAction ? (uses > 0 ? 'Action used this generation' : 'Action available this generation') : undefined,
        });
      }
      // THE ENACTED RESOLUTION's own passive effect — everyone's LAW while it
      // stands: one row with its printed graphic, under its party's seal. It
      // LEADS the strip (the law before the privileges) and wears the gold of
      // the government in power (`.con-pfx__item--resolution`) — the same
      // mark the Parliament gives the enacted card, so it never reads as one
      // more party's perk among the rows.
      const enacted = model.enacted === undefined ? undefined : getResolution(model.enacted.resolution);
      if (enacted !== undefined && enacted.text.passive !== undefined) {
        out.unshift({
          key: `resolution:${enacted.id}`,
          party: enacted.party,
          resolution: enacted.id,
          title: enacted.text.name,
          renderRoot: enacted.renderData,
          emblem: partyEmblemUrl(enacted.party),
          accent: partyAccent(enacted.party),
          reasons: [{key: 'Enacted resolution — its effect applies to every player', params: [], tone: 'holds'}],
          action: undefined,
        });
      }
      return out;
    },
  },
  methods: {
    reasonText(row: AccessReasonRow): string {
      return row.params.length > 0 ? translateTextWithParams(row.key, [...row.params]) : translateText(row.key);
    },
  },
});
</script>
