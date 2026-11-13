<template>
  <div ref="root" class="con-ma con-ws con-ws--dockcover" role="dialog" :aria-label="$t(title)"
       :class="['con-ma--' + kind, {'con-ma--focus': focusState.open, 'con-ma--offer': offerCount > 0, 'con-ma--rollcall': rollcall}]"
       data-motion-surface="ma-screen">
    <div class="con-ma__backdrop" aria-hidden="true"></div>
    <div class="con-ma__panel" data-motion-panel>
      <!-- ── THE WORKSPACE HEADER — the shared ConsoleWsHead: root «НАГРАДЫ» /
           «ДОСТИЖЕНИЯ» + the category emblem; descending into an item grows
           the crumb tail «› БАНКИР › СПОНСОРСТВО» (stable context before the
           mutable stage; amber past the commit).

           The trailing zone states the SYSTEM's current state and nothing
           else: the slot tray, the tally, and the live PRICE of the next
           claim/fund. NO wallet delta — the projected transaction of one
           action belongs to the status rail, whole and in one place; a header
           that also drew «462 −8 → 454» made a single move read as two
           statements and printed a payment for an action the player might not
           even be able to take. The price comes from the ENGINE's own
           `milestoneCost()` / `awardFundingCost()`, so Van Allen's free
           milestones, Staged Protests' +8 and the 8 → 14 → 20 award ladder are
           all already in it. ── -->
      <!-- ⚠️ THE ROOT IS THE FLOW THE PLAYER ENTERED, not this screen's name
           (the colonies' scene-step rule). Standing NESTED — the start
           workspace handing its scene to Vitor's free-sponsorship step — the
           crumb is the STACK's: «СТАРТ ПАРТИИ › ВИТОР › НАГРАДЫ», deepening
           through this screen's own stages (the watcher publishes them UP).
           At depth 0 this screen is its own root («НАГРАДЫ»/«ДОСТИЖЕНИЯ»). -->
      <ConsoleWsHead class="con-ma__wshead"
                     :root="headRoot"
                     :emblem="headEmblem"
                     :subject="headSubject"
                     :stage="headStage"
                     :committed="headCommitted">
        <template #trailing>
          <!-- THE HEAD-TALLY: whose slots, how many taken, the price of the next one — the SYSTEM's facts, never a
               wallet delta (that is the status rail's, whole and in one place). -->
          <div class="con-ma__tally" data-ma-tally>
            <!-- THE OFFER COUNT (milestones): «is there anything I can take, and how much» answered before the eye reaches
                 a tile — a solid mint chip with a number, rendered only when the answer is yes (calm by default). -->
            <div v-if="offerCount > 0" class="con-ma__offer" data-ma-offer>
              <i class="con-ma__offer-tick" aria-hidden="true">
                <svg viewBox="0 0 12 10"><path d="M1.6 5.4 L4.6 8.3 L10.4 1.7" /></svg>
              </i>
              <span class="con-ma__offer-text">{{ offerText }}</span>
            </div>
            <!-- The NEXT free slot arms while the fund action is genuinely offered (awards only — the strategy rail's
                 door grammar: the accent lives at the ACTION level, never as a per-row glow). -->
            <div class="con-ma__slots" aria-hidden="true">
              <span v-for="(c, si) in slots" :key="si"
                    class="con-ma__slot"
                    :class="c !== undefined ? 'player_bg_color_' + c :
                      ['con-ma__slot--empty', {'con-ma__slot--next': kind === 'awards' && anyAvailable && si === takenCount}]"></span>
            </div>
            <div v-if="allTaken" class="con-ma__complete">✓ {{ $t(kind === 'awards' ? 'All funded' : 'All claimed') }}</div>
            <div v-else class="con-ma__count">{{ $t(kind === 'awards' ? 'Funded' : 'Claimed') }} <b>{{ takenCount }}/{{ maxSlots }}</b></div>
            <!-- PC01 · GO: the price NAMES ITS CAUSE — a waived one is the table's price struck + the source's seal
                 (one renderer); Vitor's free sponsorship keeps its word. -->
            <div v-if="!allTaken" class="con-ma__price" :class="{'con-ma__price--free': chipReading.kind !== 'paid'}" :data-ma-price="kind"
                 :data-ma-price-kind="chipReading.kind">
              <span class="con-ma__price-label">{{ $t('Cost') }}</span>
              <ConsoleMaWaivedPrice v-if="chipReading.kind === 'waived'" :printed="chipReading.printed" :waivedBy="chipReading.waivedBy" />
              <span v-else-if="chipReading.kind === 'free'" class="con-ma__price-free">{{ $t('Free') }}</span>
              <template v-else>
                <b class="con-ma__price-value">{{ nextCost }}</b>
                <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
              </template>
            </div>
          </div>
        </template>
      </ConsoleWsHead>

      <!-- ── The stage wrap: the BROWSE layer (the list) and the MA FOCUS stage occupy the same region. Descending
           recomposes the frame in place: the browse DOM is only parked (selection / scroll / focus survive). ── -->
      <div class="con-ma__stagewrap">
        <div class="con-ma__browse"
             :class="{
               'con-ma__browse--parked': focusState.open,
               'con-ma__browse--arrive-l': kindArrive === 'left',
               'con-ma__browse--arrive-r': kindArrive === 'right',
             }">
          <!-- TWO WORKSPACES, ONE FAMILY (FB′ — the owner, 2026-11-03): each kind its own screen, TWO COLUMNS OF
               THREE TILES (`--ma-rows` = half the list, rounded up) — five and six (Venus) both stand whole, the tiles
               are big enough for a big medallion, and an odd fifth NEVER stretches: its neighbour's cell stays empty.
               A tile: the medallion the tile's height · the name and its rule beside YOUR plate · the table's FIELD
               at the foot. -->
          <ConsoleScrollArea class="con-ma__scroll-host" content-class="con-ma__grid" ref="grid"
                             :style="{'--ma-rows': String(Math.max(1, Math.ceil(items.length / 2)))}">
            <article v-for="(it, i) in items" :key="it.key"
                     class="con-ma__card"
                     :class="{
                       'con-ma__card--focused': i === index,
                       // P29/P33: the actionable state is a MILESTONE semantic — a fundable award is an ordinary
                       // economy action and stays calm (the head-tally's next slot arms instead).
                       'con-ma__card--go': it.available && it.kind === 'milestone',
                       'con-ma__card--taken': it.takenBy !== undefined,
                       'con-ma__card--dead': it.slotsExhausted,
                       'con-ma__card--arriving': revealNames.includes(it.name),
                     }"
                     :data-ma-row="it.name"
                     :style="rollStyle(it)"
                     :ref="i === index ? 'focusedCard' : undefined"
                     @click="onCardClick(i)">
              <span v-if="railClass(it) !== ''" class="con-ma__rail" :class="railClass(it)" aria-hidden="true"></span>
              <!-- THE CLAIM SHELF — «you can take this now» in its OWN geometry (a solid bar the tile stands on), never the
                   edge ring: the cursor seeds onto the first claimable tile and its ring would paint over a state kant. -->
              <span v-if="isOffered(it)" class="con-ma__claimbar" data-ma-claimbar aria-hidden="true"></span>

              <!-- The medallion: ONE optical size on every row (the measured fit `maArtFitStyle` — the same the
                   strategy rail draws), on a plain plate; a taken emblem desaturates. The FLIP twin of the detail
                   stage's hero. -->
              <div class="con-ma__stage" aria-hidden="true">
                <div class="con-ma__art" :style="artStyle(it)"></div>
                <i v-if="it.kind === 'award' && it.takenBy !== undefined"
                   class="con-ma__gem" :class="'player_bg_color_' + it.takenBy.color"></i>
              </div>

              <!-- The tile's reading column: the name and its rule beside YOUR plate, the table's field at the foot. -->
              <div class="con-ma__main">
                <div class="con-ma__top">
                  <!-- The name — and WHO took it on the same line (a settled fact beside the name, never a line more) —
                       over the rule. -->
                  <div class="con-ma__body">
                    <div class="con-ma__nameline">
                      <span class="con-ma__name" v-i18n>{{ shortName(it.name) }}</span>
                      <!-- An AWARD's sponsor stands beside the name (the plate is YOUR race); a claimed MILESTONE's owner
                           is its plate's subject, never said twice. -->
                      <span v-if="it.takenBy !== undefined && it.kind === 'award'" class="con-ma__owner">
                        <span class="con-ma__owner-dot" :class="'player_bg_color_' + it.takenBy.color" aria-hidden="true"></span>
                        <span class="con-ma__owner-name">{{ it.takenBy.name }}</span>
                        <span class="con-ma__owner-verb">✓ {{ $t('Funded') }}</span>
                      </span>
                    </div>
                    <div class="con-ma__desc" v-i18n>{{ it.description }}</div>
                  </div>
                  <!-- YOUR PLATE — the one reading that is yours, at ONE width on every tile: a milestone's count toward
                       its threshold (or the owner's seal once claimed); an award's score and where it puts you. -->
                  <div class="con-ma__status">
                    <!-- THE CLAIMED PLATE — the plate grammar of «ВЫ» (kicker · value · foot, one height): «ПОЛУЧЕНО»,
                         the owner's enamel cube and name with the engraved check — the settled trophy, never a CTA. -->
                    <div v-if="it.kind === 'milestone' && it.takenBy !== undefined"
                         class="con-ma__seal"
                         :class="{'con-ma__seal--mine': it.takenBy.color === it.myColor}"
                         data-ma-seal>
                      <span class="con-ma__metric-label">{{ $t('Claimed') }}</span>
                      <span class="con-ma__seal-who">
                        <i class="con-ma__seal-cube" :class="'player_bg_color_' + it.takenBy.color" aria-hidden="true"></i>
                        <b class="con-ma__seal-name">{{ it.takenBy.name }}</b>
                        <i class="con-ma__seal-tick" aria-hidden="true">
                          <svg viewBox="0 0 12 10"><path d="M1.6 5.4 L4.6 8.3 L10.4 1.7" /></svg>
                        </i>
                      </span>
                      <span class="con-ma__metric-foot" aria-hidden="true"></span>
                    </div>
                    <div v-else-if="it.kind === 'milestone'" class="con-ma__metric" :class="metricClass(it)">
                      <span class="con-ma__metric-label">{{ $t('You') }}</span>
                      <span class="con-ma__metric-value">
                        <i v-if="it.myReady && it.scores.length > 0" class="con-ma__readymark" aria-hidden="true">
                          <svg viewBox="0 0 12 10"><path d="M1.6 5.4 L4.6 8.3 L10.4 1.7" /></svg>
                        </i>
                        <template v-if="it.scores.length === 0">—</template>
                        <!-- A condition milestone (no numeric threshold): «—» while not met — the detail reads the same. -->
                        <template v-else-if="it.threshold === undefined"><b v-if="!it.myReady">—</b></template>
                        <template v-else><b>{{ it.myScore }}</b><span class="con-ma__metric-req">/{{ it.threshold }}</span></template>
                      </span>
                      <span class="con-ma__metric-foot">
                        <span v-if="it.available" class="con-ma__avail">{{ $t('Ready to claim') }}</span>
                        <span v-else-if="it.threshold !== undefined && it.scores.length > 0" class="con-ma__meter" aria-hidden="true"><i :style="{width: meterWidth(it)}"></i></span>
                      </span>
                    </div>
                    <div v-else class="con-ma__race" :class="'con-ma__race--' + it.raceTone">
                      <span class="con-ma__metric-label">{{ $t('You') }}</span>
                      <span class="con-ma__race-value"><b>{{ it.myScore }}</b></span>
                      <span class="con-ma__race-foot" :class="'con-ma__race-foot--' + it.raceTone">{{ raceFootText(it) }}</span>
                    </div>
                  </div>
                </div>
                <!-- THE FIELD — the table read across the tile's foot (`maFieldLanes`): a milestone's RIVALS on their
                     way to the threshold (a rival who meets it wears the drawn check), an award's every SEAT ranked by its score
                     (the leaders crowned, your own lane ringed). A hairline gauge per seat, a kant for the state —
                     never light. A finished race draws nothing. -->
                <div v-if="lanesOf(it).length > 0" class="con-ma__field" data-ma-field>
                  <span v-for="l in lanesOf(it)" :key="l.color"
                        class="con-ma__lane"
                        :class="{'con-ma__lane--me': l.me, 'con-ma__lane--lead': l.mark === 'crown', 'con-ma__lane--reached': l.mark === 'reached',
                                 'con-ma__lane--zero': l.score === 0 && !l.me}"
                        :data-ma-lane="l.color">
                    <span class="con-ma__lane-head">
                      <span class="con-ma__lane-mark" aria-hidden="true">
                        <i v-if="l.mark === 'crown'" class="con-ma__crown">
                          <svg viewBox="0 0 18 15">
                            <path d="M2.4 12.2 L3 5.6 L6.5 8.1 L9 1 L11.5 8.1 L15 5.6 L15.6 12.2 Z" />
                            <path class="con-ma__crown-base" d="M2.9 13 H15.1 A0.62 0.62 0 0 1 15.1 14.24 H2.9 A0.62 0.62 0 0 1 2.9 13 Z" />
                          </svg>
                        </i>
                        <i v-else-if="l.mark === 'reached'" class="con-ma__lane-tick">
                          <svg viewBox="0 0 12 10"><path d="M1.6 5.4 L4.6 8.3 L10.4 1.7" /></svg>
                        </i>
                      </span>
                      <i class="con-ma__cube" :class="['player_bg_color_' + l.color, {'con-ma__cube--me': l.me}]" aria-hidden="true"></i>
                      <b class="con-ma__lane-score">{{ l.score }}</b>
                    </span>
                    <span class="con-ma__lane-bar" aria-hidden="true"><i :style="{width: Math.round(l.fill * 100) + '%'}"></i></span>
                  </span>
                </div>
              </div>
            </article>
          </ConsoleScrollArea>

          <!-- THE STATUS RAIL — the focused item's WHOLE projected transaction
               in the shared `current → resulting` chips (M€ + the category's
               slot counter), or the ONE concrete blocker. Same component, same
               model, same line as the detail stage's: the projection is stated
               once and never in two dialects. -->
          <ConsoleMaRail class="con-ma__foot" :view="railView" :name="focusedName" />
        </div>

        <!-- ── THE MA FOCUS STAGE — the same frame, one level deeper. The
             descend hooks unfold it from the pressed card's rect; the emblem
             pedestal is the carried subject. No `appear`: a restore-mount
             seats the stage instantly (RESUME is not a re-entrance). ── -->
        <transition :css="false"
                    @enter="onFocusEnter" @leave="onFocusLeave"
                    @enter-cancelled="onFocusEnterCancelled" @leave-cancelled="onFocusLeaveCancelled">
          <ConsoleMaFocusStage v-if="focusState.open && focusItem !== undefined && focusView !== undefined && focusInspect !== undefined"
                               :item="focusItem"
                               :view="focusView"
                               :inspect="focusInspect"
                               :available="focusAvailable"
                               :blockReason="focusBlockReason"
                               :sponsors="sponsors"
                               :payView="payView"
                               :payFocusUnit="payFocusUnit"
                               :billAsks="focusItem !== undefined && billNames.includes(focusItem.name)"
                               @ceremony-done="$emit('ceremony-done')" />
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * data-motion-*: the director animates the panel (NON_SHADE_OWNERS —
 *       the OWN dim stays by design; density lives in the panel materials).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

