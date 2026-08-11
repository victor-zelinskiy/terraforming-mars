<template>
  <!-- `con-ws` — the WORKSPACE-family marker: `.con-root:has(.con-ws)` lifts
       and rings the player rail while this screen lives (leave transitions
       included), hides the ДОП.РЕСУРСЫ satellite that would paint into the
       band, and idles the board's infinite loops underneath. The hand is a
       first-class workspace, not a section that happens to fill the space —
       and the rail is the wallet every play on this screen is paid from.
       `data-flow` — the EXPLICIT state of the descent (browse · configure ·
       picking, the last one being «the stage is claimed but a pick bridge has
       borrowed the shelf»), read by the chrome and by e2e; never inferred from
       an animation's side effects. -->
  <div class="con-hand con-hand--grid"
       :class="{'con-ws': !embedded, 'con-hand--embedded': embedded, 'con-hand--transit': transitHold, 'con-hand--under-scene': underScene, 'con-hand--discard': discard !== undefined, 'con-hand--discarding': discarding, 'con-hand--staged': stageOpen, 'con-hand--stagepaused': stagePaused}"
       :data-flow="stageOpen ? (stagePaused ? 'picking' : 'configure') : 'browse'"
       :style="rootStyle">
  <!-- The workspace FRAME — ONE chrome for both presentation states (the card
       shelf AND the embedded play stage). It is the screen's single plane: the
       shelf inside it carries no second plate, because a frame inside a frame
       is exactly what made this screen read as content pasted into an old
       modal. -->
  <div class="con-hand__frame">
    <!-- HEADER: the SHARED workspace header (ConsoleWsHead) — same emblem box,
         same three type voices, same aux-zone geometry as «Действия карт». Our
         browse-layer content (counts + tag filters + the mode bars) goes in its
         default slot; the breadcrumb tail is the component's own. Button hints
         live ONLY in the footer command bar — never here. -->
    <!-- EMBEDDED (this screen is a STEP of another workspace — the Game Start
         Workspace's play-from-hand prelude): the shared header comes OFF and
         the host's own `ConsoleWsHead` carries the whole breadcrumb. Two
         headers inside one frame is the exact «content pasted into an old
         modal» reading this component was built to remove — and the crumb
         root would lie («КАРТЫ В РУКЕ» when the player is inside СТАРТ
         ПАРТИИ). The slot content (counts · filters · the mode bars) is NOT
         chrome — it is this screen's own toolbar and stays either way. -->
    <!-- BROWSE-LAYER CHROME HIDES PAST THE DESCENT (embed contract rule 5):
         in the normal shell ConsoleWsHead does this itself — its browse layer
         (holding these filters/counters) yields to the deep crumb when the
         stage opens. The embedded toolbar must keep the same law, or the
         filters stand over a configure stage they no longer apply to. Held,
         not unmounted: the row keeps its height (no layout shift) and the
         filter state survives untouched. -->
    <component :is="embedded ? 'div' : 'ConsoleWsHead'"
               :class="embedded ? ['con-hand__toolbar', {'con-hand__toolbar--held': stageOpen}] : 'con-hand__head'"
               v-bind="embedded ? {} : {
                 root: 'Cards in hand',
                 emblem: 'cards',
                 subject: stage !== undefined ? stage.subject : '',
                 stage: stage !== undefined ? stage.name : '',
                 committed: stage !== undefined && stage.committed,
               }">
      <div class="con-hand__head-left">
        <span v-if="countText !== ''" class="con-hand__count">{{ countText }}</span>
        <span v-if="!selectActive && playableCount > 0" class="con-hand__playable">{{ $t('Playable now') }}: <b>{{ playableCount }}</b></span>
      </div>
      <!-- Tag filter (LB/RB cycle, R3 reset — advertised in the footer). The
           active chip is the always-visible source of truth for the filter. -->
      <div v-if="showFilters" class="con-hand__filters" role="group" :aria-label="$t('Tag filter')">
        <div v-for="opt in tagFilters"
             :key="opt.value"
             class="con-hand__filter"
             :class="{'con-hand__filter--active': opt.value === activeTag, 'con-hand__filter--empty': opt.count === 0 && opt.value !== activeTag}">
          <span v-if="opt.value === 'all'" class="con-hand__filter-label" v-i18n>All</span>
          <span v-else class="con-hand__filter-icon" :class="'tag-' + opt.value" aria-hidden="true"></span>
          <span class="con-hand__filter-count">{{ opt.count }}</span>
        </div>
      </div>
      <!-- SALE mode: the live financial summary of the current pick — how
           many cards are chosen, the M€ they pay out, and the before → after
           wallet. Amber (the sale accent); the gain/total read dim at zero
           picks so the mechanics are visible before the first selection. -->
      <div v-if="saleActive" class="con-hand__salebar" role="status" :aria-label="$t('Patent sale')">
        <span class="con-hand__salebar-item">
          <span class="con-hand__salebar-label">{{ $t('Selected') }}:</span>
          <b class="con-hand__salebar-num">{{ sale.count }}</b>
        </span>
        <span class="con-hand__salebar-item con-hand__salebar-item--gain" :class="{'con-hand__salebar-item--zero': sale.count === 0}">
          <b class="con-hand__salebar-num">+{{ sale.payout }}</b>
          <i class="resource_icon resource_icon--megacredits con-hand__salebar-mc" aria-hidden="true"></i>
        </span>
        <span class="con-hand__salebar-item con-hand__salebar-item--total" :class="{'con-hand__salebar-item--zero': sale.count === 0}">
          <i class="resource_icon resource_icon--megacredits con-hand__salebar-mc" aria-hidden="true"></i>
          <b class="con-hand__salebar-num">{{ sale.before }}</b>
          <span class="con-hand__salebar-arrow" aria-hidden="true">→</span>
          <b class="con-hand__salebar-num con-hand__salebar-num--after">{{ sale.after }}</b>
        </span>
      </div>
      <!-- DISCARD mode: the ONE header block every discard gets, whoever asked
           for it. It states the ask («Сбросьте 1 карту»), NAMES the source (a
           card effect / a colony / a game rule), shows the colony-bonus
           position when the discard closes a Pluto payout, and — when the
           discard BUYS something — the exchange, live for the current pick.
           Derived from the server marker in cardDiscard/discardIntent.ts, so
           it cannot drift between cases. -->
      <div v-if="discard !== undefined" class="con-hand__discard" role="status">
        <span class="con-hand__discard-mark" aria-hidden="true">⌫</span>
        <span class="con-hand__discard-ask">{{ discardAsk }}</span>
        <span class="con-hand__discard-sep" aria-hidden="true">·</span>
        <span class="con-hand__discard-src">{{ discardSource }}</span>
        <span v-if="discard.sequence !== undefined" class="con-hand__discard-seq">{{ discardSequence }}</span>
        <span v-if="discard.exchange !== undefined" class="con-hand__discard-swap">
          <b class="con-hand__discard-out">−{{ Math.max(1, discard.picked) }}</b>
          <i class="resource_icon resource_icon--cards con-hand__discard-icon" aria-hidden="true"></i>
          <span class="con-hand__discard-arrow" aria-hidden="true">→</span>
          <b class="con-hand__discard-in" :class="{'con-hand__discard-in--zero': discard.exchange.amount === 0}">+{{ discard.exchange.amount }}</b>
          <i :class="discardExchangeIconClass" class="con-hand__discard-icon" aria-hidden="true"></i>
        </span>
      </div>
      <!-- SELECT mode: the SOURCE-OPERATION chip — a composer's target pick
           names the action it serves («Настройка действия · Газосборники»),
           so the player never loses the WHY mid-pick. Suppressed for a discard:
           the block above already carries the source, and two source chips
           would say the same thing twice. -->
      <div v-if="selectActive && discard === undefined && select !== undefined && select.context !== undefined" class="con-hand__pickctx">
        <span class="con-hand__pickctx-mark" aria-hidden="true">◈</span>
        <span class="con-hand__pickctx-kicker">{{ $t(select.context.kicker) }}</span>
        <span class="con-hand__pickctx-sep" aria-hidden="true">·</span>
        <span class="con-hand__pickctx-card">{{ $t(select.context.card) }}</span>
      </div>
      <!-- SELECT mode: the "suitable only" filter chip (LT toggles). Shown only
           for a CONDITIONAL prompt where some hand cards can't be picked; a
           plain "pick any card" prompt (e.g. discard 1) has no non-candidates,
           so no filter is offered. -->
      <div v-if="selectActive && select !== undefined && select.filtered"
           class="con-hand__selectfilter"
           :class="{'con-hand__selectfilter--all': !select.suitableOnly}">
        <span class="con-hand__selectfilter-dot" aria-hidden="true"></span>
        <span class="con-hand__selectfilter-label">{{ $t(select.suitableOnly ? 'Only suitable' : 'All cards') }}</span>
      </div>
      <!-- Multi-pick PAYOUT summary (Public Plans: +1 M€ per revealed card) —
           the select-mode twin of the sale bar: picked count, the live gain,
           and the before → after wallet. Cyan (the select accent). -->
      <div v-if="selectActive && selectPayout !== undefined" class="con-hand__salebar con-hand__salebar--select" role="status">
        <span class="con-hand__salebar-item">
          <span class="con-hand__salebar-label">{{ $t('Selected') }}:</span>
          <b class="con-hand__salebar-num">{{ pickCount }}</b>
        </span>
        <span class="con-hand__salebar-item con-hand__salebar-item--gain" :class="{'con-hand__salebar-item--zero': pickCount === 0}">
          <b class="con-hand__salebar-num">+{{ pickGain }}</b>
          <i :class="payoutIconClass" class="con-hand__salebar-mc" aria-hidden="true"></i>
        </span>
        <span v-if="selectPayout.current !== undefined" class="con-hand__salebar-item con-hand__salebar-item--total" :class="{'con-hand__salebar-item--zero': pickCount === 0}">
          <i :class="payoutIconClass" class="con-hand__salebar-mc" aria-hidden="true"></i>
          <b class="con-hand__salebar-num">{{ selectPayout.current }}</b>
          <span class="con-hand__salebar-arrow" aria-hidden="true">→</span>
          <b class="con-hand__salebar-num con-hand__salebar-num--after">{{ selectPayout.current + pickGain }}</b>
        </span>
      </div>
    </component>

    <!-- ── The STAGE WRAP: the BROWSE layer (shelf + status rail) and the
         embedded stage occupy the same region. Descending recomposes the frame
         IN PLACE — the browse DOM is only parked, so the selection, the scroll
         position and the filter survive by construction; nothing is
         unmounted, nothing remounts on the way back. ── -->
    <div class="con-hand__stagewrap">
    <div class="con-hand__browse" ref="browseEl" :class="{'con-hand__browse--parked': stageOpen}">
    <!-- Premium hand SHELF: a smart, virtualized grid. Only the visible rows +
         overscan are rendered, so a big hand pages at 60fps. -->
    <div class="con-hand__shelf">
      <div class="con-hand__grid"
           ref="grid"
           :class="{'con-hand__grid--centered': !plan.scrolls, 'con-hand__grid--scroll': plan.scrolls}"
           @scroll.passive="onScroll">
        <div class="con-hand__pad" :style="padStyle">
          <div class="con-hand__spacer" :style="{height: topSpacerPx + 'px'}" aria-hidden="true"></div>
          <div v-for="row in renderRows"
               :key="row"
               class="con-hand__row"
               :style="rowStyle">
            <div v-for="(entry, ci) in rowEntries(row)"
                 :key="entry.card.name"
                 class="con-hand__slot"
                 :data-zoom-slot="entry.card.name"
                 :class="{
                   'con-hand__slot--selected': row * plan.cols + ci === index,
                   'con-hand__slot--playable': !saleActive && !selectActive && entry.playable,
                   'con-hand__slot--unplayable': !saleActive && !selectActive && !entry.playable,
                   'con-hand__slot--sale-picked': saleActive && isSaleSelected(entry.card.name),
                   'con-hand__slot--select-picked': selectActive && isSelectPicked(entry.card.name),
                   'con-hand__slot--select-disabled': selectActive && !isSelectable(entry.card.name),
                   'con-deal-hold': entry.card.name === stagedCard,
                 }">
              <Card :card="entry.card" :key="entry.card.name" lightweight />
              <span v-if="entry.robot" class="con-hand__robot" v-i18n>Robots</span>
              <!-- State band: sale pick / select pick (✓), a "can't select"
                   marker on a non-candidate, else a COMPACT play blocker chip
                   (the full reason is in the info panel below). -->
              <span v-if="saleActive && isSaleSelected(entry.card.name)" class="con-cards__pickband con-cards__pickband--sale" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
              <span v-else-if="selectActive && isSelectPicked(entry.card.name)"
                    class="con-cards__pickband"
                    :class="discard !== undefined ? 'con-cards__pickband--discard' : 'con-cards__pickband--select'"
                    aria-hidden="true">{{ discard !== undefined ? '⌫ ' + $t('Discarded') : '✓ ' + $t('Card selected') }}</span>
              <span v-else-if="selectActive && !isSelectable(entry.card.name)" class="con-hand__chip" aria-hidden="true">{{ $t('Unavailable') }}</span>
              <span v-else-if="!saleActive && !selectActive && !entry.playable && chipLabel(entry)" class="con-hand__chip" aria-hidden="true">{{ $t(chipLabel(entry) || '') }}</span>
            </div>
          </div>
          <div class="con-hand__spacer" :style="{height: bottomSpacerPx + 'px'}" aria-hidden="true"></div>
        </div>
      </div>

      <!-- Thin premium scrollbar / progress (only when the grid scrolls). -->
      <div v-if="plan.scrolls && entries.length > 0" class="con-hand__scrollbar" aria-hidden="true">
        <div class="con-hand__scrollthumb" :style="thumbStyle"></div>
      </div>

      <!-- Empty state, centred in the glass frame (filter vs truly-empty).
           Held back while a reveal/filter episode owns the cards — the
           message must not pop over cards still gathering into the dock. -->
      <div v-if="entries.length === 0 && !transitHold" class="con-hand__empty">
        <span class="con-hand__empty-glyph" aria-hidden="true">◍</span>
        <span class="con-hand__empty-text">{{ emptyMessage }}</span>
      </div>
    </div>

    <!-- Selected-card INFO PANEL: name + play state + the server's structured
         reason. NO button hints (they live in the footer). -->
    <div v-if="selected !== undefined"
         class="con-cards__verdictbar con-hand__verdictbar"
         :class="{
           'con-hand__verdictbar--ok': !saleActive && !selectActive && selectedPlayable,
           'con-hand__verdictbar--blocked': !saleActive && !selectActive && !selectedPlayable,
           'con-hand__verdictbar--sale': saleActive,
           'con-hand__verdictbar--select': selectActive && discard === undefined,
           'con-hand__verdictbar--discard': discard !== undefined,
           'con-hand__verdictbar--hold': filterBusy,
         }">
      <span class="con-cards__verdict-name">{{ $t(selected.name) }}</span>
      <template v-if="selectActive">
        <!-- Picked / pickable / blocked — with the concrete «why not» reason
             for a non-candidate card (the fork's always-explain rule). -->
        <span v-if="isSelectPicked(selected.name)" class="con-cards__verdict con-cards__verdict--picked"><span aria-hidden="true">{{ discard !== undefined ? '⌫' : '✓' }}</span> {{ $t(discard !== undefined ? 'Discarded' : 'Card selected') }}</span>
        <span v-else-if="isSelectable(selected.name)" class="con-cards__verdict con-cards__verdict--ok">{{ $t(discard !== undefined ? 'Can be discarded' : 'Not selected') }}</span>
        <template v-else>
          <span class="con-cards__verdict con-cards__verdict--blocked"><span aria-hidden="true">✕</span> {{ $t('Unavailable') }}</span>
          <span v-if="focusedSelectReason !== ''" class="con-hand__reason con-hand__reason--bar con-hand__reason--rule">{{ focusedSelectReason }}</span>
        </template>
      </template>
      <template v-else-if="saleActive">
        <span class="con-cards__verdict" :class="isSaleSelected(selected.name) ? 'con-cards__verdict--picked' : ''">{{ $t(isSaleSelected(selected.name) ? 'Card selected' : 'Not selected') }}</span>
      </template>
      <template v-else-if="selectedPlayable">
        <span class="con-cards__verdict con-cards__verdict--ok"><span aria-hidden="true">✓</span> {{ $t('Playable now') }}</span>
      </template>
      <template v-else>
        <span class="con-cards__verdict con-cards__verdict--blocked"><span aria-hidden="true">✕</span> {{ $t('Unplayable now') }}</span>
        <!-- A card with NO server rules-reason but not playable is rules-OK,
             just not your window (opponent's turn / mid-action) — say so, never
             a bare "Нельзя разыграть" nor a misleading "conditions not met". -->
        <span v-if="softBlocked" class="con-hand__reason con-hand__reason--bar con-hand__reason--turn">{{ $t(softReason) }}</span>
        <span v-else v-for="(r, i) in reasons.slice(0, 2)" :key="i" class="con-hand__reason con-hand__reason--bar" :class="'con-hand__reason--' + r.type">{{ reasonLine(r) }}</span>
      </template>
      <!-- Filtered count lives HERE (compact, right-aligned) — never in the
           header, so the header height can't jump when the filter changes. -->
      <span v-if="filteredCountText !== ''" class="con-hand__shown">{{ filteredCountText }}</span>
    </div>

    <!-- The gliding selection frame — THE primary focus indicator of card
         navigation (shared with the start scene / draft / reveal). Self-
         resolving: tracks the cursored card inside this section itself,
         following grid scroll and the focus scale transition live.
         Suppressed while the reveal transition owns the cards (the frame
         would aim at a held-invisible slot). -->
    </div><!-- /__browse -->

    <!-- ── THE EMBEDDED STAGE — the TELEPORT TARGET the shell's ONE
         ConsolePlayCardConfirm re-homes into (consoleWorkspaceStack). The very
         same instance that used to stand as its own band renders HERE, in
         embedded dress: same captures, same payment, same submit path, same
         command contract, same zoom routing. A nested second instance would
         mean two mount points and two contracts to keep in sync — and a static
         import of a `Card.vue` consumer into a unit-tested component silently
         zeroes its whole spec file (the chunk `CardHelp.vue` loads cannot
         resolve under mochapack). One mount, one lifecycle, one input path.

         `data-unfold-surface` is what the descend phrase clips open from the
         pressed card's rect; it is rendered from the moment the stage OPENS
         (not when the composer arrives), so the teleport can never resolve
         against a target that does not exist yet. -->
    <transition :css="false"
                @enter="handStageEnterHook" @leave="handStageLeaveHook"
                @enter-cancelled="handStageEnterCancelledHook" @leave-cancelled="handStageLeaveCancelledHook">
      <div v-if="stageOpen"
           class="con-hand__stage"
           data-unfold-surface
           data-embed-slot="hand-play"></div>
    </transition>
    </div><!-- /__stagewrap -->
  </div><!-- /__frame -->
  </div>
</template>

<script lang="ts">
/**
 * Console Hand section — a PREMIUM, VIRTUALIZED SMART GRID (the rework of the
 * legacy horizontal carousel). The pure layout/nav math lives in
 * `consoleHandGrid.ts` (unit-tested); this component owns the DOM concerns:
 * measuring the box (ResizeObserver), WINDOWING the rows (only the visible
 * rows + overscan render, so a big hand stays 60fps), keeping the selected card
 * visible on navigation, and the right-stick free-scroll + lazy edge-nudge.
 *
 * Selection index lives in the router (`consoleState.handIndex`) and is passed
 * back as the `index` prop for rendering; the section MUTATES it directly from
 * `move()` (mirrors `ConsoleBoardSection.move()`), and the shell just delegates.
 *
 * A premium HEADER hosts the title + live counts + the console-native tag
 * filter (LB/RB cycle, R3 reset — the shell owns those inputs; the panel is
 * pure state). PLAYABLE-FIRST sort is applied by the shell; the info panel
 * under the grid carries the play state + the SERVER's structured unplayable
 * reasons (unit-suffixed "Сейчас: …"). Button hints live ONLY in the footer.
 */
import {defineComponent, PropType, markRaw} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import {setWorkspaceFrameSlot} from '@/client/console/consoleWorkspaceStack';
import {
  handStageEnterHook,
  handStageLeaveHook,
  handStageEnterCancelledHook,
  handStageLeaveCancelledHook,
} from '@/client/console/consoleHandStageMotion';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';
import {consoleState} from '@/client/console/consoleRouter';
import {planHandGrid, stepHandGrid, shortBlockerLabel, HandGridPlan, HandNavDir} from '@/client/components/console/consoleHandGrid';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {ConsoleTagFilterOption, HandTagFilter} from '@/client/components/console/consoleHandFilter';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {saleSummary} from '@/client/console/patentSale/patentSaleModel';
import {DiscardIntent} from '@/client/console/cardDiscard/discardIntent';

export type ConsoleHandEntry = {
  card: CardModel,
  playable: boolean,
  /** Hosted on Self-Replicating Robots. */
  robot: boolean,
};

/**
 * MANDATORY hand-SELECT mode (server `handSelect` task — discard / reveal /
 * keep / place a card FROM the player's own hand), handed down by the shell.
 * Present ⇔ the section is a picker rather than the normal play/browse hand.
 * The shell owns the accumulation + submit; the section only renders the pick
 * states + the "suitable only" filter chip (LT toggles it in the shell).
 */
export type ConsoleHandSelectMode = {
  active: true,
  /** Names the player may pick (the prompt's candidate cards). */
  selectable: ReadonlyArray<string>,
  /** Currently picked names (multi-select accumulation). */
  selected: ReadonlyArray<string>,
  /** Pre-translated per-card reason for a NON-selectable card. */
  reasons: Record<string, string>,
  /** min===max===1 → A submits directly (no toggle-then-confirm). */
  single: boolean,
  /** The prompt is a CONDITIONAL subset of the hand (there ARE non-pickable
   *  cards) → the "suitable only" toggle is meaningful. */
  filtered: boolean,
  /** The "suitable only" filter is ON (only candidate cards shown). */
  suitableOnly: boolean,
  /** The honest «из Y» universe for the shown-count line (a CLIENT pick hides
   *  the staged / SRR-hosted cards, so the section's own total would lie). */
  total?: number,
  /** Live per-picked-card payout (Public Plans: +1 M€ each) — renders the
   *  sale-bar-style running summary (count · +gain · before → after). */
  payout?: {icon: string, amount: number, current?: number},
  /** The OPERATION this pick serves (a composer's target pick): a kicker
   *  i18n key + the source card name (i18n key). Rendered as a header chip so
   *  the player never loses WHY they are choosing here. */
  context?: {kicker: string, card: string},
  /**
   * THE DISCARD SKIN. Present ⇔ this pick throws cards away, derived by the
   * shell from the server's single `discardPrompt` marker — so a card effect
   * (Mars University), a colony bonus (Pluto), a colony effect (Hygiea), a
   * global event and a CEO action all render identically. The section only
   * READS it: the ask, the source, the colony-bonus position and the exchange
   * are all pre-derived (cardDiscard/discardIntent.ts).
   */
  discard?: DiscardIntent,
};

/** Rows kept mounted above/below the viewport so a fast page never blanks. */
const OVERSCAN = 2;
/** Top/bottom content inset (px): a card's cost badge + focus glow poke ABOVE
 *  the card box, so the scroll content starts this far below the clip edge
 *  (and rows keep this margin from the viewport top when scrolled to). */
const EDGE_INSET_BASE = 20;
/** Edge reserve around the grid (badge overhang + focus glow clearance).
 *  Scales with the TV profile: the fill-pass grows cards ~2.5×, so the
 *  cost badge's overhang grows past the 1080-tuned 20px and the top row
 *  clipped (the «карты обрезаются сверху» defect). */
function edgeInset(): number {
  return Math.round(EDGE_INSET_BASE * conUiScale());
}
/** Right-stick free-scroll px per intent frame (rows are tall). */
const STICK_SCROLL_STEP = 44;
/** Fallback box before the first measure / under JSDOM (rects are 0). */
const FALLBACK_W = 1280;
const FALLBACK_H = 560;

function clampNum(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * THE DESCENT the hand hosts: the player pressed A on a card and the workspace
 * opened one level deeper around it. The shell owns the flow; the section only
 * needs to know that it must PARK its browse layer, grow the breadcrumb and
 * render the stage zone the embedded surface teleports into.
 */
export type ConsoleHandStage = {
  /** The carried card (an i18n key) — the breadcrumb's fixed subject. */
  subject: string,
  /** The step's own name (i18n key), handed UP by the embedded surface. */
  name: string,
  /** Past the commit boundary — the stage marker goes amber. */
  committed: boolean,
};

export default defineComponent({
  name: 'ConsoleHandSection',
  components: {Card, ConsoleWsHead},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<ConsoleHandEntry>>, required: true},
    index: {type: Number, required: true},
    /** Sell-patents mode: A toggles picks, RT confirms (shell owns the flow). */
    saleActive: {type: Boolean, default: false},
    saleSelected: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
    /** The player's current M€ — drives the sale summary's before → after. */
    saleMegacredits: {type: Number, default: 0},
    /** MANDATORY hand-select mode (discard / reveal / place) — undefined when
     *  the section is the normal play/browse hand. */
    select: {type: Object as PropType<ConsoleHandSelectMode | undefined>, default: undefined},
    /**
     * The discard cinematic is holding the chosen cards ABOVE this grid (they
     * are proxies on the discard layer; their real slots are held empty). The
     * rest of the hand recedes so the eye stays on what is leaving — a pure
     * CSS beat (`.con-hand--discarding`), no timeline, transform/opacity only.
     */
    discarding: {type: Boolean, default: false},
    /** The turn/phase reason (i18n key) for a card that is rules-OK but not
     *  playable right now (opponent's turn / mid-action). Set by the shell. */
    softReason: {type: String, default: 'Not your turn to take any actions'},
    /** Tag-filter options (All + tags present in the hand) built by the shell. */
    tagFilters: {type: Array as PropType<ReadonlyArray<ConsoleTagFilterOption>>, default: () => []},
    /** The active tag filter (`'all'` or one tag) — drives the chip highlight. */
    activeTag: {type: String as PropType<HandTagFilter>, default: 'all'},
    /**
     * The card currently STAGED in the play composer (or mid-return /
     * mid-depart) — its hand slot is held empty via a VUE-managed
     * `con-deal-hold` (patch-proof, unlike a runtime classList): one
     * physical card can never sit in the hand AND the modal at once.
     */
    stagedCard: {type: String as PropType<CardName | undefined>, default: undefined},
    /**
     * The dock ↔ overlay REVEAL transition owns the cards right now: every
     * slot renders held (the flying proxies are the single visible
     * representation of each card — handRevealDirector.ts). Vue-managed so
     * a mid-episode patch can't wash the hold off.
     */
    transitHold: {type: Boolean, default: false},
    /**
     * A tag-FILTER episode is airborne (`handRevealState.filterActive`):
     * the status rail HOLDS its text (the already-swapped verdict/counts
     * must not read over cards still gathering) — it fades back in with
     * the settle.
     */
    filterBusy: {type: Boolean, default: false},
    /**
     * A bottom-reaching scene is up (the shell's `footerUnderScene` — play
     * composer etc. — or the reveal modal): the status rail DROPS back
     * under the overlay band. In the calm open hand it rides ABOVE the
     * footer/dock (z 11711) so the non-filtered backs staying in the tray
     * (per-card lift) and the reveal flights pass BEHIND it, never over
     * its text.
     */
    underScene: {type: Boolean, default: false},
    /**
     * THE OPEN DESCENT (undefined = the browse layer owns the screen). Present
     * ⇔ the workspace has been entered one level deeper: the header grows its
     * tail, the shelf parks, and the stage zone renders as the teleport target
     * for the shell's play composer.
     */
    stage: {type: Object as PropType<ConsoleHandStage | undefined>, default: undefined},
    /**
     * THIS SCREEN IS A STEP OF ANOTHER WORKSPACE (the Game Start Workspace's
     * play-from-hand prelude). The SHELL comes off — the shared header, the
     * frame plate, the `con-ws` rail marker — and the host draws all three;
     * the CONTENT (the shelf, the filters, the status rail, the playability
     * presentation, the stage zone the composer descends into) is untouched,
     * which is the whole point: the player gets their real hand, not a picker.
     *
     * Mirrors `ConsolePlayCardConfirm.embedded` / `ConsoleTaskHost.embedded`:
     * one prop, never one per flavour.
     */
    embedded: {type: Boolean, default: false},
    /**
     * THE DESCENT IS PAUSED — a pick BRIDGE is out (the composer sent the
     * player back to this very shelf to choose a card for the play it is
     * configuring). The stage stays CLAIMED (the zone keeps its slot and the
     * composer keeps every capture — retracting it here would unmount the
     * composer and lose the whole configuration), but the shelf must come back
     * to full strength: it is the picker now, and a parked 7 %-opacity grid is
     * one the player cannot choose from.
     */
    stagePaused: {type: Boolean, default: false},
  },
  data() {
    return {
      box: {w: 0, h: 0},
      /** Row-gated scroll position that drives the render window. */
      scrollTopPx: 0,
      /** Smooth 0..1 scroll fraction for the scrollbar thumb. */
      scrollFrac: 0,
      lastFirstRow: -1,
      ro: undefined as ResizeObserver | undefined,
      rafScroll: undefined as number | undefined,
      rafMeasure: undefined as number | undefined,
    };
  },
  computed: {
    /** The workspace has been descended into — the browse layer is parked. */
    stageOpen(): boolean {
      return this.stage !== undefined;
    },
    selected(): CardModel | undefined {
      return this.entries[this.index]?.card;
    },
    selectedPlayable(): boolean {
      return this.entries[this.index]?.playable === true;
    },
    reasons(): ReadonlyArray<UnplayableReason> {
      return this.selected?.unplayableReasons ?? [];
    },
    /** The selected card is blocked only by the window (no server rules-reason),
     *  so the panel shows the soft turn/phase reason instead of a bare block. */
    softBlocked(): boolean {
      return !this.saleActive && !this.selectActive && this.selected !== undefined && !this.selectedPlayable && this.reasons.length === 0;
    },
    // ── mandatory hand SELECT (discard / reveal / place) ──────────────────
    selectActive(): boolean {
      return this.select?.active === true;
    },
    // ── DISCARD skin (one derivation, every discard case) ─────────────────
    /** The pre-derived discard presentation, or undefined for a normal pick. */
    discard(): DiscardIntent | undefined {
      return this.selectActive ? this.select?.discard : undefined;
    },
    /** «Сбросьте 1 карту» / «Сбросьте 3 карты» / «Сбросьте до 3 карт». */
    discardAsk(): string {
      const headline = this.discard?.headline;
      if (headline === undefined) {
        return '';
      }
      return headline.amount === undefined ?
        translateText(headline.key) :
        translateTextWithParams(headline.key, [String(headline.amount)]);
    },
    /** WHO demands it: the source card's name when there is one, else the kind
     *  («Колония» / «Правило игры») — never a bare unexplained ask. */
    discardSource(): string {
      const intent = this.discard;
      if (intent === undefined) {
        return '';
      }
      return intent.card !== undefined ? translateText(intent.card) : translateText(intent.sourceKey);
    },
    /** «Бонус колонии 2 из 3» — Pluto resolves one cube at a time. A SINGLE
     *  colony shows the plain «Бонус колонии»: «1 из 1» numbers a sequence
     *  that does not exist, and the player reads it as a progress bar. */
    discardSequence(): string {
      const seq = this.discard?.sequence;
      if (seq === undefined) {
        return '';
      }
      if (seq.total <= 1) {
        return translateText('Colony bonus');
      }
      return translateTextWithParams('Colony bonus ${0} of ${1}', [String(seq.index), String(seq.total)]);
    },
    discardExchangeIconClass(): string {
      return iconClassFor(this.discard?.exchange?.icon ?? 'cards');
    },
    /** SALE mode: the live pick summary (count / payout / before → after). */
    sale(): {count: number, payout: number, before: number, after: number} {
      return saleSummary(this.saleSelected.length, this.saleMegacredits);
    },
    /** The focused card's per-card «why not» reason (non-selectable only). */
    focusedSelectReason(): string {
      const name = this.selected?.name;
      return name !== undefined ? this.selectReason(name) : '';
    },
    /** Multi-pick payout summary (present only for a paying client pick). */
    selectPayout(): {icon: string, amount: number, current?: number} | undefined {
      return this.select?.payout;
    },
    pickCount(): number {
      return this.select?.selected.length ?? 0;
    },
    pickGain(): number {
      return this.pickCount * (this.selectPayout?.amount ?? 0);
    },
    payoutIconClass(): string {
      return iconClassFor(this.selectPayout?.icon ?? 'megacredits');
    },
    // ── header / filter panel ─────────────────────────────────────────────
    showFilters(): boolean {
      // Only worth a filter panel when there's a real tag beyond "All", and
      // never in sale / select mode (sale shows the whole hand; select uses the
      // "suitable only" toggle, not tag filters).
      return !this.saleActive && !this.selectActive && this.tagFilters.length > 1;
    },
    totalCount(): number {
      return this.tagFilters.find((o) => o.value === 'all')?.count ?? this.entries.length;
    },
    playableCount(): number {
      return this.entries.reduce((n, e) => n + (e.playable ? 1 : 0), 0);
    },
    /** The header shows the plain total ONLY when there are no filter chips to
     *  carry it (the "All" chip shows it otherwise). It NEVER shows "Показано X
     *  из Y" — that would widen the header on a filter toggle and wrap the chips
     *  to a second row (the header must stay a stable height); that count lives
     *  compactly in the bottom info bar instead (`filteredCountText`). */
    countText(): string {
      return this.showFilters ? '' : String(this.totalCount);
    },
    /** "Показано 8 из 33" — shown ONLY when a tag filter is active (never in
     *  sale mode, where the whole hand is shown), in the bottom info bar (never
     *  the header, so the header height can't jump). */
    filteredCountText(): string {
      if (this.saleActive) {
        return '';
      }
      // Select mode: "Показано X из Y" only while the "suitable only" filter is
      // hiding non-candidate cards. A CLIENT pick supplies its own honest
      // universe (`total` — staged / SRR-hosted cards are outside the pick).
      if (this.selectActive) {
        return this.select?.filtered === true && this.select.suitableOnly ?
          translateTextWithParams('Shown ${0} of ${1}', [String(this.entries.length), String(this.select.total ?? this.totalCount)]) :
          '';
      }
      return this.activeTag !== 'all' ?
        translateTextWithParams('Shown ${0} of ${1}', [String(this.entries.length), String(this.totalCount)]) :
        '';
    },
    emptyMessage(): string {
      return this.activeTag !== 'all' ? translateText('No cards with this tag') : translateText('No cards in hand');
    },
    plan(): HandGridPlan {
      // Reserve the edge inset on every side so cards' badges + focus glow have
      // room and never clip against the shelf edge (the fit/scroll decision
      // and the centred content width both fall inside that inset box).
      const w = (this.box.w > 0 ? this.box.w : FALLBACK_W) - edgeInset() * 2;
      const h = (this.box.h > 0 ? this.box.h : FALLBACK_H) - edgeInset() * 2;
      return planHandGrid({availW: w, availH: h, count: this.entries.length, uiScale: conUiScale()});
    },
    /** Row indices to render (all when it fits; windowed when it scrolls). The
     *  window is derived even before the first measure (from the fallback box),
     *  so a large hand never mounts every card in one frame on first paint. */
    renderRows(): Array<number> {
      const p = this.plan;
      if (p.rows <= 0) {
        return [];
      }
      if (!p.scrolls) {
        return this.range(0, p.rows - 1);
      }
      const availH = this.box.h > 0 ? this.box.h : FALLBACK_H;
      const contentY = this.scrollTopPx - edgeInset();
      const first = Math.max(0, Math.floor(contentY / p.rowStride) - OVERSCAN);
      const last = Math.min(p.rows - 1, Math.ceil((contentY + availH) / p.rowStride) + OVERSCAN);
      return this.range(first, last);
    },
    rootStyle(): Record<string, string> {
      return {'--con-hand-zoom': String(this.plan.cardZoom)};
    },
    padStyle(): Record<string, string> {
      return this.plan.contentW > 0 ? {width: Math.round(this.plan.contentW) + 'px'} : {};
    },
    rowStyle(): Record<string, string> {
      return {height: this.plan.rowStride + 'px', columnGap: this.plan.gapX + 'px'};
    },
    topSpacerPx(): number {
      const rows = this.renderRows;
      return rows.length === 0 ? 0 : edgeInset() + rows[0] * this.plan.rowStride;
    },
    bottomSpacerPx(): number {
      const rows = this.renderRows;
      if (rows.length === 0) {
        return 0;
      }
      return (this.plan.rows - 1 - rows[rows.length - 1]) * this.plan.rowStride + edgeInset();
    },
    thumbStyle(): Record<string, string> {
      const p = this.plan;
      const content = p.rows * p.rowStride + edgeInset() * 2;
      const visible = this.box.h > 0 ? this.box.h : FALLBACK_H;
      const hPct = clampNum(8, 100, (visible / Math.max(1, content)) * 100);
      const topPct = (100 - hPct) * this.scrollFrac;
      return {height: hPct + '%', top: topPct + '%'};
    },
  },
  watch: {
    /**
     * Publish / retract the TELEPORT TARGET as the stage zone comes and goes.
     * The consumer depends on this VALUE, not on a `document.querySelector` in
     * a computed — a computed tracks reactive reads, not the DOM, so it would
     * never re-run when the node appears, and a teleport whose target does not
     * exist drops its content on the floor.
     */
    stageOpen: {
      immediate: true,
      // POST-FLUSH, and that is the whole trick. A `pre` watcher publishes the
      // selector BEFORE this component has rendered the node it names — and the
      // shell is our PARENT, so it re-renders first and resolves the teleport
      // against a target that does not exist yet. Vue then warns and leaves the
      // content sitting in its original place: the composer appeared BELOW the
      // command bar, in flow, with the workspace standing empty above it.
      // Publishing after the DOM update means the node is always there before
      // anyone can look for it.
      flush: 'post',
      handler(on: boolean) {
        setWorkspaceFrameSlot('hand', on ? '[data-embed-slot="hand-play"]' : '');
      },
    },
    index() {
      void this.$nextTick(() => this.ensureSelectedVisible());
    },
    'entries.length'() {
      // A shrinking hand may leave the index past the end — clamp it.
      if (this.index > this.entries.length - 1) {
        consoleState.handIndex = Math.max(0, this.entries.length - 1);
      }
      void this.$nextTick(() => {
        this.applyScroll();
        this.ensureSelectedVisible();
      });
    },
  },
  methods: {
    // The WORKSPACE DESCEND phrase, one level deeper than «Действия карт»'s
    // (consoleHandStageMotion): the stage unfolds from the pressed card's rect
    // and folds back into it. Bound as methods so the template stays readable.
    handStageEnterHook,
    handStageLeaveHook,
    handStageEnterCancelledHook,
    handStageLeaveCancelledHook,
    range(a: number, b: number): Array<number> {
      const out: Array<number> = [];
      for (let i = a; i <= b; i++) {
        out.push(i);
      }
      return out;
    },
    rowEntries(row: number): ReadonlyArray<ConsoleHandEntry> {
      const start = row * this.plan.cols;
      return this.entries.slice(start, start + this.plan.cols);
    },
    isSaleSelected(name: string): boolean {
      return this.saleSelected.includes(name);
    },
    /** Select mode: is this card a candidate the player may pick? */
    isSelectable(name: string): boolean {
      return this.select?.selectable.includes(name) ?? false;
    },
    /** Select mode: is this card currently picked? */
    isSelectPicked(name: string): boolean {
      return this.select?.selected.includes(name) ?? false;
    },
    /** Select mode: the pre-translated «why not» reason for a non-candidate. */
    selectReason(name: string): string {
      return this.select?.reasons[name] ?? '';
    },
    /** "Требуется X · Сейчас: Y°C" — shared formatter (unit included). */
    reasonLine(r: UnplayableReason): string {
      return unplayableReasonLine(r);
    },
    /** Compact blocker chip label for an unavailable card (english i18n key). */
    chipLabel(entry: ConsoleHandEntry): string | undefined {
      return shortBlockerLabel(entry.card.unplayableReasons ?? []);
    },
    // ── navigation (called by the shell, mirrors ConsoleBoardSection) ──────
    /** D-pad / left-stick: move the selection across the grid, keep it visible. */
    move(dir: HandNavDir): void {
      consoleState.handIndex = stepHandGrid(this.index, dir, this.entries.length, this.plan.cols);
      void this.$nextTick(() => this.ensureSelectedVisible());
    },
    /** Right stick: free vertical scroll; the scroll handler nudges selection. */
    stickScroll(dy: number): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined || !this.plan.scrolls) {
        return;
      }
      grid.scrollBy({top: dy * STICK_SCROLL_STEP, behavior: 'auto'});
    },
    // ── scroll / windowing / measure ──────────────────────────────────────
    onScroll(): void {
      if (this.rafScroll !== undefined) {
        return;
      }
      this.rafScroll = requestAnimationFrame(() => {
        this.rafScroll = undefined;
        this.applyScroll();
      });
    },
    applyScroll(): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined) {
        return;
      }
      const p = this.plan;
      const st = grid.scrollTop;
      // Row-gated: only re-render the window when the first visible row changes.
      const firstRow = p.rowStride > 0 ? Math.floor((st - edgeInset()) / p.rowStride) : 0;
      if (firstRow !== this.lastFirstRow) {
        this.lastFirstRow = firstRow;
        this.scrollTopPx = st;
      }
      // Smooth indicators (cheap — one style + one text node).
      const maxScroll = Math.max(1, grid.scrollHeight - grid.clientHeight);
      this.scrollFrac = clampNum(0, 1, st / maxScroll);
      // Keep the selection visible while free-scrolling (lazy edge nudge).
      this.reconcileSelection(st);
    },
    reconcileSelection(st: number): void {
      const p = this.plan;
      if (!p.scrolls || p.cols <= 0 || this.box.h <= 0) {
        return;
      }
      const firstFull = Math.ceil((st - edgeInset()) / p.rowStride);
      const lastFull = Math.floor((st - edgeInset() + this.box.h) / p.rowStride) - 1;
      if (lastFull < firstFull) {
        return;
      }
      const selRow = Math.floor(this.index / p.cols);
      if (selRow < firstFull) {
        this.clampSelectionToRow(firstFull);
      } else if (selRow > lastFull) {
        this.clampSelectionToRow(lastFull);
      }
    },
    clampSelectionToRow(row: number): void {
      const p = this.plan;
      const r = clampNum(0, p.rows - 1, row);
      const col = this.index % p.cols;
      const idx = Math.min(this.entries.length - 1, r * p.cols + col);
      if (idx !== consoleState.handIndex && idx >= 0) {
        consoleState.handIndex = idx;
      }
    },
    ensureSelectedVisible(): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      const p = this.plan;
      if (grid === undefined || !p.scrolls || p.cols <= 0) {
        return;
      }
      const inset = edgeInset();
      const clientH = grid.clientHeight;
      const viewTop = grid.scrollTop;
      // Reveal the focused card from its ACTUAL rendered rect when it's in the
      // virtual window: the DOM rect folds in the selected-card scale pop
      // (`--selected` transform) AND the real premium-face height, so the
      // reveal never stops a few px short of the bottom row (the «карта не
      // видна полностью, приходится доскроллить правым стиком» defect — the
      // pure `slotH` math missed the pop). Fall back to the plan math only
      // when the row is outside the window (a jump beyond overscan), where no
      // slot element exists yet.
      const name = this.entries[this.index]?.card.name;
      const slot = name !== undefined ?
        grid.querySelector<HTMLElement>(`[data-zoom-slot="${CSS.escape(name)}"]`) : null;
      let relTop: number;
      let relBottom: number;
      if (slot !== null) {
        const sr = slot.getBoundingClientRect();
        const gr = grid.getBoundingClientRect();
        relTop = sr.top - gr.top; // 0 = grid viewport top
        relBottom = sr.bottom - gr.top;
      } else {
        const row = Math.floor(this.index / p.cols);
        relTop = inset + row * p.rowStride - viewTop;
        relBottom = relTop + p.slotH;
      }
      // Leave an edge-inset buffer on the revealed edge so the card's top badge
      // / focus glow clear the shelf edge (and never sit behind the status rail).
      let delta = 0;
      if (relTop - inset < 0) {
        delta = relTop - inset; // reveal the top (scroll up)
      } else if (relBottom + inset > clientH) {
        delta = relBottom + inset - clientH; // reveal the bottom (scroll down)
      }
      if (delta === 0) {
        return;
      }
      const maxScroll = Math.max(0, grid.scrollHeight - clientH);
      const next = clampNum(0, maxScroll, viewTop + delta);
      if (Math.abs(next - viewTop) > 0.5) {
        grid.scrollTop = next; // fires @scroll → applyScroll re-windows
      }
    },
    // ── the dock ↔ overlay reveal transition (handRevealDirector) ─────────
    /**
     * Every hand card's OVERLAY home, in entries order: the real card rect
     * for rendered slots, a PLAN-derived rect for slots beyond the virtual
     * window (grid math is pure — a reference rendered card anchors the
     * row/column strides, so even a 30-card tail has an honest position).
     * `visible` = the rect intersects the grid viewport (off-window proxies
     * fade at the boundary — "into the scroll"); a visible rect that CROSSES
     * the viewport edge also carries `clip` — the screen-px overflow the
     * grid's overflow cuts off the real slot — so the flying proxy can land
     * exactly as clipped (never a whole card that "sinks" at the handoff).
     * One read batch; no writes.
     */
    transitionTargets(): {pairs: Array<{name: CardName, rect: {left: number, top: number, width: number, height: number}, visible: boolean, clip?: {top: number, bottom: number}}>, scrollTop: number} {
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined || this.entries.length === 0) {
        return {pairs: [], scrollTop: 0};
      }
      const gr = grid.getBoundingClientRect();
      // The grid clips its scroll content at its own border box — the honest
      // boundary the real slots render against.
      const clipFor = (rect: {top: number, height: number}): {top: number, bottom: number} | undefined => {
        const top = Math.max(0, gr.top - rect.top);
        const bottom = Math.max(0, rect.top + rect.height - gr.bottom);
        return top > 0.5 || bottom > 0.5 ? {top, bottom} : undefined;
      };
      const p = this.plan;
      // The anchor: the FIRST rendered slot's card (its entries index is
      // known via the render window), backing out the per-card strides.
      const firstRow = this.renderRows[0] ?? 0;
      const refIndex = firstRow * p.cols;
      const refName = this.entries[refIndex]?.card.name;
      const refSlot = refName !== undefined ?
        grid.querySelector<HTMLElement>(`[data-zoom-slot="${CSS.escape(refName)}"]`) : null;
      const refCard = refSlot?.querySelector<HTMLElement>(':is(.card-container, .pcard)');
      const ref = refCard?.getBoundingClientRect();
      // Column stride: measured off two adjacent rendered cards when
      // possible (slot padding/zoom folded in), else plan-derived.
      let colStride = ref !== undefined ? ref.width + p.gapX : 0;
      const secondName = this.entries[refIndex + 1]?.card.name;
      const secondCard = secondName !== undefined && p.cols > 1 ?
        grid.querySelector<HTMLElement>(`[data-zoom-slot="${CSS.escape(secondName)}"] :is(.card-container, .pcard)`) : null;
      if (ref !== undefined && secondCard !== null && secondCard !== undefined) {
        const r2 = secondCard.getBoundingClientRect();
        if (r2.left > ref.left) {
          colStride = r2.left - ref.left;
        }
      }
      const refRow = Math.floor(refIndex / p.cols);
      const refCol = refIndex % p.cols;
      const pairs = this.entries.map((e, i) => {
        const slotCard = grid.querySelector<HTMLElement>(`[data-zoom-slot="${CSS.escape(e.card.name)}"] :is(.card-container, .pcard)`);
        let rect: {left: number, top: number, width: number, height: number};
        if (slotCard !== null) {
          const r = slotCard.getBoundingClientRect();
          rect = {left: r.left, top: r.top, width: r.width, height: r.height};
        } else if (ref !== undefined) {
          const row = Math.floor(i / p.cols);
          const col = i % p.cols;
          rect = {
            left: ref.left + (col - refCol) * colStride,
            top: ref.top + (row - refRow) * p.rowStride,
            width: ref.width,
            height: ref.height,
          };
        } else {
          rect = {left: gr.left + gr.width / 2, top: gr.bottom, width: 60, height: 84};
        }
        const visible = rect.top < gr.bottom - 4 && rect.top + rect.height > gr.top + 4;
        return {name: e.card.name as CardName, rect, visible, clip: visible ? clipFor(rect) : undefined};
      });
      return {pairs, scrollTop: grid.scrollTop};
    },
    /** Re-seat the grid scroll after a mid-close reopen remount — the
     *  returning proxies land on rects measured at THIS scroll. */
    restoreScroll(px: number): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid !== undefined) {
        grid.scrollTop = px;
      }
    },
    measure(): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined) {
        return;
      }
      const w = grid.clientWidth;
      const h = grid.clientHeight;
      if (w !== this.box.w || h !== this.box.h) {
        this.box = {w, h};
        void this.$nextTick(() => {
          this.applyScroll();
          this.ensureSelectedVisible();
        });
      }
    },
    scheduleMeasure(): void {
      if (this.rafMeasure !== undefined) {
        return;
      }
      this.rafMeasure = requestAnimationFrame(() => {
        this.rafMeasure = undefined;
        this.measure();
      });
    },
  },
  mounted() {
    const grid = this.$refs.grid as HTMLElement | undefined;
    if (grid !== undefined && typeof ResizeObserver !== 'undefined') {
      this.ro = markRaw(new ResizeObserver(() => this.scheduleMeasure()));
      this.ro.observe(grid);
    }
    this.measure();
    void this.$nextTick(() => this.ensureSelectedVisible());
  },
  beforeUnmount() {
    // Retract the target HERE, never from the flow side: a stale selector
    // teleports the next surface into a detached node, and the unmount watcher
    // does not fire (Vue tears the component down before its watchers run).
    setWorkspaceFrameSlot('hand', '');
    this.ro?.disconnect();
    if (this.rafScroll !== undefined) {
      cancelAnimationFrame(this.rafScroll);
    }
    if (this.rafMeasure !== undefined) {
      cancelAnimationFrame(this.rafMeasure);
    }
  },
});
</script>
