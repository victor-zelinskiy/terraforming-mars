<template>
  <!--
    THE COLONY DOSSIER (X = «Осмотреть») — the ONE read of a colony, hosted in
    two places (docs/claude/console/colony-inspect.md):

      · INSIDE the colony workspace (`embedded`): the X stage of the colonies
        section, in the very region the trade stage opens in. The host draws
        the crumb («КОЛОНИИ › ЛУНА › ОСМОТР»); B folds back to the grid; A
        goes ON — «К торговле» — into the trade / build / pick stage for this
        colony, with the planet, the track and the berths physically carried
        over. A is NEVER gated here: the dossier reads, the stage decides.
      · OVER the journal (standalone): a band surface with its own head
        («ЖУРНАЛ › ЛУНА › ОСМОТР»), read-only history — B closes it.

    THE JOB: the LORE, the RULES and the BIG ART — and, since the player is
    one press from acting, WHAT THE ACT WOULD GIVE AND COST. Four zones, no
    scroll on the TV (the composition's whole budget is «fits at 4K and 1080»):

      SIDE (left)     the ARCHIVE ENTRY (the SAME block the card viewer and
                      the party inspect use, fed by colonyLore.ts) with the
                      ACT'S READING right under it: the server's verdict AS
                      INFORMATION (never a gate), what the player receives at
                      the current level and where a card resource lands. The
                      payment paths are deliberately NOT here — they are the
                      trade stage's own configuration (and a card can add
                      paths without limit; a list that grows crowds the lore).
                      The two stand as ONE group centred on the planet's axis,
                      mirrored by the rules panel on the right.
      PLANET (centre) the colony as a physical object: the disc at the size
                      the room allows, the state + the fleet under it, and the
                      TRADE-TRACK INSTRUMENT — the exact component the trade
                      stage resolves on — pinned to the column's foot.
      RULES (right)   the cold-cyan reading panel: the THREE printed rules of
                      the tile (construction, trade income, owner bonus) in
                      the reading face, the recipients under the bonus, and
                      the track rule in one sentence. NOTHING the instrument
                      already draws is restated here (seats, the live reading,
                      the fleet) — two surfaces share a subject only when
                      they answer different questions.

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

        <!-- ═══ SIDE — the archive entry above, the act's reading below ═══ -->
        <aside class="con-colinspect__side">
          <!-- The archive entry has TWO seats and ONE is shown (the host's
               width decides, in CSS): here, at the top of the side column;
               on a narrow host inside the rules panel's scroll, after the
               rules — a starved column clipped it to one line, and a cut
               archive entry is worse than one a scroll reaches. -->
          <div class="con-colinspect__lore con-colinspect__lore--side" data-unfold-late>
            <CardLoreAside :model="loreModel" :nonce="loreNonce" />
          </div>

          <!-- THE ACT'S READING — what A leads to. The verdict is the
               SERVER's (tone and reason), stated as a fact beside the act's
               name; the reward is the reward package every colony surface
               shares. History (the journal) keeps only the level's income. -->
          <section v-if="showAct"
                   class="con-colinspect__act"
                   :class="'con-colinspect__act--' + actIntent"
                   :aria-label="$t(actTitleKey)"
                   data-unfold-late>
            <div class="con-colinspect__act-head">
              <span class="con-colinspect__act-kind">{{ $t(actTitleKey) }}</span>
              <span v-if="!readonly"
                    class="con-colinspect__verdict"
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
              </span>
            </div>

            <!-- ВЫ ПОЛУЧИТЕ — the totals at the level the act reads. -->
            <div class="con-colinspect__act-sec con-colinspect__act-sec--gain">
              <span class="con-colinspect__act-label">{{ $t(readonly ? 'On the current level' : 'You receive') }}</span>
              <template v-for="total in rewardTotals" :key="total.key">
                <div class="con-colinspect__gain">
                  <b class="con-colinspect__gain-amount">+{{ total.amount }}</b>
                  <span class="con-colinspect__gain-glyph" :class="{'con-colinspect__gain-glyph--prod': total.production}">
                    <i v-if="total.icon !== undefined" :class="rewardIconClass(total.icon)" aria-hidden="true"></i>
                    <span v-else class="con-colinspect__gain-label">{{ $t(total.label ?? '') }}</span>
                  </span>
                  <em v-if="total.cardDestination && cardTargetLines.length > 0" class="con-colinspect__gain-dest">
                    {{ $t(cardTargetLines.length > 1 ? 'To these cards:' : 'To this card:') }}
                  </em>
                  <em v-else-if="total.destinationKey !== undefined" class="con-colinspect__gain-dest">{{ $t(total.destinationKey) }}</em>
                </div>
                <!-- …and the cards themselves, under the total they explain
                     (the shared preview's own before → after). -->
                <div v-if="total.cardDestination && cardTargetLines.length > 0" class="con-colinspect__gain-cards">
                  <span v-for="line in cardTargetLines" :key="line.card" class="con-colinspect__gain-card">
                    <i v-if="line.iconClass !== ''" :class="line.iconClass" aria-hidden="true"></i>
                    <span class="con-colinspect__gain-card-name">{{ cardLabel(line.card) }}</span>
                    <em>{{ line.before }} → {{ line.after }}</em>
                  </span>
                </div>
              </template>
              <p v-if="rewardTotals.length === 0" class="con-colinspect__muted">{{ $t('No reward at this level') }}</p>
              <div v-if="lostCount > 0" class="con-colinspect__lost">
                <span aria-hidden="true">!</span>
                <span>{{ $t('Resource will be lost — no card') }}</span>
              </div>
              <p v-if="actIntent !== 'build' && offsetSteps > 0" class="con-colinspect__note con-colinspect__note--gain">
                {{ $t('Your trade advances the track first') }} <b>+{{ offsetSteps }}</b>
              </p>
            </div>
          </section>
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
            <span class="con-colinspect__fleetline" :class="{'con-colinspect__fleetline--none': colony.visitor === undefined}">
              <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
              <span>{{ colony.visitor === undefined ? $t('No trade fleet here') : visitorLine }}</span>
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

        <!-- ═══ RULES — the reading panel: the tile's three printed rules ═══ -->
        <aside class="con-colinspect__rules" data-unfold-item :aria-label="$t('Rules')">
          <div class="con-colinspect__rules-head" data-unfold-late>
            <span class="con-colinspect__rules-mark" aria-hidden="true">§</span>
            <span class="con-colinspect__rules-title">{{ $t('Rules') }}</span>
          </div>
          <ConsoleScrollArea ref="scroll" class="con-colinspect__rules-scroll" axis="y">
            <div class="con-colinspect__rules-body">
              <!-- ПОСТРОЙКА — the placement grant (the berths draw the seats). -->
              <section class="con-colinspect__group con-colinspect__group--build" data-unfold-late>
                <span class="con-colinspect__kind">{{ $t('Construction') }}</span>
                <div class="con-colinspect__line">
                  <span class="con-colinspect__glyph">
                    <BenefitGlyph :benefit="buildBenefit" :idx="nextBuildSlot" :cardResource="metadata.cardResource" />
                  </span>
                  <p class="con-colinspect__text" v-i18n>{{ metadata.build.description }}</p>
                </div>
              </section>

              <!-- ТОРГОВЫЙ ДОХОД — the printed rule (the instrument shows the level). -->
              <section class="con-colinspect__group con-colinspect__group--trade" data-unfold-late>
                <span class="con-colinspect__kind">{{ $t('Trade income') }}</span>
                <div class="con-colinspect__line">
                  <span class="con-colinspect__glyph">
                    <BenefitGlyph :benefit="tradeBenefitNow" :idx="effectivePosition" :cardResource="metadata.cardResource" />
                  </span>
                  <p class="con-colinspect__text" v-i18n>{{ metadata.trade.description }}</p>
                </div>
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
                <div class="con-colinspect__owners">
                  <div v-for="owner in owners" :key="owner.color"
                       class="con-colinspect__owner"
                       :class="{'con-colinspect__owner--you': owner.color === viewerColor}">
                    <span :class="'con-status__dot player_bg_color_' + owner.color" aria-hidden="true"></span>
                    <span class="con-colinspect__owner-name">{{ owner.name }}</span>
                    <em v-if="owner.count > 1" class="con-colinspect__owner-mult">×{{ owner.count }}</em>
                    <b v-if="bonusQty > 0" class="con-colinspect__owner-total">+{{ owner.count * bonusQty }}</b>
                  </div>
                  <p v-if="owners.length === 0" class="con-colinspect__muted">{{ $t('No colonies built here yet') }}</p>
                </div>
              </section>

              <!-- The track rule, as a closing note — the instrument DRAWS it
                   (the guard bars, the stop); this is the one sentence for a
                   player who wants it in words. -->
              <p class="con-colinspect__note con-colinspect__note--rule" data-unfold-late>
                {{ $t('The marker returns to the built-colony count after a trade and advances each generation') }}
              </p>
              <!-- The archive entry's NARROW-HOST seat (see the side column). -->
              <div class="con-colinspect__lore con-colinspect__lore--inline" data-unfold-late>
                <CardLoreAside :model="loreModel" :nonce="loreNonce" />
              </div>
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
import {ColonyTradeFollowUpModel, ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {buildColonyLoreModel} from '@/client/colonies/colonyLore';
import {LoreModel} from '@/client/cards/cardLore';
import {translateLore} from '@/client/cards/loreTranslate';
import {fetchColonyTradePreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {
  colonyOwnerCounts, colonyRewardPackage, describeBenefit, effectiveTradePosition, isCardDestination,
  rewardDestinationKey, RewardTotal, tradeOutcome,
} from '@/client/components/colonies/colonyTradePlan';
import {presentedColonyModel} from '@/client/console/colonyTrade/consoleColonyTrade';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateText, translateTextWithParams, translateCardName} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {ColonyFocusIntent, setColonyFocusStage} from '@/client/console/consoleColoniesModel';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import CardLoreAside from '@/client/components/card/CardLoreAside.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePlanetDisc from '@/client/components/console/ConsolePlanetDisc.vue';
import ConsoleColonyTrackInstrument, {ColonyTrackBonusMath} from '@/client/components/console/ConsoleColonyTrackInstrument.vue';

type Benefit = {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown};
type CardTargetLine = {card: string, iconClass: string, before: number, after: number};

/** One d-pad / stick step of the rules panel (logical px; scaled by the profile). */
const SCROLL_STEP_PX = 140;

export default defineComponent({
  name: 'ConsoleColonyInspect',
  components: {
    BenefitGlyph, ColonyFleetIcon, CardLoreAside, ConsoleWsHead, ConsoleScrollArea,
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
    /** READ-ONLY history (the journal door): no verdict, no target planning
     *  — and no A. The level's income still reads. */
    readonly: {type: Boolean, default: false},
    /** The act A leads to (the workspace door): names the block, picks the reward. */
    actIntent: {type: String as PropType<ColonyFocusIntent>, default: 'trade'},
    /** That act is genuinely offerable HERE (server truth) — INFORMATION, not a gate. */
    actionAvailable: {type: Boolean, default: false},
    /** The honest reason when it is not ('' when available). */
    blockReason: {type: String, default: ''},
    /** That reason's REGISTER (`AvailabilityBlocker.tone`). */
    blockTone: {type: String as PropType<'warning' | 'danger'>, default: 'danger'},
    /** A pick's DISPLAY label («Build» / «Select»), for the verdict. */
    pickLabel: {type: String, default: ''},
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
    /** The viewer's own settlements here — each pays the colony bonus. */
    ownColonyCount(): number {
      if (this.viewerColor === undefined) {
        return 0;
      }
      return this.colony.colonies.filter((c) => c === this.viewerColor).length;
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
    /** The act block stands on the interactive door always; the journal keeps
     *  the level's income only when the colony is in play (a catalog tile —
     *  not in this game — has no level to read). */
    showAct(): boolean {
      return !this.readonly || this.colony.isActive || this.colony.colonies.length > 0;
    },
    /** The act's NAME on the block («ТОРГОВЛЯ» / «ПОСТРОЙКА» / the pick's verb). */
    actTitleKey(): string {
      if (this.actIntent === 'build') {
        return 'Construction';
      }
      if (this.actIntent === 'pick' && this.pickLabel !== '') {
        return this.pickLabel;
      }
      return 'Trading';
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
    /**
     * WHAT THE PLAYER RECEIVES — the ONE reward derivation every colony
     * surface shares (`tradeOutcome` → `colonyRewardPackage`): the track's
     * income at the level the act reads PLUS the viewer's own settlements'
     * bonuses, merged per type and destination. No payment is chosen yet, so
     * no `current → resulting` is claimed — the stage owns that once a path
     * is dialed. A BUILD reads the placement grant of the next free berth.
     */
    rewardTotals(): ReadonlyArray<RewardTotal> {
      if (this.actIntent === 'build') {
        const b = this.metadata.build;
        const resource = Array.isArray(b.resource) ? b.resource[this.nextBuildSlot] : b.resource;
        const per = describeBenefit(b.type, b.quantity[this.nextBuildSlot] ?? 0, typeof resource === 'string' ? resource : undefined, this.metadata);
        if (per === undefined || per.amount <= 0) {
          return [];
        }
        return [{
          key: 'build',
          icon: per.icon,
          label: per.label,
          amount: per.amount,
          production: per.production,
          destinationKey: rewardDestinationKey(b.type),
          cardDestination: isCardDestination(b.type),
        }];
      }
      const outcome = tradeOutcome({
        metadata: this.metadata,
        rewardPosition: this.effectivePosition,
        payments: [],
        ownColonyCount: this.ownColonyCount,
        flatBonuses: this.preview?.flatBonuses,
        stocks: {},
        production: {},
      });
      return colonyRewardPackage({
        gains: outcome.gains,
        metadata: this.metadata,
        colony: this.colony,
        viewer: this.viewerColor,
      }).totals;
    },
    /** The follow-ups of the act A leads to (the shared server preview). */
    actFollowUps(): ReadonlyArray<ColonyTradeFollowUpModel> {
      if (this.preview === undefined) {
        return [];
      }
      return this.actIntent === 'build' ? (this.preview.buildFollowUps ?? []) : this.preview.followUps;
    },
    /** WHERE a card resource lands — one line per PHYSICAL card, amounts
     *  merged (an income and a bonus aimed at the same card are one row). */
    cardTargetLines(): Array<CardTargetLine> {
      const lines = new Map<string, CardTargetLine>();
      for (const followUp of this.actFollowUps) {
        if (followUp.kind !== 'cardTarget' || followUp.lost) {
          continue;
        }
        const iconClass = followUp.resource !== undefined ?
          iconClassFor(followUp.resource.toString().toLowerCase().replace(/ /g, '-')) + ' con-colinspect__gain-card-icon' : '';
        const cards: ReadonlyArray<CardModel> = followUp.pick?.cards ??
          (followUp.auto !== undefined ? [{name: followUp.auto, resources: this.autoTargetResources(followUp.auto)} as CardModel] : []);
        for (const card of cards) {
          const before = card.resources ?? 0;
          const line = lines.get(card.name);
          if (line === undefined) {
            lines.set(card.name, {card: card.name, iconClass, before, after: before + followUp.amount});
          } else {
            line.after += followUp.amount;
          }
        }
      }
      return [...lines.values()];
    },
    lostCount(): number {
      return this.actFollowUps.filter((f) => f.kind === 'cardTarget' && f.lost).length;
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
    rewardIconClass(icon: string): string {
      return iconClassFor(icon) + ' con-colinspect__gain-icon';
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
    /** The rules panel's one scroll path (↑/↓ and the right stick alike). */
    scrollRules(dy: number): void {
      const scroll = this.$refs.scroll as {scrollByPx?: (dy: number) => void} | undefined;
      scroll?.scrollByPx?.(Math.sign(dy) * SCROLL_STEP_PX * conUiScale());
    },
    /**
     * The pad, while the dossier owns it: ↑/↓ and the right stick scroll the
     * rules panel (a safety net — the composition fits on the TV without
     * one), B leaves (the host decides where to — the grid, or the journal),
     * A goes ON into the act's stage. A is never gated by the dossier: the
     * verdict stands here as information, the stage carries the refusal.
     */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
        this.scrollRules(intent.dy);
        return;
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.scrollRules(intent.dir === 'down' ? 1 : -1);
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
      if (action === 'primary' && !this.readonly) {
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
