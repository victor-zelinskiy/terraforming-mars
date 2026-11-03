<template>
  <!-- data-motion-*: the director animates the panel (NON_SHADE_OWNERS —
       the OWN dim stays by design; density lives in the panel materials). -->
  <div class="con-ma con-ws con-ws--dockcover" role="dialog" :aria-label="$t(title)"
       :class="['con-ma--' + kind, {'con-ma--focus': focusState.open}]"
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
            <div v-if="!allTaken" class="con-ma__price" :class="{'con-ma__price--free': free || nextCost === 0}" :data-ma-price="kind">
              <span class="con-ma__price-label">{{ $t('Cost') }}</span>
              <span v-if="free || nextCost === 0" class="con-ma__price-free">{{ $t('Free') }}</span>
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
          <!-- TWO WORKSPACES, ONE FAMILY (FB′ — the owner, 2026-11-03: the one-screen split divided attention and
               scrolled with Venus). ONE column of FULL-WIDTH rows of one height (`--ma-rows` = the list), so five and
               six items both stand whole and an odd count never stretches a tile. Every row reads left to right:
               the medallion · the name and its rule · THE FIELD (the table, seat by seat) · YOUR plate. -->
          <ConsoleScrollArea class="con-ma__scroll-host" content-class="con-ma__grid" ref="grid"
                             :style="{'--ma-rows': String(Math.max(1, items.length)), '--ma-seats': String(seatCount)}">
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
                     :ref="i === index ? 'focusedCard' : undefined"
                     @click="onCardClick(i)">
              <span v-if="railClass(it) !== ''" class="con-ma__rail" :class="railClass(it)" aria-hidden="true"></span>

              <!-- The medallion: ONE optical size on every row (the measured fit `maArtFitStyle` — the same the
                   strategy rail draws), on a plain plate; a taken emblem desaturates. The FLIP twin of the detail
                   stage's hero. -->
              <div class="con-ma__stage" aria-hidden="true">
                <div class="con-ma__art" :style="artStyle(it)"></div>
                <i v-if="it.kind === 'award' && it.takenBy !== undefined"
                   class="con-ma__gem" :class="'player_bg_color_' + it.takenBy.color"></i>
              </div>

              <!-- The name — and WHO took it on the same line (a settled fact beside the name, never a third line
                   that grows the row) — over the rule. -->
              <div class="con-ma__body">
                <div class="con-ma__nameline">
                  <span class="con-ma__name" v-i18n>{{ shortName(it.name) }}</span>
                  <span v-if="it.takenBy !== undefined" class="con-ma__owner">
                    <span class="con-ma__owner-dot" :class="'player_bg_color_' + it.takenBy.color" aria-hidden="true"></span>
                    <span class="con-ma__owner-name">{{ it.takenBy.name }}</span>
                    <span class="con-ma__owner-verb">✓ {{ $t(it.kind === 'milestone' ? 'Claimed' : 'Funded') }}</span>
                  </span>
                </div>
                <div class="con-ma__desc" v-i18n>{{ it.description }}</div>
              </div>

              <!-- THE FIELD — the table read across the row (`maFieldLanes`): a milestone's RIVALS on their way to the
                   threshold (a rival who meets it wears the drawn check), an award's every SEAT ranked by its score
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

              <!-- YOUR PLATE — the one reading that is yours, at ONE width on every row: a milestone's count toward
                   its threshold (or the owner's seal once claimed); an award's score and where it puts you. -->
              <div class="con-ma__status">
                <div v-if="it.kind === 'milestone' && it.takenBy !== undefined"
                     class="con-ma__seal"
                     :class="{'con-ma__seal--mine': it.takenBy.color === it.myColor}">
                  <i class="con-ma__seal-cube" :class="'player_bg_color_' + it.takenBy.color" aria-hidden="true"></i>
                  <i class="con-ma__seal-tick" aria-hidden="true">
                    <svg viewBox="0 0 12 10"><path d="M1.6 5.4 L4.6 8.3 L10.4 1.7" /></svg>
                  </i>
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
                    <span v-if="it.available" class="con-ma__avail">{{ $t('Available now') }}</span>
                    <span v-else-if="it.threshold !== undefined && it.scores.length > 0" class="con-ma__meter" aria-hidden="true"><i :style="{width: meterWidth(it)}"></i></span>
                  </span>
                </div>
                <div v-else class="con-ma__race" :class="'con-ma__race--' + it.raceTone">
                  <span class="con-ma__metric-label">{{ $t('You') }}</span>
                  <span class="con-ma__race-value"><b>{{ it.myScore }}</b></span>
                  <span class="con-ma__race-foot" :class="'con-ma__race-foot--' + it.raceTone">{{ raceFootText(it) }}</span>
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

<script lang="ts">
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
import {defineComponent, PropType} from 'vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleMaFocusStage from '@/client/components/console/ConsoleMaFocusStage.vue';
import ConsoleMaRail from '@/client/components/console/ConsoleMaRail.vue';
import {ConsoleMaItem, ConsoleMaKind, maAwardGap, maFieldLanes, MaFieldLane} from '@/client/components/console/consoleMaModel';
import {buildMaRail, MaRailView} from '@/client/components/console/consoleMaRail';
import {motionMs} from '@/client/components/motion/motionTokens';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {MaConfirmView} from '@/client/components/ma/maConfirmModel';
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

export default defineComponent({
  name: 'ConsoleMaScreen',
  components: {ConsoleScrollArea, ConsoleWsHead, ConsoleMaFocusStage, ConsoleMaRail},
  props: {
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
    /** The awards' sponsors in funding order (the detail's sponsorship ladder). */
    sponsors: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  },
  emits: ['ceremony-done', 'pick'],
  data() {
    return {
      /**
       * The one-shot availability REVEAL ledger (seed-then-diff, the strategy
       * rail's idiom): names whose «offered now» rose on a LIVE watched frame.
       * The first observation after mount seeds silently — opening the
       * workspace never replays a ceremony for a state that merely IS.
       */
      revealNames: [] as Array<string>,
      /** The reveal ledger's seed (undefined = the next pass seeds silently). */
      availSeed: undefined as Set<string> | undefined,
      /** The LB/RB ARRIVE beat — the side the family's other workspace came in from ('' = standing). */
      kindArrive: '' as '' | 'left' | 'right',
      arriveTimer: undefined as number | undefined,
    };
  },
  computed: {
    focusState() {
      return maFocusState;
    },
    title(): string {
      return this.kind === 'milestones' ? 'Milestones' : 'Awards';
    },
    /** The slot tray: each TAKER's colour in order, then the empty slots. */
    slots(): Array<string | undefined> {
      const takers: Array<string | undefined> = this.items.filter((it) => it.takenBy !== undefined).map((it) => it.takenBy?.color);
      while (takers.length < this.maxSlots) {
        takers.push(undefined);
      }
      return takers.slice(0, this.maxSlots);
    },
    allTaken(): boolean {
      return this.takenCount >= this.maxSlots;
    },
    /** The fund/claim action is genuinely offered on some item right now. */
    anyAvailable(): boolean {
      return this.items.some((it) => it.available && it.takenBy === undefined);
    },
    /** The widest field on the screen — every field reserves it, so the lanes stand in the same columns row to row. */
    seatCount(): number {
      return Math.max(0, ...this.items.map((it) => maFieldLanes(it).length));
    },
    /** The descended item (undefined = the stage has nothing to stand on). */
    focusItem(): ConsoleMaItem | undefined {
      return maFocusState.open ?
        this.items.find((it) => it.name === maFocusState.name) : undefined;
    },
    // ── The workspace crumb (ConsoleWsHead) ────────────────────────────────
    crumbSubject(): string {
      return this.focusItem !== undefined ? maDisplayName(this.focusItem.name) : '';
    },
    crumbStage(): string {
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
      return this.kind === 'milestones' ? 'Claiming' : 'Sponsorship';
    },
    crumbCommitted(): boolean {
      return maFocusState.open && maFocusState.phase !== 'detail';
    },
    // ── The header when NESTED (the scene-step shape) ──────────────────────
    /** The stack kind this screen renders as (two kinds, one chassis). */
    frameKind(): WorkspaceFrameKind {
      return this.kind === 'milestones' ? 'milestones' : 'awards';
    },
    /** Nested (a hosted scene step / a stand over a surviving phase root):
     *  the crumb is the STACK's — root = the flow the player entered. */
    stackCrumb(): ReturnType<typeof workspaceStackCrumb> {
      return workspaceFrameIndex(this.frameKind) > 0 ? workspaceStackCrumb() : undefined;
    },
    headRoot(): string {
      return this.stackCrumb?.root ?? this.title;
    },
    /** The identity symbol belongs to the PARENT anchor (the stack's root
     *  kind); a root with none draws none — never this screen's own. */
    headEmblem(): string | undefined {
      if (this.stackCrumb === undefined) {
        return this.kind;
      }
      const rootKind = workspaceStackRootKind();
      return rootKind !== undefined ? workspaceFrameEmblem(rootKind).emblem : undefined;
    },
    headSubject(): string {
      return this.stackCrumb !== undefined ? (this.stackCrumb.subject?.text ?? '') : this.crumbSubject;
    },
    headStage(): string {
      return this.stackCrumb !== undefined ? (this.stackCrumb.stage ?? '') : this.crumbStage;
    },
    headCommitted(): boolean {
      return this.stackCrumb?.committed ?? this.crumbCommitted;
    },
    /**
     * What this screen HANDS UP to its frame while nested (rule 5 — an
     * embedded surface never titles itself, it publishes): the stage tail
     * (its own stage names, the category name at the browse layer) and the
     * carried subject (the descended item; the HOST's source card — the
     * corporation whose action this step is — while browsing).
     */
    nestedCrumb(): {stage: string, subject: string} | undefined {
      if (workspaceFrameIndex(this.frameKind) <= 0) {
        return undefined;
      }
      const base = workspaceStepSourceCard(this.frameKind, () => false);
      return {
        stage: this.crumbStage !== '' ? this.crumbStage : this.title,
        subject: this.crumbSubject !== '' ? this.crumbSubject : base,
      };
    },
    takenCount(): number {
      return this.items.filter((it) => it.takenBy !== undefined).length;
    },
    /** The LIVE price of the next claim/fund — the shell passes the ENGINE's
     *  own number through the items (`cost`); the header shows it, the rail
     *  projects it, and the submit charges it. */
    nextCost(): number | undefined {
      return this.items.find((it) => it.cost !== undefined)?.cost;
    },
    focused(): ConsoleMaItem | undefined {
      return this.items[this.index];
    },
    focusedName(): string {
      return this.focused !== undefined ? maDisplayName(this.focused.name) : '';
    },
    /** THE STATUS RAIL of the focused item — the same pure model the detail
     *  stage renders (one projection, one language, one place). */
    railView(): MaRailView {
      return buildMaRail({
        item: this.focused,
        kind: this.kind,
        cost: this.focused?.cost ?? this.nextCost ?? 0,
        free: this.free,
        myMegacredits: this.myMegacredits,
        takenCount: this.takenCount,
        maxSlots: this.maxSlots,
        billAsks: this.focused !== undefined && this.billNames.includes(this.focused.name),
      });
    },
  },
  watch: {
    /** Publish the crumb tail + subject UP to the frame while nested — the
     *  header renders the STACK, so what this screen knows (its stages, the
     *  descended item) must live there or the tail never advances. */
    nestedCrumb: {
      immediate: true,
      handler(c: {stage: string, subject: string} | undefined) {
        if (c === undefined) {
          return;
        }
        setWorkspaceFrameStage(this.frameKind, c.stage);
        setWorkspaceFrameSubject(this.frameKind, c.subject);
      },
    },
    /** Overflow is an extreme-mod fallback — keep the focus visible there. */
    index() {
      void this.$nextTick(() => {
        const slot = this.$refs.focusedCard as HTMLElement | Array<HTMLElement> | undefined;
        const el = Array.isArray(slot) ? slot[0] : slot;
        // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
        (this.$refs.grid as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(el);
      });
    },
    kind(next: ConsoleMaKind, prev: ConsoleMaKind) {
      // A family switch happens from the overview only; a defensively-open stage of the OTHER kind must not survive it.
      if (maFocusState.open) {
        resetMaFocus();
      }
      (this.$refs.grid as {scrollToStart?: () => void} | undefined)?.scrollToStart?.();
      // The ARRIVE beat: the other workspace's list slides in from its bumper's side (RB → the awards from the right)
      // while the frame, the head and the rail stand still. The reveal ledger seeds fresh for the new list.
      this.availSeed = undefined;
      this.revealNames = [];
      this.kindArrive = next === 'awards' && prev === 'milestones' ? 'right' : 'left';
      window.clearTimeout(this.arriveTimer);
      this.arriveTimer = window.setTimeout(() => {
        this.kindArrive = '';
      }, motionMs(260));
    },
    /**
     * THE AVAILABILITY REVEAL — seed-then-diff over the items' own identity.
     * The first pass per mount/category seeds silently; a LIVE rising edge
     * («offered now» appearing on a milestone while the player watches) plays
     * the one-shot arrival phrase on that tile, once.
     */
    items: {
      immediate: true,
      handler(next: ReadonlyArray<ConsoleMaItem>) {
        const now = new Set(next
          .filter((it) => it.kind === 'milestone' && it.available && it.takenBy === undefined)
          .map((it) => it.name));
        const seed = this.availSeed;
        this.availSeed = now;
        if (seed === undefined) {
          return; // mount / category swap — never replay a standing state
        }
        for (const name of now) {
          if (!seed.has(name) && !this.revealNames.includes(name)) {
            this.revealNames.push(name);
            window.setTimeout(() => {
              this.revealNames = this.revealNames.filter((n) => n !== name);
            }, motionMs(1400));
          }
        }
      },
    },
  },
  mounted() {
    // RESTORE-MOUNT: the stage is already open (the task-restore door
    // re-seated the suspended detail) — the transition plays no enter hook,
    // so the browse layer must be parked here or it shows under the stage.
    if (maFocusState.open) {
      parkMaBrowse(this.$el as Element);
    }
  },
  beforeUnmount() {
    window.clearTimeout(this.arriveTimer);
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
  },
  methods: {
    /** The emblem at ONE optical size — the measured fit the strategy rail reads (the player's language's file). */
    artStyle(it: ConsoleMaItem): Record<string, string> {
      return maArtFitStyle(it.name);
    },
    /** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
    shortName(name: string): string {
      return name.replace(/[0-9]+$/, '');
    },
    /** The row's field — the table seat by seat (pure: `maFieldLanes`). */
    lanesOf(it: ConsoleMaItem): ReadonlyArray<MaFieldLane> {
      return maFieldLanes(it);
    },
    railClass(it: ConsoleMaItem): string {
      if (it.takenBy !== undefined) {
        return 'con-ma__rail--owner player_bg_color_' + it.takenBy.color;
      }
      // The left edge speaks OWNER colour only; availability's edge is the
      // card's own bottom shelf light (CSS `--go` — see console.less).
      return '';
    },
    /** Milestone metric tones: gold-white «offered now» over green «met». */
    metricClass(it: ConsoleMaItem): string {
      if (it.available) {
        return 'con-ma__metric--now';
      }
      return it.myReady && it.scores.length > 0 ? 'con-ma__metric--ready' : '';
    },
    /**
     * The award race foot — WHERE THE VIEWER STANDS, in words (colour alone
     * may never carry it): leads / shares the lead / trails (with their own
     * count — they may not be in either rendered tier) / no race yet.
     */
    raceFootText(it: ConsoleMaItem): string {
      switch (it.raceTone) {
      case 'lead': return $t('You lead');
      case 'tie': return $t('Tied for the lead');
      case 'behind': return translateTextWithParams('Behind by ${0}', [String(maAwardGap(it))]);
      default: return $t('No race yet');
      }
    },
    /** Mouse/touch parity: a click focuses the tile; a click on the focused
     *  tile opens it (the same two-step the controller speaks). */
    onCardClick(i: number): void {
      if (maFocusState.open) {
        return;
      }
      this.$emit('pick', i);
    },
    meterWidth(it: ConsoleMaItem): string {
      const t = it.threshold ?? 0;
      if (t <= 0) {
        return '0%';
      }
      return `${Math.min(100, Math.round((it.myScore / t) * 100))}%`;
    },
    // ── The MA FOCUS descend (browse → detail and back) ────────────────────
    /**
     * Descend into the item at `index` (A = «Выбрать» — EVERY item is
     * selectable, taken/blocked ones included: the stage explains the state).
     * Arms the descend origins SYNCHRONOUSLY at the press: the card's rect
     * (the unfold source) + the emblem pedestal's rect (the FLIP source).
     */
    enterFocus(): void {
      const item = this.items[this.index];
      if (item === undefined || maFocusState.open) {
        return;
      }
      const slot = this.$refs.focusedCard as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      const art = el?.querySelector<HTMLElement>('.con-ma__stage');
      const rectOf = (node: HTMLElement | null | undefined) => {
        const r = node?.getBoundingClientRect();
        return r === undefined || r.width < 10 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      armMaFocusOrigin(rectOf(el), rectOf(art));
      openMaFocus(item.kind, item.name);
    },
    onFocusEnter(el: Element, done: () => void): void {
      maFocusEnterHook(el, done);
    },
    onFocusLeave(el: Element, done: () => void): void {
      maFocusLeaveHook(el, done);
    },
    onFocusEnterCancelled(el: Element): void {
      maFocusEnterCancelledHook(el);
    },
    onFocusLeaveCancelled(el: Element): void {
      maFocusLeaveCancelledHook(el);
    },
  },
});
</script>
