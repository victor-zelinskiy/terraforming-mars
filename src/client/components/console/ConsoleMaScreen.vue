<template>
  <!-- data-motion-*: the director animates the panel (NON_SHADE_OWNERS —
       the OWN dim stays by design; density lives in the panel materials). -->
  <div class="con-ma con-ws" role="dialog" :aria-label="$t(title)"
       :class="{'con-ma--focus': focusState.open}"
       data-motion-surface="ma-screen">
    <div class="con-ma__backdrop" aria-hidden="true"></div>
    <div class="con-ma__panel" data-motion-panel>
      <!-- ── THE WORKSPACE HEADER — the shared ConsoleWsHead: root «НАГРАДЫ» /
           «ДОСТИЖЕНИЯ» + the category emblem; descending into an item grows
           the crumb tail «› БАНКИР › СПОНСОРСТВО» (stable context before the
           mutable stage; amber past the commit). The slot tray + tally + the
           wallet live in the trailing zone — parent chrome, stable through
           every stage. ── -->
      <ConsoleWsHead class="con-ma__wshead"
                     :root="title"
                     :emblem="kind"
                     :subject="crumbSubject"
                     :stage="crumbStage"
                     :committed="crumbCommitted">
        <template #trailing>
          <div class="con-ma__tally">
            <div class="con-ma__slots" aria-hidden="true">
              <span v-for="(c, i) in slots" :key="i"
                    class="con-ma__slot"
                    :class="c !== undefined ? 'player_bg_color_' + c : 'con-ma__slot--empty'"></span>
            </div>
            <div v-if="allTaken" class="con-ma__complete">✓ {{ $t(kind === 'awards' ? 'All funded' : 'All claimed') }}</div>
            <div v-else class="con-ma__count">{{ $t(kind === 'awards' ? 'Funded' : 'Claimed') }} <b>{{ takenCount }}/{{ maxSlots }}</b></div>
            <!-- The WALLET: the overlay covers the resource panel, so the
                 viewer's M€ live HERE — together with the (category-wide)
                 price as a premium before → after preview. -->
            <div class="con-ma__wallet" :class="{'con-ma__wallet--short': !free && walletShort > 0, 'con-ma__wallet--free': free}">
              <span class="con-ma__wallet-label">{{ $t('You have') }}</span>
              <span class="con-ma__wallet-now"><b>{{ myMegacredits }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i></span>
              <span v-if="free" class="con-ma__wallet-free">{{ $t('Free sponsorship') }}</span>
              <template v-else-if="nextCost !== undefined">
                <span class="con-ma__wallet-price">−{{ nextCost }}</span>
                <span v-if="walletShort === 0" class="con-ma__wallet-after">→ <b>{{ walletAfter }}</b></span>
                <span v-else class="con-ma__wallet-shortfall">{{ shortfallText }}</span>
              </template>
            </div>
          </div>
        </template>
      </ConsoleWsHead>

      <!-- ── The stage wrap: the BROWSE layer (the emblem grid) and the MA
           FOCUS stage occupy the same region. Descending recomposes the frame
           in place: the browse DOM is only parked (selection / scroll / focus
           survive by construction). ── -->
      <div class="con-ma__stagewrap">
        <div class="con-ma__browse" :class="{'con-ma__browse--parked': focusState.open}">
          <!-- The dashboard: a 2-column grid whose rows STRETCH to fill the
               panel — the standard 5–6 items always fit with NO scrollbar (an
               odd list's last card spans both columns; overflow scroll is an
               extreme-mod fallback only). Every card is focusable — A only
               SELECTS (opens the detail stage); nothing is ever bought from
               the overview, so the per-item CTA is gone by design. -->
          <ConsoleScrollArea class="con-ma__scroll-host" content-class="con-ma__grid" ref="grid">
            <article v-for="(it, i) in items" :key="it.key"
                     class="con-ma__card"
                     :class="{
                       'con-ma__card--focused': i === index,
                       // P29: the strong actionable lift is a MILESTONE semantic
                       // (a hard condition was met). A fundable award is a normal
                       // economy action — the row stays calm.
                       'con-ma__card--go': it.available && it.kind === 'milestone',
                       'con-ma__card--taken': it.takenBy !== undefined,
                     }"
                     :ref="i === index ? 'focusedCard' : undefined">
              <span v-if="railClass(it) !== ''" class="con-ma__rail" :class="railClass(it)" aria-hidden="true"></span>

              <!-- Art stage: built for the transparent 512×512 icons — a soft
                   radial pedestal, contain (NEVER cropped). It is also the
                   FLIP twin of the focus stage's hero pedestal: the emblem
                   physically continues into the detail state. -->
              <div class="con-ma__stage" aria-hidden="true">
                <div class="con-ma__art" :style="{backgroundImage: `url(assets/ma/${artSlug(it)}.png)`}"></div>
              </div>

              <div class="con-ma__body">
                <div class="con-ma__name" v-i18n>{{ shortName(it.name) }}</div>
                <div class="con-ma__desc" v-i18n>{{ it.description }}</div>
                <div v-if="it.takenBy !== undefined" class="con-ma__owner">
                  <span class="con-ma__owner-dot" :class="'player_bg_color_' + it.takenBy.color" aria-hidden="true"></span>
                  <span class="con-ma__owner-name">{{ it.takenBy.name }}</span>
                  <span class="con-ma__owner-verb">✓ {{ $t(it.kind === 'milestone' ? 'Claimed' : 'Funded') }}</span>
                </div>
              </div>

              <!-- Status column: the dominant YOU metric (score / threshold +
                   meter for milestones; leadership for awards) and the rivals
                   strip (OTHER players only). Action semantics live in the
                   detail stage — the overview compares, it never commits. -->
              <div class="con-ma__status">
                <div class="con-ma__metric" :class="metricClass(it)">
                  <span class="con-ma__metric-label">{{ $t('You') }}</span>
                  <span class="con-ma__metric-value">
                    <template v-if="it.scores.length === 0">—</template>
                    <!-- Condition milestone (no numeric threshold): the raw
                         score is not progress, so show met / not-met. -->
                    <template v-else-if="it.kind === 'milestone' && it.threshold === undefined"><b>{{ it.myReady ? '✓' : '—' }}</b></template>
                    <template v-else><b>{{ it.myScore }}</b><span v-if="it.threshold !== undefined" class="con-ma__metric-req">/{{ it.threshold }}</span></template>
                  </span>
                  <span v-if="it.kind === 'award' && it.scores.length > 0" class="con-ma__metric-sub" :class="{'con-ma__metric-sub--lead': it.myLead}">
                    <template v-if="it.myLead">{{ $t('You lead') }}</template>
                    <template v-else>{{ $t('Leader') }}: {{ it.leaderScore }}</template>
                  </span>
                  <span v-if="it.threshold !== undefined && it.scores.length > 0" class="con-ma__meter" aria-hidden="true"><i :style="{width: meterWidth(it)}"></i></span>
                </div>
                <div v-if="rivals(it).length > 0" class="con-ma__rivals">
                  <span class="con-ma__rivals-label">{{ $t('Rivals') }}</span>
                  <span v-for="s in rivals(it)" :key="s.color"
                        class="con-ma__rival"
                        :class="rivalClasses(it, s)">{{ s.score }}</span>
                </div>
              </div>
            </article>
          </ConsoleScrollArea>

          <!-- Footer: the FOCUSED item's context (one fixed line — owner /
               ready / "+N to the threshold" / the concrete blocker); controller
               hints live in the global command bar. -->
          <div class="con-ma__foot">
            <div class="con-ma__context" :class="contextClass">
              <template v-if="context.tone === 'owner'">
                <span class="con-ma__owner-dot" :class="'player_bg_color_' + context.color" aria-hidden="true"></span>
                <span>{{ $t(context.kind === 'milestone' ? 'claimed by' : 'funded by') }} {{ context.name }}</span>
              </template>
              <template v-else-if="context.tone === 'ready'"><span>{{ $t(context.key) }}</span></template>
              <template v-else-if="context.tone === 'gap'"><span>{{ $t('To the threshold') }}: <b>+{{ context.gap }}</b></span></template>
              <template v-else-if="context.tone === 'blocked'"><span>{{ $t(context.key) }}</span></template>
            </div>
          </div>
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
import {translateTextWithParams} from '@/client/directives/i18n';
import {ConsoleMaItem, ConsoleMaKind, ConsoleMaScore, ConsoleMaFocusContext, consoleMaFocusContext} from '@/client/components/console/consoleMaModel';
import {MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {MaInspectView} from '@/client/components/console/consoleMaInspectModel';
import {maDisplayName} from '@/client/components/ma/maArt';
import {maFocusState, openMaFocus, suspendMaFocus, resetMaFocus} from '@/client/console/consoleMaFocus';
import {abandonMaCeremonyEmbed} from '@/client/components/ma/maCeremonyState';
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
  components: {ConsoleScrollArea, ConsoleWsHead, ConsoleMaFocusStage},
  props: {
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
  },
  emits: ['ceremony-done'],
  computed: {
    focusState() {
      return maFocusState;
    },
    title(): string {
      return this.kind === 'milestones' ? 'Milestones' : 'Awards';
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
      return this.kind === 'milestones' ? 'Claiming' : 'Sponsorship';
    },
    crumbCommitted(): boolean {
      return maFocusState.open && maFocusState.phase !== 'detail';
    },
    takenCount(): number {
      return this.items.filter((it) => it.takenBy !== undefined).length;
    },
    /** The completed state = the SLOT race is over (3/3), not "every listed". */
    allTaken(): boolean {
      return this.takenCount >= this.maxSlots;
    },
    /** Slot pips: filled with each taker's colour, hollow while open. */
    slots(): Array<string | undefined> {
      const colors: Array<string | undefined> = this.items
        .filter((it) => it.takenBy !== undefined)
        .map((it) => it.takenBy?.color);
      while (colors.length < this.maxSlots) {
        colors.push(undefined);
      }
      return colors.slice(0, this.maxSlots);
    },
    nextCost(): number | undefined {
      return this.items.find((it) => it.cost !== undefined)?.cost;
    },
    /** M€ left after the (category-wide) claim/fund price. */
    walletAfter(): number {
      return this.myMegacredits - (this.nextCost ?? 0);
    },
    walletShort(): number {
      return Math.max(0, -this.walletAfter);
    },
    shortfallText(): string {
      return translateTextWithParams('Need ${0} more M€', [String(this.walletShort)]);
    },
    focused(): ConsoleMaItem | undefined {
      return this.items[this.index];
    },
    context(): ConsoleMaFocusContext {
      return consoleMaFocusContext(this.focused);
    },
    contextClass(): string {
      switch (this.context.tone) {
      case 'ready': return 'con-ma__context--ready';
      case 'gap': return 'con-ma__context--gap';
      case 'blocked': return 'con-ma__context--blocked';
      default: return '';
      }
    },
  },
  watch: {
    /** Overflow is an extreme-mod fallback — keep the focus visible there. */
    index() {
      void this.$nextTick(() => {
        const slot = this.$refs.focusedCard as HTMLElement | Array<HTMLElement> | undefined;
        const el = Array.isArray(slot) ? slot[0] : slot;
        // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
        (this.$refs.grid as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(el);
      });
    },
    kind() {
      // A category switch happens from the overview only; a defensively-open
      // stage of the OTHER kind must not survive the swap.
      if (maFocusState.open) {
        resetMaFocus();
      }
      (this.$refs.grid as {scrollToStart?: () => void} | undefined)?.scrollToStart?.();
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
    /** Same slug the desktop overlays bind (assets/ma/<slug>.png). */
    artSlug(it: ConsoleMaItem): string {
      return it.name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
    },
    /** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
    shortName(name: string): string {
      return name.replace(/[0-9]+$/, '');
    },
    rivals(it: ConsoleMaItem): ReadonlyArray<ConsoleMaScore> {
      return [...it.scores].filter((s) => s.color !== it.myColor).sort((a, b) => b.score - a.score);
    },
    railClass(it: ConsoleMaItem): string {
      if (it.takenBy !== undefined) {
        return 'con-ma__rail--owner player_bg_color_' + it.takenBy.color;
      }
      // P29: the mint "act now" rail is milestone-only (see the card class).
      return it.available && it.kind === 'milestone' ? 'con-ma__rail--go' : '';
    },
    metricClass(it: ConsoleMaItem): string {
      if (it.kind === 'award') {
        return it.myLead ? 'con-ma__metric--lead' : '';
      }
      return it.myReady && it.scores.length > 0 ? 'con-ma__metric--ready' : '';
    },
    meterWidth(it: ConsoleMaItem): string {
      const t = it.threshold ?? 0;
      if (t <= 0) {
        return '0%';
      }
      return `${Math.min(100, Math.round((it.myScore / t) * 100))}%`;
    },
    rivalClasses(it: ConsoleMaItem, s: ConsoleMaScore): Array<string> {
      const classes = ['player_bg_color_' + s.color];
      if (it.kind === 'award' && s.score === it.leaderScore && s.score > 0) {
        classes.push('con-ma__rival--leader');
      }
      if (it.kind === 'milestone' && s.claimable === true) {
        classes.push('con-ma__rival--ready');
      }
      return classes;
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
