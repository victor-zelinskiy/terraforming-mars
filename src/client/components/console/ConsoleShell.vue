<template>
  <div ref="conRootEl" class="con-root" :class="conRootClasses">
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
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';


import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';

import ConsoleBoardBinder from '@/client/components/console/ConsoleBoardBinder.vue';
import ConsoleBoardInput from '@/client/components/console/ConsoleBoardInput.vue';

import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import ConsoleTerraformedTitle from '@/client/components/console/ConsoleTerraformedTitle.vue';
import ConsoleBotTurnReview from '@/client/components/console/ConsoleBotTurnReview.vue';
import ConsoleCommandBar from '@/client/components/console/ConsoleCommandBar.vue';
import ConsoleHandDock from '@/client/components/console/ConsoleHandDock.vue';
import ConsoleSheet from '@/client/components/console/ConsoleSheet.vue';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import ConsoleMaCeremony from '@/client/components/console/ConsoleMaCeremony.vue';
import ConsoleQuickSelector from '@/client/components/console/ConsoleQuickSelector.vue';
import ConsoleStdProjectsScreen from '@/client/components/console/ConsoleStdProjectsScreen.vue';

import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
import ConsoleStrategyRail from '@/client/components/console/ConsoleStrategyRail.vue';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import ConsoleHandSection from '@/client/components/console/ConsoleHandSection.vue';
import ConsoleResourcePanel from '@/client/components/console/ConsoleResourcePanel.vue';
import ConsoleColoniesSection from '@/client/components/console/ConsoleColoniesSection.vue';
import ConsoleParliamentSection from '@/client/components/console/ConsoleParliamentSection.vue';
import ConsoleResolutionAside from '@/client/components/console/parliament/ConsoleResolutionAside.vue';
import ConsolePartyAccessPanel from '@/client/components/console/parliament/ConsolePartyAccessPanel.vue';
import ConsoleInfoMode from '@/client/components/console/ConsoleInfoMode.vue';
import ConsoleStrandedPrompt from '@/client/components/console/ConsoleStrandedPrompt.vue';
import ConsoleSystemAlert from '@/client/components/console/ConsoleSystemAlert.vue';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import ConsoleGovernmentSupport from '@/client/components/console/ConsoleGovernmentSupport.vue';
import ConsoleEffectDecision from '@/client/components/console/ConsoleEffectDecision.vue';
import ConsoleProductionLoss from '@/client/components/console/ConsoleProductionLoss.vue';
import ConsoleDeckPick from '@/client/components/console/deckPick/ConsoleDeckPick.vue';
import ConsoleDeckPickLayer from '@/client/components/console/deckPick/ConsoleDeckPickLayer.vue';
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import ConsoleEndgameWorkspace from '@/client/components/console/ConsoleEndgameWorkspace.vue';
import ConsoleRevealOverlay from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsoleDrawSearchRule from '@/client/components/console/foundation/ConsoleDrawSearchRule.vue';
import ConsoleTeleport from '@/client/components/console/foundation/ConsoleTeleport.vue';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import ConsoleCorpFirstActionConfirm from '@/client/components/console/ConsoleCorpFirstActionConfirm.vue';
import ConsoleCardExitLayer from '@/client/components/console/cardDeal/ConsoleCardExitLayer.vue';
import ConsoleCardDiscardLayer from '@/client/components/console/cardDiscard/ConsoleCardDiscardLayer.vue';
import ConsoleDiscardPile from '@/client/components/console/discardPile/ConsoleDiscardPile.vue';
import ConsoleHandRevealLayer from '@/client/components/console/ConsoleHandRevealLayer.vue';
import ConsoleHandDeliveryLayer from '@/client/components/console/ConsoleHandDeliveryLayer.vue';
import ConsoleParliamentFlightLayer from '@/client/components/console/parliament/ConsoleParliamentFlightLayer.vue';
import ConsoleDraftTray from '@/client/components/console/cardDeal/ConsoleDraftTray.vue';
import ConsoleDraftWorkspace from '@/client/components/console/draft/ConsoleDraftWorkspace.vue';
import ConsoleExternalDrawWorkspace from '@/client/components/console/externalDraw/ConsoleExternalDrawWorkspace.vue';
import ConsoleTradeFleetLayer from '@/client/components/console/colonyFleet/ConsoleTradeFleetLayer.vue';
import ConsoleColonyTradeLayer from '@/client/components/console/colonyTrade/ConsoleColonyTradeLayer.vue';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import ConsolePlayedHeroLayer from '@/client/components/console/played/ConsolePlayedHeroLayer.vue';
import ConsoleCountedWhy from '@/client/components/console/ConsoleCountedWhy.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import ConsoleInspectSide from '@/client/components/console/ConsoleInspectSide.vue';
import ConsoleTargetDossierPanel from '@/client/components/console/played/ConsoleTargetDossierPanel.vue';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import ConsoleArmedFlightLayer from '@/client/components/console/ConsoleArmedFlightLayer.vue';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleBotDividendLedger from '@/client/components/console/ConsoleBotDividendLedger.vue';
import ConsoleSpendHeat from '@/client/components/console/ConsoleSpendHeat.vue';
import ConsoleVenusBonus from '@/client/components/console/ConsoleVenusBonus.vue';
import ConsoleBotAttack from '@/client/components/console/ConsoleBotAttack.vue';
import ConsoleAresGlobals from '@/client/components/console/ConsoleAresGlobals.vue';


