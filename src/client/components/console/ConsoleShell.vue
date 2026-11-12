<template>
  <div class="con-root" :class="conRootClasses">
    <!-- P27: the strip is player IDENTITY + live turn STATUS only — the
         cards/actions counters live in the right home panel now, and the
         viewer's "your turn" reads from their own chip (no central pill). -->
    <ConsoleStatusStrip :playerView="playerView"
                        :waitingOnPlayers="waitingOnPlayers"
                        :epoch="playerView.runId"
                        :attentionPending="mandatoryChipAttention"
                        :ghostParam="stdpGhostParam" />

    <!-- P27: the central banner is reserved for MANDATORY / critical states
         (placement, awaited decisions) — never a plain "your turn". Enters/
         leaves in the same `con-plate` voice as the mandatory card beside it
         (this band's family transition) — a HUD-band surface never pops. -->
    <transition name="con-plate">
      <div v-if="bannerText !== ''" class="con-banner">
        <span class="con-banner__pulse" aria-hidden="true"></span>
        <span>{{ bannerText }}</span>
      </div>
    </transition>

    <!-- CTS: a DEFERRED task (B = inspect the board) docks as an amber chip.
         P15: the return verb is CONTEXT-AWARE (selection / draft / start
         setup / decision) — never a generic «return to game» while the
         player is already in the game. -->
    <!-- (The legacy amber "deferred" banner was UNIFIED into the mandatory
         prompt card below — one premium surface, its CTA relabels by state
         (Открыть / Вернуться к решению). No second visual style. -->

    <!-- (The centre-stage «СОБЫТИЯ В ОЧЕРЕДИ» banner is GONE: the pending
         count is secondary service information and must not out-shout the
         event it queues behind. It now renders as a quiet tail UNDER the
         notification stack itself — see NotificationLayer's console queue
         chip — visually bound to the surface whose backlog it describes.) -->

    <!-- MANDATORY ANNOUNCEMENT (consoleMandatoryGate): a mandatory ACTION (corp
         first action / forced hand pick / off-turn reaction / a must-open
         workspace flow like the between-generations draft) is ANNOUNCED here —
         not popped open — and the player opens it with A when they're ready.
         Its FIRST presentation waits for the card ON SCREEN to have been read
         (a 1.5 s beat — never for the queue, PL-290); once presented it is a STANDING
         state that later notifications may join but never hide or reset. A
         drawn-cards reveal is NOT announced — it flows straight through from
         its draw cinematic (never split from it). -->
    <transition name="con-plate">
      <ConsoleMandatoryAnnounce v-if="mandatoryAnnounceVisible"
                                :kicker="mandatoryAnnounceView.kicker"
                                :ask="mandatoryAnnounceView.ask"
                                :sourceCard="mandatoryAnnounceView.sourceCard"
                                :sourceResolution="mandatoryAnnounceView.sourceResolution"
                                :openLabel="mandatoryAnnounceView.openLabel"
                                :tone="mandatoryAnnounceView.tone"
                                :invitation="mandatoryAnnounceView.invitation"
                                :invitationWinnerName="mandatoryAnnounceView.invitationWinnerName" />
    </transition>

    <!-- THE DRAFT TRAY — the ONE persistent "selected cards area" of the
         draft (top-centre, ON the table, under the task modal): picked
         cards fly hero-style into it, the calm draftWait banner lives on
         it (the fork does NOT surface the server's optional re-pick), and
         the draft→research rise scene launches from it. Non-blocking; the
         board stays inspectable underneath. -->
    <transition name="con-layer">
      <ConsoleDraftTray v-if="draftTrayMounted"
                        :playerView="playerView"
                        :waiting="draftWaitActive" />
    </transition>

    <!-- «МАРС ТЕРРАФОРМИРОВАН» — the terraformed SCENE's title plate (TR70,
         `terraformedScene.ts`): the scene itself plays on the REAL planet —
         the surfaces recede by the root classes, the board section's camera
         comes in, the held scales let go on the stage — and this plate names
         it under the disc. The persistent state (the gold rail at 100 %, the
         final-generation marker) lives in the top HUD. -->
    <ConsoleTerraformedTitle />

    <!-- MarsBot «Разбор хода» — the console-native FULLSCREEN turn review.
         Renders the SAME botTurnReviewState as the desktop overlay (suppressed
         in console mode); B closes, X inspects the card, L3 shows on map —
         hinted only in the command bar. -->
    <ConsoleBotTurnReview :players="playerView.players" />

    <!-- Milestone coronation / award seal — the cinematic post-confirm beat
         (pointer-events: none, bounded lifetime; fired only when the fresh
         playerView proves the viewer's OWN claim/fund resolved). -->
    <ConsoleMaCeremony />

    <!-- P29: --journal keeps the context panel's LAYOUT slot (the board
         never reflows) but hides its paint — the journal REPLACES it, the
         panel can't bleed through the journal surface. -->
    <!-- `--hand`: while the hand section is open, .con-main drops its z-index:1
         stacking trap so the hand's status rail (z11711) competes at the ROOT
         level and paints ABOVE the reveal flight stage (11645) + the dock
         furniture — flights dive BEHIND the rail, never over its text. -->
    <!-- `--info`: the INFORMATION WORKSPACE (Y) lives INSIDE .con-main (an
         absolute child right of the rail) — the z-index:1 trap drops so the
         workspace (11560) and the elevated rail (11561) compete at the ROOT
         level, above every band surface and the workspace's own dim. Held
         through the dismiss transition (infoModeState.closing) or a band
         surface would pop OVER the fading panel. The `con-insp-*` accent
         class publishes the inspected player's color tokens to BOTH sides
         of the rail↔workspace seam. -->
    <div class="con-main" :class="conMainClasses" ref="conMainEl">
      <!-- The rail is the Information Workspace's SUMMARY half: while the
           mode is open its player context is OVERRIDDEN to the inspected
           player (ONE source: infoModeState.playerColor) — TR / VP /
           resources / production / tags all re-read there. Read-only: the
           override never touches gameplay state or submissions. -->
      <!-- (The ДОП.РЕСУРСЫ aux satellite is never HIDDEN by a workspace — it
           simply keeps its board-level z and is covered where a panel reaches
           it; only the rail panel itself is lifted above the shade. The prop
           gates the section/info states it always did.) -->
      <ConsoleResourcePanel ref="conRailEl"
                            :player="railPlayer" :epoch="playerView.runId"
                            :gameTags="playerView.game.tags"
                            :convertPlants="convertPlantsReady && railShowsSelf" :convertHeat="convertHeatReady && convertHeatFutile === undefined && railShowsSelf"
                            :boardVisible="consoleState.section === 'board' && !infoModeState.open && !startSceneVisible"
                            :own="railShowsSelf"
                            :trVeto="railTrVeto"
                            :trPristar="railPristarMark"
                            :trSkip="railRatingSkipMark"
                            :vpHidden="railVpHidden"
                            :automa="railAutoma"
                            :botCtx="botExtrasCtx"
                            @aux-press="onAuxCellPressed" />
      <!-- v-show (NOT v-if): the board must stay in the DOM — the headless
           SelectSpace attaches placement handlers to its cells. -->
      <!-- …and UNDER a standing workspace while its board PEEK is open (TR45 — L3 «Показать на поле» in the play
           composer): the workspace recedes by opacity over it, keeping its state (`boardPeek.ts`). -->
      <ConsoleBoardSection v-show="consoleState.section === 'board' || boardPeekUi.peek !== undefined"
                           :ref="surfaces.bind.boardSection"
                           :playerView="playerView"
                           :placementActive="placementActive"
                           :placementShape="placementShape"
                           :cellPreview="selectedCellPreview"
                           :legalSpaces="placementSpaceModel?.spaces ?? []"
                           :movePick="placementMoveLevelNow === 'source'"
                           :moveFrom="placementMoveFrom"
                           :inspecting="consoleState.inspecting" />
      <!-- THE BOARD PEEK's HUD (TR45): the SAME «why» strip the composer shows (`ConsoleCountedWhy`), standing over
           the board while the roll call lights its shares — «4 города» is four pulsing hexes and a lit chip at once. -->
      <transition name="con-boardpeek">
        <div v-if="boardPeekUi.shown && boardPeekUi.peek !== undefined" class="con-boardpeek" data-board-peek>
          <ConsoleCountedWhy :why="boardPeekUi.peek.why" :lit="boardPeekUi.lit" />
        </div>
      </transition>
      <!-- The right STRATEGY RAIL — the Milestones/Awards premium HUD, the
           LEFT rail's geometric twin (same width token). Always the board
           home's right edge; task overlays and workspaces stand OVER it. The
           board PEEK shows it too: the peeked board is the board home's
           layout, never a wider re-fit (PL-199, `boardPeek.ts`). -->
      <ConsoleStrategyRail ref="conStratEl"
                           :shown="consoleState.section === 'board' || boardPeekUi.peek !== undefined"
                           :replaced="strategyRailReplaced"
                           :milestones="hudMilestoneZone"
                           :awards="hudAwardZone"
                           :viewerColor="thisPlayer.color"
                           :epoch="playerView.runId"
                           :covered="strategyRailCovered"
                           @open="openSheet($event)" />
      <!-- The right CONTEXT dossier (placement / inspection / track) — a
           task-time OVERLAY pinned to the right edge (the journal's idiom):
           the board layout NEVER reflows for a mode change, so the planet
           fit + the planet-focus scene keep one constant geometry. -->
      <transition name="con-ctx">
        <ConsoleContextPanel v-if="consoleState.section === 'board' && contextOverlayMode !== undefined"
                             :mode="contextOverlayMode ?? 'cell'"
                             :info="selectedCellInfo"
                             :preview="selectedCellPreview"
                             :loading="cellInfoLoading"
                             :viewerColor="thisPlayer.color"
                             :players="playerView.players"
                             :placementKickerKey="placementKickerKey"
                             :placementTitle="placementTitle"
                             :placementShape="placementShape"
                             :conversion="plantConversion"
                             :aresTiles="game.gameOptions.expansions.ares === true"
                             :selectedLegal="selectedCellLegal"
                             :illegalReason="selectedCellIllegalReason"
                             :flowPhase="placementFlowState.phase"
                             :inspectAll="consoleState.freeRoam"
                             :sourceView="placementSourceView"
                             :chosenTarget="placementChosenTarget"
                             :stagedPlate="placementStagedPlate"
                             :trackInfo="trackInfo"
                             :trackScale="trackScaleOverview"
                             :lore="selectedCellLore"
                             :finale="finalePanel" />
      </transition>
      <!-- The console-NATIVE journal (View) — REPLACES the right info panel
           while open: an absolute overlay anchored to the right edge, wider
           than the panel and free to overlap the board. The board layout is
           NEVER reflowed or rescaled for it (the context panel stays in the
           flex flow underneath). Board home only; owns the pad while open. -->
      <transition name="con-journal">
        <ConsoleJournalPanel v-if="journalPanelVisible"
                             :ref="surfaces.bind.journalPanel"
                             :playerView="playerView"
                             @close="closeJournal"
                             @notice="showNotice($event)"
                             @inspect-colony="openJournalColonyInspect($event)" />
      </transition>
      <!-- EMBEDDED HOSTING — «Эпатажный спонсор» (consoleStartSponsor.ts).
           A prelude whose effect is «play a card from your hand» must NOT
           throw the player out of the Game Start Workspace they are standing
           in: the very same hand instance is TELEPORTED into that workspace's
           embed zone and wears its shell (`:embedded`), exactly the pattern
           the reveal / task host / play composer already use. One instance,
           one input path, one set of captures — never a second copy and
           never a picker standing in for the player's real hand. -->
      <ConsoleTeleport :to="handEmbedTarget ?? 'body'" :disabled="handEmbedTarget === undefined">
      <!-- v-show (NOT v-if) while a HYDRO frame stands over the hand (the
           espionage target pick / execution): the two sections are flex
           siblings of ONE row, so the covered hand yields the row — with its
           captures, its teleported composer and its state intact for the
           return. The flip is a plain repaint, never a leave/enter pair: the
           one hook this tag carries (`handLeaveHook`) releases at once unless
           the hand is ending WITH a step that was its whole screen (the staged
           vote) — then the workspace dissolves over the returning board as one
           surface instead of cutting from a full Parliament to the planet. -->
      <transition :css="false" @leave="handLeaveHook">
      <ConsoleHandSection v-if="workspaceFrameRenders('hand')"
                          v-show="!handCoveredByHydro"
                          :ref="surfaces.bind.handSection"
                          :embedded="handEmbedTarget !== undefined"
                          :entries="handEntries"
                          :index="consoleState.handIndex"
                          :saleActive="consoleState.sale.active"
                          :saleSelected="consoleState.sale.selected"
                          :saleMegacredits="thisPlayer.megacredits"
                          :payer="thisPlayer"
                          :salePatent="salePatentModel"
                          :select="handSelectProps"
                          :packetExtras="handPacketExtras"
                          :discarding="discardInOverlay"
                          :softReason="handSoftReason"
                          :turnWindowClosed="handTurnWindowClosed"
                          :tagFilters="handTagFilterOptions"
                          :activeTag="handActiveFilter"
                          :hiddenByFilter="handHiddenByFilter"
                          :cardPayouts="handCardPayouts"
                          :payIcon="discardMeta?.exchange?.icon ?? 'megacredits'"
                          :stagedCard="stagedHandCard"
                          :stage="handStage"
                          :stagePaused="pickBridgeActive"
                          :handPickOpen="handPickOverlays"
                          @pick-resumed="pickResumeFreeze = undefined"
                          :transitHold="handRevealState.holdSlots"
                          :filterBusy="handRevealState.filterActive"
                          :underScene="sceneOverHand || consoleRevealMode !== undefined" />
      </transition>
      </ConsoleTeleport>
      <!-- Surface-motion 'section': a workspace switch gets a light rise
           (no dim) — never the bare v-if pop it used to be. The wheel's
           «Торговля» slot hands off directionally into it. -->
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <!-- THE COLONY WORKSPACE — standalone section, OR an embedded STEP of
             another live workspace (a prelude's Build Colony, a played card's
             trade pick, a blue action's free trade): the very same instance is
             TELEPORTED into that workspace's zone and wears its shell
             (`:embedded`) — one instance, one input path, one set of captures
             (workspace-embed rules 1-4; `workspaceFrameRenders` covers the
             claim-to-slot gap frame). -->
        <ConsoleTeleport :to="colonySectionTarget ?? 'body'" :disabled="colonySectionTarget === undefined">
        <!-- `data-motion-surface` is part of what the `embedded` prop STRIPS
             (host-agnostic rule 1). Left on, the band-surface director gave a
             hosted STEP the standalone workspace-switch entrance — a full
             surface arrival played inside somebody else's zone, plus a shade
             owner dimming the board behind a full-bleed start cinematic. That
             is the «Colonies появляется резко» from inside «Старт партии»: the
             wrong grammar, not a missing one. Absent, the director's hooks
             pass straight through and the step's arrival is the workspace
             entry phrase the section itself speaks. -->
        <!-- (A STAGED COLONY's step — TR07 — stays MOUNTED for its host's dissolve: the hand leaves with the
             colonies inside it as ONE surface, so the section reads the latch of the zone and the pick it stood in
             until the hand's own leave releases it — `coloniesLeaving`.) -->
        <ConsoleColoniesSection v-if="workspaceFrameRenders('colonies') || coloniesLeaving"
                                :ref="surfaces.bind.coloniesSection"
                                :data-motion-surface="colonySectionTarget !== undefined ? undefined : 'section'"
                                :embedded="colonySectionTarget !== undefined"
                                :colonies="coloniesForRail"
                                :index="consoleState.colonyIndex"
                                :tradeable="tradeableColonyNames"
                                :tradeBlockReason="colonyTradeBlockReason"
                                :myTurn="myTurn"
                                :awaitingInput="awaitingInput"
                                :pick="coloniesLeaving ? colonyPickLatch : colonyPick"
                                :catalog="colonyRailIsCatalog"
                                :players="playerView.players"
                                :viewerColor="thisPlayer.color"
                                :dockedColony="tradeFleetState.dockedColonyName"
                                :grantColony="colonyGrantColony"
                                :tradeOffset="thisPlayer.colonyTradeOffset ?? 0"
                                :tradePaymentOptions="tradeColonyContext !== undefined ? tradeColonyContext.paymentOptions : []"
                                :tradeDisabledPayments="tradeColonyContext !== undefined ? tradeColonyContext.disabledPayments : []"
                                :thisPlayer="thisPlayer"
                                :playerId="playerView.id"
                                :statsView="playerView"
                                :viewVersion="`${playerView.game.gameAge}|${playerView.game.undoCount}`"
                                :docks="coloniesLeaving ? [] : colonyDocks"
                                @dock-confirm="onFleetDockConfirm($event)"
                                @dock-inspect="inspectFleetDock($event)"
                                @dock-flow-complete="onFleetDockFlowComplete($event)"
                                @trade-confirm="onColonyTradeComposerConfirm($event)"
                                @build-confirm="onColonyBuildConfirm($event)"
                                @flow-complete="onColonyFlowComplete"
                                @inspect-enter="onColonyInspectEnter()"
                             @pick-confirm="onColonyPickConfirm()" />
        </ConsoleTeleport>
      </transition>
      <!-- The console-NATIVE Hydronetwork screen (the full rework — the
           desktop overlay is no longer re-hosted here). One shared brain:
           hydroNetworkState + buildHydroModel; the shell keeps the pick
           sheet + the byte-identical submit batch. -->
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <!-- v-show (NOT v-if) while a nested full-scene step is out (the
             position-7 repeat browser): the plan, the flow record and every
             capture must survive the round trip, and the director recognizes
             the pick bridge so neither surface plays a leave/enter pair —
             the workspace's OWN handoff phrase carries the transition. -->
        <ConsoleHydroSection v-if="workspaceFrameRenders('hydro')"
                             v-show="!pickBridgeActive || hydroInstrumentOut || repeatPickHandoff"
                             :class="{'con-bridgefade': repeatPickHandoff && !hydroInstrumentOut}"
                             data-motion-surface="section"
                             :ref="surfaces.bind.hydroSection"
                             :playerView="playerView"
                             :actionAvailable="hydroActionAvailable"
                             :cacheKey="hydroCacheKey"
                             :followUpLive="hydroFollowUpLive"
                             :revealEmbedded="hydroRevealEmbedded"
                             :bonusOffer="hydroBonusOfferLive ? hydroBonusOfferRaw : undefined"
                             :ownsPrompt="hydroBonusOfferRaw !== undefined"
                             :cardOffer="hydroCardOffer"
                             :rewardOffer="hydroRewardOffer"
                             :espionageOffer="hydroEspionageOffer"
                             :blockadeOffer="hydroBlockadeOffer"
                             :blockadeExecution="hydroBlockadeExecution"
                             :hostHeadHidden="handCoveredByHydro"
                             @bonus-answer="submitHydroBonus($event)"
                             @card-advance="submitHydroCardAdvance($event)"
                             @pick="openHydroRepeatPick"
                             @notice="showNotice($event)"
                             @confirm="submitHydroAdvance($event)"
                             @collapse="collapseWorkspace()"
                             @result-done="finishHydroFlow()"
                             @reward-picked="onHydroRewardPicked($event)"
                             @espionage-picked="onHydroEspionagePicked($event)"
                             @blockade-picked="onHydroBlockadePicked($event)"
                             @close="onHydroClose()" />
      </transition>
      <!-- The console-native PARLIAMENT screen (Turmoil Redux): the vote, the
           party effects and actions, the Agenda. Presence is the stack's
           (`workspaceFrameRenders`); the section publishes its command
           contract into `consoleParliamentUi` and submits byte-identical
           responses through the ONE transport funnel. -->
      <!-- THE PARLIAMENT LEAVES ALIVE («Заседание v3», В1): the section stays MOUNTED for its whole leave
           (`parliamentMounted` = the stack's presence OR the leave in flight), so the surface that
           dissolves is the one that stood — a section unmounted at the frame's close lost its TELEPORTED
           objects on the spot (the ruler's tile out of the government, the vote layer's cards) while its
           retained DOM played a 170 ms leave over the holes. The leave is driven EXPLICITLY by the watcher
           (`surfaceLeaveHook` on the live element — the director's own section dissolve), never by a
           `v-if`/`v-show` race whose semantics decide whether anything animates at all; the section
           latches its last coherent view on the `leaving` prop and reads nothing live until it unmounts. -->
      <!-- HOSTED AS A STEP (the Redux Venus's delegate grant — the Parliament's
           vote step standing INSIDE the colonies that paid it): the SAME
           instance is teleported into the host's zone and wears its embedded
           dress (`embedded` strips the frame, the head, `con-ws` and the motion
           id — the colonies' own pattern, one screen above). One instance, one
           input path, one submit funnel — never a copy. -->
      <ConsoleTeleport :to="parliamentEmbedTeleportTo" :disabled="!parliamentEmbedActive">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook" @after-leave="onParliamentAfterLeave"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="onParliamentLeaveCancelled">
        <ConsoleParliamentSection v-if="parliamentMounted"
                                  :data-motion-surface="parliamentEmbedActive ? undefined : 'section'"
                                  :ref="surfaces.bind.parliamentSection"
                                  :playerView="playerView"
                                  :leaving="parliamentLeaving"
                                  :warm="parliamentWarm"
                                  :embedded="parliamentEmbedActive"
                                  :myTurn="myTurn"
                                  :awaitingInput="awaitingInput"
                                  :stagedVote="parliamentStagedVote"
                                  :stagedReceipt="parliamentStagedReceipt"
                                  :stagedFlow="parliamentStagedFlow"
                                  @submit="submitParliament($event)"
                                  @staged-back="cancelStagedPlay()"
                                  @inspect-source="inspectParliamentSource($event)"
                                  @notice="showNotice($event)"
                                  @inspect="inspectParliament($event)"
                                  @open-action="openParliamentPartyAction($event)"
                                  @open-resolution-action="openParliamentResolutionAction($event)"
                                  @flow-complete="onParliamentFlowComplete($event)"
                                  @to-board="openParliamentBoardDoor()"
                                  @collapse="collapseWorkspace()"
                                  @close="leaveWorkspace()" />
      </transition>
      </ConsoleTeleport>

      <!-- THE ACTION WORKSPACE («Действия карт») — the console-native
           blue-card action center as an ABSOLUTE child of .con-main filling
           everything RIGHT of the player rail (the information-workspace
           seam geometry: left edge from --con-rail-w / --con-main-gap). The
           rail stays visible and LIT above the shared shade (the `con-ws`
           marker + `.con-root--ws-open` lift it for as long as the
           surface lives, leave transitions included) — the player's
           resources remain the on-screen context of every cost/gain read
           here, and the natural landing zone of the future post-confirm
           resource-flight sequence. Rides the shared `.con-shade` (no own
           backdrop). -->
      <!-- v-show while a client hand pick is out (SRR link pick): the Action
           Center + its composer stay mounted so every capture survives (the
           director recognizes the pick bridge and never animates it). -->
      <!-- `cardActionsLeaveHook` is the director's own leave (`surfaceLeaveHook`) — and, when the workspace ends
           WITH a hosted Parliament step (TR15's staged action vote), the step rides that ONE motion (its release
           is handed to the end of it, never a second fade multiplying the first). -->
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="cardActionsLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <!-- COLLAPSE, not close: past the commit boundary B parks the whole
             stack, and the committed decision keeps living inside it — same
             revealed card, same picks, no replayed cinematic, no restarted
             server flow.
             ⚠️ The park is a SEPARATE stack, so presence already answers it:
             a parked frame is not in `frames`, so `workspaceFrameRenders`
             is false and this unmounts on its own. Hiding on the GLOBAL
             `workspaceCollapsed` here meant «somebody, somewhere is parked» —
             so opening ДЕЙСТВИЯ КАРТ by hand while the start selection was
             minimized rendered a live workspace with `display:none` over it:
             right command bar, blank screen. Opening the list to LOOK while
             another flow is parked is a supported intent (`collapsed` below
             is exactly what keeps it read-only). -->
        <!-- v-show while the client PICK BRIDGE hides it: the composer and every
             capture must survive that round trip untouched.
             A card's Hydronetwork step is deliberately NOT in this list — that
             workspace does not leave, it YIELDS (`--yielded`): its body
             dissolves and its HEADER stays, so the crumb the player is reading
             is the same DOM node on both sides of the walk. Hiding it here is
             what made the header blink and shift. -->
        <ConsoleCardActions v-if="workspaceFrameRenders('card-actions')"
                            v-show="!pickBridgeActive || repeatPickHandoff"
                            :class="{'con-bridgefade': repeatPickHandoff}"
                            :ref="surfaces.bind.cardActions"
                            :playerView="playerView"
                            :collapsed="workspaceCollapsed"
                            :blockedReason="actionBlockedReason"
                            @blocked="showNotice"
                            @submit-batch="onCardActionsSubmitBatch"
                            @staged-placement="onCardActionsStagedPlacement"
                            @staged-vote="onCardActionsStagedVote"
                            @staged-law-play="onCardActionsStagedLawPlay"
                            @reveal-ack="onCardActionsRevealAck"
                            @flow-complete="onCardActionsFlowComplete"
                            @collapse="onCardActionsCollapse"
                            @colony-step="onCardActionsColonyStep"
                            @delta-step="onCardActionsDeltaStep"
                            @close="onCardActionsClose" />
      </transition>

      <!-- The "select an action to repeat" surface (ProjectInspection / Viron /
           Hydronetwork stage 7): the SAME ДЕЙСТВИЯ КАРТ workspace, reused in
           `repeat` mode (full dossier + filters + all actions with reasons).
           Mounted OVER the source composer (v-show hidden) while the pick is
           out; A = «Выбрать», the chosen action is composed here and RESOLVED
           back to the source via the bridge.
           A plain CSS fade, DELIBERATELY not the surface-motion hooks: the
           director's pick-bridge fork keys on the source composer's `v-show`
           pair, and a second 'card-actions' surface entering through the same
           hooks would classify as a self-handoff. The fade removes the hard
           cut (this was the one workspace-band plate mounting with no entry
           at all) without touching the bridge semantics.
           …and the fade is a CROSSFADE: while it plays, the surface being
           replaced stays painted underneath and fades out in place
           (`repeatPickHandoff` + `con-bridgefade`), so the band never drops
           to the bare shade and the header's root + carried card overlap
           their own text — one workspace advancing, not a full redraw. -->
      <transition name="con-layer" appear
                  @after-enter="onRepeatPickEntered" @enter-cancelled="onRepeatPickEntered">
        <!-- v-show (NOT v-if) while a nested full-scene step is out — the
             inner composer's Hydronetwork picks (the Dutch Mountains
             stage-reward claim, a plan's landing pre-select) push a `hydro`
             frame over this browser and take the whole scene
             (`frameSteps: 'scene'` on the repeat-pick registry row). The
             browser waits underneath with the inner composer and every
             capture intact; the resolve pops the frame and this re-shows.
             Without the hide the track mounted BEHIND this absolute band —
             «гидросеть на фоне как второй workspace». -->
        <ConsoleCardActions v-if="workspaceFrameRenders('repeat-pick')"
                            v-show="!repeatPickSceneOut"
                            repeat
                            :ref="surfaces.bind.repeatPick"
                            :playerView="playerView"
                            @close="onRepeatPickClose" />
      </transition>

      <!-- THE INFORMATION WORKSPACE (Y) — read-only dossier of the inspected
           player, an ABSOLUTE child of .con-main filling everything right of
           the rail between the two bars (fallback surfaces still render
           above at z12000+). Surface-motion: the frame materializes from /
           returns to the rail seam via the director; its own full dim stays
           (it opens OVER arbitrary band surfaces, above the shade).
           after-leave releases the `--info` stacking state (see conMainClasses). -->
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @after-leave="onInfoModeLeaveSettled"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleInfoMode v-if="infoModeState.open" :ref="surfaces.bind.infoMode" :playerView="playerView" :myTurn="myTurn" />
      </transition>
    </div>

    <!-- (The colony trade composer + the section's X-inspect dossier are GONE
         as standalone modals: both live INSIDE the colony workspace now — the
         COLONY FOCUS STAGE (ConsoleColonyFocusStage), a descend of the
         colonies section itself. See consoleColoniesModel.colonyFocusState.) -->

    <!-- Colony inspect — the READ-ONLY dossier a JOURNAL colony row opens
         (X on a colony chip). Journal-only: pinned to its one colony, pure
         history, B closes. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleColonyInspect v-if="colonyInspectModel !== undefined"
                            :ref="surfaces.bind.journalInspect"
                            :colony="colonyInspectModel"
                            :players="playerView.players"
                            :viewerColor="thisPlayer.color"
                            :playerId="playerView.id"
                            :tradeOffset="thisPlayer.colonyTradeOffset ?? 0"
                            hostRoot="Journal"
                            :readonly="true"
                            @cancel="closeColonyInspect()" />
    </transition>

    <!-- «Разыграно» (X from the board home) — the console-native played-cards
         TABLE: a workspace SCREEN in the central opening (the identity column
         + the shelf album, TR65). Surface-motion: the frame materializes in
         place like every workspace and its own dim fades with it; the HERO
         scene mounts without the entrance (its landing is measured). Closed
         automatically when a mandatory surface arrives (the journal's
         hard-block rule). -->
    <transition :css="false"
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsolePlayedOverlay v-if="playedTableVisible"
                            :ref="surfaces.bind.playedOverlay"
                            :players="playerView.players"
                            :thisPlayerColor="thisPlayer.color"
                            :automa="playerView.game.automa"
                            :heroIncoming="playedHeroIncoming"
                            :heroRevealed="playedHeroState.revealed"
                            :heroActive="playedHeroHolds"
                            @close="closePlayedOverlay" />
    </transition>

    <!-- The played-card hero STAGE — the fixed proxy layer of the "card
         lands on my tableau" scene. Mounted for the whole transaction so
         the flight survives the composer unmounting beneath it, and the
         leak detector counts it as the serving surface for the beat. -->
    <ConsolePlayedHeroLayer />

    <!-- (The MA full-text READER is gone: X → «Осмотреть» was the last trace
         of the modal era. Every item — available, blocked, already taken —
         opens INTO the workspace's own detail stage on A, so a second reading
         surface is a parallel path with nothing left to show.) -->

    <!-- THE SURFACE-MOTION SHADE (surfaceMotionState) — the ONE dim behind
         every migrated band surface. Always mounted; only its opacity moves,
         so a wheel → sheet → composer → reveal chain keeps one continuous
         darkness (never stacked dims, never a blink through zero). -->
    <!-- `--focus` deepens the vignette while a wheel slot is ARMED — the
         dimming is a transition instrument, not a static backdrop: open
         wheel → focused hold → (commit) the shade hands its darkness to the
         incoming surface, or releases toward a workspace. Opacity-only. -->
    <!-- THE SHARED DIM. Its BOX is the central opening (the four hull members
         stay lit — see `.con-shade` in console.less) — for EVERY owner: the
         card reveal, its one-time full-bleed exception, joined the opening in TR57. -->
    <div class="con-shade"
         :class="{
           'con-shade--on': surfaceShadeVisible,
           'con-shade--veil': surfaceShadeVeil,
           'con-shade--clear': surfaceShadeClear,
           'con-shade--focus': wheelInput.arm !== undefined,
         }" aria-hidden="true"></div>

    <!-- P27: the RT / LT QUICK SELECTORS — the direct-input command layers
         (RT = action categories, LT = basic actions). Surface-motion:
         mechanical wheel-open / wheel-dismiss / wheel-handoff (the chosen
         slot's impulse carries into the next surface). -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleQuickSelector v-if="consoleState.quick !== undefined"
                            :entries="quickEntries"
                            :title="quickTitle"
                            :trigger="quickTrigger"
                            :mode="wheelControl.mode"
                            :focusedSlot="wheelControl.mode === 'focus-confirm' ? wheelInput.focus : undefined"
                            :armedSlot="wheelInput.arm !== undefined ? wheelInput.arm.slot : undefined"
                            :armedBlocked="wheelInput.arm !== undefined && wheelInput.arm.blocked" />
    </transition>
    <!-- P26: milestones/awards render as the dedicated premium strategic
         panel; P27 adds the Standard-Projects premium screen (incl. Patent
         sale); every other bounded list keeps the generic bottom sheet.
         ONE surface-motion transition wraps the whole v-if chain: a swap
         between two sheets is a handoff (both sides choreographed); the
         MA screen and the generic sheet carry no data-motion-surface, so
         the hooks pass them through untouched (their own CSS entries play). -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleStdProjectsScreen v-if="workspaceFrameRenders('standard-projects')"
                                :ref="surfaces.bind.stdpScreen"
                                :items="stdProjectItems"
                                :index="consoleState.sheetIndex"
                                :myMegacredits="thisPlayer.megacredits"
                                :stepUp="stdpStepUp"
                                :backLabel="stdBackLabel"
                                :thisPlayer="thisPlayer"
                                :players="playerView.players"
                                :statsView="playerView" />
      <ConsoleMaScreen v-else-if="maScreenKind !== undefined"
                       :ref="surfaces.bind.maScreen"
                       :kind="maScreenKind"
                       :items="maScreenItems"
                       :index="consoleState.sheetIndex"
                       :myMegacredits="thisPlayer.megacredits"
                       :free="awardFundingActive && maScreenKind === 'awards'"
                       :focusView="maFocusView"
                       :focusInspect="maFocusInspect"
                       :focusAvailable="maFocusAvailable"
                       :focusBlockReason="maFocusBlockReason"
                       :sponsors="maAwardSponsors"
                       :priceWaiver="maScreenPriceWaiver"
                       :payView="maPayView"
                       :billNames="maBillNames"
                       :payFocusUnit="maPayFocusUnit"
                       @ceremony-done="onMaCeremonyDone"
                       @pick="onMaPick" />
      <!-- (The BLUE-CARD ACTION CENTER left this chain — it is the ACTION
           WORKSPACE now, an absolute child of .con-main right of the player
           rail; see the mount next to ConsoleInfoMode.) -->
      <ConsoleSheet v-else-if="consoleState.sheet !== undefined && consoleState.sheet !== 'cardActions'" :title="sheetTitle" :rows="sheetRows" :index="consoleState.sheetIndex" />
    </transition>

    <!-- The quick wheel's CONFIRM (pass / the heat conversion the table answers) — a plate of the prompt-modal
         family (`ConsoleActionConfirm`, PL-385) with the R3 «Эффекты» layer its «Сработает» row is the door of
         (PL-394). Surface-motion: rides the shared shade + the director — a wheel's slot hands off INTO this card
         (its medallion is the flight's landing anchor). -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleActionConfirm v-if="consoleState.confirm !== undefined"
                            :ref="surfaces.bind.actionConfirm"
                            :kind="consoleState.confirm"
                            :stepUp="pendingClientPick?.host === 'confirm'"
                            :effects="confirmEffects"
                            :forecast="confirmForecast"
                            :body="confirmBody"
                            :warnings="confirmWarnings"
                            :quiet="confirmQuiet"
                            :thisPlayer="thisPlayer"
                            :players="playerView.players"
                            :statsView="playerView" />
    </transition>

    <!-- Transient notice (unsupported verb, refusals). -->
    <transition name="con-notice">
      <div v-if="notice !== ''" class="con-notice">{{ $t(notice) }}</div>
    </transition>

    <!-- CTS T1–T3: the console-native task host (choice / player / amount /
         resource / distribute / card browser / payment lanes — plus the
         CLIENT-side standard-project payment via promptOverride). The
         desktop modal is SUPPRESSED while it serves; B defers a server
         task (inspect the board) and CANCELS a client payment. -->
    <!-- THE DRAFT WORKSPACE («ДРАФТ») — the between-generations draft and the
         research buy as ONE phase-anchored workspace flow (WORKSPACE_KINDS
         'draft'). Presence follows the stack (invariant 1) and nothing else.
         The frame is STOOD UP only by the player's A on the mandatory
         announcement (a pending FLOW action — draftMandatoryFlowBeat), and
         CLOSED by the `draftFrameLive` watcher's falling edge. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleDraftWorkspace v-if="draftWorkspaceMounted"
                             :ref="surfaces.bind.draftWs"
                             :playerView="playerView"
                             @submit="onDraftSubmit"
                             @defer="onDraftDefer" />
    </transition>

    <!-- THE EXTERNAL-DRAW WORKSPACE («ДОБОР КАРТЫ») — the mandatory take of
         cards another player's action drew for the viewer (WORKSPACE_KINDS
         'external-draw'). Stood up ONLY by the player's A on the mandatory
         announcement; CLOSED by the `externalDrawFrameLive` watcher's falling
         edge, which waits out the last take's flight (`externalDrawHolding`).
         Non-minimizable by construction: it emits no defer and B is «Забрать
         все». -->
    <ConsoleTeleport :to="externalDrawEmbedTarget ?? 'body'" :disabled="externalDrawEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleExternalDrawWorkspace v-if="externalDrawWorkspaceMounted"
                                      :ref="surfaces.bind.extDrawWs"
                                      :playerView="playerView"
                                      :embedded="externalDrawEmbedTarget !== undefined"
                                      @submit="onExternalDrawSubmit" />
      </transition>
    </ConsoleTeleport>

    <!-- EMBEDDED HOSTING (consoleWorkspaceOutcome): a card PICK the player's
         own workspace produced (Inventors' Guild / Business Network revealing
         a card to buy; Hi-Tech Lab keeping one of N) is the next stage of
         THAT flow, not a new demand — so the same host is teleported into the
         workspace's outcome slot instead of rising as its own band. Same
         instance, same submit path, same command contract. -->
    <ConsoleTeleport :to="taskEmbedTarget ?? 'body'" :disabled="taskEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <!-- !energyConversionState.active: the COMMIT HANDOFF of the optional
             energy→heat conversion (Supercapacitors). The moment the server's
             answer arms the rail transition the amount surface has nothing
             left to decide — it leaves (its leave rides the transition's
             lead-in), the shade lifts, and the existing rail animation plays
             on a fully readable rail. The old view (still holding this very
             prompt) stays committed through the await, so without this term
             the band would stand over its own result. Safe: the transition is
             a registered animation hold, so the leak detector stays quiet. -->
        <!-- A SERIES IS ONE VISIT (PC04 · GS): between answer k and question k + 1 of the same series the host STANDS on
             the answered question (`seriesHeldVisit` — inert, the pad absorbed), and the next one arrives in place. -->
        <ConsoleTaskHost v-if="(hostTask !== undefined && taskHostRendered) || seriesHeldVisit !== undefined"
                         :ref="surfaces.bind.taskHost"
                         :playerView="playerView"
                         :task="(hostTask ?? seriesHeldVisit?.task)!"
                         :embedded="taskEmbedTarget !== undefined"
                         :prompt-override="pendingClientPayment !== undefined ? pendingClientPayment.input : pendingClientPick?.input"
                         :held-prompt="hostTask === undefined ? seriesHeldVisit?.input : undefined"
                         :defer-label="pendingClientPayment !== undefined || pendingClientPick !== undefined ? 'Cancel' : 'Minimize'"
                         @submit="onTaskSubmit"
                         @submit-batch="onTaskSubmitBatch"
                         @defer="onTaskDefer"
                         @result-detached="onWorkspaceResultDetached"
                         @space-pick="onTaskSpacePick"
                         @hand-pick="onTaskHandPick" />
      </transition>
    </ConsoleTeleport>

    <!-- EFFECT DECISION — the ONE screen for a MARKED optional decision
         ("use the effect / pay the price / go and pick" vs a deliberate
         decline). It stands in for the generic task host exactly like the
         Government Support panel below, and ONLY when the pure adapter could
         represent the prompt honestly — otherwise the host keeps it.
         EMBEDDED when the player's own press raised it: a science tag played
         from the hand wakes «Марсианский университет», and that question is the
         NEXT STAGE of the play, not a window that arrived over it. Same
         instance teleported into the workspace's outcome zone, same submit
         path, same command contract. -->
    <ConsoleTeleport :to="effectDecisionEmbedTarget ?? 'body'" :disabled="effectDecisionEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <!-- …and a series is ONE visit here too (PC04 · GS): between two questions of one series the decision stands on
             the answered one (`seriesHeldDecision`), inert, until the next arrives in place. -->
        <ConsoleEffectDecision v-if="(effectDecisionVm !== undefined && effectDecisionRendered) || seriesHeldDecision !== undefined"
                               :ref="surfaces.bind.effectDecision"
                               :playerView="playerView"
                               :prompt-override="effectDecisionRendered ? undefined : seriesHeldDecision?.input"
                               :vm="(effectDecisionRendered ? effectDecisionVm : seriesHeldDecision?.vm)!"
                               :embedded="effectDecisionEmbedTarget !== undefined"
                               @submit="onTaskSubmit"
                               @defer="onTaskDefer"
                               @hand-pick="onTaskHandPick" />
      </transition>
    </ConsoleTeleport>

    <!-- FINAL GREENERY has no surface of its own: the finale is played ON THE BOARD (2026-10-14, PL-295) — the
         placement dossier carries its block (`finalePanel`), the bar its finish hold. See finalGreeneryModel.ts. -->

    <!-- Government Support (World Government Terraforming) — the dedicated
         premium 2×2 briefing panel (replaces the generic host for this ONE
         choice). Same submit / space-pick / defer contract as the host. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleGovernmentSupport v-if="govSupportActive && !govScaleFocusState.closing && !consoleState.task.deferred && taskSpacePending === undefined"
                                :ref="surfaces.bind.govSupport"
                                :playerView="playerView"
                                @submit="onTaskSubmit"
                                @defer="onTaskDefer"
                                @space-pick="onTaskSpacePick"
                                @gov-confirm="onGovSupportLeafConfirm" />
    </transition>

    <!-- DRAW & SELECT — «посмотри N карт колоды, оставь K» (Корпоративные
         архивы, Деловые контакты, Конкурс изобретений, Leavitt, the Delta
         science stage). Its own surface, not the generic card browser: these
         cards belong to nobody yet, so the flow owes a deck they come out of
         and a physical journey into the hand dock.
         EMBEDDED when the player's own workspace produced the draw — the SAME
         instance teleported into that workspace's outcome zone, so a prelude's
         effect deepens the start workspace instead of replacing it. -->
    <ConsoleTeleport :to="deckPickEmbedTarget ?? 'body'" :disabled="deckPickEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleDeckPick v-if="deckPickActive && !deckPickHeldForWorkspace"
                         :ref="surfaces.bind.deckPick"
                         :playerView="playerView"
                         :embedded="deckPickEmbedTarget !== undefined"
                         @submit="onTaskSubmit"
                         @submit-batch="onTaskSubmitBatch"
                         @defer="onTaskDefer" />
      </transition>
    </ConsoleTeleport>

    <!-- Production loss (Ares hazard-adjacency penalty) — the dedicated
         premium "reduce your production" surface (replaces the generic host
         distribute lanes for this ONE case). Same submit / defer contract. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleProductionLoss v-if="productionLossActive && !consoleState.task.deferred && taskSpacePending === undefined"
                             :ref="surfaces.bind.prodLoss"
                             :playerView="playerView"
                             @submit="onTaskSubmit"
                             @defer="onTaskDefer" />
    </transition>

    <!-- The three prompts that used to fall through to the DESKTOP modal
         inside the console shell. Same submit / defer contract as every other
         decision surface; each owns the pad while it serves. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleSpendHeat v-if="spendHeatActive"
                        :ref="surfaces.bind.spendHeat"
                        :playerView="playerView"
                        @submit="onTaskSubmit"
                        @defer="onTaskDefer" />
    </transition>
    <!-- THE VENUS BONUS IS A STEP OF ITS HOST (P89 · ledger EE — the owner's law of 2026-11-01): the alternative board's
         bonus the press's Venus step earned stands INSIDE the workspace the press was made in («ДЕЙСТВИЯ КАРТ ›
         <карта> › БОНУС ВЕНЕРЫ», the hand's play, the standard projects, the trade) — the same instance teleported into
         the host's zone; a band of its own only when no surface hosts it, and then after the board's story. -->
    <ConsoleTeleport :to="venusBonusEmbedTarget ?? 'body'" :disabled="venusBonusEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleVenusBonus v-if="venusBonusActive"
                           :ref="surfaces.bind.venusBonus"
                           :playerView="playerView"
                           :embedded="venusBonusEmbedTarget !== undefined"
                           @submit="onTaskSubmit"
                           @defer="onTaskDefer" />
      </transition>
    </ConsoleTeleport>
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleAresGlobals v-if="aresGlobalsActive"
                          :ref="surfaces.bind.aresGlobals"
                          :playerView="playerView"
                          @submit="onTaskSubmit"
                          @defer="onTaskDefer" />
    </transition>

    <!-- THE MARSBOT ATTACK — a hostile bot effect the player must answer.
         A compact modal, deliberately NOT a workspace: the player opened
         nothing, so there is no flow to descend into and nothing to come back
         to. It is announced first like every interruptive mandatory prompt
         (consoleMandatoryGate), so it can never appear over a workspace the
         player is working in — the chip carries the demand until they press A
         on the board home. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleBotAttack v-if="botAttackActive && botAttackVm !== undefined"
                        :ref="surfaces.bind.botAttack"
                        :playerView="playerView"
                        :vm="botAttackVm"
                        @submit="onTaskSubmit"
                        @defer="onTaskDefer" />
    </transition>

    <!-- CTS T5: the game-opening START SCENE (initialCards wizard /
         start-sequence ceremony) — the console-native replacement for
         both desktop start surfaces. B defers to the amber chip. -->
    <transition name="con-layer">
      <ConsoleStartScene v-if="startSceneMounted"
                         :yielded="!startSceneVisible"
                         :ref="surfaces.bind.startScene"
                         :playerView="playerView"
                         :waitingOnPlayers="waitingOnPlayers"
                         :task="startTask"
                         @submit="onTaskSubmit"
                         @submit-batch="onTaskSubmitBatch"
                         @defer="collapseWorkspace()" />
    </transition>

    <!-- THE FINAL SCORING WORKSPACE — the post-game phase root (Phase.END):
         the console-native scoring ceremony, the ranking, the winner beat and
         the post-game action list. A full-bleed scene over the frame; the
         command bar below stays live (skip → the action-list verbs).
         «Обзор партии» is the workspace's OWN internal analytics scene
         (ConsoleEndgameOverview) — the desktop results overlay never rises
         in console mode. B = «Свернуть» hides the workspace via v-show
         (state intact, a running ceremony paused) and opens the final board
         for inspection. -->
    <transition name="con-layer">
      <ConsoleEndgameWorkspace v-if="endgameWorkspaceMounted"
                               v-show="!endgameCollapsed"
                               :ref="surfaces.bind.endgameWs"
                               :playerView="playerView" />
    </transition>

    <!-- CTS T6: the reveal overlay (drawn cards ВЗЯТЬ / deck-check result /
         another player's public reveal) — the console-native replacement
         for the three desktop reveal modals (gated off in console). -->
    <!-- EMBEDDED HOSTING (consoleWorkspaceOutcome): when a workspace the
         player opened themselves has CLAIMED this batch, the very same
         instance is TELEPORTED into that workspace's outcome slot and wears
         its embedded dress — one mount point, one lifecycle, one command
         contract, one input path, in both homes. The surface-motion
         transition is bypassed while embedded: the workspace already owns the
         enter (the column is standing and the cards fly into it), and a band
         materialize on top of that would be a second, contradictory entrance.
         The motion hooks stay bound in BOTH homes and need no branch: the
         embedded root drops its `data-motion-surface`, and an absent id is
         exactly the director's documented pass-through. -->
    <ConsoleTeleport :to="revealEmbedTarget ?? 'body'" :disabled="revealEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <!-- THE SETTLEMENT TABLE (colony polish 1) keeps this instance mounted between two cycles of a
             multi-settlement payout — PARKED (no batch, no input, no commands) in the receded stage's zone while
             the hand owns the room — so the place that held the sealed card is the element that turns over. -->
        <ConsoleRevealOverlay v-if="revealOverlayMode !== undefined || settlementTableParked"
                              :ref="surfaces.bind.revealOverlay"
                              :playerView="playerView"
                              :mode="revealOverlayMode ?? 'drawn'"
                              :parked="revealOverlayMode === undefined"
                              :embedded="revealEmbedTarget !== undefined"
                              :sourceSeat="revealSourceSeatStands"
                              @dismiss-result="onDismissRevealResult"
                              @result-detached="onWorkspaceResultDetached"
                              @drawn-complete="onEmbeddedDrawnComplete"
                              @discard-pick="onRevealDiscardPick" />
      </transition>
    </ConsoleTeleport>

    <!-- CTS T0: the honest guard for a prompt NO surface serves (the
         leak detector's stranded check) — never a silent pill again. -->
    <transition name="con-layer">
      <ConsoleStrandedPrompt v-if="leakDetectorState.stranded !== undefined && !infoModeState.open"
                             :stranded="leakDetectorState.stranded" />
    </transition>

    <!-- SYSTEM ALERT: the pad-navigable replacement for App's native <dialog>
         alert (a server outage / rejected input froze the shell before, its
         OK button unreachable). Top of the intent chain — A/B dismiss. -->
    <transition name="con-layer">
      <ConsoleSystemAlert v-if="consoleSystemAlertState.current !== undefined" />
    </transition>

    <!-- The zoom dim VEIL — the ONE dim of the console fullscreen viewer
         (dialog.con-zoom's ::backdrop paints NOTHING — see the LESS). It
         fades in from the very first frame of the open (Vue enter
         transition), persists for the whole fullscreen lifetime, and fades
         out UNDER the close flight (`--lifted` on zoomClosing) — so the dim
         is gradual both ways and can never STACK with a backdrop or pop off
         while visible (the two failure modes of earlier designs: the
         one-step backdrop dim read abrupt/late; a veil UNDER a dimming
         backdrop blinked when removed). -->
    <transition name="con-zoom-veil">
      <div v-if="consoleCardZoom.card !== undefined"
           class="con-zoom-veil"
           :class="{'con-zoom-veil--lifted': zoomClosing}"
           aria-hidden="true"></div>
    </transition>
    <!-- Zoom OPEN flight (consoleZoomMotion.playZoomOpenFlight): the dialog
         below opens VANILLA at the flight's touchdown — its first top-layer
         frame is the final, fully-visible content (the compositor-safe shape;
         see the consoleZoomMotion.ts header). The premium FLIP lift flies
         THIS proxy on a normal fixed layer, like every other console flight
         (deal / exit / board-bonus). -->
    <div v-if="zoomOpenProxy !== undefined" class="con-zoom-flight-layer" aria-hidden="true">
      <!-- The GSAP-transformed element stays zoom-FREE (CSS zoom on the same
           element would rescale the translate coordinates); the landing zoom
           lives on the inner wrapper, whose zoomed layout box sizes the proxy. -->
      <div :ref="surfaces.bind.zoomFlightProxy" class="con-zoom-flight-proxy">
        <div class="con-zoom-flight-proxy__zoom" :style="{zoom: String(zoomOpenProxy.zoom)}">
          <CardZoomCard :card="zoomOpenProxy.card" :selected="zoomSelected" />
        </div>
      </div>
    </div>

    <!-- P13/P15: the global "X = fullscreen card" viewer - ONE reused
         CardZoomModal for every console card context (module state).
         P15 makes it CONTROLLER-NATIVE: the shell owns the pad while it is
         open (LB/RB browse, B/X close, A toggles the pick when the opener
         passed a select context), the desktop close button + touch arrows
         are replaced by the console command bar in the #actions slot, and
         the `con-zoom` class scopes that restyle to THIS instance only. -->
    <CardZoomModal v-if="consoleCardZoom.card !== undefined"
                   :ref="surfaces.bind.cardZoom"
                   class="con-zoom"
                   :class="[{'con-zoom--flight': zoomFlight, 'con-zoom--closing': zoomClosing, 'con-zoom--parliament': zoomResolutionId !== undefined, 'con-zoom--party': zoomPartyOpen}, zoomRejectedTagClasses]"
                   :card="consoleCardZoom.card"
                   :cards="consoleCardZoom.cards.length > 1 ? consoleCardZoom.cards : undefined"
                   :index="consoleCardZoom.index"
                   :selected="zoomSelected"
                   :dismissable="!consoleCardZoom.mandatory"
                   :closing="zoomClosing"
                   :consoleMotion="true"
                   :annotationsSuppressed="zoomSideVisible"
                   :navCounter="!consoleCardZoom.counterInFooter"
                   :flankMotion="zoomResolutionId !== undefined"
                   :lore="true"
                   @navigate="onCardZoomNavigate"
                   @close="onCardZoomClosed">
      <!-- A RESOLUTION's PARTY (Turmoil Redux) in the left gutter — the
           column a project card lends to its archive entry. One scene reads
           the resolution whole: its party (here), the card (centre), its own
           rules (right), where it stands and the viewer's access (the bar).
           Every column follows `consoleCardZoom.card`, so browsing LB/RB
           re-points all of them in the same flush — never a frame of the new
           card beside the previous party. -->
      <template v-if="zoomResolutionParty !== undefined" #aside="aside">
        <div class="con-zoom-asidecol">
          <ConsoleResolutionAside :ref="surfaces.bind.zoomAsidePanel"
                                  :party="zoomResolutionParty"
                                  :parliament="game.parliament"
                                  :viewer="thisPlayer.color"
                                  :canActNow="myTurn && awaitingInput"
                                  :contextKey="zoomResolutionContextKey"
                                  :support="zoomResolutionSupport"
                                  :tier="zoomResolutionTier"
                                  :nonce="aside.nonce"
                                  :closing="aside.closing" />
        </div>
      </template>
      <!-- TV rules panel (Этап 1-R2): the stable right-hand rules surface —
           the structured Card Information blocks beside the hero card. The
           floating callouts are suppressed while it shows (one place for
           details); cards with no structured rules render no panel and the
           fit reclaims the width.
           When opened as an INSPECT DOSSIER (X from the Action Browser) the
           panel becomes a two-tab ПРАВИЛА/СТАТИСТИКА box (LB/RB switch, handled
           in handleZoomIntent); every other inspect keeps the plain rules. -->
      <template v-if="zoomSideVisible" #side="side">
        <!-- ONE right COLUMN, ONE layout container — never two independently
             positioned boxes. It spans the WHOLE band the modal's midrow
             already measures (counter above, command bar below), so nothing
             here can reach under the footer, and it is TOP-ANCHORED: the
             column's upper edge is the same for every card, so browsing
             LB/RB never makes it jump.

             ORDER IS MEANING: «ДОСТУПНОСТЬ» leads, because the requirement
             bar sits at the TOP of the card — the player first reads whether
             it holds right now, then the full rules below. The two stay
             SEPARATE panels: availability is this game's state, rules are the
             card's permanent content. Priority under pressure: availability
             is never squeezed, the «§ ПРАВИЛА» head always stands, and only
             the rules BODY takes an internal scroll. -->
        <div class="con-zoom-sidecol">
          <!-- THE TARGET DOSSIER leads when the cards are TARGETS of a «where does it go» step (`playedTargetDossier.ts`):
               the card as a target — whose, what lies on it, what this move does to it — before its permanent rules. -->
          <ConsoleTargetDossierPanel v-if="zoomTargetDossier !== undefined"
                                     :dossier="zoomTargetDossier"
                                     :closing="side.closing" />
          <ConsoleCardAvailabilityPanel v-if="zoomAvailabilityView !== undefined && consoleCardZoom.inspect === undefined"
                                        variant="panel"
                                        :view="zoomAvailabilityView"
                                        :closing="side.closing" />
          <ConsolePartyAccessPanel v-if="zoomPartyAccess !== undefined"
                                   :party="zoomPartyAccess"
                                   :parliament="game.parliament"
                                   :viewer="thisPlayer.color"
                                   :closing="side.closing" />
          <ConsoleInspectSide v-if="consoleCardZoom.inspect !== undefined && zoomRulesCardName !== undefined"
                              :ref="surfaces.bind.zoomInspectSide"
                              :cardName="zoomRulesCardName"
                              :history="consoleCardZoom.inspect.history"
                              :tab="consoleCardZoom.inspectTab"
                              :nonce="side.nonce"
                              :closing="side.closing" />
          <!-- The MarsBot corporation's printed boxes — the SAME rules panel,
               fed the bot card's own groups (never the human original's). A
               HOLDING reads in the order given: its dividend leads. -->
          <!-- A campaign TENDER (the Committee's contract): its rule, its window and its buyout — the face prints no
               prose since its third pass, the column reads it like a project card's rules. -->
          <ConsoleCardRulesPanel v-else-if="zoomTenderAnnotations !== undefined"
                                 :ref="surfaces.bind.zoomRulesPanel"
                                 keepOrder
                                 :annotationsOverride="zoomTenderAnnotations"
                                 :nonce="side.nonce"
                                 :closing="side.closing" />
          <ConsoleCardRulesPanel v-else-if="zoomBotCorpAnnotations !== undefined"
                                 :ref="surfaces.bind.zoomRulesPanel"
                                 :annotationsOverride="zoomBotCorpAnnotations"
                                 :keepOrder="zoomBotCorpHolding"
                                 :nonce="side.nonce"
                                 :closing="side.closing">
            <!-- A further corporation's dividend reads LIVE under its printed rule: both goals' thresholds and progress, and the total. -->
            <template #group-extra="{group, tier}">
              <ConsoleBotDividendLedger v-if="zoomBotDividendReading !== undefined && group.id === zoomBotDividendGroupId"
                                        :reading="zoomBotDividendReading"
                                        :tier="tier"
                                        :final="game.phase === 'end'" />
            </template>
          </ConsoleCardRulesPanel>
          <!-- A parliament face (Turmoil Redux): a resolution's OWN rules
               (its effect in words, then the chairman quest's condition) or a
               party's reading — in the order they are given, which is the
               order the face prints them. The graphic stays on the card. -->
          <ConsoleCardRulesPanel v-else-if="zoomParliamentAnnotations !== undefined"
                                 :ref="surfaces.bind.zoomRulesPanel"
                                 keepOrder
                                 :tier="zoomResolutionTier"
                                 :annotationsOverride="zoomParliamentAnnotations"
                                 :nonce="side.nonce"
                                 :closing="side.closing" />
          <ConsoleCardRulesPanel v-else-if="zoomRulesCardName !== undefined && zoomHasRules"
                                 :ref="surfaces.bind.zoomRulesPanel"
                                 :cardName="zoomRulesCardName"
                                 :annotationsOverride="zoomCardForYouAnnotations"
                                 :suppressIds="zoomCoveredRequirements"
                                 :nonce="side.nonce"
                                 :closing="side.closing" />
        </div>
      </template>
      <template #actions>
        <!-- A read-only inspector (bot-turn / card-actions, opened from a chip)
             names itself, so the card never reads as an ordinary picked card. -->
        <div v-if="consoleCardZoom.contextLabel !== undefined" class="con-zoom__context">
          <span class="con-zoom__context-mark" aria-hidden="true">◈</span>
          <span>{{ $t(consoleCardZoom.contextLabel) }}</span>
        </div>
        <!-- P17: an UNPLAYABLE card is never mute — the same structured
             server reasons the hand verdict shows (desktop parity). When the
             AVAILABILITY PANEL is up it carries these very reasons in the
             side column, so the bar copy yields (never two voices at once). -->
        <div v-if="zoomReasons.length > 0 && zoomAvailabilityView === undefined" class="con-zoom__reasons">
          <span class="con-zoom__reasons-head"><span aria-hidden="true">✕</span> {{ $t('Unplayable now') }}</span>
          <div class="con-zoom__reason-list">
            <span v-for="(r, i) in zoomReasons" :key="i" class="con-zoom__reason">{{ r }}</span>
          </div>
        </div>
        <div class="con-zoom__bar">
          <!-- Парламент v8 (the owner's point 9): a RESOLUTION's dossier is its RULES — the viewer's own readings (the
               standing, the vote's facts, the estimate, the ledger, the party's answers, the winner's tile, the grant)
               are the VOTE's, read on the vote panel; the bar carries VERBS only. -->
          <!-- THE PROVENANCE PLATE (opened from «Разыграно»): the hero card
               would otherwise read like any other inspected card. The plate
               leads the bar and states WHOSE table it lies on, in WHICH
               printed zone and where in that zone — the seat's own colour
               runs through the dot and the plate's edge. For the Automa it
               also says the card was FLIPPED, never chosen. -->
          <span v-if="zoomProvenance !== undefined"
                class="con-zoom__prov"
                :class="['con-zoom-seat-' + zoomProvenance.seatColor, {'con-zoom__prov--bot': zoomProvenance.isBot}]">
            <span class="con-zoom__prov-seat">
              <span class="con-status__dot" :class="'player_bg_color_' + zoomProvenance.seatColor" aria-hidden="true"></span>
              <span class="con-zoom__prov-name">{{ zoomProvenance.seatName }}</span>
            </span>
            <span class="con-zoom__prov-sep" aria-hidden="true"></span>
            <span class="con-zoom__prov-kicker">{{ $t(zoomProvenance.isBot ? 'Flipped' : 'Played') }}</span>
            <span class="con-zoom__prov-cat">{{ $t(zoomProvenance.category) }}</span>
            <span v-if="zoomProvenance.ordinal !== undefined" class="con-zoom__prov-ord">
              <b>{{ zoomProvenance.ordinal.n }}</b><span aria-hidden="true">/</span>{{ zoomProvenance.ordinal.total }}
            </span>
          </span>
          <!-- The prominent ROLE status (single-card reveal): «ПОЛУЧЕННАЯ
               КАРТА» / «ИСТОЧНИК ДОБОРА» — the player always tells a received
               card from the draw source at a glance. -->
          <span v-if="zoomStatusLabel !== undefined"
                class="con-zoom__status"
                :class="zoomReceiveLabel === 'To the discard' ? 'con-zoom__status--discarded' :
                  zoomReceiveLabel !== undefined ? 'con-zoom__status--received' : 'con-zoom__status--source'">
            {{ $t(zoomStatusLabel) }}
          </span>
          <!-- WHY THIS CARD WAS THROWN AWAY (TR32 — a conditional search's discard pile): the tag it carries
               that the rule excludes (its printed medallion is struck on the face above, one class per tag),
               or the rule a positive filter applied. The server's own step, never a client guess. -->
          <span v-if="zoomDiscardVerdict !== undefined"
                class="con-zoom__verdict"
                data-zoom-discard-verdict
                :data-verdict-kind="zoomDiscardVerdict.kind"
                :data-verdict-tags="zoomDiscardVerdict.kind === 'tags' ? zoomDiscardVerdict.tags.join(',') : undefined">
            <template v-if="zoomDiscardVerdict.kind === 'tags'">
              <span class="con-zoom__verdict-label">{{ $t('Thrown away for its tag') }}</span>
              <span v-for="tag in zoomDiscardVerdict.tags" :key="tag" class="con-zoom__verdict-tag">
                <span class="con-dsearch__tag con-dsearch__tag--struck" :style="zoomVerdictTagStyle(tag)" aria-hidden="true"></span>
                <span class="con-zoom__verdict-name">{{ zoomVerdictTagName(tag) }}</span>
              </span>
            </template>
            <template v-else>
              <span class="con-zoom__verdict-label">{{ $t('Did not match the search') }}</span>
              <ConsoleDrawSearchRule :clauses="zoomDiscardVerdict.terms" size="line" />
            </template>
          </span>
          <!-- «ПОЛУЧЕНО N» — parity with the multi-card modal's header count. -->
          <span v-if="zoomReceivedCount > 0" class="con-zoom__count">
            <span class="con-zoom__count-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
            <span class="con-zoom__count-label">{{ $t('Received') }}</span>
            <b class="con-zoom__count-num">{{ zoomReceivedCount }}</b>
          </span>
          <span v-if="zoomSelected" class="con-zoom__state">✓ {{ $t('Card selected') }}</span>
          <!-- THE VOTE VERB (Turmoil Redux — the viewer opened from the vote
               mode): A sends a delegate to the card on screen through the vote
               mode's own submit. Under the verb, the SAME reading the mode's
               confirm uses: where the delegate leaves from and what it costs,
               or why it cannot go now. A blocked verb stays in place, calm,
               and A on it only nudges the reason — the viewer never closes on
               a vote that cannot be sent. -->
          <button v-if="zoomVoteVerb !== undefined"
                  class="con-zoom__btn con-zoom__vote"
                  :class="{'con-zoom__vote--blocked': !zoomVoteVerb.available}"
                  :aria-disabled="!zoomVoteVerb.available"
                  :data-vote-available="zoomVoteVerb.available ? 'yes' : 'no'"
                  :data-vote-source="zoomVoteVerb.source"
                  @click="zoomSendVote">
            <GamepadGlyph control="confirm" />
            <span class="con-zoom__vote-text">
              <!-- A STAGED card door: the press is the PLAY's commit — its one existing verb. -->
              <span class="con-zoom__vote-label">{{ $t(zoomVoteVerb.door === 'card' ? 'Play card' : 'Send the delegate') }}</span>
              <!-- ONE cell: the live reading and, invisible under it, the
                   reading of every other card the viewer pages through — the
                   verb is sized once for the whole context, so paging never
                   moves it or the controls beside it. -->
              <span class="con-zoom__vote-cell">
                <span v-for="line in zoomVoteDetailLines" :key="line.key"
                      class="con-zoom__vote-line"
                      :class="line.live ? ['con-zoom__vote-detail', {'con-zoom__vote-detail--nudge': zoomVoteNudge > 0}] : 'con-zoom__vote-line--sizer'"
                      :aria-hidden="line.live ? undefined : 'true'">
                  <!-- The card door's delegate is the CARD's (the mode's own source line, word for word);
                       its price was settled in the composer and is not this verb's to restate. -->
                  <span v-if="line.verb.door === 'card' && line.verb.gate !== 'rule'" class="con-zoom__vote-src">{{ $t('from the reserve · by the card') }}</span>
                  <template v-else-if="line.verb.source !== 'none' && line.verb.gate !== 'rule'">
                    <span class="con-zoom__vote-src">{{ $t(line.verb.source === 'reserve' ? 'from the reserve' : 'from the lobby') }}</span>
                    <span class="con-zoom__vote-sep" aria-hidden="true">·</span>
                    <span v-if="line.verb.cost > 0" class="con-zoom__vote-cost"><b>{{ line.verb.cost }}</b><i class="resource_icon resource_icon--megacredits con-zoom__vote-mc" aria-hidden="true"></i></span>
                    <span v-else class="con-zoom__vote-free">{{ $t('free') }}</span>
                  </template>
                  <template v-if="!line.verb.available">
                    <span v-if="(line.verb.source !== 'none' || line.verb.door === 'card') && line.verb.gate !== 'rule'" class="con-zoom__vote-sep" aria-hidden="true">·</span>
                    <span class="con-zoom__vote-reason">{{ line.verb.reason }}</span>
                  </template>
                </span>
              </span>
            </span>
          </button>
          <!-- The RECEIVE bridge (drawn-cards reveal) — A takes the on-screen
               card. Single-card departs from fullscreen; multi-card closes to
               the strip first. Absent on the read-only source view. -->
          <button v-if="zoomReceiveLabel !== undefined" class="con-zoom__btn con-zoom__btn--play" @click="zoomTakeReceived">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomReceiveLabel) }}</span>
          </button>
          <button v-else-if="zoomSelectable" class="con-zoom__btn con-zoom__btn--select" @click="zoomToggleSelect">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomSelected ? zoomDeselectLabel : zoomSelectLabel) }}</span>
          </button>
          <!-- P17: the context ACTION (play-from-hand parity) — A hands the
               card to the existing play flow; hidden when not actionable. -->
          <button v-else-if="zoomActionLabel !== undefined" class="con-zoom__btn con-zoom__btn--play" @click="zoomExecuteAction">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomActionLabel) }}</span>
          </button>
          <span v-if="zoomTakeAllLabel !== undefined" class="con-zoom__cmd">
            <GamepadGlyph control="triggerR" />
            <span>{{ $t(zoomTakeAllLabel) }}</span>
          </span>
          <!-- The L3 role swap (single-card reveal: received ⇄ source) — a
               compact chip naming the OTHER card (interactive card source). -->
          <span v-if="zoomSwapLabel !== undefined && zoomSwapOtherName !== undefined" class="con-zoom__swap">
            <GamepadGlyph control="stickL" />
            <span class="con-zoom__swap-label">{{ $t(zoomSwapLabel) }}</span>
            <span class="con-zoom__swap-sep" aria-hidden="true">·</span>
            <span class="con-zoom__swap-name">{{ $t(zoomSwapOtherName) }}</span>
          </span>
          <!-- A STATIC source chip for a non-inspectable source (tile / colony
               bonus) — the received card always names where it came from. -->
          <span v-else-if="zoomSourceInfo !== undefined" class="con-zoom__swap con-zoom__swap--static">
            <span class="con-zoom__swap-mark" aria-hidden="true">◈</span>
            <span class="con-zoom__swap-label">{{ $t(zoomSourceInfo.label) }}</span>
            <span class="con-zoom__swap-sep" aria-hidden="true">·</span>
            <span class="con-zoom__swap-name">{{ zoomSourceInfo.name }}</span>
          </span>
          <!-- R3 opens the conditional-search discard pile (single-card reveal
               only) — the fullscreen twin of the multi-card modal's R3. -->
          <span v-if="zoomDiscardsAvailable" class="con-zoom__cmd">
            <GamepadGlyph control="stickR" />
            <span>{{ $t('Discarded pile') }}</span>
          </span>
          <span v-if="consoleCardZoom.cards.length > 1" class="con-zoom__cmd con-zoom__cmd--flip">
            <GamepadGlyph control="bumperL" />
            <span class="con-zoom__flip-arrow" aria-hidden="true">◀</span>
            <!-- The position rides HERE when the viewer shows no counter plate
                 above the card (the Parliament's three proposals): the paging
                 hint and where the player stands in the list, one element. -->
            <span v-if="consoleCardZoom.counterInFooter" class="con-zoom__flip-pos" data-zoom-position>
              <b>{{ consoleCardZoom.index + 1 }}</b><span aria-hidden="true">/</span>{{ consoleCardZoom.cards.length }}
            </span>
            <span v-else>{{ $t('Browse') }}</span>
            <span class="con-zoom__flip-arrow" aria-hidden="true">▶</span>
            <GamepadGlyph control="bumperR" />
          </span>
          <!-- A MANDATORY viewer (single-card reveal) has NO close — the only
               completion is taking the received card. -->
          <button v-if="!consoleCardZoom.mandatory" class="con-zoom__btn" @click="closeZoomViewer">
            <GamepadGlyph control="back" />
            <span>{{ $t('Close') }}</span>
          </button>
        </div>
      </template>
    </CardZoomModal>

    <!-- The ONE exit/transfer flight stage (take / collect / hero-pick /
         hand→modal) — app-level so a flight survives its host surface
         closing mid-animation (cardExitDirector.ts). -->
    <ConsoleCardExitLayer />

    <!-- The dock ↔ hand-overlay REVEAL stage — the compact pack physically
         opens into the real hand grid and gathers back (one reversible
         timeline per episode; handRevealDirector.ts). UNDER the footer
         band: the dock/bar furniture occludes the flights per pixel, so a
         card slots in BEHIND the tray texture, never over it. -->
    <!-- SINGLE-OWNER HAND BODIES: every hand card is ONE persistent element
         here for its whole life — docked pack, flights, album shelf, page
         packets (handBodies.ts). The dock below renders only chassis. -->
    <!-- …and the bodies ARE the dock's cards, so they leave with it: the
         chassis already hides at Phase.END (`handDockVisible`) while this
         layer kept painting the pack at z 11645 — over a scoring scene that
         lives at 11480. `handBodyCards`, never `handDockCards`. -->
    <ConsoleHandRevealLayer :cards="handBodyCards" :held="dockHeld" :pose="handPackPose" />

    <!-- The STARTING-CARDS DELIVERY stage — the cards you paid for fly from
         the top-HUD project deck down into the hand dock bay
         (handDeliveryDirector.ts). Under the footer band, like the reveal
         stage: an arriving card dives BEHIND the tray plate/bar texture. -->
    <ConsoleHandDeliveryLayer />

    <!-- The PARLIAMENT's flight stage (Turmoil Redux): every cube and card the
         sitting director flies rides this body-level fixed layer, so a flight
         survives the section's transforms, its stage's clip and its unmount. -->
    <ConsoleParliamentFlightLayer />

    <!-- The colony-trade LAUNCH flight stage (send a trade fleet to the
         planet) — app-level so the ship survives the composer dissolving
         beneath it; docks on the target colony's berth, then the trade
         resolves (consoleTradeFleet.ts / tradeFleetDirector.ts). -->
    <ConsoleTradeFleetLayer />

    <!-- The colony-trade REWARD stage — after the fleet docks, the drawn
         cards physically leave the traded tile's «ТОРГОВАТЬ» / «БОНУС»
         cells into the single merged reveal, and the white track marker
         glides LEFT to its reset cell once every reward is confirmed
         (consoleColonyTrade.ts / colonyTradeDirector.ts). -->
    <ConsoleColonyTradeLayer />

    <!-- The hydronetwork MARKER-ADVANCE stage — a token glides along the rail
         to the new stop and locks in, then the advance resolves (calmer,
         engineering-flavoured; consoleHydroMarker.ts). -->
    <ConsoleHydroMarkerLayer />

    <!-- The board CARD-BONUS stage — the card-back bonus physically lifts
         off the placed cell, travels into the reveal space and flips into
         the real received cards (consoleBoardCardBonus.ts). -->
    <ConsoleBoardCardBonusLayer :player-view="playerView" />

    <!-- The DECK-DRAW stage — cards physically peel off the top-bar project
         deck, are judged one at a time against the server's own search
         record, and route to the discard tray or the hold zone; the reveal
         modal then assembles around the found cards
         (consoleDeckDraw.ts / deckDrawDirector.ts). -->
    <ConsoleDeckDrawLayer :player-view="playerView" />

    <!-- The DRAW & SELECT flight stage. App level for the same reason every
         other flight stage is: a fixed-position proxy inside a teleported
         surface resolves against whatever ancestor is animating. -->
    <ConsoleDeckPickLayer />

    <!-- The PATENT-SALE trade-terminal stage — the sold cards flip to their
         backs, sink into the terminal's slit, and the dispensed M€ chip
         arcs onto the resource rail; the commit lands at its touchdown
         (consolePatentSale.ts / patentSaleDirector.ts). -->
    <ConsolePatentSaleLayer />

    <!-- The CARD-DISCARD stage — the ONE "a card physically leaves the hand"
         cinematic every discard ends at (a card effect, a colony bonus, a
         global event, a CEO action): the chosen cards are seized out of the
         hand with the condemned rim, the hand hands off, and they turn to
         their backs across the throw onto the discard pile, whose count ticks
         on contact (consoleCardDiscard.ts / discardDirector.ts). -->
    <ConsoleCardDiscardLayer />
    <!-- «СБРОШЕННЫЕ» — the ONE discard pile of the table (TR52): the deck's twin hanging from the status strip,
         out while a discard is being told (a search's thrown-away cards, a card leaving the hand), in every host
         the same place (discardPile.ts). -->
    <ConsoleDiscardPile />

    <!-- The TILE-PLACEMENT HERO stage — the chosen tile physically flies
         from the table edge into the picked hex (thickness + tightening
         ground shadow + touchdown settle), then the cell's printed bonus
         icons rise through it and hand off to the resource chips
         (consoleTilePlacement.ts / tilePlacementDirector.ts). -->
    <ConsoleTilePlacementLayer />
    <!-- «ГОРОДА ПЛАТЯТ» (TR21): the cities beside a placed tile pay the card the play chose — shell level, beside the tile stage. -->
    <ConsoleCityPayoutLayer />
    <!-- «ШАГ ШКАЛЫ ПЛАТИТ» (TR24): a card that answers each step of a scale — its tokens condense on the marker. -->
    <ConsoleScaleStepRewardLayer />
    <!-- «СРАБАТЫВАНИЕ КАРТЫ» (TR80): the card whose printed effect fired surfaces at a seat beside the rail; its tokens
         are born on its effect row (cardReaction/cardReactionDirector.ts). -->
    <ConsoleCardReactionLayer />
    <!-- «ОБРАТНЫЙ ХОД» (TR47): the tags of a parameter swing — the fall's «−1 · РТ остаётся», a limit's «МАКС.». -->
    <ConsoleScaleSwingLayer />

    <!-- The MARS NOMADS MOVE stage — the camp module lifts off its cell
         (the contact shadow stays behind and lets go), hops to the adjacent
         hex on one tall carried arc, displaces the destination's printed
         bonuses, collects them through the shared resource chips and lets
         the field materialize them back
         (consoleNomadMove.ts / nomadMoveDirector.ts). -->
    <ConsoleNomadMoveLayer />

    <!-- The COLONY-BUILD HERO stage — the player's cube physically drops into
         the built colony's slot while the slot's one-time build bonus is
         lifted out of the cell (a resource glyph rises + hands off to the
         resource chips; a card lifts via the board-card-bonus cover), then the
         cube takes the vacated place
         (consoleColonyBuild.ts / colonyBuildDirector.ts). -->
    <ConsoleColonyBuildLayer />
    <!-- A CITY LANDS ON A COLONY TILE (TR22 Nova City) — the scene's fixed stage: one tile proxy, one cube. -->
    <ConsoleColonyCityLayer />

    <!-- The SHARED RESOURCE-TRANSFER stage — every "receiving resources"
         chip (the sale's M€ payout, a played card's reward beat, a placed
         cell's printed bonuses) flies here: real resource art + the amount,
         source → exact panel zone → delta chip
         (consoleResourceTransfer.ts / resourceTransferDirector). -->
    <ConsoleResourceTransferLayer />
    <!-- The one-play class's tokens (TR49): an armed effect spent into / armed out of the played card. -->
    <ConsoleArmedFlightLayer />

    <!-- The FOOTER — one composed band: the command bar with its centre BAY
         + the permanent HAND DOCK sitting in it. The dock is absolutely
         positioned at left:50% of this full-width wrapper (symmetric root
         padding) → mathematically the viewport centre, coaxial with the
         RT/LT quick cross (fixed inset:0 + flex centre). `--con-hd-bay`
         is written HERE from the model so the bar's grid track and the
         dock's plate can never disagree. -->
    <div class="con-footer" :class="{'con-footer--nodock': game.phase === 'end', 'con-footer--under-scene': footerUnderScene, 'con-footer--behind-workspace': dockBehindWorkspace}" :style="footerVars">
      <!-- THE DOCK IS A PHYSICAL PART OF THE BOTTOM BAR — its CARDS are hidden
           in two lifecycle windows (the endgame; and the pre-game INITIAL
           SETUP where no actual hand exists yet — see `handDockVisible`, so
           the «КАРТЫ 0/0» readout never lies), but the command bar KEEPS its
           reserved bay track through the whole in-game lifecycle (see the bar
           below) — only the dock's own cards `v-show` off. The player must
           always see how many cards they hold; the bar carries the command
           hints LEFT + RIGHT of the permanent centre bay. Surfaces interact
           with it by Z ONLY: tall
           bottom-reaching panels (the «Разыграно» table, composers, sheets,
           inspectors — `footerUnderScene`) drop the footer BELOW themselves
           so they cover the PACK where they overlap while the plate +
           counter keep peeking below their edge; the card-flow surfaces
           (start ceremony / task-host buys / the reveal modal — which is
           RAISED above the dock zone in CSS) keep the footer on top so
           cards visibly fly into a bright dock. The dock's per-card slots
           therefore stay laid out + measurable at all times WHILE VISIBLE —
           the hand-intake director can always land a card, and the counter
           only ticks on the physical touchdown. -->
      <!-- THE HAND DOCK PRESENCE CONTRACT (docs/claude/console/hand-dock-
           presence.md): once the dock appears after setup it stays to the end
           of the game — NEVER unmounted, NEVER v-show'n away by a screen. It
           is always the top layer of the section/band ladder; where a status
           rail or an embedded surface would collide it steps into the COMPACT
           pose instead of hiding, and while cards are physically arriving it
           always rises to FULL (the intake accent) whatever is open. -->
      <ConsoleHandDock v-show="handDockVisible"
                       ref="handDock"
                       :cards="handDockCards"
                       :playableCount="cardsPlayableCount"
                       :epoch="playerView.runId"
                       :interactive="handDockInteractive"
                       :raised="consoleState.quick === 'actions'"
                       :compact="handDockCompact"
                       :intake="dockIntakeAccent"
                       :transit="handRevealTransit"
                       :deliveryHeld="dockHeld"
                       :album="handDockAlbum"
                       :inspecting="infoModeState.open"
                       :inspection="dockInspection"
                       :armed="dockArmedEffects"
                       @mouseenter="dockHover = true"
                       @mouseleave="dockHover = false"
                       @open="onHandDockOpen"
                       @page="onDockPage" />
      <!-- The command bar keeps its BAY (centre track) for the whole in-game
           lifecycle — the bay-mode fit (planCommandRun drops/splits commands
           to the width) is what keeps the setup's 5-command run from clipping
           at TV 4K. Only the DOCK CARDS (the «КАРТЫ 0/0» readout) are hidden
           during the pre-game setup (handDockVisible); the reserved bay track
           stays, so the bar layout is identical to in-game. -->
      <ConsoleCommandBar :context="commandContext" :commands="commands" :bay="game.phase !== 'end'" />
    </div>

    <!-- THE GAME TRANSPORT (transport rework): the poll chain / submit
         funnel / cinematic gates / view apply live in the
         console/transport/gameTransport module; the binder below OWNS the
         transport lifecycle and renders the one legacy piece left — the
         top-level SelectSpace board binder (cell handlers + highlight). -->
    <div class="con-wf-host" aria-hidden="true">
      <console-board-binder v-if="game.phase !== 'end'"
                            :playerView="playerView"
                            :waitingfor="playerView.waitingFor"></console-board-binder>
      <console-board-input v-if="convertPlantsPrompt !== undefined"
                           :playerView="playerView"
                           :playerinput="convertPlantsPrompt"
                           :price="plantExchangePrice"
                           :onsave="onConvertPlantsSpacePicked" />
      <!-- Nested board pick from a task's space-type option (WGT ocean):
           the same board-input binder as convert-plants. -->
      <console-board-input v-if="taskSpacePrompt !== undefined"
                           :playerView="playerView"
                           :playerinput="taskSpacePrompt"
                           :price="finalGreeneryPickPending ? plantExchangePrice : undefined"
                           :onsave="onTaskSpacePicked" />
      <!-- STAGED PLAY (docs/TILE_PLAY_STAGED_COMMIT.md): the play's cell pick
           BEFORE the batch is submitted — the third client-side picker, fed a
           synthetic SelectSpace built from the preview's StagedPlacementModel.
           The confirm posts the parked batch (+ the space tail); B restores
           the composer with nothing ever sent. -->
      <console-board-input v-if="stagedPlayLevelPrompt !== undefined"
                           :playerView="playerView"
                           :playerinput="stagedPlayLevelPrompt"
                           :staged="placementStaged"
                           :onsave="onStagedPlaySpacePicked" />
    </div>

    <!-- Play-a-card flow — the console-native confirm (CTS T8: the
         re-hosted HandCardPaymentContent modal is retired). Preview +
         payment here; the on-play choices arrive as NATIVE follow-up
         tasks after confirm (the legacy-supported sequential contract).

         EMBEDDED HOSTING (consoleWorkspaceStack): when the player entered
         «КАРТЫ В РУКЕ» themselves and pressed A on a card, playing it is the
         NEXT STAGE of that flow, not a new demand — so the SAME instance is
         teleported into the hand workspace's stage zone instead of rising as
         its own band. Same captures, same payment, same submit path, same
         command contract. Entering from anywhere else (the fullscreen viewer
         on the board, a `playFromHand` task that opened the screen for us)
         keeps the standalone band: there is no workspace the player descended
         through, so there is nothing to be inside of.

         The surface-motion transition is BYPASSED while embedded — the
         workspace owns the entrance (the zone unfolds from the pressed card
         and the composer plays its own second reveal inside it), and a band
         materialize on top of that would be a second, contradictory
         entrance. The hooks stay bound in BOTH homes and need no branch: the
         embedded root drops its `data-motion-surface`, and an absent id is
         exactly the director's documented pass-through. -->
    <ConsoleTeleport :to="playEmbedTarget ?? 'body'" :disabled="playEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <!-- v-show (NOT v-if) while a client hand pick is out: the composer's
             captured choices/payment must survive the hand round-trip (the
             director recognizes the pick bridge and never animates it). -->
        <ConsolePlayCardConfirm v-if="pendingPlayCard !== undefined && !playHeldForWorkspace"
                                v-show="!pickBridgeActive || repeatPickHandoff || handPickPhrased"
                                :class="{'con-bridgefade': repeatPickHandoff}"
                                :ref="surfaces.bind.playConfirm"
                                :playerView="playedHeroComposerView() ?? playerView"
                                :cardName="pendingPlayCard.cardName"
                                :input="pendingPlayCard.input"
                                :passReading="passLeftBehind"
                                :embedded="playEmbedTarget !== undefined"
                                @confirm="onPlayCardConfirmNative($event)"
                                @cancel="onPlayCardCancel" />
      </transition>
    </ConsoleTeleport>

    <!-- (The repeat-pick ДЕЙСТВИЯ КАРТ surface moved INTO .con-main — the
         action workspace geometry next to the rail; see there.) -->

    <!-- The corporation's MANDATORY FIRST ACTION — the dedicated confirm
         modal (the play-composer's mandatory sibling). Presence is DERIVED
         from the corporationInitialAction prompt (never opened imperatively);
         B DEFERS to the amber chip, A submits the corp's OrOptions option. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleCorpFirstActionConfirm v-if="corpFirstActionOpen"
                                     :ref="surfaces.bind.corpFirstConfirm"
                                     :playerView="playerView"
                                     :corpNames="corpFirstActionNames"
                                     @confirm="onCorpFirstActionConfirm"
                                     @cancel="onCorpFirstActionDefer" />
    </transition>

  </div>
</template>

<script lang="ts">
/**
 * ConsoleShell — the console-first TV shell (docs/CONSOLE_MODE_CONCEPT.md;
 * feedback iteration 2 = the console COMMAND MODEL):
 *
 *  MAIN BOARD = the console home screen. Stable semantics from it (P27 —
 *  the COMMAND MODEL rework):
 *   Y  → Information Mode (read-only dashboard; was LT)
 *   RT → the ACTION-CATEGORY quick selector (A=Cards, ↑ Card actions,
 *        → Trading, ↓ Voting [reserved for Turmoil], ← Hydronetwork)
 *   LT → the BASIC-ACTIONS quick selector (A=Standard projects [incl.
 *        Patent sale], ↑ Skip turn, ↓ Pass [always confirmed],
 *        ← Plant conversion, → Heat conversion)
 *   LB → Milestones panel (badge = claimable count; viewable any time)
 *   RB → Awards panel (badge = fundable count; viewable any time)
 *   L3 → BOARD INSPECTION MODE (cells + global-parameter track bonuses;
 *        the cells are NOT part of the normal command loop — placement
 *        mode keeps its own automatic cell navigation)
 *   View → journal; B → calm (exits inspection → home; never destructive)
 *  Inside menus LB/RB are NOT globally reserved. B always returns toward the
 *  board; a mandatory placement B = cancel when the server marker allows,
 *  else an honest «Требуется выбор».
 *
 * Input claiming/fallback and the submission contracts are unchanged from
 * P0: everything ends in gameTransport.submitInput()/submitBatch() with payloads
 * byte-identical to the desktop dedicated buttons (turnIntents walkers).
 */
import {installCursorArrivalInput} from '@/client/console/cursorArrivalInput';
import {defineComponent, PropType, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';


import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {SpaceId} from '@/common/Types';

import ConsoleBoardBinder from '@/client/components/console/ConsoleBoardBinder.vue';
import {submitInput, submitBatch as transportSubmitBatch, SubmitTicket} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import ConsoleBoardInput from '@/client/components/console/ConsoleBoardInput.vue';

import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import ConsoleTerraformedTitle from '@/client/components/console/ConsoleTerraformedTitle.vue';
import {registerTerraformedSceneProbes, terraformedSceneState, terraformedSceneUp} from '@/client/console/terraformedScene/terraformedScene';
import ConsoleBotTurnReview from '@/client/components/console/ConsoleBotTurnReview.vue';
import {botTurnReviewState} from '@/client/components/marsbot/botTurnReviewState';
import {acquireForegroundLease, registerRevealParkSupplier} from '@/client/components/presentation/presentationFlow';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {waitGraphSnapshot} from '@/client/console/waitGraph/waitGraph';
import {ceilingStats} from '@/client/console/waitGraph/ceilingWait';
import {registerNotificationCornerProbe} from '@/client/components/notifications/notificationState';
import {cancelNotifHold, resetNotifHold} from '@/client/console/consoleNotifHold';
import {LiveNotification} from '@/client/components/notifications/notificationTypes';
import ConsoleCommandBar from '@/client/components/console/ConsoleCommandBar.vue';
import ConsoleHandDock from '@/client/components/console/ConsoleHandDock.vue';
import ConsoleSheet from '@/client/components/console/ConsoleSheet.vue';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import ConsoleMaCeremony from '@/client/components/console/ConsoleMaCeremony.vue';
import {maFocusState, openMaFocus, discardMaFocusDraft} from '@/client/console/consoleMaFocus';
import ConsoleQuickSelector from '@/client/components/console/ConsoleQuickSelector.vue';
import ConsoleStdProjectsScreen from '@/client/components/console/ConsoleStdProjectsScreen.vue';

import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
import ConsoleStrategyRail from '@/client/components/console/ConsoleStrategyRail.vue';
import {hideScaleTooltip} from '@/client/components/board/scaleTooltipState';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import ConsoleHandSection from '@/client/components/console/ConsoleHandSection.vue';
import {ConsoleHandSelectMode} from '@/client/components/console/consoleHandSectionTypes';
import ConsoleResourcePanel from '@/client/components/console/ConsoleResourcePanel.vue';
import ConsoleColoniesSection from '@/client/components/console/ConsoleColoniesSection.vue';
import ConsoleParliamentSection from '@/client/components/console/ConsoleParliamentSection.vue';
import {HostedParliamentStepKind} from '@/client/console/parliament/hostedParliamentStep';
import ConsoleResolutionAside from '@/client/components/console/parliament/ConsoleResolutionAside.vue';
import ConsolePartyAccessPanel from '@/client/components/console/parliament/ConsolePartyAccessPanel.vue';
import ConsoleInfoMode from '@/client/components/console/ConsoleInfoMode.vue';
import ConsoleStrandedPrompt from '@/client/components/console/ConsoleStrandedPrompt.vue';
import ConsoleSystemAlert from '@/client/components/console/ConsoleSystemAlert.vue';
import {consoleSystemAlertState} from '@/client/console/consoleSystemAlertState';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import ConsoleGovernmentSupport from '@/client/components/console/ConsoleGovernmentSupport.vue';
import ConsoleEffectDecision from '@/client/components/console/ConsoleEffectDecision.vue';
import {EffectDecisionAction} from '@/client/console/effectDecision/effectDecisionModel';
import {endFinaleSession} from '@/client/console/finalGreenery/finalGreenerySession';
import ConsoleProductionLoss from '@/client/components/console/ConsoleProductionLoss.vue';
import ConsoleDeckPick from '@/client/components/console/deckPick/ConsoleDeckPick.vue';
import ConsoleDeckPickLayer from '@/client/components/console/deckPick/ConsoleDeckPickLayer.vue';
import {deckPickState} from '@/client/console/deckPick/consoleDeckPick';
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import ConsoleEndgameWorkspace from '@/client/components/console/ConsoleEndgameWorkspace.vue';
import {boardSceneSettling} from '@/client/console/rewardPayoutQuiet';
import ConsoleRevealOverlay from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsoleDrawSearchRule from '@/client/components/console/foundation/ConsoleDrawSearchRule.vue';
import ConsoleTeleport from '@/client/components/console/foundation/ConsoleTeleport.vue';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import {closeWorkspaceRoot, offStageDeadFrames, pruneOffStageDeadFrames, registerAnchorDropListener, registerFrameAnchorDead, registerFrameBeatExpired, stackYieldedToBoard, enterWorkspace, goBoardHome, leaveWorkspace, setWorkspaceFramePhase, workspaceFrameRenders, workspaceStackTop, workspaceFrameHost, workspaceFrameKnown, workspaceStackCollapsed, workspaceStackState, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {installConsoleReadinessProbe, registerReadinessDecisionDiag} from '@/client/console/e2eReadiness';
import {resetStdProjectsFlow, stdProjectsFlow} from '@/client/console/consoleStdProjects';
import {stdProjectCommitState} from '@/client/console/consoleStdProjectCommit';
import ConsoleCorpFirstActionConfirm from '@/client/components/console/ConsoleCorpFirstActionConfirm.vue';
import ConsoleCardExitLayer from '@/client/components/console/cardDeal/ConsoleCardExitLayer.vue';
import ConsoleCardDiscardLayer from '@/client/components/console/cardDiscard/ConsoleCardDiscardLayer.vue';
import ConsoleDiscardPile from '@/client/components/console/discardPile/ConsoleDiscardPile.vue';
import {cardDiscardTransaction, registerDiscardOverlayHandoff, registerPreselectedDiscardArm} from '@/client/console/cardDiscard/consoleCardDiscard';
import {colonyBonusEntry, colonyBonusSequence, colonyResolutionUi, remoteColonyBonusParksReveal} from '@/client/console/colonyTrade/colonyResolution';
import ConsoleHandRevealLayer from '@/client/components/console/ConsoleHandRevealLayer.vue';
import ConsoleHandDeliveryLayer from '@/client/components/console/ConsoleHandDeliveryLayer.vue';
import ConsoleParliamentFlightLayer from '@/client/components/console/parliament/ConsoleParliamentFlightLayer.vue';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive, resetHandDelivery} from '@/client/console/handDock/handDeliveryDirector';
import {setHandRevealHooks} from '@/client/console/handDock/handRevealDirector';
import ConsoleDraftTray from '@/client/components/console/cardDeal/ConsoleDraftTray.vue';
import ConsoleDraftWorkspace from '@/client/components/console/draft/ConsoleDraftWorkspace.vue';
import ConsoleExternalDrawWorkspace from '@/client/components/console/externalDraw/ConsoleExternalDrawWorkspace.vue';
import {Phase} from '@/common/Phase';
import ConsoleTradeFleetLayer from '@/client/components/console/colonyFleet/ConsoleTradeFleetLayer.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import ConsoleColonyTradeLayer from '@/client/components/console/colonyTrade/ConsoleColonyTradeLayer.vue';
import {colonyTradeState, isColonyTradeInputLocked, colonyTradeDiagnostics} from '@/client/console/colonyTrade/consoleColonyTrade';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import ConsolePlayedHeroLayer from '@/client/components/console/played/ConsolePlayedHeroLayer.vue';
import {conWsPresence, installConWsPresenceBridge} from '@/client/console/conWsPresenceBridge';
import {playedHeroState} from '@/client/console/played/consolePlayedHero';
import {colonyFocusState} from '@/client/console/consoleColoniesModel';
import {consoleStartState, startSceneHeld} from '@/client/console/consoleStartState';
import {boardExcursionActive, releaseBoardExcursion} from '@/client/console/boardExcursion';
import {firstActionOwed} from '@/client/console/startFirstAction';
import {isResourceTransferActive, resourceTransferDiagnostics} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {boardPeekState} from '@/client/console/boardPeek';
import ConsoleCountedWhy from '@/client/components/console/ConsoleCountedWhy.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import ConsoleInspectSide from '@/client/components/console/ConsoleInspectSide.vue';
import ConsoleTargetDossierPanel from '@/client/components/console/played/ConsoleTargetDossierPanel.vue';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import ConsoleArmedFlightLayer from '@/client/components/console/ConsoleArmedFlightLayer.vue';
import Card from '@/client/components/card/CardFace.vue';
import {ZoomCard} from '@/client/components/card/cardZoomTypes';
import ConsoleBotDividendLedger from '@/client/components/console/ConsoleBotDividendLedger.vue';
import {consoleCardZoom} from '@/client/console/consoleCardZoom';
import {currentRevealEvent, drawnCardsState, registerRevealQueuePark, revealPresented} from '@/client/components/drawnCards/drawnCardsState';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';
import {generationSceneState, registerGenerationSceneHandoff} from '@/client/console/generationScene/generationScene';
import {ConsoleTask, taskFor, SHELL_SECTION_KINDS, corpFirstActionInStartFlow} from '@/client/console/consoleTaskRouter';
import ConsoleSpendHeat from '@/client/components/console/ConsoleSpendHeat.vue';
import ConsoleVenusBonus from '@/client/components/console/ConsoleVenusBonus.vue';
import ConsoleBotAttack from '@/client/components/console/ConsoleBotAttack.vue';
import ConsoleAresGlobals from '@/client/components/console/ConsoleAresGlobals.vue';


import {leakDetectorState, registerScreenCureExecutor, registerScreenShadowContext, screenShadowStanding, startConsoleLeakDetector, setConsoleTaskHandoffPending} from '@/client/console/consoleLeakDetector';
import {resetScreenShadowLog, screenCureArming, screenCureArmingFor, screenCurePlanText, screenShadowLog} from '@/client/console/screenDirector';
import {armSceneDestination, deferSceneReveal, loadingScreenState, registerGameExitTarget} from '@/client/console/loadingScreenState';
import {paths} from '@/common/app/paths';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import ConsoleHydroMarkerLayer from '@/client/components/console/hydroMarker/ConsoleHydroMarkerLayer.vue';
import {isHydroMarkerActive, hydroMarkerState, hydroRewardHoldOwed, hydroTraversalPending} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroCeremonyOwed, hydroFlowState, hydroFlowTrail, installHydroFlowWitnesses, isHydroCeremonyActive, registerHydroFlowProbe} from '@/client/console/hydroFlow/consoleHydroFlow';
import {preludePlayChainState} from '@/client/console/deckPick/preludePlayChain';
import {workspaceOutcomeBeatPending, lastOutcomeReleaseStack, setWorkspaceOutcomeServingProbe, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {boardBeatParkState, registerBoardBeatLiveParams, registerBoardBeatRedrive, registerBoardBeatSurfaceProbe, registerBoardWatchableProbe} from '@/client/console/boardBeatPark';
import {colonyBonusPayoutParksReveal} from '@/client/console/colonyLedger/colonyBonusPayout';
import ConsoleBoardCardBonusLayer from '@/client/components/console/boardCardBonus/ConsoleBoardCardBonusLayer.vue';
import {boardCardBonusState} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {OutcomeAdoptionDecision} from '@/client/console/consoleOutcomeAdoption';
import {planetFocusState, captureGlobalParams, isPlanetFocusEngaged} from '@/client/console/planetFocus';
import ConsoleDeckDrawLayer from '@/client/components/console/deckDraw/ConsoleDeckDrawLayer.vue';
import {deckDrawHolds} from '@/client/console/deckDraw/consoleDeckDraw';
import ConsolePatentSaleLayer from '@/client/components/console/patentSale/ConsolePatentSaleLayer.vue';
import {patentSaleState} from '@/client/console/patentSale/consolePatentSale';
import ConsoleResourceTransferLayer from '@/client/components/console/resourceTransfer/ConsoleResourceTransferLayer.vue';
import ConsoleTilePlacementLayer from '@/client/components/console/tilePlacement/ConsoleTilePlacementLayer.vue';
import ConsoleCityPayoutLayer from '@/client/components/console/tilePlacement/ConsoleCityPayoutLayer.vue';
import ConsoleScaleStepRewardLayer from '@/client/components/console/scaleStepReward/ConsoleScaleStepRewardLayer.vue';
import ConsoleCardReactionLayer from '@/client/components/console/cardReaction/ConsoleCardReactionLayer.vue';
import {cardReactionPending, hurryCardReactions} from '@/client/console/cardReaction/cardReactionDirector';
import ConsoleScaleSwingLayer from '@/client/components/console/scaleSwing/ConsoleScaleSwingLayer.vue';
import {PlacementPeek} from '@/client/console/tilePlacement/placementPeek';
import ConsoleNomadMoveLayer from '@/client/components/console/nomads/ConsoleNomadMoveLayer.vue';
import {tilePlacementState} from '@/client/console/tilePlacement/consoleTilePlacement';
import {placementFlowState} from '@/client/console/tilePlacement/placementFlow';
import {registerBoardShownDespiteStack} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {nomadMoveState} from '@/client/console/nomads/consoleNomadMove';
import ConsoleColonyBuildLayer from '@/client/components/console/colonyBuild/ConsoleColonyBuildLayer.vue';
import ConsoleColonyCityLayer from '@/client/components/console/colonyCity/ConsoleColonyCityLayer.vue';
import {isColonyBuildActive} from '@/client/console/colonyBuild/consoleColonyBuild';
import ConsoleJournalPanel from '@/client/components/console/ConsoleJournalPanel.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

import {consoleState, closeConsoleLayers, registerConsoleIntentHandler} from '@/client/console/consoleRouter';
import {wheelControlState} from '@/client/console/quickWheel/wheelControlMode';
import {consoleHandPickState} from '@/client/console/consoleHandPick';
import {consoleRepeatPickState} from '@/client/console/consoleRepeatPick';
import {cardDeltaAdvanceCard, clearCardDeltaAdvance} from '@/client/console/hydroFlow/deltaAdvanceEntry';
import {setAlbumLayoutRecomposer} from '@/client/console/consoleAlbumLayout';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import {StageHost, useWorkspaceBandGeometry} from '@/client/console/composables/useWorkspaceBandGeometry';
import {useConsoleSession, leaveConsoleSession} from '@/client/console/session/consoleSession';
import {handoffPendingEntries} from '@/client/console/shell/shellFlowState';
// Only as the DEGRADE default for a player model that predates `maCosts` (an
// old save, a test fixture) — the live price always comes from the server.
import {notificationBus} from '@/client/components/notifications/notificationBus';
import {infoModeState} from '@/client/console/infoModeState';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import ConsoleMandatoryAnnounce from '@/client/components/console/ConsoleMandatoryAnnounce.vue';
import {isMandatoryBeatPresented, resetMandatoryGate, setMandatoryGateHeld} from '@/client/console/consoleMandatoryGate';
import {startShadowLog} from '@/client/console/startDirector';
import {AdmissionSignals, promptAdmissionBlock, releasePromptPresence} from '@/client/console/consolePromptAdmission';
import {waitScreenHandoff} from '@/client/console/screenHandoff';
import {PARLIAMENT_DOOR} from '@/client/console/parliament/parliamentDoorHandoff';
import {setConsoleBoardHomeIdle} from '@/client/console/consoleForegroundWatchdog';
import type {StagedVoteModel} from '@/common/models/ActionPreviewModel';
import ConsoleActionConfirm from '@/client/components/console/ConsoleActionConfirm.vue';
import {colonyTrackMoveFlow, registerColonyTrackMoveHost} from '@/client/console/colonyTrade/colonyTrackMove';
import {registerColonyRosterHost} from '@/client/console/colonyRoster/consoleColonyRoster';
import {RosterLevel} from '@/client/console/colonyRoster/colonyRosterModel';
import {PendingPlayCard} from '@/client/console/shell/shellShared';
import {createViewerController, ViewerPort} from '@/client/console/shell/viewerController';
import {shellPort} from '@/client/console/shell/shellPort';
import {createSurfaceRegistry} from '@/client/console/shell/surfaceRegistry';
import {createMaController, MaPort} from '@/client/console/shell/maController';
import {createInfoController, InfoPort} from '@/client/console/shell/infoController';
import {createNoticeController} from '@/client/console/shell/noticeController';
import {createWheelController, WheelPort} from '@/client/console/shell/wheelController';
import {createCellController, CellPort} from '@/client/console/shell/cellController';
import {createConvertController, ConvertPort} from '@/client/console/shell/convertController';
import {createRailController, RailPort} from '@/client/console/shell/railController';
import {createJournalController, JournalPort} from '@/client/console/shell/journalController';
import {createSurfaceController} from '@/client/console/shell/surfaceController';
import {createSupervisorController, SupervisorPort} from '@/client/console/supervisor/supervisorController';
import {createSeatController, SeatPort} from '@/client/console/shell/seatController';
import {createDraftController, DraftPort} from '@/client/console/shell/draftController';
import {createFinaleController, FinalePort} from '@/client/console/shell/finaleController';
import {createPlayedController, PlayedPort} from '@/client/console/shell/playedController';
import {createStagedController, StagedPort} from '@/client/console/shell/stagedController';
import {createCardActionsController, CardActionsPort} from '@/client/console/shell/cardActionsController';
import {createStdProjectsController, StdProjectsPort} from '@/client/console/shell/stdProjectsController';
import {createStartController, StartPort} from '@/client/console/shell/startController';
import {createHydroController, HydroPort} from '@/client/console/shell/hydroController';
import {createParliamentController, ParliamentPort} from '@/client/console/shell/parliamentController';
import {createColonyController, ColonyPort} from '@/client/console/shell/colonyController';
import {createPlacementController, PlacementPort} from '@/client/console/shell/placementController';
import {createMandatoryController, MandatoryPort} from '@/client/console/shell/mandatoryController';
import {createRevealController, RevealPort} from '@/client/console/shell/revealController';
import {createOutcomeController, OutcomePort} from '@/client/console/shell/outcomeController';
import {createRouterController, RouterPort} from '@/client/console/shell/routerController';
import {createPlayCardController, PlayCardPort} from '@/client/console/shell/playCardController';
import {createHandSelectController, HandSelectPort} from '@/client/console/shell/handSelectController';
import {createHandController, HandPort} from '@/client/console/shell/handController';
import {createWorkspaceController, WorkspacePort} from '@/client/console/shell/workspaceController';
import {createCommandBarController, CommandBarPort} from '@/client/console/shell/commandBarController';
import {createPadRouterController, PadRouterPort} from '@/client/console/shell/padRouterController';
import {createViewApplyController, ViewApplyPort} from '@/client/console/shell/viewApplyController';
import {consoleSessionScope} from '@/client/console/session/consoleSession';


/* (The terminal std-project beat's length is the PHRASE's own now — press,
 * sweep and the post-chip read live in `consoleStdProjectCommit.ts`, so the
 * dismiss can never disagree with the animation it is waiting for.) */


export default defineComponent({
  name: 'ConsoleShell',
  components: {
    ConsoleTeleport,
    ConsoleCountedWhy,
    ConsoleActionConfirm,
    ConsoleDrawSearchRule,
    ConsoleStatusStrip,
    ConsoleMandatoryAnnounce,
    ConsoleTerraformedTitle,
    ConsoleBotTurnReview,
    ConsoleCommandBar,
    ConsoleHandDock,
    ConsoleSheet,
    ConsoleMaScreen,
    ConsoleMaCeremony,
    ConsoleQuickSelector,
    ConsoleStdProjectsScreen,
    ConsoleContextPanel,
    ConsoleStrategyRail,
    ConsoleSystemAlert,
    ConsoleBoardSection,
    ConsoleHandSection,
    ConsoleResourcePanel,
    ConsoleColoniesSection,
    ConsoleParliamentSection,
    ConsoleResolutionAside,
    ConsolePartyAccessPanel,
    ConsoleInfoMode,
    ConsoleCardRulesPanel,
    ConsoleBotDividendLedger,
    ConsoleInspectSide,
    ConsoleTargetDossierPanel,
    ConsoleCardAvailabilityPanel,
    ConsoleStrandedPrompt,
    ConsoleTaskHost,
    ConsoleGovernmentSupport,
    ConsoleEffectDecision,
    ConsoleProductionLoss,
    ConsoleDeckPick,
    ConsoleDeckPickLayer,
    ConsoleSpendHeat,
    ConsoleVenusBonus,
    ConsoleBotAttack,
    ConsoleAresGlobals,
    ConsoleStartScene,
    ConsoleEndgameWorkspace,
    ConsoleRevealOverlay,
    ConsolePlayCardConfirm,
    ConsoleCorpFirstActionConfirm,
    ConsoleCardExitLayer,
    ConsoleCardDiscardLayer,
    ConsoleDiscardPile,
    ConsoleHandRevealLayer,
    ConsoleHandDeliveryLayer,
    ConsoleParliamentFlightLayer,
    ConsoleDraftTray,
    ConsoleDraftWorkspace,
    ConsoleExternalDrawWorkspace,
    ConsoleHydroMarkerLayer,
    ConsoleBoardCardBonusLayer,
    ConsoleDeckDrawLayer,
    ConsoleTradeFleetLayer,
    ConsoleColonyTradeLayer,
    ConsoleColonyInspect,
    ConsolePlayedOverlay,
    ConsolePlayedHeroLayer,
    ConsolePatentSaleLayer,
    ConsoleResourceTransferLayer,
    ConsoleArmedFlightLayer,
    ConsoleTilePlacementLayer,
    ConsoleCityPayoutLayer,
    ConsoleScaleStepRewardLayer,
    ConsoleCardReactionLayer,
    ConsoleScaleSwingLayer,
    ConsoleNomadMoveLayer,
    ConsoleColonyBuildLayer,
    ConsoleColonyCityLayer,
    CardZoomModal,
    CardZoomCard,
    Card,
    ConsoleCardActions,
    ConsoleHydroSection,
    ConsoleJournalPanel,
    GamepadGlyph,
    'console-board-binder': ConsoleBoardBinder,
    'console-board-input': ConsoleBoardInput,
  },
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /**
     * The LIVE list of players the server is waiting on (App-level, refreshed
     * by the game transport's `/api/waitingFor` poll — mirrors what the
     * desktop DraftFlowOverlay / StartGameFlowOverlay receive). Load-bearing
     * while the viewer holds a prompt: the playerView is NOT refreshed then
     * (it would drop their partial input), so this is the only signal that
     * another player has since submitted.
     */
    waitingOnPlayers: {type: Array as PropType<ReadonlyArray<Color>>, default: () => []},
  },
  setup() {
    // Foundation (docs/CONSOLE_FOUNDATION.md): the in-game shell is a
    // console-native SURFACE — page-level scroll is locked for its lifetime
    // (html.console-native + body scroll lock); anything that overflows must
    // live inside a ConsoleScrollArea, never scroll the page.
    useConsoleNativeSurface();
    // THE SESSION — the one root of the console's flow tree (console/session/consoleSession.ts): it stands for this
    // shell's life and ends when the shell is unmounted, taking every flow opened inside it.
    useConsoleSession();
    // THE CENTRAL STAGE'S ONE GEOMETRY. Every fixed band surface and the shared
    // dim read the LIVE opening between the four hull members instead of
    // approximating it from tokens — so a modal can never reach under a bar and
    // the shade can never grey one out. The two RAILS are measured too: the
    // right one is board-home only, and a `v-show` flip that hides it moves the
    // opening's edge without resizing the column.
    const conMainEl = ref<HTMLElement>();
    // Component instances, not elements — the mirror resolves `$el` itself.
    const conRailEl = ref<StageHost>();
    const conStratEl = ref<StageHost>();
    useWorkspaceBandGeometry(
      {main: conMainEl, left: conRailEl, right: conStratEl},
      () => `${consoleState.section}|${consoleState.sheet ?? ''}`);
    // THE SURFACE REGISTRY (console/shell/surfaceRegistry.ts): the template stands each surface under its name
    // (`:ref="surfaces.bind.<name>"`), the controllers ask for it through their port — never `$refs`.
    const surfaces = createSurfaceRegistry();
    const viewer = createViewerController(shellPort<ViewerPort>());
    const ma = createMaController(shellPort<MaPort>());
    const info = createInfoController(shellPort<InfoPort>());
    const notice = createNoticeController();
    const wheel = createWheelController(shellPort<WheelPort>());
    const cell = createCellController(shellPort<CellPort>());
    const convert = createConvertController(shellPort<ConvertPort>());
    const rail = createRailController(shellPort<RailPort>());
    const journal = createJournalController(shellPort<JournalPort>());
    const surface = createSurfaceController();
    const supervisor = createSupervisorController(shellPort<SupervisorPort>());
    const seat = createSeatController(shellPort<SeatPort>());
    const draft = createDraftController(shellPort<DraftPort>());
    const finale = createFinaleController(shellPort<FinalePort>());
    const played = createPlayedController(shellPort<PlayedPort>());
    const staged = createStagedController(shellPort<StagedPort>());
    const cardActions = createCardActionsController(shellPort<CardActionsPort>());
    const stdProjects = createStdProjectsController(shellPort<StdProjectsPort>());
    const start = createStartController(shellPort<StartPort>());
    const hydro = createHydroController(shellPort<HydroPort>());
    const parliament = createParliamentController(shellPort<ParliamentPort>());
    const colony = createColonyController(shellPort<ColonyPort>());
    const placement = createPlacementController(shellPort<PlacementPort>());
    const mandatory = createMandatoryController(shellPort<MandatoryPort>());
    const reveal = createRevealController(shellPort<RevealPort>());
    const outcome = createOutcomeController(shellPort<OutcomePort>());
    const router = createRouterController(shellPort<RouterPort>());
    const playCard = createPlayCardController(shellPort<PlayCardPort>());
    const handSelect = createHandSelectController(shellPort<HandSelectPort>());
    const hand = createHandController(shellPort<HandPort>());
    const workspace = createWorkspaceController(shellPort<WorkspacePort>());
    const commandBar = createCommandBarController(shellPort<CommandBarPort>());
    const padRouter = createPadRouterController(shellPort<PadRouterPort>());
    const viewApply = createViewApplyController(shellPort<ViewApplyPort>());
    return {conMainEl, conRailEl, conStratEl, surfaces, ...viewer, ...ma, ...info, ...notice, ...wheel, ...cell, ...convert, ...rail, ...journal, ...surface, ...supervisor, ...seat, ...draft, ...finale, ...played, ...staged, ...cardActions, ...stdProjects, ...start, ...hydro, ...parliament, ...colony, ...placement, ...mandatory, ...reveal, ...outcome, ...router, ...playCard, ...handSelect, ...hand, ...workspace, ...commandBar, ...padRouter, ...viewApply};
  },
  data() {
    return {
      boardPeekUi: boardPeekState,
      consoleState,
      consoleCardZoom,
      playedHeroState,
      handRevealState,
      handDeliveryState,
      /** A chosen colony track's move (TR07), mirrored so the follow-up's liveness tracks it. */
      trackMoveFlow: colonyTrackMoveFlow,
      patentSaleState,
      /** The terminal std-project commit phrase. MIRRORED for the same reason
       *  as the two below: `'stdProjectCommitState.abortNonce'` resolves
       *  against the instance. */
      stdProjectCommitState,
      /** The card-discard cinematic. MIRRORED HERE ON PURPOSE: a path watcher
       *  key (`'cardDiscardTransaction.phase'`) resolves against the instance,
       *  so a module reactive that is not in data() makes the watcher silently
       *  never fire (the hydro black-screen bug). */
      cardDiscardTransaction,
      tilePlacementState,
      placementFlowState,
      nomadMoveState,
      /** Planet Focus (main-grid placement): phases + held global params. */
      planetFocusState,
      /** «МАРС ТЕРРАФОРМИРОВАН» — the terraformed scene's phases (TR70): the root classes and the camera's hand-back read it. */
      terraformedSceneState,
      /** Unregister fn of the planet-focus live-params source. */
      offPlanetFocusParams: undefined as (() => void) | undefined,
      /** The `.con-ws` DOM-presence flags (ex-`:has()`) + their observer's
       *  dispose — module reactive mirrored into data() so conRootClasses
       *  tracks it (the path-watcher data-mirror rule). */
      wsPresence: conWsPresence,
      offWsPresence: undefined as (() => void) | undefined,
      infoModeState,
      leakDetectorState,
      consoleSystemAlertState,
      govScaleFocusState,
      /** The energy→heat conversion transition (feedback module) — in data()
       *  so the task-host v-if tracks its `active` flip reliably: the amount
       *  surface that ANSWERED the conversion leaves the moment the rail
       *  animation claims the foreground, and the rail plays it un-dimmed. */
      energyConversionState,
      botTurnReviewState,
      /** The colony trade-launch controller (drives the docked-settle glow). */
      tradeFleetState,
      /** The colony trade-REWARD transaction (the Pluto return-home watcher). */
      colonyTradeState,
      /** The remote colony-bonus ENTRY context (colonyResolution.ts) — in
       *  data() so the resolution computeds/watchers track it reliably. */
      bonusEntry: colonyBonusEntry,
      /** …and the SEQUENCE context (colonyResolution.ts) — the server ordinal
       *  that says another cycle of this payout is owed. Same reason: a module
       *  reactive must be mirrored in `data()` to be tracked. */
      bonusSequence: colonyBonusSequence,
      /** The hydronetwork marker-advance controller (the plan-reset watcher). */
      hydroMarkerState,
      /** The deck-pick flow, mirrored for reactivity (the traversal's resume
       *  gate waits out its closing beats — cards to the dock, the clear). */
      flowDeckState: deckPickState,
      /** The client hand-pick bridge state (composer → hand section). */
      consoleHandPickState,
      consoleRepeatPickState,
      /** The hydro workspace flow — module reactive, mirrored here for path
       *  watchers (vue-path-watcher rule). */
      hydroFlow: hydroFlowState,
      /** The colony workspace flow (browse ⇄ focus stage) — module reactive,
       *  mirrored here for path watchers (vue-path-watcher rule). */
      colonyFocus: colonyFocusState,
      /** The persisted control-style choice (quick-select / focus-confirm) —
       *  mirrored for the path watcher below (module-reactive rule). */
      wheelControl: wheelControlState,
      /** The console-native card-action center's UI state (filter + confirm-open). */
      consoleCardActionsUi,
      /** Release fn of the held 'mandatory-choice' presentation lease. */
      releasePresentationLease: undefined as (() => void) | undefined,
      /** Unregister of the notification corner probe (FK — a new card waits while a viewer stands in its corner). */
      releaseNotificationCorner: undefined as (() => void) | undefined,
    };
  },
  computed: {
    /**
     * THE PHASE ANCHORS' WORD, as ONE reactive fact (the anchor rule — `consoleWorkspaceStack.ts` § A FRAME LIVES ONLY
     * WHILE ITS ANCHOR HOLDS): which phase roots are PROVABLY over. The same predicates the lifecycle watchers close on
     * — the draft's, the sitting's (per seat), the endgame's. The START is not judged here: its life is the opening
     * director's (the scene's own release beat), and no server fact says «over» before it does.
     */
    deadPhaseAnchors(): ReadonlyArray<string> {
      const dead: Array<string> = [];
      if (!this.draftFrameLive) {
        dead.push('draft');
      }
      if (!this.parliamentSittingFrameLive) {
        dead.push(Phase.PARLIAMENT);
      }
      if (!this.endgameFrameLive) {
        dead.push('end');
      }
      return dead;
    },
    /** Off-stage frames (parked / aside for the board) whose phase is over — the prune watcher's key. Reads the phase
     *  facts THROUGH `deadPhaseAnchors` (a reactive edge), never only through the stack's registered predicate. */
    offStageDeadAnchorKey(): string {
      return this.deadPhaseAnchors.length === 0 ? '' : offStageDeadFrames().join(',');
    },
    /** Every tile placed this turn — L3 = Показать на карте (ALL cells pulse). */
    reviewMapSpaces(): ReadonlyArray<SpaceId> {
      const out: Array<SpaceId> = [];
      for (const tile of this.botTurnReviewState.review?.tiles ?? []) {
        if (!out.includes(tile.spaceId)) {
          out.push(tile.spaceId);
        }
      }
      return out;
    },
  },
  watch: {
    handAlbumPickerKey(): void {
      this.whenHandAlbumPickerKeyChanges();
    },
    viewerAskedNothing(none: boolean): void {
      this.whenViewerAskedNothingChanges(none);
    },
    viewerAskedOffTurn(offTurn: boolean): void {
      this.whenViewerAskedOffTurnChanges(offTurn);
    },
    revealEmbedTarget(target: string | undefined): void {
      this.whenRevealEmbedTargetChanges(target);
    },
    promptPresenceEntries(entries: string): void {
      this.whenPromptPresenceEntriesChanges(entries);
    },
    promptPresenceIdentity(): void {
      this.whenPromptPresenceIdentityChanges();
    },
    promptAnswerInFlight(inProgress: boolean): void {
      this.whenPromptAnswerInFlightChanges(inProgress);
    },
    clientPickSceneLive(live: boolean): void {
      this.whenClientPickSceneLiveChanges(live);
    },
    cardDeltaEntryFrameLive: {
      immediate: true,
      handler(live: boolean): void {
        this.whenCardDeltaEntryFrameLiveChanges(live);
      },
    },
    maCurrentBeat() {
      this.whenMaCurrentBeatChanges();
    },
    'playerView.game.gameAge'() {
      this.whenPlayerViewGameGameAgeChanges();
    },
    'playerView.game.undoCount'() {
      this.whenPlayerViewGameUndoCountChanges();
    },
    awardFundingActive(next: boolean) {
      this.whenAwardFundingActiveChanges(next);
    },
    commitHolding(now: boolean, was: boolean) {
      this.whenCommitHoldingChanges(now, was);
    },
    topNotification(next: LiveNotification | undefined, prev: LiveNotification | undefined) {
      this.whenTopNotificationChanges(next, prev);
    },
    'consoleState.quick'() {
      this.whenConsoleStateQuickChanges();
    },
    'wheelControl.mode'() {
      this.whenWheelControlModeChanges();
    },
    parliamentBillStanding: {
      immediate: true,
      handler(on: boolean): void {
        this.whenParliamentBillStandingChanges(on);
      },
    },
    'consoleState.task.deferred'(deferred: boolean) {
      this.whenConsoleStateTaskDeferredChanges(deferred);
    },
    taskSpacePending(pending: {index: number, spacePrompt: PlayerInputModel} | undefined) {
      this.whenTaskSpacePendingChanges(pending);
    },
    tradePayoutIncoming(incoming: boolean) {
      this.whenTradePayoutIncomingChanges(incoming);
    },
    colonyPayoutIncoming(incoming: boolean) {
      this.whenColonyPayoutIncomingChanges(incoming);
    },
    outcomeAdoptionDecision: {
      // IMMEDIATE: a decision already standing at mount (a reload into a
      // pending batch with a restored stack) has no change edge left to fire
      // on — unapplied, the presentation hold above it would stand forever.
      immediate: true,
      flush: 'post',
      handler(decision: OutcomeAdoptionDecision): void {
        this.whenOutcomeAdoptionDecisionChanges(decision);
      },
    },
    exitBarrierHeldBatch(id: number | undefined): void {
      this.whenExitBarrierHeldBatchChanges(id);
    },
    colonySequenceKey: {
      immediate: true,
      handler(): void {
        this.whenColonySequenceKeyChanges();
      },
    },
    'bonusSequence.awaiting'(awaiting: boolean): void {
      this.whenBonusSequenceAwaitingChanges(awaiting);
    },
    colonyResolutionEvidence: {
      immediate: true,
      handler(live: boolean): void {
        this.whenColonyResolutionEvidenceChanges(live);
      },
    },
    colonyEntryAwaiting: {
      immediate: true,
      handler(awaiting: boolean): void {
        this.whenColonyEntryAwaitingChanges(awaiting);
      },
    },
    settlementMarkerKey: {
      immediate: true,
      flush: 'pre',
      handler(): void {
        this.whenSettlementMarkerKeyChanges();
      },
    },
    questionTableKey: {
      immediate: true,
      flush: 'pre',
      handler(): void {
        this.whenQuestionTableKeyChanges();
      },
    },
    colonyDiscardStageStranded(stranded: boolean): void {
      this.whenColonyDiscardStageStrandedChanges(stranded);
    },
    colonyResolutionLive(live: boolean, was: boolean): void {
      this.whenColonyResolutionLiveChanges(live, was);
    },
    workspaceOutcomeServingNow(serving: boolean): void {
      this.whenWorkspaceOutcomeServingNowChanges(serving);
    },
    // THE OWED CONCLUSIONS' FACTS — the row `owedConclusionSignal` stood in, and a watcher OF THE SHELL on purpose: the
    // facts of a conclusion move in two steps inside one tick (an owed step's door falls, a reaction of the shell then
    // pushes the step's frame), and an ending asked between the two — or after the render — is wrong
    // (`workspaceConclusionOwe.ts` says how both were found). Do not turn it into a free watcher.
    owedConclusionFacts(): void {
      this.whenOwedConclusionFactsChanges();
    },
    boardBeatsWatchable(watchable: boolean): void {
      this.whenBoardBeatsWatchableChanges(watchable);
    },
    colonyBonusAutoCollect(key: string): void {
      this.whenColonyBonusAutoCollectChanges(key);
    },
    'colonyTradeState.glideNonce'() {
      this.whenColonyTradeStateGlideNonceChanges();
    },
    colonyPromptOpenable(on: boolean) {
      this.whenColonyPromptOpenableChanges(on);
    },
    colonyTrackRaiseKey(key: string) {
      this.whenColonyTrackRaiseKeyChanges(key);
    },
    colonyFollowUpLive(live: boolean, was: boolean) {
      this.whenColonyFollowUpLiveChanges(live, was);
    },
    colonyPromptStranded: {
      flush: 'post',
      handler(stranded: boolean): void {
        this.whenColonyPromptStrandedChanges(stranded);
      },
    },
    armedColonyTradeTrack() {
      this.whenArmedColonyTradeTrackChanges();
    },
    'hydroMarkerState.active'(active: boolean) {
      this.whenHydroMarkerStateActiveChanges(active);
    },
    hydroResolutionBusy(busy: boolean) {
      this.whenHydroResolutionBusyChanges(busy);
    },
    workspaceCollapsed(collapsed: boolean) {
      this.whenWorkspaceCollapsedChanges(collapsed);
    },
    hydroFrameStands(stands: boolean) {
      this.whenHydroFrameStandsChanges(stands);
    },
    'hydroFlow.commit.phase'(phase: string | undefined) {
      this.whenHydroFlowCommitPhaseChanges(phase);
    },
    hydroFollowUpLive() {
      this.whenHydroFollowUpLiveChanges();
    },
    'hydroFlow.step'() {
      this.whenHydroFlowStepChanges();
    },
    'hydroFlow.repeatBridge'() {
      this.whenHydroFlowRepeatBridgeChanges();
    },
    repeatPickActive(active: boolean) {
      this.whenRepeatPickActiveChanges(active);
    },
    repeatPickFrameLive(live: boolean) {
      this.whenRepeatPickFrameLiveChanges(live);
    },
    hydroRewardFrameLive(live: boolean) {
      this.whenHydroRewardFrameLiveChanges(live);
    },
    espionageExecutionStanding(standing: boolean, was: boolean): void {
      this.whenEspionageExecutionStandingChanges(standing, was);
    },
    hydroViewerTrackPosition(pos: number) {
      this.whenHydroViewerTrackPositionChanges(pos);
    },
    deckPickActive(active: boolean) {
      this.whenDeckPickActiveChanges(active);
    },
    hydroTraversalResumeReady(ready: boolean) {
      this.whenHydroTraversalResumeReadyChanges(ready);
    },
    presentedDrawnRevealId: {
      immediate: true,
      handler(id: number | undefined): void {
        this.whenPresentedDrawnRevealIdChanges(id);
      },
    },
    journalHardBlocked(now: boolean) {
      this.whenJournalHardBlockedChanges(now);
    },
    'playedHeroState.phase'(phase: string) {
      this.whenPlayedHeroStatePhaseChanges(phase);
    },
    'patentSaleState.phase'(phase: string) {
      this.whenPatentSaleStatePhaseChanges(phase);
    },
    consoleMandatoryPresenting: {
      immediate: true,
      handler(presenting: boolean): void {
        this.whenConsoleMandatoryPresentingChanges(presenting);
      },
    },
    'consoleState.sheet'(sheet: string | undefined) {
      this.whenConsoleStateSheetChanges(sheet);
    },
    'consoleState.section'(section: string) {
      this.whenConsoleStateSectionChanges(section);
    },
    journalPanelVisible(visible: boolean) {
      this.whenJournalPanelVisibleChanges(visible);
    },
    ledgerPayoutOrphaned(orphaned: boolean): void {
      this.whenLedgerPayoutOrphanedChanges(orphaned);
    },
    chainPlacementOrderEmbedded(now: boolean): void {
      this.whenChainPlacementOrderEmbeddedChanges(now);
    },
    startDiscardStepDue(due: boolean): void {
      this.whenStartDiscardStepDueChanges(due);
    },
    startPartyStepDue(due: boolean): void {
      this.whenStartPartyStepDueChanges(due);
    },
    startHostedStepDue(kind: HostedParliamentStepKind | ''): void {
      this.whenStartHostedStepDueChanges(kind);
    },
    startStrandedNow(now: boolean): void {
      this.whenStartStrandedNowChanges(now);
    },
    startShadowSig(sig: string): void {
      this.whenStartShadowSigChanges(sig);
    },
    'playerView.waitingFor.promptId'(id: number | undefined): void {
      this.whenPlayerViewWaitingForPromptIdChanges(id);
    },
    ledgerDiscardStepDue(due: boolean): void {
      this.whenLedgerDiscardStepDueChanges(due);
    },
    consoleForegroundBusy(busy: boolean, wasBusy: boolean): void {
      this.whenConsoleForegroundBusyChanges(busy, wasBusy);
    },
    corpFirstActionOpen(open: boolean): void {
      this.whenCorpFirstActionOpenChanges(open);
    },
    draftFrameLive: {
      immediate: true,
      handler(live: boolean): void {
        this.whenDraftFrameLiveChanges(live);
      },
    },
    offStageDeadAnchorKey(key: string): void {
      this.whenOffStageDeadAnchorKeyChanges(key);
    },
    parliamentSittingFrameLive: {
      immediate: true,
      handler(live: boolean): void {
        this.whenParliamentSittingFrameLiveChanges(live);
      },
    },
    parliamentEmbedTarget(target: string | undefined): void {
      this.whenParliamentEmbedTargetChanges(target);
    },
    stagedVoteModel: {
      flush: 'sync',
      handler(vote: StagedVoteModel | undefined): void {
        this.whenStagedVoteModelChanges(vote);
      },
    },
    playedHeroTold(told: boolean): void {
      this.whenPlayedHeroToldChanges(told);
    },
    hostedStepDeclaredCard(card: string): void {
      this.whenHostedStepDeclaredCardChanges(card);
    },
    venusBonusEmbedTarget(target: string | undefined): void {
      this.whenVenusBonusEmbedTargetChanges(target);
    },
    parliamentLeaving(leaving: boolean): void {
      this.whenParliamentLeavingChanges(leaving);
    },
    parliamentShown(shown: boolean, was: boolean): void {
      this.whenParliamentShownChanges(shown, was);
    },
    externalDrawFrameLive: {
      immediate: true,
      handler(live: boolean): void {
        this.whenExternalDrawFrameLiveChanges(live);
      },
    },
    draftPaymentServeSignal: {
      immediate: true,
      handler(): void {
        this.whenDraftPaymentServeSignalChanges();
      },
    },
    startFrameLive: {
      immediate: true,
      handler(live: boolean): void {
        this.whenStartFrameLiveChanges(live);
      },
    },
    endgameFrameLive: {
      immediate: true,
      handler(live: boolean): void {
        this.whenEndgameFrameLiveChanges(live);
      },
    },
    'playedHeroState.active'(active: boolean): void {
      this.whenPlayedHeroStateActiveChanges(active);
    },
    mandatoryGateHeld: {
      immediate: true,
      handler(held: boolean): void {
        this.whenMandatoryGateHeldChanges(held);
      },
    },
    deferredWhileOnOwnSurface(on: boolean): void {
      this.whenDeferredWhileOnOwnSurfaceChanges(on);
    },
    mandatoryBeatKey: {
      immediate: true,
      handler(key: string): void {
        this.whenMandatoryBeatKeyChanges(key);
      },
    },
    mandatoryPresentationReady: {
      immediate: true,
      handler(ready: boolean): void {
        this.whenMandatoryPresentationReadyChanges(ready);
      },
    },
    rawAdmissionSignals: {
      immediate: true,
      deep: true,
      handler(raw: AdmissionSignals): void {
        this.whenRawAdmissionSignalsChanges(raw);
      },
    },
    boardHomeIdle: {
      immediate: true,
      handler(idle: boolean): void {
        this.whenBoardHomeIdleChanges(idle);
      },
    },
    placementHeld: {
      immediate: true,
      handler(held: boolean): void {
        this.whenPlacementHeldChanges(held);
      },
    },
    'consoleCardZoom.card'(card: ZoomCard | undefined, prev: ZoomCard | undefined) {
      this.whenConsoleCardZoomCardChanges(card, prev);
    },
    focusedPlayableHandCard(name: CardName | undefined) {
      this.whenFocusedPlayableHandCardChanges(name);
    },
    colonyRosterLevel(level: RosterLevel | undefined): void {
      this.whenColonyRosterLevelChanges(level);
    },
    colonyRailNames(next: string, prev: string): void {
      this.whenColonyRailNamesChanges(next, prev);
    },
    stagedColonyCommitting(now: boolean, was: boolean): void {
      this.whenStagedColonyCommittingChanges(now, was);
    },
    stagedVoteCommitting(now: boolean, was: boolean): void {
      this.whenStagedVoteCommittingChanges(now, was);
    },
    pendingPlayCard(now: PendingPlayCard | undefined) {
      this.whenPendingPlayCardChanges(now);
    },
    departingPlayCardGone(gone: boolean) {
      this.whenDepartingPlayCardGoneChanges(gone);
    },
    cellPreviewKey: {
      immediate: true,
      handler(): void {
        this.whenCellPreviewKeyChanges();
      },
    },
    placementPeekTarget: {
      immediate: true,
      handler(peek: PlacementPeek | undefined): void {
        this.whenPlacementPeekTargetChanges(peek);
      },
    },
    placementTakesBoardForLanding(now: boolean) {
      this.whenPlacementTakesBoardForLandingChanges(now);
    },
    boardStoryCoverCandidate(now: boolean) {
      this.whenBoardStoryCoverCandidateChanges(now);
    },
    boardStoryCoverOwed(owed: boolean) {
      this.whenBoardStoryCoverOwedChanges(owed);
    },
    placementTakesBoardForStory(now: boolean) {
      this.whenPlacementTakesBoardForStoryChanges(now);
    },
    placementActive(now: boolean) {
      this.whenPlacementActiveChanges(now);
    },
    placementMoveFrom(now: SpaceId | undefined, before: SpaceId | undefined) {
      this.whenPlacementMoveFromChanges(now, before);
    },
    placementRawSpaceModel(raw: SelectSpaceModel | undefined) {
      this.whenPlacementRawSpaceModelChanges(raw);
    },
    placementWorldVersion(): void {
      this.whenPlacementWorldVersionChanges();
    },
    planetFocusTarget(now: boolean): void {
      this.whenPlanetFocusTargetChanges(now);
    },
    'terraformedSceneState.phase'(now: string): void {
      this.whenTerraformedSceneStatePhaseChanges(now);
    },
    startTask(now: ConsoleTask | undefined, was: ConsoleTask | undefined): void {
      this.whenStartTaskChanges(now, was);
    },
    startExcursionEngage(now: boolean): void {
      this.whenStartExcursionEngageChanges(now);
    },
    hydroBonusReturnSignal(): void {
      this.whenHydroBonusReturnSignalChanges();
    },
    hydroBonusDoorSignal(): void {
      this.whenHydroBonusDoorSignalChanges();
    },
    espionagePromptDoorSignal: {
      immediate: true,
      handler(open: boolean): void {
        this.whenEspionagePromptDoorSignalChanges(open);
      },
    },
    blockadePromptDoorSignal: {
      immediate: true,
      handler(open: boolean): void {
        this.whenBlockadePromptDoorSignalChanges(open);
      },
    },
    startExcursionQuietNow(now: boolean): void {
      this.whenStartExcursionQuietNowChanges(now);
    },
    'bonusActionLedgerOwed'(owed: boolean): void {
      this.whenBonusActionLedgerOwedChanges(owed);
    },
    startSceneServes(now: boolean): void {
      this.whenStartSceneServesChanges(now);
    },
    'cardDiscardTransaction.phase'(phase: string, was: string | undefined): void {
      this.whenCardDiscardTransactionPhaseChanges(phase, was);
    },
    effectDecisionKey(now: string, was: string | undefined): void {
      this.whenEffectDecisionKeyChanges(now, was);
    },
    effectDecisionDirectPick(action: EffectDecisionAction | undefined): void {
      this.whenEffectDecisionDirectPickChanges(action);
    },
    pickBridgeActive: {
      immediate: true,
      handler(now: boolean): void {
        this.whenPickBridgeActiveChanges(now);
      },
    },
    freshPickFocusAt(at: number): void {
      this.whenFreshPickFocusAtChanges(at);
    },
    handSelectProps(v: ConsoleHandSelectMode | undefined): void {
      this.whenHandSelectPropsChanges(v);
    },
    handPickActive(now: boolean): void {
      this.whenHandPickActiveChanges(now);
    },
    playPickActive(now: boolean): void {
      this.whenPlayPickActiveChanges(now);
    },
    stdpConclusionSignal(): void {
      this.whenStdpConclusionSignalChanges();
    },
    'stdProjectCommitState.abortNonce'() {
      this.whenStdProjectCommitStateAbortNonceChanges();
    },
    workspaceOutcomeAnswerArrived(arrived: boolean) {
      this.whenWorkspaceOutcomeAnswerArrivedChanges(arrived);
    },
    handCardsBelongToDock(now: boolean, was: boolean) {
      this.whenHandCardsBelongToDockChanges(now, was);
    },
    handOutcomeLive(live: boolean, was: boolean) {
      this.whenHandOutcomeLiveChanges(live, was);
    },
    playComposerReleasable: {
      flush: 'post',
      handler(releasable: boolean): void {
        this.whenPlayComposerReleasableChanges(releasable);
      },
    },
    workspaceOutcomeEmbedded(embedded: boolean, was: boolean) {
      this.whenWorkspaceOutcomeEmbeddedChanges(embedded, was);
    },
    finalGreeneryActive: {
      flush: 'post',
      handler(on: boolean): void {
        this.whenFinalGreeneryActiveChanges(on);
      },
    },
    finaleOverForViewer(over: boolean): void {
      this.whenFinaleOverForViewerChanges(over);
    },
    playerView: {
      immediate: true,
      handler(newView: PlayerViewModel, oldView: PlayerViewModel | undefined) {
        this.whenPlayerViewChanges(newView, oldView);
      },
    },
  },
  methods: {
    /**
     * «Осмотреть» on a fired-passive card whose source is the ENACTED RESOLUTION
     * (Development Craze doubled a placement's bonuses): the resolution's OWN
     * inspector — the one viewer the Parliament's X opens — never a second one.
     * Textual origin: the toast is not the card's physical place.
     */
    onNotificationInspectResolution(resolution: string): void {
      if (this.playerView.game.parliament === undefined) {
        return;
      }
      this.inspectParliament({kind: 'resolution', ids: [resolution], index: 0});
    },
    // ── P27: BOARD INSPECTION MODE (L3) ──────────────────────────────────
    toggleInspection(): void {
      if (this.consoleState.inspecting) {
        this.exitInspection();
        return;
      }
      this.exitScaleInspect(); // the two inspection modes are exclusive
      this.consoleState.inspecting = true;
      // Land on a predictable cell (the last inspected one, else re-seed).
      void this.$nextTick(() => {
        if (this.consoleState.boardSpaceId === undefined) {
          const board = this.surfaces.at<InstanceType<typeof ConsoleBoardSection>>('boardSection');
          board?.seed(false);
        }
      });
    },
    exitInspection(): void {
      this.consoleState.inspecting = false;
      this.consoleState.trackMarker = undefined;
    },
    // ── P27b: SCALE INSPECTION MODE (R3) — the track-bonus ring ─────────
    toggleScaleInspect(): void {
      if (this.consoleState.scaleInspecting) {
        this.exitScaleInspect();
        return;
      }
      this.exitInspection();
      const board = this.surfaces.at<InstanceType<typeof ConsoleBoardSection>>('boardSection');
      if (board?.enterTrackInspect() === true) {
        this.consoleState.scaleInspecting = true;
      } else {
        this.showNotice('Unavailable right now');
      }
    },
    exitScaleInspect(): void {
      this.consoleState.scaleInspecting = false;
      this.consoleState.trackMarker = undefined;
    },
    /** A client-hosted pick folds ONE level back to the door that promised it (nothing was sent). */
    cancelClientPick(): void {
      const pick = this.pendingClientPick;
      // An ANSWERED pick is past its boundary: its batch is on the wire and its scene owed — B is absorbed.
      if (pick === undefined || pick.answered === true) {
        return;
      }
      this.pendingClientPick = undefined;
      pick.onCancel();
    },
    // ── shell-section tasks (T3 projectCard / T4 colony) ─────────────────
    /** Open (or re-open after un-defer) the section that serves the task. */
    /**
     * Land the cursor on the awards surface a funding task just opened:
     * a suspended PRE-COMMIT detail re-seats exactly (RESUME ≠ FRESH-OPEN),
     * else the cursor goes to the first fundable award so A means something
     * at once. Shared by the hosted push (the start's first-action step) and
     * the parked-stack restore.
     */
    seatAwardFundingSurface(): void {
      void this.$nextTick(() => {
        const draft = maFocusState.draft;
        if (draft !== undefined && draft.kind === 'award') {
          const idx = this.maScreenItems.findIndex((it) => it.name === draft.name);
          if (idx !== -1) {
            this.consoleState.sheetIndex = idx;
            openMaFocus(draft.kind, draft.name);
          }
          discardMaFocusDraft();
          return;
        }
        if (maFocusState.open) {
          return;
        }
        const first = this.maScreenItems.findIndex((it) => it.available);
        this.consoleState.sheetIndex = first !== -1 ? first : 0;
      });
    },
    /**
     * The notification card's «Перейти к действию» CTA (window event —
     * PlayerHome's listener doesn't exist in console): bring the pending
     * decision back — un-defer the task, re-open its serving surface,
     * snap to the board for a pending placement.
     */
    onNotificationGoToAction(): void {
      // THROUGH `restoreDeferredTask`, never a copy of its body. This site was
      // a hand-copied older version of it — un-defer + re-open the shell task —
      // written before the park existed, so it cleared the flag the park's own
      // way back is gated on (`mandatoryDeferredActive`) while leaving the
      // frames parked: a minimized card play answered here lost its picks AND
      // became unreachable, since `restoreWorkspaceStack` is only ever called
      // from the restore path this branch was bypassing.
      if (this.consoleState.task.deferred || workspaceStackCollapsed()) {
        this.restoreDeferredTask();
      }
      if (this.placementActive) {
        goBoardHome();
        closeConsoleLayers();
      }
    },
    /**
     * SCENE TRANSITION: where «выйти из партии» actually leads. A campaign
     * mission's honest parent is its campaign map (with the mission identity
     * riding the curtain's context); an ordinary game exits to the main
     * menu. Registered at mount — the campaign contract is immutable for the
     * game's whole life, so no watcher is needed.
     */
    syncGameExitTarget(): void {
      const campaign = this.playerView.game.gameOptions?.campaign;
      if (campaign !== undefined) {
        registerGameExitTarget(
          paths.CAMPAIGN + '?id=' + encodeURIComponent(campaign.campaignId),
          {kind: 'campaign-map', mission: campaign.missionSlot + 1, missionCount: campaign.missionCount},
          'sync');
      } else {
        registerGameExitTarget('/', {kind: 'main-menu'}, 'interface');
      }
    },
    /**
     * THE SHELL IS WHAT ITS CONTROLLERS' PORTS SAY (architecture v2 — `console/shell/shellPort.ts`). Never called: each
     * row is a compile-time proof (vue-tsc) that this component still provides every member a controller taken out
     * of it reads, calls or writes, with the type the controller expects. `scripts/shell-extract.mjs` adds a row per
     * extracted domain; a row goes when its port is empty.
     */
    shellPortsConform(): void {
      const viewerPort: ViewerPort = this;
      void viewerPort;
      const maPort: MaPort = this;
      void maPort;
      const infoPort: InfoPort = this;
      void infoPort;
      const wheelPort: WheelPort = this;
      void wheelPort;
      const cellPort: CellPort = this;
      void cellPort;
      const convertPort: ConvertPort = this;
      void convertPort;
      const railPort: RailPort = this;
      void railPort;
      const journalPort: JournalPort = this;
      void journalPort;
      const supervisorPort: SupervisorPort = this;
      void supervisorPort;
      const seatPort: SeatPort = this;
      void seatPort;
      const draftPort: DraftPort = this;
      void draftPort;
      const finalePort: FinalePort = this;
      void finalePort;
      const playedPort: PlayedPort = this;
      void playedPort;
      const stagedPort: StagedPort = this;
      void stagedPort;
      const cardActionsPort: CardActionsPort = this;
      void cardActionsPort;
      const stdProjectsPort: StdProjectsPort = this;
      void stdProjectsPort;
      const startPort: StartPort = this;
      void startPort;
      const hydroPort: HydroPort = this;
      void hydroPort;
      const parliamentPort: ParliamentPort = this;
      void parliamentPort;
      const colonyPort: ColonyPort = this;
      void colonyPort;
      const placementPort: PlacementPort = this;
      void placementPort;
      const mandatoryPort: MandatoryPort = this;
      void mandatoryPort;
      const revealPort: RevealPort = this;
      void revealPort;
      const outcomePort: OutcomePort = this;
      void outcomePort;
      const routerPort: RouterPort = this;
      void routerPort;
      const playCardPort: PlayCardPort = this;
      void playCardPort;
      const handSelectPort: HandSelectPort = this;
      void handSelectPort;
      const handPort: HandPort = this;
      void handPort;
      const workspacePort: WorkspacePort = this;
      void workspacePort;
      const commandBarPort: CommandBarPort = this;
      void commandBarPort;
      const padRouterPort: PadRouterPort = this;
      void padRouterPort;
      const viewApplyPort: ViewApplyPort = this;
      void viewApplyPort;
    },
    // ── transport ────────────────────────────────────────────────────────
    /** The press's TICKET comes back: `accepted: false` = the funnel was busy and nothing was sent (`gameTransport.SubmitTicket`). */
    submit(response: unknown): SubmitTicket {
      return submitInput(response as InputResponse);
    },
    /** `promptId` — the prompt the batch was COMPOSED for (default: the one standing now; see `gameTransport.submitBatch`). */
    submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket {
      return transportSubmitBatch(responses as ReadonlyArray<InputResponse>, promptId);
    },
    /** …a new prompt is a new entry … */
    whenPromptPresenceIdentityChanges(): void {
      releasePromptPresence();
    },
    /**
     * A CARD'S HYDRONETWORK ENTRY DIES WITH ITS FRAME.
     *
     * B popped the frame, or the finished move unwound the whole stack — either
     * way the lock must go, or the next visit to the track would still believe
     * it is serving that card. Watched HERE, in the always-mounted shell: the
     * action workspace unmounts together with the very frames whose departure
     * this observes, so it cannot be the witness of its own end.
     *
     * Keyed on `workspaceFrameKnown`, so a PARKED hydro frame (the player
     * minimized the move to read the board) keeps its entry intact.
     */
    whenCardDeltaEntryFrameLiveChanges(live: boolean): void {
      if (!live && cardDeltaAdvanceCard() !== '') {
        clearCardDeltaAdvance();
      }
    },
    /** The free-award-funding task ended (submitted / expired / new game) —
     *  a suspended MA detail draft has lost its restore door and must die
     *  with it (a stale draft re-seating in a LATER game is the trap). */
    whenAwardFundingActiveChanges(next: boolean): void {
      if (!next) {
        discardMaFocusDraft();
      }
    },
    // NOTIFICATION X-HOLD safety: the tracked card left the screen (TTL ran
    // out despite the pause safeguard, a flow ack, a queue promotion) or a
    // DIFFERENT card took the top slot — an in-flight hold must die with it,
    // never fire an action for a card the player no longer sees.
    whenTopNotificationChanges(next: LiveNotification | undefined, prev: LiveNotification | undefined): void {
      if (next?.id !== prev?.id) {
        cancelNotifHold();
      }
    },
    /*
     * PATENT-SALE hero staging (consolePatentSale): the sale UI stays up
     * while the picked cards flip + converge (they lift off LIVE hand
     * slots); the moment the stack ENTERS the terminal ('inserting') the
     * hand has physically given the cards away — close the sale mode and
     * return to the board, where the payout chip lands on the resource
     * rail. An error BEFORE this point ('failed' while the sale UI is
     * still open) leaves the player's picks intact — the scene unwinds
     * with zero trace and the transport's alert explains.
     */
    whenPatentSaleStatePhaseChanges(phase: string): void {
      if (phase === 'inserting') {
        // THE RESOLUTION ACTION'S sale (Open IP Trade): the hand STEP has given
        // the cards away — the step leaves, the action workspace STAYS for the
        // terminal's payout and the draw that follows in its own zone.
        if (patentSaleState.source === 'resolution') {
          if (workspaceFrameHost('hand') === 'card-actions' && workspaceStackTop()?.kind === 'hand') {
            leaveWorkspace();
          }
          return;
        }
        // The hand has physically given the cards away — the WHOLE flow closes
        // in one splice (std-projects host included: no flash of the parent
        // list between the sale and the payout chip landing on the rail).
        resetStdProjectsFlow();
        closeConsoleLayers();
        goBoardHome();
      }
      // A sale refused BEFORE the terminal took the stack: the picks are
      // intact (the scene unwinds), so a hosting std-projects frame returns
      // to its reversible configure stage — B must work again.
      if (phase === 'failed' && workspaceFrameHost('hand') === 'standard-projects') {
        setWorkspaceFramePhase('standard-projects', 'configure');
      }
    },
    // PRESENTATION FLOW occupancy: while a console mandatory surface (task
    // host / start scene / gov-support panel) is actively presenting, hold a
    // 'mandatory-choice' lease so transient notifications queue instead of
    // floating over it. Deferred tasks release it (the board is inspectable).
    whenConsoleMandatoryPresentingChanges(presenting: boolean): void {
      if (presenting && this.releasePresentationLease === undefined) {
        this.releasePresentationLease = acquireForegroundLease('mandatory-choice');
      } else if (!presenting && this.releasePresentationLease !== undefined) {
        this.releasePresentationLease();
        this.releasePresentationLease = undefined;
      }
    },
    // Leaving the colonies ends the workspace flow with it: the focus stage
    // folds away and the command-bar mirror is cleared so stale hints can't
    // linger. Reopening always lands on the browse surface.
    //
    // ⚠️ This watcher used to close the HAND's descent too, guarded by a
    // hand-written «unless a colony follow-up is live inside it». Both are gone:
    // `section` is a PROJECTION now, so leaving the hand IS the frame going
    // away, and a frame cannot be removed from under the step it is carrying.
    // That guard-plus-write pair was the soft-lock.
    /** «СРАБАТЫВАНИЕ КАРТЫ» (iteration 3): the player opened a sheet while reactions play — they HURRY (a pace, never a cut). */
    whenConsoleStateSheetChanges(sheet: string | undefined): void {
      if (sheet !== undefined && cardReactionPending()) {
        hurryCardReactions('navigation');
      }
    },
    // The journal closing for ANY reason (mandatory surface, game switch)
    // takes its read-only colony dossier with it.
    whenJournalPanelVisibleChanges(visible: boolean): void {
      if (!visible && this.journalColonyInspect !== undefined) {
        this.closeColonyInspect();
      }
    },
    /** WATCH `consoleForegroundBusy` — the reaction's body (the shell's `watch` table delegates here, in its order). */
    whenConsoleForegroundBusyChanges(busy: boolean, wasBusy: boolean): void {
      // Don't auto-open an interruptive task that is still GATED (announced,
      // not yet opened via B) — it waits for the player's press, not for the
      // foreground to clear (consoleMandatoryGate).
      if (wasBusy && !busy && !this.consoleState.task.deferred && !this.taskGateHeld) {
        const task = taskFor(this.playerView);
        if (task !== undefined && SHELL_SECTION_KINDS.has(task.kind)) {
          this.openShellTaskSurface(task);
        }
      }
    },
    // THE PARLIAMENT'S SITTING FRAME — the same contract: the falling edge
    // (the political phase is over) closes a PHASE-anchored Parliament root,
    // parked or standing. A Parliament the player walked into on their own
    // (an `always` anchor) is not the sitting's and stays.
    whenOffStageDeadAnchorKeyChanges(key: string): void {
      if (key !== '') {
        pruneOffStageDeadFrames();
      }
    },
    /** WATCH `startFrameLive` — the reaction's body (the shell's `watch` table delegates here, in its order). */
    whenStartFrameLiveChanges(live: boolean): void {
      if (live) {
        // `Known`, not `Index`: while the opening is PARKED its frame is set
        // aside, not gone — standing a second one up beside it would mount the
        // scene over the board the player parked it to look at.
        if (!workspaceFrameKnown('start')) {
          enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
        }
      } else {
        // Its OWN anchor went dead — `closeWorkspaceRoot`, never `goBoardHome`:
        // that one deliberately protects a phase root from a step inside it,
        // so using it here would leave the scene mounted for the whole game.
        closeWorkspaceRoot('start');
      }
    },
    // Mirror the live gate-held state into the module so the leak detector (a
    // timer that can't recompute the shell signals) treats a held prompt as
    // legitimately served — the announcement / chip is its surface (A opens it).
    whenMandatoryGateHeldChanges(held: boolean): void {
      setMandatoryGateHeld(held);
    },
    // …and the watchdog's SCOPE: it may only act while the player is on the
    // board home with nothing of their own open (see boardHomeIdle).
    whenBoardHomeIdleChanges(idle: boolean): void {
      setConsoleBoardHomeIdle(idle);
    },
    /** The start ceremony fully resolved (the game began) — release any
     *  residual starting-cards delivery HOLD so the dock can never stick
     *  withheld. The normal flow already cleared it on the flight's landing;
     *  this is the belt-and-braces for a theoretical no-payment path. NOT
     *  fired on defer (`startTask` stays defined while the scene is deferred,
     *  so the hold correctly survives a board inspection). */
    whenStartTaskChanges(now: ConsoleTask | undefined, was: ConsoleTask | undefined): void {
      // Never yank a LIVE flight — its own safety timeout reconciles it. And
      // never a HELD workspace's withhold: `startTask` flickers undefined in
      // every prompt gap of the deployment (submit round trips), while the
      // bought cards must stay out of the dock until the payment flies them in.
      if (now === undefined && was !== undefined && !startSceneHeld() &&
          handDeliveryState.held.length > 0 && !isHandDeliveryActive()) {
        resetHandDelivery();
      }
    },
    /** The workspace itself let go (the deployment settled / the game moved
     *  on) — a latch without its scene is meaningless, and it must never
     *  leak into a rematch. */
    whenStartSceneServesChanges(now: boolean): void {
      if (!now && boardExcursionActive()) {
        releaseBoardExcursion();
      }
    },
    /** THE SEAT'S FINALE IS OVER (the server's fact / the END): the session ends, the camera and the dossier let go. */
    whenFinaleOverForViewerChanges(over: boolean): void {
      if (over) {
        endFinaleSession();
      }
    },
  },
  mounted() {
    // THE CURSOR ARRIVES (TR58): a step or a press during an arrival releases it — input never waits for a ring.
    installCursorArrivalInput();
    // THE START YIELDS ITS SCENE, NOT ITS FRAME (the reliability iteration): while it does, the board is on screen.
    registerBoardShownDespiteStack(() => this.startSceneMounted && !this.startSceneVisible &&
      workspaceStackState.frames.length === 1 && workspaceStackState.frames[0].kind === 'start');
    // THE START SHADOW's reader (phase 0) — the findings so far and the judged state right now.
    (window as unknown as {__conStartShadow?: () => unknown}).__conStartShadow = () => ({
      findings: [...startShadowLog.findings], judged: startShadowLog.judged, now: this.startShadowNow,
    });
    // THE SCREEN SHADOW (`screenDirector.ts`, phase 0) — the leak detector's 1 Hz pass judges every question past the
    // opening; the shell supplies what only it knows (the start owns the opening; the admission block on the surface).
    resetScreenShadowLog();
    registerReadinessDecisionDiag(() => ({
      raw: this.rawEffectDecisionVm !== undefined, vm: this.effectDecisionVm !== undefined,
      belongs: this.effectDecisionBelongsToWorkspace, heldForWorkspace: this.effectDecisionHeldForWorkspace,
      active: this.effectDecisionActive, rendered: this.effectDecisionRendered,
      askedNothing: this.viewerAskedNothing, offTurn: this.viewerAskedOffTurn,
      gateHeld: this.mandatoryGateHeld, presented: this.mandatoryActionPresented, plate: this.mandatoryAnnounceVisible,
      beacon: this.mandatoryChipAttention, servedHere: this.promptServedWhereIStand, ownedByClaim: this.promptOwnedByClaim,
      hostBlock: this.playerView.waitingFor === undefined ? '' : promptAdmissionBlock('host', this.admissionSignals) ?? '',
      // The start's pad and the prelude chain (P58 · FS — the order step's two hosts).
      start: {ownsPad: this.startSceneOwnsPad, visible: this.startSceneVisible, serves: this.startSceneServes,
        promptSurface: this.startPromptSurfaceStands, excursion: this.startExcursionHolds, sheet: this.consoleState.sheet ?? '',
        section: this.consoleState.section, deferred: this.consoleState.task.deferred, deckPick: this.deckPickServing},
      chain: {live: preludePlayChainState.live, host: preludePlayChainState.host, yielded: stackYieldedToBoard(),
        host2: this.hostTask === undefined ? '' : `${this.hostTask.kind}${'flavor' in this.hostTask ? ':' + String(this.hostTask.flavor) : ''}`,
        embed: this.taskEmbedTarget ?? ''},
    }));
    // STEP 4 — the owner's armed classes (`SCREEN_CURE_DEFAULT_ARMED`: the blind announce); a stand names its own set
    // (`?screenCure=open,restore,yield,announce` / `all` / `none`).
    screenCureArming.armed = screenCureArmingFor(new URLSearchParams(window.location.search).get('screenCure'));
    registerScreenCureExecutor((plan) => this.runScreenDirectorCure(plan));
    // THE ANCHOR RULE: the stack's return doors and prunes ask the shell which phases are over, and name what they drop.
    registerFrameAnchorDead((anchor) => this.frameAnchorIsDead(anchor));
    // A frame's beat past its own bound (the frame machine's structural net — the arbiter cuts a quiet beat much sooner):
    // the same teardown the arbiter's rung runs.
    registerFrameBeatExpired((kind, phase) => this.forceRecoverStuckWorkspace(kind, `[workspace-stall] beat «${kind}:${phase}» torn down at the frame's own bound`));
    registerAnchorDropListener(({home, kinds}) => {
      console.warn(`[workspace-anchor] dropped ${kinds.join(', ')} (${home}) — its phase is over; it does not come back`);
    });
    // THE CURE STAND'S SEAM (`?screenControl=1` only): a latch bug put in on purpose — the stack dropped, or a foreign
    // workspace stood up, behind the product's back.
    if (new URLSearchParams(window.location.search).get('screenControl') === '1') {
      (window as unknown as {__conScreenControl?: unknown}).__conScreenControl = {
        dropStack: () => goBoardHome(),
        standWorkspace: (kind: WorkspaceFrameKind) => enterWorkspace(kind),
        // A NOTIFICATION-ONLY hold the screen handoff waits for and the task host's admission does not — the class of a
        // card into the dock / a token wave at a sitting's close (the «К драфту» stand: no legacy browser in the wait).
        holdScreen: (ms: number) => {
          // The seam's own recovery is its release: a ceiling ends the owed screen exactly as the timer would.
          const owned: {hold?: AnimationHold} = {};
          const release = () => owned.hold?.release();
          owned.hold = beginAnimationHold('screen-control-owed', {scope: 'notification-only', expire: release});
          consoleSessionScope().guarantee(ms, 'ConsoleShell: a release\'s bound', release);
        },
        // A DEFECT PUT IN ON PURPOSE is declared to the liveness arbiter: the screen shadow's live control hides a
        // question's surface for a few seconds to prove the shadow names it, and the arbiter (a stranded question is
        // judged at 4 s) would cure that very defect first. The window is named and bounded; `0` ends it.
        declareDefect: (ms: number) => {
          this.declareScreenControlDefect(ms);
        },
      };
    }
    registerScreenShadowContext(() => {
      const wf = this.playerView.waitingFor;
      const block = wf === undefined ? undefined : promptAdmissionBlock(wf.type === 'space' ? 'placement' : 'host', this.admissionSignals);
      return {
        startOwned: this.startSceneMounted,
        admission: block ?? '',
        announce: !this.mandatoryGateHeld ? 'none' : isMandatoryBeatPresented(this.mandatoryBeat) ? 'presented' : 'pending',
      };
    });
    // THE WAIT GRAPH's evidence (Э2): the last snapshot's nodes, the counts, the standing streaks.
    (window as unknown as {__conWaitGraph?: () => unknown}).__conWaitGraph = () => JSON.parse(JSON.stringify({...waitGraphSnapshot(), ceilings: ceilingStats})) as unknown;
    (window as unknown as {__conScreenShadow?: () => unknown}).__conScreenShadow = () => ({
      findings: [...screenShadowLog.findings], judged: screenShadowLog.judged,
      stats: JSON.parse(JSON.stringify(screenShadowLog.stats)) as unknown,
      cure: {
        armed: [...screenCureArming.armed],
        standing: screenShadowStanding.plan === undefined ? null : screenCurePlanText(screenShadowStanding.plan),
      },
    });
    // A decision that IS its pick standing at boot (a reload mid-prompt) opens its album — the watcher is not
    // `immediate`, so the mount edge is asked here.
    this.openEffectDecisionPick(this.effectDecisionDirectPick);
    // …and a FINALE standing open at boot (a reload mid-finale): the watcher is not `immediate`, so its mount edge
    // is asked here — the board takes the pick once the shell has rendered.
    void this.$nextTick(() => {
      if (this.finalGreeneryActive) {
        this.openFinalGreeneryOnBoard();
      }
    });
    // A CHOSEN TRACK's move (TR07) is seeded only while the stage that will play it stands — the shell knows.
    registerColonyTrackMoveHost((colony) => workspaceFrameKnown('colonies') && this.colonyFocus.open && this.colonyFocus.colonyName === colony);
    // A ROSTER change somebody else made is played on the colony GRID — only while that grid is what the player is
    // looking at: the colonies frame on top, browsing (no stage, no dossier), the in-game table on the rail.
    registerColonyRosterHost(() => this.consoleState.section === 'colonies' && workspaceFrameRenders('colonies') &&
      !this.colonyFocus.open && !this.colonyRailIsCatalog && !colonyTradeState.active && !isColonyBuildActive());
    // The e2e readiness probe (`window.__conReady`) — read-only snapshots of
    // the holds/transport/stack facts this shell already stands on. Installed
    // here so the aggregator adds no new edges to any import graph.
    installConsoleReadinessProbe();
    // THE RELEASE FUNNEL'S GUARD (consoleWorkspaceOutcome): a claim serving a
    // live prompt/batch whose host frame still stands cannot be released out
    // from under the player. The evidence lives in the shell (the raw
    // `waitingFor`, the server's unconsumed reveals), so the shell registers
    // the one probe; the module refuses on its own.
    setWorkspaceOutcomeServingProbe(() => this.workspaceOutcomeServingNow);
    // THE HYDRO FLOW-CLOSE WITNESSES (consoleHydroFlow → presentationLedger):
    // the committed flow's close chain is edge-driven, and a missed edge used
    // to wedge the workspace until some unrelated 20–30 s safety shook it.
    // The shell registers the facts only it has (the busy conjunction, the
    // result hold's timer, the server position) and the witnesses re-drive
    // the flow's OWN doors within one grace window.
    registerHydroFlowProbe({
      busy: () => this.hydroResolutionBusy,
      resultHoldArmed: () => this.hydroResultTimer !== undefined,
      serverAtDestination: () => {
        const c = this.hydroFlow.commit;
        return c !== undefined && (this.thisPlayer.deltaProject?.position ?? -1) === c.toPosition;
      },
      drive: () => this.driveHydroFlowStuck(),
    });
    this.offHydroWitnesses = installHydroFlowWitnesses();
    // (THE WORKSPACE-CONCLUSION TIME NET is gone — architecture v2 · S5. An owed ending is a run in its frame's scope
    // that wakes on the decision's own facts and re-asks on its own cadence, `workspaceConclusionOwe.ts`; the truth
    // witness that re-drove a hand-listed signal's misses every half second has nothing left to witness.)
    // THE BOARD-BEAT PARK'S «watchable» verdict (boardBeatPark) — coverage
    // facts only, shell-owned. Registered at mount, so a reload that lands
    // with a parked batch (server reveals survive the trip) re-parks or
    // drains against the real screen; the mount-edge drain below covers the
    // watcher's blind spot (a watcher never fires on its initial truth).
    registerBoardWatchableProbe(() => this.boardBeatsWatchable);
    // THE GENERATION SCENE'S RISE waits for the screen handoff (state delivery, 2026-10-28): the scene holds the
    // foreground itself through the wait, so its own label is the one the director ignores.
    registerGenerationSceneHandoff((id, into) => waitScreenHandoff(id, {
      ignoreHolds: ['generation-scene'],
      // A rise INTO THE SITTING waits for the player's own owed objects only (see `enterWorkspaceAfterHandoff`).
      ...(into === 'parliament' ? PARLIAMENT_DOOR : {}),
    }));
    // …and «a workspace surface is still LEAVING» — the bridge counts a
    // `.con-ws` through its whole fade, so the scale story starts on a board
    // the player can actually see (never under a dissolving workspace).
    registerBoardBeatSurfaceProbe(() => conWsPresence.wsOpen);
    // …and the QUEUE skips what the park holds: a parked Venus draw must not
    // wall the workspace's own batch behind it (drawnCardsState — the queue
    // park), the same verdict `rawDrawnRevealPending` subtracts.
    // …and a ledger row's batch whose turn has not come (`colonyBonusPayoutParksReveal` — TR23).
    // …and ONE verdict for the batch (`revealBatchParked` — the card-intake law's R7: a park holds a batch by its
    // ROOT, and a batch a workspace claims is never held out of its own zone by the board beat).
    this.releaseRevealQueuePark = registerRevealQueuePark((batch) => this.revealBatchParked(batch));
    // …and the ledger's redrive rides the shell's GUARDED drain (the one
    // that folds board cinematics + the read admission in) — the bare
    // module drain is only the desktop/test default.
    registerBoardBeatRedrive(() => this.drainBoardBeats());
    void this.$nextTick(() => this.drainBoardBeats());
    // «МАРС ТЕРРАФОРМИРОВАН» (TR70 — `terraformedScene.ts`): the scene is a BOARD BEAT and waits for a board the
    // player can see — the field's story over (the tile hero, the payouts, a remote landing, the camera), no
    // reveal standing or pending, no cards in flight, no discard settling, no generation scene mid-phrase; and
    // whether a SECTION stands on the board's slot (the board is then faded in under it for the scene).
    registerTerraformedSceneProbes({
      quiet: () => {
        const s = this.rawAdmissionSignals;
        return !boardSceneSettling() && !s.revealOpen && !s.revealPending && !s.cardArrival && !s.cardDiscard &&
          !s.playedHero && !s.tileHero && !s.boardBonus && !isPlanetFocusEngaged() && !this.planetFocusState.arcsReturning &&
          generationSceneState.phase === 'idle';
      },
      sectionCovered: () => this.consoleState.section !== 'board',
      playerOwned: () => this.rawAdmissionSignals.revealOpen || this.rawAdmissionSignals.revealPending,
    });
    // READ-ONLY e2e/diagnostics probe: the nested-continuation state in one
    // snapshot (the e2e specs dump it on a failure instead of guessing from
    // pixels). Never used by product code.
    // READ-ONLY e2e/diagnostics probe (same idiom): «МАРС ТЕРРАФОРМИРОВАН» (TR70) — the scene's phase (the ARMED wait
    // has no DOM of its own), what it holds and the camera it rides; a storyboard reads the product's own tact off this.
    (window as unknown as Record<string, unknown>).__conTerraformedDiag = () => ({
      phase: terraformedSceneState.phase,
      stage: terraformedSceneState.stage,
      nonce: terraformedSceneState.nonce,
      showNonce: terraformedSceneState.showNonce,
      skipped: terraformedSceneState.skipped,
      final: terraformedSceneState.final,
      lastEnd: terraformedSceneState.lastEnd,
      up: terraformedSceneUp(),
      parkHeld: boardBeatParkState.sceneHeld,
      camera: {phase: this.planetFocusState.phase, mode: this.planetFocusState.mode},
    });
    // READ-ONLY e2e/diagnostics probe (same idiom): the Hydronetwork's commit
    // flow with its close gate BROKEN DOWN INTO ITS TERMS. The flow reaches
    // its result stage on the FALLING EDGE of `hydroResolutionBusy`, so a
    // single stuck term reads from the outside as «the track never played its
    // result» — the symptom, three screens away from the cause.
    (window as unknown as Record<string, unknown>).__conHydroDiag = () => ({
      commit: this.hydroFlow.commit === undefined ? null : {
        phase: this.hydroFlow.commit.phase,
        toPosition: this.hydroFlow.commit.toPosition,
        kind: this.hydroFlow.commit.kind,
      },
      step: this.hydroFlow.step ?? null,
      repeatBridge: this.hydroFlow.repeatBridge,
      resolutionBusy: this.hydroResolutionBusy,
      busyTerms: {
        markerGliding: isHydroMarkerActive(),
        rewardHeld: hydroRewardHoldOwed(),
        transfersFlying: isResourceTransferActive(),
        ceremony: isHydroCeremonyActive(),
        followUpInteractive: this.hydroFollowUpLive,
        traversalPending: hydroTraversalPending(),
        intakeFlying: this.cardArrivalBusy,
        ceremonyOwed: hydroCeremonyOwed(),
      },
      parked: {
        deferred: this.consoleState.task.deferred,
        collapsed: workspaceStackCollapsed(),
      },
      // The module's own transition trail (bounded ring) — a field wedge
      // names its last edges instead of demanding a reproduction.
      trail: hydroFlowTrail(),
    });
    (window as unknown as Record<string, unknown>).__conColonyDiag = () => ({
      // THE STACK IS THE SNAPSHOT — one ordered list instead of five flags that
      // had to be read together and could disagree.
      stack: workspaceStackState.frames.map((f) => ({
        kind: f.kind, subject: f.subject, stage: f.stage, phase: f.phase,
        overlay: f.overlay, slot: f.slot, anchor: f.anchor.type,
      })),
      parked: workspaceStackState.parked.map((f) => f.kind),
      // The STD-PROJECTS flow, for the acceptance probes: «which project, how
      // far along, and is a cancel in flight» is the one thing the stack alone
      // cannot say (the frame phase is shared by several of its states).
      stdpFlow: {
        state: stdProjectsFlow.state,
        card: stdProjectsFlow.card,
        cancelRequested: stdProjectsFlow.cancelRequested,
        excursion: stdProjectsFlow.boardExcursion?.card ?? null,
      },
      hostKind: workspaceFrameHost('colonies') ?? null,
      embedTarget: this.colonyEmbedTarget ?? null,
      promptRaw: this.colonyPromptRaw,
      // …and whether its own DOOR is open yet: a prompt that is live while its
      // surface is deliberately held is the state the sequencing probes read
      // («one press, several effects» — the previous one is still being worked
      // through). `owedStep` is the same fact from the FLOW's side.
      promptOpenable: this.colonyPromptOpenable,
      owedStep: this.followUpStepOwed,
      followUp: this.colonyFollowUpLive,
      section: this.consoleState.section,
      sheet: this.consoleState.sheet ?? null,
      sponsorEmbed: this.startSponsorEmbed,
      taskDeferred: this.consoleState.task.deferred,
      wfType: this.playerView.waitingFor?.type ?? null,
      // The COLONY RESOLUTION's lifecycle, for the e2e timeline probes.
      outcomeHost: workspaceOutcomeState.host ?? null,
      outcomeStage: workspaceOutcomeState.stage,
      // The claim's own identity — «why didn't this batch match» is decided
      // by these three, and reading them from pixels is impossible.
      outcomeKinds: [...workspaceOutcomeState.kinds],
      outcomeScope: workspaceOutcomeState.scope,
      outcomeSourceCard: workspaceOutcomeState.sourceCard,
      outcomeSlot: workspaceOutcomeState.embedSlot,
      tradeActive: colonyTradeState.active,
      // The COVER SCENE's own state: a scene stuck past its last beat holds
      // the pad (isColonyTradeInputLocked), which reads on screen as «the card
      // is there and А does nothing» — the one symptom with no other tell.
      cardScene: colonyTradeState.cardScene,
      tradePhase: colonyTradeState.phase,
      // The reward TRANSACTION and the transfer framework's own trail —
      // «the chip never flew» vs «it flew onto nothing» are told apart here.
      trade: colonyTradeDiagnostics(),
      transfer: resourceTransferDiagnostics(),
      // WHICH batches the cover scene claimed vs which are still on the table:
      // the reset glide's gate is «every staged batch was taken», and the two
      // lists are the only way to see it disagree with the screen.
      stagedIds: [...colonyTradeState.stagedRevealIds],
      liveReveals: drawnCardsState.events.map((e) => `${e.id}:${e.cards.length - e.takenIndices.size}${e.dismissed ? 'D' : ''}`),
      glideNonce: colonyTradeState.glideNonce,
      inputLocked: isColonyTradeInputLocked(),
      arrivalPending: workspaceOutcomeBeatPending(),
      resolutionLive: this.colonyResolutionLive,
      // …and WHAT is holding it: server evidence, or only the client-armed
      // entry. A resolution live on the entry ALONE past its bounded wait is
      // the latch this pair exists to make visible.
      resolutionEvidence: this.colonyResolutionEvidence,
      entry: {colony: this.bonusEntry.colonyName, awaiting: this.bonusEntry.awaiting},
      revealPending: this.rawDrawnRevealPending,
      // THE MOUNT DECISION OF THE REVEAL, term by term (`consoleRevealMode` → `revealOverlayMode`): «the payout
      // never presented» has a dozen possible holders and every one of them is a read of these, never a pixel.
      revealDecision: ((): Record<string, unknown> => {
        const ev = currentRevealEvent();
        return {
          event: ev === undefined ? null : {id: ev.id, cards: ev.cards.length, taken: ev.takenIndices.size, dismissed: ev.dismissed,
            source: ev.source?.type === 'colony' ? `colony:${ev.source.colonyName}:${ev.source.trade?.role ?? '-'}` : ev.source?.type ?? null},
          mode: this.consoleRevealMode ?? null,
          overlayMode: this.revealOverlayMode ?? null,
          embedTarget: this.revealEmbedTarget ?? null,
          rawPending: this.rawDrawnRevealPending,
          heldForWorkspace: this.revealHeldForWorkspace,
          heroHolds: this.playedHeroHolds,
          tileHolds: this.tilePlacementHolds,
          deckHolds: deckDrawHolds(),
          remotePark: ev !== undefined && remoteColonyBonusParksReveal(this.remoteColonyBonusPending, ev.source),
          payoutPark: ev !== undefined && colonyBonusPayoutParksReveal(ev.source),
          embedSlot: workspaceOutcomeState.embedSlot,
          beatPending: workspaceOutcomeBeatPending(),
          presented: ev !== undefined && revealPresented(ev.id),
          exitBarrier: ev !== undefined && this.exitBarrierHolds(ev.id),
          exitBusy: this.cardStageExitBusy,
          adoption: this.outcomeAdoptionDecision.kind,
          discardStage: colonyResolutionUi.discardStage,
          restorePending: this.colonyFocusRestorePending,
          focusOpen: this.colonyFocus.open,
        };
      })(),
      // The COVER-LIFT scene (a colony BUILD's card bonus rides it, exactly as
      // a board cell's does). Its phase ladder is the only way to tell «the
      // flight played» from «the cards just appeared»: an `idle` scene next to
      // a live colony reveal is the missing-animation signature.
      bonusScene: {
        active: boardCardBonusState.active,
        phase: boardCardBonusState.phase,
        source: boardCardBonusState.source.kind,
        staged: boardCardBonusState.stagedEventId ?? null,
      },
      // ⚠️ The reason is ONE line (`«reason» @ms`) — the old `.split('\n')
      // .slice(1)` here dropped it entirely, so every probe read «nobody
      // released it» while the claim was demonstrably gone. Raw, verbatim.
      lastRelease: lastOutcomeReleaseStack,
      // THE START WORKSPACE'S LIFE, for the first-action probes: «why is the
      // frame still here / why did it go» has five terms, and reading them
      // from pixels is guesswork (the frame's disappearance and the claim's
      // release look identical on screen — one causes the other).
      start: {
        frameLive: this.startFrameLive,
        serves: this.startSceneServes,
        held: startSceneHeld(),
        task: this.startTask?.kind ?? null,
        owed: firstActionOwed(this.playerView),
        inFlow: corpFirstActionInStartFlow(this.playerView),
        outcomeSource: workspaceOutcomeState.sourceCard,
        mounted: this.startSceneMounted,
        stage: consoleStartState.firstAct.stage,
      },
    });
    // Phase D of the discard cinematic reuses the ORDINARY hand-close episode;
    // the transaction awaits this instead of the shell watching a phase.
    registerDiscardOverlayHandoff((discarded) => this.handOffHandForDiscard(discarded));
    // …and a card action's PRE-SELECTED discard (P68): armed at the composer's press, the cards leaving from the dock.
    registerPreselectedDiscardArm((names, meta) => this.armDiscardScene(names, meta));
    // An «Компоновка альбома» flip while the hand album is OPEN rides the
    // same measured FLIP episode a filter change uses: cards glide and scale
    // into the new composition, the out-of-capacity ones exit to the page
    // packets, and focus keeps its CARD (the page holding it opens by
    // derivation). Anywhere else the preference applies directly — the next
    // open lands in the chosen composition from its first frame.
    setAlbumLayoutRecomposer((apply) => {
      if (this.consoleState.section === 'hand' && handRevealState.phase === 'open') {
        this.applyHandFilterChange(apply);
      } else {
        apply();
      }
    });
    this.offIntent = registerConsoleIntentHandler((intent) => this.handleIntent(intent));
    // The `.con-ws` / planet-focus DOM-presence flags (the ex-`:has()` rules)
    // — one observer on the shell root, folded into conRootClasses.
    this.offWsPresence = installConWsPresenceBridge(this.$el as HTMLElement);
    // The console-mode <html> class is owned by GamepadLayer (it spans every
    // lifecycle screen); the shell only reports its own presence.
    this.consoleState.shellMounted = true;
    resetMandatoryGate(); // a fresh shell starts with no acknowledged beat
    resetNotifHold(); // a fresh shell never inherits a mid-flight X-hold
    // The board-beat park reads the LIVE committed parameters through this
    // source at its drain's release — the accent names exactly the scales
    // that moved (the playerView root identity changes every response, so
    // the module can never hold an object reference itself).
    this.offPlanetFocusParams = registerBoardBeatLiveParams(
      () => captureGlobalParams(this.playerView.game));
    // The hand-reveal director owns WHEN the section switches during its
    // episodes (and re-seats the grid scroll on a mid-close reopen).
    setHandRevealHooks({
      // The director owns WHEN the hand appears / goes home during an episode;
      // it asks in the shell's vocabulary, and the shell answers with the verb.
      setSection: (s) => {
        if (s === 'hand') {
          this.openHandWorkspace();
          return;
        }
        // THE SHARED LAW (`handExitVerb`): a HOSTED hand pops ONE level (the
        // host keeps the room and its own flow continues — `goBoardHome` here
        // wiped the whole stack out from under the colony resolution the
        // instant the gather finished), and a hand whose OWN flow is still owed
        // does not leave at all. The home verb belongs only to a hand standing
        // alone with nothing left to host.
        const verb = this.handExitVerb();
        if (verb === 'pop') {
          leaveWorkspace();
        } else if (verb === 'home') {
          goBoardHome();
        }
      },
      restoreScroll: (px) => {
        (this.surfaces.at<InstanceType<typeof ConsoleHandSection>>('handSection'))?.restoreScroll(px);
      },
    });
    // Clear any scale-overview tooltip a stray real-mouse hover left showing
    // before the shell reported its presence (mouse tooltips are suppressed in
    // console mode from here on — see ArcScale.mouseTooltipsSuppressed).
    hideScaleTooltip();
    // THE DOOR'S MOUNT EDGE. A reload with a card-granted bonus move already on
    // the wire computes its door as `open` on the very first evaluation, so no
    // change watcher can ever fire for it — the workspace never opened and the
    // prompt was genuinely stranded. Asked HERE, not with `immediate`: an
    // immediate handler runs at setup, before there is a shell to enter a
    // workspace from.
    this.syncHydroBonusDoor();
    startConsoleLeakDetector(() => this.playerView);
    // THE BEAT STALL GUARD: a machine beat with nothing in flight is a stall, whatever its cause (the R&D Funding freeze).
    this.startSupervisor();
    // THE PARK MUST NOT SILENCE THE FEED (the «Экран завис» deadlock). A
    // foreign colony bonus's batch is deliberately presented NOWHERE until the
    // player opens its announcement — and the announcement's own FIRST
    // presentation waits for the notification feed to settle. Counted as a
    // live result-modal, the parked batch silenced the very feed its door was
    // waiting for, and only the foreground watchdog got out (`expired
    // result-modal`). The shell owns the park verdict, so it injects it: the
    // SAME pending + parks pair `rawDrawnRevealPending` reads, never a second
    // derivation — the silence and the surface cannot disagree about the batch.
    // …and the BOARD-BEAT park is the second member of the same exemption:
    // a global-parameter batch waiting out a covered board is presented
    // NOWHERE by design, and must not read as a live result-modal either.
    // …and the parliament's Agenda CARD park is the third (same law, same shape).
    this.releaseRevealParkSupplier = registerRevealParkSupplier((batch) => this.revealBatchParked(batch));
    // FK — THE CARD'S CORNER: a full-bleed inspection (the card / party dossier viewer) stands where the card would;
    // a NEW card waits in the queue (its tail is the beacon) and presents when the viewer leaves (PL-680). (The
    // received-cards reveal claims the corner itself — FL; never a read of this shell's computeds from here.)
    this.releaseNotificationCorner = registerNotificationCornerProbe(() => consoleCardZoom.card !== undefined);
    // T6: the notification CTAs go through the typed notificationBus;
    // PlayerHome's listeners don't exist in console — the shell answers them.
    (this as unknown as {__notifOff: Array<() => void>}).__notifOff = [
      notificationBus.goToAction.on(this.onNotificationGoToAction),
      notificationBus.cancel.on(this.onNotificationCancel),
      notificationBus.openParliament.on(this.onNotificationOpenParliament),
      notificationBus.inspectResolution.on(this.onNotificationInspectResolution),
    ];
    // SCENE TRANSITION (the game destination). Register where «выйти из
    // партии» leads — a campaign mission returns to ITS campaign map, an
    // ordinary game to the main menu; every exit door funnels through
    // exitGameToMenu() so the destination can never diverge between doors.
    this.syncGameExitTarget();
    // …and hold the boot curtain until this shell's FIRST frame is real:
    // fonts settled (a fallback-font swap moves layout) and — when the boot
    // state demands the start workspace — the start scene actually rendered,
    // so a new game reveals INTO its opening composition, never onto a bare
    // board a workspace then pops over. The board section registers its own
    // geometry-convergence hold. Every hold is bounded by the director.
    if (loadingScreenState.phase === 'covering') {
      const releaseFonts = deferSceneReveal('fonts', 3000);
      const fonts = (document as Partial<Document>).fonts;
      if (fonts !== undefined) {
        void fonts.ready.then(() => releaseFonts());
      } else {
        releaseFonts();
      }
      if (this.startFrameLive) {
        const releaseStart = deferSceneReveal('start-scene', 8000);
        const settle = () => void this.$nextTick(() => releaseStart());
        if (this.startSceneVisible) {
          settle();
        } else {
          const stop = this.$watch(
            () => this.startSceneVisible,
            (visible: boolean) => {
              if (visible) {
                settle();
                stop();
              }
            });
        }
      }
      armSceneDestination();
    }
  },
  beforeUnmount() {
    // ── THE SHELL'S OWN WIRING GOES FIRST: a dead shell's closures (its probes, suppliers, hooks and leases) must not
    //    drive what the teardown below does — or the next game. ──
    registerGenerationSceneHandoff(undefined); // a dead shell's director must not gate the next game's rise
    handoffPendingEntries.clear();
    this.stopSupervisor(); // the liveness arbiter dies with its shell (the start watchdog and its shadow are its scope's)
    delete (window as unknown as {__conStartShadow?: unknown}).__conStartShadow;
    registerScreenShadowContext(undefined);
    registerScreenCureExecutor(undefined);
    registerFrameAnchorDead(undefined);
    registerFrameBeatExpired(undefined);
    registerAnchorDropListener(undefined);
    registerReadinessDecisionDiag(undefined);
    delete (window as unknown as {__conScreenShadow?: unknown}).__conScreenShadow;
    delete (window as unknown as {__conWaitGraph?: unknown}).__conWaitGraph;
    delete (window as unknown as {__conScreenControl?: unknown}).__conScreenControl;
    registerBoardShownDespiteStack(undefined);
    setConsoleTaskHandoffPending(false);
    registerColonyTrackMoveHost(undefined);
    registerColonyRosterHost(undefined);
    this.offIntent?.();
    this.offWsPresence?.();
    this.offHydroWitnesses?.();
    this.offHydroWitnesses = undefined;
    registerHydroFlowProbe(undefined); // a dead shell's closures must not drive the next game
    this.offPlanetFocusParams?.();
    registerTerraformedSceneProbes(undefined);
    this.releaseRevealQueuePark?.();
    this.releaseRevealQueuePark = undefined;
    registerDiscardOverlayHandoff(undefined);
    registerPreselectedDiscardArm(undefined);
    setAlbumLayoutRecomposer(undefined);
    this.releasePresentationLease?.();
    this.releasePresentationLease = undefined;
    // Restore the default reveal-park supplier: a dead shell's closure reads
    // computeds whose effects are stopped at unmount.
    this.releaseRevealParkSupplier?.();
    this.releaseRevealParkSupplier = undefined;
    this.releaseNotificationCorner?.();
    this.releaseNotificationCorner = undefined;
    this.consoleState.shellMounted = false;
    setMandatoryGateHeld(false); // shell gone → clear the held mirror (the watcher won't fire on unmount)
    // The claim's serving probe goes before the claim's own reset (in the pass below): a dead shell's computeds must
    // never guard the next game's releases — the reset itself is forced either way.
    setWorkspaceOutcomeServingProbe(undefined);
    // ── THE GAME SCREEN LEAVES. Every module that keeps state of the running game DECLARED it beside its own reset
    //    (`sessionState(label, reset, at)`), and the session takes all of it down here in ONE ordered pass — the list
    //    of `reset…()` rows this hook used to be (66 of them; a module missing from it leaked into the next game) is
    //    gone (architecture v2 — PLAN §10 · C5). The session's SCOPE — every flow, hold, timer and wait of the game —
    //    ends in `unmounted`, after the shell's children. ──
    leaveConsoleSession();
    // ── …and what is the shell instance's own. ──
    this.zoomOpenToken++; // fence out any stale open-sequence callback
    this.clearZoomOpenFlight();
    document.body.classList.remove('con-zoom-open');
    document.body.classList.remove('con-play-modal-open');
    this.clearDepartingPlayCard();
    (this as unknown as {__notifOff?: Array<() => void>}).__notifOff?.forEach((off) => off());
  },
});
</script>
