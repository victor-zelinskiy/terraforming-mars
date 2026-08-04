<template>
  <!-- THE GAME START WORKSPACE. One root, two bounds of one surface:
        · PREPARATION — full-bleed (the standard Top Bar and the Player Rail
          are hidden: the player has no game state yet), the frame is a real
          bounded workspace plate on an opaque premium room;
        · DEPLOYMENT (`--bounded` + the `con-ws` marker) — the SYSTEM
          workspace band: right of the player rail, between the two bars,
          on the shared seam tokens (--con-ws-left / --con-band-*). The
          `con-ws` marker lifts + rings the rail exactly like every other
          workspace of the family — never a hand-measured inset. -->
  <div class="con-start"
       :class="{
         'con-start--ceremony': mode === 'ceremony',
         'con-start--bounded': shellBounded,
         'con-ws': shellBounded,
         'con-start--matcut': matCut,
         'con-start--materializing': state.flow === 'materializing',
         'con-start--releasing': state.flow === 'releasing',
         'con-start--resolved': state.flow === 'releasing',
       }"
       role="dialog" :aria-label="$t('Start of the game')">
    <div class="con-start__bg" aria-hidden="true"></div>

    <!-- ONE PERSISTENT FRAME. Never keyed, never `out-in`-swapped: the wizard
         panes, the summary and the deployment are LAYERS of one workspace —
         a stage change is a pane motion under the dock flights (the director),
         never a page replacement through an empty slot. -->
    <div class="con-start__frame">
        <!-- ── Header: the ONE system Workspace header (ConsoleWsHead) ──
             The Game Start Workspace speaks the project's header grammar
             from the first second: СТАРТ ПАРТИИ › <ЭТАП> [› <ФАЗА>]. The aux
             zone hosts the JOURNEY RAIL (the reusable multi-stage primitive:
             tabs while the preparation is reversible, a linear progress
             readout once the deployment runs) + the pick counter. The
             TRAILING zone carries the compact PARTICIPANT strip — the
             standard top HUD is hidden through the whole preparation, but
             who is choosing / who is ready stays readable (same status brain
             as the strip, so they can never disagree). -->
        <ConsoleWsHead class="con-start__wshead"
                       root="Start of the game"
                       mark="◈"
                       :subject="wsSubject"
                       :stage="wsStage"
                       :committed="mode === 'ceremony'">
          <!-- The aux BROWSE layer only RESERVES the zone's height (the crumb
               is always deep here: СТАРТ ПАРТИИ › <ГРУППА> › <ЭТАП>); the
               live journey renders in the deep tail beside the stage. -->
          <div class="con-start__auxrow">
            <ConsoleJourneyRail :items="journeyItems" :mode="mode === 'wizard' ? 'tabs' : 'progress'" />
          </div>
          <template #deep>
            <ConsoleJourneyRail class="con-start__jtail"
                                :items="journeyItems"
                                :mode="mode === 'wizard' ? 'tabs' : 'progress'" />
          </template>
          <template #trailing>
            <!-- Card-step pick counter (wizard): a plain «Выбрано N из M»;
                 re-keyed on a blocked RB press so the chip replays its
                 one-shot nudge (what still gates the step). -->
            <span v-if="mode === 'wizard' && currentStep !== undefined" :key="'cnt' + counterNudge"
                  class="con-start__count"
                  :class="{'con-start__count--ready': currentStepComplete, 'con-start__count--nudge': counterNudge > 0}">
              {{ $t('Selected') }} <b>{{ picksHere.length }}</b> {{ ofMaxText }}
            </span>
            <!-- PARTICIPANT READINESS (preparation only — in the deployment
                 the real top strip is back and owns this). Compact by design:
                 seat dot · name · status. Never the whole game HUD. -->
            <div v-if="mode === 'wizard' || state.flow === 'materializing'" class="con-start__crewline" aria-live="polite">
              <span v-for="p in participants" :key="p.color"
                    class="con-start__crewchip"
                    :class="{'con-start__crewchip--self': p.self, 'con-start__crewchip--ready': p.status.category !== 'active'}">
                <span :class="'con-start__crewdot player_bg_color_' + p.color" aria-hidden="true"></span>
                <span class="con-start__crewname">{{ participantName(p) }}</span>
                <span class="con-start__crewstate">
                  <span v-if="p.status.category !== 'active'" class="con-start__crewtick" aria-hidden="true">✓</span>
                  {{ $t(p.status.textKey) }}
                </span>
              </span>
            </div>
          </template>
        </ConsoleWsHead>

        <!-- ── WIZARD: the PARKED step panes ─────────────────────────
             Every card step's surface is MOUNTED ONCE and PARKED (v-show):
             a revisited step is the same physical table the player left —
             same card instances, same slots, no re-deal, no re-materialize
             (`--settled` mutes the first-visit stagger), focus and scroll
             restored by the frame watcher. The pane swap itself hides under
             the Selection Dock flights (collect on RT / return on LT). -->
        <div v-show="mode === 'wizard' && currentStep !== undefined"
             class="con-start__body con-start__body--cards con-info__scroll" ref="body">
          <div v-for="(st, si) in steps" :key="st.id"
               class="con-start__steppane" v-show="railPos === si"
               :ref="(el) => setPaneRef(si, el)">
            <div class="con-cards">
              <div class="con-cards__strip"
                   :class="{
                     'con-cards__strip--grid': st.input.cards.length > 6,
                     'con-cards__strip--few': st.input.cards.length <= 3,
                     'con-cards__strip--has-focus': st.input.cards.length > 0,
                     'con-start__strip--settled': state.visited.has(si),
                   }"
                   :ref="(el) => setStripRef(si, el)">
                <div v-for="(card, i) in st.input.cards" :key="card.name + '#' + i"
                     class="con-cards__slot con-start__deal"
                     :style="railPos === si && !state.visited.has(si) ? dealDelay(i) : {}"
                     :data-zoom-slot="railPos === si ? card.name : undefined"
                     :data-step-slot="st.id + '|' + card.name"
                     :class="{
                       'con-cards__slot--focused': railPos === si && focusIdx === i,
                       'con-cards__slot--picked': stepPicked(st, card.name),
                       'con-cards__slot--dim': railPos === si && dimUnpicked && !stepPicked(st, card.name),
                       'con-deal-hold': (railPos === si && deal.isHeld(card.name + '#' + i)) || returningNames.has(st.id + '|' + card.name),
                     }"
                     :ref="railPos === si && focusIdx === i ? 'focusedCardSlot' : undefined">
                  <Card :card="card" :key="card.name" lightweight />
                  <span v-if="stepPicked(st, card.name)" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── WIZARD: the final summary ────────────────────────────────
             P15: a COMPACT confirmation screen — every card at ONE mini
             scale (cards column left, the money report + the begin CTA in
             a fixed side rail right), never a loose scrollable leftovers
             page. X browses the whole setup fullscreen. -->
        <div v-show="summaryShown" class="con-start__body con-start__summary con-info__scroll"
             ref="summaryPane">
          <div class="con-start__summary-cards">
            <div class="con-start__summary-row">
              <div v-if="state.corp !== undefined" class="con-start__summary-block">
                <div class="con-start__section-title">{{ $t('Corporation') }}</div>
                <div class="con-start__minirow">
                  <div class="con-start__mini con-start__mini--id con-start__deal"
                       :class="{'con-start__mini--focused': isSummaryFocused(0), 'con-deal-hold': state.corp !== undefined && (summaryArriving.has(state.corp) || summaryStowing.has(state.corp))}"
                       :ref="isSummaryFocused(0) ? 'focusedCardSlot' : undefined"
                       :data-zoom-slot="state.corp">
                    <Card :card="{name: state.corp}" :key="state.corp" lightweight />
                  </div>
                </div>
              </div>
              <div v-if="state.preludes.length > 0" class="con-start__summary-block">
                <div class="con-start__section-title">{{ $t('Preludes') }}</div>
                <div class="con-start__minirow">
                  <div v-for="(name, i) in state.preludes" :key="name"
                       class="con-start__mini con-start__mini--id con-start__deal"
                       :class="{'con-start__mini--focused': isSummaryFocused(summaryPreludeBase + i), 'con-deal-hold': summaryArriving.has(name) || summaryStowing.has(name)}"
                       :ref="isSummaryFocused(summaryPreludeBase + i) ? 'focusedCardSlot' : undefined"
                       :data-zoom-slot="name">
                    <Card :card="{name}" :key="name" lightweight />
                  </div>
                </div>
              </div>
              <div v-if="state.ceo !== undefined" class="con-start__summary-block">
                <div class="con-start__section-title">{{ $t('CEO') }}</div>
                <div class="con-start__minirow">
                  <div class="con-start__mini con-start__mini--id"
                       :class="{'con-start__mini--focused': isSummaryFocused(summaryCeoIdx)}"
                       :ref="isSummaryFocused(summaryCeoIdx) ? 'focusedCardSlot' : undefined"
                       :data-zoom-slot="state.ceo"><Card :card="{name: state.ceo}" :key="state.ceo" lightweight /></div>
                </div>
              </div>
            </div>
            <div class="con-start__summary-block">
              <div class="con-start__section-title">{{ $t('Projects') }} · {{ state.projects.length }}</div>
              <div v-if="state.projects.length > 0" class="con-start__minirow con-start__minirow--wrap">
                <div v-for="(name, i) in state.projects" :key="name"
                     class="con-start__mini con-start__deal"
                     :class="{'con-start__mini--focused': isSummaryFocused(summaryProjectBase + i), 'con-deal-hold': summaryArriving.has(name) || summaryStowing.has(name)}"
                     :ref="isSummaryFocused(summaryProjectBase + i) ? 'focusedCardSlot' : undefined"
                     :data-zoom-slot="name">
                  <Card :card="{name}" :key="name" lightweight />
                </div>
              </div>
              <div v-else class="con-start__none">{{ $t('You are not buying any project cards') }}</div>
            </div>
          </div>
          <aside class="con-start__summary-side">
            <!-- ═══ EXPANDED STARTUP STATUS PREVIEW ═══
                 The summary's status panel in the visual language of the
                 FUTURE in-game HUD: this exact panel physically transforms
                 into the Top HUD + Player Rail on the commit (Game State
                 Materialization) — it is the game state's visible source,
                 never a loose money footnote. Values are authoritative only
                 (shared money brain / printed production / printed tags). -->
            <div v-if="preview !== undefined" class="con-start__hudprev" ref="hudPrev">
              <div class="con-start__hudprev-head">
                <span class="con-start__hudprev-kicker">{{ $t('Starting state') }}</span>
                <span class="con-start__hudprev-corp">
                  <span :class="'con-start__crewdot player_bg_color_' + playerView.thisPlayer.color" aria-hidden="true"></span>
                  {{ $t(preview.corp) }}
                </span>
              </div>
              <div class="con-start__hudprev-money">
                <div class="con-start__money-line"><span>{{ $t('Starting funds') }}</span>
                  <b>{{ preview.start }} <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b></div>
                <div v-if="preview.buys > 0" class="con-start__money-line"><span>{{ $t('Projects') }}: {{ preview.buys }} × {{ preview.cardCost }}</span>
                  <b>−{{ preview.projectsCost }} <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b></div>
                <div v-if="preview.preludeDelta !== 0" class="con-start__money-line"><span>{{ $t('Prelude effects') }}</span>
                  <b>{{ preview.preludeDelta > 0 ? '+' : '' }}{{ preview.preludeDelta }} <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b></div>
                <div class="con-start__money-line con-start__money-line--total"><span>{{ $t('Remaining') }}</span>
                  <b>{{ preview.remaining }} <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b></div>
              </div>
              <!-- The QUICK DECISION line — what is chosen, in two compact
                   chips. Deliberately minimal: the cards themselves already
                   state their effects; this panel answers only «что выбрано
                   и сколько денег останется». -->
              <div class="con-start__hudprev-grid">
                <span class="con-start__hudprev-cell">
                  <span class="con-start__hudprev-label">{{ $t('Starting hand') }}</span>
                  <b>{{ preview.handSize }}</b>
                </span>
                <span v-if="preview.preludeCount > 0" class="con-start__hudprev-cell">
                  <span class="con-start__hudprev-label">{{ $t('Preludes') }}</span>
                  <b>{{ preview.preludeCount }}</b>
                </span>
              </div>
              <div class="con-start__hudprev-ready" :class="{'con-start__hudprev-ready--ok': wizardReady}">
                {{ wizardReady ? $t('Ready to begin') : $t('Complete the remaining steps') }}
              </div>
            </div>
            <div v-if="armedSkip" class="con-start__skipwarn">
              ⚠ {{ $t('You are not buying any project cards') }} — {{ $t('Press again to confirm') }}
            </div>
            <!-- THE LAUNCH BLOCK. The summary is the setup's waiting room as
                 much as it is a review, so this ONE slot states honestly which
                 of the two it currently is, and MORPHS between them:
                  · WAITING — somebody else still owes their setup pick: a live
                    per-player readout (the SAME status brain the top strip
                    reads, so the two can never disagree) under a scanning
                    sweep. The pick is genuinely still happening — say so.
                  · LAUNCH  — nobody else owes anything: this press is the LAST
                    input the game needs, so it earns the full CTA plate.
                 A is bound in BOTH states (see `launchVerb` — a hard gate
                 would deadlock two humans); only the verb changes. The begin
                 press used to hide on RT, which advertised the biggest press
                 of the setup on the least obvious control. -->
            <div class="con-start__launch" role="status" aria-live="polite">
              <transition name="con-start-launch" mode="out-in">
                <div v-if="!launch.launches" key="wait" class="con-start__wait">
                  <span class="con-start__wait-scan" aria-hidden="true"></span>
                  <div class="con-start__wait-head">
                    <span class="con-start__wait-orbit" aria-hidden="true"><i></i><i></i><i></i></span>
                    <span class="con-start__wait-title">{{ $t('Waiting for other players') }}</span>
                  </div>
                  <div class="con-start__crew">
                    <span v-for="mate in launch.others" :key="mate.color"
                          class="con-start__mate"
                          :class="'con-start__mate--' + mate.status.category">
                      <span :class="'con-start__mate-dot player_bg_color_' + mate.color" aria-hidden="true"></span>
                      <span class="con-start__mate-name">{{ crewName(mate) }}</span>
                      <span class="con-start__mate-state">
                        <span v-if="!mate.picking" class="con-start__mate-tick" aria-hidden="true">✓</span>
                        <span>{{ $t(mate.status.textKey) }}</span>
                        <i v-if="mate.picking" class="con-start__mate-dots" aria-hidden="true"><b></b><b></b><b></b></i>
                      </span>
                    </span>
                  </div>
                  <!-- Honest secondary affordance: confirming NOW locks the
                       viewer's choice in — the wait simply continues. -->
                  <div class="con-start__wait-cta" :class="{'con-start__wait-cta--off': !wizardReady}">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Submit your choice') }}</span>
                  </div>
                </div>
                <div v-else key="go" class="con-start__beginline" :class="{'con-start__beginline--off': !wizardReady}">
                  <span class="con-start__beginline-flash" aria-hidden="true"></span>
                  <GamepadGlyph control="confirm" /><span>{{ $t('Begin the game') }}</span>
                </div>
              </transition>
            </div>
          </aside>
        </div>

        <!-- ── CEREMONY — the DEPLOYMENT ───────────────────────────────
             Three physical places, one causal story:
              · the STARTUP QUEUE — every unresolved start card (corporation,
                preludes, draw candidates, the bought projects until they are
                paid) stands HERE as one persistent row. A resolved card
                LEAVES it physically; the others only ever slide over
                (transition-group move) — nothing unmounts, nothing re-deals;
              · the EMBED zone — a card that draws/picks other cards opens
                its follow-up (the shared reveal) INSIDE this workspace, in
                this slot; the queue yields visual priority but stays mounted;
              · the PLAYED zone — the REAL «Разыграно» (owner + category
                piles on the shared ConsolePlayedPile primitive). A pressed
                card flies DIRECTLY down into its reserved pile slot — no
                central holding presentation, no handoff copies. -->
        <div v-if="mode === 'ceremony'" class="con-start__body con-start__ceremony"
             :class="{'con-start__ceremony--hidden': !ceremonyRevealed}" ref="ceremonyBody">
          <!-- ── THE DEPLOYMENT — one row, three physical places ──
                · the QUEUE COLUMN (left, the protagonist): every unresolved
                  start card + the bought-projects purchase row; the embedded
                  follow-up (the shared reveal) is an OVERLAY LAYER of this
                  same column — the queue recedes in place, never unmounts;
                · the COMPACT PLAYED DOCK (right): «РАЗЫГРАНО · owner», the
                  destination-focused receiving stacks;
                · the HAND DOCK (the shell's own footer bay, visible below the
                  band by construction) — the bought / drawn cards' landing. -->
          <div class="con-start__deploy">
            <div class="con-start__queuecol" :class="{'con-start__queuecol--yield': embedActive}">
              <div class="con-start__queue" ref="queueEl">
                <!-- ONE transition-group holds the whole reading order of the
                     start: КОРПОРАЦИЯ (order 1) → КУПЛЕННЫЕ ПРОЕКТЫ (the buy
                     block, order 2) → ПРОЛОГИ (order 3) — the player's real
                     action sequence, kept by flex `order` so the FLIP moves
                     still share one container. -->
                <transition-group name="con-start-shift" tag="div" class="con-start__queue-row">
                  <div v-for="entry in queueCards" :key="entry.name"
                       class="con-start__qcard con-start__deal"
                       :style="{order: entry.kind === 'prelude' ? 3 : 1}"
                       :class="{
                         'con-start__qcard--focused': isFocused(entry.kind, entry.name),
                         'con-start__qcard--awaiting': entry.dimmed,
                         'con-deal-hold': queueArriving.has(entry.name) || heroDepartedName === entry.name || deal.isHeld(entry.name + '#' + entry.dealIdx),
                       }"
                       :data-zoom-slot="entry.name"
                       :data-queue-slot="entry.name">
                    <Card :card="{name: entry.name}" :key="entry.name" lightweight />
                    <span v-if="entry.badge !== undefined" class="con-cards__pickband" :class="entry.badgeClass">{{ $t(entry.badge) }}</span>
                    <div v-if="entry.reason !== undefined" class="con-cards__reason">{{ $t(entry.reason) }}</div>
                    <div v-else-if="isFocused(entry.kind, entry.name) && entry.verb !== undefined" class="con-start__slot-a">
                      <GamepadGlyph control="confirm" /><span>{{ $t(entry.verb) }}</span>
                    </div>
                  </div>

                  <!-- The BOUGHT PROJECTS — part of the queue until the payment
                       resolves them into the hand (they keep their pay-grid
                       identity: runHandDelivery measures [data-pay-card]). -->
                  <div v-if="payProjects.length > 0" key="#buy" class="con-start__buy"
                       :style="{order: 2}"
                       :class="{'con-start__buy--focused': isFocused('pay', PAY_KEY)}">
                    <div class="con-start__buy-row" ref="payGrid">
                      <div v-for="name in payProjects" :key="name"
                           class="con-start__buycard"
                           :class="{'con-deal-hold': queueArriving.has(name)}"
                           :data-pay-card="name">
                        <Card :card="{name}" :key="name" lightweight />
                      </div>
                    </div>
                    <div class="con-start__buy-meta">
                      <span class="con-start__buy-cap">{{ $t('Bought cards') }} · <b>{{ payProjects.length }}</b></span>
                      <span v-if="corpPayCost !== undefined" class="con-start__buy-amount">−{{ corpPayCost.megacredits }}<i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></span>
                      <div v-if="isFocused('pay', PAY_KEY)" class="con-start__slot-a">
                        <GamepadGlyph control="confirm" /><span>{{ $t('Pay') }}</span>
                      </div>
                    </div>
                  </div>
                </transition-group>
              </div>

              <!-- EMBEDDED FOLLOW-UP: the shared reveal teleports HERE (claim
                   'start') as an overlay LAYER of the queue column — the same
                   Header / Status Rail / Footer frame it deepens, never a
                   modal over the workspace. The zone stands from the claim's
                   first frame (a teleport needs its target before the search).
                   THE SOURCE CARD STAYS IN THE STEP: it physically EMERGES
                   from its dock stack into the left column (its slot keeps
                   geometry, face away — one visual owner), presides over the
                   draw, and SETTLES back into the stack on release. -->
              <div class="con-start__embed" data-embed-slot="start"
                   :class="{'con-start__embed--live': embedActive}">
                <div v-if="embedSourceShown !== undefined" class="con-start__embedsource" ref="embedSourceCol">
                  <span class="con-start__embedsource-cap">{{ $t('Source') }}</span>
                  <div class="con-start__embedsource-card"
                       :class="{'con-deal-hold': embedSourceArriving}"
                       data-embed-source-slot>
                    <ConsolePlayedCardLite :name="embedSourceShown" />
                  </div>
                </div>
              </div>
            </div>

            <!-- ── THE COMPACT PLAYED DESTINATION — «РАЗЫГРАНО · owner» ── -->
            <ConsoleStartPlayedDock :playerView="playerView" :awayCard="embedSourceShown" />
          </div>
        </div>

        <!-- ── THE SELECTION DOCK (preparation shelf) ─────────────────
             The decisions already made lie here as compact face-down piles,
             physically collected on RT and returned on LT (startDockMotion).
             Not the Hand Dock, not the Played Tableau — everything here is
             still reversible until the summary commit. -->
        <ConsoleStartSelectionDock v-if="mode === 'wizard' || state.flow === 'materializing'" :piles="dockPileView" />

        <!-- ── PINNED STATUS RAIL ───────────────────────────────────────
             The focused card's LOCAL state ONLY (name + picked / limit /
             unaffordable / hint) — NEVER the global «N из M» progress (that
             is the header counter). Pinned as the frame's last child so it
             sits directly above the command bar with a STABLE height: the
             card area (flex:1 body above) fills all the space down to it,
             and a message swap never shifts the cards. Wizard card step only;
             hidden while the deal cinematic runs (nothing interactive yet). -->
        <!-- CEREMONY status rail — the same shared workspace status line:
             the focused queue card + its resolution context. Never the full
             startup status, never an effect breakdown. -->
        <!-- The rail STAYS through the embedded reveal (its height is part of
             the deploy zone's geometry — unmounting it mid-embed re-flowed
             the queue and the dock under the open surface): the content
             simply names the deeper step. -->
        <div v-if="mode === 'ceremony' && ceremonyRevealed"
             class="con-start__statusrail con-start__statusrail--hint">
          <div class="con-start__status-inner">
            <span class="con-start__status-name" :key="ceremonyStatusName">{{ ceremonyStatusName }}</span>
            <span v-if="ceremonyStatusText !== ''" class="con-start__status-state">{{ ceremonyStatusText }}</span>
          </div>
        </div>

        <div v-if="mode === 'wizard' && currentStep !== undefined"
             class="con-start__statusrail" :class="statusRailClass">
          <!-- The rail's HEIGHT is reserved for the whole card step; only its
               CONTENT is hidden while the deal cinematic runs (--held: opacity,
               never an unmount) — so the card area never resizes / jumps when
               the rail's text appears. The inner is PERSISTENT: a d-pad move
               only re-keys the NAME (a one-shot settle) — the state chip
               («Выберите ещё N») patches in place and never blinks (the old
               wholesale keyed out-in faded the whole rail on every move). -->
          <div class="con-start__status-inner"
               :class="{'con-start__status-inner--held': deal.state.active}">
            <span class="con-start__status-name"
                  :key="focusedCard ? focusedCard.name : 'none'">{{ focusedCard ? $t(focusedCard.name) : '' }}</span>
            <span v-if="statusRailText !== ''" class="con-start__status-state"
                  :key="'st' + blockedNudge">{{ statusRailText }}</span>
            <!-- The ONE quick summary (workspace status-rail grammar): the
                 live economy in a compact chip — funds on the identity steps,
                 the full buy line on the projects step. The deep breakdown
                 belongs to the summary's status preview, never up here. -->
            <span v-if="budget !== undefined" class="con-start__status-quick"
                  :class="{'con-start__status-quick--broke': budget.remaining + budget.preludes < 0}">
              <template v-if="!moneyCompact">
                <span class="con-start__status-quick-part">{{ $t('Projects') }} {{ budget.buys }} × {{ budget.cardCost }}</span>
                <span class="con-start__status-quick-sep" aria-hidden="true">·</span>
              </template>
              <span class="con-start__status-quick-part con-start__status-quick-part--strong">
                {{ $t('Funds') }} {{ moneyCompact ? moneyAvailable : budget.remaining + budget.preludes }}
                <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i>
              </span>
            </span>
          </div>
        </div>

        <!-- The command contract lives in the shell's command bar ONLY
             (footHints → setConsoleStartCommands). The old inline footer
             duplicated it UNDER the bar (z 11700 covers the frame bottom)
             — removed, its height goes to the cards; the frame's bottom
             padding keeps the body clear of the bar. -->
      </div>

    <!-- The Selection-Dock flight layer (collect / return / summary reveal
         proxies — startDockMotion). ONE fixed stage, scene-owned. -->
    <div class="con-startdock-layer" ref="dockLayer" aria-hidden="true"></div>

    <!-- The deal cinematic stage: deck + lite proxy flyers (GSAP). Alive
         only while a deal runs — will-change is scoped by construction. -->
    <ConsoleCardDealLayer v-if="deal.state.active" ref="dealLayer"
                          :cards="deal.state.cards" :nonce="deal.state.nonce" />
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE START SCENE — CTS T5 (docs/CONSOLE_MODE_CONCEPT.md §CTS-1). The
 * console-native game-opening experience, replacing BOTH desktop start
 * surfaces (InitialDraftFlowOverlay + StartGameFlowOverlay) in console
 * mode with one cohesive full-screen scene:
 *
 *  WIZARD (`initialCards`): corporation → preludes → (CEO) → project buy
 *  → summary, with a step rail, a LIVE budget capsule (the shared
 *  initialDraftMoney math — Manutech/Tharsis/… corp×prelude pairs never
 *  fork), the shared `.con-cards` inspector+filmstrip, and a byte-parity
 *  `{type:'initialCards', responses}` submit (consoleStartState).
 *
 *  CEREMONY (`startSequence`): the corp column (status badges + «Apply
 *  effect») beside the prelude progress rail (played ✓ / playable pulse /
 *  awaiting / fizzle-blocked with the honest hint) and, when the live ask
 *  is a pick (drew-N-choose-1 / Double Down copy / Merger corp choice),
 *  a dedicated candidate strip. All predicates are REUSED from
 *  startGameFlowState (one brain, marker-driven — never title text).
 *
 * Grammar (the 2026-07 polish pass): ←/→/↑/↓ navigate · A = the exact
 * contextual verb — select / deselect a card (single-pick replaces +
 * advances; a limit-blocked card has NO A at all — the context rail
 * explains), and the ONE launch commit on the summary (zero-projects arms
 * an inline warning first) · X = the focused card fullscreen (the
 * viewer's A toggles the pick via the select context) · LB/RB = the
 * symmetric STEP navigation (RB gated on step validity; stops AT the
 * summary) · B = minimize to inspect the board (intentional — the amber
 * chip returns; ceremony B = defer as before). RT/LT are unused here.
 * Picks live in module state (consoleStartState) so defer / re-renders
 * never lose them. Sub-actions (payments, placements) arrive as normal
 * prompts → the scene yields to the T1–T4 native tasks and returns.
 */
import {defineComponent, PropType} from 'vue';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel, SelectCardModel, SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction, ConsoleActionOverrides} from '@/client/console/composables/consoleActionModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {
  buildInitialCardsResponse, clearDockDrift, consoleStartState, deploymentCrumb, deploymentJourneyItems,
  driftDockPile, ensureStartWizard, holdStartScene, initialCardsInputOf, initialCardsSignature,
  picksForStep, releaseStartScene, StartCrewMate, StartCrumb, StartDockPileModel, startFlowBusy,
  StartLaunchState, StartParticipant, startDockPiles, startJourneyItems, startLaunchState,
  startParticipants, StartWizardStep, stepComplete, wizardCrumb, wizardSteps,
} from '@/client/console/consoleStartState';
import {buildStartStatusPreview, StartStatusPreview} from '@/client/console/startStatusPreview';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {afterPreludes, cardCostForCorp, startingMegacredits} from '@/client/components/initialDraft/initialDraftMoney';
import {
  corporationCardNames, PreludeEntry, preludeEntries, recordDrawChoice,
  startFlowCorpPayPrompt, startFlowCorpPlayPrompt, startFlowCorpSelectPrompt,
  startFlowPreludeCopyPrompt, startFlowPreludeDrawPrompt, startFlowPreludePrompt,
} from '@/client/components/startGameFlow/startGameFlowState';
import {
  armPlayedHero, isPlayedHeroActive, playedHeroState,
} from '@/client/console/played/consolePlayedHero';
import ConsoleStartPlayedDock from '@/client/components/console/ConsoleStartPlayedDock.vue';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';
import {
  claimWorkspaceOutcome, markWorkspaceOutcomePresenting, releaseWorkspaceOutcome,
  setWorkspaceOutcomeSlot, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive} from '@/client/console/handDock/handDeliveryDirector';