import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import ConsoleHydroMarkerLayer from '@/client/components/console/hydroMarker/ConsoleHydroMarkerLayer.vue';
import ConsoleBoardCardBonusLayer from '@/client/components/console/boardCardBonus/ConsoleBoardCardBonusLayer.vue';
import ConsoleDeckDrawLayer from '@/client/components/console/deckDraw/ConsoleDeckDrawLayer.vue';
import ConsolePatentSaleLayer from '@/client/components/console/patentSale/ConsolePatentSaleLayer.vue';
import ConsoleResourceTransferLayer from '@/client/components/console/resourceTransfer/ConsoleResourceTransferLayer.vue';
import ConsoleTilePlacementLayer from '@/client/components/console/tilePlacement/ConsoleTilePlacementLayer.vue';
import ConsoleCityPayoutLayer from '@/client/components/console/tilePlacement/ConsoleCityPayoutLayer.vue';
import ConsoleScaleStepRewardLayer from '@/client/components/console/scaleStepReward/ConsoleScaleStepRewardLayer.vue';
import ConsoleCardReactionLayer from '@/client/components/console/cardReaction/ConsoleCardReactionLayer.vue';
import ConsoleScaleSwingLayer from '@/client/components/console/scaleSwing/ConsoleScaleSwingLayer.vue';
import ConsoleNomadMoveLayer from '@/client/components/console/nomads/ConsoleNomadMoveLayer.vue';
import ConsoleColonyBuildLayer from '@/client/components/console/colonyBuild/ConsoleColonyBuildLayer.vue';
import ConsoleColonyCityLayer from '@/client/components/console/colonyCity/ConsoleColonyCityLayer.vue';
import ConsoleJournalPanel from '@/client/components/console/ConsoleJournalPanel.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

// Only as the DEGRADE default for a player model that predates `maCosts` (an
// old save, a test fixture) — the live price always comes from the server.
import ConsoleMandatoryAnnounce from '@/client/components/console/ConsoleMandatoryAnnounce.vue';
import ConsoleActionConfirm from '@/client/components/console/ConsoleActionConfirm.vue';
import {useConsoleShell} from '@/client/console/shell/useConsoleShell';


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
  setup(props) {
    // THE SHELL IS LAYOUT (architecture v2 — S-last): the template above, the components it renders, the props it
    // takes — and ONE composition (`console/shell/useConsoleShell.ts`) that returns every member the template reads.
    // No `data`, no `computed`, no `methods`, no `watch`, no hooks: new behaviour is a controller member.
    return useConsoleShell(props);
  },
});
</script>
