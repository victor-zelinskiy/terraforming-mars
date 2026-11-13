<template>
  <div ref="root" class="con-stdp con-ws con-ws--dockcover" role="dialog" :aria-label="$t('Standard Projects')" data-motion-surface="std-projects">
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
      <div class="con-stdp__stagewrap" data-forecast-host>
        <!-- ── THE «ЭФФЕКТЫ» LAYER (R3) — a LEVEL of this workspace, the composers' own (PL-066): the browse PARKS
             in place, the explorer unfolds out of the foot's «⚡ сработает» door with the FOCUSED project's answer
             (the ruling Greens' 2 M€ on an asteroid's degree, a card that reacts to the scale), B / R3 fold it
             back with the cursor where it stood; the crumb gains «ЭФФЕКТЫ». The shell routes the pad here. ── -->
        <ConsoleForecastLayer ref="forecastLayer"
                              host="stdp"
                              :forecast="focusedForecast"
                              :cards="thisPlayer?.tableau ?? []"
                              :color="thisPlayer?.color ?? ''"
                              :players="players"
                              :statsByColor="forecastStatsByColor" />
        <div class="con-stdp__browse" :class="{'con-stdp__browse--parked': stepUp}"
             :aria-hidden="stepUp ? 'true' : undefined"
             data-forecast-browse>
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
                       // AVAILABLE and changing nothing (the server's proven verdict): a live row a step quieter —
                       // never reordered, never refused (the player may still take it).
                       'con-stdp__card--futile': rowFutile(it),
                       // THE COMMIT PHRASE, on the row that was pressed:
                       // `--pressing` is the tactile answer (it plays on the
                       // press frame, before the server has said anything);
                       // `--committing` runs the gold sweep along the rail;
                       // `--committed` holds the fixed gold state.
                       'con-stdp__card--pressing': commitPhase === 'press' && it.key === commitCardKey,
                       'con-stdp__card--committing': commitPhase === 'committing' && it.key === commitCardKey,
                       'con-stdp__card--committed': commitPhase === 'committed' && it.key === commitCardKey,
                     }"
                     :ref="i === index ? 'focusedCard' : undefined"
                     :data-stdp-card="it.cardName"
                     :data-stdp-futile="rowFutile(it) ? it.preview?.futile?.kind : undefined"
                     :data-stdp-veto="rowVetoed(it) || undefined">
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
              <!-- A STANDING rule of this party under the description (fast mode's «раз за поколение» on the
                   patent sale) — printed while the row is live; a blocker speaks in the footer, not here. -->
              <div v-if="it.note !== undefined" class="con-stdp__note" data-stdp-note>{{ $t(it.note) }}</div>
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
                <!-- WHAT THE TABLE ANSWERS to the focused project's own bump — the composers' «⚡ сработает» group, and
                     the DOOR of the R3 «Эффекты» layer (PL-066). -->
                <ConsoleForecastDoor :reaction="focusedReaction" :canOpen="forecastCanOpen" :pulse="forecastPulse" @open="openForecastLayer()" />
                <span v-if="nextStepKey !== undefined" class="con-stdp__context-next">› {{ $t(nextStepKey) }}</span>
                <!-- The project's tile is REPLACED by the standing law (RX35): it is NOT placed — the struck chip alone
                     let a player expect a cell. The law and the data are the chip's hint and the next step's words. -->
                <span v-for="w in focusedTileWarnings" :key="'tile:' + w.title" class="con-stdp__context-warning" data-stdp-diverted-tile>⚠ {{ w.title }}</span>
                <!-- The project changes NOTHING right now — the server's verdict supersedes the per-chip warnings
                     (it says more, and the two never stand together). -->
                <span v-if="focusedFutile !== undefined" class="con-stdp__context-futile" data-stdp-context-futile>○ {{ $t(focusedFutile) }} · {{ $t('the action will change nothing') }}</span>
                <!-- The project moves the scale — and its RATING is refused (RX42 UNMI Veto): the struck chip above
                     names the law; the foot says it in words, in the law's own register. -->
                <span v-else-if="focusedVeto" class="con-stdp__context-veto" data-stdp-context-veto :data-veto-source="focusedRefusal">⊘ {{ $t(focusedRefusalNote) }}</span>
                <template v-else>
                  <span v-for="w in focusedWarnings" :key="w" class="con-stdp__context-warning">⚠ {{ $t(warningTextOf(w)) }}</span>
                </template>
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

