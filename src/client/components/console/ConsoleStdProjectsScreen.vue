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
           mutable stage; amber past the commit).

           NO wallet here any more. The projected transaction of ONE action was
           split across two zones — the M€ half in this trailing block, the
           rest as chips in the status rail — so a single move read as two
           unrelated statements. The rail now carries the WHOLE projection
           (M€ chip included) and the header is quiet: the balance already
           lives on the player rail, and the price already lives in the row. -->
      <ConsoleWsHead class="con-stdp__wshead"
                     root="Standard Projects"
                     emblem="standard-projects"
                     wheel-anchor="std-projects"
                     :subject="crumbSubject"
                     :stage="crumbStage"
                     :stageRaw="crumbStageRaw"
                     :committed="crumbCommitted" />

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
                       'con-stdp__card--go': it.available && !isCommitRow(it),
                       'con-stdp__card--off': !it.available,
                       // THE COMMIT PHRASE, on the row that was pressed:
                       // `--pressing` is the tactile answer (it plays on the
                       // press frame, before the server has said anything);
                       // `--committing` runs the gold sweep along the rail;
                       // `--committed` holds the fixed gold state.
                       'con-stdp__card--pressing': commitPhase === 'press' && it.key === commitCardKey,
                       'con-stdp__card--committing': commitPhase === 'committing' && it.key === commitCardKey,
                       'con-stdp__card--committed': commitPhase === 'committed' && it.key === commitCardKey,
                     }"
                     :ref="i === index ? 'focusedCard' : undefined">
            <span v-if="it.available" class="con-stdp__rail" aria-hidden="true">
              <!-- The gold pass's own body inside the state marker: the rail
                   is re-forged rather than repainted. -->
              <i class="con-stdp__rail-sweep" aria-hidden="true"></i>
            </span>
            <!-- THE GOLD WAVE crosses the whole ROW once — the row is what
                 changed state, so the row is what the light travels. Present
                 only on the committing row (it is otherwise transparent and
                 pointer-inert). -->
            <i v-if="it.available" class="con-stdp__wave" aria-hidden="true"></i>
            <div class="con-stdp__stage" aria-hidden="true">
              <i class="con-stdp__icon" :class="it.iconClass"></i>
            </div>
            <div class="con-stdp__body">
              <div class="con-stdp__name">{{ $t(it.title) }}</div>
              <div class="con-stdp__desc">{{ $t(it.description) }}</div>
            </div>
            <div class="con-stdp__status">
              <span v-if="it.cost !== undefined" class="con-stdp__cost"
                    :class="{
                      'con-stdp__cost--short': it.available === false && it.cost > myMegacredits,
                      'con-stdp__cost--discounted': it.discount !== undefined,
                    }">
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
                <span v-if="commitPhase === 'committed' && focused.key === commitCardKey"
                      class="con-stdp__context-state con-stdp__context-state--committed">{{ $t('Completed') }}</span>
                <!-- THE WHOLE PROJECTED TRANSACTION, one row, one language:
                     the M€ chip first (what it costs you), then production /
                     global parameters, then the next step. Keyed by identity
                     so a focus change CROSSFADES the set in place instead of
                     re-flowing the line — the rail's height is fixed. -->
                <transition-group v-if="focusedChips.length > 0" tag="div" class="con-stdp__context-chips"
                                  name="con-stdp-chip">
                  <ActionEffectChip v-for="e in focusedChips" :key="chipKey(e)" :effect="e" />
                </transition-group>
                <span v-else-if="commitPhase === 'idle'" class="con-stdp__context-state">{{ $t('Ready to use now') }}</span>
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
import {
  StdProjectCommitPhase, stdProjectCommitState,
} from '@/client/console/consoleStdProjectCommit';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {Warning} from '@/common/cards/Warning';
import {warningText} from '@/client/components/card/cardWarnings';
import {setWorkspaceFrameSlot, workspaceStackCrumb} from '@/client/console/consoleWorkspaceStack';
import {armOutcomeOriginFrom} from '@/client/console/consoleActionOutcomeMotion';

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
      if (this.commitPhase === 'committed' && this.focused.key === this.commitCardKey) {
        return 'con-stdp__context--committed';
      }
      return this.focused.available ? 'con-stdp__context--ready' : 'con-stdp__context--blocked';
    },
    /**
     * THE WHOLE PROJECTED TRANSACTION of the focused project, in the order it
     * reads: what it costs you (the M€ chip), then what it changes (production
     * / a global parameter / oceans), then anything else guaranteed.
     *
     * The M€ chip is the server's OWN cost effect — `current → resulting` in
     * the same component every composer renders — not a money widget coined
     * here. It used to be filtered out because the header carried a second,
     * differently-shaped copy of it; with that block gone the transaction is
     * whole, and the row's price is the only other statement (a price is not
     * a projection: it says what the thing costs, not where you land).
     */
    focusedChips(): ReadonlyArray<ActionEffect> {
      return this.focused?.preview?.effects ?? [];
    },
    /** Chip identity for the crossfade — icon + note is what makes two chips
     *  the SAME statement across a focus change (the M€ chip stays put while
     *  the parameter beside it swaps). */
    chipKeyOf(): (e: ActionEffect) => string {
      return (e: ActionEffect) => `${e.direction}:${e.icon}:${e.note ?? ''}`;
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
      // PATENT SALE is a client pre-select, so it has no server preview and no
      // honest projection yet: the payout depends entirely on cards nobody has
      // picked. The row already states the RULE («+1 M€ / карта»), so the rail
      // states the STEP — and the real `current → resulting` money appears
      // inside the hand step, computed from the actual picks.
      if (this.focused?.key === 'sell-patents') {
        return 'Next: choose the cards to sell.';
      }
      return undefined;
    },
    /**
     * THE COMMIT PHRASE's phase — the row's pose comes from this, never from
     * whichever render the server's answer happened to land in. `press` is
     * already true on the press frame (the tactile answer owes nothing to the
     * network); `committing` is the gold sweep; `committed` is the held gold.
     */
    commitPhase(): StdProjectCommitPhase {
      return stdProjectCommitState.phase;
    },
    /** Which row the phrase belongs to (the pressed one, not the focused one —
     *  they are the same today, and a stray focus move must not steal it). */
    commitCardKey(): string {
      return stdProjectCommitState.card;
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
      if (root === undefined || root === null || up) {
        return;
      }
      // Folding back: drop anything a previous episode may have left on the
      // zone. The ENTRY itself is CSS — see below.
      const zone = root.querySelector<HTMLElement>('[data-outcome-zone]');
      if (zone !== null) {
        gsap.killTweensOf(zone);
        gsap.set(zone, {clearProps: 'all'});
      }
    },
  },
  methods: {
    warningTextOf(w: Warning): string {
      return warningText(w);
    },
    chipKey(e: ActionEffect): string {
      return this.chipKeyOf(e);
    },
    /** Is this the row the commit phrase is playing on? */
    isCommitRow(it: StdProjectItem): boolean {
      return this.commitPhase !== 'idle' && it.key === this.commitCardKey;
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
