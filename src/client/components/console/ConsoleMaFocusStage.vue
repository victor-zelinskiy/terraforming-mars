<template>
  <div ref="root" class="con-mafocus"
       :class="['con-mafocus--' + kind, {
         'con-mafocus--committing': phase === 'committing',
         'con-mafocus--cere': ceremonyUp,
         // «Offered now» is a MILESTONE semantic (P29) — an award to sponsor stays calm; a kant, never a glow (FB).
         'con-mafocus--avail': available && phase === 'detail' && kind === 'milestone',
         'con-mafocus--go': warmGo,
       }]">
    <div class="con-mafocus__surface" data-unfold-surface>
      <span class="con-mafocus__edge" data-unfold-edge aria-hidden="true"></span>

      <div class="con-mafocus__grid">
        <!-- ── HERO column: the carried emblem + identity. The pedestal is the
             ONE physical object of the whole flow (card → hero → ceremony) —
             its children must be identical in every phase. ── -->
        <div class="con-mafocus__side">
          <div class="con-mafocus__stage" data-ma-focus-hero>
            <MaHeroArt :name="item.name" :kind="kind" class="con-mafocus__hero" />
          </div>
          <div class="con-mafocus__name" data-ma-detail data-unfold-item v-i18n>{{ displayView.displayName }}</div>
          <!-- THE STATE BADGE — ONE short word-pair, never a sentence. It says
               WHICH state this is; the progress block says by how much, and
               the status rail says what the action would do (or why it can't).
               A badge that tried to carry the whole reason («ПОРОГ ДОСТИГНУТ —
               МОЖНО ВЗЯТЬ СЕЙЧАС») outgrew the hero column and was clipped by
               it; the length is the fix, not a smaller font. -->
          <div class="con-mafocus__state" data-ma-detail data-unfold-late>
            <span class="con-mafocus__state-chip" :class="'con-mafocus__state-chip--' + stateTone">
              <span v-if="ownerColor !== ''" class="con-mafocus__dot" :class="'player_bg_color_' + ownerColor" aria-hidden="true"></span>
              <span>{{ $t(stateLabel) }}</span>
            </span>
          </div>

          <!-- YOUR STANDING — the personal fact, and the column's second
               voice. It lived in the dossier as a «Ваш прогресс» block, which
               left the identity column ending at the badge with a void under
               it and made the player's own number one row among the rules.
               Here it belongs to the artefact: this is YOUR reading of it. -->
          <div class="con-mafocus__you" data-ma-detail data-unfold-late>
            <span class="con-mafocus__you-label">{{ $t('You') }}</span>
            <span class="con-mafocus__you-value" :class="{'con-mafocus__you-value--met': kind === 'milestone' && displayView.thresholdMet}">
              <!-- A CONDITION milestone's raw score is no progress: «—» until met, «✓» once — the overview's own reading. -->
              <template v-if="conditionMilestone"><b>{{ item.myReady ? '✓' : '—' }}</b></template>
              <template v-else><b>{{ displayView.myScore }}</b><span v-if="displayView.threshold !== undefined" class="con-mafocus__you-req">/{{ displayView.threshold }}</span></template>
            </span>
            <span v-if="displayView.threshold !== undefined" class="con-mafocus__meter" aria-hidden="true"><i :style="{width: meterWidth}"></i></span>
            <span v-if="standingNote !== ''" class="con-mafocus__you-note" :class="{'con-mafocus__you-note--lead': displayView.raceTone === 'lead' || displayView.raceTone === 'tie'}">{{ standingNote }}</span>
          </div>
        </div>

        <!-- ── DOSSIER column: THREE PLATES, top to bottom, in EVERY mode (FB — the owner's frames: «Условие» floated in
             the middle of an empty column): the rule · what it gives · the race. The column is filled by its plates,
             never centred in a void. ── -->
        <!-- THE DOSSIER and «› ОПЛАТА» (PL-1622) are TWO FACES of one column, crossing by opacity in one grid cell — the
             payment stands in the plates' place when the bill will ask (Helion's heat), never a second surface; the plates
             come back for the commit, so the price flies into the PRINTED price (PL-1621). -->
        <div class="con-mafocus__dossier">
        <div class="con-mafocus__main con-mafocus__face" :class="{'con-mafocus__face--off': payShown}" data-ma-detail>
          <div class="con-mafocus__plate" data-unfold-item data-ma-plate="condition">
            <div class="con-mafocus__block-title">{{ $t('Condition') }}</div>
            <div class="con-mafocus__desc" v-i18n>{{ displayView.description }}</div>
          </div>

          <!-- WHAT IT GIVES — the mechanic truth of the category: a milestone pays its 5 VP the moment it is claimed;
               an award pays nothing now and its places at the end — with the SPONSORSHIP LADDER: every slot's price,
               the sponsors' seats on the funded ones, the next price marked by a kant. -->
          <div class="con-mafocus__plate con-mafocus__gives" data-unfold-item data-ma-plate="gives">
            <div class="con-mafocus__block-title">{{ $t('What it gives') }}</div>
            <div class="con-mafocus__truth" :class="{'con-mafocus__truth--exchange': kind === 'milestone'}">
              <template v-if="kind === 'milestone'">
                <!-- THE EXCHANGE (FE polish — the owner: the price pill, a tiny «→» and a big «+5» did not belong to one
                     another): two EQUAL cells on one chassis — the kicker over the value, one type scale — joined by a
                     drawn link. The price cell is the PRINTED PRICE (PL-1621): the price token is drawn into it. -->
                <div class="con-mafocus__exchange" data-ma-exchange>
                  <span class="con-mafocus__xcell con-mafocus__xcell--price"
                        :data-ma-price-target="charged ? '' : undefined"
                        :data-ma-price-kind="displayView.price.kind">
                    <span class="con-mafocus__xlabel">{{ $t('Cost') }}</span>
                    <span class="con-mafocus__xvalue">
                      <!-- PC01 · GO: a waived price is the table's price struck → 0 + the source's seal; nothing flies into it. -->
                      <ConsoleMaWaivedPrice v-if="displayView.price.kind === 'waived'"
                                            :printed="displayView.price.printed" :waivedBy="displayView.price.waivedBy" />
                      <template v-else-if="displayView.price.kind === 'free'"><b>{{ $t('Free') }}</b></template>
                      <template v-else><b>{{ displayView.cost }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i></template>
                    </span>
                  </span>
                  <span class="con-mafocus__xlink" aria-hidden="true">
                    <svg viewBox="0 0 28 12"><path d="M1 6 H25" /><path d="M20 1.6 L25.4 6 L20 10.4" /></svg>
                  </span>
                  <span class="con-mafocus__xcell con-mafocus__xcell--gain">
                    <span class="con-mafocus__xlabel">{{ $t('Reward') }}</span>
                    <span class="con-mafocus__xvalue con-mafocus__vp-badge"><b>+5</b><span class="con-mafocus__xunit">{{ $t('VP') }}</span></span>
                  </span>
                </div>
                <span class="con-mafocus__truth-note">{{ $t('Milestones grant 5 victory points immediately when claimed.') }}</span>
              </template>
              <template v-else>
                <span class="con-mafocus__truth-note">
                  {{ $t(displayInspect.playersCount > 2 ? 'At game end: 5 VP for 1st place, 2 VP for 2nd.' : 'At game end: 5 VP for 1st place.') }}
                </span>
              </template>
            </div>
            <div v-if="kind === 'award'" class="con-mafocus__ladder" data-ma-ladder>
              <!-- THE THREE TIMES (PC01 · GO): a funded step prints what it WENT for (the server's `paid` — a waived slot
                   reads «0» with its source's seal for every seat), the next step the price with its cause, the steps
                   after it the table's rule — struck to 0 with the seal under a standing waiver. -->
              <span v-for="(step, si) in ladder" :key="si" class="con-mafocus__ladder-step"
                    :class="{'con-mafocus__ladder-step--next': step.next, 'con-mafocus__ladder-step--funded': step.sponsor !== undefined,
                             'con-mafocus__ladder-step--waived': step.reading.kind === 'waived'}"
                    :data-ma-ladder-step="si" :data-ma-price-kind="step.reading.kind"
                    :data-ma-price-target="step.next && step.charged ? '' : undefined">
                <span v-if="step.sponsor !== undefined" class="con-mafocus__dot" :class="'player_bg_color_' + step.sponsor" aria-hidden="true"></span>
                <ConsoleMaWaivedPrice v-if="step.reading.kind === 'waived'" :printed="step.reading.printed" :waivedBy="step.reading.waivedBy" />
                <template v-else-if="step.reading.kind === 'free'"><b>{{ $t('Free') }}</b></template>
                <template v-else>
                  <b>{{ step.reading.price }}</b>
                  <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
                </template>
              </span>
            </div>
            <!-- WHO waived the price, in words ONCE, here (the detail has the room and no corporation face on screen);
                 the overview and the ceremony carry only the seal. -->
            <div v-if="waiverSource !== undefined" class="con-mafocus__waiver" data-ma-waiver :data-ma-waiver-source="waiverSource">
              {{ waiverLine }}
            </div>
          </div>

          <!-- THE RACE — EVERY mode: ranked leader → last with relative bars (the inspect view-model; the engine-
               faithful VP projection). A claimed milestone opens with its HISTORY row (who claimed it) and keeps the
               field's current values under it; an award nobody scores yet says so and ranks nobody. -->
          <div class="con-mafocus__plate con-mafocus__race" data-unfold-item data-ma-plate="race">
            <div class="con-mafocus__block-title">{{ $t('Current race') }}</div>
            <div v-if="displayInspect.owner !== undefined && kind === 'milestone'" class="con-mafocus__history" data-ma-history>
              <span class="con-mafocus__dot" :class="'player_bg_color_' + displayInspect.owner.color" aria-hidden="true"></span>
              <span>{{ $t('Claimed') }} · <b>{{ displayInspect.owner.name }}</b></span>
            </div>
            <div v-if="displayInspect.nobodyLeads" class="con-mafocus__nolead" data-ma-nolead>{{ $t('Nobody leads yet') }}</div>
            <!-- How the BOT counts this one in THIS game (the registry's generated line) — and an award's push. -->
            <div v-if="displayInspect.botRule !== undefined" class="con-mafocus__botrule" data-ma-bot-rule>
              <span>{{ ruleText(displayInspect.botRule.criterion) }}</span>
              <span v-if="displayInspect.botRule.helper !== undefined" class="con-mafocus__botrule-helper" data-ma-bot-helper>
                {{ $t('Corporate Competition') }}: {{ ruleText(displayInspect.botRule.helper) }}
              </span>
            </div>
            <div class="con-mafocus__rows">
              <div v-for="r in displayInspect.rows" :key="r.color"
                   class="con-mafocus__row"
                   :class="{'con-mafocus__row--viewer': r.viewer, 'con-mafocus__row--leader': r.isLeader}">
                <span class="con-mafocus__row-rank" aria-hidden="true">
                  <!-- The award identity echo: the RACE leader wears the same crown the overview cassette caps with. -->
                  <i v-if="kind === 'award' && r.isLeader" class="con-mafocus__row-crown">
                    <svg viewBox="0 0 18 15">
                      <path d="M2.4 12.2 L3 5.6 L6.5 8.1 L9 1 L11.5 8.1 L15 5.6 L15.6 12.2 Z" />
                      <path class="con-mafocus__row-crown-base" d="M2.9 13 H15.1 A0.62 0.62 0 0 1 15.1 14.24 H2.9 A0.62 0.62 0 0 1 2.9 13 Z" />
                    </svg>
                  </i>
                  <template v-else-if="!displayInspect.nobodyLeads">{{ r.rank }}</template>
                </span>
                <span class="con-mafocus__dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
                <span class="con-mafocus__row-name">{{ r.viewer ? $t('You') : r.name }}</span>
                <span class="con-mafocus__row-bar" aria-hidden="true"><i :style="{width: r.barPct + '%'}"></i></span>
                <span class="con-mafocus__row-score">{{ r.score }}</span>
                <span v-if="r.projectedVp !== undefined" class="con-mafocus__row-vp" data-unfold-late>+{{ r.projectedVp }} {{ $t('VP') }}</span>
                <span v-else-if="r.canClaim === true" class="con-mafocus__row-ready" data-unfold-late>✓</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="payView !== undefined" class="con-mafocus__pay con-mafocus__face" :class="{'con-mafocus__face--off': !payShown}"
             data-ma-pay :aria-hidden="payShown ? undefined : 'true'">
          <ConsolePaymentPanel :view="payView" mode="expanded" hint-mode="none" :focus-unit="payFocusUnit" :flash-nonce="payFlash" />
        </div>
        </div>
      </div>

      <!-- ── THE STATUS RAIL — the stage's ONE centre of decision, and the
           SAME line the list state carries: the whole projected transaction in
           shared `current → resulting` chips, or the one concrete blocker.
           Past the press it states the commit instead (and after a refusal,
           the inline reason). The verbs live in the global command bar. ── -->
      <!-- ONE cell, two faces that CROSS by opacity (FB — the old `v-if` swap blinked on every press): the rail
           while the decision is the player's, the commit's own line once A was pressed (or a refusal's reason). -->
      <div class="con-mafocus__decision" data-ma-detail data-unfold-item
           :data-ma-block-reason="blockReason !== '' ? blockReason : undefined">
        <ConsoleMaRail class="con-mafocus__face" :class="{'con-mafocus__face--off': commitStatus !== ''}" :view="railView" />
        <span class="con-mafocus__face con-mafocus__status" :class="[statusClass, {'con-mafocus__face--off': commitStatus === ''}]"
              :aria-hidden="commitStatus === '' ? 'true' : undefined">
          <template v-if="phase === 'committing'">{{ $t('Confirming…') }}</template>
          <template v-else-if="commitStatus !== ''">✕ {{ $t(commitStatus) }}</template>
        </span>
      </div>

      <!-- ── THE CEREMONY SCENE (post-commit). The hero emblem GLIDES into
           the seat below; the dressing surfaces around it; the shared burst
           fires over the seat. Mounted only past the commit boundary —
           motion is driven by consoleMaFocusMotion.runMaCeremonyStage. ── -->
      <div v-if="ceremonyUp" class="con-mafocus__cere" aria-hidden="true">
        <div class="con-mafocus__cere-seat" data-ma-cere-seat>
          <span class="con-mafocus__cere-halo" data-ma-cere-dress></span>
          <span class="con-mafocus__cere-ring" data-ma-cere-dress></span>
          <!-- The glide TARGET — smaller than the ring, so the coronation
               ring FRAMES the arriving emblem instead of hiding under it. -->
          <span class="con-mafocus__cere-slot" data-ma-cere-slot></span>
        </div>
        <div class="con-mafocus__cere-lines">
          <div class="con-mafocus__cere-kicker" data-ma-cere-line>{{ $t(ceremonyKicker) }}</div>
          <div class="con-mafocus__cere-name" data-ma-cere-line v-i18n>{{ displayView.displayName }}</div>
          <div v-if="kind === 'milestone'" class="con-mafocus__cere-vp" data-ma-cere-line>
            <span class="con-mafocus__cere-vp-num">+5</span>
            <span class="con-mafocus__cere-vp-unit">{{ $t('VP') }}</span>
          </div>
          <div v-else-if="displayView.free" class="con-mafocus__cere-cost" data-ma-cere-line>{{ $t('Free sponsorship') }}</div>
          <div v-else-if="displayView.price.kind === 'waived'" class="con-mafocus__cere-cost" data-ma-cere-line data-ma-price-kind="waived">
            <span>{{ $t('Cost') }}:</span>
            <ConsoleMaWaivedPrice :printed="displayView.price.printed" :waivedBy="displayView.price.waivedBy" />
          </div>
          <div v-else class="con-mafocus__cere-cost" data-ma-cere-line>
            <span>{{ $t('Cost') }}: <b>{{ displayView.cost }}</b></span>
            <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * THE MA FOCUS STAGE — the same workspace frame, one level deeper. The
 * descend hooks unfold it from the pressed card's rect; the emblem
 * pedestal is the carried subject. It is BOTH the full detail dossier and
 * the safe confirmation context (the second A commits); past the commit
 * it becomes the ceremony's scene — the hero emblem never leaves it.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * CONSOLE MA FOCUS STAGE — the detail state of the Milestones/Awards
 * workspace (the North-Star rework of the old `ConsoleMaConfirm` modal).
 *
 * A PURE renderer over three unit-tested view-models:
 *  - `ConsoleMaItem` (consoleMaModel) — the dashboard item identity;
 *  - `MaConfirmView` (maConfirmModel) — economy / slots / progress, REBUILT
 *    from the live playerView on every commit (a raced-away slot re-renders
 *    as an honest blocked state);
 *  - `MaInspectView` (consoleMaInspectModel) — the ranked race/standings
 *    with the engine-faithful endgame VP projection.
 *
 * Input, commands and the commit path live in ConsoleShell (the sheet
 * pattern); the flow phase lives in consoleMaFocus.ts. The CEREMONY runs on
 * this stage: the `phase` watcher hands the DOM to
 * `runMaCeremonyStage` and emits `ceremony-done` on its completion — the
 * shell's ONE signal to close the workspace.
 */
import {computed, nextTick, onBeforeUnmount, PropType, ref, useTemplateRef, watch} from 'vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import ConsoleMaRail from '@/client/components/console/ConsoleMaRail.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import {PaymentView} from '@/client/console/paymentPlan';
import {ConsoleMaItem} from '@/client/components/console/consoleMaModel';
import {buildMaRail, MaRailView} from '@/client/components/console/consoleMaRail';
import {MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {MaInspectView} from '@/client/components/console/consoleMaInspectModel';
import {maFocusState, MaFocusPhase} from '@/client/console/consoleMaFocus';
import {AWARD_COSTS} from '@/common/constants';
import ConsoleMaWaivedPrice from '@/client/components/console/foundation/ConsoleMaWaivedPrice.vue';
import {maFundedSlotReading, maPriceCharged, MaPriceReading, maPriceReading, MaSponsorSlot} from '@/client/console/maPriceReading';
import {CardName} from '@/common/cards/CardName';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Message} from '@/common/logs/Message';
import {runMaCeremonyStage, stopMaCeremonyStage} from '@/client/console/consoleMaFocusMotion';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'ConsoleMaFocusStage'});
const props = defineProps({
  item: {type: Object as PropType<ConsoleMaItem>, required: true},
  view: {type: Object as PropType<MaConfirmView>, required: true},
  inspect: {type: Object as PropType<MaInspectView>, required: true},
  /** LIVE availability (the waitingFor tree is the source of truth). */
  available: {type: Boolean, required: true},
  /** The concrete reason when not available — the model's ONE ladder (`ConsoleMaItem.blocker`); '' when offered. */
  blockReason: {type: String, default: ''},
  /** The server WILL ask this claim's bill (PL-1622) — the rail names the payment step instead of an M€-only projection. */
  billAsks: {type: Boolean, default: false},
  /** «› ОПЛАТА» (PL-1622): the payment panel's view (undefined while the stage is closed) and its cursor's source. */
  payView: {type: Object as PropType<PaymentView | undefined>, default: undefined},
  payFocusUnit: {type: String, default: undefined},
  /** The awards' funded slots in FUNDING order — each sponsor's seat and the price it went for (the ladder's past). */
  sponsors: {type: Array as PropType<ReadonlyArray<MaSponsorSlot>>, default: () => []},
});
const emit = defineEmits(['ceremony-done']);

const root = useTemplateRef<HTMLElement>('root');
/**
 * THE COMMIT FREEZE (the colony stage's `heldView` idiom): the instant
 * the commit leaves for the wire the stage pins what it shows — the
 * live rebuild would otherwise repaint the paid price / before-after /
 * standings mid-beat (the free flag drops with the consumed task, the
 * NEXT award price replaces the paid one). The ceremony then states
 * the EXACT paid economy. A refusal releases the pin — the restored
 * detail must be live again.
 */
const heldView = ref<MaConfirmView | undefined>(undefined);
const heldInspect = ref<MaInspectView | undefined>(undefined);
/**
 * …AND THE ITEM IS PINNED WITH THEM (PL-604, the TR61 walk): the status
 * rail reads the item for its first branch — «Получено игроком …» the
 * instant the answer lands — so for the detail's fade-out under the
 * ceremony two voices said one thing («ДОСТИЖЕНИЕ ПОЛУЧЕНО» on the scene,
 * «Claimed by player1» on the rail under the hero). Past the press the
 * rail states the transaction AS PRESSED, and nothing else.
 */
const heldItem = ref<ConsoleMaItem | undefined>(undefined);
const kind = computed((): 'milestone' | 'award' => {
  return props.item.kind;
});
const phase = computed((): MaFocusPhase => {
  return maFocusState.phase;
});
const error = computed((): string => {
  return maFocusState.error;
});
const ceremonyUp = computed((): boolean => {
  return phase.value === 'ceremony' || phase.value === 'closing';
});
/**
 * THE ACTIVATION MATERIAL of the stage (milestone only — the P29/P33
 * decision keeps the loud «offered» state a milestone semantic): the
 * warm lit ground/pedestal/shelf the browse tile's `--go` carries,
 * continued one level deeper so the descend never changes the object's
 * temperature. LATCHED past the commit press (`phase !== 'detail'`) —
 * the ceremony is this light consummated, and a surface that cooled the
 * instant A landed read as a scene swap; a refusal returns to `detail`
 * and the layers FADE with the live `available` (opacity-driven CSS).
 */
const warmGo = computed((): boolean => {
  return kind.value === 'milestone' && (props.available || phase.value !== 'detail');
});
/** What the stage renders: LIVE pre-commit, PINNED past the commit. */
const displayView = computed((): MaConfirmView => {
  return heldView.value ?? props.view;
});
const displayInspect = computed((): MaInspectView => {
  return heldInspect.value ?? props.inspect;
});
/** The payment face stands — only in the reversible detail (the commit brings the plates back for the price). */
const payShown = computed((): boolean => {
  return props.payView !== undefined && maFocusState.pay !== undefined && phase.value === 'detail';
});
const payFlash = computed((): number => {
  return maFocusState.pay?.flash ?? 0;
});
/** A milestone with no numeric threshold — met / not met, never a progress number. */
const conditionMilestone = computed((): boolean => {
  return kind.value === 'milestone' && displayView.value.threshold === undefined;
});
/** The press charges the rail (the PL-1621 flight arms its target) — never for a free / waived price. */
const charged = computed((): boolean => {
  return maPriceCharged(displayView.value.price);
});
/**
 * THE SPONSORSHIP LADDER (awards) — the truth about THREE TIMES (PC01 · GO): one step per slot.
 *  · PAST — a funded slot wears its sponsor's seat and what it WENT for: the server's `paid` (a waived slot reads
 *    «0» with its source's seal, for every seat); a save without the fact prints the rules' price of the slot.
 *  · PRESENT — the next step: the live price with its cause (the engine's own; the waiver's struck table price).
 *  · FUTURE — the steps after it print the TABLE's rule (14 · 20 — true for whoever funds them); under a standing
 *    waiver each is struck to 0 with the same seal: the seat reads the table's rule AND its own price.
 */
const ladder = computed((): Array<{reading: MaPriceReading, sponsor?: string, next: boolean, charged: boolean}> => {
  const taken = displayView.value.takenCount;
  const rule = (i: number) => AWARD_COSTS[i] ?? AWARD_COSTS[AWARD_COSTS.length - 1];
  const nextWaiver = displayView.value.price.kind === 'waived' ? displayView.value.price.waivedBy : undefined;
  return Array.from({length: displayView.value.maxSlots}, (_, i) => {
    const sponsor = props.sponsors[i];
    const next = i === taken;
    let reading: MaPriceReading;
    if (sponsor !== undefined && i < taken) {
      reading = maFundedSlotReading(sponsor, rule(i));
    } else if (next) {
      reading = displayView.value.price;
    } else {
      reading = maPriceReading({price: nextWaiver !== undefined ? 0 : rule(i), printed: rule(i), waivedBy: nextWaiver});
    }
    return {
      reading,
      ...(sponsor !== undefined ? {sponsor: sponsor.color} : {}),
      next,
      charged: maPriceCharged(reading),
    };
  });
});
/** The card that waived THIS seat's price — named once, in words, under the exchange / the ladder. */
const waiverSource = computed((): CardName | undefined => {
  return displayView.value.price.kind === 'waived' ? displayView.value.price.waivedBy : undefined;
});
const waiverLine = computed((): string => {
  const source = waiverSource.value;
  return source === undefined ? '' : translateTextWithParams('${0} — free for you', [translateText(source)]);
});
const takenByMe = computed((): boolean => {
  return props.item.takenBy !== undefined && props.item.takenBy.color === props.item.myColor;
});
/** The state BADGE — one short label, one tone. Which state, nothing more:
 *  the quantity is the progress block's, the consequence is the rail's. */
const stateTone = computed((): 'taken' | 'mine' | 'go' | 'idle' => {
  if (displayView.value.takenByOther !== undefined) {
    return 'taken';
  }
  if (takenByMe.value) {
    return 'mine';
  }
  return props.available ? 'go' : 'idle';
});
const stateLabel = computed((): string => {
  switch (stateTone.value) {
  case 'taken':
  case 'mine':
    return kind.value === 'milestone' ? 'Claimed' : 'Funded';
  case 'go':
    return kind.value === 'milestone' ? 'Can be claimed' : 'Can be sponsored';
  default:
    // ONE word for the state; the reason is the rail's, named (FB — never «Сейчас недоступно»).
    return kind.value === 'milestone' && !props.item.myReady ? 'Not met yet' : 'Not now';
  }
});
/** The claimant's colour dot rides the badge when someone ELSE owns it. */
const ownerColor = computed((): string => {
  return displayView.value.takenByOther?.color ?? '';
});
/**
 * The one line UNDER the viewer's own number: where they stand in the
 * race. An award's whole point is the comparison, so it names the leader
 * (or says the viewer IS one); a milestone's number already carries its
 * own target («20/29»), so it says nothing rather than something twice.
 */
const standingNote = computed((): string => {
  if (kind.value === 'milestone') {
    return '';
  }
  switch (displayView.value.raceTone) {
  case 'lead': return $t('You lead');
  case 'tie': return $t('Tied for the lead');
  case 'behind': return `${$t('Leader')}: ${displayView.value.leaderScore}`;
  default: return '';
  }
});
const meterWidth = computed((): string => {
  const t = displayView.value.threshold ?? 0;
  if (t <= 0) {
    return '0%';
  }
  return `${Math.min(100, Math.round((displayView.value.myScore / t) * 100))}%`;
});
/**
 * THE STATUS RAIL of this item — the same pure model, the same component
 * the list state renders. It uses the PINNED view past the commit, so the
 * ceremony states the economy that was actually paid.
 */
const railView = computed((): MaRailView => {
  return buildMaRail({
    item: heldItem.value ?? props.item,
    kind: kind.value === 'milestone' ? 'milestones' : 'awards',
    cost: displayView.value.cost,
    free: displayView.value.free,
    myMegacredits: displayView.value.mcBefore,
    takenCount: displayView.value.takenCount,
    maxSlots: displayView.value.maxSlots,
    // ON the payment step the panel states every row's «остаётся» — the rail names no step it already is.
    billAsks: props.billAsks && !payShown.value,
  });
});
/**
 * The COMMIT's own line, which REPLACES the rail while it speaks: the
 * pending beat, or a refusal's inline reason. A blocked-by-state item is
 * NOT one of these — the rail already names that blocker, and printing it
 * twice is the duplication this iteration removed.
 */
const commitStatus = computed((): string => {
  if (phase.value === 'committing') {
    return 'Confirming…';
  }
  return error.value;
});
const statusClass = computed((): string => {
  return phase.value === 'committing' ?
    'con-mafocus__status--wait' : 'con-mafocus__status--blocked';
});
const ceremonyKicker = computed((): string => {
  if (kind.value === 'milestone') {
    return 'Milestone claimed';
  }
  return displayView.value.free ? 'Award sponsored' : 'Award funded';
});

/** A server Message (the bot's registry line) through the one translation road — a copy, never the model's object. */
function ruleText(message: Message): string {
  return translateMessage({message: message.message, data: message.data.map((d) => ({...d}))});
}

/** The commit resolved — the ceremony owns the stage from here. One-shot
 *  by construction (the phase machine never re-enters 'ceremony'). */
watch(() => phase.value, (next: MaFocusPhase, prev: MaFocusPhase) => {
  if (next === 'committing') {
    // Pin the presentation across the commit (see `heldView`).
    heldView.value = props.view;
    heldInspect.value = props.inspect;
    heldItem.value = props.item;
  } else if (next === 'detail') {
    // A refusal restored the reversible detail — live values again.
    heldView.value = undefined;
    heldInspect.value = undefined;
    heldItem.value = undefined;
  }
  if (next === 'ceremony' && prev === 'committing') {
    // (PRICE, THEN CROWN — PL-1621: the shell enters the ceremony only once the price has been absorbed.)
    void nextTick(() => {
      const el = root.value;
      if (el === null) {
        return;
      }
      runMaCeremonyStage(el, {kind: kind.value}, () => emit('ceremony-done'));
    });
  }
});
onBeforeUnmount(() => {
  // A torn-down stage must never fire a late completion into the shell.
  stopMaCeremonyStage();
});
</script>
