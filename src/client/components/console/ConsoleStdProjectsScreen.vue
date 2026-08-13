<template>
  <!-- data-motion-*: rides the shared `.con-shade` dim + the surface-motion
       director (wheel-handoff-aware entry) — no own backdrop/CSS entry.
       `con-ws--dockcover`: a full workspace panel — the hand-dock PACK is
       COVERED where the panel reaches it (never hidden, never dimmed; it
       resurfaces for physical card arrivals) — see console.less. -->
  <div class="con-stdp con-ws con-ws--dockcover" role="dialog" :aria-label="$t('Standard Projects')" data-motion-surface="std-projects">
    <div class="con-stdp__panel" data-motion-panel>
      <!-- THE ONE workspace header (ConsoleWsHead): root «СТАНДАРТНЫЕ ПРОЕКТЫ»
           + the identity emblem (the wheel flight's landing anchor). A flow
           grows the crumb tail «› ГОРОД › ВЫБОР» (stable context before the
           mutable stage; amber past the commit). The viewer's wallet with the
           live before → after price preview is parent chrome — the trailing
           zone, stable through every stage. -->
      <ConsoleWsHead class="con-stdp__wshead"
                     root="Standard Projects"
                     emblem="standard-projects"
                     wheel-anchor="std-projects"
                     :subject="crumbSubject"
                     :stage="crumbStage"
                     :stageRaw="crumbStageRaw"
                     :committed="crumbCommitted">
        <template #trailing>
          <div class="con-stdp__wallet" :class="{'con-stdp__wallet--short': focusedShort > 0}">
            <span class="con-stdp__wallet-label">{{ $t('You have') }}</span>
            <span class="con-stdp__wallet-now"><b>{{ myMegacredits }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i></span>
            <!-- The price preview is a PRE-commit statement: past the commit
                 the balance has already moved (the live value above ticks),
                 and re-showing «−N → …» would read as a second spend. -->
            <template v-if="focusedCost !== undefined && !committing">
              <span class="con-stdp__wallet-price">−{{ focusedCost }}</span>
              <span v-if="focusedShort === 0" class="con-stdp__wallet-after">→ <b>{{ myMegacredits - focusedCost }}</b></span>
              <span v-else class="con-stdp__wallet-shortfall">{{ shortfallText }}</span>
            </template>
          </div>
        </template>
      </ConsoleWsHead>

      <!-- ── The stage wrap: the BROWSE layer (the project grid + the focused
           row's context strip) and the flow's NESTED STEP occupy the same
           region as two stacked layers of ONE zone. A step standing inside
           (the Build-Colony pick, the patent sale's hand, the payment) PARKS
           the browse layer — held by opacity/visibility, selection and scroll
           untouched — and teleports into the always-present embed zone. Never
           a `v-if` swap (embed rules; a teleport target must exist at the
           child's mount). ── -->
      <div class="con-stdp__stagewrap">
        <div class="con-stdp__browse" :class="{'con-stdp__browse--parked': stepUp}"
             :aria-hidden="stepUp ? 'true' : undefined">
          <!-- The dashboard: a 2-column grid — every basic action is a focusable
               card (Patent sale included, Steam-version parity); a disabled card
               still explains itself via the footer context. -->
          <ConsoleScrollArea class="con-stdp__scroll-host" content-class="con-stdp__grid" ref="grid">
            <article v-for="(it, i) in items" :key="it.key"
                     class="con-stdp__card"
                     :class="{
                       'con-stdp__card--focused': i === index,
                       'con-stdp__card--go': it.available && !committing,
                       'con-stdp__card--off': !it.available,
                       'con-stdp__card--committed': committing && it.key === flowCardKey,
                     }"
                     :ref="i === index ? 'focusedCard' : undefined">
            <span v-if="it.available" class="con-stdp__rail" aria-hidden="true"></span>
            <div class="con-stdp__stage" aria-hidden="true">
              <i class="con-stdp__icon" :class="it.iconClass"></i>
            </div>
            <div class="con-stdp__body">
              <div class="con-stdp__name">{{ $t(it.title) }}</div>
              <div class="con-stdp__desc">{{ $t(it.description) }}</div>
            </div>
            <div class="con-stdp__status">
              <span v-if="it.cost !== undefined" class="con-stdp__cost" :class="{'con-stdp__cost--short': it.available === false && it.cost > myMegacredits}">
                <b>{{ it.cost }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
                <!-- The saving already folded into the price — the SAME compact
                     `−N` capsule the premium card face docks on its cost badge
                     (`.pcard__cost-delta`). Absolutely positioned: zero row
                     growth, zero layout shift, nothing at zero discount. -->
                <span v-if="it.discount !== undefined" class="con-stdp__cost-delta" :aria-label="$t('Discount')">−{{ it.discount }}</span>
              </span>
              <span v-else-if="it.gain !== undefined" class="con-stdp__gain">
                <b>{{ it.gain }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
                <span class="con-stdp__gain-note">
                  <span aria-hidden="true">/</span>
                  <i class="resource_icon resource_icon--cards" role="img" :aria-label="$t('card')"></i>
                </span>
              </span>
            </div>
            </article>
          </ConsoleScrollArea>

          <!-- Footer: the FOCUSED item's context — the projected result in the
               SAME `current → resulting` chip language every composer speaks
               (never a bespoke preview dialect), the honest maxed-parameter
               warnings, the pay-on-commit next step, or the concrete blocker.
               (Controller hints live in the global command bar.) -->
          <div class="con-stdp__foot" aria-live="polite">
            <div class="con-stdp__context" :class="contextClass">
              <span v-if="focused !== undefined" class="con-stdp__context-name">{{ $t(focused.title) }}</span>
              <span v-if="focused !== undefined" class="con-stdp__context-divider" aria-hidden="true"></span>
              <span v-if="focused !== undefined && !focused.available" class="con-stdp__context-state">{{ focusedReason }}</span>
              <template v-else-if="focused !== undefined">
                <span v-if="committing && focused.key === flowCardKey" class="con-stdp__context-state con-stdp__context-state--committed">{{ $t('Completed') }}</span>
                <div v-if="focusedChips.length > 0" class="con-stdp__context-chips">
                  <ActionEffectChip v-for="(e, ci) in focusedChips" :key="ci" :effect="e" />
                </div>
                <span v-else-if="!committing" class="con-stdp__context-state">{{ $t('Ready to use now') }}</span>
                <span v-if="nextStepKey !== undefined" class="con-stdp__context-next">› {{ $t(nextStepKey) }}</span>
                <span v-for="w in focusedWarnings" :key="w" class="con-stdp__context-warning">⚠ {{ $t(warningTextOf(w)) }}</span>
              </template>
            </div>
          </div>
        </div>

        <!-- The flow's NESTED-STEP zone. Always present (a `<Teleport>` whose
             target is missing at mount drops its content), overlaid on the
             browse layer; the hosted surface (hand / colonies / payment) is
             the SAME shell-mounted instance wearing `embedded`. -->
        <div class="con-stdp__step" :class="{'con-stdp__step--up': stepUp}"
             data-embed-slot="stdp-step" data-outcome-zone></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * P27 → North-Star rework — the console-native STANDARD PROJECTS WORKSPACE.
 *
 * The whole basic-actions family on one dashboard (every server std project +
 * PATENT SALE as a first-class entry), and the OWNER of the whole flow: a
 * project needing a target hosts that choice as a NESTED STEP inside this very
 * panel (Build Colony → the colonies, Patent sale → the hand, the alt-resource
 * payment → the payment host), a placement project yields to the always-mounted
 * board and comes back on cancel, and a terminal project commits right here
 * with a short committed beat — no second confirm, no resource flights.
 *
 * PURE derivation lives in consoleQuickModel.buildStdProjectItems (rows,
 * server-authoritative reasons, the generic discount) + the server's
 * `CardModel.standardProjectPreview` (guaranteed `current → resulting` chips);
 * flow state lives in consoleStdProjects.ts; input handling (grid nav / A / B)
 * stays in ConsoleShell, like every sheet.
 */
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {translateTextWithParams, translateText} from '@/client/directives/i18n';
import {StdProjectItem} from '@/client/console/consoleQuickModel';
import {stdProjectsFlow} from '@/client/console/consoleStdProjects';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {Warning} from '@/common/cards/Warning';
import {warningText} from '@/client/components/card/cardWarnings';
import {setWorkspaceFrameSlot, workspaceStackCrumb} from '@/client/console/consoleWorkspaceStack';
import {
  armOutcomeOriginFrom, playOutcomeContent, playOutcomePhase,
} from '@/client/console/consoleActionOutcomeMotion';

/** The zone this workspace publishes for its hosted step (embed rule 4). */
const STDP_EMBED_SLOT = '.con-stdp [data-embed-slot="stdp-step"]';

export default defineComponent({
  name: 'ConsoleStdProjectsScreen',
  components: {ConsoleWsHead, ConsoleScrollArea, ActionEffectChip},
  props: {
    items: {type: Array as PropType<ReadonlyArray<StdProjectItem>>, required: true},
    index: {type: Number, required: true},
    myMegacredits: {type: Number, required: true},
    /**
     * B semantics differ for the MANDATORY std-project prompt (Minimize).
     * Rendered by the shell's command bar now (the local hint row is gone);
     * kept declared so the shell's :backLabel binding doesn't fall through
     * as a DOM attribute.
     */
    backLabel: {type: String, default: 'Close'},
    /**
     * A step of the flow is standing INSIDE this workspace (a nested frame —
     * the colony pick, the sale's hand — or the embedded payment host, which
     * teleports without a frame of its own). The shell computes it — the ONE
     * derivation — and the browse layer parks on it.
     */
    stepUp: {type: Boolean, default: false},
  },
  computed: {
    focused(): StdProjectItem | undefined {
      return this.items[this.index];
    },
    focusedCost(): number | undefined {
      return this.focused?.cost;
    },
    focusedShort(): number {
      const cost = this.focusedCost;
      if (cost === undefined) {
        return 0;
      }
      return Math.max(0, cost - this.myMegacredits);
    },
    shortfallText(): string {
      return translateTextWithParams('Need ${0} more M€', [String(this.focusedShort)]);
    },
    focusedReason(): string {
      const f = this.focused;
      if (f === undefined || f.reason === '') {
        return '';
      }
      return f.reasonParams !== undefined ?
        translateTextWithParams(f.reason, [...f.reasonParams]) :
        translateText(f.reason);
    },
    contextClass(): string {
      if (this.focused === undefined) {
        return '';
      }
      if (this.committing && this.focused.key === this.flowCardKey) {
        return 'con-stdp__context--committed';
      }
      return this.focused.available ? 'con-stdp__context--ready' : 'con-stdp__context--blocked';
    },
    /**
     * The focused row's projected-result chips — the server's guaranteed
     * effects MINUS the M€ cost chip (the price already reads twice: the row
     * and the wallet preview; a third copy is the duplication rule 6 forbids).
     * Reserve-unit costs (Moon steel/titanium) stay — shown nowhere else.
     */
    focusedChips(): ReadonlyArray<ActionEffect> {
      const effects = this.focused?.preview?.effects ?? [];
      return effects.filter((e) => !(e.direction === 'cost' && e.icon === 'megacredits'));
    },
    focusedWarnings(): ReadonlyArray<Warning> {
      return this.focused?.warnings ?? [];
    },
    /** The pay-on-commit follow-up, named BEFORE the descent (§7: only the
     *  guaranteed part is promised — target-dependent results arrive with the
     *  step's own preview surfaces). Existing i18n keys, nothing coined. */
    nextStepKey(): string | undefined {
      const target = this.focused?.preview?.target;
      if (target === 'space') {
        return 'Next: choose a location on the board.';
      }
      if (target === 'colony') {
        return 'Next: choose a colony.';
      }
      return undefined;
    },
    /** The terminal-commit beat (the world changed; the row states it). */
    committing(): boolean {
      return stdProjectsFlow.state === 'commit';
    },
    flowCardKey(): string {
      return stdProjectsFlow.card;
    },
    // ── the shared crumb (workspaceStackCrumb → ConsoleWsHead) ──────────────
    crumbSubject(): string {
      return workspaceStackCrumb()?.subject?.text ?? '';
    },
    crumbStage(): string {
      return workspaceStackCrumb()?.stage ?? '';
    },
    /** A hosted step may publish a composed, already-translated tail
     *  («ГАНИМЕД · ТОРГОВЛЯ») — mirror the stack's own convention. */
    crumbStageRaw(): boolean {
      return false;
    },
    crumbCommitted(): boolean {
      return workspaceStackCrumb()?.committed === true;
    },
  },
  watch: {
    /** Overflow is a fallback — keep the focus visible there. */
    index() {
      void this.$nextTick(() => {
        const slot = this.$refs.focusedCard as HTMLElement | Array<HTMLElement> | undefined;
        const el = Array.isArray(slot) ? slot[0] : slot;
        // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
        (this.$refs.grid as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(el);
      });
    },
    /**
     * The DESCEND phrase, one level deeper (never a v-if blink): the browse
     * layer RELEASES on the spot (the `--parked` CSS transition), the step
     * zone UNFOLDS from the rect the pressed row occupied (armed by the shell
     * synchronously at the press — a stale arm degrades to a plain surface),
     * and the teleported step REVEALS from inside the opened zone. The fold
     * back is the same phrase reversed: the zone's inline motion props are
     * cleared and the parked layer returns through its own transition.
     */
    stepUp(up: boolean) {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || root === null) {
        return;
      }
      const zone = root.querySelector<HTMLElement>('[data-outcome-zone]');
      if (up) {
        void this.$nextTick(() => {
          playOutcomePhase(root, () => {
            playOutcomeContent(root);
          });
        });
      } else if (zone !== null) {
        gsap.killTweensOf(zone);
        gsap.set(zone, {clearProps: 'all'});
      }
    },
  },
  methods: {
    warningTextOf(w: Warning): string {
      return warningText(w);
    },
    /** Arm the descend phrase from the FOCUSED row — called by the shell
     *  SYNCHRONOUSLY in the press handler (and again when a server round
     *  trip pushes the step later; a stale arm degrades gracefully). */
    armStepOrigin(): void {
      const slot = this.$refs.focusedCard as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      armOutcomeOriginFrom(el);
    },
  },
  mounted() {
    // Embed rule 4: the zone is published from mounted() (a change-watcher
    // cannot fire true→true across a restore) and retracted in beforeUnmount —
    // never from the flow side.
    setWorkspaceFrameSlot('standard-projects', STDP_EMBED_SLOT);
  },
  beforeUnmount() {
    setWorkspaceFrameSlot('standard-projects', '');
  },
});
</script>