/**
 * P26/P31 — the console-native Milestones / Awards WORKSPACE (the North-Star
 * rework of the P26 dashboard). A strategic dashboard whose items are
 * SELECTABLE WHOLES: A on the overview only descends into the item's detail
 * stage (`ConsoleMaFocusStage`) — the confirmation context where the second,
 * deliberate A commits. The old per-item CTA and the `ConsoleMaConfirm`
 * modal are gone from the console-native flow.
 *
 * PURE derivation lives in consoleMaModel.ts (unit-tested); this component
 * renders items + hosts the browse ⇄ detail descend (consoleMaFocusMotion).
 * Input handling (grid nav / A / B / LB/RB category switch) stays in
 * ConsoleShell, like every sheet.
 */
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleMaFocusStage from '@/client/components/console/ConsoleMaFocusStage.vue';
import ConsoleMaRail from '@/client/components/console/ConsoleMaRail.vue';
import {ConsoleMaItem, ConsoleMaKind, maAwardGap, maFieldLanes, MaFieldLane} from '@/client/components/console/consoleMaModel';
import {buildMaRail, MaRailView} from '@/client/components/console/consoleMaRail';
import {motionMs} from '@/client/components/motion/motionTokens';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {MaConfirmView} from '@/client/components/ma/maConfirmModel';
import ConsoleMaWaivedPrice from '@/client/components/console/foundation/ConsoleMaWaivedPrice.vue';
import {MaPriceReading, maPriceReading, MaPriceWaiver, MaSponsorSlot} from '@/client/console/maPriceReading';
import {MaInspectView} from '@/client/components/console/consoleMaInspectModel';
import {PaymentView} from '@/client/console/paymentPlan';
import {maArtFitStyle, maDisplayName} from '@/client/components/ma/maArt';
import {maFocusState, openMaFocus, suspendMaFocus, resetMaFocus} from '@/client/console/consoleMaFocus';
import {abandonMaCeremonyEmbed} from '@/client/components/ma/maCeremonyState';
import {
  WorkspaceFrameKind,
  setWorkspaceFrameStage,
  setWorkspaceFrameSubject,
  workspaceFrameEmblem,
  workspaceFrameIndex,
  workspaceStackCrumb,
  workspaceStackRootKind,
  workspaceStepSourceCard,
} from '@/client/console/consoleWorkspaceStack';
import {
  armMaFocusOrigin,
  maFocusEnterHook,
  maFocusLeaveHook,
  maFocusEnterCancelledHook,
  maFocusLeaveCancelledHook,
  parkMaBrowse,
} from '@/client/console/consoleMaFocusMotion';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'ConsoleMaScreen'});
const props = defineProps({
  /** Which of the family's two workspaces this is (the sheet). */
  kind: {type: String as PropType<ConsoleMaKind>, required: true},
  items: {type: Array as PropType<ReadonlyArray<ConsoleMaItem>>, required: true},
  index: {type: Number, required: true},
  /** The viewer's M€ — the overlay covers the resource panel. */
  myMegacredits: {type: Number, required: true},
  /** MAX claimable/fundable slots (3). */
  maxSlots: {type: Number, default: 3},
  /** FREE-sponsorship mode (Vitor's start action funds an award for free):
   *  the wallet reads «Бесплатное спонсирование» instead of a −0 price. */
  free: {type: Boolean, default: false},
  /** The detail stage's live view-models (shell-built, playerView-fresh). */
  focusView: {type: Object as PropType<MaConfirmView | undefined>, default: undefined},
  focusInspect: {type: Object as PropType<MaInspectView | undefined>, default: undefined},
  focusAvailable: {type: Boolean, default: false},
  focusBlockReason: {type: String, default: ''},
  /** The names whose bill the server WILL ask (PL-1622 — `maCosts.payments`): their rail names the payment step. */
  billNames: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  /** «› ОПЛАТА» (PL-1622): the payment stage's panel view (undefined while it is closed) and its cursor's source. */
  payView: {type: Object as PropType<PaymentView | undefined>, default: undefined},
  payFocusUnit: {type: String, default: undefined},
  /** The awards' funded slots in FUNDING order — each sponsor's seat and the price it went for (the detail's ladder). */
  sponsors: {type: Array as PropType<ReadonlyArray<MaSponsorSlot>>, default: () => []},
  /** PC01 · GO: the card that waived this kind's next price and the table's price it waived (the server's facts). */
  priceWaiver: {type: Object as PropType<MaPriceWaiver | undefined>, default: undefined},
});
const emit = defineEmits(['ceremony-done', 'pick']);

