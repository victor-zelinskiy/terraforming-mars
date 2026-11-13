<template>
  <div ref="root" class="con-played"
       :class="{'con-played--hero': heroActive, 'con-played--catview': categoryUp, 'con-played--embedded': embedded, 'con-ws': !embedded}"
       :data-motion-surface="embedded || heroActive ? undefined : 'played'"
       :data-played-density="measured ? stacks.density : undefined">
    <div v-if="!embedded" class="con-played__backdrop" aria-hidden="true"></div>
    <div class="con-played__panel" :data-motion-panel="embedded ? undefined : ''">
      <!-- THE WORKSPACE HEADER (standalone): the ONE crumb grammar — РАЗЫГРАНО › ‹участник› › ‹зона›. The seat is
           the SUBJECT (LB/RB recompose it), the open category is the STAGE (the only other animating segment). The
           EMBEDDED host's own header already reads ИНФОРМАЦИЯ › ‹участник› › РАЗЫГРАНО · ‹зона›. -->
      <ConsoleWsHead v-if="!embedded" class="con-played__head"
                     root="Played"
                     :subject="viewedDisplayName"
                     subjectRaw
                     :stage="crumbStage">
        <template #trailing>
          <span class="con-played__meta">
            <span class="con-status__dot" :class="'player_bg_color_' + viewedPlayer.color" aria-hidden="true"></span>
            <span class="con-played__total">
              <span class="con-played__total-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
              <b>{{ totalCount }}</b>
            </span>
          </span>
        </template>
      </ConsoleWsHead>

      <div class="con-played__body" ref="body">
        <!-- THE CONTENT RENDERS ONCE, against the MEASURED body (PL-625): the body is a flex box whose size never depends
             on what it holds, so the first render lays the chassis out, `onMounted` measures it (a forced layout, no
             paint yet), and the table renders its faces a single time with the real plan before the first paint. -->
        <div v-if="measured" class="con-played__table" :class="`con-played__table--${stacks.density}`" :style="tableStyle">
          <div v-for="st in stacks.stacks" :key="st.key"
               class="con-played__family con-played__stack"
               :class="stackClasses(st)"
               :data-played-cat="stackFocusKey(st)"
               :data-played-stack="st.key"
               :data-played-lanes="st.lanes.length"
               :style="{left: st.x + 'px', top: stacks.padTop + 'px', width: st.w + 'px'}"
               @click="onStackPress(st)">
            <!-- The caption lives inside the stack's width: the label ellipsizes in its OWN box, the count and the A badge
                 (the focused stack's «open» — the bar names the verb) never shrink. -->
            <span class="con-played__caption" :style="{maxWidth: captionRoom(st) + 'px'}">
              <span class="con-played__caption-label">{{ $t(stackLabel(st)) }}</span>
              <b v-if="stackShowsCount(st)" class="con-played__caption-count">{{ stackCount(st) }}</b>
              <GamepadGlyph v-if="stackFocusKey(st) !== undefined" control="confirm" class="con-played__caption-open" />
            </span>

            <!-- The BOT's corporations — its own entities (bot rules, original identity) on the corporation's stack,
                 laid exactly as a player's: in a campaign the portfolio (the primary, then each holding in acquisition
                 order) is a CASCADE whose newest lies in front. What a holding does differently is the RULES' to say
                 (the fullscreen inspect), never the table's. A/X opens the inspect (physical lift via data-zoom-slot). -->
            <div v-if="st.key === 'corporation' && botCorp !== undefined" class="con-played__lanes" :style="{columnGap: stacks.laneGap + 'px'}">
              <div v-for="(lane, li) in st.lanes" :key="li" class="con-played__lane"
                   :style="{width: stacks.slotW + 'px', height: (stacks.slotH + (lane.count - 1) * st.peek) + 'px'}">
                <div v-for="(corp, ci) in botCorps.slice(lane.start, lane.start + lane.count)" :key="corp.id"
                     class="con-played__slot con-played__botcorp"
                     :class="{'con-played__slot--front': ci === lane.count - 1}"
                     :style="{top: ci * st.peek + 'px', width: stacks.slotW + 'px', height: stacks.slotH + 'px', zIndex: String(ci + 1)}"
                     :data-zoom-slot="corp.id" :data-bot-corp="corp.id">
                  <div class="con-played__lift">
                    <div class="con-played__face con-played__focusbox" :style="{zoom: String(stacks.zoom)}">
                      <MarsBotCorpFace :id="corp.id" :resources="corp.resources" :resource="corp.resource" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Events — face down, one pile, per the printed rules. During the hero scene the pile shows the
                 PRE-play count (the counter ticks only after the landed card is committed), and a first-ever event
                 reserves a HIDDEN pile so the arc has a real target. -->
            <ConsolePlayedEventsPile v-else-if="st.key === 'events' && st.count > 0"
                                     :count="displayedEventsCount"
                                     :reserved="eventsPileReserved"
                                     :focused="false"
                                     :out="eventsOut"
                                     :slotW="stacks.slotW" :cardH="stacks.slotH" />
            <!-- A PREPARED PLACE (PL-620) — the corporation before the choice, the events before the first: a dashed
                 outline that names what is missing, never a card-sized plate. Its box stays: the first card lands here. -->
            <div v-else-if="st.count === 0"
                 class="con-played__seat-place"
                 :class="{'con-played__seat-place--events': st.key === 'events'}"
                 :style="{width: stacks.slotW + 'px', height: stacks.slotH + 'px'}">
              <span v-if="st.key === 'events'" class="con-played__seat-note" v-i18n>No events played yet</span>
            </div>
            <!-- A CASCADE — the zone's cards in their lanes. -->
            <ConsolePlayedStack v-else
                                :cards="stackCards(st.key)" :lanes="st.lanes"
                                :hiddenKey="heroHiddenKey" :outNames="outNames" :grounded="groundedNames"
                                :zoom="stacks.zoom" :slotW="stacks.slotW" :slotH="stacks.slotH" :peek="st.peek" :laneGap="stacks.laneGap"
                                :live="st.key === 'corporation'" />
          </div>
          <!-- Nothing played yet / an identity-only table: one calm line where the project stacks will lie — never a
               bare half (the stacks of the identity stand beside it). -->
          <div v-if="emptyTable || projectsEmpty" class="con-played__none" :style="noneStyle">
            <span class="con-played__none-shelf" aria-hidden="true"></span>
            <span v-if="emptyTable" class="con-played__void"><span class="con-played__void-glyph" aria-hidden="true">◈</span><span v-i18n>No cards played yet</span></span>
            <span v-else v-i18n>No played projects yet</span>
          </div>
        </div>
      </div>
    </div>

    <!-- The CATEGORY VIEW — mounted for the whole physical episode (the
         cards lift off the table above, fly into it, and fly back on close).
         It owns the flights; the table only holds the airborne cards' slots. -->
    <ConsolePlayedCategoryView v-if="categoryUp"
                               ref="catView"
                               :cards="categoryViewCards"
                               :provenanceByName="provenanceByName"
                               :faceFloorZoom="stacks.zoom"
                               :boxInset="catInset"
                               @settled-closed="onCategorySettled" />
  </div>
