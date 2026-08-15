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
  <div class="con-hand con-hand--album"
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
        <!-- A colony-bonus discard leads with the demanding PLANET itself —
             the source is a place the player can recognize, not just the
             word «Колония» (the plate replaced the separate source-chip row
             the colonies section used to draw above the grid). -->
        <span v-if="discardPlanetClass !== ''" class="con-hand__discard-planet" :class="discardPlanetClass" aria-hidden="true"></span>
        <span v-else class="con-hand__discard-mark" aria-hidden="true">⌫</span>
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
      <!-- PAGE INDICATOR — the album's one piece of chrome: the visible card
           range, the total, and the page position. Right-aligned in the
           header (margin-left: auto), fixed single line — the header height
           never moves when pages come and go. Arrows light only toward a
           page that exists (the direction language of the edges). -->
      <div v-if="plan.pageCount > 1" class="con-hand__pageind" aria-hidden="true">
        <span class="con-hand__pageind-arrow" :class="{'con-hand__pageind-arrow--on': activePage > 0}">‹</span>
        <span class="con-hand__pageind-range">{{ pageRangeText }}</span>
        <span class="con-hand__pageind-sep">·</span>
        <span class="con-hand__pageind-pages"><b>{{ activePage + 1 }}</b>/{{ plan.pageCount }}</span>
        <span class="con-hand__pageind-arrow" :class="{'con-hand__pageind-arrow--on': activePage < plan.pageCount - 1}">›</span>
      </div>
    </component>

    <!-- ── The STAGE WRAP: the BROWSE layer (album + status rail) and the
         embedded stage occupy the same region. Descending recomposes the frame
         IN PLACE — the browse DOM is only parked, so the selection, the page
         and the filter survive by construction; nothing is unmounted, nothing
         remounts on the way back. ── -->
    <div class="con-hand__stagewrap">
    <div class="con-hand__browse" ref="browseEl" :class="{'con-hand__browse--parked': stageOpen}">
    <!-- Premium hand ALBUM: a strict page of profile-fixed shape (5×2 on the
         couch, 4×1 on the Deck) — never a scrolling canvas. The strip carries
         one page per stride; the viewport clips everything else; the pages
         beyond the edges are the physical PACKETS the reveal transition
         parks there. Only the active page ± its neighbours mount. -->
    <!-- @scroll pin: an `overflow: hidden` box is still PROGRAMMATICALLY
         scrollable, and the mounted neighbour page's transformed bounds are
         scrollable overflow by spec — a stray `scrollIntoView`/`focus()`
         from anywhere in the tree could silently shift the whole strip.
         A scroll event here can only ever be programmatic (wheel is taken,
         there is no scrollbar), so it is always reset. -->
    <div class="con-hand__album" ref="album" @wheel.prevent="onWheel" @scroll.passive="pinScroll">
      <div class="con-hand__pagestrip"
           :class="{'con-hand__pagestrip--live': pageMotionLive && !transitHold, 'con-hand__pagestrip--turning': turning}"
           :style="stripStyle"
           @transitionend.self="onStripSettled">
        <div v-for="p in renderPages"
             :key="'page' + p"
             class="con-hand__page"
             :style="pageStyle(p)">
          <div v-for="(row, ri) in pageRows(p)"
               :key="ri"
               class="con-hand__row"
               :style="rowStyle">
            <div v-for="cell in row"
                 :key="cell.e.card.name"
                 class="con-hand__slot"
                 :data-zoom-slot="cell.e.card.name"
                 :class="{
                   'con-hand__slot--selected': cell.gi === index,
                   'con-hand__slot--playable': !saleActive && !selectActive && cell.e.playable,
                   // DIM only what the RULES refuse. A card whose only blocker
                   // is the turn keeps its bright pose — dimming it says «this
                   // card is wrong», which is false and unlearns itself the
                   // moment the turn comes back.
                   'con-hand__slot--unplayable': !saleActive && !selectActive && !cell.e.potential,
                   'con-hand__slot--notnow': !saleActive && !selectActive && cell.e.potential && !cell.e.playable,
                   'con-hand__slot--sale-picked': saleActive && isSaleSelected(cell.e.card.name),
                   'con-hand__slot--select-picked': selectActive && isSelectPicked(cell.e.card.name),
                   'con-hand__slot--select-disabled': selectActive && !isSelectable(cell.e.card.name),
                   'con-deal-hold': cell.e.card.name === stagedCard,
                 }">
              <Card :card="cell.e.card" :key="cell.e.card.name" lightweight />
              <span v-if="cell.e.robot" class="con-hand__robot" v-i18n>Robots</span>
              <!-- State band: sale pick / select pick (✓), a "can't select"
                   marker on a non-candidate, else a COMPACT play blocker chip
                   (the full reason is in the info panel below). -->
              <span v-if="saleActive && isSaleSelected(cell.e.card.name)" class="con-cards__pickband con-cards__pickband--sale" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
              <span v-else-if="selectActive && isSelectPicked(cell.e.card.name)"
                    class="con-cards__pickband"
                    :class="discard !== undefined ? 'con-cards__pickband--discard' : 'con-cards__pickband--select'"
                    aria-hidden="true">{{ discard !== undefined ? '⌫ ' + $t('Discarded') : '✓ ' + $t('Card selected') }}</span>
              <span v-else-if="selectActive && !isSelectable(cell.e.card.name)" class="con-hand__chip" aria-hidden="true">{{ $t('Unavailable') }}</span>
              <span v-else-if="!saleActive && !selectActive && !cell.e.playable && chipLabel(cell.e)" class="con-hand__chip" aria-hidden="true">{{ $t(chipLabel(cell.e) || '') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- PAGE EDGES — the thin layered hint that neighbouring pages exist
           (never a decorative book, never a peek of real cards). Clickable
           for mouse users; the pad turns pages by walking across the edge
           or flicking the right stick. -->
      <button v-if="activePage > 0"
              type="button" tabindex="-1" aria-hidden="true"
              class="con-hand__pgedge con-hand__pgedge--left"
              @click="turnPage(-1)"></button>
      <button v-if="activePage < plan.pageCount - 1"
              type="button" tabindex="-1" aria-hidden="true"
              class="con-hand__pgedge con-hand__pgedge--right"
              @click="turnPage(1)"></button>

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
           // «НЕ СЕЙЧАС» is its own register: the card is fine, the moment is not.
           'con-hand__verdictbar--notnow': !saleActive && !selectActive && softBlocked,
           'con-hand__verdictbar--blocked': !saleActive && !selectActive && !selectedPlayable && !softBlocked,
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
      <!-- A card with NO server rules-reason but not playable is rules-OK, just
           not your window (opponent's turn / mid-action). That is an EXECUTION
           GATE, not a verdict on the card: it wears the calm «НЕ СЕЙЧАС» state
           and names the moment — never a red «Нельзя разыграть», never a
           misleading "conditions not met". (See
           `src/common/availability/AvailabilityBlocker.ts`.) -->
      <template v-else-if="softBlocked">
        <span class="con-cards__verdict con-cards__verdict--notnow"><span aria-hidden="true">⏳</span> {{ $t('Not now') }}</span>
        <span class="con-hand__reason con-hand__reason--bar con-hand__reason--turn">{{ $t(softReason) }}</span>
      </template>
      <template v-else>
        <span class="con-cards__verdict con-cards__verdict--blocked"><span aria-hidden="true">✕</span> {{ $t('Unplayable now') }}</span>
        <span v-for="(r, i) in reasons.slice(0, 2)" :key="i" class="con-hand__reason con-hand__reason--bar" :class="'con-hand__reason--' + r.type">{{ reasonLine(r) }}</span>
      </template>
      <!-- Filtered count lives HERE (compact, right-aligned) — never in the
           header, so the header height can't jump when the filter changes. -->
      <span v-if="filteredCountText !== ''" class="con-hand__shown">{{ filteredCountText }}</span>
    </div>

    <!-- The gliding selection frame — THE primary focus indicator of card
         navigation (shared with the start scene / draft / reveal). Self-
         resolving: tracks the cursored card inside this section itself,
         following the focus scale transition live. Suppressed while the
         reveal transition owns the cards (the frame would aim at a
         held-invisible slot). -->
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

    <!-- ── THE OUTCOME ZONE — «… › ДОБОР КАРТ», the play's own next stage.
         What the played card PRODUCED (the drawn batch, the buy/keep pick) is
         re-homed HERE, into the workspace the player composed the play in:
         the same shell-mounted ConsoleRevealOverlay / ConsoleDeckPick
         instance, in embedded dress, with the crumb above it simply gaining a
         tail. Without it the batch left for a full-bleed band over the board
         while this workspace dissolved under it — the press and its result in
         two different places.

         An OVERLAY LAYER of the same region, never a sibling of the stage:
         the landing scene («Разыграно») stays on screen underneath until this
         surface actually arrives, so the handoff is one surface taking over
         from another rather than an empty frame in between.

         Rendered from the CLAIM (i.e. from submit time), so the teleport
         target always exists before anyone looks for it. -->
    <div v-if="outcomeZoneOn"
         class="con-hand__outcome"
         data-outcome-zone
         data-embed-slot="hand-outcome"></div>
    </div><!-- /__stagewrap -->
  </div><!-- /__frame -->
  </div>
</template>

<script lang="ts">
/**
 * Console Hand section — the PREMIUM ALBUM (the rework of the vertically-
 * scrolling smart grid). The pure page/layout/navigation math lives in
 * `consoleHandAlbum.ts` (unit-tested); this component owns the DOM concerns:
 * measuring the box (ResizeObserver), rendering the active page ± its
 * neighbours, the page-turn transition (a transform slide of the strip —
 * naturally interruptible, so rapid turns retarget instead of queueing), the
 * page-edge affordances, and the right-stick / wheel page flicks.
 *
 * Selection index lives in the router (`consoleState.handIndex`) and is passed
 * back as the `index` prop for rendering; the section MUTATES it directly from
 * `move()` (mirrors `ConsoleBoardSection.move()`), and the shell just
 * delegates. THE ACTIVE PAGE IS DERIVED FROM THE FOCUS — they can never
 * disagree, so restoring the focus restores the page, and navigation across a
 * page edge IS the page turn.
 *
 * FOCUS IS ANCHORED TO CARD IDENTITY: when the entries re-sort or shrink the
 * cursor follows the card it was on (`focusName`), and only falls back to the
 * nearest logical slot when that card is gone — never to a random first page.
 *
 * A premium HEADER hosts the title + live counts + the console-native tag
 * filter (LB/RB cycle, R3 reset — the shell owns those inputs; the panel is
 * pure state) + the page indicator. PLAYABLE-FIRST sort is applied by the
 * shell; the info panel under the album carries the play state + the SERVER's
 * structured unplayable reasons. Button hints live ONLY in the footer.
 */
import {defineComponent, PropType, markRaw} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import {setWorkspaceFrameSlot, workspaceFrameParked} from '@/client/console/consoleWorkspaceStack';
import {
  releaseWorkspaceOutcome, setWorkspaceOutcomeSlot, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
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
import {shortBlockerLabel, HandNavDir} from '@/client/components/console/consoleHandGrid';
import {
  albumSpecFor, planHandAlbum, pageOfIndex, pageSlotOfIndex, stepHandAlbum, pageJumpIndex,
  packetRect, HandAlbumPlan, PacketSide,
} from '@/client/components/console/consoleHandAlbum';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {ConsoleTagFilterOption, HandTagFilter} from '@/client/components/console/consoleHandFilter';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {saleSummary} from '@/client/console/patentSale/patentSaleModel';
import {DiscardIntent} from '@/client/console/cardDiscard/discardIntent';

export type ConsoleHandEntry = {
  card: CardModel,
  /** Playable RIGHT NOW — the server's live play offer (executable now). */
  playable: boolean,
  /**
   * Playable by the RULES, whoever's turn it is — the server's structured
   * `unplayableReasons` are empty. `playable ⊆ potential`, and the gap between
   * them is exactly the turn/phase gate: such a card is «НЕ СЕЙЧАС», never
   * «Нельзя разыграть», it keeps its bright pose, and it counts on the wheel.
   */
  potential: boolean,
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

/** Fallback box before the first measure / under JSDOM (rects are 0). */
const FALLBACK_W = 1280;
const FALLBACK_H = 560;
/** Right-stick page flick: the axis magnitude that fires a turn, and the
 *  hold-repeat interval (a held stick pages at a controlled cadence — the
 *  CSS slide retargets, so rapid turns never queue). */
const FLICK_THRESHOLD = 0.5;
const FLICK_REPEAT_MS = 280;
/** Mouse wheel: accumulated delta per page turn + the accumulator's decay. */
const WHEEL_STEP = 60;
const WHEEL_DECAY_MS = 260;
/** Safety release of the `--turning` will-change class. */
const TURN_SAFETY_MS = 420;

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

/** One rendered cell: the entry + its flat hand index. */
type AlbumCell = {e: ConsoleHandEntry, gi: number};

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
     * Cards of the hand's UNIVERSE that are outside the current view (tag
     * filter / «only suitable») — they are NOT on any page, but they are
     * physically in the album: the reveal transition parks them with the
     * far-side page packets, so the dock genuinely empties when the hand
     * opens and every card has exactly one home.
     */
    packetExtras: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
    /**
     * The discard cinematic is holding the chosen cards ABOVE this album (they
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
     * a mid-episode patch can't wash the hold off. Also pins the page strip
     * (no slide mid-episode — the flight targets were measured against the
     * current layout).
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
     * footer/dock (z 11711) so the reveal flights pass BEHIND it, never
     * over its text.
     */
    underScene: {type: Boolean, default: false},
    /**
     * THE OPEN DESCENT (undefined = the browse layer owns the screen). Present
     * ⇔ the workspace has been entered one level deeper: the header grows its
     * tail, the album parks, and the stage zone renders as the teleport target
     * for the shell's play composer.
     */
    stage: {type: Object as PropType<ConsoleHandStage | undefined>, default: undefined},
    /**
     * THIS SCREEN IS A STEP OF ANOTHER WORKSPACE (the Game Start Workspace's
     * play-from-hand prelude). The SHELL comes off — the shared header, the
     * frame plate, the `con-ws` rail marker — and the host draws all three;
     * the CONTENT (the album, the filters, the status rail, the playability
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
     * to full strength: it is the picker now, and a parked 7 %-opacity album is
     * one the player cannot choose from.
     */
    stagePaused: {type: Boolean, default: false},
  },
  data() {
    return {
      box: {w: 0, h: 0},
      /** The workspace OUTCOME claim (module reactive — a path watcher needs
       *  the mirror here, or it never fires). */
      outcome: workspaceOutcomeState,
      /** The layout profile (module reactive — the album's page shape). */
      layout: consoleLayoutState,
      /** A page slide is airborne — `will-change` scoped to the turn only. */
      turning: false,
      turnSafety: undefined as number | undefined,
      /** The strip transition arms only after the mount has settled — the
       *  first paint (and every fresh open) must land on its page with no
       *  slide from x=0. */
      pageMotionLive: false,
      /** The page the strip last SETTLED on — the render window keeps both
       *  the settled and the target page mounted, so a mid-slide page never
       *  unmounts under the player (a pop). */
      settledPage: 0,
      /** The IDENTITY the cursor is anchored to — when entries re-sort or
       *  shrink, focus follows the card, not the number. */
      focusName: undefined as string | undefined,
      lastFlickAt: 0,
      wheelAcc: 0,
      wheelAt: 0,
      ro: undefined as ResizeObserver | undefined,
      rafMeasure: undefined as number | undefined,
    };
  },
  computed: {
    /** The workspace has been descended into — the browse layer is parked. */
    stageOpen(): boolean {
      return this.stage !== undefined;
    },
    /**
     * THIS workspace holds the outcome claim of the play it is standing in —
     * its zone is owed (see the template). Read straight off the claim, never
     * off «is something on screen»: the zone has to exist BEFORE the artifact
     * looks for it.
     */
    outcomeZoneOn(): boolean {
      return this.outcome.host === 'hand' && this.outcome.sourceCard !== '';
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
    /**
     * The selected card is blocked ONLY by the execution window — legal by the
     * rules (`potential`), just not submittable this moment (`!playable`). Read
     * from the entry the shell already classified through the shared blocker
     * model, so the info bar and the card's own pose can never disagree.
     */
    softBlocked(): boolean {
      return !this.saleActive && !this.selectActive && this.selected !== undefined &&
        !this.selectedPlayable && this.entries[this.index]?.potential === true;
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
    /** WHO demands it: the source card's name when there is one, the COLONY's
     *  own name for a colony bonus (its planet mini stands beside it), else
     *  the kind («Правило игры») — never a bare unexplained ask. */
    discardSource(): string {
      const intent = this.discard;
      if (intent === undefined) {
        return '';
      }
      if (intent.card !== undefined) {
        return translateText(intent.card);
      }
      if (intent.colonyName !== undefined) {
        return translateText(intent.colonyName);
      }
      return translateText(intent.sourceKey);
    },
    /** The demanding colony's planet art ('' = not a colony discard). */
    discardPlanetClass(): string {
      const name = this.discard?.colonyName;
      return name === undefined || name === '' ? '' : name.replace(' ', '-') + '-background';
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
    /** «Можно разыграть: N» — POTENTIAL, the same number the wheel shows: a
     *  count that halves because an opponent started thinking is not a fact
     *  about the hand. (The press itself still needs `playable`.) */
    playableCount(): number {
      return this.entries.reduce((n, e) => n + (e.potential ? 1 : 0), 0);
    },
    /** The header shows the plain total ONLY when there are no filter chips to
     *  carry it (the "All" chip shows it otherwise). It NEVER shows "Показано X
     *  из Y" — that would widen the header on a filter toggle and wrap the chips
     *  to a second row (the header must stay a stable height); that count lives
     *  compactly in the bottom info bar instead (`filteredCountText`).
     *  In SELECT mode the number gets its label — a bare «37» beside the ask
     *  plate read as an unexplained figure. */
    countText(): string {
      if (this.showFilters) {
        return '';
      }
      return this.selectActive ?
        translateTextWithParams('Total cards: ${0}', [String(this.totalCount)]) :
        String(this.totalCount);
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
    /**
     * THE ALBUM PLAN — page shape from the PROFILE, card size from the BOX.
     * Never from the hand size: one card and a full page are the same
     * geometry, and a growing hand only ever adds pages.
     */
    plan(): HandAlbumPlan {
      return planHandAlbum({
        availW: this.box.w > 0 ? this.box.w : FALLBACK_W,
        availH: this.box.h > 0 ? this.box.h : FALLBACK_H,
        count: this.entries.length,
        spec: albumSpecFor(this.layout.profile),
        uiScale: conUiScale(),
      });
    },
    /** The page the cursor lives on — the album's viewport, BY DERIVATION.
     *  Focus and page can never disagree; restoring one restores the other. */
    activePage(): number {
      const clamped = clampNum(0, Math.max(0, this.entries.length - 1), this.index);
      return Math.min(this.plan.pageCount - 1, pageOfIndex(clamped, this.plan.perPage));
    },
    /** Pages kept mounted: the active page ± 1, plus the last SETTLED page's
     *  neighbourhood — a page mid-slide never unmounts under the player. */
    renderPages(): Array<number> {
      if (this.entries.length === 0) {
        return [];
      }
      const last = this.plan.pageCount - 1;
      const keep = new Set<number>();
      for (const centre of [this.activePage, Math.min(last, this.settledPage)]) {
        for (let p = Math.max(0, centre - 1); p <= Math.min(last, centre + 1); p++) {
          keep.add(p);
        }
      }
      return [...keep].sort((a, b) => a - b);
    },
    rootStyle(): Record<string, string> {
      return {'--con-hand-zoom': String(this.plan.cardZoom)};
    },
    /** The strip slides one stride per page — transform only (interruptible,
     *  retargetable, zero layout, zero scroll geometry). */
    stripStyle(): Record<string, string> {
      return {transform: `translateX(${-this.activePage * this.plan.stride}px)`};
    },
    rowStyle(): Record<string, string> {
      return {height: this.plan.slotH + 'px', columnGap: this.plan.gapX + 'px'};
    },
    /** «1–10 из 19» — the active page's card range over the visible total. */
    pageRangeText(): string {
      const start = this.activePage * this.plan.perPage;
      const end = Math.min(this.entries.length, start + this.plan.perPage);
      return translateTextWithParams('${0} of ${1}', [`${start + 1}–${end}`, String(this.entries.length)]);
    },
    /** The cursor SEMANTICS epoch — a mode flip (browse ↔ sale ↔ select/pick)
     *  re-seats the cursor on the shell's side, so the identity anchor must
     *  adopt the new position even when the index number did not change. */
    modeKey(): string {
      return `${this.saleActive}|${this.selectActive}`;
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
    /** The OUTCOME zone, same law and same reason (POST-flush: the shell is our
     *  parent and resolves the teleport before we have rendered the node). */
    outcomeZoneOn: {
      immediate: true,
      flush: 'post',
      handler(on: boolean) {
        if (on) {
          setWorkspaceOutcomeSlot('[data-embed-slot="hand-outcome"]');
        } else if (this.outcome.embedSlot === '[data-embed-slot="hand-outcome"]') {
          // Only OUR selector: the claim may already have moved to another host.
          setWorkspaceOutcomeSlot('');
        }
      },
    },
    /* ── FOCUS IDENTITY + PAGE DERIVATION ─────────────────────────────────
       Declared in this order ON PURPOSE — watchers fire in declaration order
       within one flush, so an explicit index write (the shell seating a pick)
       refreshes the anchor BEFORE the entries watcher could «follow» a card
       the player is no longer on. */
    index() {
      this.focusName = this.entries[clampNum(0, Math.max(0, this.entries.length - 1), this.index)]?.card.name;
    },
    /** A MODE flip re-seats the cursor semantics (select/sale enter and leave
     *  set their own index) — adopt the current position as the new anchor
     *  even when the number itself did not change. */
    modeKey() {
      this.focusName = this.entries[clampNum(0, Math.max(0, this.entries.length - 1), this.index)]?.card.name;
    },
    /**
     * FOCUS FOLLOWS THE CARD, NOT THE NUMBER. When the entries re-sort (a card
     * became unplayable and sank in the playable-first order) or shrink, the
     * cursor stays on the card it was on; only when that card is GONE does it
     * fall back to the nearest logical slot (same index, clamped) — never to a
     * random first page. The active page follows by derivation.
     */
    entries(list: ReadonlyArray<ConsoleHandEntry>) {
      const len = list.length;
      if (len === 0) {
        if (consoleState.handIndex !== 0) {
          consoleState.handIndex = 0;
        }
        this.focusName = undefined;
        return;
      }
      const cur = clampNum(0, len - 1, this.index);
      const curName = list[cur]?.card.name;
      if (this.focusName !== undefined && curName !== this.focusName) {
        const at = list.findIndex((e) => e.card.name === this.focusName);
        if (at >= 0) {
          consoleState.handIndex = at;
          return;
        }
      }
      if (this.index > len - 1) {
        consoleState.handIndex = len - 1;
      }
      this.focusName = list[clampNum(0, len - 1, consoleState.handIndex)]?.card.name;
    },
    /** The page turn's will-change window + the settled-page render anchor. */
    activePage(now: number) {
      if (!this.pageMotionLive || this.transitHold) {
        this.settledPage = now;
        return;
      }
      this.turning = true;
      if (this.turnSafety !== undefined) {
        clearTimeout(this.turnSafety);
      }
      this.turnSafety = window.setTimeout(() => {
        this.turning = false;
        this.settledPage = this.activePage;
        this.turnSafety = undefined;
      }, TURN_SAFETY_MS);
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
    /** The rows of one page, each cell carrying its FLAT hand index. */
    pageRows(page: number): Array<Array<AlbumCell>> {
      const p = this.plan;
      const start = page * p.perPage;
      const slice = this.entries.slice(start, start + p.perPage);
      const rows: Array<Array<AlbumCell>> = [];
      for (let r = 0; r * p.cols < slice.length; r++) {
        rows.push(slice.slice(r * p.cols, (r + 1) * p.cols).map((e, ci) => ({e, gi: start + r * p.cols + ci})));
      }
      return rows;
    },
    /** One page's berth on the strip: its stride slot + the centring pads. */
    pageStyle(page: number): Record<string, string> {
      const p = this.plan;
      return {
        transform: `translate(${page * p.stride + p.padX}px, ${p.padTop}px)`,
        width: p.pageW + 'px',
        rowGap: p.gapY + 'px',
      };
    },
    onStripSettled(e: TransitionEvent): void {
      if (e.propertyName !== 'transform') {
        return;
      }
      this.turning = false;
      this.settledPage = this.activePage;
      if (this.turnSafety !== undefined) {
        clearTimeout(this.turnSafety);
        this.turnSafety = undefined;
      }
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
    /**
     * D-pad / left-stick: deterministic album stepping. Horizontal walks the
     * flat hand order — crossing a page edge IS the page turn (the strip
     * follows the derived active page); vertical moves by a row within the
     * page, column preserved. Nothing wraps; every edge is felt.
     */
    move(dir: HandNavDir): void {
      consoleState.handIndex = stepHandAlbum(this.index, dir, this.entries.length, this.plan);
    },
    /** The explicit page turn (edge click / stick flick / wheel): same
     *  relative slot on the neighbouring page. */
    turnPage(dir: 1 | -1): void {
      if (this.transitHold) {
        return;
      }
      consoleState.handIndex = pageJumpIndex(this.index, dir, this.entries.length, this.plan.perPage);
    },
    /**
     * Right stick — the PAGE FLICK (replaces the old free vertical scroll):
     * a firm push turns one page toward the push; holding it pages at a
     * controlled cadence. The CSS slide retargets mid-flight, so rapid
     * flicks redirect the same motion instead of queueing five animations.
     */
    stickScroll(dy: number, dx = 0): void {
      const v = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      if (Math.abs(v) < FLICK_THRESHOLD) {
        return;
      }
      const now = Date.now();
      if (now - this.lastFlickAt < FLICK_REPEAT_MS) {
        return;
      }
      this.lastFlickAt = now;
      this.turnPage(v > 0 ? 1 : -1);
    },
    /** A scroll on the album is always programmatic (see the template note) —
     *  pin it back so a stray `scrollIntoView` can never shift the strip. */
    pinScroll(): void {
      const album = this.$refs.album as HTMLElement | undefined;
      if (album !== undefined && (album.scrollLeft !== 0 || album.scrollTop !== 0)) {
        album.scrollLeft = 0;
        album.scrollTop = 0;
      }
    },
    /** Mouse wheel: accumulate into one page turn per firm notch group. */
    onWheel(e: WheelEvent): void {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = Date.now();
      if (now - this.wheelAt > WHEEL_DECAY_MS) {
        this.wheelAcc = 0;
      }
      this.wheelAt = now;
      this.wheelAcc += d;
      if (Math.abs(this.wheelAcc) >= WHEEL_STEP) {
        this.turnPage(this.wheelAcc > 0 ? 1 : -1);
        this.wheelAcc = 0;
      }
    },
    /** The album derives its viewport from the focus — nothing to scroll.
     *  Kept (as a no-op) because the filter episode's measure path and the
     *  shell's refocus call it; the page follows `handIndex` reactively. */
    ensureSelectedVisible(): void {
      // Intentionally empty: activePage is derived from the focus index.
    },
    /** Scroll restoration is gone with the scroll itself — the page derives
     *  from the restored focus index. Kept for the director's hook shape. */
    restoreScroll(_px: number): void {
      // Intentionally empty.
    },
    // ── the dock ↔ album reveal transition (handRevealDirector) ───────────
    /**
     * Every hand card's ALBUM home, in entries order + the out-of-view
     * UNIVERSE extras:
     *  - active-page cards → their real slot rects (`visible: true`);
     *  - cards of other pages → their page PACKET anchor beyond the stage
     *    edge (left for earlier pages, right for later — `visible: false`,
     *    the proxies dissolve at the boundary while flying toward it);
     *  - `packetExtras` (outside the current filter) → the far right packet.
     * One read batch; no writes; no clipping (a page never crosses the
     * viewport edge — partially visible rows are gone with the scroll).
     */
    transitionTargets(): {pairs: Array<{name: CardName, rect: {left: number, top: number, width: number, height: number}, visible: boolean, clip?: {top: number, bottom: number, left?: number, right?: number}}>, scrollTop: number} {
      const album = this.$refs.album as HTMLElement | undefined;
      if (album === undefined || (this.entries.length === 0 && this.packetExtras.length === 0)) {
        return {pairs: [], scrollTop: 0};
      }
      const box = album.getBoundingClientRect();
      const p = this.plan;
      const s = conUiScale();
      const active = this.activePage;
      const packetOf = (side: PacketSide, depth: number, seq: number) =>
        packetRect(side, depth, seq, {left: box.left, top: box.top, width: box.width, height: box.height}, p.slotW, p.slotH, s);
      // A packet-bound card WIPES behind the stage edge (a side clip in the
      // director's language) instead of sliding whole over the HUD beside
      // the album — the leading side of the card hides first.
      const packetClip = (side: PacketSide) =>
        side === 'left' ? {top: 0, bottom: 0, left: p.slotW} : {top: 0, bottom: 0, right: p.slotW};
      const pairs = this.entries.map((e, i) => {
        const page = pageOfIndex(i, p.perPage);
        if (page !== active) {
          const side: PacketSide = page < active ? 'left' : 'right';
          return {name: e.card.name as CardName, rect: packetOf(side, Math.abs(page - active), pageSlotOfIndex(i, p.perPage)), visible: false, clip: packetClip(side)};
        }
        const slotCard = album.querySelector<HTMLElement>(`[data-zoom-slot="${CSS.escape(e.card.name)}"] :is(.card-container, .pcard)`);
        if (slotCard !== null) {
          const r = slotCard.getBoundingClientRect();
          return {name: e.card.name as CardName, rect: {left: r.left, top: r.top, width: r.width, height: r.height}, visible: true};
        }
        // Plan-derived fallback (pre-paint measure): mirror the rendered
        // geometry — the page block at its pads, rows individually centred.
        const slot = pageSlotOfIndex(i, p.perPage);
        const row = Math.floor(slot / p.cols);
        const col = slot % p.cols;
        const pageStart = page * p.perPage;
        const inRow = Math.min(p.cols, this.entries.length - (pageStart + row * p.cols));
        const rowW = inRow * p.slotW + (inRow - 1) * p.gapX;
        const rect = {
          left: box.left + p.padX + (p.pageW - rowW) / 2 + col * (p.slotW + p.gapX),
          top: box.top + p.padTop + row * (p.slotH + p.gapY),
          width: p.slotW,
          height: p.slotH,
        };
        return {name: e.card.name as CardName, rect, visible: true};
      });
      // The out-of-view universe (tag-filtered / non-suitable): parked past
      // the LAST page's packets on the right — physically in the album, so
      // the dock genuinely empties and the close gathers every card home.
      const farDepth = Math.max(1, p.pageCount - active);
      this.packetExtras.forEach((name, k) => {
        pairs.push({name: name as CardName, rect: packetOf('right', farDepth + 1, k % p.perPage), visible: false, clip: packetClip('right')});
      });
      return {pairs, scrollTop: 0};
    },
    /**
     * Packet flight anchors for a set of names (the filter episode's leaver
     * landings / enterer origins): cards leaving the current view gather into
     * the right-edge packet; cards entering it fan out of the same place.
     */
    packetHomeRects(names: ReadonlyArray<string>, side: PacketSide = 'right'): Map<string, {left: number, top: number, width: number, height: number}> {
      const out = new Map<string, {left: number, top: number, width: number, height: number}>();
      const album = this.$refs.album as HTMLElement | undefined;
      if (album === undefined) {
        return out;
      }
      const box = album.getBoundingClientRect();
      const p = this.plan;
      const s = conUiScale();
      names.forEach((name, k) => {
        out.set(name, packetRect(side, 1, k % p.perPage, {left: box.left, top: box.top, width: box.width, height: box.height}, p.slotW, p.slotH, s));
      });
      return out;
    },
    measure(): void {
      const album = this.$refs.album as HTMLElement | undefined;
      if (album === undefined) {
        return;
      }
      const w = album.clientWidth;
      const h = album.clientHeight;
      if (w !== this.box.w || h !== this.box.h) {
        this.box = {w, h};
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
    const album = this.$refs.album as HTMLElement | undefined;
    if (album !== undefined && typeof ResizeObserver !== 'undefined') {
      this.ro = markRaw(new ResizeObserver(() => this.scheduleMeasure()));
      this.ro.observe(album);
    }
    this.measure();
    this.focusName = this.entries[clampNum(0, Math.max(0, this.entries.length - 1), this.index)]?.card.name;
    this.settledPage = this.activePage;
    // Arm the page-slide transition only after the first paint has settled:
    // a fresh open (possibly restored onto page 3) must LAND on its page,
    // never slide to it from x = 0.
    void this.$nextTick(() => {
      requestAnimationFrame(() => {
        this.pageMotionLive = true;
      });
    });
  },
  beforeUnmount() {
    // Retract the target HERE, never from the flow side: a stale selector
    // teleports the next surface into a detached node, and the unmount watcher
    // does not fire (Vue tears the component down before its watchers run).
    setWorkspaceFrameSlot('hand', '');
    // A CLAIM CAN NEVER OUTLIVE ITS FLOW: an orphaned one is worse than a leak
    // (it suppresses the standalone presenters, so the artifact shows NOWHERE).
    // …unless the workspace was PARKED — «свернуть» keeps the whole decision
    // alive at full depth, and its surface unmounting is exactly how that
    // looks. (The raw claim is read here, not the gated computed: the park
    // happens BEFORE this hook and would already have flipped it false.)
    if (this.outcome.host === 'hand' && this.outcome.sourceCard !== '' &&
        !workspaceFrameParked('hand')) {
      releaseWorkspaceOutcome('hand-unmount');
    }
    this.ro?.disconnect();
    if (this.rafMeasure !== undefined) {
      cancelAnimationFrame(this.rafMeasure);
    }
    if (this.turnSafety !== undefined) {
      clearTimeout(this.turnSafety);
    }
  },
});
</script>