const flow = useFlowScope('ma-screen');
const focusedCard = useTemplateRef<HTMLElement | Array<HTMLElement>>('focusedCard');
const grid = useTemplateRef<{ensureVisible?: (el: Element | null | undefined) => void} & {scrollToStart?: () => void}>('grid');
const root = useTemplateRef<HTMLElement>('root');
/**
 * The one-shot availability REVEAL ledger (seed-then-diff, the strategy
 * rail's idiom): names whose «offered now» rose on a LIVE watched frame.
 * The first observation after mount seeds silently — opening the
 * workspace never replays a ceremony for a state that merely IS.
 */
const revealNames = ref<Array<string>>([]);
/** The reveal ledger's seed (undefined = the next pass seeds silently). */
const availSeed = ref<Set<string> | undefined>(undefined);
/** The LB/RB ARRIVE beat — the side the family's other workspace came in from ('' = standing). */
const kindArrive = ref<'' | 'left' | 'right'>('');
/** The arrive beat's cancel (the screen's scope takes its beats back on unmount). */
let arriveTimer = (() => {}) as () => void;
/**
 * THE OPENING ROLL CALL — the one-shot phrase that answers «what can I take?» the moment the milestones screen
 * stands (mount / LB·RB arrive): the claimable tiles' shelves draw, their plates stamp, their checks draw, one
 * after another. It ENDS on its own; the standing state is the material it leaves behind.
 */