</template>

<script setup vapor lang="ts">
/*
 * CONSOLE «РАЗЫГРАНО» — the console-native played-cards TABLE (X from the
 * board home). ONE PAGE OF TABLE STACKS (the owner, 2026-10-19; TR65's
 * chassis stays — the table stands in the central opening like every
 * workspace screen): every zone lies as the printed game lays it — the
 * corporation, the preludes, the CEO, the active and the automated cards as
 * CASCADES (each covered card shows its title band, the newest lies whole
 * in front, a long zone continues in a second lane), the events as ONE
 * face-down pile with its count. The whole table is ONE screen; how compact
 * it is (the face, the band, the lanes) is solved from the measured body
 * and the counts (`planPlayedStacks`). Nothing here is paged.
 *
 * NAVIGATION IS BY STACK (the per-card cursor is gone by design): the d-pad
 * moves between the stacks, A opens the focused zone — its cards physically
 * LIFT off the stack and fly into the category view (ConsolePlayedCategoryView
 * owns that whole transition; face-down events flip open mid-flight), which
 * is where a zone is READ and where pages are allowed (LB/RB turn them
 * there). Closing flies them back onto the stack. LB/RB at the table walk
 * the seats.
 *
 * View-only: nothing here ever submits. Input is delegated by the shell
 * (handleIntent); command-bar hints are mirrored through consolePlayedUi.
 *
 * `con-ws` + `data-motion-surface` (standalone host only): the workspace
 *       family's marker and the surface-motion entrance — the player rail stays
 *       lit left of the table, the strategy rail yields its zone (the shell's
 *       policy), the frame materializes in place. The EMBEDDED re-seat lives
 *       inside the Information Workspace, which owns its own chassis. The HERO
 *       scene mounts without the entrance (its landing is measured on the first
 *       frames — a materialize would move the target under the flight).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {MarsBotCorpModel, MarsBotCorpResource} from '@/common/automa/MarsBotCorpData';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {botTableauCards} from '@/client/components/marsbot/marsBotView';
import {marsBotCorpZoomEntry} from '@/client/components/card/cardZoomTypes';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {
  buildPlayedZones, planPlayedStacks, stepTableFocus,
  PlayedStackKey, PlayedStackPlan, PlayedStacksPlan, PlayedZones,
} from '@/client/components/console/consolePlayedModel';
import {
  playedCategories, categoryCards, PlayedCategory, PlayedCategoryKey, PLAYED_CATEGORY_LABEL, PLAYED_CATEGORY_LABEL_SHORT,
} from '@/client/components/console/consolePlayedCategoryModel';
import {
  playedCategoryState, resetPlayedCategoryView, isCategoryViewUp, isCategoryViewBusy,
  categoryOutNames, categoryAwayNames, categoryGroundedNames,
} from '@/client/console/played/playedCategoryView';
import {resetCategoryDirector} from '@/client/console/played/playedCategoryDirector';
import {providePlayedHeroTarget} from '@/client/console/played/consolePlayedHero';
import {restingRectOf} from '@/client/console/cardFlight/landingRect';
import {HeroRect} from '@/client/console/played/playedHeroModel';
import {openConsoleCardZoom, slotZoomOrigin, ConsoleZoomProvenance} from '@/client/console/consoleCardZoom';
import {playedProvenanceByName} from '@/client/components/console/played/playedProvenance';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsolePlayedStack from '@/client/components/console/played/ConsolePlayedStack.vue';
import ConsolePlayedEventsPile from '@/client/components/console/played/ConsolePlayedEventsPile.vue';
import ConsolePlayedCategoryView from '@/client/components/console/played/ConsolePlayedCategoryView.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {whenPainted} from '@/client/console/session/sessionWaits';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

/** The table's focusable keys: the card categories + the bot's corporation slot. */
type TableFocusKey = PlayedCategoryKey | 'botcorp' | '';

