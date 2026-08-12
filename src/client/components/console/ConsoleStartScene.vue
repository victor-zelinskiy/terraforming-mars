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
         'con-start--yielded': yielded,
         'con-start--bounded': shellBounded,
         'con-ws': shellBounded,
         'con-start--sponsor': sponsorStep,
         'con-start--matcut': matCut,
         'con-start--materializing': state.flow === 'materializing',
         'con-start--completing': state.flow === 'completing',
         'con-start--releasing': state.flow === 'releasing',
         'con-start--resolved': state.flow === 'completing' || state.flow === 'releasing',
       }"
       role="dialog" :aria-label="$t('Start of the game')">
    <div class="con-start__bg" aria-hidden="true"></div>

    <!-- ONE PERSISTENT FRAME. Never keyed, never `out-in`-swapped: the wizard
         panes, the summary and the deployment are LAYERS of one workspace —
         a stage change is a pane motion under the dock flights (the director),
         never a page replacement through an empty slot. -->
    <div class="con-start__frame" ref="frame">
        <!-- ── Header: the ONE system Workspace header (ConsoleWsHead) ──
             The Game Start Workspace speaks the project's header grammar
             from the first second: СТАРТ ПАРТИИ › <ЭТАП> [› <ФАЗА>]. The aux
             line keeps only local location/action context. The universal
             FLOW tier below hosts one persistent Start Game rail, connected
             to the root marker: tabs while preparation is reversible, linear
             progress once deployment runs, compact parent context in child
             workspaces.
             The TRAILING zone carries the compact PARTICIPANT strip — the
             standard top HUD is hidden through the whole preparation, but
             who is choosing / who is ready stays readable (same status brain
             as the strip, so they can never disagree). -->
        <ConsoleWsHead class="con-start__wshead"
                       root="Start of the game"
                       mark="◈"
                       :subject="wsSubject"
                       :stage="wsStage"
                       :committed="mode === 'ceremony'">
          <template #trailing>
            <!-- Card-step pick counter (wizard): a plain «Выбрано N из M»;
                 re-keyed on a blocked RB press so the chip replays its
                 one-shot nudge (what still gates the step). -->
            <span v-if="mode === 'wizard' && currentStep !== undefined" :key="'cnt' + counterNudge"
                  class="con-start__count"
                  :aria-label="`${$t('Selected')} ${picksHere.length} ${ofMaxText}`"
                  :class="{'con-start__count--ready': currentStepComplete, 'con-start__count--nudge': counterNudge > 0}">
              <span class="con-start__count-label" aria-hidden="true">{{ $t('Selected') }}</span>
              <b aria-hidden="true">{{ picksHere.length }}</b>
              <span aria-hidden="true">{{ ofMaxText }}</span>
            </span>
            <!-- PARTICIPANT READINESS (preparation only — in the deployment
                 the real top strip is back and owns this). Compact by design:
                 seat dot · name · status. Never the whole game HUD. -->
            <div v-if="prepSurfaceLive" class="con-start__crewline" aria-live="polite">
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
          <template #flow>
            <!-- ONE INSTANCE through root ↔ deep ↔ terminal. The workspace
                 stack selects its presentation; nested hand/colonies screens
                 inherit this parent context without rendering or knowing it. -->
            <span ref="flowHost" class="con-start__flowhost">
              <ConsoleJourneyRail :phases="journeyPhases"
                                  :presentation="flowPresentation"
                                  :compact-context="flowCompactContext"
                                  :committing="state.flow === 'completing'"
                                  :pending-item-id="pendingJourneyItemId"
                                  :pulse-key="railPulse"
                                  :pulse-dir="railPulseDir" />
            </span>
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
             :class="{'con-start__summary--prewarm': summaryPrewarm}"
             :style="prewarmStyle"
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
                <!-- SENT — the table is still confirming. The player's own
                     part is DONE: no CTA, no verb, nothing to press but B.
                     The deployment opens for everyone at the same moment,
                     so the honest state here is a calm readout of WHO the
                     game is still waiting for (never an empty deployment). -->
                <div v-if="awaitingOthers" key="await" class="con-start__wait con-start__await">
                  <span class="con-start__wait-scan" aria-hidden="true"></span>
                  <div class="con-start__wait-head">
                    <span class="con-start__wait-orbit" aria-hidden="true"><i></i><i></i><i></i></span>
                    <span class="con-start__wait-title">{{ $t('Your setup is confirmed') }}</span>
                  </div>
                  <div class="con-start__await-line">{{ $t('The game starts when everyone is ready') }}</div>
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
                </div>
                <div v-else-if="!launch.launches" key="wait" class="con-start__wait">
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
        <!-- ── «ЭПАТАЖНЫЙ СПОНСОР»: THE WORKSPACE BECOMES THE HAND ──────
             A prelude whose effect is «play a card from your hand» does not
             put a picker inside the deployment layout — the deployment
             DISSOLVES and the player's real hand screen takes the body, with
             the workspace HEADER standing still as the spatial anchor. That
             is the whole illusion: one surface going deeper, never a second
             screen arriving. Everything the deployment owns (queue, shelf,
             compact «Разыграно», status rail, journey rail) is `v-if`'d away
             for the duration — its STATE is module-level and untouched, so it
             all comes back exactly as it was when the effect resolves.

             The zone is a plain full-size host: the hand teleports in and is
             laid out by its own engine, against the same box it would get as
             a normal screen. -->
        <div v-if="sponsorStep" class="con-start__handstep" data-embed-slot="start-hand"></div>

        <!-- THE COLONIES STEP — a prelude's SelectColony (Early Colonization's
             Build Colony …): the COLONY WORKSPACE is teleported into this zone
             and wears the start's shell (workspace-embed host 'start' ×
             surface 'colonies'). Same contract as the sponsor step: full-size
             host, the deployment parks (module state, returns untouched), the
             crumb reads «СТАРТ ПАРТИИ › <пролог> › КОЛОНИИ». -->
        <div v-if="colonyStep" class="con-start__handstep con-start__colonystep" data-embed-slot="start-colonies"></div>

        <div v-if="mode === 'ceremony' && !sponsorStep && !colonyStep" class="con-start__body con-start__ceremony"
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
            <div class="con-start__queuecol">
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
                       :class="{
                         'con-start__buy--focused': isFocused('pay', PAY_KEY),
                         'con-start__buy--chromehold': buyChrome === 'hold',
                         'con-start__buy--chromein': buyChrome === 'entering',
                       }">
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

            </div>

            <!-- ── THE COMPACT PLAYED DESTINATION — «РАЗЫГРАНО · owner» ──
                 It BELONGS to the deployment, and it YIELDS THE STAGE while a
                 step is standing inside the workspace: the effect's own screen
                 gets the whole room, and the shelf breathes back — in full,
                 measured and settled — before the source card's continuation
                 flight ever aims at it (`runPlayedDockReturn` is awaited ahead
                 of the settle). Recede/return, the same phrase the queue uses;
                 never a hide, never a `v-if`. -->
            <ConsoleStartPlayedDock ref="playedDockEl" :playerView="playerView" :awayCard="embedSourceShown" />

            <!-- EMBEDDED FOLLOW-UP: the shared reveal / the draw & select
                 surface teleports HERE (claim 'start') as an overlay LAYER of
                 the WHOLE deployment row — the same Header / Status Rail /
                 Footer frame it deepens, never a modal over the workspace. The
                 zone stands from the claim's first frame (a teleport needs its
                 target before the search).
                 IT SPANS THE ROW, not the queue column: the step is the only
                 thing the player is doing, so it gets every pixel the
                 deployment was using — the queue has receded and the played
                 shelf has yielded. Only the SOURCE keeps its seat, because it
                 is what the whole step is about: the card physically EMERGES
                 from its dock stack into the left column (its slot keeps
                 geometry, face away — one visual owner), presides over the
                 draw, and SETTLES back into the stack on release. -->
            <div class="con-start__embed" data-embed-slot="start"
                 :class="{
                   'con-start__embed--live': embedActive || sponsorStep || firstActionPanelShown,
                   'con-start__embed--sourced': embedSourceShown !== undefined,
                 }">
              <div v-if="embedSourceShown !== undefined" class="con-start__embedsource" ref="embedSourceCol"
                   :class="{'con-start__embedsource--departing': embedSourceDeparting}">
                <span class="con-start__embedsource-cap">{{ $t('Source') }}</span>
                <div class="con-start__embedsource-card"
                     :class="{'con-deal-hold': embedSourceArriving}"
                     data-embed-source-slot>
                  <ConsolePlayedCardLite :name="embedSourceShown" />
                </div>
              </div>

              <!-- ── THE FIRST-ACTION BRIEFING — the stage's own surface ──
                   It does NOT title itself (the workspace crumb already says
                   «СТАРТ ПАРТИИ › КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ»): the printed
                   ASK leads, the server-computed result chips + honest
                   follow-up rows support, and the state zone is either the
                   calm turn-wait or the ONE clear CTA. It stands beside the
                   seated corporation card and yields the zone to any embedded
                   follow-up the action opens (the seat stays either way). -->
              <transition name="con-start-firstact">
                <div v-if="firstActionPanelShown" class="con-start__firstact"
                     :class="{
                       'con-start__firstact--ready': firstActionActionableNow,
                       'con-start__firstact--busy': firstAct.submitting || firstAct.stage === 'staging',
                     }">
                  <div class="con-start__firstact-head">
                    <span class="con-start__firstact-flag" aria-hidden="true">⚑</span>
                    <span class="con-start__firstact-kicker">{{ $t('Mandatory') }}</span>
                  </div>
                  <div class="con-start__firstact-ask">{{ firstActionAskText }}</div>

                  <div v-if="firstActionEffects.length > 0" class="con-start__firstact-block">
                    <div class="con-start__firstact-cap">{{ $t('Result') }}</div>
                    <div class="con-start__firstact-chips">
                      <ActionEffectChip v-for="(eff, k) in firstActionEffects" :key="k" :effect="eff" />
                    </div>
                  </div>

                  <div v-for="(w, i) in firstActionWarnings" :key="'w' + i" class="con-start__firstact-warn">
                    <span class="con-start__firstact-warn-glyph" aria-hidden="true">⚠</span>
                    <span class="con-start__firstact-warn-body">
                      <span v-if="w.title !== ''" class="con-start__firstact-warn-title">{{ w.title }}</span>
                      <ActionEffectChip v-if="w.effect !== undefined" :effect="w.effect" :skipped="true" />
                      <span class="con-start__firstact-warn-text">{{ w.reason }}</span>
                    </span>
                  </div>

                  <div v-for="(n, i) in firstActionNotes" :key="'n' + i" class="con-start__firstact-next" :aria-label="n.full">
                    <span v-if="n.tileType !== undefined" class="con-start__firstact-next-tile" :style="tileIconStyle(n.tileType)" aria-hidden="true"></span>
                    <span v-else class="con-start__firstact-next-glyph" aria-hidden="true">›</span>
                    <span class="con-start__firstact-next-label">{{ $t('Next') }}</span>
                    <span class="con-start__firstact-next-text">{{ n.text }}</span>
                    <span v-if="n.constraint !== ''" class="con-start__firstact-next-tail">{{ n.constraint }}</span>
                  </div>

                  <!-- The STATE ZONE — one reserved row, so waiting → ready is
                       a paint change on a standing panel, never a re-layout.
                       The rise (staging) keeps it QUIET: a wait line under a
                       card that is still travelling would name a state the
                       player is not in. -->
                  <div class="con-start__firstact-state">
                    <div v-if="firstActionActionableNow" class="con-start__firstact-cta">
                      <GamepadGlyph control="confirm" class="con-start__firstact-cta-glyph" />
                      <span class="con-start__firstact-cta-label">{{ $t('Take first action') }}</span>
                    </div>
                    <div v-else-if="firstAct.submitting" class="con-start__firstact-wait con-start__firstact-wait--busy">
                      <span class="con-start__firstact-wait-text">{{ $t('Executing') }}…</span>
                    </div>
                    <div v-else-if="firstAct.stage === 'standing'" class="con-start__firstact-wait">
                      <span class="con-start__firstact-pulse" aria-hidden="true"><i></i><i></i><i></i></span>
                      <span class="con-start__firstact-wait-text">{{ firstActionWaitLine }}</span>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <!-- ── PINNED STATUS RAIL ───────────────────────────────────────
             The focused card's LOCAL state ONLY (name + picked / limit /
             unaffordable / hint) — NEVER the global «N из M» progress (that
             is the header counter). It sits ABOVE the Selection Dock, and the
             DOCK is the frame's last child — deliberately: the rail exists
             only while a card step is focused (`currentStep`), so with the
             rail below it the shelf jumped up by a whole rail height the
             moment the player stepped onto the SUMMARY. The shelf is the one
             thing that must not move (it is a flight destination and the
             player's running tally); a rail that only appears while there is
             something to say may take that slack instead. Height stays
             reserved for the whole card step, so a message swap never shifts
             the cards; hidden while the deal cinematic runs (nothing
             interactive yet). -->
        <!-- CEREMONY status rail — the same shared workspace status line:
             the focused queue card + its resolution context. Never the full
             startup status, never an effect breakdown. -->
        <!-- The rail STAYS through the embedded reveal (its height is part of
             the deploy zone's geometry — unmounting it mid-embed re-flowed
             the queue and the dock under the open surface): the content
             simply names the deeper step. -->
        <!-- The COLONIES step hides it too: the colony workspace carries its
             own status rail, and with the queue unfocused this one degrades
             to «Ожидаем других игроков» — a lie while the player IS the one
             being waited for (the iteration-2 false-wait bug). -->
        <div v-if="mode === 'ceremony' && ceremonyRevealed && !sponsorStep && !colonyStep"
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

        <!-- ── THE SELECTION DOCK (preparation shelf) ─────────────────
             The decisions already made lie here as compact face-down piles,
             physically collected on RT and returned on LT (startDockMotion).
             Not the Hand Dock, not the Played Tableau — everything here is
             still reversible until the summary commit.
             The frame's LAST child: its seat above the command bar is the
             same on every step INCLUDING the summary (see the status rail
             above — that one is the part allowed to come and go). -->
        <ConsoleStartSelectionDock v-if="prepSurfaceLive" :piles="dockPileView" />

        <!-- The command contract lives in the shell's command bar ONLY
             (footHints → setConsoleStartCommands). The old inline footer
             duplicated it UNDER the bar (z 11700 covers the frame bottom)
             — removed, its height goes to the cards; the frame's bottom
             padding keeps the body clear of the bar. -->
      </div>

    <!-- THE FREEZE LAYER of the summary → deployment scene transition: a
         NON-REACTIVE DOM snapshot of the whole summary frame. The live tree
         underneath may re-render, re-bound and re-title as much as it needs —
         no poll, no mode flip, no bot response can touch this snapshot. The
         card overlay flies ABOVE it; the prepared deployment materializes
         UNDER it; the snapshot cross-dissolves between the two. -->
    <div class="con-start-freeze" ref="freezeHost" aria-hidden="true"></div>

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
import {defineComponent, markRaw, PropType} from 'vue';
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
  buildInitialCardsResponse, clearDockDrift, committedStartJourneyItems, consoleStartState, deploymentCrumb, deploymentJourneyItems,
  driftDockPile, ensureStartWizard, holdStartScene, initialCardsInputOf, initialCardsSignature,
  markStartDeploymentBegun, startAwaitingOthers, startDeploymentBegun,
  picksForStep, releaseStartScene, StartCrewMate, StartCrumb, StartDockPileModel, startFlowBusy,
  StartLaunchState, StartParticipant, startDockPiles, startJourneyItems, startLaunchState,
  sponsorCrumb, startParticipants, StartWizardStep, stepComplete, wizardCrumb, wizardSteps,
} from '@/client/console/consoleStartState';
import {buildStartStatusPreview, StartStatusPreview} from '@/client/console/startStatusPreview';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {afterPreludes, cardCostForCorp, startingMegacredits} from '@/client/components/initialDraft/initialDraftMoney';
import {
  corpActionOptionIndexFor, corporationCardNames, PreludeEntry, preludeEntries, preludeFizzleNotice, recordDrawChoice,
  startFlowCorpPayPrompt, startFlowCorpPlayPrompt, startFlowCorpPrompt, startFlowCorpSelectPrompt,
  startFlowPreludeCopyPrompt, startFlowPreludeDrawPrompt, startFlowPreludePrompt,
} from '@/client/components/startGameFlow/startGameFlowState';
import {
  firstActionActionable, firstActionAsk, firstActionBranch, firstActionDrawExpected,
  firstActionOwed, firstActionStageCorp, startWaitMate,
} from '@/client/console/startFirstAction';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {NextStepRow, noteRow, placementRow} from '@/client/console/consolePlacementNextStep';
import {consoleTranslate} from '@/client/console/consoleTranslate';
import {tileIconStyle} from '@/client/console/consoleTileIcon';
import {
  armPlayedHero, isPlayedHeroActive, playedHeroHolding, playedHeroState,
} from '@/client/console/played/consolePlayedHero';
import {
  descendRecede, descendReturn, guardedDescend,
} from '@/client/console/surfaceMotion/workspaceDescend';
import ConsoleStartPlayedDock from '@/client/components/console/ConsoleStartPlayedDock.vue';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';
import {
  claimWorkspaceOutcome, markWorkspaceOutcomeBeatDone, markWorkspaceOutcomePresenting, releaseWorkspaceOutcome,
  setWorkspaceOutcomeSlot, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive} from '@/client/console/handDock/handDeliveryDirector';