const rollcall = ref(false);
let rollcallTimer = (() => {}) as () => void;

const focusState = maFocusState;
const title = computed((): string => {
  return props.kind === 'milestones' ? 'Milestones' : 'Awards';
});
/** The slot tray: each TAKER's colour in order, then the empty slots. */
const slots = computed((): Array<string | undefined> => {
  const takers: Array<string | undefined> = props.items.filter((it) => it.takenBy !== undefined).map((it) => it.takenBy?.color);
  while (takers.length < props.maxSlots) {
    takers.push(undefined);
  }
  return takers.slice(0, props.maxSlots);
});
const allTaken = computed((): boolean => {
  return takenCount.value >= props.maxSlots;
});
/** The fund/claim action is genuinely offered on some item right now. */
const anyAvailable = computed((): boolean => {
  return props.items.some((it) => it.available && it.takenBy === undefined);
});
/** The milestones the claim is genuinely offered on right now, in reading order (the roll call's order too). */
const offeredNames = computed((): Array<string> => {
  return props.items.filter((it) => isOffered(it)).map((it) => it.name);
});
const offerCount = computed((): number => {
  return offeredNames.value.length;
});
const offerText = computed((): string => {
  return translateTextWithParams('Ready to claim: ${0}', [String(offerCount.value)]);
});
/** The descended item (undefined = the stage has nothing to stand on). */
const focusItem = computed((): ConsoleMaItem | undefined => {
  return maFocusState.open ?
    props.items.find((it) => it.name === maFocusState.name) : undefined;
});
// ── The workspace crumb (ConsoleWsHead) ────────────────────────────────
const crumbSubject = computed((): string => {
  return focusItem.value !== undefined ? maDisplayName(focusItem.value.name) : '';
});
const crumbStage = computed((): string => {
  if (!maFocusState.open) {
    return '';
  }
  if (maFocusState.phase === 'ceremony' || maFocusState.phase === 'closing') {
    return 'Ceremony';
  }
  // «› ОПЛАТА» (PL-1622) — a level of the reversible detail: the tail moves forward, the root and the item stay.
  if (maFocusState.pay !== undefined && maFocusState.phase === 'detail') {
    return 'Payment';
  }
  return props.kind === 'milestones' ? 'Claiming' : 'Sponsorship';
});
const crumbCommitted = computed((): boolean => {
  return maFocusState.open && maFocusState.phase !== 'detail';
});
// ── The header when NESTED (the scene-step shape) ──────────────────────
/** The stack kind this screen renders as (two kinds, one chassis). */
const frameKind = computed((): WorkspaceFrameKind => {
  return props.kind === 'milestones' ? 'milestones' : 'awards';
});
/** Nested (a hosted scene step / a stand over a surviving phase root):
 *  the crumb is the STACK's — root = the flow the player entered. */
