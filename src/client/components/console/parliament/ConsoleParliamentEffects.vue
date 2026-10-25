<template>
  <!-- ══ «ВАШИ ЭФФЕКТЫ» (Парламент v8 «Пленарный зал», docs/TURMOIL_REDUX_PARLIAMENT_V8_PLAN.md § 6) — under BOTH the
       opposition's benches and the government's dais, across the whole chamber: what the parliament gives the viewer
       for as long as it stands — the ruling party's effect (everyone's), the parties whose effect the viewer holds
       (by delegates or a card's grant), their actions, and the enacted law's STANDING part (its passive, its action;
       the enactment's one-time rows are never printed here). One tile per SOURCE; the tiles SCALE with their count
       (1–2 large · 3 in a row · 4 as 2×2 · 5+ compact 3×2 — `effectsTileSize`). A focus stop of its own: A opens the
       full list as an inner step (§ 6). A spectator holds nothing and the block is not drawn. ══ -->
  <div v-if="items.length > 0"
       class="con-parl__effects"
       :class="['con-parl__effects--' + size, {'con-parl__effects--focus': focused}]"
       data-parl-effects
       :data-parl-effects-count="items.length">
    <div class="con-parl__effects-head">
      <!-- THE ACCESS SCENE (2026-10-25): the zone's own head says what just happened — «Эффект партии получен» — from
           the seal's touchdown to the leave; keyed, so the change is its own one-shot entry (never a blink of text). -->
      <span v-if="accessWon" key="won" class="con-parl__effects-kicker con-parl__effects-kicker--won" data-parl-effects-won>
        <svg class="con-parl__effects-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.4 6.5 12 13 4.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>{{ $t('Party effect gained') }}
      </span>
      <span v-else key="kicker" class="con-parl__effects-kicker">{{ $t('Your effects') }}</span>
      <span class="con-parl__effects-sum">
        <span v-if="readyActions > 0" class="con-parl__effects-sum-item con-parl__effects-sum-item--action" data-parl-effects-ready="">
          <svg class="con-parl__effects-bolt" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.6 1 3.4 9.1h3.9L6.2 15l6.4-8.4H8.6z" /></svg><b>{{ readyActions }}</b>
        </span>
        <span v-if="standing > 0" class="con-parl__effects-sum-item">
          <svg class="con-parl__effects-inf" viewBox="0 0 24 12" aria-hidden="true"><path d="M6 1.5a4.5 4.5 0 1 0 0 9c3.6 0 8.4-9 12-9a4.5 4.5 0 1 1 0 9C14.4 10.5 9.6 1.5 6 1.5z" /></svg><b>{{ standing }}</b>
        </span>
      </span>
    </div>
    <div class="con-parl__effects-grid" :style="{'--con-parl-effects-n': String(Math.min(items.length, size === 's' ? 3 : items.length))}">
      <div v-for="item in items" :key="item.key"
           class="con-parl__effects-row"
           :class="['con-parl__effects-row--' + item.why, {
             'con-parl__effects-row--law': item.kind === 'law',
             'con-parl__effects-row--arriving': arriving(item),
             'con-parl__effects-row--won': won(item),
           }]"
           :data-party="item.party"
           :data-parl-effects-arrival="arriving(item) ? 'arriving' : won(item) ? 'won' : undefined"
           :style="{'--parl-accent': partyAccent(item.party)}">
        <div class="con-parl__effects-tilehead">
          <span class="con-parl__effects-seal">
            <img class="con-parl__effects-emblem" :src="emblemUrl(item.party)" alt="" />
            <!-- THE KIND IS A MARK, NEVER A WORD (the owner, 2026-10-19): an action rides the seal as a bolt in its state's
                 colour (ready amber · used ✓ · not now dim); a standing effect needs no mark — the block's ∞ counts them. -->
            <span v-if="item.action !== undefined" class="con-parl__effects-badge" :class="'con-parl__effects-badge--' + item.action"
                  :data-parl-effects-action="item.action" aria-hidden="true">
              <svg v-if="item.action !== 'used'" viewBox="0 0 16 16"><path d="M9.6 1 3.4 9.1h3.9L6.2 15l6.4-8.4H8.6z" /></svg>
              <svg v-else viewBox="0 0 16 16"><path d="M3 8.4 6.5 12 13 4.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </span>
          </span>
          <span class="con-parl__effects-name">{{ item.kind === 'law' ? $t(item.lawName ?? '') : $t(partyNameKey(item.party)) }}</span>
          <!-- WHY it is yours, by a MARK: the ruler's crown (everyone's), your two delegates, a card's grant, the law. -->
          <span class="con-parl__effects-why" :class="'con-parl__effects-why--' + item.why" :data-parl-effects-why="item.why" :aria-label="$t(whyKey(item.why))">
            <template v-if="item.why === 'ruling'">
              <svg class="con-parl__effects-crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 13 3.5 4l5 4.5L12 1.5l3.5 7L20.5 4 22 13z" /><rect x="2" y="13.6" width="20" height="2" rx="1" /></svg>
            </template>
            <template v-else-if="item.why === 'delegates'">
              <span v-for="n in 2" :key="n" class="con-parl__effects-place" aria-hidden="true"><PlayerDelegate v-if="viewerColor !== undefined" :color="viewerColor" :size="figurePx(18)" :glow="false" /></span>
            </template>
            <!-- TR62: BY THE ALLIANCE — the PARTNER's small emblem with the link beside it (the badge of the seals). -->
            <template v-else-if="item.why === 'alliance' && item.via !== undefined">
              <span class="con-parl__effects-ally" :style="{backgroundImage: `url(${emblemUrl(item.via)})`}" :data-parl-effects-via="item.via" aria-hidden="true"></span>
              <span class="con-parl__effects-link" aria-hidden="true"></span>
            </template>
            <i v-else-if="item.why === 'granted'" class="con-parl__card-mark resource_icon resource_icon--cards" aria-hidden="true"></i>
            <i v-else class="con-parl__card-mark resource_icon resource_icon--cards" aria-hidden="true"></i>
          </span>
        </div>
        <div class="con-parl__effects-formula">
          <ConsolePartyFormula v-if="item.kind === 'party'" :party="item.party" size="compact" />
          <PremiumMechanicsPanel v-else-if="item.lawMechanics !== undefined" class="con-parl__effects-law" :mechanics="item.lawMechanics"
                                 data-parl-enacted-effect :data-parl-enacted-part="item.lawPart"
                                 :aria-label="$t(item.lawPart === 'action' ? 'Resolution action' : 'Resolution effect')" />
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {ParliamentViewVm, PartyActionStateVm} from '@/client/console/parliament/consoleParliamentModel';
import {EffectItem, effectsTileSize, EffectsTileSize, EffectWhy, parliamentEffectItems} from '@/client/console/parliament/parliamentEffectsModel';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';

