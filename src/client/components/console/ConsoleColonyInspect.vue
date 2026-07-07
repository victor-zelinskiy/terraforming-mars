<template>
  <!--
    CONSOLE COLONY INSPECT (X = «Осмотреть») — the full colony dossier,
    openable for ANY colony at ANY time (read-only; never requires the colony
    to be a legal action target). Explains: what the colony does, how its
    track works (all 7 positions with the live marker + the position a trade
    would actually read), the build/trade/owner-bonus benefits, who built
    here, whose fleet is parked, whether the viewer can trade right now (and
    why not), the payment paths, and — via the shared server preview — where
    a card-resource reward would actually land (targets / auto / lost).
    Button hints live ONLY in the shell's bottom command bar (B = close).
  -->
  <div class="con-task-host con-colinspect" role="dialog" :aria-label="$t('Colony')">
    <div class="con-task-host__backdrop" aria-hidden="true"></div>
    <div class="con-task con-colinspect__frame">
      <header class="con-colinspect__head">
        <div class="con-colinspect__planet" :class="planetClass" aria-hidden="true"></div>
        <div class="con-colinspect__head-text">
          <div class="con-task__kicker">
            <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Colony') }}</span>
          </div>
          <div class="con-task__title">{{ $t(colony.name) }}</div>
          <div class="con-colinspect__desc" v-i18n>{{ metadata.trade.description }}</div>
        </div>
        <span class="con-colinspect__state" :class="colony.isActive ? 'con-colinspect__state--on' : 'con-colinspect__state--off'">
          {{ $t(colony.isActive ? 'Active' : 'Not active yet') }}
        </span>
      </header>

      <div class="con-colinspect__main">
        <!-- ── LEFT: the full 7-position trade track. ──────────────────── -->
        <section class="con-colinspect__track">
          <div class="con-colinspect__section-title">{{ $t('Trade track') }}</div>
          <div v-for="cell in trackRows" :key="cell.index"
               class="con-colinspect__track-row"
               :class="{
                 'con-colinspect__track-row--marker': cell.marker,
                 'con-colinspect__track-row--effective': cell.effective,
               }">
            <span class="con-colinspect__track-num">{{ cell.index + 1 }}</span>
            <span class="con-colinspect__track-reward">
              <span v-if="cell.quantity > 1" class="con-colinspect__track-qty">{{ cell.quantity }}</span>
              <BenefitGlyph :benefit="tradeBenefit(cell.index)" :idx="cell.index" :cardResource="metadata.cardResource" />
            </span>
            <span v-if="cell.marker" class="con-colinspect__track-tag">{{ $t('Marker') }}</span>
            <span v-else-if="cell.effective" class="con-colinspect__track-tag con-colinspect__track-tag--eff">{{ $t('Trade reads here') }}</span>
          </div>
          <div v-if="offsetSteps > 0" class="con-colinspect__note">
            {{ $t('Your trade advances the track first') }} (+{{ offsetSteps }})
          </div>
          <div class="con-colinspect__note con-colinspect__note--muted">
            {{ $t('The marker returns to the built-colony count after a trade and advances each generation') }}
          </div>
        </section>

        <!-- ── RIGHT: benefits, owners, fleet, availability, targets. ──── -->
        <section class="con-colinspect__info">
          <div class="con-colinspect__block">
            <div class="con-colinspect__section-title">{{ $t('Build a colony') }}</div>
            <div class="con-colinspect__benefit">
              <span class="con-colinspect__benefit-glyph">
                <BenefitGlyph :benefit="buildBenefit" :idx="nextBuildSlot" :cardResource="metadata.cardResource" />
              </span>
              <span class="con-colinspect__benefit-desc" v-i18n>{{ metadata.build.description }}</span>
            </div>
            <div class="con-colinspect__slots">
              <span v-for="idx in [0, 1, 2]" :key="idx"
                    class="con-colinspect__slot"
                    :class="{'con-colinspect__slot--taken': colony.colonies[idx] !== undefined}">
                <span v-if="colony.colonies[idx] !== undefined" class="con-coltile__cube" :class="'player_bg_color_' + colony.colonies[idx]"></span>
              </span>
              <span class="con-colinspect__slots-label">{{ ownersLine }}</span>
            </div>
          </div>

          <div class="con-colinspect__block">
            <div class="con-colinspect__section-title">{{ $t('Colony bonus (each trade)') }}</div>
            <div class="con-colinspect__benefit">
              <span class="con-colinspect__benefit-glyph">
                <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
              </span>
              <span class="con-colinspect__benefit-desc" v-i18n>{{ metadata.colony.description }}</span>
            </div>
            <div v-for="owner in owners" :key="owner.color" class="con-colinspect__owner">
              <span :class="'con-status__dot player_bg_color_' + owner.color"></span>
              <span>{{ owner.name }}</span>
              <span v-if="owner.count > 1" class="con-colinspect__owner-mult">×{{ owner.count }}</span>
            </div>
            <div v-if="owners.length === 0" class="con-colinspect__note con-colinspect__note--muted">{{ $t('No colonies built here yet') }}</div>
          </div>

          <div class="con-colinspect__block">
            <div class="con-colinspect__section-title">{{ $t('Trading') }}</div>
            <div v-if="colony.visitor !== undefined" class="con-colinspect__fleet-line">
              <span class="con-coltile__fleet-ship colonies-fleet" :class="'colonies-fleet-' + colony.visitor" aria-hidden="true"></span>
              <span>{{ visitorLine }}</span>
            </div>
            <div class="con-colinspect__verdict" :class="tradeable ? 'con-colinspect__verdict--ok' : 'con-colinspect__verdict--no'">
              <template v-if="tradeable">
                <span class="con-coltile__status-dot" aria-hidden="true"></span>
                <span>{{ $t('Trade available') }}</span>
              </template>
              <template v-else>
                <span aria-hidden="true">✕</span>
                <span>{{ blockReason !== '' ? $t(blockReason) : $t('Trade unavailable') }}</span>
              </template>
            </div>
            <div v-if="paymentChips.length > 0" class="con-colonies__pay con-colinspect__pay">
              <span class="con-colonies__pay-label">{{ $t('Payment') }}</span>
              <span v-for="(chip, i) in paymentChips" :key="i"
                    class="con-colonies__pay-chip"
                    :class="{'con-colonies__pay-chip--off': !chip.available}">
                <i v-if="chip.iconClass !== ''" :class="chip.iconClass" aria-hidden="true"></i>
                <b>{{ chip.amount }}</b>
              </span>
            </div>
          </div>

          <!-- Card-resource targets — the shared server preview's truth. -->
          <div v-if="targetRows.length > 0 || lostCount > 0" class="con-colinspect__block">
            <div class="con-colinspect__section-title">{{ $t('Where the resources go') }}</div>
            <div v-for="(row, i) in targetRows" :key="'t' + i" class="con-colinspect__target">
              <span class="con-colinspect__target-role">{{ $t(row.roleLabel) }}</span>
              <template v-if="row.cards.length > 0">
                <span v-for="card in row.cards" :key="card.name" class="con-colinspect__target-card">
                  <i v-if="row.iconClass !== ''" :class="row.iconClass" aria-hidden="true"></i>
                  <span>{{ $t(card.name) }}</span>
                  <b>{{ card.resources ?? 0 }} → {{ (card.resources ?? 0) + row.amount }}</b>
                </span>
              </template>
              <span v-else class="con-colinspect__target-auto">{{ $t('Chosen when trading') }}</span>
            </div>
            <div v-for="i in lostCount" :key="'l' + i" class="con-colinspect__lost">
              <span aria-hidden="true">!</span>
              <span>{{ $t('No eligible card — this resource would not be added') }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {DisabledOptionModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {fetchColonyTradePreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {colonyOwnerCounts, effectiveTradePosition} from '@/client/components/colonies/colonyTradePlan';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';

type TrackRow = {index: number, quantity: number, marker: boolean, effective: boolean};
type TargetRow = {roleLabel: string, iconClass: string, amount: number, cards: ReadonlyArray<CardModel>};

export default defineComponent({
  name: 'ConsoleColonyInspect',
  components: {BenefitGlyph},
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The viewer's own player id — enables the server target preview. */
    playerId: {type: String, default: ''},
    tradeOffset: {type: Number, default: 0},
    tradeable: {type: Boolean, default: false},
    blockReason: {type: String, default: ''},
    paymentOptions: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    disabledPayments: {type: Array as PropType<ReadonlyArray<DisabledOptionModel>>, default: () => []},
  },
  data() {
    return {
      preview: undefined as ColonyTradePreviewModel | undefined,
    };
  },
  computed: {
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
    },
    /** The build slot the NEXT colony here would occupy (for its bonus glyph). */
    nextBuildSlot(): number {
      return Math.min(this.colony.colonies.length, 2);
    },
    planetClass(): string {
      return this.colony.name.replace(' ', '-') + '-background';
    },
    trackMax(): number {
      return this.metadata.trade.quantity.length - 1;
    },
    effectivePosition(): number {
      const offset = this.colony.isActive ? this.tradeOffset : 0;
      return effectiveTradePosition(this.colony, this.metadata, offset);
    },
    offsetSteps(): number {
      return Math.max(0, this.effectivePosition - Math.min(this.colony.trackPosition, this.trackMax));
    },
    trackRows(): Array<TrackRow> {
      const marker = Math.min(this.colony.trackPosition, this.trackMax);
      const rows: Array<TrackRow> = [];
      for (let i = 0; i <= this.trackMax; i++) {
        rows.push({
          index: i,
          quantity: this.metadata.trade.quantity[i] ?? 0,
          marker: i === marker,
          effective: i === this.effectivePosition && this.effectivePosition !== marker,
        });
      }
      return rows;
    },
    buildBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const b = this.metadata.build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    colonyBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = this.metadata.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    owners(): Array<{color: Color, count: number, name: string}> {
      return colonyOwnerCounts(this.colony).map((owner) => {
        const player = this.players.find((p) => p.color === owner.color);
        return {...owner, name: player !== undefined ? participantDisplayName(player) : owner.color};
      });
    },
    ownersLine(): string {
      return `${this.colony.colonies.length}/3`;
    },
    visitorLine(): string {
      const visitor = this.colony.visitor;
      if (visitor === undefined) {
        return '';
      }
      if (visitor === this.viewerColor) {
        return translateText('Your trade fleet is currently here');
      }
      const player = this.players.find((p) => p.color === visitor);
      if (player !== undefined) {
        return translateTextWithParams('Trade fleet of ${0} is currently here', [participantDisplayName(player)]);
      }
      return translateText('Trade fleet currently here');
    },
    paymentChips(): Array<{iconClass: string, amount: string, available: boolean}> {
      const chips: Array<{iconClass: string, amount: string, available: boolean}> = [];
      for (const option of this.paymentOptions) {
        const meta = option.metadata;
        if (meta?.icon !== undefined) {
          chips.push({iconClass: iconClassFor(meta.icon) + ' con-colonies__pay-icon', amount: String(meta.amount ?? ''), available: true});
        }
      }
      for (const disabled of this.disabledPayments) {
        const meta = disabled.metadata;
        if (meta?.icon !== undefined) {
          chips.push({iconClass: iconClassFor(meta.icon) + ' con-colonies__pay-icon', amount: String(meta.amount ?? ''), available: false});
        }
      }
      return chips;
    },
    targetRows(): Array<TargetRow> {
      const rows: Array<TargetRow> = [];
      for (const followUp of this.preview?.followUps ?? []) {
        if (followUp.kind !== 'cardTarget' || followUp.lost) {
          continue;
        }
        const iconClass = followUp.resource !== undefined ?
          iconClassFor(followUp.resource.toString().toLowerCase().replace(/ /g, '-')) + ' con-colinspect__target-icon' : '';
        rows.push({
          roleLabel: followUp.role === 'tradeReward' ? 'Trade reward' : 'Colony bonus',
          iconClass,
          amount: followUp.amount,
          cards: followUp.pick?.cards ??
            (followUp.auto !== undefined ? [{name: followUp.auto, resources: this.autoTargetResources(followUp.auto)} as CardModel] : []),
        });
      }
      return rows;
    },
    lostCount(): number {
      return (this.preview?.followUps ?? []).filter((f) => f.kind === 'cardTarget' && f.lost).length;
    },
  },
  watch: {
    'colony.name'() {
      this.loadPreview();
    },
  },
  methods: {
    /** BenefitGlyph input for the trade reward at one track position. */
    tradeBenefit(position: number): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const t = this.metadata.trade;
      const resource = Array.isArray(t.resource) ? t.resource[position] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    async loadPreview(): Promise<void> {
      this.preview = undefined;
      const preview = await fetchColonyTradePreview(this.playerId, this.colony.name as ColonyName);
      if (preview !== undefined && preview.colonyName === this.colony.name) {
        this.preview = preview;
      }
    },
    autoTargetResources(cardName: string): number {
      // The auto target is one of the viewer's own tableau cards; its live
      // resource count rides the players model.
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      const card = viewer?.tableau.find((c) => c.name === cardName);
      return card?.resources ?? 0;
    },
  },
  mounted() {
    this.loadPreview();
  },
});
</script>