import {captureCards, collectToDock, returnFromDock, reseatCards, registerStartDockLayer, resetStartDockMotion, DockFlightSource} from '@/client/console/startDockMotion';
import {gsap} from 'gsap';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleJourneyRail, {JourneyItem} from '@/client/components/console/foundation/ConsoleJourneyRail.vue';
import ConsoleStartSelectionDock from '@/client/components/console/ConsoleStartSelectionDock.vue';
import {armDeliveryHold, runHandDelivery} from '@/client/console/handDock/handDeliveryDirector';
import {extractPlayRewards, ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {cardsResponse} from '@/client/console/taskResponses';
import {setConsoleStartCommands, resetConsoleStartUi, startSceneCommands, StartCommand} from '@/client/console/consoleStartUi';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {applyDiscardExit, runHeroPick} from '@/client/console/cardDeal/cardExitDirector';
import {createCardDealSequence} from '@/client/console/cardDeal/cardDealSequence';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {nearestInDirection, rowFitZoom, gridFitPlan} from '@/client/console/consoleStartNav';
import {motionMs} from '@/client/components/motion/motionTokens';
import ConsoleCardDealLayer from '@/client/components/console/cardDeal/ConsoleCardDealLayer.vue';


function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}


type Focusable = {kind: 'corp' | 'prelude' | 'candidate' | 'pay', name: CardName, disabled: boolean};

/** The card-payment beat's synthetic focus key (it is not a card). */
const PAY_KEY = '#pay' as CardName;

/**
 * The initial-setup input remap: STEP navigation lives on LT / RT (the
 * triggers), not LB / RB. The bumpers are neutralized to prevTab / nextTab
 * (unused by this scene) so an old LB / RB habit does nothing instead of
 * stepping. The triggers are otherwise idle during setup (RT / LT keep their
 * in-game quick-wheel role only OUTSIDE this scene), so there is no conflict.
 */
const START_INPUT_OVERRIDES: ConsoleActionOverrides = {
  triggerL: 'prevSection',
  triggerR: 'nextSection',
  bumperL: 'prevTab',
  bumperR: 'nextTab',
};

/**
 * Fit-zoom ceilings (× conUiScale). Deliberately ABOVE 1: the status rail is
 * now pinned OUTSIDE the scrollable body, so the freed height must GROW the
 * cards into it (the old 1× cap pinned corp/prelude cards at natural size and
 * wasted the space). rowFitZoom / gridFitPlan still clamp to fit both axes, so
 * a small card count never bursts the frame — the ceiling only lifts the cap.
 */
const ROW_ZOOM_CEIL = 1.35;
const GRID_ZOOM_CEIL = 1.2;

/** The stable delivery-hold key for a bought-cards set (name-derived, so it
 *  survives a reload mid-ceremony and matches between the summary-submit arm
 *  and the in-ceremony re-affirm). */
function deliveryHoldKey(names: ReadonlyArray<CardName>): string {
  return 'ceremony|' + [...names].sort().join(',');
}