<script setup vapor lang="ts">
/*
 * data-motion-*: rides the shared `.con-shade` dim + the surface-motion
 *       director (wheel-handoff-aware entry) — no own backdrop/CSS entry.
 *       `con-ws--dockcover`: a full workspace panel — the hand-dock PACK is
 *       COVERED where the panel reaches it (never hidden, never dimmed; it
 *       resurfaces for physical card arrivals) — see console.less.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

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
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {gsap} from 'gsap';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleForecastDoor from '@/client/components/console/ConsoleForecastDoor.vue';
import ConsoleForecastLayer from '@/client/components/console/ConsoleForecastLayer.vue';
import {ForecastSeat} from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {forecastLayerAvailable, reactionChipsOf, VariantReaction} from '@/client/console/effectForecastModel';
import {closeEffectForecastLayer, effectForecastOpen, forecastStageText} from '@/client/console/consoleEffectForecast';
import {
  foldForecastHost, forecastHostIntent, forecastOwnerColors as forecastOwnerColorsOf, forecastStatsByColor as forecastStatsByColorOf, openForecastHost, pulseForecastDoor,
} from '@/client/console/consoleForecastHost';
import {VersionedView} from '@/client/console/gameStateVersion';
import {$t, translateTextWithParams, translateText} from '@/client/directives/i18n';
import {StdProjectItem} from '@/client/console/consoleQuickModel';
import {
  StdProjectCommitPhase, stdProjectCommitState,
} from '@/client/console/consoleStdProjectCommit';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {DivertedTileWarning, divertedTileWarnings} from '@/client/components/actions/divertedTileWarning';
import {Warning} from '@/common/cards/Warning';
import {warningText} from '@/client/components/card/cardWarnings';
import {RatingRefusalSource, ratingRefusalNote, ratingRefusalOfEffects} from '@/client/console/ratingRefusal';
import {setWorkspaceFrameSlot, workspaceStackCrumb} from '@/client/console/consoleWorkspaceStack';
import {armOutcomeOriginFrom} from '@/client/console/consoleActionOutcomeMotion';

/** The zone this workspace publishes for its hosted step (embed rule 4). */
const STDP_EMBED_SLOT = '.con-stdp [data-embed-slot="stdp-step"]';

defineOptions({name: 'ConsoleStdProjectsScreen'});
const props = defineProps({
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
  /** The viewer (the layer's own tableau) and every seat (the explorer's names and colours) — PL-066. */
  thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
  players: {type: Array as PropType<ReadonlyArray<ForecastSeat>>, default: () => []},
  /** The viewer's versioned view — the reacting seats' effect stats are asked with it. */
  statsView: {type: Object as PropType<VersionedView | undefined>, default: undefined},
});

const forecastLayer = useTemplateRef<ExposedOf<typeof ConsoleForecastLayer>>('forecastLayer');
const focusedCard = useTemplateRef<HTMLElement | Array<HTMLElement>>('focusedCard');
const grid = useTemplateRef<{ensureVisible?: (el: Element | null | undefined) => void}>('grid');
const root = useTemplateRef<HTMLElement>('root');
/** The one-shot COMMIT flare on the «⚡ сработает» door (PL-066) and its clock (a plain handle). */
const forecastPulse = ref(false);
let pulseCall: {kill: () => void} | undefined;

const focused = computed((): StdProjectItem | undefined => {
  return props.items[props.index];
});
const focusedReason = computed((): string => {
  const f = focused.value;
  if (f === undefined || f.reason === '') {
    return '';
  }
  return f.reasonParams !== undefined ?
    translateTextWithParams(f.reason, [...f.reasonParams]) :
    translateText(f.reason);
});
const contextClass = computed((): string => {
  if (focused.value === undefined) {
    return '';
  }
  if (commitPhase.value === 'committed' && focused.value.key === commitCardKey.value) {
    return 'con-stdp__context--committed';
  }
  return focused.value.available ? 'con-stdp__context--ready' : 'con-stdp__context--blocked';
});
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
const focusedChips = computed((): ReadonlyArray<ActionEffect> => {
  return focused.value?.preview?.effects ?? [];
});
/** The tile the standing law takes from the focused project (RX35 — Greenery / Aquifer): NOT placed, in words. */
const focusedTileWarnings = computed((): Array<DivertedTileWarning> => {
  return divertedTileWarnings(focusedChips.value);
});
/** Chip identity for the crossfade — icon + note is what makes two chips
 *  the SAME statement across a focus change (the M€ chip stays put while
 *  the parameter beside it swaps). */
