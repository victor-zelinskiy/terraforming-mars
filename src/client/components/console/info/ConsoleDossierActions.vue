<template>
  <!--
    THE DOSSIER'S ACTIONS PLATE (TR60): the seat's action cards as TILES — the card's own art, its name, and its STATE
    as a SHAPE, never a colour alone: ▶ on a mint disc = the viewer can take it now (the server's offer); ✕ on an
    amber disc under a dark scrim = the viewer's own card refused (the server's reason is the zone's, one A away);
    ✓ on a steel disc over a sunk art = used this generation (public); ○ hollow = another seat's card not yet used
    (its availability is that seat's verdict — invariant 2, never derived here). The legend under the tiles says the
    same counts in the same shapes. Read-only: the zone is the ring stop, a tile is not.
    Empty: the silhouette of a tile and one line — no action cards on this table.
  -->
  <div class="con-dacts" :data-dossier-actions="tiles.length">
    <div v-if="tiles.length > 0" class="con-dacts__grid" :style="{'--dact-cols': columns}">
      <div v-for="t in shown" :key="t.name" class="con-dact" :class="'con-dact--' + t.state"
           :data-dossier-action="t.name" :data-action-state="t.state">
        <span v-if="t.political !== undefined" class="con-dact__art con-dact__art--party" :style="{'--parl-accent': accentOf(t.political.party)}" aria-hidden="true">
          <img class="con-dact__emblem" :src="emblemOf(t.political.party)" alt="" />
        </span>
        <span v-else class="con-dact__art" :style="artStyle(t.name)" aria-hidden="true"></span>
        <span class="con-dact__mark" aria-hidden="true">{{ MARK[t.state] }}</span>
        <span class="con-dact__name">{{ $t(t.political?.title ?? t.name) }}</span>
      </div>
      <div v-if="hidden > 0" class="con-dact con-dact--more" data-dossier-action-more>
        <span class="con-dact__morenum">+{{ hidden }}</span>
      </div>
    </div>
    <div v-else class="con-dacts__void" data-dossier-empty="actions">
      <span class="con-dact con-dact--ghost" aria-hidden="true"><span class="con-dact__art"></span></span>
      <span class="con-dacts__voidline">{{ $t('No action cards on the table') }}</span>
    </div>
    <div v-if="counts.length > 0" class="con-dacts__legend" data-dossier-action-legend>
      <span v-for="c in counts" :key="c.state" class="con-dacts__count" :class="'con-dacts__count--' + c.state" :data-action-count="c.state">
        <span class="con-dacts__countmark" aria-hidden="true">{{ MARK[c.state] }}</span>
        <b>{{ c.count }}</b>
        <span>{{ $t(LABEL[c.state]) }}</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {DossierActionState, DossierActionTile, dossierActionCounts} from '@/client/console/infoDossierModel';
import {cardArtUrl, cardArtUrlAtTier, CARD_ART_FALLBACK_URL} from '@/client/cards/cardArt';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';

/** The state's SHAPE — a symbol that reads in every language and without colour. */
const MARK: Readonly<Record<DossierActionState, string>> = {ready: '▶', blocked: '✕', used: '✓', idle: '○'};
/** The legend's words (i18n keys). */
const LABEL: Readonly<Record<DossierActionState, string>> = {
  ready: 'Available now',
  blocked: 'Not available',
  used: 'Used this generation',
  idle: 'Not used yet',
};

export default defineComponent({
  name: 'ConsoleDossierActions',
  props: {
    tiles: {type: Array as PropType<ReadonlyArray<DossierActionTile>>, required: true},
    /** At most this many tiles stand on the plate; the rest are counted («+K») — the zone shows them all. */
    max: {type: Number, default: 8},
    columns: {type: Number, default: 4},
  },
  data() {
    return {MARK, LABEL};
  },
  computed: {
    shown(): ReadonlyArray<DossierActionTile> {
      return this.tiles.length > this.max ? this.tiles.slice(0, this.max - 1) : this.tiles;
    },
    hidden(): number {
      return this.tiles.length - this.shown.length;
    },
    counts(): ReadonlyArray<{state: DossierActionState, count: number}> {
      return dossierActionCounts(this.tiles);
    },
  },
  methods: {
    emblemOf(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    accentOf(party: ReduxParty): string {
      return partyAccent(party);
    },
    artStyle(name: string): Record<string, string> {
      const url = cardArtUrl(name as CardName);
      return {backgroundImage: `url(${url === undefined ? CARD_ART_FALLBACK_URL : cardArtUrlAtTier(url, 'thumb')})`};
    },
  },
});
</script>