export default defineComponent({
  name: 'ConsoleStartScene',
  components: {Card, GamepadGlyph, ConsoleCardDealLayer, ConsoleWsHead, ConsoleJourneyRail, ConsoleStartSelectionDock, ConsoleStartPlayedDock, ConsolePlayedCardLite},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** The LIVE `/api/waitingFor` poll (App → shell → here) — see `launch`. */
    waitingOnPlayers: {type: Array as PropType<ReadonlyArray<Color>>, default: () => []},
    /** The live start prompt's task — undefined through the deployment's
     *  prompt gaps (the LIFETIME HOLD keeps the scene mounted then). */
    task: {type: Object as PropType<ConsoleTask | undefined>, default: undefined},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      state: consoleStartState,
      focusIdx: 0,
      /** Zero-projects submit armed (second A confirms — the skip warning). */
      armedSkip: false,
      /** A pressed on a limit-blocked card → the rail message replays its
       *  one-shot settle (restrained feedback; state never changes). */
      blockedNudge: 0,
      /** RB pressed on an incomplete step → the pick counter replays its
       *  one-shot nudge (the header names what still gates the step). */
      counterNudge: 0,
      /** THIS session showed the deferred corporationPlay prompt → a played
       *  corp has physically moved to the «Разыграно» table (see corpColumn). */
      sawCorpPlayPrompt: false,
      /** One-shot dev warn for a corp played with no corporationPlay prompt. */
      warnedCorpPrompt: false,
      PAY_KEY,
      /** The deal cinematic lifecycle (holds slots, flies proxies, skips). */
      deal: createCardDealSequence(),
      dealLaunchTimer: undefined as number | undefined,
      /** Wizard-card fit (sets --con-cards-zoom / --con-cards-grid-zoom so the
       *  cards always fit BOTH axes → never scroll/clip on focus). Observers
       *  run it on resize; never per focus. */
      /** VueUse stop-handles (auto-managed listeners; no raw addEventListener). */
      stopStripObs: undefined as (() => void) | undefined,
      stopResize: undefined as (() => void) | undefined,
      fitScheduled: false,
      fitRetries: 0,
      /** The post-frame-swap re-verify fit (out-in leaves no strip to measure
       *  at the watcher's nextTick). */
      fitTimer: undefined as number | undefined,
      /**
       * PRE-FETCHED on-play rewards per ceremony card — the CORPORATION (its
       * starting M€ + its own on-play production/stock) and each PRELUDE. The
       * opening ceremony plays them STRAIGHT from this scene (no play composer
       * to extract the rewards at confirm time), so they are fetched while the
       * player is still reading the cards and handed to the hero at arm time —
       * the same premium reward beat as a normal play. A card with no cached
       * entry simply arms without a beat (its chips then fire on the commit —
       * the honest default).
       */
      playRewards: new Map<CardName, ReadonlyArray<ResourceTransferSpec>>(),
      /** Per pressable card: how many cards its play DRAWS (from the same
       *  preview branch) — the embed claim's `expectedCards`. */
      drawExpected: new Map<CardName, number>(),
      /** In-flight / done prefetches (never re-request the same card). */
      rewardFetched: new Set<CardName>(),
      /** The played-hero transaction (module reactive — the queue and the
       *  played zone derive their reserved slots from it). */
      heroState: playedHeroState,
      /** The shared claim state (embed zone presence derives from it). */
      outcome: workspaceOutcomeState,
      /** Slots whose card is FLYING BACK from a dock pile (held empty until
       *  its touchdown) — keys are `stepId|name`. */
      returningNames: new Set<string>(),
      /** Summary tiles whose card is still arriving from its pile. */
      summaryArriving: new Set<CardName>(),
      /** Queue slots whose card is still arriving (the summary re-seat / an
       *  extra prelude joining) — held empty until each touchdown. */
      queueArriving: new Set<CardName>(),
      /** A dock flight is running — step navigation waits it out. */
      dockBusy: false,
      /** Parked per-step strips (v-show panes) — index = step position. */
      stripEls: [] as Array<HTMLElement | undefined>,
      /** Parked pane roots (the stage-transition motion targets). */
      paneEls: [] as Array<HTMLElement | undefined>,
      /** The deployment shell has been REVEALED (Game State Materialization
       *  finished / a reload landed straight in the ceremony). A play press
       *  is accepted only after this — the destination-readiness gate. */
      ceremonyRevealed: false,
      /** The commit's refusal safety (a submit that never flips the mode). */
      commitSafety: undefined as number | undefined,
      /** Summary tiles whose card is being STOWED back into its pile (held
       *  empty under the departing proxies — one visual owner on the way
       *  back too, never an open tile below a flying copy). */
      summaryStowing: new Set<CardName>(),
      /** THE EMBED'S SOURCE COLUMN — the card that caused the draw, kept IN
       *  the step: emerges physically from its dock stack when the reveal
       *  presents, settles back when it releases. */
      embedSourceShown: undefined as CardName | undefined,
      /** The column slot is held empty (its card is still in flight). */
      embedSourceArriving: false,
      /** GAME FRAME MATERIALIZATION: the summary layer has been SWAPPED OUT
       *  under the flying cards (the deployment stands in its place). */
      matSwap: false,
      /** The one-frame re-bound: every shell transition is cut so the new
       *  bounds apply INSTANTLY under the proxies (never a live reflow). */
      matCut: false,
      /** The STANDARD SHELL is up: bounded band + `con-ws` + bars. Decoupled
       *  from the mode flip — the swap moment of the materialization owns it
       *  (binding it to `mode` re-bounded the LIVE summary mid-transition:
       *  clipped cards, early bars — the exact rejected frame). */
      shellUp: false,
    };
  },
  computed: {
    wf(): PlayerInputModel | undefined {
      return this.playerView.waitingFor;
    },
    wizardInput(): SelectInitialCardsModel | undefined {
      return initialCardsInputOf(this.wf);
    },
    mode(): 'wizard' | 'ceremony' {
      return this.wizardInput !== undefined ? 'wizard' : 'ceremony';
    },
    // ── wizard ───────────────────────────────────────────────────────
    steps(): Array<StartWizardStep> {
      const input = this.wizardInput;
      return input !== undefined ? wizardSteps(input) : [];
    },
    /** Clamped position; === steps.length → the summary. */
    railPos(): number {
      return Math.min(this.state.stepIdx, this.steps.length);
    },
    currentStep(): StartWizardStep | undefined {
      return this.steps[this.railPos];
    },
    /**
     * THE WORKSPACE BREADCRUMB — the one continuous line of the whole start:
     * `СТАРТ ПАРТИИ › <ГРУППА> › <ЭТАП>` from the first pick to the last
     * prelude. The subject is the stable stage GROUP, only the tail advances
     * (consoleWorkspaceHeader grammar); past the commit the header renders it
     * amber. An embedded reveal advances the tail to ITS stage name
     * (`phaseKey`, honest generic «ДОБОР КАРТ» until published) — the
     * embedded surface never titles the workspace itself.
     */
    crumb(): StartCrumb {
      if (this.mode === 'wizard') {
        return wizardCrumb(this.currentStep?.id);
      }
      return deploymentCrumb({
        embedActive: this.embedActive,
        embedPhase: this.outcome.phaseKey,
        embedSubject: this.embedSubject,
        corpPending: this.corpPlayPrompt !== undefined,
        payPending: this.corpPayCost !== undefined,
        corpPick: this.corpCandidatePick,
      });
    },
    wsSubject(): string {
      return this.crumb.subject;
    },
    wsStage(): string {
      return this.crumb.stage;
    },
    /** The bounded system shell (band + `con-ws` + bars) — up only when the
     *  materialization's swap says so, never at the raw mode flip. */
    shellBounded(): boolean {
      return this.mode === 'ceremony' && this.shellUp;
    },
    /** The embed's source GROUP (its card's manifest type) — keeps the crumb's
     *  subject honest while the reveal owns the stage tail. */
    embedSubject(): string | undefined {
      const source = this.outcome.sourceCard;
      if (source === '') {
        return undefined;
      }
      return getCard(source as CardName)?.type === CardType.CORPORATION ? 'Corporation' : 'Preludes';
    },
    /** The Journey Rail items: reversible TABS through the preparation,
     *  a linear PROGRESS readout through the deployment. */
    journeyItems(): ReadonlyArray<JourneyItem> {
      if (this.mode === 'wizard') {
        return startJourneyItems(this.steps, this.picks, this.railPos);
      }
      return deploymentJourneyItems({
        corpPending: this.corpPlayPrompt !== undefined,
        payPending: this.corpPayCost !== undefined,
        boughtCards: this.ceremonyBoughtNames.length > 0,
        preludesLeft: this.preludeRail.length,
        hasPreludes: this.preludeRail.length > 0 || this.playedPreludes.length > 0,
      });
    },
    /** The Selection Dock piles — EVERY step's pile, pre-mounted from the
     *  first frame (a flight can never target an unmounted element). Through
     *  the materialization the shelf synthesizes from the committed picks
     *  (the wizard input is gone, but the recede needs the physical shelf). */
    dockPileView(): ReadonlyArray<StartDockPileModel> {
      if (this.steps.length > 0) {
        return startDockPiles(this.steps, this.picks, this.railPos, this.state.dockDrift);
      }
      if (this.state.flow !== 'materializing') {
        return [];
      }
      // Through the shell formation the shelf keeps its COUNTS-ONLY trace
      // (the cards themselves lie in the summary tiles — backs stay 0).
      const out: Array<StartDockPileModel> = [];
      if (this.state.corp !== undefined) {
        out.push({id: 'corp', label: 'Corporation', count: 1, backs: 0, collected: true});
      }
      if (this.state.preludes.length > 0) {
        out.push({id: 'prelude', label: 'Preludes', count: this.state.preludes.length, backs: 0, collected: true});
      }
      if (this.state.ceo !== undefined) {
        out.push({id: 'ceo', label: 'CEO', count: 1, backs: 0, collected: true});
      }
      out.push({id: 'projects', label: 'Projects', count: this.state.projects.length, backs: 0, collected: true});
      return out;
    },
    /** The compact participant readiness strip (preparation only — the real
     *  top strip is hidden there and owns this again in the deployment). */
    participants(): ReadonlyArray<StartParticipant> {
      return startParticipants(this.playerView, this.waitingOnPlayers);
    },
    /** The EXPANDED STARTUP STATUS PREVIEW (the summary's status panel — the
     *  visible source the commit transforms into the real HUD). */
    preview(): StartStatusPreview | undefined {
      return buildStartStatusPreview(this.picks);
    },
    /** An embedded follow-up (the shared reveal) is presenting in THIS
     *  workspace's zone — the queue yields visual priority, never unmounts. */
    embedActive(): boolean {
      return this.outcome.host === 'start' && this.outcome.sourceCard !== '';
    },
    /** Presence key of the live drawn-reveal event (claim lifecycle driver). */
    revealEventKey(): string {
      return currentRevealEvent() === undefined ? '' : 'ev';
    },
    /** The ceremony status rail: the focused queue card's NAME (the SOURCE
     *  card while an embedded reveal owns the zone). */
    ceremonyStatusName(): string {
      if (this.embedActive && this.outcome.sourceCard !== '') {
        return translateText(this.outcome.sourceCard);
      }
      const f = this.focusedItem;
      if (f === undefined) {
        return '';
      }
      return f.name === PAY_KEY ? translateText('Bought cards') : translateText(f.name);
    },
    /** …and its resolution CONTEXT — one short state, never a breakdown. */
    ceremonyStatusText(): string {
      if (this.embedActive) {
        return translateText('Card draw');
      }
      const f = this.focusedItem;
      if (f === undefined) {
        return this.heroState.active ? '' : translateText('Waiting for other players');
      }
      switch (f.kind) {
      case 'corp':
        return translateText('Ready to play');
      case 'pay':
        return translateText('Confirm the purchase');
      case 'candidate':
        return translateText('Select one');
      default: {
        const idx = this.queueCards.findIndex((q) => q.name === f.name);
        return idx <= 0 ? translateText('Ready to play') : translateText('Next prelude');
      }
      }
    },
    /**
     * THE DEPLOYMENT SETTLED — the whole start sequence is resolved for this
     * player AND every visual consequence has completed: no live start ask,
     * no hero in flight, no embedded follow-up open, no reveal pending, no
     * card still flying into the hand dock, nothing left in the queue. Under
     * the lifetime HOLD this is what finally releases the workspace (its own
     * calm dissolve → the board), never a prompt gap. The corporation's
     * mandatory first action is deliberately OUTSIDE this scene's scope.
     */
    deploymentSettled(): boolean {
      if (this.mode !== 'ceremony' || !this.state.hold || this.state.flow === 'materializing') {
        return false;
      }
      return this.corpPlayPrompt === undefined &&
        this.corpPayCost === undefined &&
        this.candidatePrompt === undefined &&
        startFlowPreludePrompt(this.playerView) === undefined &&
        this.wizardInput === undefined &&
        !this.heroState.active &&
        !this.embedActive &&
        currentRevealEvent() === undefined &&
        !isHandDeliveryActive() &&
        handDeliveryState.held.length === 0 &&
        this.queueCards.length === 0 &&
        this.payProjects.length === 0 &&
        this.queueArriving.size === 0;
    },
    /** The preludes already ON the authoritative tableau. */
    playedPreludes(): ReadonlyArray<CardName> {
      return this.playerView.thisPlayer.tableau
        .filter((c) => getCard(c.name)?.type === CardType.PRELUDE)
        .map((c) => c.name as CardName);
    },
    /**
     * THE STARTUP QUEUE — every unresolved start card as ONE persistent
     * physical row: the pending corporation, the draw/Merger candidates, the
     * prelude rail. A resolved card leaves; the rest only ever slide over.
     */
    queueCards(): ReadonlyArray<{name: CardName, kind: Focusable['kind'], verb?: string, badge?: string, badgeClass?: string, reason?: string, dimmed: boolean, dealIdx: number}> {
      if (this.mode !== 'ceremony') {
        return [];
      }
      const out: Array<{name: CardName, kind: Focusable['kind'], verb?: string, badge?: string, badgeClass?: string, reason?: string, dimmed: boolean, dealIdx: number}> = [];
      const corp = this.corpPlayCard;
      if (corp !== undefined) {
        out.push({name: corp.name, kind: 'corp', verb: 'Play now', dimmed: false, dealIdx: -1});
      }
      this.candidateCards.forEach((c, i) => {
        const disabled = c.isDisabled === true;
        out.push({
          name: c.name, kind: 'candidate',
          verb: disabled ? undefined : this.candidateVerb,
          badge: disabled ? 'Unavailable' : undefined,
          badgeClass: disabled ? 'con-cards__pickband--disabled' : undefined,
          reason: disabled ? undefined : undefined,
          dimmed: disabled,
          dealIdx: i,
        });
      });
      const preludesLive = startFlowPreludePrompt(this.playerView) !== undefined;
      for (const e of this.preludeRail) {
        const playable = e.status === 'playable' && !e.blocked && preludesLive;
        out.push({
          name: e.name, kind: 'prelude',
          verb: playable ? 'Play now' : undefined,
          reason: e.blocked ? 'Play another prelude first' : undefined,
          dimmed: !playable,
          dealIdx: -1,
        });
      }
      return out;
    },
    /**
     * ONE VISUAL OWNER — the queue slot of a card whose hero has physically
     * left it. From the lift to the transaction's end the slot stands
     * empty-held (`.con-deal-hold`); the tableau commit then removes the
     * entry and the neighbours FLIP over the freed space. The source face can
     * never coexist with the flying hero.
     */
    heroDepartedName(): CardName | undefined {
      const hero = this.heroState;
      if (!hero.active || hero.card === undefined) {
        return undefined;
      }
      // NOT during 'preparing': the director is still measuring/covering the
      // source there (its own holdSource blanks it in the same turn the proxy
      // lands over it) — hiding a frame earlier reads as the card blinking
      // out before anything picks it up.
      const p = hero.phase;
      return p === 'idle' || p === 'armed' || p === 'failed' || p === 'preparing' ? undefined : hero.card;
    },
    picks() {
      return {
        corp: this.state.corp,
        preludes: this.state.preludes,
        ceo: this.state.ceo,
        projects: this.state.projects,
      };
    },
    stepEntries(): ReadonlyArray<CardModel> {
      return this.currentStep?.input.cards ?? [];
    },
    focusedCard(): CardModel | undefined {
      return this.stepEntries[this.focusIdx];
    },
    picksHere(): ReadonlyArray<CardName> {
      const step = this.currentStep;
      return step !== undefined ? picksForStep(this.picks, step.id) : [];
    },
    /** P13: the 10-card projects step wraps into a comparison GRID. */
    wizardGrid(): boolean {
      return this.stepEntries.length > 6;
    },
    singlePickStep(): boolean {
      const step = this.currentStep;
      return step !== undefined && step.input.min === 1 && step.input.max === 1;
    },
    /** P15: at the pick max, unpicked cards de-emphasize (desktop parity). */
    dimUnpicked(): boolean {
      const step = this.currentStep;
      return step !== undefined && this.picksHere.length >= step.input.max;
    },
    /** Can A pick the focused (unpicked) card right now? (single-pick
     *  REPLACES the selection; multi-pick blocks at the max.) */
    canPickFocused(): boolean {
      const step = this.currentStep;
      if (step === undefined) {
        return false;
      }
      if (this.focusedUnaffordable) {
        return false;
      }
      return this.singlePickStep || this.picksHere.length < step.input.max;
    },
    /** The whole chosen setup, for the summary's fullscreen browse (X). The
     *  order (corp → preludes → CEO → projects) matches the summary's DOM row
     *  order, so a flat focus index maps 1:1 onto the rendered tiles. */
    summaryCards(): ReadonlyArray<CardModel> {
      const names: Array<CardName> = [];
      if (this.state.corp !== undefined) {
        names.push(this.state.corp);
      }
      names.push(...this.state.preludes);
      if (this.state.ceo !== undefined) {
        names.push(this.state.ceo);
      }
      names.push(...this.state.projects);
      return names.map((name) => ({name}) as CardModel);
    },
    /** True on the wizard's final summary (no live step). */
    onSummary(): boolean {
      return this.mode === 'wizard' && this.currentStep === undefined;
    },
    /** The summary pane KEEPS RENDERING through the materialization until
     *  the SWAP moment (`matSwap`): the capture proxies stand over its cards
     *  by then, and the deployment replaces it UNDER them in one turn. */
    summaryShown(): boolean {
      return this.onSummary || this.state.flow === 'committing' ||
        (this.state.flow === 'materializing' && !this.matSwap);
    },
    /**
     * The summary is the setup's WAITING ROOM as much as it is a review: the
     * game cannot start until every player has picked. This is the honest
     * readout of that (the SHARED status brain — see startLaunchState).
     */
    launch(): StartLaunchState {
      return startLaunchState(this.playerView, this.waitingOnPlayers);
    },
    /**
     * The confirm's VERB. Nobody else owes a pick → this press is the last
     * input the game needs, so it genuinely BEGINS the game; while somebody
     * else is still choosing it only submits the viewer's own choice.
     *
     * The press itself is NEVER gated on the others (only its wording): two
     * humans sitting on their summaries are both pending for each other, so a
     * hard gate would leave them waiting on one another forever.
     */
    launchVerb(): string {
      return this.launch.launches ? 'Begin the game' : 'Submit your choice';
    },
    /** Flat-index offsets so each summary section maps onto `summaryCards`. */
    summaryPreludeBase(): number {
      return this.state.corp !== undefined ? 1 : 0;
    },
    summaryCeoIdx(): number {
      return this.summaryPreludeBase + this.state.preludes.length;
    },
    summaryProjectBase(): number {
      return this.summaryCeoIdx + (this.state.ceo !== undefined ? 1 : 0);
    },
    currentStepComplete(): boolean {
      const step = this.currentStep;
      if (step === undefined) {
        return true;
      }
      if (step.id === 'projects' && !this.budgetOk) {
        return false;
      }
      return stepComplete(step, this.picks);
    },
    /** «из M» — the counter's / picked-chip's plain denominator (the server's
     *  pick max; readiness styling carries the min). */
    ofMaxText(): string {
      const step = this.currentStep;
      if (step === undefined) {
        return '';
      }
      return translateTextWithParams('of ${0}', [String(step.input.max)]);
    },
    /** The limit message: cause + recovery, calm amber (never an error). */
    limitText(): string {
      const step = this.currentStep;
      if (step === undefined) {
        return '';
      }
      const max = String(step.input.max);
      return translateTextWithParams(
        'Limit ${0}/${1} reached — deselect one of the marked cards', [max, max]);
    },
    /** PROJECTS step: adding the focused (unpicked) card would break the budget
     *  (every project costs the same, so this is really "no room for one more"
     *  — a NORMAL limit, surfaced per-card so the rail can explain it). */
    focusedUnaffordable(): boolean {
      const step = this.currentStep;
      const card = this.focusedCard;
      const corp = this.state.corp;
      if (step === undefined || step.id !== 'projects' || card === undefined || corp === undefined) {
        return false;
      }
      if (this.isPickedHere(card.name)) {
        return false;
      }
      return (startingMegacredits(corp, this.state.projects.length + 1) ?? 0) < 0;
    },
    /** The pinned status rail's LOCAL state for the focused card. Never the
     *  global «N из M» progress (that lives in the header counter) — only the
     *  focused card's own state + a short hint. */
    statusRailKind(): 'picked' | 'unaffordable' | 'limit' | 'hint' {
      const step = this.currentStep;
      const card = this.focusedCard;
      if (step === undefined || card === undefined) {
        return 'hint';
      }
      if (this.isPickedHere(card.name)) {
        return 'picked';
      }
      if (this.focusedUnaffordable) {
        return 'unaffordable';
      }
      if (!this.singlePickStep && this.picksHere.length >= step.input.max) {
        return 'limit';
      }
      return 'hint';
    },
    /** The rail's kind modifier — applied only while the deal is idle, so the
     *  height-reserving empty rail during the cinematic stays neutral (no
     *  coloured border) until its content fades in. */
    statusRailClass(): string {
      return this.deal.state.active ? '' : 'con-start__statusrail--' + this.statusRailKind;
    },
    statusRailText(): string {
      switch (this.statusRailKind) {
      case 'picked':
        return translateText('Card selected');
      case 'unaffordable':
        return translateText('Not enough funds to add this card');
      case 'limit':
        return this.limitText;
      default:
        return this.stepHint;
      }
    },
    /** A short hint for the current pick — never a controller prompt, never the
     *  global progress. Preludes: how many still to pick; projects: available;
     *  single-pick (corp/CEO): the header states the task, so no rail hint. */
    stepHint(): string {
      const step = this.currentStep;
      if (step === undefined) {
        return '';
      }
      if (step.id === 'projects') {
        return translateText('Available to buy');
      }
      if (this.singlePickStep) {
        return '';
      }
      const remaining = step.input.min - this.picksHere.length;
      return remaining > 0 ? translateTextWithParams('Select ${0} more', [String(remaining)]) : '';
    },
    /** Economy is COMPACT on corp / prelude (nothing bought yet → just the
     *  available funds); the projects step + summary show the full breakdown. */
    moneyCompact(): boolean {
      const step = this.currentStep;
      return step !== undefined && step.id !== 'projects';
    },
    /** The compact readout's available funds (start + any prelude effect). */
    moneyAvailable(): number {
      const b = this.budget;
      return b === undefined ? 0 : b.start + b.preludes;
    },
    cardCost(): number {
      return cardCostForCorp(this.state.corp);
    },
    budget(): {start: number, buys: number, cardCost: number, remaining: number, preludes: number} | undefined {
      const corp = this.state.corp;
      if (corp === undefined) {
        return undefined;
      }
      const buys = this.state.projects.length;
      return {
        start: startingMegacredits(corp, 0) ?? 0,
        buys,
        cardCost: this.cardCost,
        remaining: startingMegacredits(corp, buys) ?? 0,
        preludes: afterPreludes(corp, this.state.preludes, buys),
      };
    },
    budgetOk(): boolean {
      const b = this.budget;
      return b === undefined || b.remaining >= 0;
    },
    wizardReady(): boolean {
      // Every step complete → the summary X can submit.
      return this.steps.every((s) => stepComplete(s, this.picks)) && this.budgetOk;
    },
    // ── ceremony ─────────────────────────────────────────────────────
    /** The DEFERRED 'play your corporation' prompt (marker corporationPlay).
     *  While it is live the corp is genuinely UNPLAYED on the server. */
    corpPlayPrompt(): SelectCardModel | undefined {
      return this.mode === 'ceremony' ? startFlowCorpPlayPrompt(this.playerView) : undefined;
    },
    corpPlayCard(): CardModel | undefined {
      return this.corpPlayPrompt?.cards?.[0];
    },
    /** The DEFERRED card-payment beat's cost (undefined = nothing to pay:
     *  the step is skipped entirely, exactly as the rules read). */
    corpPayCost(): {megacredits: number, cards: number} | undefined {
      return this.mode === 'ceremony' ? startFlowCorpPayPrompt(this.playerView) : undefined;
    },
    /**
     * The bought project cards (the ceremony's held + payment-grid set). The
     * player's wizard picks are the explicit intent; a reload mid-ceremony
     * (module state reset) falls back to the current hand, which at the pay
     * step IS exactly the bought projects (corp is played, preludes/CEO are
     * not in `cardsInHand`). Empty until the ceremony (never held on the
     * wizard, never on a returning save with no picks + no hand).
     */
    ceremonyBoughtNames(): ReadonlyArray<CardName> {
      if (this.mode !== 'ceremony') {
        return [];
      }
      if (this.state.projects.length > 0) {
        return this.state.projects;
      }
      return this.playerView.cardsInHand.map((c) => c.name);
    },
    /** The bought projects standing in the QUEUE's purchase row — from the
     *  first deployment frame until the payment resolves them into the hand
     *  (they are withheld from the dock the whole time; the pay confirm is
     *  what physically flies them there). */
    payProjects(): ReadonlyArray<CardName> {
      if (this.mode !== 'ceremony') {
        return [];
      }
      return this.corpPlayPrompt !== undefined || this.corpPayCost !== undefined ? this.ceremonyBoughtNames : [];
    },
    /** A balanced column count for the compact pay grid (rows stay even —
     *  never a lone orphan on a second row). */
    payGridCols(): number {
      const n = this.payProjects.length;
      if (n <= 4) {
        return n;
      }
      const cols = Math.min(6, Math.ceil(Math.sqrt(n)));
      const rows = Math.ceil(n / cols);
      return Math.ceil(n / rows);
    },
    /**
     * The stable key of the delivery HOLD episode: non-empty from the first
     * ceremony frame (corp-play or pay beat) while cards were bought, so the
     * bought projects are withheld from the dock until the payment flies them
     * in. Name-derived (not the module signature) so it survives a reload
     * mid-ceremony. Empty = nothing to hold (wizard / nothing bought).
     */
    deliveryHoldSignature(): string {
      if (this.mode !== 'ceremony' || this.ceremonyBoughtNames.length === 0) {
        return '';
      }
      if (this.corpPlayPrompt === undefined && this.corpPayCost === undefined) {
        return '';
      }
      return deliveryHoldKey(this.ceremonyBoughtNames);
    },
    /** Identity of the pressable ceremony set — drives the reward pre-fetch
     *  (the deferred corp + Merger's offered corps / drew-N candidates + the
     *  prelude rail). */
    playRewardKey(): string {
      return [
        this.corpPlayCard?.name ?? '',
        ...this.candidateCards.map((c) => c.name),
        ...this.preludeRail.map((e) => e.name),
      ].join('|');
    },
    preludeRail(): ReadonlyArray<PreludeEntry> {
      if (this.mode !== 'ceremony') {
        return [];
      }
      // A PLAYED prelude physically MOVED to the «Разыграно» table (the hero
      // landing) — it leaves the scene rail and the remaining cards FLIP into
      // the freed space (never a "played" ghost sitting in both places).
      return preludeEntries(this.playerView).filter((e) => e.status !== 'played');
    },
    /** The live pick prompt (draw-1-of-N / Double Down copy / Merger corp). */
    candidatePrompt(): SelectCardModel | undefined {
      if (this.mode !== 'ceremony') {
        return undefined;
      }
      return startFlowPreludeDrawPrompt(this.playerView) ??
        startFlowPreludeCopyPrompt(this.playerView) ??
        startFlowCorpSelectPrompt(this.playerView);
    },
    candidateCards(): ReadonlyArray<CardModel> {
      return this.candidatePrompt?.cards ?? [];
    },
    candidateVerb(): string {
      if (startFlowPreludeCopyPrompt(this.playerView) !== undefined) {
        return 'Copy';
      }
      if (startFlowCorpSelectPrompt(this.playerView) !== undefined) {
        return 'Select';
      }
      return 'Play now';
    },
    /** P17: the live ask is a CORPORATION pick (Merger) → compact strip. */
    corpCandidatePick(): boolean {
      return startFlowCorpSelectPrompt(this.playerView) !== undefined;
    },
    /** The flat actionable list the focus cycles over. */
    focusables(): Array<Focusable> {
      const out: Array<Focusable> = [];
      if (this.mode !== 'ceremony') {
        return out;
      }
      // The deferred corporation play is the WHOLE decision of its beat —
      // nothing else is actionable until the corp physically lands.
      if (this.corpPlayPrompt !== undefined && this.corpPlayCard !== undefined) {
        out.push({kind: 'corp', name: this.corpPlayCard.name, disabled: false});
        return out;
      }
      // …then paying for the bought cards is the only thing to do.
      if (this.corpPayCost !== undefined) {
        out.push({kind: 'pay', name: PAY_KEY, disabled: false});
        return out;
      }
      if (this.candidatePrompt !== undefined) {
        for (const c of this.candidateCards) {
          out.push({kind: 'candidate', name: c.name, disabled: c.isDisabled === true});
        }
        return out;
      }
      if (startFlowPreludePrompt(this.playerView) !== undefined) {
        for (const e of this.preludeRail) {
          if (e.status === 'playable' && !e.blocked) {
            out.push({kind: 'prelude', name: e.name, disabled: false});
          }
        }
      }
      return out;
    },
    focusedItem(): Focusable | undefined {
      return this.focusables[this.focusIdx];
    },
    headTitle(): string {
      if (this.mode === 'wizard') {
        const step = this.currentStep;
        return step !== undefined ? textOf(step.input.title) : translateText('Summary');
      }
      return textOf(this.wf?.title);
    },
    /** The card set the deal cinematic flies for the CURRENT frame. */
    dealCards(): ReadonlyArray<CardModel> {
      if (this.mode === 'wizard') {
        return this.currentStep !== undefined ? this.stepEntries : [];
      }
      return this.candidateCards;
    },
    /** The deal-identity FRAME (the old keyed-frame name, kept ONLY as a
     *  deal-cache key — the frame itself is one persistent surface now). */
    dealFrame(): string {
      if (this.mode === 'wizard') {
        return this.onSummary ? 'wizard-summary' : 'wizard-steps';
      }
      return 'ceremony';
    },
    /** The deal identity: frame + step + the exact card set (a fresh candidate
     *  set under the SAME frame — successive draw-1-of-N asks — re-deals). */
    dealSignature(): string {
      return `${this.dealFrame}|${this.railPos}|${this.dealCards.map((c) => c.name).join(',')}`;
    },
    /** The ceremony beat identity — resets the focus cursor without a remount. */
    ceremonyPromptKey(): string {
      return this.mode === 'ceremony' ? `${this.wf?.type ?? ''}|${textOf(this.wf?.title)}` : '';
    },
    /** Diagnostic: the corp is on the table but this session never staged its
     *  landing — an assigned/test-mode corp, or a client newer than the server
     *  (no corporationPlay prompt). Shown as context; warned once in dev. */
    corpPlayedWithoutPrompt(): boolean {
      return this.mode === 'ceremony' && !this.sawCorpPlayPrompt &&
        this.corpPlayCard === undefined && corporationCardNames(this.playerView).length > 0;
    },
    /** The live command contract — ONE pure derivation (startSceneCommands),
     *  mirrored verbatim by the shell's bar. See consoleStartUi.ts for the
     *  setup grammar (context-exact A · X · LB/RB steps · B; no RT, no
     *  generic «Навигация»). */
    footHints(): Array<StartCommand> {
      // Mid-motion (dock flights, the commit, the materialization, the final
      // release) NOTHING is pressable — the bar goes honestly empty instead
      // of advertising verbs the input gate would swallow. The deal cinematic
      // keeps its Skip (startSceneCommands handles it first).
      if (startFlowBusy() && !this.deal.state.active) {
        return [];
      }
      return startSceneCommands({
        dealActive: this.deal.state.active,
        mode: this.mode,
        onSummary: this.onSummary,
        singlePick: this.singlePickStep,
        focusedPicked: this.focusedCard !== undefined && this.isPickedHere(this.focusedCard.name),
        canPickFocused: this.canPickFocused,
        hasCards: this.onSummary ? this.summaryCards.length > 0 : this.stepEntries.length > 0,
        stepComplete: this.currentStepComplete,
        hasPrevStep: this.railPos > 0,
        launchVerb: this.launchVerb,
        launches: this.launch.launches,
        wizardReady: this.wizardReady,
        payBeat: this.corpPayCost !== undefined,
        ceremonyVerb: this.candidatePrompt !== undefined ? this.candidateVerb : 'Play now',
        hasFocusables: this.focusables.length > 0,
      });
    },
  },
  watch: {
    /** The deal identity pins the wizard picks (module state survival). */
    'wizardInput': {
      immediate: true,
      handler(input: SelectInitialCardsModel | undefined) {
        if (input !== undefined) {
          ensureStartWizard(this.playerView.id, initialCardsSignature(input));
        }
      },
    },
    /**
     * The pressable ceremony set (the deferred corporation + the prelude rail,
     * incl. a drew-N winner joining it): pre-fetch each card's on-play rewards
     * while the player reads them, so the press arms the hero with its reward
     * beat ready. Non-gating — the fetch never delays a press (dedup'd by
     * `rewardFetched`).
     */
    'playRewardKey': {
      immediate: true,
      handler() {
        this.prefetchPlayRewards();
      },
    },
    /** Step position (the panes swap under this): reseed focus, mark the
     *  step visited (its first-visit stagger never replays), refit. */
    railPos() {
      this.onFrameSettle();
    },
    /** Entering / leaving the summary pane settles the frame like a step
     *  change (the panes swap under the dock flights, never a remount). */
    onSummary() {
      this.onFrameSettle();
    },

    /** Pre-flush: arm the deal HOLD before the new card set paints (the
     *  real cards mount hidden — zero first-frame flash). */
    'dealSignature': {
      immediate: true,
      handler() {
        this.prepareDeal();
      },
    },
    /** Grid↔row transition re-fits the single row (never per focus). */
    wizardGrid() {
      void this.$nextTick(() => this.fitCardStrip());
    },
    /** The pinned status rail is v-if'd off DURING the deal cinematic, so the
     *  body is taller then; when the deal ends the rail appears and the body
     *  shrinks by the rail height — re-fit so the (freed-height) cards fit the
     *  now-shorter body instead of overflowing its internal scroll. */
    'deal.state.active'(active: boolean) {
      if (!active) {
        void this.$nextTick(() => this.fitCardStrip());
      }
    },
    focusables(now: Array<Focusable>) {
      // Only clamp the CEREMONY focus cursor here — the wizard summary reuses
      // focusIdx over summaryCards (focusables is empty there), and this clamp
      // would otherwise snap it back to 0 on every re-eval.
      if (this.mode === 'ceremony' && this.focusIdx >= now.length) {
        this.focusIdx = Math.max(0, now.length - 1);
      }
    },
    /** The ceremony frame is ONE stable key now (in-place beats) — the focus
     *  cursor reseeds on each new BEAT here instead of the old frame remount. */
    ceremonyPromptKey() {
      if (this.mode === 'ceremony') {
        this.focusIdx = 0;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    /** Latch: THIS session staged the corporation's landing, so a played corp
     *  belongs to the «Разыграно» table (never a ghost twin on the scene). */
    'corpPlayCard': {
      immediate: true,
      handler(card: CardModel | undefined) {
        if (card !== undefined) {
          this.sawCorpPlayPrompt = true;
        }
      },
    },
    /** Dev signal for a genuinely stale pairing: the corporation is already
     *  played and no corporationPlay prompt ever arrived (a server older than
     *  this client). The UI degrades honestly (context card) — this names it. */
    'corpPlayedWithoutPrompt': {
      immediate: true,
      handler(now: boolean) {
        if (now && process.env.NODE_ENV !== 'production' && !this.warnedCorpPrompt) {
          this.warnedCorpPrompt = true;
          console.warn('[console-start] the corporation is already played and no `corporationPlay` prompt arrived — ' +
            'showing it as context. If this is a fresh game, the SERVER is older than this client (restart / rebuild it).');
        }
      },
    },
    /** Mirror the scene's live contract into the shell's command bar (the bar
     *  is the ONE hint surface — no inline duplicates anywhere in the scene). */
    'footHints': {
      immediate: true,
      handler(hints: Array<StartCommand>) {
        setConsoleStartCommands(hints);
      },
    },
    /**
     * The PREPARATION → DEPLOYMENT boundary. A commit in flight that flips
     * the mode runs GAME STATE MATERIALIZATION (the status preview transforms
     * into the Top HUD + Player Rail, the shell re-bounds, the deployment
     * reveals). Any other path into the ceremony (a reload mid-start, a
     * defer/restore) skips the episode and simply establishes the shell.
     */
    'mode': {
      immediate: true,
      handler(now: 'wizard' | 'ceremony', was?: 'wizard' | 'ceremony') {
        if (now === 'ceremony' && was === 'wizard' && this.state.flow === 'committing') {
          void this.runMaterialization();
          return;
        }
        if (now === 'ceremony') {
          // Any other path into the ceremony (a reload mid-start, a defer /
          // restore) skips the episode: the standard shell simply stands.
          this.shellUp = true;
          this.ceremonyRevealed = true;
          if (this.state.flow === 'committing' || this.state.flow === 'materializing') {
            this.state.flow = 'deploying';
          }
        } else {
          this.shellUp = false;
        }
        void this.$nextTick(() => this.syncCeremonyLayout());
      },
    },
    /** The workspace lets go ONLY when the deployment fully settles — its own
     *  calm release, never a prompt gap (the lifetime hold's other half).
     *  Immediate: a re-mount that lands on an already-settled deployment
     *  (un-defer after the last beat) releases right away. */
    'deploymentSettled': {
      immediate: true,
      handler(now: boolean) {
        if (now) {
          void this.runSceneRelease();
        }
      },
    },
    /**
     * THE EMBEDDED FOLLOW-UP lifecycle. The claim is armed at the play press
     * (actByName); when the server's reveal event actually presents in our
     * zone we mark it; when the reveal fully completes (cards taken, intake
     * landed — the event clears) the claim releases and the workspace
     * returns to the queue context. A claim that never produced anything is
     * dropped by its own 20 s backstop.
     */
    'revealEventKey'(now: string, was: string) {
      if (this.outcome.host !== 'start') {
        return;
      }
      if (now !== '' && was === '') {
        markWorkspaceOutcomePresenting();
        // THE SOURCE STAYS IN THE STEP — and it emerges only NOW: the reveal
        // event follows the hero's commit, so the source card is physically
        // lying in the dock (at the claim's press it was still in flight).
        void this.runEmbedSourceEmerge();
        return;
      }
      if (now === '' && was !== '') {
        releaseWorkspaceOutcome();
        // Back to the queue context: focus the next unresolved card.
        this.focusIdx = 0;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    /** The claim released (any exit — the take finished, the backstop, the
     *  unmount): the source card settles back into its stack slot. */
    'embedActive'(now: boolean, was: boolean) {
      if (!now && was) {
        void this.runEmbedSourceSettle();
      }
    },
    /** Withhold the bought project cards from the dock the instant the
     *  ceremony opens (so they are never in the hand before the player pays);
     *  they are shown face-up in the payment element and fly in on the pay
     *  confirm. Idempotent per deal (armDeliveryHold no-ops after the flight);
     *  survives defer + reload. */
    'deliveryHoldSignature': {
      immediate: true,
      handler(key: string) {
        if (key !== '') {
          armDeliveryHold(key, this.ceremonyBoughtNames);
        }
      },
    },
  },
  mounted() {
    void this.$nextTick(() => {
      this.fitCardStrip();
      this.syncCeremonyLayout();
      registerStartDockLayer(this.$refs.dockLayer as HTMLElement | undefined);
    });
    // (The hero's landing target — the compact played dock's reserved front
    // anchor — is registered by ConsoleStartPlayedDock itself on its mount.)
    // Foundation: VueUse-managed listeners (no raw add/removeEventListener).
    this.stopStripObs = useResizeObserver(this.$el as HTMLElement, () => this.scheduleFit()).stop;
    this.stopResize = useEventListener(window, 'resize', this.scheduleFit);
  },
  beforeUnmount() {
    document.body.classList.remove('con-start-ceremony');
    document.body.classList.remove('con-start-prep');
    if (this.outcome.host === 'start') {
      releaseWorkspaceOutcome(); // an orphaned claim suppresses presenters
    }
    resetStartDockMotion();
    registerStartDockLayer(undefined);
    this.stopStripObs?.();
    this.stopResize?.();
    if (this.dealLaunchTimer !== undefined) {
      window.clearTimeout(this.dealLaunchTimer);
    }
    if (this.fitTimer !== undefined) {
      window.clearTimeout(this.fitTimer);
    }
    if (this.commitSafety !== undefined) {
      window.clearTimeout(this.commitSafety);
    }
    // NOTE the lifetime HOLD deliberately survives an unmount (a defer keeps
    // the deployment claim; the release beat is what clears it). A transient
    // motion flow does not: a scene torn down mid-flight must come back
    // pressable, so any busy flow resets to its resting state.
    if (startFlowBusy()) {
      this.state.flow = this.state.hold ? 'deploying' : 'idle';
    }
    this.deal.dispose();
    resetConsoleStartUi();
  },
  methods: {
    /** Shared step/frame settle: reseed focus, mark visited, refit. */
    onFrameSettle(): void {
      this.focusIdx = this.stepInitialFocus();
      this.armedSkip = false;
      this.blockedNudge = 0;
      this.counterNudge = 0;
      if (this.mode === 'wizard' && this.currentStep !== undefined) {
        this.state.visited.add(this.railPos);
      }
      void this.$nextTick(() => {
        this.scrollFocusedIntoView();
        this.fitCardStrip();
        this.fitSummary();
      });
      if (this.fitTimer !== undefined) {
        window.clearTimeout(this.fitTimer);
      }
      this.fitTimer = window.setTimeout(() => {
        this.fitTimer = undefined;
        this.fitCardStrip();
        this.fitSummary();
      }, motionMs(240));
    },
    /** Parked-pane strip refs (index = step position). */
    setStripRef(i: number, el: unknown): void {
      this.stripEls[i] = el instanceof HTMLElement ? el : undefined;
    },
    /** Parked pane ROOT refs (the stage-transition motion targets). */
    setPaneRef(i: number, el: unknown): void {
      this.paneEls[i] = el instanceof HTMLElement ? el : undefined;
    },
    /** The pane element a rail position renders in (steps / the summary). */
    paneElAt(pos: number): HTMLElement | undefined {
      if (pos >= this.steps.length) {
        const summary = this.$refs.summaryPane as HTMLElement | undefined;
        return summary ?? undefined;
      }
      return this.paneEls[pos];
    },
    /**
     * THE STAGE TRANSITION — the same phrase as every workspace descend,
     * scaled to a sibling swap: the leaving pane RELEASES in place (a short
     * settle down, no travel), the entering pane SURFACES from where the old
     * one stood. Runs UNDER the dock flights (the moving cards own the eye);
     * a `v-if`/`v-show` hard cut on its own is exactly the page-swap this
     * replaces. Resolves on its own completion — reduced motion skips it.
     */
    animatePaneSwap(from: HTMLElement | undefined, to: HTMLElement | undefined): Promise<void> {
      if (consoleReducedMotionActive() || from === undefined || to === undefined || from === to) {
        return Promise.resolve();
      }
      gsap.killTweensOf([from, to]);
      return new Promise<void>((resolve) => {
        const safety = window.setTimeout(resolve, motionMs(260) + 700);
        const done = () => {
          window.clearTimeout(safety);
          gsap.set(to, {clearProps: 'opacity,transform,visibility'});
          resolve();
        };
        // The OLD pane is already display:none (v-show flipped before this
        // runs) — its release is carried by the dock proxies covering its
        // cards. The NEW pane surfaces from a settled-down state.
        gsap.fromTo(to,
          {autoAlpha: 0, y: 10 * conUiScale(), scale: 0.995, transformOrigin: '50% 30%'},
          {autoAlpha: 1, y: 0, scale: 1, duration: motionMs(260) / 1000, ease: 'power3.out', onComplete: done});
      });
    },
    activeStrip(): HTMLElement | undefined {
      return this.stripEls[this.railPos];
    },
    /** Is `name` picked on step `st` (parked panes render every step). */
    stepPicked(st: StartWizardStep, name: CardName): boolean {
      return picksForStep(this.picks, st.id).includes(name);
    },
    /** The dock pile element for a step. */
    pileElFor(id: string): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      return root.querySelector<HTMLElement>(`[data-start-pile="${id}"] .con-startdock__stack`);
    },
    /** The parked slot of a step's card (whether or not its pane is active). */
    stepSlotEl(stepId: string, name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(`${stepId}|${name}`) : `${stepId}|${name}`;
      return root.querySelector<HTMLElement>(`[data-step-slot="${esc}"]`);
    },
    /**
     * RT — ADVANCE WITH COLLECT: the current step's picked cards physically
     * fly off their slots onto their Selection-Dock pile (flipping face-down
     * mid-arc); the pane swap happens UNDER the flight. Entering the summary
     * afterwards opens every pile into the summary tiles.
     */
    async advanceWithCollect(): Promise<void> {
      const step = this.currentStep;
      if (step === undefined || this.dockBusy || startFlowBusy()) {
        return;
      }
      this.dockBusy = true;
      const fromPane = this.paneElAt(this.railPos);
      const goingToSummary = this.railPos + 1 >= this.steps.length;
      try {
        const names = picksForStep(this.picks, step.id);

        if (goingToSummary) {
          // ── DIRECT TO THE SUMMARY: the current step's picks glide from
          // their GRID SLOTS straight into their summary tiles (never a
          // detour through the shelf pile), while the earlier piles open
          // into theirs — ONE combined convoy, one transition. ──
          this.state.flow = 'revealing-summary';
          const capture = captureCards(names
            .map((name) => ({name, el: this.stepSlotEl(step.id, name)}))
            .filter((sc): sc is DockFlightSource => sc.el !== null));
          names.forEach((n) => this.returningNames.add(`${step.id}|${n}`));
          // Every pick lands in a HELD summary tile (no tile paints early).
          this.steps.forEach((st) => picksForStep(this.picks, st.id).forEach((n) => this.summaryArriving.add(n)));
          // The earlier piles keep their lying backs through the target flip
          // (targets drop to 0 on the summary; the physique must not blink).
          this.steps.forEach((st, i) => {
            if (i < this.railPos) {
              driftDockPile(st.id, picksForStep(this.picks, st.id).length);
            }
          });
          this.state.stepIdx = this.railPos + 1;
          await this.$nextTick();
          this.fitSummary();
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          const paneMotion = this.animatePaneSwap(fromPane, this.paneElAt(this.railPos));
          await Promise.all([
            this.revealSummaryFromPiles(step.id),
            capture.flyTo(
              (n) => this.summaryTileFor(n),
              (n) => {
                this.summaryArriving.delete(n);
                this.returningNames.delete(`${step.id}|${n}`);
              }),
          ]);
          names.forEach((n) => this.returningNames.delete(`${step.id}|${n}`));
          this.summaryArriving.clear();
          clearDockDrift();
          await paneMotion;
          return;
        }

        // ── A STEP ADVANCE: the picks collect onto their shelf pile. ──
        this.state.flow = 'docking';
        const sources: Array<DockFlightSource> = names
          .map((name) => ({name, el: this.stepSlotEl(step.id, name)}))
          .filter((sc): sc is DockFlightSource => sc.el !== null);
        let paneMotion: Promise<void> = Promise.resolve();
        // The pile's backs follow the CARDS: pre-drift −N so the state flip
        // shows an (honest) empty pile, then each touchdown adds one back.
        driftDockPile(step.id, -names.length);
        await collectToDock(sources, this.pileElFor(step.id), () => {
          // The picks are COVERED by their proxies: the pane may swap now —
          // the entering surface rises under the flight, one continuous move.
          this.state.stepIdx = this.railPos + 1;
          paneMotion = this.$nextTick().then(() => this.animatePaneSwap(fromPane, this.paneElAt(this.railPos)));
        }, () => {
          driftDockPile(step.id, 1);
        });
        clearDockDrift(step.id);
        await paneMotion;
      } finally {
        this.dockBusy = false;
        this.state.flow = 'idle';
      }
    },
    /**
     * LT — BACK WITH RETURN: the previous step's pane restores (same table,
     * same slots, no re-deal) and its collected cards fly OUT of their pile
     * back into their reserved slots, face-up (held empty until touchdown).
     */
    async backWithReturn(): Promise<void> {
      if (this.railPos === 0 || this.dockBusy || startFlowBusy()) {
        return;
      }
      this.dockBusy = true;
      this.state.flow = this.onSummary ? 'stowing-summary' : 'returning';
      const fromPane = this.paneElAt(this.railPos);
      try {
        const leavingSummary = this.onSummary;
        const target = this.railPos - 1;
        const step = this.steps[target];
        if (step === undefined) {
          this.state.stepIdx = target;
          clearDockDrift();
          return;
        }
        const names = picksForStep(this.picks, step.id);

        if (leavingSummary) {
          // ── DIRECT FROM THE SUMMARY: the target step's cards glide from
          // their tiles straight back into their GRID SLOTS, while the other
          // sections gather into their shelf piles — one combined convoy,
          // the exact reverse of the way in. ──
          const capture = captureCards(names
            .map((name) => ({name, el: this.summaryTileFor(name)}))
            .filter((sc): sc is DockFlightSource => sc.el !== null));
          names.forEach((n) => {
            this.summaryStowing.add(n);
            this.returningNames.add(`${step.id}|${n}`);
          });
          const stowGroups = this.steps
            .filter((_st, i) => i !== target)
            .map((st) => ({st, names: picksForStep(this.picks, st.id)}))
            .filter((g) => g.names.length > 0);
          // The flip re-collects the earlier piles (targets 0 → picks): hold
          // the physique at zero until each card physically lands back.
          stowGroups.forEach((g) => driftDockPile(g.st.id, -g.names.length));
          this.state.stepIdx = target;
          await this.$nextTick();
          this.fitCardStrip();
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          const paneMotion = this.animatePaneSwap(fromPane, this.paneElAt(target));
          await Promise.all([
            ...stowGroups.map((g) => collectToDock(
              g.names
                .map((name) => ({name, el: this.summaryTileFor(name)}))
                .filter((sc): sc is DockFlightSource => sc.el !== null),
              this.pileElFor(g.st.id),
              () => g.names.forEach((n) => this.summaryStowing.add(n)),
              () => driftDockPile(g.st.id, 1),
            )),
            capture.flyTo(
              (n) => this.stepSlotEl(step.id, n),
              (n) => this.returningNames.delete(`${step.id}|${n}`)),
          ]);
          names.forEach((n) => this.returningNames.delete(`${step.id}|${n}`));
          clearDockDrift();
          await paneMotion;
          return;
        }

        // ── A STEP RETURN: the collected cards fly OUT of their pile back
        // into their reserved slots (held empty until each touchdown). ──
        names.forEach((n) => this.returningNames.add(`${step.id}|${n}`));
        // The flip un-collects the TARGET step (its backs' target → 0):
        // hold the physique steady across it, then drain per departure.
        driftDockPile(step.id, names.length);
        this.state.stepIdx = target;
        await this.$nextTick();
        const paneMotion = this.animatePaneSwap(fromPane, this.paneElAt(target));
        await returnFromDock(
          names,
          this.pileElFor(step.id),
          (name) => this.stepSlotEl(step.id, name),
          (name) => this.returningNames.delete(`${step.id}|${name}`),
          () => driftDockPile(step.id, -1),
        );
        names.forEach((n) => this.returningNames.delete(`${step.id}|${n}`));
        clearDockDrift();
        await paneMotion;
      } finally {
        // The stow's tile holds release only now — the summary pane is long
        // hidden, so no face can flash under a dead proxy.
        this.summaryStowing.clear();
        this.dockBusy = false;
        this.state.flow = 'idle';
      }
    },
    /** The SUMMARY REVEAL: the collected piles open — their cards fly into
     *  their summary tiles face-up, and each pile's backs DRAIN as its cards
     *  depart (the backs disappear BECAUSE the cards left — one physical
     *  owner). `exclude` = the step whose cards travel their own DIRECT path
     *  (the projects glide grid → tiles, never through the shelf). The
     *  CALLER owns the hold sets and the drift reconciliation — this may run
     *  as one leg of a combined convoy. */
    async revealSummaryFromPiles(exclude?: StartWizardStep['id']): Promise<void> {
      this.summaryStowing.clear();
      const groups = this.steps
        .filter((st) => st.id !== exclude)
        .map((st) => ({st, names: picksForStep(this.picks, st.id)}))
        .filter((g) => g.names.length > 0);
      groups.forEach((g) => g.names.forEach((n) => this.summaryArriving.add(n)));
      await this.$nextTick();
      await Promise.all(groups.map((g) =>
        returnFromDock(
          g.names,
          this.pileElFor(g.st.id),
          (name) => this.summaryTileFor(name),
          (name) => this.summaryArriving.delete(name),
          () => driftDockPile(g.st.id, -1),
        )));
    },
    /** Leaving the summary backwards: the laid-out set gathers back into its
     *  piles first (the reverse of the reveal) — a back reappears only when
     *  its card physically lands back on the shelf — then the step returns.
     *  ONE VISUAL OWNER: the tiles are held empty (`summaryStowing`) in the
     *  same paint their proxies spawn — a card can never lie open in the
     *  summary while its copy flies to the shelf. */
    async collectSummaryToPiles(): Promise<void> {
      const groups = this.steps
        .map((st) => ({st, names: picksForStep(this.picks, st.id)}))
        .filter((g) => g.names.length > 0);
      await Promise.all(groups.map((g) => {
        const sources: Array<DockFlightSource> = g.names
          .map((name) => ({name, el: this.summaryTileFor(name)}))
          .filter((sc): sc is DockFlightSource => sc.el !== null);
        return collectToDock(sources, this.pileElFor(g.st.id),
          () => sources.forEach((sc) => this.summaryStowing.add(sc.name)),
          () => driftDockPile(g.st.id, 1));
      }));
      // (The drift is reconciled by the caller AFTER the step flip — clearing
      // here, still on the summary, would blink every just-landed back out.
      // The stow holds release then too: the tiles are off-screen by that
      // point, and an early release would flash the faces under dead proxies.)
    },
    summaryTileFor(name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name;
      return root.querySelector<HTMLElement>(`.con-start__summary [data-zoom-slot="${esc}"], .con-start__mini[data-zoom-slot="${esc}"]`);
    },
    dealDelay(i: number): Record<string, string> {
      if (consoleReducedMotionActive()) {
        return {};
      }
      return {animationDelay: `calc(${Math.min(i, 12) * 55}ms * var(--motion-scale, 1))`};
    },
    isPickedHere(name: CardName): boolean {
      return this.picksHere.includes(name);
    },
    isFocused(kind: Focusable['kind'], name: CardName): boolean {
      const f = this.focusedItem;
      return f !== undefined && f.kind === kind && f.name === name;
    },
    /** Summary focus cursor: is the flat-indexed tile the focused one? */
    isSummaryFocused(idx: number): boolean {
      return this.onSummary && this.focusIdx === idx;
    },
    /** The launch readout's visible label for a seat (the bot resolves to
     *  its localized display name — never a raw «MarsBot»). */
    crewName(mate: StartCrewMate): string {
      return participantDisplayName({name: mate.name, isMarsBot: mate.isMarsBot});
    },
    disabledCardReason(card: CardModel): string {
      const reason = card.disabledReason;
      if (reason !== undefined && reason !== '') {
        return textOf(reason);
      }
      // Merger's unaffordable corp — the one known disabled case here.
      return translateText('Not enough M€');
    },
    /** The shell routes every intent here while the scene is active. */
    handleIntent(intent: GamepadIntent): void {
      // Any input mid-deal SKIPS the cinematic (and is consumed) — the
      // player is never made to wait, and no press can act on cards that
      // aren't interactive yet.
      if (this.deal.state.active) {
        this.deal.skip();
        return;
      }
      // THE INPUT LOCK: while the director is mid-motion (dock flights, the
      // commit round trip, the materialization, the final release) every
      // press is absorbed — a repeat A cannot double-fire, LT/RT cannot fork
      // a flight, B cannot tear down a surface a proxy is flying over.
      if (startFlowBusy()) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent, START_INPUT_OVERRIDES);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    /**
     * DEAL CINEMATIC (console_card_deal.less / cardDealSequence.ts): decide
     * + arm the hold for the current frame's card set, synchronously —
     * called pre-flush from the frameKey watcher and on mount, so the real
     * cards render hidden from their very first frame.
     */
    prepareDeal(): void {
      if (this.dealLaunchTimer !== undefined) {
        window.clearTimeout(this.dealLaunchTimer);
        this.dealLaunchTimer = undefined;
      }
      const cards = this.dealCards;
      const names = cards.map((c) => c.name);
      const keys = cards.map((c, i) => c.name + '#' + i);
      const dealKey = `${this.playerView.id}|${this.dealFrame}|${names.join(',')}`;
      if (this.deal.prepare(dealKey, names, keys)) {
        // Launch after the con-task-swap frame transition (160ms) settles +
        // fitCardStrip has sized the row — the measured rects are final.
        this.dealLaunchTimer = window.setTimeout(() => {
          this.dealLaunchTimer = undefined;
          requestAnimationFrame(() => this.launchDeal());
        }, motionMs(260));
      }
    },
    launchDeal(): void {
      if (!this.deal.state.active) {
        return;
      }
      const layer = this.$refs.dealLayer as InstanceType<typeof ConsoleCardDealLayer> | undefined;
      if (layer === undefined) {
        this.deal.dispose();
        return;
      }
      let slotCards: Array<HTMLElement>;
      if (this.mode === 'wizard') {
        const strip = this.activeStrip();
        if (strip === undefined || strip === null) {
          this.deal.dispose();
          return;
        }
        slotCards = Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot > :is(.card-container, .pcard)'));
      } else {
        // CEREMONY: drawn candidates deal into their QUEUE slots (the deck
        // deals — cards received into the queue arrive physically).
        const row = this.$refs.queueEl as HTMLElement | undefined;
        if (row === undefined || row === null) {
          this.deal.dispose();
          return;
        }
        slotCards = this.candidateCards
          .map((c) => {
            const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(c.name) : c.name;
            return row.querySelector<HTMLElement>(`[data-queue-slot="${esc}"] :is(.card-container, .pcard)`);
          })
          .filter((el): el is HTMLElement => el !== null);
      }
      this.deal.launch({slotCards, proxies: layer.proxyEls(), deck: layer.deckEl()});
    },
    /** The focus a freshly-entered frame opens on: a wizard step with an
     *  existing pick focuses the FIRST picked card (LB/RB returns land on
     *  the player's own choice); everything else starts at 0. */
    stepInitialFocus(): number {
      if (this.mode !== 'wizard' || this.currentStep === undefined) {
        return 0;
      }
      const idx = this.stepEntries.findIndex((c) => this.picksHere.includes(c.name));
      return idx > 0 ? idx : 0;
    },
    onNav(dir: NavDirection): void {
      // The summary browses the whole chosen setup with FULL 2D spatial
      // navigation: ←/→ move along the row, ↑/↓ jump between the corp/prelude
      // and project SECTIONS by real geometry (nearest tile, no wrap-around).
      if (this.onSummary) {
        this.moveFocusSummary(dir);
        return;
      }
      // P13: the wizard GRID jumps rows on up/down (measured, wrap-robust).
      if (this.mode === 'wizard' && this.wizardGrid && (dir === 'up' || dir === 'down')) {
        this.moveFocusRow(dir === 'down' ? 1 : -1);
        return;
      }
      const step = dir === 'right' || dir === 'down' ? 1 : -1;
      const count = this.mode === 'wizard' ? this.stepEntries.length : this.focusables.length;
      if (count === 0) {
        return;
      }
      const next = Math.min(count - 1, Math.max(0, this.focusIdx + step));
      if (next !== this.focusIdx) {
        this.focusIdx = next;
        this.armedSkip = false;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    /** PHYSICAL zoom origin: the fullscreen card lifts out of (and returns
     *  into) the `data-zoom-slot` tile for the browsed card; the underlying
     *  focus follows LB/RB so closing lands on the last-viewed card. */
    zoomOriginFor(names: ReadonlyArray<CardName>, follow: boolean) {
      return slotZoomOrigin(
        () => this.$el as HTMLElement,
        (i) => names[i] ?? '',
        follow ? (i) => {
          this.focusIdx = i;
          void this.$nextTick(() => this.scrollFocusedIntoView());
        } : undefined,
      );
    },
    /** P13/P15: X fullscreen for the focused card (wizard AND ceremony).
     *  Wizard steps pass the SELECT context (A toggles the pick without
     *  leaving the viewer); the SUMMARY browses read-only; the CEREMONY passes
     *  the ACTION context so a playable prelude / drew-N candidate is played
     *  straight from fullscreen (desktop StartGameFlow parity). The corp effect
     *  stays read-only (its label is undefined) — matching desktop. */
    zoomFocused(): void {
      if (this.mode === 'wizard') {
        if (this.currentStep !== undefined && this.stepEntries.length > 0) {
          const origin = this.zoomOriginFor(this.stepEntries.map((c) => c.name), true);
          // Single-pick step: A in the viewer SELECTS the focused card and
          // advances (parity with the strip's A-commit + the between-generation
          // draft's fullscreen Select). Multi-pick steps keep the toggle context.

          openConsoleCardZoom(this.stepEntries, this.focusIdx, {
            isSelected: (name) => this.isPickedHere(name),
            toggle: (name) => this.togglePickByName(name),
          }, undefined, {origin});
          return;
        }
        // The summary: X reviews the WHOLE chosen setup fullscreen, OPENING on
        // the focused tile and following LB/RB back onto the focus (the mini
        // tiles carry data-zoom-slot too, so the lift/return stays physical).
        if (this.currentStep === undefined && this.summaryCards.length > 0) {
          openConsoleCardZoom(this.summaryCards, this.focusIdx, undefined, undefined, {
            origin: this.zoomOriginFor(this.summaryCards.map((c) => c.name), true),
          });
        }
        return;
      }
      const items = this.focusables;
      const item = this.focusedItem;
      if (item === undefined || items.length === 0) {
        return;
      }
      const action = {
        labelFor: (name: CardName) => this.ceremonyZoomLabel(name),
        reasonsFor: () => [],
        execute: (name: CardName) => this.actByName(name),
      };
      if (item.kind === 'candidate') {
        openConsoleCardZoom(this.candidateCards, this.candidateCards.findIndex((c) => c.name === item.name), undefined, action, {
          origin: this.zoomOriginFor(this.candidateCards.map((c) => c.name), true),
        });
        return;
      }
      // Corps / preludes: browse the whole actionable set by name; A plays a
      // prelude (corp rows stay read-only via the undefined label).
      const cards = items.map((f) => ({name: f.name}) as CardModel);
      openConsoleCardZoom(cards, this.focusIdx, undefined, action, {
        origin: this.zoomOriginFor(cards.map((c) => c.name), true),
      });
    },
    /** Grid row jump - measured from the DOM, robust to flex-wrap. */
    moveFocusRow(step: 1 | -1): void {
      const strip = this.activeStrip();
      if (strip === undefined) {
        return;
      }
      const slots = Array.from(strip.children) as Array<HTMLElement>;
      const cur = slots[this.focusIdx];
      if (cur === undefined) {
        return;
      }
      const curTop = cur.offsetTop;
      const curCx = cur.offsetLeft + cur.offsetWidth / 2;
      let best = -1;
      let bestScore = Infinity;
      slots.forEach((el, i) => {
        const dTop = el.offsetTop - curTop;
        if ((step === 1 && dTop <= 4) || (step === -1 && dTop >= -4)) {
          return;
        }
        const score = Math.abs(dTop) * 10000 + Math.abs(el.offsetLeft + el.offsetWidth / 2 - curCx);
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
      if (best !== -1 && best !== this.focusIdx) {
        this.focusIdx = best;
        this.armedSkip = false;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    /** The summary's mini tiles, in DOM order (= summaryCards order: corp →
     *  preludes → CEO → projects), for the 2D spatial navigation. */
    summaryTileEls(): Array<HTMLElement> {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelectorAll !== 'function') {
        return [];
      }
      return Array.from(root.querySelectorAll<HTMLElement>('.con-start__mini'));
    },
    /** Summary 2D d-pad: move focus to the nearest tile in `dir` by real
     *  geometry (nearestInDirection) — ←/→ along a row, ↑/↓ across sections;
     *  no candidate → focus stays; re-measured each press so a resize is
     *  always honoured. */
    moveFocusSummary(dir: NavDirection): void {
      const tiles = this.summaryTileEls();
      if (tiles.length === 0 || this.focusIdx >= tiles.length) {
        return;
      }
      const rects = tiles.map((el) => el.getBoundingClientRect());
      const next = nearestInDirection(rects, this.focusIdx, dir);
      if (next !== -1 && next !== this.focusIdx) {
        this.focusIdx = next;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    scrollFocusedIntoView(): void {
      const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      if (el !== undefined && el !== null) {
        // The single ROW is fit-to-width (fitCardStrip) + the candidate rows
        // sit at a tuned fit zoom → never scroll a row on focus (that shifted
        // neighbours + churned the whole strip every d-pad move = Steam Deck
        // perf). Only the wizard GRID scrolls, and only VERTICALLY to the row.
        if ((this.mode === 'wizard' && this.wizardGrid) || this.onSummary) {
          el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        }
        return;
      }
      const body = (this.$refs.ceremonyBody ?? this.$refs.body) as HTMLElement | undefined;
      const focused = body?.querySelector('.con-start__qcard--focused');
      focused?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    },
    /** The participant strip's display name (bot-safe). */
    participantName(p: StartParticipant): string {
      return participantDisplayName({name: p.name, isMarsBot: p.isMarsBot});
    },
    /**
     * SHELL MATERIALIZATION — the game frame FORMS AROUND the workspace.
     * Runs on the commit's acceptance (the wizard mode flips):
     *
     *  1. a short mechanical confirmation — the status preview states its
     *     final numbers (resolved accent) while the summary cards stand
     *     STABLE and visible;
     *  2. the preparation-only chrome ends its role IN PLACE — the crew
     *     strip and the counts shelf calmly fade where they are (nothing
     *     flies anywhere: the Top Bar and the Player Rail are DIFFERENT
     *     presentation contexts, not transformed panels);
     *  3. ONE class swap materializes the standard shell: the Top Bar
     *     surfaces from the top edge, the Player Rail from the left edge
     *     (each from its OWN anchor — opacity + a short controlled slide),
     *     and the full-bleed surface re-bounds to standard workspace bounds
     *     through the frame's padding transition — content adapts smoothly,
     *     nothing jumps;
     *  4. the summary cards then PHYSICALLY REGROUP into the deployment's
     *     startup queue (reseatCards — the same lift/travel/dock grammar),
     *     the bought projects into the purchase row; the status preview
     *     finishes its role locally and fades;
     *  5. the deployment surface is live — the corporation is the first ask.
     *
     * Reduced motion: values swap in one settled frame (no travel).
     */
    /** The queue / purchase-row slot a start card lands into. */
    queueTargetEl(name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name;
      return root.querySelector<HTMLElement>(`[data-queue-slot="${esc}"], [data-pay-card="${esc}"]`);
    },
    /**
     * GAME FRAME MATERIALIZATION — the screen is replaced UNDER the moving
     * cards (the hand-workspace principle: the new surface is prepared in
     * its FINAL geometry before anything travels):
     *
     *  1. the resolved beat — the status preview states its final numbers;
     *  2. CAPTURE — every chosen card gets a proxy over its exact live
     *     pixels; the originals hide in the same tick;
     *  3. LIFT — the cards rise slightly toward the viewer, the CORPORATION
     *     (the player's face) a notch more; the summary's chrome fades;
     *  4. THE SWAP — one cut turn with every shell transition disabled: the
     *     summary layer unmounts, the root re-bounds to the SYSTEM band, the
     *     bars materialize from their edges, and the deployment stands
     *     already FINAL — queue slots held, «РАЗЫГРАНО» shelf in place;
     *  5. FLY — the captured cards carry into the measured slots (convoy in
     *     reading order). After the landings NOTHING re-flows — the layout
     *     they landed into is the layout that stays.
     *
     * Reduced motion: the same swap in one settled frame (no travel).
     */
    async runMaterialization(): Promise<void> {
      this.state.flow = 'materializing';
      if (this.commitSafety !== undefined) {
        window.clearTimeout(this.commitSafety);
        this.commitSafety = undefined;
      }
      const reduced = consoleReducedMotionActive();
      const summary = this.$refs.summaryPane as HTMLElement | undefined;
      const prev = this.$refs.hudPrev as HTMLElement | undefined;
      const moving: Array<CardName> = [];
      if (this.state.corp !== undefined) {
        moving.push(this.state.corp);
      }
      moving.push(...this.state.preludes, ...this.state.projects);

      if (reduced || summary === undefined || !summary.isConnected) {
        this.matSwap = true;
        this.matCut = true;
        this.shellUp = true;
        this.ceremonyRevealed = true;
        this.syncCeremonyLayout();
        await this.$nextTick();
        this.matCut = false;
        this.matSwap = false;
        this.state.flow = 'deploying';
        return;
      }

      // 1) THE RESOLVED BEAT — the preview states its final numbers; the
      // cards stay exactly where they are.
      if (prev !== undefined) {
        prev.classList.add('con-start__hudprev--resolved');
      }
      await new Promise<void>((r) => window.setTimeout(r, motionMs(240)));

      // 2) CAPTURE the cards where they stand (originals hide in this tick;
      // the queue slots are held empty from before their first paint).
      const sources: Array<DockFlightSource> = moving
        .map((name) => ({name, el: this.summaryTileFor(name)}))
        .filter((s): s is DockFlightSource => s.el !== null);
      const capture = captureCards(sources);
      moving.forEach((n) => {
        this.summaryArriving.add(n);
        this.queueArriving.add(n);
      });

      // 3) LIFT — toward the viewer, corporation accented; the summary's
      // chrome calmly finishes its role underneath.
      const liftBeat = capture.lift(this.state.corp);
      gsap.to(summary, {autoAlpha: 0, duration: motionMs(200) / 1000, ease: 'power2.in', delay: 0.06});
      await liftBeat;

      // 4) THE SWAP — one cut turn: summary out, system band + bars + the
      // fully-prepared deployment in, zero transitions, zero reflow after.
      this.matSwap = true;
      this.matCut = true;
      this.shellUp = true;
      this.ceremonyRevealed = true;
      this.syncCeremonyLayout();
      gsap.set(summary, {clearProps: 'opacity,visibility'});
      await this.$nextTick();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      // 5) FLY into the measured slots; each landing reveals its real card.
      await capture.flyTo(
        (name) => this.queueTargetEl(name),
        (name) => this.queueArriving.delete(name));

      this.summaryArriving.clear();
      this.queueArriving.clear();
      this.matCut = false;
      this.matSwap = false;
      this.state.flow = 'deploying';
    },
    /**
     * THE WORKSPACE RELEASE — the deployment settled (corp landed, projects
     * delivered, preludes resolved): the Game Start Workspace dissolves as
     * ONE calm surface and the board takes input on a settled frame. This is
     * the ONLY place the lifetime hold lets go.
     */
    async runSceneRelease(): Promise<void> {
      if (this.state.flow === 'releasing') {
        return;
      }
      this.state.flow = 'releasing';
      const el = this.$el as HTMLElement | undefined;
      if (!consoleReducedMotionActive() && el !== undefined && el.isConnected) {
        // THE RESOLVED BEAT — a short settled frame (the `--resolved` accent:
        // queue empty, dock stable, tableau standing) BEFORE the dissolve, so
        // the release reads as "the start is complete", never as a cut.
        await new Promise<void>((r) => window.setTimeout(r, motionMs(380)));
        await new Promise<void>((resolve) => {
          const safety = window.setTimeout(resolve, motionMs(360) + 700);
          gsap.to(el, {autoAlpha: 0, duration: motionMs(320) / 1000, ease: 'power2.in', onComplete: () => {
            window.clearTimeout(safety);
            resolve();
          }});
        });
      }
      releaseStartScene();
      this.state.flow = 'idle';
    },
    /**
     * SHELL BOUNDS. The deployment's bounds are the SYSTEM workspace band
     * (`--con-ws-left` / `--con-band-*` seam tokens + the `con-ws` marker on
     * the root — the same geometry every workspace of the family stands on;
     * no hand-measured rail inset, ever). This toggle only drives WHAT EXISTS
     * around the workspace: the preparation hides the standard Top Bar and
     * the Player Rail (the player has no game state yet); the ceremony swap
     * MATERIALIZES both from their own edges (the entrance keyframes).
     */
    syncCeremonyLayout(): void {
      // The bars follow the BOUNDED SHELL, not the raw mode: through the
      // materialization they materialize at the SWAP moment (shellUp), never
      // over the still-standing summary.
      const shellUp = this.shellBounded;
      document.body.classList.toggle('con-start-ceremony', shellUp);
      document.body.classList.toggle('con-start-prep', !shellUp);
    },
    /** rAF-coalesced fit for resize bursts (never fires per focus move). */
    scheduleFit(): void {
      if (this.fitScheduled) {
        return;
      }
      this.fitScheduled = true;
      requestAnimationFrame(() => {
        this.fitScheduled = false;
        this.fitCardStrip();
        this.fitSummary();
        this.syncCeremonyLayout();
      });
    },
    /**
     * SUMMARY FIT — one zoom for the whole review so EVERY card fits the
     * pane without clipping and the width is genuinely used: the identity
     * row (corp + preludes + CEO, one notch larger) and the wrapped project
     * rows are solved TOGETHER against the cards column's live box, largest
     * zoom first. Pure math over measured bounds — no per-tile DOM probing,
     * so it is safe to run while pile flights still hold the tiles.
     */
    fitSummary(): void {
      if (!this.summaryShown) {
        return;
      }
      const pane = this.$refs.summaryPane as HTMLElement | undefined;
      if (pane === undefined || pane === null || typeof pane.querySelector !== 'function') {
        return;
      }
      const col = pane.querySelector<HTMLElement>('.con-start__summary-cards');
      if (col === null || col.clientWidth < 60 || pane.clientHeight < 120) {
        return;
      }
      const ui = conUiScale();
      const availW = col.clientWidth;
      const availH = pane.clientHeight;
      const idCount = (this.state.corp !== undefined ? 1 : 0) + this.state.preludes.length +
        (this.state.ceo !== undefined ? 1 : 0);
      const projCount = this.state.projects.length;
      const NAT_W = 320;
      const NAT_H = 460;
      const ID_BOOST = 1.12;
      const titleH = 34 * ui;
      const gap = 14 * ui;
      const rowPad = 12 * ui;
      const fits = (z: number): boolean => {
        const zs = z * ui;
        const idW = NAT_W * zs * ID_BOOST + gap;
        const idCols = Math.max(1, Math.floor((availW + gap) / idW));
        const idRows = idCount > 0 ? Math.ceil(idCount / idCols) : 0;
        const idH = idRows * (NAT_H * zs * ID_BOOST) + Math.max(0, idRows - 1) * gap +
          (idRows > 0 ? titleH + rowPad : 0);
        const prW = NAT_W * zs + gap;
        const prCols = Math.max(1, Math.floor((availW + gap) / prW));
        const prRows = projCount > 0 ? Math.ceil(projCount / prCols) : 0;
        const prH = titleH + rowPad + prRows * (NAT_H * zs) + Math.max(0, prRows - 1) * gap;
        return idH + gap + prH <= availH;
      };
      let zoom = 0.4;
      for (let z = 0.82; z >= 0.4; z -= 0.02) {
        if (fits(z)) {
          zoom = z;
          break;
        }
      }
      pane.style.setProperty('--con-start-mini-zoom', zoom.toFixed(3));
      pane.style.setProperty('--con-start-mini-id-zoom', (zoom * ID_BOOST).toFixed(3));
    },
    /** The height the strip may occupy. The status rail is now PINNED OUTSIDE
     *  the scrollable body (a frame-level element above the command bar), so
     *  the strip may use the WHOLE body height — the cards fill all the space
     *  between the header and the pinned rail (no verdict reserve to subtract). */
    stripAvailHeight(strip: HTMLElement): number {
      const body = this.$refs.body as HTMLElement | undefined;
      if (body === undefined || body === null) {
        return strip.clientHeight;
      }
      return Math.max(180 * conUiScale(), body.clientHeight);
    },
    /**
     * Size the wizard card strip so N cards ALWAYS fit — BOTH axes (the
     * premium 320×460 face made height the binding constraint). The strip
     * then never overflows, never scrolls on focus, and there is no
     * per-focus smooth-scroll churn (Steam Deck).
     *  - single ROW (≤6 cards): `--con-cards-zoom` = min(width-fit,
     *    height-fit, 1) — the corp/prelude steps now EARN a bigger card
     *    when the viewport allows it;
     *  - GRID (>6 cards, the 10-card project buy): a balanced rows×cols
     *    search (the played-tableau planner idea) maximizes the zoom that
     *    fits width AND the body height → `--con-cards-grid-zoom` + a
     *    max-width cap so flex-wrap breaks at the PLANNED column count
     *    (5+5, never 6+4).
     * Runs on mount / step / grid / resize — NEVER per focus. The ceremony
     * candidate strip (no ref) keeps its tuned `__cands` zoom.
     */
    fitCardStrip(): void {
      const strip = this.activeStrip();
      if (strip === undefined || strip === null) {
        // The keyed frame swaps `out-in` — a fresh step's strip mounts only
        // after the 160ms leave. Retry briefly so the fit lands on the NEW
        // strip instead of leaving the CSS fallback zoom.
        if (this.mode === 'wizard' && this.currentStep !== undefined && this.fitRetries < 30) {
          this.fitRetries++;
          requestAnimationFrame(() => this.fitCardStrip());
        } else {
          this.fitRetries = 0;
        }
        return;
      }
      if (this.mode !== 'wizard') {
        strip.style.removeProperty('--con-cards-zoom');
        strip.style.removeProperty('--con-cards-grid-zoom');
        strip.style.removeProperty('max-width');
        return;
      }
      const n = strip.children.length;
      if (n === 0) {
        strip.style.removeProperty('--con-cards-zoom');
        strip.style.removeProperty('--con-cards-grid-zoom');
        strip.style.removeProperty('max-width');
        return;
      }
      const grid = this.wizardGrid;
      // Probe the natural slot size at zoom 1 (offsetWidth/Height ignore the
      // focused card's transform: scale AND report the UNZOOMED box).
      strip.style.setProperty(grid ? '--con-cards-grid-zoom' : '--con-cards-zoom', '1');
      strip.style.removeProperty(grid ? '--con-cards-zoom' : '--con-cards-grid-zoom');
      strip.style.removeProperty('max-width');
      const probe = strip.children[0] as HTMLElement;
      const slotW = probe.offsetWidth;
      const slotH = probe.offsetHeight;
      if (slotW <= 0 || slotH <= 0) {
        if (this.fitRetries < 20) {
          this.fitRetries++;
          requestAnimationFrame(() => this.fitCardStrip());
        }
        return;
      }
      this.fitRetries = 0;
      const cs = window.getComputedStyle(strip);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const colGap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 14;
      const rowGap = parseFloat(cs.rowGap) || colGap;
      const availW = strip.clientWidth - padX;
      const availH = this.stripAvailHeight(strip) - padY;
      // TV profile: the card face is px-natural — its size ceiling/floors
      // scale with the profile so cards stay couch-readable on 4K.
      const s = conUiScale();
      const fit = {n, slotW, slotH, availW, availH, colGap, rowGap, scale: s};
      if (!grid) {
        // Ceiling ROW_ZOOM_CEIL×scale (was 1×): the freed body height now GROWS
        // the corp/prelude row into the space instead of pinning it at natural
        // size; rowFitZoom still clamps to fit both axes.
        strip.style.setProperty('--con-cards-zoom', rowFitZoom(fit, ROW_ZOOM_CEIL).toFixed(3));
        return;
      }
      // GRID (the 10-card project buy): the balanced rows×cols plan with the
      // largest zoom fitting both axes; cap the content width at the planned
      // columns so flex-wrap breaks at 5+5 (never 6+4). Zoom quantizes tiles to
      // device px — rounding room (see TaskHost).
      const plan = gridFitPlan({...fit, maxRows: 3}, GRID_ZOOM_CEIL);
      strip.style.setProperty('--con-cards-grid-zoom', plan.zoom.toFixed(3));
      strip.style.maxWidth = `${Math.ceil(plan.cols * slotW * plan.zoom + (plan.cols - 1) * colGap + padX + 2 + 4 * s)}px`;
    },
    // Foundation: SEMANTIC actions — A(primary) act, X(inspect) zoom card,
    // LT/RT(prev/nextSection, remapped via START_INPUT_OVERRIDES) the symmetric
    // wizard-step navigation, B(back) minimize. LB/RB are deliberately UNUSED
    // in the initial setup (they keep their in-game role only outside it).
    onPress(action: ConsoleAction): void {
      switch (action) {
      case 'primary':
        this.onPrimary();
        return;
      case 'inspect':
        // P13 global rule: X reads the focused card fullscreen.
        this.zoomFocused();
        return;
      case 'prevSection':
        // LT is STEP navigation (back one wizard step); B always minimizes.
        // The collected cards physically RETURN from their pile.
        if (this.mode === 'wizard') {
          void this.backWithReturn();
        }
        return;
      case 'nextSection':
        // RT = forward step navigation (LT's pair); gated on completion. The
        // picked cards physically COLLECT into their Selection-Dock pile. It
        // stops AT the summary — starting the game is ONLY the explicit A
        // commit there, never a shoulder press.
        if (this.mode === 'wizard' && !this.onSummary) {
          if (!this.currentStepComplete) {
            this.counterNudge++;
            return;
          }
          void this.advanceWithCollect();
        }
        return;
      case 'back':
        // B = minimize (inspect the board; the amber chip returns — picks,
        // step progress and the whole deployment claim live in module
        // state). NEVER while a play is physically in flight or an embedded
        // follow-up is open — a defer unmounts the scene and with it the
        // hero's landing target / the reveal's zone (the stranded-card bug).
        if (isPlayedHeroActive() || this.embedActive ||
            isHandDeliveryActive() || this.queueArriving.size > 0) {
          return;
        }
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    /** A: wizard = single-pick commits + advances / multi-pick toggles (RT
     *  continues) / the SUMMARY's launch CTA; ceremony = act. */
    onPrimary(): void {
      if (this.mode === 'wizard') {
        if (this.currentStep === undefined) {
          // The SUMMARY's one press — the explicit «НАЧАТЬ ПАРТИЮ» CTA. A is
          // free here (there is nothing to select), and it is the control the
          // CTA plate names. onContinue still arms the zero-projects warning
          // first, so an empty buy stays a conscious second press.
          this.onContinue();
          return;
        }
        // EVERY step is toggle-then-RT now (the Selection Dock grammar): a
        // pick stays in the grid with its «Выбрана» band — comparable,
        // deselectable, physically collected only when the step advances.
        this.togglePick();
        return;
      }
      this.actOnFocused();
    },
    togglePick(): void {
      const card = this.focusedCard;
      if (card !== undefined) {
        this.togglePickByName(card.name);
      }
    },
    /** P15: pure selection flip — shared by the strip AND the fullscreen
     *  viewer's A (single-pick REPLACES / picked → deselect; NEVER a
     *  continue — the double A/Y continue confusion is gone). */
    togglePickByName(name: CardName): void {
      const step = this.currentStep;
      if (step === undefined) {
        return;
      }
      const picked = this.picksHere.includes(name);
      if (this.singlePickStep) {
        this.writePicks(step.id, picked ? [] : [name]);
        return;
      }
      if (picked) {
        this.writePicks(step.id, this.picksHere.filter((n) => n !== name));
        return;
      }
      if (this.picksHere.length >= step.input.max) {
        // Slots full: state / focus never change — the context rail names the
        // limit + recovery, and replays its one-shot settle as the restrained
        // "the press was heard" feedback.
        this.blockedNudge++;
        return;
      }
      // PROJECTS: no budget for one more card — a NORMAL limit, blocked here so
      // the buy can never go negative; the rail says «Недостаточно средств…».
      if (step.id === 'projects' && this.state.corp !== undefined &&
          (startingMegacredits(this.state.corp, this.picksHere.length + 1) ?? 0) < 0) {
        this.blockedNudge++;
        return;
      }
      this.writePicks(step.id, [...this.picksHere, name]);
    },
    writePicks(id: StartWizardStep['id'], names: ReadonlyArray<CardName>): void {
      switch (id) {
      case 'corp':
        this.state.corp = names[0];
        break;
      case 'prelude':
        this.state.preludes = [...names];
        break;
      case 'ceo':
        this.state.ceo = names[0];
        break;
      case 'projects':
        this.state.projects = [...names];
        break;
      }
    },
    /** The live slot for a card on this scene (data-zoom-slot marker). */
    exitSlotFor(name: string): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-zoom-slot="${esc}"]`);
    },
    /** X / RB: advance the wizard; on the summary — submit. */
    onContinue(): void {
      if (this.mode !== 'wizard') {
        this.actOnFocused();
        return;
      }
      if (this.currentStep !== undefined) {
        if (!this.currentStepComplete) {
          // Blocked RB: no transition — the header's pick counter (the step's
          // gating reason) replays its one-shot nudge instead.
          this.counterNudge++;
          return;
        }
        this.state.stepIdx = this.railPos + 1;
        return;
      }
      // Summary submit — a zero-projects buy arms an inline warning first.
      if (!this.wizardReady) {
        return;
      }
      const input = this.wizardInput;
      if (input === undefined) {
        return;
      }
      const hasProjectsStep = this.steps.some((s) => s.id === 'projects');
      if (hasProjectsStep && this.state.projects.length === 0 && !this.armedSkip) {
        this.armedSkip = true;
        return;
      }
      // Withhold the bought cards from the dock BEFORE the submit brings them
      // into `cardsInHand`, so they never flash in the hand on the way into
      // the ceremony (the reactive watcher re-affirms the SAME hold once in
      // ceremony — idempotent). They fly in on the payment confirm.
      if (this.state.projects.length > 0) {
        armDeliveryHold(deliveryHoldKey(this.state.projects), [...this.state.projects]);
      }
      // THE COMMIT BOUNDARY. The workspace's LIFETIME HOLD arms in the same
      // press as the submit: from here the root Game Start Workspace exists
      // continuously to the end of the deployment — the response's prompt
      // gaps can no longer unmount it (that unmount is what used to close the
      // workspace after commit and strand the corporation hero). The mode
      // flip (the server accepting) runs GAME STATE MATERIALIZATION; the
      // safety below un-arms everything if the submit is refused.
      holdStartScene();
      this.state.flow = 'committing';
      if (this.commitSafety !== undefined) {
        window.clearTimeout(this.commitSafety);
      }
      this.commitSafety = window.setTimeout(() => {
        this.commitSafety = undefined;
        if (this.state.flow === 'committing' && this.mode === 'wizard') {
          // The server never accepted (error / network) — the preparation
          // returns pressable and the lifetime claim lets go.
          this.state.flow = 'idle';
          releaseStartScene();
        }
      }, 20000);
      this.$emit('submit', buildInitialCardsResponse(input, this.picks));
    },
    backStep(): void {
      if (this.railPos > 0) {
        this.state.stepIdx = this.railPos - 1;
      }
    },
    /** Ceremony A: play the corporation / a prelude / pick a candidate. */
    actOnFocused(): void {
      const item = this.focusedItem;
      if (item !== undefined) {
        this.actByName(item.name);
      }
    },
    /** The ceremony action for a card BY NAME — shared by the inline strip AND
     *  the fullscreen viewer's A (play-from-fullscreen parity with the desktop
     *  StartGameFlow). Safe from fullscreen: the viewer closes BEFORE this runs
     *  (ConsoleZoomAction.execute), so a corp sub-action / prelude effect opens
     *  on a clean surface. */
    actByName(name: CardName): void {
      // A hero transaction is in flight (submit awaiting the server) — the
      // press is already being honoured; never double-arm/double-submit.
      if (isPlayedHeroActive()) {
        return;
      }
      // DESTINATION READINESS: a play press is honoured only when the
      // deployment shell is REVEALED and standing (the receiving stage's
      // container, the compact tableau, the rail all live in it). Before
      // that — mid-materialization — the source card must not release.
      if (this.mode === 'ceremony' && (!this.ceremonyRevealed || this.embedActive || this.queueArriving.size > 0)) {
        return;
      }
      const item = this.focusables.find((f) => f.name === name);
      if (item === undefined || item.disabled) {
        return;
      }
      // The card-payment beat: the server holds the exact M€ deduction behind
      // this confirm. The bought cards were shown FACE UP in the pay grid;
      // now they physically fly from there into the hand dock — measure their
      // rects BEFORE the submit (the grid unmounts as the payment resolves),
      // fire the delivery, then submit.
      if (item.kind === 'pay') {
        this.launchStartCardsDelivery();
        this.$emit('submit', {type: 'option'});
        return;
      }
      // The deferred CORPORATION play: arm the hero transaction (the card
      // physically lands in the bottom «Разыграно» only after the server
      // proves the play), claim any follow-up it draws, then submit.
      if (item.kind === 'corp') {
        if (this.corpPlayPrompt !== undefined) {
          this.armStartHero(name);
          this.claimStartFollowUp(name);
          this.$emit('submit', cardsResponse([name]));
        }
        return;
      }
      // A drew-N-choose-ONE pick is recorded BEFORE submit (the discarded
      // candidates vanish from the view — this is the only capture window).
      const draw = startFlowPreludeDrawPrompt(this.playerView);
      // Double Down COPIES an already-played prelude — nothing new enters the
      // tableau, so the hero transaction would (correctly) refuse; it keeps
      // the legacy hero-pick beat instead.
      const copyPick = startFlowPreludeCopyPrompt(this.playerView) !== undefined;
      const submit = () => {
        if (item.kind === 'candidate' && draw !== undefined) {
          recordDrawChoice(this.playerView.id, this.candidateCards.map((c) => c.name), name);
        }
        if (!copyPick) {
          // Preludes / drawn picks / Merger's corp all LAND in the tableau —
          // the hero carries the pressed card into the bottom «Разыграно».
          this.armStartHero(name);
          this.claimStartFollowUp(name);
        }
        this.$emit('submit', cardsResponse([name]));
      };
      // CANDIDATE pick (drew-1-of-N / Double Down / Merger): the rivals —
      // genuinely discarded by the rules — tumble to the discard side while
      // the chosen card runs its hero landing (copy keeps the legacy pick).
      if (item.kind === 'candidate' && !this.deal.state.active) {
        const slot = this.exitSlotFor(name);
        if (slot !== null) {
          const row = this.$refs.queueEl as HTMLElement | undefined;
          const rejects = row !== undefined && row !== null ?
            (Array.from(row.querySelectorAll<HTMLElement>('[data-queue-slot]')))
              .filter((el) => el !== slot && !el.classList.contains('con-deal-hold') &&
                this.candidateCards.some((c) => c.name === el.getAttribute('data-queue-slot'))) : [];
          applyDiscardExit(rejects, {delayMs: 150});
          if (copyPick) {
            void runHeroPick({name, el: slot}, submit);
            return;
          }
        }
      }
      submit();
    },
    /**
     * THE SOURCE EMERGE — the card that caused the draw comes physically
     * forward: its dock face steps AWAY (geometry held), a proxy carries the
     * same pixels into the step's source column, the column card reveals on
     * touchdown. The same take/carry/lay grammar as every start transfer.
     */
    async runEmbedSourceEmerge(): Promise<void> {
      const source = this.outcome.sourceCard as CardName;
      if (source === '' || this.embedSourceShown !== undefined) {
        return;
      }
      this.embedSourceShown = source;
      this.embedSourceArriving = true;
      await this.$nextTick();
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        this.embedSourceArriving = false;
        return;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(source) : source;
      const dockFace = root.querySelector<HTMLElement>(`.con-start__played [data-played-key="${esc}"] .con-splayed__face`);
      const colSlot = root.querySelector<HTMLElement>('[data-embed-source-slot]');
      if (dockFace === null || colSlot === null) {
        this.embedSourceArriving = false; // degraded: the column simply shows
        return;
      }
      // Spawn the carry FIRST (the proxy clones the face's live pixels);
      // `embedSourceShown` is already set, so the dock's REACTIVE `awayCard`
      // hides the face in the same flush the proxy covers it (an imperative
      // class here was wiped by the dock's next patch — the duplicate bug).
      await reseatCards([{name: source, fromEl: dockFace, toEl: colSlot}],
        () => {
          this.embedSourceArriving = false;
        });
      this.embedSourceArriving = false;
    },
    /** THE SOURCE SETTLE — the step is over: the source card returns along
     *  the same physical path into the very stack slot it left; the shelf
     *  face returns REACTIVELY the moment the proxy touches down. */
    async runEmbedSourceSettle(): Promise<void> {
      const source = this.embedSourceShown;
      if (source === undefined) {
        return;
      }
      const root = this.$el as HTMLElement | undefined;
      const q = root !== undefined && typeof root.querySelector === 'function' ? root : undefined;
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(source) : source;
      const colSlot = q?.querySelector<HTMLElement>('[data-embed-source-slot]') ?? null;
      const dockFace = q?.querySelector<HTMLElement>(`.con-start__played [data-played-key="${esc}"] .con-splayed__face`) ?? null;
      if (colSlot !== null && dockFace !== null) {
        this.embedSourceArriving = true; // the column empties under the proxy
        await reseatCards([{name: source, fromEl: colSlot, toEl: dockFace}],
          () => {
            // Touchdown: release the away-state — the shelf face reappears
            // under the settling proxy in the same frame.
            this.embedSourceShown = undefined;
          });
      }
      this.embedSourceShown = undefined;
      this.embedSourceArriving = false;
    },
    /**
     * The play's FOLLOW-UP claim: a start card that DRAWS other cards hosts
     * the shared reveal INSIDE this workspace (the embed zone). Armed in the
     * same press as the submit — nothing card-shaped can slip past it and
     * open a standalone surface for a frame. Cards that draw nothing make no
     * claim (a no-op — the deployment simply continues).
     */
    claimStartFollowUp(name: CardName): void {
      const expected = this.drawExpected.get(name) ?? 0;
      if (expected <= 0) {
        return;
      }
      setWorkspaceOutcomeSlot('.con-start__embed');
      claimWorkspaceOutcome('start', name, ['draw', 'pick'], 0, expected);
    },
    /**
     * The starting-cards DELIVERY (handDeliveryDirector). Fire on the payment
     * confirm: capture the FACE-UP card rects from the payment grid NOW (the
     * grid unmounts as the payment resolves), so the same cards can lift off
     * exactly where they sat, flip to their backs and arc down into the hand
     * dock. Only fires while the delivery is holding this deal (the arm
     * watcher) — a no-op otherwise.
     */
    launchStartCardsDelivery(): void {
      const names = [...this.ceremonyBoughtNames];
      if (names.length === 0) {
        return;
      }
      const grid = this.$refs.payGrid as HTMLElement | undefined;
      const rects = new Map<CardName, DOMRect>();
      if (grid !== undefined && grid !== null) {
        for (const el of grid.querySelectorAll<HTMLElement>('[data-pay-card]')) {
          const name = el.getAttribute('data-pay-card') as CardName | null;
          const card = el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? el;
          const r = card.getBoundingClientRect();
          if (name !== null && r.width > 4) {
            rects.set(name, r);
          }
        }
      }
      runHandDelivery(names, rects);
    },
    /** Arm the played-card hero for a START-SCENE press: the card lifts out
     *  of its scene slot (never the play composer), carrying the prelude's
     *  PRE-FETCHED on-play rewards so the landing gets the same premium
     *  reward beat a composer-played card gets. */
    armStartHero(name: CardName): void {
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
        CSS.escape(name) : name.replace(/"/g, '\\"');
      // HOST 'workspace': the standalone «Разыграно» overlay never opens for
      // a start play. The card lifts out of its QUEUE slot and flies the hero
      // arc DIRECTLY into the compact played dock's reserved FRONT ANCHOR
      // (ConsoleStartPlayedDock.measureFrontAnchor) — a short, causal
      // trajectory: queue → «РАЗЫГРАНО». Effects then resolve FROM the docked
      // card; the queue reflows over the freed slot.
      // The zoom-slot fallback is scoped to the CEREMONY layer: the parked
      // summary pane (v-show) keeps the same zoom-slot identities hidden in
      // the DOM, and an unscoped query used to shadow the live queue slot.
      armPlayedHero(name, false, {
        manualTableOpen: false,
        host: 'workspace',
        sourceSelector: `.con-start [data-queue-slot="${esc}"] :is(.card-container, .pcard), .con-start__ceremony [data-zoom-slot="${esc}"] :is(.card-container, .pcard)`,
        rewards: this.playRewards.get(name),
      });
    },
    /**
     * Pre-fetch the on-play rewards of every card the player can press in the
     * ceremony — the chosen CORPORATION (still in the deferred `corporationPlay`
     * window: its starting M€ + its own production/stock gains) and each
     * PRELUDE. The ceremony has no play composer, so this is where the reward
     * manifest comes from. Runs while the player reads the cards (never gating
     * the press): a card whose fetch hasn't landed simply arms without a beat.
     *
     * Only STOCK / PRODUCTION gains ride the beat here: a card-resource gain
     * needs a pre-selected host card, which the ceremony (with no composer)
     * cannot capture — it stays with the ordinary commit + its own follow-up
     * prompt, never a chip flying at a target the player never chose.
     */
    prefetchPlayRewards(): void {
      const viewerId = this.playerView.id;
      if (typeof fetch !== 'function') {
        return; // JSDOM / a headless host — the beat degrades honestly
      }
      // Every card the player can press RIGHT NOW: the deferred corporation,
      // Merger's offered corporations (its `corporationSelection` candidates —
      // the 2nd corp plays EXACTLY like the first, so it gets the identical
      // reward beat), and the prelude rail. A drew-N prelude candidate rides
      // the same list (it lands in the tableau like any prelude); Double Down's
      // copy candidates are ALREADY-PLAYED preludes — they never re-play, so
      // the copy prompt is skipped (its press keeps the legacy pick beat).
      const corpName = this.corpPlayCard?.name;
      const copyPick = startFlowPreludeCopyPrompt(this.playerView) !== undefined;
      const candidates = copyPick ? [] : this.candidateCards.map((c) => c.name);
      const names: Array<CardName> = [
        ...(corpName !== undefined ? [corpName] : []),
        ...candidates,
        ...this.preludeRail.filter((e) => e.status !== 'played').map((e) => e.name),
      ];
      for (const name of names) {
        if (this.rewardFetched.has(name)) {
          continue;
        }
        this.rewardFetched.add(name);
        const url = apiUrl(paths.API_CARD_PLAY_PREVIEW) +
          '?id=' + encodeURIComponent(viewerId) + '&card=' + encodeURIComponent(name);
        fetch(url)
          .then((r) => (r.ok ? r.json() : undefined))
          .then((p) => {
            const preview = p as ActionPreview | undefined;
            const branch = preview?.branches?.[0];
            if (branch === undefined) {
              return;
            }
            const rewards = extractPlayRewards({
              cardName: name,
              effects: branch.effects,
              steps: branch.steps,
              stepResponses: {}, // the ceremony pre-collects nothing
            }).filter((spec) => spec.channel !== 'card-resource');
            if (rewards.length > 0) {
              this.playRewards.set(name, rewards);
            }
            // The same structural read the card-actions workspace uses: a
            // `cards` gain in the branch means this play DRAWS — its follow-
            // up reveal will be claimed into OUR embed zone at press time.
            let expected = 0;
            for (const e of branch.effects ?? []) {
              if (e.direction === 'gain' && e.icon === 'cards') {
                expected += Math.max(1, Math.round(e.amount));
              }
            }
            if (expected > 0) {
              this.drawExpected.set(name, expected);
            }
          })
          .catch(() => {
            // A failed preview is not a game problem — the card just plays
            // without the reward beat (its chips fire on the commit).
          });
      }
    },
    /** The fullscreen A-verb for a ceremony card, or undefined → read-only.
     *  Preludes / drew-N candidates are PLAYABLE from fullscreen (desktop
     *  parity — «Разыграть»); a corporation's first action is NOT (matching
     *  the desktop, where the corp effect is applied from its column, not the
     *  card viewer). */
    ceremonyZoomLabel(name: CardName): string | undefined {
      const item = this.focusables.find((f) => f.name === name);
      if (item === undefined || item.disabled) {
        return undefined;
      }
      // Every actionable ceremony card — incl. the deferred corporation —
      // is playable from fullscreen (the viewer closes, then actByName runs).
      return this.candidatePrompt !== undefined ? this.candidateVerb : 'Play now';
    },
  },
});
</script>