/** Fallback body box before the first measure / under JSDOM (1080-logical; the planner scales from it). */
const FALLBACK_W = 1400;
const FALLBACK_H = 620;

defineOptions({name: 'ConsolePlayedOverlay'});
const props = defineProps({
  players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  thisPlayerColor: {type: String as PropType<Color>, required: true},
  /**
   * PLAY-ANIMATION mode (the hero scene): the just-played card. The table
   * renders the +1 layout IMMEDIATELY (appended to the viewer's tableau if
   * the commit hasn't landed yet — the synthetic and the committed layout
   * are IDENTICAL), with the card's slot reserved hidden until
   * `heroRevealed` — the front of its stack's last lane.
   */
  heroIncoming: {type: Object as PropType<CardModel | undefined>, default: undefined},
  /** Landing committed — the reserved slot turns real (under the proxy). */
  heroRevealed: {type: Boolean, default: false},
  /** The transaction owns the moment (input inert, frame gated). */
  heroActive: {type: Boolean, default: false},
  /**
   * The public Automa state — lets the table show the BOT seat's cards
   * (its played pile; the bot has no real tableau on its player model).
   * Passed by both hosts; the overlay resolves per viewed seat.
   */
  automa: {type: Object as PropType<MarsBotModel>, default: undefined},
  /**
   * EMBEDDED mode — the table is the Information Workspace's «Разыграно»
   * detail: static inside the workspace frame (no own chassis), the
   * viewed seat is CONTROLLED by `forcedColor` (the workspace's inspected
   * player — LB/RB switches it globally, never here), B is routed by the
   * shell (category-local back only).
   */
  embedded: {type: Boolean, default: false},
  /** The controlled viewed seat (embedded mode only). */
  forcedColor: {type: String as PropType<Color>, default: undefined},
});
const emit = defineEmits({
  'close': () => true,
});

const flow = useFlowScope('played-overlay');
const body = useTemplateRef<HTMLElement>('body');
const catView = useTemplateRef<{handleIntent?: (i: GamepadIntent) => void}>('catView');
const root = useTemplateRef<HTMLElement>('root');
/** The stacks whose caption takes the SHORT label (the full one overflowed its measured room — P5). */
const shortCaptions = ref<Array<string>>([]);
/** The measured table body (offset box — transform-independent, so a materializing panel never mis-sizes it). */
const box = ref({w: 0, h: 0});
/** The CATEGORY VIEW stands over the table's BODY, never over its head (PL-626): the crumb reads the open zone
 *  («РАЗЫГРАНО › PLAYER1 › АКТИВНЫЕ») and the ДОП. РЕСУРСЫ lane stays clear. Insets from the root, px. */
const catInset = ref<Record<string, string> | undefined>(undefined);
let ro: ResizeObserver | undefined;
/** WHOSE tableau is on the table (LB/RB cycles; defaults to the viewer). */
const viewColor = ref(props.thisPlayerColor as Color);
/** The focused CATEGORY (the only focusable objects of the table). */
const focusCategory = ref<TableFocusKey>('');
/** Hero-scene target-measurer deregistration (play-animation mode). */
let unregisterHeroTarget: (() => void) | undefined;
const catState = playedCategoryState;

/** The seat on the table: controlled by the workspace when embedded. */
const effectiveViewColor = computed((): Color => {
  return props.embedded && props.forcedColor !== undefined ? props.forcedColor : viewColor.value;
});
const viewedPlayer = computed((): PublicPlayerModel => {
  return props.players.find((p) => p.color === effectiveViewColor.value) ??
    props.players.find((p) => p.color === props.thisPlayerColor) ??
    props.players[0];
});
const viewedIsBot = computed((): boolean => {
  return viewedPlayer.value?.isMarsBot === true;
});
/** The bot's corporation (its own entity — bot rules, original identity). */
const botCorp = computed((): MarsBotCorpModel | undefined => {
  return viewedIsBot.value ? props.automa?.corporation : undefined;
});
/**
 * Every corporation the bot holds, in acquisition order — the primary, then the campaign portfolio's HOLDINGS.
 * The table lays them as a player's corporations (the newest in front); only the primary carries a resource.
 */
const botCorps = computed((): ReadonlyArray<{id: MarsBotCorpId, resources: number, resource?: MarsBotCorpResource}> => {
  const corp = botCorp.value;
  if (corp === undefined) {
    return [];
  }
  return [
    {id: corp.id, resources: corp.resources, resource: corp.resource},
    ...(props.automa?.holdings ?? []).map((h) => ({id: h.id, resources: 0})),
  ];
});
/** The localized seat label — never a raw `MarsBot` for the bot seat. */
const viewedDisplayName = computed((): string => {
  return participantDisplayName(viewedPlayer.value);
});
/**
 * The cards on the table: a human's real tableau; the BOT seat reads its
 * public played pile (everything it flipped — same premium table, same
 * zone grouping; provenance is named by the head note).
 */
