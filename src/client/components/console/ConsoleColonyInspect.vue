<template>
  <!--
    THE COLONY DOSSIER (X = «Осмотреть») — the ONE read of a colony, hosted in
    two places (docs/claude/console/colony-inspect.md):

      · INSIDE the colony workspace (`embedded`): the X stage of the colonies
        section, in the very region the trade stage opens in. The host draws
        the crumb («КОЛОНИИ › ЛУНА › ОСМОТР»); B folds back to the grid; A
        ENTERS the action — the trade / build / pick stage for this colony,
        with the planet, the track and the berths physically carried over.
      · OVER the journal (standalone): a band surface with its own head
        («ЖУРНАЛ › ЛУНА › ОСМОТР»), read-only history — B closes it.

    COMPOSITION — the fullscreen card viewer's three-zone grammar:

      LORE (left)     the archive entry — the SAME block the card viewer and
                      the party inspect use (CardLoreAside), fed by the colony
                      resolver (colonyLore.ts): warm ivory, no panel.
      PLANET (centre) the colony as a physical object: the disc at the size
                      the room allows, the state + the fleet under it, and the
                      TRADE-TRACK INSTRUMENT — the exact component the trade
                      stage resolves on — pinned to the column's foot.
      RULES (right)   the cold-cyan reading panel: one group per rule, kind
                      chips, sentences in the reading face. The instrument
                      draws the MECHANISM (the rate × the seated cubes); this
                      panel names the RECIPIENTS — two panels share a subject
                      only when they answer different questions.

    READ-ONLY by construction: it submits nothing and captures nothing; A only
    re-routes into the stage the grid's A would have opened. Button hints live
    ONLY in the shell's bottom command bar.

    MOTION: the dossier publishes exactly the marks the colony descend
    choreography reads (`data-unfold-surface` / `-edge` / `-item` / `-late`,
    `data-colony-focus-planet` / `-track` / `-slots`), so the grid → dossier
    unfold, the carry of the three identities, the two reveal waves and the
    fold back are the focus stage's own hooks — no dossier-specific director.
  -->
  <div class="con-colinspect"
       ref="rootEl"
       :class="{
         'con-ws': !embedded,
         'con-colinspect--standalone': !embedded,
         'con-colinspect--embedded': embedded,
         'con-colinspect--readonly': readonly,
       }"
       role="dialog"
       :aria-label="$t(colony.name)"
       :data-motion-surface="embedded ? undefined : 'colony-inspect'">
    <div class="con-colinspect__frame" :data-motion-panel="embedded ? undefined : ''">
      <!-- The standalone head — the host's crumb when hosted (rule 5). -->
      <ConsoleWsHead v-if="!embedded"
                     class="con-colinspect__head"
                     :root="hostRoot"
                     :subject="colony.name"
                     stage="Inspection" />

      <div class="con-colinspect__surface" data-unfold-surface>
        <!-- THE EDGE — a separate inert layer, formed AFTER the opening (see
             the focus stage: a ring painted from the first frame can only
             arrive as a finished rectangle). -->
        <span class="con-colinspect__edge" data-unfold-edge aria-hidden="true"></span>

        <!-- ═══ LORE — the archive entry ═══ -->
        <aside class="con-colinspect__lore" data-unfold-late>
          <CardLoreAside :model="loreModel" :nonce="loreNonce" />
        </aside>

        <!-- ═══ HERO — the colony as a physical object ═══ -->
        <section class="con-colinspect__hero">
          <div class="con-colinspect__planetwrap">
            <!-- THE CARD SOURCE: a card payout that lands while the dossier is
                 up (a remote trade's delivery) is born at the colony, exactly
                 as on the stage. -->
            <ConsolePlanetDisc class="con-colinspect__planet"
                               :colony="colony.name"
                               :lit="true"
                               data-colony-focus-planet
                               :data-colony-card-source="colony.name">
              <!-- THE ORBITAL BERTH — the fleet's live landing anchor while
                   the dossier is up (the same data key the tile's dock and
                   the stage's orbit carry; the ladders prefer the big one). -->
              <span class="con-colinspect__orbit"
                    :data-fleet-berth="colony.name"
                    :class="colony.visitor !== undefined ? ['con-colinspect__orbit--occupied', 'fleet-hue--' + colony.visitor] : []"
                    aria-hidden="true">
                <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
              </span>
            </ConsolePlanetDisc>
          </div>
          <div class="con-colinspect__status" data-unfold-late>
            <span class="con-colinspect__state"
                  :class="colony.isActive ? 'con-colinspect__state--on' : 'con-colinspect__state--off'">
              {{ $t(colony.isActive ? 'Active colony' : 'Not active yet') }}
            </span>
            <span v-if="visitorLine !== ''" class="con-colinspect__fleetline">
              <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
              <span>{{ visitorLine }}</span>
            </span>
          </div>
          <!-- THE INSTRUMENT — the resting object: no latch, no settle, no
               build preview; the marker and the read position are the live
               ones (frozen behind a running transaction like everywhere). -->
          <ConsoleColonyTrackInstrument class="con-colinspect__instrument"
                                        :colony="colony"
                                        :metadata="metadata"
                                        :markerPosition="markerPosition"
                                        :effectivePosition="effectivePosition"
                                        :ownerNames="ownerNames"
                                        :bonusMath="bonusMath"
                                        :viewerColor="viewerColor" />
        </section>

        <!-- ═══ RULES — the reading panel ═══ -->
        <aside class="con-colinspect__rules" data-unfold-item :aria-label="$t('Rules')">
          <div class="con-colinspect__rules-head" data-unfold-late>
            <span class="con-colinspect__rules-mark" aria-hidden="true">§</span>
            <span class="con-colinspect__rules-title">{{ $t('Rules') }}</span>
          </div>
          <ConsoleScrollArea ref="scroll" class="con-colinspect__rules-scroll" axis="y">
            <div class="con-colinspect__rules-body">
              <!-- ПОСТРОЙКА — the placement grant + the seats. -->
              <section class="con-colinspect__group con-colinspect__group--build" data-unfold-late>
                <span class="con-colinspect__kind">{{ $t('Construction') }}</span>
                <div class="con-colinspect__line">
                  <span class="con-colinspect__glyph">
                    <BenefitGlyph :benefit="buildBenefit" :idx="nextBuildSlot" :cardResource="metadata.cardResource" />
                  </span>
                  <p class="con-colinspect__text" v-i18n>{{ metadata.build.description }}</p>
                </div>
                <div class="con-colinspect__meta">
                  <span class="con-colinspect__seats" aria-hidden="true">
                    <span v-for="idx in [0, 1, 2]" :key="idx"
                          class="con-colinspect__seat"
                          :class="{'con-colinspect__seat--taken': colony.colonies[idx] !== undefined}">
                      <PlayerCube v-if="colony.colonies[idx] !== undefined" :color="colony.colonies[idx]" :size="14" />
                    </span>
                  </span>
                  <span class="con-colinspect__meta-text">{{ $t('Free slots') }}: {{ 3 - colony.colonies.length }}</span>
                </div>
              </section>

              <!-- ТОРГОВЫЙ ДОХОД — the printed rule + what a trade reads NOW. -->
              <section class="con-colinspect__group con-colinspect__group--trade" data-unfold-late>
                <span class="con-colinspect__kind">{{ $t('Trade income') }}</span>
                <div class="con-colinspect__line">
                  <span class="con-colinspect__glyph">
                    <BenefitGlyph :benefit="tradeBenefitNow" :idx="effectivePosition" :cardResource="metadata.cardResource" />
                  </span>
                  <p class="con-colinspect__text" v-i18n>{{ metadata.trade.description }}</p>
                </div>
                <div class="con-colinspect__now">
                  <span class="con-colinspect__now-label">{{ $t('Now') }}</span>
                  <span v-if="rewardNow.quantity > 0" class="con-colinspect__now-value">
                    <b>+{{ rewardNow.quantity }}</b>
                    <span class="con-colinspect__now-glyph">
                      <BenefitGlyph :benefit="tradeBenefitNow" :idx="effectivePosition" :cardResource="metadata.cardResource" />
                    </span>
                  </span>
                  <span v-else class="con-colinspect__muted">{{ $t('No reward at this level') }}</span>
                  <span class="con-colinspect__now-pos">{{ $t('Trade track') }} {{ effectivePosition + 1 }}/{{ trackMax + 1 }}</span>
                </div>
                <p v-if="offsetSteps > 0" class="con-colinspect__note con-colinspect__note--gain">
                  {{ $t('Your trade advances the track first') }} <b>+{{ offsetSteps }}</b>
                </p>
              </section>

              <!-- БОНУС ВЛАДЕЛЬЦА — the printed rule + WHO receives what. -->
              <section class="con-colinspect__group con-colinspect__group--bonus" data-unfold-late>
                <span class="con-colinspect__kind">{{ $t('Owner bonus') }}</span>
                <div class="con-colinspect__line">
                  <span class="con-colinspect__glyph">
                    <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
                  </span>
                  <p class="con-colinspect__text" v-i18n>{{ metadata.colony.description }}</p>
                </div>
                <div v-for="owner in owners" :key="owner.color" class="con-colinspect__owner">
                  <span :class="'con-status__dot player_bg_color_' + owner.color" aria-hidden="true"></span>
                  <span class="con-colinspect__owner-name">{{ owner.name }}</span>
                  <em v-if="owner.count > 1" class="con-colinspect__owner-mult">×{{ owner.count }}</em>
                  <b v-if="bonusQty > 0" class="con-colinspect__owner-total">+{{ owner.count * bonusQty }}</b>
                </div>
                <p v-if="owners.length === 0" class="con-colinspect__muted">{{ $t('No colonies built here yet') }}</p>
              </section>

              <!-- ФЛОТ — who is parked here. -->
              <section class="con-colinspect__group con-colinspect__group--fleet" data-unfold-late>
                <span class="con-colinspect__kind">{{ $t('Fleet') }}</span>
                <div class="con-colinspect__line con-colinspect__line--fleet">
                  <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
                  <p class="con-colinspect__text" :class="{'con-colinspect__text--muted': colony.visitor === undefined}">
                    {{ colony.visitor === undefined ? $t('No trade fleet here') : visitorLine }}
                  </p>
                </div>
              </section>

              <!-- ДОСТУПНОСТЬ — the interactive door only: the server's own
                   verdict on the act A would enter, with its tone, and every
                   payment path — affordable AND not (the full picture, never
                   hidden). History (the journal) has no verdict. -->
              <section v-if="!readonly" class="con-colinspect__group con-colinspect__group--avail" data-unfold-late>
                <span class="con-colinspect__kind">{{ $t('Availability') }}</span>
                <div class="con-colinspect__verdict"
                     :class="actionAvailable ? 'con-colinspect__verdict--ok' :
                       (blockTone === 'warning' ? 'con-colinspect__verdict--notnow' : 'con-colinspect__verdict--no')">
                  <template v-if="actionAvailable">
                    <span class="con-colinspect__verdict-dot" aria-hidden="true"></span>
                    <span>{{ $t(verdictKey) }}</span>
                  </template>
                  <template v-else>
                    <span aria-hidden="true">{{ blockTone === 'warning' ? '⏳' : '✕' }}</span>
                    <span>{{ blockReason !== '' ? $t(blockReason) : $t('Trade unavailable') }}</span>
                  </template>
                </div>
                <div v-if="paymentRows.length > 0" class="con-colinspect__paytable">
                  <div v-for="(row, i) in paymentRows" :key="i"
                       class="con-colinspect__payrow"
                       :class="{'con-colinspect__payrow--off': !row.available}">
                    <i v-if="row.iconClass !== ''" class="con-colinspect__payrow-icon" :class="row.iconClass" aria-hidden="true"></i>
                    <span class="con-colinspect__payrow-title">{{ row.title }}</span>
                    <span v-if="row.available" class="con-colinspect__payrow-delta">{{ row.preview }}</span>
                    <span v-else class="con-colinspect__payrow-reason">{{ row.reason }}</span>
                  </div>
                </div>
              </section>

              <!-- КУДА ПОПАДУТ РЕСУРСЫ — the shared server preview's truth
                   (interactive door only; the journal is history, not planning). -->
              <section v-if="!readonly && (targetRows.length > 0 || lostCount > 0)"
                       class="con-colinspect__group con-colinspect__group--targets" data-unfold-late>
                <span class="con-colinspect__kind">{{ $t('Where the resources go') }}</span>
                <div v-for="(row, i) in targetRows" :key="'t' + i" class="con-colinspect__target">
                  <span class="con-colinspect__target-role">{{ $t(row.roleLabel) }}</span>
                  <template v-if="row.cards.length > 0">
                    <span v-for="card in row.cards" :key="card.name" class="con-colinspect__target-card">
                      <i v-if="row.iconClass !== ''" :class="row.iconClass" aria-hidden="true"></i>
                      <span>{{ cardLabel(card.name) }}</span>
                      <b>{{ card.resources ?? 0 }} → {{ (card.resources ?? 0) + row.amount }}</b>
                    </span>
                  </template>
                  <span v-else class="con-colinspect__target-auto">{{ $t('Chosen when trading') }}</span>
                </div>
                <div v-for="i in lostCount" :key="'l' + i" class="con-colinspect__lost">
                  <span aria-hidden="true">!</span>
                  <span>{{ $t('No eligible card — this resource would not be added') }}</span>
                </div>
              </section>

              <!-- The track rule, as a closing note — the instrument DRAWS it
                   (the guard bars, the stop); this is the one sentence for a
                   player who wants it in words. -->
              <p class="con-colinspect__note con-colinspect__note--rule" data-unfold-late>
                {{ $t('The marker returns to the built-colony count after a trade and advances each generation') }}
              </p>
            </div>
          </ConsoleScrollArea>
        </aside>
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
import {buildColonyLoreModel} from '@/client/colonies/colonyLore';
import {LoreModel} from '@/client/cards/cardLore';
import {translateLore} from '@/client/cards/loreTranslate';
import {fetchColonyTradePreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {colonyOwnerCounts, effectiveTradePosition, rewardAtPosition, TradeRewardAt} from '@/client/components/colonies/colonyTradePlan';
import {presentedColonyModel} from '@/client/console/colonyTrade/consoleColonyTrade';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateMessage, translateText, translateTextWithParams, translateCardName} from '@/client/directives/i18n';
import {Message} from '@/common/logs/Message';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {ColonyFocusIntent, setColonyFocusStage} from '@/client/console/consoleColoniesModel';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import CardLoreAside from '@/client/components/card/CardLoreAside.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePlanetDisc from '@/client/components/console/ConsolePlanetDisc.vue';
import ConsoleColonyTrackInstrument, {ColonyTrackBonusMath} from '@/client/components/console/ConsoleColonyTrackInstrument.vue';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

type Benefit = {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown};
type TargetRow = {roleLabel: string, iconClass: string, amount: number, cards: ReadonlyArray<CardModel>};
type PayRow = {iconClass: string, title: string, preview: string, reason: string, available: boolean};

/** One d-pad step of the rules panel (logical px; scaled by the profile). */
const SCROLL_STEP_PX = 140;

export default defineComponent({
  name: 'ConsoleColonyInspect',
  components: {
    BenefitGlyph, ColonyFleetIcon, PlayerCube, CardLoreAside, ConsoleWsHead, ConsoleScrollArea,
    ConsolePlanetDisc, ConsoleColonyTrackInstrument,
  },
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The viewer's own player id — enables the server target preview. */
    playerId: {type: String, default: ''},
    tradeOffset: {type: Number, default: 0},
    /**
     * A STEP of a workspace (rule 1 — host-agnostic): the shell chrome (the
     * band, the plate, the head, the `con-ws` marker, the motion id) comes
     * off; the composition, the input path and every anchor are untouched.
     */
    embedded: {type: Boolean, default: false},
    /** The crumb root of the STANDALONE host (the journal door). */
    hostRoot: {type: String, default: 'Journal'},
    /** READ-ONLY history (the journal door): no verdict, no payment table,
     *  no target planning — and no A. */
    readonly: {type: Boolean, default: false},
    /** The act A would ENTER (the workspace door): decides the verdict's word. */
    actIntent: {type: String as PropType<ColonyFocusIntent>, default: 'trade'},
    /** That act is genuinely offerable HERE (server truth). */
    actionAvailable: {type: Boolean, default: false},
    /** The honest reason when it is not ('' when available). */
    blockReason: {type: String, default: ''},
    /** That reason's REGISTER (`AvailabilityBlocker.tone`). */
    blockTone: {type: String as PropType<'warning' | 'danger'>, default: 'danger'},
    /** A pick's DISPLAY label («Build» / «Select»), for the verdict. */
    pickLabel: {type: String, default: ''},
    paymentOptions: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    disabledPayments: {type: Array as PropType<ReadonlyArray<DisabledOptionModel>>, default: () => []},
  },
  emits: ['cancel', 'enter'],
  data() {
    return {
      preview: undefined as ColonyTradePreviewModel | undefined,
      /** The archive block's settle signal: 0 until the dossier has mounted,
       *  then 1 — the block reveals once, under the entrance's late wave. */
      loreNonce: 0,
    };
  },
  computed: {
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
    },
    loreModel(): LoreModel {
      return buildColonyLoreModel(this.colony.name, translateLore);
    },
    /** The colony as PRESENTED: a running transaction keeps the committed
     *  track reset frozen (the same helper the tile and the stage read). */
    presented(): ColonyModel {
      return presentedColonyModel(this.colony);
    },
    trackMax(): number {
      return this.metadata.trade.quantity.length - 1;
    },
    markerPosition(): number {
      return Math.min(this.presented.trackPosition, this.trackMax);
    },
    effectivePosition(): number {
      const offset = this.colony.isActive ? this.tradeOffset : 0;
      return effectiveTradePosition(this.presented, this.metadata, offset);
    },
    offsetSteps(): number {
      return Math.max(0, this.effectivePosition - this.markerPosition);
    },
    rewardNow(): TradeRewardAt {
      return rewardAtPosition(this.metadata, this.effectivePosition);
    },
    tradeBenefitNow(): Benefit {
      const t = this.metadata.trade;
      const resource = Array.isArray(t.resource) ? t.resource[this.effectivePosition] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    nextBuildSlot(): number {
      return Math.min(this.colony.colonies.length, 2);
    },
    buildBenefit(): Benefit {
      const b = this.metadata.build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    colonyBenefit(): Benefit {
      const c = this.metadata.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    bonusQty(): number {
      return this.metadata.colony.quantity ?? 1;
    },
    owners(): Array<{color: Color, count: number, name: string}> {
      return colonyOwnerCounts(this.colony).map((owner) => {
        const player = this.players.find((p) => p.color === owner.color);
        return {...owner, name: player !== undefined ? participantDisplayName(player) : owner.color};
      });
    },
    /** The names seated in the three berths (the instrument's prop). */
    ownerNames(): Array<string> {
      return [0, 1, 2].map((idx) => {
        const color = this.colony.colonies[idx];
        if (color === undefined) {
          return '';
        }
        const player = this.players.find((p) => p.color === color);
        return player !== undefined ? participantDisplayName(player) : color;
      });
    },
    /** The multiplier row the instrument draws — the same rule as the stage:
     *  the viewer's own stake when they stand here, else the largest holder;
     *  only when the count genuinely changes the number. */
    bonusMath(): ColonyTrackBonusMath | undefined {
      const mine = this.viewerColor === undefined ? undefined : this.owners.find((o) => o.color === this.viewerColor);
      const subject = mine ?? [...this.owners].sort((a, b) => b.count - a.count)[0];
      if (subject === undefined || subject.count < 2 || this.bonusQty <= 0) {
        return undefined;
      }
      return {color: subject.color, count: subject.count, total: subject.count * this.bonusQty};
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
    /** The verdict's word when the act IS offerable — the act's own verb. */
    verdictKey(): string {
      if (this.actIntent === 'build') {
        return 'Build here';
      }
      if (this.actIntent === 'pick') {
        return this.pickLabel !== '' ? this.pickLabel : 'Can select';
      }
      return 'Trade available';
    },
    /** EVERY payment path — affordable with `current → resulting`, the rest
     *  disabled with the server reason (the full picture, never hidden). */
    paymentRows(): Array<PayRow> {
      const rows: Array<PayRow> = [];
      for (const option of this.paymentOptions) {
        const meta = option.metadata;
        const res = meta?.resource;
        rows.push({
          iconClass: meta?.icon !== undefined ? iconClassFor(meta.icon) + ' con-colinspect__pay-icon' : '',
          title: textOf(option.title),
          preview: res !== undefined ? `${res.current} → ${res.resulting}` : '',
          reason: '',
          available: true,
        });
      }
      for (const disabled of this.disabledPayments) {
        rows.push({
          iconClass: disabled.metadata?.icon !== undefined ? iconClassFor(disabled.metadata.icon) + ' con-colinspect__pay-icon' : '',
          title: textOf(disabled.title),
          preview: '',
          reason: textOf(disabled.reason),
          available: false,
        });
      }
      return rows;
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
    /** Localized card name, tolerating a `Name:variant` id (drops the suffix). */
    cardLabel(name: string): string {
      return translateCardName(name);
    },
    async loadPreview(): Promise<void> {
      this.preview = undefined;
      if (this.readonly || this.playerId === '') {
        return;
      }
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
    /**
     * The pad, while the dossier owns it: ↑/↓ scroll the rules panel, B
     * leaves (the host decides where to — the grid, or the journal), A ENTERS
     * the action — only when it is genuinely offered (the bar shows the verb
     * disabled otherwise, and the reason stands in the ДОСТУПНОСТЬ group).
     */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          const scroll = this.$refs.scroll as {scrollByPx?: (dy: number) => void} | undefined;
          scroll?.scrollByPx?.((intent.dir === 'down' ? 1 : -1) * SCROLL_STEP_PX * conUiScale());
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      const action = consoleActionOf(intent);
      if (action === 'back') {
        this.$emit('cancel');
        return;
      }
      if (action === 'primary' && !this.readonly && this.actionAvailable) {
        this.$emit('enter');
      }
    },
  },
  mounted() {
    // Hosted: the dossier hands its stage name UP (rule 5 — it never draws
    // its own kicker): «КОЛОНИИ › ЛУНА › ОСМОТР».
    if (this.embedded) {
      setColonyFocusStage('Inspection');
    }
    this.loadPreview();
    // The archive block reveals once the dossier stands (the entrance's late
    // wave holds the whole lore column until the geometry has stopped).
    void this.$nextTick(() => {
      this.loreNonce = 1;
    });
  },
});
</script>