const chipKeyOf = computed((): (e: ActionEffect) => string => {
  return (e: ActionEffect) => `${e.direction}:${e.icon}:${e.note ?? ''}`;
});
const focusedWarnings = computed((): ReadonlyArray<Warning> => {
  return focused.value?.warnings ?? [];
});
/** The focused project would change nothing (the server's reason key) — undefined for one that does something. */
const focusedFutile = computed((): string | undefined => {
  const f = focused.value;
  return f !== undefined && rowFutile(f) ? f.preview?.futile?.reason : undefined;
});
/** The focused project's rating is refused (RX42) — the foot's note beside the struck chip. */
const focusedVeto = computed((): boolean => {
  const f = focused.value;
  return f !== undefined && rowVetoed(f);
});
/** WHO refuses the focused row's rating — the law (RX42) or a card's skip (P57 Preservation Program). */
const focusedRefusal = computed((): RatingRefusalSource => {
  return ratingRefusalOfEffects(focused.value?.preview?.effects ?? []) ?? 'law';
});
/** The foot's note in the refuser's own words («РТ под вето» · «Первый РТ пропускается»). */
const focusedRefusalNote = computed((): string => {
  return ratingRefusalNote(focusedRefusal.value);
});
/** The pay-on-commit follow-up, named BEFORE the descent (§7: only the
 *  guaranteed part is promised — target-dependent results arrive with the
 *  step's own preview surfaces). Existing i18n keys, nothing coined. */
const nextStepKey = computed((): string | undefined => {
  const target = focused.value?.preview?.target;
  // A REPLACED UNIT (RX35): the project's unit becomes data, and the preview pre-collects the card it lands on.
  if ((focused.value?.preview?.steps ?? []).some((s) => s.kind === 'input' && s.input.type === 'card')) {
    return 'Next: choose the card for the data.';
  }
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
  if (focused.value?.key === 'sell-patents') {
    return 'Next: choose the cards to sell.';
  }
  return undefined;
});
/**
 * THE COMMIT PHRASE's phase — the row's pose comes from this, never from
 * whichever render the server's answer happened to land in. `press` is
 * already true on the press frame (the tactile answer owes nothing to the
 * network); `committing` is the gold sweep; `committed` is the held gold.
 */
const commitPhase = computed((): StdProjectCommitPhase => {
  return stdProjectCommitState.phase;
});
/** Which row the phrase belongs to (the pressed one, not the focused one —
 *  they are the same today, and a stray focus move must not steal it). */
const commitCardKey = computed((): string => {
  return stdProjectCommitState.card;
});
// ── the shared crumb (workspaceStackCrumb → ConsoleWsHead) ──────────────
const crumbSubject = computed((): string => {
  return workspaceStackCrumb()?.subject?.text ?? '';
});
const crumbStage = computed((): string => {
  const stage = workspaceStackCrumb()?.stage ?? '';
  // The R3 «Эффекты» layer is a level INSIDE this workspace: the tail gains «ЭФФЕКТЫ» (+ the source card at its
  // detail) and gives it back on B / R3 — a composed, pre-translated string (PL-066).
  return forecastStageText('stdp', stage) ?? stage;
});
/** A hosted step may publish a composed, already-translated tail
 *  («ГАНИМЕД · ТОРГОВЛЯ») — mirror the stack's own convention; the
 *  layer's tail is composed too. */
const crumbStageRaw = computed((): boolean => {
  return fxOpen.value;
});
// ── THE EFFECT FORECAST (rides inside the focused project's preview) — the R3 «Эффекты» layer (PL-066) ──
const focusedForecast = computed((): EffectForecast | undefined => {
  return focused.value?.preview?.forecast;
});
const focusedReaction = computed((): VariantReaction => {
  return reactionChipsOf(focusedForecast.value?.facts ?? []);
});
const forecastAvailable = computed((): boolean => {
  return forecastLayerAvailable(focusedForecast.value);
});
/** R3 is the BROWSE level's verb — silent under a hosted step and through a commit's beats. */
const forecastCanOpen = computed((): boolean => {
  return forecastAvailable.value && !props.stepUp && commitPhase.value === 'idle';
});
const fxOpen = computed((): boolean => {
  return effectForecastOpen('stdp');
});
const forecastOwnerColors = computed((): ReadonlyArray<string> => {
  return forecastOwnerColorsOf(focusedForecast.value, props.players);
});
const forecastStatsByColor = computed((): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> => {
  return forecastStatsByColorOf(forecastOwnerColors.value);
});
const crumbCommitted = computed((): boolean => {
  return workspaceStackCrumb()?.committed === true;
});