import {captureCards, CapturedFlight, returnFromDock, reseatCards, registerStartDockLayer, resetStartDockMotion, convoyBeats, liveFlightProxies, DockFlightSource, parkSurface, unparkSurface, clearSurfaceParking, measureTargets, pressPile} from '@/client/console/startDockMotion';
import {FACE_DOWN_DEG, FACE_UP_DEG} from '@/client/console/cardFlight/card3dInner';
import {isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {
  setWorkspaceFrameSlot, setWorkspaceFrameSubject, workspaceFrameHasNested, workspaceFrameHost,
  workspaceFramePhase, workspaceFrameSubject, workspaceStackCrumb,
  workspaceStackState,
} from '@/client/console/consoleWorkspaceStack';
import {
  beginStartTransition, endStartTransition, resetStartTransition, setStartTransitionPhase,
  startTransition, transitionKind,
} from '@/client/console/startStageDirector';
import {gsap} from 'gsap';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleJourneyRail, {
  JourneyCompactContext, JourneyItem, JourneyPhase, JourneyPresentation,
} from '@/client/components/console/foundation/ConsoleJourneyRail.vue';
import ConsoleStartSelectionDock from '@/client/components/console/ConsoleStartSelectionDock.vue';
import {armDeliveryHold, runHandDelivery} from '@/client/console/handDock/handDeliveryDirector';
import {extractPlayRewards, ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {ActionEffect, ActionPreview} from '@/common/models/ActionPreviewModel';
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
import {holdForGsapAnimation} from '@/client/components/presentation/animationHold';
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

/**
 * The offset between «the picks have left the table» and «the table starts to
 * retire» (ms @ motion scale 1). Short enough to feel like one gesture, long
 * enough that the eye reads the CAUSE: these cards were taken off THAT table,
 * and the table went away afterwards. A zero offset reads as the whole screen
 * dissolving at once; anything much longer reads as two separate events.
 *
 * This is a CHOREOGRAPHIC offset inside this scene's own phrase, not a guess
 * about when some other animation has finished — every hand-off in the flow
 * waits on a real completion signal.
 */
const SEPARATION_BEAT_MS = 55;

/** The stable delivery-hold key for a bought-cards set (name-derived, so it
 *  survives a reload mid-ceremony and matches between the summary-submit arm
 *  and the in-ceremony re-affirm). */
function deliveryHoldKey(names: ReadonlyArray<CardName>): string {
  return 'ceremony|' + [...names].sort().join(',');
}

/** A locally-created GSAP timeline settles on completion OR interruption.
 *  (`Animation.then` intentionally has no interrupt path.) */
function gsapSettled(animation: gsap.core.Animation): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    animation.eventCallback('onComplete', finish);
    animation.eventCallback('onInterrupt', finish);
  });
}