const stackCrumb = computed((): ReturnType<typeof workspaceStackCrumb> => {
  return workspaceFrameIndex(frameKind.value) > 0 ? workspaceStackCrumb() : undefined;
});
const headRoot = computed((): string => {
  return stackCrumb.value?.root ?? title.value;
});
/** The identity symbol belongs to the PARENT anchor (the stack's root
 *  kind); a root with none draws none — never this screen's own. */
const headEmblem = computed((): string | undefined => {
  if (stackCrumb.value === undefined) {
    return props.kind;
  }
  const rootKind = workspaceStackRootKind();
  return rootKind !== undefined ? workspaceFrameEmblem(rootKind).emblem : undefined;
});
const headSubject = computed((): string => {
  return stackCrumb.value !== undefined ? (stackCrumb.value.subject?.text ?? '') : crumbSubject.value;
});
const headStage = computed((): string => {
  return stackCrumb.value !== undefined ? (stackCrumb.value.stage ?? '') : crumbStage.value;
});
const headCommitted = computed((): boolean => {
  return stackCrumb.value?.committed ?? crumbCommitted.value;
});
/**
 * What this screen HANDS UP to its frame while nested (rule 5 — an
 * embedded surface never titles itself, it publishes): the stage tail
 * (its own stage names, the category name at the browse layer) and the
 * carried subject (the descended item; the HOST's source card — the
 * corporation whose action this step is — while browsing).
 */