const viewedTableau = computed((): ReadonlyArray<CardModel> => {
  if (viewedIsBot.value && props.automa !== undefined) {
    return botTableauCards(props.automa);
  }
  return viewedPlayer.value?.tableau ?? [];
});
const zones = computed((): PlayedZones => {
  const tableau = viewedTableau.value;
  const incoming = props.heroIncoming;
  // Synthetic +1: BEFORE the commit the incoming card is appended so the
  // layout is already final (spec: the table never re-arranges around
  // the landing). After the commit the tableau carries it for real —
  // the guard prevents a duplicate, keys/positions stay identical.
  if (incoming !== undefined &&
      viewedPlayer.value?.color === props.thisPlayerColor &&
      !tableau.some((c) => c.name === incoming.name)) {
    return buildPlayedZones([...tableau, incoming]);
  }
  return buildPlayedZones(tableau);
});
/** The focusable categories of the shown tableau, in table order. */
const categories = computed((): ReadonlyArray<PlayedCategory> => {
  return playedCategories(zones.value);
});
/** The category view episode is mounted (opening / open / closing). */
const categoryUp = computed((): boolean => {
  return isCategoryViewUp();
});
/** The open category's cards (LIVE — an undo/refresh flows through). */
const categoryViewCards = computed((): ReadonlyArray<CardModel> => {
  const key = catState.category;
  return key !== undefined ? categoryCards(zones.value, key) : [];
});
/** The crumb's STAGE: the open category (an i18n key) — the only segment that ever changes past the seat. */
const crumbStage = computed((): string => {
  const key = catState.category;
  return categoryUp.value && key !== undefined ? PLAYED_CATEGORY_LABEL[key] : '';
});
/** Names lifted OUT of the table (airborne / in the view) — their slots
 *  render held geometry so a card never exists in two places at once. */
const outNames = computed((): ReadonlySet<string> => {
  return categoryOutNames();
});
/** Names dissolving IN PLACE for a bounded category episode (the cards
 *  beyond the flight budget — opacity, not a visibility hold). */
const groundedNames = computed((): ReadonlySet<string> => {
  return categoryGroundedNames();
});
/** Names LOGICALLY AWAY in the category view (flown AND grounded) — what
 *  the events-pile count and its full-ghost read. */
const awayNames = computed((): ReadonlySet<string> => {
  return categoryAwayNames();
});
/** How many EVENTS are currently away (lifted into the view). */
const heldEventsCount = computed((): number => {
  if (awayNames.value.size === 0) {
    return 0;
  }
  return zones.value.events.reduce((n, c) => n + (awayNames.value.has(c.name) ? 1 : 0), 0);
});
const eventsOut = computed((): boolean => {
  // Full ghost only when EVERY event is away; mirrors the held semantics
  // of `outNames` (never a frame before proxies exist).
  const total = zones.value.events.length;
  return total > 0 && heldEventsCount.value >= total;
});
/** The hero card is an EVENT (classified structurally via the zones). */
const heroIncomingIsEvent = computed((): boolean => {
  const incoming = props.heroIncoming;
  return incoming !== undefined && zones.value.events.some((c) => c.name === incoming.name);
});
/** The reserved face-up slot stays hidden until the landing commit. */
const heroHiddenKey = computed((): string | undefined => {
  const incoming = props.heroIncoming;
  if (incoming === undefined || props.heroRevealed || heroIncomingIsEvent.value) {
    return undefined;
  }
  return incoming.name;
});
/** The events counter ticks only AFTER the landed card is revealed, and
 *  drops by the events currently AWAY in the view (physical truth). */
const displayedEventsCount = computed((): number => {
  const n = zones.value.events.length - heldEventsCount.value;
  return props.heroIncoming !== undefined && heroIncomingIsEvent.value && !props.heroRevealed ?
    Math.max(0, n - 1) : Math.max(0, n);
});
/** First-ever event mid-scene: the pile exists as HIDDEN geometry. */
const eventsPileReserved = computed((): boolean => {
  return displayedEventsCount.value === 0 && zones.value.events.length > 0;
});
const totalCount = computed((): number => {
  const z = zones.value;
  const n = z.corporations.length + z.preludes.length + z.ceos.length +
    z.active.length + z.automated.length + z.events.length;
  // The header count stays honest mid-scene: the landing card joins the
  // total only once it is revealed on the table.
  return props.heroIncoming !== undefined && !props.heroRevealed ? Math.max(0, n - 1) : n;
});
/**
 * The BY-NAME provenance lookup of THIS table — the plate every
 * fullscreen opened from here carries («лежит на столе <место>, зона
 * <зона>, N из M»). Live: it re-derives with the tableau, so an undo or
 * a fresh play can never leave a stale plate behind.
 */