export default defineComponent({
  name: 'ConsoleStartScene',
  components: {Card, GamepadGlyph, ConsoleCardDealLayer, ConsoleWsHead, ConsoleJourneyRail, ConsoleStartSelectionDock, ConsoleStartPlayedDock, ConsolePlayedCardLite, ActionEffectChip},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** The LIVE `/api/waitingFor` poll (App → shell → here) — see `launch`. */
    waitingOnPlayers: {type: Array as PropType<ReadonlyArray<Color>>, default: () => []},
    /** The live start prompt's task — undefined through the deployment's
     *  prompt gaps (the LIFETIME HOLD keeps the scene mounted then). */
    task: {type: Object as PropType<ConsoleTask | undefined>, default: undefined},
    /**
     * YIELDED — the workspace steps aside for an interaction it cannot host:
     * a BOARD PLACEMENT (a start prelude that owes a tile). COLLAPSE, never
     * close: the component stays mounted (its lifetime hold, its claims and
     * its release watcher are what finish the start — unmounting it here
     * would strand the whole deployment), it just stops painting and stops
     * taking presses while the board serves.
     */
    yielded: {type: Boolean, default: false},
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
      /** The played shelf has receded for an embedded step (its own half of
       *  the deployment's release — see `runPlayedDockRelease`). */
      playedDockReleased: false,
      /** The source card is LEAVING its seat for «РАЗЫГРАНО» — the caption
       *  dissolves with the departure, never after it. */
      embedSourceDeparting: false,
      /** In-flight / done prefetches (never re-request the same card). */
      rewardFetched: new Set<CardName>(),
      /** The played-hero transaction (module reactive — the queue and the
       *  played zone derive their reserved slots from it). */
      heroState: playedHeroState,
      /** The shared claim state (embed zone presence derives from it). */
      outcome: workspaceOutcomeState,
      /** The workspace STACK (module reactive — mirrored so template paths
       *  stay reactive): who is standing inside us, and how deep. */
      stack: workspaceStackState,
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
      /** The live stage transition (module reactive — the ONE director; the
       *  rail, the input gate and the panes all read it, never a private
       *  boolean). Mirrored into `data` so template paths stay reactive. */
      transition: startTransition,
      /** The journey rail's directional impulse: a re-key that replays a
       *  one-shot connector sweep. NEVER a label change (see pulseJourney). */
      railPulse: 0,
      railPulseDir: 0 as 1 | -1 | 0,
      /** The final all-phase commit has consolidated the persistent rail into
       *  its terminal presentation. Local choreography state only: the real
       *  completion predicate remains `deploymentSettled`. */
      flowTerminal: false,
      /** Exact cards belonging to the STARTING-CARDS delivery episode. This
       *  is choreography identity (like `queueArriving`), not a second copy
       *  of purchase progress: held/inFlight remain the live source of truth.
       *  The snapshot scopes the Projects stage so a later prelude draw can
       *  never be mistaken for the initial purchase delivery. */
      startDeliveryNames: [] as Array<CardName>,
      /** Killed on teardown so the completion promise settles through GSAP's
       *  onInterrupt path and can never release a detached start scene. */
      completionTimeline: undefined as gsap.core.Timeline | undefined,
      /** The summary pane is mounted INVISIBLE at its final box so its tiles
       *  can be laid out and measured before any card leaves (§prewarm). */
      summaryPrewarm: false,
      /** The prewarmed pane's box, relative to the workspace frame. */
      prewarmBox: undefined as {left: number, top: number, width: number, height: number} | undefined,
      /**
       * FIT IS FROZEN while cards are airborne. The fit engines re-solve a
       * zoom from the live DOM; running one mid-flight moves the destinations
       * out from under cards that were planned against the old rects. The
       * prewarm has already solved the FINAL geometry by then, so there is
       * nothing to re-solve until everything is down.
       */
      fitLocked: false,
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
      /** THE EMBED'S SOURCE COLUMN — the card that causes the draw, kept IN
       *  the step. For a play pressed HERE the hero flight lands DIRECTLY in
       *  this column (the effect-source seat — the card never reaches the
       *  tableau first); a claim that presents without our hero falls back to
       *  the physical emerge from the dock stack. */
      embedSourceShown: undefined as CardName | undefined,
      /** The column slot is held empty (its card is still in flight). */
      embedSourceArriving: false,
      /** The source card PHYSICALLY stands in the column (the hero landed /
       *  the emerge finished) — only then may the settle FLY it to the dock;
       *  an aborted flow clears the column with no ghost flight. */
      embedSourceLanded: false,
      /** The queue scene has RELEASED (the draw-effect flow owns the room). */
      queueReleased: false,
      /**
       * THE FIRST-ACTION STAGE — the deployment's conditional last stage (the
       * corporation's MANDATORY first action, embedded into the start flow).
       *  · 'idle'       — no stage (nothing owed, or not its turn in the flow);
       *  · 'staging'    — the corp card is rising out of «Разыграно» into the
       *                   source seat; the deployment chrome recedes behind it;
       *  · 'standing'   — the briefing stands around the seated card: waiting
       *                   for the player's turn, or actionable (A performs);
       *  · 'performing' — the option is submitted; the action's own follow-ups
       *                   (a drawn-prelude pick, a placement, a claimed reveal)
       *                   run through the EXISTING deployment grammar;
       *  · 'leaving'    — the chain resolved: the card settles home, the room
       *                   returns, the stage hands the flow to READY.
       */
      firstAct: {
        stage: 'idle' as 'idle' | 'staging' | 'standing' | 'performing' | 'leaving',
        /** The corporation currently owning the stage's seat. */
        corp: undefined as CardName | undefined,
        /** The submit is on the wire — the one anti-double-press latch. */
        submitting: false,
      },
      /** Fetched first-action previews by corp (`has(name)` = fetch settled) —
       *  the briefing's result chips / warnings / follow-up notes. */
      firstActionPreviews: new Map<CardName, ActionPreview | undefined>(),
      /** The stage has stood at least once this mount — keeps its journey
       *  chapter visible (completed) after the action resolves. */
      firstActionSeen: false,
      /** GAME FRAME MATERIALIZATION: the summary layer has been SWAPPED OUT
       *  under the flying cards (the deployment stands in its place). */
      matSwap: false,
      /** The scene transition's CARD OVERLAY (captured at the commit press —
       *  before the submit, over the still-untouched summary). */
      matCapture: undefined as CapturedFlight | undefined,
      /** The frozen summary snapshot is live in the freeze layer. */
      matFrozen: false,
      /** The one-frame re-bound: every shell transition is cut so the new
       *  bounds apply INSTANTLY under the proxies (never a live reflow). */
      matCut: false,
      /** The STANDARD SHELL is up: bounded band + `con-ws` + bars. Decoupled
       *  from the mode flip — the swap moment of the materialization owns it
       *  (binding it to `mode` re-bounded the LIVE summary mid-transition:
       *  clipped cards, early bars — the exact rejected frame). */
      shellUp: false,
      /**
       * The commit was ACCEPTED but the table is still confirming — this
       * player waited on their summary. The materialization then plays when
       * the deployment finally arrives (it re-arms its own freeze there, on
       * the live summary), so the hand-over is the same cinematic for
       * everyone, just later.
       */
      sentAwaiting: false,
      /** The «КУПЛЕНО» box's CHROME (plate + caption) through the
       *  materialization: held away while the bought projects are airborne,
       *  entering only when the LAST of them stands in the row — the box
       *  materializes AROUND landed cards, never as an empty frame waiting. */
      buyChrome: 'shown' as 'shown' | 'hold' | 'entering',
    };
  },
  computed: {
    wf(): PlayerInputModel | undefined {
      return this.playerView.waitingFor;
    },
    wizardInput(): SelectInitialCardsModel | undefined {
      return initialCardsInputOf(this.wf);
    },
    /**
     * THE TWO BOUNDS OF THE WORKSPACE. `ceremony` is the DEPLOYMENT, and it
     * begins when the SERVER hands this player their start sequence — never
     * merely because their wizard input is gone. In a multiplayer table the
     * gap between «I confirmed» and «everyone confirmed» is exactly that
     * state, and treating it as the deployment opened an empty one (no
     * queue, no hand dock, no way back once minimized).
     */
    mode(): 'wizard' | 'ceremony' {
      if (this.deploymentLatched) {
        return 'ceremony';
      }
      return this.wizardInput !== undefined || this.awaitingOthers ? 'wizard' : 'ceremony';
    },
    /** The latch (module state — it must survive this component's own
     *  re-renders and the deployment's prompt gaps). */
    deploymentLatched(): boolean {
      return startDeploymentBegun();
    },
    /**
     * SENT, AND THE TABLE IS STILL WAITING. The player's picks are final and
     * nothing is asked of them: the summary STAYS (its cards, its numbers),
     * the launch CTA becomes a calm waiting readout, and the deployment
     * opens for everyone at the same moment.
     */
    awaitingOthers(): boolean {
      return startAwaitingOthers(this.playerView);
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
      // «ЭПАТАЖНЫЙ СПОНСОР»: the crumb states the CAUSE, then the stage the
      // player is standing in — `СТАРТ ПАРТИИ › ЭПАТАЖНЫЙ СПОНСОР › КАРТЫ В
      // РУКЕ`, deepening to `… › РОЗЫГРЫШ` and `… › РАЗЫГРАНО` as the descent
      // goes on. Stable context BEFORE the mutable stage: the source card is
      // the same vnode all the way through, only the tail advances.
      // A prelude's COLONIES step: «СТАРТ ПАРТИИ › <пролог> › КОЛОНИИ» —
      // post-commit (the prelude is played; the colony pick is its effect),
      // so the tail is amber from the first frame.
      if (this.colonyStep) {
        return sponsorCrumb({
          source: this.sponsorSource,
          stage: 'Colonies',
          committed: true,
        });
      }
      if (this.sponsorStep) {
        // THE TAIL IS THE DEEPEST STEP'S, not the hosted hand's. The chain can
        // go one level further (a played card owing a colony:
        // «СТАРТ ПАРТИИ › <пролог> › КОЛОНИИ»), and a crumb that stopped at the
        // hand would keep naming a stage the player left two screens ago. The
        // stack already answers this — the root and subject stay ours.
        const crumb = workspaceStackCrumb();
        return sponsorCrumb({
          source: this.sponsorSource,
          stage: crumb?.stage ?? '',
          committed: crumb?.committed === true,
        });
      }
      return deploymentCrumb({
        embedActive: this.embedActive,
        embedPhase: this.outcome.phaseKey,
        embedSubject: this.embedSubject,
        corpPending: this.deploymentFlowStage === 'corp',
        payPending: this.deploymentFlowStage === 'pay',
        corpPick: this.corpCandidatePick,
        // The first-action tail — while its briefing/wait stands. A follow-up
        // pick (the drawn preludes) advances the tail through the EXISTING
        // grammar (candidates → «ПРОЛОГИ › РОЗЫГРЫШ», an embedded reveal →
        // the claim's own stage name) — the root never restarts.
        firstAction: this.firstActionPanelShown ||
          (this.deploymentFlowStage === 'firstAction' && this.candidatePrompt === undefined && !this.embedActive),
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
    /**
     * The embed's subject — THE SOURCE CARD ITSELF.
     *
     * Stable context BEFORE the mutable stage, exactly as `sponsorCrumb`
     * already does for a play-from-hand effect: «СТАРТ ПАРТИИ › КОРПОРАТИВНЫЕ
     * АРХИВЫ › ВЫБОР». The crumb used to name the card's GROUP instead
     * («ПРОЛОГИ»), which is a true sentence about the wrong thing — the player
     * is inside ONE card's effect, and the whole reason that effect renders in
     * this workspace rather than in a modal is that it never stopped being that
     * card's. Card names are i18n keys, so this needs no `subjectRaw`.
     */
    embedSubject(): string | undefined {
      const source = this.outcome.sourceCard;
      return source === '' ? undefined : source;
    },
    /** Bought projects remain the active deployment step until their real
     *  HandDock delivery has landed, not merely until the payment prompt
     *  disappears. */
    projectDeliveryPending(): boolean {
      if (this.corpPayCost !== undefined) {
        return true;
      }
      const live = new Set([...handDeliveryState.held, ...handDeliveryState.inFlight]);
      return this.startDeliveryNames.some((name) => live.has(name));
    },
    /** Parent source wins over the card being played inside its child effect
     *  (Eccentric Sponsor's project is still part of the PRELUDE step). */
    flowEffectCard(): CardName | undefined {
      if (this.sponsorSource !== undefined) {
        return this.sponsorSource;
      }
      if (this.outcome.sourceCard !== '') {
        return this.outcome.sourceCard as CardName;
      }
      return this.heroState.card;
    },
    /** The deployment stage stays on its source until every effect/child/card
     *  motion has returned. This is presentation over existing live signals,
     *  not a second progress latch. */
    deploymentFlowStage(): 'corp' | 'pay' | 'preludes' | 'firstAction' | 'ready' {
      // While the FIRST-ACTION stage is up, everything its action spawns —
      // the corp-sourced claim, the drawn-prelude pick, the placement yield —
      // belongs to THAT stage, not back to «Корпорация» / «Прологи» (the
      // journey must never re-open a completed chapter for a chain the last
      // stage started).
      if (this.firstActionStageLive) {
        return 'firstAction';
      }
      const effectOpen = this.heroState.active || this.embedActive || this.sponsorPending ||
        this.effectReturnPending || workspaceFrameHasNested('start') || this.yielded ||
        currentRevealEvent() !== undefined;
      const sourceType = this.flowEffectCard === undefined ? undefined : getCard(this.flowEffectCard)?.type;
      if (this.corpPlayPrompt !== undefined || this.corpCandidatePick ||
          (effectOpen && sourceType === CardType.CORPORATION)) {
        return 'corp';
      }
      if (this.projectDeliveryPending) {
        return 'pay';
      }
      if (this.preludeRail.length > 0 || startFlowPreludePrompt(this.playerView) !== undefined ||
          (effectOpen && sourceType === CardType.PRELUDE) ||
          (effectOpen && sourceType === undefined)) {
        return 'preludes';
      }
      // The cards are through; the mandatory first action is what remains
      // (its stage is about to rise, or its wait is standing).
      if (this.firstActionOwedNow) {
        return 'firstAction';
      }
      return 'ready';
    },
    /** The Journey Rail items: reversible TABS through the preparation,
     *  a linear PROGRESS readout through the deployment. */
    selectionJourneyItems(): ReadonlyArray<JourneyItem> {
      if (!this.state.hold && this.mode === 'wizard' && this.steps.length > 0) {
        return startJourneyItems(this.steps, this.picks, this.railPos, this.state.visited);
      }
      return committedStartJourneyItems(this.state.stepIds);
    },
    deploymentJourneyItemsView(): ReadonlyArray<JourneyItem> {
      if (this.state.flow === 'completing' || this.state.flow === 'releasing') {
        return deploymentJourneyItems({
          corpPending: false,
          payPending: false,
          boughtCards: this.state.projects.length > 0,
          preludesLeft: 0,
          hasPreludes: this.state.preludes.length > 0 || this.playedPreludes.length > 0,
          hasFirstAction: this.firstActionSeen,
          firstActionPending: false,
        }).map((item) => ({...item, state: 'completed' as const}));
      }
      const deploymentLive = this.mode === 'ceremony' && this.state.flow !== 'materializing';
      if (!deploymentLive) {
        const future: Array<JourneyItem> = [
          {id: 'corp', label: 'Corporation', state: 'locked'},
        ];
        if (this.state.projects.length > 0) {
          future.push({id: 'pay', label: 'Projects', state: 'locked'});
        }
        if (this.state.preludes.length > 0) {
          future.push({id: 'preludes', label: 'Preludes', state: 'locked'});
        }
        future.push({id: 'ready', label: 'Ready', state: 'locked'});
        return future;
      }
      return deploymentJourneyItems({
        corpPending: this.deploymentFlowStage === 'corp',
        payPending: this.deploymentFlowStage === 'pay',
        boughtCards: this.ceremonyBoughtNames.length > 0,
        preludesLeft: this.deploymentFlowStage === 'preludes' ? Math.max(1, this.preludeRail.length) : 0,
        hasPreludes: this.state.preludes.length > 0 || this.preludeRail.length > 0 ||
          this.playedPreludes.length > 0 || this.deploymentFlowStage === 'preludes',
        // The stage EXISTS whenever the corp owes its opening move (visible
        // as the upcoming chapter from the first frame of the deployment) —
        // and it STAYS, completed, once the action resolves (`firstActionSeen`
        // — the rail must not shrink a chapter the player just finished).
        hasFirstAction: this.firstActionOwedNow || this.firstActionStageLive || this.firstActionSeen,
        firstActionPending: this.deploymentFlowStage === 'firstAction',
      });
    },
    journeyPhases(): ReadonlyArray<JourneyPhase> {
      /* Keep the deployment chapter physically open while its final commit
       * beam confirms the already-settled canonical items. `flowTerminal` then
       * consolidates this SAME mounted object into READY. Previously the
       * `completing` flag collapsed the item track one frame before GSAP tried
       * to acknowledge it, making the premium completion sequence invisible. */
      const terminal = this.flowTerminal || this.state.flow === 'releasing';
      const deploymentLive = this.mode === 'ceremony' && this.state.flow !== 'materializing';
      const selectionWaiting = !terminal && !deploymentLive &&
        (this.awaitingOthers || this.state.flow === 'committing' || this.state.flow === 'materializing');
      return [
        {
          id: 'selection', ordinal: '01', label: 'Selection', mode: 'tabs',
          state: terminal || deploymentLive ? 'completed' : (selectionWaiting ? 'waiting' : 'current'),
          items: this.selectionJourneyItems,
        },
        {
          id: 'deployment', ordinal: '02', label: 'Playing', mode: 'progress',
          state: terminal ? 'completed' : (deploymentLive ? 'current' : 'locked'),
          items: this.deploymentJourneyItemsView,
        },
      ];
    },
    flowPresentation(): JourneyPresentation {
      if (this.flowTerminal) {
        return 'complete';
      }
      return workspaceFrameHasNested('start') ? 'compact' : 'expanded';
    },
    flowCompactContext(): JourneyCompactContext {
      const deploymentContext = this.mode === 'ceremony' || this.state.hold;
      if (!deploymentContext) {
        const current = this.selectionJourneyItems.find((item) => item.state === 'current');
        return {
          ordinal: '01',
          phaseLabel: 'Selection',
          itemLabel: this.awaitingOthers ? 'Waiting for other players' : (current?.label ?? 'Summary'),
        };
      }
      const itemLabel = this.deploymentFlowStage === 'corp' ? 'Corporation' :
        (this.deploymentFlowStage === 'pay' ? 'Projects' :
          (this.deploymentFlowStage === 'firstAction' ? 'First action' :
            (this.deploymentFlowStage === 'ready' ? 'Ready' : 'Preludes')));
      return {ordinal: '02', phaseLabel: 'Playing', itemLabel};
    },
    /**
     * THE PENDING STAGE — what the player asked for, while it is still not
     * what is on screen. The rail shows it as a directional anticipation and
     * NOTHING else: `journeyItems` keeps `current` on the ACTIVE stage for the
     * whole transition, so no chip ever claims a stage whose cards have not
     * arrived yet.
     */
    pendingJourneyItemId(): string {
      if (this.mode !== 'wizard' || this.transition.kind === undefined) {
        return '';
      }
      return this.selectionJourneyItems[this.transition.to]?.id ?? '';
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
    /**
     * «ЭПАТАЖНЫЙ СПОНСОР» — this workspace is hosting the play-from-hand step
     * (the hand is teleported into our embed zone and wears our shell). The
     * deployment queue does NOT unmount: it parks, keeps its order, its focus
     * and its already-played cards, and comes back untouched.
     */
    sponsorStep(): boolean {
      return workspaceFrameHost('hand') === 'start';
    },
    /** A prelude's SelectColony — this workspace hosts the COLONIES step
     *  (same shape as the sponsor's hand step, different surface). */
    colonyStep(): boolean {
      return workspaceFrameHost('colonies') === 'start';
    },
    /**
     * OUR ZONE for whichever step we are hosting — one selector, published
     * once. Two mutually exclusive divs, so the frame below never has to know
     * which of its children it is carrying.
     */
    stepSlot(): string {
      if (this.sponsorStep) {
        return '.con-start__handstep';
      }
      return this.colonyStep ? '.con-start__colonystep' : '';
    },
    /**
     * A play-from-hand effect is still owed — the server is holding its
     * `SelectProjectCardToPlay`, or the player's commit is on the wire. Read
     * from the RAW prompt (not from the embed claim) on purpose: the claim
     * derives from the workspace serving, and the workspace serving must not
     * derive from the claim.
     */
    sponsorPending(): boolean {
      const wf = this.playerView.waitingFor;
      if (wf !== undefined && wf.type === 'projectCard') {
        const hand = new Set(this.playerView.cardsInHand.map((c) => c.name));
        return wf.cards.length > 0 && wf.cards.every((c) => hand.has(c.name));
      }
      // …or the hosted step has crossed its own commit boundary: between the
      // submit and the project's landing the server names no prompt at all.
      const phase = workspaceFramePhase('hand');
      return phase !== undefined && isCommitted(phase);
    },
    /** The card whose effect asked for the play — the crumb's subject. */
    sponsorSource(): CardName | undefined {
      const src = workspaceFrameSubject('start');
      return src === '' ? undefined : src as CardName;
    },
    embedActive(): boolean {
      return this.outcome.host === 'start' && this.outcome.sourceCard !== '';
    },
    /**
     * THE START EFFECT FLOW — one derived beat for the whole draw-effect
     * episode, so the scene choreography advances from ONE watcher instead of
     * scattered listeners racing each other. The physical timeline:
     *
     *   press  — claim armed, the source seat mounts held, hero armed at it;
     *   depart — the hero proxy is UP and carrying (the queue scene releases
     *            under it — the pressed slot is already blanked, zero pop);
     *   landed — the hero's atomic handoff (real column card under the proxy);
     *   (the shared reveal then presents in the freed zone; its own lifecycle
     *    — deck flights, picks, intake — is the deck-draw scene's);
     *   return — the claim released: the queue scene returns, THEN the source
     *            card carries on into «Разыграно» (the settle flight);
     *   failed — the submit died: restore everything, no ghost flights.
     */
    startEffectBeat(): 'idle' | 'staged' | 'depart' | 'landed' | 'failed' {
      if (this.embedSourceShown === undefined) {
        return 'idle';
      }
      if (playedHeroState.card !== this.embedSourceShown) {
        return this.embedSourceLanded ? 'landed' : 'staged';
      }
      if (playedHeroState.phase === 'failed') {
        return 'failed';
      }
      if (playedHeroState.revealed || this.embedSourceLanded) {
        return 'landed';
      }
      // 'preparing' still measures/blanks the pressed slot — the release
      // starts one phase later, when the proxy already owns the pixels.
      return playedHeroHolding() && playedHeroState.phase !== 'preparing' ? 'depart' : 'staged';
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
      // The first-action stage (its own briefing beats only — a follow-up
      // pick names the FOCUSED candidate below, exactly as every pick does):
      // the seated corporation IS the subject.
      if (this.firstActionPanelShown && this.firstAct.corp !== undefined) {
        return translateText(this.firstAct.corp);
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
      // The first-action stage: the rail carries only the short state — the
      // briefing panel owns the wait line (one text, one place; the rail
      // repeating it beside the panel read as an echo). A follow-up pick
      // falls through to the ordinary focused-card grammar.
      if (this.firstActionPanelShown) {
        return this.firstActionActionableNow ? translateText('Mandatory first action') : '';
      }
      if (this.firstActionStageLive && this.candidatePrompt === undefined) {
        return '';
      }
      const f = this.focusedItem;
      if (f === undefined) {
        // NOTHING FOCUSED IS NOT «WE ARE WAITING FOR OTHERS». The rail used to
        // print that as a blanket fallback, so every gap of the deployment (a
        // submit round trip, the beat between two stages, the whole
        // first-action stage) told a SOLO player they were waiting for a bot
        // that was not moving at all. The line may only be said when there is
        // an actually-active opponent to NAME; otherwise the rail is silent.
        return this.heroState.active ? '' : this.ceremonyWaitLine;
      }
      switch (f.kind) {
      case 'corp':
        return translateText('Ready to play');
      case 'pay':
        return translateText('Confirm the purchase');
      case 'candidate':
        return translateText('Select one');
      default: {
        // A prelude that would FIZZLE names what pressing A actually costs (the
        // badge is only the marker — the sentence is the rail's job).
        const notice = preludeFizzleNotice(this.preludeRail, f.name);
        if (notice !== undefined) {
          return translateText(notice);
        }
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
      // A board-owned placement or any nested workspace is still part of the
      // source card's effect. READY may only begin after that surface has
      // returned to the Start frame, even when no startSequence prompt remains.
      if (this.yielded || workspaceFrameHasNested('start')) {
        return false;
      }
      // «ЭПАТАЖНЫЙ СПОНСОР» — a prelude whose effect is «play a card from your
      // hand» is NOT finished when its own card docks: the server is holding a
      // live `SelectProjectCardToPlay` for it, and the project it buys has yet
      // to be chosen, played, landed and resolved. Releasing here is what used
      // to throw the player onto a bare board (or, worse, close the last
      // prelude's workspace before its own effect had run).
      return !this.sponsorPending &&
        // …and neither is a prelude whose effect has resolved but whose CARD is
        // still on its way home. The claim releases the moment the server stops
        // asking, which is a beat BEFORE the source card leaves its seat for
        // «РАЗЫГРАНО» and the two halves of the deployment breathe back. Letting
        // the scene go there produced two reported bugs at once, and they were
        // the same bug: on the LAST prelude the card's play animation never ran
        // (the board simply appeared), and on every prelude the shelf kept a
        // blanked top slot — `awayCard` still naming a card whose settle never
        // reached the line that clears it, so only the peek strip painted.
        !this.effectReturnPending &&
        // THE FIRST-ACTION STAGE is the deployment's own conditional last
        // stage now: the workspace may not settle while the corporation still
        // OWES its mandatory first action (domain ledger / live prompt), and
        // not before the stage's own return beat has physically completed
        // (the corp card settled home, the room breathed back).
        !this.firstActionOwedNow &&
        this.firstAct.stage === 'idle' &&
        this.corpPlayPrompt === undefined &&
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
    // ── THE FIRST-ACTION STAGE (the deployment's conditional last stage) ──
    /** The corporation still owes its mandatory first action (see
     *  startFirstAction.ts — domain ledger / live marked prompt). */
    firstActionOwedNow(): boolean {
      return firstActionOwed(this.playerView);
    },
    /** The corp the stage seats (the READY one first — Merger resolves them
     *  one at a time as the server re-raises the prompt). */
    firstActionCorpNow(): CardName | undefined {
      return firstActionStageCorp(this.playerView);
    },
    /** The player's turn has genuinely arrived — the marked OrOptions is live
     *  and carries the seated corp's option. */
    firstActionActionableNow(): boolean {
      return this.firstAct.stage === 'standing' && !this.firstAct.submitting &&
        firstActionActionable(this.playerView, this.firstAct.corp);
    },
    /** The stage is on screen in ANY of its beats. */
    firstActionStageLive(): boolean {
      return this.firstAct.stage !== 'idle';
    },
    /** The briefing PANEL renders — never over an embedded follow-up (the
     *  reveal owns the zone then; the seat stays either way) and never once
     *  the action is off performing its own presentation. */
    firstActionPanelShown(): boolean {
      return (this.firstAct.stage === 'staging' || this.firstAct.stage === 'standing') &&
        !this.embedActive && this.candidatePrompt === undefined;
    },
    /**
     * ENTRY IS DUE — the deployment's cards are through, nothing is mid-air,
     * nothing is hosted, and the corporation still owes its opening move.
     * Pure entry predicate: the watcher acts on its rising edge only.
     */
    firstActionEntryDue(): boolean {
      if (this.firstAct.stage !== 'idle' || this.mode !== 'ceremony' || !this.ceremonyRevealed) {
        return false;
      }
      if (!this.firstActionOwedNow || this.firstActionCorpNow === undefined) {
        return false;
      }
      if (this.yielded || workspaceFrameHasNested('start')) {
        return false;
      }
      if (this.sponsorPending || this.effectReturnPending ||
          this.corpPlayPrompt !== undefined || this.corpPayCost !== undefined ||
          this.candidatePrompt !== undefined ||
          startFlowPreludePrompt(this.playerView) !== undefined ||
          this.wizardInput !== undefined) {
        return false;
      }
      return !this.heroState.active && !this.embedActive &&
        currentRevealEvent() === undefined && !isHandDeliveryActive() &&
        this.queueCards.length === 0 && this.payProjects.length === 0 &&
        this.queueArriving.size === 0;
    },
    /**
     * The stage's CHAIN IS QUIET — every visual consequence of the action has
     * returned to this frame: no yield (the placement excursion holds it), no
     * embedded follow-up, no candidate pick, no hero, no reveal, no intake.
     * Shared by the leave (below) and the Merger re-stand.
     */
    firstActionChainQuiet(): boolean {
      return !this.yielded && !workspaceFrameHasNested('start') &&
        !this.embedActive && this.candidatePrompt === undefined &&
        startFlowPreludePrompt(this.playerView) === undefined &&
        !this.heroState.active && currentRevealEvent() === undefined &&
        !isHandDeliveryActive() && this.queueCards.length === 0 &&
        this.queueArriving.size === 0;
    },
    /**
     * THE STAGE MAY LEAVE — the action resolved (ledger drained, prompt gone)
     * and its chain is quiet. One release, at the end.
     */
    firstActionLeaveDue(): boolean {
      if (this.firstAct.stage === 'idle' || this.firstAct.stage === 'leaving') {
        return false;
      }
      if (this.firstActionOwedNow) {
        return false;
      }
      return this.firstActionChainQuiet;
    },
    /** The seated corp's fetched preview (undefined = fetch pending/failed). */
    firstActionPreview(): ActionPreview | undefined {
      const corp = this.firstAct.corp;
      return corp === undefined ? undefined : this.firstActionPreviews.get(corp);
    },
    /** The printed ASK — the live option's buttonLabel (`initialActionText`),
     *  or the honest generic while the prompt has not arrived yet. */
    firstActionAskText(): string {
      const ask = firstActionAsk(this.playerView, this.firstAct.corp);
      return ask !== undefined ? translateText(ask) : translateText('Take the first action of your corporation');
    },
    /** The server-computed result chips of the seated corp's action. */
    firstActionEffects(): ReadonlyArray<ActionEffect> {
      return firstActionBranch(this.firstActionPreview)?.effects ?? [];
    },
    /** Skipped-effect warnings (the shared derivation — composer parity). */
    firstActionWarnings(): Array<{title: string, reason: string, effect?: ActionEffect}> {
      const branch = firstActionBranch(this.firstActionPreview);
      if (branch === undefined) {
        return [];
      }
      return skippedEffectViews(branch.steps).map((w) => ({
        title: w.title !== '' ? translateText(w.title) : '',
        reason: translateText(w.reason),
        effect: w.effect,
      }));
    },
    /** Honest post-confirm follow-ups («ДАЛЕЕ: разместите тайл города…») —
     *  the same presenters the play composer uses. */
    firstActionNotes(): Array<NextStepRow> {
      const branch = firstActionBranch(this.firstActionPreview);
      if (branch === undefined) {
        return [];
      }
      const out: Array<NextStepRow> = [];
      for (const s of branch.steps) {
        if (s.kind === 'boardPlacement') {
          out.push(placementRow(s, consoleTranslate, textOf));
        } else if (s.kind === 'note' && s.noteKind !== 'warning') {
          out.push(noteRow(s.text !== undefined ? textOf(s.text) : translateText('Choose a target')));
        } else if (s.kind === 'input') {
          const t = textOf(s.input.title);
          out.push(noteRow(t !== '' ? t : translateText('Choose a target')));
        }
      }
      return out;
    },
    /** The waiting readout — whose move the stage is calmly waiting out. */
    firstActionWaitLine(): string {
      const mate = startWaitMate(this.playerView, this.waitingOnPlayers);
      if (mate === undefined) {
        return translateText('The first action unlocks on your turn');
      }
      return translateTextWithParams('Waiting for ${0} to finish their move', [participantDisplayName(mate)]);
    },
    /**
     * THE HONEST WAIT LINE for the ceremony's status rail — «ожидаем» is a
     * claim about ANOTHER PLAYER, so it may only be said when there is one to
     * name. Empty otherwise: the deployment's own gaps (a submit round trip,
     * the beat between two stages) are not a wait for anybody, and printing
     * one there told a solo player they were waiting for a bot that was not
     * even moving.
     */
    ceremonyWaitLine(): string {
      const mate = startWaitMate(this.playerView, this.waitingOnPlayers);
      return mate === undefined ?
        '' :
        translateTextWithParams('Waiting for ${0} to finish their move', [participantDisplayName(mate)]);
    },
    /**
     * THE EFFECT'S RETURN IS STILL OWED — the source card has not finished its
     * journey into «РАЗЫГРАНО», or a half of the deployment is still receded.
     *
     * A separate question from `embedActive`: that one is about the SERVER
     * (is the effect still asking?), this one is about the SCREEN (has what
     * the effect started finished moving?). The scene may only dissolve when
     * both are answered.
     */
    effectReturnPending(): boolean {
      return this.embedSourceShown !== undefined ||
        this.queueReleased ||
        this.playedDockReleased;
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
          // The server's own reason (Merger's unaffordable corps say so). This
          // used to be hardcoded `undefined`, so the template's reason line
          // never rendered and a dimmed card carried a bare «Недоступна».
          reason: disabled ? this.disabledCardReason(c) : undefined,
          dimmed: disabled,
          dealIdx: i,
        });
      });
      const preludesLive = startFlowPreludePrompt(this.playerView) !== undefined;
      for (const e of this.preludeRail) {
        const playable = e.status === 'playable' && preludesLive;
        // A would-FIZZLE prelude stays fully pressable — the badge warns, it never
        // withholds. What it costs is the status rail's line (`ceremonyStatusText`);
        // the badge is the at-a-glance marker that survives losing focus, and it
        // rides the pickband — OUTSIDE the dimmable card body, so a state badge
        // never fades with the card it describes.
        out.push({
          name: e.name, kind: 'prelude',
          verb: playable ? 'Play now' : undefined,
          badge: playable && e.fizzles ? 'Will fizzle' : undefined,
          badgeClass: playable && e.fizzles ? 'con-cards__pickband--warn' : undefined,
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
      // PREWARM: mounted (and laid out at its final box) but held invisible —
      // its tiles are the destinations the convoy has to measure BEFORE it
      // starts, and a `v-show`-hidden pane has no geometry at all.
      return this.summaryPrewarm || this.onSummary || this.state.flow === 'committing' ||
        (this.state.flow === 'materializing' && !this.matSwap) ||
        // SENT, WAITING FOR THE TABLE: the summary is still the player's
        // screen — their picks, their numbers, nothing asked of them.
        this.awaitingOthers;
    },
    /**
     * THE PREPARATION SURFACE IS STILL THE LIVE ONE — the same boundary
     * `summaryShown` uses. The deployment is assembled UNDER the freeze
     * snapshot in one cut (`matSwap`), so everything that BELONGS to the
     * preparation has to retire in that cut, not when the episode ends.
     *
     * Load-bearing for THE LANDING, not just for tidiness. The convoy
     * measures its destinations right after the swap. A preparation element
     * still in flow at that moment is measured into the destination and then
     * removed: the selection shelf takes real HEIGHT off the deployment row,
     * the crew strip real WIDTH off the header. Retiring them at `flow →
     * 'deploying'` (i.e. after the cards were already down) is exactly what
     * made the whole composition jump the instant the player chips vanished —
     * the cards had landed on geometry that then stopped existing.
     *
     * The player sees none of the retirement: it happens under the opaque
     * snapshot, and the 640ms cross-dissolve IS the chips dissolving while
     * the deployment's own progress rail surfaces in its final place.
     */
    prepSurfaceLive(): boolean {
      return this.mode === 'wizard' || (this.state.flow === 'materializing' && !this.matSwap);
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
    /** The prewarmed summary's inline box: an absolute copy of the cards
     *  body's rect, so the fit engine solves the geometry the pane will
     *  ACTUALLY have once it becomes the body — nothing re-flows at the swap
     *  and every measured tile rect stays valid across it. */
    prewarmStyle(): Record<string, string> {
      const box = this.prewarmBox;
      if (!this.summaryPrewarm || box === undefined) {
        return {};
      }
      return {
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      };
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
          // `fizzles` is deliberately NOT a filter here: the warning must not cost
          // the player the ability to reach the card at all (focus is also how the
          // rail explains it, and how X opens the fullscreen face).
          if (e.status === 'playable') {
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
        awaiting: this.awaitingOthers,
        payBeat: this.corpPayCost !== undefined,
        ceremonyVerb: this.candidatePrompt !== undefined ? this.candidateVerb : 'Play now',
        hasFocusables: this.focusables.length > 0,
        firstAction: this.firstActionBarState,
      });
    },
    /** The first-action stage as the command contract sees it (see
     *  StartSceneCommandState.firstAction). Only the PANEL beats own the bar —
     *  the action's follow-ups (candidates, an embedded reveal) fall back to
     *  the queue/claim grammar exactly as every other play. */
    firstActionBarState(): 'off' | 'waiting' | 'ready' | 'busy' {
      if (!this.firstActionPanelShown) {
        return 'off';
      }
      if (this.firstAct.stage === 'staging' || this.firstAct.submitting) {
        return 'busy';
      }
      return this.firstActionActionableNow ? 'ready' : 'waiting';
    },
  },
  watch: {
    /** The deal identity pins the wizard picks (module state survival). */
    'wizardInput': {
      immediate: true,
      handler(input: SelectInitialCardsModel | undefined) {
        if (input !== undefined) {
          ensureStartWizard(
            this.playerView.id,
            initialCardsSignature(input),
            wizardSteps(input).map((step) => step.id),
          );
          // A fresh deal on a still-mounted scene (rematch) — a stale
          // first-action stage from the previous game must never leak in.
          if (this.firstAct.stage !== 'idle' || this.firstActionSeen) {
            this.firstAct.stage = 'idle';
            this.firstAct.corp = undefined;
            this.firstAct.submitting = false;
            this.firstActionSeen = false;
          }
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
    /**
     * PUBLISH THE HAND STEP'S ZONE — `flush: 'post'`, never `pre`. A `pre`
     * watcher names a node this component has not rendered yet: the shell
     * resolves the teleport first, finds nothing, and Vue drops the hand to
     * `body` — a full-screen hand standing OUTSIDE the workspace, which is
     * precisely the artefact the step exists to remove. Retracted the moment
     * the step ends, so a stale selector can never teleport into a detached
     * node. (Same contract as `setWorkspaceStageSlot` in the hand.)
     */
    'stepSlot': {
      immediate: true,
      flush: 'post',
      handler(selector: string) {
        setWorkspaceFrameSlot('start', selector);
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
     * SENT → WAITING. The submit was accepted but the deployment is not this
     * player's yet: the frozen snapshot (armed at the press for the
     * hand-over cinematic) must let go at once — the player is going to look
     * at this screen until the table finishes — and the flow leaves its
     * committing state so B (minimize) works again.
     */
    'awaitingOthers'(now: boolean, was: boolean) {
      if (now && !was) {
        this.disposeMaterializationFreeze(true);
        this.summaryArriving.clear();
        this.sentAwaiting = true;
        if (this.state.flow === 'committing') {
          this.state.flow = 'idle';
        }
        if (this.commitSafety !== undefined) {
          window.clearTimeout(this.commitSafety);
          this.commitSafety = undefined;
        }
      }
    },
    /**
     * THE DEPLOYMENT LATCH. The server handing this player a start-sequence
     * prompt is the ONE honest signal that their deployment has begun — in a
     * multiplayer table it arrives only once EVERY player has confirmed, so
     * this is also what makes the hand-over simultaneous.
     */
    'task': {
      immediate: true,
      handler(task: ConsoleTask | undefined) {
        // The corporation's first action is part of the deployment too — a
        // reload that lands straight on it (the wait / the live prompt) must
        // open the ceremony bounds, not the preparation.
        if ((task?.kind === 'startSequence' || task?.kind === 'corpFirstAction') &&
            !startDeploymentBegun()) {
          markStartDeploymentBegun();
        }
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
        if (now === 'ceremony' && was === 'wizard' &&
            (this.state.flow === 'committing' || this.sentAwaiting)) {
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
    /**
     * THE START EFFECT FLOW's beat advance — the ONE watcher that drives the
     * scene-side choreography of a draw-effect play (see startEffectBeat).
     */
    'startEffectBeat'(now: 'idle' | 'staged' | 'depart' | 'landed' | 'failed', was: string) {
      if (now === 'depart' && was === 'staged') {
        this.runQueueRelease();
        // ONE release, both layers: the deployment lets go as a whole, so the
        // step that follows opens into a genuinely empty room rather than into
        // the top half of one.
        this.runPlayedDockRelease();
      }
      if (now === 'landed' && !this.embedSourceLanded) {
        // THE ATOMIC HANDOFF at the effect-source seat: the hero flipped
        // `revealed` and paints the real column card under its proxy in this
        // same flush — release the hold, remember the card is physical.
        this.embedSourceArriving = false;
        this.embedSourceLanded = true;
        // …AND THIS IS THE EXECUTION BEAT, played out. The card has physically
        // left the queue, travelled and settled into the source seat — which
        // is exactly what the claim's beat gate is waiting to be told. Nobody
        // was telling it for a start-hosted outcome, so every draw and every
        // pick here sat out the full 2.6 s BEAT_SAFETY before its surface was
        // allowed to mount: a real beat followed by an arbitrary wait.
        markWorkspaceOutcomeBeatDone();
      }
      if (now === 'failed') {
        void this.abortStartEffectFlow();
      }
    },
    // ── THE FIRST-ACTION STAGE lifecycle ─────────────────────────────────
    /**
     * ENTRY — the deployment's cards are through and the corporation still
     * owes its opening move: the stage rises (the corp card out of
     * «Разыграно», the chrome receding behind it). Immediate: a reload that
     * lands mid-first-action (the wait, or the live prompt) restores the
     * standing stage through the same one path — the emerge simply plays on
     * the freshly mounted dock, so the restore is physical too, never a
     * re-run of anything committed.
     */
    'firstActionEntryDue': {
      immediate: true,
      handler(due: boolean) {
        if (due) {
          void this.enterFirstActionStage();
        }
      },
    },
    /** EXIT — the action's whole causal chain resolved (ledger drained,
     *  every follow-up answered, every flight home): one leave, at the end. */
    'firstActionLeaveDue'(due: boolean) {
      if (due) {
        void this.runFirstActionLeave();
      }
    },
    /**
     * A SECOND owed corporation (Merger) — the server re-raised the prompt
     * after the first action's chain resolved: re-stand the stage (the flow
     * never left it), and the seat hands over to the next corp.
     */
    'firstActionOwedNow'(owed: boolean) {
      if (owed) {
        this.restandFirstAction();
      }
    },
    /** …and the same re-stand off the QUIET edge — the second owed action can
     *  be re-raised while the first one's chain is still flying (a placement
     *  excursion), so whichever of the two flips LAST does the re-stand. */
    'firstActionChainQuiet'(quiet: boolean) {
      if (quiet) {
        this.restandFirstAction();
      }
    },
    'firstActionCorpNow'(corp: CardName | undefined) {
      if (corp !== undefined && this.firstAct.stage === 'standing' && this.firstAct.corp !== corp) {
        void this.swapFirstActionSeat(corp);
      }
    },
    /**
     * THE ACTION'S FOLLOW-UP PICK ARRIVED (Valley Trust's three preludes):
     * the room comes back for the candidates — the queue and the shelf
     * breathe back around the still-seated corporation (it IS the source of
     * these cards), and the existing candidate flow takes over untouched.
     */
    'candidatePrompt'(now: SelectCardModel | undefined, was: SelectCardModel | undefined) {
      if (now !== undefined && was === undefined && this.firstAct.stage === 'performing') {
        void Promise.all([this.runQueueReturn(), this.runPlayedDockReturn()]);
      }
    },
    /**
     * THE SUBMIT ROUND TRIP resolved (any response): release the latch. A
     * refusal leaves the prompt standing — the stage stays actionable and the
     * CTA re-arms; success moves the prompt on — the stage goes performing
     * and the action's own presentation (a claim, a pick, a placement) drives
     * from here.
     */
    'playerView'() {
      if (this.firstAct.submitting) {
        this.firstAct.submitting = false;
        if ((this.firstAct.stage === 'standing' || this.firstAct.stage === 'staging') &&
            startFlowCorpPrompt(this.playerView) === undefined) {
          this.firstAct.stage = 'performing';
        }
      }
    },
    /** The claim released (any exit — the take finished, the backstop, the
     *  unmount): the main scene RETURNS first, then the source card carries
     *  on into «Разыграно» (the second half of its interrupted journey). */
    'embedActive'(now: boolean, was: boolean) {
      if (now && !was) {
        // THE RELEASE IS GUARANTEED HERE, not only on the hero's `depart`
        // beat. Both halves are latch-guarded, so this is a no-op when the
        // beat already ran — but when it did NOT (a claim that arrives without
        // a hero flight, a beat that skipped straight past `staged`) nothing
        // ever receded, and the deployment then had no return to play: the
        // step simply unmounted and the queue reappeared in a single frame.
        // A scene that is asked to come back must have gone away first.
        this.runQueueRelease();
        this.runPlayedDockRelease();
        return;
      }
      if (!now && was) {
        void this.runStartEffectReturn();
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
          const names = [...this.ceremonyBoughtNames];
          this.startDeliveryNames = names;
          armDeliveryHold(key, names);
        }
      },
    },
  },
  mounted() {
    // Announce our zone for THIS mount: a minimize→restore re-creates the
    // component while `stepSlot` never changes value, so the watcher has
    // nothing to fire on — and the zone would stand unannounced, leaving the
    // hosted step teleport-less in `.con-main`.
    setWorkspaceFrameSlot('start', this.stepSlot);
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
    this.disposeMaterializationFreeze(true);
    if (this.outcome.host === 'start') {
      releaseWorkspaceOutcome(); // an orphaned claim suppresses presenters
    }
    // Retract our zone HERE, never from the flow side: a stale selector
    // teleports the next surface into a detached node, and the unmount watcher
    // does not fire (Vue tears watchers down first).
    setWorkspaceFrameSlot('start', '');
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
    this.completionTimeline?.kill();
    this.completionTimeline = undefined;
    // NOTE the lifetime HOLD deliberately survives an unmount (a defer keeps
    // the deployment claim; the release beat is what clears it). A transient
    // motion flow does not: a scene torn down mid-flight must come back
    // pressable, so any busy flow resets to its resting state.
    // A stage transition dies with the scene: its phases name DOM that no
    // longer exists, and a live director would keep the input gate shut on the
    // restored scene forever (its own `finally` may still be parked on an
    // await that can no longer resolve against a torn-down tree).
    resetStartTransition();
    if (startFlowBusy()) {
      this.state.flow = this.state.hold ? 'deploying' : 'idle';
    }
    this.deal.dispose();
    resetConsoleStartUi();
  },
  methods: {
    /** The «ДАЛЕЕ» row's inline tile pictogram (the same art as the card face). */
    tileIconStyle,
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
     * TWO settled animation frames — the honest «the layout has painted»
     * wait. One rAF still runs BEFORE the paint of the frame it belongs to,
     * so a single one measures a layout the compositor has not shown yet.
     */
    settledFrame(): Promise<void> {
      return new Promise<void>((resolve) => (typeof requestAnimationFrame === 'function' ?
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())) :
        window.setTimeout(resolve, 32)));
    },
    /**
     * A deliberate CHOREOGRAPHIC offset between two beats of this scene's own
     * sequence (never a guess about when someone else's animation finished —
     * every completion in this file is a real signal). Motion-scaled, so the
     * speed preset keeps the whole phrase in proportion.
     */
    beat(ms: number): Promise<void> {
      return new Promise<void>((resolve) => window.setTimeout(resolve, motionMs(ms)));
    },
    /**
     * THE JOURNEY RAIL'S DIRECTIONAL PULSE. The rail must NOT move its
     * active marker at the press — the stage has not changed yet, and a chip
     * that lights up before its cards exist is the same lie the old early
     * stage commit told. It shows DIRECTION instead: a short light impulse
     * along the connector toward the requested stage. No text changes
     * anywhere during a transition (the player cannot read a label that lives
     * for 300 ms — it would only ever register as a flicker).
     */
    pulseJourney(dir: 1 | -1): void {
      this.railPulseDir = dir;
      this.railPulse++;
    },
    /** Retire a step pane as ONE cached layer (never card by card). */
    parkPane(pos: number, dir: 1 | -1): Promise<void> {
      return parkSurface(this.paneElAt(pos), dir);
    },
    /** Bring a parked pane back — same table, same cards, no re-deal. */
    revealPane(pos: number, dir: 1 | -1): Promise<void> {
      return unparkSurface(this.paneElAt(pos), dir);
    },
    /**
     * HOLD THE ENTERING SURFACE DOWN BEFORE THE COMMIT.
     *
     * Every pane is mounted and merely `v-show`n, so the frame in which the
     * stage commits is the frame in which the incoming pane goes
     * `display:block` — at FULL opacity, because its reveal has not started
     * yet. That is one painted frame of the next stage arriving at full
     * strength and then fading in from zero: a blink, and precisely the
     * «two surfaces» artefact in miniature. Held here, released by the
     * reveal, which owns the whole entrance.
     */
    holdPaneForReveal(el: HTMLElement | null | undefined): void {
      if (el !== null && el !== undefined) {
        gsap.killTweensOf(el);
        gsap.set(el, {autoAlpha: 0});
      }
    },
    /**
     * PREWARM THE SUMMARY (§ every destination measured before anything
     * moves). The pane is mounted INVISIBLE at exactly the box it will occupy
     * once it becomes the active body — an absolute copy of the cards body's
     * rect — so the fit engine solves the FINAL geometry and nothing re-flows
     * at the swap. Without this the summary assembled itself while cards were
     * already arriving: the tiles that had not laid out yet had no rect to
     * fly to, and every one of them degraded into «just appear».
     */
    async prewarmSummary(): Promise<void> {
      const frameEl = this.$refs.frame as HTMLElement | undefined;
      const body = this.$refs.body as HTMLElement | undefined;
      if (frameEl !== undefined && frameEl !== null && body !== undefined && body !== null &&
          typeof body.getBoundingClientRect === 'function') {
        const fr = frameEl.getBoundingClientRect();
        const br = body.getBoundingClientRect();
        if (br.width > 8 && br.height > 8) {
          this.prewarmBox = {
            left: br.left - fr.left, top: br.top - fr.top,
            width: br.width, height: br.height,
          };
        }
      }
      this.summaryPrewarm = true;
      await this.$nextTick();
      // The zoom search is a handful of forced reflows; run it, let the frame
      // paint, then re-verify on the settled layout.
      this.fitSummary();
      await this.settledFrame();
      this.fitSummary();
      await this.settledFrame();
    },
    /** The prewarmed pane becomes the real body — same box, zero shift. */
    releaseSummaryPrewarm(): void {
      this.summaryPrewarm = false;
      this.prewarmBox = undefined;
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
     * RT — ADVANCE. The one FORWARD stage change, in the order a physical
     * table demands (see `startStageDirector` for why the old order could not
     * work):
     *
     *   press → the picks compress and lift OUT of the table
     *         → they travel (turning over in the air)
     *         → the table they came from retires behind them, as ONE layer
     *         → they land on the shelf / in their summary tiles
     *         → ONLY THEN is the stage committed and the next surface opened.
     *
     * Nothing textual changes anywhere along it: the response is the cards'
     * own movement plus the rail's directional pulse.
     */
    async advanceWithCollect(): Promise<void> {
      const step = this.currentStep;
      if (step === undefined || this.dockBusy || startFlowBusy()) {
        return;
      }
      const from = this.railPos;
      const to = from + 1;
      const kind = transitionKind(from, to, this.steps.length);
      if (kind === undefined) {
        return;
      }
      this.dockBusy = true;
      beginStartTransition(kind, from, to);
      this.pulseJourney(1);
      this.state.flow = kind === 'to-summary' ? 'revealing-summary' : 'docking';
      const names = picksForStep(this.picks, step.id);
      // The corporation is the player's own face — it lifts a notch higher.
      const accent = step.id === 'corp' ? names[0] : undefined;
      // ① CAPTURE — the pixels are ours from THIS frame, which is what lets
      // the table underneath retire without the cards going down with it.
      const capture = captureCards(names
        .map((name) => ({name, el: this.stepSlotEl(step.id, name)}))
        .filter((sc): sc is DockFlightSource => sc.el !== null));
      names.forEach((n) => this.returningNames.add(`${step.id}|${n}`));
      try {
        // ② IMPULSE — the press is answered in its own interaction frame.
        setStartTransitionPhase('compressing-selection');
        await capture.impulse(accent);
        setStartTransitionPhase('lifting-selection');
        if (kind === 'to-summary') {
          await this.toSummaryConvoy(step, capture, from);
        } else {
          await this.stepForwardCollect(step, capture, from, to);
        }
      } finally {
        capture.dispose();
        names.forEach((n) => this.returningNames.delete(`${step.id}|${n}`));
        this.summaryArriving.clear();
        clearDockDrift();
        this.fitLocked = false;
        this.dockBusy = false;
        this.state.flow = 'idle';
        setStartTransitionPhase('stabilizing-focus');
        await this.settledFrame();
        endStartTransition();
      }
    },
    /**
     * FORWARD, step → step: the picks collect onto their shelf pile, and the
     * NEXT step's table is opened only once the shelf physically has them.
     */
    async stepForwardCollect(
      step: StartWizardStep, capture: CapturedFlight, from: number, to: number,
    ): Promise<void> {
      const pileEl = this.pileElFor(step.id);
      // ③ TRANSFER. The pile's backs follow the CARDS (dockDrift): +1 per
      // touchdown, so a back appears exactly when — and because — its card
      // lands on it.
      //
      // ⚠️ NO pre-drift of −N here. The step is not `collected` until the
      // stage commits, so its target back count is still 0: a −N pre-drift
      // would be cancelled by the +1 landings and the pile would stay empty
      // until the commit — the card's proxy retires onto NOTHING and the
      // card is briefly gone from the world. (That worked before only
      // because the stage used to commit at t=0, which is the bug this whole
      // rework removes.) The drift is squared with the state in the commit's
      // own tick, below.
      setStartTransitionPhase('transferring-selection');
      this.fitLocked = true;
      const flight = capture.flyTo(
        () => pileEl,
        () => driftDockPile(step.id, 1),
        {flipTo: FACE_DOWN_DEG, reseat: false, pressElFor: () => pileEl});
      // ④ …and only once they have VISIBLY separated does the table they came
      // from begin to retire — whole, in one piece, with its unpicked cards
      // still lying exactly where they lie. That small offset is what makes
      // the gesture read as «I took THESE cards off THAT table».
      await this.beat(SEPARATION_BEAT_MS);
      setStartTransitionPhase('parking-current-surface');
      const parked = this.parkPane(from, 1);
      setStartTransitionPhase('docking-selection');
      await Promise.all([flight, parked]);
      // ⑤ THE COMMIT. The shelf has the cards and nothing of the old stage is
      // on screen: only now may a card of the next stage exist — and it is
      // held down until its own reveal opens it (never a full-strength frame).
      setStartTransitionPhase('committing-stage');
      this.holdPaneForReveal(this.paneElAt(to));
      // ONE TICK: the step becomes `collected` (its target back count rises
      // to its picks) and the physical drift that was standing in for that
      // is dropped in the same mutation batch — Vue renders once, so the
      // shelf never flickers through an intermediate count.
      clearDockDrift(step.id);
      this.state.stepIdx = to;
      await this.$nextTick();
      clearSurfaceParking(this.paneElAt(from));
      this.fitLocked = false;
      this.fitCardStrip();
      await this.settledFrame();
      setStartTransitionPhase('revealing-next-surface');
      await this.revealPane(to, 1);
    },
    /**
     * FORWARD, last step → SUMMARY. Every selected card physically travels
     * into its own summary tile: the current step's picks straight out of the
     * player's hand, every earlier step's out of its shelf pile — two legs of
     * ONE convoy, each owning its own proxies.
     *
     * ⚠️ Both legs used to share one proxy layer that each of them CLEARED on
     * completion, so the shorter leg wiped the longer one's still-airborne
     * cards while their timelines kept firing landings. That is the bug that
     * looked like «the last projects teleport into the summary», and it got
     * worse the more projects were bought. Ownership is per-batch now
     * (`startDockMotion`), and there is no instant-placement path left.
     */
    async toSummaryConvoy(step: StartWizardStep, capture: CapturedFlight, from: number): Promise<void> {
      // ③ PREWARM. Every tile mounted, laid out and MEASURED while the cards
      // are still in the player's hand — a summary that assembles itself as
      // cards arrive has no stable rect to offer them.
      setStartTransitionPhase('preparing-summary-layout');
      const everyPick: Array<CardName> = [];
      for (const st of this.steps) {
        for (const n of picksForStep(this.picks, st.id)) {
          everyPick.push(n);
        }
      }
      // HELD FROM THE FIRST PAINT: not one tile may show a card before that
      // card has physically landed in it (one visual owner, always).
      everyPick.forEach((n) => this.summaryArriving.add(n));
      await this.prewarmSummary();
      const {missing} = await measureTargets(everyPick, (n) => this.summaryTileFor(n), 40);
      if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
        console.warn('[console-start] summary tiles never measured: ' + missing.join(', ') +
          ' — those cards cannot be carried physically.');
      }
      // ④ The table retires, with the taken cards already held above it.
      setStartTransitionPhase('parking-current-surface');
      await this.parkPane(from, 1);
      // ⑤ THE COMMIT. The summary becomes the stage while every tile is still
      // empty — so there is never a frame with two card surfaces on it.
      setStartTransitionPhase('committing-stage');
      const summaryPane = this.$refs.summaryPane as HTMLElement | undefined;
      this.holdPaneForReveal(summaryPane);
      // ONE TICK, again: on the summary every pile's target drops to 0, but
      // the earlier steps' cards are still physically LYING there until they
      // fly out — the drift stands in for them, and it is applied in the same
      // mutation batch as the flip so the shelf never shows a doubled (or an
      // emptied) count for a frame.
      this.steps.forEach((st, i) => {
        if (i < from) {
          driftDockPile(st.id, picksForStep(this.picks, st.id).length);
        }
      });
      this.state.stepIdx = from + 1;
      this.releaseSummaryPrewarm();
      await this.$nextTick();
      clearSurfaceParking(this.paneElAt(from));
      await this.settledFrame();
      // The summary's own frame opens EMPTY (every tile is still held): the
      // player sees where the cards are going before they get there, and
      // there is never a frame carrying two card surfaces.
      await unparkSurface(summaryPane, 1);
      // ⑥ DISTRIBUTE — every card, no exceptions, adaptive to the count.
      setStartTransitionPhase('distributing-summary-cards');
      this.fitLocked = true;
      const legs: Array<Promise<void>> = [
        capture.flyTo((n) => this.summaryTileFor(n), (n) => {
          this.summaryArriving.delete(n);
          this.returningNames.delete(`${step.id}|${n}`);
        }),
      ];
      for (const st of this.steps) {
        if (st.id === step.id) {
          continue;
        }
        const groupNames = picksForStep(this.picks, st.id);
        if (groupNames.length === 0) {
          continue;
        }
        legs.push(returnFromDock(
          groupNames,
          this.pileElFor(st.id),
          (n) => this.summaryTileFor(n),
          (n) => this.summaryArriving.delete(n),
          () => driftDockPile(st.id, -1)));
      }
      setStartTransitionPhase('docking-all-summary-cards');
      // THE SUMMARY IS NOT «DONE» UNTIL THE LAST CARD IS DOWN — the controls
      // (and the input lock) release off this promise, never off a clock.
      await Promise.all(legs);
      setStartTransitionPhase('revealing-summary-status');
      this.fitLocked = false;
      this.fitSummary();
    },
    /**
     * LT — GO BACK. The BACKWARD phrase is deliberately NOT the forward one
     * reversed: a card can only come home to a table that already exists, so
     * the receiving surface is restored FIRST and the card is released from
     * the shelf only afterwards.
     */
    async backWithReturn(): Promise<void> {
      if (this.railPos === 0 || this.dockBusy || startFlowBusy()) {
        return;
      }
      const from = this.railPos;
      const target = from - 1;
      const step = this.steps[target];
      const kind = transitionKind(from, target, this.steps.length);
      if (step === undefined || kind === undefined) {
        this.state.stepIdx = target;
        clearDockDrift();
        return;
      }
      this.dockBusy = true;
      beginStartTransition(kind, from, target);
      this.pulseJourney(-1);
      this.state.flow = kind === 'from-summary' ? 'stowing-summary' : 'returning';
      try {
        if (kind === 'from-summary') {
          await this.fromSummaryReturn(step, target);
        } else {
          await this.stepBackReturn(step, target, from);
        }
      } finally {
        // The stow's tile holds release only now — the summary pane is long
        // hidden, so no face can flash under a dead proxy.
        this.summaryStowing.clear();
        this.summaryArriving.clear();
        picksForStep(this.picks, step.id).forEach((n) => this.returningNames.delete(`${step.id}|${n}`));
        clearDockDrift();
        this.fitLocked = false;
        this.dockBusy = false;
        this.state.flow = 'idle';
        setStartTransitionPhase('stabilizing-focus');
        await this.settledFrame();
        endStartTransition();
      }
    },
    /** BACKWARD, step → step: the pile gives its cards back into the reserved
     *  slots of a table that is already standing. */
    async stepBackReturn(step: StartWizardStep, target: number, from: number): Promise<void> {
      const names = picksForStep(this.picks, step.id);
      // ① THE KINETIC ANSWER, in the press's own frame: the shelf pile that
      // is about to give the cards back physically stirs, and the table the
      // player is leaving starts to retire. Neither of them is text.
      pressPile(this.pileElFor(step.id));
      setStartTransitionPhase('parking-current-surface');
      await this.parkPane(from, -1);
      // ② THE RECEIVING TABLE COMES BACK FIRST — cached, never re-dealt: the
      // same cards in the same slots, with the returning card's slot RESERVED
      // (held empty) so the layout is final before anything flies into it.
      setStartTransitionPhase('committing-previous-stage');
      names.forEach((n) => this.returningNames.add(`${step.id}|${n}`));
      driftDockPile(step.id, names.length);
      this.holdPaneForReveal(this.paneElAt(target));
      this.state.stepIdx = target;
      await this.$nextTick();
      clearSurfaceParking(this.paneElAt(from));
      this.fitCardStrip();
      setStartTransitionPhase('revealing-previous-surface');
      await this.revealPane(target, -1);
      // ③ The reserved slots are measured on the settled table…
      setStartTransitionPhase('preparing-reserved-slots');
      await measureTargets(names, (n) => this.stepSlotEl(step.id, n), 40);
      this.fitLocked = true;
      // ④ …and only NOW does the card leave the shelf, back-side up, turning
      // face-up in the air and settling into the slot it came from.
      setStartTransitionPhase('releasing-selection-from-dock');
      setStartTransitionPhase('transferring-selection-home');
      await returnFromDock(
        names,
        this.pileElFor(step.id),
        (name) => this.stepSlotEl(step.id, name),
        (name) => this.returningNames.delete(`${step.id}|${name}`),
        () => driftDockPile(step.id, -1),
      );
      setStartTransitionPhase('docking-selection-home');
    },
    /** BACKWARD, summary → last step: the laid-out set is picked up as one —
     *  the target step's picks go home to their grid slots, every other group
     *  gathers back onto its shelf pile. Two batches, two destinations, one
     *  gesture; neither can wipe the other (per-batch ownership). */
    async fromSummaryReturn(step: StartWizardStep, target: number): Promise<void> {
      const names = picksForStep(this.picks, step.id);
      const stowGroups = this.steps
        .filter((st) => st.id !== step.id)
        .map((st) => ({st, names: picksForStep(this.picks, st.id)}))
        .filter((g) => g.names.length > 0);
      const pileOf = new Map<CardName, StartWizardStep['id']>();
      stowGroups.forEach((g) => g.names.forEach((n) => pileOf.set(n, g.st.id)));
      const tileSource = (n: CardName): DockFlightSource | undefined => {
        const el = this.summaryTileFor(n);
        return el === null ? undefined : {name: n, el};
      };
      const homeSources = names.map(tileSource).filter((s): s is DockFlightSource => s !== undefined);
      const stowSources = [...pileOf.keys()].map(tileSource).filter((s): s is DockFlightSource => s !== undefined);
      const homeCapture = captureCards(homeSources);
      const stowCapture = captureCards(stowSources);
      // ONE VISUAL OWNER: the tiles are held empty in the same paint their
      // proxies spawn — a card can never lie open in the summary while its
      // copy is in the air.
      [...homeSources, ...stowSources].forEach((s) => this.summaryStowing.add(s.name));
      names.forEach((n) => this.returningNames.add(`${step.id}|${n}`));
      try {
        setStartTransitionPhase('compressing-selection');
        await Promise.all([homeCapture.impulse(), stowCapture.impulse()]);
        setStartTransitionPhase('lifting-selection');
        setStartTransitionPhase('parking-current-surface');
        await parkSurface(this.$refs.summaryPane as HTMLElement | undefined, -1);
        // The receiving table first, exactly as in the step→step return.
        setStartTransitionPhase('committing-previous-stage');
        stowGroups.forEach((g) => driftDockPile(g.st.id, -g.names.length));
        this.holdPaneForReveal(this.paneElAt(target));
        this.state.stepIdx = target;
        await this.$nextTick();
        clearSurfaceParking(this.$refs.summaryPane as HTMLElement | undefined);
        this.fitCardStrip();
        setStartTransitionPhase('revealing-previous-surface');
        await this.revealPane(target, -1);
        setStartTransitionPhase('preparing-reserved-slots');
        await measureTargets(names, (n) => this.stepSlotEl(step.id, n), 40);
        this.fitLocked = true;
        setStartTransitionPhase('transferring-selection-home');
        await Promise.all([
          homeCapture.flyTo(
            (n) => this.stepSlotEl(step.id, n),
            (n) => this.returningNames.delete(`${step.id}|${n}`),
            {flipTo: FACE_UP_DEG}),
          stowCapture.flyTo(
            (n) => this.pileElFor(pileOf.get(n) ?? ''),
            (n) => {
              const id = pileOf.get(n);
              if (id !== undefined) {
                driftDockPile(id, 1);
              }
            },
            {
              flipTo: FACE_DOWN_DEG,
              reseat: false,
              pressElFor: (n) => this.pileElFor(pileOf.get(n) ?? ''),
            }),
        ]);
        setStartTransitionPhase('docking-selection-home');
      } finally {
        homeCapture.dispose();
        stowCapture.dispose();
      }
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
      // Merger's unaffordable corps now carry the server's own reason (see
      // Merger.bespokePlay). Guessing "not enough M€" for anything else that
      // ever lands here would be a lie the moment a second case appears — say
      // only what is true.
      return translateText('This card cannot be chosen here');
    },
    /** The shell routes every intent here while the scene is active. */
    handleIntent(intent: GamepadIntent): void {
      // YIELDED — the board owns the screen (see the `yielded` prop). The
      // shell stops routing here (`startSceneOwnsPad`), so this is defence:
      // the guard sits at the ENTRY, not on `onPress` alone, because `onNav`
      // is an intent too — an unguarded d-pad walked the INVISIBLE queue
      // while the player was trying to move over the board's hexes.
      if (this.yielded) {
        return;
      }
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
        // THE FIRST-ACTION SEAT — the one card on stage: X reads it
        // fullscreen from its physical seat (the viewer lifts out of the
        // seat and returns into it — the composer's one-physical-card rule).
        const seated = this.firstAct.corp;
        if (this.firstActionStageLive && seated !== undefined) {
          openConsoleCardZoom([{name: seated} as CardModel], 0, undefined, undefined, {
            origin: {
              kind: 'physical',
              resolve: () => (this.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('[data-embed-source-slot]') ?? null,
            },
          });
        }
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
     * THE BARS' ENTRANCE BEAT — measured against the convoy, never a timer.
     * The standard shell (Top HUD + Player Rail) may only start materializing
     * when BOTH hold:
     *   · the convoy is ARRIVING (the cards are deep in their carry — the
     *     room appearing while they still cross the screen reads as the shell
     *     landing ON them), and
     *   · no card physically OVERLAPS a bar's zone at that instant — a
     *     per-frame rect test, so the release can never paint a bar over a
     *     card in flight whatever the pacing, profile or card count.
     * The last landing is the hard cap (by then the layer is empty anyway).
     */
    releaseBarsWithConvoy(count: number): void {
      const beats = convoyBeats(count);
      const zones = ['.con-status', '.con-res']
        .map((sel) => document.querySelector<HTMLElement>(sel)?.getBoundingClientRect())
        .filter((r): r is DOMRect => r !== undefined && r.width > 4 && r.height > 4);
      const margin = 6 * conUiScale();
      const overlapsAZone = (r: DOMRect): boolean => zones.some((z) =>
        r.right > z.left - margin && r.left < z.right + margin &&
        r.bottom > z.top - margin && r.top < z.bottom + margin);
      const start = performance.now();
      const step = () => {
        if (!this.matFrozen && this.matCapture === undefined) {
          document.body.classList.remove('con-start-barshold'); // transition over
          return;
        }
        const t = performance.now() - start;
        const clear = liveFlightProxies().every((p) => !overlapsAZone(p.getBoundingClientRect()));
        if ((t >= beats.arriving && clear) || t >= beats.landed) {
          document.body.classList.remove('con-start-barshold');
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    /** The «КУПЛЕНО» chrome enters only once the LAST bought project stands
     *  in the row — the box materializes around cards, never around a
     *  landing still in progress. */
    noteBuyLanding(name: CardName): void {
      if (this.buyChrome !== 'hold' || !this.state.projects.includes(name)) {
        return;
      }
      if (!this.state.projects.some((p) => this.queueArriving.has(p))) {
        this.buyChrome = 'entering';
      }
    },
    /** The names travelling through the materialization, in play order. */
    materializationNames(): Array<CardName> {
      const moving: Array<CardName> = [];
      if (this.state.corp !== undefined) {
        moving.push(this.state.corp);
      }
      moving.push(...this.state.projects, ...this.state.preludes);
      return moving;
    },
    /**
     * ARM THE SCENE TRANSITION — at the commit press, on the untouched
     * summary: the card overlay captures every chosen card's live pixels
     * (fixed layer ABOVE the bars and the snapshot), then the whole summary
     * frame is SNAPSHOTTED into the freeze layer as a plain, non-reactive
     * DOM clone. From here the live tree may re-render, re-bound and
     * re-title freely — the player sees only the snapshot and the cards.
     *
     * The clone is inert by construction: the moving cards are hidden inside
     * it (the overlay owns them), and every live identity attribute is
     * stripped so no selector, director or flight can ever match the
     * snapshot instead of the real surface (the parked-summary lesson).
     */
    prepareMaterializationFreeze(): void {
      if (consoleReducedMotionActive() || this.matFrozen) {
        return;
      }
      const host = this.$refs.freezeHost as HTMLElement | undefined;
      const root = this.$el as HTMLElement | undefined;
      const frame = root !== undefined && typeof root.querySelector === 'function' ?
        root.querySelector<HTMLElement>('.con-start__frame') : null;
      if (host === undefined || host === null || frame === null) {
        return;
      }
      const moving = this.materializationNames();
      const sources: Array<DockFlightSource> = moving
        .map((name) => ({name, el: this.summaryTileFor(name)}))
        .filter((s): s is DockFlightSource => s.el !== null);
      const capture = captureCards(sources);
      if (capture.names.length === 0) {
        capture.dispose();
        return; // degraded: the settled one-frame swap will carry the turn
      }
      const rect = frame.getBoundingClientRect();
      const clone = frame.cloneNode(true) as HTMLElement;
      // A snapshot is already the fully settled frame. Inserting its cloned
      // header into the DOM must NOT replay mount-only breadcrumb / connector /
      // journey intro animations: those `backwards` delays blanked SUMMARY for
      // a frame and the rail for almost a second. The host owns the ONE motion
      // here — the whole frozen header and rail dissolve together.
      clone.classList.add('con-start__frame--snapshot');
      // The overlay owns the moving cards — hide them INSIDE the snapshot.
      for (const name of moving) {
        const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name;
        clone.querySelectorAll<HTMLElement>(`[data-zoom-slot="${esc}"]`).forEach((el) => {
          el.style.visibility = 'hidden';
        });
      }
      // Strip every live identity — the snapshot must be unmatchable.
      const LIVE_ATTRS = ['data-zoom-slot', 'data-queue-slot', 'data-step-slot', 'data-start-pile',
        'data-played-key', 'data-start-front', 'data-embed-slot', 'data-pay-card', 'data-splayed-fam'];
      clone.querySelectorAll<HTMLElement>(LIVE_ATTRS.map((a) => `[${a}]`).join(',')).forEach((el) => {
        LIVE_ATTRS.forEach((a) => el.removeAttribute(a));
      });
      host.innerHTML = '';
      host.style.left = `${rect.left}px`;
      host.style.top = `${rect.top}px`;
      host.style.width = `${rect.width}px`;
      host.style.height = `${rect.height}px`;
      host.appendChild(clone);
      host.classList.add('con-start-freeze--live');
      this.matCapture = capture;
      this.matFrozen = true;
      // The live originals hide under the snapshot (belt — nobody sees them).
      moving.forEach((n) => this.summaryArriving.add(n));
    },
    /** Drop the snapshot (and optionally the card overlay) — refusal,
     *  unmount, or the transition's own completion. Idempotent. */
    disposeMaterializationFreeze(alsoCapture: boolean): void {
      const host = this.$refs.freezeHost as HTMLElement | undefined;
      if (host !== undefined && host !== null) {
        gsap.killTweensOf(host);
        host.classList.remove('con-start-freeze--live');
        host.innerHTML = '';
        gsap.set(host, {clearProps: 'all'});
      }
      this.matFrozen = false;
      // The bars hold may never outlive the transition (the success path has
      // already released it at the flight beat — this is the abort belt).
      document.body.classList.remove('con-start-barshold');
      if (alsoCapture) {
        this.matCapture?.dispose();
        this.matCapture = undefined;
        this.buyChrome = 'shown'; // aborted / degraded: the box stands normally
      }
    },
    /** The snapshot cross-dissolves over the prepared deployment. */
    dissolveFreeze(): Promise<void> {
      const host = this.$refs.freezeHost as HTMLElement | undefined;
      if (host === undefined || host === null || !this.matFrozen) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const safety = window.setTimeout(resolve, motionMs(680) + 600);
        gsap.to(host, {
          autoAlpha: 0,
          scale: 0.995,
          transformOrigin: '50% 45%',
          duration: motionMs(640) / 1000,
          ease: 'power2.inOut',
          onComplete: () => {
            window.clearTimeout(safety);
            resolve();
          },
        });
      });
    },
    /** The corp's target slot rect must stand STILL before anything flies. */
    async awaitQueueStability(): Promise<void> {
      const probe = this.state.corp ?? this.materializationNames()[0];
      if (probe === undefined) {
        return;
      }
      let last: {x: number, y: number} | undefined;
      for (let i = 0; i < 30; i++) {
        await new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));
        const el = this.queueTargetEl(probe);
        const r = el?.getBoundingClientRect();
        if (r !== undefined && r.width > 4 && last !== undefined &&
            Math.abs(r.left - last.x) < 0.5 && Math.abs(r.top - last.y) < 0.5) {
          return;
        }
        last = r !== undefined && r.width > 4 ? {x: r.left, y: r.top} : undefined;
      }
    },
    /**
     * GAME FRAME MATERIALIZATION — a true SCENE TRANSITION between two
     * independent states, armed at the commit press (see
     * prepareMaterializationFreeze):
     *
     *  · the FROZEN SUMMARY (a non-reactive snapshot) is all the player
     *    sees — no header change, no re-size, no clipping can reach it;
     *  · UNDER it the final game surface assembles instantly and completely
     *    (band bounds, bars, «РАЗЫГРАНО» shelf, held queue slots) — one cut
     *    turn with every shell transition disabled;
     *  · the CARD OVERLAY rises toward the viewer (the corporation — the
     *    player's face — a notch more) above everything;
     *  · once the new surface's geometry has PROVEN still, the snapshot
     *    cross-dissolves — the prepared screen (bars included) materializes
     *    visually under the airborne cards — and the cards carry into their
     *    final slots. After the landings nothing re-flows, ever;
     *  · the handoff is atomic per card (the real card appears in the same
     *    timeline slot the proxy releases).
     *
     * Reduced motion (or a degraded capture): one settled frame swap.
     */
    async runMaterialization(): Promise<void> {
      // The MULTIPLAYER path arrives here with no armed snapshot (the one
      // from the press was let go when the wait began) — arm it now, on the
      // live summary the player has been looking at.
      if (!this.matFrozen && this.sentAwaiting) {
        this.prepareMaterializationFreeze();
      }
      this.sentAwaiting = false;
      this.state.flow = 'materializing';
      if (this.commitSafety !== undefined) {
        window.clearTimeout(this.commitSafety);
        this.commitSafety = undefined;
      }
      const capture = this.matCapture;
      const moving = this.materializationNames();

      if (capture === undefined || !this.matFrozen || consoleReducedMotionActive()) {
        // The settled one-frame swap (reduced motion / degraded capture).
        this.disposeMaterializationFreeze(true);
        this.matSwap = true;
        this.matCut = true;
        this.shellUp = true;
        this.ceremonyRevealed = true;
        this.syncCeremonyLayout();
        await this.$nextTick();
        this.matCut = false;
        this.matSwap = false;
        this.summaryArriving.clear();
        this.state.flow = 'deploying';
        return;
      }

      // THE SWAP UNDER THE SNAPSHOT — the final surface assembles complete:
      // held queue slots first (they must never paint occupied), then one
      // cut turn for bounds + bars + shelf. Two entrances are deliberately
      // HELD through the swap: the standard bars (they enter WITH the flight
      // — released below; entering here, under the snapshot, they surfaced
      // mid-dissolve over the still-standing summary) and the «КУПЛЕНО»
      // box's chrome (it frames landed cards, never an empty landing).
      moving.forEach((n) => this.queueArriving.add(n));
      if (this.state.projects.length > 0) {
        this.buyChrome = 'hold';
      }
      document.body.classList.add('con-start-barshold');
      this.matSwap = true;
      this.matCut = true;
      this.shellUp = true;
      this.ceremonyRevealed = true;
      this.syncCeremonyLayout();
      await this.$nextTick();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await this.awaitQueueStability();

      // THE RISE — the cards come toward the viewer over the frozen summary.
      await capture.lift(this.state.corp);

      // THE CROSS-DISSOLVE + THE CARRY: the prepared screen surfaces under
      // the airborne cards; the convoy leaves a beat into the dissolve and
      // lands on geometry that no longer changes.
      const fade = this.dissolveFreeze();
      await new Promise<void>((r) => window.setTimeout(r, motionMs(150)));
      // THE BARS ENTER AS THE CONVOY ARRIVES — never at take-off: the watcher
      // releases them the first frame the cards are deep in their carry AND
      // no card overlaps a bar's zone (see releaseBarsWithConvoy).
      this.releaseBarsWithConvoy(capture.names.length);
      await Promise.all([
        capture.flyTo(
          (name) => this.queueTargetEl(name),
          (name) => {
            this.queueArriving.delete(name);
            this.noteBuyLanding(name);
          }),
        fade,
      ]);
      if (this.buyChrome === 'hold') {
        this.buyChrome = 'entering'; // a no-flight fallback never leaves the box hidden
      }

      this.disposeMaterializationFreeze(false);
      this.matCapture = undefined;
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
      if (this.state.flow === 'completing' || this.state.flow === 'releasing') {
        return;
      }
      this.flowTerminal = false;
      this.state.flow = 'completing';
      await this.$nextTick();
      const el = this.$el as HTMLElement | undefined;
      if (el === undefined || !el.isConnected) {
        return;
      }
      {
        // THE RESOLVED BEAT — a short settled frame (the `--resolved` accent:
        // queue empty, dock stable, tableau standing) BEFORE the dissolve, so
        // the release reads as "the start is complete", never as a cut.
        const flowHost = this.$refs.flowHost as HTMLElement | undefined;
        const rail = flowHost?.querySelector<HTMLElement>('.con-jrail');
        const items = rail?.querySelectorAll<HTMLElement>('.con-jrail__item') ?? [];
        const phases = rail?.querySelectorAll<HTMLElement>('.con-jrail__phase') ?? [];
        const beam = rail?.querySelector<HTMLElement>('.con-jrail__commit-beam');
        const reduced = consoleReducedMotionActive();
        const timeline = markRaw(gsap.timeline({paused: true}));
        this.completionTimeline = timeline;

        if (!reduced) {
          if (beam !== undefined) {
            timeline.fromTo(beam,
              {xPercent: -130, autoAlpha: 0},
              {
                xPercent: 430,
                autoAlpha: 0.9,
                duration: motionMs(560) / 1000,
                ease: 'power2.inOut',
              }, 0.06);
          }
          if (items.length > 0) {
            timeline.to(items, {
              y: -1,
              scale: 1.018,
              duration: motionMs(100) / 1000,
              stagger: motionMs(32) / 1000,
              ease: 'power2.out',
            }, 0);
            timeline.to(items, {
              y: 0,
              scale: 1,
              duration: motionMs(160) / 1000,
              stagger: motionMs(24) / 1000,
              ease: 'power2.out',
            }, motionMs(105) / 1000);
          }
          if (phases.length > 0) {
            timeline.to(phases, {
              scaleY: 1.018,
              duration: motionMs(150) / 1000,
              stagger: motionMs(70) / 1000,
              ease: 'power2.out',
            }, 0.16);
            timeline.to(phases, {
              scaleY: 1,
              duration: motionMs(190) / 1000,
              stagger: motionMs(55) / 1000,
              ease: 'power2.out',
            }, 0.31);
          }
        }

        // Commit every named stage, then consolidate this same rail into its
        // terminal answer. The terminal layer has been mounted from frame one.
        timeline.call(() => {
          if (el.isConnected) {
            this.flowTerminal = true;
          }
        }, undefined, reduced ? 0 : motionMs(690) / 1000);
        // Give the consolidated READY pose a true couch-readable hold after
        // its width morph. A 4K browser needs close to a second merely to
        // rasterize this full scene; the old 1.1 s beat was logically observed
        // but visually skipped straight to the board on that profile. 1.8 s is
        // still a concise terminal acknowledgement after the whole setup, and
        // speed presets continue to scale it with the rest of the sequence.
        // Reduced motion stays brief.
        timeline.to({}, {duration: motionMs(reduced ? 420 : 1800) / 1000});
        timeline.call(() => {
          if (el.isConnected) {
            this.state.flow = 'releasing';
          }
        });
        timeline.to(el, {
          autoAlpha: 0,
          duration: motionMs(reduced ? 140 : 300) / 1000,
          ease: 'power2.in',
        });

        const settled = gsapSettled(timeline);
        holdForGsapAnimation('start-flow-completion', timeline, {
          scope: 'notification-only',
          maxHoldMs: 8_000,
        });
        /* A full-frame 4K capture (or a suspended TV compositor) can starve
         * GSAP's rAF ticker for far longer than the sequence itself. Do not
         * invent a second completion state: finish this SAME timeline after a
         * generous ceiling so its callbacks, terminal commit and release all
         * run in their canonical order. Normal Calm/Standard/Swift timings are
         * 3.7s or less, so this path is strictly degraded-render recovery. */
        const releaseSafety = window.setTimeout(() => {
          if (this.completionTimeline === timeline && el.isConnected) {
            timeline.progress(1);
          }
        }, 6_000);
        timeline.play(0);
        await settled;
        window.clearTimeout(releaseSafety);
        if (this.completionTimeline === timeline) {
          this.completionTimeline = undefined;
        }
        // A teardown kills the timeline. A detached instance cannot release
        // the lifetime hold; the restored Start workspace owns that outcome.
        if (!el.isConnected) {
          return;
        }
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
      // FROZEN while cards are in the air: re-solving the zoom would move the
      // tiles the convoy was planned against. The prewarm already solved the
      // final geometry — there is nothing to re-solve until everything lands.
      if (!this.summaryShown || this.fitLocked) {
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
      // THE MODEL IS ONLY A SEED. It cannot know the pane's real furniture
      // (the counts shelf, paddings, a wrapped section title), and every
      // count where it guessed a row too optimistically shipped a SCROLLBAR
      // — a console-native bug by contract. So the model picks a starting
      // guess and the LIVE PANE is then asked the only honest question:
      // «do you overflow?»
      const seedFits = (z: number): boolean => {
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
      const MIN_Z = 0.26;
      const MAX_Z = 0.86;
      const STEP = 0.02;
      let seed = MIN_Z;
      for (let z = MAX_Z; z >= MIN_Z; z -= STEP) {
        if (seedFits(z)) {
          seed = z;
          break;
        }
      }
      const apply = (z: number) => {
        pane.style.setProperty('--con-start-mini-zoom', z.toFixed(3));
        pane.style.setProperty('--con-start-mini-id-zoom', (z * ID_BOOST).toFixed(3));
      };
      // Reading `scrollHeight` forces the pending layout, so each probe below
      // measures the zoom it just applied — the whole search is a handful of
      // reflows on ONE transition, and it can never disagree with the DOM.
      const overflows = (): boolean =>
        pane.scrollHeight > pane.clientHeight + 1 || col.scrollWidth > col.clientWidth + 1;
      apply(seed);
      let best = seed;
      if (overflows()) {
        // Walk DOWN until the pane genuinely stops scrolling.
        best = MIN_Z;
        for (let z = seed - STEP; z >= MIN_Z; z -= STEP) {
          apply(z);
          if (!overflows()) {
            best = z;
            break;
          }
        }
      } else {
        // …or UP while the space is still there — an under-used pane is the
        // other half of the same bug (tiny cards on a 4K screen).
        for (let z = seed + STEP; z <= MAX_Z; z += STEP) {
          apply(z);
          if (overflows()) {
            break;
          }
          best = z;
        }
      }
      apply(best);
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
      if (this.fitLocked) {
        return; // see fitSummary — a destination may not move mid-flight
      }
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
      // (`yielded` is guarded at the intent ENTRY — it covers nav too.)
      if (this.awaitingOthers && action !== 'back' && action !== 'inspect') {
        return; // sent — nothing is asked of this player (see awaitingOthers)
      }
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
        // The first-action stage adds two beats of its own: the corp's rise
        // into the seat and the submit round trip — both are one motion the
        // collapse would tear (the standing WAIT itself minimizes freely).
        if (isPlayedHeroActive() || this.embedActive ||
            isHandDeliveryActive() || this.queueArriving.size > 0 ||
            this.firstAct.stage === 'staging' || this.firstAct.submitting) {
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
      // The FIRST-ACTION stage's one clear CTA — actionable only when the
      // player's turn has genuinely arrived (never a dead press: the waiting
      // state offers no A at all, and the submit latch swallows repeats).
      if (this.firstActionActionableNow) {
        this.performFirstAction();
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
      // THE SCENE TRANSITION ARMS NOW — on the still-untouched summary:
      // the card overlay captures the live pixels, the freeze layer snapshots
      // the whole frame. From this press to the deployment the player only
      // ever sees the snapshot + the flying cards, whatever the live tree
      // re-renders underneath.
      this.prepareMaterializationFreeze();
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
          // returns pressable, the frozen snapshot + card overlay let go
          // (the live summary stands untouched beneath), and the lifetime
          // claim releases.
          this.disposeMaterializationFreeze(true);
          this.summaryArriving.clear();
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
      // THE SEAT HANDS OVER, never doubles. A first-action follow-up pick
      // whose winner DRAWS cards itself (Valley Trust hands the player a
      // Biolab) needs the source seat for its own claim — and the seat is
      // still occupied by the corporation. One physical object per card: the
      // corp settles home FIRST (its role as the source ends the moment the
      // action's outcome takes over), the rivals tumble at once (the press's
      // instant response), and only on the vacated seat does the pick arm its
      // hero + claim. A non-drawing winner keeps the corp seated — the stage
      // closes it at READY.
      if (this.firstActionStageLive && this.embedSourceShown !== undefined &&
          (this.drawExpected.get(name) ?? 0) > 0) {
        if (this.firstAct.stage === 'standing' || this.firstAct.stage === 'staging') {
          this.firstAct.stage = 'performing';
        }
        void this.runEmbedSourceSettle().then(() => submit());
        return;
      }
      submit();
    },
    /**
     * THE SOURCE EMERGE — the card that caused the draw comes physically
     * forward: its dock face steps AWAY (geometry held), a proxy carries the
     * same pixels into the step's source column, the column card reveals on
     * touchdown. The same take/carry/lay grammar as every start transfer.
     */
    async runEmbedSourceEmerge(explicitSource?: CardName): Promise<void> {
      const source = explicitSource ?? this.outcome.sourceCard as CardName;
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
        this.embedSourceLanded = true;
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
      this.embedSourceLanded = true; // the card physically stands in the seat
    },
    /**
     * THE QUEUE RELEASE — the main scene lets go so the effect owns the room.
     * Not a dim: the queue content genuinely leaves (recede grammar, origin at
     * the departed card's slot — the whole scene breathes away from the press
     * point), and the zone behind it is clean for the reveal. The pressed
     * card's slot is already blanked under the hero proxy, so nothing pops.
     */
    runQueueRelease(): void {
      if (this.queueReleased) {
        return;
      }
      this.queueReleased = true;
      const queue = this.$refs.queueEl as HTMLElement | undefined;
      if (queue === undefined || queue === null || !queue.isConnected) {
        return;
      }
      const name = this.embedSourceShown;
      const esc = name !== undefined && typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name;
      const slot = esc === undefined ? null :
        queue.querySelector<HTMLElement>(`[data-queue-slot="${esc}"], [data-pay-card="${esc}"]`);
      const r = slot?.getBoundingClientRect();
      const point = r !== undefined && r.width > 0 ? {x: r.left + r.width / 2, y: r.top + r.height / 2} : undefined;
      if (consoleReducedMotionActive()) {
        gsap.set(queue, {autoAlpha: 0});
        return;
      }
      guardedDescend(queue, 420, () => {}, (finish) => {
        const tl = gsap.timeline({onComplete: finish});
        descendRecede(tl, queue, point, motionMs(380) / 1000, 0);
        return tl;
      });
    },
    /**
     * THE PLAYED SHELF YIELDS THE STAGE.
     *
     * «РАЗЫГРАНО» belongs to the deployment, not to the step standing inside
     * it — so while that step is up it recedes exactly as the queue does, and
     * the effect's own screen gets the whole row. It is deliberately NOT a
     * `v-if`: the shelf keeps its DOM, its counters and its stack identities
     * (`[data-played-key]`, `[data-start-front]`), so nothing has to be rebuilt
     * and the hero target it registers is never withdrawn.
     *
     * The origin is the shelf's own centre — it is not what the player pressed,
     * so it must not appear to fly out of the pressed card.
     */
    runPlayedDockRelease(): void {
      if (this.playedDockReleased) {
        return;
      }
      const dock = this.playedDockRoot();
      if (dock === null) {
        return;
      }
      this.playedDockReleased = true;
      if (consoleReducedMotionActive()) {
        gsap.set(dock, {autoAlpha: 0});
        return;
      }
      guardedDescend(dock, 420, () => {}, (finish) => {
        const tl = gsap.timeline({onComplete: finish});
        descendRecede(tl, dock, undefined, motionMs(320) / 1000, 0);
        return tl;
      });
    },
    /**
     * …AND COMES BACK IN TIME. Awaited BEFORE the source card's continuation
     * flight, because that flight measures `[data-played-key]` inside this very
     * shelf: a card aiming at a receded (transformed, transparent) destination
     * would fly to a place that is not where it lands.
     */
    async runPlayedDockReturn(): Promise<void> {
      if (!this.playedDockReleased) {
        return;
      }
      this.playedDockReleased = false;
      const dock = this.playedDockRoot();
      if (dock === null) {
        return;
      }
      await this.$nextTick(); // the shelf's own post-effect state settles first
      if (consoleReducedMotionActive()) {
        gsap.set(dock, {clearProps: 'transform,opacity,visibility'});
        return;
      }
      await new Promise<void>((resolve) => {
        guardedDescend(dock, 460, resolve, (finish) => {
          const tl = gsap.timeline({onComplete: finish});
          descendReturn(tl, dock, motionMs(400) / 1000, 0);
          return tl;
        });
      });
    },
    /** The shelf's root element (it is a component, so reach through `$el`). */
    playedDockRoot(): HTMLElement | null {
      const dock = this.$refs.playedDockEl as {$el?: HTMLElement} | undefined;
      const el = dock?.$el;
      return el !== undefined && el !== null && el.isConnected ? el : null;
    },
    /** THE QUEUE RETURN — the reverse of the same phrase: the (already
     *  reflowed) queue breathes back from the remembered origin, fully ready
     *  before the source card's continuation flight measures anything. */
    async runQueueReturn(): Promise<void> {
      if (!this.queueReleased) {
        return;
      }
      this.queueReleased = false;
      const queue = this.$refs.queueEl as HTMLElement | undefined;
      if (queue === undefined || queue === null || !queue.isConnected) {
        return;
      }
      await this.$nextTick(); // the post-effect queue state settles first
      if (consoleReducedMotionActive()) {
        gsap.set(queue, {clearProps: 'transform,opacity,visibility'});
        return;
      }
      await new Promise<void>((resolve) => {
        guardedDescend(queue, 470, resolve, (finish) => {
          const tl = gsap.timeline({onComplete: finish});
          descendReturn(tl, queue, motionMs(430) / 1000, 0);
          return tl;
        });
      });
    },
    /** THE RETURN HALF of the effect flow, in order: the main scene comes
     *  back FULLY READY (queue standing, dock untouched), and only then the
     *  source card continues its interrupted journey into «Разыграно». */
    async runStartEffectReturn(): Promise<void> {
      // BOTH halves of the deployment come back together, and BOTH are fully
      // settled before the source card continues — the shelf is this flight's
      // destination, so a return that raced it would aim the card at a moving
      // target.
      await Promise.all([this.runQueueReturn(), this.runPlayedDockReturn()]);
      await this.runEmbedSourceSettle();
    },
    /** The submit died mid-flow: nothing landed anywhere — clear the held
     *  seat with NO ghost flight, drop the orphaned claim, restore the queue. */
    async abortStartEffectFlow(): Promise<void> {
      this.embedSourceShown = undefined;
      this.embedSourceArriving = false;
      this.embedSourceLanded = false;
      this.embedSourceDeparting = false;
      if (this.outcome.host === 'start') {
        releaseWorkspaceOutcome();
      }
      await Promise.all([this.runQueueReturn(), this.runPlayedDockReturn()]);
    },
    /** THE SOURCE SETTLE — the effect is over: the source card carries on
     *  from its seat into the dock's family slot (the second half of the
     *  play's journey); the shelf face turns real the moment the proxy
     *  touches down. A card that never PHYSICALLY reached the seat (an
     *  aborted flow) just clears — a flight of a ghost is worse than none. */
    async runEmbedSourceSettle(): Promise<void> {
      const source = this.embedSourceShown;
      if (source === undefined) {
        return;
      }
      // The caption goes FIRST and on its own beat: «ИСТОЧНИК» names a card
      // that is about to leave, and a label outliving its subject is the
      // loudest kind of leftover state. Set before anything is measured, so
      // the dissolve overlaps the flight instead of following it.
      this.embedSourceDeparting = true;
      if (!this.embedSourceLanded) {
        this.embedSourceShown = undefined;
        this.embedSourceArriving = false;
        this.embedSourceDeparting = false;
        return;
      }
      const root = this.$el as HTMLElement | undefined;
      const q = root !== undefined && typeof root.querySelector === 'function' ? root : undefined;
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(source) : source;
      const colSlot = q?.querySelector<HTMLElement>('[data-embed-source-slot]') ?? null;
      // ⚠️ AIM AT THE SLOT, NEVER AT THE FACE INSIDE IT.
      //
      // `.con-splayed__top` is the shelf's PREPARED CARD PLACE — card-shaped by
      // construction (`height: cardH`, the stack's `width: slotW`, both the
      // painted face's own box) and already the anchor the OUTBOUND hero flight
      // lands on (`data-start-front`). The FACE only exists when there is
      // something to paint there, and while this card is out on loan its family
      // may have nothing else: `topFace` is `undefined` whenever the away card
      // was the only one of its category — which is the ordinary case for the
      // first prelude a player plays.
      //
      // The face query then returned null, the whole `if` was skipped, and the
      // card went from the source seat to «РАЗЫГРАНО» in ONE FRAME. Half of a
      // play animated and half of it teleported, for a reason that was purely
      // about which element happened to be painted.
      const dockSlot =
        q?.querySelector<HTMLElement>(`.con-start__played .con-splayed__top[data-played-key="${esc}"]`) ??
        q?.querySelector<HTMLElement>(`.con-start__played [data-played-key="${esc}"]`) ??
        null;
      if (colSlot !== null && dockSlot !== null) {
        this.embedSourceArriving = true; // the column empties under the proxy
        await reseatCards([{name: source, fromEl: colSlot, toEl: dockSlot}],
          () => {
            // Touchdown: release the away-state — the shelf face reappears
            // under the settling proxy in the same frame.
            this.embedSourceShown = undefined;
          });
      }
      this.embedSourceShown = undefined;
      this.embedSourceArriving = false;
      this.embedSourceLanded = false;
      this.embedSourceDeparting = false;
    },
    // ── THE FIRST-ACTION STAGE (methods) ─────────────────────────────────
    /**
     * ENTER THE STAGE — the physical opening the flow's grammar demands: the
     * corporation card rises out of its REAL place in «Разыграно» (the same
     * emerge every embedded step uses — dock face steps away, geometry held,
     * a proxy carries the live pixels into the source seat), while the
     * deployment chrome (queue remnants + the played shelf's frame, captions
     * and unrelated cards) recedes behind it in the descend phrase. The
     * briefing then materializes around the settled card (CSS enter — the
     * panel is mounted by `firstActionPanelShown`).
     */
    async enterFirstActionStage(): Promise<void> {
      const corp = this.firstActionCorpNow;
      if (corp === undefined || this.firstAct.stage !== 'idle') {
        return;
      }
      this.firstAct.stage = 'staging';
      this.firstAct.corp = corp;
      this.firstAct.submitting = false;
      this.firstActionSeen = true;
      this.fetchFirstActionPreview(corp);
      // The card leaves FIRST, the shelf lets go BEHIND it (the same order the
      // effect flow uses: the source is out before the surface retires — the
      // card must never vanish inside a fading shelf).
      const emerge = this.runEmbedSourceEmerge(corp);
      this.runQueueRelease();
      window.setTimeout(() => {
        // A beat later, so the card visibly LEAVES the shelf before the shelf
        // dissolves (reduced motion collapses both to instant sets).
        if (this.firstAct.stage === 'staging' || this.firstAct.stage === 'standing') {
          this.runPlayedDockRelease();
        }
      }, motionMs(140));
      await emerge;
      if (this.firstAct.stage === 'staging') {
        this.firstAct.stage = 'standing';
      }
    },
    /** The briefing's preview fetch — non-gating (the CTA never waits on it);
     *  a failed fetch degrades to the ask + the confirm, exactly like the
     *  ceremony's reward prefetch. */
    fetchFirstActionPreview(corp: CardName): void {
      if (this.firstActionPreviews.has(corp) || typeof fetch !== 'function') {
        return;
      }
      this.firstActionPreviews.set(corp, undefined);
      const url = apiUrl(paths.API_CORP_FIRST_ACTION_PREVIEW) +
        '?id=' + encodeURIComponent(this.playerView.id) + '&corp=' + encodeURIComponent(corp);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          this.firstActionPreviews.set(corp, p as ActionPreview | undefined);
        })
        .catch(() => {
          // Degraded honestly: the stage still shows the ask + the CTA.
        });
    },
    /**
     * PERFORM THE FIRST ACTION (A on the standing stage) — submit the seated
     * corp's option of the marked OrOptions, byte-identical to the legacy
     * radio submit. A draw-effect action claims its follow-up INTO this
     * workspace in the same press (the corp is ALREADY physically staged in
     * the source seat, so the claim's execution beat is done by construction);
     * everything else (a placement, a prelude pick) arrives as the
     * deployment's normal follow-up prompts.
     */
    performFirstAction(): void {
      if (!this.firstActionActionableNow) {
        return;
      }
      const corp = this.firstAct.corp;
      const prompt = startFlowCorpPrompt(this.playerView);
      const index = corpActionOptionIndexFor(prompt, corp as CardName);
      if (prompt === undefined || index === -1) {
        return;
      }
      this.firstAct.submitting = true;
      const expected = firstActionDrawExpected(this.firstActionPreview);
      if (expected > 0) {
        setWorkspaceOutcomeSlot('.con-start__embed');
        claimWorkspaceOutcome('start', corp as CardName, ['draw', 'pick'], 0, expected);
        // The execution beat is ALREADY played: the source card physically
        // stands in its seat (the stage's emerge). Without this the claim
        // sits out the full BEAT_SAFETY before its surface may mount.
        markWorkspaceOutcomeBeatDone();
      }
      this.$emit('submit', {type: 'or', index, response: {type: 'option'}});
    },
    /**
     * LEAVE THE STAGE — the action's whole causal chain has resolved: the
     * room breathes back and the corporation card physically settles home
     * into «Разыграно» (the same return + settle phrase every embedded step
     * ends with) — closing its role as the source, so READY lands on a
     * complete, settled frame.
     */
    async runFirstActionLeave(): Promise<void> {
      if (this.firstAct.stage === 'idle' || this.firstAct.stage === 'leaving') {
        return;
      }
      this.firstAct.stage = 'leaving';
      await this.runStartEffectReturn();
      this.firstAct.stage = 'idle';
      this.firstAct.corp = undefined;
      this.firstAct.submitting = false;
    },
    /**
     * MERGER RE-STAND — the server re-raised the first-action prompt after a
     * previous action's chain resolved (a second corporation owes its move):
     * the standing stage returns without ever having left, and the seat swap
     * follows if the pending corp changed.
     */
    restandFirstAction(): void {
      if (this.firstAct.stage !== 'performing' || !this.firstActionOwedNow || !this.firstActionChainQuiet) {
        return;
      }
      this.firstAct.stage = 'standing';
      this.firstAct.submitting = false;
      const corp = this.firstActionCorpNow;
      if (corp !== undefined && this.firstAct.corp !== corp) {
        void this.swapFirstActionSeat(corp);
      }
    },
    /**
     * MERGER — a SECOND corporation owes its action after the first resolved:
     * the seat hands over (the first corp settles home, the next one rises)
     * through the same two phrases, never a repaint of the seat's face.
     */
    async swapFirstActionSeat(next: CardName): Promise<void> {
      if (this.firstAct.stage !== 'standing' || this.firstAct.corp === next) {
        return;
      }
      this.firstAct.stage = 'staging';
      this.firstAct.submitting = false;
      // The settle flies INTO the shelf, so the shelf must be back and
      // measurable first (the same order runStartEffectReturn keeps); it
      // recedes again behind the next corp's rise.
      await this.runPlayedDockReturn();
      await this.runEmbedSourceSettle();
      this.firstAct.corp = next;
      this.fetchFirstActionPreview(next);
      const emerge = this.runEmbedSourceEmerge(next);
      window.setTimeout(() => {
        if (this.firstAct.stage === 'staging' || this.firstAct.stage === 'standing') {
          this.runPlayedDockRelease();
        }
      }, motionMs(140));
      await emerge;
      if (this.firstAct.stage === 'staging') {
        this.firstAct.stage = 'standing';
      }
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
      // The EFFECT-SOURCE seat mounts IN THE SAME PRESS: the hero flight
      // needs its intermediate landing slot measurable before it flies, and
      // the column card stays held until the hero's atomic handoff.
      this.embedSourceShown = name;
      this.embedSourceArriving = true;
      this.embedSourceLanded = false;
      this.embedSourceDeparting = false;
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
      this.startDeliveryNames = names;
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
      // The one place the client legitimately knows WHICH card is being
      // played. If its effect turns out to ask for a play-from-hand
      // («Эпатажный спонсор»), this is the source the crumb names — the
      // server's prompt carries no attribution of its own.
      setWorkspaceFrameSubject('start', name);
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
        // A play with an interactive DRAW pauses its journey at the effect-
        // source seat: the hero lands in the embed column (claimStartFollowUp
        // mounts it in this same press), presides over the reveal, and the
        // settle carries it on into «Разыграно» when the effect completes.
        targetSelector: (this.drawExpected.get(name) ?? 0) > 0 ? '[data-embed-source-slot]' : undefined,
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
