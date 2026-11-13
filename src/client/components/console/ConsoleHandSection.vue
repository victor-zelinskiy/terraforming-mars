<template>
  <div ref="root" class="con-hand con-hand--album"
       :class="{'con-ws': !embedded, 'con-hand--embedded': embedded, 'con-hand--transit': transitHold, 'con-hand--chrome-wait': chromeWait, 'con-hand--frame-wait': frameWait, 'con-hand--under-scene': underScene, 'con-hand--discard': discard !== undefined, 'con-hand--discarding': discarding, 'con-hand--staged': stageOpen, 'con-hand--stagepaused': stagePaused}"
       :data-flow="stageOpen ? (stagePaused ? 'picking' : 'configure') : 'browse'"
       :data-cursor-pending="cursorPending ? '' : undefined"
       :data-hand-arrives="arrivesByFlight ? 'flight' : undefined"
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
    <component :is="embedded ? 'div' : ConsoleWsHead"
               :class="embedded ? ['con-hand__toolbar', {'con-hand__toolbar--held': stageOpen}] : 'con-hand__head'"
               v-bind="embedded ? {} : {
                 root: 'Cards in hand',
                 emblem: 'cards',
                 subject: stage !== undefined ? stage.subject : '',
                 stage: stage !== undefined ? stage.name : '',
                 stageRaw: stage !== undefined && stage.raw === true,
                 committed: stage !== undefined && stage.committed,
               }">
      <div class="con-hand__head-left">
        <span v-if="countText !== ''" class="con-hand__count">{{ countText }}</span>
        <!-- Not in the SALE (PL-208): the screen is asking which cards to sell, and «Можно разыграть: 4» beside the sale's
             own summary read as a second, unrelated count — every other playability mark already stands aside there. -->
        <span v-if="!selectActive && !saleActive && playableCount > 0" class="con-hand__playable">{{ $t('Playable now') }}: <b>{{ playableCount }}</b></span>
        <!-- «ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ» (TR49 class): what the NEXT card played will spend, where that card is chosen.
             Nothing when nothing is armed — and it reserves nothing: the head keeps its one line, the formula yields. -->
        <ConsoleArmedEffectsStrip v-if="!selectActive && !saleActive" class="con-hand__armed" :effects="armedEffects" variant="strip" />
      </div>
      <!-- THE FILTER ROW — in EVERY album mode (P50's polish companion · ledger FD): the browse hand cycles it on LT/RT
           (R3 resets); a PICKER (a discard, a sale, a composer's pick) keeps its OWN chip (`selectTagFilter`), and the
           row is a FOCUSABLE LINE everywhere — ▲ from the top row of cards enters it, ◀▶ walk the chips, A applies, ▼ / B
           back to the cards (the triggers and R3 keep their select verbs). A per-tag exchange (the Reds) adds «ПЛАТЯТ»
           — the cards that pay. The active chip is the always-visible source of truth for the filter. -->
      <div v-if="showFilters" class="con-hand__filters" role="group" :aria-label="$t('Tag filter')" data-hand-filters
           :data-hand-filters-focused="filterFocus >= 0 ? '' : undefined">
        <div v-for="(opt, oi) in tagFilters"
             :key="opt.value"
             class="con-hand__filter"
             :class="{'con-hand__filter--active': opt.value === activeTag, 'con-hand__filter--empty': opt.count === 0 && opt.value !== activeTag,
                      'con-hand__filter--focused': filterFocus === oi, 'con-hand__filter--pays': opt.value === 'pays'}"
             :data-hand-filter="opt.value" :data-hand-filter-count="opt.count"
             :data-hand-filter-active="opt.value === activeTag ? '' : undefined">
          <span v-if="opt.value === 'all'" class="con-hand__filter-label" v-i18n>All</span>
          <template v-else-if="opt.value === 'pays'">
            <i :class="payIconClass" class="con-hand__filter-pay" aria-hidden="true"></i>
            <span class="con-hand__filter-label">{{ $t('Pays') }}</span>
          </template>
          <span v-else class="con-hand__filter-icon" :class="'tag-' + opt.value" aria-hidden="true"></span>
          <span class="con-hand__filter-count">{{ opt.count }}</span>
        </div>
      </div>
      <!-- SALE mode: the live financial summary of the current pick — how
           many cards are chosen, the M€ they pay out, what the TABLE answers
           (TR46: «+4 [data] Исследовательские стартапы», then Martian Fiber's
           «+4 M€» — the server's rate × the pick, never a client number), and
           the before → after wallet (the answers' M€ included). Amber (the
           sale accent); at zero picks the gains read dim and each answer
           states its rate «per card», so the mechanics read before the first
           selection. -->
      <div v-if="saleActive" class="con-hand__salebar" role="status" :aria-label="$t('Patent sale')">
        <span class="con-hand__salebar-item">
          <span class="con-hand__salebar-label">{{ $t('Selected') }}:</span>
          <b class="con-hand__salebar-num">{{ sale.count }}</b>
        </span>
        <span class="con-hand__salebar-item con-hand__salebar-item--gain" :class="{'con-hand__salebar-item--zero': sale.count === 0}">
          <b class="con-hand__salebar-num">+{{ sale.payout }}</b>
          <i class="resource_icon resource_icon--megacredits con-hand__salebar-mc" aria-hidden="true"></i>
        </span>
        <span v-for="a in saleAnswers"
              :key="a.key"
              class="con-hand__salebar-item con-hand__salebar-item--answer"
              :class="{'con-hand__salebar-item--zero': sale.count === 0}"
              :data-sale-answer="a.source">
          <span class="con-hand__salebar-spark" aria-hidden="true">⚡</span>
          <template v-if="a.icon !== ''">
            <b class="con-hand__salebar-num">+{{ a.shown }}</b>
            <i :class="answerIconClass(a.icon)" class="con-hand__salebar-mc" aria-hidden="true"></i>
          </template>
          <span class="con-hand__salebar-source">{{ $t(a.source) }}</span>
          <span v-if="sale.count === 0 && a.icon !== ''" class="con-hand__salebar-rate">{{ $t('per card') }}</span>
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
        <!-- THE SEALED BONUS THIS DISCARD OPENS (colony polish 1): the next settlement's card lies on the table
             under its seal; the plate carries that same lock, so the choice reads as what it buys. -->
        <span v-if="discardSealNext > 0" class="con-hand__discard-seal" data-hand-seal :data-hand-seal-place="discardSealNext">
          <span class="con-hand__discard-sealcard" aria-hidden="true">
            <span class="con-card-back"></span>
            <svg class="con-hand__discard-seallock" viewBox="0 0 24 24">
              <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" /><rect x="5" y="10.5" width="14" height="10" rx="2.2" />
            </svg>
          </span>
          <span class="con-hand__discard-sealtext">{{ discardSealText }}</span>
        </span>
        <span v-if="discard.exchange !== undefined && selectPayout === undefined" class="con-hand__discard-swap">
          <b class="con-hand__discard-out">−{{ Math.max(1, discard.picked) }}</b>
          <i class="resource_icon resource_icon--cards con-hand__discard-icon" aria-hidden="true"></i>
          <span class="con-hand__discard-arrow" aria-hidden="true">→</span>
          <b class="con-hand__discard-in" :class="{'con-hand__discard-in--zero': discard.exchange.amount === 0}">+{{ discard.exchange.amount }}</b>
          <i :class="discardExchangeIconClass" class="con-hand__discard-icon" aria-hidden="true"></i>
          <!-- The SECOND payout in cards (a card back per card thrown) — beside the first, its own icon. -->
          <template v-if="discard.exchange.draw !== undefined">
            <span class="con-hand__discard-sep" aria-hidden="true">·</span>
            <b class="con-hand__discard-in" :class="{'con-hand__discard-in--zero': discard.exchange.draw === 0}" data-hand-discard-draw>+{{ discard.exchange.draw }}</b>
            <i class="resource_icon resource_icon--cards con-hand__discard-icon" aria-hidden="true"></i>
          </template>
        </span>
        <!-- THE HONESTY COUNT (FD): the picker's chip hides candidates — said, never a silent cut. -->
        <span v-if="hiddenByFilter > 0" class="con-hand__discard-hidden" data-hand-hidden-by-filter>{{ hiddenText }}</span>
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
        <!-- The SECOND payout, in cards (Open IP Trade: a card back per card
             discarded) — the same running arithmetic, its own icon. -->
        <span v-if="pickCardGain > 0 || (selectPayout.cards ?? 0) > 0" class="con-hand__salebar-item con-hand__salebar-item--gain" :class="{'con-hand__salebar-item--zero': pickCount === 0}" data-hand-sale-cards>
          <b class="con-hand__salebar-num">+{{ pickCardGain }}</b>
          <i class="resource_icon resource_icon--cards con-hand__salebar-mc" aria-hidden="true"></i>
        </span>
        <span v-if="selectPayout.current !== undefined" class="con-hand__salebar-item con-hand__salebar-item--total" :class="{'con-hand__salebar-item--zero': pickCount === 0}">
          <i :class="payoutIconClass" class="con-hand__salebar-mc" aria-hidden="true"></i>
          <b class="con-hand__salebar-num">{{ selectPayout.current }}</b>
          <span class="con-hand__salebar-arrow" aria-hidden="true">→</span>
          <b class="con-hand__salebar-num con-hand__salebar-num--after">{{ selectPayout.current + pickGain }}</b>
        </span>
      </div>
      <!-- (The page position lives in ONE place — the ALBUM SPINE in the
           footer bay (ConsoleHandDock `album` prop), beside the LB/RB verbs
           that drive it. A second pager up here would split the navigation
           from its own controls and hand the header a competing corner.) -->
      <!-- THE FLEET BERTH (a hosted COLONIES step — TR07's staged colony): the colony screen's fleet dock lands
           where «Колонии» always puts it, the header's reserved right edge — never a toolbar row inside the zone,
           which would steal height from the grid whose fit is height-bound. Only the root header lends it (an
           embedded hand has no header of its own). -->
      <template v-if="!embedded" #trailing>
        <span v-if="colonyStepHosted" class="con-hand__fleetberth" data-colony-fleet-berth></span>
      </template>
    </component>

    <!-- ── The STAGE WRAP: the BROWSE layer (album + status rail) and the
         embedded stage occupy the same region. Descending recomposes the frame
         IN PLACE — the browse DOM is only parked, so the selection, the page
         and the filter survive by construction; nothing is unmounted, nothing
         remounts on the way back. ── -->
    <div class="con-hand__stagewrap">
    <div class="con-hand__browse" ref="browseEl" :class="{'con-hand__browse--parked': stageOpen}">
    <!-- THE QUESTION LINE — what this pick is asked for, ABOVE the cards it is answered with (2026-10-13). Past the
         descent the header's own discard block is under the deep crumb, so the ask moves here: the discard mark, the
         ask, its source and what it buys; and an OPTIONAL pick carries its DECLINE plate — the button (RT) repeated
         where the eye already is, never a row among the cards, never B. In-flow: the album below solves its cards from
         the room it leaves. -->
    <div v-if="questionShown" class="con-hand__question" data-pick-question>
      <div v-if="questionAskShown && discard !== undefined" class="con-hand__question-ask">
        <span v-if="discardPlanetClass !== ''" class="con-hand__discard-planet" :class="discardPlanetClass" aria-hidden="true"></span>
        <span v-else class="con-hand__discard-mark" aria-hidden="true">⌫</span>
        <span class="con-hand__question-text">{{ discardAsk }}</span>
        <span class="con-hand__discard-sep" aria-hidden="true">·</span>
        <span class="con-hand__question-src">{{ discardSource }}</span>
        <span v-if="discard.exchange !== undefined" class="con-hand__discard-swap">
          <b class="con-hand__discard-out">−{{ Math.max(1, discard.picked) }}</b>
          <i class="resource_icon resource_icon--cards con-hand__discard-icon" aria-hidden="true"></i>
          <span class="con-hand__discard-arrow" aria-hidden="true">→</span>
          <b class="con-hand__discard-in" :class="{'con-hand__discard-in--zero': discard.exchange.amount === 0}">+{{ discard.exchange.amount }}</b>
          <i :class="discardExchangeIconClass" class="con-hand__discard-icon" aria-hidden="true"></i>
          <!-- The SECOND payout in cards (a card back per card thrown) — beside the first, its own icon. -->
          <template v-if="discard.exchange.draw !== undefined">
            <span class="con-hand__discard-sep" aria-hidden="true">·</span>
            <b class="con-hand__discard-in" :class="{'con-hand__discard-in--zero': discard.exchange.draw === 0}" data-hand-discard-draw>+{{ discard.exchange.draw }}</b>
            <i class="resource_icon resource_icon--cards con-hand__discard-icon" aria-hidden="true"></i>
          </template>
        </span>
      </div>
      <!-- The question line's BUTTONS, right-aligned together: «decide after the draw» (R3) of a question that may wait
           for a draw, then the decline (RT). -->
      <span v-if="pickDefer !== undefined || pickDecline !== undefined" class="con-hand__question-plates">
        <ConsoleDeferPlate v-if="pickDefer !== undefined" class="con-hand__question-defer" :defer="pickDefer" />
        <ConsoleDeclinePlate v-if="pickDecline !== undefined" class="con-hand__question-decline"
                             :label="pickDecline.label" :forgone="pickDecline.forgone" />
      </span>
    </div>
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
               :style="pageRowStyle(p)">
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
              <Card :card="cell.e.card" :key="cell.e.card.name" :art-tier="handArtTier" lightweight />
              <span v-if="cell.e.robot" class="con-hand__robot" v-i18n>Robots</span>
              <!-- WHAT THIS CARD PAYS IF THROWN (FD — a per-tag exchange, the Reds): its own «+N [M€]» on a kant, «+0» muted
                   and never hidden — the count the «ПЛАТЯТ» chip reads. -->
              <span v-if="cardPayouts[cell.e.card.name] !== undefined" class="con-hand__payplate"
                    :class="{'con-hand__payplate--zero': cardPayouts[cell.e.card.name] === 0}"
                    :data-hand-card-pays="cardPayouts[cell.e.card.name]" aria-hidden="true">
                <b>+{{ cardPayouts[cell.e.card.name] }}</b><i :class="payIconClass" class="con-hand__payplate-icon"></i>
              </span>
              <!-- State band: sale pick / select pick (✓), a "can't select"
                   marker on a non-candidate, else a COMPACT play blocker chip
                   (the full reason is in the info panel below). -->
              <span v-if="saleActive && isSaleSelected(cell.e.card.name)" class="con-cards__pickband con-cards__pickband--sale" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
              <span v-else-if="selectActive && isSelectPicked(cell.e.card.name)"
                    class="con-cards__pickband"
                    :class="discard !== undefined ? 'con-cards__pickband--discard' : 'con-cards__pickband--select'"
                    aria-hidden="true">{{ discard !== undefined ? '⌫ ' + $t('Discarded') : '✓ ' + $t('Card selected') }}</span>
              <span v-else-if="selectActive && !isSelectable(cell.e.card.name)" class="con-hand__chip" aria-hidden="true">{{ $t('Unavailable') }}</span>
              <span v-else-if="selectActive && isBonusFresh(cell.e.card.name)" class="con-hand__fresh" data-hand-fresh aria-hidden="true">{{ freshBonusText }}</span>
              <span v-else-if="selectActive && isDrawFresh(cell.e.card.name)" class="con-hand__fresh" data-hand-fresh="draw" aria-hidden="true">{{ $t('New card') }}</span>
              <!-- A NAMED reason (a party, the chairman) says what the verdict bar says — the emblem and «0/2» (PL-479). -->
              <span v-else-if="!saleActive && !selectActive && !cell.e.playable && chipLabel(cell.e)" class="con-hand__chip"
                    :class="{'con-hand__chip--emblem': chipEmblem(cell.e) !== undefined}" aria-hidden="true">
                <template v-if="chipEmblem(cell.e) !== undefined">
                  <img class="con-hand__chip-emblem" :src="chipEmblem(cell.e)!.emblem" alt="" />{{ chipEmblem(cell.e)!.text }}
                </template>
                <template v-else>{{ $t(chipLabel(cell.e) || '') }}</template>
              </span>
              <!-- THE FORECAST PLATE — one grammar, two readers (`countedPlay.handForecastPlate`): a card that
                   advances the Agenda marker says HOW FAR (К-H1, TR42 — «[★] 2», `CardModel.agendaWalk`), a play
                   COUNTED off the table says HOW MANY (the owner's decision 2026-10-12, TR45 — «[microbe] +14», the
                   play preview's own chips `CardModel.countedPlay`). The server's number before the composer opens.
                   Quiet, never a blocker: no red, the art's lower edge, a zero muted and never hidden. Rules-playable
                   only — a refusal speaks first. -->
              <span v-else-if="!saleActive && !selectActive && cell.e.potential && (forecastPlates.has(cell.e.card.name) || tenderPlates.has(cell.e.card.name) || easingPlates.has(cell.e.card.name))"
                    class="con-hand__plate"
                    :class="[forecastPlates.has(cell.e.card.name) ? 'con-hand__plate--' + forecastPlates.get(cell.e.card.name)?.kind : tenderPlates.has(cell.e.card.name) ? 'con-hand__plate--pay' : 'con-hand__plate--ease', {'con-hand__plate--zero': forecastPlates.get(cell.e.card.name)?.zero && !tenderPlates.has(cell.e.card.name) && !easingPlates.has(cell.e.card.name)}]"
                    :data-hand-pay="tenderHook(cell.e.card.name)"
                    :data-hand-walk="forecastPlates.get(cell.e.card.name)?.kind === 'walk' ? forecastPlates.get(cell.e.card.name)?.value : undefined"
                    :data-hand-count="forecastPlates.get(cell.e.card.name)?.kind === 'count' ? forecastPlates.get(cell.e.card.name)?.value : undefined"
                    :data-hand-ease="easingHook(cell.e.card.name)"
                    :data-hand-veto="forecastPlates.get(cell.e.card.name)?.veto"
                    aria-hidden="true">
                <!-- THE REQUIREMENT UNDER AN EFFECT (TR49 class) — the plate's FIRST reader, the precondition before what
                     the play gives: «[t°] ±2» (shifted) · the scale struck (ignored) · a check when the card is playable
                     ONLY thanks to it. The server's reading (`CardModel.requirementEasing`) — nothing compared here. -->
                <template v-if="easingPlates.has(cell.e.card.name)">
                  <span v-for="(item, k) in easingPlates.get(cell.e.card.name)?.items ?? []" :key="'ease-' + k"
                        class="con-hand__plate-item con-hand__plate-item--ease" :class="'con-hand__plate-item--' + item.kind">
                    <!-- a PARTY requirement (TR70) wears the party's emblem — the hand's own counter badge — in the scale icon's place -->
                    <span class="con-hand__plate-icon" :class="item.iconClass" :style="item.emblem !== undefined ? {backgroundImage: `url(${item.emblem})`} : undefined"></span>
                    <!-- WHAT bends it — a card on the table / the one-play bolt / a policy, one mark per source -->
                    <PremiumModifierMarks class="con-hand__plate-marks" :sources="item.sources" />
                    <span v-if="item.kind === 'shift'" class="con-hand__plate-n">±{{ item.steps }}</span>
                  </span>
                  <span v-if="easingPlates.get(cell.e.card.name)?.decisive" class="con-hand__plate-check" aria-hidden="true"></span>
                  <span v-if="forecastPlates.has(cell.e.card.name) || tenderPlates.has(cell.e.card.name)" class="con-hand__plate-sep" aria-hidden="true"></span>
                </template>
                <!-- A RATING THE LAW REFUSES (RX42): the plate's last item, STRUCK — the server's number (`CardModel.ratingVetoed`). -->
                <span v-for="(item, k) in forecastPlates.get(cell.e.card.name)?.items ?? []" :key="k" class="con-hand__plate-item" :class="{'con-hand__plate-item--struck': item.struck === true}">
                  <span class="con-hand__plate-icon" :class="[item.iconClass, {'con-hand__plate-icon--prod': item.production}]"></span>
                  <span class="con-hand__plate-n">{{ item.upTo ? plateUpToText(item.amount) : item.signed ? signedAmount(item.amount) : item.amount }}</span>
                </span>
                <!-- More counted goods than a tile holds (Productive Outpost's colony bonuses): NAMED in words («ещё 1»),
                     never dropped and never a «+1» that reads as one more amount — the composer reads every one. -->
                <span v-if="(forecastPlates.get(cell.e.card.name)?.more ?? 0) > 0" class="con-hand__plate-more" :data-hand-more="forecastPlates.get(cell.e.card.name)?.more">{{ plateMoreText(forecastPlates.get(cell.e.card.name)?.more ?? 0) }}</span>
                <!-- THE TENDER (К-H1, TR48): what pays for a card M€ alone cannot — after the forecast, behind a hairline. -->
                <span v-if="forecastPlates.has(cell.e.card.name) && tenderPlates.has(cell.e.card.name)" class="con-hand__plate-sep" aria-hidden="true"></span>
                <span v-for="t in tenderPlates.get(cell.e.card.name) ?? []" :key="'pay-' + t.unit" class="con-hand__plate-item con-hand__plate-item--pay">
                  <span class="con-hand__plate-icon" :class="tenderIconClass(t.unit)"></span>
                  <span class="con-hand__plate-n">{{ t.count }}</span>
                </span>
                <!-- …and what it is WORTH here — the card's own «[data] = [2]» read as money (TR48: «data is money»). -->
                <span v-if="tenderPlates.has(cell.e.card.name)" class="con-hand__plate-item con-hand__plate-item--pay con-hand__plate-item--worth">
                  <span class="con-hand__plate-eq" aria-hidden="true">=</span>
                  <span class="con-hand__plate-icon" :class="tenderIconClass('megacredits')"></span>
                  <span class="con-hand__plate-n">{{ tenderWorth(cell.e.card.name) }}</span>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ALBUM EDGE GATE — «there is a page that way», as ONE deliberate
           object. A compact PYLON at the vertical centre of the page edge:
           a chamfered two-layer plate (cyan kant + dark glass — the dock
           plate's own construction) carrying a large chevron, with two
           sheet slivers stepping out from behind it toward the clip line —
           the pages physically waiting beyond. It lives in its OWN reserved
           side gutter (`ALBUM_EDGE_GUTTER`), so an edge card's ring/glow
           never meets it; a shaped, glyph-bearing body cannot read as a
           scrollbar or a cropped boundary the way the old hairline stack
           did. Both sides always RENDER (the composition must not shift
           when the last page drops its next edge) — an unavailable side is
           `--off`: a ghost of the shape, never a lie about where the album
           continues. `--pulse` answers EVERY page-turn door (LB/RB, click,
           flick, wheel — see `turnPage`): the gate kicks INWARD, handing
           the incoming page onto the stage, then the ordinary slide carries
           the motion on. No controller-focus state by design: the pad never
           parks a cursor here — its affordance is the physical bumper,
           advertised by the bay instrument below. -->
      <button v-for="side in ['left', 'right']"
              :key="side"
              type="button" tabindex="-1" aria-hidden="true"
              class="con-hand__pgedge"
              :class="[
                `con-hand__pgedge--${side}`,
                {'con-hand__pgedge--off': side === 'left' ? activePage === 0 : activePage >= plan.pageCount - 1},
                {'con-hand__pgedge--pulse': edgePulse === side},
              ]"
              @click="turnPage(side === 'left' ? -1 : 1)">
        <span class="con-hand__pgedge-sheet con-hand__pgedge-sheet--2" aria-hidden="true"></span>
        <span class="con-hand__pgedge-sheet con-hand__pgedge-sheet--1" aria-hidden="true"></span>
        <span class="con-hand__pgedge-face" aria-hidden="true">
          <span class="con-hand__pgedge-face-in"></span>
          <span class="con-hand__pgedge-chev">{{ side === 'left' ? '‹' : '›' }}</span>
        </span>
      </button>

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
        <!-- A FULL DISCARD SET is a NAMED refusal, never a silent no-op behind «Можно сбросить» (PC05 Spire · GW — the
             fourth card of «discard 3»): the limit with its numbers, and how to change the set. -->
        <span v-else-if="isSelectable(selected.name) && discardSetFull" class="con-cards__verdict con-cards__verdict--blocked" data-hand-set-full><span aria-hidden="true">✕</span> {{ discardSetFullText }}</span>
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
        <!-- …and WHY, when it is playable only thanks to a requirement modifier (TR49 class): «благодаря: Особая разработка». -->
        <span v-if="selectedEasedThanks !== ''" class="con-hand__reason con-hand__reason--bar con-hand__reason--eased" data-hand-eased>{{ selectedEasedThanks }}</span>
        <!-- …and that the play IS A PASS (class CT — `ClientCard.playCountsAsPass`): said before the composer opens. -->
        <span v-if="selectedPasses" class="con-hand__reason con-hand__reason--bar con-hand__reason--pass" data-hand-passes>{{ $t('Playing it counts as passing') }}</span>
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
      <!-- Real rule blockers: the SHARED cardAvailability view (the same one
           the fullscreen panel renders) — its ordered, de-duped rows, first
           two here IN THE COMPACT COUNTER FORM («Метки 1/3» — the bar is one
           fixed-height row by the card-status contract; the full sentences
           live in the fullscreen panel). A turn note that joins them keeps
           its own amber voice under the red verdict. -->
      <template v-else>
        <span class="con-cards__verdict con-cards__verdict--blocked"><span aria-hidden="true">✕</span> {{ $t('Unplayable now') }}</span>
        <span v-for="r in playReasonRows" :key="r.key" class="con-hand__reason con-hand__reason--bar" :class="'con-hand__reason--' + r.type">
          <img v-if="r.emblem !== undefined" class="con-reason-emblem" :src="r.emblem" alt="" data-reason-emblem />{{ r.compact }}</span>
      </template>
      <!-- GIVE-UP modes (sale / select) additionally speak the card's FUTURE
           value in the shared draft voice — «what can I still play?» is what
           prices a card being sold or discarded. INFORMATIONAL only: the
           selection verdict above stays the authoritative layer, this line
           never gates a pick and never re-styles the prompt's own reason.
           The one-liner is the shared availability register (variant="line"),
           so its wording/colours can never drift from the fullscreen panel. -->
      <ConsoleCardAvailabilityPanel v-if="evaluationAvailability !== undefined"
                                    variant="line"
                                    class="con-hand__evalavail"
                                    :view="evaluationAvailability"/>
      <!-- Filtered count lives HERE (compact, right-aligned) — never in the
           header, so the header height can't jump when the filter changes. -->
      <span v-if="filteredCountText !== ''" class="con-hand__shown">{{ filteredCountText }}</span>
    </div>

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
         v-embed-zone
         class="con-hand__outcome"
         data-outcome-zone
         data-embed-slot="hand-outcome"></div>
    </div><!-- /__stagewrap -->
  </div><!-- /__frame -->
  </div>
</template>

<script setup vapor lang="ts">
/*
 * `con-ws` — the WORKSPACE-family marker: `.con-root--ws-open` lifts
 *       and rings the player rail while this screen lives (leave transitions
 *       included), hides the ДОП.РЕСУРСЫ satellite that would paint into the
 *       band, and idles the board's infinite loops underneath. The hand is a
 *       first-class workspace, not a section that happens to fill the space —
 *       and the rail is the wallet every play on this screen is paid from.
 *       `data-flow` — the EXPLICIT state of the descent (browse · configure ·
 *       picking, the last one being «the stage is claimed but a pick bridge has
 *       borrowed the shelf»), read by the chrome and by e2e; never inferred from
 *       an animation's side effects.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

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
import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {artTierForWidth, CardArtTier, preloadPremiumCardArt} from '@/client/cards/cardArt';
import {handCursor, handRevealState} from '@/client/console/handDock/handRevealState';
import {releaseCursor} from '@/client/console/cursorArrival';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleDeclinePlate from '@/client/components/console/foundation/ConsoleDeclinePlate.vue';
import ConsoleDeferPlate from '@/client/components/console/foundation/ConsoleDeferPlate.vue';
import type {DeferPlateModel} from '@/client/console/tableQuestionRow';
import {setWorkspaceFrameSlot, workspaceFrameHost, workspaceFrameParked} from '@/client/console/consoleWorkspaceStack';
import {offerColonyFleetBerth, retractColonyFleetBerth} from '@/client/console/consoleColoniesModel';
import {releaseWorkspaceOutcome, retractWorkspaceOutcomeSlot, setWorkspaceOutcomeSlot, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {rehomePlayOutcome} from '@/client/console/played/consolePlayOutcomeClaim';
// The WORKSPACE DESCEND phrase, one level deeper than «Действия карт»'s
// (consoleHandStageMotion): the stage unfolds from the pressed card's rect
// and folds back into it. The four hooks are the template's `<transition>` bindings.
import {handStageEnterHook, handStageLeaveHook, handStageEnterCancelledHook, handStageLeaveCancelledHook, handStagePickPause, handStagePickResume} from '@/client/console/consoleHandStageMotion';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {readingText} from '@/client/console/readingText';
import {colonyBonusFreshFor, colonyResolutionUi} from '@/client/console/colonyTrade/colonyResolution';
import {availabilityContextFor, buildCardAvailability, CardAvailabilityView, CardAvailabilityReasonView} from '@/client/console/cardAvailability';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import {consoleState} from '@/client/console/consoleRouter';
import {shortBlockerLabel, HandNavDir} from '@/client/components/console/consoleHandGrid';
import {unplayableReasonChip} from '@/client/components/handCards/unplayableReasonFormat';
import {albumSpecFor, planHandAlbum, planAlbumPage, pageRowsFor, pageOfIndex, pageSlotOfIndex, stepHandAlbum, pageJumpIndex, packetRect, HandAlbumPlan, AlbumPagePlan, PacketSide} from '@/client/components/console/consoleHandAlbum';
import {albumLayoutState} from '@/client/console/consoleAlbumLayout';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {AlbumFilter, AlbumFilterOption} from '@/client/components/console/consoleHandFilter';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {PatentSaleAnswer, PatentSaleSummary, patentSaleAnswers, patentSaleSummary} from '@/client/console/patentSale/patentSaleAnswers';
import {PatentSaleModel} from '@/common/models/PatentSaleModel';
import {DiscardIntent} from '@/client/console/cardDiscard/discardIntent';
import type {DeclineModel} from '@/client/console/optionalChoice';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {HandForecastPlate, handForecastPlate, signedAmount} from '@/client/console/countedPlay';
import {HandTenderItem, handTenderItems} from '@/client/console/handTenderPlate';
import {HandEasingPlate, handEasingPlate} from '@/client/console/handEasingPlate';
import {armedEffectsOf} from '@/client/console/armedEffects';
import {PresentedArmedEffect, presentedArmedEffects} from '@/client/console/armedEffectFlight';
import ConsoleArmedEffectsStrip from '@/client/components/console/ConsoleArmedEffectsStrip.vue';
import PremiumModifierMarks from '@/client/components/premiumCard/PremiumModifierMarks.vue';
import {paymentUnitIcon} from '@/client/console/paymentPlan';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import type {ConsoleHandEntry, ConsoleHandSelectMode, ConsoleHandStage, HandTransitionTargets} from '@/client/components/console/consoleHandSectionTypes';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {vEmbedZone, vI18n} from '@/client/directives/vDirectives';

export type {ConsoleHandEntry, ConsoleHandSelectMode, ConsoleHandStage, HandTransitionTargets};

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
/** The edge affordance's press impulse (one shot, shorter than the slide). */
const EDGE_PULSE_MS = 260;

function clampNum(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** One rendered cell: the entry + its flat hand index. */
type AlbumCell = {e: ConsoleHandEntry, gi: number};

defineOptions({name: 'ConsoleHandSection'});
const props = defineProps({
  entries: {type: Array as PropType<ReadonlyArray<ConsoleHandEntry>>, required: true},
  index: {type: Number, required: true},
  /** Sell-patents mode: A toggles picks, RT confirms (shell owns the flow). */
  saleActive: {type: Boolean, default: false},
  saleSelected: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  /** The player's current M€ — drives the sale summary's before → after. */
  saleMegacredits: {type: Number, default: 0},
  /** The sale prompt's RATE (`SelectCardModel.patentSale`) — the project's M€ and the table's answers per card. */
  salePatent: {type: Object as PropType<PatentSaleModel | undefined>, default: undefined},
  /**
   * The hand's OWNER (К-H1, TR48): what pays for a card M€ alone cannot — the tender plate reads the opening
   * payment mix off this model (`handTenderPlate.handTenderItems`). Absent → no tender plate.
   */
  payer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
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
  /** The play WINDOW is closed (opponent's turn or an owed decision) — set
   *  by the shell from its one blocked-reason source. Decides whether the
   *  turn note joins a blocked card's reason list (never re-derived here). */
  turnWindowClosed: {type: Boolean, default: false},
  /** Tag-filter options (All + tags present in the hand) built by the shell. */
  tagFilters: {type: Array as PropType<ReadonlyArray<AlbumFilterOption>>, default: () => []},
  /** The active filter (`'all'`, one tag, or a picker's «pays») — drives the chip highlight. */
  activeTag: {type: String as PropType<AlbumFilter>, default: 'all'},
  /** Candidates the picker's chip hides (FD) — «скрыто фильтром: N»; 0 prints nothing. */
  hiddenByFilter: {type: Number, default: 0},
  /** What each card pays if thrown under a per-tag exchange (FD) — empty for any other album. */
  cardPayouts: {type: Object as PropType<Readonly<Record<string, number>>>, default: () => ({})},
  /** The exchange's payout icon (the plate's and the «ПЛАТЯТ» chip's). */
  payIcon: {type: String, default: 'megacredits'},
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
  /**
   * …and the pause is a HAND PICK answering the stage's own question (the `consoleHandPick` bridge) — the one
   * pause that plays the workspace phrase (`handStagePickPause` / `handStagePickResume`). A repeat pick or a scene
   * handover pauses the stage too, with handoffs of their own.
   */
  handPickOpen: {type: Boolean, default: false},
});
/** `pick-resumed`: the pick's RESUME phrase is done (or needed no phrase) — the shell releases the shelf's frozen look. */
const emit = defineEmits(['pick-resumed']);

const flow = useFlowScope('hand-section');
const album = useTemplateRef<HTMLElement>('album');
const root = useTemplateRef<HTMLElement>('root');
const box = ref({w: 0, h: 0});
/** The workspace OUTCOME claim (module reactive — read straight off the
 *  module; `outcomeZoneOn` and the unmount hook follow it). */
const outcome = workspaceOutcomeState;
/** The layout profile (module reactive — the album's page shape). */
const layout = consoleLayoutState;
/** The «Компоновка альбома» preference (module reactive). */
const albumLayout = albumLayoutState;
/** A page slide is airborne — `will-change` scoped to the turn only. */
const turning = ref(false);
let cancelTurnSafety = (() => {}) as () => void;
/** The edge that answered the last page press (one-shot impulse). */
const edgePulse = ref<'left' | 'right' | undefined>(undefined);
let cancelEdgePulse = (() => {}) as () => void;
/** The strip transition arms only after the mount has settled — the
 *  first paint (and every fresh open) must land on its page with no
 *  slide from x=0. */
const pageMotionLive = ref(false);
/** The page the strip last SETTLED on — the render window keeps both
 *  the settled and the target page mounted, so a mid-slide page never
 *  unmounts under the player (a pop). */
const settledPage = ref(0);
/** The IDENTITY the cursor is anchored to — when entries re-sort or
 *  shrink, focus follows the card, not the number. */
const focusName = ref<string | undefined>(undefined);
const lastFlickAt = ref(0);
const wheelAcc = ref(0);
const wheelAt = ref(0);
let ro: ResizeObserver | undefined;
/** A measure is scheduled for the next frame (its cancel) — `undefined` when none stands. */
let cancelMeasure: (() => void) | undefined;
/** Debounce handle for the focused card's full-art prewarm. */
let cancelPrewarm = (() => {}) as () => void;

/**
 * THE CURSOR'S POSE IS GATED (TR58, `[data-cursor-pending]` → `.con-cursor()`): while the copies hold the slots and
 * through the handoff the focused card stands at REST — the copies land on the resting box and leave on the next
 * frame — then the cursor ARRIVES (`handCursor`, released by the episode's handoff or by a step).
 */
const cursorPending = computed((): boolean => {
  return props.transitHold || handCursor.pending;
});
/** Every hand card's forecast plate (a walk or a counted play), keyed by name — the server's reading, never a client count. */
const forecastPlates = computed((): ReadonlyMap<CardName, HandForecastPlate> => {
  const out = new Map<CardName, HandForecastPlate>();
  for (const e of props.entries) {
    const plate = handForecastPlate(e.card);
    if (plate !== undefined) {
      out.set(e.card.name, plate);
    }
  }
  return out;
});
/**
 * THE PLATE'S THIRD READER (К-H1, TR48 — the owner's decision 2026-10-12): the CARD-BOUND tender the opening
 * payment mix spends on a card M€ alone cannot pay — «[data] 4» on a Science card that Supercomputer's data
 * make playable. Keyed by name; the panel's own mix (`handTenderItems`), never a second rule.
 */
const tenderPlates = computed((): ReadonlyMap<CardName, ReadonlyArray<HandTenderItem>> => {
  const out = new Map<CardName, ReadonlyArray<HandTenderItem>>();
  if (props.payer === undefined) {
    return out;
  }
  for (const e of props.entries) {
    const items = handTenderItems(e.card, props.payer);
    if (items.length > 0) {
      out.set(e.card.name, items);
    }
  }
  return out;
});
/** The workspace has been descended into — the browse layer is parked. */
const stageOpen = computed((): boolean => {
  return props.stage !== undefined;
});
/** A hand pick answers the open stage's question right now (see `handPickOpen`). */
const stagePickOut = computed((): boolean => {
  return stageOpen.value && props.stagePaused && props.handPickOpen;
});
/** The COLONIES stand inside this hand as its step (TR07's staged colony; a played card's live pick). */
const colonyStepHosted = computed((): boolean => {
  return workspaceFrameHost('colonies') === 'hand';
});
/** …and this header lends them its fleet berth (only the root header exists to lend it). */
const berthOffered = computed((): boolean => {
  return !props.embedded && colonyStepHosted.value;
});
/**
 * THIS workspace holds the outcome claim of the play it is standing in —
 * its zone is owed (see the template). Read straight off the claim, never
 * off «is something on screen»: the zone has to exist BEFORE the artifact
 * looks for it.
 */
const outcomeZoneOn = computed((): boolean => {
  return outcome.host === 'hand' && outcome.sourceCard !== '';
});
const selected = computed((): CardModel | undefined => {
  return props.entries[props.index]?.card;
});
const selectedPlayable = computed((): boolean => {
  return props.entries[props.index]?.playable === true;
});
/**
 * The selected card is blocked ONLY by the execution window — legal by the
 * rules (`potential`), just not submittable this moment (`!playable`). Read
 * from the entry the shell already classified through the shared blocker
 * model, so the info bar and the card's own pose can never disagree.
 */
const softBlocked = computed((): boolean => {
  return !props.saleActive && !selectActive.value && selected.value !== undefined &&
    !selectedPlayable.value && props.entries[props.index]?.potential === true;
});
/**
 * The selected card's availability in the PLAY voice — the SHARED
 * cardAvailability model, the very view the fullscreen panel renders for
 * this card, so the verdict bar's lines and the fullscreen list can never
 * drift (ordering, de-dupe and the turn note's place included). The bar
 * shows the first two rows; the rest wait in the fullscreen.
 */
const playAvailability = computed((): CardAvailabilityView | undefined => {
  if (selected.value === undefined || props.saleActive || selectActive.value || selectedPlayable.value) {
    return undefined;
  }
  return buildCardAvailability({
    reasons: selected.value.unplayableReasons,
    easing: selected.value.requirementEasing,
    turnReason: props.turnWindowClosed ? props.softReason : undefined,
  }, 'play');
});
/**
 * A PLAYABLE card met ONLY thanks to a requirement modifier names it (TR49 class) — the eased voice's compact form
 * of the SAME shared model the fullscreen panel renders; '' when the card needs no help.
 */
/** The focused card's play counts as a pass (`ClientCard.playCountsAsPass`, P80) — the verdict bar names it. */
const selectedPasses = computed((): boolean => {
  return selected.value !== undefined && getCard(selected.value.name)?.playCountsAsPass === true;
});
const selectedEasedThanks = computed((): string => {
  if (selected.value === undefined || !selectedPlayable.value || props.saleActive || selectActive.value) {
    return '';
  }
  const view = buildCardAvailability({reasons: undefined, easing: selected.value.requirementEasing}, 'play');
  return view?.severity === 'eased' ? view.primary?.compact ?? '' : '';
});
/** The viewer's armed one-play effects (TR49 class) — the public seat model the shell hands in as the payer. */
const armedEffects = computed((): ReadonlyArray<PresentedArmedEffect> => {
  return presentedArmedEffects(armedEffectsOf(props.payer));
});
/** The plate's requirement reader (TR49 class), keyed by name. */
const easingPlates = computed((): ReadonlyMap<CardName, HandEasingPlate> => {
  const out = new Map<CardName, HandEasingPlate>();
  for (const e of props.entries) {
    const plate = handEasingPlate(e.card);
    if (plate !== undefined) {
      out.set(e.card.name, plate);
    }
  }
  return out;
});
/** The verdict bar's visible rows (compact: the top of the shared list). */
const playReasonRows = computed((): ReadonlyArray<CardAvailabilityReasonView> => {
  return (playAvailability.value?.reasons ?? []).slice(0, 2);
});
/**
 * The focused card's availability for the GIVE-UP modes (sale / select) —
 * the shared model in the requirement voice ('hand-sell' / 'hand-give' →
 * draft): the decision is «part with this card or keep it», so only the
 * printed requirements' trajectory speaks (amber «пока не выполнено», red
 * «уже не выполнить»), never money, never the current turn. Purely
 * informational — the prompt's own candidacy and the sale's selection
 * state stay the authoritative layers above.
 */
const evaluationAvailability = computed((): CardAvailabilityView | undefined => {
  if (selected.value === undefined || (!props.saleActive && !selectActive.value)) {
    return undefined;
  }
  const context = availabilityContextFor(props.saleActive ? 'hand-sell' : 'hand-give');
  if (context === undefined) {
    return undefined;
  }
  return buildCardAvailability({reasons: selected.value.unplayableReasons}, context);
});
// ── mandatory hand SELECT (discard / reveal / place) ──────────────────
const selectActive = computed((): boolean => {
  return props.select?.active === true;
});
// ── DISCARD skin (one derivation, every discard case) ─────────────────
/** The pre-derived discard presentation, or undefined for a normal pick. */
const discard = computed((): DiscardIntent | undefined => {
  return selectActive.value ? props.select?.discard : undefined;
});
/** A multi DISCARD holds as many cards as it may (`max` > 1) — another card is a named refusal (the limit's numbers). */
const discardSetFull = computed((): boolean => {
  const d = discard.value;
  return d !== undefined && d.max > 1 && (props.select?.selected.length ?? 0) >= d.max;
});
const discardSetFullText = computed((): string => {
  const max = discard.value?.max ?? 0;
  return translateTextWithParams('Limit ${0}/${1} reached — deselect one of the marked cards', [String(max), String(max)]);
});
/** The DECLINE of an optional pick (RT answers it; its plate stands in the question line). */
const pickDecline = computed((): DeclineModel | undefined => {
  return selectActive.value ? props.select?.decline : undefined;
});
/** «Decide after the draw» of a table question that may wait (R3; its plate beside the decline's). */
const pickDefer = computed((): DeferPlateModel | undefined => {
  return selectActive.value ? props.select?.defer : undefined;
});
/** The question line stands: past the descent for a discard (the header's own block is under the deep crumb), and
 *  for any pick that can be declined or left for after a draw (its plates have nowhere else to stand). */
const questionShown = computed((): boolean => {
  return selectActive.value && (questionAskShown.value || pickDecline.value !== undefined || pickDefer.value !== undefined);
});
/** …and it carries the ASK only where the header cannot (past the descent) — never the same block twice. */
const questionAskShown = computed((): boolean => {
  return stageOpen.value && discard.value !== undefined;
});
/** «Сбросьте 1 карту» / «Сбросьте 3 карты» / «Сбросьте до 3 карт». */
const discardAsk = computed((): string => {
  const headline = discard.value?.headline;
  if (headline === undefined) {
    return '';
  }
  return headline.amount === undefined ?
    translateText(headline.key) :
    translateTextWithParams(headline.key, [String(headline.amount)]);
});
/** WHO demands it: the source card's name when there is one, the COLONY's
 *  own name for a colony bonus (its planet mini stands beside it), else
 *  the kind («Правило игры») — never a bare unexplained ask. */
const discardSource = computed((): string => {
  const intent = discard.value;
  if (intent === undefined) {
    return '';
  }
  // A COLONY's bonus leads with the colony, whoever pays it: its planet stands beside the name, and a CARD
  // that pays it (TR23 — the discard's source is that card) is already the crumb's subject one line above.
  if (intent.colonyName !== undefined) {
    return translateText(intent.colonyName);
  }
  if (intent.card !== undefined) {
    return translateText(intent.card);
  }
  if (intent.partyName !== undefined) {
    return translateTextWithParams('Party action of ${0}', [translateText(intent.partyName)]);
  }
  // An enacted LAW asks (Open IP Trade's action): its printed name, never a bare «Резолюция».
  if (intent.resolution !== undefined) {
    return translateText(resolutionName(intent.resolution));
  }
  return translateText(intent.sourceKey);
});
/** The demanding colony's planet art ('' = not a colony discard). */
const discardPlanetClass = computed((): string => {
  const name = discard.value?.colonyName;
  return name === undefined || name === '' ? '' : name.replace(' ', '-') + '-background';
});
/** «Бонус колонии 2 из 3» — Pluto resolves one cube at a time. A SINGLE
 *  colony shows the plain «Бонус колонии»: «1 из 1» numbers a sequence
 *  that does not exist, and the player reads it as a progress bar. */
const discardSequence = computed((): string => {
  const seq = discard.value?.sequence;
  if (seq === undefined) {
    return '';
  }
  if (seq.total <= 1) {
    return translateText('Colony bonus');
  }
  return translateTextWithParams('Colony bonus ${0} of ${1}', [String(seq.index), String(seq.total)]);
});
/**
 * THE NEXT SETTLEMENT this discard opens (0 = none): a colony bonus paid per settlement, not the last one —
 * its card lies sealed until this discard is answered (`colonyTrade/settlementTable.ts`).
 */
const discardSealNext = computed((): number => {
  const seq = discard.value?.sequence;
  return seq !== undefined && seq.total > 1 && seq.index < seq.total ? seq.index + 1 : 0;
});
const discardSealText = computed((): string => {
  return readingText({label: 'opens bonus ${0}', params: [String(discardSealNext.value)]});
});
/**
 * THE CARD THIS BONUS JUST BROUGHT IN wears «НОВАЯ · БОНУС N» while its discard is asked (К-4) — the player
 * watched it go into the hand a moment ago and must be able to find it among the rest (or keep it). «НОВАЯ»
 * alone for a single settlement: «бонус 1» would number a sequence that does not exist.
 */
const freshBonusText = computed((): string => {
  const seq = discard.value?.sequence;
  if (seq === undefined) {
    return '';
  }
  return seq.total > 1 ? readingText({label: 'New · bonus ${0}', params: [String(seq.index)]}) : translateText('New card');
});
const discardExchangeIconClass = computed((): string => {
  return iconClassFor(discard.value?.exchange?.icon ?? 'cards');
});
/** SALE mode: the live pick summary (count / payout / answers / before → after) — the server's rate × the pick. */
const sale = computed((): PatentSaleSummary => {
  return patentSaleSummary(props.salePatent, props.saleSelected.length, props.saleMegacredits);
});
/**
 * The table's answers as the bar reads them: the amount for the pick, or —
 * at zero picks — the RATE of one card (dim, «за карту»), so the answer is
 * named before the first selection.
 */
const saleAnswers = computed((): Array<PatentSaleAnswer & {shown: number}> => {
  const rows = sale.value.count > 0 ? sale.value.answers : patentSaleAnswers(props.salePatent, 1);
  return rows.map((a) => ({...a, shown: a.amount}));
});
/** The focused card's per-card «why not» reason (non-selectable only). */
const focusedSelectReason = computed((): string => {
  const name = selected.value?.name;
  return name !== undefined ? selectReason(name) : '';
});
/** Multi-pick payout summary (present only for a paying client pick). */
const selectPayout = computed((): {icon: string, amount: number, current?: number, cards?: number} | undefined => {
  return props.select?.payout;
});
const pickCount = computed((): number => {
  return props.select?.selected.length ?? 0;
});
const pickGain = computed((): number => {
  return pickCount.value * (selectPayout.value?.amount ?? 0);
});
/** The second payout in CARDS for the current pick (0 when the pick pays none). */
const pickCardGain = computed((): number => {
  return pickCount.value * (selectPayout.value?.cards ?? 0);
});
const payoutIconClass = computed((): string => {
  return iconClassFor(selectPayout.value?.icon ?? 'megacredits');
});
// ── header / filter panel ─────────────────────────────────────────────
const showFilters = computed((): boolean => {
  // Only worth a filter panel when there's a real chip beyond "All" — in EVERY album mode (FD): a picker's chips
  // are its own, beside the «suitable only» toggle of a narrowed prompt.
  return props.tagFilters.length > 1;
});
/** The focused chip (FD — the row as a focusable line), −1 while the cursor is on the cards. */
const filterFocus = computed((): number => {
  return showFilters.value ? consoleState.filterFocus : -1;
});
const payIconClass = computed((): string => {
  return iconClassFor(props.payIcon);
});
const hiddenText = computed((): string => {
  return translateTextWithParams('Hidden by the filter: ${0}', [String(props.hiddenByFilter)]);
});
const totalCount = computed((): number => {
  return props.tagFilters.find((o) => o.value === 'all')?.count ?? props.entries.length;
});
/**
 * THE CHROME COMES IN BEATS, NEVER IN THE HANDOFF'S FLUSH (PL-508). Through the open episode the header and the
 * verdict rail are RESERVED in layout (zero shifts) but transparent — they used to stand opaque from frame 0, and
 * the flights, which dive BEHIND the rail by z-design, read as covered by it. Then they rose together in the very
 * flush that handed the copies over, the cursor a frame later — three events in one beat. Now the director's
 * `chrome` beat drives them, never a timer: the FRAME (header, page edges) rises as the copies take off — it is
 * never on their path —, the READING (the rail — it names the card under the cursor) comes with the cursor's
 * arrival, after the copies have gone (`chromeWait`). A cancelled open (B mid-flight) never raises the rail.
 */
const chromeWait = computed((): boolean => {
  const phase = handRevealState.phase;
  return phase === 'opening' || ((phase === 'open' || phase === 'closing') && handRevealState.chrome !== 'all');
});
/**
 * A HOSTED hand whose entry IS the bodies' flight (P86): the host's own step entry (`con-stdp-step-in` — opacity
 * from 0) must not hide the slots the bodies land on, or the player sees the hand «appear» with its cards already
 * down. Without a flight (reduced motion, the short path) the host's entry plays as before.
 */
const arrivesByFlight = computed((): boolean => {
  return props.embedded && (handRevealState.phase === 'opening' || chromeWait.value);
});
/** The album's FRAME (the header, the page edges) waits only for the copies to take off (PL-508). */
const frameWait = computed((): boolean => {
  return handRevealState.phase === 'opening' && handRevealState.chrome === 'held';
});
/** «Можно разыграть: N» — POTENTIAL, the same number the wheel shows: a
 *  count that halves because an opponent started thinking is not a fact
 *  about the hand. (The press itself still needs `playable`.) */
const playableCount = computed((): number => {
  return props.entries.reduce((n, e) => n + (e.potential ? 1 : 0), 0);
});
/** The header shows the plain total ONLY when there are no filter chips to
 *  carry it (the "All" chip shows it otherwise). It NEVER shows "Показано X
 *  из Y" — that would widen the header on a filter toggle and wrap the chips
 *  to a second row (the header must stay a stable height); that count lives
 *  compactly in the bottom info bar instead (`filteredCountText`).
 *  In SELECT mode the number gets its label — a bare «37» beside the ask
 *  plate read as an unexplained figure. */
const countText = computed((): string => {
  if (showFilters.value) {
    return '';
  }
  return selectActive.value ?
    translateTextWithParams('Total cards: ${0}', [String(totalCount.value)]) :
    String(totalCount.value);
});
/** "Показано 8 из 33" — shown ONLY when a tag filter is active (never in
 *  sale mode, where the whole hand is shown), in the bottom info bar (never
 *  the header, so the header height can't jump). */
const filteredCountText = computed((): string => {
  if (props.saleActive) {
    return '';
  }
  // Select mode: "Показано X из Y" only while the "suitable only" filter is
  // hiding non-candidate cards. A CLIENT pick supplies its own honest
  // universe (`total` — staged / SRR-hosted cards are outside the pick).
  if (selectActive.value) {
    return props.select?.filtered === true && props.select.suitableOnly ?
      translateTextWithParams('Shown ${0} of ${1}', [String(props.entries.length), String(props.select.total ?? totalCount.value)]) :
      '';
  }
  return props.activeTag !== 'all' ?
    translateTextWithParams('Shown ${0} of ${1}', [String(props.entries.length), String(totalCount.value)]) :
    '';
});
const emptyMessage = computed((): string => {
  return props.activeTag !== 'all' ? translateText('No cards with this tag') : translateText('No cards in hand');
});
/**
 * THE ALBUM BACKBONE PLAN — page CAPACITY from the profile + the player's
 * «Компоновка альбома» preference (read synchronously at module import,
 * so the very first measure — and the HandDock flight aiming at it — is
 * already in the chosen composition), the STANDARD two-row card size
 * from the box. Pagination facts only: stride, page count, the standard
 * zoom every full two-row page shares. The per-page DENSITY geometry
 * (Showcase Pages) lives in `pagePlanFor`.
 */
const plan = computed((): HandAlbumPlan => {
  return planHandAlbum({
    availW: box.value.w > 0 ? box.value.w : FALLBACK_W,
    availH: box.value.h > 0 ? box.value.h : FALLBACK_H,
    count: props.entries.length,
    spec: albumSpecFor(layout.profile, albumLayout.layout),
    uiScale: conUiScale(),
  });
});
/** The ACTIVE page's row composition — navigation's vertical map. */
const activePageRows = computed((): ReadonlyArray<number> => {
  const start = activePage.value * plan.value.perPage;
  const n = Math.min(props.entries.length - start, plan.value.perPage);
  return pageRowsFor(Math.max(0, n), albumSpecFor(layout.profile, albumLayout.layout));
});
/** The page the cursor lives on — the album's viewport, BY DERIVATION.
 *  Focus and page can never disagree; restoring one restores the other. */
const activePage = computed((): number => {
  const clamped = clampNum(0, Math.max(0, props.entries.length - 1), props.index);
  return Math.min(plan.value.pageCount - 1, pageOfIndex(clamped, plan.value.perPage));
});
/** Pages kept mounted: the active page ± 1, plus the last SETTLED page's
 *  neighbourhood — a page mid-slide never unmounts under the player. */
const renderPages = computed((): Array<number> => {
  if (props.entries.length === 0) {
    return [];
  }
  const last = plan.value.pageCount - 1;
  const keep = new Set<number>();
  for (const centre of [activePage.value, Math.min(last, settledPage.value)]) {
    for (let p = Math.max(0, centre - 1); p <= Math.min(last, centre + 1); p++) {
      keep.add(p);
    }
  }
  return [...keep].sort((a, b) => a - b);
});
const rootStyle = computed((): Record<string, string> => {
  return {'--con-hand-zoom': String(plan.value.cardZoom)};
});
/**
 * ART TIER for the album grid (perf iteration 3). The plan's slot width
 * is real CSS px (the solver multiplies uiScale in), so the shared
 * `artTierForWidth` rule lands exactly like the played grid's: ~272 px
 * slots at 1080p paint the 512-px thumb build (an open hand held 8
 * full-res decodes ≈ 48 MB — all oversized, measured by the long-game
 * probe), while 4K's ~544 px slots keep the full file for couch
 * sharpness. The fullscreen inspector is covered by the focused-card
 * prewarm below.
 */
const handArtTier = computed((): CardArtTier => {
  return artTierForWidth(plan.value.slotW);
});
/** The strip slides one stride per page — transform only (interruptible,
 *  retargetable, zero layout, zero scroll geometry). */
const stripStyle = computed((): Record<string, string> => {
  return {transform: `translateX(${-activePage.value * plan.value.stride}px)`};
});
/** The cursor SEMANTICS epoch — a mode flip (browse ↔ sale ↔ select/pick)
 *  re-seats the cursor on the shell's side, so the identity anchor must
 *  adopt the new position even when the index number did not change. */
const modeKey = computed((): string => {
  return `${props.saleActive}|${selectActive.value}`;
});

function answerIconClass(icon: string): string {
  return iconClassFor(icon);
}
/**
 * ONE PAGE'S DENSITY SOLVE (Showcase Pages): the composition + the card
 * size for exactly the cards standing on it. Pure math over the same
 * measured box — cheap enough to call from the render path.
 */
function pagePlanFor(page: number): AlbumPagePlan {
  const start = page * plan.value.perPage;
  const n = Math.max(0, Math.min(props.entries.length - start, plan.value.perPage));
  return planAlbumPage({
    availW: box.value.w > 0 ? box.value.w : FALLBACK_W,
    availH: box.value.h > 0 ? box.value.h : FALLBACK_H,
    count: n,
    spec: albumSpecFor(layout.profile, albumLayout.layout),
    uiScale: conUiScale(),
  }, n, plan.value);
}
/** The rows of one page per its COMPOSED density (e.g. [5,4] / [3]),
 *  each cell carrying its FLAT hand index. */
function pageRows(page: number): Array<Array<AlbumCell>> {
  const start = page * plan.value.perPage;
  const slice = props.entries.slice(start, start + plan.value.perPage);
  const composition = pagePlanFor(page).rows;
  const rows: Array<Array<AlbumCell>> = [];
  let at = 0;
  for (const len of composition) {
    rows.push(slice.slice(at, at + len).map((e, ci) => ({e, gi: start + at + ci})));
    at += len;
  }
  return rows;
}
/** One page's berth on the strip: its stride slot + its OWN centring
 *  pads and card scale (`--con-hand-zoom` rides the page, so a showcase
 *  page's chips/bands counter-zoom against ITS size, not the base). */
function pageStyle(page: number): Record<string, string> {
  const pp = pagePlanFor(page);
  return {
    'transform': `translate(${page * plan.value.stride + pp.padX}px, ${pp.padTop}px)`,
    'width': pp.pageW + 'px',
    'rowGap': pp.gapY + 'px',
    '--con-hand-zoom': String(pp.zoom),
  };
}
/** The row line style of one page (slot height + column gap). */
function pageRowStyle(page: number): Record<string, string> {
  const pp = pagePlanFor(page);
  return {height: pp.slotH + 'px', columnGap: pp.gapX + 'px'};
}
function onStripSettled(e: TransitionEvent): void {
  if (e.propertyName !== 'transform') {
    return;
  }
  turning.value = false;
  settledPage.value = activePage.value;
  cancelTurnSafety();
}
function isSaleSelected(name: string): boolean {
  return props.saleSelected.includes(name);
}
/** Select mode: is this card a candidate the player may pick? */
function isSelectable(name: string): boolean {
  return props.select?.selectable.includes(name) ?? false;
}
/** Select mode: is this card currently picked? */
function isSelectPicked(name: string): boolean {
  return props.select?.selected.includes(name) ?? false;
}
/** A colony-bonus discard: is this the card that cycle's bonus just brought in (К-4)? */
function isBonusFresh(name: string): boolean {
  const d = discard.value;
  if (d === undefined || d.sequence === undefined || d.colonyName === undefined) {
    return false;
  }
  return colonyBonusFreshFor(colonyResolutionUi.bonusFresh, {colonyName: d.colonyName, index: d.sequence.index}, name);
}
/** A discard LEFT FOR AFTER THE DRAW: is this the card the draw just brought (2026-10-15)? */
function isDrawFresh(name: string): boolean {
  return props.select?.fresh?.includes(name) ?? false;
}
/** Select mode: the pre-translated «why not» reason for a non-candidate. */
function selectReason(name: string): string {
  return props.select?.reasons[name] ?? '';
}
/** «ещё N» — the counted goods past the plate's two, in WORDS: a «+N» beside «+1» amounts read as one more amount. */
/** A chosen count's ceiling (TR54): «до +4» — one reading renderer (PL-160). */
function plateUpToText(n: number): string {
  return readingText({label: 'up to ${0}', params: [signedAmount(n)]});
}
function plateMoreText(n: number): string {
  return readingText({label: 'and ${0} more', params: [String(n)]});
}
/** A tender unit's sprite (the payment panel's own table — `seeds` → seed, `supercomputerData` → data). */
function tenderIconClass(unit: string): string {
  return iconClassFor(paymentUnitIcon(unit));
}
/** The M€ the card-bound tender pays on this card — Σ count × rate, the panel's own contributions. */
function tenderWorth(name: CardName): number {
  return (tenderPlates.value.get(name) ?? []).reduce((sum, t) => sum + t.megacredits, 0);
}
/** The e2e hook of the tender plate: «unit:count» per unit, in the mix's order (undefined without one). */
function tenderHook(name: CardName): string | undefined {
  const items = tenderPlates.value.get(name);
  return items === undefined ? undefined : items.map((t) => t.unit + ':' + t.count).join(' ');
}
/** The e2e hook of the requirement plate (TR49 class): «waive ✓» / «±2» / «ally ✓» (TR62 — met through the alliance). */
function easingHook(name: CardName): string | undefined {
  const plate = easingPlates.value.get(name);
  if (plate === undefined) {
    return undefined;
  }
  const items = plate.items.map((i) => i.kind === 'waive' ? 'waive' : i.kind === 'ally' ? 'ally' : '±' + i.steps).join(' ');
  return plate.decisive ? items + ' ✓' : items;
}
/** Compact blocker chip label for an unavailable card (english i18n key). */
function chipLabel(entry: ConsoleHandEntry): string | undefined {
  return shortBlockerLabel(entry.card.unplayableReasons ?? []);
}
function chipEmblem(entry: ConsoleHandEntry): {emblem: string, text: string} | undefined {
  return unplayableReasonChip(entry.card.unplayableReasons ?? []);
}
// ── navigation (called by the shell, mirrors ConsoleBoardSection) ──────
/**
 * D-pad / left-stick: deterministic album stepping. Horizontal walks the
 * flat hand order — crossing a page edge IS the page turn (the strip
 * follows the derived active page); vertical moves between the ACTIVE
 * page's COMPOSED rows ([5,4] / [4,3] / a single showcase row), column
 * preserved. Nothing wraps; every edge is felt.
 */
function move(dir: HandNavDir): void {
  // THE CHIP ROW (FD): ◀▶ walk the chips (no wrap), ▼ hands the cursor back to the cards.
  if (filterFocus.value >= 0) {
    if (dir === 'left' || dir === 'right') {
      consoleState.filterFocus = Math.max(0, Math.min(props.tagFilters.length - 1, filterFocus.value + (dir === 'left' ? -1 : 1)));
    } else if (dir === 'down') {
      consoleState.filterFocus = -1;
    }
    return;
  }
  if (dir === 'up' && showFilters.value) {
    const next = stepHandAlbum(props.index, dir, props.entries.length, {perPage: plan.value.perPage, rows: activePageRows.value});
    if (next === props.index || props.entries.length === 0) {
      // ▲ from the top row of cards ENTERS the chip row, on the active chip.
      consoleState.filterFocus = Math.max(0, props.tagFilters.findIndex((o) => o.value === props.activeTag));
      return;
    }
  }
  consoleState.handIndex = stepHandAlbum(props.index, dir, props.entries.length, {
    perPage: plan.value.perPage,
    rows: activePageRows.value,
  });
}
/** The explicit page turn (LB/RB, edge click, stick flick, wheel): same
 *  relative slot on the neighbouring page. The pressed EDGE answers on
 *  the press frame — a short impulse, never a ceremony in front of the
 *  slide (the transform retarget still redirects a repeat press). */
function turnPage(dir: 1 | -1): void {
  if (props.transitHold) {
    return;
  }
  const next = pageJumpIndex(props.index, dir, props.entries.length, plan.value.perPage);
  if (next !== props.index) {
    pulseEdge(dir === 1 ? 'right' : 'left');
  }
  consoleState.handIndex = next;
}
/** The edge's press response (CSS `--pulse`, one shot). */
function pulseEdge(side: 'left' | 'right'): void {
  edgePulse.value = side;
  cancelEdgePulse();
  cancelEdgePulse = flow.after(EDGE_PULSE_MS, 'the edge\'s press impulse reads', () => {
    edgePulse.value = undefined;
  });
}
/**
 * Right stick — the PAGE FLICK (replaces the old free vertical scroll):
 * a firm push turns one page toward the push; holding it pages at a
 * controlled cadence. The CSS slide retargets mid-flight, so rapid
 * flicks redirect the same motion instead of queueing five animations.
 */
function stickScroll(dy: number, dx = 0): void {
  const v = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  if (Math.abs(v) < FLICK_THRESHOLD) {
    return;
  }
  const now = Date.now();
  if (now - lastFlickAt.value < FLICK_REPEAT_MS) {
    return;
  }
  lastFlickAt.value = now;
  turnPage(v > 0 ? 1 : -1);
}
/** A scroll on the album is always programmatic (see the template note) —
 *  pin it back so a stray `scrollIntoView` can never shift the strip. */
function pinScroll(): void {
  const albumNow = album.value ?? undefined;
  if (albumNow !== undefined && (albumNow.scrollLeft !== 0 || albumNow.scrollTop !== 0)) {
    albumNow.scrollLeft = 0;
    albumNow.scrollTop = 0;
  }
}
/** Mouse wheel: accumulate into one page turn per firm notch group. */
function onWheel(e: WheelEvent): void {
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  const now = Date.now();
  if (now - wheelAt.value > WHEEL_DECAY_MS) {
    wheelAcc.value = 0;
  }
  wheelAt.value = now;
  wheelAcc.value += d;
  if (Math.abs(wheelAcc.value) >= WHEEL_STEP) {
    turnPage(wheelAcc.value > 0 ? 1 : -1);
    wheelAcc.value = 0;
  }
}
/** The album derives its viewport from the focus — nothing to scroll.
 *  Kept (as a no-op) because the filter episode's measure path and the
 *  shell's refocus call it; the page follows `handIndex` reactively. */
function ensureSelectedVisible(): void {
  // Intentionally empty: activePage is derived from the focus index.
}
/** Scroll restoration is gone with the scroll itself — the page derives
 *  from the restored focus index. Kept for the director's hook shape. */
function restoreScroll(_px: number): void {
  // Intentionally empty.
}
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
function transitionTargets(): HandTransitionTargets {
  const albumNow = album.value ?? undefined;
  if (albumNow === undefined || (props.entries.length === 0 && props.packetExtras.length === 0)) {
    return {pairs: [], scrollTop: 0};
  }
  const box = albumNow.getBoundingClientRect();
  // The album's x-range — the PHYSICAL boundary packet flights cross.
  // The director erases/reveals a packet-bound card exactly by this
  // edge as it slides past (never an alpha fade in mid-air).
  const stage = {left: box.left, right: box.left + box.width};
  const p = plan.value;
  const s = conUiScale();
  const active = activePage.value;
  const packetOf = (side: PacketSide, depth: number, seq: number) =>
    packetRect(side, depth, seq, {left: box.left, top: box.top, width: box.width, height: box.height}, p.slotW, p.slotH, s);
  // A packet-bound card WIPES behind the stage edge (a side clip in the
  // director's language) instead of sliding whole over the HUD beside
  // the album — the leading side of the card hides first.
  const packetClip = (side: PacketSide) =>
    side === 'left' ? {top: 0, bottom: 0, left: p.slotW} : {top: 0, bottom: 0, right: p.slotW};
  const pairs = props.entries.map((e, i) => {
    const page = pageOfIndex(i, p.perPage);
    if (page !== active) {
      const side: PacketSide = page < active ? 'left' : 'right';
      return {name: e.card.name as CardName, rect: packetOf(side, Math.abs(page - active), pageSlotOfIndex(i, p.perPage)), visible: false, clip: packetClip(side)};
    }
    const slotCard = albumNow.querySelector<HTMLElement>(`[data-zoom-slot="${CSS.escape(e.card.name)}"] :is(.card-container, .pcard)`);
    if (slotCard !== null) {
      const r = slotCard.getBoundingClientRect();
      return {name: e.card.name as CardName, rect: {left: r.left, top: r.top, width: r.width, height: r.height}, visible: true};
    }
    // Plan-derived fallback (pre-paint measure): mirror the rendered
    // DENSITY geometry — the page block at its own pads, the composed
    // rows individually centred, this page's own card size.
    const pp = pagePlanFor(page);
    const slot = pageSlotOfIndex(i, p.perPage);
    let row = 0;
    let rowStart = 0;
    while (row < pp.rows.length - 1 && slot >= rowStart + pp.rows[row]) {
      rowStart += pp.rows[row];
      row++;
    }
    const col = slot - rowStart;
    const inRow = pp.rows[row] ?? 1;
    const rowW = inRow * pp.slotW + (inRow - 1) * pp.gapX;
    const rect = {
      left: box.left + pp.padX + (pp.pageW - rowW) / 2 + col * (pp.slotW + pp.gapX),
      top: box.top + pp.padTop + row * (pp.slotH + pp.gapY),
      width: pp.slotW,
      height: pp.slotH,
    };
    return {name: e.card.name as CardName, rect, visible: true};
  });
  // The out-of-view universe (tag-filtered / non-suitable): parked past
  // the LAST page's packets on the right — physically in the album, so
  // the dock genuinely empties and the close gathers every card home.
  const farDepth = Math.max(1, p.pageCount - active);
  props.packetExtras.forEach((name, k) => {
    pairs.push({name: name as CardName, rect: packetOf('right', farDepth + 1, k % p.perPage), visible: false, clip: packetClip('right')});
  });
  return {pairs, scrollTop: 0, stage};
}
/**
 * Packet flight anchors for a set of names (the filter episode's leaver
 * landings / enterer origins): cards leaving the current view gather into
 * the right-edge packet; cards entering it fan out of the same place.
 */
function packetHomeRects(names: ReadonlyArray<string>, side: PacketSide = 'right'): Map<string, {left: number, top: number, width: number, height: number}> {
  const out = new Map<string, {left: number, top: number, width: number, height: number}>();
  const albumNow = album.value ?? undefined;
  if (albumNow === undefined) {
    return out;
  }
  const box = albumNow.getBoundingClientRect();
  const p = plan.value;
  const s = conUiScale();
  names.forEach((name, k) => {
    out.set(name, packetRect(side, 1, k % p.perPage, {left: box.left, top: box.top, width: box.width, height: box.height}, p.slotW, p.slotH, s));
  });
  return out;
}
function measure(): void {
  const albumNow = album.value ?? undefined;
  if (albumNow === undefined) {
    return;
  }
  const w = albumNow.clientWidth;
  const h = albumNow.clientHeight;
  if (w !== box.value.w || h !== box.value.h) {
    box.value = {w, h};
  }
}
function scheduleMeasure(): void {
  if (cancelMeasure !== undefined) {
    return;
  }
  cancelMeasure = flow.afterFrame('the album is re-measured', () => {
    cancelMeasure = undefined;
    measure();
  });
}

/**
 * THE PICK BRIDGE IS A PHRASE, never a cut (the owner's hard rule 2026-10-13 — the 4K storyboard showed the
 * composer gone in one frame and the album there in the next). `post`: the album has rendered its pick and the
 * stage its last frame — the phrase poses both inline before this flush paints. A stage that CLOSED under the pick
 * (the play left) has nothing to resume; a discard the pick answered owns its own exit (the tray seizes the cards).
 */
watch(() => stagePickOut.value, (out: boolean, was: boolean): void => {
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined || out === was || !(rootNow instanceof HTMLElement)) {
    return;
  }
  if (out) {
    handStagePickPause(rootNow);
  } else if (stageOpen.value && !props.discarding) {
    handStagePickResume(rootNow, () => emit('pick-resumed'));
  } else {
    emit('pick-resumed');
  }
}, {flush: 'post'});
/**
 * The reveal flights must decode the DESTINATION'S file — stamp the
 * album's tier for the layer's proxies (perf iteration 3).
 */
watch(() => handArtTier.value, (tier: CardArtTier) => {
  handRevealState.artTier = tier;
}, {immediate: true});
/** Thumb-tier albums prewarm the FOCUSED card's full art (debounced) so
 *  the fullscreen inspector opens onto an already-decoded picture — the
 *  played grid's exact pattern. */
watch(() => focusName.value, () => {
  cancelPrewarm();
  const name = focusName.value;
  if (handArtTier.value !== 'thumb' || name === undefined) {
    return;
  }
  cancelPrewarm = flow.after(160, 'the focused card\'s art prewarm (debounced)', () => {
    preloadPremiumCardArt([name as CardName]);
  });
}, {immediate: true});
/**
 * Publish / retract the TELEPORT TARGET as the stage zone comes and goes.
 * The consumer depends on this VALUE, not on a `document.querySelector` in
 * a computed — a computed tracks reactive reads, not the DOM, so it would
 * never re-run when the node appears, and a teleport whose target does not
 * exist drops its content on the floor.
 */
watch(() => stageOpen.value, (on: boolean) => {
  setWorkspaceFrameSlot('hand', on ? '[data-embed-slot="hand-play"]' : '');
}, {
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
});
/**
 * The FLEET BERTH the hosted colonies' dock teleports into (TR07) — offered
 * while the step stands, retracted the moment it leaves, so the section
 * falls back to its own toolbar for a host with no header. POST-flush, the
 * slot's law: the node exists before anyone resolves it.
 */
watch(() => berthOffered.value, (on: boolean) => {
  if (on) {
    offerColonyFleetBerth('hand', '[data-colony-fleet-berth]');
  } else {
    retractColonyFleetBerth('hand');
  }
}, {immediate: true, flush: 'post'});
/** The OUTCOME zone, same law and same reason (POST-flush: the shell is our
 *  parent and resolves the teleport before we have rendered the node). */
watch(() => outcomeZoneOn.value, (on: boolean) => {
  if (on) {
    setWorkspaceOutcomeSlot('[data-embed-slot="hand-outcome"]');
  } else {
    // Only OUR selector: the claim may already have moved to another host.
    retractWorkspaceOutcomeSlot('[data-embed-slot="hand-outcome"]');
  }
}, {immediate: true, flush: 'post'});
/* ── FOCUS IDENTITY + PAGE DERIVATION ─────────────────────────────────
   Declared in this order ON PURPOSE — watchers fire in declaration order
   within one flush, so an explicit index write (the shell seating a pick)
   refreshes the anchor BEFORE the entries watcher could «follow» a card
   the player is no longer on. */
watch(() => props.index, () => {
  focusName.value = props.entries[clampNum(0, Math.max(0, props.entries.length - 1), props.index)]?.card.name;
  // A step DURING the cursor's arrival IS the arrival — the ring comes to the new card now, input never waits for
  // an animation (TR58). While the copies still fly the slots are held anyway (`transitHold`).
  if (!props.transitHold && handCursor.pending) {
    releaseCursor(handCursor);
  }
});
/** A MODE flip re-seats the cursor semantics (select/sale enter and leave
 *  set their own index) — adopt the current position as the new anchor
 *  even when the number itself did not change. */
watch(() => modeKey.value, () => {
  focusName.value = props.entries[clampNum(0, Math.max(0, props.entries.length - 1), props.index)]?.card.name;
});
/**
 * FOCUS FOLLOWS THE CARD, NOT THE NUMBER. When the entries re-sort (a card
 * became unplayable and sank in the playable-first order) or shrink, the
 * cursor stays on the card it was on; only when that card is GONE does it
 * fall back to the nearest logical slot (same index, clamped) — never to a
 * random first page. The active page follows by derivation.
 */
watch(() => props.entries, (list: ReadonlyArray<ConsoleHandEntry>) => {
  const len = list.length;
  if (len === 0) {
    if (consoleState.handIndex !== 0) {
      consoleState.handIndex = 0;
    }
    focusName.value = undefined;
    return;
  }
  const cur = clampNum(0, len - 1, props.index);
  const curName = list[cur]?.card.name;
  if (focusName.value !== undefined && curName !== focusName.value) {
    const at = list.findIndex((e) => e.card.name === focusName.value);
    if (at >= 0) {
      consoleState.handIndex = at;
      return;
    }
  }
  if (props.index > len - 1) {
    consoleState.handIndex = len - 1;
  }
  focusName.value = list[clampNum(0, len - 1, consoleState.handIndex)]?.card.name;
});
/** The page turn's will-change window + the settled-page render anchor. */
watch(() => activePage.value, (now: number) => {
  if (!pageMotionLive.value || props.transitHold) {
    settledPage.value = now;
    return;
  }
  turning.value = true;
  cancelTurnSafety();
  cancelTurnSafety = flow.after(TURN_SAFETY_MS, 'the page turn\'s safety release', () => {
    turning.value = false;
    settledPage.value = activePage.value;
  });
});

onMounted(() => {
  const albumNow = album.value ?? undefined;
  if (albumNow !== undefined && typeof ResizeObserver !== 'undefined') {
    ro = markRaw(new ResizeObserver(() => scheduleMeasure()));
    ro.observe(albumNow);
  }
  measure();
  focusName.value = props.entries[clampNum(0, Math.max(0, props.entries.length - 1), props.index)]?.card.name;
  settledPage.value = activePage.value;
  // Arm the page-slide transition only after the first paint has settled:
  // a fresh open (possibly restored onto page 3) must LAND on its page,
  // never slide to it from x = 0.
  void nextTick(() => {
    flow.afterFrame('the first paint settles', () => {
      pageMotionLive.value = true;
    });
  });
});
onBeforeUnmount(() => {
  // Retract the target HERE, never from the flow side: a stale selector
  // teleports the next surface into a detached node, and the unmount watcher
  // does not fire (Vue tears the component down before its watchers run).
  setWorkspaceFrameSlot('hand', '');
  // …and the fleet berth this header lent the hosted colonies, by the same law.
  // UNCONDITIONALLY — by the time the hand unmounts the colonies frame is
  // usually gone, so «am I offering?» already reads false while the berth we
  // lent is still published (the field crash of game-pdb19bfa). Only OUR berth
  // is taken back.
  retractColonyFleetBerth('hand');
  // …AND THE OUTCOME ZONE IS THE SAME LAW — PARK INCLUDED. The CLAIM
  // deliberately survives «свернуть» (below); the DOM node does not, and the
  // slot describes a NODE. Left published, it is not merely stale: a
  // `<Teleport>`'s `to` is UNCHANGED across the park, so Vue never re-resolves
  // it and keeps the DETACHED div as its target — the restored surface then
  // mounts into a node that is not in the document. Measured on «Марсианский
  // университет»: collapse the embedded decision, return from the board card,
  // and the crumb, the kicker and the command bar all announce the stage while
  // NOTHING is on screen (`[console-leak-detector] STRANDED PROMPT: "or"`).
  // Cleared here, the host re-publishes the same selector on its way back and
  // that CHANGE is what makes the teleport look the target up again. Guards
  // all four consumers of the zone at once — the embedded reveal, the deck
  // pick, the buy prompt and the effect decision.
  // Only OUR zone (ledger HC) — never a slot another host published meanwhile.
  retractWorkspaceOutcomeSlot('[data-embed-slot="hand-outcome"]');
  // A CLAIM CAN NEVER OUTLIVE ITS FLOW: an orphaned one is worse than a leak
  // (it suppresses the standalone presenters, so the artifact shows NOWHERE).
  // …unless the workspace was PARKED — «свернуть» keeps the whole decision
  // alive at full depth, and its surface unmounting is exactly how that
  // looks. (The raw claim is read here, not the gated computed: the park
  // happens BEFORE this hook and would already have flipped it false.)
  if (outcome.host === 'hand' && outcome.sourceCard !== '' &&
      !workspaceFrameParked('hand')) {
    // …AND «THIS STEP IS OVER» IS NOT «THE FLOW IS OVER». When the hand is a
    // STEP of another workspace («Эпатажный спонсор» plays a project from
    // inside the Game Start Workspace), the step exists only for the play and
    // unmounts the moment the card lands — beats before the play's own
    // follow-up arrives. The outcome then belongs one level UP, to the
    // workspace the player never left; released here it belonged to nobody,
    // and «Деловые контакты» raised its pick as a standalone band over a
    // deployment that had already started its next stage on top of it.
    if (!rehomePlayOutcome('hand')) {
      releaseWorkspaceOutcome('hand-unmount');
    }
  }
  ro?.disconnect();
});
defineExpose({ensureSelectedVisible, move, packetHomeRects, restoreScroll, stickScroll, transitionTargets, turnPage});
</script>