const provenanceByName = computed((): (name: string | undefined) => ConsoleZoomProvenance | undefined => {
  return playedProvenanceByName(viewedPlayer.value, viewedTableau.value);
});
/** The body has been measured — the content renders against the real box only (PL-625). */
const measured = computed((): boolean => {
  return box.value.w > 4 && box.value.h > 4;
});
/** Nothing on the table at all (the bot's corporation slot counts as content). */
const emptyTable = computed((): boolean => {
  return categories.value.length === 0 && botCorp.value === undefined;
});
/** No project card lies on the table (an identity-only table). */
const projectsEmpty = computed((): boolean => {
  const z = zones.value;
  return z.preludes.length + z.ceos.length + z.active.length + z.automated.length === 0;
});
const stackCounts = computed((): Record<PlayedStackKey, number> => {
  const z = zones.value;
  return {
    corporation: botCorp.value !== undefined ? botCorps.value.length : z.corporations.length,
    prelude: z.preludes.length,
    ceo: z.ceos.length,
    active: z.active.length,
    automated: z.automated.length,
    events: z.events.length,
  };
});
/** THE PLAN — the measured body box and the stacks' counts: ONE page, the compactness solved. */
const stacks = computed((): PlayedStacksPlan => {
  const s = conUiScale();
  const measured = box.value.w > 4 && box.value.h > 4;
  return planPlayedStacks({
    availW: measured ? box.value.w : FALLBACK_W * s,
    availH: measured ? box.value.h : FALLBACK_H * s,
    counts: stackCounts.value,
    uiScale: s,
  });
});
/** The plan's px as CSS variables — the stylesheet lays the chassis out, the planner says how wide. */
const tableStyle = computed((): Record<string, string> => {
  return {
    '--con-played-caption-h': stacks.value.captionH + 'px',
  };
});
/** The «no projects yet» line takes the room right of the identity stacks (they stand at the left edge then). */
const noneStyle = computed((): Record<string, string> => {
  const last = stacks.value.stacks[stacks.value.stacks.length - 1];
  const left = last === undefined ? 0 : last.x + last.w + stacks.value.gap;
  return {
    left: left + 'px',
    top: stacks.value.padTop + 'px',
    width: Math.max(0, box.value.w - left - stacks.value.gap) + 'px',
    height: (stacks.value.captionH + stacks.value.slotH) + 'px',
  };
});

/** The body box — OFFSET dimensions (a materializing panel's transform never shrinks the plan). */
function measure(): void {
  const bodyNow = body.value ?? undefined;
  if (bodyNow === undefined) {
    return;
  }
  const w = bodyNow.offsetWidth;
  const h = bodyNow.offsetHeight;
  if (categoryUp.value) {
    measureCatInset();
  }
  if (w !== box.value.w || h !== box.value.h) {
    box.value = {w, h};
  }
}
/** The body's box inside the root (rests: no transform runs while a category opens) — the category view's room. */
function measureCatInset(): void {
  const rootNow = root.value ?? undefined;
  const bodyNow = body.value ?? undefined;
  if (rootNow === undefined || bodyNow === undefined || typeof rootNow.getBoundingClientRect !== 'function') {
    return;
  }
  const r = rootNow.getBoundingClientRect();
  const b = bodyNow.getBoundingClientRect();
  if (b.width <= 4 || b.height <= 4) {
    catInset.value = undefined;
    return;
  }
  const px = (v: number) => `${Math.max(0, Math.round(v))}px`;
  catInset.value = {top: px(b.top - r.top), left: px(b.left - r.left), right: px(r.right - b.right), bottom: px(r.bottom - b.bottom)};
}
// ── the stacks ──────────────────────────────────────────────────────
function stackLabel(st: PlayedStackPlan): string {
  return shortCaptions.value.includes(st.key) ? PLAYED_CATEGORY_LABEL_SHORT[st.key] : PLAYED_CATEGORY_LABEL[st.key];
}
/**
 * A caption whose FULL label overflows its own box (`captionRoom`) takes the short one — an ellipsis in the middle
 * of a word («АВТОМАТИЧЕСК…») is a cut, never a label (P5). Measured off the rendered label, so the font, the
 * profile and the locale decide, never a character count.
 */
function fitCaptions(): void {
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined || typeof rootNow.querySelectorAll !== 'function') {
    return;
  }
  const next = [...shortCaptions.value];
  rootNow.querySelectorAll<HTMLElement>('[data-played-stack]').forEach((el) => {
    const key = el.dataset.playedStack;
    const label = el.querySelector<HTMLElement>('.con-played__caption-label');
    if (key === undefined || label === null || next.includes(key)) {
      return;
    }
    if (label.scrollWidth > label.clientWidth + 0.5) {
      next.push(key);
    }
  });
  if (next.length !== shortCaptions.value.length) {
    shortCaptions.value = next;
  }
}
function stackCards(key: PlayedStackKey): ReadonlyArray<CardModel> {
  return categoryCards(zones.value, key);
}
/** A caption may run on into the gap before the next stack (a one-lane stack is narrower than «АВТОМАТИЧЕСКИЕ 3» at
 *  4K) — never under the next stack's own caption; past that the label ellipsizes in its own box. */