const nestedCrumb = computed((): {stage: string, subject: string} | undefined => {
  if (workspaceFrameIndex(frameKind.value) <= 0) {
    return undefined;
  }
  const base = workspaceStepSourceCard(frameKind.value, () => false);
  return {
    stage: crumbStage.value !== '' ? crumbStage.value : title.value,
    subject: crumbSubject.value !== '' ? crumbSubject.value : base,
  };
});
const takenCount = computed((): number => {
  return props.items.filter((it) => it.takenBy !== undefined).length;
});
/** The LIVE price of the next claim/fund — the shell passes the ENGINE's
 *  own number through the items (`cost`); the header shows it, the rail
 *  projects it, and the submit charges it. */
const nextCost = computed((): number | undefined => {
  return props.items.find((it) => it.cost !== undefined)?.cost;
});
/** The header chip's reading — the price with its cause (PC01 · GO): paid / waived / free. */
const chipReading = computed((): MaPriceReading => {
  return maPriceReading({
    price: nextCost.value ?? 0,
    printed: props.priceWaiver?.printed,
    waivedBy: props.priceWaiver?.waivedBy,
    free: props.free,
  });
});
const focused = computed((): ConsoleMaItem | undefined => {
  return props.items[props.index];
});
const focusedName = computed((): string => {
  return focused.value !== undefined ? maDisplayName(focused.value.name) : '';
});
/** THE STATUS RAIL of the focused item — the same pure model the detail
 *  stage renders (one projection, one language, one place). */
