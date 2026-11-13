<template>
  <div ref="root" class="con-start"
       :class="{
         'con-start--ceremony': mode === 'ceremony',
         // The «Эффекты» layer opened from the QUEUE's door (TR82): the queue parks under it (the composers' browse
         // column phrase) — the layer is a level of this stage, never a modal over a live queue.
         'con-start--queuefx': firstActionFxOpen && !firstActionPanelShown,
         'con-start--yielded': yielded,
         'con-start--bounded': shellBounded,
         'con-ws': shellBounded,
         // A hand step stands INSIDE the deployment's body (P55 · FN) — the frame's gap is the deployment's own, never
         // re-fitted for it; the class stays the family's marker.
         'con-start--sponsor': sponsorStep,
         'con-start--matcut': matCut,
         'con-start--materializing': state.flow === 'materializing',
         'con-start--completing': state.flow === 'completing',
         'con-start--releasing': state.flow === 'releasing',
         'con-start--resolved': state.flow === 'completing' || state.flow === 'releasing',
         // A RESTORED first-action stage renders its room already away: the
         // collapse unmounts this workspace, so without this the queue and
         // «РАЗЫГРАНО» paint for the frames before the pose lands — the
         // reported flash of a shelf that immediately disappears again.
         'con-start--roomheld': stageOwnsRoom && !roomPosed,
         // «РАЗЫГРАНО» STAYS ON STAGE while a stage panel stands: it is the
         // home the seated card came out of and settles back into, so the
         // swap must have somewhere visible to happen. It tucks to a PEEK
         // (the stacks' tops) and the stage lays out above it.
         'con-start--shelfstage': shelfOnStage,
         // A prelude's «ВАРИАНТ» step stands (P44): the queue's other blocks and the shelf recede, the prelude stays.
         'con-start--variant': variantStep !== undefined,
       }"
       :data-bonus-stage="state.bonusAct.stage"
       :data-first-stage="state.firstAct.stage"
       :data-start-press-refused="pressRefusal || undefined"
       :data-start-serves="servesNow"
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
                       :stage="startFxStage ?? orderStageText ?? wsStage"
                       :stageRaw="startFxStage !== undefined || orderStageText !== undefined"
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
            <!-- THE PURCHASE LEDGER (§20.4 — the owner, 2026-11-09): on the project step, ONE line says what the buy costs and
                 what is left — the money the start brings (the lineage's merges and bonus, the preludes' own M€) minus
                 the picks × the card's price. Each number is keyed on its value: a change (a pick, «Субсидия»'s price)
                 replays its one-shot tick in place — the line never re-lays out. -->
            <span v-if="ledgerShown && ledgerView !== undefined" class="con-start__ledger"
                  :class="{'con-start__ledger--broke': ledgerView.left < 0}" data-purchase-ledger
                  :data-purchase-cost="ledgerView.cost" :data-purchase-left="ledgerView.left">
              <span class="con-start__ledger-cap">{{ $t('Purchase') }}</span>
              <!-- The purchase carries the price's WHY (TerraLabs, a lineage merge, «Субсидия»…) — the one hint the
                   status rail's money chip carried before this line replaced it on the project step. -->
              <span class="con-start__ledger-sum con-price-hint" data-purchase-price :data-hint="startPriceHint">
                <b :key="'n' + ledgerView.buys" class="con-start__ledger-num">{{ ledgerView.buys }}</b>
                <span class="con-start__ledger-op" aria-hidden="true">×</span>
                <b :key="'c' + ledgerView.cost" class="con-start__ledger-num con-start__ledger-num--price" data-purchase-price-value>{{ ledgerView.cost }}</b>
                <i class="resource_icon resource_icon--megacredits con-start__ledger-mc" aria-hidden="true"></i>
                <span class="con-start__ledger-op" aria-hidden="true">=</span>
                <b :key="'t' + ledgerView.buys * ledgerView.cost" class="con-start__ledger-num">{{ ledgerView.buys * ledgerView.cost }}</b>
              </span>
              <span class="con-start__ledger-sep" aria-hidden="true"></span>
              <span class="con-start__ledger-cap">{{ $t('Left') }}</span>
              <span class="con-start__ledger-sum">
                <b :key="'l' + ledgerView.left" class="con-start__ledger-num con-start__ledger-num--left" data-purchase-left-value>{{ ledgerView.left }}</b>
                <i class="resource_icon resource_icon--megacredits con-start__ledger-mc" aria-hidden="true"></i>
              </span>
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
                  <span class="con-start__crewword">{{ $t(p.status.textKey) }}</span>
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
        <div v-show="mode === 'wizard' && currentStep !== undefined && !legacyViewCovers && !tenderViewCovers && !restructureCovers"
             class="con-start__body con-start__body--cards con-info__scroll" ref="body"
             :data-cursor-pending="deal.state.active ? '' : undefined">
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
                     :data-deal-dealing="railPos === si && deal.isHeld(card.name + '#' + i) ? 'yes' : undefined"
                     :class="{
                       'con-cards__slot--focused': railPos === si && focusIdx === i && !(st.id === 'projects' && tagMode !== undefined),
                       'con-cards__slot--tender': railPos === si && tenderModeLive,
                       'con-cards__slot--picked': stepPicked(st, card.name),
                       'con-cards__slot--dim': railPos === si && ((dimUnpicked && !stepPicked(st, card.name) && reviewMode === undefined) || tagFocusDims(st, card.name)),
                       'con-cards__slot--release': railPos === si && stripRelease.has(card.name),
                       'con-deal-hold': (railPos === si && deal.isHeld(card.name + '#' + i)) || returningNames.has(st.id + '|' + card.name),
                     }"
                     :ref="railPos === si && focusIdx === i ? 'focusedCardSlot' : undefined">
                  <Card :card="card" :key="card.name" lightweight />
                  <span v-if="railPos === si && stripRelease.has(card.name)" class="con-cards__pickband con-cards__pickband--discard" aria-hidden="true" data-tender-release>{{ $t('Back to the deck') }}</span>
                  <span v-else-if="stepPicked(st, card.name)" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
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
        <div v-show="summaryShown && !legacyViewCovers && !tenderViewCovers" class="con-start__body con-start__summary con-info__scroll"
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
            <!-- The «Тендеры» finale: what was executed and what the start will buy back — the chips, never a second portfolio. -->
            <div v-if="portfolioEntries.length > 0" class="con-start__summary-block" data-summary-tenders>
              <div class="con-start__section-title">{{ $t('Tenders') }} · {{ portfolioCounts.executed }}/{{ portfolioCounts.total }}</div>
              <div class="con-start__minirow con-start__minirow--wrap con-start__minirow--tenders">
                <ConsoleTenderChip v-for="e in portfolioEntries" :key="e.instance" :id="e.id" :status="e.status" />
              </div>
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
                <div v-if="preview.buys > 0" class="con-start__money-line"><span class="con-price-hint" data-purchase-price :data-hint="startPriceHint">{{ $t('Projects') }}: {{ preview.buys }} × {{ preview.cardCost }}</span>
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
            <!-- THE TERMINAL WARNING (§16.4): tenders of the start window still held — after this press they cannot be
                 executed; the Committee buys them back. A conscious second press begins anyway. -->
            <div v-if="armedTenders" class="con-start__skipwarn" data-start-tender-warning>
              ⚠ {{ tenderWarningText }}
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

        <!-- ── CAMPAIGN: THE LEGACY OVERVIEW ────────────────────────────
             The wizard's read-only SUB-STAGE (R3 from any page, corp step
             through the summary): the current page PARKS on the spot
             (parkSurface — the retire-the-surface grammar every start
             transfer speaks), this layer takes the same body slot, and the
             legacy cards physically RISE from their shelf tiles into two
             zones — corporations and the carried projects — through the ONE
             take/carry/lay flight core (riseToSeats). A seat still waiting
             for its card reads as a PREPARED CARD PLACE (quiet ring), never
             an invisible hole. The shelf below never re-lays out (a tile is
             only HELD while its card is up here); B answers with the press
             impulse, flies everything home (each tile takes the landing
             weight) and un-parks the exact page — picks and focus untouched
             (the pages are parked v-show layers; this stage never writes
             them). -->
        <div v-show="legacyViewCovers" class="con-start__body con-start__legacyview" ref="legacyPane">
          <!-- `--live` = fully open and interactive (a state marker specs
               read); `--leaving` swaps the entrance keyframe for the fold. -->
          <div class="con-legview"
               :class="{
                 'con-legview--live': legacyView.phase === 'open',
                 'con-legview--leaving': legacyView.phase === 'leaving',
               }">
            <div class="con-legview__zones">
              <section v-if="legacyOverviewCorpCount > 0" class="con-legview__zone">
                <div class="con-legview__cap">{{ $t('Corporations') }}</div>
                <div class="con-legview__row">
                  <div v-for="(card, i) in legacyOverviewCards.slice(0, legacyOverviewCorpCount)" :key="card.name"
                       class="con-legview__slot"
                       :class="{
                         'con-legview__slot--focused': legacyView.phase === 'open' && legacyView.focus === i,
                         'con-legview__slot--held': legacyStageHeld.has(card.name),
                       }"
                       :data-zoom-slot="card.name"
                       :data-legview-slot="card.name">
                    <Card :card="card" :key="card.name" lightweight />
                  </div>
                </div>
              </section>
              <!-- Inside the «НАСЛЕДИЕ» tail the zone caption never echoes
                   the tail's noun — «КОРПОРАЦИИ» · «ПРОЕКТЫ» (the shelf,
                   standing beside other blocks, keeps the qualified
                   «ПРОЕКТЫ НАСЛЕДИЯ»). -->
              <section v-if="legacyOverviewCards.length > legacyOverviewCorpCount"
                       class="con-legview__zone con-legview__zone--projects">
                <div class="con-legview__cap">{{ $t('Projects') }}</div>
                <div class="con-legview__row">
                  <div v-for="(card, i) in legacyOverviewCards.slice(legacyOverviewCorpCount)" :key="card.name"
                       class="con-legview__slot"
                       :class="{
                         'con-legview__slot--focused': legacyView.phase === 'open' && legacyView.focus === legacyOverviewCorpCount + i,
                         'con-legview__slot--held': legacyStageHeld.has(card.name),
                       }"
                       :data-zoom-slot="card.name"
                       :data-legview-slot="card.name">
                    <Card :card="card" :key="card.name" lightweight />
                  </div>
                </div>
              </section>
            </div>
            <!-- READ-ONLY, said in one quiet line: what these cards are and
                 that nothing here changes the picks. Provenance + state —
                 never a duplicated button hint (the ONE command bar owns
                 every verb). -->
            <div class="con-legview__note">
              {{ $t('Carried from the previous mission') }} · {{ $t('View only') }}
            </div>
          </div>
        </div>

        <!-- ── CAMPAIGN «ТЕНДЕРЫ»: THE DOOR's LIST (§19) ──────────────────
             L3 from any wizard page (the dock's «ТЕНДЕРЫ» block is the door): the page PARKS on the spot (the legacy
             overview's own phrase), this layer takes the same body slot and the certificates RISE out of the dock's
             miniatures into the list — the ones that execute on THIS page first, then the others with their reason.
             A on a certificate of this page hands the screen BACK to the page (the certificates fly home, the page
             surfaces as it was — same cards, same size) and the tender stands there in its MODE; B / L3 return with
             nothing done. -->
        <div v-show="tenderViewCovers" class="con-start__body con-start__tenderview" ref="tenderPane">
          <ConsoleTenderPortfolio v-show="tenderSheet === undefined" ref="portfolio" class="con-start__tenderlist"
                                  :class="{'con-start__tenderlist--leaving': tenderView.phase === 'leaving'}"
                                  :entries="doorEntries" :focus="tenderView.phase === 'open' ? tenderView.focus : -1"
                                  place="start" :busy="state.tenderBusy" :held-names="tenderListHeld"
                                  :live="tenderView.phase === 'open'" embedded />
          <!-- THE ACTIVATION SHEET (§20): the chosen tender as the hero of its own scene — the RESULT beside it. -->
          <ConsoleTenderActivation v-if="tenderSheet !== undefined && tenderSheetPlan !== undefined" ref="tenderSheetEl"
                                   :plan="tenderSheetPlan" :hero-held="sheetHeroHeld"
                                   :open="tenderSheet.phase === 'open' || tenderSheet.phase === 'committing' || sheetPanelOpen"
                                   :committed="sheetCommitted" :stamping="sheetStamping"
                                   :leaving="tenderSheet.phase === 'leaving'" :busy="state.tenderBusy !== undefined"
                                   :tags="sheetTags" :tag-focus="sheetTagFocus" :tag-picked="sheetTagPicked" />
        </div>

        <!-- ── CAMPAIGN «ТЕНДЕРЫ»: THE RESTRUCTURING (§19.7, the owner 2026-11-09) ──
             The lineage the dock carries on EVERY page is what it rewrites, so it stands over whichever page the player
             chose it on (the page parks). ONE ROW: the lineage first — already standing, already MARKED «✓ В линейке»
             (no flight: these cards are the player's) — then the candidates, which come off the corporation deck one by
             one as the server deals them. The rule is the row's: ONE lineage corporation may be taken out, ONE candidate
             taken in; RT confirms only a whole lineage (the same count it started with) — a swap, or the lineage kept.
             The cards are drawn: there is no way back from here (B only folds the workspace; the decision stays). -->
        <div v-show="restructureCovers" class="con-start__body con-start__restructview" ref="restructPane">
          <div v-if="restructureMode !== undefined" class="con-restructure" data-tender-mode="restructure"
               :data-restructure-valid="restructureState.valid ? 'yes' : undefined">
            <div class="con-restructure__row" data-tender-zone="row">
              <section class="con-restructure__group" data-tender-zone="lineage">
                <div class="con-restructure__cap">{{ $t('Lineage') }}</div>
                <div class="con-restructure__cards">
                  <div v-for="(card, i) in restructureLineageCards" :key="card.name" class="con-cards__slot con-restructure__slot"
                       :class="{
                         'con-cards__slot--focused': focusIdx === i,
                         'con-cards__slot--picked': restructureMode.replace !== card.name,
                         'con-cards__slot--release': restructureMode.replace === card.name,
                       }"
                       :data-zoom-slot="card.name" :data-restruct-lineage="card.name"
                       :data-tender-mode-card="card.name" :data-tender-mode-picked="restructureMode.replace !== card.name ? 'yes' : undefined">
                    <Card :card="card" :key="card.name" lightweight />
                    <span v-if="restructureMode.replace === card.name" class="con-cards__pickband con-cards__pickband--discard" aria-hidden="true">{{ $t('Leaves the lineage') }}</span>
                    <span v-else class="con-cards__pickband" aria-hidden="true">✓ {{ $t('In the lineage') }}</span>
                  </div>
                </div>
              </section>
              <span class="con-restructure__divider" aria-hidden="true"></span>
              <section class="con-restructure__group con-restructure__group--offer" data-tender-zone="offer">
                <div class="con-restructure__cap">{{ $t('Candidates') }}</div>
                <div class="con-restructure__cards">
                  <div v-for="(card, i) in restructureOfferCards" :key="card.name" class="con-cards__slot con-restructure__slot"
                       :class="{
                         'con-cards__slot--focused': focusIdx === restructureLineageCards.length + i,
                         'con-cards__slot--picked': restructureMode.take === card.name,
                         'con-restructure__slot--arriving': restructArriving.has(card.name),
                       }"
                       :data-zoom-slot="card.name" :data-restruct-candidate="card.name"
                       :data-tender-mode-card="card.name" :data-tender-mode-picked="restructureMode.take === card.name ? 'yes' : undefined">
                    <Card :card="card" :key="card.name" lightweight />
                    <span v-if="restructureMode.take === card.name" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('In the lineage') }}</span>
                  </div>
                  <!-- The candidates' PLACES while the deck deals them (the server's first answer in flight): prepared
                       card places, never a hole — the row's geometry is final from the first frame. -->
                  <template v-if="restructureOfferCards.length === 0">
                    <div v-for="n in restructureCandidateCount" :key="'place' + n" class="con-restructure__place" aria-hidden="true"></div>
                  </template>
                </div>
              </section>
            </div>
          </div>
        </div>

        <!-- ── CAMPAIGN «ТЕНДЕРЫ»: THE DECK (§19.7) — the pile a tender's scene plays against: the cards an exchange or a
             gamble returns fly INTO it, the fresh deal and the restructuring's candidates come OFF it. A real object on
             the scene (frame-absolute at the body's bottom-right corner — out of flow, the deal never re-fits for it),
             up only while a tender that touches the deck stands or plays. -->
        <div class="con-start__tdeck" :class="{'con-start__tdeck--up': tenderDeckUp}" :style="tenderDeckStyle"
             ref="tenderDeck" data-tender-deck :data-tender-deck-up="tenderDeckUp ? 'yes' : undefined" aria-hidden="true">
          <div class="con-start__tdeck-pile">
            <div class="con-card-back con-start__tdeck-c con-start__tdeck-c--3"></div>
            <div class="con-card-back con-start__tdeck-c con-start__tdeck-c--2"></div>
            <div class="con-card-back con-start__tdeck-c"></div>
          </div>
          <span class="con-start__tdeck-cap">{{ $t('Deck') }}</span>
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
        <!-- P55 · FN — the hand step is a step like the colonies': its zone lives INSIDE the deployment's body below
             and the deployment RELEASES in place (the same nodes come back — never the v-if sibling swap that blinked
             on entry and on return). This outer zone is the fallback for a hand step outside the ceremony only. -->
        <div v-if="sponsorStep && mode !== 'ceremony'" class="con-start__handstep con-start__handslot" data-embed-slot="start-hand"></div>

        <!-- THE COLONIES STEP — a prelude's SelectColony (Early Colonization's
             Build Colony …): the COLONY WORKSPACE is teleported into this zone
             and wears the start's shell (workspace-embed host 'start' ×
             surface 'colonies'). Same contract as the sponsor step: full-size
             host, the deployment parks (module state, returns untouched), the
             crumb reads «СТАРТ ПАРТИИ › <пролог> › КОЛОНИИ».
             Unlike the sponsor's hand, the zone lives INSIDE the deployment's
             body and the deployment is NEVER unmounted for it (P48 · ledger
             EY — the open «parent collapse» blink of colony-focus-stage §5):
             the deployment RELEASES in place (opacity, its box kept — no
             re-fit), the zone takes exactly that box, and on the way back the
             same nodes reveal where they stood. -->
        <div v-if="mode === 'ceremony'" class="con-start__body con-start__ceremony"
             :class="{'con-start__ceremony--hidden': !ceremonyRevealed && !sponsorStep, 'con-start__ceremony--stepped': colonyStep || sponsorStep || orderStep !== undefined}"
             :data-start-step-zone="colonyStep ? 'colonies' : (sponsorStep ? 'hand' : (orderStep !== undefined ? 'order' : undefined))"
             ref="ceremonyBody">
          <div v-if="colonyStep" class="con-start__handstep con-start__colonystep" data-embed-slot="start-colonies"></div>
          <!-- P58 · FS — «ОЧЕРЁДНОСТЬ»: a prelude that places several tiles in the PLAYER's order asks «which tile next»
               between its placements (the LIVE `OrOptions` — `placementOrderPrompt`). A step of the start like the
               colonies' and the hand's: its zone lives INSIDE the deployment's body and the deployment releases in
               place (the same nodes come back); the prelude stands as the step's hero, its rows the card's own printed
               hexes — the placed ones sealed where they stood. Through the board's placement the scene collapses
               (`yielded`), it never closes, and it comes back with the next step. -->
          <transition name="con-start-firstact">
            <div v-if="orderStep !== undefined" class="con-start__handstep con-start__orderstep" data-start-order-step
                 :data-start-order-index="orderStep.order?.index" :data-start-order-of="orderStep.order?.of">
              <div class="con-start__orderhero" :data-zoom-slot="orderStep.card" :data-start-order-hero="orderStep.card">
                <Card :card="{name: orderStep.card}" :key="orderStep.card" lightweight />
              </div>
              <div class="con-start__orderchoice">
                <ConsolePreludeVariantStep :variant="orderStep" :focus="orderFocus" :sealed="orderSealed" @pick="onOrderPick" />
              </div>
            </div>
          </transition>
          <div v-if="sponsorStep" class="con-start__handstep con-start__handslot" data-embed-slot="start-hand"></div>
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
              <div class="con-start__queue" ref="queueEl"
                   :class="{'con-start__queue--solved': queueZoom !== undefined}"
                   :style="queueZoom !== undefined ? {'--con-start-qzoom': String(queueZoom)} : undefined">
                <!-- ONE transition-group holds the whole reading order of the
                     start: КОРПОРАЦИЯ (order 1) → КУПЛЕННЫЕ ПРОЕКТЫ (the buy
                     block, order 2) → ПРОЛОГИ (order 3) — the player's real
                     action sequence, kept by flex `order` so the FLIP moves
                     still share one container. -->
                <transition-group name="con-start-shift" tag="div" class="con-start__queue-row">
                  <div v-for="entry in queueCards" :key="entry.name"
                       class="con-start__qcard con-start__deal"
                       :style="{order: entry.kind === 'prelude' ? 5 : 1}"
                       :class="{
                         'con-start__qcard--focused': isFocused(entry.kind, entry.name),
                         'con-start__qcard--armed': riskStage !== undefined && riskArmed === entry.name,
                         'con-start__qcard--enabler': entry.enabler === true,
                         'con-start__qcard--awaiting': entry.dimmed,
                         'con-deal-hold': queueArriving.has(entry.name) || heroDepartedName === entry.name || deal.isHeld(entry.name + '#' + entry.dealIdx),
                       }"
                       :data-zoom-slot="entry.name"
                       :data-queue-slot="entry.name"
                       :data-forecast-hero="queueForecastCard === entry.name ? '' : undefined"
                       :data-variant-hero="variantStep !== undefined && variantCard === entry.name ? '' : undefined">
                    <Card :card="{name: entry.name}" :key="entry.name" lightweight />
                    <span v-if="entry.badge !== undefined" class="con-cards__pickband" :class="entry.badgeClass">{{ $t(entry.badge) }}</span>
                    <div v-if="entry.reason !== undefined" class="con-cards__reason">{{ $t(entry.reason) }}</div>
                    <!-- THE A PILL IS ALSO THE RISK STAGE'S FACE. Inside the
                         stage the pill relabels IN PLACE to the verb that
                         names the loss — never «Подтвердить», which beside
                         «Сначала разыграйте другой пролог» could only be read
                         as «press A to go to that one». The pill is absolutely
                         positioned, so entering and leaving the stage costs
                         ZERO layout shift: the queue never moves under the
                         player mid-decision. -->
                    <div v-else-if="isFocused(entry.kind, entry.name) && entry.verb !== undefined"
                         class="con-start__slot-a"
                         :class="{'con-start__slot-a--armed': riskStage !== undefined && riskArmed === entry.name}">
                      <GamepadGlyph control="confirm" />
                      <span>{{ riskStage !== undefined && riskArmed === entry.name ? $t(riskStage.commitLabel) : $t(entry.verb) }}</span>
                    </div>
                    <!-- THE READING LINE (TRP0 · DE — S2): under EVERY corporation / prelude of the queue, one quiet line —
                         the VERDICT word, so two preludes compare at a glance without walking the focus. Never a fact
                         of the face (the card above prints those) and never the table's answer (P79 · DI — it stands
                         ONCE, on the status rail, for the focused card: two places for one fact were two R3 keys);
                         absolute under the card (its room is the solver's reserve), the same in every focus state: a
                         d-pad walk changes the kant and the hero's scale, never a line. -->
                    <div v-if="entry.reading !== undefined" class="con-start__qread"
                         data-qcard-reading :data-qcard-verdict="entry.reading.verdict">
                      <span v-if="entry.reading.text !== undefined" class="con-start__qread-verdict"
                            :class="'con-start__qread-verdict--' + entry.reading.tone">{{ queueReadingText(entry.reading) }}</span>
                      <!-- P44: a prelude whose play is a CHOICE says so before A — its branches named in the printed order. -->
                      <span v-if="variantReadingText(entry.name) !== ''" class="con-start__qread-variants"
                            data-qcard-variants>{{ variantReadingText(entry.name) }}</span>
                    </div>
                  </div>

                  <!-- CAMPAIGN «БОНУС КАМПАНИИ» — pre-laid from the first
                       frame in its activation slot (right after the base
                       corporation), dimmed until its press; the press flies
                       the M€ chip into the rail (launchBonusFlight). -->
                  <div v-if="bonusPlateShown" key="#bonus" class="con-start__bonusplate"
                       :style="{order: 2}"
                       data-campaign-bonus
                       :class="{
                         'con-start__bonusplate--focused': isFocused('bonus', BONUS_KEY),
                         'con-start__bonusplate--awaiting': bonusPrompt === undefined,
                       }">
                    <span class="con-start__bonusplate-cap">{{ $t('Campaign bonus') }}</span>
                    <span class="con-start__bonusplate-amount">+{{ campaignBonusAmount }}<i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></span>
                    <div v-if="isFocused('bonus', BONUS_KEY)" class="con-start__slot-a con-start__slot-a--inline">
                      <GamepadGlyph control="confirm" /><span>{{ $t('Receive') }}</span>
                    </div>
                  </div>

                  <!-- The BOUGHT PROJECTS — part of the queue until the payment
                       resolves them into the hand (they keep their pay-grid
                       identity: runHandDelivery measures [data-pay-card]). -->
                  <div v-if="payProjects.length > 0" key="#buy" class="con-start__buy"
                       :style="{order: 3}"
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

                  <!-- CAMPAIGN «НАСЛЕДИЕ ПРОЕКТОВ» — the carried cards, FACE
                       UP, pre-laid from the first frame in the SAME chassis
                       as the bought projects (one queue language): dimmed
                       until their press, then flown into the hand dock by
                       the exact same delivery flight — the only difference
                       from the purchase is that nothing is deducted. -->
                  <!-- CAMPAIGN «ТЕНДЕРЫ» — «КОМПЕНСАЦИЯ»: the Committee buys back every tender left unexecuted, 3 M€
                       each, as the LAST stage of the deployment. Pre-laid from the first ceremony frame (the held
                       count is the self model's), dimmed until its press; the press flies the M€ chip into the rail
                       (the bonus plate's own language). -->
                  <div v-if="compensationPlateShown" key="#compensation" class="con-start__bonusplate con-start__bonusplate--tenders"
                       :style="{order: 5}"
                       data-tender-compensation
                       :class="{
                         'con-start__bonusplate--focused': isFocused('compensation', COMPENSATION_KEY),
                         'con-start__bonusplate--awaiting': compensationPrompt === undefined,
                       }">
                    <span class="con-start__bonusplate-cap">{{ $t('Tender compensation') }}</span>
                    <span class="con-start__bonusplate-amount">+{{ compensationAmount }}<i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></span>
                    <span class="con-start__bonusplate-sub" data-tender-compensation-sub>{{ compensationSubText }}</span>
                    <div class="con-start__bonusplate-row" data-buyout-row>
                      <ConsoleTenderChip v-for="t in heldTenderEntries" :key="t.instance" :id="t.id" :status="t.status"
                                         :class="{'con-tchip--cashing': cashing.has(t.instance)}" :data-buyout-card="t.instance" />
                    </div>
                    <div v-if="isFocused('compensation', COMPENSATION_KEY)" class="con-start__slot-a con-start__slot-a--inline">
                      <GamepadGlyph control="confirm" /><span>{{ $t('Receive') }}</span>
                    </div>
                  </div>
                  <div v-if="legacyRowShown" key="#legacy" class="con-start__buy con-start__legacy"
                       :style="{order: 4}"
                       :class="{
                         'con-start__buy--focused': isFocused('legacy', LEGACY_KEY),
                         'con-start__legacy--awaiting': legacyPrompt === undefined,
                       }">
                    <div class="con-start__buy-row" ref="legacyGrid">
                      <div v-for="card in legacyRowCards" :key="card.name"
                           class="con-start__buycard"
                           :data-legacy-card="card.name">
                        <Card :card="card" :key="card.name" lightweight />
                      </div>
                    </div>
                    <div class="con-start__buy-meta">
                      <span class="con-start__buy-cap">{{ $t('Legacy') }} · <b>{{ legacyRowCards.length }}</b></span>
                      <span class="con-start__buy-amount con-start__legacy-note">{{ $t('Carried from the previous mission') }}</span>
                      <div v-if="isFocused('legacy', LEGACY_KEY)" class="con-start__slot-a">
                        <GamepadGlyph control="confirm" /><span>{{ $t('Receive') }}</span>
                      </div>
                    </div>
                  </div>
                </transition-group>
              </div>

              <!-- ── THE RISK STAGE ────────────────────────────────────────
                   The player pressed A on a prelude whose effect cannot
                   resolve. NOTHING was sent, nothing moved, no empty picker
                   opened — this is the same workspace one state deeper, and
                   the cards it is about (the waiting one, amber-ringed; every
                   prelude that could open it, amber-tied) stay on screen
                   behind it.

                   It is ABSOLUTELY POSITIONED over the queue column's own
                   slack: entering and leaving the stage must not move the
                   cards the player is reading. It carries the two things the
                   rail cannot — WHAT is missing (the heading) and WHAT COULD
                   STILL FIX IT (the body, with the enabling prelude named
                   only when there is exactly one). The verb of the press
                   lives in the ONE command bar, as everywhere else. -->
              <transition name="con-start-risk">
                <div v-if="riskStage !== undefined" class="con-start__risk"
                     :class="'con-start__risk--' + riskStage.tone"
                     data-start-risk>
                  <div class="con-start__risk-head">
                    <span class="con-start__risk-flag" aria-hidden="true">⚠</span>
                    <span class="con-start__risk-title">{{ $t(riskStage.title) }}</span>
                  </div>
                  <div class="con-start__risk-body">{{ riskBodyText }}</div>
                </div>
                <!-- …and the RESULT of having gone through with it. The card
                     played with the ordinary physical animation (it is a
                     normal play in every other respect), so all this adds is
                     the one honest word about what happened — briefly, on the
                     same chassis, with no delta chips for an effect that never
                     ran and no picker for a target that never existed. -->
                <div v-else-if="effectLostShown" class="con-start__risk con-start__risk--lost"
                     data-start-effect-lost>
                  <div class="con-start__risk-head">
                    <span class="con-start__risk-title">{{ $t('Effect lost') }}</span>
                  </div>
                </div>
              </transition>

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
            <div v-embed-zone class="con-start__embed" data-embed-slot="start"
                 :class="{
                   // ROOM classes ride `…OwnsRoom` (staging + standing), the
                   // PANELS mount at `standing` only: the seat then wears its
                   // hero width from the flight's FIRST aim (no post-landing
                   // resize) and the briefing materializes around the settled
                   // card — two beats, never a chord over a flying card.
                   'con-start__embed--live': embedPresenting || firstActionOwnsRoom || bonusActionOwnsRoom,
                   'con-start__embed--sourced': embedSourceVisible !== undefined,
                   // THE HERO SIZE BELONGS TO THE BRIEFING, NOT TO THE STAGE.
                   // While the briefing is what the player is looking at, the
                   // corporation IS the subject and fills the room. The moment
                   // its action opens a step (the drawn preludes), the SUBJECT
                   // MOVES to those cards and the card becomes context again —
                   // a hero-sized context covers the receiving zone and the
                   // «РАЗЫГРАНО» shelf, which is exactly what it did.
                   'con-start__embed--firstact': firstActionOwnsRoom,
                   'con-start__embed--bonusact': bonusActionOwnsRoom,
                   // …and the zone STOPS at the shelf's peeking band, so the
                   // seat and its plate are laid out ABOVE «РАЗЫГРАНО»
                   // instead of over it. One bit drives both the shelf's
                   // pose and this reservation — they cannot disagree.
                   'con-start__embed--shelfstage': shelfOnStage,
                 }">
              <div v-if="embedSourceVisible !== undefined" class="con-start__embedsource" ref="embedSourceCol"
                   :class="{'con-start__embedsource--departing': embedSourceDeparting}">
                <span class="con-start__embedsource-cap">{{ $t('Source') }}</span>
                <div class="con-start__embedsource-card"
                     :class="{'con-deal-hold': embedSourceArriving}"
                     :data-start-seat-card="embedSourceVisible"
                     :data-reaction-home="embedSourceVisible"
                     data-embed-source-slot>
                  <!-- The LIVE capsule (TR81): a corporation answering its own first action lays its tokens HERE —
                       the count is the committed one minus what is still in the air, ticking on each touchdown. -->
                  <ConsolePlayedCardLite :name="embedSourceVisible" :card="seatCapsuleModel" />
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
              <!-- THE «ЭФФЕКТЫ» ROOM (R3 — TR81): the briefing's «Сработает» row is the DOOR of the effects layer,
                   a LEVEL inside this stage (the forecast's law 9 — the stages' own phrase, `consoleForecastHost.ts`):
                   the briefing parks in place (`data-forecast-browse`), the explorer unfolds out of the row into the
                   room beside the seat, B / R3 fold it back; the seat stays — the corporation is what it is about.
                   THE QUEUE'S DOOR (P79 · DI) opens the SAME layer in the queue's own space: the room becomes the lane
                   beside the focused prelude (`queueFxLane`, measured at the press), the prelude stands as the hero,
                   its neighbours and the shelf park on the phrase's own timeline, and the panel grows up OUT of the
                   status rail's row. -->
              <!-- THE PRELUDE'S «ВАРИАНТ» STEP (P44 · ledger EQ) — the branch chosen BEFORE the press, in the lane beside the
                   prelude it is about (the forecast door's own geometry, `startQueueFxLane`): the queue's other blocks
                   and the shelf recede, the card stays. A on a row chooses AND plays (one batch — the pick and the
                   addressed answer); B returns to the queue with nothing sent. -->
              <transition name="con-start-firstact">
                <div v-if="variantStep !== undefined" class="con-start__variant" data-start-variant
                     :style="variantLane !== undefined ? {'--con-start-qfx-l': variantLane.left + 'px', '--con-start-qfx-r': variantLane.right + 'px'} : undefined">
                  <ConsolePreludeVariantStep :variant="variantStep" :focus="variantFocus" :sealed="variantSealed" :forecast="variantForecast" @pick="onVariantPick" />
                </div>
              </transition>
              <div class="con-start__fxhost" data-forecast-host
                   :class="{
                     'con-start__fxhost--queue': queueFxLane !== undefined && !firstActionPanelShown,
                     'con-start__fxhost--narrow': queueFxLane !== undefined && !firstActionPanelShown && queueFxLane.narrow,
                   }"
                   :style="queueFxLane !== undefined && !firstActionPanelShown ? {'--con-start-qfx-l': queueFxLane.left + 'px', '--con-start-qfx-r': queueFxLane.right + 'px'} : undefined">
              <ConsoleForecastLayer ref="forecastLayer"
                                    host="start"
                                    :operation="firstActionPanelShown ? 'action' : 'play'"
                                    :forecast="startForecast"
                                    :branches="startForecastBranches"
                                    :cards="playerView.thisPlayer?.tableau ?? []"
                                    :color="playerView.thisPlayer?.color ?? ''"
                                    :players="playerView.players"
                                    :statsByColor="startForecastStats" />
              <transition name="con-start-firstact">
                <div v-if="firstActionPanelShown" class="con-start__firstact"
                     :class="{
                       'con-start__firstact--ready': firstActionActionableNow,
                       'con-start__firstact--busy': state.firstAct.submitting || state.firstAct.stage === 'staging',
                     }"
                     data-forecast-browse>
                  <div class="con-start__firstact-head">
                    <span class="con-start__firstact-flag" aria-hidden="true">⚑</span>
                    <span class="con-start__firstact-kicker">{{ $t('Mandatory') }}</span>
                    <!-- NESTED IN THE BONUS WINDOW: the mandatory move IS
                         bonus action №1 («as your first action» and
                         «immediately take 2 actions» resolve to this one
                         press), so the stage wears the window's counter
                         instead of being a chapter of its own. -->
                    <span v-if="firstActionNested" class="con-start__firstact-bonusctx">
                      <span class="con-start__firstact-bonusctx-flag" aria-hidden="true">»</span>
                      <span>{{ $t('Bonus action') }}</span>
                      <b>{{ bonusActionIndexNow }}/{{ bonusActionGrantedNow }}</b>
                    </span>
                  </div>
                  <div v-if="firstActionNested" class="con-start__firstact-nestednote">
                    {{ $t('Mandatory first action of your corporation — it is taken as bonus action 1') }}
                  </div>
                  <div class="con-start__firstact-ask">{{ firstActionAskText }}</div>

                  <div v-if="firstActionEffects.length > 0" class="con-start__firstact-block">
                    <div class="con-start__firstact-cap">{{ $t('Result') }}</div>
                    <div class="con-start__firstact-chips">
                      <ActionEffectChip v-for="(eff, k) in firstActionEffects" :key="k" :effect="eff" />
                    </div>
                  </div>

                  <!-- WHAT THE TABLE ANSWERS (TR81 — the preview carries the forecast, law 8): «Сработает» with the
                       R3 key — the door of the «Эффекты» layer. Lotus Innovations answers its own «+2 TR» here. -->
                  <div v-if="firstActionForecastShown" class="con-start__firstact-answer" data-start-firstact-forecast>
                    <ConsoleForecastRow class="con-start__firstact-forecast" :class="{'con-forecast--descend': forecastPulse}"
                                        :forecast="firstActionForecast" @open="openFirstActionForecast()" />
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


                  <!-- «С КАРТЫ „ФОРА"» — the ordering choice as its OWN zone.
                       Visually a separate inset panel (never confusable with
                       the action CTA below): the caption names the SOURCE
                       CARD, the M€ row prints its FORMULA (the player's
                       ordering decision depends on understanding that playing
                       cards shrinks the claim and drawing grows it), and the
                       tail line says what happens if they skip it. -->
                  <div v-if="stageGainRows.length > 0" class="con-start__gains">
                    <div class="con-start__gains-cap">
                      <i class="con-start__gains-cap-glyph" aria-hidden="true"></i>
                      <span>{{ stageGainsCaption }}</span>
                      <span class="con-start__gains-hint">
                        <GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span>
                      </span>
                    </div>
                    <button v-for="(g, i) in stageGainRows" :key="g.index"
                            type="button"
                            class="con-start__gainrow"
                            :data-gain-row="g.resource"
                            :class="{'con-start__gainrow--focused': stageFocusIdx === i}"
                            @click="claimStageGain(g)">
                      <span class="con-start__gainrow-take">
                        <!-- ONE «A» ON SCREEN, AND A BOX THAT NEVER MOVES.
                             The glyph is ALWAYS in the DOM — a `v-if` here
                             re-fitted the row on every focus change, and a
                             shrink-to-fit panel re-fitted with it (the whole
                             plate visibly jumped). Only the FOCUSED control
                             paints it: two lit A's read as two different
                             presses, which is exactly how a claim happened
                             by accident. -->
                        <GamepadGlyph control="confirm" class="con-start__gainrow-glyph"
                                      :class="{'con-start__gainrow-glyph--idle': stageFocusIdx !== i}" />
                        <span class="con-start__gainrow-verb">{{ $t('Claim now') }}</span>
                      </span>
                      <b class="con-start__gainrow-amount">{{ g.amount }}</b>
                      <i class="resource_icon con-start__gainrow-icon"
                         :class="g.resource === 'steel' ? 'resource_icon--steel' : 'resource_icon--megacredits'"
                         aria-hidden="true"></i>
                      <span v-if="g.perCardInHand !== undefined" class="con-start__gainrow-formula">
                        {{ gainFormulaText(g) }}
                      </span>
                    </button>
                    <div class="con-start__gains-tail">{{ $t('Not claimed — arrives by itself after the actions') }}</div>
                  </div>
                  <!-- The STATE ZONE — one reserved row, so waiting → ready is
                       a paint change on a standing panel, never a re-layout.
                       The rise (staging) keeps it QUIET: a wait line under a
                       card that is still travelling would name a state the
                       player is not in. -->
                  <div class="con-start__firstact-state">
                    <div v-if="firstActionActionableNow" class="con-start__firstact-cta"
                         :class="{'con-start__firstact-cta--focused': stageCtaFocused}">
                      <GamepadGlyph control="confirm" class="con-start__firstact-cta-glyph"
                                    :class="{'con-start__firstact-cta-glyph--idle': !stageCtaFocused}" />
                      <span class="con-start__firstact-cta-label">{{ $t('Take first action') }}</span>
                    </div>
                    <div v-else-if="state.firstAct.submitting" class="con-start__firstact-wait con-start__firstact-wait--busy">
                      <span class="con-start__firstact-wait-text">{{ $t('Executing') }}…</span>
                    </div>
                    <div v-else-if="state.firstAct.stage === 'standing'" class="con-start__firstact-wait">
                      <span class="con-start__firstact-pulse" aria-hidden="true"><i></i><i></i><i></i></span>
                      <span class="con-start__firstact-wait-text">{{ firstActionWaitLine }}</span>
                    </div>
                  </div>
                </div>
              </transition>
              </div>

              <!-- ── THE BONUS WINDOW — the overview of «Фора»'s grant ──────
                   The SEAT holds the granting prelude for the window's whole
                   life (the sub-stage borrows it for the corp and hands it
                   back), the PLAN names the window's actions so «1/2» is
                   never an unexplained number, the GAINS zone carries the
                   ordering choice, and the one CTA states where the next
                   press goes. It does NOT title itself — the crumb reads
                   «СТАРТ ПАРТИИ › ФОРА › ДЕЙСТВИЕ». -->
              <transition name="con-start-firstact">
                <div v-if="bonusActionPanelShown" class="con-start__bonusact"
                     :class="{
                       'con-start__bonusact--ready': bonusActionBarState === 'ready',
                       'con-start__bonusact--busy': state.bonusAct.stage === 'staging',
                     }">
                  <div class="con-start__bonusact-head">
                    <span class="con-start__bonusact-flag" aria-hidden="true">»</span>
                    <span class="con-start__bonusact-kicker">{{ $t('Bonus actions') }}</span>
                    <b v-if="bonusActionGrantedNow > 0" class="con-start__bonusact-count"
                      >{{ bonusActionIndexNow }}/{{ bonusActionGrantedNow }}</b>
                  </div>
                  <div class="con-start__bonusact-ask">{{ bonusActionAskText }}</div>

                  <!-- THE PLAN — only when the window CONTAINS the corp's
                       mandatory move; a free-only window needs no list. -->
                  <div v-if="bonusPlan.length > 0" class="con-start__plan">
                    <div v-for="(item, i) in bonusPlan" :key="item.key"
                         class="con-start__planrow"
                         :class="'con-start__planrow--' + item.state">
                      <span class="con-start__planrow-num">{{ i + 1 }}</span>
                      <span class="con-start__planrow-mark" aria-hidden="true">{{ item.state === 'done' ? '✓' : '' }}</span>
                      <span class="con-start__planrow-label">{{ $t(item.label) }}</span>
                      <span v-if="item.corp !== undefined" class="con-start__planrow-corp">{{ $t(item.corp) }}</span>
                    </div>
                  </div>
                  <div v-else class="con-start__bonusact-note">{{ $t('These actions are extra — they do not use up your normal turn.') }}</div>
                  <div class="con-start__bonusact-note con-start__bonusact-note--warn">
                    <span class="con-start__bonusact-note-glyph" aria-hidden="true">⚠</span>
                    <span>{{ $t('You cannot pass or end your turn until they are spent.') }}</span>
                  </div>

                  <!-- «С КАРТЫ „ФОРА"» — the ordering choice as its OWN zone.
                       Visually a separate inset panel (never confusable with
                       the action CTA below): the caption names the SOURCE
                       CARD, the M€ row prints its FORMULA (the player's
                       ordering decision depends on understanding that playing
                       cards shrinks the claim and drawing grows it), and the
                       tail line says what happens if they skip it. -->
                  <div v-if="stageGainRows.length > 0" class="con-start__gains">
                    <div class="con-start__gains-cap">
                      <i class="con-start__gains-cap-glyph" aria-hidden="true"></i>
                      <span>{{ stageGainsCaption }}</span>
                      <span class="con-start__gains-hint">
                        <GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span>
                      </span>
                    </div>
                    <button v-for="(g, i) in stageGainRows" :key="g.index"
                            type="button"
                            class="con-start__gainrow"
                            :data-gain-row="g.resource"
                            :class="{'con-start__gainrow--focused': stageFocusIdx === i}"
                            @click="claimStageGain(g)">
                      <span class="con-start__gainrow-take">
                        <!-- ONE «A» ON SCREEN, AND A BOX THAT NEVER MOVES.
                             The glyph is ALWAYS in the DOM — a `v-if` here
                             re-fitted the row on every focus change, and a
                             shrink-to-fit panel re-fitted with it (the whole
                             plate visibly jumped). Only the FOCUSED control
                             paints it: two lit A's read as two different
                             presses, which is exactly how a claim happened
                             by accident. -->
                        <GamepadGlyph control="confirm" class="con-start__gainrow-glyph"
                                      :class="{'con-start__gainrow-glyph--idle': stageFocusIdx !== i}" />
                        <span class="con-start__gainrow-verb">{{ $t('Claim now') }}</span>
                      </span>
                      <b class="con-start__gainrow-amount">{{ g.amount }}</b>
                      <i class="resource_icon con-start__gainrow-icon"
                         :class="g.resource === 'steel' ? 'resource_icon--steel' : 'resource_icon--megacredits'"
                         aria-hidden="true"></i>
                      <span v-if="g.perCardInHand !== undefined" class="con-start__gainrow-formula">
                        {{ gainFormulaText(g) }}
                      </span>
                    </button>
                    <div class="con-start__gains-tail">{{ $t('Not claimed — arrives by itself after the actions') }}</div>
                  </div>

                  <!-- The STATE ZONE — one reserved row, so waiting → ready is
                       a paint change on a standing panel, never a re-layout. -->
                  <div class="con-start__bonusact-state">
                    <div v-if="bonusActionBarState === 'ready'" class="con-start__bonusact-cta"
                         :class="{'con-start__bonusact-cta--focused': stageCtaFocused}">
                      <GamepadGlyph control="confirm" class="con-start__bonusact-cta-glyph"
                                    :class="{'con-start__bonusact-cta-glyph--idle': !stageCtaFocused}" />
                      <template v-if="bonusOverviewVerb === 'firstAction'">
                        <span class="con-start__bonusact-cta-label">{{ $t('Go to the first action') }}</span>
                        <span class="con-start__bonusact-cta-tail">{{ $t('inside this workspace') }}</span>
                      </template>
                      <template v-else>
                        <span class="con-start__bonusact-cta-label">{{ $t('Go to the board') }}</span>
                        <span class="con-start__bonusact-cta-tail">{{ $t('you will come back here') }}</span>
                      </template>
                    </div>
                    <div v-else class="con-start__bonusact-wait">
                      <span class="con-start__firstact-pulse" aria-hidden="true"><i></i><i></i><i></i></span>
                      <span class="con-start__bonusact-wait-text">{{ $t('Preparing') }}…</span>
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
        <!-- …and BEFORE any press the rail is where a waiting prelude's
             situation is SAID: the sentence sits under the badge that marks
             it, so the player reads the whole thing without pressing anything.
             Once the RISK STAGE is up the stage owns that sentence and the
             rail's chip goes quiet — one voice per statement, never the same
             warning printed twice on one screen. -->
        <div v-if="mode === 'ceremony' && ceremonyRevealed"
             class="con-start__statusrail" :class="[ceremonyRailClass, {'con-start__statusrail--stepped': colonyStep || sponsorStep}]">
          <div class="con-start__status-inner">
            <span class="con-start__status-name" :key="ceremonyStatusName">{{ ceremonyStatusName }}</span>
            <span v-if="ceremonyStatusText !== ''" class="con-start__status-state">{{ ceremonyStatusText }}</span>
            <!-- WHAT THE TABLE ANSWERS to the focused Prelude's play (TR82 — the play preview carries the forecast, law
                 8): «Сработает» with the R3 key — the DOOR of the «Эффекты» layer (law 9). Proteus answers the second
                 Prelude whose tag matches the first here, before the press. The ONE place of the answer on the scene
                 (P79 · DI): the rail's right end — a quiet tracked-caps kicker, the chips louder than it, the ONE R3
                 key last; it never shrinks (the name and the state give way first). -->
            <span v-if="queueForecastShown" class="con-start__status-answer" data-start-prelude-forecast :key="'fx' + (queueForecastCard ?? '')">
              <ConsoleForecastRow class="con-start__prelude-forecast" :class="{'con-forecast--descend': forecastPulse}"
                                  :forecast="queueForecast" @open="openQueueForecast()" />
            </span>
          </div>
        </div>

        <div v-if="mode === 'wizard' && currentStep !== undefined"
             class="con-start__statusrail"
             :class="[statusRailClass, {'con-start__statusrail--veiled': tenderViewOwnsScreen || restructureCovers}]">
          <!-- The rail's HEIGHT is reserved for the whole card step; only its
               CONTENT is hidden until the FOCUS COMMIT (--held: opacity, never
               an unmount) — so the card area never resizes / jumps when the
               rail's text appears. The hold covers the WHOLE uncommitted
               window (`railCommitted` = stage transition settled + deal not
               holding), and it lands INSTANTLY (no fade-out — see the CSS):
               the commit frame of a stage change must never paint the next
               step's card name, not even for one transition tick. Content
               itself derives from the gated `railCard`, so name+availability+
               state publish atomically at the commit and the release fade
               reveals the right payload. The inner is PERSISTENT: a d-pad move
               only re-keys the NAME (a one-shot settle) — the state chip
               («Выберите ещё N») patches in place and never blinks (the old
               wholesale keyed out-in faded the whole rail on every move). -->
          <!-- (The LEGACY OVERVIEW holds the rail's CONTENT the same way the
               focus-commit does: the box stays — nothing above it may move —
               while the payload speaks about a card that is not on stage.) -->
          <div class="con-start__status-inner"
               :class="{'con-start__status-inner--held': !railCommitted || legacyStageOwnsScreen || tenderViewOwnsScreen || restructureCovers}">
            <!-- THE FOCUSED CARD'S AVAILABILITY — the SAME block the draft
                 workspace pins under its spread (ConsoleCardAvailabilityPanel,
                 compact) built by the SAME shared model in the SAME DRAFT
                 voice: the starting hand is bought FOR LATER, so only the
                 PRINTED REQUIREMENTS speak — amber «пока не выполнено» while
                 the game can still get there, red «уже не выполнить» only
                 where the server could prove it. Money says nothing here (the
                 funds chip on the right is the economy's one voice).
                 It carries the card's NAME itself, so the rail never states it
                 twice. ONE ROW at the rail's one fixed height (the shared
                 card-status token): the reason speaks the compact counter
                 form («Метки 1/3»), the full sentence lives in fullscreen —
                 so the rail can never resize the cards above it, whatever
                 the focused card has to say (`stepShowsAvailability` only
                 picks which CONTENT stands here, never a different box). -->
            <ConsoleCardAvailabilityPanel v-if="railShowsAvailability"
                                          class="con-start__status-avail"
                                          :key="railCard ? railCard.name : 'none'"
                                          variant="compact"
                                          :view="focusedAvailability"
                                          :cardTitle="railCard ? $t(railCard.name) : undefined"/>
            <span v-else class="con-start__status-name"
                  :key="railCard ? railCard.name : 'none'">{{ railCard ? $t(railCard.name) : '' }}</span>
            <span v-if="statusRailText !== ''" class="con-start__status-state"
                  :key="'st' + blockedNudge">{{ statusRailText }}</span>
            <!-- The ONE quick summary (workspace status-rail grammar): the
                 live economy in a compact chip — funds on the identity steps,
                 the full buy line on the projects step. The deep breakdown
                 belongs to the summary's status preview, never up here. -->
            <span v-if="budget !== undefined && !ledgerShown" class="con-start__status-quick"
                  :class="{'con-start__status-quick--broke': budget.remaining + budget.preludes < 0}">
              <template v-if="!moneyCompact">
                <span class="con-start__status-quick-part con-price-hint" data-purchase-price :data-hint="startPriceHint">{{ $t('Projects') }} {{ budget.buys }} × {{ budget.cardCost }}</span>
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
        <!-- CAMPAIGN missions 2+: the acquired corporations AND the carried
             projects ride the SAME shelf row as the prepared piles — separate
             «НАСЛЕДИЕ» / «ПРОЕКТЫ НАСЛЕДИЯ» blocks after every pile type,
             costing the candidate strip zero space. R3 (every wizard page)
             descends into the LEGACY OVERVIEW, whose card flights lift out
             of these very tiles. -->
        <ConsoleStartSelectionDock v-if="prepSurfaceLive" :piles="dockPileView"
                                   :lineage="lineageDock"
                                   :carried="carriedDock"
                                   :lineage-hint="legacyOverviewAvailable"
                                   :tenders="dockTenders"
                                   :stamped="dockStamped"
                                   :tender-door="tenderDoorAvailable"
                                   :tender-ready="tenderReadyCount"
                                   :held-tenders="tenderDockHeld" :ready-tenders="tenderReadyInstances"
                                   :active-tender="state.tenderMode?.instance"
                                   :plated="tenderPlate !== undefined"
                                   :held-names="legacyDockHeld"
                                   @inspect-lineage="openLegacyOverview($event)">
          <!-- A TENDER'S MODE PLATE (§19): the standing tender's identity, what it gives in live numbers, the request's
               tags — on the shelf's row, never a row over the deal (the deal's size and layout stay the player's). -->
          <template #plate>
            <div v-if="tenderPlate !== undefined" class="con-tplate" data-tender-plate
                 :data-tender-plate-kind="tenderPlate.kind" :data-tender-plate-id="tenderPlate.id">
              <div class="con-tmini con-tmini--active"><ConsoleTenderCard :id="tenderPlate.id" size="table" state="held" /></div>
              <div class="con-tplate__id">
                <span class="con-tplate__cap">{{ $t('Tender') }}</span>
                <span class="con-tplate__name">{{ $t(tenderNameOf(tenderPlate.id)) }}</span>
              </div>
              <span class="con-tplate__divider" aria-hidden="true"></span>
              <div v-if="tagMode !== undefined" class="con-tplate__tags" data-tender-mode="tag">
                <!-- Each medallion wears the deck's own number (server-counted): a tag with NO card is disabled with its
                     reason on the bar, a tag short of three shows what it has. The focused one's NAME is the plate's line. -->
                <div v-for="(tag, i) in requestTags" :key="tag"
                     class="con-tagpick__chip con-tagpick__chip--plate"
                     :class="{
                       'con-tagpick__chip--focused': focusIdx === i,
                       'con-tagpick__chip--picked': tagMode.tag === tag,
                       'con-tagpick__chip--off': requestTagCount(tag) === 0,
                       'con-tagpick__chip--short': requestTagCount(tag) > 0 && requestTagCount(tag) < 3,
                     }"
                     :data-tender-tag="tag" :data-tender-tag-count="requestTagCount(tag)"
                     :data-tender-tag-off="requestTagCount(tag) === 0 ? 'yes' : undefined"
                     :data-tender-mode-picked="tagMode.tag === tag ? 'yes' : undefined">
                  <i class="con-tagpick__icon" :style="tagIconStyle(tag)" aria-hidden="true"></i>
                  <b class="con-tagpick__count">{{ requestTagCountText(tag) }}</b>
                </div>
              </div>
              <span class="con-tplate__reading" :class="{'con-tplate__reading--busy': state.tenderBusy !== undefined}" data-tender-plate-reading>{{ tenderPlate.reading }}</span>
            </div>
          </template>
        </ConsoleStartSelectionDock>

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
                          :cards="deal.state.cards" :models="dealModels" :nonce="deal.state.nonce" />
  </div>
</template>

<script setup lang="ts">
/*
 * THE GAME START WORKSPACE. One root, two bounds of one surface:
 *        · PREPARATION — full-bleed (the standard Top Bar and the Player Rail
 *          are hidden: the player has no game state yet), the frame is a real
 *          bounded workspace plate on an opaque premium room;
 *        · DEPLOYMENT (`--bounded` + the `con-ws` marker) — the SYSTEM
 *          workspace band: right of the player rail, between the two bars,
 *          on the shared seam tokens (--con-ws-left / --con-band-*). The
 *          `con-ws` marker lifts + rings the rail exactly like every other
 *          workspace of the family — never a hand-measured inset.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {campaignFinalePicksCorporation} from '@/common/campaign/CampaignTypes';

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
import {cursorEnsureVisible, scrollContainerOf} from '@/client/console/cursorScroll';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel, SelectCardModel, SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {$t, translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction, ConsoleActionOverrides} from '@/client/console/composables/consoleActionModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {gateCursorUntilAnimationsEnd} from '@/client/console/cursorArrival';
import {ConsoleTask, startPlacementOrderOf, startStepDiscardOf, taskFor} from '@/client/console/consoleTaskRouter';
import {
  buildInitialCardsResponse, campaignWizardExtra, clearDockDrift, committedStartJourneyItems, consoleStartState, deploymentCrumb, deploymentJourneyItems,
  driftDockPile, ensureStartWizard, holdStartScene, initialCardsInputOf, initialCardsSignature,
  markStartDeploymentBegun, setStartCampaignCorpStage, startAwaitingOthers, startDeploymentBegun,
  picksForStep, releaseStartScene, setStartHeroPlaying, StartCrewMate, StartCrumb, StartDockPileModel, startFlowBusy,
  StartLaunchState, StartParticipant, startDockPiles, startJourneyItems, startLaunchState, startRailCommitted,
  sponsorCrumb, startCardAvailability, startParticipants, StartWizardStep, stepComplete,
  stepShowsAvailability, wizardCrumb, wizardSteps,
  armStartRedealRestore, restoreStartPicksAfterRedeal, startCardPrice, StartTenderMode, StartWizardStepId,
  abandonStartSceneRelease, beginFirstActSubmit, beginStartSceneRelease, completeStartSceneRelease, endFirstActSubmit,
} from '@/client/console/consoleStartState';
import {buildStartStatusPreview, StartStatusPreview} from '@/client/console/startStatusPreview';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {afterPreludes, cardCostForCorp, startingMegacredits} from '@/client/components/initialDraft/initialDraftMoney';
import {purchasePriceHint, startPurchasePriceSource} from '@/client/console/purchasePriceSource';
import {
  bonusActionGains, bonusActionGranted, bonusActionIndex, bonusActionNestedFirstAction,
  bonusActionOnBoard, bonusActionOwed, bonusActionsDeclaredBy,
  bonusActionSource, BonusGainRow,
} from '@/client/console/bonusAction';
import {beginHoldConfirm, cancelHoldConfirm} from '@/client/console/consoleHoldConfirm';
import {armDeferredDiscards, deferredDiscardKey} from '@/client/console/deferredDiscardFresh';
import {
  isPreludeEnabler, preludeBadge, preludeEnablerBadge, PreludeRisk, preludeRisk,
} from '@/client/console/startPreludeRisk';
import {PreludeOutlook} from '@/common/cards/PreludeOutlook';
import {
  corpActionOptionIndexFor, corporationCardNames, PreludeEntry, preludeEntries, recordDrawChoice,
  startFlowBonusPrompt, startFlowCorpPayPrompt, startFlowCorpPlayPrompt, startFlowCorpPrompt, startFlowCorpSelectPrompt,
  startFlowLegacyPrompt, startFlowCompensationPrompt, startFlowMergePrompt,
  startFlowPreludeCopyPrompt, startFlowPreludeDrawPrompt, startFlowPreludePrompt,
} from '@/client/components/startGameFlow/startGameFlowState';
import {
  firstActionActionable, firstActionAsk, firstActionBranch, firstActionCandidates as firstActionCandidatesOf, firstActionDrawExpected,
  firstActionOwed, firstActionPreviewable, firstActionStageCorp, startFlowOtherPromptStands,
  startWaitMate,
} from '@/client/console/startFirstAction';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {NextStepRow, noteRow, placementRow} from '@/client/console/consolePlacementNextStep';
import {delegateGrantFollowUpRow, nextRowText} from '@/client/console/consolePlayCardComposer';
import {consoleTranslate} from '@/client/console/consoleTranslate';
import {tileIconStyle} from '@/client/console/consoleTileIcon';
import {gameStateVersion} from '@/client/console/gameStateVersion';
import {
  armPlayedHero, isPlayedHeroActive, playedHeroHolding, playedHeroState,
} from '@/client/console/played/consolePlayedHero';
import {
  descendRecede, descendReturn, guardedDescend,
} from '@/client/console/surfaceMotion/workspaceDescend';
import ConsoleStartPlayedDock from '@/client/components/console/ConsoleStartPlayedDock.vue';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';
import {
  claimWorkspaceOutcome, markWorkspaceOutcomeAnswerIn, markWorkspaceOutcomeBeatDone, markWorkspaceOutcomePresenting,
  releaseWorkspaceOutcome, retractWorkspaceOutcomeSlot, setWorkspaceOutcomeSlot, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {claimPlayOutcome, playOutcomeZone, playOwesTargetPick} from '@/client/console/played/consolePlayOutcomeClaim';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {deckDrawHolds} from '@/client/console/deckDraw/consoleDeckDraw';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive} from '@/client/console/handDock/handDeliveryDirector';
import {captureCards, CapturedFlight, returnFromDock, reseatCards, registerStartDockLayer, resetStartDockMotion, convoyBeats, liveFlightProxies, DockFlightSource, parkSurface, unparkSurface, clearSurfaceParking, measureTargets, pressPile, riseToSeats, RiseConvoy, slideIntoLayout, GlidePair, cardRectNow, Rect} from '@/client/console/startDockMotion';
import ConsoleTenderActivation, {ActivationTag} from '@/client/components/console/campaign/ConsoleTenderActivation.vue';
import {ActivationFacts, TenderActivationPlan, startActivationPlan, tagGridCols} from '@/client/console/campaign/tenderActivation';
import {FACE_DOWN_DEG, FACE_UP_DEG} from '@/client/console/cardFlight/card3dInner';
import {isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {
  setWorkspaceFrameSlot, setWorkspaceFrameSubject, workspaceFrameHasNested, workspaceFrameHost,
  workspaceFramePhase, workspaceFrameSubject, workspaceStackCrumb,
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
import type {RailReward} from '@/client/console/resourceTransfer/railReward';
import {playRailReward, startPlaySpendReward, withRailAnswerTags} from '@/client/console/consoleActionCommit';
import {railAnswerTags, ratingAnswerSpecs} from '@/client/console/played/receivingStageModel';
import {reactionRailSpecs} from '@/client/console/colonyTrade/fleetDockModel';
import {ForecastBranchInfo, forecastForFixedBranch, forecastLayerAvailable, forecastRowPresent} from '@/client/console/effectForecastModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {TransferEnd} from '@/client/console/resourceTransfer/resourceTransferModel';
import ConsoleForecastRow from '@/client/components/console/ConsoleForecastRow.vue';
import ConsoleForecastLayer from '@/client/components/console/ConsoleForecastLayer.vue';
import ConsolePreludeVariantStep from '@/client/components/console/foundation/ConsolePreludeVariantStep.vue';
import {InputResponse} from '@/common/inputs/InputResponse';
import {
  firstAvailableRow, PreludeVariant, preludePreStepStage, preludeVariantAnswer, preludeVariantOf, preludeVariantReading, preludeVariantRowOf,
  preludeVariantStepResponses, stepVariantFocus, placementOrderStepOf, placementOrderAnswer, PLACEMENT_ORDER_STAGE,
  placementOrderStageParams, preludeForecastBranches, preludePlayForecast,
} from '@/client/console/preludeVariant/preludeVariantModel';
import {closeEffectForecastLayer, effectForecastOpen, forecastExplorerUi, forecastStageText} from '@/client/console/consoleEffectForecast';
import {
  foldForecastHost, forecastHostIntent, forecastOwnerColors, forecastStatsByColor, openForecastHost, pulseForecastDoor,
} from '@/client/console/consoleForecastHost';
import {
  armFirstActionRail, firstActionRailBusy, firstActionRailOf, firstActionRailState, flyFirstActionRail, releaseFirstActionRail,
} from '@/client/console/startFirstActionRail';
import {ReactorEmergence, cardReactionAnswerFlight, markReactionCause} from '@/client/console/cardReaction/cardReactionDirector';
import {buriedUnderAnotherCard, liftInPlace, placeShowsCard, settleInPlace} from '@/client/console/cardReaction/reactorPlaces';
import {
  observedStartQueueBox, observeStartQueueBox, releaseStartQueueBox, retireStartReactorPlace, standStartReactorPlace,
} from '@/client/components/console/consoleStartSceneState';
import {transferEndVerdict} from '@/client/console/resourceTransfer/transferEndVisible';
import {probeTick} from '@/client/console/probeTick';
import {beginCeilingWait} from '@/client/console/waitGraph/ceilingWait';
import {cardReactionState} from '@/client/console/cardReaction/cardReactionStage';
import {reactionTempo} from '@/client/console/cardReaction/cardReactionModel';
import {heldCardCapsule} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {centreEndOf, iconMatches} from '@/client/console/consoleActionCommitMotion';
import {clearPanelRewardHold, releasePanelRewardHold, runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  armBonusGainClaim, awaitVisibleBonusGainSource, bonusGainRewardState, bonusGainSourceSelectors, consumeBonusGainReward,
} from '@/client/console/startBonusGain';
import {ActionEffect, ActionPreview} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {fetchPreview} from '@/client/utils/previewFetch';
import {cardsResponse} from '@/client/console/taskResponses';
import {setConsoleStartCommands, resetConsoleStartUi, startSceneCommands, startPressRefusal, StartCommand} from '@/client/console/consoleStartUi';
import {startServesOf, StartServes} from '@/client/console/startServing';
import {transportRequestInProgress} from '@/client/console/transport/gameTransport';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {applyDiscardExit, runHeroPick} from '@/client/console/cardDeal/cardExitDirector';
import {createCardDealSequence} from '@/client/console/cardDeal/cardDealSequence';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {StartQueueFxLane, StartQueueReading, startQueueFxLane, startQueueLayout, startQueueReading} from '@/client/console/startQueueLayout';
import ConsoleTenderPortfolio from '@/client/components/console/campaign/ConsoleTenderPortfolio.vue';
import ConsoleTenderChip from '@/client/components/console/campaign/ConsoleTenderChip.vue';
import ConsoleTenderCard from '@/client/components/console/campaign/ConsoleTenderCard.vue';
import {
  StartPortfolioContext, TenderPortfolioEntry, TenderStandingPage, tenderDoorList, tenderPageOf, tenderPortfolio,
  tenderPortfolioCounts, tenderReadyHere, tenderCardStateOf, tenderPortfolioName, tenderPressResponse,
  tenderRestructureResponse, tenderExchangeResponse, tenderTagResponse, tenderRestructureKeep,
} from '@/client/console/campaign/tenderPortfolio';
import {ALL_TAGS, Tag} from '@/common/cards/Tag';
import {tagIconStyle} from '@/client/components/premiumCard/premiumCardIcons';
import {tagLabel} from '@/client/cards/tagLabel';
import {tenderZoomEntry} from '@/client/components/card/cardZoomTypes';
import {TenderResponse} from '@/common/inputs/InputResponse';
import {TENDER_COMPENSATION_MC, TENDER_RESTRUCTURING_CANDIDATES, TENDER_TARGETED_REQUEST_CARDS, TenderId, isGambleTender} from '@/common/campaign/tenders';
import {CloneFlightHandle, flyCardClones} from '@/client/console/cardFlight/cloneFlights';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {candidateOutlook} from '@/client/console/deckPick/preludePick';
import {readingText} from '@/client/console/readingText';
import {nearestInDirection, rowFitZoom, gridFitPlan} from '@/client/console/consoleStartNav';
import {motionMs} from '@/client/components/motion/motionTokens';
import {holdForGsapAnimation} from '@/client/components/presentation/animationHold';
import ConsoleCardDealLayer from '@/client/components/console/cardDeal/ConsoleCardDealLayer.vue';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import {availabilityContextFor, CardAvailabilityView} from '@/client/console/cardAvailability';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';
import {noteTransferTrail} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {span} from '@/client/console/session/sessionWaits';
import {whenPainted} from '@/client/console/session/sessionWaits';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {vEmbedZone} from '@/client/directives/vDirectives';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

type Focusable = {kind: 'corp' | 'prelude' | 'candidate' | 'pay' | 'bonus' | 'legacy' | 'compensation', name: CardName, disabled: boolean};

/**
 * WHO OWNS THE SOURCE SEAT (docs/claude/console/start-first-action.md § THE
 * SEAT HAS ONE OWNER): the queue play's draw effect (`'effect'` — the source
 * card parks in the seat while its reveal presents), the first-action stage
 * (`'firstAction'` — the corporation of the briefing) or the «Фора» window
 * (`'bonus'` — the granting card). Every emerge / settle goes through the
 * seat funnel, which refuses a foreign owner: the claim's release may settle
 * only what the effect seated, never a stage's card.
 */
type SeatOwner = 'effect' | 'firstAction' | 'bonus';

/** One physical slot of the deployment queue. */
type QueueEntry = {
  name: CardName,
  kind: Focusable['kind'],
  verb?: string,
  badge?: string,
  badgeClass?: string,
  reason?: string,
  /** This card could open the FOCUSED one's waiting effect (the amber tie). */
  enabler?: boolean,
  dimmed: boolean,
  dealIdx: number,
  /** The reading line under the card (TRP0 · DE) — a corporation / prelude only. */
  reading?: StartQueueReading,
};

/** The card-payment beat's synthetic focus key (it is not a card). */
const PAY_KEY = '#pay' as CardName;

/** The campaign carried-cards beat's synthetic focus key. */
const LEGACY_KEY = '#legacy' as CardName;

/** The campaign comeback-bonus beat's synthetic focus key. */
const BONUS_KEY = '#bonus' as CardName;

/** The «КОМПЕНСАЦИЯ» plate's focus key (the «Тендеры» mode's last deployment stage). */
const COMPENSATION_KEY = '#compensation' as CardName;

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

/**
 * How long «ЭФФЕКТ ПОТЕРЯН» stands after a prelude played without its effect.
 * A statement, not a ceremony: long enough to read, short enough that the
 * deployment does not feel punished for a choice the player made on purpose.
 */
const EFFECT_LOST_BEAT_MS = 1800;

/** The legacy overview's phase machine. `fading` = the current page PARKS
 *  (parkSurface — it steps back into depth, the same retire-the-surface
 *  grammar every start transfer speaks); `entering` = the stage is up, the
 *  cards are RISING from their shelf tiles (riseToSeats); `open` =
 *  interactive; `leaving` = captureCards → impulse → flyTo home. Reversible
 *  and wizard-only by construction — the picks are never touched. */
type LegacyViewPhase = 'closed' | 'fading' | 'entering' | 'open' | 'leaving';

/** The stable delivery-hold key for a bought-cards set (name-derived, so it
 *  survives a reload mid-ceremony and matches between the summary-submit arm
 *  and the in-ceremony re-affirm). */
/**
 * WHICH DEAL a delivery hold belongs to. NOT an identity: the identity is the
 * delivery's ROLE (`'bought'` / `'legacy'`), and the director keys its
 * episodes on that. This only lets a re-arm tell "the same set, re-affirmed"
 * from "a different deal for this role" — using it as the identity is what let
 * the legacy delivery and the bought delivery reset each other mid-flight.
 */
function deliverySignature(names: ReadonlyArray<CardName>): string {
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

/** How long the start waits for its corporation's face to stand before the reactor rises at the stage instead. */
const START_REACTOR_FACE_WAIT_MS = 2400;

/** The deployment refuses a press while its destination is not ready / the funnel is busy (the input-absorb ledger). */
const START_PRESS_ABSORBER = 'start-press-refusal';

/** THE INPUT LOCK's gate on the ledger: a press while the start's motion director is busy (a dock flight, the summary's
 *  arrival, the commit round trip, the materialization) is a DELIBERATE swallow — noted, so a driver retries once the
 *  motion lets go instead of reading a screen that never saw the press (the e2e flake class ①, 2026-11-08). */
const START_FLOW_ABSORBER = 'start-flow-motion';

/** CAMPAIGN «ТЕНДЕРЫ» (§19): the door's list is moving (rise / fly home) or a tender's answer is on the wire. */
const TENDER_DOOR_ABSORBER = 'tender-door-motion';

defineOptions({name: 'ConsoleStartScene'});
const props = defineProps({
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
});
const emit = defineEmits(['submit', 'submit-batch', 'defer']);

const flow = useFlowScope('start-scene');
const queueEl = useTemplateRef<HTMLElement>('queueEl');
const summaryPane = useTemplateRef<HTMLElement>('summaryPane');
const body = useTemplateRef<HTMLElement>('body');
const frame = useTemplateRef<HTMLElement>('frame');
const forecastLayer = useTemplateRef<InstanceType<typeof ConsoleForecastLayer>>('forecastLayer');
const dealLayer = useTemplateRef<InstanceType<typeof ConsoleCardDealLayer>>('dealLayer');
const tenderDeck = useTemplateRef<HTMLElement>('tenderDeck');
const restructPane = useTemplateRef<HTMLElement>('restructPane');
const tenderSheetEl = useTemplateRef<{heroEl?: () => HTMLElement | undefined}>('tenderSheetEl');
const tenderPane = useTemplateRef<HTMLElement>('tenderPane');
const portfolio = useTemplateRef<{slotEl?: (instance: string) => HTMLElement | undefined}>('portfolio');
const legacyPane = useTemplateRef<HTMLElement>('legacyPane');
const focusedCardSlot = useTemplateRef<HTMLElement | Array<HTMLElement>>('focusedCardSlot');
const ceremonyBody = useTemplateRef<HTMLElement>('ceremonyBody');
const freezeHost = useTemplateRef<HTMLElement>('freezeHost');
const flowHost = useTemplateRef<HTMLElement>('flowHost');
const playedDockEl = useTemplateRef<{$el?: HTMLElement}>('playedDockEl');
const payGrid = useTemplateRef<HTMLElement>('payGrid');
const legacyGrid = useTemplateRef<HTMLElement>('legacyGrid');
const dockLayer = useTemplateRef<HTMLElement>('dockLayer');
const root = useTemplateRef<HTMLElement>('root');
const state = consoleStartState;
const focusIdx = ref(0);
/** Zero-projects submit armed (second A confirms — the skip warning). */
const armedSkip = ref(false);
/**
 * THE RISK STAGE — the prelude whose first A opened the «this cannot
 * resolve» stage. Raw latch only: what the scene renders and acts on is
 * {@link riskStage}, re-derived from the LIVE focus, so a navigation can
 * never leave a stale arm behind to fire on a card the player has since
 * walked away from.
 */
const riskArmed = ref<CardName | undefined>(undefined);
/** WHY the last deployment press was refused (`startPressRefusal`) — '' when it was honoured; a probe's witness. */
const pressRefusal = ref<string>('');
/** The input-absorb ledger's registration of the press-refusal gate (`inputAbsorb.ts`). */
let absorbOff: (() => void) | undefined;
let flowAbsorbOff: (() => void) | undefined;
let tenderAbsorbOff: (() => void) | undefined;
/**
 * The prelude the player COMMITTED knowing its effect would not happen.
 * Latched (not derived): by the time the beat is shown the card has left
 * the rail and the server no longer describes it — this is the only
 * record that the result the player is watching is a deliberate loss.
 */
const effectLostFor = ref<CardName | undefined>(undefined);
/** …and whether its short beat is on screen right now. */
const effectLostShown = ref(false);
let effectLostTimer: (() => void) | undefined;
/** A pressed on a limit-blocked card → the rail message replays its
 *  one-shot settle (restrained feedback; state never changes). */
const blockedNudge = ref(0);
/** RB pressed on an incomplete step → the pick counter replays its
 *  one-shot nudge (the header names what still gates the step). */
const counterNudge = ref(0);
/** THIS session showed the deferred corporationPlay prompt → a played
 *  corp has physically moved to the «Разыграно» table (see corpColumn). */
const sawCorpPlayPrompt = ref(false);
/** One-shot dev warn for a corp played with no corporationPlay prompt. */
const warnedCorpPrompt = ref(false);
/** The deal cinematic lifecycle (holds slots, flies proxies, skips). */
const deal = ref(createCardDealSequence());
let dealLaunchTimer: (() => void) | undefined;
/** Wizard-card fit (sets --con-cards-zoom / --con-cards-grid-zoom so the
 *  cards always fit BOTH axes → never scroll/clip on focus). Observers
 *  run it on resize; never per focus. */
/** VueUse stop-handles (auto-managed listeners; no raw addEventListener). */
let stopStripObs: (() => void) | undefined;
let stopBodyObs: (() => void) | undefined;
let stopResize: (() => void) | undefined;
const fitScheduled = ref(false);
const fitRetries = ref(0);
/** The post-frame-swap re-verify fit (out-in leaves no strip to measure
 *  at the watcher's nextTick). */
let fitTimer: (() => void) | undefined;
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
const playRewards = new Map<CardName, ReadonlyArray<ResourceTransferSpec>>();
/** The printed PRICE each start play takes off the rail — flown FIRST, before the result (P52 · FH). */
const playSpends = new Map<CardName, RailReward>();
/** Per pressable card: its play's RAIL HALF (PL-001 for plays) — the direct TR and the table's answer,
 *  read off the same preview; flown by the same beat after the gains above. */
const playRails = new Map<CardName, RailReward>();
/** Per pressable card: WHAT THE TABLE ANSWERS to its play (TR82 — the same preview's forecast, branch 0): the
 *  focused Prelude's «Сработает» row and its «Эффекты» layer read it. */
const playForecasts = ref(new Map<CardName, EffectForecast>());
/** THE QUEUE CARD'S ZOOM solved from the queue's box (TRP0 · DE — `startQueueLayout`); undefined until measured. */
const queueZoom = ref<number | undefined>(undefined);
/** Per pressable card: how many cards its play DRAWS (from the same
 *  preview branch) — the embed claim's `expectedCards`. */
const drawExpected = new Map<CardName, number>();
/** The played shelf has receded for an embedded step (its own half of
 *  the deployment's release — see `runPlayedDockRelease`). */
const playedDockReleased = ref(false);
/** The source card is LEAVING its seat for «РАЗЫГРАНО» — the caption
 *  dissolves with the departure, never after it. */
const embedSourceDeparting = ref(false);
/** In-flight / done prefetches (never re-request the same card WITHIN
 *  one game-state version — see `prefetchPlayRewards`). */
const rewardFetched = ref(new Set<CardName>());
/** The game-state version `playRewards` / `drawExpected` belong to. */
const rewardVersion = ref('');
/** The played-hero transaction (module reactive — the queue and the
 *  played zone derive their reserved slots from it). */
const heroState = playedHeroState;
/** The shared claim state (embed zone presence derives from it). */
const outcome = workspaceOutcomeState;
/** Slots whose card is FLYING BACK from a dock pile (held empty until
 *  its touchdown) — keys are `stepId|name`. */
const returningNames = ref(new Set<string>());
/** Summary tiles whose card is still arriving from its pile. */
const summaryArriving = ref(new Set<CardName>());
/** Queue slots whose card is still arriving (the summary re-seat / an
 *  extra prelude joining) — held empty until each touchdown. */
const queueArriving = ref(new Set<CardName>());
/** A dock flight is running — step navigation waits it out. */
const dockBusy = ref(false);
/** The live stage transition (module reactive — the ONE director; the
 *  rail, the input gate and the panes all read it, never a private
 *  boolean). The module state itself, under the name the template reads. */
const transition = startTransition;
/** The journey rail's directional impulse: a re-key that replays a
 *  one-shot connector sweep. NEVER a label change (see pulseJourney). */
const railPulse = ref(0);
const railPulseDir = ref<1 | -1 | 0>(0);
/** The final all-phase commit has consolidated the persistent rail into
 *  its terminal presentation. Local choreography state only: the real
 *  completion predicate remains `deploymentSettled`. */
const flowTerminal = ref(false);
/** Exact cards belonging to the STARTING-CARDS delivery episode. This
 *  is choreography identity (like `queueArriving`), not a second copy
 *  of purchase progress: held/inFlight remain the live source of truth.
 *  The snapshot scopes the Projects stage so a later prelude draw can
 *  never be mistaken for the initial purchase delivery. */
const startDeliveryNames = ref<Array<CardName>>([]);
/** Killed on teardown so the completion promise settles through GSAP's
 *  onInterrupt path and can never release a detached start scene. */
let completionTimeline: gsap.core.Timeline | undefined;
/** THE LEGACY OVERVIEW (campaign): the wizard's read-only sub-stage —
 *  R3 anywhere in the wizard descends into the «НАСЛЕДИЕ» tail, B
 *  returns to the exact page (picks/focus untouched by construction:
 *  the pages are parked v-show layers and this never writes them). */
const legacyView = ref({phase: 'closed' as LegacyViewPhase, focus: 0});
/**
 * CAMPAIGN «ТЕНДЕРЫ» — THE DOOR's LIST (§19): L3 from any wizard page parks the page and stands the holder's
 * certificates over it (the legacy overview's phrase); `tenderListHeld` = list slots whose certificate is still in
 * the air, `tenderDockHeld` = dock miniatures whose certificate is up.
 */
const tenderView = ref({phase: 'closed' as LegacyViewPhase, focus: 0});
const tenderListHeld = ref<Array<string>>([]);
const tenderDockHeld = ref<Array<string>>([]);
const tenderRise = ref<RiseConvoy | undefined>(undefined);
const tenderFlight = ref<CapturedFlight | undefined>(undefined);
const tenderPageRestored = ref(false);
let tenderRestoreTimer: (() => void) | undefined;
/** The page's cursor before a mode took the d-pad (the request's tags, the restructuring's groups) — given back. */
const tagFocusReturn = ref(0);
const restructFocusReturn = ref(0);
/** THE GLIDE (§20): the page's card boxes as the player last saw them (remembered when the door opened). */
const pageSlotRects = ref<Map<string, Rect> | undefined>(undefined);
/** A tender that GROWS the deal was executed: its answer's new layout plays as a glide, then a deal. */
const dealGlideArmed = ref(false);
/** The RESULT unfolds at the hero's own touchdown (the siblings may still be flying home — the panel never waits). */
const sheetPanelOpen = ref(false);
/** The purchase ledger's values held through a sheet's hand-over (`ledgerView`). */
const ledgerHold = ref<{buys: number, cost: number, left: number} | undefined>(undefined);
/** The sheet's RESULT as it stood at the press (what was decided — never re-read off the reshaped table). */
const sheetPlanFrozen = ref<TenderActivationPlan | undefined>(undefined);
/** A deal that changed while a tender's layer covered the page — dealt the moment the page is the player's again. */
const dealOwed = ref(false);
const glideActive = ref(false);
/** THE ACTIVATION SHEET (§20): the chosen tender as the hero of its own scene. */
const tenderSheet = ref<{instance: string, id: TenderId, phase: 'entering' | 'open' | 'committing' | 'leaving'} | undefined>(undefined);
const sheetHeroHeld = ref(true);
const sheetCommitted = ref(false);
const sheetStamping = ref(false);
const sheetTagFocus = ref(0);
const sheetTagPicked = ref<Tag | undefined>(undefined);
/** The sheet is handing the screen to its page — a deal's launch waits for it (`launchDeal`). */
const tenderHandoffActive = ref(false);
let handoffWaiters: Array<() => void> = [];
/** THE RESTRUCTURING's candidates still in the air off the tender deck (their slots keep their box, show nothing). */
const restructArriving = ref(new Set<CardName>());
let restructFlight: CloneFlightHandle | undefined;
/** A dealt restructuring found standing (a reload) was put back on the screen once — the decision is owed. */
const restructResumed = ref(false);
/** The tender DECK's place on the frame (its bottom-right corner of the visible body) — measured on its rise. */
const tenderDeckPos = ref<{left: number, top: number} | undefined>(undefined);
/** The deal that follows a tender's answer comes OFF the tender deck (armed at the commit, let go at its end). */
const tenderDealArmed = ref(false);
/** The summary's TERMINAL WARNING stands: start-window tenders still held — the next press begins anyway. */
const armedTenders = ref(false);
/** A simple tender's answer is on the wire and its effect lands on `step` — the landing is told there. */
const tenderLanding = ref<{instance: string, step: StartWizardStepId | undefined} | undefined>(undefined);
/** The dock chip that just took its stamp (a one-shot class). */
const dockStamped = ref<string | undefined>(undefined);
let dockStampTimer: (() => void) | undefined;
/** The BUYOUT's chips whose coins are leaving right now. */
const cashing = ref(new Set<string>());
/** Per rail position: the deal NAMES already on the table — a grown deal flies only its new cards. */
const landedDealNames = new Map<number, Set<string>>();
/** The strip indices the armed deal lands on (a subset when the deal grew in place). */
const dealSlotIdx = ref<Array<number>>([]);
/** A redeal's DEPARTURE is in the air (the cards the review / the gamble gives back are flying to the deck). */
const departureActive = ref(false);
let departureSafety: (() => void) | undefined;
/** Shelf tiles whose card is UP in the overview (held empty — the tile
 *  stays the flight's measured home; the shelf never re-lays out).
 *  Filled per-card at its DEPART (the take's end), emptied per-card at
 *  its homecoming touchdown — the counts follow the physical cards. */
const legacyDockHeld = ref<Array<CardName>>([]);
/** Stage seats still waiting for a card — they read as PREPARED card
 *  places (a quiet ring), never as invisible holes. */
const legacyStageHeld = ref(new Set<CardName>());
/** The HOMEWARD captured flight (dispose = teardown mid-leave). */
const legacyFlight = ref<CapturedFlight | undefined>(undefined);
/** The OUTBOUND rise convoy (dispose = teardown mid-enter). */
const legacyRise = ref<RiseConvoy | undefined>(undefined);
/** LEAVE parallelism: the parked page has already surfaced back UNDER
 *  the still-landing convoy (the LT step-return's own parallelism —
 *  the body must not stand empty while the cards travel to the shelf). */
const legacyPageRestored = ref(false);
/** The stage-fold choreographic offset (cleared on teardown). */
let legacyRestoreTimer: (() => void) | undefined;
let stopLegacyResize: (() => void) | undefined;
/** The summary pane is mounted INVISIBLE at its final box so its tiles
 *  can be laid out and measured before any card leaves (§prewarm). */
const summaryPrewarm = ref(false);
/** The prewarmed pane's box, relative to the workspace frame. */
const prewarmBox = ref<{left: number, top: number, width: number, height: number} | undefined>(undefined);
/**
 * FIT IS FROZEN while cards are airborne. The fit engines re-solve a
 * zoom from the live DOM; running one mid-flight moves the destinations
 * out from under cards that were planned against the old rects. The
 * prewarm has already solved the FINAL geometry by then, so there is
 * nothing to re-solve until everything is down.
 */
const fitLocked = ref(false);
/** Parked per-step strips (v-show panes) — index = step position. */
const stripEls = ref<Array<HTMLElement | undefined>>([]);
/** Parked pane roots (the stage-transition motion targets). */
const paneEls = ref<Array<HTMLElement | undefined>>([]);
/** The deployment shell has been REVEALED (Game State Materialization
 *  finished / a reload landed straight in the ceremony). A play press
 *  is accepted only after this — the destination-readiness gate. */
const ceremonyRevealed = ref(false);
/** The commit's refusal safety (a submit that never flips the mode). */
let commitSafety: (() => void) | undefined;
/** Summary tiles whose card is being STOWED back into its pile (held
 *  empty under the departing proxies — one visual owner on the way
 *  back too, never an open tile below a flying copy). */
const summaryStowing = ref(new Set<CardName>());
/** THE EMBED'S SOURCE COLUMN — the card that causes the draw, kept IN
 *  the step. For a play pressed HERE the hero flight lands DIRECTLY in
 *  this column (the effect-source seat — the card never reaches the
 *  tableau first); a claim that presents without our hero falls back to
 *  the physical emerge from the dock stack. */
const embedSourceShown = ref<CardName | undefined>(undefined);
/** The emerge's PRE-FLIGHT half: mounts the seat column while the shelf
 *  face is STILL PAINTED, so the carry can capture the live pixels.
 *  (`embedSourceShown` is what reactively blanks the shelf face — and a
 *  CORPORATION is always its family's only card, so its face element
 *  LEAVES the DOM in that very patch. Queried after nextTick it was
 *  null, the emerge degraded, and the corp TELEPORTED into the seat on
 *  every first-action entry.) */
const embedSourceIncoming = ref<CardName | undefined>(undefined);
/** The column slot is held empty (its card is still in flight). */
const embedSourceArriving = ref(false);
/** The source card PHYSICALLY stands in the column (the hero landed /
 *  the emerge finished) — only then may the settle FLY it to the dock;
 *  an aborted flow clears the column with no ghost flight. */
const embedSourceLanded = ref(false);
/** The queue scene has RELEASED (the draw-effect flow owns the room). */
const queueReleased = ref(false);
/** The first action's rail half (TR81 — the start stage as an ATTACHED host of the card-reaction framework). */
const firstActionRail = firstActionRailState;
/** The reaction scene's phase — the stage's completion barrier waits for the reactor to settle back. */
const reactionStage = cardReactionState;
/** The «Сработает» door's one-shot COMMIT flare (`pulseForecastDoor`) and its plain handle. */
const forecastPulse = ref(false);
let forecastPulseCall: {kill: () => void} | undefined;
/** The «Эффекты» room's lane when the QUEUE's door opened it (P79 · DI — measured at the press, beside the hero);
 *  it outlives the layer so the fold plays in the same room. */
const queueFxLane = ref<StartQueueFxLane | undefined>(undefined);
/** THE «ВАРИАНТ» STEP (P44): the prelude whose branch is being chosen, the cursor's row, the lane it stands in. */
const variantCard = ref<CardName | undefined>(undefined);
const variantFocus = ref(0);
const variantLane = ref<StartQueueFxLane | undefined>(undefined);
/** The answer is on its way (A pressed on a row) — the seal stands, nothing else takes a press. */
const variantSealed = ref(false);
/** The branch POSITION chosen per prelude — read by the reward prefetch and the press's batch. */
const variantChosen = ref(new Map<CardName, number>());
/**
 * P58 · FS — THE «ОЧЕРЁДНОСТЬ» STEP: the cursor's row, and the answer on its way (A pressed — the seal stands, the
 * step keeps standing on the answered prompt until the scene yields to the board: no deployment flash between).
 */
const orderFocus = ref(0);
const orderSealed = ref(false);
const orderKept = ref<PreludeVariant | undefined>(undefined);
/** The play preview per pressable card (this game-state version) — the variant step's rows. */
const playPreviews = ref(new Map<CardName, ActionPreview>());
/** Fetched first-action previews by corp (`has(name)` = fetch settled) —
 *  the briefing's result chips / warnings / follow-up notes. (The stage
 *  MACHINE lives in `consoleStartState.firstAct` — it must survive the
 *  collapse, which unmounts this component; only this cache is local.) */
const firstActionPreviews = ref(new Map<CardName, ActionPreview | undefined>());
/** The game-state version those previews were fetched under. A corp's
 *  first action is priced against live state, and the deployment CHANGES
 *  that state under the briefing (preludes pay out before the action is
 *  taken) — so the cache is version-scoped like every other server-derived
 *  one (`gameStateVersion`), never keyed by corp name alone. */
const firstActionPreviewsVersion = ref('');
/** The room's receded pose has been applied in THIS mount — until it is,
 *  a restore renders the queue/shelf hidden by class, so a re-entered
 *  stage can never flash them before the pose lands. */
const roomPosed = ref(false);
/** A room return is running: the deal must not measure slots inside a
 *  surface that is still travelling. */
const roomSettling = ref(false);
/** Stale-guard for the stage's confirmed leave (see the watcher). */
const firstActionLeaveToken = ref(0);
/** THE SEAT'S OWNER — see `SeatOwner` and the seat funnel below. */
const seatOwner = ref<SeatOwner | undefined>(undefined);
/** The seat's flight episode: every emerge / settle bumps it, and a
 *  continuation whose token is stale applies NOTHING (it only disposes
 *  its own proxies). A settle that finished after a newer take used to
 *  wipe the seat the take had just filled — the reported loop. */
const seatFlight = ref(0);
/** ONE flight at a time: seat requests are serialized on this chain,
 *  so two writers can never fly the same card twice. */
const seatChain = ref(Promise.resolve() as Promise<void>);
/** Focus INSIDE a standing stage panel: 0 = the stage's own CTA, 1.. =
 *  the claimable gain rows (Head Start's «получить до или после»). */
// THE STAGE PANEL'S CURSOR — an index into the panel's own VISUAL
// order: the gain rows top-down, the CTA last (it is drawn under
// them). It used to be «0 = CTA, 1.. = rows», which made ↓ walk UP the
// screen and ↑ on the CTA a dead press — read from the couch as «the
// d-pad dropped my input».
//
// `undefined` = HOME = the CTA, and it is DERIVED (`stageFocusIdx`)
// rather than seeded: a stored default is only correct if something
// writes it at the right moment, and a panel that is already standing
// when the scene mounts fires no watcher — so the cursor opened on a
// GAIN ROW and the bar offered «Получить сейчас» to a player who had
// pressed nothing. A press must never be pre-aimed at a claim.
const stageCursor = ref<number | undefined>(undefined);
/** One claim on the wire at a time (reset when the prompt answers). */
const gainClaimPending = ref(false);
/** GAME FRAME MATERIALIZATION: the summary layer has been SWAPPED OUT
 *  under the flying cards (the deployment stands in its place). */
const matSwap = ref(false);
/** The scene transition's CARD OVERLAY (captured at the commit press —
 *  before the submit, over the still-untouched summary). */
const matCapture = ref<CapturedFlight | undefined>(undefined);
/** The frozen summary snapshot is live in the freeze layer. */
const matFrozen = ref(false);
/** The one-frame re-bound: every shell transition is cut so the new
 *  bounds apply INSTANTLY under the proxies (never a live reflow). */
const matCut = ref(false);
/** The STANDARD SHELL is up: bounded band + `con-ws` + bars. Decoupled
 *  from the mode flip — the swap moment of the materialization owns it
 *  (binding it to `mode` re-bounded the LIVE summary mid-transition:
 *  clipped cards, early bars — the exact rejected frame). */
const shellUp = ref(false);
/**
 * The commit was ACCEPTED but the table is still confirming — this
 * player waited on their summary. The materialization then plays when
 * the deployment finally arrives (it re-arms its own freeze there, on
 * the live summary), so the hand-over is the same cinematic for
 * everyone, just later.
 */
const sentAwaiting = ref(false);
/** The «КУПЛЕНО» box's CHROME (plate + caption) through the
 *  materialization: held away while the bought projects are airborne,
 *  entering only when the LAST of them stands in the row — the box
 *  materializes AROUND landed cards, never as an empty frame waiting. */
const buyChrome = ref('shown' as 'shown' | 'hold' | 'entering');

const wf = computed((): PlayerInputModel | undefined => {
  return props.playerView.waitingFor;
});
const wizardInput = computed((): SelectInitialCardsModel | undefined => {
  return initialCardsInputOf(wf.value);
});
/**
 * THE TWO BOUNDS OF THE WORKSPACE. `ceremony` is the DEPLOYMENT, and it
 * begins when the SERVER hands this player their start sequence — never
 * merely because their wizard input is gone. In a multiplayer table the
 * gap between «I confirmed» and «everyone confirmed» is exactly that
 * state, and treating it as the deployment opened an empty one (no
 * queue, no hand dock, no way back once minimized).
 */
const mode = computed((): 'wizard' | 'ceremony' => {
  if (deploymentLatched.value) {
    return 'ceremony';
  }
  return wizardInput.value !== undefined || awaitingOthers.value ? 'wizard' : 'ceremony';
});
/** The latch (module state — it must survive this component's own
 *  re-renders and the deployment's prompt gaps). */
const deploymentLatched = computed((): boolean => {
  return startDeploymentBegun();
});
/**
 * SENT, AND THE TABLE IS STILL WAITING. The player's picks are final and
 * nothing is asked of them: the summary STAYS (its cards, its numbers),
 * the launch CTA becomes a calm waiting readout, and the deployment
 * opens for everyone at the same moment.
 */
const awaitingOthers = computed((): boolean => {
  return startAwaitingOthers(props.playerView);
});
// ── wizard ───────────────────────────────────────────────────────
const steps = computed((): Array<StartWizardStep> => {
  const input = wizardInput.value;
  return input !== undefined ? wizardSteps(input) : [];
});
/** Clamped position; === steps.length → the summary. */
const railPos = computed((): number => {
  return Math.min(state.stepIdx, steps.value.length);
});
const currentStep = computed((): StartWizardStep | undefined => {
  return steps.value[railPos.value];
});
/**
 * THE WORKSPACE BREADCRUMB — the one continuous line of the whole start:
 * `СТАРТ ПАРТИИ › <ГРУППА> › <ЭТАП>` from the first pick to the last
 * prelude. The subject is the stable stage GROUP, only the tail advances
 * (consoleWorkspaceHeader grammar); past the commit the header renders it
 * amber. An embedded reveal advances the tail to ITS stage name
 * (`phaseKey`, honest generic «ДОБОР КАРТ» until published) — the
 * embedded surface never titles the workspace itself.
 */
const crumb = computed((): StartCrumb => {
  if (mode.value === 'wizard') {
    const page = wizardCrumb(currentStep.value?.id);
    // THE LEGACY OVERVIEW is a TAIL of the page it was opened from —
    // «СТАРТ ПАРТИИ › КОРПОРАЦИЯ › НАСЛЕДИЕ», never a new subject. The
    // subject is the line's stable anchor: replacing it re-sizes its
    // swap cell at the crossfade's end and the whole tail JUMPS left —
    // while a stage-only advance moves nothing (nothing stands right of
    // the stage). B returns and the tail walks back the moment the PAGE
    // is what the player sees again (the convoy may still be landing).
    if (legacyStageOwnsScreen.value) {
      return {subject: page.subject, stage: 'Legacy'};
    }
    // A tender's MODE on a deal step is the page's tail — «… › ПРОЛОГИ › ПЕРЕСМОТР», «… › КОРПОРАЦИЯ › РЕСТРУКТУРИЗАЦИЯ».
    // THE DOOR's list is a tail of the page it was opened from — «… › ПРОЛОГИ › ТЕНДЕРЫ».
    if (tenderViewOwnsScreen.value) {
      return {subject: page.subject, stage: tenderSheet.value !== undefined ? tenderPortfolioName(tenderSheet.value.id) : 'Tenders'};
    }
    // A tender's MODE on its page names the TENDER — «СТАРТ ПАРТИИ › ПРОЛОГИ › ОТКРЫТЫЙ КОНКУРС»: the player sees which
    // tender they are executing, on the page it changes.
    if (tenderModeLive.value && tenderModeEntry.value !== undefined) {
      return {subject: page.subject, stage: tenderPortfolioName(tenderModeEntry.value.id)};
    }
    return page;
  }
  // «ЭПАТАЖНЫЙ СПОНСОР»: the crumb states the CAUSE, then the stage the
  // player is standing in — `СТАРТ ПАРТИИ › ЭПАТАЖНЫЙ СПОНСОР › КАРТЫ В
  // РУКЕ`, deepening to `… › РОЗЫГРЫШ` and `… › РАЗЫГРАНО` as the descent
  // goes on. Stable context BEFORE the mutable stage: the source card is
  // the same vnode all the way through, only the tail advances.
  // A prelude's COLONIES step: «СТАРТ ПАРТИИ › <пролог> › КОЛОНИИ» —
  // post-commit (the prelude is played; the colony pick is its effect),
  // so the tail is amber from the first frame.
  if (colonyStep.value) {
    return sponsorCrumb({
      source: sponsorSource.value,
      stage: 'Colonies',
      committed: true,
    });
  }
  // P58 · FS — «СТАРТ ПАРТИИ › <пролог> › ОЧЕРЁДНОСТЬ k / n»: the prelude is played (post-commit — amber).
  if (orderStep.value !== undefined) {
    return sponsorCrumb({source: orderStep.value.card, stage: preludePreStepStage(orderStep.value), committed: true});
  }
  if (sponsorStep.value) {
    // THE TAIL IS THE DEEPEST STEP'S, not the hosted hand's. The chain can
    // go one level further (a played card owing a colony:
    // «СТАРТ ПАРТИИ › <пролог> › КОЛОНИИ»), and a crumb that stopped at the
    // hand would keep naming a stage the player left two screens ago. The
    // stack already answers this — the root and subject stay ours.
    const crumb = workspaceStackCrumb();
    return sponsorCrumb({
      source: sponsorSource.value,
      stage: crumb?.stage ?? '',
      committed: crumb?.committed === true,
    });
  }
  return deploymentCrumb({
    variantSubject: variantStep.value !== undefined ? variantCard.value : undefined,
    variantStage: variantStep.value !== undefined ? preludePreStepStage(variantStep.value) : undefined,
    embedActive: embedPresenting.value,
    embedPhase: outcome.phaseKey,
    embedSubject: embedSubject.value,
    corpPending: deploymentFlowStage.value === 'corp',
    payPending: deploymentFlowStage.value === 'pay',
    bonusPending: deploymentFlowStage.value === 'bonus',
    mergePending: deploymentFlowStage.value === 'merge',
    legacyPending: deploymentFlowStage.value === 'legacy',
    corpPick: corpCandidatePick.value,
    // The first-action tail — while its briefing/wait stands. A follow-up
    // pick (the drawn preludes) advances the tail through the EXISTING
    // grammar (candidates → «ПРОЛОГИ › РОЗЫГРЫШ», an embedded reveal →
    // the claim's own stage name) — the root never restarts.
    firstAction: firstActionPanelShown.value ||
      (deploymentFlowStage.value === 'firstAction' && candidatePrompt.value === undefined && !embedPresenting.value),
    // The bonus tail — while the briefing stands AND through the whole
    // board trip, so a player who minimizes the board and restores the
    // workspace mid-bonus reads the same line they left.
    bonusAction: deploymentFlowStage.value === 'bonusAction' &&
      candidatePrompt.value === undefined && !embedPresenting.value,
    bonusSource: bonusActionSourceCard.value,
    bonusNested: firstActionNested.value,
    owedStep: owedDiscardStep.value !== undefined ? {subject: owedDiscardStep.value, stage: 'Card discard'} : undefined,
  });
});
/**
 * PC05 Spire · GW — the start's discard step is OWED (the server asks it; the hand has not opened yet — the draw's
 * cards are still being taken): its card. The crumb names the coming stage for that gap (`deploymentCrumb.owedStep`).
 */
const owedDiscardStep = computed((): string | undefined => {
  return taskFor(props.playerView)?.kind === 'handSelect' ? startStepDiscardOf(props.playerView) : undefined;
});
/** The identity of the live order step (its card and its count) — '' when none stands. */
const orderLiveKey = computed((): string => {
  const live = orderLive.value;
  return live === undefined ? '' : `${live.card}#${live.order?.index ?? 0}/${live.order?.of ?? 0}`;
});
/** P58 · FS — the LIVE «which tile next» of a start prelude (`startPlacementOrderOf`), or undefined. */
const orderLive = computed((): PreludeVariant | undefined => {
  if (mode.value !== 'ceremony') {
    return undefined;
  }
  const source = startPlacementOrderOf(props.playerView);
  return source === undefined ? undefined : placementOrderStepOf(props.playerView.waitingFor, getCard(source)?.metadata.renderData);
});
/** …the step on screen: the live one, or the answered one while its answer is on its way (sealed). */
const orderStep = computed((): PreludeVariant | undefined => {
  return orderLive.value ?? (orderSealed.value ? orderKept.value : undefined);
});
/** Would A on the order step be refused right now (the funnel busy, a hero in flight)? — the bar dims A on it. */
const orderPressRefusal = computed((): ReturnType<typeof startPressRefusal> => {
  return startPressRefusal('order', {
    heroActive: isPlayedHeroActive(),
    ceremony: mode.value === 'ceremony',
    shellRevealed: ceremonyRevealed.value,
    embedPresenting: embedPresenting.value,
    queueArriving: queueArriving.value.size > 0,
    requestInProgress: transportRequestInProgress(),
    deliveryPending: false,
  });
});
/** The crumb's stage of the order step, in the player's language with its count («ОЧЕРЁДНОСТЬ 2 / 3»). */
const orderStageText = computed((): string | undefined => {
  const step = orderStep.value;
  const params = step === undefined ? undefined : placementOrderStageParams(step);
  return params === undefined ? undefined : translateTextWithParams(PLACEMENT_ORDER_STAGE, [...params]);
});
/** The «ВАРИАНТ» step standing (P44) — the prelude's branches from its play preview; undefined = no step. */
const variantStep = computed((): PreludeVariant | undefined => {
  const card = variantCard.value;
  if (card === undefined || mode.value !== 'ceremony') {
    return undefined;
  }
  return preludeVariantOf(card, playPreviews.value.get(card));
});
/** The «ВАРИАНТ» step's card's WHOLE forecast (P65 · GH): each row reads its own branch's table answer from it. */
const variantForecast = computed((): EffectForecast | undefined => {
  const card = variantCard.value;
  return card === undefined ? undefined : playPreviews.value.get(card)?.forecast;
});
const wsSubject = computed((): string => {
  return crumb.value.subject;
});
const wsStage = computed((): string => {
  return crumb.value.stage;
});
/** The bounded system shell (band + `con-ws` + bars) — up only when the
 *  materialization's swap says so, never at the raw mode flip. */
const shellBounded = computed((): boolean => {
  return mode.value === 'ceremony' && shellUp.value;
});
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
const embedSubject = computed((): string | undefined => {
  const source = outcome.sourceCard;
  return source === '' ? undefined : source;
});
/** Bought projects remain the active deployment step until their real
 *  HandDock delivery has landed, not merely until the payment prompt
 *  disappears. */
const projectDeliveryPending = computed((): boolean => {
  if (corpPayCost.value !== undefined) {
    return true;
  }
  const live = new Set([...handDeliveryState.held, ...handDeliveryState.inFlight]);
  return startDeliveryNames.value.some((name) => live.has(name));
});
/** Parent source wins over the card being played inside its child effect
 *  (Eccentric Sponsor's project is still part of the PRELUDE step). */
const flowEffectCard = computed((): CardName | undefined => {
  if (sponsorSource.value !== undefined) {
    return sponsorSource.value;
  }
  if (outcome.sourceCard !== '') {
    return outcome.sourceCard as CardName;
  }
  return heroState.card;
});
/** The deployment stage stays on its source until every effect/child/card
 *  motion has returned. This is presentation over existing live signals,
 *  not a second progress latch. */
const deploymentFlowStage = computed((): 'corp' | 'bonus' | 'pay' | 'merge' | 'legacy' | 'preludes' | 'bonusAction' | 'firstAction' | 'ready' => {
  // THE BONUS-ACTION STAGE outranks every other: its actions are taken
  // «immediately», ahead of the player's remaining preludes, and while the
  // player is out on the BOARD spending them the deployment must not tell
  // the journey rail it is back on «Прологи» (the chapter the player is in
  // is the one they were handed off from). It also covers the standing
  // briefing, before the hand-off is confirmed.
  if (bonusActionStageLive.value) {
    return 'bonusAction';
  }
  // While the FIRST-ACTION stage is up, everything its action spawns —
  // the corp-sourced claim, the drawn-prelude pick, the placement yield —
  // belongs to THAT stage, not back to «Корпорация» / «Прологи» (the
  // journey must never re-open a completed chapter for a chain the last
  // stage started).
  if (firstActionStageLive.value) {
    // NESTED: the corp's mandatory move spent as bonus action #1 — the
    // chapter the player is in is «Бонусные действия», and the rail must
    // not leave it for a stage that is the window's own first item.
    return bonusActionsOwedNow.value ? 'bonusAction' : 'firstAction';
  }
  const effectOpen = heroState.active || embedActive.value || sponsorPending.value ||
    effectReturnPending.value || workspaceFrameHasNested('start') || props.yielded ||
    currentRevealEvent() !== undefined || orderStep.value !== undefined;
  const sourceType = flowEffectCard.value === undefined ? undefined : getCard(flowEffectCard.value)?.type;
  // CAMPAIGN: the bonus press — its own chapter right after the base.
  if (bonusPrompt.value !== undefined) {
    return 'bonus';
  }
  // CAMPAIGN: a merge press + its hero/effects are their OWN chapter,
  // told apart from the base deployment by the effect card being one of
  // the ADDITIONAL corporations (never lineage[0] / the mission-1 pick).
  if (corpMergePrompt.value !== undefined || mergeFeeStands.value ||
      (effectOpen && sourceType === CardType.CORPORATION &&
       flowEffectCard.value !== undefined && campaignAdditionalNames.value.includes(flowEffectCard.value))) {
    return 'merge';
  }
  if (corpPlayPrompt.value !== undefined || corpCandidatePick.value ||
      (effectOpen && sourceType === CardType.CORPORATION)) {
    return 'corp';
  }
  if (projectDeliveryPending.value) {
    return 'pay';
  }
  // CAMPAIGN «Наследие»: the carried-cards press and their dock flight.
  if (legacyPrompt.value !== undefined || legacyArrivalLive.value) {
    return 'legacy';
  }
  if (preludeRail.value.length > 0 || startFlowPreludePrompt(props.playerView) !== undefined ||
      (effectOpen && sourceType === CardType.PRELUDE) ||
      (effectOpen && sourceType === undefined)) {
    return 'preludes';
  }
  // The cards are through; the mandatory first action is what remains
  // (its stage is about to rise, or its wait is standing).
  if (firstActionOwedNow.value) {
    return 'firstAction';
  }
  return 'ready';
});
/** The Journey Rail items: reversible TABS through the preparation,
 *  a linear PROGRESS readout through the deployment. */
const selectionJourneyItems = computed((): ReadonlyArray<JourneyItem> => {
  if (!state.hold && mode.value === 'wizard' && steps.value.length > 0) {
    return startJourneyItems(steps.value, picks.value, railPos.value, state.visited);
  }
  return committedStartJourneyItems(state.stepIds);
});
const deploymentJourneyItemsView = computed((): ReadonlyArray<JourneyItem> => {
  if (state.flow === 'completing' || state.flow === 'releasing') {
    return deploymentJourneyItems({
      corpPending: false,
      payPending: false,
      hasBonus: campaignBonusAmount.value > 0,
      bonusPending: false,
      hasMerge: mergeChapterExists.value,
      mergePending: false,
      hasLegacy: state.legacySeen,
      legacyPending: false,
      boughtCards: state.projects.length > 0,
      preludesLeft: 0,
      hasPreludes: state.preludes.length > 0 || playedPreludes.value.length > 0,
      hasBonusActions: state.bonusActionSeen,
      bonusActionsPending: false,
      hasFirstAction: (state.firstActionSeen || firstActionDeclared.value) &&
        !firstActionAbsorbed.value,
      firstActionPending: false,
    }).map((item) => ({...item, state: 'completed' as const}));
  }
  const deploymentLive = mode.value === 'ceremony' && state.flow !== 'materializing';
  if (!deploymentLive) {
    const future: Array<JourneyItem> = [
      {id: 'corp', label: 'Corporation', state: 'locked'},
    ];
    // The campaign chapters are declared by the contract + the owner's
    // own wire fields, so the deployment starts with the shape it will
    // keep — bonus, then every merge, straight after the corporation.
    if (campaignBonusAmount.value > 0) {
      future.push({id: 'bonus', label: 'Campaign bonus', state: 'locked'});
    }
    if (mergeChapterExists.value) {
      future.push({id: 'merge', label: 'Merger stage', state: 'locked'});
    }
    if (state.projects.length > 0) {
      future.push({id: 'pay', label: 'Projects', state: 'locked'});
    }
    if (state.preludes.length > 0) {
      future.push({id: 'preludes', label: 'Preludes', state: 'locked'});
    }
    // The picked cards DECLARE the coming chapters (the pick is made in
    // the wizard), so the deployment STARTS with the shape it will keep:
    // a granted bonus window is a chapter from the first frame, and the
    // corp's mandatory first action is ABSORBED into it (the server
    // spends it as bonus action #1 whenever both exist).
    const bonusDeclared = bonusActionsDeclaredBy(state.preludes) !== undefined;
    if (bonusDeclared) {
      future.push({id: 'bonusActions', label: 'Bonus actions', state: 'locked'});
    }
    if (firstActionDeclared.value && !bonusDeclared) {
      future.push({id: 'firstAction', label: 'First action', state: 'locked'});
    }
    future.push({id: 'ready', label: 'Ready', state: 'locked'});
    return future;
  }
  return deploymentJourneyItems({
    corpPending: deploymentFlowStage.value === 'corp',
    payPending: deploymentFlowStage.value === 'pay',
    // CAMPAIGN chapters: bonus / merges / legacy are all declared by the
    // contract + the owner's own wire fields from the first frame — the
    // rail starts with the shape it will keep.
    hasBonus: campaignBonusAmount.value > 0,
    bonusPending: deploymentFlowStage.value === 'bonus',
    hasMerge: mergeChapterExists.value,
    mergePending: deploymentFlowStage.value === 'merge',
    hasLegacy: legacyChapterExists.value,
    legacyPending: deploymentFlowStage.value === 'legacy',
    boughtCards: ceremonyBoughtNames.value.length > 0,
    // HONEST WHATEVER OWNS THE FLOW STAGE. A bonus action does not finish
    // the prelude chapter — the player's remaining prelude is still there,
    // waiting behind the bonuses — and a rail that ticks «ПРОЛОГИ ✓» and
    // then re-opens it two presses later moves BACKWARDS in front of the
    // player, which is the one thing a linear progress readout may not do.
    preludesLeft: deploymentFlowStage.value === 'preludes' ?
      Math.max(1, preludeRail.value.length) :
      preludeRail.value.length,
    hasPreludes: state.preludes.length > 0 || preludeRail.value.length > 0 ||
      playedPreludes.value.length > 0 || deploymentFlowStage.value === 'preludes',
    // The stage EXISTS from the FIRST FRAME of the deployment when the
    // chosen corporation declares one (`firstActionDeclared` — the flow
    // must not discover a chapter halfway through), through the ledger
    // while it is owed, and it STAYS, completed, once the action resolves
    // (`firstActionSeen` — the rail must not shrink a chapter the player
    // just finished).
    // The BONUS chapter cannot be declared in advance the way the corp's
    // first action can — which prelude the player draws is not known until
    // it is played — so it joins the rail when the grant happens and
    // STAYS, completed, once the bonuses are spent (`bonusActionSeen`).
    // DECLARED from the picked cards too — «Фора» chosen in the wizard
    // WILL be played, so the chapter stands from the deployment's first
    // frame instead of popping in and re-numbering its neighbours.
    hasBonusActions: bonusChapterExists.value,
    // OWED, not «the briefing is up»: the chapter is still the player's
    // current one while they are out on the board spending it, and while a
    // bonus is being spent on the corporation's own stage.
    bonusActionsPending: bonusActionsOwedNow.value ||
      deploymentFlowStage.value === 'bonusAction',
    // ABSORBED whenever the mandatory first action is the bonus window's
    // own item #1 — a chapter the player never visits must not exist.
    hasFirstAction: (firstActionDeclared.value || firstActionOwedNow.value ||
      firstActionStageLive.value || state.firstActionSeen) &&
      !firstActionAbsorbed.value,
    firstActionPending: deploymentFlowStage.value === 'firstAction',
  });
});
const journeyPhases = computed((): ReadonlyArray<JourneyPhase> => {
  /* Keep the deployment chapter physically open while its final commit
   * beam confirms the already-settled canonical items. `flowTerminal` then
   * consolidates this SAME mounted object into READY. Previously the
   * `completing` flag collapsed the item track one frame before GSAP tried
   * to acknowledge it, making the premium completion sequence invisible. */
  const terminal = flowTerminal.value || state.flow === 'releasing';
  const deploymentLive = mode.value === 'ceremony' && state.flow !== 'materializing';
  const selectionWaiting = !terminal && !deploymentLive &&
    (awaitingOthers.value || state.flow === 'committing' || state.flow === 'materializing');
  return [
    {
      id: 'selection', ordinal: '01', label: 'Selection', mode: 'tabs',
      state: terminal || deploymentLive ? 'completed' : (selectionWaiting ? 'waiting' : 'current'),
      items: selectionJourneyItems.value,
    },
    {
      id: 'deployment', ordinal: '02', label: 'Playing', mode: 'progress',
      state: terminal ? 'completed' : (deploymentLive ? 'current' : 'locked'),
      items: deploymentJourneyItemsView.value,
    },
  ];
});
const flowPresentation = computed((): JourneyPresentation => {
  if (flowTerminal.value) {
    return 'complete';
  }
  return workspaceFrameHasNested('start') ? 'compact' : 'expanded';
});
const flowCompactContext = computed((): JourneyCompactContext => {
  const deploymentContext = mode.value === 'ceremony' || state.hold;
  if (!deploymentContext) {
    const current = selectionJourneyItems.value.find((item) => item.state === 'current');
    return {
      ordinal: '01',
      phaseLabel: 'Selection',
      itemLabel: awaitingOthers.value ? 'Waiting for other players' : (current?.label ?? 'Summary'),
    };
  }
  const itemLabel = deploymentFlowStage.value === 'corp' ? 'Corporation' :
    (deploymentFlowStage.value === 'pay' ? 'Projects' :
      (deploymentFlowStage.value === 'firstAction' ? 'First action' :
        (deploymentFlowStage.value === 'ready' ? 'Ready' : 'Preludes')));
  return {ordinal: '02', phaseLabel: 'Playing', itemLabel};
});
/**
 * THE PENDING STAGE — what the player asked for, while it is still not
 * what is on screen. The rail shows it as a directional anticipation and
 * NOTHING else: `journeyItems` keeps `current` on the ACTIVE stage for the
 * whole transition, so no chip ever claims a stage whose cards have not
 * arrived yet.
 */
const pendingJourneyItemId = computed((): string => {
  if (mode.value !== 'wizard' || transition.kind === undefined) {
    return '';
  }
  return selectionJourneyItems.value[transition.to]?.id ?? '';
});
/** The Selection Dock piles — EVERY step's pile, pre-mounted from the
 *  first frame (a flight can never target an unmounted element). Through
 *  the materialization the shelf synthesizes from the committed picks
 *  (the wizard input is gone, but the recede needs the physical shelf). */
const dockPileView = computed((): ReadonlyArray<StartDockPileModel> => {
  if (steps.value.length > 0) {
    return startDockPiles(steps.value, picks.value, railPos.value, state.dockDrift);
  }
  if (state.flow !== 'materializing') {
    return [];
  }
  // Through the shell formation the shelf keeps its COUNTS-ONLY trace
  // (the cards themselves lie in the summary tiles — backs stay 0).
  const out: Array<StartDockPileModel> = [];
  if (state.corp !== undefined) {
    out.push({id: 'corp', label: 'Corporation', count: 1, backs: 0, collected: true});
  }
  if (state.preludes.length > 0) {
    out.push({id: 'prelude', label: 'Preludes', count: state.preludes.length, backs: 0, collected: true});
  }
  if (state.ceo !== undefined) {
    out.push({id: 'ceo', label: 'CEO', count: 1, backs: 0, collected: true});
  }
  out.push({id: 'projects', label: 'Projects', count: state.projects.length, backs: 0, collected: true});
  return out;
});
/** The compact participant readiness strip (preparation only — the real
 *  top strip is hidden there and owns this again in the deployment). */
const participants = computed((): ReadonlyArray<StartParticipant> => {
  return startParticipants(props.playerView, props.waitingOnPlayers);
});
/** The EXPANDED STARTUP STATUS PREVIEW (the summary's status panel — the
 *  visible source the commit transforms into the real HUD). */
const preview = computed((): StartStatusPreview | undefined => {
  return buildStartStatusPreview(picks.value, campaignExtra.value);
});
/** An embedded follow-up (the shared reveal) is presenting in THIS
 *  workspace's zone — the queue yields visual priority, never unmounts. */
/**
 * «ЭПАТАЖНЫЙ СПОНСОР» — this workspace is hosting the play-from-hand step
 * (the hand is teleported into our embed zone and wears our shell). The
 * deployment queue does NOT unmount: it parks, keeps its order, its focus
 * and its already-played cards, and comes back untouched.
 */
const sponsorStep = computed((): boolean => {
  return workspaceFrameHost('hand') === 'start';
});
/** A prelude's SelectColony — this workspace hosts the COLONIES step
 *  (same shape as the sponsor's hand step, different surface). */
const colonyStep = computed((): boolean => {
  return workspaceFrameHost('colonies') === 'start';
});
/**
 * OUR ZONE for whichever step we are hosting — one selector, published
 * once. Two mutually exclusive divs, so the frame below never has to know
 * which of its children it is carrying.
 */
const stepSlot = computed((): string => {
  if (sponsorStep.value) {
    return '.con-start__handslot';
  }
  return colonyStep.value ? '.con-start__colonystep' : '';
});
/**
 * A play-from-hand effect is still owed — the server is holding its
 * `SelectProjectCardToPlay`, or the player's commit is on the wire. Read
 * from the RAW prompt (not from the embed claim) on purpose: the claim
 * derives from the workspace serving, and the workspace serving must not
 * derive from the claim.
 */
const sponsorPending = computed((): boolean => {
  const wf = props.playerView.waitingFor;
  if (wf !== undefined && wf.type === 'projectCard') {
    const hand = new Set(props.playerView.cardsInHand.map((c) => c.name));
    return wf.cards.length > 0 && wf.cards.every((c) => hand.has(c.name));
  }
  // …or the hosted step has crossed its own commit boundary: between the
  // submit and the project's landing the server names no prompt at all.
  const phase = workspaceFramePhase('hand');
  return phase !== undefined && isCommitted(phase);
});
/** The card whose effect asked for the play — the crumb's subject. */
const sponsorSource = computed((): CardName | undefined => {
  const src = workspaceFrameSubject('start');
  return src === '' ? undefined : src as CardName;
});
/**
 * A follow-up is CLAIMED for this workspace — the step is ours to host.
 * Says nothing about whether it is on screen yet (see `embedPresenting`).
 */
const embedActive = computed((): boolean => {
  return outcome.host === 'start' && outcome.sourceCard !== '';
});
/**
 * …AND IT IS ACTUALLY ON SCREEN. The distinction is load-bearing.
 *
 * A claim is placed at the PRESS, before the server has said what the
 * play produces — and inside the first-action stage it is placed
 * optimistically ON PURPOSE (a bespoke action's preview cannot promise
 * the draw its own follow-up will make). Everything about PRESENTATION —
 * the crumb's tail, the room receding, the input guard, the status line —
 * must therefore key on the step being THERE, not on the hope of it.
 * Keyed on the claim, an optimistic claim emptied the room and titled it
 * «ДОБОР КАРТ» for a draw that never came, with the candidates it should
 * have been dealing hidden behind it.
 */
const embedPresenting = computed((): boolean => {
  return embedActive.value && outcome.stage === 'presenting';
});
/**
 * A «ПОСМОТРИ N, ОСТАВЬ K» PICK STANDS IN THIS WORKSPACE AND NOBODY OWNS IT —
 * the card it belongs to, or undefined.
 *
 * The claim that makes the pick a step of this workspace is MODULE state
 * armed at the press, so a reload (or any path that lost it) leaves the
 * server's question with no host: the shell renders the pick as its own
 * band, and this full-bleed scene, mounted over it, hides it — the cards are
 * pickable, the pad is theirs, and the player sees the deployment with no
 * cards (the field blocker of 2026-10-18). The server asks one thing at a
 * time, so a deck pick standing while this scene is up IS this workspace's
 * step. Read off the RAW prompt; any live claim — even another host's — is
 * left alone.
 */
const orphanStepSource = computed((): CardName | undefined => {
  if (outcome.sourceCard !== '' || mode.value !== 'ceremony' ||
      taskFor(props.playerView)?.kind !== 'deckSelect') {
    return undefined;
  }
  return wf.value?.deckPickPrompt?.source?.card;
});
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
const startEffectBeat = computed((): 'idle' | 'staged' | 'depart' | 'landed' | 'failed' => {
  if (embedSourceShown.value === undefined) {
    return 'idle';
  }
  if (playedHeroState.card !== embedSourceShown.value) {
    return embedSourceLanded.value ? 'landed' : 'staged';
  }
  if (playedHeroState.phase === 'failed') {
    return 'failed';
  }
  if (playedHeroState.revealed || embedSourceLanded.value) {
    return 'landed';
  }
  // 'preparing' still measures/blanks the pressed slot — the release
  // starts one phase later, when the proxy already owns the pixels
  // ('shipping' is earlier still: the card stands while its price leaves the rail).
  return playedHeroHolding() && playedHeroState.phase !== 'preparing' && playedHeroState.phase !== 'shipping' ? 'depart' : 'staged';
});
/** Presence key of the live drawn-reveal event (claim lifecycle driver). */
const revealEventKey = computed((): string => {
  return currentRevealEvent() === undefined ? '' : 'ev';
});
/** The ceremony status rail: the focused queue card's NAME (the SOURCE
 *  card while an embedded reveal owns the zone). */
const ceremonyStatusName = computed((): string => {
  if (embedPresenting.value && outcome.sourceCard !== '') {
    return translateText(outcome.sourceCard);
  }
  // The first-action stage (its own briefing beats only — a follow-up
  // pick names the FOCUSED candidate below, exactly as every pick does):
  // the seated corporation IS the subject.
  // …except NESTED in the bonus window: the sub-stage's seat and chips
  // already name the corporation and the obligation — the rail repeating
  // them under the panel read as a second, stray announcement.
  if (firstActionPanelShown.value && state.firstAct.corp !== undefined) {
    return firstActionNested.value ? '' : translateText(state.firstAct.corp);
  }
  const f = focusedItem.value;
  if (f === undefined) {
    return '';
  }
  return f.name === PAY_KEY ? translateText('Bought cards') : translateText(f.name);
});
/** …and its resolution CONTEXT — one short state, never a breakdown. */
const ceremonyStatusText = computed((): string => {
  if (embedPresenting.value) {
    // THE EMBEDDED STAGE NAMES ITSELF. A hard-coded «Добор карт» was true
    // of the only guest the zone originally had (the drawn-cards reveal)
    // and a lie about every other one: a priced prelude's PAYMENT stood in
    // this very zone under «СТАРТ ПАРТИИ › … › ОПЛАТА» with the rail below
    // announcing a card draw that was not happening. The stage publishes
    // its own key up (`setWorkspaceOutcomePhase`), which is the same source
    // the crumb's tail reads — one voice, two places. Same resolution as
    // `ConsoleColoniesSection`'s embedded kicker.
    return translateText(outcome.phaseKey !== '' ? outcome.phaseKey : 'Card draw');
  }
  // The first-action stage: the rail carries only the short state — the
  // briefing panel owns the wait line (one text, one place; the rail
  // repeating it beside the panel read as an echo). A follow-up pick
  // falls through to the ordinary focused-card grammar.
  if (firstActionPanelShown.value) {
    return firstActionActionableNow.value && !firstActionNested.value ?
      translateText('Mandatory first action') : '';
  }
  if (firstActionStageLive.value && candidatePrompt.value === undefined) {
    return '';
  }
  const f = focusedItem.value;
  if (f === undefined) {
    // NOTHING FOCUSED IS NOT «WE ARE WAITING FOR OTHERS». The rail used to
    // print that as a blanket fallback, so every gap of the deployment (a
    // submit round trip, the beat between two stages, the whole
    // first-action stage) told a SOLO player they were waiting for a bot
    // that was not moving at all. The line may only be said when there is
    // an actually-active opponent to NAME; otherwise the rail is silent.
    return heroState.active ? '' : ceremonyWaitLine.value;
  }
  // The RISK STAGE owns the sentence while it is up (see its markup) —
  // the rail must not print the same warning a second time.
  if (riskStage.value !== undefined) {
    return '';
  }
  switch (f.kind) {
  case 'corp':
    return translateText('Ready to play');
  case 'pay':
    return translateText('Confirm the purchase');
  case 'candidate':
    return translateText('Select one');
  default: {
    // A prelude whose effect cannot resolve names the situation IN THE
    // RAIL, before any press — the badge is only the marker, the sentence
    // is the rail's job. Same source as the badge and the risk stage, so
    // the three can never describe different situations.
    const risk = focusedRisk.value;
    if (risk !== undefined) {
      return translateTextWithParams(risk.body, [...risk.bodyParams]);
    }
    const idx = queueCards.value.findIndex((q) => q.name === f.name);
    return idx <= 0 ? translateText('Ready to play') : translateText('Next prelude');
  }
  }
});
/**
 * THE DEPLOYMENT SETTLED — the whole start sequence is resolved for this
 * player AND every visual consequence has completed: no live start ask,
 * no hero in flight, no embedded follow-up open, no reveal pending, no
 * card still flying into the hand dock, nothing left in the queue. Under
 * the lifetime HOLD this is what finally releases the workspace (its own
 * calm dissolve → the board), never a prompt gap. The corporation's
 * mandatory first action is deliberately OUTSIDE this scene's scope.
 */
const deploymentSettled = computed((): boolean => {
  if (mode.value !== 'ceremony' || !state.hold || state.flow === 'materializing') {
    return false;
  }
  // A board-owned placement or any nested workspace is still part of the
  // source card's effect. READY may only begin after that surface has
  // returned to the Start frame, even when no startSequence prompt remains.
  if (props.yielded || workspaceFrameHasNested('start')) {
    return false;
  }
  // P58 · FS — a prelude's «which tile next» is its own step (the next placements are still owed).
  if (orderStep.value !== undefined) {
    return false;
  }
  // «ЭПАТАЖНЫЙ СПОНСОР» — a prelude whose effect is «play a card from your
  // hand» is NOT finished when its own card docks: the server is holding a
  // live `SelectProjectCardToPlay` for it, and the project it buys has yet
  // to be chosen, played, landed and resolved. Releasing here is what used
  // to throw the player onto a bare board (or, worse, close the last
  // prelude's workspace before its own effect had run).
  return !sponsorPending.value &&
    // …and neither is a prelude whose effect has resolved but whose CARD is
    // still on its way home. The claim releases the moment the server stops
    // asking, which is a beat BEFORE the source card leaves its seat for
    // «РАЗЫГРАНО» and the two halves of the deployment breathe back. Letting
    // the scene go there produced two reported bugs at once, and they were
    // the same bug: on the LAST prelude the card's play animation never ran
    // (the board simply appeared), and on every prelude the shelf kept a
    // blanked top slot — `awayCard` still naming a card whose settle never
    // reached the line that clears it, so only the peek strip painted.
    !effectReturnPending.value &&
    // …and neither is a play the TABLE is still answering (TR82 Proteus — the last Prelude's matching tag): the
    // reactor rises out of its slot on «РАЗЫГРАНО» and lays its token in its own capsule there, so the shelf must
    // stand until the chain has receded — released first, the corporation's data fell into the bare satellite.
    reactionStage.phase === 'idle' &&
    // THE FIRST-ACTION STAGE is the deployment's own conditional last
    // stage now: the workspace may not settle while the corporation still
    // OWES its mandatory first action (domain ledger / live prompt), and
    // not before the stage's own return beat has physically completed
    // (the corp card settled home, the room breathed back).
    !firstActionOwedNow.value &&
    // …and NEVER while a card-granted bonus action is still owed. The
    // workspace does not end the preparation in the middle of the two
    // actions it just handed the player: it collapses to the board (the
    // excursion latch) and comes back to finish, which is the whole
    // point of announcing the trip in the first place.
    !bonusActionsOwedNow.value &&
    state.bonusAct.stage === 'idle' &&
    state.firstAct.stage === 'idle' &&
    corpPlayPrompt.value === undefined &&
    corpPayCost.value === undefined &&
    // …and never while the CAMPAIGN'S «НАСЛЕДИЕ» is still owed — the server standing on the carried cards'
    // press, or their cascade still on its way into the dock (PL-1110). The flow stage knew this beat
    // (`deploymentFlowStage` → 'legacy'); the settle did not, so the moment the bought cards had landed the scene
    // released itself over a live prompt — the board, a stale bar, the row's press orphaned until a reload. Only
    // a press made within the cascade's own window used to hide it.
    legacyPrompt.value === undefined &&
    !legacyArrivalLive.value &&
    candidatePrompt.value === undefined &&
    startFlowPreludePrompt(props.playerView) === undefined &&
    wizardInput.value === undefined &&
    !heroState.active &&
    !embedActive.value &&
    currentRevealEvent() === undefined &&
    // …and never in the gap where a draw's cards are already coming off
    // the deck but its reveal has not been staged yet (see
    // `firstActionChainQuiet`): the workspace may not dissolve INTO a
    // cinematic it started.
    !deckDrawHolds() &&
    !isHandDeliveryActive() &&
    handDeliveryState.held.length === 0 &&
    queueCards.value.length === 0 &&
    payProjects.value.length === 0 &&
    queueArriving.value.size === 0;
});
// ── THE BONUS-ACTION STAGE (a prelude granted actions «immediately») ──
/**
 * A card-granted bonus action is owed RIGHT NOW — the server is standing
 * on an action menu carrying the `bonusActionPrompt` marker.
 *
 * Server-authoritative and structural. Never a phase check (`game.phase`
 * is PRELUDES for the whole prelude phase) and never a title check (the
 * menu carries the ORDINARY action-menu title on purpose, so that the task
 * router, the quick wheels and the status label keep classifying it as an
 * action menu).
 */
const bonusActionOwedNow = computed((): boolean => {
  // …and it is one the BOARD has to serve. A bonus spent on the
  // corporation's mandatory first action is served by this very workspace
  // (its own stage), so it must not trigger a hand-off — see
  // `bonusActionOnBoard`.
  return bonusActionOnBoard(props.playerView);
});
/**
 * THE WINDOW's overview stands for BOTH shapes of the next item: a free
 * board action (the hand-off CTA) and the corp's nested mandatory move
 * (the sub-stage CTA). One panel, one seat («Фора»), one plan — the
 * difference is only which verb the A carries.
 */
const bonusWindowDue = computed((): boolean => {
  return bonusActionsOwedNow.value &&
    (bonusActionOwedNow.value || firstActionNested.value);
});
/**
 * THE LEDGER — bonuses are owed AT ALL, whichever prompt stands.
 *
 * Different question from `bonusActionOwedNow`, and both are needed: the
 * hand-off asks «does the BOARD have to serve this one», the deployment
 * asks «is this chapter over». They disagree exactly while the corporation's
 * mandatory first action spends a bonus inside this workspace — and if the
 * rail read the hand-off question there it would tick «БОНУСНЫЕ ДЕЙСТВИЯ ✓»
 * with one still owed, then take the ✓ back.
 */
const bonusActionsOwedNow = computed((): boolean => {
  return bonusActionOwed(props.playerView);
});
/** The card that granted them — the stage's subject and the crumb's. */
const bonusActionSourceCard = computed((): CardName | undefined => {
  return bonusActionSource(props.playerView) ?? state.bonusAct.source;
});
/** `N` of the `N / M` readout — which bonus action is being taken now. */
const bonusActionIndexNow = computed((): number => {
  return bonusActionIndex(props.playerView);
});
/** `M` — how many the card granted. */
const bonusActionGrantedNow = computed((): number => {
  return bonusActionGranted(props.playerView);
});
/** The stage is live in ANY of its beats (briefing standing, or the
 *  player out on the board spending the bonuses). */
const bonusActionStageLive = computed((): boolean => {
  // 'onboard' is NOT a stage of this workspace — it is the window in which
  // the workspace has let go of the screen entirely. Only the briefing
  // beats own the flow stage.
  const stage = state.bonusAct.stage;
  return stage === 'staging' || stage === 'standing';
});
/**
 * The BRIEFING PANEL renders — the announcement before the hand-off.
 *
 * Only in the `standing` beat: once the player has confirmed, the board
 * owns the screen and the workspace is collapsed behind it, so painting
 * the panel would be painting into a hidden surface. It also yields to an
 * embedded follow-up exactly like the first-action briefing does (the
 * prelude's own reveal may still be presenting when the grant lands).
 */
const bonusActionPanelShown = computed((): boolean => {
  const stage = state.bonusAct.stage;
  // `standing` only — same two-beat entry grammar as the first-action
  // briefing (the plate materializes around the settled card).
  return stage === 'standing' &&
    // The sub-stage (the corp's briefing) takes the plate while it lives.
    state.firstAct.stage === 'idle' &&
    !embedPresenting.value && candidatePrompt.value === undefined;
});
/** The overview's CTA: enter the corp sub-stage, or hand the board over. */
const bonusOverviewVerb = computed((): 'firstAction' | 'board' => {
  return firstActionNested.value ? 'firstAction' : 'board';
});
/**
 * THE WINDOW'S PLAN — its actions as a readable list, so «бонусные
 * действия 1/2» is never an unexplained number. Shown only when the
 * window CONTAINS the corp's mandatory move (with a free-only window the
 * counter chip already says everything a list would).
 */
const bonusPlan = computed((): Array<{key: string, label: string, corp?: CardName, state: 'current' | 'done' | 'next'}> => {
  const corpInWindow = firstActionNested.value || state.bonusAct.corpDone;
  if (!corpInWindow) {
    return [];
  }
  const corp = firstActionCorpNow.value ?? state.firstAct.corp ?? undefined;
  return [
    {
      key: 'corp',
      label: 'Mandatory first action',
      corp,
      state: state.bonusAct.corpDone ? 'done' : 'current',
    },
    {
      key: 'free',
      label: 'Free action on the board',
      state: state.bonusAct.corpDone ? 'current' : 'next',
    },
  ];
});
/**
 * ENTRY IS DUE — a bonus action is owed, the prelude that granted it has
 * finished everything it was doing, and nothing of the deployment is still
 * in flight. Pure entry predicate; the watcher acts on its rising edge.
 */
const bonusActionEntryDue = computed((): boolean => {
  if (state.bonusAct.stage !== 'idle' || mode.value !== 'ceremony' || !ceremonyRevealed.value) {
    return false;
  }
  if (!bonusWindowDue.value) {
    return false;
  }
  // Never INTO a cinematic the granting prelude started: its own card is
  // still travelling, its reveal is still presenting, or a step it opened
  // is standing inside this very workspace.
  return !props.yielded && !workspaceFrameHasNested('start') &&
    !embedPresenting.value && !effectReturnPending.value &&
    !heroState.active && candidatePrompt.value === undefined;
});
/**
 * The stage's ASK — what the press is FOR, naming the card that granted
 * the bonuses. The card name is its own i18n key (`ru/promo.json`), so
 * this is one interpolation, not a per-card table.
 */
const bonusActionAskText = computed((): string => {
  const source = bonusActionSourceCard.value;
  const granted = bonusActionGrantedNow.value;
  if (source === undefined || granted <= 0) {
    return translateText('Take an extra action on the board');
  }
  return translateTextWithParams(
    '${0} grants you ${1} immediate actions — take them on the board',
    [translateText(source), String(granted)]);
});
/**
 * THE CLAIMABLE GAINS of the live bonus-window prompt — the steel / M€
 * whose TIMING the official card text leaves to the player. Server rows
 * (option index + live amount); empty off the window's own prompts.
 */
const stageGainRows = computed((): ReadonlyArray<BonusGainRow> => {
  if (!bonusActionPanelShown.value && !firstActionPanelShown.value) {
    return [];
  }
  return bonusActionGains(props.playerView);
});
/** Identity of the rows — the reset key for focus + the claim latch. */
const stageGainKey = computed((): string => {
  return stageGainRows.value.map((g) => `${g.resource}:${g.index}:${g.amount}`).join('|');
});
/** A stage panel with an internal focus model is up. */
const stagePanelUp = computed((): boolean => {
  return bonusActionPanelShown.value || firstActionPanelShown.value;
});
/**
 * THE «ФОРА» GAINS ARE OWED A FLIGHT, AND THIS FRAME CAN GIVE THEM ONE.
 *
 * Two arrivals, one beat (`startBonusGain.ts`), and they are ready at
 * different moments — which is the whole reason the beat waits for a
 * surface instead of firing at the commit:
 *
 *  · a CLAIM was pressed in a standing panel and carries its own captured
 *    origin (the row), so the deployment being on screen is enough;
 *  · the AUTO-RESOLVE happened while the player was away on the board, and
 *    its chips come out of the granting card in «РАЗЫГРАНО» — so it waits
 *    for the shelf to have come BACK. Flying out of a receded (transformed,
 *    transparent) shelf would put the origin somewhere the player cannot
 *    see, which is exactly the thing this beat exists to prevent.
 */
const bonusGainWaveDue = computed((): boolean => {
  const reward = bonusGainRewardState.owed;
  if (reward === undefined || mode.value !== 'ceremony' || !ceremonyRevealed.value || props.yielded) {
    return false;
  }
  return reward.point !== undefined || !playedDockReleased.value;
});
/**
 * THE PANEL'S FOCUS TARGETS, in the order the EYE reads them: every
 * claimable gain row (they are drawn first) and then the stage's own CTA.
 * The d-pad walks this list, so ↓ always moves toward the CTA and ↑
 * toward the first row — «the d-pad moves where the eye expects» is the
 * same law the card-actions grid follows.
 */
const stageCtaIdx = computed((): number => {
  return stageGainRows.value.length;
});
/** Where the cursor actually stands — HOME (the CTA) until it is moved. */
const stageFocusIdx = computed((): number => {
  return Math.min(stageCtaIdx.value, stageCursor.value ?? stageCtaIdx.value);
});
/** The cursor stands on the stage's CTA (the panel's last target). */
const stageCtaFocused = computed((): boolean => {
  return stageFocusIdx.value >= stageCtaIdx.value;
});
/** The cursor stands on a gain row (the bar's A relabels to «Получить»). */
const stageGainFocused = computed((): boolean => {
  return stageFocusIdx.value < stageCtaIdx.value;
});
/**
 * THE NESTED FIRST ACTION — the corp's mandatory move being spent AS bonus
 * action #1 (both markers on one prompt). The stage then frames itself as
 * an ITEM of the bonus window («БОНУСНОЕ ДЕЙСТВИЕ 1/2») instead of a
 * chapter of its own: the player got the actions, spends the first on the
 * corporation, and the rail never leaves «Бонусные действия».
 */
const firstActionNested = computed((): boolean => {
  return bonusActionNestedFirstAction(props.playerView);
});
/**
 * The bonus chapter is DECLARED before the play — a picked/held prelude
 * grants bonus actions (`ClientCard.grantsBonusActions`). «Фора» chosen in
 * the wizard WILL be played, so the chapter is a certainty and must stand
 * in the rail from the deployment's first frame instead of popping in.
 */
const bonusActionsDeclared = computed((): boolean => {
  const held = [
    ...state.preludes,
    ...preludeRail.value.map((e) => e.name),
    ...playedPreludes.value,
  ];
  return bonusActionsDeclaredBy(held) !== undefined;
});
/** …and specifically by a card NOT YET PLAYED (the window is still ahead). */
const bonusDeclaredUnplayed = computed((): boolean => {
  return bonusActionsDeclaredBy(preludeRail.value.map((e) => e.name)) !== undefined;
});
/** The bonus chapter exists at all (declared, owed, standing or walked). */
const bonusChapterExists = computed((): boolean => {
  return bonusActionsDeclared.value || bonusActionsOwedNow.value ||
    bonusActionStageLive.value || state.bonusActionSeen;
});
/**
 * The first-action chapter is ABSORBED into the bonus one. The server
 * spends the mandatory first action AS bonus action #1 whenever both
 * exist, so a separate «Первое действие» chapter would narrate a stage
 * the player never visits. A first action that arises AFTER the window
 * (Merger acquiring a corporation later) is standalone again — it joins
 * the rail dynamically, like the Merger corp itself always has.
 */
const firstActionAbsorbed = computed((): boolean => {
  if (state.firstActionSeen) {
    return false;
  }
  if (!bonusChapterExists.value) {
    return false;
  }
  if (firstActionOwedNow.value && !bonusActionsOwedNow.value && !bonusDeclaredUnplayed.value) {
    return false;
  }
  return true;
});
/** «С карты „Фора"» — the gains zone names its source card. */
const stageGainsCaption = computed((): string => {
  const source = bonusActionSourceCard.value;
  if (source === undefined) {
    return translateText('From the card — claim now or after the actions');
  }
  return translateTextWithParams('From «${0}» — claim now or after the actions', [translateText(source)]);
});
/** The stage as the command contract sees it (see StartSceneCommandState). */
const bonusActionBarState = computed((): 'off' | 'waiting' | 'ready' => {
  if (!bonusActionPanelShown.value) {
    return 'off';
  }
  // The seat is still rising — a CTA the press cannot honour yet is a lie.
  if (state.bonusAct.stage === 'staging') {
    return 'waiting';
  }
  // Ready for the board hand-off OR for the sub-stage entry. The entry
  // reads the PROMPT directly (`firstActionActionable`), never the
  // sub-stage machine — on the overview that machine is still idle by
  // definition, which is exactly why the player is being offered a door.
  return (bonusActionOwedNow.value ||
    (firstActionNested.value &&
      firstActionActionable(props.playerView, firstActionCorpNow.value))) ? 'ready' : 'waiting';
});
// ── THE FIRST-ACTION STAGE (the deployment's conditional last stage) ──
/** The corporation still owes its mandatory first action (see
 *  startFirstAction.ts — domain ledger / live marked prompt). */
const firstActionOwedNow = computed((): boolean => {
  return firstActionOwed(props.playerView);
});
/**
 * THE FLOW KNOWS ITS OWN SHAPE FROM THE FIRST FRAME — does the chosen
 * corporation DECLARE a mandatory first action?
 *
 * The server ledger (`pendingInitialActions`) only fills when the
 * corporation is PLAYED, so keying the journey on it alone made the
 * chapter POP IN mid-deployment — the flow appearing to change its mind
 * about how many stages it has. The card's own generated declaration
 * (`ClientCard.hasFirstAction`, exported under exactly the condition
 * `playCorporationCard` uses) answers it the moment the corporation is
 * known: the wizard pick, the deferred play prompt, or the tableau.
 *
 * A MERGER's second corporation is genuinely unknown until it is chosen,
 * so THAT one still joins the rail dynamically — with its arrival beat.
 */
const firstActionDeclared = computed((): boolean => {
  const names: Array<CardName> = [];
  if (state.corp !== undefined) {
    names.push(state.corp);
  }
  if (corpPlayCard.value !== undefined) {
    names.push(corpPlayCard.value.name);
  }
  names.push(...corporationCardNames(props.playerView));
  return names.some((name) => getCard(name)?.hasFirstAction === true);
});
/** The corp the stage seats (the READY one first — Merger resolves them
 *  one at a time as the server re-raises the prompt). */
const firstActionCorpNow = computed((): CardName | undefined => {
  return firstActionStageCorp(props.playerView);
});
/** Every owed corporation whose option is LIVE right now — the player's
 *  LB/RB choice when there is more than one. */
const firstActionCandidates = computed((): ReadonlyArray<CardName> => {
  return firstActionCandidatesOf(props.playerView);
});
/** The bar advertises the choice only where a press can honour it. */
const firstActionChoiceLive = computed((): boolean => {
  return state.firstAct.stage === 'standing' && !state.firstAct.submitting &&
    firstActionCandidates.value.length > 1 && firstActionPanelShown.value;
});
/** The player's turn has genuinely arrived — the marked OrOptions is live
 *  and carries the seated corp's option. */
const firstActionActionableNow = computed((): boolean => {
  return state.firstAct.stage === 'standing' && !state.firstAct.submitting &&
    firstActionActionable(props.playerView, state.firstAct.corp);
});
/** The stage is on screen in ANY of its beats. */
const firstActionStageLive = computed((): boolean => {
  return state.firstAct.stage !== 'idle';
});
/** The seat column's card — the incoming half first (the emerge mounts
 *  the column BEFORE the shelf face is hidden, so the carry can capture
 *  live pixels), then the settled owner. */
const embedSourceVisible = computed((): CardName | undefined => {
  return embedSourceIncoming.value ?? embedSourceShown.value;
});
/**
 * THE STAGE OWNS THE ROOM — the deployment's queue and «РАЗЫГРАНО» are
 * receded because the briefing is what the player is looking at.
 *
 * It stops owning it the moment the action's OWN follow-up needs the
 * room: a drawn-prelude pick lands in the queue (and must be DEALT into
 * it), and the chosen prelude flies to the shelf — both need those
 * surfaces standing, settled and measurable. Deriving this instead of
 * calling release/return from separate watchers is what makes the pair
 * symmetric: there is no order in which the release can happen without
 * its return.
 */
/**
 * THE ROOM HAS ONE OWNER, whichever briefing stage is standing.
 *
 * Both the corporation's first action and a card's bonus actions put a
 * SEATED CARD plus a plate on the deployment row, and both need the queue
 * and «РАЗЫГРАНО» to let go behind them. Deliberately ONE derived bit
 * feeding ONE pair of phrases (release / return): the two directions stay
 * symmetric no matter which stage took the room, and two writers cannot
 * cancel each other mid-flight — the defect the comment below warns about.
 */
const stageOwnsRoom = computed((): boolean => {
  return firstActionOwnsRoom.value || bonusActionOwnsRoom.value;
});
/**
 * …AND THE SHELF IS PART OF THAT STAGE, not of the room it recedes.
 *
 * The seated card EMERGES from «РАЗЫГРАНО» and SETTLES back into it — and
 * inside the bonus window it does both again for the corporation swap. A
 * receded shelf makes every one of those flights end in nothing: the card
 * shrinks toward an invisible place and the player is asked to believe a
 * destination they cannot see. So while a stage PANEL owns the room the
 * shelf stays lit and merely TUCKS (`--shelfstage`: the band peeks, the
 * stage lays out above it) — while an embedded STEP (a reveal, a deck
 * pick) still takes the whole room, because that step really does need
 * every pixel and nothing is flying to the shelf during it.
 */
const shelfOnStage = computed((): boolean => {
  return stageOwnsRoom.value && !embedPresenting.value;
});
/** The bonus briefing's half of it (the seated granting card + its plate). */
const bonusActionOwnsRoom = computed((): boolean => {
  const stage = state.bonusAct.stage;
  if (stage !== 'staging' && stage !== 'standing') {
    return false;
  }
  return !embedPresenting.value && candidatePrompt.value === undefined;
});
const firstActionOwnsRoom = computed((): boolean => {
  const stage = state.firstAct.stage;
  // ONLY the BRIEFING beats. Once the action is `performing`, its own
  // follow-ups are what the player is looking at, and every one of them
  // NEEDS these surfaces: the drawn candidates are dealt INTO the queue,
  // and the chosen card flies to the shelf. (A follow-up that wants the
  // room away again — an embedded reveal ON SCREEN — recedes it through
  // the claim's own phrase; this bit must not become a second writer,
  // hence the `embedPresenting` term here and the guard on the return.
  // PRESENTING, not merely claimed: a claim is optimistic here, and
  // yielding the room to one that never presents empties the deployment
  // for a step that does not exist.)
  if (stage !== 'staging' && stage !== 'standing') {
    return false;
  }
  return !embedPresenting.value && candidatePrompt.value === undefined;
});
/** The briefing PANEL renders — never over an embedded follow-up that is
 *  actually on screen (the reveal owns the zone then; the seat stays
 *  either way) and never once the action is off performing.
 *  `standing` ONLY, never `staging`: the entry's grammar is two beats —
 *  the corporation flies into its seat FIRST, the briefing materializes
 *  around the SETTLED card (the doc-comment on `enterFirstActionStage`
 *  always promised this; mounting at staging played the panel's rise, the
 *  zone's entry and the carry as one chord over a still-flying card). */
const firstActionPanelShown = computed((): boolean => {
  return state.firstAct.stage === 'standing' &&
    // …and never over an EMPTY seat: whatever ordering emptied it (a
    // previous effect's settle lagging the quieted server, an entry
    // variant nobody enumerated), the briefing waits for the corp to be
    // physically seated — the self-heal watcher below re-runs the
    // handover phrase for exactly this state.
    (embedSourceShown.value !== undefined || embedSourceIncoming.value !== undefined) &&
    !embedPresenting.value && candidatePrompt.value === undefined;
});
/** The self-heal trigger: the stage STANDS but nobody is seated. */
const firstActionSeatMissing = computed((): boolean => {
  return state.firstAct.stage === 'standing' &&
    state.firstAct.corp !== undefined &&
    embedSourceShown.value === undefined && embedSourceIncoming.value === undefined;
});
/**
 * ENTRY IS DUE — the deployment's cards are through, nothing is mid-air,
 * nothing is hosted, and the corporation still owes its opening move.
 * Pure entry predicate: the watcher acts on its rising edge only.
 */
const firstActionEntryDue = computed((): boolean => {
  // NESTED (the corp's move is the bonus window's item #1): the WINDOW
  // owns it — the overview stands first and the player ENTERS the
  // sub-stage with an explicit press (`enterBonusSubStage`). Auto-entry
  // here is what made the corp briefing appear out of nowhere, with
  // «Фора» — the source of the whole window — never on screen.
  if (firstActionNested.value) {
    return false;
  }
  if (state.firstAct.stage !== 'idle' || mode.value !== 'ceremony' || !ceremonyRevealed.value) {
    return false;
  }
  if (!firstActionOwedNow.value || firstActionCorpNow.value === undefined) {
    return false;
  }
  // THE STAGE BEFORE THIS ONE IS STILL BEING PLAYED. The general form of
  // it, not another shape added to the list below: the server asks one
  // thing at a time, so anything on the wire that is not this stage's own
  // move IS the deployment's unfinished work. «Эпатажный спонсор» playing
  // «Деловые контакты» ends in a deck PICK — a prompt none of the
  // enumerated blockers names — and the stage used to stand up over the
  // four cards the player was choosing between, offering «Первое действие
  // станет доступно на вашем ходу» and no way back.
  if (startFlowOtherPromptStands(props.playerView)) {
    return false;
  }
  if (props.yielded || workspaceFrameHasNested('start')) {
    return false;
  }
  if (sponsorPending.value || effectReturnPending.value ||
      corpPlayPrompt.value !== undefined || corpPayCost.value !== undefined ||
      candidatePrompt.value !== undefined ||
      startFlowPreludePrompt(props.playerView) !== undefined ||
      wizardInput.value !== undefined) {
    return false;
  }
  // «The deployment's cards are through» — with ONE exception the server's
  // own order creates: a NESTED first action (spent as bonus action #1)
  // comes BEFORE the player's remaining preludes, so those legitimately
  // WAIT in the queue while the stage stands. Only non-prelude queue work
  // (a corp play, candidates) still blocks entry then.
  const queueBlocks = firstActionNested.value ?
    queueCards.value.some((entry) => entry.kind !== 'prelude') :
    queueCards.value.length > 0;
  return !heroState.active && !embedActive.value &&
    currentRevealEvent() === undefined && !isHandDeliveryActive() &&
    !queueBlocks && payProjects.value.length === 0 &&
    queueArriving.value.size === 0;
});
/**
 * The stage's CHAIN IS QUIET — every visual consequence of the action has
 * returned to this frame: no yield (the placement excursion holds it), no
 * embedded follow-up, no candidate pick, no hero, no reveal, no intake.
 * Shared by the leave (below) and the Merger re-stand.
 */
const firstActionChainQuiet = computed((): boolean => {
  // The submit's round trip is chain work too: the server has not said
  // yet what this action produces.
  if (state.firstAct.submitting) {
    return false;
  }
  // …and so is ANYTHING the server is still asking that this stage does not
  // serve — the general form of the enumerated chain shapes below. The
  // ACTION MENU is the one exception, and it is the honest END: the start
  // is over and the player's own turn has begun, so holding the stage for
  // it would leave the workspace standing for the rest of the game.
  if (startFlowOtherPromptStands(props.playerView, {allowActionMenu: true})) {
    return false;
  }
  return !props.yielded && !workspaceFrameHasNested('start') &&
    !embedActive.value && candidatePrompt.value === undefined &&
    startFlowPreludePrompt(props.playerView) === undefined &&
    !heroState.active && currentRevealEvent() === undefined &&
    // THE TABLE'S ANSWER TO THE ACTION (TR81): its rail half in the air, the reactor still standing out of its seat.
    !firstActionRailBusy() && reactionStage.phase === 'idle' &&
    // THE DECK IS ALREADY DEALING. A draw's cards come off the deck
    // BEFORE the reveal event exists, so «no reveal yet» is not «no draw»
    // — read that gap as quiet and the stage leaves, the deployment
    // settles, and the batch then presents in a standalone modal over a
    // workspace that has already let go (the reported «карты тянутся в
    // отдельной модалке»).
    !deckDrawHolds() &&
    !isHandDeliveryActive() &&
    // «The queue is empty» — with the SAME nested exception the entry
    // makes: inside the bonus window the remaining preludes legitimately
    // WAIT while the corp's move (item #1) resolves; only non-prelude
    // queue work still counts as chain.
    (state.bonusAct.stage === 'standing' || state.bonusAct.stage === 'staging' ?
      !queueCards.value.some((entry) => entry.kind !== 'prelude') :
      queueCards.value.length === 0) &&
    queueArriving.value.size === 0;
});
/**
 * THE STAGE MAY LEAVE — the action resolved (ledger drained, prompt gone)
 * and its chain is quiet. One release, at the end.
 */
const firstActionLeaveDue = computed((): boolean => {
  if (state.firstAct.stage === 'idle' || state.firstAct.stage === 'leaving') {
    return false;
  }
  if (firstActionOwedNow.value) {
    return false;
  }
  return firstActionChainQuiet.value;
});
/** The seated corp's fetched preview (undefined = fetch pending/failed). */
const firstActionPreview = computed((): ActionPreview | undefined => {
  const corp = state.firstAct.corp;
  return corp === undefined ? undefined : firstActionPreviews.value.get(corp);
});
/**
 * WHAT THE TABLE ANSWERS to the seated corp's first action (TR81 — the forecast rides the preview, the forecast's
 * law 8): Lotus Innovations' «+2 [data]» for its own «+2 TR», a city's tile reactors, the parties.
 */
const firstActionForecast = computed((): EffectForecast | undefined => {
  return forecastForFixedBranch(firstActionPreview.value?.forecast, 0);
});
const firstActionForecastShown = computed((): boolean => {
  return forecastRowPresent(firstActionForecast.value);
});
/** The «Эффекты» door may open: the standing briefing, nothing on the wire, something to show (law 9). */
const firstActionForecastCanOpen = computed((): boolean => {
  return firstActionPanelShown.value && state.firstAct.stage === 'standing' && !state.firstAct.submitting &&
    forecastLayerAvailable(firstActionForecast.value);
});
const firstActionFxOpen = computed((): boolean => {
  return effectForecastOpen('start');
});
/** The crumb's tail while the layer stands — «ПЕРВОЕ ДЕЙСТВИЕ · ЭФФЕКТЫ», pre-translated (`stageRaw`). */
const firstActionFxStage = computed((): string | undefined => {
  return forecastStageText('start', 'First action');
});
const firstActionForecastOwners = computed((): ReadonlyArray<string> => {
  return forecastOwnerColors(firstActionForecast.value, props.playerView.players);
});
/**
 * THE FOCUSED CARD OF THE DEPLOYMENT QUEUE whose play the table answers (TR82 — the forecast's law 9: every
 * surface that draws the table's answer is a door): a Prelude, or the DEFERRED CORPORATION — a corporation that
 * answers its own tags (TR84 Titan Holdings: «including these» → «Сработает: +2 [leverage]») says so before the
 * press. Only the plain queue beat: a first-action briefing, an embedded step, the sponsor's hand, the colonies
 * and the risk stage speak for themselves.
 */
const queueForecastCard = computed((): CardName | undefined => {
  if (mode.value !== 'ceremony' || !ceremonyRevealed.value || firstActionPanelShown.value || embedPresenting.value ||
    sponsorStep.value || colonyStep.value || riskStage.value !== undefined || candidatePrompt.value !== undefined) {
    return undefined;
  }
  const item = focusedItem.value;
  return item === undefined || (item.kind !== 'prelude' && item.kind !== 'corp') || item.disabled ? undefined : item.name;
});
const queueForecast = computed((): EffectForecast | undefined => {
  const name = queueForecastCard.value;
  return name === undefined ? undefined : playForecasts.value.get(name);
});
const queueForecastShown = computed((): boolean => {
  return forecastRowPresent(queueForecast.value);
});
const queueForecastCanOpen = computed((): boolean => {
  return queueForecastShown.value && forecastLayerAvailable(queueForecast.value);
});
/** The ONE layer of the stage reads the door that opened it: the first action's briefing, else the queue's Prelude. */
const startForecast = computed((): EffectForecast | undefined => {
  return firstActionPanelShown.value ? firstActionForecast.value : queueForecast.value;
});
/** The layer titles a variant prelude's branch-tied facts by their branch — only while the variant is unchosen (P65 · GH). */
const startForecastBranches = computed((): ReadonlyArray<ForecastBranchInfo> => {
  const name = firstActionPanelShown.value ? undefined : queueForecastCard.value;
  if (name === undefined) {
    return [];
  }
  const preview = playPreviews.value.get(name);
  const chosen = preludeVariantRowOf(preview === undefined ? undefined : preludeVariantOf(name, preview), variantChosen.value.get(name));
  return preludeForecastBranches(name, preview, chosen?.position);
});
const startForecastCanOpen = computed((): boolean => {
  return firstActionForecastCanOpen.value || queueForecastCanOpen.value;
});
const startForecastOwners = computed((): ReadonlyArray<string> => {
  return forecastOwnerColors(startForecast.value, props.playerView.players);
});
const startForecastStats = computed((): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> => {
  return forecastStatsByColor(startForecastOwners.value);
});
/** The crumb's tail while the layer stands — «… · ЭФФЕКТЫ» after the stage the door stood on (`stageRaw`). */
const startFxStage = computed((): string | undefined => {
  return firstActionPanelShown.value ? firstActionFxStage.value : forecastStageText('start', wsStage.value);
});
/**
 * THE SEATED CARD'S LIVE CAPSULE (TR81): the committed count minus what is still in the air — a corporation that
 * answers its own first action lays its tokens HERE, and the capsule ticks on each touchdown. `undefined` for a card
 * the tableau does not hold (a prelude still in the queue) — the face then prints its pristine capsule.
 */
const seatCapsuleModel = computed((): CardModel | undefined => {
  const name = embedSourceVisible.value;
  // Only a HOLDER wears the live model: every other seated card keeps the name-only face its flights paint.
  if (name === undefined || getCard(name)?.resourceType === undefined) {
    return undefined;
  }
  const model = props.playerView.thisPlayer?.tableau.find((c) => c.name === name);
  if (model === undefined) {
    return undefined;
  }
  const held = heldCardCapsule(name);
  return held === 0 ? model : {...model, resources: Math.max(0, (model.resources ?? 0) - held)};
});
/** The printed ASK — the live option's buttonLabel (`initialActionText`),
 *  or the honest generic while the prompt has not arrived yet. */
const firstActionAskText = computed((): string => {
  const ask = firstActionAsk(props.playerView, state.firstAct.corp);
  return ask !== undefined ? translateText(ask) : translateText('Take the first action of your corporation');
});
/** The server-computed result chips of the seated corp's action. */
const firstActionEffects = computed((): ReadonlyArray<ActionEffect> => {
  return firstActionBranch(firstActionPreview.value)?.effects ?? [];
});
/** Skipped-effect warnings (the shared derivation — composer parity). */
const firstActionWarnings = computed((): Array<{title: string, reason: string, effect?: ActionEffect}> => {
  const branch = firstActionBranch(firstActionPreview.value);
  if (branch === undefined) {
    return [];
  }
  return skippedEffectViews(branch.steps).map((w) => ({
    title: w.title !== '' ? translateText(w.title) : '',
    reason: translateText(w.reason),
    effect: w.effect,
  }));
});
/** Honest post-confirm follow-ups («ДАЛЕЕ: разместите тайл города…») —
 *  the same presenters the play composer uses. */
const firstActionNotes = computed((): Array<NextStepRow> => {
  const branch = firstActionBranch(firstActionPreview.value);
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
    } else if (s.kind === 'delegateGrantFollowUp') {
      // A delegate on a resolution (TR83 The Deimos Group) — the vote is the step AFTER the confirm, in the Parliament.
      out.push(noteRow(nextRowText(delegateGrantFollowUpRow(s, 'confirm'), {text: translateText, params: translateTextWithParams})));
    }
  }
  return out;
});
/** The waiting readout — whose move the stage is calmly waiting out. */
const firstActionWaitLine = computed((): string => {
  const mate = startWaitMate(props.playerView, props.waitingOnPlayers);
  if (mate === undefined) {
    return translateText('The first action unlocks on your turn');
  }
  return translateTextWithParams('Waiting for ${0} to finish their move', [participantDisplayName(mate)]);
});
/**
 * THE HONEST WAIT LINE for the ceremony's status rail — «ожидаем» is a
 * claim about ANOTHER PLAYER, so it may only be said when there is one to
 * name. Empty otherwise: the deployment's own gaps (a submit round trip,
 * the beat between two stages) are not a wait for anybody, and printing
 * one there told a solo player they were waiting for a bot that was not
 * even moving.
 */
const ceremonyWaitLine = computed((): string => {
  const mate = startWaitMate(props.playerView, props.waitingOnPlayers);
  return mate === undefined ?
    '' :
    translateTextWithParams('Waiting for ${0} to finish their move', [participantDisplayName(mate)]);
});
/**
 * THE EFFECT'S RETURN IS STILL OWED — the source card has not finished its
 * journey into «РАЗЫГРАНО», or a half of the deployment is still receded.
 *
 * A separate question from `embedActive`: that one is about the SERVER
 * (is the effect still asking?), this one is about the SCREEN (has what
 * the effect started finished moving?). The scene may only dissolve when
 * both are answered.
 */
const effectReturnPending = computed((): boolean => {
  return embedSourceShown.value !== undefined ||
    embedSourceIncoming.value !== undefined ||
    queueReleased.value ||
    playedDockReleased.value;
});
/** The preludes already ON the authoritative tableau. */
const playedPreludes = computed((): ReadonlyArray<CardName> => {
  return props.playerView.thisPlayer.tableau
    .filter((c) => getCard(c.name)?.type === CardType.PRELUDE)
    .map((c) => c.name as CardName);
});
/**
 * THE STARTUP QUEUE — every unresolved start card as ONE persistent
 * physical row: the pending corporation, the draw/Merger candidates, the
 * prelude rail. A resolved card leaves; the rest only ever slide over.
 */
/** What mounts / unmounts the queue's box (the ceremony body's own `v-if`) — the observer re-attaches on it. */
const queueHostKey = computed((): string => {
  return `${mode.value}|${sponsorStep.value}|${colonyStep.value}`;
});
const queueCards = computed((): ReadonlyArray<QueueEntry> => {
  if (mode.value !== 'ceremony') {
    return [];
  }
  const out: Array<QueueEntry> = [];
  const corp = corpPlayCard.value;
  if (corp !== undefined) {
    out.push({name: corp.name, kind: 'corp', verb: 'Play now', dimmed: false, dealIdx: -1,
      reading: startQueueReading({kind: 'corp', playable: true, risk: undefined}, translateText)});
  }
  // CAMPAIGN: EVERY additional corporation stands PRE-LAID in the queue
  // from the first frame, in its activation order — dimmed until its own
  // merge press, active with «Слить» when its prompt arrives. Each wears
  // the Merger-rule fee badge up front; a merged corp leaves for
  // «Разыграно» via the hero flight (its tableau commit drops the entry).
  const activeMerge = corpMergeCard.value?.name;
  for (const name of campaignAdditionalUnplayed.value) {
    const active = name === activeMerge;
    out.push({
      name, kind: 'corp',
      verb: active ? 'Merge' : undefined,
      badge: 'Pay 42 M€.',
      dimmed: !active,
      dealIdx: -1,
    });
  }
  candidateCards.value.forEach((c, i) => {
    const disabled = c.isDisabled === true;
    // PL-1468: a drawn prelude that cannot resolve BURNS when chosen — said on the card before the press, in the
    // very word an own prelude wears (one reader: `candidateOutlook`), never a silent «Разыграть».
    const burn = disabled ? undefined : candidateOutlookOf.value(c.name);
    out.push({
      name: c.name, kind: 'candidate',
      verb: disabled ? undefined : candidateVerb.value,
      badge: disabled ? 'Unavailable' : preludeBadge(burn),
      badgeClass: disabled ? 'con-cards__pickband--disabled' : (burn !== undefined ? 'con-cards__pickband--warn' : undefined),
      ...(burn !== undefined ? {reading: startQueueReading({kind: 'prelude', playable: true, risk: preludeRisk(burn, (n) => translateText(n), {hold: true})}, translateText)} : {}),
      // The server's own reason (Merger's unaffordable corps say so). This
      // used to be hardcoded `undefined`, so the template's reason line
      // never rendered and a dimmed card carried a bare «Недоступна».
      reason: disabled ? disabledCardReason(c) : undefined,
      dimmed: disabled,
      dealIdx: i,
    });
  });
  const preludesLive = startFlowPreludePrompt(props.playerView) !== undefined;
  const focusedOutlook = focusedItem.value?.kind === 'prelude' ?
    outlookOf.value(focusedItem.value.name) : undefined;
  for (const e of preludeRail.value) {
    const playable = e.status === 'playable' && preludesLive;
    // A prelude whose effect cannot resolve stays fully pressable — the
    // badge warns, it never withholds. But it must warn ACCURATELY: a flat
    // «СГОРИТ» over a card that is one ordinary press away from working is
    // the same false alarm the whole order-aware pass exists to remove, so
    // the badge is the verdict's own word («СНАЧАЛА ДРУГОЙ ПРОЛОГ» / «ПОКА
    // НЕТ ДОСТУПНОЙ ЦЕЛИ» / «ЭФФЕКТ НЕ СРАБОТАЕТ»). It rides the pickband —
    // OUTSIDE the dimmable card body — so a state badge never fades with
    // the card it describes.
    const badge = playable ? preludeBadge(e.outlook) : undefined;
    // …and while a waiting card is focused, every prelude that could open
    // it wears the tie. EVERY one, equally: singling one out would be the
    // screen choosing the player's order for them.
    const enabler = playable && isPreludeEnabler(focusedOutlook, e.name);
    // «Продление программы»: a prelude carried from the previous mission says so (a quiet band, never a warning).
    const carried = carriedPreludeNames.value.has(e.name) && badge === undefined && !enabler;
    out.push({
      name: e.name, kind: 'prelude',
      verb: playable ? 'Play now' : undefined,
      badge: enabler && badge === undefined ? preludeEnablerBadge(focusedOutlook) : (carried ? translateText('Legacy') : badge),
      badgeClass: enabler && badge === undefined ?
        'con-cards__pickband--enabler' :
        (badge !== undefined ? 'con-cards__pickband--warn' : (carried ? 'con-cards__pickband--legacy' : undefined)),
      enabler,
      dimmed: !playable,
      dealIdx: -1,
      reading: startQueueReading({kind: 'prelude', playable, risk: preludeRisk(e.outlook, (n) => translateText(n), {hold: true})}, translateText),
    });
  }
  return out;
});
/**
 * ONE VISUAL OWNER — the queue slot of a card whose hero has physically
 * left it. From the lift to the transaction's end the slot stands
 * empty-held (`.con-deal-hold`); the tableau commit then removes the
 * entry and the neighbours FLIP over the freed space. The source face can
 * never coexist with the flying hero.
 */
const heroDepartedName = computed((): CardName | undefined => {
  const hero = heroState;
  if (!hero.active || hero.card === undefined) {
    return undefined;
  }
  // NOT during 'preparing': the director is still measuring/covering the
  // source there (its own holdSource blanks it in the same turn the proxy
  // lands over it) — hiding a frame earlier reads as the card blinking
  // out before anything picks it up.
  const p = hero.phase;
  return p === 'idle' || p === 'armed' || p === 'shipping' || p === 'failed' || p === 'preparing' ? undefined : hero.card;
});
const picks = computed(() => {
  return {
    corp: state.corp,
    preludes: state.preludes,
    ceo: state.ceo,
    projects: state.projects,
  };
});
const stepEntries = computed((): ReadonlyArray<CardModel> => {
  return currentStep.value?.input.cards ?? [];
});
/** Live models aligned with the deal's card list — the flying face must
 *  match the landed face (the parity contract). */
const dealModels = computed((): Array<CardModel | undefined> => {
  const pool = stepEntries.value;
  return deal.value.state.cards.map((name) => pool.find((c) => c.name === name));
});
const focusedCard = computed((): CardModel | undefined => {
  return stepEntries.value[focusIdx.value];
});
/**
 * THE FOCUS COMMIT (see `startRailCommitted`): card-specific rail payload
 * may publish only when the stage transition has settled AND the deal
 * cinematic is not holding the cards. Before that the rail knows no card.
 */
const railCommitted = computed((): boolean => {
  return startRailCommitted({
    dealActive: deal.value.state.active,
    transitionPhase: transition.phase,
  });
});
/**
 * The ONE gated source of the rail's card-specific payload. Name,
 * availability and pick state all derive from it, so they publish and
 * retract as one atomic value — a name without availability (or a stale
 * card surviving into the next stage) is unrepresentable.
 */
const railCard = computed((): CardModel | undefined => {
  return railCommitted.value ? focusedCard.value : undefined;
});
/** The COMMITTED card's availability, DRAFT voice (see the module). */
const focusedAvailability = computed((): CardAvailabilityView | undefined => {
  return startCardAvailability(railCard.value);
});
/** Does THIS step reserve the rail's two-row availability zone? */
const railShowsAvailability = computed((): boolean => {
  return stepShowsAvailability(stepEntries.value);
});
const picksHere = computed((): ReadonlyArray<CardName> => {
  const step = currentStep.value;
  return step !== undefined ? picksForStep(picks.value, step.id) : [];
});
/** P13: the 10-card projects step wraps into a comparison GRID. */
const wizardGrid = computed((): boolean => {
  return stepEntries.value.length > 6;
});
const singlePickStep = computed((): boolean => {
  const step = currentStep.value;
  return step !== undefined && step.input.min === 1 && step.input.max === 1;
});
/** P15: at the pick max, unpicked cards de-emphasize (desktop parity). */
const dimUnpicked = computed((): boolean => {
  const step = currentStep.value;
  return step !== undefined && picksHere.value.length >= step.input.max;
});
/** Can A pick the focused (unpicked) card right now? (single-pick
 *  REPLACES the selection; multi-pick blocks at the max.) */
const canPickFocused = computed((): boolean => {
  const step = currentStep.value;
  if (step === undefined) {
    return false;
  }
  if (focusedUnaffordable.value) {
    return false;
  }
  return singlePickStep.value || picksHere.value.length < step.input.max;
});
/** The whole chosen setup, for the summary's fullscreen browse (X). The
 *  order (corp → preludes → CEO → projects) matches the summary's DOM row
 *  order, so a flat focus index maps 1:1 onto the rendered tiles. */
const summaryCards = computed((): ReadonlyArray<CardModel> => {
  const names: Array<CardName> = [];
  if (state.corp !== undefined) {
    names.push(state.corp);
  }
  names.push(...state.preludes);
  if (state.ceo !== undefined) {
    names.push(state.ceo);
  }
  names.push(...state.projects);
  // The summary browses SYNTHETIC models (the tiles only need a name) —
  // but the requirement verdict must survive the trip: a card that was
  // «требование пока не выполнено» on the buy step is still that on the
  // review screen. Only the reasons are carried over; everything else
  // stays synthetic, so the face renders exactly as it did before.
  const reasons = stepReasons.value;
  return names.map((name) => {
    const r = reasons.get(name);
    return (r === undefined ? {name} : {name, unplayableReasons: r}) as CardModel;
  });
});
/** The server's per-card reasons, addressed by name across every step. */
const stepReasons = computed((): Map<CardName, ReadonlyArray<UnplayableReason>> => {
  const out = new Map<CardName, ReadonlyArray<UnplayableReason>>();
  for (const st of steps.value) {
    for (const card of st.input.cards) {
      if (card.unplayableReasons !== undefined) {
        out.set(card.name, card.unplayableReasons);
      }
    }
  }
  return out;
});
/** True on the wizard's final summary (no live step). */
const onSummary = computed((): boolean => {
  return mode.value === 'wizard' && currentStep.value === undefined;
});
/** The summary pane KEEPS RENDERING through the materialization until
 *  the SWAP moment (`matSwap`): the capture proxies stand over its cards
 *  by then, and the deployment replaces it UNDER them in one turn. */
const summaryShown = computed((): boolean => {
  // PREWARM: mounted (and laid out at its final box) but held invisible —
  // its tiles are the destinations the convoy has to measure BEFORE it
  // starts, and a `v-show`-hidden pane has no geometry at all.
  return summaryPrewarm.value || onSummary.value || state.flow === 'committing' ||
    (state.flow === 'materializing' && !matSwap.value) ||
    // SENT, WAITING FOR THE TABLE: the summary is still the player's
    // screen — their picks, their numbers, nothing asked of them.
    awaitingOthers.value;
});
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
const prepSurfaceLive = computed((): boolean => {
  return mode.value === 'wizard' || (state.flow === 'materializing' && !matSwap.value);
});
/**
 * The summary is the setup's WAITING ROOM as much as it is a review: the
 * game cannot start until every player has picked. This is the honest
 * readout of that (the SHARED status brain — see startLaunchState).
 */
const launch = computed((): StartLaunchState => {
  return startLaunchState(props.playerView, props.waitingOnPlayers);
});
/**
 * The confirm's VERB. Nobody else owes a pick → this press is the last
 * input the game needs, so it genuinely BEGINS the game; while somebody
 * else is still choosing it only submits the viewer's own choice.
 *
 * The press itself is NEVER gated on the others (only its wording): two
 * humans sitting on their summaries are both pending for each other, so a
 * hard gate would leave them waiting on one another forever.
 */
const launchVerb = computed((): string => {
  return launch.value.launches ? 'Begin the game' : 'Submit your choice';
});
/** The prewarmed summary's inline box: an absolute copy of the cards
 *  body's rect, so the fit engine solves the geometry the pane will
 *  ACTUALLY have once it becomes the body — nothing re-flows at the swap
 *  and every measured tile rect stays valid across it. */
const prewarmStyle = computed((): Record<string, string> => {
  const box = prewarmBox.value;
  if (!summaryPrewarm.value || box === undefined) {
    return {};
  }
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  };
});
/** Flat-index offsets so each summary section maps onto `summaryCards`. */
const summaryPreludeBase = computed((): number => {
  return state.corp !== undefined ? 1 : 0;
});
const summaryCeoIdx = computed((): number => {
  return summaryPreludeBase.value + state.preludes.length;
});
const summaryProjectBase = computed((): number => {
  return summaryCeoIdx.value + (state.ceo !== undefined ? 1 : 0);
});
const currentStepComplete = computed((): boolean => {
  const step = currentStep.value;
  if (step === undefined) {
    return true;
  }
  if (step.id === 'projects' && !budgetOk.value) {
    return false;
  }
  return stepComplete(step, picks.value);
});
/** «из M» — the counter's / picked-chip's plain denominator (the server's
 *  pick max; readiness styling carries the min). */
const ofMaxText = computed((): string => {
  const step = currentStep.value;
  if (step === undefined) {
    return '';
  }
  return translateTextWithParams('of ${0}', [String(step.input.max)]);
});
/** The limit message: cause + recovery, calm amber (never an error). */
const limitText = computed((): string => {
  const step = currentStep.value;
  if (step === undefined) {
    return '';
  }
  const max = String(step.input.max);
  return translateTextWithParams(
    'Limit ${0}/${1} reached — deselect one of the marked cards', [max, max]);
});
/** PROJECTS step: adding the focused (unpicked) card would break the budget
 *  (every project costs the same, so this is really "no room for one more"
 *  — a NORMAL limit, surfaced per-card so the rail can explain it). */
const focusedUnaffordable = computed((): boolean => {
  const step = currentStep.value;
  const card = focusedCard.value;
  const corp = state.corp;
  if (step === undefined || step.id !== 'projects' || card === undefined || corp === undefined) {
    return false;
  }
  if (isPickedHere(card.name)) {
    return false;
  }
  return (wizardRemaining.value(state.projects.length + 1) ?? 0) < 0;
});
/** The pinned status rail's LOCAL state for the focused card. Never the
 *  global «N из M» progress (that lives in the header counter) — only the
 *  focused card's own state + a short hint. */
const statusRailKind = computed((): 'picked' | 'unaffordable' | 'limit' | 'hint' => {
  const step = currentStep.value;
  // The COMMITTED card only: before the focus commit the rail knows no
  // card, so its state line stays the neutral step hint.
  const card = railCard.value;
  if (step === undefined || card === undefined) {
    return 'hint';
  }
  if (isPickedHere(card.name)) {
    return 'picked';
  }
  if (focusedUnaffordable.value) {
    return 'unaffordable';
  }
  if (!singlePickStep.value && picksHere.value.length >= step.input.max) {
    return 'limit';
  }
  return 'hint';
});
/** The rail's kind modifier — applied only past the focus commit, so the
 *  height-reserving empty rail during the cinematic / stage transition
 *  stays neutral (no coloured border) until its content fades in. */
const statusRailClass = computed((): string => {
  return railCommitted.value ? 'con-start__statusrail--' + statusRailKind.value : '';
});
const statusRailText = computed((): string => {
  switch (statusRailKind.value) {
  case 'picked':
    return translateText('Card selected');
  case 'unaffordable':
    return translateText('Not enough funds to add this card');
  case 'limit':
    return limitText.value;
  default:
    return stepHint.value;
  }
});
/** A short hint for the current pick — never a controller prompt, never the
 *  global progress. Preludes: how many still to pick; projects: available;
 *  single-pick (corp/CEO): the header states the task, so no rail hint. */
const stepHint = computed((): string => {
  const step = currentStep.value;
  if (step === undefined) {
    return '';
  }
  if (step.id === 'projects') {
    return translateText('Available to buy');
  }
  if (singlePickStep.value) {
    return '';
  }
  const remaining = step.input.min - picksHere.value.length;
  return remaining > 0 ? translateTextWithParams('Select ${0} more', [String(remaining)]) : '';
});
/** Economy is COMPACT on corp / prelude (nothing bought yet → just the
 *  available funds); the projects step + summary show the full breakdown. */
const moneyCompact = computed((): boolean => {
  const step = currentStep.value;
  return step !== undefined && step.id !== 'projects';
});
/** The compact readout's available funds (start + any prelude effect). */
const moneyAvailable = computed((): number => {
  const b = budget.value;
  return b === undefined ? 0 : b.start + b.preludes;
});
/** CAMPAIGN: the lineage's money contribution (starting M€ + bonus −
 *  the merge fee, and the stacked card-cost delta) — the client mirror of
 *  the server's `campaignStartingBudget`. Zeros in ordinary games. */
const campaignExtra = computed((): {megaCredits: number, cardCostDelta: number, mergeFee: number} => {
  return campaignWizardExtra(props.playerView);
});
const cardCost = computed((): number => {
  return startCardPrice(cardCostForCorp(state.corp), campaignExtra.value.cardCostDelta);
});
/** Who set a non-default `cardCost` — the pick and the campaign lineage (`purchasePriceSource.ts`); '' at 3 M€. */
const startPriceHint = computed((): string => {
  const lineage = props.playerView.game.gameOptions.campaign?.grants.find((g) => g.color === props.playerView.thisPlayer.color)?.corporations ?? [];
  return purchasePriceHint(startPurchasePriceSource(cardCost.value, [...lineage, state.corp]));
});
/** The wizard funds after `buys` purchases — ONE formula for the budget,
 *  the per-card gate and the pick guard (campaign-aware). */
/**
 * The starting M€ the CORPORATION pick brings — the pick's own; in a campaign finale that deploys its lineage (no
 * corporation step at all) nothing is picked and the lineage's money is the whole of `campaignExtra` (0 here).
 * `undefined` = not known yet (a corporation step whose pick is still open).
 */
const startCorpMc = computed((): number | undefined => {
  const corp = state.corp;
  if (corp !== undefined) {
    return startingMegacredits(corp, 0);
  }
  const deploysLineage = props.playerView.game.gameOptions.campaign !== undefined && !steps.value.some((st) => st.id === 'corp') &&
    campaignLineage.value.length > 0;
  return deploysLineage ? 0 : undefined;
});
const wizardRemaining = computed((): (buys: number) => number | undefined => {
  return (buys: number) => {
    const base = startCorpMc.value;
    if (base === undefined) {
      return undefined;
    }
    return base + campaignExtra.value.megaCredits - buys * cardCost.value;
  };
});
/** The purchase ledger stands on the project step whenever the money is known. */
const ledgerShown = computed((): boolean => {
  return mode.value === 'wizard' && currentStep.value?.id === 'projects' && budget.value !== undefined;
});
/** What is left after the buy — the start's money, the preludes' own M€, minus the picks. */
const ledgerLeft = computed((): number => {
  const b = budget.value;
  return b === undefined ? 0 : b.remaining + b.preludes;
});
/**
 * What the purchase ledger SHOWS: the live money — or, while a tender's sheet still hands the screen back, the values
 * it stood at before the press: a price «Субсидия» changed ticks on the purchase page the player returns to, never
 * under the sheet's stamp (the storyboard of 2026-11-09).
 */
const ledgerView = computed((): {buys: number, cost: number, left: number} | undefined => {
  if (ledgerHold.value !== undefined) {
    return ledgerHold.value;
  }
  const b = budget.value;
  return b === undefined ? undefined : {buys: b.buys, cost: b.cardCost, left: ledgerLeft.value};
});
const budget = computed((): {start: number, buys: number, cardCost: number, remaining: number, preludes: number} | undefined => {
  const corp = state.corp;
  const base = startCorpMc.value;
  if (base === undefined) {
    return undefined;
  }
  const buys = state.projects.length;
  return {
    start: base + campaignExtra.value.megaCredits,
    buys,
    cardCost: cardCost.value,
    remaining: wizardRemaining.value(buys) ?? 0,
    preludes: afterPreludes(corp, state.preludes, buys),
  };
});
const budgetOk = computed((): boolean => {
  const b = budget.value;
  return b === undefined || b.remaining >= 0;
});
const wizardReady = computed((): boolean => {
  // Every step complete → the summary X can submit.
  return steps.value.every((s) => stepComplete(s, picks.value)) && budgetOk.value;
});
// ── ceremony ─────────────────────────────────────────────────────
/** The DEFERRED 'play your corporation' prompt (marker corporationPlay).
 *  While it is live the corp is genuinely UNPLAYED on the server. */
const corpPlayPrompt = computed((): SelectCardModel | undefined => {
  return mode.value === 'ceremony' ? startFlowCorpPlayPrompt(props.playerView) : undefined;
});
const corpPlayCard = computed((): CardModel | undefined => {
  return corpPlayPrompt.value?.cards?.[0];
});
/** The DEFERRED card-payment beat's cost (undefined = nothing to pay:
 *  the step is skipped entirely, exactly as the rules read). */
const corpPayCost = computed((): {megacredits: number, cards: number} | undefined => {
  return mode.value === 'ceremony' ? startFlowCorpPayPrompt(props.playerView) : undefined;
});
/** CAMPAIGN missions 2–3: the deliberate «СЛИЯНИЕ» press (marker
 *  `corporationMerge`) — the freshly picked corporation plays ON TOP of
 *  the established lineage, its starting M€ / effects applying at THIS
 *  press (never silently inside the base corporation's beat). */
const corpMergePrompt = computed((): SelectCardModel | undefined => {
  return mode.value === 'ceremony' ? startFlowMergePrompt(props.playerView) : undefined;
});
const corpMergeCard = computed((): CardModel | undefined => {
  return corpMergePrompt.value?.cards?.[0];
});
/** CAMPAIGN «Наследие проектов»: the carried-cards press (marker
 *  `campaignLegacy` — it carries only the COUNT; the identities stay the
 *  owner's own reveal, which deals them into the hand dock). */
const legacyPrompt = computed((): {cards: number} | undefined => {
  return mode.value === 'ceremony' ? startFlowLegacyPrompt(props.playerView) : undefined;
});
/** The viewer's frozen campaign lineage (the established corporations).
 *  What tells the MERGE hero apart from a lineage corp's own play. */
const campaignLineage = computed((): ReadonlyArray<CardName> => {
  const contract = props.playerView.game.gameOptions.campaign;
  const color = props.playerView.thisPlayer.color;
  // The self model names the lineage this mission DEPLOYS (a «Реструктуризация» at the finale's start rewrites
  // it); the frozen grant is the fallback.
  return props.playerView.campaignLineage ?? contract?.grants.find((g) => g.color === color)?.corporations ?? [];
});
/**
 * The ADDITIONAL corporations of this mission, in deployment order:
 * lineage[1..] (missions 3–4 re-merge the whole company), then the fresh
 * pick (missions 2–3). Each merges by its own press and pays the fee.
 */
const campaignAdditionalNames = computed((): ReadonlyArray<CardName> => {
  const contract = props.playerView.game.gameOptions.campaign;
  const lineage = campaignLineage.value;
  if (contract === undefined || lineage.length === 0) {
    return []; // ordinary game / mission 1 (the pick is the base)
  }
  const out: Array<CardName> = [...lineage.slice(1)];
  // A three-mission finale still drafts its third — that pick merges like every pick.
  if (!contract.final || campaignFinalePicksCorporation(lineage.length)) {
    for (const c of props.playerView.pickedCorporationCard) {
      out.push(c.name);
    }
  }
  return out;
});
/** The merge chapter exists whenever an additional corporation does. */
const mergeChapterExists = computed((): boolean => {
  return campaignAdditionalNames.value.length > 0;
});
/** Additional corps not yet on the tableau — the PRE-LAID merge queue
 *  (each stands in the deployment row from the first frame, dimmed until
 *  its own press). */
const campaignAdditionalUnplayed = computed((): ReadonlyArray<CardName> => {
  const onTable = new Set(props.playerView.thisPlayer.tableau.map((c) => c.name));
  return campaignAdditionalNames.value.filter((n) => !onTable.has(n));
});
/** The comeback bonus this seat is owed (0 = no chapter). */
const campaignBonusAmount = computed((): number => {
  const contract = props.playerView.game.gameOptions.campaign;
  const grant = contract?.grants.find((g) => g.color === props.playerView.thisPlayer.color);
  return grant?.bonusMegaCredits ?? 0;
});
/** The live «Бонус кампании» press (marker `campaignBonus`). */
const bonusPrompt = computed((): {megaCredits: number} | undefined => {
  return mode.value === 'ceremony' ? startFlowBonusPrompt(props.playerView) : undefined;
});
/** The bonus plate stands PRE-LAID from the first ceremony frame and
 *  leaves when its press has been answered (the chip flew to the rail). */
const bonusPlateShown = computed((): boolean => {
  return mode.value === 'ceremony' && campaignBonusAmount.value > 0 &&
    (bonusPrompt.value !== undefined || corpPlayPrompt.value !== undefined);
});
/** The carried cards, FACE UP (owner-only wire field) — the «НАСЛЕДИЕ»
 *  row renders them exactly like the bought projects. */
const legacyRowCards = computed((): ReadonlyArray<CardModel> => {
  return props.playerView.campaignCarriedCards ?? [];
});
/** The carried cards have already joined the hand (the press happened). */
const legacyGranted = computed((): boolean => {
  const carried = legacyRowCards.value;
  if (carried.length === 0) {
    return true;
  }
  const hand = new Set(props.playerView.cardsInHand.map((c) => c.name));
  return carried.every((c) => hand.has(c.name));
});
/** The legacy row stands PRE-LAID until its cards leave for the dock. */
const legacyRowShown = computed((): boolean => {
  return mode.value === 'ceremony' && legacyRowCards.value.length > 0 && !legacyGranted.value;
});
/** The carried cards' delivery flight into the dock is still running. */
const legacyArrivalLive = computed((): boolean => {
  const names = new Set([...handDeliveryState.held, ...handDeliveryState.inFlight]);
  return legacyRowCards.value.some((c) => names.has(c.name));
});
/** The merge FEE's own payment prompt stands (a lineage with an alt
 *  payment path — Helion's heat, Luna Trade Federation's titanium —
 *  gets a real payment choice): the merge chapter is still the player's
 *  place. Bounded structurally: ≥2 corporations (the pick is merged),
 *  no prelude touched yet (the fee resolves before the prelude stage). */
const mergeFeeStands = computed((): boolean => {
  return mode.value === 'ceremony' && mergeChapterExists.value &&
    wf.value?.type === 'payment' &&
    corporationCardNames(props.playerView).length >= 2 &&
    playedPreludes.value.length === 0;
});
/** The legacy chapter is KNOWN from the first frame (the owner's own
 *  wire field carries the carried cards) and never leaves the rail once
 *  seen (`legacySeen`). */
const legacyChapterExists = computed((): boolean => {
  return legacyRowCards.value.length > 0 || legacyPrompt.value !== undefined ||
    legacyArrivalLive.value || state.legacySeen;
});
/** The «НАСЛЕДИЕ» dock block (campaign missions 2+): the acquired
 *  corporations, visible through the WHOLE preparation. Context, never
 *  a pick — a click / R3 descends into the legacy overview.
 *  Gated on the LINEAGE ITSELF, never on the merge chapter: on mission 2
 *  the lineage is exactly ONE corporation and no additional corp exists
 *  yet in the wizard (the pick is unsubmitted), so a merge-chapter gate
 *  silently hid the block precisely where it mattered. */
const lineageDock = computed((): ReadonlyArray<CardName> => {
  return mode.value === 'wizard' ? campaignLineage.value : [];
});
/** «Наследие проектов» on the same shelf: the carried project cards
 *  (owner-only wire field), face-up beside the corporations — their
 *  identity can change what the player buys, so they stand through the
 *  WHOLE preparation. */
const carriedDock = computed((): ReadonlyArray<CardName> => {
  return mode.value === 'wizard' ? legacyRowCards.value.map((c) => c.name) : [];
});
/** THE LEGACY OVERVIEW's card set — corporations first, then the carried
 *  projects (the same reading order as the shelf blocks). One flat list:
 *  the d-pad walks it freely across both zones. */
const legacyOverviewCards = computed((): ReadonlyArray<CardModel> => {
  return [
    ...lineageDock.value.map((name) => ({name}) as CardModel),
    ...(mode.value === 'wizard' ? legacyRowCards.value : []),
  ];
});
const legacyOverviewCorpCount = computed((): number => {
  return lineageDock.value.length;
});
// ── CAMPAIGN «ТЕНДЕРЫ» — THE DOOR (§19) and a tender's MODE on its page (§16.3 · §19) ──
/** The page the player stands on — what decides which tenders execute HERE. */
const tenderStandingPage = computed((): TenderStandingPage => {
  if (mode.value !== 'wizard' || onSummary.value || currentStep.value === undefined) {
    return 'summary';
  }
  return currentStep.value.id;
});
/** The portfolio's context — the page, the live deal, the picks' ceilings, the price, the lineage. */
const portfolioContext = computed((): StartPortfolioContext | undefined => {
  const input = wizardInput.value;
  if (input === undefined || (input.tenders ?? []).length === 0) {
    return undefined;
  }
  const stepOf = (id: StartWizardStepId) => steps.value.find((st) => st.id === id)?.input;
  const prelude = stepOf('prelude');
  const projects = stepOf('projects');
  return {
    place: 'start',
    tenders: input.tenders ?? [],
    page: tenderStandingPage.value,
    preludesDealt: prelude?.cards.length ?? 0,
    preludePick: prelude?.max ?? 0,
    projectsDealt: projects?.cards.length ?? 0,
    projectsMax: projects?.max ?? 0,
    cardCost: preview.value?.cardCost ?? 0,
    lineage: campaignLineage.value,
    corporationsDealt: stepOf('corp')?.cards.length ?? 0,
  };
});
/** Every holding in ACQUISITION order (the dock's stable row, the summary). */
const portfolioEntries = computed((): ReadonlyArray<TenderPortfolioEntry> => {
  const ctx = portfolioContext.value;
  return ctx === undefined ? [] : tenderPortfolio(ctx);
});
/** …in the DOOR's order: the ones that execute on this page first, then the others with their reason. */
const doorEntries = computed((): ReadonlyArray<TenderPortfolioEntry> => {
  return tenderDoorList(portfolioEntries.value);
});
const portfolioCounts = computed((): {executed: number, open: number, total: number} => {
  return tenderPortfolioCounts(portfolioEntries.value);
});
/** The dock's «ТЕНДЕРЫ» block is a door on every wizard page (the summary included — the list says where each goes). */
const tenderDoorAvailable = computed((): boolean => {
  return mode.value === 'wizard' && portfolioEntries.value.length > 0;
});
/** How many tenders execute on THIS page — the door lights only then (never while a mode already stands). */
const tenderReadyCount = computed((): number => {
  if (!tenderDoorAvailable.value || state.tenderMode !== undefined) {
    return 0;
  }
  return tenderReadyHere(portfolioEntries.value);
});
/** The door's phrase is running or a tender's answer is on the wire — a press now is absorbed, and SAID so (the ledger). */
const tenderDoorMoving = computed((): boolean => {
  const p = tenderView.value.phase;
  return p === 'fading' || p === 'entering' || p === 'leaving' || state.tenderBusy !== undefined || state.restructureOpening !== undefined;
});
/** The door's list exists (any phase past closed) — input routes to it. */
const tenderViewOn = computed((): boolean => {
  return tenderView.value.phase !== 'closed';
});
/** …and owns the screen (the crumb's tail, the bar) — the page surfaced back = the list let go. */
const tenderViewOwnsScreen = computed((): boolean => {
  return tenderViewOn.value && !tenderPageRestored.value;
});
/** …and covers the body (the parked page is v-show-hidden through the open). */
const tenderViewCovers = computed((): boolean => {
  const p = tenderView.value.phase;
  return p === 'entering' || p === 'open' || (p === 'leaving' && !tenderPageRestored.value);
});
/** The focused certificate of the open list. */
const focusedDoorEntry = computed((): TenderPortfolioEntry | undefined => {
  return tenderView.value.phase === 'open' ? doorEntries.value[tenderView.value.focus] : undefined;
});
/** The holdings that execute on the page standing now — the dock lights only these. */
const tenderReadyInstances = computed((): ReadonlyArray<string> => {
  return doorEntries.value.filter((e) => e.state === 'ready').map((e) => e.instance);
});
/** The sheet's certificate (its live entry). */
const tenderSheetEntry = computed((): TenderPortfolioEntry | undefined => {
  const sheet = tenderSheet.value;
  return sheet === undefined ? undefined : portfolioEntries.value.find((e) => e.instance === sheet.instance);
});
/** The table's facts the sheet's RESULT reads. */
const activationFacts = computed((): ActivationFacts => {
  const ctx = portfolioContext.value;
  const live = tenderSheet.value === undefined ? undefined : (wizardInput.value?.tenders ?? []).find((t) => t.instance === tenderSheet.value?.instance);
  const b = budget.value;
  return {
    preludesDealt: ctx?.preludesDealt ?? 0,
    preludePick: ctx?.preludePick ?? 0,
    projectsDealt: ctx?.projectsDealt ?? 0,
    projectsMax: ctx?.projectsMax ?? 0,
    corporationsDealt: ctx?.corporationsDealt ?? 0,
    lineage: campaignLineage.value.length,
    cardCost: cardCost.value,
    projectsPicked: state.projects.length,
    fundsLeft: b === undefined ? undefined : b.remaining + b.preludes,
    preludesPicked: state.preludes.length,
    corporationPicked: state.corp !== undefined,
    ...(live?.deckLeft !== undefined ? {deckLeft: live.deckLeft} : {}),
    ...(sheetTagPicked.value !== undefined && live?.tagCounts?.[sheetTagPicked.value] !== undefined ? {tagCount: live.tagCounts[sheetTagPicked.value]} : {}),
  };
});
const tenderSheetPlan = computed((): TenderActivationPlan | undefined => {
  const sheet = tenderSheet.value;
  if (sheet === undefined) {
    return undefined;
  }
  // Past the press the sheet tells what WAS decided: the answer reshapes the table under it at once, and a live plan
  // read «6 → 8» over a press that made «4 → 6» (the storyboard of 2026-11-09).
  return sheet.phase !== 'open' && sheet.phase !== 'entering' && sheetPlanFrozen.value !== undefined ?
    sheetPlanFrozen.value : startActivationPlan(sheet.id, activationFacts.value);
});
/** «Целевой запрос»'s medallions on the sheet — the table's printed tags with the deck's own counts. */
const sheetTags = computed((): ReadonlyArray<ActivationTag> | undefined => {
  const sheet = tenderSheet.value;
  if (sheet === undefined || sheet.id !== 'targetedRequest') {
    return undefined;
  }
  const live = (wizardInput.value?.tenders ?? []).find((t) => t.instance === sheet.instance);
  const counts = live?.tagCounts ?? {};
  return requestTags.value.map((tag) => ({tag, label: tagLabel(tag), count: counts[tag] ?? Number.POSITIVE_INFINITY, iconStyle: tagIconStyle(tag)}));
});
/** The bar's facts while the sheet stands. */
const tenderSheetFacts = computed((): {verb: string, enabled: boolean, tag: boolean, pickLabel: string, pickEnabled: boolean} | undefined => {
  const sheet = tenderSheet.value;
  const plan = tenderSheetPlan.value;
  if (sheet === undefined || plan === undefined) {
    return undefined;
  }
  const live = sheet.phase === 'open' && state.tenderBusy === undefined;
  const tags = sheetTags.value;
  if (tags !== undefined) {
    const focused = tags[sheetTagFocus.value];
    const none = focused !== undefined && focused.count === 0;
    return {verb: plan.verb, enabled: live && sheetTagPicked.value !== undefined, tag: true,
      pickLabel: none ? 'No card with this tag is left' : focused !== undefined && sheetTagPicked.value === focused.tag ? 'Unpick' : 'Choose this tag',
      pickEnabled: live && focused !== undefined && !none};
  }
  return {verb: plan.verb, enabled: live, tag: false, pickLabel: '', pickEnabled: false};
});
/** The bar's facts while the list stands: A executes the focused certificate — disabled, never hidden, elsewhere. */
const tenderListFacts = computed((): {enabled: boolean} | undefined => {
  if (!tenderViewOwnsScreen.value || tenderSheet.value !== undefined) {
    return undefined;
  }
  const e = focusedDoorEntry.value;
  return {enabled: e !== undefined && e.state === 'ready' && state.tenderBusy === undefined};
});
/** The start-window tenders still executable when the player would leave the selection — the terminal warning's list. */
const openStartTenders = computed((): ReadonlyArray<TenderPortfolioEntry> => {
  return portfolioEntries.value.filter((e) => e.state === 'ready' || e.state === 'elsewhere');
});
const tenderWarningText = computed((): string => {
  const names = openStartTenders.value.map((e) => translateText(tenderPortfolioName(e.id))).join(' · ');
  return translateTextWithParams('Unexecuted: ${0}', [names]) + ' — ' +
    translateTextWithParams('Unexecuted tenders are bought back for ${0} M€ each after the start — press again to begin anyway', [String(TENDER_COMPENSATION_MC)]);
});
/** The dock's «ТЕНДЕРЫ» block — every holding in acquisition order. */
const dockTenders = computed((): ReadonlyArray<{instance: string, id: TenderId, status: 'held' | 'executed' | 'cashed'}> => {
  return portfolioEntries.value.map((e) => ({instance: e.instance, id: e.id, status: e.status}));
});
/** The standing mode's certificate (its live entry — the reading in this page's numbers). */
const tenderModeEntry = computed((): TenderPortfolioEntry | undefined => {
  const mode = state.tenderMode;
  return mode === undefined ? undefined : portfolioEntries.value.find((e) => e.instance === mode.instance);
});
/** A mode stands on the page the player sees (never under the list or the legacy overview). */
const tenderModeLive = computed((): boolean => {
  return mode.value === 'wizard' && state.tenderMode !== undefined && !tenderViewOwnsScreen.value && !legacyStageOwnsScreen.value;
});
/** A CONFIRM mode — a previewed effect standing on its page until A executes it. */
const confirmMode = computed((): Extract<StartTenderMode, {kind: 'confirm'}> | undefined => {
  const mode = state.tenderMode;
  return mode !== undefined && mode.kind === 'confirm' ? mode : undefined;
});
const reviewMode = computed((): Extract<StartTenderMode, {kind: 'review'}> | undefined => {
  const mode = state.tenderMode;
  return mode !== undefined && mode.kind === 'review' && currentStep.value?.id === mode.pool ? mode : undefined;
});
/**
 * The cards the standing mode sends back to the deck — their band on the deal strip: the exchange's marked cards,
 * or EVERY card of the page under a gamble's confirm (what «пересдать всё» means, seen before the press).
 */
const stripRelease = computed((): ReadonlySet<CardName> => {
  const review = reviewMode.value;
  if (review !== undefined) {
    return new Set(review.release);
  }
  const confirm = confirmMode.value;
  if (confirm !== undefined && isGambleTender(confirm.id) && tenderPageOf(confirm.id) === currentStep.value?.id) {
    return new Set(stepEntries.value.map((c) => c.name));
  }
  return new Set();
});
/** The most cards the exchange may return — what its pool's deck can still give (the server's `deckLeft`). */
const reviewDeckLeft = computed((): number => {
  const mode = reviewMode.value;
  const live = mode === undefined ? undefined : (wizardInput.value?.tenders ?? []).find((t) => t.instance === mode.instance);
  return live?.deckLeft ?? Number.POSITIVE_INFINITY;
});
const restructureMode = computed((): Extract<StartTenderMode, {kind: 'restructure'}> | undefined => {
  const mode = state.tenderMode;
  return mode !== undefined && mode.kind === 'restructure' ? mode : undefined;
});
/** The restructuring's layer covers the page (the page is parked under it). */
/** A tender's layer stands over the wizard's page (its list / sheet, or the restructuring's row). */
const pageCovered = computed((): boolean => {
  return restructureCovers.value || tenderViewCovers.value;
});
const restructureCovers = computed((): boolean => {
  return mode.value === 'wizard' && restructureMode.value !== undefined && !tenderViewCovers.value && !legacyViewCovers.value;
});
/** «Целевой запрос»'s mode — the tag medallions on the dock's plate. */
const tagMode = computed((): Extract<StartTenderMode, {kind: 'tag'}> | undefined => {
  const mode = state.tenderMode;
  return mode !== undefined && mode.kind === 'tag' ? mode : undefined;
});
/** The deck's numbers the held request was served with (`tagCounts` — the server's; absent = unknown, treated as open). */
const requestTagCounts = computed((): Partial<Record<Tag, number>> => {
  const mode = tagMode.value;
  const live = mode === undefined ? undefined : (wizardInput.value?.tenders ?? []).find((t) => t.instance === mode.instance);
  return live?.tagCounts ?? {};
});
/** The tags a request may name here — the printed card tags of the expansions at the table (never wild / clone / event). */
const requestTags = computed((): ReadonlyArray<Tag> => {
  const o = props.playerView.game.gameOptions;
  return ALL_TAGS.filter((tag) => {
    switch (tag) {
    case Tag.WILD:
    case Tag.CLONE:
    case Tag.EVENT:
      return false;
    case Tag.VENUS: return o.expansions.venus === true;
    case Tag.MOON: return o.expansions.moon === true;
    case Tag.CRIME: return o.expansions.underworld === true;
    case Tag.MARS: return o.expansions.pathfinders === true;
    default: return true;
    }
  });
});
/**
 * THE RESTRUCTURING's row (§19.7 — the owner, 2026-11-09): every lineage corporation starts MARKED; ONE may be
 * taken out (`replace`), ONE candidate taken in (`take`). The decision is whole only with the lineage's own count
 * marked — a SWAP (one out, one in) or the lineage KEPT (nothing changed); every other state names what is missing.
 */
const restructureState = computed((): {valid: boolean, swap: boolean, marked: number, total: number, missing?: string} => {
  const mode = restructureMode.value;
  const total = campaignLineage.value.length;
  if (mode === undefined) {
    return {valid: false, swap: false, marked: total, total};
  }
  const marked = total - (mode.replace !== undefined ? 1 : 0) + (mode.take !== undefined ? 1 : 0);
  const swap = mode.take !== undefined && mode.replace !== undefined;
  const keep = mode.take === undefined && mode.replace === undefined;
  const missing = mode.take !== undefined && mode.replace === undefined ? 'Take one corporation out of the lineage' :
    mode.replace !== undefined && mode.take === undefined ? 'Choose the candidate that joins' : undefined;
  return {valid: mode.offer.length > 0 && (swap || keep), swap, marked, total, ...(missing !== undefined ? {missing} : {})};
});
/** The candidates' count — the places the row prepares while the deck deals them. */
const restructureCandidateCount = TENDER_RESTRUCTURING_CANDIDATES;
/** The tender DECK stands while a tender that touches the deck stands in its mode or plays its scene. */
const tenderDeckUp = computed((): boolean => {
  if (mode.value !== 'wizard') {
    return false;
  }
  if (departureActive.value || restructArriving.value.size > 0 || tenderDealArmed.value) {
    return true;
  }
  const modeNow = state.tenderMode;
  if (modeNow === undefined || !tenderModeLive.value) {
    return false;
  }
  return modeNow.kind !== 'confirm' || modeNow.id !== 'researchSubsidy';
});
const tenderDeckStyle = computed((): Record<string, string> => {
  const pos = tenderDeckPos.value;
  return pos === undefined ? {} : {left: `${pos.left}px`, top: `${pos.top}px`};
});
const restructureOfferCards = computed((): ReadonlyArray<CardModel> => {
  return (restructureMode.value?.offer ?? []).map((name) => ({name}) as CardModel);
});
const restructureLineageCards = computed((): ReadonlyArray<CardModel> => {
  return restructureMode.value === undefined ? [] : campaignLineage.value.map((name) => ({name}) as CardModel);
});
/** What the d-pad walks on the current wizard page: the request's tags · the restructuring's two groups · the deal. */
const wizardFocusCount = computed((): number => {
  if (tagMode.value !== undefined && currentStep.value?.id === 'projects') {
    return requestTags.value.length;
  }
  if (restructureMode.value !== undefined) {
    return restructureOfferCards.value.length + restructureLineageCards.value.length;
  }
  return stepEntries.value.length;
});
/**
 * THE PLATE's facts (§19) — the standing tender on the shelf's row: its identity and WHAT THE PRESS WILL DO, in this
 * page's live numbers (a confirm's effect, the exchange's tally, the request's focused tag, the busy word).
 */
const tenderPlate = computed((): {kind: StartTenderMode['kind'], id: TenderId, reading: string} | undefined => {
  const mode = state.tenderMode;
  const entry = tenderModeEntry.value;
  if (mode === undefined || entry === undefined || !tenderModeLive.value) {
    return undefined;
  }
  const read = (key: string, params: ReadonlyArray<string>) => readingText({label: key, params: [...params]});
  if (state.tenderBusy !== undefined) {
    return {kind: mode.kind, id: entry.id, reading: translateText('Executing…')};
  }
  switch (mode.kind) {
  case 'review': {
    const n = mode.release.length;
    return {kind: mode.kind, id: entry.id, reading: n === 0 ?
      read('Mark the cards to return — as many fresh ones come in their place', []) :
      read('Returning ${0} card(s) — as many fresh ones come in their place', [String(n)])};
  }
  case 'tag': {
    const focused = requestTags.value[focusIdx.value];
    const named = mode.tag;
    if (named !== undefined) {
      return {kind: mode.kind, id: entry.id, reading: read('Tag named: ${0} — ${1} project cards with it join the deal', [tagLabel(named), String(Math.min(TENDER_TARGETED_REQUEST_CARDS, requestTagCount(named)))])};
    }
    if (focused !== undefined) {
      const count = requestTagCount(focused);
      return {kind: mode.kind, id: entry.id, reading: count === Number.POSITIVE_INFINITY ?
        tagLabel(focused) :
        read('${0}: ${1} in the deck', [tagLabel(focused), String(count)])};
    }
    return {kind: mode.kind, id: entry.id, reading: read(entry.reading.key, entry.reading.params)};
  }
  case 'restructure': {
    if (mode.offer.length === 0) {
      return {kind: mode.kind, id: entry.id, reading: read('Dealing ${0} candidates from the corporation deck…', [String(TENDER_RESTRUCTURING_CANDIDATES)])};
    }
    const st = restructureState.value;
    return {kind: mode.kind, id: entry.id, reading: read('In the lineage: ${0} / ${1}', [String(st.marked), String(st.total)]) +
      (st.missing !== undefined ? ' · ' + translateText(st.missing) : '')};
  }
  default:
    return {kind: mode.kind, id: entry.id, reading: read(entry.reading.key, entry.reading.params)};
  }
});
/**
 * A on the focused card of the restructuring's row: the lineage first (marked — A takes it OUT; the one out — A
 * puts it back), then the candidates (A takes one IN; the one in — A leaves it out). A second «out» or a second «in»
 * is refused by name (the rule of the row, never a silent swap of the player's earlier choice).
 */
const restructurePickFacts = computed((): {label: string, enabled: boolean} => {
  const mode = restructureMode.value;
  if (mode === undefined) {
    return {label: '', enabled: false};
  }
  const lineage = restructureLineageCards.value;
  const i = focusIdx.value;
  if (i < lineage.length) {
    const name = lineage[i].name;
    if (mode.replace === name) {
      return {label: 'Back into the lineage', enabled: true};
    }
    return mode.replace !== undefined ?
      {label: 'Only one corporation can leave the lineage', enabled: false} :
      {label: 'Out of the lineage', enabled: true};
  }
  const name = restructureOfferCards.value[i - lineage.length]?.name;
  if (name === undefined || restructArriving.value.has(name)) {
    return {label: 'Into the lineage', enabled: false};
  }
  if (mode.take === name) {
    return {label: 'Leave out', enabled: true};
  }
  return mode.take !== undefined ?
    {label: 'Only one candidate can join', enabled: false} :
    {label: 'Into the lineage', enabled: true};
});
/** The bar's facts while a tender's mode stands on its page. */
const tenderModeFacts = computed((): {kind: 'confirm' | 'review' | 'restructure' | 'tag', commitLabel: string, canCommit: boolean, pickLabel: string, pickEnabled: boolean} | undefined => {
  if (!tenderModeLive.value) {
    return undefined;
  }
  const busy = state.tenderBusy !== undefined;
  if (confirmMode.value !== undefined) {
    return {kind: 'confirm', commitLabel: 'Execute the tender', canCommit: !busy, pickLabel: '', pickEnabled: false};
  }
  const tagModeNow = tagMode.value;
  if (tagModeNow !== undefined && currentStep.value?.id === 'projects') {
    const focused = requestTags.value[focusIdx.value];
    const none = focused !== undefined && requestTagCount(focused) === 0;
    return {kind: 'tag', commitLabel: 'Request the three cards', canCommit: !busy && tagModeNow.tag !== undefined,
      pickLabel: none ? 'No card with this tag is left' : focused !== undefined && tagModeNow.tag === focused ? 'Unpick' : 'Choose this tag',
      pickEnabled: focused !== undefined && !busy && !none};
  }
  const review = reviewMode.value;
  if (review !== undefined) {
    const focused = stepEntries.value[focusIdx.value]?.name;
    const marked = focused !== undefined && review.release.includes(focused);
    const full = !marked && review.release.length >= reviewDeckLeft.value;
    return {kind: 'review', commitLabel: 'Exchange the marked cards', canCommit: !busy && review.release.length > 0,
      pickLabel: marked ? 'Keep this card' : full ? 'The deck holds no more cards' : 'Exchange this card',
      pickEnabled: focused !== undefined && !busy && !full};
  }
  const mode = restructureMode.value;
  if (mode !== undefined) {
    const st = restructureState.value;
    const pick = restructurePickFacts.value;
    return {kind: 'restructure',
      commitLabel: st.missing ?? (st.swap ? 'Replace' : 'Keep the lineage'),
      canCommit: !busy && st.valid,
      pickLabel: pick.label, pickEnabled: pick.enabled && !busy};
  }
  return undefined;
});
/** The holdings still HELD in the ceremony — the BUYOUT's chips. */
const heldTenderEntries = computed((): ReadonlyArray<{instance: string, id: TenderId, status: 'held' | 'executed' | 'cashed'}> => {
  return (props.playerView.campaignTenders ?? []).filter((t) => t.status === 'held').map((t) => ({instance: t.instance, id: t.id as TenderId, status: t.status}));
});
// ── «КОМПЕНСАЦИЯ» — the «Тендеры» mode's last deployment stage ──
const heldTenderCount = computed((): number => {
  return (props.playerView.campaignTenders ?? []).filter((t) => t.status === 'held').length;
});
const compensationPrompt = computed((): {tenders: number, megaCredits: number} | undefined => {
  return mode.value === 'ceremony' ? startFlowCompensationPrompt(props.playerView) : undefined;
});
const compensationAmount = computed((): number => {
  return compensationPrompt.value?.megaCredits ?? heldTenderCount.value * TENDER_COMPENSATION_MC;
});
/** The plate stands PRE-LAID while any tender is still held in the ceremony, and leaves with its press (the
 *  statuses turn «cashed» in the same answer). */
const compensationPlateShown = computed((): boolean => {
  return mode.value === 'ceremony' && (compensationPrompt.value !== undefined || heldTenderCount.value > 0);
});
const compensationSubText = computed((): string => {
  const held = (props.playerView.campaignTenders ?? []).filter((t) => t.status === 'held');
  const count = compensationPrompt.value?.tenders ?? held.length;
  const names = held.map((t) => translateText(tenderPortfolioName(t.id as TenderId))).join(' · ');
  return translateTextWithParams('Unexecuted tenders: ${0} × ${1} M€', [String(count), String(TENDER_COMPENSATION_MC)]) +
    (names !== '' ? ' — ' + names : '');
});
/** The preludes «Продление программы» carried into this finale — the queue marks them. */
const carriedPreludeNames = computed((): Set<CardName> => {
  return new Set((props.playerView.campaignCarriedPreludes ?? []).map((c) => c.name));
});
/** R3 opens the overview from EVERY wizard page — corp step through the
 *  summary, the sent-and-awaiting summary included (the read is exactly
 *  what informs the picks still being made). */
const legacyOverviewAvailable = computed((): boolean => {
  return mode.value === 'wizard' && legacyOverviewCards.value.length > 0;
});
/** The overview stage exists (any phase past closed) — input routes to
 *  it, the rail holds. */
const legacyViewOn = computed((): boolean => {
  return legacyView.value.phase !== 'closed';
});
/** …and it OWNS THE SCREEN the player is reading: everything the tail
 *  and the bar say follows THIS, not the raw phase — through the leave's
 *  final landings the page has already surfaced back underneath the
 *  convoy, and a crumb still reading «НАСЛЕДИЕ» over the visible pick
 *  grid names a stage the player has left. */
const legacyStageOwnsScreen = computed((): boolean => {
  return legacyViewOn.value && !legacyPageRestored.value;
});
/** …and it COVERS the body (the released page is v-show-hidden — also
 *  what keeps its parked `data-zoom-slot`s unmeasurable, so the viewer
 *  lifts out of the STAGE seats, never a parked twin). During `fading`
 *  the old page is still the visible one; through the LEAVE the page
 *  takes the body back as soon as the stage chrome has folded
 *  (`legacyPageRestored`) — the convoy is still landing on the shelf
 *  while the page surfaces underneath it. */
const legacyViewCovers = computed((): boolean => {
  const p = legacyView.value.phase;
  return p === 'entering' || p === 'open' ||
    (p === 'leaving' && !legacyPageRestored.value);
});
/**
 * The bought project cards (the ceremony's held + payment-grid set). The
 * player's wizard picks are the explicit intent; a reload mid-ceremony
 * (module state reset) falls back to the current hand, which at the pay
 * step IS exactly the bought projects (corp is played, preludes/CEO are
 * not in `cardsInHand`). Empty until the ceremony (never held on the
 * wizard, never on a returning save with no picks + no hand).
 */
const ceremonyBoughtNames = computed((): ReadonlyArray<CardName> => {
  if (mode.value !== 'ceremony') {
    return [];
  }
  if (state.projects.length > 0) {
    return state.projects;
  }
  return props.playerView.cardsInHand.map((c) => c.name);
});
/** The purchase (corp play / the merge stage / the pay press) is still
 *  ahead of or at the player — the bought cards' pre-payment window.
 *  The MERGE stage is part of it now: the pay press comes AFTER the
 *  merge, and the purchase row must stand continuously through it. */
const prePaymentStage = computed((): boolean => {
  return corpPlayPrompt.value !== undefined || bonusPrompt.value !== undefined ||
    corpMergePrompt.value !== undefined || mergeFeeStands.value ||
    campaignAdditionalUnplayed.value.length > 0 || corpPayCost.value !== undefined;
});
/** The bought projects standing in the QUEUE's purchase row — from the
 *  first deployment frame until the payment resolves them into the hand
 *  (they are withheld from the dock the whole time; the pay confirm is
 *  what physically flies them there). */
const payProjects = computed((): ReadonlyArray<CardName> => {
  if (mode.value !== 'ceremony') {
    return [];
  }
  return prePaymentStage.value ? ceremonyBoughtNames.value : [];
});
/**
 * The stable key of the delivery HOLD episode: non-empty from the first
 * ceremony frame (corp-play or pay beat) while cards were bought, so the
 * bought projects are withheld from the dock until the payment flies them
 * in. Name-derived (not the module signature) so it survives a reload
 * mid-ceremony. Empty = nothing to hold (wizard / nothing bought).
 */
const deliveryHoldSignature = computed((): string => {
  if (mode.value !== 'ceremony' || ceremonyBoughtNames.value.length === 0) {
    return '';
  }
  // The whole pre-payment window (corp play → merge stage → pay press):
  // the bought cards stay withheld from the dock through the MERGE too —
  // dropping the hold there would fly them in before they were paid for.
  if (!prePaymentStage.value) {
    return '';
  }
  return deliverySignature(ceremonyBoughtNames.value);
});
/** Identity of the pressable ceremony set — drives the reward pre-fetch
 *  (the deferred corp + Merger's offered corps / drew-N candidates + the
 *  prelude rail). */
/**
 * The game-state version every SERVER-DERIVED prefetch in this scene is
 * scoped to (`gameStateVersion`). The deployment moves the state under its
 * own briefing — each prelude pays out before the next card is pressed, and
 * other seats act in the same phase — so a preview cached by CARD NAME
 * alone outlives the state it was priced against.
 */
const startPreviewVersion = computed((): string => {
  return gameStateVersion(props.playerView);
});
const playRewardKey = computed((): string => {
  return [
    startPreviewVersion.value,
    corpPlayCard.value?.name ?? '',
    ...candidateCards.value.map((c) => c.name),
    ...preludeRail.value.map((e) => e.name),
  ].join('|');
});
/**
 * The ORDER-AWARE verdict of a queued prelude, straight from the server
 * (`CardModel.preludeOutlook` → `PreludeEntry.outlook`). The ONE place the
 * scene asks «can this card's effect actually resolve?» — badge, rail,
 * risk stage and the commit gate all read it, so they cannot describe
 * different situations.
 */
const outlookOf = computed((): (name: CardName) => PreludeOutlook | undefined => {
  const rail = preludeRail.value;
  const candidate = candidateOutlookOf.value;
  return (name: CardName) => rail.find((e) => e.name === name)?.outlook ?? candidate(name);
});
/**
 * PL-1468 — a drew-N CANDIDATE's verdict (Valley Trust, New Partner): the server stamps it on the start pick, and
 * for a card played now-or-never any non-playable verdict is final (`candidateOutlook`). A copy (Double Down) or a
 * corporation pick (Merger) carries none.
 */
const candidateOutlookOf = computed((): (name: CardName) => PreludeOutlook | undefined => {
  if (startFlowPreludeCopyPrompt(props.playerView) !== undefined || startFlowCorpSelectPrompt(props.playerView) !== undefined) {
    return () => undefined;
  }
  const cards = candidateCards.value;
  return (name: CardName) => candidateOutlook(cards.find((c) => c.name === name)?.preludeOutlook);
});
/**
 * THE RISK of the FOCUSED prelude — what is missing, what could still fix
 * it, and the verb of the press that would give it up. `undefined` when
 * the focused card can simply be played (or is not a prelude at all).
 *
 * The whole feature hangs off this being ONE value: the old screen derived
 * its warning in one place and its button label in another, and printed
 * «Сначала разыграйте другой пролог» beside «A — Подтвердить». Read
 * together those two can only mean «press A to go to the other prelude» —
 * and A burned the card. Here the sentence and the verb come out of the
 * same call.
 */
const focusedRisk = computed((): PreludeRisk | undefined => {
  const f = focusedItem.value;
  if (f === undefined || (f.kind !== 'prelude' && f.kind !== 'candidate')) {
    return undefined;
  }
  return preludeRisk(outlookOf.value(f.name), (n) => translateText(n), {hold: true});
});
/**
 * …and whether the player has ENTERED that risk stage (A pressed once).
 * Derived from the focus, never latched alone: any d-pad move, fullscreen
 * browse, minimize or re-open drops it by construction, so the player can
 * never come back to a screen that is one input from losing an effect.
 */
const riskStage = computed((): PreludeRisk | undefined => {
  const f = focusedItem.value;
  if (riskArmed.value === undefined || f === undefined || f.name !== riskArmed.value) {
    return undefined;
  }
  return focusedRisk.value;
});
/**
 * The committed-without-effect card has finished ARRIVING — the hero has
 * landed and the queue is standing again. Only then may the beat speak.
 */
const effectLostReady = computed((): boolean => {
  return effectLostFor.value !== undefined && !isPlayedHeroActive() &&
    queueArriving.value.size === 0;
});
/** The risk stage's body, with the enabling prelude's name interpolated. */
const riskBodyText = computed((): string => {
  const risk = riskStage.value;
  return risk === undefined ? '' : translateTextWithParams(risk.body, [...risk.bodyParams]);
});
/** The hold gate's key — one per card, so a re-focus can never inherit a hold. */
const riskHoldKey = computed((): string => {
  return riskArmed.value === undefined ? '' : `start-prelude-risk:${riskArmed.value}`;
});
/**
 * The ceremony rail's state class. A focused prelude whose effect cannot
 * resolve takes the console's amber caution — the same one every other
 * «this costs you» line carries — instead of the neutral cyan hint: the
 * badge on the card and the sentence explaining it must speak with ONE
 * voice, and they must do it BEFORE the press. The risk stage then steps
 * up to its own state.
 */
const ceremonyRailClass = computed((): string => {
  if (riskStage.value !== undefined) {
    return 'con-start__statusrail--burn';
  }
  return focusedRisk.value !== undefined ?
    'con-start__statusrail--warn' :
    'con-start__statusrail--hint';
});
const preludeRail = computed((): ReadonlyArray<PreludeEntry> => {
  if (mode.value !== 'ceremony') {
    return [];
  }
  // A PLAYED prelude physically MOVED to the «Разыграно» table (the hero
  // landing) — it leaves the scene rail and the remaining cards FLIP into
  // the freed space (never a "played" ghost sitting in both places).
  return preludeEntries(props.playerView).filter((e) => e.status !== 'played');
});
/** The live pick prompt (draw-1-of-N / Double Down copy / Merger corp). */
const candidatePrompt = computed((): SelectCardModel | undefined => {
  if (mode.value !== 'ceremony') {
    return undefined;
  }
  return startFlowPreludeDrawPrompt(props.playerView) ??
    startFlowPreludeCopyPrompt(props.playerView) ??
    startFlowCorpSelectPrompt(props.playerView);
});
const candidateCards = computed((): ReadonlyArray<CardModel> => {
  return candidatePrompt.value?.cards ?? [];
});
const candidateVerb = computed((): string => {
  if (startFlowPreludeCopyPrompt(props.playerView) !== undefined) {
    return 'Copy';
  }
  if (startFlowCorpSelectPrompt(props.playerView) !== undefined) {
    return 'Select';
  }
  return 'Play now';
});
/** P17: the live ask is a CORPORATION pick (Merger) → compact strip. */
const corpCandidatePick = computed((): boolean => {
  return startFlowCorpSelectPrompt(props.playerView) !== undefined;
});
/** The flat actionable list the focus cycles over. */
const focusables = computed((): Array<Focusable> => {
  const out: Array<Focusable> = [];
  if (mode.value !== 'ceremony') {
    return out;
  }
  // The deferred corporation play is the WHOLE decision of its beat —
  // nothing else is actionable until the corp physically lands.
  if (corpPlayPrompt.value !== undefined && corpPlayCard.value !== undefined) {
    out.push({kind: 'corp', name: corpPlayCard.value.name, disabled: false});
    return out;
  }
  // …then paying for the bought cards is the only thing to do.
  if (corpPayCost.value !== undefined) {
    out.push({kind: 'pay', name: PAY_KEY, disabled: false});
    return out;
  }
  // CAMPAIGN: the bonus press is the whole decision of its beat…
  if (bonusPrompt.value !== undefined) {
    out.push({kind: 'bonus', name: BONUS_KEY, disabled: false});
    return out;
  }
  // …as is each merge press…
  if (corpMergePrompt.value !== undefined && corpMergeCard.value !== undefined) {
    out.push({kind: 'corp', name: corpMergeCard.value.name, disabled: false});
    return out;
  }
  // …and the carried-cards press («Наследие проектов»).
  if (legacyPrompt.value !== undefined) {
    out.push({kind: 'legacy', name: LEGACY_KEY, disabled: false});
    return out;
  }
  // …and the «КОМПЕНСАЦИЯ» press (the «Тендеры» mode's last stage).
  if (compensationPrompt.value !== undefined) {
    out.push({kind: 'compensation', name: COMPENSATION_KEY, disabled: false});
    return out;
  }
  if (candidatePrompt.value !== undefined) {
    for (const c of candidateCards.value) {
      out.push({kind: 'candidate', name: c.name, disabled: c.isDisabled === true});
    }
    return out;
  }
  if (startFlowPreludePrompt(props.playerView) !== undefined) {
    for (const e of preludeRail.value) {
      // `fizzles` is deliberately NOT a filter here: the warning must not cost
      // the player the ability to reach the card at all (focus is also how the
      // rail explains it, and how X opens the fullscreen face).
      if (e.status === 'playable') {
        out.push({kind: 'prelude', name: e.name, disabled: false});
      }
    }
  }
  return out;
});
const focusedItem = computed((): Focusable | undefined => {
  return focusables.value[focusIdx.value];
});
/** The card set the deal cinematic flies for the CURRENT frame. */
const dealCards = computed((): ReadonlyArray<CardModel> => {
  if (mode.value === 'wizard') {
    return currentStep.value !== undefined ? stepEntries.value : [];
  }
  return candidateCards.value;
});
/** The deal-identity FRAME (the old keyed-frame name, kept ONLY as a
 *  deal-cache key — the frame itself is one persistent surface now). */
const dealFrame = computed((): string => {
  if (mode.value === 'wizard') {
    return onSummary.value ? 'wizard-summary' : 'wizard-steps';
  }
  return 'ceremony';
});
/** The deal identity: frame + step + the exact card set (a fresh candidate
 *  set under the SAME frame — successive draw-1-of-N asks — re-deals). */
const dealSignature = computed((): string => {
  // The corporation step under the RESTRUCTURING mode defers its deal until the mode ends (the strip rests hidden
  // under the mode — a deal cannot measure it); the signature moves on the mode's edge so the deal then plays.
  const mode = restructureMode.value !== undefined && currentStep.value?.id === 'corp' ? '|restructure' : '';
  return `${dealFrame.value}|${railPos.value}|${dealCards.value.map((c) => c.name).join(',')}${mode}`;
});
/**
 * The ceremony beat identity — resets the focus cursor without a remount.
 *
 * ⚠️ STRUCTURAL, never the TITLE. It used to be `type|textOf(title)`, and
 * i18n mutates `Message.message` IN PLACE on render (cross-cutting
 * invariant 1): the key therefore flipped spontaneously WITHIN one prompt,
 * this watcher fired, and the focus cursor jumped back to index 0 while the
 * player was mid-decision. Harmless-looking for years, because the queue
 * mostly had one obvious card — and then genuinely dangerous the moment a
 * decision could STAND on the focused card: the risk stage was dropped
 * under the player and the next A played whatever the cursor had landed on.
 * Card NAMES are enum values and never translated, so this changes exactly
 * when the ask changes.
 */
const ceremonyPromptKey = computed((): string => {
  const wfNow = wf.value;
  if (mode.value !== 'ceremony' || wfNow === undefined) {
    return '';
  }
  const kind = wfNow.startGamePrompt?.kind ?? '';
  const cards = wfNow.type === 'card' ? (wfNow.cards ?? []).map((c) => c.name).join(',') : '';
  return `${wfNow.type}|${kind}|${cards}`;
});
/** Diagnostic: the corp is on the table but this session never staged its
 *  landing — an assigned/test-mode corp, or a client newer than the server
 *  (no corporationPlay prompt). Shown as context; warned once in dev. */
const corpPlayedWithoutPrompt = computed((): boolean => {
  return mode.value === 'ceremony' && !sawCorpPlayPrompt.value &&
    corpPlayCard.value === undefined && corporationCardNames(props.playerView).length > 0;
});
/** The live command contract — ONE pure derivation (startSceneCommands),
 *  mirrored verbatim by the shell's bar. See consoleStartUi.ts for the
 *  setup grammar (context-exact A · X · LB/RB steps · B; no RT, no
 *  generic «Навигация»). */
const footHints = computed((): Array<StartCommand> => {
  // Mid-motion (dock flights, the commit, the materialization, the final
  // release) NOTHING is pressable — the bar goes honestly empty instead
  // of advertising verbs the input gate would swallow. The deal cinematic
  // keeps its Skip (startSceneCommands handles it first).
  if (startFlowBusy() && !deal.value.state.active) {
    return [];
  }
  // The legacy overview's MOTION beats (park, rise convoy, the leave)
  // absorb every press — the bar goes honestly quiet instead of
  // advertising verbs the gate would swallow (same policy as above).
  if (legacyViewOn.value && legacyView.value.phase !== 'open') {
    return [];
  }
  // P58 · FS — THE «ОЧЕРЁДНОСТЬ» STEP owns the bar: A places the row's tile next. No B — the prelude is played,
  // the step cannot be backed out of.
  if (orderStep.value !== undefined) {
    if (orderSealed.value) {
      return [];
    }
    const refused = orderPressRefusal.value !== undefined;
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: refused ? 'Performing…' : 'Place this tile next',
        enabled: !refused && orderStep.value.rows[orderFocus.value]?.available === true},
    ] as unknown as Array<StartCommand>;
  }
  // THE «ВАРИАНТ» STEP (P44) owns the bar while it stands: A chooses the row AND plays, B back to the queue.
  if (variantStep.value !== undefined) {
    if (variantSealed.value) {
      return [];
    }
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: variantStep.value.kind === 'resource' ? 'Play with this resource' : 'Play this variant',
        enabled: variantStep.value.rows[variantFocus.value]?.available === true},
      {control: 'back', label: 'Back'},
    ] as unknown as Array<StartCommand>;
  }
  // The «Эффекты» layer owns the bar while it stands — the explorer's own contract, verbatim.
  if (firstActionFxOpen.value) {
    return [...(forecastExplorerUi('start').barCommands ?? [])] as unknown as Array<StartCommand>;
  }
  return startSceneCommands({
    dealActive: deal.value.state.active,
    mode: mode.value,
    onSummary: onSummary.value,
    singlePick: singlePickStep.value,
    focusedPicked: focusedCard.value !== undefined && isPickedHere(focusedCard.value.name),
    canPickFocused: canPickFocused.value,
    hasCards: onSummary.value ? summaryCards.value.length > 0 : stepEntries.value.length > 0,
    stepComplete: currentStepComplete.value,
    hasPrevStep: railPos.value > 0,
    launchVerb: launchVerb.value,
    launches: launch.value.launches,
    wizardReady: wizardReady.value,
    awaiting: awaitingOthers.value,
    payBeat: corpPayCost.value !== undefined,
    // The bar carries the FOCUSED item's own verb: a candidate pick's, «Получить» on the campaign's bonus plate and
    // its carried-cards row (the rows' inline hints say the same — the bar never contradicts them with «Разыграть»).
    ceremonyVerb: candidatePrompt.value !== undefined ? candidateVerb.value :
      (focusedItem.value?.kind === 'legacy' || focusedItem.value?.kind === 'bonus' || focusedItem.value?.kind === 'compensation') ? 'Receive' : 'Play now',
    hasFocusables: focusables.value.length > 0,
    pressBlocked: pressBlockedNow.value,
    firstAction: firstActionBarState.value,
    firstActionChoice: firstActionChoiceLive.value,
    firstActionEffects: firstActionForecastCanOpen.value,
    queueEffects: queueForecastCanOpen.value,
    bonusAction: bonusActionBarState.value,
    stageGainFocused: stageGainFocused.value,
    bonusFirstPending: bonusOverviewVerb.value === 'firstAction',
    bonusSub: firstActionNested.value && state.firstAct.stage !== 'idle',
    riskCommitLabel: riskStage.value?.commitLabel,
    riskHold: riskStage.value !== undefined,
    legacyAvailable: legacyOverviewAvailable.value,
    legacyOverview: legacyView.value.phase === 'open',
    tenderDoor: tenderDoorAvailable.value && !tenderViewOn.value && !legacyViewOn.value && state.tenderMode === undefined ?
      {ready: tenderReadyCount.value} : undefined,
    tenderList: tenderListFacts.value,
    tenderSheet: tenderSheetFacts.value,
    tenderMode: tenderModeFacts.value,
  });
});
/**
 * WHAT THIS SCENE SERVES RIGHT NOW (`startServesOf` — the reliability iteration of 2026-10-28). Read off the
 * scene's own facts only; a latch that merely REMEMBERS a past beat (`effectReturnPending`'s released room, a seat
 * owner) is deliberately NOT motion — a scene stuck on one serves nothing, and that is what the watchdog must see.
 */
const servesNow = computed((): StartServes => {
  return startServesOf({
    mode: mode.value,
    yielded: props.yielded,
    nestedStep: workspaceFrameHasNested('start') || orderStep.value !== undefined,
    flowBeat: state.flow !== 'idle' && state.flow !== 'deploying',
    motion: heroState.active || queueArriving.value.size > 0 || deal.value.state.active ||
      embedSourceArriving.value || embedSourceDeparting.value ||
      deckDrawHolds() || isHandDeliveryActive() || currentRevealEvent() !== undefined,
    outcomePresenting: embedPresenting.value,
    stagePanel: firstActionPanelShown.value || bonusActionPanelShown.value,
    stageTransit: state.firstAct.submitting,
    risk: riskStage.value !== undefined,
    focusables: focusables.value.filter((f) => !f.disabled).length,
  });
});
/**
 * WOULD THE PRESS ON THE FOCUSED ITEM BE REFUSED RIGHT NOW — the same gate `actByName` applies, read LIVE
 * (the transport's reactive mirror, the delivery ledger) so the bar can dim A and name the wait instead of
 * advertising a verb the gate would swallow. `undefined` = the press is honoured.
 */
const pressBlockedNow = computed((): ReturnType<typeof startPressRefusal> => {
  return startPressRefusal(focusedItem.value?.kind ?? '', {
    heroActive: isPlayedHeroActive(),
    ceremony: mode.value === 'ceremony',
    shellRevealed: ceremonyRevealed.value,
    embedPresenting: embedPresenting.value,
    queueArriving: queueArriving.value.size > 0,
    requestInProgress: transportRequestInProgress(),
    deliveryPending: projectDeliveryPending.value,
  });
});
/** The first-action stage as the command contract sees it (see
 *  StartSceneCommandState.firstAction). Only the PANEL beats own the bar —
 *  the action's follow-ups (candidates, an embedded reveal) fall back to
 *  the queue/claim grammar exactly as every other play. */
const firstActionBarState = computed((): 'off' | 'waiting' | 'ready' | 'busy' => {
  if (!firstActionPanelShown.value) {
    return 'off';
  }
  if (state.firstAct.stage === 'staging' || state.firstAct.submitting) {
    return 'busy';
  }
  return firstActionActionableNow.value ? 'ready' : 'waiting';
});

/** The reading line's words — through the ONE reading renderer (a «Сначала: 0» carries its param). */
function queueReadingText(reading: StartQueueReading): string {
  return reading.text === undefined ? '' : readingText({label: reading.text, params: reading.params});
}
/**
 * THE QUEUE'S BOX → THE CARD'S ZOOM (TRP0 · DE — S1). Observes `.con-start__queue` (re-attached when the ceremony
 * mounts a new one) and solves `startQueueLayout` from its box, the row's other blocks (measured) and the number of
 * queue cards. The cards keep the old fixed zoom until the first measure. Never during a hero flight: the source
 * slot must not change under a card that is leaving it.
 */
function observeQueueBox(): void {
  // An UNMOUNTED ref reads `null`, never `undefined` (Vue clears it so): read as «no queue» — `observe(null)` threw
  // inside the watcher's flush on every queue change past the deployment (the owner's export of 2026-10-31 22:16,
  // the fourth inside `openHandWithReveal`).
  const ref = queueEl.value ?? undefined;
  const el = ref instanceof Element ? ref : undefined;
  // The observer and the box it watches are the page's (`consoleStartSceneState.ts`): a NEW box is solved at once.
  if (observeStartQueueBox(el, () => solveQueueZoom())) {
    solveQueueZoom();
  }
}
function solveQueueZoom(): void {
  const el = observedStartQueueBox();
  if (el === undefined || !el.isConnected || el.clientWidth === 0 || el.clientHeight === 0 || heroDepartedName.value !== undefined) {
    return;
  }
  const others = Array.from(el.querySelectorAll<HTMLElement>(':scope > .con-start__queue-row > :not(.con-start__qcard)'));
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const plan = startQueueLayout({
    width: el.clientWidth,
    height: el.clientHeight,
    othersWidth: others.reduce((sum, o) => sum + o.getBoundingClientRect().width, 0),
    others: others.length,
  }, queueCards.value.length, remPx, conUiScale());
  const zoom = Math.round(plan.zoom * 1000) / 1000;
  if (zoom !== queueZoom.value) {
    queueZoom.value = zoom;
  }
}
/** Shared step/frame settle: reseed focus, mark visited, refit. */
function onFrameSettle(): void {
  focusIdx.value = stepInitialFocus();
  armedSkip.value = false; armedTenders.value = false;
  clearRiskStage();
  blockedNudge.value = 0;
  counterNudge.value = 0;
  if (mode.value === 'wizard' && currentStep.value !== undefined) {
    state.visited.add(railPos.value);
  }
  void nextTick(() => {
    scrollFocusedIntoView();
    fitCardStrip();
    fitSummary();
    // THE CURSOR ARRIVES AFTER THE DEAL-IN (TR58): a frame whose cards are still staggering in holds its cursor
    // pose until their entrance has finished (the animations' own end), then the ring comes in on the slot's
    // transition. (The proxy deal holds it through `deal.state.active` on the body.)
    const pane = onSummary.value ? summaryPane.value : body.value;
    if (pane !== undefined && pane !== null) {
      gateCursorUntilAnimationsEnd(pane);
    }
  });
  fitTimer?.();
  fitTimer = flow.after(motionMs(240), 'the frame\'s re-verify fit', () => {
    fitTimer = undefined;
    fitCardStrip();
    fitSummary();
  });
}
/** Parked-pane strip refs (index = step position). */
function setStripRef(i: number, el: unknown): void {
  stripEls.value[i] = el instanceof HTMLElement ? el : undefined;
}
/** Parked pane ROOT refs (the stage-transition motion targets). */
function setPaneRef(i: number, el: unknown): void {
  paneEls.value[i] = el instanceof HTMLElement ? el : undefined;
}
/** The pane element a rail position renders in (steps / the summary). */
function paneElAt(pos: number): HTMLElement | undefined {
  if (pos >= steps.value.length) {
    const summary = summaryPane.value ?? undefined;
    return summary ?? undefined;
  }
  return paneEls.value[pos];
}
/**
 * TWO settled animation frames — the honest «the layout has painted»
 * wait. One rAF still runs BEFORE the paint of the frame it belongs to,
 * so a single one measures a layout the compositor has not shown yet.
 */
function settledFrame(): Promise<void> {
  return whenPainted();
}
/**
 * A deliberate CHOREOGRAPHIC offset between two beats of this scene's own
 * sequence (never a guess about when someone else's animation finished —
 * every completion in this file is a real signal). Motion-scaled, so the
 * speed preset keeps the whole phrase in proportion.
 */
function beat(ms: number): Promise<void> {
  return span(motionMs(ms));
}
/**
 * THE JOURNEY RAIL'S DIRECTIONAL PULSE. The rail must NOT move its
 * active marker at the press — the stage has not changed yet, and a chip
 * that lights up before its cards exist is the same lie the old early
 * stage commit told. It shows DIRECTION instead: a short light impulse
 * along the connector toward the requested stage. No text changes
 * anywhere during a transition (the player cannot read a label that lives
 * for 300 ms — it would only ever register as a flicker).
 */
function pulseJourney(dir: 1 | -1): void {
  railPulseDir.value = dir;
  railPulse.value++;
}
/** Retire a step pane as ONE cached layer (never card by card). */
function parkPane(pos: number, dir: 1 | -1): Promise<void> {
  return parkSurface(paneElAt(pos), dir);
}
/** Bring a parked pane back — same table, same cards, no re-deal. */
function revealPane(pos: number, dir: 1 | -1): Promise<void> {
  return unparkSurface(paneElAt(pos), dir);
}
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
function holdPaneForReveal(el: HTMLElement | null | undefined): void {
  if (el !== null && el !== undefined) {
    gsap.killTweensOf(el);
    gsap.set(el, {autoAlpha: 0});
  }
}
/**
 * PREWARM THE SUMMARY (§ every destination measured before anything
 * moves). The pane is mounted INVISIBLE at exactly the box it will occupy
 * once it becomes the active body — an absolute copy of the cards body's
 * rect — so the fit engine solves the FINAL geometry and nothing re-flows
 * at the swap. Without this the summary assembled itself while cards were
 * already arriving: the tiles that had not laid out yet had no rect to
 * fly to, and every one of them degraded into «just appear».
 */
async function prewarmSummary(): Promise<void> {
  const frameEl = frame.value ?? undefined;
  const bodyNow = body.value ?? undefined;
  if (frameEl !== undefined && frameEl !== null && bodyNow !== undefined && bodyNow !== null &&
      typeof bodyNow.getBoundingClientRect === 'function') {
    const fr = frameEl.getBoundingClientRect();
    const br = bodyNow.getBoundingClientRect();
    if (br.width > 8 && br.height > 8) {
      prewarmBox.value = {
        left: br.left - fr.left, top: br.top - fr.top,
        width: br.width, height: br.height,
      };
    }
  }
  summaryPrewarm.value = true;
  await nextTick();
  // The zoom search is a handful of forced reflows; run it, let the frame
  // paint, then re-verify on the settled layout.
  fitSummary();
  await settledFrame();
  fitSummary();
  await settledFrame();
}
/** The prewarmed pane becomes the real body — same box, zero shift. */
function releaseSummaryPrewarm(): void {
  summaryPrewarm.value = false;
  prewarmBox.value = undefined;
}
function activeStrip(): HTMLElement | undefined {
  return stripEls.value[railPos.value];
}
/**
 * THIS MOUNT'S ROOT ELEMENT — or `undefined` when there is none to query.
 *
 * ⚠️ THE ROOT REF IS `null`, NOT `undefined`, WHENEVER THERE IS NO DOM:
 * before the mount (the whole of setup) and after the unmount. Every
 * reader in this file used to spell the guard as
 * `root === undefined || typeof root.querySelector !== 'function'`, which
 * looks defensive and is not: `null === undefined` is FALSE, so the guard
 * falls through to `typeof null.querySelector` and THROWS.
 *
 * That is not theoretical. An `immediate` entry watcher runs during
 * setup, so a reload landing on the corporation's mandatory first
 * action threw here inside `runEmbedSourceEmerge`; the async entry
 * rejected mid-way, `firstAct.stage` stayed `'staging'` forever, and the
 * workspace painted its «ПЕРВОЕ ДЕЙСТВИЕ» stage with an EMPTY BODY and no
 * way forward. One reader, one guard, so the trap cannot be re-authored.
 */
function sceneRoot(): HTMLElement | undefined {
  const el = root.value ?? undefined;
  return el === null || el === undefined || typeof el.querySelector !== 'function' ? undefined : el;
}
/** Is `name` picked on step `st` (parked panes render every step). */
function stepPicked(st: StartWizardStep, name: CardName): boolean {
  return picksForStep(picks.value, st.id).includes(name);
}
/** The dock pile element for a step. */
function pileElFor(id: string): HTMLElement | null {
  const root = sceneRoot();
  if (root === undefined) {
    return null;
  }
  return root.querySelector<HTMLElement>(`[data-start-pile="${id}"] .con-startdock__stack`);
}
/** The parked slot of a step's card (whether or not its pane is active). */
function stepSlotEl(stepId: string, name: CardName): HTMLElement | null {
  const root = sceneRoot();
  if (root === undefined) {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(`${stepId}|${name}`) : `${stepId}|${name}`;
  return root.querySelector<HTMLElement>(`[data-step-slot="${esc}"]`);
}
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
async function advanceWithCollect(): Promise<void> {
  const step = currentStep.value;
  if (step === undefined || dockBusy.value || startFlowBusy()) {
    return;
  }
  const from = railPos.value;
  const to = from + 1;
  const kind = transitionKind(from, to, steps.value.length);
  if (kind === undefined) {
    return;
  }
  dockBusy.value = true;
  beginStartTransition(kind, from, to);
  pulseJourney(1);
  state.flow = kind === 'to-summary' ? 'revealing-summary' : 'docking';
  const names = picksForStep(picks.value, step.id);
  // The corporation is the player's own face — it lifts a notch higher.
  const accent = step.id === 'corp' ? names[0] : undefined;
  // ① CAPTURE — the pixels are ours from THIS frame, which is what lets
  // the table underneath retire without the cards going down with it.
  const capture = captureCards(names
    .map((name) => ({name, el: stepSlotEl(step.id, name)}))
    .filter((sc): sc is DockFlightSource => sc.el !== null));
  names.forEach((n) => returningNames.value.add(`${step.id}|${n}`));
  try {
    // ② IMPULSE — the press is answered in its own interaction frame.
    setStartTransitionPhase('compressing-selection');
    await capture.impulse(accent);
    setStartTransitionPhase('lifting-selection');
    if (kind === 'to-summary') {
      await toSummaryConvoy(step, capture, from);
    } else {
      await stepForwardCollect(step, capture, from, to);
    }
  } finally {
    capture.dispose();
    names.forEach((n) => returningNames.value.delete(`${step.id}|${n}`));
    summaryArriving.value.clear();
    clearDockDrift();
    fitLocked.value = false;
    dockBusy.value = false;
    state.flow = 'idle';
    setStartTransitionPhase('stabilizing-focus');
    await settledFrame();
    endStartTransition();
  }
}
/**
 * FORWARD, step → step: the picks collect onto their shelf pile, and the
 * NEXT step's table is opened only once the shelf physically has them.
 */
async function stepForwardCollect(
  step: StartWizardStep, capture: CapturedFlight, from: number, to: number,
): Promise<void> {
  const pileEl = pileElFor(step.id);
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
  fitLocked.value = true;
  const flight = capture.flyTo(
    () => pileEl,
    () => driftDockPile(step.id, 1),
    {flipTo: FACE_DOWN_DEG, reseat: false, pressElFor: () => pileEl});
  // ④ …and only once they have VISIBLY separated does the table they came
  // from begin to retire — whole, in one piece, with its unpicked cards
  // still lying exactly where they lie. That small offset is what makes
  // the gesture read as «I took THESE cards off THAT table».
  await beat(SEPARATION_BEAT_MS);
  setStartTransitionPhase('parking-current-surface');
  const parked = parkPane(from, 1);
  setStartTransitionPhase('docking-selection');
  await Promise.all([flight, parked]);
  // ⑤ THE COMMIT. The shelf has the cards and nothing of the old stage is
  // on screen: only now may a card of the next stage exist — and it is
  // held down until its own reveal opens it (never a full-strength frame).
  setStartTransitionPhase('committing-stage');
  holdPaneForReveal(paneElAt(to));
  // ONE TICK: the step becomes `collected` (its target back count rises
  // to its picks) and the physical drift that was standing in for that
  // is dropped in the same mutation batch — Vue renders once, so the
  // shelf never flickers through an intermediate count.
  clearDockDrift(step.id);
  state.stepIdx = to;
  await nextTick();
  clearSurfaceParking(paneElAt(from));
  fitLocked.value = false;
  fitCardStrip();
  await settledFrame();
  setStartTransitionPhase('revealing-next-surface');
  await revealPane(to, 1);
}
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
async function toSummaryConvoy(step: StartWizardStep, capture: CapturedFlight, from: number): Promise<void> {
  // ③ PREWARM. Every tile mounted, laid out and MEASURED while the cards
  // are still in the player's hand — a summary that assembles itself as
  // cards arrive has no stable rect to offer them.
  setStartTransitionPhase('preparing-summary-layout');
  const everyPick: Array<CardName> = [];
  for (const st of steps.value) {
    for (const n of picksForStep(picks.value, st.id)) {
      everyPick.push(n);
    }
  }
  // HELD FROM THE FIRST PAINT: not one tile may show a card before that
  // card has physically landed in it (one visual owner, always).
  everyPick.forEach((n) => summaryArriving.value.add(n));
  await prewarmSummary();
  const {missing} = await measureTargets(everyPick, (n) => summaryTileFor(n), 40);
  if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('[console-start] summary tiles never measured: ' + missing.join(', ') +
      ' — those cards cannot be carried physically.');
  }
  // ④ The table retires, with the taken cards already held above it.
  setStartTransitionPhase('parking-current-surface');
  await parkPane(from, 1);
  // ⑤ THE COMMIT. The summary becomes the stage while every tile is still
  // empty — so there is never a frame with two card surfaces on it.
  setStartTransitionPhase('committing-stage');
  const summaryPaneNow = summaryPane.value ?? undefined;
  holdPaneForReveal(summaryPaneNow);
  // ONE TICK, again: on the summary every pile's target drops to 0, but
  // the earlier steps' cards are still physically LYING there until they
  // fly out — the drift stands in for them, and it is applied in the same
  // mutation batch as the flip so the shelf never shows a doubled (or an
  // emptied) count for a frame.
  steps.value.forEach((st, i) => {
    if (i < from) {
      driftDockPile(st.id, picksForStep(picks.value, st.id).length);
    }
  });
  state.stepIdx = from + 1;
  releaseSummaryPrewarm();
  await nextTick();
  clearSurfaceParking(paneElAt(from));
  await settledFrame();
  // The summary's own frame opens EMPTY (every tile is still held): the
  // player sees where the cards are going before they get there, and
  // there is never a frame carrying two card surfaces.
  await unparkSurface(summaryPaneNow, 1);
  // ⑥ DISTRIBUTE — every card, no exceptions, adaptive to the count.
  setStartTransitionPhase('distributing-summary-cards');
  fitLocked.value = true;
  const legs: Array<Promise<void>> = [
    capture.flyTo((n) => summaryTileFor(n), (n) => {
      summaryArriving.value.delete(n);
      returningNames.value.delete(`${step.id}|${n}`);
    }),
  ];
  for (const st of steps.value) {
    if (st.id === step.id) {
      continue;
    }
    const groupNames = picksForStep(picks.value, st.id);
    if (groupNames.length === 0) {
      continue;
    }
    legs.push(returnFromDock(
      groupNames,
      pileElFor(st.id),
      (n) => summaryTileFor(n),
      (n) => summaryArriving.value.delete(n),
      () => driftDockPile(st.id, -1)));
  }
  setStartTransitionPhase('docking-all-summary-cards');
  // THE SUMMARY IS NOT «DONE» UNTIL THE LAST CARD IS DOWN — the controls
  // (and the input lock) release off this promise, never off a clock.
  await Promise.all(legs);
  setStartTransitionPhase('revealing-summary-status');
  fitLocked.value = false;
  fitSummary();
}
/**
 * LT — GO BACK. The BACKWARD phrase is deliberately NOT the forward one
 * reversed: a card can only come home to a table that already exists, so
 * the receiving surface is restored FIRST and the card is released from
 * the shelf only afterwards.
 */
async function backWithReturn(): Promise<void> {
  if (railPos.value === 0 || dockBusy.value || startFlowBusy()) {
    return;
  }
  const from = railPos.value;
  const target = from - 1;
  const step = steps.value[target];
  const kind = transitionKind(from, target, steps.value.length);
  if (step === undefined || kind === undefined) {
    state.stepIdx = target;
    clearDockDrift();
    return;
  }
  dockBusy.value = true;
  beginStartTransition(kind, from, target);
  pulseJourney(-1);
  state.flow = kind === 'from-summary' ? 'stowing-summary' : 'returning';
  try {
    if (kind === 'from-summary') {
      await fromSummaryReturn(step, target);
    } else {
      await stepBackReturn(step, target, from);
    }
  } finally {
    // The stow's tile holds release only now — the summary pane is long
    // hidden, so no face can flash under a dead proxy.
    summaryStowing.value.clear();
    summaryArriving.value.clear();
    picksForStep(picks.value, step.id).forEach((n) => returningNames.value.delete(`${step.id}|${n}`));
    clearDockDrift();
    fitLocked.value = false;
    dockBusy.value = false;
    state.flow = 'idle';
    setStartTransitionPhase('stabilizing-focus');
    await settledFrame();
    endStartTransition();
  }
}
/** BACKWARD, step → step: the pile gives its cards back into the reserved
 *  slots of a table that is already standing. */
async function stepBackReturn(step: StartWizardStep, target: number, from: number): Promise<void> {
  const names = picksForStep(picks.value, step.id);
  // ① THE KINETIC ANSWER, in the press's own frame: the shelf pile that
  // is about to give the cards back physically stirs, and the table the
  // player is leaving starts to retire. Neither of them is text.
  pressPile(pileElFor(step.id));
  setStartTransitionPhase('parking-current-surface');
  await parkPane(from, -1);
  // ② THE RECEIVING TABLE COMES BACK FIRST — cached, never re-dealt: the
  // same cards in the same slots, with the returning card's slot RESERVED
  // (held empty) so the layout is final before anything flies into it.
  setStartTransitionPhase('committing-previous-stage');
  names.forEach((n) => returningNames.value.add(`${step.id}|${n}`));
  driftDockPile(step.id, names.length);
  holdPaneForReveal(paneElAt(target));
  state.stepIdx = target;
  await nextTick();
  clearSurfaceParking(paneElAt(from));
  fitCardStrip();
  setStartTransitionPhase('revealing-previous-surface');
  await revealPane(target, -1);
  // ③ The reserved slots are measured on the settled table…
  setStartTransitionPhase('preparing-reserved-slots');
  await measureTargets(names, (n) => stepSlotEl(step.id, n), 40);
  fitLocked.value = true;
  // ④ …and only NOW does the card leave the shelf, back-side up, turning
  // face-up in the air and settling into the slot it came from.
  setStartTransitionPhase('releasing-selection-from-dock');
  setStartTransitionPhase('transferring-selection-home');
  await returnFromDock(
    names,
    pileElFor(step.id),
    (name) => stepSlotEl(step.id, name),
    (name) => returningNames.value.delete(`${step.id}|${name}`),
    () => driftDockPile(step.id, -1),
  );
  setStartTransitionPhase('docking-selection-home');
}
/** BACKWARD, summary → last step: the laid-out set is picked up as one —
 *  the target step's picks go home to their grid slots, every other group
 *  gathers back onto its shelf pile. Two batches, two destinations, one
 *  gesture; neither can wipe the other (per-batch ownership). */
async function fromSummaryReturn(step: StartWizardStep, target: number): Promise<void> {
  const names = picksForStep(picks.value, step.id);
  const stowGroups = steps.value
    .filter((st) => st.id !== step.id)
    .map((st) => ({st, names: picksForStep(picks.value, st.id)}))
    .filter((g) => g.names.length > 0);
  const pileOf = new Map<CardName, StartWizardStep['id']>();
  stowGroups.forEach((g) => g.names.forEach((n) => pileOf.set(n, g.st.id)));
  const tileSource = (n: CardName): DockFlightSource | undefined => {
    const el = summaryTileFor(n);
    return el === null ? undefined : {name: n, el};
  };
  const homeSources = names.map(tileSource).filter((s): s is DockFlightSource => s !== undefined);
  const stowSources = [...pileOf.keys()].map(tileSource).filter((s): s is DockFlightSource => s !== undefined);
  const homeCapture = captureCards(homeSources);
  const stowCapture = captureCards(stowSources);
  // ONE VISUAL OWNER: the tiles are held empty in the same paint their
  // proxies spawn — a card can never lie open in the summary while its
  // copy is in the air.
  [...homeSources, ...stowSources].forEach((s) => summaryStowing.value.add(s.name));
  names.forEach((n) => returningNames.value.add(`${step.id}|${n}`));
  try {
    setStartTransitionPhase('compressing-selection');
    await Promise.all([homeCapture.impulse(), stowCapture.impulse()]);
    setStartTransitionPhase('lifting-selection');
    setStartTransitionPhase('parking-current-surface');
    await parkSurface(summaryPane.value ?? undefined, -1);
    // The receiving table first, exactly as in the step→step return.
    setStartTransitionPhase('committing-previous-stage');
    stowGroups.forEach((g) => driftDockPile(g.st.id, -g.names.length));
    holdPaneForReveal(paneElAt(target));
    state.stepIdx = target;
    await nextTick();
    clearSurfaceParking(summaryPane.value ?? undefined);
    fitCardStrip();
    setStartTransitionPhase('revealing-previous-surface');
    await revealPane(target, -1);
    setStartTransitionPhase('preparing-reserved-slots');
    await measureTargets(names, (n) => stepSlotEl(step.id, n), 40);
    fitLocked.value = true;
    setStartTransitionPhase('transferring-selection-home');
    await Promise.all([
      homeCapture.flyTo(
        (n) => stepSlotEl(step.id, n),
        (n) => returningNames.value.delete(`${step.id}|${n}`),
        {flipTo: FACE_UP_DEG}),
      stowCapture.flyTo(
        (n) => pileElFor(pileOf.get(n) ?? ''),
        (n) => {
          const id = pileOf.get(n);
          if (id !== undefined) {
            driftDockPile(id, 1);
          }
        },
        {
          flipTo: FACE_DOWN_DEG,
          reseat: false,
          pressElFor: (n) => pileElFor(pileOf.get(n) ?? ''),
        }),
    ]);
    setStartTransitionPhase('docking-selection-home');
  } finally {
    homeCapture.dispose();
    stowCapture.dispose();
  }
}
function summaryTileFor(name: CardName): HTMLElement | null {
  const root = sceneRoot();
  if (root === undefined) {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name;
  return root.querySelector<HTMLElement>(`.con-start__summary [data-zoom-slot="${esc}"], .con-start__mini[data-zoom-slot="${esc}"]`);
}
function dealDelay(i: number): Record<string, string> {
  if (consoleReducedMotionActive()) {
    return {};
  }
  return {animationDelay: `calc(${Math.min(i, 12) * 55}ms * var(--motion-scale, 1))`};
}
function isPickedHere(name: CardName): boolean {
  return picksHere.value.includes(name);
}
function isFocused(kind: Focusable['kind'], name: CardName): boolean {
  const f = focusedItem.value;
  return f !== undefined && f.kind === kind && f.name === name;
}
/** Summary focus cursor: is the flat-indexed tile the focused one? */
function isSummaryFocused(idx: number): boolean {
  return onSummary.value && focusIdx.value === idx;
}
/** The launch readout's visible label for a seat (the bot resolves to
 *  its localized display name — never a raw «MarsBot»). */
function crewName(mate: StartCrewMate): string {
  return participantDisplayName({name: mate.name, isMarsBot: mate.isMarsBot});
}
function disabledCardReason(card: CardModel): string {
  const reason = card.disabledReason;
  if (reason !== undefined && reason !== '') {
    return textOf(reason);
  }
  // Merger's unaffordable corps now carry the server's own reason (see
  // Merger.bespokePlay). Guessing "not enough M€" for anything else that
  // ever lands here would be a lie the moment a second case appears — say
  // only what is true.
  return translateText('This card cannot be chosen here');
}
/** The shell routes every intent here while the scene is active. */
function handleIntent(intent: GamepadIntent): void {
  // (LETTING GO is not this surface's business: the shared hold gate
  // observes the intent bus itself, above every consuming branch —
  // `consoleHoldConfirm`. A surface that had to be trusted to forward the
  // button-up is exactly how a released hold once kept filling.)
  // YIELDED — the board owns the screen (see the `yielded` prop). The
  // shell stops routing here (`startSceneOwnsPad`), so this is defence:
  // the guard sits at the ENTRY, not on `onPress` alone, because `onNav`
  // is an intent too — an unguarded d-pad walked the INVISIBLE queue
  // while the player was trying to move over the board's hexes.
  if (props.yielded) {
    return;
  }
  // Any input mid-deal SKIPS the cinematic (and is consumed) — the
  // player is never made to wait, and no press can act on cards that
  // aren't interactive yet.
  if (deal.value.state.active) {
    deal.value.skip();
    return;
  }
  // THE INPUT LOCK: while the director is mid-motion (dock flights, the
  // commit round trip, the materialization, the final release) every
  // press is absorbed — a repeat A cannot double-fire, LT/RT cannot fork
  // a flight, B cannot tear down a surface a proxy is flying over. The swallow is NOTED (the ledger): a press that
  // landed inside the summary's arrival beat is retried by a driver once the motion lets go, never read as taken.
  if (startFlowBusy()) {
    noteInputAbsorbed(START_FLOW_ABSORBER);
    return;
  }
  // THE «ЭФФЕКТЫ» LAYER owns the pad while it stands; R3 on the standing first-action briefing opens it (TR81 — the
  // forecast's law 9: every surface that draws the table's answer is a door). Resolved before the semantic map.
  if (firstActionFxOpen.value) {
    forecastHostIntent('start', intent, forecastLayer.value ?? undefined);
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickR' && firstActionForecastCanOpen.value) {
    openFirstActionForecast();
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickR' && queueForecastCanOpen.value) {
    openQueueForecast();
    return;
  }
  // THE LEGACY OVERVIEW owns every intent while it exists: d-pad walks
  // the legacy cards, X inspects, B / R3 return — and its own motion
  // beats absorb everything (a press mid-flight can neither double-open
  // nor tear the stage a clone is flying into).
  if (legacyViewOn.value) {
    handleLegacyViewIntent(intent);
    return;
  }
  // THE TENDER DOOR's list owns every intent while it exists (§19): ◀ ▶ walk, A executes a certificate of this page,
  // X inspects, B / L3 return — its own motion beats absorb everything.
  if (tenderViewOn.value) {
    handleTenderViewIntent(intent);
    return;
  }
  // L3 — the tender door, on EVERY wizard page (the dock's «ТЕНДЕРЫ» block stands left of «НАСЛЕДИЕ»: left stick for
  // the left door, as R3 is the legacy's). A standing mode keeps the stick (its press would leave a half-made choice).
  if (intent.kind === 'press' && intent.button === 'stickL' && tenderDoorAvailable.value) {
    if (state.tenderMode === undefined && !tenderDoorMoving.value) {
      openTenderView();
    } else if (tenderDoorMoving.value) {
      noteInputAbsorbed(TENDER_DOOR_ABSORBER);
    }
    return;
  }
  // R3 — the legacy-overview door, on EVERY wizard page (the corp step
  // through the summary, the sent-and-awaiting summary included).
  if (intent.kind === 'press' && intent.button === 'stickR' &&
      legacyOverviewAvailable.value && state.tenderMode === undefined) {
    openLegacyOverview();
    return;
  }
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  const action = consoleActionOf(intent, START_INPUT_OVERRIDES);
  if (action === 'primary' && riskStage.value !== undefined) {
    // The stage is up: A no longer «confirms», it HOLDS. A reflex double
    // tap therefore cannot reach the commit at all — the second tap only
    // restarts a ring the player can watch not finishing.
    beginRiskHold();
    return;
  }
  if (action !== undefined) {
    onPress(action);
  }
}
/**
 * Start the hold that COMMITS a prelude whose effect will not happen.
 * Keyed per card, so a re-focus can never inherit somebody else's hold.
 */
function beginRiskHold(): void {
  const armed = riskArmed.value;
  if (armed === undefined) {
    return;
  }
  beginHoldConfirm(riskHoldKey.value, () => {
    // Re-check on completion: the hold spans real time, and the player may
    // have been moved off this card by a server response in the meantime.
    if (riskArmed.value === armed && focusedItem.value?.name === armed) {
      commitRiskyPlay(armed);
    }
  });
}
/**
 * THE COMMIT — the only path that plays a prelude whose effect is lost.
 * It hands straight back to the ordinary play (`actByName` runs with the
 * card already armed, so the gate above lets it through): the physical
 * animation, the hero landing and the queue's own bookkeeping are the
 * SAME ones every prelude uses. The only addition is the honest result
 * beat, latched here so it survives the card leaving the rail.
 */
function commitRiskyPlay(name: CardName): void {
  effectLostFor.value = name;
  cancelHoldConfirm();
  actByName(name);
}
/**
 * Drop the risk stage and everything armed with it. ONE exit used by B,
 * by every focus change, by the fullscreen browse, by the beat reset and
 * by the commit — so «the player is one input from losing an effect» can
 * never survive a navigation or a re-open.
 */
function clearRiskStage(): void {
  riskArmed.value = undefined;
  cancelHoldConfirm();
}
/**
 * DEAL CINEMATIC (console_card_deal.less / cardDealSequence.ts): decide
 * + arm the hold for the current frame's card set, synchronously —
 * called pre-flush from the frameKey watcher and on mount, so the real
 * cards render hidden from their very first frame.
 */
function prepareDeal(): void {
  if (dealLaunchTimer !== undefined) {
    dealLaunchTimer();
    dealLaunchTimer = undefined;
  }
  if (pageCovered.value) {
    // The page is parked under a tender's layer (the sheet commits before it hands the screen over): the deal is
    // OWED and plays once the page is back (`pageCovered`) — skipped, the new cards simply appeared, undealt.
    dealOwed.value = true;
    return;
  }
  dealOwed.value = false;
  const cards = dealCards.value;
  const allNames = cards.map((c) => c.name);
  // A VISITED step whose deal GREW or was REDEALT in place (a tender — «Открытый конкурс», a review) deals only
  // the cards that were not on the table: the ones already lying there never fly again (they did not move).
  const landed = mode.value === 'wizard' && state.visited.has(railPos.value) ? landedDealNames.get(railPos.value) : undefined;
  const fresh = cards.map((_c, i) => i).filter((i) => landed === undefined || !landed.has(cards[i].name));
  const names = fresh.map((i) => cards[i].name);
  const keys = fresh.map((i) => cards[i].name + '#' + i);
  dealSlotIdx.value = fresh.length < cards.length ? fresh : [];
  if (mode.value === 'wizard') {
    landedDealNames.set(railPos.value, new Set(allNames));
  }
  const dealKey = `${props.playerView.id}|${dealFrame.value}|${allNames.join(',')}`;
  if (deal.value.prepare(dealKey, names, keys)) {
    // Launch after the con-task-swap frame transition (160ms) settles +
    // fitCardStrip has sized the row — the measured rects are final.
    dealLaunchTimer = flow.after(motionMs(260), 'the deal\'s launch (the frame swap settles first)', () => {
      dealLaunchTimer = undefined;
      flow.afterFrame('the deal launches on a painted frame', () => launchDeal());
    });
  }
}
function launchDeal(): void {
  if (!deal.value.state.active) {
    return;
  }
  // A DEAL MEASURES ITS DESTINATIONS, so it may not run while the room is
  // still travelling back (the first-action stage hands the queue back
  // for its drawn candidates): slots inside a receding/returning surface
  // are neither where the cards will lie nor visible when they arrive —
  // that is the reported «прологи выкладываются без анимации». Re-arm
  // instead of dropping the cinematic.
  if (roomSettling.value || departureActive.value || glideActive.value || tenderHandoffActive.value) {
    // …and a REDEAL's new cards come off the deck only once the cards it took away have reached it (the review's
    // and the gamble's departure, §16.3): the deck answers after it has received.
    dealLaunchTimer = flow.after(motionMs(120), 'the deal\'s launch (the room is still settling)', () => {
      dealLaunchTimer = undefined;
      flow.afterFrame('the deal launches on a painted frame', () => launchDeal());
    });
    return;
  }
  const layer = dealLayer.value ?? undefined;
  if (layer === undefined) {
    deal.value.dispose();
    return;
  }
  let slotCards: Array<HTMLElement>;
  if (mode.value === 'wizard') {
    const strip = activeStrip();
    if (strip === undefined || strip === null) {
      deal.value.dispose();
      return;
    }
    const all = Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot > :is(.card-container, .pcard)'));
    // A deal that grew in place lands on the NEW slots only (`dealSlotIdx` — the indices `prepareDeal` armed).
    slotCards = dealSlotIdx.value.length > 0 ? dealSlotIdx.value.map((i) => all[i]).filter((el): el is HTMLElement => el !== undefined) : all;
  } else {
    // CEREMONY: drawn candidates deal into their QUEUE slots (the deck
    // deals — cards received into the queue arrive physically).
    const row = queueEl.value ?? undefined;
    if (row === undefined || row === null) {
      deal.value.dispose();
      return;
    }
    slotCards = candidateCards.value
      .map((c) => {
        const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(c.name) : c.name;
        return row.querySelector<HTMLElement>(`[data-queue-slot="${esc}"] :is(.card-container, .pcard)`);
      })
      .filter((el): el is HTMLElement => el !== null);
  }
  // A TENDER's deal comes OFF the tender deck the player watched the cards go into (a real pile — no synthetic
  // dealer rises); every other deal keeps the dealer.
  const tenderDeckNow = tenderDealArmed.value ? (tenderDeck.value ?? undefined) : undefined;
  const deckRect = tenderDeckNow?.getBoundingClientRect();
  if (tenderDeckNow !== undefined && deckRect !== undefined && deckRect.width > 4) {
    deal.value.launch({slotCards, proxies: layer.proxyEls(), deck: null, originEl: tenderDeckNow,
      originScale: deckRect.width / CARD_NATURAL_W});
    return;
  }
  deal.value.launch({slotCards, proxies: layer.proxyEls(), deck: layer.deckEl()});
}
/** The focus a freshly-entered frame opens on: a wizard step with an
 *  existing pick focuses the FIRST picked card (LB/RB returns land on
 *  the player's own choice); everything else starts at 0. */
function stepInitialFocus(): number {
  if (mode.value !== 'wizard' || currentStep.value === undefined) {
    return 0;
  }
  const idx = stepEntries.value.findIndex((c) => picksHere.value.includes(c.name));
  return idx > 0 ? idx : 0;
}
function onNav(dir: NavDirection): void {
  // P58 · FS — the «ОЧЕРЁДНОСТЬ» step owns the pad: every direction walks its ONE column (sealed rows walked over).
  if (orderStep.value !== undefined) {
    if (!orderSealed.value) {
      orderFocus.value = stepVariantFocus(orderStep.value, orderFocus.value, dir === 'down' || dir === 'right' ? 1 : -1);
    }
    return;
  }
  // THE «ВАРИАНТ» STEP owns the pad while it stands (P44): every direction walks its ONE column.
  if (variantStep.value !== undefined) {
    if (!variantSealed.value) {
      variantFocus.value = stepVariantFocus(variantStep.value, variantFocus.value, dir === 'down' || dir === 'right' ? 1 : -1);
    }
    return;
  }
  // A STANDING STAGE PANEL owns the pad: up/down walk its rows (the CTA
  // and the claimable gains). The room behind it is receded, so handing
  // the press to the invisible queue moved a focus nobody could see.
  if (stagePanelUp.value) {
    // ONE COLUMN, so EVERY d-pad direction walks it. A direction that
    // does nothing at all is indistinguishable from a dropped input at
    // couch distance — and this panel had two of them (↑ on the CTA, and
    // both horizontals).
    const step = dir === 'down' || dir === 'right' ? 1 : -1;
    stageCursor.value = Math.min(stageCtaIdx.value, Math.max(0, stageFocusIdx.value + step));
    return;
  }
  // The summary browses the whole chosen setup with FULL 2D spatial
  // navigation: ←/→ move along the row, ↑/↓ jump between the corp/prelude
  // and project SECTIONS by real geometry (nearest tile, no wrap-around).
  if (onSummary.value) {
    moveFocusSummary(dir);
    return;
  }
  // P13: the wizard GRID jumps rows on up/down (measured, wrap-robust).
  if (mode.value === 'wizard' && wizardGrid.value && (dir === 'up' || dir === 'down')) {
    moveFocusRow(dir === 'down' ? 1 : -1);
    return;
  }
  const step = dir === 'right' || dir === 'down' ? 1 : -1;
  const count = mode.value === 'wizard' ? wizardFocusCount.value : focusables.value.length;
  if (count === 0) {
    return;
  }
  const next = Math.min(count - 1, Math.max(0, focusIdx.value + step));
  if (next !== focusIdx.value) {
    focusIdx.value = next;
    armedSkip.value = false; armedTenders.value = false;
    clearRiskStage();
    void nextTick(() => scrollFocusedIntoView());
  }
}
/** PHYSICAL zoom origin: the fullscreen card lifts out of (and returns
 *  into) the `data-zoom-slot` tile for the browsed card; the underlying
 *  focus follows LB/RB so closing lands on the last-viewed card. */
function zoomOriginFor(names: ReadonlyArray<CardName>, follow: boolean) {
  return slotZoomOrigin(
    () => root.value as HTMLElement,
    (i) => names[i] ?? '',
    follow ? (i) => {
      focusIdx.value = i;
      // Browsing away in fullscreen is a navigation like any other — an
      // armed burn does not follow the player onto the next card.
      clearRiskStage();
      void nextTick(() => scrollFocusedIntoView());
    } : undefined,
  );
}
// ── CAMPAIGN: THE LEGACY OVERVIEW ──────────────────────────────────
/** The wizard page the overview descends FROM — the surface that PARKS
 *  under the rising cards and un-parks on the way back. */
function legacyPageEl(): HTMLElement | undefined {
  const el = onSummary.value ? summaryPane.value : body.value;
  return el instanceof HTMLElement ? el : undefined;
}
/**
 * R3 / a shelf-tile click: descend into the «НАСЛЕДИЕ» tail. The phrase
 * is the start flow's own transfer grammar end to end: the current page
 * PARKS on the spot (`parkSurface` — it steps back into depth, the
 * same-frame answer to the press), the stage takes the page's exact
 * flex seat (prepared card places standing), and the legacy cards RISE
 * from their shelf tiles through the ONE take/carry/lay flight core.
 * Reversible; `closeLegacyOverview` is the exact mirror.
 */
function openLegacyOverview(name?: CardName): void {
  if (!legacyOverviewAvailable.value || legacyView.value.phase !== 'closed') {
    return;
  }
  const cards = legacyOverviewCards.value;
  const idx = name !== undefined ? cards.findIndex((c) => c.name === name) : 0;
  legacyView.value.focus = Math.max(0, idx);
  // Every stage seat is born PREPARED (the ring) and reveals only on its
  // own card's touchdown.
  legacyStageHeld.value = new Set(cards.map((c) => c.name));
  legacyView.value.phase = 'fading';
  // The park IS the completion signal of the release beat — never a
  // timer racing it.
  void parkSurface(legacyPageEl() ?? null, 1)
    .then(() => void enterLegacyStage());
}
/** The stage takes the body: v-show swap in one flush (the parked page —
 *  already at alpha 0 — hides, the stage shows in the same flex seat:
 *  same rect, no reflow), fit the seats, then RISE the shelf tiles. */
async function enterLegacyStage(): Promise<void> {
  if (legacyView.value.phase !== 'fading') {
    return;
  }
  legacyView.value.phase = 'entering';
  await nextTick();
  fitLegacyView();
  await nextTick();
  // One settled frame: the zoom var must be applied before measuring.
  await whenPainted();
  if (legacyView.value.phase !== 'entering') {
    return; // torn down mid-beat (mode flip / unmount)
  }
  const names = legacyOverviewCards.value.map((c) => c.name);
  const root = sceneRoot();
  const pairs = names
    .map((n) => ({
      name: n,
      fromEl: root?.querySelector<HTMLElement>(`[data-legacy-dock="${n}"]`) ?? null,
      toEl: root?.querySelector<HTMLElement>(`[data-legview-slot="${n}"]`) ?? null,
    }))
    .filter((p): p is {name: CardName, fromEl: HTMLElement, toEl: HTMLElement} =>
      p.fromEl !== null && p.toEl !== null);
  const convoy = riseToSeats(pairs,
    // Touchdown: the seat reveals under the proxy (the handoff frame).
    (n) => legacyStageHeld.value.delete(n),
    // Depart (the take's end): the tile physically empties — the shelf
    // counts follow the cards, never the state flip.
    (n) => {
      if (!legacyDockHeld.value.includes(n)) {
        legacyDockHeld.value = [...legacyDockHeld.value, n];
      }
    });
  legacyRise.value = convoy;
  await convoy.settled;
  legacyRise.value = undefined;
  if (legacyView.value.phase === 'entering') {
    // Reconcile the end state (a degraded pair resolves here too).
    legacyStageHeld.value = new Set();
    legacyDockHeld.value = [...names];
    legacyView.value.phase = 'open';
  }
}
/**
 * B / R3 from the overview — the exact mirror: capture the seats where
 * they stand, answer the press with the IMPULSE (the cards compress and
 * release into the take in the same interaction frame), fold the stage
 * chrome under the travelling cards, and fly each one home — its shelf
 * tile takes the landing weight (`pressElFor`). Then the parked page
 * surfaces back. The player is exactly where they descended from.
 */
async function closeLegacyOverview(): Promise<void> {
  if (legacyView.value.phase !== 'open') {
    return;
  }
  const names = legacyOverviewCards.value.map((c) => c.name);
  const root = sceneRoot();
  const tileOf = (n: CardName) => root?.querySelector<HTMLElement>(`[data-legacy-dock="${n}"]`) ?? null;
  const sources: Array<DockFlightSource> = [];
  for (const n of names) {
    const el = root?.querySelector<HTMLElement>(`[data-legview-slot="${n}"]`);
    if (el instanceof HTMLElement) {
      sources.push({name: n, el});
    }
  }
  const flight = captureCards(sources);
  legacyFlight.value = flight;
  // The seats empty into their prepared places the SAME tick — the
  // proxies cover them pixel-true from this frame.
  legacyStageHeld.value = new Set(names);
  legacyView.value.phase = 'leaving';
  await flight.impulse();
  if (legacyView.value.phase !== 'leaving') {
    flight.dispose();
    legacyFlight.value = undefined;
    return; // torn down under the impulse
  }
  // THE PAGE COMES BACK UNDER THE CONVOY: once the stage chrome has
  // folded (a choreographic offset of this scene's own phrase — the fold
  // keyframe's length), the parked page surfaces while the cards are
  // still landing on the shelf. The body never stands empty behind a
  // travelling convoy — the LT step-return's own parallelism.
  legacyRestoreTimer?.();
  legacyRestoreTimer = flow.after(motionMs(320), 'the parked page surfaces under the legacy convoy', () => {
    legacyRestoreTimer = undefined;
    if (legacyView.value.phase === 'leaving') {
      legacyPageRestored.value = true;
      void nextTick().then(() => void unparkSurface(legacyPageEl() ?? null, 1));
    }
  });
  await flight.flyTo(tileOf,
    (n) => {
      legacyDockHeld.value = legacyDockHeld.value.filter((held) => held !== n);
    },
    {reseat: false, pressElFor: tileOf});
  legacyFlight.value = undefined;
  if (legacyView.value.phase === 'leaving') {
    settleLegacyClosed();
  }
}
/**
 * The stage is gone; the parked page SURFACES BACK (`unparkSurface` —
 * the same table the player left, no re-deal, picks intact). ALSO the
 * teardown target (mode flip / unmount / failed measure): `teardown`
 * restores the page INSTANTLY (clearSurfaceParking on both panes — a
 * parked pane left at alpha 0 would come back invisible) and must leave
 * no holds, convoys or captured proxies behind.
 */
function settleLegacyClosed(teardown = false): void {
  legacyRestoreTimer?.();
  legacyRestoreTimer = undefined;
  legacyRise.value?.dispose();
  legacyRise.value = undefined;
  legacyFlight.value?.dispose();
  legacyFlight.value = undefined;
  legacyDockHeld.value = [];
  legacyStageHeld.value = new Set();
  const wasUp = legacyView.value.phase !== 'closed';
  const pageBack = legacyPageRestored.value;
  legacyView.value.phase = 'closed';
  legacyPageRestored.value = false;
  if (teardown || !wasUp) {
    clearSurfaceParking(body.value instanceof HTMLElement ? body.value : null);
    clearSurfaceParking(summaryPane.value instanceof HTMLElement ? summaryPane.value : null);
    return;
  }
  if (pageBack) {
    return; // the page already surfaced under the convoy
  }
  // The v-show swap lands on the next patch; the page un-parks from
  // there (it stands at alpha 0 until then — no flash).
  void nextTick().then(() => void unparkSurface(legacyPageEl() ?? null, 1));
}
/** The overview's whole input surface (the stage owns the pad). */
function handleLegacyViewIntent(intent: GamepadIntent): void {
  if (legacyView.value.phase !== 'open') {
    return; // a motion beat — absorb (no double-open, no mid-flight tear)
  }
  if (intent.kind === 'nav') {
    const count = legacyOverviewCards.value.length;
    if (count === 0) {
      return;
    }
    const step = intent.dir === 'right' || intent.dir === 'down' ? 1 : -1;
    legacyView.value.focus = Math.min(count - 1, Math.max(0, legacyView.value.focus + step));
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  if (intent.button === 'stickR' || intent.button === 'back') {
    if (state.tenderBusy !== undefined) {
      return; // the answer is on the wire — the stage stands until the deal comes back
    }
    void closeLegacyOverview();
    return;
  }
  if (intent.button === 'secondary') {
    zoomLegacyFocused();
    return;
  }
  // Everything else is deliberately absorbed: the pages underneath must
  // not move while the player reads their legacy.
}
// ── CAMPAIGN «ТЕНДЕРЫ» — THE DOOR's list, a tender's MODE on its page, the commit's scenes (§19) ──
/** ONE door for every tender answer: the picks are armed to survive the redeal, the instance goes busy. */
function submitTender(response: TenderResponse): void {
  armStartRedealRestore();
  state.tenderBusy = response.instance;
  emit('submit', response);
}
/**
 * L3 / a click on the dock's «ТЕНДЕРЫ» block: the DOOR opens. The phrase is the legacy overview's own: the page
 * PARKS on the spot, the list takes the page's exact flex seat, and the certificates RISE out of the dock's
 * miniatures (the ONE take/carry/lay core). The cursor lands on the first certificate of THIS page (the list's head).
 */
function openTenderView(): void {
  if (!tenderDoorAvailable.value || tenderView.value.phase !== 'closed' || state.tenderMode !== undefined) {
    return;
  }
  // The page's cards as the player sees them NOW — a tender that grows the deal glides them from here.
  rememberPageSlots();
  tenderView.value.focus = 0;
  tenderListHeld.value = doorEntries.value.map((e) => e.instance);
  tenderView.value.phase = 'fading';
  void parkSurface(legacyPageEl() ?? null, 1)
    .then(() => void enterTenderView());
}
async function enterTenderView(): Promise<void> {
  if (tenderView.value.phase !== 'fading') {
    return;
  }
  tenderView.value.phase = 'entering';
  await nextTick();
  fitTenderList();
  await whenPainted();
  if (tenderView.value.phase !== 'entering') {
    return; // torn down mid-beat
  }
  const root = sceneRoot();
  const pairs = doorEntries.value
    .map((e) => ({
      name: e.instance as CardName,
      fromEl: root?.querySelector<HTMLElement>(`[data-tender-dock-chip="${e.instance}"]`) ?? null,
      toEl: root?.querySelector<HTMLElement>(`[data-tport-slot="${e.instance}"]`) ?? null,
    }))
    .filter((p): p is {name: CardName, fromEl: HTMLElement, toEl: HTMLElement} => p.fromEl !== null && p.toEl !== null);
  const convoy = riseToSeats(pairs,
    (n) => {
      tenderListHeld.value = tenderListHeld.value.filter((x) => x !== n);
    },
    (n) => {
      if (!tenderDockHeld.value.includes(n)) {
        tenderDockHeld.value = [...tenderDockHeld.value, n];
      }
    });
  tenderRise.value = convoy;
  await convoy.settled;
  tenderRise.value = undefined;
  if (tenderView.value.phase === 'entering') {
    tenderListHeld.value = [];
    tenderDockHeld.value = doorEntries.value.map((e) => e.instance);
    tenderView.value.phase = 'open';
  }
}
/**
 * B / L3 from the list — the exact mirror: the certificates fly home into their miniatures, the page surfaces back
 * under the convoy (the same table the player left — same cards, same size, picks untouched). Resolves when the
 * last certificate has landed; `then` runs once the PAGE is the one on screen (a chosen tender's mode stands there).
 */
async function closeTenderView(then?: () => void, keepPageParked = false): Promise<void> {
  if (tenderView.value.phase !== 'open') {
    return;
  }
  const root = sceneRoot();
  const miniOf = (n: CardName) => root?.querySelector<HTMLElement>(`[data-tender-dock-chip="${n}"]`) ?? null;
  const sources: Array<DockFlightSource> = [];
  for (const e of doorEntries.value) {
    const el = root?.querySelector<HTMLElement>(`[data-tport-slot="${e.instance}"]`);
    if (el instanceof HTMLElement) {
      sources.push({name: e.instance as CardName, el});
    }
  }
  const flight = captureCards(sources);
  tenderFlight.value = flight;
  tenderListHeld.value = doorEntries.value.map((e) => e.instance);
  tenderView.value.phase = 'leaving';
  await flight.impulse();
  if (tenderView.value.phase !== 'leaving') {
    flight.dispose();
    tenderFlight.value = undefined;
    return;
  }
  tenderRestoreTimer?.();
  tenderRestoreTimer = flow.after(motionMs(320), 'the parked page surfaces under the tender convoy', () => {
    tenderRestoreTimer = undefined;
    if (tenderView.value.phase === 'leaving') {
      tenderPageRestored.value = true;
      then?.();
      then = undefined;
      // A tender whose own layer takes the page's place (the restructuring) keeps the page PARKED — the list hands
      // the screen straight to that layer; unparking here raced the layer's own park (a killed tween never resolves).
      if (!keepPageParked) {
        void nextTick().then(() => void unparkSurface(legacyPageEl() ?? null, 1));
      }
    }
  });
  await flight.flyTo(miniOf,
    (n) => {
      tenderDockHeld.value = tenderDockHeld.value.filter((held) => held !== n);
    },
    {reseat: false, pressElFor: miniOf});
  tenderFlight.value = undefined;
  if (tenderView.value.phase === 'leaving') {
    settleTenderViewClosed();
    then?.();
  }
}
/** The list is gone, the page is back. Also the teardown target (mode flip / unmount): no holds, no proxies left. */
function settleTenderViewClosed(teardown = false): void {
  tenderRestoreTimer?.();
  tenderRestoreTimer = undefined;
  tenderRise.value?.dispose();
  tenderRise.value = undefined;
  tenderFlight.value?.dispose();
  tenderFlight.value = undefined;
  tenderDockHeld.value = [];
  tenderListHeld.value = [];
  tenderSheet.value = undefined;
  const wasUp = tenderView.value.phase !== 'closed';
  const pageBack = tenderPageRestored.value;
  tenderView.value.phase = 'closed';
  tenderPageRestored.value = false;
  if (teardown || !wasUp) {
    clearSurfaceParking(body.value instanceof HTMLElement ? body.value : null);
    clearSurfaceParking(summaryPane.value instanceof HTMLElement ? summaryPane.value : null);
    return;
  }
  if (!pageBack) {
    void nextTick().then(() => void unparkSurface(legacyPageEl() ?? null, 1));
  }
}
/** The list's whole input surface: ◀ ▶ walk, A executes a certificate of this page, X inspects, B / L3 return. */
function handleTenderViewIntent(intent: GamepadIntent): void {
  if (tenderSheet.value !== undefined) {
    handleSheetIntent(intent);
    return;
  }
  if (tenderView.value.phase !== 'open') {
    noteInputAbsorbed(TENDER_DOOR_ABSORBER);
    return; // a motion beat — absorb (no double-open, no mid-flight tear)
  }
  if (intent.kind === 'nav') {
    const count = doorEntries.value.length;
    if (count === 0) {
      return;
    }
    const step = intent.dir === 'right' || intent.dir === 'down' ? 1 : -1;
    tenderView.value.focus = Math.min(count - 1, Math.max(0, tenderView.value.focus + step));
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  if (intent.button === 'stickL' || intent.button === 'back') {
    void closeTenderView();
    return;
  }
  if (intent.button === 'secondary') {
    openPortfolioZoom();
    return;
  }
  if (intent.button === 'confirm') {
    chooseDoorEntry();
  }
}
/**
 * A on a certificate in the list: one of THIS page goes home with its siblings and stands on the page in its MODE
 * (the page is the one the player chose it on — no travel, no new surface); any other names why on the bar (the
 * press is refused with a nudge, never silently).
 */
function chooseDoorEntry(): void {
  const entry = focusedDoorEntry.value;
  if (entry === undefined || state.tenderBusy !== undefined) {
    return;
  }
  if (entry.state !== 'ready') {
    blockedNudge.value++;
    return;
  }
  // The chosen tender becomes the HERO of its activation sheet (§20) — what it does and what it gives, in numbers.
  void openSheet(entry);
}
/** THE RESTRUCTURING's layer over the page: the page parks, the ONE row stands (the lineage marked). */
async function openRestructureMode(instance: string, offer: ReadonlyArray<CardName>, pageParked = false): Promise<void> {
  restructFocusReturn.value = focusIdx.value;
  if (!pageParked) {
    await parkSurface(legacyPageEl() ?? null, 1);
  }
  // The deal's answer may have arrived while the page was parking — its candidates are already on the mode.
  const already = restructureMode.value;
  if (already === undefined || already.instance !== instance) {
    state.tenderMode = {kind: 'restructure', instance, offer: [...offer]};
  }
  focusIdx.value = 0;
  void nextTick(() => {
    fitRestructureRow();
    placeTenderDeck();
  });
}
/**
 * THE ROW's card size — ONE zoom for the lineage and the candidates, solved from the pane for the WHOLE row (the
 * lineage + the candidates' places), so the candidates landing change no box.
 */
function fitRestructureRow(): void {
  const pane = restructPane.value ?? undefined;
  const row = pane?.querySelector<HTMLElement>('.con-restructure');
  if (pane === undefined || row === null || row === undefined) {
    return;
  }
  const n = campaignLineage.value.length + TENDER_RESTRUCTURING_CANDIDATES;
  const rem = parseFloat(window.getComputedStyle(row).fontSize) || 16;
  // Width: the row's paddings, the gaps, the divider. Height: the paddings, the caption + its clearance over the
  // cards' top band, and the cursor's lift room (the focused card rises — it must not touch the status rail).
  const availW = pane.clientWidth - 2.4 * rem - (n - 1) * 1.9 * rem - 4.4 * rem;
  const availH = pane.clientHeight - 0.8 * rem - 3.2 * rem - 1.8 * rem;
  if (availW <= 0 || availH <= 0) {
    return;
  }
  const zoom = Math.max(0.3, Math.min(availW / (n * 320), availH / 445, 1.2 * conUiScale()));
  row.style.setProperty('--con-restruct-zoom', zoom.toFixed(3));
}
/** The restructuring's layer lets go: the page surfaces back as it was (its cursor too). */
function leaveRestructureLayer(): void {
  restructFlight?.dispose();
  restructFlight = undefined;
  restructArriving.value = new Set();
  focusIdx.value = restructFocusReturn.value;
  void nextTick().then(() => void unparkSurface(legacyPageEl() ?? null, -1));
}
/**
 * THE CANDIDATES COME OFF THE DECK: the server drew them — their slots stand held, each card leaves the tender
 * deck in turn and lands in its place (the face reveals on its own touchdown). Reduced motion / no measurable
 * deck: they simply stand.
 */
async function dealRestructureCandidates(instance: string, offer: ReadonlyArray<CardName>): Promise<void> {
  const mode = restructureMode.value;
  if (mode === undefined || mode.instance !== instance) {
    return;
  }
  restructArriving.value = new Set(offer);
  state.tenderMode = {...mode, offer: [...offer]};
  await nextTick();
  // The row's size and the deck's place are measured on the layer as it stands NOW (the page may have parked late).
  fitRestructureRow();
  placeTenderDeck();
  await whenPainted();
  const deck = tenderDeck.value ?? undefined;
  const deckRect = deck?.getBoundingClientRect();
  const root = sceneRoot();
  const faceOf = (n: CardName) => root?.querySelector<HTMLElement>(`[data-restruct-candidate="${CSS.escape(n)}"] :is(.card-container, .pcard)`) ?? null;
  const to = new Map<CardName, DOMRect>();
  for (const n of offer) {
    const r = faceOf(n)?.getBoundingClientRect();
    if (r !== undefined && r.width > 8) {
      to.set(n, r);
    }
  }
  if (deckRect === undefined || deckRect.width < 4 || to.size === 0 || consoleReducedMotionActive()) {
    restructArriving.value = new Set();
    return;
  }
  const from = new Map<CardName, DOMRect>(offer.map((n) => [n, deckRect]));
  restructFlight?.dispose();
  const flight: CloneFlightHandle = flyCardClones({
    names: [...offer],
    sourceEl: faceOf,
    from,
    to,
    layerClass: 'con-start-tdeal',
    onLand: (n) => {
      const next = new Set(restructArriving.value);
      next.delete(n);
      restructArriving.value = next;
    },
    onDone: () => {
      restructArriving.value = new Set();
      flight.dispose();
      if (restructFlight === flight) {
        restructFlight = undefined;
      }
      tenderDealArmed.value = false;
    },
    travelMs: 420,
    staggerMs: 140,
  });
  restructFlight = flight;
}
/** The tender DECK takes its place: the RIGHT END of the dock's row (frame coordinates) — under the body, over no card. */
function placeTenderDeck(): void {
  const frameNow = frame.value ?? undefined;
  const deck = tenderDeck.value ?? undefined;
  const dock = sceneRoot()?.querySelector<HTMLElement>('.con-startdock') ?? null;
  if (frameNow === undefined || deck === undefined || dock === null) {
    return;
  }
  const f = frameNow.getBoundingClientRect();
  const d = dock.getBoundingClientRect();
  if (d.width < 8) {
    return;
  }
  const w = deck.offsetWidth;
  const h = deck.offsetHeight;
  tenderDeckPos.value = {left: Math.round(d.right - f.left - w - 8), top: Math.round(d.top - f.top + (d.height - h) / 2)};
}
/** A in a mode: the exchange's mark · the restructuring's candidate / lineage pick · the request's tag · a confirm's commit. */
function toggleTenderModePick(): void {
  if (state.tenderBusy !== undefined) {
    noteInputAbsorbed(TENDER_DOOR_ABSORBER);
    return;
  }
  if (confirmMode.value !== undefined) {
    commitTenderMode();
    return;
  }
  const tagModeNow = tagMode.value;
  if (tagModeNow !== undefined) {
    const tag = requestTags.value[focusIdx.value];
    if (tag !== undefined && requestTagCount(tag) === 0) {
      blockedNudge.value++; // the bar names why (the deck has none) — the press is refused, never silently
      return;
    }
    if (tag !== undefined) {
      state.tenderMode = {...tagModeNow, tag: tagModeNow.tag === tag ? undefined : tag};
    }
    return;
  }
  const review = reviewMode.value;
  if (review !== undefined) {
    const name = stepEntries.value[focusIdx.value]?.name;
    if (name !== undefined) {
      const marked = review.release.includes(name);
      if (!marked && review.release.length >= reviewDeckLeft.value) {
        blockedNudge.value++; // the bar names why (the deck has no more) — refused, never silently
        return;
      }
      state.tenderMode = {...review, release: marked ? review.release.filter((n) => n !== name) : [...review.release, name]};
    }
    return;
  }
  const mode = restructureMode.value;
  if (mode === undefined) {
    return;
  }
  if (!restructurePickFacts.value.enabled) {
    blockedNudge.value++; // the bar names the rule («only one out» · «only one in») — refused, never silently
    return;
  }
  const lineageN = restructureLineageCards.value.length;
  if (focusIdx.value < lineageN) {
    const name = restructureLineageCards.value[focusIdx.value]?.name;
    if (name !== undefined) {
      state.tenderMode = {...mode, replace: mode.replace === name ? undefined : name};
    }
    return;
  }
  const name = restructureOfferCards.value[focusIdx.value - lineageN]?.name;
  if (name !== undefined) {
    state.tenderMode = {...mode, take: mode.take === name ? undefined : name};
  }
}
/**
 * THE COMMIT — the mode's one press, and its scene on the page the player is looking at:
 *  · a CONFIRM: a gamble's cards turn face down and go back to the deck before the new deal comes off it; a deal
 *    that GROWS (+2 preludes, +4 projects) first lets the standing cards GLIDE to their new places (`armDealGlide` —
 *    nothing jumps), then the new cards come off the deck into the places that opened;
 *  · the EXCHANGE: the marked cards go back to the deck, the rest stay where they lie, the fresh ones land in the
 *    freed places (`exchangeInPlace` on the server);
 *  · the REQUEST: its three cards join the deal with the same glide;
 *  · the RESTRUCTURING: the candidate takes the replaced charter's seat.
 */
function commitTenderMode(): void {
  if (state.tenderBusy !== undefined) {
    return;
  }
  const confirm = confirmMode.value;
  if (confirm !== undefined) {
    const response = tenderPressResponse({instance: confirm.instance, id: confirm.id});
    if (response === undefined) {
      return;
    }
    const page = currentStep.value?.id;
    tenderLanding.value = {instance: confirm.instance, step: page};
    if (isGambleTender(confirm.id) && page !== undefined) {
      void departToDeck(page, stepEntries.value.map((c) => c.name));
    } else {
      dealGlideArmed.value = true;
    }
    submitTender(response);
    return;
  }
  const tagModeNow = tagMode.value;
  if (tagModeNow !== undefined) {
    if (tagModeNow.tag !== undefined) {
      tenderLanding.value = {instance: tagModeNow.instance, step: 'projects'};
      dealGlideArmed.value = true;
      submitTender(tenderTagResponse(tagModeNow.instance, tagModeNow.tag));
    }
    return;
  }
  const review = reviewMode.value;
  if (review !== undefined) {
    tenderLanding.value = {instance: review.instance, step: review.pool};
    if (review.release.length === 0) {
      return;
    }
    void departToDeck(review.pool, [...review.release]);
    submitTender(tenderExchangeResponse(review.instance, review.release));
    return;
  }
  const mode = restructureMode.value;
  if (mode !== undefined && restructureState.value.valid) {
    submitTender(mode.take !== undefined && mode.replace !== undefined ?
      tenderRestructureResponse(mode.instance, mode.take, mode.replace) :
      tenderRestructureKeep(mode.instance));
  }
}
/** B / LT in a mode: the way out with nothing applied — the restructuring declines (the candidates go back). */
function cancelTenderMode(): void {
  const mode = state.tenderMode;
  if (mode === undefined || state.tenderBusy !== undefined) {
    return;
  }
  if (mode.kind === 'restructure') {
    return; // the cards are drawn — the decision cannot be undone (the owner, 2026-11-09); RT resolves it
  }
  if (mode.kind === 'tag') {
    focusIdx.value = tagFocusReturn.value;
  }
  state.tenderMode = undefined;
}
// ── THE ACTIVATION SHEET (§20) — the chosen tender as the hero of its own scene, then the hand-over to its page ──
/**
 * A on a certificate of THIS page: the list lets go of everything but the chosen one — its siblings fly home into
 * their miniatures, the chosen certificate is CARRIED out of its slot onto the hero seat of its sheet, and the RESULT
 * unfolds beside it once it has landed. No second copy of the card exists at any moment (one object, one teller).
 */
async function openSheet(entry: TenderPortfolioEntry): Promise<void> {
  if (tenderSheet.value !== undefined || tenderView.value.phase !== 'open') {
    return;
  }
  const root = sceneRoot();
  const miniOf = (n: CardName) => root?.querySelector<HTMLElement>(`[data-tender-dock-chip="${n}"]`) ?? null;
  const sources: Array<DockFlightSource> = [];
  for (const e of doorEntries.value) {
    const el = root?.querySelector<HTMLElement>(`[data-tport-slot="${e.instance}"]`);
    if (el instanceof HTMLElement) {
      sources.push({name: e.instance as CardName, el});
    }
  }
  // Capture where everything stands NOW (the list still painted), then let the sheet take the layer.
  const flight = captureCards(sources);
  tenderFlight.value = flight;
  tenderListHeld.value = doorEntries.value.map((e) => e.instance);
  sheetHeroHeld.value = true;
  sheetCommitted.value = false;
  sheetTagFocus.value = 0;
  sheetTagPicked.value = undefined;
  sheetPlanFrozen.value = undefined;
  sheetPanelOpen.value = false;
  tenderSheet.value = {instance: entry.instance, id: entry.id, phase: 'entering'};
  await nextTick();
  fitTenderSheet();
  await whenPainted();
  const hero = sheetHeroEl();
  await flight.flyTo((n) => (n === entry.instance ? hero : miniOf(n)),
    (n) => {
      if (n === entry.instance) {
        sheetHeroHeld.value = false;
        sheetPanelOpen.value = true;
      } else {
        tenderDockHeld.value = tenderDockHeld.value.filter((held) => held !== n);
      }
    },
    {reseat: true, pressElFor: (n) => (n === entry.instance ? null : miniOf(n))});
  tenderFlight.value = undefined;
  sheetHeroHeld.value = false;
  if (tenderSheet.value?.instance === entry.instance && tenderSheet.value.phase === 'entering') {
    tenderSheet.value = {...tenderSheet.value, phase: 'open'};
  }
}
/** The hero's seat (the certificate's landing and its take-off). */
function sheetHeroEl(): HTMLElement | null {
  const sheet = tenderSheetEl.value ?? undefined;
  return sheet?.heroEl?.() ?? null;
}
/**
 * B on the sheet — ONE level: back to the list. The hero is carried back into its slot and its siblings rise out of
 * the dock again; the cursor stands on the certificate the player had chosen.
 */
async function closeSheetToList(): Promise<void> {
  const sheet = tenderSheet.value;
  if (sheet === undefined || sheet.phase !== 'open') {
    return;
  }
  const hero = sheetHeroEl();
  const flight = captureCards(hero !== null ? [{name: sheet.instance as CardName, el: hero}] : []);
  tenderFlight.value = flight;
  tenderListHeld.value = doorEntries.value.map((e) => e.instance);
  sheetPanelOpen.value = false;
  tenderSheet.value = undefined;
  tenderView.value.focus = Math.max(0, doorEntries.value.findIndex((e) => e.instance === sheet.instance));
  tenderView.value.phase = 'entering';
  await nextTick();
  fitTenderList();
  await whenPainted();
  const root = sceneRoot();
  const slotOf = (n: string) => root?.querySelector<HTMLElement>(`[data-tport-slot="${n}"]`) ?? null;
  const pairs = doorEntries.value
    .filter((e) => e.instance !== sheet.instance)
    .map((e) => ({name: e.instance as CardName, fromEl: root?.querySelector<HTMLElement>(`[data-tender-dock-chip="${e.instance}"]`) ?? null, toEl: slotOf(e.instance)}))
    .filter((p): p is {name: CardName, fromEl: HTMLElement, toEl: HTMLElement} => p.fromEl !== null && p.toEl !== null);
  const convoy = riseToSeats(pairs,
    (n) => {
      tenderListHeld.value = tenderListHeld.value.filter((x) => x !== n);
    },
    (n) => {
      if (!tenderDockHeld.value.includes(n)) {
        tenderDockHeld.value = [...tenderDockHeld.value, n];
      }
    });
  tenderRise.value = convoy;
  await Promise.all([
    convoy.settled,
    flight.flyTo((n) => slotOf(n), (n) => {
      tenderListHeld.value = tenderListHeld.value.filter((x) => x !== n);
    }, {reseat: true}),
  ]);
  tenderRise.value = undefined;
  tenderFlight.value = undefined;
  if (tenderView.value.phase === 'entering') {
    tenderListHeld.value = [];
    tenderView.value.phase = 'open';
  }
}
/** The sheet's whole input surface: A (and RT for a request) commits, the tags walk, X reads the hero, B goes back. */
function handleSheetIntent(intent: GamepadIntent): void {
  const sheet = tenderSheet.value;
  if (sheet === undefined || sheet.phase !== 'open' || state.tenderBusy !== undefined) {
    noteInputAbsorbed(TENDER_DOOR_ABSORBER);
    return;
  }
  const tags = sheetTags.value;
  if (intent.kind === 'nav') {
    if (tags !== undefined && tags.length > 0) {
      // ONE grid (`tagGridCols`): ←→ a tile, ↑↓ a row — the column kept, never wrapping past an edge.
      const cols = tagGridCols(tags.length);
      const step = intent.dir === 'right' ? 1 : intent.dir === 'left' ? -1 : intent.dir === 'down' ? cols : -cols;
      const next = sheetTagFocus.value + step;
      if (next >= 0 && next < tags.length) {
        sheetTagFocus.value = next;
      }
    }
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  switch (intent.button) {
  case 'back':
  case 'stickL':
    void closeSheetToList();
    return;
  case 'secondary': {
    const entry = tenderSheetEntry.value;
    if (entry !== undefined) {
      openConsoleCardZoom([tenderZoomEntry(entry.id, {instance: entry.instance, state: tenderCardStateOf(entry.status)})], 0, undefined, undefined, {
        contextLabel: 'Tenders',
        origin: {kind: 'physical', resolve: () => sheetHeroEl()},
      });
    }
    return;
  }
  case 'confirm':
    if (tags !== undefined) {
      const t = tags[sheetTagFocus.value];
      if (t === undefined || t.count === 0) {
        blockedNudge.value++;
        return;
      }
      sheetTagPicked.value = sheetTagPicked.value === t.tag ? undefined : t.tag;
      return;
    }
    void commitSheet();
    return;
  case 'triggerR':
    if (tags !== undefined && sheetTagPicked.value !== undefined) {
      void commitSheet();
    }
    return;
  default:
    return;
  }
}
/**
 * THE ACTIVATION — the sheet's one commit. The Committee's stamp comes down on the hero (a one-shot), the answer goes
 * out (a gamble's only after its cards are back in the deck — the deck answers after it has received), and the sheet
 * HANDS the screen to the page whose cards it changes, where the change plays: the cards that stay glide to their new
 * places, the new ones come off the tender deck, the price ticks in the purchase ledger. An exchange and the
 * restructuring are not executed here — their sheet hands over to the page's marking / the restructuring's row.
 */
async function commitSheet(): Promise<void> {
  const sheet = tenderSheet.value;
  const plan = tenderSheetPlan.value;
  if (sheet === undefined || plan === undefined || sheet.phase !== 'open') {
    return;
  }
  const page = currentStep.value?.id;
  switch (plan.kind) {
  case 'review': {
    const pool = sheet.id === 'preludeReview' ? 'prelude' : 'projects';
    await handOffSheet(false);
    state.tenderMode = {kind: 'review', instance: sheet.instance, pool, release: []};
    return;
  }
  case 'restructure': {
    await handOffSheet(true);
    const live = (wizardInput.value?.tenders ?? []).find((t) => t.instance === sheet.instance);
    if (live?.offer !== undefined) {
      void openRestructureMode(sheet.instance, live.offer, true);
      return;
    }
    void openRestructureMode(sheet.instance, [], true);
    state.restructureOpening = sheet.instance;
    tenderDealArmed.value = true;
    submitTender({type: 'tender', instance: sheet.instance});
    return;
  }
  default:
    break;
  }
  // A one-press tender (and the request with its tag): the stamp, then the answer, then the hand-over.
  const response = plan.kind === 'tag' ?
    (sheetTagPicked.value !== undefined ? tenderTagResponse(sheet.instance, sheetTagPicked.value) : undefined) :
    tenderPressResponse({instance: sheet.instance, id: sheet.id});
  if (response === undefined) {
    return;
  }
  sheetPlanFrozen.value = plan;
  ledgerHold.value = ledgerView.value;
  tenderSheet.value = {...sheet, phase: 'committing'};
  sheetCommitted.value = true;
  sheetStamping.value = true;
  flow.after(motionMs(620), 'the sheet\'s stamp one-shot ends', () => {
    sheetStamping.value = false;
  });
  const gamble = isGambleTender(sheet.id);
  const grows = sheet.id === 'openCall' || sheet.id === 'broadPortfolio' || sheet.id === 'targetedRequest';
  tenderLanding.value = {instance: sheet.instance, step: page};
  if (grows) {
    dealGlideArmed.value = true;
    tenderDealArmed.value = true;
  }
  if (!gamble) {
    submitTender(response);
  }
  await span(motionMs(560));
  await handOffSheet(false);
  if (gamble && page !== undefined) {
    // The page is back: every card of it goes back into the tender deck, THEN the new deal is asked for.
    await departToDeck(page, stepEntries.value.map((c) => c.name));
    submitTender(response);
  }
}
/**
 * THE HAND-OVER: the RESULT folds, the hero flies home into its miniature (the dock answers the landing; a stamped
 * one takes the stamp's one-shot there too), and the page surfaces from behind the glass — or stays parked for a
 * layer that takes its place (the restructuring). Resolves once the screen is the page's.
 */
async function handOffSheet(keepPageParked: boolean): Promise<void> {
  const sheet = tenderSheet.value;
  if (sheet === undefined) {
    return;
  }
  tenderHandoffActive.value = true;
  const root = sceneRoot();
  const miniOf = (n: CardName) => root?.querySelector<HTMLElement>(`[data-tender-dock-chip="${n}"]`) ?? null;
  const hero = sheetHeroEl();
  const flight = captureCards(hero !== null ? [{name: sheet.instance as CardName, el: hero}] : []);
  tenderFlight.value = flight;
  sheetHeroHeld.value = true;
  sheetPanelOpen.value = false;
  tenderSheet.value = {...sheet, phase: 'leaving'};
  tenderView.value.phase = 'leaving';
  tenderRestoreTimer?.();
  tenderRestoreTimer = flow.after(motionMs(260), 'the parked page surfaces under the sheet\'s hero', () => {
    tenderRestoreTimer = undefined;
    if (tenderView.value.phase === 'leaving') {
      tenderPageRestored.value = true;
      if (!keepPageParked) {
        void nextTick().then(() => void unparkSurface(legacyPageEl() ?? null, 1));
      }
    }
  });
  await flight.flyTo(miniOf, (n) => {
    tenderDockHeld.value = tenderDockHeld.value.filter((held) => held !== n);
    if (sheetCommitted.value) {
      stampDockChip(n);
    }
  }, {reseat: false, pressElFor: miniOf});
  tenderFlight.value = undefined;
  tenderSheet.value = undefined;
  // The page is the player's again: the ledger lets go of the held values — a changed number ticks in place now.
  ledgerHold.value = undefined;
  if (tenderView.value.phase === 'leaving') {
    if (keepPageParked) {
      tenderPageRestored.value = true; // nothing to unpark — the layer that follows takes the page's seat
    }
    settleTenderViewClosed();
  }
  tenderHandoffActive.value = false;
  const waiters = handoffWaiters;
  handoffWaiters = [];
  waiters.forEach((w) => w());
}
/** Resolves once no tender layer covers the page (its un-park has begun) — bounded: a stuck cover never strands a glide. */
function whenPageUncovered(): Promise<void> {
  if (!pageCovered.value && tenderSheet.value === undefined) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        stop();
        disarmBound();
        resolve();
      }
    };
    const stop = watch(() => !pageCovered.value, (open) => {
      if (open) {
        finish();
      }
    });
    // A RELEASE: a glide awaits this promise — it resolves at the bound, or when the scene is gone.
    const disarmBound = flow.guarantee(motionMs(4000), 'the page is uncovered (a stuck cover never strands a glide)', finish);
  });
}
/** The sheet's hero size — solved from the layer's own box (the certificate is the scene's hero by size). */
function fitTenderSheet(): void {
  const pane = tenderPane.value ?? undefined;
  const sheet = pane?.querySelector<HTMLElement>('.con-tsheet');
  if (pane === undefined || sheet === null || sheet === undefined || pane.clientHeight < 40) {
    return;
  }
  const h = pane.clientHeight * 0.9;
  const w = Math.min(h / 1.42, pane.clientWidth * 0.34);
  sheet.style.setProperty('--tsheet-hero-w', `${Math.round(w)}px`);
  // The RESULT reads in full: a panel taller than the layer (a long rule, three notes on a 720p frame) is fitted by
  // ONE type number — measured at the natural size, scaled down together, never below a legible floor.
  const panel = sheet.querySelector<HTMLElement>('.con-tsheet__panel');
  if (panel !== null) {
    sheet.style.removeProperty('--tsheet-type');
    const room = pane.clientHeight * 0.96;
    const need = panel.scrollHeight;
    if (need > room) {
      const rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      sheet.style.setProperty('--tsheet-type', `${(Math.max(0.7, room / need) * rem).toFixed(2)}px`);
    }
  }
}
/** The list's certificate size — as large as the layer allows for the whole row (never a scroll, never a wrap). */
function fitTenderList(): void {
  const pane = tenderPane.value ?? undefined;
  const list = pane?.querySelector<HTMLElement>('.con-tport');
  if (pane === undefined || list === null || list === undefined || pane.clientHeight < 40) {
    return;
  }
  const count = Math.max(1, doorEntries.value.length);
  // The ROOT rem — every length of the layer below is one (the list's own font size is not).
  const rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const gap = 1.6 * rem;
  const availW = pane.clientWidth - 2.4 * rem - gap * (count - 1);
  // The row's own room: the reading under it (two lines), each certificate's word line and the cursor's lift (its
  // ring stands proud of the face — it once touched the journey rail above the layer) are subtracted.
  const availH = pane.clientHeight - 7.2 * rem;
  const w = Math.max(6 * rem, Math.min(availW / count, availH / 1.42, 20 * rem));
  list.style.setProperty('--tport-w', `${Math.round(w)}px`);
}
/**
 * THE GLIDE (§20): the deal GREW in place. The cards that stay are carried from where the player last saw them (the
 * boxes remembered when the door opened) to the places the new fit gave them — on the page the player sees, after
 * the hand-over — and only then do the new cards come off the tender deck (`launchDeal` waits for the glide). They
 * are hidden from the very frame the new deal applies, so nothing ever jumps.
 */
async function playDealGlide(): Promise<void> {
  dealGlideArmed.value = false;
  const rects = pageSlotRects.value;
  const step = currentStep.value?.id;
  if (rects === undefined || step === undefined) {
    return;
  }
  const keys = [...rects.keys()].filter((k) => k.startsWith(`${step}|`));
  keys.forEach((k) => returningNames.value.add(k));
  glideActive.value = true;
  try {
    // ON A PAGE THE PLAYER SEES: the answer routinely lands while the sheet still covers the page (the stamp's beat),
    // and a glide played under the cover was a page that came back already re-laid (the storyboard of 2026-11-09).
    // The slide starts with the page's own un-park — its proxies surface WITH the page, then move.
    await whenPageUncovered();
    await nextTick();
    fitCardStrip();
    await whenPainted();
    const pairs: Array<GlidePair> = [];
    for (const k of keys) {
      const name = k.slice(step.length + 1) as CardName;
      const toEl = stepSlotEl(step, name);
      const from = rects.get(k);
      if (toEl !== null && from !== undefined) {
        pairs.push({name, from, toEl});
      }
    }
    // The new cards come off the deck as the row SETTLES (its last third — their places are final from the first
    // frame of the slide), never after an idle beat of empty places.
    await slideIntoLayout(pairs, (n) => returningNames.value.delete(`${step}|${n}`), {
      fadeInMs: motionMs(230),
      onSettling: () => {
        glideActive.value = false;
      },
    });
  } finally {
    keys.forEach((k) => returningNames.value.delete(k));
    glideActive.value = false;
  }
}
/** The boxes of the page's cards as the player sees them now (a glide's «from»). */
function rememberPageSlots(): void {
  const strip = activeStrip();
  if (strip === undefined || strip === null) {
    pageSlotRects.value = undefined;
    return;
  }
  const rects = new Map<string, Rect>();
  for (const el of Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot[data-step-slot]'))) {
    const key = el.dataset.stepSlot;
    const r = cardRectNow(el);
    if (key !== undefined && r !== undefined && r.w > 4) {
      rects.set(key, r);
    }
  }
  pageSlotRects.value = rects.size > 0 ? rects : undefined;
}
/**
 * THE DEPARTURE (§16.3) — the cards a redeal takes away leave the table as they came: captured where they stand,
 * turned FACE DOWN on the way, laid onto the deck stack (the deal layer's own deck — the very source the new cards
 * come off). The originals stay held under their proxies until the answer replaces them; a refusal (no new deal
 * within the safety) gives them back. Reduced motion / no measurable deck: nothing flies, nothing is withheld.
 */
async function departToDeck(stepId: StartWizardStepId, names: ReadonlyArray<CardName>): Promise<void> {
  // The cards go back to the TENDER DECK — a real pile standing on the scene (the deal layer's own deck lives only
  // while a deal runs, so a departure aimed at it never flew).
  tenderDealArmed.value = true;
  placeTenderDeck();
  await nextTick();
  const deck = tenderDeck.value;
  if (deck === null || names.length === 0 || consoleReducedMotionActive()) {
    return;
  }
  const capture = captureCards(names
    .map((name) => ({name, el: stepSlotEl(stepId, name)}))
    .filter((sc): sc is DockFlightSource => sc.el !== null));
  if (capture.names.length === 0) {
    capture.dispose();
    return;
  }
  const keys = capture.names.map((n) => `${stepId}|${n}`);
  keys.forEach((k) => returningNames.value.add(k));
  departureActive.value = true;
  departureSafety?.();
  // The SAFETY: a refused answer changes no view — the held originals come back on their own.
  departureSafety = flow.after(motionMs(4000), 'the departure\'s safety (a refused redeal gives the cards back)', () => {
    departureSafety = undefined;
    keys.forEach((k) => returningNames.value.delete(k));
  });
  try {
    await capture.impulse();
    await capture.flyTo(() => deck, undefined, {flipTo: FACE_DOWN_DEG, pressElFor: () => deck});
  } finally {
    capture.dispose();
    departureActive.value = false;
  }
}
/**
 * THE DOOR's X (§16.6): the holder's certificates in the shared fullscreen viewer, in the list's order — the
 * focused one first, each lifted out of its own slot; LB/RB keep the list's cursor in lockstep.
 */
function openPortfolioZoom(): void {
  const entries = doorEntries.value;
  if (entries.length === 0) {
    return;
  }
  const list = entries.map((e) => tenderZoomEntry(e.id, {instance: e.instance, state: tenderCardStateOf(e.status)}));
  const portfolioNow = portfolio.value ?? undefined;
  openConsoleCardZoom(list, Math.min(Math.max(tenderView.value.focus, 0), list.length - 1), undefined, undefined, {
    contextLabel: 'Tenders',
    origin: {
      kind: 'physical',
      resolve: (i) => {
        const e = entries[i];
        return e !== undefined ? portfolioNow?.slotEl?.(e.instance) ?? null : null;
      },
      onBrowse: (i) => {
        if (tenderView.value.phase === 'open') {
          tenderView.value.focus = i;
        }
      },
    },
  });
}
function tenderNameOf(id: TenderId): string {
  return tenderPortfolioName(id);
}
/** The medallion's number: the deck's count (unknown reads as nothing — never a client count). */
function requestTagCountText(tag: Tag): string {
  const n = requestTagCount(tag);
  return n === Number.POSITIVE_INFINITY ? '' : String(n);
}
/** How many cards of the tag the deck still holds — the server's count; unknown reads as open (never a client count). */
function requestTagCount(tag: Tag): number {
  return requestTagCounts.value[tag] ?? Number.POSITIVE_INFINITY;
}
/** The dock chip of an executed tender takes the stamp — a one-shot class the CSS keyframe reads. */
function stampDockChip(instance: string): void {
  dockStampTimer?.();
  dockStamped.value = instance;
  dockStampTimer = flow.after(motionMs(620), 'the dock chip\'s stamp one-shot ends', () => {
    dockStamped.value = undefined;
    dockStampTimer = undefined;
  });
}
/** «КОМПЕНСАЦИЯ»: the M€ chip flies from the plate into the rail (the bonus plate's own language). */
function launchCompensationFlight(): void {
  const held = heldTenderEntries.value;
  if (held.length === 0) {
    const amount = compensationPrompt.value?.megaCredits ?? 0;
    if (amount > 0) {
      void runResourceTransfers({
        specs: [{channel: 'stock', resource: 'megacredits', amount}],
        source: {selectors: ['[data-tender-compensation]']},
        arrival: 'auto',
      });
    }
    return;
  }
  // THE BUYOUT (§16.4): the certificates in turn — each takes its stamp and its coins leave FROM its own chip into
  // the rail (the counter ticks on every touchdown); the run resolves when the last has landed.
  void (async () => {
    for (const t of held) {
      cashing.value.add(t.instance);
      cashing.value = new Set(cashing.value);
      await runResourceTransfers({
        specs: [{channel: 'stock', resource: 'megacredits', amount: TENDER_COMPENSATION_MC}],
        source: {selectors: [`[data-buyout-card="${t.instance}"]`, '[data-tender-compensation]']},
        arrival: 'auto',
      });
    }
    cashing.value = new Set<string>();
  })();
}
/** X: the focused legacy card fullscreen — lifting out of (and returning
 *  into) its STAGE seat; LB/RB browse the whole legacy set and the seat
 *  focus follows. */
function zoomLegacyFocused(): void {
  const cards = legacyOverviewCards.value;
  if (cards.length === 0) {
    return;
  }
  openConsoleCardZoom([...cards], legacyView.value.focus, undefined, undefined, {
    origin: slotZoomOrigin(
      () => root.value as HTMLElement,
      (i) => cards[i]?.name ?? '',
      (i) => {
        legacyView.value.focus = i;
      },
    ),
    contextLabel: 'Legacy',
  });
}
/** The overview's geometry: ONE shared zoom so both zones' cards are the
 *  same physical size — solved against the live body box (max 2+2 cards,
 *  as large as the room allows, minus the caption row and the read-only
 *  note line). */
function fitLegacyView(): void {
  const pane = legacyPane.value ?? undefined;
  if (pane === undefined) {
    return;
  }
  const n = Math.max(1, legacyOverviewCards.value.length);
  const zones = (legacyOverviewCorpCount.value > 0 ? 1 : 0) +
    (legacyOverviewCards.value.length > legacyOverviewCorpCount.value ? 1 : 0);
  const s = conUiScale();
  const capH = 30 * s; // the zone caption row
  const noteH = 34 * s; // the read-only note line
  const zoneGap = 56 * s;
  const cardGap = 22 * s;
  const availH = pane.clientHeight - capH - noteH - 24 * s;
  const availW = pane.clientWidth - (zones - 1) * zoneGap - (n - zones) * cardGap - 32 * s;
  // The premium card face is 320×445 natural (+ ring headroom).
  const zoom = Math.min(1.7 * s, availH / 460, availW / (n * 320));
  pane.style.setProperty('--con-legview-zoom', Math.max(0.3, zoom).toFixed(3));
}
/** P13/P15: X fullscreen for the focused card (wizard AND ceremony).
 *  Wizard steps pass the SELECT context (A toggles the pick without
 *  leaving the viewer); the SUMMARY browses read-only; the CEREMONY passes
 *  the ACTION context so a playable prelude / drew-N candidate is played
 *  straight from fullscreen (desktop StartGameFlow parity). The corp effect
 *  stays read-only (its label is undefined) — matching desktop. */
function zoomFocused(): void {
  if (mode.value === 'wizard') {
    if (currentStep.value !== undefined && stepEntries.value.length > 0) {
      const origin = zoomOriginFor(stepEntries.value.map((c) => c.name), true);
      // Single-pick step: A in the viewer SELECTS the focused card and
      // advances (parity with the strip's A-commit + the between-generation
      // draft's fullscreen Select). Multi-pick steps keep the toggle context.

      // The viewer speaks the SAME DRAFT voice as the rail below the
      // spread: «ДОСТУПНОСТЬ» over «ПРАВИЛА», the requirement stated once,
      // in the richer wording that also carries the current value.
      openConsoleCardZoom(stepEntries.value, focusIdx.value, {
        isSelected: (name) => isPickedHere(name),
        toggle: (name) => togglePickByName(name),
      }, undefined, {origin, availability: availabilityContextFor('start-pick')});
      return;
    }
    // The summary: X reviews the WHOLE chosen setup fullscreen, OPENING on
    // the focused tile and following LB/RB back onto the focus (the mini
    // tiles carry data-zoom-slot too, so the lift/return stays physical).
    if (currentStep.value === undefined && summaryCards.value.length > 0) {
      openConsoleCardZoom(summaryCards.value, focusIdx.value, undefined, undefined, {
        origin: zoomOriginFor(summaryCards.value.map((c) => c.name), true),
        availability: availabilityContextFor('start-pick'),
      });
    }
    return;
  }
  // Going to READ the card is leaving the decision for a moment, so the
  // stage lets go: the viewer must never hand back a screen whose next
  // input gives an effect up.
  clearRiskStage();
  const items = focusables.value;
  const item = focusedItem.value;
  if (item === undefined || items.length === 0) {
    // THE FIRST-ACTION SEAT — the one card on stage: X reads it
    // fullscreen from its physical seat (the viewer lifts out of the
    // seat and returns into it — the composer's one-physical-card rule).
    const seated = state.firstAct.corp;
    if (firstActionStageLive.value && seated !== undefined) {
      openConsoleCardZoom([{name: seated} as CardModel], 0, undefined, undefined, {
        origin: {
          kind: 'physical',
          resolve: () => sceneRoot()?.querySelector<HTMLElement>('[data-embed-source-slot]') ?? null,
        },
      });
    }
    return;
  }
  const action = {
    labelFor: (name: CardName) => ceremonyZoomLabel(name),
    reasonsFor: () => [],
    execute: (name: CardName) => actByName(name),
  };
  if (item.kind === 'candidate') {
    openConsoleCardZoom(candidateCards.value, candidateCards.value.findIndex((c) => c.name === item.name), undefined, action, {
      origin: zoomOriginFor(candidateCards.value.map((c) => c.name), true),
    });
    return;
  }
  // Corps / preludes: browse the whole actionable set by name; A plays a
  // prelude (corp rows stay read-only via the undefined label).
  const cards = items.map((f) => ({name: f.name}) as CardModel);
  openConsoleCardZoom(cards, focusIdx.value, undefined, action, {
    origin: zoomOriginFor(cards.map((c) => c.name), true),
  });
}
/** Grid row jump - measured from the DOM, robust to flex-wrap. */
function moveFocusRow(step: 1 | -1): void {
  const strip = activeStrip();
  if (strip === undefined) {
    return;
  }
  const slots = Array.from(strip.children) as Array<HTMLElement>;
  const cur = slots[focusIdx.value];
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
  if (best !== -1 && best !== focusIdx.value) {
    focusIdx.value = best;
    armedSkip.value = false; armedTenders.value = false;
    clearRiskStage();
    void nextTick(() => scrollFocusedIntoView());
  }
}
/** The summary's mini tiles, in DOM order (= summaryCards order: corp →
 *  preludes → CEO → projects), for the 2D spatial navigation. */
function summaryTileEls(): Array<HTMLElement> {
  const root = sceneRoot();
  if (root === undefined) {
    return [];
  }
  return Array.from(root.querySelectorAll<HTMLElement>('.con-start__mini'));
}
/** Summary 2D d-pad: move focus to the nearest tile in `dir` by real
 *  geometry (nearestInDirection) — ←/→ along a row, ↑/↓ across sections;
 *  no candidate → focus stays; re-measured each press so a resize is
 *  always honoured. */
function moveFocusSummary(dir: NavDirection): void {
  const tiles = summaryTileEls();
  if (tiles.length === 0 || focusIdx.value >= tiles.length) {
    return;
  }
  const rects = tiles.map((el) => el.getBoundingClientRect());
  const next = nearestInDirection(rects, focusIdx.value, dir);
  if (next !== -1 && next !== focusIdx.value) {
    focusIdx.value = next;
    void nextTick(() => scrollFocusedIntoView());
  }
}
function scrollFocusedIntoView(): void {
  const slot = focusedCardSlot.value ?? undefined;
  const el = Array.isArray(slot) ? slot[0] : slot;
  if (el !== undefined && el !== null) {
    // The single ROW is fit-to-width (fitCardStrip) + the candidate rows
    // sit at a tuned fit zoom → never scroll a row on focus (that shifted
    // neighbours + churned the whole strip every d-pad move = Steam Deck
    // perf). Only the wizard GRID scrolls, and only VERTICALLY to the row.
    if ((mode.value === 'wizard' && wizardGrid.value) || onSummary.value) {
      const box = scrollContainerOf(el, 'y');
      if (box !== undefined) {
        cursorEnsureVisible(box, el, {axis: 'y'});
      }
    }
    return;
  }
  const bodyNow = ceremonyBody.value ?? body.value;
  const focused = bodyNow?.querySelector('.con-start__qcard--focused');
  const box = focused === null || focused === undefined ? undefined : scrollContainerOf(focused, 'y');
  if (focused !== null && focused !== undefined && box !== undefined) {
    cursorEnsureVisible(box, focused, {axis: 'y'});
  }
}
/** The participant strip's display name (bot-safe). */
function participantName(p: StartParticipant): string {
  return participantDisplayName({name: p.name, isMarsBot: p.isMarsBot});
}
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
function queueTargetEl(name: CardName): HTMLElement | null {
  const root = sceneRoot();
  if (root === undefined) {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name;
  return root.querySelector<HTMLElement>(`[data-queue-slot="${esc}"], [data-pay-card="${esc}"]`);
}
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
function releaseBarsWithConvoy(count: number): void {
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
    if (!matFrozen.value && matCapture.value === undefined) {
      document.body.classList.remove('con-start-barshold'); // transition over
      return;
    }
    const t = performance.now() - start;
    const clear = liveFlightProxies().every((p) => !overlapsAZone(p.getBoundingClientRect()));
    if ((t >= beats.arriving && clear) || t >= beats.landed) {
      document.body.classList.remove('con-start-barshold');
      return;
    }
    probeTick(step);
  };
  probeTick(step);
}
/** The «КУПЛЕНО» chrome enters only once the LAST bought project stands
 *  in the row — the box materializes around cards, never around a
 *  landing still in progress. */
function noteBuyLanding(name: CardName): void {
  if (buyChrome.value !== 'hold' || !state.projects.includes(name)) {
    return;
  }
  if (!state.projects.some((p) => queueArriving.value.has(p))) {
    buyChrome.value = 'entering';
  }
}
/** The names travelling through the materialization, in play order. */
function materializationNames(): Array<CardName> {
  const moving: Array<CardName> = [];
  if (state.corp !== undefined) {
    moving.push(state.corp);
  }
  moving.push(...state.projects, ...state.preludes);
  return moving;
}
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
function prepareMaterializationFreeze(): void {
  if (consoleReducedMotionActive() || matFrozen.value) {
    return;
  }
  const host = freezeHost.value ?? undefined;
  const root = sceneRoot();
  const frame = root?.querySelector<HTMLElement>('.con-start__frame') ?? null;
  if (host === undefined || host === null || frame === null) {
    return;
  }
  const moving = materializationNames();
  const sources: Array<DockFlightSource> = moving
    .map((name) => ({name, el: summaryTileFor(name)}))
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
  matCapture.value = capture;
  matFrozen.value = true;
  // The live originals hide under the snapshot (belt — nobody sees them).
  moving.forEach((n) => summaryArriving.value.add(n));
}
/** Drop the snapshot (and optionally the card overlay) — refusal,
 *  unmount, or the transition's own completion. Idempotent. */
function disposeMaterializationFreeze(alsoCapture: boolean): void {
  const host = freezeHost.value ?? undefined;
  if (host !== undefined && host !== null) {
    gsap.killTweensOf(host);
    host.classList.remove('con-start-freeze--live');
    host.innerHTML = '';
    gsap.set(host, {clearProps: 'all'});
  }
  matFrozen.value = false;
  // The bars hold may never outlive the transition (the success path has
  // already released it at the flight beat — this is the abort belt).
  document.body.classList.remove('con-start-barshold');
  if (alsoCapture) {
    matCapture.value?.dispose();
    matCapture.value = undefined;
    buyChrome.value = 'shown'; // aborted / degraded: the box stands normally
  }
}
/** The snapshot cross-dissolves over the prepared deployment. */
function dissolveFreeze(): Promise<void> {
  const host = freezeHost.value ?? undefined;
  if (host === undefined || host === null || !matFrozen.value) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const safety = consoleSessionScope().guarantee(motionMs(680) + 600, 'ConsoleStartScene: a beat\'s safety', resolve);
    gsap.to(host, {
      autoAlpha: 0,
      scale: 0.995,
      transformOrigin: '50% 45%',
      duration: motionMs(640) / 1000,
      ease: 'power2.inOut',
      onComplete: () => {
        safety();
        resolve();
      },
    });
  });
}
/** The corp's target slot rect must stand STILL before anything flies. */
async function awaitQueueStability(): Promise<void> {
  const probe = state.corp ?? materializationNames()[0];
  if (probe === undefined) {
    return;
  }
  let last: {x: number, y: number} | undefined;
  // The wait always waits (two frames at least): a node of the wait graph, its frame ceiling said (`ceilingWait.ts`).
  const wait = beginCeilingWait({
    id: 'start-scene:queue-stability', owner: 'ConsoleStartScene', what: 'a still target slot of the corporation', maxMs: 30 * 16,
    detail: '30 frames, estimated at 16 ms each',
  });
  for (let i = 0; i < 30; i++) {
    await whenPainted(1, 50, flow);
    const el = queueTargetEl(probe);
    const r = el?.getBoundingClientRect();
    if (r !== undefined && r.width > 4 && last !== undefined &&
        Math.abs(r.left - last.x) < 0.5 && Math.abs(r.top - last.y) < 0.5) {
      wait.met();
      return;
    }
    last = r !== undefined && r.width > 4 ? {x: r.left, y: r.top} : undefined;
  }
  wait.ceiling();
}
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
async function runMaterialization(): Promise<void> {
  // The MULTIPLAYER path arrives here with no armed snapshot (the one
  // from the press was let go when the wait began) — arm it now, on the
  // live summary the player has been looking at.
  if (!matFrozen.value && sentAwaiting.value) {
    prepareMaterializationFreeze();
  }
  sentAwaiting.value = false;
  state.flow = 'materializing';
  if (commitSafety !== undefined) {
    commitSafety();
    commitSafety = undefined;
  }
  const capture = matCapture.value;
  const moving = materializationNames();

  if (capture === undefined || !matFrozen.value || consoleReducedMotionActive()) {
    // The settled one-frame swap (reduced motion / degraded capture).
    disposeMaterializationFreeze(true);
    matSwap.value = true;
    matCut.value = true;
    shellUp.value = true;
    ceremonyRevealed.value = true;
    syncCeremonyLayout();
    await nextTick();
    matCut.value = false;
    matSwap.value = false;
    summaryArriving.value.clear();
    state.flow = 'deploying';
    return;
  }

  // THE SWAP UNDER THE SNAPSHOT — the final surface assembles complete:
  // held queue slots first (they must never paint occupied), then one
  // cut turn for bounds + bars + shelf. Two entrances are deliberately
  // HELD through the swap: the standard bars (they enter WITH the flight
  // — released below; entering here, under the snapshot, they surfaced
  // mid-dissolve over the still-standing summary) and the «КУПЛЕНО»
  // box's chrome (it frames landed cards, never an empty landing).
  moving.forEach((n) => queueArriving.value.add(n));
  if (state.projects.length > 0) {
    buyChrome.value = 'hold';
  }
  document.body.classList.add('con-start-barshold');
  matSwap.value = true;
  matCut.value = true;
  shellUp.value = true;
  ceremonyRevealed.value = true;
  syncCeremonyLayout();
  await nextTick();
  await whenPainted();
  await awaitQueueStability();

  // THE RISE — the cards come toward the viewer over the frozen summary.
  await capture.lift(state.corp);

  // THE CROSS-DISSOLVE + THE CARRY: the prepared screen surfaces under
  // the airborne cards; the convoy leaves a beat into the dissolve and
  // lands on geometry that no longer changes.
  const fade = dissolveFreeze();
  await span(motionMs(150));
  // THE BARS ENTER AS THE CONVOY ARRIVES — never at take-off: the watcher
  // releases them the first frame the cards are deep in their carry AND
  // no card overlaps a bar's zone (see releaseBarsWithConvoy).
  releaseBarsWithConvoy(capture.names.length);
  await Promise.all([
    capture.flyTo(
      (name) => queueTargetEl(name),
      (name) => {
        queueArriving.value.delete(name);
        noteBuyLanding(name);
      }),
    fade,
  ]);
  if (buyChrome.value === 'hold') {
    buyChrome.value = 'entering'; // a no-flight fallback never leaves the box hidden
  }

  disposeMaterializationFreeze(false);
  matCapture.value = undefined;
  summaryArriving.value.clear();
  queueArriving.value.clear();
  matCut.value = false;
  matSwap.value = false;
  state.flow = 'deploying';
}
/**
 * THE WORKSPACE RELEASE — the deployment settled (corp landed, projects
 * delivered, preludes resolved): the Game Start Workspace dissolves as
 * ONE calm surface and the board takes input on a settled frame. This is
 * the ONLY place the lifetime hold lets go.
 */
/**
 * THE DIRECTOR'S DOOR INTO THE RELEASE (`startDirectorCure` → `release`): the game proper has begun and the
 * deployment never settled — the scene ends through its OWN release beat (the resolved frame, the dissolve, the
 * lifetime hold let go), never a cut. A scene already releasing says so; a scene not in the ceremony (nothing to
 * dissolve) lets the hold go at once.
 */
function releaseByDirector(): string {
  if (state.flow === 'completing' || state.flow === 'releasing') {
    return 'already-releasing';
  }
  // …and a scene with NO STANDING ROOT has nothing to dissolve either (a stale instance the director still holds a
  // ref to): its release beat could only mark `completing` and return — the hold lets go at once instead (R8).
  const root = sceneRoot();
  if (mode.value !== 'ceremony' || root === undefined || !root.isConnected) {
    releaseStartScene();
    return 'hold-released';
  }
  void runSceneRelease();
  return 'released';
}
async function runSceneRelease(): Promise<void> {
  if (state.flow === 'completing' || state.flow === 'releasing') {
    return;
  }
  // NOTHING IS MARKED UNTIL THE RELEASE CAN RUN (wait graph R8): `completing` reads «already releasing» to every
  // door (the settled watcher of the next mount, the director's release), so a release that set it and then found
  // no root to dissolve stood the lifetime hold for the whole game. A torn-down instance releases nothing here.
  const root = sceneRoot();
  if (root === undefined || !root.isConnected) {
    return;
  }
  flowTerminal.value = false;
  const release = beginStartSceneRelease();
  await nextTick();
  const el = sceneRoot();
  if (el === undefined || !el.isConnected) {
    // Torn down in the tick: the flow returns to where it stood (this deal, this run only), so the restored scene's
    // settled watcher — or the director — runs the release again.
    abandonStartSceneRelease(release);
    return;
  }
  {
    // THE RESOLVED BEAT — a short settled frame (the `--resolved` accent:
    // queue empty, dock stable, tableau standing) BEFORE the dissolve, so
    // the release reads as "the start is complete", never as a cut.
    const flowHostNow = flowHost.value ?? undefined;
    const rail = flowHostNow?.querySelector<HTMLElement>('.con-jrail');
    const items = rail?.querySelectorAll<HTMLElement>('.con-jrail__item') ?? [];
    const phases = rail?.querySelectorAll<HTMLElement>('.con-jrail__phase') ?? [];
    const beam = rail?.querySelector<HTMLElement>('.con-jrail__commit-beam');
    const reduced = consoleReducedMotionActive();
    const timeline = markRaw(gsap.timeline({paused: true}));
    completionTimeline = timeline;

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
        flowTerminal.value = true;
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
        state.flow = 'releasing';
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
    // PACING: it finishes a timeline of a scene that STANDS — a scene that left has killed it (`settled` resolved).
    const cancelReleaseSafety = flow.after(6_000, 'the start\'s completion sequence is finished by hand (a starved ticker)', () => {
      if (completionTimeline === timeline && el.isConnected) {
        timeline.progress(1);
      }
    });
    timeline.play(0);
    await settled;
    cancelReleaseSafety();
    if (completionTimeline === timeline) {
      completionTimeline = undefined;
    }
    // A teardown kills the timeline. A detached instance cannot release
    // the lifetime hold; the restored Start workspace owns that outcome —
    // and it CAN, because the abandoned run hands the flow back (R8).
    if (!el.isConnected) {
      abandonStartSceneRelease(release);
      return;
    }
  }
  completeStartSceneRelease(release);
}
/**
 * SHELL BOUNDS. The deployment's bounds are the SYSTEM workspace band
 * (`--con-ws-left` / `--con-band-*` seam tokens + the `con-ws` marker on
 * the root — the same geometry every workspace of the family stands on;
 * no hand-measured rail inset, ever). This toggle only drives WHAT EXISTS
 * around the workspace: the preparation hides the standard Top Bar and
 * the Player Rail (the player has no game state yet); the ceremony swap
 * MATERIALIZES both from their own edges (the entrance keyframes).
 */
function syncCeremonyLayout(): void {
  // The bars follow the BOUNDED SHELL, not the raw mode: through the
  // materialization they materialize at the SWAP moment (shellUp), never
  // over the still-standing summary.
  const shellUp = shellBounded.value;
  document.body.classList.toggle('con-start-ceremony', shellUp);
  document.body.classList.toggle('con-start-prep', !shellUp);
}
/** rAF-coalesced fit for resize bursts (never fires per focus move). */
function scheduleFit(): void {
  if (fitScheduled.value) {
    return;
  }
  fitScheduled.value = true;
  flow.afterFrame('the coalesced fit of a resize burst', () => {
    fitScheduled.value = false;
    fitCardStrip();
    fitSummary();
    syncCeremonyLayout();
  });
}
/**
 * SUMMARY FIT — one zoom for the whole review so EVERY card fits the
 * pane without clipping and the width is genuinely used: the identity
 * row (corp + preludes + CEO, one notch larger) and the wrapped project
 * rows are solved TOGETHER against the cards column's live box, largest
 * zoom first. Pure math over measured bounds — no per-tile DOM probing,
 * so it is safe to run while pile flights still hold the tiles.
 */
function fitSummary(): void {
  // FROZEN while cards are in the air: re-solving the zoom would move the
  // tiles the convoy was planned against. The prewarm already solved the
  // final geometry — there is nothing to re-solve until everything lands.
  if (!summaryShown.value || fitLocked.value) {
    return;
  }
  const pane = summaryPane.value ?? undefined;
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
  const idCount = (state.corp !== undefined ? 1 : 0) + state.preludes.length +
    (state.ceo !== undefined ? 1 : 0);
  const projCount = state.projects.length;
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
}
/** The height the strip may occupy. The status rail is now PINNED OUTSIDE
 *  the scrollable body (a frame-level element above the command bar), so
 *  the strip may use the WHOLE body height — the cards fill all the space
 *  between the header and the pinned rail (no verdict reserve to subtract). */
function stripAvailHeight(strip: HTMLElement): number {
  // The strip's OWN box is the room (`.con-start__body--cards .con-cards__strip { min-height: 0 }` — `flex: 1`
  // with basis 0, so the box is what the column gives it, never what the cards take): whatever grew below the body
  // is already subtracted by layout. The body is only the fallback for a strip that has no box yet. (Nothing of a
  // tender stands in the column any more — its controls ride the dock's plate, §19: the deal keeps its size.)
  const own = strip.clientHeight;
  if (own > 0) {
    return Math.max(180 * conUiScale(), own);
  }
  const bodyNow = body.value ?? undefined;
  if (bodyNow === undefined || bodyNow === null) {
    return own;
  }
  return Math.max(180 * conUiScale(), bodyNow.clientHeight);
}
/** Tag mode: a dealt card WITHOUT the focused tag steps back — the player reads at once what the request would
 *  stack with on this table (the tags are tiny on a grid card; the dim says it at a glance). */
function tagFocusDims(step: StartWizardStep, name: CardName): boolean {
  if (step.id !== 'projects' || tagMode.value === undefined || currentStep.value?.id !== 'projects') {
    return false;
  }
  const tag = requestTags.value[focusIdx.value];
  return tag !== undefined && !(getCard(name)?.tags ?? []).includes(tag);
}
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
function fitCardStrip(): void {
  if (fitLocked.value) {
    return; // see fitSummary — a destination may not move mid-flight
  }
  const strip = activeStrip();
  if (strip === undefined || strip === null) {
    // The keyed frame swaps `out-in` — a fresh step's strip mounts only
    // after the 160ms leave. Retry briefly so the fit lands on the NEW
    // strip instead of leaving the CSS fallback zoom.
    if (mode.value === 'wizard' && currentStep.value !== undefined && fitRetries.value < 30) {
      fitRetries.value++;
      probeTick(() => fitCardStrip());
    } else {
      fitRetries.value = 0;
    }
    return;
  }
  if (mode.value !== 'wizard') {
    strip.style.removeProperty('--con-cards-zoom');
    strip.style.removeProperty('--con-cards-grid-zoom');
    strip.style.removeProperty('max-width');
    return;
  }
  // A strip NOT RENDERED (its page parked under a tender's layer — `v-show`) has no box to fit: a fit taken there
  // read a zero width and set the row to its floor zoom, so a deal that grew under the sheet slid its cards towards
  // half-size copies (the storyboard of 2026-11-09). The page's own return re-fits it (`playDealGlide`, the observer).
  if (strip.offsetParent === null || strip.clientWidth === 0) {
    return;
  }
  const n = strip.children.length;
  if (n === 0) {
    strip.style.removeProperty('--con-cards-zoom');
    strip.style.removeProperty('--con-cards-grid-zoom');
    strip.style.removeProperty('max-width');
    return;
  }
  const grid = wizardGrid.value;
  // Probe the natural slot size at zoom 1 (offsetWidth/Height ignore the
  // focused card's transform: scale AND report the UNZOOMED box).
  strip.style.setProperty(grid ? '--con-cards-grid-zoom' : '--con-cards-zoom', '1');
  strip.style.removeProperty(grid ? '--con-cards-zoom' : '--con-cards-grid-zoom');
  strip.style.removeProperty('max-width');
  const probe = strip.children[0] as HTMLElement;
  const slotW = probe.offsetWidth;
  const slotH = probe.offsetHeight;
  if (slotW <= 0 || slotH <= 0) {
    if (fitRetries.value < 20) {
      fitRetries.value++;
      probeTick(() => fitCardStrip());
    }
    return;
  }
  fitRetries.value = 0;
  const cs = window.getComputedStyle(strip);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const colGap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 14;
  const rowGap = parseFloat(cs.rowGap) || colGap;
  const availW = strip.clientWidth - padX;
  const availH = stripAvailHeight(strip) - padY;
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
}
// Foundation: SEMANTIC actions — A(primary) act, X(inspect) zoom card,
// LT/RT(prev/nextSection, remapped via START_INPUT_OVERRIDES) the symmetric
// wizard-step navigation, B(back) minimize. LB/RB are deliberately UNUSED
// in the initial setup (they keep their in-game role only outside it).
function onPress(action: ConsoleAction): void {
  // (`yielded` is guarded at the intent ENTRY — it covers nav too.)
  if (awaitingOthers.value && action !== 'back' && action !== 'inspect') {
    return; // sent — nothing is asked of this player (see awaitingOthers)
  }
  switch (action) {
  case 'primary':
    onPrimary();
    return;
  case 'inspect':
    // THE RESTRUCTURING's X: the focused candidate / lineage corporation fullscreen.
    if (restructureMode.value !== undefined) {
      const cards = [...restructureLineageCards.value, ...restructureOfferCards.value];
      if (cards.length > 0) {
        openConsoleCardZoom(cards, Math.min(focusIdx.value, cards.length - 1), undefined, undefined, {contextLabel: tenderPortfolioName('restructuring')});
      }
      return;
    }
    // P13 global rule: X reads the focused card fullscreen.
    zoomFocused();
    return;
  case 'prevSection':
    // A tender's MODE: LT is the way out with nothing applied — the restructuring has none (its cards are drawn).
    if (mode.value === 'wizard' && tenderModeFacts.value !== undefined) {
      cancelTenderMode();
      return;
    }
    // LT is STEP navigation (back one wizard step); B always minimizes.
    // The collected cards physically RETURN from their pile. (The legacy
    // read moved off LT to R3 — the trigger is a STEP verb everywhere,
    // and the overview door had to exist on pages where LT is taken.)
    if (mode.value === 'wizard') {
      void backWithReturn();
    }
    return;
  case 'nextSection':
    // A tender's MODE: RT is its ONE commit — a CONFIRM's commit is A alone (the bar names no RT; a shoulder press
    // must never execute a tender the player only previewed).
    if (mode.value === 'wizard' && tenderModeFacts.value !== undefined) {
      if (tenderModeFacts.value.kind !== 'confirm' && tenderModeFacts.value.canCommit) {
        commitTenderMode();
      }
      return;
    }
    // RT = forward step navigation (LT's pair); gated on completion. The
    // picked cards physically COLLECT into their Selection-Dock pile. It
    // stops AT the summary — starting the game is ONLY the explicit A
    // commit there, never a shoulder press.
    if (mode.value === 'wizard' && !onSummary.value) {
      if (!currentStepComplete.value) {
        counterNudge.value++;
        return;
      }
      void advanceWithCollect();
    }
    return;
  case 'prevTab':
  case 'nextTab':
    // LB/RB on the standing first-action stage: the player's choice among
    // SEVERAL owed corporations (the server offers one option each).
    if (mode.value === 'ceremony') {
      cycleFirstActionCorp(action === 'prevTab' ? -1 : 1);
    }
    return;
  case 'back':
    // A tender's MODE ends with nothing applied — one level. The restructuring has no way back (its cards are
    // drawn): B folds the workspace like on any page, the decision stays where it stands.
    if (mode.value === 'wizard' && tenderModeFacts.value !== undefined && tenderModeFacts.value.kind !== 'restructure') {
      cancelTenderMode();
      return;
    }
    // P58 · FS — the order step has no way back (the prelude is played) and is not minimized from here: the press
    // is absorbed, the step's bar names no B.
    if (orderStep.value !== undefined) {
      return;
    }
    // THE «ВАРИАНТ» STEP'S B is one level: back to the queue, nothing sent, the prelude where it stood (P44).
    if (variantStep.value !== undefined) {
      if (!variantSealed.value) {
        closeVariantStep();
      }
      return;
    }
    // THE SUB-STAGE'S B IS ONE LOGICAL LEVEL — back to the window's
    // overview, seat handed back to «Фора». Nothing was submitted, so
    // nothing rolls back; the NEXT B (on the overview) minimizes.
    if (firstActionNested.value && state.firstAct.stage === 'standing' &&
        !state.firstAct.submitting) {
      void exitBonusSubStage();
      return;
    }
    // THE RISK STAGE OUTRANKS THE MINIMIZE. B here means «back to
    // choosing»: it drops the stage, returns the card to its ordinary
    // pose, and leaves the player free to walk to the enabling prelude
    // themselves — the screen never plays it for them. Minimizing instead
    // would hide the stage with the gate still armed, and take away the
    // undo at the one moment it is the thing the player wants; the NEXT B
    // (nothing armed) minimizes as always.
    if (riskStage.value !== undefined) {
      clearRiskStage();
      return;
    }
    // B = minimize (inspect the board; the amber chip returns — picks,
    // step progress and the whole deployment claim live in module
    // state). NEVER while a play is physically in flight or an embedded
    // follow-up is open — a defer unmounts the scene and with it the
    // hero's landing target / the reveal's zone (the stranded-card bug).
    // The first-action stage adds two beats of its own: the corp's rise
    // into the seat and the submit round trip — both are one motion the
    // collapse would tear (the standing WAIT itself minimizes freely).
    if (isPlayedHeroActive() || embedPresenting.value ||
        isHandDeliveryActive() || queueArriving.value.size > 0 ||
        state.firstAct.stage === 'staging' || state.firstAct.submitting) {
      return;
    }
    // Minimizing must never leave the risk stage armed behind it: the
    // player would come back to a screen one input from losing an effect
    // they had walked away from.
    clearRiskStage();
    emit('defer');
    return;
  default:
    return;
  }
}
/** A: wizard = single-pick commits + advances / multi-pick toggles (RT
 *  continues) / the SUMMARY's launch CTA; ceremony = act. */
function onPrimary(): void {
  if (orderStep.value !== undefined) {
    onOrderPick(orderFocus.value);
    return;
  }
  if (variantStep.value !== undefined) {
    onVariantPick(variantFocus.value);
    return;
  }
  if (mode.value === 'wizard') {
    if (currentStep.value === undefined) {
      // The SUMMARY's one press — the explicit «НАЧАТЬ ПАРТИЮ» CTA. A is
      // free here (there is nothing to select), and it is the control the
      // CTA plate names. onContinue still arms the zero-projects warning
      // first, so an empty buy stays a conscious second press.
      onContinue();
      return;
    }
    // A tender's MODE on this step: A is the mode's pick, never the step's.
    if (tenderModeFacts.value !== undefined) {
      toggleTenderModePick();
      return;
    }
    // EVERY step is toggle-then-RT now (the Selection Dock grammar): a
    // pick stays in the grid with its «Выбрана» band — comparable,
    // deselectable, physically collected only when the step advances.
    togglePick();
    return;
  }
  // A FOCUSED GAIN ROW claims that gain — one round trip, no action
  // spent (the server's own no-spend loop). Checked before both stage
  // CTAs: the row is where the cursor stands.
  if (stagePanelUp.value && stageGainFocused.value) {
    const gain = stageGainRows.value[stageFocusIdx.value];
    if (gain !== undefined) {
      claimStageGain(gain);
    }
    return;
  }
  // The BONUS-WINDOW overview's one clear CTA — either the explicit entry
  // into the corp's sub-stage (item #1) or the hand-off to the board.
  if (bonusActionBarState.value === 'ready') {
    if (bonusOverviewVerb.value === 'firstAction') {
      void enterBonusSubStage();
    } else {
      confirmBonusHandoff();
    }
    return;
  }
  // The FIRST-ACTION stage's one clear CTA — actionable only when the
  // player's turn has genuinely arrived (never a dead press: the waiting
  // state offers no A at all, and the submit latch swallows repeats).
  if (firstActionActionableNow.value) {
    performFirstAction();
    return;
  }
  actOnFocused();
}
function togglePick(): void {
  // Defence: a cursor left past the strip's end (a mode's rows, a shrunken deal) clamps before it picks.
  if (focusIdx.value >= stepEntries.value.length) {
    focusIdx.value = Math.max(0, stepEntries.value.length - 1);
  }
  const card = focusedCard.value;
  if (card !== undefined) {
    togglePickByName(card.name);
  }
}
/** P15: pure selection flip — shared by the strip AND the fullscreen
 *  viewer's A (single-pick REPLACES / picked → deselect; NEVER a
 *  continue — the double A/Y continue confusion is gone). */
function togglePickByName(name: CardName): void {
  const step = currentStep.value;
  if (step === undefined) {
    return;
  }
  const picked = picksHere.value.includes(name);
  if (singlePickStep.value) {
    writePicks(step.id, picked ? [] : [name]);
    return;
  }
  if (picked) {
    writePicks(step.id, picksHere.value.filter((n) => n !== name));
    return;
  }
  if (picksHere.value.length >= step.input.max) {
    // Slots full: state / focus never change — the context rail names the
    // limit + recovery, and replays its one-shot settle as the restrained
    // "the press was heard" feedback.
    blockedNudge.value++;
    return;
  }
  // PROJECTS: no budget for one more card — a NORMAL limit, blocked here so
  // the buy can never go negative; the rail says «Недостаточно средств…».
  if (step.id === 'projects' && state.corp !== undefined &&
      (wizardRemaining.value(picksHere.value.length + 1) ?? 0) < 0) {
    blockedNudge.value++;
    return;
  }
  writePicks(step.id, [...picksHere.value, name]);
}
function writePicks(id: StartWizardStep['id'], names: ReadonlyArray<CardName>): void {
  switch (id) {
  case 'corp':
    state.corp = names[0];
    break;
  case 'prelude':
    state.preludes = [...names];
    break;
  case 'ceo':
    state.ceo = names[0];
    break;
  case 'projects':
    state.projects = [...names];
    break;
  }
}
/** The live slot for a card on this scene (data-zoom-slot marker). */
function exitSlotFor(name: string): HTMLElement | null {
  const root = sceneRoot();
  if (root === undefined) {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
  return root.querySelector<HTMLElement>(`[data-zoom-slot="${esc}"]`);
}
/** X / RB: advance the wizard; on the summary — submit. */
function onContinue(): void {
  if (mode.value !== 'wizard') {
    actOnFocused();
    return;
  }
  if (currentStep.value !== undefined) {
    if (!currentStepComplete.value) {
      // Blocked RB: no transition — the header's pick counter (the step's
      // gating reason) replays its one-shot nudge instead.
      counterNudge.value++;
      return;
    }
    state.stepIdx = railPos.value + 1;
    return;
  }
  // Summary submit — a zero-projects buy arms an inline warning first.
  if (!wizardReady.value) {
    return;
  }
  const input = wizardInput.value;
  if (input === undefined) {
    return;
  }
  // ONE conscious second press for everything the start would leave behind: an empty buy and the start-window
  // tenders still executable (§16.4 — after this press the Committee buys them back). Both warnings arm together,
  // so the player never presses through a chain of them.
  const hasProjectsStep = steps.value.some((s) => s.id === 'projects');
  const skipWarn = hasProjectsStep && state.projects.length === 0 && !armedSkip.value;
  const tenderWarn = openStartTenders.value.length > 0 && !armedTenders.value;
  if (skipWarn || tenderWarn) {
    if (skipWarn) {
      armedSkip.value = true;
    }
    if (tenderWarn) {
      armedTenders.value = true;
    }
    return;
  }
  // Withhold the bought cards from the dock BEFORE the submit brings them
  // into `cardsInHand`, so they never flash in the hand on the way into
  // the ceremony (the reactive watcher re-affirms the SAME hold once in
  // ceremony — idempotent). They fly in on the payment confirm.
  if (state.projects.length > 0) {
    armDeliveryHold('bought', deliverySignature(state.projects), [...state.projects]);
  }
  // THE SCENE TRANSITION ARMS NOW — on the still-untouched summary:
  // the card overlay captures the live pixels, the freeze layer snapshots
  // the whole frame. From this press to the deployment the player only
  // ever sees the snapshot + the flying cards, whatever the live tree
  // re-renders underneath.
  prepareMaterializationFreeze();
  // THE COMMIT BOUNDARY. The workspace's LIFETIME HOLD arms in the same
  // press as the submit: from here the root Game Start Workspace exists
  // continuously to the end of the deployment — the response's prompt
  // gaps can no longer unmount it (that unmount is what used to close the
  // workspace after commit and strand the corporation hero). The mode
  // flip (the server accepting) runs GAME STATE MATERIALIZATION; the
  // safety below un-arms everything if the submit is refused.
  holdStartScene();
  state.flow = 'committing';
  commitSafety?.();
  commitSafety = flow.after(20000, 'the commit\'s refusal safety (the server never accepted)', () => {
    commitSafety = undefined;
    if (state.flow === 'committing' && mode.value === 'wizard') {
      // The server never accepted (error / network) — the preparation
      // returns pressable, the frozen snapshot + card overlay let go
      // (the live summary stands untouched beneath), and the lifetime
      // claim releases.
      disposeMaterializationFreeze(true);
      summaryArriving.value.clear();
      state.flow = 'idle';
      releaseStartScene();
    }
  });
  emit('submit', buildInitialCardsResponse(input, picks.value));
}
/** Ceremony A: play the corporation / a prelude / pick a candidate. */
function actOnFocused(): void {
  const item = focusedItem.value;
  if (item !== undefined) {
    actByName(item.name);
  }
}
/** The ceremony action for a card BY NAME — shared by the inline strip AND
 *  the fullscreen viewer's A (play-from-fullscreen parity with the desktop
 *  StartGameFlow). Safe from fullscreen: the viewer closes BEFORE this runs
 *  (ConsoleZoomAction.execute), so a corp sub-action / prelude effect opens
 *  on a clean surface. */
/** Open the «ВАРИАНТ» step for a prelude (P44): the lane beside the card measured now, the cursor on the first takeable row. */
function openVariantStep(name: CardName): void {
  const variant = preludeVariantOf(name, playPreviews.value.get(name));
  if (variant === undefined) {
    return;
  }
  clearRiskStage();
  const rootNow = root.value ?? undefined;
  const hero = rootNow?.querySelector?.<HTMLElement>('[data-queue-slot="' + CSS.escape(name) + '"]') ?? undefined;
  const zone = rootNow?.querySelector?.<HTMLElement>('.con-start__embed') ?? undefined;
  if (hero !== undefined && hero !== null && zone !== undefined && zone !== null) {
    const zr = zone.getBoundingClientRect();
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    variantLane.value = startQueueFxLane(zr, hero.getBoundingClientRect(), remPx, zr.width > 0 ? zone.offsetWidth / zr.width : 1);
  }
  variantFocus.value = firstAvailableRow(variant);
  variantSealed.value = false;
  variantCard.value = name;
}
/**
 * P58 · FS — A on a row of the «ОЧЕРЁДНОСТЬ» step: the LIVE `OrOptions` answered with the row's own option
 * (`placementOrderAnswer` — found by the option's tileType, never a title), through the ONE submit funnel. A press
 * the funnel would drop (an answer still on the wire, a hero in flight) is refused and NAMED, never sent.
 */
function onOrderPick(index: number): void {
  const step = orderLive.value;
  const row = step?.rows[index];
  if (step === undefined || row === undefined || orderSealed.value) {
    return;
  }
  orderFocus.value = index;
  const refusal = orderPressRefusal.value;
  pressRefusal.value = refusal ?? '';
  const answer = placementOrderAnswer(row);
  if (refusal !== undefined || answer === undefined) {
    return;
  }
  orderKept.value = step;
  orderSealed.value = true;
  emit('submit', answer);
}
/** Lets the answered order step go (the scene yielded to the board, a new step arrived, the server refused). */
function releaseOrderStep(): void {
  orderSealed.value = false;
  orderKept.value = undefined;
}
function closeVariantStep(): void {
  variantCard.value = undefined;
  variantSealed.value = false;
}
/** A on a row (or a click): a takeable row is the CHOICE and the PRESS — the branch recorded, its rewards re-read, played. */
function onVariantPick(index: number): void {
  const card = variantCard.value;
  const row = variantStep.value?.rows[index];
  if (card === undefined || row === undefined || variantSealed.value) {
    return;
  }
  variantFocus.value = index;
  if (!row.available) {
    return; // a refused row is read, never taken (its reason stands on the tile)
  }
  variantChosen.value.set(card, row.choice);
  const preview = playPreviews.value.get(card);
  if (preview !== undefined) {
    // A RESOURCE row (P50 · FC) carries its answer into the wave — the «?» flies as the chosen resource.
    applyPlayPreview(card, preview, row.position, rewardVersion.value, preludeVariantStepResponses(row));
  }
  variantSealed.value = true;
  actByName(card);
  // A refused press (the funnel busy, a hero in flight) leaves the step standing for the next A.
  if (variantChosen.value.has(card)) {
    variantSealed.value = false;
    variantChosen.value.delete(card);
    return;
  }
  variantCard.value = undefined;
  variantSealed.value = false;
}
/** The chosen branch's addressed answer for a prelude's press, or undefined (no choice made / nothing to choose). */
function variantAnswerFor(name: CardName): InputResponse | undefined {
  const preview = playPreviews.value.get(name);
  const variant = preview === undefined ? undefined : preludeVariantOf(name, preview);
  const row = preludeVariantRowOf(variant, variantChosen.value.get(name));
  return preview === undefined || row === undefined ? undefined : preludeVariantAnswer(preview, row);
}
/** The queue's reading of a prelude's branches — «Выбор: Температура · Кислород (макс.) · Венера»; '' when none. */
function variantReadingText(name: CardName): string {
  const parts = preludeVariantReading(playPreviews.value.get(name));
  if (parts.length === 0) {
    return '';
  }
  const label: Record<string, string> = {temperature: 'Temperature', oxygen: 'Oxygen', venus: 'Venus', oceans: 'Oceans'};
  return translateText('Choice') + ': ' +
    parts.map((p) => translateText(label[p.icon] ?? p.icon) + (p.maxed ? ' (' + translateText('max.') + ')' : '')).join(' · ');
}
function actByName(name: CardName): void {
  const item = focusables.value.find((f) => f.name === name);
  // THE ONE GATE OF A DEPLOYMENT PRESS (`startPressRefusal`, pure + spec'd):
  //  · a hero transaction is in flight (the press is already being honoured; never a double arm / submit);
  //  · DESTINATION READINESS — the deployment shell is REVEALED and standing (the receiving stage's container,
  //    the compact tableau, the rail all live in it); before that, mid-materialization, the source card must
  //    not release; nor while an embedded outcome presents or a card is still arriving;
  //  · THE FUNNEL IS BUSY — the previous answer is still on the wire or presenting: the transport would DROP
  //    this press's submit, and a cinematic launched for it (a hero lift, a delivery cascade) would be a card
  //    flying for nothing (the «Наследие» row pressed right after the bought cards' payment hung its cards in
  //    the air for exactly this);
  //  · the carried cards' press while the BOUGHT cards are still on their way into the dock.
  // The refusal is NAMED on the root (`data-start-press-refused`) for the probes; the player's next press,
  // once the fact has passed, is honoured.
  const refusal = startPressRefusal(item?.kind ?? '', {
    heroActive: isPlayedHeroActive(),
    ceremony: mode.value === 'ceremony',
    shellRevealed: ceremonyRevealed.value,
    embedPresenting: embedPresenting.value,
    queueArriving: queueArriving.value.size > 0,
    requestInProgress: transportRequestInProgress(),
    deliveryPending: projectDeliveryPending.value,
  });
  pressRefusal.value = refusal ?? '';
  if (refusal !== undefined) {
    noteInputAbsorbed(START_PRESS_ABSORBER);
    return;
  }
  if (item === undefined || item.disabled) {
    return;
  }
  // ── THE «ВАРИАНТ» STEP (P44 · ledger EQ) ────────────────────────────
  // A prelude whose play is a CHOICE of several executable branches is chosen BEFORE the press (the law «every
  // choice is made before the commit»): the press opens the step beside the card, nothing is sent; the row's A
  // comes back here with the branch recorded and plays the prelude with the answer in the SAME batch.
  if (item.kind === 'prelude' && startFlowPreludeCopyPrompt(props.playerView) === undefined &&
      !variantChosen.value.has(name) && preludeVariantOf(name, playPreviews.value.get(name)) !== undefined) {
    openVariantStep(name);
    return;
  }
  // ── THE PRE-COMMIT GATE ────────────────────────────────────────────
  // A prelude whose effect cannot resolve is NOT played by this press. It
  // ENTERS the risk stage instead: nothing is sent, nothing animates, no
  // card moves and no empty target picker opens — the workspace simply
  // says what is missing and what could still fix it. The commit lives
  // behind the HOLD (`onRiskCommit`), and its verb names the loss.
  //
  // Never a block: burning a prelude for the 15 M€ stays a legal (bad)
  // play, and the tabletop puts no order restriction on preludes. The gate
  // costs one deliberate input, never the choice.
  //
  // Deliberately re-asked here rather than read off `riskStage`, so the
  // fullscreen viewer's A (which arrives by NAME and may have moved the
  // cursor on its way out) is gated identically.
  if ((item.kind === 'prelude' || item.kind === 'candidate') && riskArmed.value !== name &&
      preludeRisk(outlookOf.value(name), (n) => translateText(n)) !== undefined) {
    riskArmed.value = name;
    cancelHoldConfirm();
    return;
  }
  clearRiskStage();
  // The card-payment beat: the server holds the exact M€ deduction behind
  // this confirm. The bought cards were shown FACE UP in the pay grid;
  // now they physically fly from there into the hand dock — measure their
  // rects BEFORE the submit (the grid unmounts as the payment resolves),
  // fire the delivery, then submit.
  if (item.kind === 'pay') {
    launchStartCardsDelivery();
    emit('submit', {type: 'option'});
    return;
  }
  // The deferred CORPORATION play — and the campaign MERGE press, which is
  // the same physical event one mission later (the new corp lands ON TOP
  // of the lineage): arm the hero transaction (the card physically lands
  // in the bottom «Разыграно» only after the server proves the play),
  // claim any follow-up it draws, then submit.
  if (item.kind === 'corp') {
    if (corpPlayPrompt.value !== undefined || corpMergePrompt.value !== undefined) {
      armStartHero(name);
      claimStartFollowUp(name);
      emit('submit', cardsResponse([name]));
    }
    return;
  }
  // CAMPAIGN «Бонус кампании»: the press takes the comeback M€ — the chip
  // physically flies from the plate into the rail's M€ counter (the
  // shared resource-transfer language, delta chip on touchdown).
  if (item.kind === 'bonus') {
    launchBonusFlight();
    emit('submit', {type: 'option'});
    return;
  }
  // CAMPAIGN «Наследие»: the press grants the carried cards — measured
  // from their FACE-UP row and flown into the hand dock EXACTLY like the
  // bought projects (one premium language; the only difference is that
  // nothing is deducted).
  if (item.kind === 'legacy') {
    launchLegacyDelivery();
    emit('submit', {type: 'option'});
    return;
  }
  // CAMPAIGN «КОМПЕНСАЦИЯ»: the Committee's buy-back — the M€ chip flies from the plate into the rail.
  if (item.kind === 'compensation') {
    launchCompensationFlight();
    emit('submit', {type: 'option'});
    return;
  }
  // A drew-N-choose-ONE pick is recorded BEFORE submit (the discarded
  // candidates vanish from the view — this is the only capture window).
  const draw = startFlowPreludeDrawPrompt(props.playerView);
  // Double Down COPIES an already-played prelude — nothing new enters the
  // tableau, so the hero transaction would (correctly) refuse; it keeps
  // the legacy hero-pick beat instead.
  const copyPick = startFlowPreludeCopyPrompt(props.playerView) !== undefined;
  const submit = () => {
    if (item.kind === 'candidate' && draw !== undefined) {
      recordDrawChoice(props.playerView.id, candidateCards.value.map((c) => c.name), name);
    }
    if (!copyPick) {
      // Preludes / drawn picks / Merger's corp all LAND in the tableau —
      // the hero carries the pressed card into the bottom «Разыграно».
      armStartHero(name);
      claimStartFollowUp(name);
    }
    // THE CHOSEN BRANCH RIDES THE PRESS (P44): the pick that plays the prelude + the ADDRESSED answer of its `or`
    // in ONE batch — no live question after the press; a refusal falls back to the live decision (with chips).
    const answer = variantAnswerFor(name);
    variantChosen.value.delete(name);
    if (answer !== undefined) {
      emit('submit-batch', [cardsResponse([name]), answer]);
      return;
    }
    emit('submit', cardsResponse([name]));
  };
  // CANDIDATE pick (drew-1-of-N / Double Down / Merger): the rivals —
  // genuinely discarded by the rules — tumble to the discard side while
  // the chosen card runs its hero landing (copy keeps the legacy pick).
  if (item.kind === 'candidate' && !deal.value.state.active) {
    const slot = exitSlotFor(name);
    if (slot !== null) {
      const row = queueEl.value ?? undefined;
      const rejects = row !== undefined && row !== null ?
        (Array.from(row.querySelectorAll<HTMLElement>('[data-queue-slot]')))
          .filter((el) => el !== slot && !el.classList.contains('con-deal-hold') &&
            candidateCards.value.some((c) => c.name === el.getAttribute('data-queue-slot'))) : [];
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
  if (firstActionStageLive.value && embedSourceShown.value !== undefined &&
      (drawExpected.get(name) ?? 0) > 0) {
    if (state.firstAct.stage === 'standing' || state.firstAct.stage === 'staging') {
      state.firstAct.stage = 'performing';
    }
    // The stage HANDS THE SEAT OVER (an explicit release by its owner);
    // the pick's own claim then takes it as the effect's.
    void seatRelease('firstAction').then(() => submit());
    return;
  }
  submit();
}
/**
 * The ceremony CARRIES this card — the viewer's own corporation or PRELUDE while the opening plays (the queue, the
 * shelf, the seat). The first action's own rail hands its emergence in explicitly (`firstActionEmergence`) and wins
 * over this. A prelude is the TRP9 case (Medical Institute answers its OWN Science tag): at the rise it is still in
 * flight from the queue to the shelf «РАЗЫГРАНО», so the start holds it and lifts it ON the shelf once it stands
 * there — never a second instance at the reaction stage.
 */
function startCarriesReactor(card: CardName): boolean {
  if (mode.value !== 'ceremony' || firstActionPanelShown.value) {
    return false;
  }
  if (seatHolds(card)) {
    return true;
  }
  const type = getCard(card)?.type;
  return (type === CardType.CORPORATION || type === CardType.PRELUDE) &&
    (props.playerView.thisPlayer?.tableau ?? []).some((c) => c.name === card);
}
/**
 * `card`'s face on the shelf — the slot that SHOWS it (`data-played-face`), else a slot keyed by it that shows no
 * other card. The top slot of a family whose card is on loan to the seat keeps the away card's KEY while it shows
 * the card underneath: lifting it for the away card raised another played card.
 */
function startShelfFace(card: CardName): HTMLElement | undefined {
  const root = sceneRoot();
  if (root === undefined) {
    return undefined;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card;
  const shown = root.querySelector<HTMLElement>(`.con-start__played [data-played-face="${esc}"]`);
  if (shown !== null) {
    return shown;
  }
  const keyed = root.querySelector<HTMLElement>(`.con-start__played [data-played-key="${esc}"]`);
  return keyed !== null && placeShowsCard(keyed, card) ? keyed : undefined;
}
/** The carried card stands on the shelf only as a strip with another card on top (no seat face of its own). */
function startReactorBuried(card: CardName): boolean {
  const root = sceneRoot();
  if (root === undefined) {
    return false;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card;
  if (root.querySelector(`.con-start__embedsource-card[data-start-seat-card="${esc}"]`) !== null) {
    return false;
  }
  const slot = startShelfFace(card);
  return slot !== undefined && slot.closest('.con-deal-hold') === null && transferEndVerdict(slot).visible && buriedUnderAnotherCard(slot);
}
/** The carried card's face as painted in the start right now — the seat first, the shelf's top slot second. */
function startVisibleFace(card: CardName): HTMLElement | undefined {
  const root = sceneRoot();
  if (root === undefined) {
    return undefined;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card;
  const candidates = [
    root.querySelector<HTMLElement>(`.con-start__embedsource-card[data-start-seat-card="${esc}"]`),
    startShelfFace(card) ?? null,
  ];
  // A strip of the shelf with another card on top is no face (the reactor would rise UNDER it — the card on top read as
  // the one that reacted).
  return candidates.find((el): el is HTMLElement => el !== null && el.closest('.con-deal-hold') === null && transferEndVerdict(el).visible &&
    !buriedUnderAnotherCard(el)) ?? undefined;
}
/** The face — waited for (bounded, on the probe clock) while the ceremony is still bringing it, when `wait`. */
async function startReactorFace(card: CardName, wait: boolean): Promise<HTMLElement | undefined> {
  const started = performance.now();
  let face = startVisibleFace(card);
  while (wait && face === undefined && performance.now() - started < START_REACTOR_FACE_WAIT_MS) {
    await new Promise<void>((resolve) => probeTick(() => resolve()));
    face = startVisibleFace(card);
  }
  return face;
}
// ── THE SEAT FUNNEL — one owner, one flight at a time ─────────────────
/** The seat holds (or is receiving) this card. */
function seatHolds(card: CardName): boolean {
  return embedSourceShown.value === card || embedSourceIncoming.value === card;
}
/**
 * Serialize a seat operation behind whatever flight is in the air. A
 * flight that THROWS (a detached node mid-query, a killed timeline) is a
 * visual transition and nothing more: it is reported and the chain goes
 * on — an exception here used to reject the async stage entry between
 * `staging` and `standing`, which is the «stage stands, body empty» hang.
 */
function seatQueue(op: () => Promise<void>): Promise<void> {
  const guardedOp = async () => {
    try {
      await op();
    } catch (e) {
      console.warn('[start-seat] a seat flight failed — the seat keeps its last consistent state', e);
    }
  };
  const run = seatChain.value.then(guardedOp, guardedOp);
  seatChain.value = run;
  return run;
}
/**
 * TAKE the seat for `card` under `owner`. Idempotent: a seat that already
 * holds (or is flying) the card answers at once — an EFFECT's take never
 * overrides a stage's ownership of its own card (the corporation's own
 * draw asks for the seat the stage already gave it). Another card seated
 * YIELDS first (the merger handover, a previous effect's settle lagging
 * the quieted server): settle, then the emerge — one serialized phrase.
 */
function seatTake(owner: SeatOwner, card: CardName): Promise<void> {
  return seatQueue(async () => {
    if (seatHolds(card)) {
      if (owner !== 'effect' || seatOwner.value === undefined) {
        seatOwner.value = owner;
      }
      return;
    }
    if (embedSourceShown.value !== undefined || embedSourceIncoming.value !== undefined) {
      await settleFlight();
    }
    seatOwner.value = owner;
    await emergeFlight(card);
  });
}
/**
 * RELEASE the seat — settle its card home into «РАЗЫГРАНО». Refused for a
 * foreign owner: the claim's release (`'effect'`) may not settle the
 * corporation a standing stage seated, which is exactly how the card used
 * to fly home under the player's briefing and rise again a beat later.
 */
function seatRelease(owner: SeatOwner): Promise<void> {
  return seatQueue(async () => {
    if (seatOwner.value !== undefined && seatOwner.value !== owner) {
      return;
    }
    await settleFlight();
    seatOwner.value = undefined;
  });
}
/**
 * THE SOURCE EMERGE — the card that caused the draw comes physically
 * forward: its dock face steps AWAY (geometry held), a proxy carries the
 * same pixels into the step's source column, the column card reveals on
 * touchdown. The same take/carry/lay grammar as every start transfer.
 * Funnel-internal: callers go through `seatTake`.
 */
async function emergeFlight(source: CardName): Promise<void> {
  if (embedSourceShown.value !== undefined || embedSourceIncoming.value !== undefined) {
    return;
  }
  const token = ++seatFlight.value;
  const root = sceneRoot();
  if (root === undefined) {
    embedSourceShown.value = source;
    embedSourceLanded.value = true;
    return;
  }
  // THE ORDER IS THE WHOLE FIX. Setting `embedSourceShown` is what
  // reactively blanks the shelf face (the dock's `awayCard`) — and a
  // CORPORATION is always its family's ONLY card, so its face element
  // does not blank, it LEAVES THE DOM in that patch. The old sequence
  // (set state → nextTick → query the face) therefore found null on
  // every first-action entry, degraded to «the column simply shows»,
  // and the corp TELEPORTED from the shelf into the seat — the reported
  // «рывок». Now: the INCOMING half mounts the seat column while the
  // face is still painted; the carry CAPTURES the live pixels
  // synchronously; and only then does `embedSourceShown` hide the face —
  // under the already-standing proxy, exactly as the discipline says.
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(source) : source;
  const faceOf = () => root.querySelector<HTMLElement>(`.con-start__played [data-played-key="${esc}"] .con-splayed__face`);
  let dockFace = faceOf();
  embedSourceIncoming.value = source;
  embedSourceArriving.value = true;
  await nextTick();
  if (seatFlight.value !== token) {
    return; // superseded — a newer flight owns the seat
  }
  if (dockFace === null || !dockFace.isConnected) {
    // The shelf face RE-MOUNTS on the flush right after a settle released
    // the away card (the face is keyed by name): one more tick and the
    // fresh node is there — a degrade here was a teleport for no reason.
    await nextTick();
    if (seatFlight.value !== token) {
      return;
    }
    dockFace = faceOf();
  }
  const colSlot = root.querySelector<HTMLElement>('[data-embed-source-slot]');
  if (dockFace === null || !dockFace.isConnected || colSlot === null) {
    // Degraded: the column simply shows (no believable source on screen).
    // A dev-warn by the flight rule («a missing source/destination is a
    // dev warn, never a silent just-appear») — this branch is a TELEPORT.
    console.warn('[start-emerge] degraded to teleport', {
      source, face: dockFace !== null, connected: dockFace?.isConnected === true, seat: colSlot !== null,
    });
    embedSourceShown.value = source;
    embedSourceIncoming.value = undefined;
    embedSourceArriving.value = false;
    embedSourceLanded.value = true;
    return;
  }
  // `reseatCards` measures + spawns SYNCHRONOUSLY before its first await —
  // the proxy stands over the live face in this very turn…
  const flight = reseatCards([{name: source, fromEl: dockFace, toEl: colSlot}],
    () => {
      if (seatFlight.value === token) {
        embedSourceArriving.value = false;
      }
    });
  // …so the face's reactive hide lands in the SAME patch the proxy is
  // already covering it (an imperative class here was wiped by the dock's
  // next patch — the historical duplicate bug).
  embedSourceShown.value = source;
  embedSourceIncoming.value = undefined;
  await flight;
  if (seatFlight.value !== token) {
    return;
  }
  embedSourceArriving.value = false;
  embedSourceLanded.value = true; // the card physically stands in the seat
}
/**
 * THE QUEUE RELEASE — the main scene lets go so the effect owns the room.
 * Not a dim: the queue content genuinely leaves (recede grammar, origin at
 * the departed card's slot — the whole scene breathes away from the press
 * point), and the zone behind it is clean for the reveal. The pressed
 * card's slot is already blanked under the hero proxy, so nothing pops.
 */
function runQueueRelease(): void {
  if (queueReleased.value) {
    return;
  }
  const queue = queueEl.value ?? undefined;
  // NOT CONNECTED = NOT RELEASED. Latching before the node check turned a
  // «there was nothing to recede yet» into «this room has already yielded»,
  // and the room then never yielded at all: a step hosted straight after
  // ANOTHER step (the sponsor's hand hands its play's pick to the
  // deployment) rises in the very flush the ceremony body comes back, so
  // the queue is a frame away from existing. The latch belongs to the work,
  // not to the attempt — so a later caller can still do it.
  if (queue === undefined || queue === null || !queue.isConnected) {
    return;
  }
  queueReleased.value = true;
  const name = embedSourceShown.value;
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
}
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
function runPlayedDockRelease(): void {
  if (playedDockReleased.value) {
    return;
  }
  const dock = playedDockRoot();
  if (dock === null) {
    return;
  }
  playedDockReleased.value = true;
  if (consoleReducedMotionActive()) {
    gsap.set(dock, {autoAlpha: 0});
    return;
  }
  guardedDescend(dock, 420, () => {}, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    descendRecede(tl, dock, undefined, motionMs(320) / 1000, 0);
    return tl;
  });
}
/**
 * …AND COMES BACK IN TIME. Awaited BEFORE the source card's continuation
 * flight, because that flight measures `[data-played-key]` inside this very
 * shelf: a card aiming at a receded (transformed, transparent) destination
 * would fly to a place that is not where it lands.
 */
async function runPlayedDockReturn(): Promise<void> {
  if (!playedDockReleased.value) {
    return;
  }
  playedDockReleased.value = false;
  const dock = playedDockRoot();
  if (dock === null) {
    return;
  }
  await nextTick(); // the shelf's own post-effect state settles first
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
}
/** The shelf's root element (it is a component, so reach through `$el`). */
function playedDockRoot(): HTMLElement | null {
  const dock = playedDockEl.value ?? undefined;
  const el = dock?.$el;
  return el !== undefined && el !== null && el.isConnected ? el : null;
}
/** THE QUEUE RETURN — the reverse of the same phrase: the (already
 *  reflowed) queue breathes back from the remembered origin, fully ready
 *  before the source card's continuation flight measures anything. */
async function runQueueReturn(): Promise<void> {
  if (!queueReleased.value) {
    return;
  }
  queueReleased.value = false;
  const queue = queueEl.value ?? undefined;
  if (queue === undefined || queue === null || !queue.isConnected) {
    return;
  }
  await nextTick(); // the post-effect queue state settles first
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
}
/**
 * THE RETURN HALF of the effect flow (the claim released), in order: the
 * main scene comes back FULLY READY (queue standing, dock untouched), and
 * only then the source card continues its interrupted journey into
 * «Разыграно».
 *
 * OWNER-AWARE, both halves. The ROOM comes back only when no stage owns
 * it (a standing briefing keeps the queue receded — returning it here
 * stood the queue up behind the briefing). The SEAT settles only what the
 * EFFECT seated: a corporation the first-action stage seated stays — its
 * own leave settles it. Both halves used to run unconditionally on the
 * claim's release, which the reconciler fires a tick after the answer
 * for every follow-up the stage cannot host (a placement, the next corp's
 * prompt) — and the card then flew home under the briefing (or, yielded,
 * invisibly), which is the «телепорт вниз» of the reported loop.
 */
async function runStartEffectReturn(): Promise<void> {
  if (!stageOwnsRoom.value) {
    await Promise.all([runQueueReturn(), runPlayedDockReturn()]);
  }
  await seatRelease('effect');
}
/** The submit died mid-flow: nothing landed anywhere — clear the held
 *  seat with NO ghost flight (unless a STAGE owns it — its card really is
 *  there), drop the orphaned claim, restore the queue. */
async function abortStartEffectFlow(): Promise<void> {
  if (seatOwner.value === undefined || seatOwner.value === 'effect') {
    seatFlight.value++;
    embedSourceShown.value = undefined;
    embedSourceIncoming.value = undefined;
    embedSourceArriving.value = false;
    embedSourceLanded.value = false;
    embedSourceDeparting.value = false;
    seatOwner.value = undefined;
  }
  if (outcome.host === 'start') {
    releaseWorkspaceOutcome();
  }
  if (!stageOwnsRoom.value) {
    await Promise.all([runQueueReturn(), runPlayedDockReturn()]);
  }
}
/** THE SOURCE SETTLE — the effect is over: the source card carries on
 *  from its seat into the dock's family slot (the second half of the
 *  play's journey); the shelf face turns real the moment the proxy
 *  touches down. A card that never PHYSICALLY reached the seat (an
 *  aborted flow) just clears — a flight of a ghost is worse than none.
 *  Funnel-internal: callers go through `seatRelease` / `seatTake`. */
async function settleFlight(): Promise<void> {
  const source = embedSourceShown.value ?? embedSourceIncoming.value;
  if (source === undefined) {
    return;
  }
  const token = ++seatFlight.value;
  // The caption goes FIRST and on its own beat: «ИСТОЧНИК» names a card
  // that is about to leave, and a label outliving its subject is the
  // loudest kind of leftover state. Set before anything is measured, so
  // the dissolve overlaps the flight instead of following it.
  embedSourceDeparting.value = true;
  if (!embedSourceLanded.value) {
    embedSourceShown.value = undefined;
    embedSourceIncoming.value = undefined;
    embedSourceArriving.value = false;
    embedSourceDeparting.value = false;
    return;
  }
  const q = sceneRoot();
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
    embedSourceArriving.value = true; // the column empties under the proxy
    await reseatCards([{name: source, fromEl: colSlot, toEl: dockSlot}],
      () => {
        // Touchdown: release the away-state — the shelf face reappears
        // under the settling proxy in the same frame. Only for THIS
        // flight: a newer take may already own the seat.
        if (seatFlight.value === token) {
          embedSourceShown.value = undefined;
        }
      });
  }
  if (seatFlight.value !== token) {
    return; // superseded — the seat belongs to a newer flight now
  }
  embedSourceShown.value = undefined;
  embedSourceIncoming.value = undefined;
  embedSourceArriving.value = false;
  embedSourceLanded.value = false;
  embedSourceDeparting.value = false;
}
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
/**
 * THE START WATCHDOG'S HEAL (the reliability iteration, 2026-10-28) — the shell calls it when the scene has served
 * NOTHING for a confirmed while with the server asking (`startStranded`). Every step re-runs one of the scene's
 * OWN phrases, never a shortcut around it, and names what it did (the watchdog prints it):
 *  ① a room a past beat RELEASED and nothing gave back (`queueReleased` / `playedDockReleased` with no step, no
 *    outcome, no stage holding it) — returned;
 *  ② a stage ENTRY that never fired (an edge-triggered watcher missed its edge: the entry turned true while another
 *    beat ran and the `true → true` never re-fired) — entered now;
 *  ③ a stage stuck in `staging` (its seat flight never settled — `seatTake` awaits a chain that a torn-down flight
 *    left unresolved) — the corporation is seated in place and the stage stands.
 */
function healStrand(): string {
  const did: Array<string> = [];
  const hosting = workspaceFrameHasNested('start') || embedPresenting.value || firstActionPanelShown.value || bonusActionPanelShown.value;
  if (!hosting && queueReleased.value) {
    void runQueueReturn();
    did.push('queue-returned');
  }
  if (!hosting && playedDockReleased.value) {
    void runPlayedDockReturn();
    did.push('shelf-returned');
  }
  if (state.firstAct.stage === 'staging' && state.firstAct.corp !== undefined && !heroState.active) {
    const corp = state.firstAct.corp;
    seatFlight.value++;
    seatChain.value = Promise.resolve();
    seatOwner.value = 'firstAction';
    embedSourceShown.value = corp;
    embedSourceIncoming.value = undefined;
    embedSourceArriving.value = false;
    embedSourceDeparting.value = false;
    embedSourceLanded.value = true;
    state.firstAct.stage = 'standing';
    did.push('first-action-seated');
  } else if (state.firstAct.stage === 'idle' && firstActionOwedNow.value && firstActionCorpNow.value !== undefined &&
      !firstActionNested.value && !startFlowOtherPromptStands(props.playerView) && mode.value === 'ceremony') {
    void enterFirstActionStage();
    did.push('first-action-entered');
  } else if (bonusActionEntryDue.value) {
    void enterBonusActionStage();
    did.push('bonus-action-entered');
  }
  return did.length === 0 ? 'nothing-to-heal' : did.join(',');
}
async function enterFirstActionStage(): Promise<void> {
  const corp = firstActionCorpNow.value;
  if (corp === undefined || state.firstAct.stage !== 'idle') {
    return;
  }
  state.firstAct.stage = 'staging';
  state.firstAct.corp = corp;
  state.firstAct.submitting = false;
  // A NESTED stand (the corp action as bonus item #1) belongs to the
  // bonus chapter — recording it as «the first-action chapter stood»
  // would resurrect a chapter the rail deliberately absorbed.
  if (!firstActionNested.value) {
    state.firstActionSeen = true;
  }
  fetchFirstActionPreview(corp);
  // The card leaves FIRST; the ROOM lets go behind it — but the recede is
  // owned by `stageOwnsRoom`'s watcher, not spelled out here. One
  // derived bit, one pair of phrases: the release and the return are then
  // guaranteed to be symmetric no matter WHICH exit the stage takes (a
  // follow-up pick, a board placement, the leave). Spelling the release
  // out at the entry and the return at one specific prompt-watcher is
  // what left the room receded when the watchers fired in the other
  // order — the room stayed away, so the drawn preludes had nowhere
  // visible to be dealt into and the hero had no measurable shelf to fly
  // to (the reported «прологи без анимации, розыгрыш одним кадром»).
  //
  // THE SEAT MAY STILL HOLD THE PREVIOUS EFFECT'S CARD: the server
  // quiets before the client-side settle finishes its return, so an
  // entry racing that window found the seat occupied, the emerge's guard
  // stayed silent, and when the old card DID settle home the briefing
  // stood over an empty seat. The funnel's take IS the handover: the old
  // occupant settles first, then the corp rises — one serialized phrase.
  await seatTake('firstAction', corp);
  if (state.firstAct.stage === 'staging' && state.firstAct.corp === corp) {
    state.firstAct.stage = 'standing';
  }
}
/**
 * THE ROOM FOLLOWS THE STAGE — ONE derived bit, both phrases.
 *
 * `instant` is the RESTORE path: the workspace unmounts on a collapse, so
 * a stage that is still standing when the player comes back must find its
 * room ALREADY receded — animating it there would play the recede a
 * second time, which is «РАЗЫГРАНО показывается и сразу исчезает».
 */
function syncStageRoom(owns: boolean, instant: boolean): void {
  if (owns) {
    if (instant) {
      poseRoomReceded();
      return;
    }
    runQueueRelease();
    // «РАЗЫГРАНО» IS NOT RECEDED HERE — it is the stage's own floor (see
    // `shelfOnStage`). If a step had taken it away earlier, bring it back:
    // the stage that follows flies cards into it.
    void runPlayedDockReturn();
    roomPosed.value = true;
    return;
  }
  // …unless ANOTHER owner still wants it away: an embedded reveal that is
  // ON SCREEN recedes the room in its own phrase and returns it in its
  // own phrase (`embedPresenting` / `embedActive` watchers). Two writers
  // on one surface is how a return and a release cancel each other
  // mid-flight. A merely CLAIMED follow-up is not an owner yet — the room
  // stays until its step actually appears.
  if (embedPresenting.value) {
    return;
  }
  // THE ROOM COMES BACK, and the deal waits for it: a card dealt into a
  // surface that is still travelling lands nowhere the player can see.
  roomSettling.value = true;
  void Promise.all([runQueueReturn(), runPlayedDockReturn()])
    .then(() => {
      roomSettling.value = false;
    });
}
/**
 * AN EMBEDDED STEP COMES BACK EXACTLY AS IT WAS — the restore half of
 * «свернуть» for a step standing in this workspace's outcome zone (the deck
 * pick, the reveal), the twin of the first-action stage's restore above.
 *
 * The claim survived the park in module state; everything this component
 * kept beside it did not. So, without replaying a beat the player already
 * watched: the zone is published again (retracted at the unmount — the
 * selector named a node that died), the SOURCE is back in its seat, and the
 * room is already away. The step's own `embedPresenting` edge cannot do it:
 * the claim is presenting on both sides of the park, and a watcher does not
 * fire on `true → true`.
 */
function restoreOutcomeStep(): void {
  if (!embedActive.value) {
    return;
  }
  const zone = playOutcomeZone('start');
  if (outcome.embedSlot === '' && zone !== undefined) {
    setWorkspaceOutcomeSlot(zone);
  }
  if (!embedPresenting.value) {
    return;
  }
  const source = outcome.sourceCard as CardName;
  if (embedSourceShown.value === undefined && seatOwner.value === undefined &&
      props.playerView.thisPlayer.tableau.some((c) => c.name === source)) {
    seatOwner.value = 'effect';
    embedSourceShown.value = source;
    embedSourceIncoming.value = undefined;
    embedSourceArriving.value = false;
    embedSourceLanded.value = true;
    embedSourceDeparting.value = false;
  }
  poseStepRoomReceded();
}
/** The room an embedded step owns, already away — no animation (a restore;
 *  the release phrase played when the step first rose). Waits a tick for a
 *  queue that is not rendered yet rather than latching an undone pose. */
function poseStepRoomReceded(): void {
  const queue = queueEl.value ?? undefined;
  if (queue === undefined || queue === null || !queue.isConnected) {
    void nextTick(() => {
      const late = queueEl.value ?? undefined;
      if (embedPresenting.value && !queueReleased.value && late !== undefined && late !== null && late.isConnected) {
        queueReleased.value = true;
        gsap.set(late, {autoAlpha: 0});
      }
    });
  } else if (!queueReleased.value) {
    queueReleased.value = true;
    gsap.set(queue, {autoAlpha: 0});
  }
  const dock = playedDockRoot();
  if (dock !== null && !playedDockReleased.value) {
    playedDockReleased.value = true;
    gsap.set(dock, {autoAlpha: 0});
  }
}
/**
 * ADOPT the unowned pick (`orphanStepSource`): the same claim the press
 * would have armed, with what it would hold by now — the beat long played,
 * the answer in, the step on stage — and the zone published. The pick then
 * teleports here, owns the pad, and the flow ends through the ordinary
 * release (the source card flies home, the deployment comes back).
 */
function adoptOrphanStep(): void {
  const source = orphanStepSource.value;
  const zone = playOutcomeZone('start');
  if (source === undefined || zone === undefined) {
    return;
  }
  claimWorkspaceOutcome('start', source, ['draw', 'pick', 'effect'], 0, 0, 'chain');
  markWorkspaceOutcomeAnswerIn();
  markWorkspaceOutcomeBeatDone();
  markWorkspaceOutcomePresenting();
  setWorkspaceOutcomeSlot(zone);
  restoreOutcomeStep();
}
/** The receded pose applied with NO animation (a restore, or reduced
 *  motion): the room is simply already away.
 *
 *  It can be asked for BEFORE the elements exist (the immediate watcher
 *  runs during setup), so it waits for them rather than declaring the
 *  pose applied — `roomPosed` is what drops the class that hides the room
 *  in the meantime, and dropping it early is the flash itself. */
function poseRoomReceded(): void {
  queueReleased.value = true;
  const queue = queueEl.value ?? undefined;
  if (queue === undefined || queue === null || !queue.isConnected) {
    void nextTick(() => {
      if (stageOwnsRoom.value && !roomPosed.value) {
        poseRoomReceded();
      }
    });
    return;
  }
  gsap.set(queue, {autoAlpha: 0});
  // The SHELF is deliberately not posed away: a restored stage finds it
  // exactly where it belongs — tucked to its peek, under the stage.
  roomPosed.value = true;
}
/**
 * ENTER the bonus-action stage — the briefing stands. Nothing is submitted
 * and nothing moves on the board: this beat exists so the player is TOLD
 * that their prelude bought them two immediate actions and that the next
 * press hands them the board, instead of the workspace simply vanishing.
 */
async function enterBonusActionStage(): Promise<void> {
  const source = bonusActionSourceCard.value;
  if (state.bonusAct.stage !== 'idle') {
    return;
  }
  state.bonusAct = {...state.bonusAct, stage: 'staging', source};
  state.bonusActionSeen = true;
  // THE STAGE HAS A SUBJECT, exactly like the first-action stage's: the
  // granting card physically EMERGES from «РАЗЫГРАНО» into the source seat
  // and presides over the briefing.
  //
  // Not decoration — it is the difference between an embedded stage and a
  // modal. A plate alone in the middle of the deployment row is attached to
  // nothing the player can see, so it reads as a window that ARRIVED over
  // the workspace; seated beside the card that caused it, the same plate is
  // plainly a stage OF the workspace. (The room lets go behind it through
  // `stageOwnsRoom` — one owner for both briefing stages.)
  if (source !== undefined) {
    await seatTake('bonus', source);
  }
  if (state.bonusAct.stage === 'staging') {
    state.bonusAct = {...state.bonusAct, stage: 'standing', source};
  }
}
/**
 * ENTER THE SUB-STAGE — the player's explicit press on «Перейти к первому
 * действию». The seat performs the PREMIUM HANDOVER: «Фора» settles home
 * into «РАЗЫГРАНО» and the corporation rises into the seat (the same two
 * phrases the Merger seat swap uses — never a repaint of the face), and
 * the plate becomes the corp's briefing. The window's identity survives
 * around it: the crumb stays «ФОРА › ПЕРВОЕ ДЕЙСТВИЕ» and the briefing
 * wears the window's 1/2 chip.
 */
async function enterBonusSubStage(): Promise<void> {
  const corp = firstActionCorpNow.value;
  if (corp === undefined || state.firstAct.stage !== 'idle' ||
      state.bonusAct.stage !== 'standing') {
    return;
  }
  state.firstAct.stage = 'staging';
  state.firstAct.corp = corp;
  state.firstAct.submitting = false;
  fetchFirstActionPreview(corp);
  // The handover: the window's card home, the item's card up — the
  // funnel's take settles the occupant first.
  await seatTake('firstAction', corp);
  if (state.firstAct.stage === 'staging' && state.firstAct.corp === corp) {
    state.firstAct.stage = 'standing';
  }
}
/**
 * LEAVE THE SUB-STAGE WITHOUT ACTING (B — one logical level): the corp
 * settles home, «Фора» retakes the seat, the overview returns. Nothing
 * was submitted, so there is nothing to roll back.
 */
async function exitBonusSubStage(): Promise<void> {
  if (state.firstAct.stage !== 'standing' || state.firstAct.submitting) {
    return;
  }
  state.firstAct.stage = 'staging';
  await seatRelease('firstAction');
  state.firstAct.stage = 'idle';
  state.firstAct.corp = undefined;
  await ensureBonusSeat();
}
/** The window's seat must hold «Фора» whenever the OVERVIEW is what the
 *  player sees — including after the sub-stage settled the corp home. */
async function ensureBonusSeat(): Promise<void> {
  const source = bonusActionSourceCard.value;
  if (source === undefined ||
      state.bonusAct.stage === 'idle' || state.bonusAct.stage === 'onboard' ||
      state.firstAct.stage !== 'idle') {
    return;
  }
  await seatTake('bonus', source);
}
/**
 * CLAIM one of the window's pending gains («Фора»: the steel / M€ whose
 * timing the player chooses). Submits the gain's own option — the server
 * resolves it at TODAY's value and re-presents the same prompt without
 * spending an action.
 */
/** «по 2 M€ за карту в руке · сейчас 7» — the live formula line. */
function gainFormulaText(gain: BonusGainRow): string {
  const rate = gain.perCardInHand ?? 0;
  const cards = rate > 0 ? Math.round(gain.amount / rate) : 0;
  return translateTextWithParams('${0} M€ per card in hand · now ${1}', [String(rate), String(cards)]);
}
function claimStageGain(gain: BonusGainRow): void {
  if (gainClaimPending.value) {
    return;
  }
  gainClaimPending.value = true;
  // THE GAIN IS A REWARD, so it arrives like every other one: a chip out of
  // the thing that produced it, onto its row in the panel, its delta chip
  // firing at the touchdown. The ORIGIN is measured NOW, while the pressed
  // row is still on screen — the same response that grants the gain answers
  // the prompt, so by the time the chip may fly the row is gone.
  armBonusGainClaim(gain, bonusActionSourceCard.value ?? state.bonusAct.source, gainRowPoint(gain));
  emit('submit', {type: 'or', index: gain.index, response: {type: 'option'}});
}
/** The pressed row's centre — the chip's birth point (see `claimStageGain`). */
function gainRowPoint(gain: BonusGainRow): {x: number, y: number} | undefined {
  const el = sceneRoot()
    ?.querySelector<HTMLElement>(`.con-start__gainrow[data-gain-row="${gain.resource}"]`);
  const r = el?.getBoundingClientRect();
  if (r === undefined || r.width <= 0) {
    return undefined;
  }
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}
/**
 * FLY WHAT THE WINDOW OWES. Both halves of the beat land here — the claim
 * the player pressed a moment ago, and the auto-resolve that happened while
 * they were on the board — because both need the same thing: a workspace
 * that is actually on screen, with the granting card standing where the
 * chips can come out of it.
 *
 * Fire-and-forget and honestly degradable: a source that cannot be measured
 * flies nothing and releases its hold at once, so the gain is announced by
 * its delta chip alone — marginally late, never lost.
 */
/** The mount edge of the same question the watcher answers (see both). */
function runBonusGainWaveIfDue(): void {
  if (bonusGainWaveDue.value) {
    runBonusGainWave();
  }
}
function runBonusGainWave(): void {
  // Taken at once — the mount edge and the watcher may both ask, and the wave must never start twice.
  const reward = consumeBonusGainReward();
  if (reward === undefined) {
    return;
  }
  const fly = (): void => {
    void runResourceTransfers({
      specs: reward.specs,
      source: reward.point !== undefined ?
        {point: reward.point} :
        {selectors: bonusGainSourceSelectors(reward.source)},
      arrival: 'auto',
      onArrive: (spec) => releasePanelRewardHold(spec),
    }).then(() => {
      // Belt-and-braces: a degraded transfer's hold snaps to the committed
      // truth now (its chip fires marginally late, never lost).
      clearPanelRewardHold();
    });
  };
  if (reward.point !== undefined) {
    fly();
    return;
  }
  // THE AUTO-RESOLVE FLIES OUT OF «РАЗЫГРАНО», and the shelf comes back WITH this scene: at the mount edge the
  // granting card is measurable but still transparent, which the law of visible ends refuses — the wave degraded
  // to a bare tick on every return. Wait (bounded) for the card to be SEEN; fly either way, so a card that never
  // shows degrades exactly as before. The panel keeps holding the gains meanwhile.
  const scene = root.value as Node | null;
  void awaitVisibleBonusGainSource(bonusGainSourceSelectors(reward.source), undefined, () => scene?.isConnected === true).then(fly);
}
/**
 * A on the standing briefing — THE HAND-OFF.
 *
 * It commits nothing: the server's action menu is already live, the board
 * is an always-mounted host, and what this press changes is who has the
 * screen. The shell watches this consent (`startExcursionEngage`) and
 * engages the completion barrier, so the workspace COLLAPSES — state
 * intact, lifetime hold untouched — and comes back exactly once, when the
 * last bonus is spent.
 */
function confirmBonusHandoff(): void {
  if (state.bonusAct.stage !== 'standing') {
    return;
  }
  state.bonusAct = {...state.bonusAct, stage: 'onboard', source: bonusActionSourceCard.value};
}
/** The briefing's preview fetch — non-gating (the CTA never waits on it);
 *  a failed fetch degrades to the ask + the confirm, exactly like the
 *  ceremony's reward prefetch. */
function fetchFirstActionPreview(corp: CardName): void {
  const version = startPreviewVersion.value;
  if (firstActionPreviewsVersion.value !== version) {
    firstActionPreviewsVersion.value = version;
    firstActionPreviews.value = new Map();
  }
  if (firstActionPreviews.value.has(corp)) {
    return;
  }
  // ASK ONLY WHAT THE SERVER CAN ANSWER. The briefing keeps standing while
  // the action it submitted resolves (the pick it produced, a placement),
  // and it re-asks on every state move — but the corp left
  // `pendingInitialActions` at the submit. See `firstActionPreviewable`.
  if (!firstActionPreviewable(props.playerView, corp)) {
    return;
  }
  firstActionPreviews.value.set(corp, undefined);
  const url = apiUrl(paths.API_CORP_FIRST_ACTION_PREVIEW) +
    '?id=' + encodeURIComponent(props.playerView.id) + '&corp=' + encodeURIComponent(corp);
  // Degraded honestly on an absent preview: the stage still shows the ask
  // + the CTA.
  fetchPreview<ActionPreview>(url).then((p) => {
    if (firstActionPreviewsVersion.value === version) {
      firstActionPreviews.value.set(corp, p);
    }
  });
}
/**
 * PERFORM THE FIRST ACTION (A on the standing stage) — submit the seated
 * corp's option of the marked OrOptions, byte-identical to the legacy
 * radio submit. A draw-effect action claims its follow-up INTO this
 * workspace in the same press (the corp is ALREADY physically staged in
 * the source seat, so the claim's execution beat is done by construction);
 * everything else (a placement, a prelude pick) arrives as the
 * deployment's normal follow-up prompts.
 */
function performFirstAction(): void {
  if (!firstActionActionableNow.value) {
    return;
  }
  const corp = state.firstAct.corp;
  const prompt = startFlowCorpPrompt(props.playerView);
  const index = corpActionOptionIndexFor(prompt, corp as CardName);
  if (prompt === undefined || index === -1) {
    return;
  }
  beginFirstActSubmit();
  // THE RAIL HALF (TR81): the action's own rail gains and the table's answer to them, armed off the briefing's own
  // preview at the press — the transport holds them in the apply block that pays them, the stage flies them.
  foldForecastHost('start');
  armFirstActionRail(firstActionRailOf(corp as CardName, firstActionBranch(firstActionPreview.value), firstActionForecast.value));
  // OPTIMISTIC BY CONTRACT (see claimStartFollowUp): whatever this action
  // turns out to produce — a drawn batch, a pick, nothing at all —
  // presents INSIDE this workspace. A claim that finds nothing to host is
  // reconciled away a tick later; a missing claim sends a full-bleed
  // modal over a workspace that then lets go behind it.
  claimPlayOutcome(corp as string, Math.max(1, firstActionDrawExpected(firstActionPreview.value)));
  // The execution beat is ALREADY played: the source card physically
  // stands in its seat (the stage's emerge). Without this the claim
  // sits out the full BEAT_SAFETY before its surface may mount.
  markWorkspaceOutcomeBeatDone();
  // A first action that DRAWS AND THEN ASKS a discard of its own (PC05 Spire — «draw 4, then discard 3»): the album
  // of that discard marks the cards the draw brought «НОВАЯ КАРТА» — the same arm a composer takes at its commit
  // (`deferredDiscardFresh`, scoped to this one action); a first action that asks nothing reads nothing.
  armDeferredDiscards([corp as string], props.playerView.cardsInHand.map((c) => c.name),
    deferredDiscardKey(props.playerView.game.generation, props.playerView.thisPlayer.actionsTakenThisGame));
  emit('submit', {type: 'or', index, response: {type: 'option'}});
}
/** R3 / a click on the «Сработает» row — the layer unfolds out of the row over the PARKED briefing (law 9). */
function openFirstActionForecast(): void {
  if (!firstActionForecastCanOpen.value || firstActionFxOpen.value) {
    return;
  }
  forecastPulseCall = pulseForecastDoor((on) => {
    forecastPulse.value = on;
  }, forecastPulseCall);
  openForecastHost('start', root.value ?? undefined, firstActionForecastOwners.value, props.playerView);
}
/**
 * R3 / a click on the focused Prelude's «Сработает» row (TR82) — the same layer, a level of the SAME scene (P79 · DI):
 * the room becomes the lane beside the hero (`startQueueFxLane`, measured now, before the layer mounts), the queue's
 * other blocks and the shelf are named as the layers to park, and the panel grows up out of the rail's row.
 */
function openQueueForecast(): void {
  if (!queueForecastCanOpen.value || firstActionFxOpen.value) {
    return;
  }
  forecastPulseCall = pulseForecastDoor((on) => {
    forecastPulse.value = on;
  }, forecastPulseCall);
  const rootNow = root.value ?? undefined;
  const door = rootNow?.querySelector?.<HTMLElement>('[data-start-prelude-forecast]') ?? undefined;
  const hero = rootNow?.querySelector?.<HTMLElement>('[data-forecast-hero]') ?? undefined;
  const zone = rootNow?.querySelector?.<HTMLElement>('.con-start__fxhost')?.parentElement ?? undefined;
  if (hero !== undefined && zone !== undefined) {
    const zr = zone.getBoundingClientRect();
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    queueFxLane.value = startQueueFxLane(zr, hero.getBoundingClientRect(), remPx, zr.width > 0 ? zone.offsetWidth / zr.width : 1);
  }
  // What PARKS: every block of the queue's row but the hero, and the shelf — the phrase's own timeline, never a class.
  const browse = Array.from(rootNow?.querySelectorAll?.<HTMLElement>('.con-start__queue-row > *, .con-start__played') ?? [])
    .filter((el) => el !== hero && el.getClientRects().length > 0);
  openForecastHost('start', door, startForecastOwners.value, props.playerView, browse);
}
/** The seated card's element — the corporation standing on the stage (the reactor's own place). */
function seatCardEl(): HTMLElement | undefined {
  const rootNow = root.value ?? undefined;
  const el = rootNow?.querySelector?.<HTMLElement>('.con-start__embedsource-card[data-embed-source-slot]');
  return el === null || el === undefined ? undefined : el;
}
/**
 * THE REACTOR RISES OUT OF ITS SEAT (law 3 of the card-reaction framework — a card standing on a stage comes forward
 * out of its place): a 14 px lift of the seated face and back — transform only (invariant 15), the rise primitive's
 * own durations. A card that is not the seated one never moves here.
 */
function liftSeat(card: CardName, up: boolean): Promise<void> {
  const el = seatCardEl();
  if (el === undefined || card !== embedSourceVisible.value) {
    return Promise.resolve();
  }
  const t = reactionTempo();
  if (consoleReducedMotionActive()) {
    gsap.set(el, up ? {y: 0} : {clearProps: 'transform'});
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    gsap.to(el, {
      y: up ? -14 * conUiScale() : 0,
      duration: motionMs(up ? t.riseMs : t.recedeMs) / 1000,
      ease: up ? 'power2.out' : 'power1.inOut',
      ...(up ? {} : {clearProps: 'transform'}),
      onComplete: resolve,
      onInterrupt: resolve,
    });
  });
}
/** The start stage's way of bringing a reactor forward (the director's `ReactorEmergence`). */
function firstActionEmergence(): ReactorEmergence {
  return {
    standsIn: (card) => card === embedSourceVisible.value && seatCardEl() !== undefined,
    emergeTarget: (card) => liftSeat(card, true),
    settleTarget: (card) => liftSeat(card, false),
    emergedFaceEl: (card) => (card === embedSourceVisible.value ? seatCardEl() : undefined),
  };
}
/**
 * FLY THE FIRST ACTION'S RAIL HALF (TR81): the k-th rating token is born on the k-th printed TR plate of the seated
 * corporation (the first action's row — never its effect row) and lands in the score cell; the table's answer is the
 * card-reaction director's flight with the SEAT as the reactor's place, the rating cell marked as its cause.
 */
async function runFirstActionRail(): Promise<void> {
  await flyFirstActionRail((rows) => {
    const seat = seatCardEl();
    const taken = new Map<string, number>();
    const plates = (resource: string): Array<HTMLElement> => seat === undefined ? [] :
      Array.from(seat.querySelectorAll<HTMLElement>('.pcard-ic')).filter((el) => el.closest('.pcard-effect') === null && iconMatches(el, resource));
    const reaction = cardReactionAnswerFlight({rows, emergence: firstActionEmergence(), view: props.playerView});
    return {
      originOf: (spec: ResourceTransferSpec): TransferEnd | undefined => {
        const k = taken.get(spec.resource) ?? 0;
        taken.set(spec.resource, k + 1);
        const printed = plates(spec.resource);
        return centreEndOf(printed[Math.min(k, printed.length - 1)]);
      },
      answer: reaction === undefined ? undefined : {
        ...reaction,
        originOf: (spec: ResourceTransferSpec) => {
          const origin = reaction.originOf(spec);
          if (origin !== undefined) {
            // THE CAUSE IS MARKED (the owner's decision 2): the rating that just ticked wears the one-shot kant.
            markReactionCause(document.querySelector('.con-res .con-score__cell--tr'));
          }
          return origin;
        },
      },
    };
  });
}
/**
 * LEAVE THE STAGE — the action's whole causal chain has resolved: the
 * room breathes back and the corporation card physically settles home
 * into «Разыграно» (the same return + settle phrase every embedded step
 * ends with) — closing its role as the source, so READY lands on a
 * complete, settled frame.
 */
async function runFirstActionLeave(): Promise<void> {
  if (state.firstAct.stage === 'idle' || state.firstAct.stage === 'leaving') {
    return;
  }
  // The window's item #1 resolved INSIDE the window: the plan ticks it,
  // and the overview that returns says 2/2 with the board CTA.
  const nested = state.bonusAct.stage === 'standing' || state.bonusAct.stage === 'staging';
  // A half still ARMED was never paid by a view (the action asked something else first): nothing is held, nothing owed.
  if (firstActionRail.phase === 'armed') {
    releaseFirstActionRail('stage left');
  }
  state.firstAct.stage = 'leaving';
  // The ROOM breathes back first (the shelf is the settle's destination),
  // then the stage RELEASES its seat — the one settle home of the stage.
  await Promise.all([runQueueReturn(), runPlayedDockReturn()]);
  await seatRelease('firstAction');
  state.firstAct.stage = 'idle';
  state.firstAct.corp = undefined;
  state.firstAct.submitting = false;
  if (nested) {
    state.bonusAct.corpDone = true;
    // …and the WINDOW's card retakes the seat the corp just left: the
    // player lands back on the overview, subject intact.
    await ensureBonusSeat();
    // The leave's own return brought the ROOM back — but the window still
    // owns it (`stageOwnsRoom` never blinked, so its watcher has no edge
    // to act on). Re-assert the queue's recede for the overview the
    // player lands on; the shelf stays, as it does all stage long.
    if (stageOwnsRoom.value) {
      runQueueRelease();
    }
  }
}
/**
 * MERGER RE-STAND — the server re-raised the first-action prompt after a
 * previous action's chain resolved (a second corporation owes its move):
 * the standing stage returns without ever having left, and the seat swap
 * follows if the pending corp changed.
 */
function restandFirstAction(): void {
  if (state.firstAct.stage !== 'performing' || !firstActionOwedNow.value || !firstActionChainQuiet.value) {
    return;
  }
  state.firstAct.submitting = false;
  const corp = firstActionCorpNow.value;
  if (corp === undefined) {
    return;
  }
  // The seat holds THIS corporation (the stage owned it through the whole
  // chain) — the briefing simply stands again. Otherwise — the next owed
  // corporation (Merger), or a seat a hosted step took over (Valley
  // Trust's pick) — the SAME two-beat phrase as the entry: staging keeps
  // the panel down, the funnel settles the occupant and flies the corp
  // into the seat, the briefing rises around it. Never a briefing over an
  // empty or emptying seat.
  if (seatHolds(corp) && embedSourceIncoming.value === undefined) {
    state.firstAct.corp = corp;
    seatOwner.value = 'firstAction';
    state.firstAct.stage = 'standing';
    return;
  }
  void swapFirstActionSeat(corp);
}
/**
 * THE SEAT HANDS OVER to `next` (Merger's second corporation after the
 * first resolved; the player's LB/RB choice between several owed) —
 * the current card settles home, the next one rises — through the funnel's
 * one serialized phrase, never a repaint of the seat's face.
 */
async function swapFirstActionSeat(next: CardName): Promise<void> {
  const stage = state.firstAct.stage;
  if ((stage !== 'standing' && stage !== 'performing') || state.firstAct.submitting) {
    return;
  }
  if (state.firstAct.corp === next && seatHolds(next)) {
    state.firstAct.stage = 'standing';
    return;
  }
  state.firstAct.stage = 'staging';
  state.firstAct.corp = next;
  fetchFirstActionPreview(next);
  // The settle flies INTO the shelf, so the shelf must be back and
  // measurable first — and it STAYS for the next corp's rise: both halves
  // of the swap have a visible place to come from and go to.
  await runPlayedDockReturn();
  await seatTake('firstAction', next);
  if (state.firstAct.stage === 'staging' && state.firstAct.corp === next) {
    state.firstAct.stage = 'standing';
  }
}
/**
 * THE PLAYER'S CHOICE — several corporations owe their opening move at
 * once (Merger), and the server's `OrOptions` offers one option EACH:
 * LB/RB cycle the seated corporation among the LIVE candidates (the
 * seat hands over through the same phrase as the Merger re-stand). Never
 * a hard order: the stage seats the first live one and the player decides.
 */
function cycleFirstActionCorp(dir: 1 | -1): void {
  const candidates = firstActionCandidates.value;
  const current = state.firstAct.corp;
  if (candidates.length < 2 || current === undefined ||
      state.firstAct.stage !== 'standing' || state.firstAct.submitting) {
    return;
  }
  const idx = candidates.indexOf(current);
  const next = candidates[((idx < 0 ? 0 : idx) + dir + candidates.length) % candidates.length];
  if (next !== undefined && next !== current) {
    void swapFirstActionSeat(next);
  }
}
/**
 * The play's FOLLOW-UP claim: a start card that DRAWS other cards hosts
 * the shared reveal INSIDE this workspace (the embed zone). Armed in the
 * same press as the submit — nothing card-shaped can slip past it and
 * open a standalone surface for a frame. Cards that draw nothing make no
 * claim (a no-op — the deployment simply continues).
 */
function claimStartFollowUp(name: CardName): void {
  const expected = drawExpected.get(name) ?? 0;
  // EVERYTHING THIS PRESS SETS OFF STAYS INSIDE THIS WORKSPACE.
  //
  // The preview's `cards` chip is a good hint, never a guarantee, and the
  // claim is therefore OPTIMISTIC — the same bargain the first-action stage
  // has always struck, now for every start play, because a `behavior`
  // preview can only advertise what the card itself declares:
  //  · a bespoke first action (Valley Trust) declares no draw, and the
  //    prelude the player then picks can draw cards of its own;
  //  · a TRIGGERED EFFECT draws for a card that is not the one pressed —
  //    Point Luna's «сыграв метку Земли, возьмите карту» fires on its OWN
  //    play, so the corporation's opening draw was advertised by nothing,
  //    claimed by nobody, and arrived as a full-bleed fullscreen card as
  //    though it had come off the board.
  // The outcome mechanism is built for optimism (`reconcileWorkspaceOutcome`
  // drops a claim a tick after the response when nothing turned out to be
  // embeddable), which makes «claim and release if unused» strictly safer
  // than «guess and miss». One resolver, shared with the play composer's
  // door — see consolePlayOutcomeClaim.
  const inFirstAction = state.firstAct.stage !== 'idle';
  claimPlayOutcome(name, Math.max(expected, inFirstAction ? 1 : 0));
  // The EFFECT-SOURCE seat mounts IN THE SAME PRESS — but ONLY for a play
  // whose draw is DECLARED: the seat is an intermediate landing slot the
  // hero flight aims at (`armStartHero`'s `targetSelector` reads the same
  // hint), so mounting it for a card that flies straight to «РАЗЫГРАНО»
  // would seat a second copy of a card already standing there. An
  // undeclared draw simply presents in the zone with its source on the
  // shelf below — one physical card, always.
  if (expected <= 0 && !inFirstAction) {
    return;
  }
  // The EFFECT arms the seat for its hero landing — unless a STAGE owns
  // it: with this very card (the first action's own draw — the
  // corporation is already seated, the reveal presents beside it) the
  // seat is simply kept; with another card (a non-drawing candidate
  // picked while the corporation stands) the play lands on the shelf and
  // its outcome, if any, presents with the source below — the stage's
  // card is never overwritten in place (a face swap in the seat is a
  // teleport twice over).
  if (seatOwner.value !== undefined && seatOwner.value !== 'effect') {
    return;
  }
  seatFlight.value++;
  seatOwner.value = 'effect';
  embedSourceShown.value = name;
  embedSourceIncoming.value = undefined;
  embedSourceArriving.value = true;
  embedSourceLanded.value = false;
  embedSourceDeparting.value = false;
}
/**
 * The starting-cards DELIVERY (handDeliveryDirector). Fire on the payment
 * confirm: capture the FACE-UP card rects from the payment grid NOW (the
 * grid unmounts as the payment resolves), so the same cards can lift off
 * exactly where they sat, flip to their backs and arc down into the hand
 * dock. Only fires while the delivery is holding this deal (the arm
 * watcher) — a no-op otherwise.
 */
function launchStartCardsDelivery(): void {
  const names = [...ceremonyBoughtNames.value];
  if (names.length === 0) {
    return;
  }
  startDeliveryNames.value = names;
  const grid = payGrid.value ?? undefined;
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
  runHandDelivery('bought', names, rects);
}
/**
 * The «НАСЛЕДИЕ» delivery — the mirror of `launchStartCardsDelivery`:
 * capture the carried cards' FACE-UP rects from their queue row NOW (the
 * row unmounts as the grant resolves), arm the dock hold (the cards join
 * `cardsInHand` only at the response and must not materialize in the
 * dock), then fly them the same lift → flip → arc into the hand dock.
 */
function launchLegacyDelivery(): void {
  const names = legacyRowCards.value.map((c) => c.name);
  if (names.length === 0) {
    return;
  }
  armDeliveryHold('legacy', deliverySignature(names), names);
  const grid = legacyGrid.value ?? undefined;
  const rects = new Map<CardName, DOMRect>();
  if (grid !== undefined && grid !== null) {
    for (const el of grid.querySelectorAll<HTMLElement>('[data-legacy-card]')) {
      const name = el.getAttribute('data-legacy-card') as CardName | null;
      const card = el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? el;
      const r = card.getBoundingClientRect();
      if (name !== null && r.width > 4) {
        rects.set(name, r);
      }
    }
  }
  runHandDelivery('legacy', names, rects);
}
/**
 * The «БОНУС КАМПАНИИ» flight — the shared resource-transfer language:
 * an M€ chip emerges from the plate, arcs into the player rail and lands
 * with the counter's own delta tick. Fired at the press (the amount is
 * the marker's own — never guessed); reduced motion resolves instantly
 * inside the framework.
 */
function launchBonusFlight(): void {
  const amount = bonusPrompt.value?.megaCredits ?? campaignBonusAmount.value;
  if (amount <= 0) {
    return;
  }
  void runResourceTransfers({
    specs: [{channel: 'stock', resource: 'megacredits', amount}],
    source: {selectors: ['[data-campaign-bonus]']},
    arrival: 'auto',
  });
}
/** Arm the played-card hero for a START-SCENE press: the card lifts out
 *  of its scene slot (never the play composer), carrying the prelude's
 *  PRE-FETCHED on-play rewards so the landing gets the same premium
 *  reward beat a composer-played card gets. */
function armStartHero(name: CardName): void {
  // What the press KNEW of the play's rewards (the trail names a wave that was never promised).
  noteTransferTrail('start:arm', {
    card: name, preview: playPreviews.value.has(name), fetched: rewardFetched.value.has(name),
    version: rewardVersion.value === startPreviewVersion.value ? 'current' : 'stale',
    rewards: playRewards.get(name)?.length ?? 0, rail: playRails.has(name),
  });
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
    targetSelector: (drawExpected.get(name) ?? 0) > 0 ? '[data-embed-source-slot]' : undefined,
    rewards: playRewards.get(name),
    rail: playRails.get(name),
    // THE PRICE LEAVES FIRST (P52 · FH — PL-104 / PL-099): a prelude's printed price (Industrial Complex's 18 M€)
    // comes off the rail's row sideways into the card before the lift; the result's wave follows the landing.
    spends: playSpends.get(name),
    // The queue slot and the dock's top slot (and the effect-source seat)
    // all paint the `thumb`-tier name-only face — the proxy wears it from
    // the lift to the handoff, no swap needed.
    sourceFace: {lightweight: true},
    landingFace: {lightweight: true, model: 'none'},
  });
  // THE START'S OWN PLAY IS IN FLIGHT (P57 · FQ): the frame lives while it runs, whatever the prompt admission says.
  setStartHeroPlaying(true);
}
/**
 * Pre-fetch the on-play rewards of every card the player can press in the
 * ceremony — the chosen CORPORATION (still in the deferred `corporationPlay`
 * window: its starting M€ + its own production/stock gains) and each
 * PRELUDE. The ceremony has no play composer, so this is where the reward
 * manifest comes from. Runs while the player reads the cards (never gating
 * the press): a card whose fetch hasn't landed simply arms without a beat.
 *
 * Only STOCK / PRODUCTION gains — and a gain ON THE CARD ITSELF — ride the beat here: any other card-resource gain
 * needs a pre-selected host card, which the ceremony (with no composer)
 * cannot capture — it stays with the ordinary commit + its own follow-up
 * prompt, never a chip flying at a target the player never chose.
 */
/**
 * The reward beat, the rail half, the forecast and the draw size of ONE branch of a card's play preview — branch 0
 * for a card with no choice, the CHOSEN branch once the «ВАРИАНТ» step answered (P44: the ceremony used to read
 * branch 0 whatever the player chose — the temperature's TR for a Venus play).
 */
function applyPlayPreview(name: CardName, preview: ActionPreview, position: number | undefined, version: string, stepResponses: Readonly<Record<number, unknown>> = {}): void {
  const branch = preview.branches?.[position ?? 0] ?? preview.branches?.[0];
  if (branch === undefined) {
    return;
  }
  const rewards = extractPlayRewards({
    cardName: name,
    effects: branch.effects,
    steps: branch.steps,
    // The ceremony pre-collects nothing — except a resource pre-step's answer (P50 · FC).
    stepResponses,
  // …except a gain ON THE CARD ITSELF (P43 · EN — «add 6 science here»): it needs no pre-selected host, its
  // host is the very card the shelf receives, so its tokens fly onto that card's capsule (TR82's receiving shelf).
  }).filter((spec) => spec.channel !== 'card-resource' || spec.targetCard === name);
  if (rewardVersion.value === version) {
    if (rewards.length > 0) {
      playRewards.set(name, rewards);
    } else {
      playRewards.delete(name);
    }
  }
  // The rail half — the ceremony pre-collects nothing; a rating's card answer (TR81 Lotus Innovations' data) rides it
  // after the TR, like the play composer's.
  // A variant not chosen yet is read WHOLE (P65 · GH): its branch-tied answers stay on their rows, never branch 0's.
  const playForecast = preludePlayForecast(name, preview, position);
  if (rewardVersion.value === version) {
    if (playForecast !== undefined) {
      playForecasts.value.set(name, playForecast);
    } else {
      playForecasts.value.delete(name);
    }
  }
  const facts = playForecast?.facts;
  // THE START HOST (P66 · GJ): no field beat tells a scale step's rating under the start's cover — the hero does,
  // one token per step off the printed scale icons.
  const rail = withRailAnswerTags(playRailReward(branch, branch.effects ?? [], {}, undefined,
    [...reactionRailSpecs(facts), ...ratingAnswerSpecs(facts)], {startHost: true}), railAnswerTags(facts));
  if (rewardVersion.value === version) {
    if (rail !== undefined) {
      playRails.set(name, rail);
    } else {
      playRails.delete(name);
    }
  }
  // THE PRICE (P52 · FH): a start play's printed price is NOT free here — it leaves the rail FIRST, the table's
  // answers to the same play netted out of the two-view check (Manutech's M€ for the raised M€ line).
  const spends = startPlaySpendReward(name, branch, stepResponses, reactionRailSpecs(facts));
  if (rewardVersion.value === version) {
    if (spends !== undefined) {
      playSpends.set(name, spends);
    } else {
      playSpends.delete(name);
    }
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
  if (expected > 0 && rewardVersion.value === version) {
    drawExpected.set(name, expected);
  }
}
function prefetchPlayRewards(): void {
  const viewerId = props.playerView.id;
  if (typeof fetch !== 'function') {
    return; // JSDOM / a headless host — the beat degrades honestly
  }
  // SERVER-DERIVED ⇒ VERSION-SCOPED. A prelude's reward can be priced off
  // the state a PREVIOUS prelude just changed («M€ равно вашему запасу
  // стали»), so a manifest kept under the card's name alone would arm the
  // beat with the numbers of a state two plays ago. `rewardFetched` is the
  // dedup INSIDE one version, never across versions.
  const version = startPreviewVersion.value;
  if (rewardVersion.value !== version) {
    rewardVersion.value = version;
    rewardFetched.value = new Set();
    // The previews belong to the version too — a step opened on an older state would answer an older branch list.
    playPreviews.value = new Map();
  }
  // Every card the player can press RIGHT NOW: the deferred corporation,
  // Merger's offered corporations (its `corporationSelection` candidates —
  // the 2nd corp plays EXACTLY like the first, so it gets the identical
  // reward beat), and the prelude rail. A drew-N prelude candidate rides
  // the same list (it lands in the tableau like any prelude); Double Down's
  // copy candidates are ALREADY-PLAYED preludes — they never re-play, so
  // the copy prompt is skipped (its press keeps the legacy pick beat).
  const corpName = corpPlayCard.value?.name;
  const copyPick = startFlowPreludeCopyPrompt(props.playerView) !== undefined;
  const candidates = copyPick ? [] : candidateCards.value.map((c) => c.name);
  const names: Array<CardName> = [
    ...(corpName !== undefined ? [corpName] : []),
    ...candidates,
    ...preludeRail.value.filter((e) => e.status !== 'played').map((e) => e.name),
  ];
  for (const name of names) {
    if (rewardFetched.value.has(name)) {
      continue;
    }
    rewardFetched.value.add(name);
    const url = apiUrl(paths.API_CARD_PLAY_PREVIEW) +
      '?id=' + encodeURIComponent(viewerId) + '&card=' + encodeURIComponent(name);
    fetchPreview<ActionPreview>(url)
      .then((preview) => {
        if (preview === undefined || rewardVersion.value !== version) {
          return;
        }
        // Kept whole: a prelude with branches is chosen in the «ВАРИАНТ» step (P44) and re-read for the chosen one.
        playPreviews.value.set(name, preview);
        const chosen = preludeVariantRowOf(preludeVariantOf(name, preview), variantChosen.value.get(name));
        applyPlayPreview(name, preview, chosen?.position, version, preludeVariantStepResponses(chosen));
      })
      .catch(() => {
        // `fetchPreview` never rejects — an absent preview simply arrives
        // as `undefined` and the card plays without the reward beat (its
        // chips fire on the commit). This guards the READING above.
      });
  }
}
/** The fullscreen A-verb for a ceremony card, or undefined → read-only.
 *  Preludes / drew-N candidates are PLAYABLE from fullscreen (desktop
 *  parity — «Разыграть»); a corporation's first action is NOT (matching
 *  the desktop, where the corp effect is applied from its column, not the
 *  card viewer). */
function ceremonyZoomLabel(name: CardName): string | undefined {
  const item = focusables.value.find((f) => f.name === name);
  if (item === undefined || item.disabled) {
    return undefined;
  }
  // (No risk verb to mirror here: opening the viewer LEAVES the risk stage
  // — reading a card is stepping out of the decision — so the viewer's A
  // is always a first press, and a first press only ever opens the stage.)
  // Every actionable ceremony card — incl. the deferred corporation —
  // is playable from fullscreen (the viewer closes, then actByName runs).
  return candidatePrompt.value !== undefined ? candidateVerb.value : 'Play now';
}

/**
 * P58 · FS — a NEW «which tile next» (the first, or the next placement's): the cursor on its first takeable row,
 * the previous answer's seal let go. The same step re-read (a poll of the standing prompt) keeps the cursor.
 */
watch(() => orderLiveKey.value, (key: string): void => {
  if (key === '') {
    return;
  }
  releaseOrderStep();
  const live = orderLive.value;
  orderFocus.value = live === undefined ? 0 : firstAvailableRow(live);
}, {immediate: true});
/** …and the board took the screen for the placement the answer asked: the answered step's work is done. */
watch(() => props.yielded, (now: boolean): void => {
  if (now) {
    releaseOrderStep();
  }
});
/**
 * THE START'S OWN PLAY ENDS WITH ITS HERO (P57 · FQ): the fact `armStartHero` raises is let go when the played-card
 * hero finishes (or was never armed — immediate: a remount with no hero standing clears a stale one).
 */
watch(() => playedHeroState.active, (active: boolean): void => {
  if (!active) {
    setStartHeroPlaying(false);
  }
}, {immediate: true});
/** The queue's box is re-observed whenever the ceremony (re)mounts it; its count re-solves the size (TRP0 · DE). */
watch(() => queueCards.value.length, (): void => {
  observeQueueBox();
  solveQueueZoom();
}, {flush: 'post'});
watch(() => queueHostKey.value, (): void => {
  observeQueueBox();
}, {flush: 'post'});
/** The verdict's MIRROR for the shell's start watchdog (module state — the shell cannot read a child's computed). */
watch(() => servesNow.value, (serves: StartServes): void => {
  consoleStartState.serves = serves;
}, {immediate: true});
/**
 * THE FIRST ACTION'S RAIL HALF IS HELD (seeded in the transport's apply block, TR81): the stage plays it — each
 * printed TR plate of the corporation births its token into the score cell, then the table's answer comes out of
 * the seat (the reactor rises in its place, its tokens born on its effect row land in its own capsule).
 */
watch(() => firstActionRailState.phase, (phase: string): void => {
  if (phase === 'seeded') {
    void nextTick(() => {
      void runFirstActionRail();
    });
  }
});
/** The «Эффекты» layer lives only on the standing briefing — the press, the turn passing, the leave fold it at once. */
watch(() => startForecastCanOpen.value, (can: boolean): void => {
  if (!can) {
    foldForecastHost('start');
  }
});
/** The tender deck rises at the body's corner (measured on its rise — the body may have changed since). */
watch(() => tenderDeckUp.value, (up: boolean) => {
  if (up) {
    placeTenderDeck();
  }
});
/**
 * A REFUSED deal of candidates (the transport's battery cleared the opening, nothing arrived): the row has nothing to
 * stand for — it leaves, the page comes back, the tender stays held.
 */
watch(() => consoleStartState.restructureOpening, (now: string | undefined, was: string | undefined) => {
  const mode = restructureMode.value;
  if (now === undefined && was !== undefined && mode !== undefined && mode.instance === was && mode.offer.length === 0) {
    const live = (wizardInput.value?.tenders ?? []).find((t) => t.instance === was);
    if (live?.offer === undefined) {
      state.tenderMode = undefined;
      tenderDealArmed.value = false;
      leaveRestructureLayer();
    }
  }
});
/** A tender answer that came back with no deal to follow lets the tender deck go. */
watch(() => consoleStartState.tenderBusy, (now: string | undefined) => {
  if (now === undefined && tenderDealArmed.value && !deal.value.state.active && !departureActive.value && restructArriving.value.size === 0) {
    flow.after(motionMs(400), 'the tender deck lets go (no deal followed the answer)', () => {
      if (state.tenderBusy === undefined && !deal.value.state.active && restructArriving.value.size === 0 && !dealLaunchTimer) {
        tenderDealArmed.value = false;
      }
    });
  }
});
/** The deal identity pins the wizard picks (module state survival). */
watch(() => wizardInput.value, (input: SelectInitialCardsModel | undefined) => {
  if (input !== undefined) {
    // READ BEFORE THE RESET: a redeal is a NEW deal identity and `ensureStartWizard` clears the module state —
    // the mode that asked for this answer and the restructuring that waits for its candidates included.
    const modeBefore = state.tenderMode;
    const openingBefore = state.restructureOpening;
    ensureStartWizard(
      props.playerView.id,
      initialCardsSignature(input),
      wizardSteps(input).map((step) => step.id),
    );
    // (`ensureStartWizard` clears the first-action stage with the rest
    // of the module state on a FRESH deal identity — a rematch cannot
    // inherit the previous game's stage.)
    // A tender's redeal served the same selection again: the picks that survived the deal come back, the busy
    // tender lets go; a restructuring whose candidates just arrived opens its step on the stage.
    restoreStartPicksAfterRedeal(input);
    state.tenderBusy = undefined;
    const tenders = input.tenders ?? [];
    // A redeal replaced cards whose departure held their slots: the holds of cards no longer dealt let go.
    const live = new Set(steps.value.flatMap((st) => st.input.cards.map((c) => `${st.id}|${c.name}`)));
    for (const key of [...returningNames.value]) {
      if (!live.has(key)) {
        returningNames.value.delete(key);
      }
    }
    // THE RESTRUCTURING's candidates arrived: the standing row receives them off the deck.
    if (openingBefore !== undefined) {
      const entry = tenders.find((t) => t.instance === openingBefore);
      state.restructureOpening = undefined;
      if (entry !== undefined && entry.offer !== undefined && entry.status === 'held') {
        const offer = entry.offer;
        // The row may not stand yet (the page still parking, or a new identity reset the mode): it stands now.
        if (state.tenderMode === undefined) {
          state.tenderMode = {kind: 'restructure', instance: entry.instance, offer: []};
        }
        void nextTick(() => void dealRestructureCandidates(entry.instance, offer));
      }
    }
    // A DEALT restructuring found standing with no mode (a reload): the decision is owed — its row comes back.
    if (!restructResumed.value && state.tenderMode === undefined && openingBefore === undefined && mode.value === 'wizard') {
      const owed = tenders.find((t) => t.id === 'restructuring' && t.status === 'held' && t.offer !== undefined);
      if (owed !== undefined && owed.offer !== undefined) {
        restructResumed.value = true;
        const offer = owed.offer;
        void nextTick(() => void openRestructureMode(owed.instance, offer));
      }
    }
    // A standing mode whose tender is executed (or gone) ends: a review's kept card becomes the step's PICK —
    // the player kept it because they wanted it (deselectable like any pick).
    const modeNow = modeBefore;
    if (modeNow !== undefined && !tenders.some((t) => t.instance === modeNow.instance && t.status === 'held')) {
      state.tenderMode = undefined;
      // The mode's cursor walked ITS rows (the request's tags, the restructuring's two groups) — the page's own
      // cursor comes back; a confirm / an exchange walked the page itself and keeps it (clamped to the deal).
      if (modeNow.kind === 'restructure') {
        leaveRestructureLayer();
      } else if (modeNow.kind === 'tag') {
        focusIdx.value = tagFocusReturn.value;
      }
      if (modeNow.kind === 'review' && modeNow.release.length > 0) {
        // The returned cards are gone from the deal — a pick that stood on one of them goes with it.
        const picksNow = picksForStep(picks.value, modeNow.pool);
        const kept = picksNow.filter((name) => !modeNow.release.includes(name));
        if (kept.length !== picksNow.length) {
          writePicks(modeNow.pool, kept);
        }
      }
      stampDockChip(modeNow.instance);
    }
    // A simple tender's effect LANDED on its step — the certificate's chip takes the stamp.
    const landing = tenderLanding.value;
    if (landing !== undefined && tenders.some((t) => t.instance === landing.instance && t.status !== 'held')) {
      tenderLanding.value = undefined;
      stampDockChip(landing.instance);
    }
  }
}, {immediate: true});
/**
 * The pressable ceremony set (the deferred corporation + the prelude rail,
 * incl. a drew-N winner joining it): pre-fetch each card's on-play rewards
 * while the player reads them, so the press arms the hero with its reward
 * beat ready. Non-gating — the fetch never delays a press (dedup'd by
 * `rewardFetched`).
 */
watch(() => playRewardKey.value, () => {
  prefetchPlayRewards();
}, {immediate: true});
/**
 * THE BRIEFING RE-ASKS WHEN THE STATE MOVES. The first-action preview is
 * fetched once, at stage entry — but the stage then STANDS, waiting for the
 * player, while preludes pay out and other seats act. Not `immediate`: the
 * stage entry owns the first ask.
 */
watch(() => startPreviewVersion.value, () => {
  const corp = state.firstAct.corp;
  if (corp !== undefined) {
    fetchFirstActionPreview(corp);
  }
});
/**
 * PUBLISH THE HAND STEP'S ZONE — `flush: 'post'`, never `pre`. A `pre`
 * watcher names a node this component has not rendered yet: the shell
 * resolves the teleport first, finds nothing, and Vue drops the hand to
 * `body` — a full-screen hand standing OUTSIDE the workspace, which is
 * precisely the artefact the step exists to remove. Retracted the moment
 * the step ends, so a stale selector can never teleport into a detached
 * node. (Same contract as `setWorkspaceStageSlot` in the hand.)
 */
watch(() => stepSlot.value, (selector: string) => {
  setWorkspaceFrameSlot('start', selector);
}, {immediate: true, flush: 'post'});
/** Step position (the panes swap under this): reseed focus, mark the
 *  step visited (its first-visit stagger never replays), refit. */
watch(() => railPos.value, () => {
  onFrameSettle();
});
/** Entering / leaving the summary pane settles the frame like a step
 *  change (the panes swap under the dock flights, never a remount). */
watch(() => onSummary.value, () => {
  onFrameSettle();
});
/** The page is the player's again: a deal that changed under the tender's layer is dealt now — only its new cards
 *  (`landedDealNames`), off the tender deck, after the glide of the ones that stayed (`launchDeal` waits for it). */
watch(() => pageCovered.value, (now: boolean) => {
  if (!now && dealOwed.value) {
    prepareDeal();
  }
});
/** Pre-flush: arm the deal HOLD before the new card set paints (the
 *  real cards mount hidden — zero first-frame flash). */
watch(() => dealSignature.value, () => {
  prepareDeal();
}, {immediate: true});
/** Grid↔row transition re-fits the single row (never per focus). */
watch(() => wizardGrid.value, () => {
  void nextTick(() => fitCardStrip());
});
/** A deal that GREW in place (a tender's +3 / +4, a redeal) re-fits before its new cards launch (`prepareDeal`
 *  waits 260 ms for exactly this — the measured destinations are the fitted ones). */
watch(() => stepEntries.value.length, () => {
  if (dealGlideArmed.value) {
    void playDealGlide();
  }
  void nextTick(() => {
    fitCardStrip();
    // THE GLIDE (§20) is played by the pre-flush half below — the cards that stay hide from this very frame.
  });
});
/** The rail's height is FIXED (the shared card-status token — the
 *  availability block is one row now), so this watch is only a settle
 *  re-measure kept for safety: the reasons ride the SERVER model and can
 *  land after the step is already on screen. A re-fit against the same
 *  geometry is a no-op by construction. */
watch(() => railShowsAvailability.value, () => {
  void nextTick(() => fitCardStrip());
});
/** The deal's end releases the rail's content hold (`railCommitted`) and
 *  settles the slots — re-fit once so the strip's measure is taken on the
 *  stable post-cinematic layout. (The rail itself is height-reserved for
 *  the whole step — `--held` hides CONTENT only, never the box — so this
 *  is a settle re-measure, not a size change.) */
watch(() => deal.value.state.active, (active: boolean) => {
  if (!active && tenderDealArmed.value && state.tenderBusy === undefined && restructArriving.value.size === 0) {
    tenderDealArmed.value = false;
  }
  if (!active) {
    void nextTick(() => fitCardStrip());
  }
});
/**
 * THE RESULT BEAT. `effectLostFor` is latched at the commit, but the word
 * belongs AFTER the card has physically arrived — the play animation is the
 * ordinary one and must not be talked over. So the beat waits for the hero
 * to settle, says one thing, and clears itself.
 */
watch(() => effectLostReady.value, (ready: boolean) => {
  if (!ready || effectLostShown.value) {
    return;
  }
  effectLostShown.value = true;
  effectLostTimer?.();
  effectLostTimer = flow.after(motionMs(EFFECT_LOST_BEAT_MS), 'the lost effect\'s beat clears itself', () => {
    effectLostTimer = undefined;
    effectLostShown.value = false;
    effectLostFor.value = undefined;
  });
});
watch(() => focusables.value, (now: Array<Focusable>) => {
  // Only clamp the CEREMONY focus cursor here — the wizard summary reuses
  // focusIdx over summaryCards (focusables is empty there), and this clamp
  // would otherwise snap it back to 0 on every re-eval.
  if (mode.value === 'ceremony' && focusIdx.value >= now.length) {
    focusIdx.value = Math.max(0, now.length - 1);
  }
});
/** The ceremony frame is ONE stable key now (in-place beats) — the focus
 *  cursor reseeds on each new BEAT here instead of the old frame remount. */
watch(() => ceremonyPromptKey.value, () => {
  if (mode.value === 'ceremony') {
    focusIdx.value = 0;
    clearRiskStage();
    void nextTick(() => scrollFocusedIntoView());
  }
});
/** Latch: THIS session staged the corporation's landing, so a played corp
 *  belongs to the «Разыграно» table (never a ghost twin on the scene). */
watch(() => corpPlayCard.value, (card: CardModel | undefined) => {
  if (card !== undefined) {
    sawCorpPlayPrompt.value = true;
  }
}, {immediate: true});
/** Dev signal for a genuinely stale pairing: the corporation is already
 *  played and no corporationPlay prompt ever arrived (a server older than
 *  this client). The UI degrades honestly (context card) — this names it. */
watch(() => corpPlayedWithoutPrompt.value, (now: boolean) => {
  if (now && process.env.NODE_ENV !== 'production' && !warnedCorpPrompt.value) {
    warnedCorpPrompt.value = true;
    console.warn('[console-start] the corporation is already played and no `corporationPlay` prompt arrived — ' +
      'showing it as context. If this is a fresh game, the SERVER is older than this client (restart / rebuild it).');
  }
}, {immediate: true});
/** Mirror the scene's live contract into the shell's command bar (the bar
 *  is the ONE hint surface — no inline duplicates anywhere in the scene). */
watch(() => footHints.value, (hints: Array<StartCommand>) => {
  setConsoleStartCommands(hints);
}, {immediate: true});
/**
 * SENT → WAITING. The submit was accepted but the deployment is not this
 * player's yet: the frozen snapshot (armed at the press for the
 * hand-over cinematic) must let go at once — the player is going to look
 * at this screen until the table finishes — and the flow leaves its
 * committing state so B (minimize) works again.
 */
watch(() => awaitingOthers.value, (now: boolean, was: boolean) => {
  if (now && !was) {
    disposeMaterializationFreeze(true);
    summaryArriving.value.clear();
    sentAwaiting.value = true;
    if (state.flow === 'committing') {
      state.flow = 'idle';
    }
    if (commitSafety !== undefined) {
      commitSafety();
      commitSafety = undefined;
    }
  }
});
/**
 * THE DEPLOYMENT LATCH. The server handing this player a start-sequence
 * prompt is the ONE honest signal that their deployment has begun — in a
 * multiplayer table it arrives only once EVERY player has confirmed, so
 * this is also what makes the hand-over simultaneous.
 */
watch(() => props.task, (task: ConsoleTask | undefined) => {
  // The corporation's first action is part of the deployment too — a
  // reload that lands straight on it (the wait / the live prompt) must
  // open the ceremony bounds, not the preparation.
  if ((task?.kind === 'startSequence' || task?.kind === 'corpFirstAction') &&
      !startDeploymentBegun()) {
    markStartDeploymentBegun();
  }
}, {immediate: true});
/**
 * The PREPARATION → DEPLOYMENT boundary. A commit in flight that flips
 * the mode runs GAME STATE MATERIALIZATION (the status preview transforms
 * into the Top HUD + Player Rail, the shell re-bounds, the deployment
 * reveals). Any other path into the ceremony (a reload mid-start, a
 * defer/restore) skips the episode and simply establishes the shell.
 */
watch(() => mode.value, (now: 'wizard' | 'ceremony', was?: 'wizard' | 'ceremony') => {
  // CAMPAIGN: the wizard is over (everyone confirmed while this player
  // was reading their legacy) — the overview dies with its mode, holds
  // cleared and the parked page restored INSTANTLY, BEFORE the
  // materialization measures the frame.
  if (now !== 'wizard' && legacyView.value.phase !== 'closed') {
    settleLegacyClosed(true);
  }
  if (now !== 'wizard' && tenderView.value.phase !== 'closed') {
    settleTenderViewClosed(true);
  }
  if (now === 'ceremony' && was === 'wizard' &&
      (state.flow === 'committing' || sentAwaiting.value)) {
    void runMaterialization();
    return;
  }
  if (now === 'ceremony') {
    // Any other path into the ceremony (a reload mid-start, a defer /
    // restore) skips the episode: the standard shell simply stands.
    shellUp.value = true;
    ceremonyRevealed.value = true;
    if (state.flow === 'committing' || state.flow === 'materializing') {
      state.flow = 'deploying';
    }
  } else {
    shellUp.value = false;
  }
  void nextTick(() => syncCeremonyLayout());
}, {immediate: true});
/** The workspace lets go ONLY when the deployment fully settles — its own
 *  calm release, never a prompt gap (the lifetime hold's other half).
 *  Immediate: a re-mount that lands on an already-settled deployment
 *  (un-defer after the last beat) releases right away. */
watch(() => deploymentSettled.value, (now: boolean) => {
  if (now) {
    void runSceneRelease();
  }
}, {immediate: true});
/**
 * THE EMBEDDED FOLLOW-UP lifecycle. The claim is armed at the play press
 * (actByName); when the server's reveal event actually presents in our
 * zone we mark it; when the reveal fully completes (cards taken, intake
 * landed — the event clears) the claim releases and the workspace
 * returns to the queue context. A claim that never produced anything is
 * dropped by its own 20 s backstop.
 */
watch(() => revealEventKey.value, (now: string, was: string) => {
  if (outcome.host !== 'start') {
    return;
  }
  if (now !== '' && was === '') {
    markWorkspaceOutcomePresenting();
    // THE SOURCE STAYS IN THE STEP — and it emerges only NOW: the reveal
    // event follows the hero's commit, so the source card is physically
    // lying in the dock (at the claim's press it was still in flight).
    // Through the funnel as the EFFECT's request: a seat already holding
    // the card (a stage's own draw) keeps its owner and nothing flies.
    if (outcome.sourceCard !== '') {
      void seatTake('effect', outcome.sourceCard as CardName);
    }
    return;
  }
  if (now === '' && was !== '') {
    // …unless the play still owes its «where?» after this draw (TRP9, PL-1117): the claim keeps the pick in our
    // zone; the reconciler releases it once answered.
    if (playOwesTargetPick(props.playerView.waitingFor)) {
      return;
    }
    releaseWorkspaceOutcome();
    // Back to the queue context: focus the next unresolved card.
    focusIdx.value = 0;
    void nextTick(() => scrollFocusedIntoView());
  }
});
/**
 * THE START EFFECT FLOW's beat advance — the ONE watcher that drives the
 * scene-side choreography of a draw-effect play (see startEffectBeat).
 */
watch(() => startEffectBeat.value, (now: 'idle' | 'staged' | 'depart' | 'landed' | 'failed', was: string) => {
  if (now === 'depart' && was === 'staged') {
    runQueueRelease();
    // ONE release, both layers: the deployment lets go as a whole, so the
    // step that follows opens into a genuinely empty room rather than into
    // the top half of one.
    runPlayedDockRelease();
  }
  if (now === 'landed' && !embedSourceLanded.value) {
    // THE ATOMIC HANDOFF at the effect-source seat: the hero flipped
    // `revealed` and paints the real column card under its proxy in this
    // same flush — release the hold, remember the card is physical.
    embedSourceArriving.value = false;
    embedSourceLanded.value = true;
    // …AND THIS IS THE EXECUTION BEAT, played out. The card has physically
    // left the queue, travelled and settled into the source seat — which
    // is exactly what the claim's beat gate is waiting to be told. Nobody
    // was telling it for a start-hosted outcome, so every draw and every
    // pick here sat out the full 2.6 s BEAT_SAFETY before its surface was
    // allowed to mount: a real beat followed by an arbitrary wait.
    markWorkspaceOutcomeBeatDone();
  }
  if (now === 'failed') {
    void abortStartEffectFlow();
  }
});
// ── THE BONUS-ACTION STAGE lifecycle ─────────────────────────────────
/**
 * ENTRY — a prelude granted bonus actions and everything it was doing has
 * finished: the briefing stands and announces the hand-off.
 *
 * A reload that lands mid-bonus restores through the same one path, and it
 * restores to `standing` rather than to `onboard` on purpose: the consent
 * latch lives in module state, which survives a COLLAPSE but not a page
 * load, and re-announcing the trip after a reload is honest — silently
 * dropping the player onto a board with no explanation is not.
 *
 * ⚠️ Deliberately NOT `immediate` — `onMounted` asks the same question.
 * See the first-action entry below for the failure this cost.
 */
watch(() => bonusActionEntryDue.value, (due: boolean) => {
  if (due) {
    void enterBonusActionStage();
  }
});
/**
 * EXIT — the last bonus action was spent. The stage closes, the chapter is
 * marked as walked (so the rail keeps it, completed), and the excursion
 * latch — which the shell owns — releases on the same signal, handing the
 * screen back to this workspace so the preparation visibly FINISHES here.
 *
 * Keyed on the OWED signal rather than on the stage, so a bonus action
 * that resolves while the player is on the board (the normal case — the
 * workspace is collapsed then) closes the stage just the same.
 */
/**
 * The rows changed (a claim answered / a new prompt): the latch opens and
 * the cursor comes home to the CTA — ALWAYS, not only when it fell off the
 * end. After a claim the remaining row slides into the slot the cursor is
 * standing on, so «press A again» would claim a gain the player never
 * pointed at; a deliberate second claim is one ArrowDown away.
 */
watch(() => stageGainKey.value, (): void => {
  gainClaimPending.value = false;
  stageCursor.value = undefined;
});
/**
 * FLY WHAT THE WINDOW OWES, the moment this frame can carry it.
 *
 * POST-flush, because the readiness terms include DOM the same flush is
 * bringing back («РАЗЫГРАНО» returning from its recede).
 *
 * ⚠️ Deliberately NOT `immediate`. The auto-resolve is seeded while this
 * scene is not mounted at all (the bonus window hands the whole screen to
 * the board), so its edge is the scene's own MOUNT — and an `immediate`
 * handler runs at SETUP, before there is any DOM to fly out of: the wave
 * measured nothing, degraded to «no flight», and consumed the very reward
 * it was there to show. `onMounted` asks the same question at the one
 * moment the answer can be true.
 */
watch(() => bonusGainWaveDue.value, (due: boolean): void => {
  if (due) {
    runBonusGainWave();
  }
});
watch(() => stagePanelUp.value, (up: boolean): void => {
  // A panel opens on its CTA — the verb the stage exists for; the gains
  // are an OPTION the player steps onto. Both edges just go HOME.
  stageCursor.value = undefined;
  if (!up) {
    gainClaimPending.value = false;
  }
});
watch(() => bonusActionsOwedNow.value, (owed: boolean): void => {
  if (owed) {
    state.bonusAct.source = bonusActionSourceCard.value;
    state.bonusActionSeen = true;
  }
  // The CLOSING edge is deliberately NOT handled here: the scene is
  // unmounted for the whole board window, so it could never see it. The
  // always-mounted shell owns that (`bonusActionLedgerOwed`).
});
// ── THE FIRST-ACTION STAGE lifecycle ─────────────────────────────────
/**
 * ENTRY — the deployment's cards are through and the corporation still
 * owes its opening move: the stage rises (the corp card out of
 * «Разыграно», the chrome receding behind it). A reload that lands
 * mid-first-action (the wait, or the live prompt) restores the standing
 * stage through the same one path — the emerge simply plays on the freshly
 * mounted dock, so the restore is physical too, never a re-run of anything
 * committed.
 *
 * ⚠️⚠️ THIS WATCHER MAY NOT BE `immediate`, and it WAS. The very case the
 * `immediate` was added for — a page opened with the prompt already live —
 * is the case where the initial truth is TRUE, so the handler ran during
 * setup: no root element, no played shelf to fly out of, no seat to fly into.
 * `runEmbedSourceEmerge` threw on the null root, the async entry rejected
 * between `stage = 'staging'` and `stage = 'standing'`, and the workspace
 * then stood on its «ПЕРВОЕ ДЕЙСТВИЕ» stage with an EMPTY BODY for the
 * rest of the session — the panel refuses to paint over an unseated corp
 * and the seat-missing self-heal only triggers from `standing`. The mount
 * edge is asked from `onMounted`, the one moment the answer can be acted
 * on (the same law the bonus-gain wave already documents below).
 */
watch(() => firstActionEntryDue.value, (due: boolean) => {
  if (due) {
    void enterFirstActionStage();
  }
});
/**
 * EXIT — the action's whole causal chain resolved (ledger drained, every
 * follow-up answered, every flight home): one leave, at the end.
 *
 * CONFIRMED OFF THE FLUSH, never on the edge itself. A response that ends
 * the prompt and a cinematic that starts because of it land in different
 * ticks: read the edge synchronously and the stage leaves in the gap, the
 * deployment settles behind it, and whatever the action produced then has
 * no workspace left to present in. Same contract as the placement
 * barrier's release — re-ask after a tick and a frame.
 */
watch(() => firstActionLeaveDue.value, (due: boolean) => {
  if (!due) {
    return;
  }
  const token = ++firstActionLeaveToken.value;
  void nextTick(() => {
    const confirm = () => {
      if (token === firstActionLeaveToken.value && firstActionLeaveDue.value) {
        void runFirstActionLeave();
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      // A RELEASE: the leave advances the stage's MODULE machine, so it is asked at the frame — or shortly when
      // none comes, or at once when the scene is gone (as the bare frame did on a scene that had left).
      void whenPainted(1, 50, flow).then(confirm);
    } else {
      confirm();
    }
  });
});
/**
 * A SECOND owed corporation (Merger) — the server re-raised the prompt
 * after the first action's chain resolved: re-stand the stage (the flow
 * never left it), and the seat hands over to the next corp.
 */
watch(() => firstActionOwedNow.value, (owed: boolean) => {
  if (owed) {
    restandFirstAction();
  }
});
/** …and the same re-stand off the QUIET edge — the second owed action can
 *  be re-raised while the first one's chain is still flying (a placement
 *  excursion), so whichever of the two flips LAST does the re-stand. */
watch(() => firstActionChainQuiet.value, (quiet: boolean) => {
  if (quiet) {
    restandFirstAction();
  }
});
watch(() => firstActionCorpNow.value, (corp: CardName | undefined) => {
  // THE NEXT CORPORATION TAKES THE SEAT ONLY WHEN THE LAST ONE'S CHAIN IS
  // QUIET. The server re-raises the prompt for the second owed corp in
  // the SAME response that accepts the first one's action (Inventrix's
  // draw needs no input), while that action's outcome — the drawn cards'
  // embedded reveal — is still presenting on the stage. Swapping here
  // pulled the reveal's source out from under it and stood the next
  // briefing over somebody else's cards; the quiet edge (`restandFirstAction`)
  // performs the swap once the chain has returned.
  if (corp !== undefined && state.firstAct.stage === 'standing' && state.firstAct.corp !== corp &&
      firstActionChainQuiet.value) {
    void swapFirstActionSeat(corp);
  }
});
/**
 * THE ROOM FOLLOWS THE STAGE. Immediate, because a RESTORE (the workspace
 * remounts after a collapse) must find the room already in its pose
 * rather than animate into it — see `syncStageRoom`.
 */
watch(() => stageOwnsRoom.value, (owns: boolean, was: boolean | undefined) => {
  syncStageRoom(owns, was === undefined);
}, {immediate: true});
/**
 * THE SUBMIT ROUND TRIP resolved (any response): release the latch. A
 * refusal leaves the prompt standing — the stage stays actionable and the
 * CTA re-arms; success moves the prompt on — the stage goes performing
 * and the action's own presentation (a claim, a pick, a placement) drives
 * from here.
 */
watch(() => props.playerView, () => {
  // The latch is the submit's own (R12): the answer ends it here, a refusal in the transport's battery, a silence at
  // its bounded safety.
  if (endFirstActSubmit(undefined, 'answered')) {
    // ACCEPTED = the seated corporation's option is GONE — even when the
    // marked prompt is still live for ANOTHER owed corporation (Merger:
    // the server re-raises it in the same response). Reading «the prompt
    // is gone» kept the stage `standing` on a corp whose move was already
    // taken, so the chain's quiet edge found no `performing` stage to
    // re-stand and the second corporation never got its seat.
    if ((state.firstAct.stage === 'standing' || state.firstAct.stage === 'staging') &&
        !firstActionActionable(props.playerView, state.firstAct.corp)) {
      state.firstAct.stage = 'performing';
    }
  }
});
/**
 * THE ROOM YIELDS WHEN THE STEP IS ACTUALLY THERE. The release is
 * guaranteed here, not only on the hero's `depart` beat — both halves are
 * latch-guarded, so this is a no-op when the beat already ran, but when
 * it did NOT (a claim that arrives without a hero flight, a beat that
 * skipped straight past `staged`) nothing ever receded, and the
 * deployment then had no return to play.
 *
 * Keyed on PRESENTING, never on the claim: a claim is placed at the
 * press and, inside the first-action stage, deliberately optimistically —
 * receding the room on it emptied the deployment for a draw that never
 * came.
 */
watch(() => embedPresenting.value, (now: boolean, was: boolean) => {
  if (now && !was) {
    runQueueRelease();
    runPlayedDockRelease();
  }
}, {flush: 'post'});
/** An unowned pick stands in this workspace — adopt it (see the computed).
 *  POST: the zone it is teleported into must already be rendered. */
watch(() => orphanStepSource.value, (source: CardName | undefined) => {
  if (source !== undefined) {
    adoptOrphanStep();
  }
}, {flush: 'post'});
/** The claim released (any exit — the take finished, the backstop, the
 *  unmount): the main scene RETURNS first, then the source card carries
 *  on into «Разыграно» (the second half of its interrupted journey). */
watch(() => embedActive.value, (now: boolean, was: boolean) => {
  if (!now && was) {
    void runStartEffectReturn();
  }
});
/** Withhold the bought project cards from the dock the instant the
 *  ceremony opens (so they are never in the hand before the player pays);
 *  they are shown face-up in the payment element and fly in on the pay
 *  confirm. Idempotent per deal (armDeliveryHold no-ops after the flight);
 *  survives defer + reload. */
watch(() => deliveryHoldSignature.value, (key: string) => {
  if (key !== '') {
    const names = [...ceremonyBoughtNames.value];
    startDeliveryNames.value = names;
    armDeliveryHold('bought', key, names);
  }
}, {immediate: true});
/**
 * SELF-HEAL: the stage STANDS but the seat is EMPTY. Every enumerated
 * entry path seats the corp itself, so this fires only for the orderings
 * nobody enumerated (a previous effect's settle emptying the seat AFTER
 * the stage stood). The panel refuses to render over an empty seat
 * (`firstActionPanelShown`), so this watcher is what turns that refusal
 * into recovery: re-run the handover phrase once per rising edge.
 * Loop-safe by construction — 'staging' makes the trigger false until
 * the emerge either seats the corp or degrades (which also seats it).
 */
/** CAMPAIGN: the legacy chapter latches the moment it becomes known — the
 *  journey rail may never shrink a chapter the player has seen. */
watch(() => legacyChapterExists.value, (now: boolean) => {
  if (now) {
    state.legacySeen = true;
  }
});
watch(() => firstActionSeatMissing.value, (now: boolean) => {
  if (!now) {
    return;
  }
  const corp = state.firstAct.corp;
  if (corp === undefined) {
    return;
  }
  state.firstAct.stage = 'staging';
  void (async () => {
    await seatTake('firstAction', corp);
    if (state.firstAct.stage === 'staging' && state.firstAct.corp === corp) {
      state.firstAct.stage = 'standing';
    }
  })();
});

onMounted(() => {
  absorbOff = registerInputAbsorber(START_PRESS_ABSORBER, () => pressBlockedNow.value !== undefined);
  // Every button, the d-pad too (`handleIntent` returns on ANY intent while the director moves) — a deal in flight is the
  // skip's, not a swallow.
  flowAbsorbOff = registerInputAbsorber(START_FLOW_ABSORBER, () => startFlowBusy() && !deal.value.state.active, {scope: 'all'});
  tenderAbsorbOff = registerInputAbsorber(TENDER_DOOR_ABSORBER, () => tenderDoorMoving.value, {scope: 'all'});
  nextTick(() => observeQueueBox());
  // THE START IS A REACTOR'S PLACE (PL-1098 — TR84 Titan Holdings answers its OWN play): a corporation the ceremony
  // carries (the queue → the shelf «РАЗЫГРАНО» → the seat «Источник») may be in no painted place at the very moment its
  // reaction rises — the solo colony step arrives in the same response and the seat is still being dealt in. The start
  // KNOWS the card is coming, so it holds the reactor: the rise waits (bounded) for the corporation's face to stand and
  // lifts it THERE; its tokens are born on that face's effect row and land in its own capsule. Never a second instance
  // at the stage while the card is about to stand in the start. (The registration is the page's — one start scene at a
  // time: `consoleStartSceneState.ts` retires the one before it.)
  // THE FACE THAT ROSE IS THE FACE THAT SETTLES (P82 · DB): the settle used to look the face up AGAIN — the card had
  // moved shelf → seat meanwhile, so another element (or none) settled and the lifted one stayed raised for good.
  const liftedFaces = new Map<CardName, HTMLElement>();
  standStartReactorPlace({
    id: 'start',
    // …unless its face lies BURIED on the shelf under another card: no honest place — the reactor rises at the stage.
    standsIn: (card) => startCarriesReactor(card) && !startReactorBuried(card),
    emergeTarget: async (card) => {
      const face = await startReactorFace(card, true);
      if (face !== undefined) {
        liftedFaces.set(card, face);
        await liftInPlace(face);
      }
    },
    settleTarget: async (card) => {
      const lifted = liftedFaces.get(card);
      liftedFaces.delete(card);
      const face = lifted?.isConnected === true ? lifted : await startReactorFace(card, false);
      if (face !== undefined) {
        await settleInPlace(face);
      }
    },
    emergedFaceEl: (card) => startVisibleFace(card),
  });
  // READ-ONLY e2e/diagnostics probe (the `__conColonyDiag` idiom): the
  // start flow's two conditional stages — the corporation's mandatory FIRST
  // ACTION and the bonus-action WINDOW — in one snapshot, with the ENTRY
  // PREDICATE BROKEN DOWN INTO ITS TERMS.
  //
  // Why a probe and not a nicer failure message: both stages are entered by
  // a watcher on a conjunction of a dozen live facts, and every one of them
  // reads «the stage never stood» from the outside. A spec that times out on
  // `.con-start__firstact` used to report the SYMPTOM and cost a bisect to
  // turn into a cause; dumping this names the false term instead. Never used
  // by product code.
  (window as unknown as Record<string, unknown>).__conStartDiag = () => ({
    mode: mode.value,
    flow: state.flow,
    ceremonyRevealed: ceremonyRevealed.value,
    firstAct: {
      stage: state.firstAct.stage,
      corp: state.firstAct.corp ?? null,
      submitting: state.firstAct.submitting,
      panelShown: firstActionPanelShown.value,
      seatMissing: firstActionSeatMissing.value,
      entryDue: firstActionEntryDue.value,
      owedNow: firstActionOwedNow.value,
      corpNow: firstActionCorpNow.value ?? null,
      nested: firstActionNested.value,
      actionableNow: firstActionActionableNow.value,
    },
    bonusAct: {
      stage: state.bonusAct.stage,
      entryDue: bonusActionEntryDue.value,
      windowDue: bonusWindowDue.value,
      owedNow: bonusActionOwedNow.value,
      panelShown: bonusActionPanelShown.value,
    },
    seat: {
      shown: embedSourceShown.value ?? null,
      incoming: embedSourceIncoming.value ?? null,
      owner: seatOwner.value ?? null,
      flight: seatFlight.value,
      presenting: embedPresenting.value,
      active: embedActive.value,
    },
    candidates: [...firstActionCandidates.value],
    // The BLOCKERS, in the order the entry predicate reads them — the first
    // `true` here is the answer to «why is the stage not standing».
    blockers: {
      otherPromptStands: startFlowOtherPromptStands(props.playerView),
      preludePrompt: startFlowPreludePrompt(props.playerView) !== undefined,
      yielded: props.yielded,
      nestedFrame: workspaceFrameHasNested('start'),
      sponsorPending: sponsorPending.value,
      effectReturnPending: effectReturnPending.value,
      corpPlayPrompt: corpPlayPrompt.value !== undefined,
      corpPayCost: corpPayCost.value !== undefined,
      candidatePrompt: candidatePrompt.value !== undefined,
      wizardInput: wizardInput.value !== undefined,
      heroActive: heroState.active,
      revealEvent: currentRevealEvent() !== undefined,
      handDelivery: isHandDeliveryActive(),
      deckDrawHolds: deckDrawHolds(),
      queueCards: queueCards.value.map((entry) => `${entry.kind}:${entry.name}`),
      queueArriving: queueArriving.value.size,
      payProjects: payProjects.value.length,
    },
    // What the scene SERVES and the latches a stuck beat would leave behind (the start watchdog prints all of it).
    serves: servesNow.value,
    flowStage: deploymentFlowStage.value,
    // EVERY term of `deploymentSettled` the blockers above do not already name — a deployment that will not settle
    // names its own holder (the field's «game → none» of 2026-10-31 showed every blocker free and the scene still up).
    settle: {
      settled: deploymentSettled.value,
      hold: state.hold,
      flow: state.flow,
      reaction: reactionStage.phase,
      embed: embedActive.value ? `${outcome.stage}:${outcome.sourceCard}` : '',
      firstOwed: firstActionOwedNow.value,
      bonusOwed: bonusActionsOwedNow.value,
      legacy: legacyPrompt.value !== undefined || legacyArrivalLive.value,
      deliveryHeld: handDeliveryState.held.length,
    },
    latches: {queueReleased: queueReleased.value, playedDockReleased: playedDockReleased.value, seatOwner: seatOwner.value ?? null},
  });
  // Campaign mode: the corporation stage relabels — «Штаб» for the final
  // mission's no-pick deployment of the accumulated trio. Missions 2–3 keep
  // «Корпорация» for the lineage base: the MERGE is its own deployment
  // chapter now (the `corporationMerge` press), never a relabel of the base.
  // A three-mission finale still DRAFTS its third corporation — that is an ordinary «Корпорация» pick, the
  // lineage merging by its own chapters; «Штаб» is the no-pick deployment only.
  const contract = props.playerView.game.gameOptions.campaign;
  const lineageLength = contract?.grants.find((g) => g.color === props.playerView.thisPlayer.color)?.corporations.length ?? 0;
  setStartCampaignCorpStage(contract === undefined ? undefined :
    (contract.final && !campaignFinalePicksCorporation(lineageLength) ? 'hq' : undefined));
  // THE «ФОРА» GAINS THIS WORKSPACE CAME BACK TO PAY. The window's
  // auto-resolve is seeded by the transport while this scene does not exist
  // (the bonus turn owns the whole screen), so its edge is THIS mount and no
  // change-watcher can carry it. Asked here, the shelf the chips come out of
  // is already rendered.
  runBonusGainWaveIfDue();
  // Announce our zone for THIS mount: a minimize→restore re-creates the
  // component while `stepSlot` never changes value, so the watcher has
  // nothing to fire on — and the zone would stand unannounced, leaving the
  // hosted step teleport-less in `.con-main`.
  setWorkspaceFrameSlot('start', stepSlot.value);
  // …and the OUTCOME zone the same way: an embedded step (the deck pick, the
  // reveal) whose claim survived the park comes back INTO this zone, and a
  // pick nobody owns (a reload) is adopted here — the zone exists from now.
  if (orphanStepSource.value !== undefined) {
    adoptOrphanStep();
  } else {
    restoreOutcomeStep();
  }
  // A FIRST-ACTION STAGE THAT WAS ALREADY STANDING comes back exactly as it
  // was: the corporation is in its seat and the room is away. The stage
  // machine survives in module state, so nothing re-enters — this only
  // re-establishes the SEAT (component-local, and its card is what the
  // briefing stands beside), without the emerge flight: that flight already
  // happened, and replaying it on every restore is a cinematic for a move
  // the player already watched.
  if (state.firstAct.stage === 'standing' || state.firstAct.stage === 'performing') {
    if (embedSourceShown.value === undefined && state.firstAct.corp !== undefined) {
      embedSourceShown.value = state.firstAct.corp;
      embedSourceArriving.value = false;
      embedSourceLanded.value = true;
    }
    // The stage owns the seat it came back to (a component-local fact the
    // remount re-derives from the module-state machine).
    if (embedSourceShown.value === state.firstAct.corp) {
      seatOwner.value = 'firstAction';
    }
    if (stageOwnsRoom.value && !roomPosed.value) {
      poseRoomReceded();
    }
  }
  // …AND A STAGE THAT IS DUE ON THIS VERY MOUNT ENTERS HERE. Both entry
  // watchers are deliberately not `immediate` (an immediate handler runs
  // during setup, before there is any DOM to fly out of — see their
  // doc-comments), so the INITIAL truth is the mount's to act on: a page
  // opened straight onto the corporation's mandatory first action, or onto a
  // prelude's bonus window, is exactly that case. A watcher cannot fire on
  // `true → true`, so without this the stage would never rise at all.
  void nextTick(() => {
    if (firstActionEntryDue.value) {
      void enterFirstActionStage();
    } else if (bonusActionEntryDue.value) {
      void enterBonusActionStage();
    }
  });
  void nextTick(() => {
    fitCardStrip();
    syncCeremonyLayout();
    registerStartDockLayer(dockLayer.value ?? undefined);
  });
  // (The hero's landing target — the compact played dock's reserved front
  // anchor — is registered by ConsoleStartPlayedDock itself on its mount.)
  // Foundation: VueUse-managed listeners (no raw add/removeEventListener).
  stopStripObs = useResizeObserver(root.value as HTMLElement, () => scheduleFit()).stop;
  // The BODY's own box moves when the scene's root does not — the dock below it grows (the tender chips, the legacy
  // row) and the strip's room shrinks with no event at the root; the fit against the old room overflowed the deal
  // under the dock (the box frame of 2026-11-08). The body is `v-show`, one element for the scene's whole life.
  stopBodyObs = useResizeObserver(body.value ?? undefined, () => scheduleFit()).stop;
  stopResize = useEventListener(window, 'resize', scheduleFit);
  // The legacy overview re-solves its shared zoom against the live body box
  // (never per focus — geometry only moves when the room does).
  stopLegacyResize = useResizeObserver(root.value as HTMLElement, () => {
    if (legacyViewCovers.value) {
      fitLegacyView();
    }
  }).stop;
});
onBeforeUnmount(() => {
  absorbOff?.();
  flowAbsorbOff?.();
  tenderAbsorbOff?.();
  releaseStartQueueBox();
  retireStartReactorPlace();
  delete (window as unknown as Record<string, unknown>).__conStartDiag;
  consoleStartState.serves = undefined;
  // The «Эффекты» layer is a level of THIS surface; the first action's rail half has nobody left to fly it.
  forecastPulseCall?.kill();
  closeEffectForecastLayer('start');
  releaseFirstActionRail('stage unmounted');
  // Every seat flight still in the air belongs to a component that is
  // going: its continuation must apply nothing (the machine lives in module
  // state and the remount re-poses the seat from it).
  seatFlight.value++;
  // The hold gate is MODULE state — it must not outlive the surface that
  // armed it (a live hold with nothing on screen would complete into a
  // component that no longer exists).
  clearRiskStage();
  document.body.classList.remove('con-start-ceremony');
  document.body.classList.remove('con-start-prep');
  disposeMaterializationFreeze(true);
  if (outcome.host === 'start') {
    releaseWorkspaceOutcome(); // an orphaned claim suppresses presenters
  }
  // A claim the funnel REFUSED to release (it serves a live prompt and the
  // frame is only PARKED — «свернуть») outlives this mount, and its zone
  // selector describes a node that dies HERE. Left published, the restore
  // patches the shell's `<Teleport>` (it stands BEFORE this scene in the
  // shell's template) against a zone not rendered yet: the target does not
  // resolve, the pick mounts in the shell's own flow UNDER this full-bleed
  // scene, and since the selector never changes again the teleport never
  // looks again — the deployment with no cards (the field blocker of
  // 2026-10-18). Retracted, the pick waits NOWHERE for the gap frame and
  // `onMounted` republishes the same selector, which is the change that makes
  // the teleport resolve it.
  if (outcome.host === 'start') {
    retractWorkspaceOutcomeSlot(playOutcomeZone('start') ?? '');
  }
  // Retract our zone HERE, never from the flow side: a stale selector
  // teleports the next surface into a detached node, and the unmount watcher
  // does not fire (Vue tears watchers down first).
  setWorkspaceFrameSlot('start', '');
  resetStartDockMotion();
  registerStartDockLayer(undefined);
  // A legacy overview dies with its scene: convoys disposed, holds cleared,
  // the parked page's inline transform dropped (a defer→restore remounts
  // at the page the player descended from — it must not come back at the
  // park's alpha 0).
  settleLegacyClosed(true);
  settleTenderViewClosed(true);
  stopLegacyResize?.();
  stopStripObs?.();
  stopBodyObs?.();
  stopResize?.();
  // The deal's launch, the re-verify fit, the commit's refusal safety and the lost effect's beat are timers of the
  // scene's own scope (`flow`) — taken back with it.
  completionTimeline?.kill();
  completionTimeline = undefined;
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
    state.flow = state.hold ? 'deploying' : 'idle';
  }
  deal.value.dispose();
  resetConsoleStartUi();
});
defineExpose({handleIntent, healStrand, releaseByDirector});
</script>