/** R3 / a click on the «⚡ сработает» door — the WORKSPACE DESCEND into the layer (PL-066). The shell calls it on R3. */
function openForecastLayer(): void {
  if (!forecastCanOpen.value || fxOpen.value) {
    return;
  }
  pulseCall = pulseForecastDoor((on) => {
    forecastPulse.value = on;
  }, pulseCall);
  openForecastHost('stdp', root.value ?? undefined, forecastOwnerColors.value, props.statsView);
}
/** Input while the layer is open (the shell routes it here): B folds one level, R3 closes the whole layer. */
function forecastIntent(intent: GamepadIntent): void {
  forecastHostIntent('stdp', intent, forecastLayer.value ?? undefined);
}
function warningTextOf(w: Warning): string {
  return warningText(w);
}
function chipKey(e: ActionEffect): string {
  return chipKeyOf.value(e);
}
/** Is this the row the commit phrase is playing on? */
function rowFutile(it: StdProjectItem): boolean {
  return it.available && it.preview?.futile !== undefined;
}
/** The row's rating is REFUSED by a standing law (RX42 — a struck chip in its preview). */
function rowVetoed(it: StdProjectItem): boolean {
  return it.available && (it.preview?.effects ?? []).some((e) => e.vetoed !== undefined);
}
function isCommitRow(it: StdProjectItem): boolean {
  return commitPhase.value !== 'idle' && it.key === commitCardKey.value;
}
/** Arm the descend phrase from the FOCUSED row — called by the shell
 *  SYNCHRONOUSLY in the press handler (and again when a server round
 *  trip pushes the step later; a stale arm degrades gracefully). */
function armStepOrigin(): void {
  const slot = focusedCard.value ?? undefined;
  const el = Array.isArray(slot) ? slot[0] : slot;
  armOutcomeOriginFrom(el);
}

/** The layer lives ONLY on the browse level — a hosted step, a commit and a focus move off the answering project fold it instantly. */
watch(() => forecastCanOpen.value, (can: boolean): void => {
  if (!can) {
    foldForecastHost('stdp');
  }
});
/** Overflow is a fallback — keep the focus visible there. The cursor moved to another project: its answer is
 *  another forecast — the layer folds, the next R3 opens that one (PL-066). */
watch(() => props.index, () => {
  foldForecastHost('stdp');
  void nextTick(() => {
    const slot = focusedCard.value ?? undefined;
    const el = Array.isArray(slot) ? slot[0] : slot;
    // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
    grid.value?.ensureVisible?.(el);
  });
});
/**
 * The DESCEND phrase, one level deeper (never a v-if blink): the browse
 * layer RELEASES on the spot (the `--parked` CSS transition), the step
 * zone UNFOLDS from the rect the pressed row occupied (armed by the shell
 * synchronously at the press — a stale arm degrades to a plain surface),
 * and the teleported step REVEALS from inside the opened zone. The fold
 * back is the same phrase reversed: the zone's inline motion props are
 * cleared and the parked layer returns through its own transition.
 */
watch(() => props.stepUp, (up: boolean) => {
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined || rootNow === null || up) {
    return;
  }
  // Folding back: drop anything a previous episode may have left on the
  // zone. The ENTRY itself is CSS — see below.
  const zone = rootNow.querySelector<HTMLElement>('[data-outcome-zone]');
  if (zone !== null) {
    gsap.killTweensOf(zone);
    gsap.set(zone, {clearProps: 'all'});
  }
});

onMounted(() => {
  // Embed rule 4: the zone is published from `onMounted` (a change-watcher
  // cannot fire true→true across a restore) and retracted in `onBeforeUnmount` —
  // never from the flow side.
  setWorkspaceFrameSlot('standard-projects', STDP_EMBED_SLOT);
});
onBeforeUnmount(() => {
  closeEffectForecastLayer('stdp');
  pulseCall?.kill();
  pulseCall = undefined;
  setWorkspaceFrameSlot('standard-projects', '');
});
defineExpose({armStepOrigin, forecastIntent, openForecastLayer});
</script>