export default defineComponent({
  name: 'ConsoleParliamentEffects',
  components: {ConsolePartyFormula, PlayerDelegate, PremiumMechanicsPanel},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** Index-aligned with `view.parties` (the Section's `partyActionStates`). */
    partyActionStates: {type: Array as PropType<ReadonlyArray<PartyActionStateVm>>, default: () => []},
    resolutionActionState: {type: Object as PropType<PartyActionStateVm | undefined>, default: undefined},
    focused: {type: Boolean, default: false},
  },
  computed: {
    /** THE RULING PARTY AS SHOWN: the previous ruler until the medallions have changed places (the sitting's hold). */
    rulerShown(): ReduxParty {
      return parliamentHolds.rulerBefore ?? this.view.rulingParty;
    },
    enactedShown(): ParliamentViewVm['enacted'] {
      const before = parliamentHolds.govBefore;
      return before !== undefined ? before.enacted : this.view.enacted;
    },
    items(): Array<EffectItem> {
      return parliamentEffectItems({
        view: this.view, ruler: this.rulerShown, enacted: this.enactedShown,
        partyActionStates: this.partyActionStates, resolutionActionState: this.resolutionActionState,
      });
    },
    size(): EffectsTileSize {
      return effectsTileSize(this.items.length);
    },
    /** The access scene's seal has landed in this zone (the head says so until the flow leaves). */
    accessWon(): boolean {
      return parliamentFlow.accessParty !== undefined && (parliamentFlow.accessBeat === 'landed' || parliamentFlow.accessBeat === 'done');
    },
    readyActions(): number {
      return this.items.filter((i) => i.action === 'ready').length;
    },
    standing(): number {
      return this.items.filter((i) => i.effect).length;
    },
  },
  methods: {
    /** The tile the access scene is bringing in: its place is RESERVED (an empty socket) until the seal lands in it. */
    arriving(item: EffectItem): boolean {
      const f = parliamentFlow;
      return item.kind === 'party' && f.accessParty === item.party && (f.accessBeat === 'count' || f.accessBeat === 'return' || f.accessBeat === 'flight');
    },
    /** …and the tile it brought in: unfolded on the touchdown, its kant marking the gain through the read. */
    won(item: EffectItem): boolean {
      return item.kind === 'party' && this.accessWon && parliamentFlow.accessParty === item.party;
    },
    figurePx(logical: number): number {
      return delegateFigurePx(logical);
    },
    whyKey(why: EffectWhy): string {
      switch (why) {
      case 'ruling': return 'for everyone';
      case 'delegates': return 'Your effect';
      case 'granted': return 'Your effect · granted by a card';
      case 'alliance': return 'Your effect · by the alliance';
      default: return 'Resolution effect';
      }
    },
    partyAccent(party: ReduxParty): string {
      return partyAccent(party);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    partyNameKey(party: ReduxParty): string {
      return partyNameKey(party);
    },
  },
});
</script>