const railView = computed((): MaRailView => {
  return buildMaRail({
    item: focused.value,
    kind: props.kind,
    cost: focused.value?.cost ?? nextCost.value ?? 0,
    free: props.free,
    myMegacredits: props.myMegacredits,
    takenCount: takenCount.value,
    maxSlots: props.maxSlots,
    billAsks: focused.value !== undefined && props.billNames.includes(focused.value.name),
  });
});

/** «The claim is offered on this milestone right now» — the one predicate of the tile's offered material. */
function isOffered(it: ConsoleMaItem): boolean {
  return it.kind === 'milestone' && it.available && it.takenBy === undefined;
}
/** The roll call's place of an offered tile (a CSS index — the stagger is the stylesheet's, on the motion clock). */
function rollStyle(it: ConsoleMaItem): Record<string, string> | undefined {
  const i = offeredNames.value.indexOf(it.name);
  return i === -1 ? undefined : {'--ma-roll-i': String(i)};
}
/**
 * Play the opening roll call once (nothing offered → nothing plays). The tiles of a fresh list are fresh nodes
 * (keyed by name), so an LB/RB arrive replays it on them by construction — no frame-apart re-arm is needed.
 */
function startRollcall(): void {
  rollcallTimer();
  rollcall.value = offerCount.value > 0 && !maFocusState.open;
  if (!rollcall.value) {
    return;
  }
  rollcallTimer = flow.after(motionMs(1100 + 120 * offerCount.value), 'the opening roll call ends', () => {
    rollcall.value = false;
  });
}
/** The emblem at ONE optical size — the measured fit the strategy rail reads (the player's language's file). */
function artStyle(it: ConsoleMaItem): Record<string, string> {
  return maArtFitStyle(it.name);
}
/** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
function shortName(name: string): string {
  return name.replace(/[0-9]+$/, '');
}
/** The row's field — the table seat by seat (pure: `maFieldLanes`). */
function lanesOf(it: ConsoleMaItem): ReadonlyArray<MaFieldLane> {
  return maFieldLanes(it);
}
function railClass(it: ConsoleMaItem): string {
  if (it.takenBy !== undefined) {
    return 'con-ma__rail--owner player_bg_color_' + it.takenBy.color;
  }
  // The left edge speaks OWNER colour only; availability's edge is the
  // card's own bottom shelf light (CSS `--go` — see console.less).
  return '';
}
/** Milestone metric tones: gold-white «offered now» over green «met». */
function metricClass(it: ConsoleMaItem): string {
  if (it.available) {
    return 'con-ma__metric--now';
  }
  return it.myReady && it.scores.length > 0 ? 'con-ma__metric--ready' : '';
}
/**
 * The award race foot — WHERE THE VIEWER STANDS, in words (colour alone
 * may never carry it): leads / shares the lead / trails (with their own
 * count — they may not be in either rendered tier) / no race yet.
 */
function raceFootText(it: ConsoleMaItem): string {
  switch (it.raceTone) {
  case 'lead': return $t('You lead');
  case 'tie': return $t('Tied for the lead');
  case 'behind': return translateTextWithParams('Behind by ${0}', [String(maAwardGap(it))]);
  default: return $t('No race yet');
  }
}
/** Mouse/touch parity: a click focuses the tile; a click on the focused
 *  tile opens it (the same two-step the controller speaks). */
function onCardClick(i: number): void {
  if (maFocusState.open) {
    return;
  }
  emit('pick', i);
}
function meterWidth(it: ConsoleMaItem): string {
  const t = it.threshold ?? 0;
  if (t <= 0) {
    return '0%';
  }
  return `${Math.min(100, Math.round((it.myScore / t) * 100))}%`;
}
// ── The MA FOCUS descend (browse → detail and back) ────────────────────
/**
 * Descend into the item at `index` (A = «Выбрать» — EVERY item is
 * selectable, taken/blocked ones included: the stage explains the state).
 * Arms the descend origins SYNCHRONOUSLY at the press: the card's rect
 * (the unfold source) + the emblem pedestal's rect (the FLIP source).
 */