function captionRoom(st: PlayedStackPlan): number {
  const list = stacks.value.stacks;
  const next = list[list.indexOf(st) + 1];
  const edge = next === undefined ? box.value.w : next.x;
  return Math.max(st.w, edge - st.x - 8 * conUiScale());
}
/** The stack's focus target: its category (the bot's corporation slot is its own); an empty place is no target. */
function stackFocusKey(st: PlayedStackPlan): TableFocusKey | undefined {
  if (st.key === 'corporation' && botCorp.value !== undefined) {
    return 'botcorp';
  }
  return st.count > 0 ? st.key : undefined;
}
/** A stack's caption count: a cascade's honest total; a single corporation and an empty place carry none. */
function stackShowsCount(st: PlayedStackPlan): boolean {
  if (st.count === 0) {
    return false;
  }
  return st.key !== 'corporation' || st.count > 1;
}
function stackCount(st: PlayedStackPlan): number {
  if (st.key === 'corporation' && botCorp.value !== undefined) {
    return botCorps.value.length;
  }
  return familyCount(categoryCards(zones.value, st.key));
}
function stackClasses(st: PlayedStackPlan): Record<string, boolean> {
  const focus = stackFocusKey(st);
  return {
    [st.key === 'events' ? 'con-played__family--event' : `con-played__family--${st.key}`]: true,
    'con-played__family--empty': st.count === 0,
    'con-played__family--focused': focus !== undefined && focusCategory.value === focus && !props.heroActive,
    'con-played__family--out': focus !== undefined && categoryUp.value && catState.category === focus,
  };
}
/** Mouse: a stack is focused by one click and opened by the next (the pad's two-step feel). */
function onStackPress(st: PlayedStackPlan): void {
  const focus = stackFocusKey(st);
  if (focus === 'botcorp') {
    onBotCorpPress();
  } else if (focus !== undefined && focus !== '') {
    onFamilyPress(focus);
  }
}
/**
 * The HONEST caption count of a family: the synthetic incoming card joins
 * it only when it has physically become the stack's card (the reveal
 * commit) — until then the caption reads the pre-play truth, exactly like
 * the header total and the events pile already did.
 */
function familyCount(cards: ReadonlyArray<CardModel>): number {
  const incoming = props.heroIncoming;
  if (incoming === undefined || props.heroRevealed) {
    return cards.length;
  }
  return cards.some((c) => c.name === incoming.name) ? Math.max(0, cards.length - 1) : cards.length;
}
/** The zone a tableau card belongs to (the hero landing's focus seed). */
function familyOf(name: string): PlayedCategoryKey | '' {
  const z = zones.value;
  if (z.events.some((c) => c.name === name)) {
    return 'events';
  }
  if (z.corporations.some((c) => c.name === name)) {
    return 'corporation';
  }
  if (z.preludes.some((c) => c.name === name)) {
    return 'prelude';
  }
  if (z.ceos.some((c) => c.name === name)) {
    return 'ceo';
  }
  if (z.active.some((c) => c.name === name)) {
    return 'active';
  }
  if (z.automated.some((c) => c.name === name)) {
    return 'automated';
  }
  // A landing card never belongs to the bot's corporation slot — fall
  // back to a CARD category (or none) for the hero focus seed.
  return focusCategory.value === 'botcorp' ? '' : focusCategory.value;
}
/** Right stick (the shell's own route): inside the category view it turns the album's pages; the table itself is
 *  one page — nothing to scroll there. */
function stickScroll(dy: number, dx = 0): void {
  if (categoryUp.value) {
    catView.value?.handleIntent?.({kind: 'scroll', dx, dy});
  }
}
// ── the pad grammar (delegated by the shell) ────────────────────────
function handleIntent(intent: GamepadIntent): void {
  // The category view owns the pad for its whole episode (incl. the
  // flights — B there reverses/snaps; the table is scenery beneath).
  if (categoryUp.value) {
    catView.value?.handleIntent?.(intent);
    return;
  }
  if (intent.kind === 'scroll') {
    return; // one page — the stick has nothing to turn at the table
  }
  if (intent.kind === 'nav') {
    moveFocus(intent.dir);
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary':
  case 'inspect':
    // A VIEW surface: A (and X) opens the focused category.
    if (focusCategory.value === 'botcorp') {
      openBotCorpZoom();
      break;
    }
    openCategory(focusCategory.value);
    break;
  case 'prevSection':
    cycleViewedPlayer(-1);
    break;
  case 'nextSection':
    cycleViewedPlayer(1);
    break;
  case 'back':
    emit('close');
    break;
  default:
    break;
  }
}
// ── category focus (the table is ONE row, walked in layout order) ──
/**
 * THE TABLE IS ONE ROW (law 1): ◀ / ▶ walk the focusable stacks in their LAYOUT order — never the
 * nearest centre, which skipped a tall stack («Прологи», spread) for a short one further on; ▲ / ▼
 * have nowhere to go on one row. An edge keeps the cursor (no wrap). `stepTableFocus` is pure.
 */
function moveFocus(dir: NavDirection): void {
  if (dir !== 'left' && dir !== 'right') {
    return;
  }
  const keys = stacks.value.stacks
    .map((st) => stackFocusKey(st))
    .filter((k): k is TableFocusKey => k !== undefined);
  const next = stepTableFocus(keys, focusCategory.value, dir === 'left' ? -1 : 1);
  if (next !== undefined) {
    focusCategory.value = next as TableFocusKey;
  }
}
// ── opening a category (the physical lift is the view's job) ────────
/** Mouse support: clicking anywhere on a zone focuses it; a click on the
 *  already-focused zone opens it (mirrors the pad's two-step feel). */