function enterFocus(): void {
  const item = props.items[props.index];
  if (item === undefined || maFocusState.open) {
    return;
  }
  const slot = focusedCard.value ?? undefined;
  const el = Array.isArray(slot) ? slot[0] : slot;
  const art = el?.querySelector<HTMLElement>('.con-ma__stage');
  const rectOf = (node: HTMLElement | null | undefined) => {
    const r = node?.getBoundingClientRect();
    return r === undefined || r.width < 10 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
  };
  armMaFocusOrigin(rectOf(el), rectOf(art));
  openMaFocus(item.kind, item.name);
}
function onFocusEnter(el: Element, done: () => void): void {
  maFocusEnterHook(el, done);
}
function onFocusLeave(el: Element, done: () => void): void {
  maFocusLeaveHook(el, done);
}
function onFocusEnterCancelled(el: Element): void {
  maFocusEnterCancelledHook(el);
}
function onFocusLeaveCancelled(el: Element): void {
  maFocusLeaveCancelledHook(el);
}

/** Publish the crumb tail + subject UP to the frame while nested — the
 *  header renders the STACK, so what this screen knows (its stages, the
 *  descended item) must live there or the tail never advances. */
watch(() => nestedCrumb.value, (c: {stage: string, subject: string} | undefined) => {
  if (c === undefined) {
    return;
  }
  setWorkspaceFrameStage(frameKind.value, c.stage);
  setWorkspaceFrameSubject(frameKind.value, c.subject);
}, {immediate: true});
/** Overflow is an extreme-mod fallback — keep the focus visible there. */
watch(() => props.index, () => {
  void nextTick(() => {
    const slot = focusedCard.value ?? undefined;
    const el = Array.isArray(slot) ? slot[0] : slot;
    // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
    grid.value?.ensureVisible?.(el);
  });
});
watch(() => props.kind, (next: ConsoleMaKind, prev: ConsoleMaKind) => {
  // A family switch happens from the overview only; a defensively-open stage of the OTHER kind must not survive it.
  if (maFocusState.open) {
    resetMaFocus();
  }
  grid.value?.scrollToStart?.();
  // The ARRIVE beat: the other workspace's list slides in from its bumper's side (RB → the awards from the right)
  // while the frame, the head and the rail stand still. The reveal ledger seeds fresh for the new list.
  availSeed.value = undefined;
  revealNames.value = [];
  kindArrive.value = next === 'awards' && prev === 'milestones' ? 'right' : 'left';
  arriveTimer();
  arriveTimer = flow.after(motionMs(260), 'the other family\'s list arrives', () => {
    kindArrive.value = '';
  });
  startRollcall();
});
/**
 * THE AVAILABILITY REVEAL — seed-then-diff over the items' own identity.
 * The first pass per mount/category seeds silently; a LIVE rising edge
 * («offered now» appearing on a milestone while the player watches) plays
 * the one-shot arrival phrase on that tile, once.
 */
watch(() => props.items, (next: ReadonlyArray<ConsoleMaItem>) => {
  const now = new Set(next
    .filter((it) => isOffered(it))
    .map((it) => it.name));
  const seed = availSeed.value;
  availSeed.value = now;
  if (seed === undefined) {
    return; // mount / category swap — never replay a standing state
  }
  for (const name of now) {
    if (!seed.has(name) && !revealNames.value.includes(name)) {
      revealNames.value.push(name);
      flow.after(motionMs(1400), 'a tile\'s availability reveal ends', () => {
        revealNames.value = revealNames.value.filter((n) => n !== name);
      });
    }
  }
}, {immediate: true});

onMounted(() => {
  // RESTORE-MOUNT: the stage is already open (the task-restore door
  // re-seated the suspended detail) — the transition plays no enter hook,
  // so the browse layer must be parked here or it shows under the stage.
  if (maFocusState.open) {
    parkMaBrowse(root.value as Element);
  } else {
    startRollcall();
  }
});
onBeforeUnmount(() => {
  if (maFocusState.open) {
    if (maFocusState.phase === 'detail') {
      // A lateral move / a defer under a live PRE-COMMIT detail — keep the
      // context as the suspended-instance draft (the restore door re-seats).
      suspendMaFocus();
    } else {
      // A teardown past the commit boundary: the beat (armed or current)
      // belongs to the GLOBAL ceremony shell from here — release the embed
      // claim and consume an already-current claimed beat deterministically.
      abandonMaCeremonyEmbed();
      resetMaFocus();
    }
  }
});
defineExpose({enterFocus});
</script>