function onFamilyPress(key: PlayedCategoryKey): void {
  if (props.heroActive || categoryUp.value) {
    return;
  }
  if (focusCategory.value === key) {
    openCategory(key);
  } else {
    focusCategory.value = key;
  }
}
/** Mouse: the bot-corporation slot mirrors the two-step family feel. */
function onBotCorpPress(): void {
  if (props.heroActive || categoryUp.value) {
    return;
  }
  if (focusCategory.value === 'botcorp') {
    openBotCorpZoom();
  } else {
    focusCategory.value = 'botcorp';
  }
}
/** Fullscreen inspect of the bot's corporation — the physical lift out of
 *  its table slot, same as the smart open of a one-card zone. */
function openBotCorpZoom(): void {
  const corp = botCorp.value;
  if (corp === undefined || props.heroActive || categoryUp.value) {
    return;
  }
  // The whole portfolio, in table order; the inspect opens on the FRONT card (the newest), as a player's would.
  const list = botCorps.value.map((c) => marsBotCorpZoomEntry(c.id, c.resources, c.resource));
  openConsoleCardZoom(list, list.length - 1, undefined, undefined, {
    origin: slotZoomOrigin(() => root.value, (i) => list[i]?.name ?? ''),
  });
}
function openCategory(key: TableFocusKey): void {
  if (key === 'botcorp') {
    openBotCorpZoom();
    return;
  }
  if (key === '' || props.heroActive || categoryUp.value) {
    return;
  }
  const cards = categoryCards(zones.value, key);
  if (cards.length === 0) {
    return;
  }
  // ONE CARD IS THE SAME SCENE (law 4 — the physics is one whatever the layout): the category's
  // own `single` stage, reached by the same flight. The old «smart open» went straight to the
  // fullscreen viewer, and an EVENT — face down in a pile with no slot of its own — rose out of
  // the depth with no lift and no flip, the pile's count never fell (the owner, 2026-11-01).
  focusCategory.value = key;
  playedCategoryState.category = key;
  playedCategoryState.names = cards.map((c) => c.name);
  playedCategoryState.focusIndex = 0;
  playedCategoryState.flights = [];
  // NOT held yet — the table cards stay visible until the director has
  // painted their proxies (the view flips the hold in that same turn).
  playedCategoryState.holdCards = false;
  playedCategoryState.frameOn = false;
  playedCategoryState.phase = 'opening';
  // The view mounts off `phase` and runs the whole open flight itself.
}
function onCategorySettled(): void {
  // The episode settled CLOSED — focus stays on the category it came
  // from (the table is exactly as the player left it).
}
// ── the hero scene: the reserved-slot measurer ──────────────────────
function heroTargetEl(): HTMLElement | null {
  const incoming = props.heroIncoming;
  const rootNow = root.value ?? undefined;
  if (incoming === undefined || rootNow === undefined || typeof rootNow.querySelector !== 'function') {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(incoming.name) : incoming.name.replace(/"/g, '\\"');
  return heroIncomingIsEvent.value ?
    rootNow.querySelector<HTMLElement>('.con-played__family--event .con-played__backstack') :
    rootNow.querySelector<HTMLElement>(`[data-played-key="${esc}"] .con-played__face`);
}
/**
 * Measure the reserved landing geometry for the incoming card: the
 * hidden face-up slot's card box (the FRONT of its stack's last lane), or
 * the events backstack. Waits for the rect to hold still across frames —
 * the arc always flies into REAL, settled geometry, never an estimate.
 */
async function measureHeroTarget(): Promise<HeroRect | undefined> {
  const incoming = props.heroIncoming;
  if (incoming === undefined) {
    return undefined;
  }
  await nextTick();
  const el = heroTargetEl();
  if (el === null) {
    return undefined;
  }
  // Stability loop: two consecutive frames with the same rect (≤ 30).
  let last: {x: number, y: number, w: number, h: number} | undefined = undefined;
  for (let i = 0; i < 30; i++) {
    await heroFrame();
    const r = el.getBoundingClientRect();
    if (r.width > 4 && last !== undefined &&
        Math.abs(r.left - last.x) < 0.5 && Math.abs(r.top - last.y) < 0.5 &&
        Math.abs(r.width - last.w) < 0.5 && Math.abs(r.height - last.h) < 0.5) {
      return last;
    }
    last = r.width > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
  }
  return last;
}
/** The reserved slot's REST rect, synchronously (the flight's final
 *  approach / the pre-reveal control measure). */
function peekHeroTarget(): HeroRect | undefined {
  const el = heroTargetEl();
  if (el === null) {
    return undefined;
  }
  const r = restingRectOf(el);
  return r.width > 4 && r.height > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}
/** One tick of the stability loop: the next painted frame, or shortly (a quiet compositor), or the table left. */
function heroFrame(): Promise<void> {
  return whenPainted(1, 50, flow);
}
// ── viewed player (LB/RB) ───────────────────────────────────────────
function cycleViewedPlayer(step: 1 | -1): void {
  // Embedded: the workspace owns the seat (LB/RB switch the inspected
  // player globally, before the intent ever reaches this table).
  if (props.embedded || props.players.length < 2) {
    return;
  }
  const idx = Math.max(0, props.players.findIndex((p) => p.color === viewColor.value));
  const next = props.players[(idx + step + props.players.length) % props.players.length];
  if (next !== undefined && next.color !== viewColor.value) {
    // A different tableau: any open category belongs to the old one.
    resetCategoryDirector();
    resetPlayedCategoryView();
    viewColor.value = next.color;
    focusCategory.value = ''; // the categories watcher reseeds
  }
}

/** A new plan (a play, a seat switch, a resize) re-judges every caption from its full label. */
watch(() => stacks.value, (): void => {
  shortCaptions.value = [];
  void nextTick(() => fitCaptions());
}, {flush: 'post'});
/** Data updated (play / undo / reconnect / seat switch): keep the focused
 *  category while it still exists, else land on the first one. */
watch(() => categories.value, (categories: ReadonlyArray<PlayedCategory>) => {
  const focusStillExists = focusCategory.value === 'botcorp' ?
    botCorp.value !== undefined :
    categories.some((c) => c.key === focusCategory.value);
  if (!focusStillExists) {
    // The bot's corporation slot is the table's first focusable object.
    focusCategory.value = botCorp.value !== undefined ? 'botcorp' : (categories[0]?.key ?? '');
  }
  // The open category emptied out entirely (an undo) — nothing left to
  // show; the view folds instantly (no cards to fly home).
  if (categoryUp.value && categoryViewCards.value.length === 0) {
    resetCategoryDirector();
    resetPlayedCategoryView();
  }
}, {immediate: true});
watch(() => focusCategory.value, (key: TableFocusKey) => {
  // The mirror carries card categories only — the corp slot reads as
  // «nothing to open as a grid» for the command bar.
  consolePlayedUi.focusCategory = key === 'botcorp' ? '' : key;
}, {immediate: true});
/** EMBEDDED seat switch (the workspace's LB/RB changed the inspected
 *  player): any open category belongs to the previous seat — fold it
 *  instantly, exactly like the internal cycle does. */
watch(() => props.forcedColor, (next: Color | undefined, prev: Color | undefined) => {
  if (props.embedded && next !== prev) {
    resetCategoryDirector();
    resetPlayedCategoryView();
    focusCategory.value = ''; // the categories watcher reseeds
  }
});
// Command-bar mirrors (the bar never pokes refs).
watch(() => catState.phase, () => {
  consolePlayedUi.categoryOpen = catState.phase === 'open';
  consolePlayedUi.categoryBusy = isCategoryViewBusy();
  const key = catState.category;
  consolePlayedUi.categoryLabel = key !== undefined ? PLAYED_CATEGORY_LABEL[key] : '';
}, {immediate: true});
watch(() => props.players.length, (n: number) => {
  consolePlayedUi.canCyclePlayer = n > 1;
}, {immediate: true});
// ── the hero scene (play-animation mode) ───────────────────────────
/** The scene always lands on the VIEWER's own tableau — a manually
 *  open table viewing an opponent snaps to the viewer's seat, and any
 *  open category view folds instantly (the table must be the scene). */
watch(() => props.heroActive, (active: boolean) => {
  if (active) {
    resetCategoryDirector();
    resetPlayedCategoryView();
    viewColor.value = props.thisPlayerColor;
  }
}, {immediate: true});
/** The reserved-slot measurer plugs into the transaction while an
 *  incoming card exists (registered fresh per scene). The category
 *  cursor seeds onto the landing card's family. */
watch(() => props.heroIncoming, (incoming: CardModel | undefined) => {
  unregisterHeroTarget?.();
  unregisterHeroTarget = undefined;
  if (incoming !== undefined) {
    unregisterHeroTarget = providePlayedHeroTarget(() => measureHeroTarget(), () => peekHeroTarget());
    focusCategory.value = familyOf(incoming.name);
  }
}, {immediate: true});
/** The view takes the BODY's box on its opening edge (pre-flush: the inset is set before the view mounts and
 *  measures itself, so its grid is planned for the room it really stands in). */
watch(() => categoryUp.value, (up: boolean) => {
  if (up) {
    measureCatInset();
  }
});
/** Touchdown committed: the cursor confirms the landing family. */
watch(() => props.heroRevealed, (revealed: boolean) => {
  if (revealed && props.heroIncoming !== undefined) {
    focusCategory.value = familyOf(props.heroIncoming.name);
  }
});

onMounted(() => {
  const bodyNow = body.value ?? undefined;
  if (bodyNow !== undefined && typeof ResizeObserver !== 'undefined') {
    ro = markRaw(new ResizeObserver(() => measure()));
    ro.observe(bodyNow);
  }
  measure();
});
onBeforeUnmount(() => {
  ro?.disconnect();
  ro = undefined;
  unregisterHeroTarget?.();
  unregisterHeroTarget = undefined;
  resetCategoryDirector();
  resetPlayedCategoryView();
  resetConsolePlayedUi();
});
defineExpose({handleIntent, stickScroll});
</script>
