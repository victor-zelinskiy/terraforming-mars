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
         (placement, awaited decisions) — never a plain "your turn". -->
    <div v-if="bannerText !== ''" class="con-banner">
      <span class="con-banner__pulse" aria-hidden="true"></span>
      <span>{{ bannerText }}</span>
    </div>

    <!-- CTS: a DEFERRED task (B = inspect the board) docks as an amber chip.
         P15: the return verb is CONTEXT-AWARE (selection / draft / start
         setup / decision) — never a generic «return to game» while the
         player is already in the game. -->
    <!-- (The legacy amber "deferred" banner was UNIFIED into the mandatory
         prompt card below — one premium surface, its CTA relabels by state
         (Открыть / Вернуться к решению). No second visual style. -->

    <!-- PRESENTATION FLOW: the quiet pending-queue chip — events are waiting
         their FIFO turn behind the active foreground item. Informational
         (same banner-band placement as the deferred chip); the journal (View)
         is the event center. Gains the critical accent when the queue holds a
         gameplay-critical item. -->
    <div v-if="pendingEvents.count > 0" class="con-banner con-banner--events" :class="{'con-banner--events-critical': pendingEvents.critical}">
      <span class="con-banner__pulse" aria-hidden="true"></span>
      <span>{{ $t('Pending events') }}</span>
      <span class="con-banner__count">+{{ pendingEvents.count }}</span>
    </div>

    <!-- MANDATORY ANNOUNCEMENT (consoleMandatoryGate): a mandatory ACTION (corp
         first action / forced hand pick / off-turn reaction / a must-open
         workspace flow like the between-generations draft) is ANNOUNCED here —
         not popped open — and the player opens it with A when they're ready.
         Its FIRST presentation waits out the whole ordinary-notification feed
         (queue empty, exit animations done); once presented it is a STANDING
         state that later notifications may join but never hide or reset. A
         drawn-cards reveal is NOT announced — it flows straight through from
         its draw cinematic (never split from it). -->
    <transition name="con-plate">
      <ConsoleMandatoryAnnounce v-if="mandatoryAnnounceVisible"
                                :kicker="mandatoryAnnounceView.kicker"
                                :ask="mandatoryAnnounceView.ask"
                                :sourceCard="mandatoryAnnounceView.sourceCard"
                                :openLabel="mandatoryAnnounceView.openLabel" />
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

    <!-- Terraforming complete — the one-shot console-native CEREMONY (the
         MA-coronation-grade centre stage: veil + procedural Mars hero +
         gsap burst; pointer-events: none, bounded lifetime; the persistent
         state lives in the top-HUD rail + generation marker). -->
    <ConsoleTerraformingCeremony />

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
                            :convertPlants="convertPlantsReady && railShowsSelf" :convertHeat="convertHeatReady && railShowsSelf"
                            :boardVisible="consoleState.section === 'board' && !infoModeState.open && !startSceneVisible"
                            :own="railShowsSelf"
                            :vpHidden="railVpHidden"
                            :automa="railAutoma" />
      <!-- v-show (NOT v-if): the board must stay in the DOM — the headless
           SelectSpace attaches placement handlers to its cells. -->
      <ConsoleBoardSection v-show="consoleState.section === 'board'"
                           ref="boardSection"
                           :playerView="playerView"
                           :placementActive="placementActive"
                           :inspecting="consoleState.inspecting" />
      <!-- The right STRATEGY RAIL — the Milestones/Awards premium HUD, the
           LEFT rail's geometric twin (same width token). Always the board
           home's right edge; task overlays and workspaces stand OVER it. -->
      <ConsoleStrategyRail ref="conStratEl"
                           v-show="consoleState.section === 'board'"
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
                             :inspectAll="consoleState.freeRoam"
                             :sourceView="placementSourceView"
                             :trackInfo="trackInfo"
                             :trackScale="trackScaleOverview"
                             :lore="selectedCellLore" />
      </transition>
      <!-- The console-NATIVE journal (View) — REPLACES the right info panel
           while open: an absolute overlay anchored to the right edge, wider
           than the panel and free to overlap the board. The board layout is
           NEVER reflowed or rescaled for it (the context panel stays in the
           flex flow underneath). Board home only; owns the pad while open. -->
      <transition name="con-journal">
        <ConsoleJournalPanel v-if="journalPanelVisible"
                             ref="journalPanel"
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
      <Teleport :to="handEmbedTarget ?? 'body'" :disabled="handEmbedTarget === undefined">
      <ConsoleHandSection v-if="workspaceFrameRenders('hand')"
                          ref="handSection"
                          :embedded="handEmbedTarget !== undefined"
                          :entries="handEntries"
                          :index="consoleState.handIndex"
                          :saleActive="consoleState.sale.active"
                          :saleSelected="consoleState.sale.selected"
                          :saleMegacredits="thisPlayer.megacredits"
                          :select="handSelectProps"
                          :packetExtras="handPacketExtras"
                          :discarding="discardInOverlay"
                          :softReason="handSoftReason"
                          :turnWindowClosed="handTurnWindowClosed"
                          :tagFilters="handTagFilterOptions"
                          :activeTag="consoleState.handTagFilter"
                          :stagedCard="stagedHandCard"
                          :stage="handStage"
                          :stagePaused="pickBridgeActive"
                          :transitHold="handRevealState.holdSlots"
                          :filterBusy="handRevealState.filterActive"
                          :underScene="sceneOverHand || consoleRevealMode !== undefined" />
      </Teleport>
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
        <Teleport :to="colonyEmbedTarget ?? 'body'" :disabled="colonyEmbedTarget === undefined">
        <!-- `data-motion-surface` is part of what the `embedded` prop STRIPS
             (host-agnostic rule 1). Left on, the band-surface director gave a
             hosted STEP the standalone workspace-switch entrance — a full
             surface arrival played inside somebody else's zone, plus a shade
             owner dimming the board behind a full-bleed start cinematic. That
             is the «Colonies появляется резко» from inside «Старт партии»: the
             wrong grammar, not a missing one. Absent, the director's hooks
             pass straight through and the step's arrival is the workspace
             entry phrase the section itself speaks. -->
        <ConsoleColoniesSection v-if="workspaceFrameRenders('colonies')"
                                ref="coloniesSection"
                                :data-motion-surface="colonyEmbedActive ? undefined : 'section'"
                                :embedded="colonyEmbedActive"
                                :colonies="coloniesForRail"
                                :index="consoleState.colonyIndex"
                                :tradeable="tradeableColonyNames"
                                :tradeBlockReason="colonyTradeBlockReason"
                                :myTurn="myTurn"
                                :awaitingInput="awaitingInput"
                                :pick="colonyPick"
                                :players="playerView.players"
                                :viewerColor="thisPlayer.color"
                                :dockedColony="tradeFleetState.dockedColonyName"
                                :tradeOffset="thisPlayer.colonyTradeOffset ?? 0"
                                :tradePaymentOptions="tradeColonyContext !== undefined ? tradeColonyContext.paymentOptions : []"
                                :tradeDisabledPayments="tradeColonyContext !== undefined ? tradeColonyContext.disabledPayments : []"
                                :thisPlayer="thisPlayer"
                                :playerId="playerView.id"
                                :viewVersion="`${playerView.game.gameAge}|${playerView.game.undoCount}`"
                                @trade-confirm="onColonyTradeComposerConfirm($event)"
                                @build-confirm="onColonyBuildConfirm($event)"
                                @flow-complete="onColonyFlowComplete"
                             @pick-confirm="onColonyPickConfirm()" />
        </Teleport>
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
                             v-show="!pickBridgeActive"
                             data-motion-surface="section"
                             ref="hydroSection"
                             :playerView="playerView"
                             :actionAvailable="hydroActionAvailable"
                             :cacheKey="hydroCacheKey"
                             :followUpLive="hydroFollowUpLive"
                             @pick="openHydroRepeatPick"
                             @notice="showNotice($event)"
                             @confirm="submitHydroAdvance($event)"
                             @collapse="collapseWorkspace()"
                             @result-done="finishHydroFlow()"
                             @close="leaveWorkspace()" />
      </transition>

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
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
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
        <ConsoleCardActions v-if="workspaceFrameRenders('card-actions')"
                            v-show="!pickBridgeActive"
                            ref="cardActions"
                            :playerView="playerView"
                            :collapsed="workspaceCollapsed"
                            :blockedReason="actionBlockedReason"
                            @blocked="showNotice"
                            @submit-batch="onCardActionsSubmitBatch"
                            @reveal-ack="onCardActionsRevealAck"
                            @flow-complete="onCardActionsFlowComplete"
                            @collapse="onCardActionsCollapse"
                            @colony-step="onCardActionsColonyStep"
                            @close="onCardActionsClose" />
      </transition>

      <!-- The "select an action to repeat" surface (ProjectInspection / Viron /
           Hydronetwork stage 7): the SAME ДЕЙСТВИЯ КАРТ workspace, reused in
           `repeat` mode (full dossier + filters + all actions with reasons).
           Mounted OVER the source composer (v-show hidden) while the pick is
           out; A = «Выбрать», the chosen action is composed here and RESOLVED
           back to the source via the bridge. -->
      <ConsoleCardActions v-if="repeatPickActive"
                          repeat
                          ref="repeatPick"
                          :playerView="playerView"
                          @close="onRepeatPickClose" />

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
        <ConsoleInfoMode v-if="infoModeState.open" ref="infoMode" :playerView="playerView" :myTurn="myTurn" />
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
                            :colony="colonyInspectModel"
                            :players="playerView.players"
                            :viewerColor="thisPlayer.color"
                            :playerId="playerView.id"
                            :tradeOffset="thisPlayer.colonyTradeOffset ?? 0"
                            :readonly="true"
                            :tradeable="false" />
    </transition>

    <!-- «Разыграно» (X from the board home) — the console-native played-cards
         TABLE overlay: view-only peek piles + the face-down events pile.
         Bottom-anchored, height follows the content; closed automatically
         when a mandatory surface arrives (the journal's hard-block rule). -->
    <transition name="con-layer">
      <ConsolePlayedOverlay v-if="playedTableVisible"
                            ref="playedOverlay"
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
         stay lit — see `.con-shade` in console.less); `--fullbleed` is the one
         exception, declared by the OWNER when a cinematic is covering the whole
         shell and its dim must follow. -->
    <div class="con-shade"
         :class="{
           'con-shade--on': surfaceShadeVisible,
           'con-shade--veil': surfaceShadeVeil,
           'con-shade--focus': wheelInput.arm !== undefined,
           'con-shade--fullbleed': surfaceShadeFullBleed,
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
                                ref="stdpScreen"
                                :items="stdProjectItems"
                                :index="consoleState.sheetIndex"
                                :myMegacredits="thisPlayer.megacredits"
                                :stepUp="stdpStepUp"
                                :backLabel="stdBackLabel" />
      <ConsoleMaScreen v-else-if="maScreenKind !== undefined"
                       ref="maScreen"
                       :kind="maScreenKind"
                       :items="maScreenItems"
                       :index="consoleState.sheetIndex"
                       :myMegacredits="thisPlayer.megacredits"
                       :free="awardFundingActive && maScreenKind === 'awards'"
                       :focusView="maFocusView"
                       :focusInspect="maFocusInspect"
                       :focusAvailable="maFocusAvailable"
                       :focusBlockReason="maFocusBlockReason"
                       @ceremony-done="onMaCeremonyDone" />
      <!-- (The BLUE-CARD ACTION CENTER left this chain — it is the ACTION
           WORKSPACE now, an absolute child of .con-main right of the player
           rail; see the mount next to ConsoleInfoMode.) -->
      <ConsoleSheet v-else-if="consoleState.sheet !== undefined && consoleState.sheet !== 'cardActions'" :title="sheetTitle" :rows="sheetRows" :index="consoleState.sheetIndex" />
    </transition>

    <!-- Console confirm panel (pass / risky conversions). Surface-motion:
         rides the shared shade + the director — a wheel's Пас slot hands
         off INTO this card (directional entry from the chosen slot). -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
    <div v-if="consoleState.confirm !== undefined" class="con-confirm con-ws" role="dialog" data-motion-surface="confirm">
      <div class="con-confirm__card" data-motion-panel>
        <!-- The emblem doubles as the wheel flight's landing anchor: a pass /
             max-temp heat commit carries its tile icon INTO this card. -->
        <div class="con-confirm__title">
          <span class="con-confirm__emblem" data-wheel-anchor="confirm" aria-hidden="true">
            <BarButtonIcon v-if="consoleState.confirm === 'pass'" name="pass" />
            <i v-else class="resource_icon resource_icon--heat"></i>
          </span>
          <span>{{ $t(confirmTitle) }}</span>
        </div>
        <div class="con-confirm__body">{{ $t(confirmBody) }}</div>
        <!-- T7 info parity: the desktop PassConfirmContent warnings (unused
             actions / free trade fleet / conversions / hydro) carry over. -->
        <div v-if="confirmWarnings.length > 0" class="con-confirm__warns">
          <div v-for="(w, i) in confirmWarnings" :key="i" class="con-confirm__warn">
            <span aria-hidden="true">!</span>
            <span>{{ w }}</span>
          </div>
        </div>
        <div class="con-confirm__actions">
          <span class="con-confirm__action con-confirm__action--yes"><GamepadGlyph control="confirm" /><span>{{ $t('Confirm') }}</span></span>
          <span class="con-confirm__action"><GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span></span>
        </div>
      </div>
    </div>
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
                             ref="draftWs"
                             :playerView="playerView"
                             @submit="onDraftSubmit"
                             @defer="onDraftDefer" />
    </transition>

    <!-- EMBEDDED HOSTING (consoleWorkspaceOutcome): a card PICK the player's
         own workspace produced (Inventors' Guild / Business Network revealing
         a card to buy; Hi-Tech Lab keeping one of N) is the next stage of
         THAT flow, not a new demand — so the same host is teleported into the
         workspace's outcome slot instead of rising as its own band. Same
         instance, same submit path, same command contract. -->
    <Teleport :to="taskEmbedTarget ?? 'body'" :disabled="taskEmbedTarget === undefined">
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
        <ConsoleTaskHost v-if="hostTask !== undefined && !taskHeldForWorkspace && !effectDecisionOwnsPrompt && !finalGreeneryActive && !govSupportActive && !productionLossActive && !govScaleFocusState.holding && !energyConversionState.active && !consoleState.task.deferred && taskSpacePending === undefined && !handPickActive"
                         ref="taskHost"
                         :playerView="playerView"
                         :task="hostTask"
                         :embedded="taskEmbedTarget !== undefined"
                         :prompt-override="pendingClientPayment !== undefined ? pendingClientPayment.input : undefined"
                         :defer-label="pendingClientPayment !== undefined ? 'Cancel' : 'Minimize'"
                         @submit="onTaskSubmit"
                         @defer="onTaskDefer"
                         @result-detached="onWorkspaceResultDetached"
                         @space-pick="onTaskSpacePick"
                         @hand-pick="onTaskHandPick" />
      </transition>
    </Teleport>

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
    <Teleport :to="effectDecisionEmbedTarget ?? 'body'" :disabled="effectDecisionEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleEffectDecision v-if="effectDecisionActive && effectDecisionVm !== undefined"
                               ref="effectDecision"
                               :playerView="playerView"
                               :vm="effectDecisionVm"
                               :embedded="effectDecisionEmbedTarget !== undefined"
                               @submit="onTaskSubmit"
                               @defer="onTaskDefer"
                               @hand-pick="onTaskHandPick" />
      </transition>
    </Teleport>

    <!-- FINAL GREENERY — the endgame conversion beat. Deliberately NOT the
         decision screen above: there the quiet bottom card is a harmless
         decline, here it ENDS THE PLAYER'S GAME. Same submit / defer /
         space-pick contract as the host it replaces. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleFinalGreenery v-if="finalGreeneryActive && finalGreeneryVm !== undefined && finalGreeneryPrompt !== undefined"
                            ref="finalGreenery"
                            :vm="finalGreeneryVm"
                            :prompt="finalGreeneryPrompt"
                            @submit="onTaskSubmit"
                            @defer="onTaskDefer"
                            @space-pick="onFinalGreenerySpacePick" />
    </transition>

    <!-- Government Support (World Government Terraforming) — the dedicated
         premium 2×2 briefing panel (replaces the generic host for this ONE
         choice). Same submit / space-pick / defer contract as the host. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleGovernmentSupport v-if="govSupportActive && !govScaleFocusState.closing && !consoleState.task.deferred && taskSpacePending === undefined"
                                ref="govSupport"
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
    <Teleport :to="deckPickEmbedTarget ?? 'body'" :disabled="deckPickEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleDeckPick v-if="deckPickActive && !deckPickHeldForWorkspace"
                         ref="deckPick"
                         :playerView="playerView"
                         :embedded="deckPickEmbedTarget !== undefined"
                         @submit="onTaskSubmit"
                         @defer="onTaskDefer" />
      </transition>
    </Teleport>

    <!-- Production loss (Ares hazard-adjacency penalty) — the dedicated
         premium "reduce your production" surface (replaces the generic host
         distribute lanes for this ONE case). Same submit / defer contract. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleProductionLoss v-if="productionLossActive && !consoleState.task.deferred && taskSpacePending === undefined"
                             ref="prodLoss"
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
                        ref="spendHeat"
                        :playerView="playerView"
                        @submit="onTaskSubmit"
                        @defer="onTaskDefer" />
    </transition>
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleVenusBonus v-if="venusBonusActive"
                         ref="venusBonus"
                         :playerView="playerView"
                         @submit="onTaskSubmit"
                         @defer="onTaskDefer" />
    </transition>
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleAresGlobals v-if="aresGlobalsActive"
                          ref="aresGlobals"
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
                        ref="botAttack"
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
                         ref="startScene"
                         :playerView="playerView"
                         :waitingOnPlayers="waitingOnPlayers"
                         :task="startTask"
                         @submit="onTaskSubmit"
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
                               ref="endgameWs"
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
    <Teleport :to="revealEmbedTarget ?? 'body'" :disabled="revealEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleRevealOverlay v-if="revealOverlayMode !== undefined"
                              ref="revealOverlay"
                              :playerView="playerView"
                              :mode="revealOverlayMode"
                              :embedded="revealEmbedTarget !== undefined"
                              @dismiss-result="onDismissRevealResult"
                              @result-detached="onWorkspaceResultDetached"
                              @drawn-complete="onEmbeddedDrawnComplete"
                              @discard-pick="onRevealDiscardPick" />
      </transition>
    </Teleport>

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
      <div ref="zoomFlightProxy" class="con-zoom-flight-proxy">
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
                   ref="cardZoom"
                   class="con-zoom"
                   :class="{'con-zoom--flight': zoomFlight, 'con-zoom--closing': zoomClosing}"
                   :card="consoleCardZoom.card"
                   :cards="consoleCardZoom.cards.length > 1 ? consoleCardZoom.cards : undefined"
                   :index="consoleCardZoom.index"
                   :selected="zoomSelected"
                   :dismissable="!consoleCardZoom.mandatory"
                   :closing="zoomClosing"
                   :consoleMotion="true"
                   :annotationsSuppressed="zoomSideVisible"
                   :lore="true"
                   @navigate="onCardZoomNavigate"
                   @close="onCardZoomClosed">
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
          <ConsoleCardAvailabilityPanel v-if="zoomAvailabilityView !== undefined && consoleCardZoom.inspect === undefined"
                                        variant="panel"
                                        :view="zoomAvailabilityView"
                                        :closing="side.closing" />
          <ConsoleInspectSide v-if="consoleCardZoom.inspect !== undefined && zoomRulesCardName !== undefined"
                              :cardName="zoomRulesCardName"
                              :history="consoleCardZoom.inspect.history"
                              :tab="consoleCardZoom.inspectTab"
                              :nonce="side.nonce"
                              :closing="side.closing" />
          <!-- The MarsBot corporation's printed boxes — the SAME rules panel,
               fed the bot card's own groups (never the human original's). -->
          <ConsoleCardRulesPanel v-else-if="zoomBotCorpAnnotations !== undefined"
                                 ref="zoomRulesPanel"
                                 :annotationsOverride="zoomBotCorpAnnotations"
                                 :nonce="side.nonce"
                                 :closing="side.closing" />
          <ConsoleCardRulesPanel v-else-if="zoomRulesCardName !== undefined && zoomHasRules"
                                 ref="zoomRulesPanel"
                                 :cardName="zoomRulesCardName"
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
                :class="zoomReceiveLabel !== undefined ? 'con-zoom__status--received' : 'con-zoom__status--source'">
            {{ $t(zoomStatusLabel) }}
          </span>
          <!-- «ПОЛУЧЕНО N» — parity with the multi-card modal's header count. -->
          <span v-if="zoomReceivedCount > 0" class="con-zoom__count">
            <span class="con-zoom__count-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
            <span class="con-zoom__count-label">{{ $t('Received') }}</span>
            <b class="con-zoom__count-num">{{ zoomReceivedCount }}</b>
          </span>
          <span v-if="zoomSelected" class="con-zoom__state">✓ {{ $t('Card selected') }}</span>
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
            <span>{{ $t('Browse') }}</span>
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
    <ConsoleHandRevealLayer />

    <!-- The STARTING-CARDS DELIVERY stage — the cards you paid for fly from
         the top-HUD project deck down into the hand dock bay
         (handDeliveryDirector.ts). Under the footer band, like the reveal
         stage: an arriving card dives BEHIND the tray plate/bar texture. -->
    <ConsoleHandDeliveryLayer />

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

    <!-- The TILE-PLACEMENT HERO stage — the chosen tile physically flies
         from the table edge into the picked hex (thickness + tightening
         ground shadow + touchdown settle), then the cell's printed bonus
         icons rise through it and hand off to the resource chips
         (consoleTilePlacement.ts / tilePlacementDirector.ts). -->
    <ConsoleTilePlacementLayer />

    <!-- The COLONY-BUILD HERO stage — the player's cube physically drops into
         the built colony's slot while the slot's one-time build bonus is
         lifted out of the cell (a resource glyph rises + hands off to the
         resource chips; a card lifts via the board-card-bonus cover), then the
         cube takes the vacated place
         (consoleColonyBuild.ts / colonyBuildDirector.ts). -->
    <ConsoleColonyBuildLayer />

    <!-- The SHARED RESOURCE-TRANSFER stage — every "receiving resources"
         chip (the sale's M€ payout, a played card's reward beat, a placed
         cell's printed bonuses) flies here: real resource art + the amount,
         source → exact panel zone → delta chip
         (consoleResourceTransfer.ts / resourceTransferDirector). -->
    <ConsoleResourceTransferLayer />

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
                       :liftedNames="dockLiftedNames"
                       :deliveryHeld="dockHeld"
                       :album="handDockAlbum"
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
                           :onsave="onConvertPlantsSpacePicked" />
      <!-- Nested board pick from a task's space-type option (WGT ocean):
           the same board-input binder as convert-plants. -->
      <console-board-input v-if="taskSpacePrompt !== undefined"
                           :playerView="playerView"
                           :playerinput="taskSpacePrompt"
                           :onsave="onTaskSpacePicked" />
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
    <Teleport :to="playEmbedTarget ?? 'body'" :disabled="playEmbedTarget === undefined">
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <!-- v-show (NOT v-if) while a client hand pick is out: the composer's
             captured choices/payment must survive the hand round-trip (the
             director recognizes the pick bridge and never animates it). -->
        <ConsolePlayCardConfirm v-if="pendingPlayCard !== undefined && !playHeldForWorkspace"
                                v-show="!pickBridgeActive"
                                ref="playConfirm"
                                :playerView="playerView"
                                :cardName="pendingPlayCard.cardName"
                                :input="pendingPlayCard.input"
                                :embedded="playEmbedTarget !== undefined"
                                @confirm="onPlayCardConfirmNative($event)"
                                @cancel="onPlayCardCancel" />
      </transition>
    </Teleport>

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
                                     ref="corpFirstConfirm"
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
import {defineComponent, PropType, ref} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {Color} from '@/common/Color';
import {GameModel} from '@/common/models/GameModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {Payment} from '@/common/inputs/Payment';
import {ColonyBonusCollectMeta, ColonyBonusDiscardMeta, DiscardPromptMeta, SelectCardModel, SelectColonyModel, SelectPaymentModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {consoleCardActionsUi, resetCardActionsFilter} from '@/client/console/consoleCardActions';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {placementReasonToUnplayable} from '@/client/components/board/placementReason';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';
import {SpaceId} from '@/common/Types';

import ConsoleBoardBinder from '@/client/components/console/ConsoleBoardBinder.vue';
import {submitInput, submitBatch as transportSubmitBatch, cancelPlacement} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import ConsoleBoardInput from '@/client/components/console/ConsoleBoardInput.vue';
import {buildStandardProjectPaymentModel, hasUsableStandardProjectAlternativeResources, standardProjectPaymentTitle} from '@/client/components/payment/paymentModelUtils';

import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import ConsoleTerraformingCeremony from '@/client/components/console/ConsoleTerraformingCeremony.vue';
import ConsoleBotTurnReview from '@/client/components/console/ConsoleBotTurnReview.vue';
import {botTurnReviewState, closeBotTurnReview, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import {openBotTurnReviewByKey, skipBotTurnPresentation, stepBotTurnReview} from '@/client/components/marsbot/marsBotPresentation';
import {acquireForegroundLease, isMandatoryPromptsHeld} from '@/client/components/presentation/presentationFlow';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';
import {PendingQueueSummary} from '@/client/components/presentation/presentationPolicy';
import {notificationState, notificationsSettled, pendingSummary, dismiss as dismissNotification} from '@/client/components/notifications/notificationState';
import {beginNotifHold, cancelNotifHold, consumeNotifHoldRelease, resetNotifHold} from '@/client/console/consoleNotifHold';
import {LiveNotification} from '@/client/components/notifications/notificationTypes';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import ConsoleHandDock, {HandDockAlbum} from '@/client/components/console/ConsoleHandDock.vue';
import {handDockBayRem} from '@/client/console/consoleHandDock';
import ConsoleSheet, {ConsoleSheetRow} from '@/client/components/console/ConsoleSheet.vue';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import ConsoleMaCeremony from '@/client/components/console/ConsoleMaCeremony.vue';
import {buildConsoleMaItems, ConsoleMaItem, ConsoleMaKind, stepGrid} from '@/client/components/console/consoleMaModel';
import {buildMaConfirm, MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {buildMaInspect, MaInspectView} from '@/client/components/console/consoleMaInspectModel';
import {
  armMaCeremony,
  claimMaCeremonyEmbed,
  releaseMaCeremonyEmbed,
  abandonMaCeremonyEmbed,
  disarmMaCeremony,
  maCeremonyState,
  MaCeremonyEvent,
} from '@/client/components/ma/maCeremonyState';
import {
  maFocusState,
  openMaFocus,
  closeMaFocus,
  setMaFocusError,
  beginMaFocusCommit,
  failMaFocusCommit,
  beginMaFocusCeremony,
  beginMaFocusClosing,
  discardMaFocusDraft,
  resetMaFocus,
  maFocusAcceptsInput,
  maFocusCommitArmed,
  maFocusCommitOutcome,
} from '@/client/console/consoleMaFocus';
import ConsoleQuickSelector from '@/client/components/console/ConsoleQuickSelector.vue';
import ConsoleStdProjectsScreen from '@/client/components/console/ConsoleStdProjectsScreen.vue';
import {buildRtQuickEntries, buildLtQuickEntries, buildStdProjectItems, QuickEntry, QuickSlot, StdProjectItem} from '@/client/console/consoleQuickModel';
import {buildMaHudZone, MaHudZone} from '@/client/console/consoleMaHudModel';
import {shareViewSnapshot} from '@/client/utils/viewSnapshotShare';

/**
 * Identity-stable MA HUD zones (perf iteration 3). `buildMaHudZone` returns a
 * fresh object per evaluation, and the zones re-evaluate on every playerView
 * commit (their deps ride `game`); a fresh identity re-rendered the v-show'n
 * strategy rail AND fired its `observeZone` ledger watchers on every response
 * — hidden included. Sharing against the previous value returns the SAME
 * object whenever the content is unchanged (Vue 3.4 computeds then notify no
 * dependents at all). Module-level on purpose: plain memory, content-compared,
 * safe across a shell remount.
 */
const maHudZoneShare: {milestones?: MaHudZone, awards?: MaHudZone} = {};
import {wheelPotentialCounts, WheelCounts} from '@/client/console/potentialAvailability';
import {blockersForReasons, potentiallyAvailable} from '@/common/availability/AvailabilityBlocker';
import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
import ConsoleStrategyRail from '@/client/components/console/ConsoleStrategyRail.vue';
import {scaleTooltipState, ScaleTooltipContent, hideScaleTooltip} from '@/client/components/board/scaleTooltipState';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import ConsoleHandSection, {ConsoleHandEntry, ConsoleHandSelectMode} from '@/client/components/console/ConsoleHandSection.vue';
import {shortBlockerLabel} from '@/client/components/console/consoleHandGrid';
import {deriveHandSelect, handSelectPicksValid, HandSelectDerivation} from '@/client/components/console/consoleHandSelectModel';
import {unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';
import {buildConsoleTagFilters, filterHandByTag, cycleTagFilter, ConsoleTagFilterOption} from '@/client/components/console/consoleHandFilter';
import ConsoleResourcePanel from '@/client/components/console/ConsoleResourcePanel.vue';
import ConsoleColoniesSection, {ConsoleColonyPick} from '@/client/components/console/ConsoleColoniesSection.vue';
import ConsoleInfoMode from '@/client/components/console/ConsoleInfoMode.vue';
import ConsoleStrandedPrompt from '@/client/components/console/ConsoleStrandedPrompt.vue';
import ConsoleSystemAlert from '@/client/components/console/ConsoleSystemAlert.vue';
import {consoleSystemAlertState, dismissConsoleAlert, isConsoleAlertActive} from '@/client/console/consoleSystemAlertState';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import ConsoleGovernmentSupport from '@/client/components/console/ConsoleGovernmentSupport.vue';
import ConsoleEffectDecision from '@/client/components/console/ConsoleEffectDecision.vue';
import {buildEffectDecision, EffectDecisionSource, EffectDecisionViewModel} from '@/client/console/effectDecision/effectDecisionModel';
import {resetDecisionFocus} from '@/client/console/effectDecision/effectDecisionState';
import ConsoleFinalGreenery from '@/client/components/console/ConsoleFinalGreenery.vue';
import {buildFinalGreenery, EYEBROW as FINAL_GREENERY_EYEBROW, FinalGreeneryViewModel} from '@/client/console/finalGreenery/finalGreeneryModel';
import ConsoleProductionLoss from '@/client/components/console/ConsoleProductionLoss.vue';
import ConsoleDeckPick from '@/client/components/console/deckPick/ConsoleDeckPick.vue';
import ConsoleDeckPickLayer from '@/client/components/console/deckPick/ConsoleDeckPickLayer.vue';
import {deckPickHolding, resetDeckPick} from '@/client/console/deckPick/consoleDeckPick';
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import ConsoleEndgameWorkspace from '@/client/components/console/ConsoleEndgameWorkspace.vue';
import {consoleEndgameUi, noteConsoleEndgameLivePhase, resetConsoleEndgame} from '@/client/console/endgame/consoleEndgameState';
import ConsoleRevealOverlay, {ConsoleRevealMode} from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import type {ConsoleHandStage} from '@/client/components/console/ConsoleHandSection.vue';
import {
  closeWorkspaceRoot,
  closeWorkspaceSheet,
  discardWorkspacePark,
  collapseWorkspaceStack,
  descendWorkspaceFrame,
  enterWorkspace,
  foldWorkspaceFrame,
  frameServing,
  goBoardHome,
  leaveWorkspace,
  popWorkspaceFrame,
  pushWorkspaceFrame,
  resetWorkspaceStack,
  restoreWorkspaceStack,
  setWorkspaceFramePhase,
  setWorkspaceFrameServes,
  setWorkspaceFrameStage,
  setWorkspaceFrameSubject,
  workspaceFrameDescended,
  workspaceFrameHasNested,
  workspaceFrameIndex,
  workspaceFrameMounted,
  workspaceFramePhase,
  workspaceFrameRenders,
  workspaceFrameSlot,
  workspaceStackTop,
  workspaceStackBack,
  workspaceStackBackVerb,
  workspaceFrameSubject,
  workspaceFrameStage,
  workspaceFrameAnchor,
  workspaceFrameHost,
  workspaceFrameIsOverlay,
  workspaceFrameKnown,
  workspaceFrameParked,
  workspaceFrameRoot,
  workspaceFrameTarget,
  workspaceHostForStep,
  workspaceStackCollapsed,
  workspaceStackCrumb,
  workspaceStackState,
  workspaceStackTopAxis,
  FrameAnchor,
  WorkspaceFrameKind,
} from '@/client/console/consoleWorkspaceStack';
import {acceptsInput, isCommitted, workspaceConclusionFor} from '@/client/console/consoleWorkspaceFlow';
import {
  beginStdProjectSubmit,
  markStdProjectCommit,
  markStdProjectTarget,
  requestStdProjectCancel,
  resetStdProjectsFlow,
  stdProjectsFlow,
  stdProjectsFlowLive,
  stdProjectsFramePhase,
} from '@/client/console/consoleStdProjects';
import {
  STDP_HOLD_MS, armStdProjectCommit, releaseStdProjectCommit, stdProjectCommitState,
} from '@/client/console/consoleStdProjectCommit';
import {resetHandStageMotion, handStageTransitioning, guardHandHeroFlight, heroCommitLift} from '@/client/console/consoleHandStageMotion';
import {armHandPlayPrewarm, cancelHandPlayPrewarm, resetHandPlayPrewarm} from '@/client/console/consoleHandPlayPrewarm';
import ConsoleCorpFirstActionConfirm from '@/client/components/console/ConsoleCorpFirstActionConfirm.vue';
import ConsoleCardExitLayer from '@/client/components/console/cardDeal/ConsoleCardExitLayer.vue';
import ConsoleCardDiscardLayer from '@/client/components/console/cardDiscard/ConsoleCardDiscardLayer.vue';
import {
  armCardDiscard, cardDiscardColonyBonus, cardDiscardTransaction, isCardDiscardActive,
  registerDiscardOverlayHandoff, resetCardDiscard,
} from '@/client/console/cardDiscard/consoleCardDiscard';
import {
  COLONY_RESOLUTION_SERVES,
  COLONY_BONUS_ENTRY_WAIT_MS,
  ColonyResolutionSignals, armColonyBonusEntry, clearColonyBonusEntry, colonyBonusCollectOf,
  colonyBonusDiscardOf,
  colonyBonusCardPickOf,
  colonyBonusEntry, colonyResolutionColony, colonyResolutionEvidenceFor, colonyResolutionLiveFor,
  colonyResolutionUi, noteColonyBonusEntryWaitOver,
  noticeColonyResolutionDiscard, remoteColonyBonusPendingFor, resetColonyResolutionUi,
  setColonyDiscardStage,
} from '@/client/console/colonyTrade/colonyResolution';
import {cardColonyTradeCard} from '@/client/console/colonyTrade/colonyTradeEntry';
import {discardPhaseInOverlay} from '@/client/console/cardDiscard/discardModel';
import {
  DiscardIntent, deriveDiscardIntent, discardMetaOf,
} from '@/client/console/cardDiscard/discardIntent';
import ConsoleHandRevealLayer from '@/client/components/console/ConsoleHandRevealLayer.vue';
import ConsoleHandDeliveryLayer from '@/client/components/console/ConsoleHandDeliveryLayer.vue';
import {handRevealState, RevealVisual} from '@/client/console/handDock/handRevealState';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {
  beginDockIntakeAccent, dockIntakeAccentActive, holdDockIntakeAccent, resetDockIntakeAccent,
} from '@/client/console/handDock/consoleDockAccent';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {isHandDeliveryActive, resetHandDelivery} from '@/client/console/handDock/handDeliveryDirector';
import {
  finishInstant, isHandRevealEpisodeRunning, resetHandReveal, reverseHandReveal, runHandCloseEpisode,
  runHandFilterEpisode, runHandOpenEpisode, runningHandRevealKind, setHandRevealHooks, RevealPair, RevealRect,
} from '@/client/console/handDock/handRevealDirector';
import ConsoleDraftTray from '@/client/components/console/cardDeal/ConsoleDraftTray.vue';
import {runCardTransfer} from '@/client/console/cardDeal/cardExitDirector';
import {
  draftPickBeatActive, draftTrayState, observeDraftTransition, riseSceneEngaged, skipDraftPickBeat,
} from '@/client/console/cardDeal/consoleDraftTray';
import ConsoleDraftWorkspace from '@/client/components/console/draft/ConsoleDraftWorkspace.vue';
import {
  betweenGenDraftLive, draftCompletionHolding, draftMandatoryFlowBeat, observeDraftWorkspace, resetDraftWorkspace,
} from '@/client/console/draft/consoleDraftFlow';
import {consoleDraftUi} from '@/client/console/draft/consoleDraftUi';
import {Phase} from '@/common/Phase';
import ConsoleTradeFleetLayer from '@/client/components/console/colonyFleet/ConsoleTradeFleetLayer.vue';
import {armTradeFleet, abortTradeFleet, isTradeFleetActive, tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import ConsoleColonyTradeLayer from '@/client/components/console/colonyTrade/ConsoleColonyTradeLayer.vue';
import {
  abortColonyTrade, armColonyTrade, colonyTradeClaimsReveal, colonyTradeState,
  isColonyTradeInputLocked, noticeColonyTradeCommit, notifyColonyTradeTrackCommitted,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {ColonyTradeTargets} from '@/client/console/colonyTrade/colonyTradeModel';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import ConsolePlayedHeroLayer from '@/client/components/console/played/ConsolePlayedHeroLayer.vue';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {conWsPresence, installConWsPresenceBridge} from '@/client/console/conWsPresenceBridge';
import {resetPlayedCategoryView} from '@/client/console/played/playedCategoryView';
import {resetPlayedCardReturns} from '@/client/console/played/playedCardReturn';
import {resetCategoryDirector} from '@/client/console/played/playedCategoryDirector';
import {
  abortPlayedHero, armPlayedHero, isPlayedHeroActive, playedHeroHolding, playedHeroState, skipPlayedHeroResult,
} from '@/client/console/played/consolePlayedHero';
import {CardType} from '@/common/cards/CardType';
import {
  colonyGridCols, colonyGridLayout, colonyNavStep, consoleColoniesUi, resetConsoleColoniesUi,
  colonyFocusState, closeColonyFocus, openColonyFocus, resetColonyFocus, ColonyFocusIntent,
} from '@/client/console/consoleColoniesModel';
import {armColonyFocusQuickExit} from '@/client/console/consoleColonyFocusMotion';
import {consolePlayCardUi} from '@/client/console/consolePlayCardUi';
import {consoleStartUi} from '@/client/console/consoleStartUi';
import {consoleStartState, startAwaitingOthers, startCorporationPlayed, startDeferredSummary, startSceneHeld} from '@/client/console/consoleStartState';
import {engageStartExcursion, releaseStartExcursion, startExcursionActive, startExcursionQuiet, startExcursionState} from '@/client/console/startBoardExcursion';
import {bonusActionInStartFlow, bonusActionOnBoard, bonusActionOwed, bonusActionTurnControlReason} from '@/client/console/bonusAction';
import {firstActionOwed} from '@/client/console/startFirstAction';
import {isResourceTransferActive} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {panelCommands} from '@/client/console/consolePanelUi';
import {consoleActionComposerUi, resetConsoleActionComposerUi, resetConsoleActionRevealClaim} from '@/client/console/consoleActionComposerUi';
import {focusKicker} from '@/client/console/consoleActionFlow';
import {buildTradeBatch, colonyBuildAsksCardTarget, colonyBuildDrawsCards, colonyOwnerBonusDrawsCards, colonyTradeAsksCardTargets, colonyTradeMayDrawCards, freeTradeFleets, stepResponse, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {colonyTradeReason} from '@/client/console/colonyTradeReason';
import {buildPlayCardBatch} from '@/client/console/consolePlayCardComposer';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import {cardHasRules} from '@/client/components/console/consoleCardRules';
import ConsoleInspectSide from '@/client/components/console/ConsoleInspectSide.vue';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import {buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';
import Card from '@/client/components/card/CardFace.vue';
import {ZoomCard, bonusZoomEntry, isMarsBotCorpZoom} from '@/client/components/card/cardZoomTypes';
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {marsBotCorpAnnotations} from '@/client/components/marsbot/marsBotCorpRules';
import {consoleCardZoom, openConsoleCardZoom, navigateConsoleCardZoom, closeConsoleCardZoom, setConsoleZoomInspectTab, slotZoomOrigin, ZoomOrigin, ConsoleZoomProvenance} from '@/client/console/consoleCardZoom';
import {beginZoomOpen, cancelZoomOpen, playZoomOpenFlight, zoomOpenSourceRect, playZoomClose, playZoomDepart, playZoomHandoff, playZoomSwap, retargetZoomHold, releaseZoomMotion} from '@/client/console/consoleZoomMotion';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {currentRevealEvent, drawnCardsState, untakenNameMultiset} from '@/client/components/drawnCards/drawnCardsState';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';
import {revealViewerState} from '@/client/components/notifications/revealViewerState';
import {ConsoleTask, TaskKind, taskFor, taskMinimizable, taskServedByHost, shellTaskOnSurface, followUpStepStage, NATIVE_COMPOSITE_KINDS, SCENE_KINDS, SECTION_SERVED_KINDS, SHELL_SECTION_KINDS, corpFirstActionInStartFlow} from '@/client/console/consoleTaskRouter';
import ConsoleSpendHeat from '@/client/components/console/ConsoleSpendHeat.vue';
import ConsoleVenusBonus from '@/client/components/console/ConsoleVenusBonus.vue';
import ConsoleBotAttack from '@/client/components/console/ConsoleBotAttack.vue';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {buildBotAttackView, BotAttackViewModel} from '@/client/console/botAttack/botAttackModel';
import ConsoleAresGlobals from '@/client/components/console/ConsoleAresGlobals.vue';

import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
import {PlacementConversion, PlacementShape} from '@/client/console/placementDossier';

import {ConsoleTaskSummary, consoleTaskSummary, placementKicker} from '@/client/console/consoleTaskSummary';
import {setStartSetupRevealSuspended} from '@/client/components/startGameFlow/startSetupRevealState';
import {corpActionOptionIndexFor, corporationCardNames, corpStatusFor, startFlowCorpPrompt} from '@/client/components/startGameFlow/startGameFlowState';
import {cancelResponse, cardsResponse, colonyResponse, orWrappedResponse} from '@/client/console/taskResponses';
import {leakDetectorState, startConsoleLeakDetector, stopConsoleLeakDetector, setConsoleTaskDeferred, setConsoleTaskSpacePlacement} from '@/client/console/consoleLeakDetector';
import {govScaleFocusState, beginGovScaleClose, commitGovScaleFocus, resetGovScaleFocus} from '@/client/console/consoleGovScaleFocus';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import ConsoleHydroMarkerLayer from '@/client/components/console/hydroMarker/ConsoleHydroMarkerLayer.vue';
import {armHydroMarker, abortHydroMarker, isHydroMarkerActive, hydroMarkerState} from '@/client/console/hydroMarker/consoleHydroMarker';
import {
  HydroResolutionKind, advanceHydroCommitPhase, beginHydroCommit, hydroFlowState,
  hydroWorkspacePhase, isHydroCeremonyActive, resetHydroFlow, setHydroRepeatBridge,
} from '@/client/console/hydroFlow/consoleHydroFlow';
import {bonusDiscardStep, BonusDiscardStep} from '@/client/console/colonyTrade/colonyBonusDiscardStep';
import {drawnRevealCommandRun} from '@/client/console/consoleRevealCommands';
import {workspaceClaimsDrawReveal, workspaceClaimsColonyReveal, workspaceClaimsDeckCheck, workspaceClaimsEffect, workspaceClaimsPick, workspaceOutcomeClaimed, workspaceOutcomeBeatPending, claimWorkspaceOutcome, lastOutcomeReleaseStack, markWorkspaceOutcomeAnswerIn, markWorkspaceOutcomeArrivalDone, markWorkspaceOutcomeBeatDone, markWorkspaceOutcomePresenting, outcomeHostConcludesFlow, releaseWorkspaceOutcome, resetWorkspaceOutcome, setWorkspaceOutcomePhase, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import type {WorkspaceOutcomeKind} from '@/client/console/consoleWorkspaceOutcome';
import {ResultRevealPresentation, resultRevealPresentation} from '@/client/console/consoleRevealPresentation';
import {claimPlayOutcome, isPlayOutcomeHost, playLandingShowing} from '@/client/console/played/consolePlayOutcomeClaim';
import ConsoleBoardCardBonusLayer from '@/client/components/console/boardCardBonus/ConsoleBoardCardBonusLayer.vue';
import {armBoardCardBonus, abortBoardCardBonus, boardCardBonusState, isBoardCardBonusActive, isBoardCardBonusFieldPhase} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {
  planetFocusState, enterPlanetFocus, beginPlanetFocusExit, playPlanetFocusScaleBeat,
  planetFocusBeatAllowed, qualifiesForPlanetFocus, captureGlobalParams,
  registerPlanetFocusParamsSource, resetPlanetFocus, isPlanetFocusEngaged,
  snapPlanetFocusSettled,
} from '@/client/console/planetFocus';
import ConsoleDeckDrawLayer from '@/client/components/console/deckDraw/ConsoleDeckDrawLayer.vue';
import {abortDeckDraw, deckDrawDealing, deckDrawHolds, isDeckDrawActive} from '@/client/console/deckDraw/consoleDeckDraw';
import ConsolePatentSaleLayer from '@/client/components/console/patentSale/ConsolePatentSaleLayer.vue';
import {armPatentSale, isPatentSaleActive, patentSaleState} from '@/client/console/patentSale/consolePatentSale';
import ConsoleResourceTransferLayer from '@/client/components/console/resourceTransfer/ConsoleResourceTransferLayer.vue';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {runResourceTransfers, beginPanelRewardHold, releasePanelRewardHold, clearPanelRewardHold, panelRewardHold, resetCardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ActionCommitPlan, actionCommitHolding, consumeActionCommitPlan, releaseActionCommit} from '@/client/console/consoleActionCommit';
import ConsoleTilePlacementLayer from '@/client/components/console/tilePlacement/ConsoleTilePlacementLayer.vue';
import {tilePlacementHolding, tilePlacementState} from '@/client/console/tilePlacement/consoleTilePlacement';
import ConsoleColonyBuildLayer from '@/client/components/console/colonyBuild/ConsoleColonyBuildLayer.vue';
import {armColonyBuild, isColonyBuildActive} from '@/client/console/colonyBuild/consoleColonyBuild';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import ConsoleJournalPanel from '@/client/components/console/ConsoleJournalPanel.vue';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import type {HydroDeltaLine} from '@/client/components/hydronetwork/hydroReward';
import {consoleHydroUi, resetConsoleHydroUi} from '@/client/console/consoleHydroState';
import {consoleJournalUi} from '@/client/console/consoleJournalState';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl, activeGlyphSet} from '@/client/gamepad/glyphSets';
import {resolveScope} from '@/client/gamepad/focusScopes';
import {consoleState, closeConsoleLayers, stepIndex, stepSelectable, registerConsoleIntentHandler, ConsoleQuickId} from '@/client/console/consoleRouter';
import {surfaceShadeOn, surfaceShadeFullBleed, setPickSuppressed, beginAwaitingHandoff, clearAwaitingHandoff, isSurfaceAwaitingHandoff, captureSurfaceDeparture, markWheelHandoff, retargetWheelEcho, resetSurfaceMotion, surfaceMotionState} from '@/client/console/surfaceMotion/surfaceMotionState';
import {WheelArmEvent, WheelInputState, initialWheelInput, reduceWheel} from '@/client/console/quickWheel/wheelArmModel';
import {wheelControlState} from '@/client/console/quickWheel/wheelControlMode';
import {wheelHandoffSpecFor, CONFIRM_HANDOFF} from '@/client/console/quickWheel/wheelHandoffModel';
import {pulseWheelAnchors} from '@/client/console/quickWheel/wheelPulse';
import {actionPreviewMap, ensureActionPreviews, resetActionPreviews} from '@/client/console/actionPreviewStore';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {resolveAwaiting, AWAITING_SAFETY_MS} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {surfaceEnterHook, surfaceLeaveHook, surfaceEnterCancelledHook, surfaceLeaveCancelledHook, pinQuickWheelBox} from '@/client/console/surfaceMotion/surfaceMotionDirector';
import {consoleHandPickState, cancelConsoleHandPick, enterConsoleHandPick, resolveConsoleHandPick, resetConsoleHandPick} from '@/client/console/consoleHandPick';
import {consoleRepeatPickState, cancelConsoleRepeatPick, enterConsoleRepeatPick, resetConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {hydroAdvanceResponses} from '@/client/console/consoleHydroAdvance';
import {consoleRepeatPickUi, resetConsoleRepeatPickUi} from '@/client/console/consoleRepeatPickUi';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {albumSpecFor} from '@/client/components/console/consoleHandAlbum';
import {albumLayoutState, setAlbumLayoutRecomposer} from '@/client/console/consoleAlbumLayout';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import {StageHost, useWorkspaceBandGeometry} from '@/client/console/composables/useWorkspaceBandGeometry';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {awaitingViewerInput, offTurnReason} from '@/client/console/offTurnReason';
// Only as the DEGRADE default for a player model that predates `maCosts` (an
// old save, a test fixture) — the live price always comes from the server.
import {AWARD_COSTS, MILESTONE_COST} from '@/common/constants';
import {notificationBus} from '@/client/components/notifications/notificationBus';
import {
  ConvertPlantsMatch,
  findAwardOptionPath,
  findConvertHeatOption,
  findConvertPlantsOption,
  findEndTurnPath,
  findHydroActionPath,
  findMilestoneOptionPath,
  findPassPath,
  findPlayProjectCardAction,
  findSellPatentsAction,
  findStandardProjectsAction,
  findTradeColonyContext,
  hasTurn,
  inputTitleText,
  promptIdentityKey,
  optionResponseForPath,
  wrapPath,
} from '@/client/console/turnIntents';
import {infoModeState, openInfoMode, closeInfoMode, settleInfoModeClose, restoreConsoleSnapshot, cyclePlayer, InfoDetail} from '@/client/console/infoModeState';
import {playInspectedSwitchMotion, playInspectedReturnMotion} from '@/client/console/inspectSwitchMotion';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {boardInfoState, configureBoardInfo, fetchBoardCellPreview} from '@/client/components/board/boardInfoState';
import {BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {journalState} from '@/client/components/journal/journalState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {actionLabelForPlayer, liveWaitingSignal} from '@/client/components/overview/playerLabels';
import ConsoleMandatoryAnnounce from '@/client/components/console/ConsoleMandatoryAnnounce.vue';
import {
  MandatoryBeat,
  MandatoryFlowBeat,
  mandatoryBeatFor,
  isMandatoryBeatHeld,
  isMandatoryBeatPresented,
  acknowledgeMandatoryBeat,
  markMandatoryBeatPresented,
  noteMandatoryBeatIdentity,
  resetMandatoryGate,
  setMandatoryGateHeld,
} from '@/client/console/consoleMandatoryGate';
import {
  AdmissionSignals,
  PromptSurface,
  isPromptAdmitted,
  setConsolePlacementHeld,
  resetPromptAdmission,
} from '@/client/console/consolePromptAdmission';
import {
  guardedAdmissionSignals,
  noteAdmissionSignals,
  setConsoleBoardHomeIdle,
} from '@/client/console/consoleForegroundWatchdog';

type PendingPlayCard = {
  cardName: CardName;
  input: SelectProjectCardToPlayModel;
};

/** The CLIENT-built standard-project payment, hosted NATIVELY by the task
 * host via `promptOverride` (T3) — nothing committed until confirm; B = Cancel. */
type PendingClientPayment = {
  cardName: CardName;
  input: SelectPaymentModel;
};

/** The synthetic host task for a client-built payment prompt. */
const CLIENT_PAYMENT_TASK: ConsoleTask = {kind: 'payment'};

/* (The terminal std-project beat's length is the PHRASE's own now — press,
 * sweep and the post-chip read live in `consoleStdProjectCommit.ts`, so the
 * dismiss can never disagree with the animation it is waiting for.) */

/** P17: px per full-deflection frame for the right-stick console scroll
 *  (mirrors the DOM engine's SCROLL_STEP_PX so the feel is identical). */
const CONSOLE_SCROLL_STEP_PX = 24;

/** The MA workspace commit backstop: a submit whose verdict never arrives
 *  (lost response) restores the reversible detail with an honest reason —
 *  far above any real round-trip, far below the 35 s hold ceiling. */
const MA_COMMIT_SAFETY_MS = 15_000;

/** The hydro RESULT stage's read hold — long enough for the route + reward
 *  lines, skippable by A/B (both land in `finishHydroFlow`). */
const HYDRO_RESULT_HOLD_MS = 2400;

/**
 * WHICH PROMPTS A CARD PLAY'S CLAIM ANSWERS FOR — the card questions its own
 * draw raises: the pick over the cards it turned over (`deckSelect` is the
 * DRAW & SELECT surface, `cardSelect` the buy/keep browser) and the payment
 * that finishes a buy (pick-then-pay is ONE decision).
 *
 * Everything else the same response may carry — a placement, an OrOptions
 * branch, a resource pick, a discard from hand — is the play's ordinary
 * follow-up and keeps its own surface, so the claim must let go of it.
 *
 * The one addition is not a KIND but a shape: a MARKED optional effect
 * (`effectDecisionBelongsToWorkspace`) is a `choice` like any other, and only
 * the server's `choiceContext` tells it apart from the branch pick beside it —
 * which is why it is asked as a predicate at the call site rather than added to
 * this set.
 */
const PLAY_CLAIMED_TASK_KINDS: ReadonlySet<TaskKind> =
  new Set<TaskKind>(['deckSelect', 'cardSelect', 'payment']);

export default defineComponent({
  name: 'ConsoleShell',
  components: {
    ConsoleStatusStrip,
    ConsoleMandatoryAnnounce,
    ConsoleTerraformingCeremony,
    ConsoleBotTurnReview,
    ConsoleCommandBar,
    ConsoleHandDock,
    ConsoleSheet,
    ConsoleMaScreen,
    ConsoleMaCeremony,
    ConsoleQuickSelector,
    BarButtonIcon,
    ConsoleStdProjectsScreen,
    ConsoleContextPanel,
    ConsoleStrategyRail,
    ConsoleSystemAlert,
    ConsoleBoardSection,
    ConsoleHandSection,
    ConsoleResourcePanel,
    ConsoleColoniesSection,
    ConsoleInfoMode,
    ConsoleCardRulesPanel,
    ConsoleInspectSide,
    ConsoleCardAvailabilityPanel,
    ConsoleStrandedPrompt,
    ConsoleTaskHost,
    ConsoleGovernmentSupport,
    ConsoleEffectDecision,
    ConsoleFinalGreenery,
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
    ConsoleHandRevealLayer,
    ConsoleHandDeliveryLayer,
    ConsoleDraftTray,
    ConsoleDraftWorkspace,
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
    ConsoleTilePlacementLayer,
    ConsoleColonyBuildLayer,
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
    return {conMainEl, conRailEl, conStratEl};
  },
  data() {
    return {
      consoleState,
      consoleCardZoom,
      playedHeroState,
      handRevealState,
      handDeliveryState,
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
      /** Planet Focus (main-grid placement): phases + held global params. */
      planetFocusState,
      /** Unregister fn of the planet-focus live-params source. */
      offPlanetFocusParams: undefined as (() => void) | undefined,
      /** The `.con-ws` DOM-presence flags (ex-`:has()`) + their observer's
       *  dispose — module reactive mirrored into data() so conRootClasses
       *  tracks it (the path-watcher data-mirror rule). */
      wsPresence: conWsPresence,
      offWsPresence: undefined as (() => void) | undefined,
      /** Fullscreen open/close choreography: chrome held hidden mid-flight. */
      zoomFlight: false,
      /** Backdrop fade-out while the close flight plays. */
      zoomClosing: false,
      /** Re-entrancy guard for the single-card reveal L3 role swap. */
      zoomSwapping: false,
      /** The OPEN flight is in progress (dialog not shown yet) — input gated. */
      zoomOpening: false,
      /** The open-flight proxy (rendered on `.con-zoom-flight-layer`). */
      zoomOpenProxy: undefined as {card: ZoomCard, zoom: number} | undefined,
      /** Stale-callback fence for the async open sequence (measure/flight). */
      zoomOpenToken: 0,
      /** Deferred proxy removal after the top layer has covered it. */
      zoomOpenClearTimer: undefined as number | undefined,
      infoModeState,
      leakDetectorState,
      consoleSystemAlertState,
      /** Re-entrancy guard: an X TAP being replayed past the toast's hold capture. */
      notifTapReplay: false,
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
      /**
       * THE POST-DISCARD RESTORE is owed: the hand has answered and is on its
       * way back to the dock, and the colony focus must re-expand from the
       * source chip BEFORE the track's committed reset may be reported — the
       * marker's return is the resolution's FINAL commit beat and it plays on
       * the big track of the colony's own focus, never over the hand and
       * never on the overview grid.
       */
      colonyFocusRestorePending: false,
      /** The colony-bonus cube this workspace already answered by itself (the
       *  auto-collect's one-shot dedupe — see `colonyBonusAutoCollect`). */
      colonyBonusCollected: '',
      /** The armed entry's BOUNDED WAIT (COLONY_BONUS_ENTRY_WAIT_MS) — the net
       *  under «entered, and nothing ever arrived». */
      colonyEntryWaitTimer: undefined as number | undefined,
      /** The hydronetwork marker-advance controller (the plan-reset watcher). */
      hydroMarkerState,
      pendingPlayCard: undefined as PendingPlayCard | undefined,
      /** The client hand-pick bridge state (composer → hand section). */
      consoleHandPickState,
      consoleRepeatPickState,
      /* (`handPickReturn` is gone: the frame UNDER the pick's overlay hand IS
         the origin, so there is nothing to remember and nothing to restore.) */
      /**
       * The pick surface FROZEN at the moment a discard was answered. The client
       * hand-pick bridge resets itself as it resolves, but the cinematic still
       * has to lift the card out of that very grid — so the section keeps
       * rendering this snapshot until the scene hands off (phase 'leaving').
       */
      discardFreeze: undefined as ConsoleHandSelectMode | undefined,
      /** The card mid-RETURN from a cancelled play composer (its hand slot
       *  stays held until the transfer proxy touches down). */
      returningPlayCard: undefined as CardName | undefined,
      /** Stale-release token of the start excursion's quiet re-check (the
       *  release is confirmed one tick + one frame later, so a one-flush
       *  hand-off between two chain signals can never slip through). */
      excursionReleaseToken: 0,
      /** The card just PLAYED (success) — its hand slot stays held until the
       *  server response removes it from the hand (never a fake return). */
      departingPlayCard: undefined as CardName | undefined,
      departingTimer: undefined as number | undefined,
      pendingClientPayment: undefined as PendingClientPayment | undefined,
      /** The hydro workspace flow — module reactive, mirrored here for path
       *  watchers (vue-path-watcher rule). */
      hydroFlow: hydroFlowState,
      /** The hydro result stage's read-hold timer (A/B skip it). */
      hydroResultTimer: undefined as number | undefined,
      /** The colony workspace flow (browse ⇄ focus stage) — module reactive,
       *  mirrored here for path watchers (vue-path-watcher rule). */
      colonyFocus: colonyFocusState,
      /* (The COLONY EMBED LATCH and `colonyOpenedByPrompt` are gone: a
         SelectColony arriving inside a live flow PUSHES a colonies frame onto
         that flow's stack, and «who brought the player here» is the frame's own
         anchor. A latch existed only because ownership had to be remembered
         separately from presence.) */
      /** X on the board home — the «Разыграно» tableau overlay (view-only). */
      playedOpen: false,
      /** A colony name opened READ-ONLY from the journal (X on a colony row). */
      journalColonyInspect: undefined as ColonyName | undefined,
      convertPlantsPending: undefined as ConvertPlantsMatch | undefined,
      /** The quick wheel's live input state (focus + arm, wheelArmModel). */
      wheelInput: initialWheelInput() as WheelInputState,
      /** The persisted control-style choice (quick-select / focus-confirm) —
       *  mirrored for the path watcher below (module-reactive rule). */
      wheelControl: wheelControlState,
      /**
       * The focused cell's PLACEMENT preview (cost / gains / who else receives
       * / endgame VP). Fetched per focused cell while a placement is active —
       * `boardInfoState.info` (the hover facts) deliberately carries none of the
       * placement CONSEQUENCES, so the panel needs this second read.
       */
      cellPreview: undefined as BoardPlacementPreview | undefined,
      cellPreviewToken: 0,
      /** A task's nested space-type option being picked on the board. */
      taskSpacePending: undefined as {index: number, spacePrompt: PlayerInputModel} | undefined,
      /** The board pick out right now came from the FINALE's placement branch. */
      finalGreeneryPickPending: false,
      /** …and the board COMMITTED it. `waitingFor` still holds the finale
       *  prompt for the whole round-trip (the server has not answered yet), so
       *  without this the screen re-mounts the instant the pick is released and
       *  BLINKS over the greenery's landing animation. */
      finalGreeneryCommitting: false,
      /** Prompt identity — a change resets the task defer state. */
      lastTaskKey: '',
      /** The reveal-result the player already acknowledged (until the server clears). */
      dismissedRevealKey: '',
      /**
       * A dismiss deferred behind the ACTION COMMIT's minimum readable beat
       * (a fast server answer must not cut the activation short). Executed
       * by the `commitHolding` falling-edge watcher — the motion's own
       * settle releases it, never a timer.
       */
      pendingCommitDismiss: undefined as (() => void) | undefined,
      /** The console-native card-action center's UI state (filter + confirm-open). */
      consoleCardActionsUi,
      /** The MA workspace commit's safety backstop (a verdict may never hang). */
      maFocusSafetyTimer: undefined as number | undefined,
      notice: '',
      noticeTimer: undefined as number | undefined,
      offIntent: undefined as (() => void) | undefined,
      /** Release fn of the held 'mandatory-choice' presentation lease. */
      releasePresentationLease: undefined as (() => void) | undefined,
    };
  },
  computed: {
    game(): GameModel {
      return this.playerView.game;
    },
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    myTurn(): boolean {
      return hasTurn(this.playerView);
    },
    /** The server is waiting on the VIEWER at all — the free action menu OR a
     *  mandatory sub-decision (corp first action / forced reaction / placement /
     *  any deferred prompt). `myTurn` ⊂ this: when a mandatory prompt is pending
     *  `myTurn` is false but this stays true, so an off-turn reason reads
     *  «Сначала завершите текущее действие», not «Сейчас не ваш ход». */
    awaitingInput(): boolean {
      return awaitingViewerInput(this.playerView);
    },
    /** The server offers convert-plants RIGHT NOW — drives BOTH the resource-
     *  cell highlight and the LT quick menu. Server-authoritative (mirrors the
     *  desktop convert availability), so it's live only on the viewer's turn. */
    convertPlantsReady(): boolean {
      return findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true) !== undefined;
    },
    /** The server offers convert-heat RIGHT NOW (same contract as above). */
    convertHeatReady(): boolean {
      return findConvertHeatOption(this.playerView.waitingFor) !== undefined;
    },
    playAction() {
      return findPlayProjectCardAction(this.playerView.waitingFor);
    },
    // ── action intelligence: POTENTIAL availability, one meaning ────────
    /**
     * The four wheel counts, all of them «what could I do in this game state»
     * — the server's turn-independent projection, clamped for card intake.
     *
     * They used to be read off the LIVE prompt tree, so «КАРТЫ 4» vanished the
     * instant an opponent took over and came back when the turn returned: the
     * wheel described the clock, not the position. Nothing here consults
     * `waitingFor`; the turn gate is an EXECUTION gate and is applied where a
     * move is actually submitted (see `src/common/availability/AvailabilityBlocker.ts`).
     */
    wheelCounts(): WheelCounts {
      return wheelPotentialCounts({
        potential: this.thisPlayer.potentialActions,
        handTotal: this.cardsTotalCount,
        hasColonies: this.game.colonies.length > 0,
        hasHydro: this.game.gameOptions.expansions.deltaProject === true,
      });
    },
    cardsPlayableCount(): number {
      return this.wheelCounts.cards;
    },
    /** Everything the RT wheel could offer, in one number (its bar badge). */
    wheelCountsTotal(): number {
      const c = this.wheelCounts;
      return c.cards + c.cardActions + c.hydro + c.trade;
    },
    /** The hand total every HUD readout shows — the same intake-aware count
     *  the dock's «КАРТЫ» line uses (held / in-flight / untaken-reveal
     *  copies excluded), so no surface ever runs ahead of a physical take. */
    cardsTotalCount(): number {
      const totals = new Map<string, number>();
      for (const c of this.handDockCards) {
        totals.set(c.name, (totals.get(c.name) ?? 0) + 1);
      }
      const held = new Map<string, number>();
      for (const n of this.dockHeld) {
        held.set(n, (held.get(n) ?? 0) + 1);
      }
      let hidden = 0;
      held.forEach((k, name) => {
        hidden += Math.min(k, totals.get(name) ?? 0);
      });
      return this.handDockCards.length - hidden;
    },
    actionsAvailableCount(): number {
      return this.wheelCounts.cardActions;
    },
    // ── the permanent HAND DOCK (bottom-centre footer bay) ──────────────
    /** The dock's hand in SERVER order (append-stable — backs only, so the
     *  playable-first sort of the hand SECTION would just reshuffle the
     *  silhouettes on every playability change). SRR-hosted cards count:
     *  they are playable from the hand surface. */
    handDockCards(): ReadonlyArray<CardModel> {
      return [
        ...this.playerView.cardsInHand,
        ...(this.thisPlayer.selfReplicatingRobotsCards ?? []),
      ];
    },
    /**
     * Names the dock must WITHHOLD (hidden-with-layout + excluded from the
     * «КАРТЫ» count) — the union of every "on its way into the hand" ledger:
     *  - the episodic starting-cards hold (armDeliveryHold, pre-payment);
     *  - cards mid-flight into the dock (released per touchdown — the
     *    counter ticks only on a physical landing);
     *  - UNTAKEN reveal-batch cards: the server puts a drawn batch straight
     *    into `cardsInHand`, but until the player presses «взять» those
     *    cards are staged on the reveal surface — the hand count must not
     *    jump ahead of the take (the desktop's stagedCardsInHand twin).
     * A multiset (may repeat names) — the dock hides that many NEWEST copies.
     */
    dockHeld(): ReadonlyArray<string> {
      const out: Array<string> = [...handDeliveryState.held, ...handDeliveryState.inFlight];
      untakenNameMultiset().forEach((k, name) => {
        for (let i = 0; i < k; i++) {
          out.push(name);
        }
      });
      return out;
    },
    /**
     * Dock backs the hand ALBUM owns right now (hidden in the tray) —
     * DERIVED, never stored, so it can't drift from the live hand:
     *  - the WHOLE album universe while the album owns the cards — phase
     *    `open`/`closing`, or `opening` once its proxies stand (the old
     *    whole-pack `dockLifted` timing). THE WHOLE HAND LEAVES THE DOCK:
     *    a card outside the tag filter is not on any page, but it is parked
     *    with the far page packets beyond the stage edge — the dock never
     *    shows a «remainder» while the player is leafing the album (one
     *    card, one home);
     *  - plus `dockExtraLift`: filter-episode leavers still airborne
     *    (released at the episode's materialization).
     */
    dockLiftedNames(): ReadonlyArray<string> {
      const st = handRevealState;
      const overlayOwns = st.phase === 'open' || st.phase === 'closing' ||
        (st.phase === 'opening' && st.flights.length > 0);
      if (!overlayOwns) {
        return st.dockExtraLift;
      }
      return [...this.handAlbumUniverse.map((e) => e.card.name), ...st.dockExtraLift];
    },
    /**
     * The dock renders IDENTICALLY in every shell state (welded into the
     * bar) — this only gates the CLICK affordance (hover lift + pointer),
     * derived from the SAME flags this template mounts surfaces by: the
     * calm board home / placement / draft-wait / quick wheels are
     * interactive; any owning overlay or a non-board section is not.
     */
    /**
     * THE DOCK IS NEVER HIDDEN — it is a physical part of the bottom bar
     * (the player must always see their hand count). This decides only the
     * footer's Z: TRUE = a tall bottom-reaching panel is up, so the footer
     * drops BELOW the overlay band (`--under-scene`, z 11390) and the panel
     * covers the PACK where they geometrically overlap — the plate +
     * «КАРТЫ» counter + command hints keep peeking below every panel's
     * bottom edge (panels end above the plate line).
     *
     * Deliberately NOT here (the footer stays ON TOP — a bright dock the
     * cards physically fly into): the start ceremony (`startTask`), the
     * task-host prompts incl. the research buy (`hostTask`), and the reveal
     * modal (`consoleRevealMode`) — its panel is RAISED above the dock zone
     * in CSS so per-card takes land in a fully visible hand.
     */
    /**
     * Surfaces that drop the FOOTER below themselves. TV-4K iteration 2:
     * this list is now ONLY the bottom-anchored surfaces (played table,
     * draft pick) + surfaces carrying their OWN command bar (bot review) or
     * an inline contract (stranded guard). The CENTERED decision surfaces
     * (composers / sheets / inspectors / task panels) used to be here too —
     * which buried the ONE command bar under their near-opaque TV backdrops
     * (the "куда-то пропала панель действий" defect): their hints are
     * published TO that bar, so the bar must stay on top. They park the
     * hand dock instead (`dockParkedUnderScene`).
     */
    footerUnderScene(): boolean {
      return (
        this.playedTableVisible ||
        this.botTurnReviewState.open ||
        this.leakDetectorState.stranded !== undefined
      );
    },
    /**
     * The centered decision surfaces: the footer BAR stays on top (their
     * command contract renders there), so the dock's card pack must not
     * poke over their veil — the dock parks (v-show) for their lifetime.
     * Flights into the dock only happen AFTER these surfaces close, so a
     * parked dock never robs a landing target.
     */
    dockParkedUnderScene(): boolean {
      // A live CLIENT hand pick hides the composer / Action Center (v-show) —
      // the hand section IS the scene, so the dock unparks (the suitable-only
      // filter episode needs its rects, and the tray belongs to the hand view).
      if (this.handPickActive) {
        return false;
      }
      return (
        this.pendingPlayCard !== undefined ||
        this.colonyFocusOpen ||
        this.corpFirstActionOpen ||
        this.govSupportActive ||
        this.productionLossActive ||
        this.nativeCompositeTask !== undefined ||
        this.colonyInspectModel !== undefined ||
        this.consoleState.sheet !== undefined ||
        this.consoleState.confirm !== undefined ||
        this.infoModeState.open
      );
    },
    /** The OLD full под-сценой predicate — still what the HAND SECTION's
     *  verdict-bar z-drop keys off (`:underScene`). */
    sceneOverHand(): boolean {
      return this.footerUnderScene || this.dockParkedUnderScene;
    },
    /** The colonies / hydro WORKSPACE sections own the bottom of the screen
     *  (colonies' focus-colony summary rail, hydro's CTA zone). The dock STAYS
     *  MOUNTED there (a Pluto card-draw trade animates INTO it), but drops
     *  BELOW the section content by z-index so its cards never poke over the
     *  rail. Board home keeps the dock on top as usual. */
    dockBehindWorkspace(): boolean {
      const phase = this.playerView.game.phase;
      // The DRAFT WORKSPACE is a card-flow surface: the pick heroes fly, the
      // purchase flights land in the dock, and the player must see the bar +
      // the compact dock BRIGHT through the whole flow — never tucked behind
      // the plate (the tuck below is the legacy in-`.con-main` pick host's,
      // now the pre-game INITIALDRAFTING path only).
      if (workspaceFrameKnown('draft')) {
        return false;
      }
      if (phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING) {
        return true;
      }
      // …and NEVER while that section is a STEP INSIDE another workspace. The
      // tuck's whole purpose is local to the BARE section standing in
      // `.con-main` (its bottom rail, over which the dock's cards must not
      // poke). Hosted — a colony build raised by a prelude or by the
      // corporation's first action — the section lives inside the start
      // workspace, whose own full-bleed plate then paints across the footer's
      // row: the tuck puts the ONE command bar UNDER it and the player reads
      // «А ВЫБРАТЬ · L3 ОСМОТРЕТЬ ИСТОЧНИК · B СВЕРНУТЬ» dimmed out. Same
      // principle as the `dockParkedUnderScene` carve-out below, one nesting
      // level further out: the bar every surface publishes its hints to may
      // never be the thing that gets covered.
      if (workspaceFrameHost('colonies') !== undefined || workspaceFrameHost('hydro') !== undefined) {
        return false;
      }
      // The bare colonies / hydro section grid. ⚠ ONLY the bare grid — while a
      // dimming OVERLAY is up (the trade / hydro confirm, inspect, a sheet…)
      // the footer MUST stay at its high z so the command bar reads BRIGHT
      // above the overlay's backdrop (dropping it left the bar dimmed under the
      // trade confirm — "не понятно какую кнопку нажать"). Those states are
      // exactly `dockParkedUnderScene` (where the dock is hidden anyway, so
      // nothing needs to tuck behind) + the hydro confirm.
      return (this.consoleState.section === 'colonies' || this.consoleState.section === 'hydro') &&
        !this.dockParkedUnderScene;
    },
    /**
     * The pre-game INITIAL-SETUP window: the player has NO actual hand yet —
     * the `initialCards` wizard is live (incl. deferred / the submit in
     * flight), the initial draft is still dealing, or the viewer submitted
     * their picks and gen-1 research waits on the other players to submit
     * theirs. The hand dock's «КАРТЫ 0/0» would be a false readout for a
     * hand that does not exist, so the footer unmounts the dock AND its bay
     * for the whole window (see `handDockVisible`). The dock appears the
     * moment the game actually starts — the start ceremony's card delivery
     * (post-launch) is the first real hand content and needs the dock as its
     * landing target.
     *
     * ⚠️ GEN-1 RESEARCH IS A TABLE STATE, NEVER A PERSONAL ONE. The research
     * barrier holds that phase until the LAST seat has played and paid, so
     * `waitingFor === undefined` there means «my setup is in, the table's is
     * not» — and past the viewer's OWN corporation play that is the
     * deployment, hand and all. Reading the bare triple as «no hand yet»
     * hid the dock (`display:none`) at the exact frame the paid cards were
     * flying into it: `stableTargetRect` polled a zero-width rect for its
     * whole budget and the delivery landed nowhere. Solo vs MarsBot never
     * showed it (the bot pre-seeds `researchedPlayers`, so the window has
     * zero length) — it is a multiplayer-only bug, which is exactly why the
     * discriminator has to be the personal fact, not the phase.
     */
    setupHandPending(): boolean {
      if (this.playerView.waitingFor?.type === 'initialCards') {
        return true;
      }
      const phase = this.game.phase;
      if (phase === Phase.INITIALDRAFTING) {
        return true;
      }
      return this.game.generation === 1 && phase === Phase.RESEARCH &&
        this.playerView.waitingFor === undefined &&
        !startCorporationPlayed(this.playerView);
    },
    /** The dock (and the bar's centre bay) exists whenever a REAL hand can —
     *  everything but the endgame and the pre-game initial setup. */
    handDockVisible(): boolean {
      return this.game.phase !== 'end' && !this.setupHandPending;
    },
    /**
     * CARDS ARE PHYSICALLY ARRIVING at (or leaving) the dock — the INTAKE
     * ACCENT. For its duration the dock stands in its FULL pose whatever is
     * open: the landing is the one moment the pack must be seen at size, and
     * every flight in these episodes measures the dock's rects — a pose
     * change mid-episode would move the targets out from under the proxies.
     */
    dockIntakeAccent(): boolean {
      // A BOUNDED LEASE, never a read of foreign flags (consoleDockAccent.ts).
      // The first cut ORed four booleans owned by four different directors —
      // and any one of them sticking disabled the compact pose for the REST OF
      // THE GAME. One of them did exactly that.
      return dockIntakeAccentActive();
    },
    /**
     * THE COMPACT POSE — the dock's answer to a busy screen (the presence
     * contract above): it never hides and never re-layers below a surface;
     * where a status rail / a workspace band / a sheet / an embedded step
     * would collide with the pack, the pack steps back into the tray instead.
     * `!handDockInteractive` is exactly «something owns the screen» — the one
     * predicate that already enumerates every such surface — plus Planet
     * Focus, which is a board-home state that makes the BOARD the subject.
     */
    handDockCompact(): boolean {
      if (this.dockIntakeAccent) {
        return false;
      }
      return planetFocusState.phase !== 'idle' || !this.handDockInteractive;
    },
    handDockInteractive(): boolean {
      if (this.consoleState.section !== 'board' || this.consoleState.fallbackActive || this.game.phase === 'end') {
        return false;
      }
      return !(
        this.hostTask !== undefined ||
        // The draft workspace: the dock stays VISIBLE in its compact pose for
        // the whole flow (the intake accent lease brings it to FULL exactly
        // while the purchase flights land).
        this.draftWorkspaceMounted ||
        this.startSceneServes ||
        this.govSupportActive ||
        this.productionLossActive ||
        this.nativeCompositeTask !== undefined ||
        this.consoleRevealMode !== undefined ||
        this.consoleState.sheet !== undefined ||
        this.consoleState.confirm !== undefined ||
        this.pendingPlayCard !== undefined ||
        this.colonyFocusOpen ||
        this.colonyInspectModel !== undefined ||
        this.corpFirstActionOpen ||
        this.playedTableVisible ||
        this.journalPanelVisible ||
        this.infoModeState.open ||
        this.botTurnReviewState.open ||
        this.govScaleFocusState.holding || this.govScaleFocusState.closing ||
        draftPickBeatActive() || riseSceneEngaged() ||
        this.leakDetectorState.stranded !== undefined
      );
    },
    /** The bay width flows from ONE source (consoleHandDock.ts) into both
     *  consumers: the bar's grid track and the dock's plate. */
    footerVars(): Record<string, string> {
      return {'--con-hd-bay': `${handDockBayRem(consoleLayoutState.profile)}rem`};
    },
    /** Award names for the translation-proof structure fallback (the fund
     *  OrOptions title is a Message that i18n mutates in place). */
    awardNames(): Array<string> {
      return this.game.awards.map((a) => a.name);
    },
    // ── placement ───────────────────────────────────────────────────────
    /** The convert-plants inner SelectSpace, narrowed for the headless picker. */
    convertPlantsPrompt() {
      const p = this.convertPlantsPending?.spacePrompt;
      return p !== undefined && p.type === 'space' ? p : undefined;
    },
    /**
     * PRESENTATION FLOW: while the player is being shown what just happened
     * (the compact AI-turn card / the opened «Разбор хода» review), the
     * console's mandatory task surfaces hold off mounting — bounded by the
     * card's TTL / the review close. The holding card / review is registered as
     * a serving surface in the leak detector, so the prompt is never "stranded".
     */
    presentationHeld(): boolean {
      return isMandatoryPromptsHeld();
    },
    /**
     * SOMETHING THE PLAYER IS STILL WORKING THROUGH OWNS THE FOREGROUND — so no
     * prompt-routed DOOR may open into it. While busy, a pending shell-section
     * prompt is held BEHIND what is running; a watcher opens the serving surface
     * the moment this clears (else it'd be a stranded prompt).
     *
     * It is the `followUp` ADMISSION, not a list of its own. The hand-rolled
     * version listed the reveal, the presentation hold, the played hero and the
     * card arrival — and had drifted from the policy it was paraphrasing by four
     * signals (a PENDING reveal batch, the tile-placement hero, a live discard
     * transaction, and the watchdog's staleness mask). That is precisely the
     * drift `consolePromptAdmission` exists to end: one table, one evaluation.
     */
    consoleForegroundBusy(): boolean {
      return !this.admits('followUp');
    },
    /** The surface-motion shade (`.con-shade--on`): ≥1 migrated band surface
     *  owns the foreground, a committed submit is awaiting its answer, or
     *  the trade-fleet flight keeps its thin veil over the colony grid. */
    surfaceShadeVisible(): boolean {
      return surfaceShadeOn() || isTradeFleetActive();
    },
    /**
     * The live shade belongs to a FULL-BLEED owner (the card-reveal cinematic),
     * so its dim covers the whole shell rather than the opening. The set lives
     * with the shade state (`surfaceShadeFullBleed`) — the shell only forwards
     * the verdict, and the trade-fleet veil is a decision-surface dim like every
     * other one.
     */
    surfaceShadeFullBleed(): boolean {
      return surfaceShadeFullBleed();
    },
    /** The shade thins to a light veil: the task host's table beat (draft
     *  tray owns the screen) and the trade-fleet launch (ship focal, grid
     *  readable) — mirrors the retired per-surface backdrop rules. */
    surfaceShadeVeil(): boolean {
      return draftTrayState.tableView || isTradeFleetActive();
    },
    /** The currently VISIBLE transient notification — the topmost (the feed is
     *  serial, so at most one). GLOBAL rule: any console toast is dismissable
     *  with B («B Закрыть» on the card); the flow-holding AI-turn card
     *  additionally offers its detail action on press-and-HOLD X. */
    topNotification(): LiveNotification | undefined {
      const feed = notificationState.transient;
      return feed.length > 0 ? feed[feed.length - 1] : undefined;
    },
    /** The pending-queue backlog (the banner-band chip). */
    pendingEvents(): PendingQueueSummary {
      return pendingSummary();
    },
    /**
     * The mode the reveal overlay is ACTUALLY mounted with, or undefined when it
     * is not on screen. The single source for both its `v-if` and the foreground
     * lease — they were two hand-written expressions and they had drifted: the
     * lease was taken on `consoleRevealMode` alone while the overlay
     * additionally required `!playedHeroHolds`, so through the hero beat the
     * console held a `mandatory-choice` lease with NOTHING rendered. That is a
     * foreground claim nobody can satisfy: the notification queue cannot drain
     * and no mandatory surface may mount behind it.
     */
    revealOverlayMode(): ConsoleRevealMode | undefined {
      return this.playedHeroHolds ? undefined : this.consoleRevealMode;
    },
    /** A console blocking foreground surface is actively presenting (drives
     *  the lease): task host / start scene / gov-support panel / the dedicated
     *  composites, plus the reveal overlays ('drawn' also derives from
     *  drawnCardsState — the lease covers the console-only 'result'/'viewer'
     *  modes too).
     *
     *  A LEASE IS A CLAIM THAT SOMETHING IS VISIBLE — so every branch here must
     *  match a surface that really renders. The two states documented as
     *  "render nowhere" are excluded explicitly: the hero beat unmounting the
     *  reveal (via `revealOverlayVisible`) and a host claimed by a workspace
     *  whose outcome slot does not exist yet (`taskHeldForWorkspace`, see its
     *  own comment). Everything else the watchdog covers as the net.
     *
     *  …AND THE CONVERSE MATTERS JUST AS MUCH: a surface that renders WITHOUT a
     *  lease can be retracted out from under the player. `mandatoryPromptsHeld`
     *  lets a flow-holding bot-turn card hold the NEXT prompt only while no
     *  mandatory lease is held — its documented fixed point ("with a surface up
     *  the hold is off and the surface stays"). The DEDICATED COMPOSITES took no
     *  lease and are gated on the very `admits('host')` that hold feeds, so a
     *  bot card arriving over «Разместите бонус шкалы Венеры» unmounted it for
     *  the card's whole TTL. Their branches are the surfaces' own `v-if`s. */
    consoleMandatoryPresenting(): boolean {
      if (this.revealOverlayMode !== undefined) {
        return true;
      }
      if (this.consoleState.task.deferred || this.taskHeldForWorkspace) {
        return false;
      }
      return (this.hostTask !== undefined && this.taskSpacePending === undefined) ||
        this.startSceneServes ||
        this.govSupportActive ||
        (this.compositeSurfaceActive && !this.deckPickHeldForWorkspace);
    },
    /** The played-card hero scene owns the foreground (spec §13: a follow-up
     *  decision surfaces only after the landing + result beat complete). */
    playedHeroHolds(): boolean {
      return playedHeroHolding();
    },
    /**
     * The DEDICATED first-action confirm modal is the SERVING SURFACE of the
     * corporation's mandatory first action — its presence is DERIVED from the
     * prompt, never opened imperatively (the open/close-race lesson from the
     * old «Разыграно» action mode). Deferring (B) hides it via the deferred
     * flag; answering it clears `shellTask` and the modal unmounts itself.
     * NOTE `shellTask` is suppressed while the hero scene / a reveal holds the
     * foreground, so the modal simply appears when the beat completes.
     */
    corpFirstActionOpen(): boolean {
      return this.shellTask?.kind === 'corpFirstAction' && !this.consoleState.task.deferred;
    },
    /** The overlay is up — as a manual browse, the hero stage, or a
     *  composer's TABLEAU PICK (the pick forces the table open over the
     *  hidden composer — consoleHandPick's played twin). */
    playedTableVisible(): boolean {
      return this.playedOpen || playedHeroState.tableOpen;
    },
    /**
     * A client pick bridge (hand / repeat-action) hides the owning composer
     * via v-show — the picked-in surface owns the screen, the shade yields.
     * (The TABLEAU bridge is gone: a played-card pick is now an EMBEDDED step
     * inside the workspace that asked, so nothing is hidden for it.)
     *
     * ⚠ THE ONE EXPRESSION. Every `v-show` that hides for a bridge binds to
     * THIS, and it is what `setPickSuppressed` publishes to surface-motion —
     * so the DOM flip and the director's «that leave was a bridge, not a
     * dismissal» verdict can never disagree. They did once, spelled out
     * separately: the director named only the hand pick, so the Viron repeat
     * pick's flip ran a real leave/enter pair and the action centre came back
     * as an empty frame (`surfaceMotionDirector.isPickBridgeHidden`).
     */
    pickBridgeActive(): boolean {
      return this.handPickActive || this.repeatPickActive;
    },
    /**
     * The corporations whose mandatory first action is live RIGHT NOW (>1 =
     * Merger's second corp). Empty when the prompt isn't up / is deferred.
     */
    corpFirstActionNames(): ReadonlyArray<CardName> {
      if (!this.corpFirstActionOpen) {
        return [];
      }
      return corporationCardNames(this.playerView)
        .filter((name) => corpStatusFor(this.playerView, name) === 'ready');
    },
    /** The incoming card the «Разыграно» table reserves a slot for (hero). */
    playedHeroIncoming(): CardModel | undefined {
      if (!playedHeroState.active || playedHeroState.card === undefined) {
        return undefined;
      }
      const p = playedHeroState.phase;
      if (p === 'armed' || p === 'idle' || p === 'failed') {
        return undefined;
      }
      return {name: playedHeroState.card} as CardModel;
    },
    /** The tile-placement hero owns the foreground (reactive twin of
     *  `tilePlacementHolding()` — `tilePlacementState` is in data()). */
    tilePlacementHolds(): boolean {
      const p = this.tilePlacementState.phase;
      return this.tilePlacementState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
    },
    /** The discard cinematic owns the screen for its bounded beat — the same
     *  contract the played / tile heroes have. Without it the task host would
     *  re-mount the instant its nested pick resolved and paint the branch list
     *  back OVER the card that is still flying out of the hand. */
    cardDiscardHolds(): boolean {
      const p = this.cardDiscardTransaction.phase;
      return this.cardDiscardTransaction.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
    },
    /** The chosen cards are still lying in the pick surface (fixate / flip /
     *  gather): the hand recedes behind them and stays frozen. */
    discardInOverlay(): boolean {
      return this.cardDiscardTransaction.active && discardPhaseInOverlay(this.cardDiscardTransaction.phase);
    },
    /**
     * THE OPTIONAL-DECISION SCREEN. A top-level `OrOptions` that the server
     * MARKED with `choiceContext` and whose every branch the adapter can serve
     * honestly becomes a decision screen instead of a list of thin rows.
     * `undefined` — for an unmarked prompt, a branch that needs a surface of
     * its own (a payment dial, a board pick), or any shape the adapter has not
     * been taught — keeps the existing task host. That is the whole migration
     * gate; there is no per-card switch anywhere.
     */
    effectDecisionVm(): EffectDecisionViewModel | undefined {
      return this.hostTask?.kind === 'choice' ? this.rawEffectDecisionVm : undefined;
    },
    /**
     * …and the SAME decision read off the RAW prompt, with no admission gate.
     *
     * OWNERSHIP AND READINESS ARE DIFFERENT QUESTIONS (embed rule 4), and here
     * they are separated by a whole cinematic: a play's own hero scene holds
     * the task host for its entire length, so «is the decision surface up?»
     * cannot answer «is this decision the play's own?». The reconciler asks the
     * second question — the same reason a play claim reads the RAW prompt kind
     * rather than «the gate is holding something».
     */
    rawEffectDecisionVm(): EffectDecisionViewModel | undefined {
      if (taskFor(this.playerView)?.kind !== 'choice') {
        return undefined;
      }
      return buildEffectDecision(this.playerView.waitingFor, {handNames: this.viewerHandNames});
    },
    /** The decision's identity — a NEW one must not inherit a stale focus. */
    effectDecisionKey(): string {
      const vm = this.effectDecisionVm;
      return vm === undefined ? '' : `${vm.eyebrowKey}|${vm.headlineKey}|${vm.actions.length}|${vm.source?.card ?? ''}`;
    },
    effectDecisionActive(): boolean {
      return this.effectDecisionVm !== undefined &&
        !this.govSupportActive && !this.productionLossActive &&
        !this.consoleState.task.deferred && this.taskSpacePending === undefined &&
        !this.handPickActive && !this.effectDecisionHeldForWorkspace;
    },
    /**
     * THE DECISION BELONGS TO AN OPEN WORKSPACE — the player pressed «Разыграть»
     * inside a screen and a card of theirs answered that press.
     *
     * Read off the RAW prompt for the same reason `taskBelongsToWorkspace` is
     * split from `taskEmbedTarget`: ownership is settled at submit time, long
     * before any surface may be shown. The `buildEffectDecision` term is not a
     * formality — a claim admitted for a shape this console cannot present
     * would SUPPRESS the standalone band and leave the prompt nowhere.
     */
    effectDecisionBelongsToWorkspace(): boolean {
      return workspaceClaimsEffect() && this.rawEffectDecisionVm !== undefined;
    },
    /** Claimed but not ready → render NOWHERE for the gap frame, never in a
     *  band of our own for one frame and somewhere else the next. The BEAT is
     *  part of «ready»: the play's own commit must be seen through before its
     *  consequence is put on screen. */
    effectDecisionHeldForWorkspace(): boolean {
      return this.effectDecisionBelongsToWorkspace &&
        (workspaceOutcomeState.embedSlot === '' || workspaceOutcomeBeatPending());
    },
    effectDecisionEmbedTarget(): string | undefined {
      // THE ADMITTED vm, not the raw one. Ownership is settled at submit time,
      // but a TARGET is a claim that something is about to be re-homed into the
      // zone — and `workspaceOutcomeEmbedded` reads it. The play's own cinematic
      // holds this prompt closed for its whole length, so the raw vm made the
      // zone «occupied» while nothing rendered in it: the crumb's tail dropped
      // to the generic «ДОБОР КАРТ» for the entire landing beat, i.e. it named a
      // stage that did not exist, one stage AHEAD of the flow.
      if (this.effectDecisionVm === undefined ||
          !this.effectDecisionBelongsToWorkspace || this.effectDecisionHeldForWorkspace) {
        return undefined;
      }
      const slot = workspaceOutcomeState.embedSlot;
      return slot === '' ? undefined : slot;
    },
    /**
     * THE PLAY'S CHAIN STILL OWES AN EFFECT DECISION — a batch was only ONE
     * effect of the press, and the server is still asking the other one.
     *
     * «Акведуки» draw three cards AND wake «Рециклон» in the SAME response:
     * the batch presents first (surfaces go in turn), and the take is where
     * the flow used to end — `result-detached`/`drawn-complete` released the
     * claim and folded the workspace under a prompt that had been standing in
     * `waitingFor` the whole time, so the decision then rose as a standalone
     * band over the board. The same fact the colony resolution states with
     * `colonyResolutionLive`: a claim is the CHAIN's ownership, and no single
     * leg's end may release it while another leg is still owed.
     *
     * Structural on both sides (the server's `choiceContext` + a shape the
     * adapter can present), and scoped to the play hosts — the only claims
     * that admit `'effect'`.
     */
    playEffectOwed(): boolean {
      return isPlayOutcomeHost(workspaceOutcomeState.host) && this.effectDecisionBelongsToWorkspace;
    },
    /**
     * THE DECISION SCREEN OWNS THIS PROMPT — it is on screen, OR briefly held
     * while the workspace that will host it publishes its zone.
     *
     * The TASK HOST must stand down for both. `effectDecisionActive` alone
     * suppresses it only for the first, so the hold would hand a marked
     * decision to the generic band for the gap frame — a modal blinking between
     * two stages of one flow, which is the whole class of break the embedding
     * removes.
     */
    effectDecisionOwnsPrompt(): boolean {
      return this.effectDecisionActive || this.effectDecisionHeldForWorkspace;
    },
    /**
     * THE FINALE. The endgame "turn your plants into greeneries" loop, on its
     * own screen — see finalGreeneryModel.ts for why it is not just another
     * optional decision (one of its two branches ends the player's game).
     * Marker-gated like every other adapter: unmarked → the host keeps it.
     */
    finalGreeneryVm(): FinalGreeneryViewModel | undefined {
      if (this.hostTask?.kind !== 'choice') {
        return undefined;
      }
      return buildFinalGreenery(this.playerView.waitingFor, this.playerView.thisPlayer);
    },
    /** The live prompt behind the finale — the placement branch is handed to
     *  the board with it. Narrowed here so the surface's prop stays required. */
    finalGreeneryPrompt(): PlayerInputModel | undefined {
      return this.finalGreeneryVm === undefined ? undefined : this.playerView.waitingFor;
    },
    finalGreeneryActive(): boolean {
      return this.finalGreeneryVm !== undefined &&
        !this.finalGreeneryCommitting &&
        !this.govSupportActive && !this.productionLossActive &&
        !this.consoleState.task.deferred && this.taskSpacePending === undefined &&
        !this.handPickActive;
    },
    /** Every card the viewer holds (incl. Self-Replicating-Robots hosts) — the
     *  ownership test that decides whether a nested pick is a HAND pick. */
    viewerHandNames(): ReadonlySet<string> {
      return new Set<string>([
        ...this.playerView.cardsInHand.map((c) => c.name),
        ...(this.playerView.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name),
      ]);
    },
    /**
     * A CARD-ARRIVAL cinematic owns the screen: cards are coming off the deck,
     * or lifting off a board cell. THE PLAY RESOLVES BEFORE ITS PROMPTS —
     * playing a science card that draws a card while Mars University is in
     * play produced the draw animation and the university's decision at the
     * same time, which is two stories told over each other.
     *
     * Why the existing sequencing missed it: both scenes hold the foreground
     * as `'notification-only'` (they ASSEMBLE the reveal modal around their own
     * landed cards, so a blocking hold would withhold the very surface they
     * build into). `presentationHeld` counts only BLOCKING holds, and
     * `rawDrawnRevealPending` deliberately goes false while they run — so
     * nothing was left to hold the task surfaces back. This names them.
     *
     * INCLUDING THE INTAKE. Waiting for the reveal is only half the wait: the
     * player answers it by TAKING the card, and the card then physically flies
     * into the dock. The reveal clears the instant it is answered, so without
     * this the prompt opened over a card still in the air. If we wait for an
     * action, we wait for the animation that action starts.
     *
     * Read through the REACTIVE flight list, not `isHandDeliveryActive()` — the
     * latter is a plain counter, so a computed built on it would never
     * re-evaluate when the flight ends.
     *
     * Deliberately NOT every animation hold: the hydro draw lands its cards in
     * a task-host pick, and the card-DEAL cinematic plays INSIDE the host —
     * suppressing the host for those would unmount the stage they play on.
     * (The intake is safe: its proxies live on the shell-level delivery layer,
     * so nothing it needs dies with the surface that released the cards.)
     */
    cardArrivalBusy(): boolean {
      return deckDrawHolds() ||
        isBoardCardBonusActive() ||
        this.handDeliveryState.flights.length > 0;
    },
    /**
     * THE ONE snapshot every prompt-surface family is admitted against
     * (consolePromptAdmission.ts owns the policy, the shell owns the signals).
     * Collected in one place so a NEW signal reaches every family at once —
     * the four hand-copied gate expressions this replaced had already drifted
     * apart, and the fifth family (board placement) had never been given one.
     */
    admissionSignals(): AdmissionSignals {
      return guardedAdmissionSignals(this.rawAdmissionSignals);
    },
    /**
     * The signals as the shell observes them, BEFORE the watchdog's staleness
     * mask. Every one of these is a bounded cinematic, but they are read as raw
     * module predicates — the animation-hold registry's 35 s ceiling never
     * protected prompt ADMISSION, so one leaked scene flag held every mandatory
     * surface closed forever. `guardedAdmissionSignals` masks a claim the
     * watchdog has PROVEN stale (nothing rendered, player blocked); the mask
     * lifts by itself the moment the flag goes honestly false again.
     */
    rawAdmissionSignals(): AdmissionSignals {
      return {
        revealOpen: this.consoleRevealMode !== undefined,
        revealPending: this.rawDrawnRevealPending,
        playedHero: this.playedHeroHolds,
        tileHero: this.tilePlacementHolds,
        // Deliberately WITHOUT the board card-bonus scene — it is armed by a
        // placement's own confirm, so it is a separate signal (see below).
        cardArrival: deckDrawHolds() || this.handDeliveryState.flights.length > 0,
        boardBonus: isBoardCardBonusActive(),
        cardDiscard: this.cardDiscardTransaction.active,
        presentation: this.presentationHeld,
        announceGate: this.taskGateHeld,
        anyAnimation: isAnimationHoldActive(),
      };
    },
    /** The task-host task (undefined = not served natively → fallback/other surfaces). */
    activeConsoleTask(): ConsoleTask | undefined {
      // A reveal overlay owns the foreground — the task host (and, cascading
      // off it, the gov-support panel) does not serve under it (see startTask).
      // Also held while a drawn reveal is pending, and while THIS interruptive
      // host prompt is still GATED (announced, not yet opened — consoleMandatoryGate).
      // NOTE the 'host' policy includes `card-discard` as ANY live discard
      // transaction, not just its animating phases: the window between the
      // answer and the server's reply is exactly when the host would otherwise
      // re-mount its branch list over the cards the player just chose (the pick
      // surface has already released it).
      if (!this.admits('host')) {
        return undefined;
      }
      // The DRAFT WORKSPACE presents its prompts natively (the pick, the
      // wait, the research buy) — the standalone host must not rise over it.
      if (this.draftClaimsTask) {
        return undefined;
      }
      return taskServedByHost(this.playerView);
    },
    /**
     * Does the console TASK HOST serve the current prompt — HOLD-INDEPENDENTLY?
     * `activeConsoleTask` goes `undefined` during a transient hold (the
     * tile-placement hero, a reveal, presentation), which used to un-SUPPRESS
     * the desktop MandatoryInputModal fallback for the ~1s gap before the
     * console surface mounts — so the desktop `ModernProductionToLose` FLASHED
     * for a beat after placing next to a hazard, then swapped to the premium
     * console surface. This reads the classification directly (no hold gate), so
     * the desktop modal stays suppressed through the hold. It stays FALSE for a
     * genuine fallback (`composite` the host can't serve) → that modal still
     * shows when nothing native handles the prompt.
     */
    hostServesPrompt(): boolean {
      // The three DEDICATED composite surfaces count too: they are not
      // host-served, but they ARE served natively, and the desktop fallback
      // must stay suppressed for them exactly as it does for the host (and
      // hold-independently, or it flashes for a beat before they mount).
      return taskServedByHost(this.playerView) !== undefined || this.compositeServesPrompt;
    },
    /**
     * DOES THE CONSOLE SERVE THIS PROMPT AT ALL — the desktop fallback's ONE
     * question, and deliberately NOT `hostServesPrompt`.
     *
     * The two ask different things. `hostServesPrompt` is «might the TASK HOST
     * take this», which the outcome reconciler needs. This is «is any console
     * surface responsible for it», which is what decides whether the legacy
     * `MandatoryInputModal` may rise. A SHELL-SECTION prompt is served by a
     * SCREEN (the hand, the colony workspace, the awards sheet) — usually
     * after a mandatory ANNOUNCE, so there is a deliberate window where none
     * of its DOM is mounted yet, and reading the host classification alone
     * made that window look like «nobody serves this». The desktop modal rose
     * into it: the remote colony-bonus collect («Заберите 1 карту с колонии
     * Миранда») shipped as a legacy dialog over the board, and answering it
     * there flew the card into a full-bleed reveal instead of taking the
     * player to the colony that paid it. The set is `SECTION_SERVED_KINDS`
     * (one place, with the reasoning for the one kind it leaves out).
     */
    promptServedNatively(): boolean {
      if (this.hostServesPrompt) {
        return true;
      }
      const task = taskFor(this.playerView);
      return task !== undefined && SECTION_SERVED_KINDS.has(task.kind);
    },
    /**
     * The three prompts that used to fall through to the DESKTOP modal inside
     * the console shell — the Venus alt-track bonus, Stormcraft's spend-heat
     * and the planetary-event thresholds. Read from the RAW router (none of
     * them is host-served) and HOLD-INDEPENDENT, like `hostServesPrompt`.
     */
    compositeServesPrompt(): boolean {
      const task = taskFor(this.playerView);
      return task !== undefined && NATIVE_COMPOSITE_KINDS.has(task.kind);
    },
    /** …and the same classification, gated on the `host` admission so a reveal
     *  still owns the foreground while it plays. */
    nativeCompositeTask(): ConsoleTask | undefined {
      if (this.pendingClientPayment !== undefined || !this.admits('host')) {
        return undefined;
      }
      const task = taskFor(this.playerView);
      return task !== undefined && NATIVE_COMPOSITE_KINDS.has(task.kind) ? task : undefined;
    },
    /**
     * «Посмотри N карт колоды, оставь K» — the DRAW & SELECT surface.
     *
     * `deckPickHolding()` is what keeps it up PAST its own prompt: the answer
     * ends `waitingFor` the moment it reaches the server, and both of the
     * flow's closing beats (the picks flying into the dock, the rest tumbling
     * away) live entirely after that. Without it the surface would be deleted
     * out from under the very animation it exists for.
     */
    deckPickActive(): boolean {
      if (this.consoleState.task.deferred || this.taskSpacePending !== undefined) {
        return false;
      }
      if (deckPickHolding()) {
        return true;
      }
      return this.nativeCompositeTask?.kind === 'deckSelect';
    },
    /** The prompt BELONGS to an open workspace (ownership), whether or not its
     *  zone is ready yet — the same split `taskBelongsToWorkspace` makes. */
    deckPickBelongsToWorkspace(): boolean {
      return workspaceClaimsPick() && this.deckPickActive;
    },
    /** Claimed but not ready → render NOWHERE for the gap frame, never in a
     *  band of our own for one frame and then somewhere else. */
    deckPickHeldForWorkspace(): boolean {
      return this.deckPickBelongsToWorkspace &&
        (workspaceOutcomeState.embedSlot === '' || workspaceOutcomeBeatPending());
    },
    deckPickEmbedTarget(): string | undefined {
      if (!this.deckPickBelongsToWorkspace || this.deckPickHeldForWorkspace) {
        return undefined;
      }
      const slot = workspaceOutcomeState.embedSlot;
      return slot === '' ? undefined : slot;
    },
    /** ON STAGE and owning its screen — the ONE predicate the pad routing, the
     *  command bar and the start scene's own ownership all read. */
    deckPickServing(): boolean {
      return this.deckPickActive && !this.deckPickHeldForWorkspace;
    },
    // ── the HYDRO workspace flow (post-commit continuation) ──────────────
    /**
     * A follow-up DECISION of the committed advance is standing — the flow's
     * `resolving` beat becomes the collapsible `committed` phase. Any viewer
     * prompt during a hydro commit IS the advance's own chain (the batch is
     * replayed sequentially; nothing else can interleave a demand).
     */
    hydroFollowUpLive(): boolean {
      if (this.hydroFlow.commit === undefined) {
        return false;
      }
      if (this.deckPickActive) {
        return true;
      }
      if (this.hostTask !== undefined && !this.consoleState.task.deferred) {
        return true;
      }
      if (this.consoleRevealMode !== undefined) {
        return true;
      }
      // A hosted step (a repeated trade's colony frame) still standing.
      return workspaceFrameHasNested('hydro');
    },
    /** The viewer's committed track position — the SERVER truth the flow's
     *  recovery net keys on (a degraded glide must not hang the commit). */
    hydroViewerTrackPosition(): number {
      return this.thisPlayer.deltaProject?.position ?? 0;
    },
    /**
     * The RESOLUTION is still physically happening: the marker glide, the
     * reward chips in flight (or still held for their flight), a follow-up
     * decision, the ceremony. Its falling edge — never a timeout — is what
     * advances the flow to the result stage.
     */
    hydroResolutionBusy(): boolean {
      if (this.hydroFlow.commit === undefined) {
        return false;
      }
      return isHydroMarkerActive() ||
        panelRewardHold.active ||
        isResourceTransferActive() ||
        isHydroCeremonyActive() ||
        this.hydroFollowUpLive;
    },
    venusBonusActive(): boolean {
      return this.nativeCompositeTask?.kind === 'venusBonus' && !this.consoleState.task.deferred;
    },
    spendHeatActive(): boolean {
      return this.nativeCompositeTask?.kind === 'spendHeat' && !this.consoleState.task.deferred;
    },
    aresGlobalsActive(): boolean {
      return this.nativeCompositeTask?.kind === 'aresGlobal' && !this.consoleState.task.deferred;
    },
    botAttackActive(): boolean {
      return this.nativeCompositeTask?.kind === 'botAttack' && !this.consoleState.task.deferred;
    },
    /**
     * The bot card's printed rules resolve differently per expansion set, and
     * the FACE must read as the player will experience it in THIS game — the
     * same context every other host of `BonusCardFace` passes.
     */
    botCardContext(): BonusCardContext {
      const expansions = this.playerView.game.gameOptions.expansions;
      return {venus: expansions.venus === true, colonies: expansions.colonies === true};
    },
    /** The attack's whole meaning, derived from the SERVER's own marker. */
    botAttackVm(): BotAttackViewModel | undefined {
      return this.botAttackActive ?
        buildBotAttackView(this.playerView.waitingFor, this.botCardContext) :
        undefined;
    },
    /**
     * ONE of the four DEDICATED COMPOSITE surfaces is on screen — the family's
     * own `v-if`s, collected in one place so the shell's cross-cutting
     * questions («does something own the pad?», «may the journal stay?», «is a
     * mandatory surface presenting?») can ask about it as a family instead of
     * naming its members one predicate at a time. It was named nowhere, and the
     * predicates that enumerate task families therefore skipped it in three
     * separate places at once.
     */
    compositeSurfaceActive(): boolean {
      return this.venusBonusActive || this.spendHeatActive ||
        this.aresGlobalsActive || this.deckPickActive || this.botAttackActive;
    },
    /** What the ConsoleTaskHost renders: a server task OR the client payment. */
    hostTask(): ConsoleTask | undefined {
      if (this.pendingClientPayment !== undefined) {
        return CLIENT_PAYMENT_TASK;
      }
      return this.activeConsoleTask;
    },
    /**
     * World Government Terraforming ("Government Support") — the ONE choice
     * prompt that gets the dedicated premium 2×2 briefing panel instead of
     * the generic ConsoleTaskHost list. Never during a client payment.
     */
    govSupportActive(): boolean {
      const task = this.hostTask;
      return this.pendingClientPayment === undefined &&
        task?.kind === 'choice' && task.flavor === 'wgt';
    },
    /**
     * "Reduce your production" (SelectProductionToLose) — the ONE distribute
     * prompt that gets the dedicated premium production-loss surface instead of
     * the generic ConsoleTaskHost lanes (the Ares hazard-adjacency penalty).
     * Only the TOP-LEVEL prompt (a nested productionToLose inside an OrOptions
     * stays in the host via `taskServedByHost`'s `choice` classification).
     */
    productionLossActive(): boolean {
      const task = this.hostTask;
      return this.pendingClientPayment === undefined &&
        task?.kind === 'distribute' && task.mode === 'production';
    },
    /** A SHELL-SECTION task (T3/T4): projectCard → hand / std sheet; colony → rail. */
    shellTask(): ConsoleTask | undefined {
      // A reveal overlay owns the foreground — no shell section activates
      // under it (see startTask). It re-opens once the reveal is finished.
      // Also suppressed while a drawn reveal is PENDING (even gated — the
      // Pluto discard waits for the WHOLE reveal beat: announce → open → take →
      // clear), and while THIS interruptive task is still GATED (announced, not
      // yet opened via B — consoleMandatoryGate).
      if (!this.admits('section')) {
        return undefined;
      }
      const task = taskFor(this.playerView);
      if (task === undefined || !SHELL_SECTION_KINDS.has(task.kind)) {
        return undefined;
      }
      // The corporation's MANDATORY FIRST ACTION belongs to the GAME START
      // WORKSPACE while the start flow is live (generation 1, zero actions
      // taken — `corpFirstActionInStartFlow`): the scene's own «ПЕРВОЕ
      // ДЕЙСТВИЕ» stage serves it seamlessly after the preludes, so the
      // standalone confirm modal must never rise beside it (two competing
      // doors into one action). Outside the start flow (a mid-game merger
      // chain) the modal remains the serving surface.
      if (task.kind === 'corpFirstAction' && corpFirstActionInStartFlow(this.playerView)) {
        return undefined;
      }
      // The MID-GAME first-action confirm is a STANDALONE modal that hosts
      // NONE of the running cinematics. The guard above already waits out the
      // reveal / hero / BLOCKING holds, but the intake + card deal register
      // 'notification-only' holds (they legitimately play OVER the other
      // shell sections and the action menu, so they must not hold those),
      // which are invisible to it. Hold the confirm until the WHOLE
      // presentation has settled — otherwise it pops as "modal spam" over
      // still-running intake animations. Safe from a self-deadlock: the
      // confirm animates nothing of its own, so nothing it hosts keeps the
      // hold alive; the hold is reactive, so the modal appears the instant
      // the last flight lands.
      if (task.kind === 'corpFirstAction' && !this.admits('standaloneModal')) {
        return undefined;
      }
      return task;
    },
    /** The T5 START SCENE task (initialCards wizard / start-sequence ceremony). */
    startTask(): ConsoleTask | undefined {
      // A reveal overlay is a TOP-PRIORITY modal — it cannot be minimized and
      // must be finished (cards taken) before anything under it comes alive.
      // A draw earned by a prelude can arrive at the SAME time the server
      // raises the corporation's first mandatory action (a start-scene task):
      // the start scene must NOT mount / grab focus under the reveal. It
      // re-activates the instant the reveal closes (the consoleForegroundBusy
      // watcher opens the serving surface then).
      if (!this.admits('scene')) {
        return undefined;
      }
      const task = taskFor(this.playerView);
      if (task !== undefined && SCENE_KINDS.has(task.kind)) {
        return task;
      }
      // The corporation's mandatory FIRST ACTION is the start flow's own
      // final conditional stage: while the start flow is live it is a SCENE
      // task (the workspace's «ПЕРВОЕ ДЕЙСТВИЕ» stage serves it — the same
      // seamless grammar as the prelude plays), and it is exactly what lets
      // a reload mid-first-action restore the workspace instead of a modal.
      if (task?.kind === 'corpFirstAction' && corpFirstActionInStartFlow(this.playerView)) {
        return task;
      }
      // (The old "keep the scene up for the client-staged corp-bonus reveal"
      // fallback is gone: the console retired the staged reveal — the
      // DEFERRED corporationPlay press + the hero landing carry that beat,
      // and the reveal never activates in console mode.)
      return undefined;
    },
    /**
     * The Game Start Workspace SERVES — a live start prompt OR the workspace
     * LIFETIME HOLD (consoleStartState.hold). The hold spans the summary
     * commit and every prompt gap of the deployment: one root workspace from
     * the first corporation card to the settled start, never a close/open
     * between beats (the close mid-hero is exactly what stranded the
     * corporation card in the motion layer). Every presence-semantics site
     * (mount, input routing, prompt suppression, foreground lease) reads THIS,
     * never raw `startTask`.
     */
    /**
     * THE BONUS-ACTION TURN IS A TURN, and a turn belongs to the BOARD HOME.
     *
     * «Фора» grants two ORDINARY actions: the player may play a card, activate
     * one, build a standard project, claim a milestone, fund an award, convert
     * resources — and, with the Colonies expansion, TRADE. Every one of those
     * is a full board interaction the start workspace cannot host, and while it
     * kept claiming the screen the console fought the player for it: the hand
     * opened as a STEP teleported into the workspace's hidden zone (so the
     * cards were simply not there), and walking to «Колонии» DEFERRED the
     * workspace, after which `actionBlockedReason` refused every action with
     * «сначала завершите текущее действие» — about a decision the player had
     * been sent away to make.
     *
     * So for the window the workspace LETS GO completely: no frame, no host,
     * no deferred task, nothing to block anything. It comes back through the
     * ordinary `startFrameLive` door — with every bit of its module state
     * intact — when the LEDGER says the bonuses are spent.
     */
    bonusTurnLive(): boolean {
      return consoleStartState.bonusAct.stage === 'onboard' &&
        bonusActionOnBoard(this.playerView);
    },
    /** The server LEDGER's own answer, unmediated by any client latch — the
     *  edge the `bonusActionLedgerOwed` watcher closes the window on. */
    bonusActionLedgerOwed(): boolean {
      return bonusActionOwed(this.playerView);
    },
    startSceneServes(): boolean {
      // …and the ONE state in which it owns nothing at all (`bonusTurnLive`).
      if (this.bonusTurnLive) {
        return false;
      }
      // The FIRST-ACTION term covers the stage's WAIT — the corporation still
      // owes its opening move but the server currently asks nothing (another
      // player is moving), so there is neither a task nor (after a reload,
      // which wipes the module hold) a lifetime hold. The workspace is still
      // the serving surface of that wait: it owns the pad, the defer summary
      // and the frame exactly as during any other beat of the deployment.
      //
      // …AND IT OWNS AN OUTCOME. A workspace that CLAIMED a follow-up may not
      // stop serving before that follow-up has presented: the claim is what
      // makes the batch embeddable, so a frame that closes in the gap between
      // the answer and the cards coming off the deck takes the only host the
      // draw had with it — the batch then opens a standalone modal over
      // nothing (Celestic's first action, and any draw at all once a reload
      // has wiped the lifetime hold).
      return this.startTask !== undefined || startSceneHeld() ||
        (corpFirstActionInStartFlow(this.playerView) && firstActionOwed(this.playerView)) ||
        // …and the same for an owed BONUS ACTION the player has NOT yet been
        // handed off for. The server stands on a plain action menu there, so
        // there is no start TASK to read, and after a reload there is no
        // lifetime hold either — but the workspace is still the surface that
        // has to ANNOUNCE the trip. Once the player confirms, `bonusTurnLive`
        // above short-circuits this whole computed to false.
        bonusActionInStartFlow(this.playerView) ||
        // …AND WHILE ITS OWN STAGE MACHINE IS STILL RUNNING. This is the
        // durable form of «the workspace owns something»: the CLAIM is
        // transient by design (it is reconciled away the moment nothing looks
        // embeddable YET), so a frame whose life hangs off it dies in the gap
        // between «the ledger drained» and «the cards came off the deck» —
        // taking with it the only host that draw had, which is how Celestic's
        // first action ended up in a modal. The stage goes `idle` only
        // through `firstActionLeaveDue`, which already waits out that gap.
        consoleStartState.firstAct.stage !== 'idle' ||
        consoleStartState.bonusAct.stage !== 'idle' ||
        (workspaceOutcomeState.host === 'start' && workspaceOutcomeState.sourceCard !== '');
    },
    /**
     * The workspace is on SCREEN. It SERVES through the whole start (above),
     * but it steps aside for the one interaction it cannot host: a BOARD
     * PLACEMENT. A start prelude that places a tile («Great Aquifer» — two
     * oceans) leaves the server waiting for a space while the board — with
     * its highlighted cells — is behind the workspace, and the workspace's
     * own status honestly has nothing to say («ожидаем других игроков»). The
     * board is an always-mounted host, so the yield IS the hand-off: the
     * scene hides while the placement stands and comes back by itself when
     * it resolves (collapse, never close — the lifetime hold is untouched,
     * so nothing about the deployment is lost).
     */
    startSceneVisible(): boolean {
      // Everything that makes the scene STEP ASIDE lives here, never in the
      // mount: a board placement it cannot host, the WHOLE completion chain
      // of that placement (the excursion latch — commit flight, reward
      // transfers, the cell's bonus reveal, every follow-up prompt: the
      // workspace returns exactly ONCE, onto a settled frame), the WGT scale
      // glide, and a task the player minimized. All are «somebody else has
      // the screen» — a paint question. Unmounting on them retracted the
      // frame's embed slot too, so a step standing INSIDE the start (the
      // sponsor's hand) lost its teleport target and fell with it.
      return this.startSceneMounted && !this.placementActive &&
        !this.startExcursionHolds &&
        !govScaleFocusState.holding && !this.consoleState.task.deferred;
    },
    /** MOUNTED ≠ VISIBLE. The scene owns the start's lifetime (its hold, its
     *  claims, its release beat), so it stays mounted through a yield and
     *  only stops painting — see the scene's `yielded` prop.
     *
     *  PRESENCE IS THE STACK AND NOTHING ELSE (invariant 1). Its own minimize
     *  goes through the park, so the frame answers that by itself; every other
     *  flag that used to sit here belonged to a DIFFERENT flow. */
    startSceneMounted(): boolean {
      return workspaceFrameMounted('start');
    },
    /** The COMPLETION BARRIER's reactive face (startBoardExcursion): the scene
     *  yielded to a board placement and that placement's causal chain has not
     *  fully completed yet. */
    startExcursionHolds(): boolean {
      return startExcursionState.active;
    },
    /** The barrier ENGAGES the moment the serving workspace yields to a board
     *  placement (the placement is the CAUSE; everything after it is chain). */
    startExcursionEngage(): boolean {
      return this.startSceneServes && this.placementActive;
    },
    /**
     * The placement chain is QUIET — every beat of `startExcursionQuiet`'s
     * contract answered from the same live signals the admission policy
     * trusts. Deliberately WITHOUT the global animation-hold registry and
     * WITHOUT the remote-placement scene: the barrier counts only the
     * viewer's own chain, so another player's cinematic can never wedge it.
     */
    startExcursionQuietNow(): boolean {
      return startExcursionQuiet({
        placementAsked: this.playerView.waitingFor?.type === 'space' ||
          this.convertPlantsPending !== undefined || this.taskSpacePending !== undefined,
        tileHero: this.tilePlacementHolds,
        transfers: isResourceTransferActive(),
        boardBonus: isBoardCardBonusActive(),
        revealBusy: this.consoleRevealMode !== undefined || currentRevealEvent() !== undefined,
        // Live intake flights only — NEVER `held`: withheld bought cards are
        // the PAY stage's business (they fly on the pay press, which needs
        // the scene back), not part of any placement chain.
        handIntake: isHandDeliveryActive() || this.handDeliveryState.flights.length > 0,
        followUpKind: taskFor(this.playerView)?.kind,
      });
    },
    /**
     * THE SCENE OWNS THE PAD AND THE BAR. Ownership follows the surface the
     * player SEES — never the lifetime hold, which stays true through the
     * whole deployment. Three consumers ask this ONE question (the bar's
     * context, the bar's commands, the input routing), so they can never
     * drift apart; the hosted steps were already excluded here, and the
     * YIELD to a board placement is the same rule one case further:
     *
     * the yield used to be paint-only (`startSceneVisible` + the scene's
     * `visibility: hidden`), so a start prelude that owes a tile hid the
     * workspace while the hidden scene kept the pad — its own press guard
     * returned, `onNav` walked the invisible queue, and the bar advertised
     * «A Разыграть · X Осмотреть · B Свернуть» over a live board. The board
     * is the always-mounted host of that placement; it must get the input.
     */
    startSceneOwnsPad(): boolean {
      // …and never a scene that is not THERE. `startSceneServes` is the
      // lifetime hold, which outlives any single mount: with the frame gone the
      // routing still handed every intent to `$refs.startScene` and returned
      // «handled», so the pad went dead with a live command bar over it and
      // only a reload got out. Ownership follows presence, always.
      // …and never over a STEP it is hosting. A prelude that turns the deck
      // over («Корпоративные архивы») puts a real decision inside the scene's
      // own zone; leaving the pad with the scene there is what made the seven
      // cards unpickable while the bar still advertised «A РАЗЫГРАТЬ».
      // …and never over a SHEET-projecting workspace standing above the phase
      // root. EstablishedMethods' prelude prompt («сыграйте стандартный
      // проект») opens the std-projects workspace as a lateral frame OVER the
      // surviving start root — the deepest frame owns the pad (the stack's
      // own law). Without this term the scene swallowed every A over a served
      // prompt with a focused row and a live bar: four presses, zero submits.
      return this.startSceneVisible && this.startSceneServes &&
        !this.startSponsorEmbed && !this.colonyEmbedActive && !this.deckPickServing &&
        this.consoleState.sheet === undefined;
    },
    /** OPTIONAL draft re-pick — the fork shows a calm "waiting for the other
     *  players" banner instead of offering to change the pick (desktop parity). */
    draftWaitActive(): boolean {
      return taskFor(this.playerView)?.kind === 'draftWait';
    },
    /** The persistent draft tray lives through the WHOLE draft (picks +
     *  waits) and stays for the research-rise handoff; it renders empty-
     *  invisible before the first pick and leaves once the draft resolves.
     *
     *  ONLY the pre-game INITIALDRAFTING flow now: the between-generations
     *  draft is served by the DRAFT WORKSPACE, whose shelf registers the
     *  same slot resolver — two surfaces, one tray brain. A parked frame
     *  counts (its way back is the deferred chip, never a popover). */
    draftTrayMounted(): boolean {
      if (workspaceFrameKnown('draft')) {
        return false;
      }
      // The pre-game flow only. The between-generations beats (pick heroes,
      // the research rise, the wait) all belong to the WORKSPACE now — the
      // popover legs they used to justify are exactly what flashed a frozen
      // pile over the returning board after the workspace released.
      return this.playerView.game.phase === Phase.INITIALDRAFTING;
    },
    /** The between-generations draft flow is ALIVE for this player — the
     *  frame-lifetime predicate (the completion beats extend it past the
     *  research answer). */
    draftFrameLive(): boolean {
      return betweenGenDraftLive(this.playerView) || draftCompletionHolding();
    },
    /** PRESENCE IS THE STACK (invariant 1) — the workspace's ONE v-if. */
    draftWorkspaceMounted(): boolean {
      return workspaceFrameRenders('draft');
    },
    /** Phase.END — the post-game scoring workspace's whole anchor. */
    endgameFrameLive(): boolean {
      return this.playerView.game.phase === Phase.END;
    },
    /** PRESENCE IS THE STACK (invariant 1) — the workspace's ONE v-if. */
    endgameWorkspaceMounted(): boolean {
      return workspaceFrameRenders('endgame');
    },
    /** B = «Свернуть»: the scene is hidden, the final board is on show —
     *  the HUD comes back (`con-root--endgame` drops) and the workspace's
     *  own intent handler owns the road back. */
    endgameCollapsed(): boolean {
      return consoleEndgameUi.collapsed;
    },
    /**
     * IS THE FINAL-SCORING STAGE ON SCREEN? The workspace scene — the
     * scoring ceremony and its internal «Обзор партии» analytics scene are
     * both faces of the SAME mounted stage owning the frame.
     *
     * FALSE while «Свернуть» has it hidden: the frame stays in the stack on
     * purpose (the ceremony resumes from the same beat, the state is intact),
     * but the player is inspecting the final BOARD, and every HUD policy keyed
     * on «is a workspace on the stage» has to answer no there. Written once
     * because it was answered twice: `con-root--endgame` read this state and
     * released the strip + player rail on the collapse, while the rail-replaced
     * policy read the STACK and kept the trophy gallery dark for the whole
     * post-game inspection.
     */
    endgameStageUp(): boolean {
      return this.endgameWorkspaceMounted && !this.endgameCollapsed;
    },
    /** The prompt kinds the draft workspace presents NATIVELY — the standalone
     *  host must not rise for them while the frame stands. (The embedded
     *  post-buy PAYMENT deliberately stays host-served — teleported into the
     *  workspace's pay slot, same instance, same submit path.) */
    draftClaimsTask(): boolean {
      if (!workspaceFrameMounted('draft')) {
        return false;
      }
      const task = taskFor(this.playerView);
      if (task === undefined) {
        return false;
      }
      return task.kind === 'draftWait' ||
        (task.kind === 'cardSelect' && (task.mode === 'draft' || task.mode === 'buy'));
    },
    /** The workspace owns the pad exactly while it is the surface the player
     *  sees; `hostTask === undefined` yields it to the embedded payment and
     *  to the Underworld research choice (both host-served). */
    draftWorkspaceOwnsPad(): boolean {
      return this.draftWorkspaceMounted && this.hostTask === undefined &&
        !this.consoleState.task.deferred;
    },
    /** Cards already drafted this round (server-managed; cleared at endRound) —
     *  drawn as the desktop-style stack beside the draftWait banner. */
    draftedCards(): ReadonlyArray<CardModel> {
      return this.playerView.draftedCards ?? [];
    },
    /**
     * A DRAWN-cards reveal is pending — the RAW signal (`currentRevealEvent`
     * minus the tile/deck holds). The drawn reveal is NEVER gated (it is the
     * continuous endpoint of its draw cinematic — see consoleMandatoryGate), but
     * a pending draw still HOLDS the follow-up task surface (the Pluto discard
     * waits for the whole reveal beat), so `shellTask`/`activeConsoleTask`/
     * `startTask` read this.
     */
    rawDrawnRevealPending(): boolean {
      // The tile-placement hero owns the screen through its landing + reward
      // beat, and the deck-draw scene deals the cards out first — the drawn
      // reveal assembles only after those (same holds as the 'drawn' branch).
      if (this.tilePlacementHolds || deckDrawHolds()) {
        return false;
      }
      // A FOREIGN trade's owner-bonus batch is PARKED behind the mandatory
      // entry (remoteColonyBonusPending): nothing presents, nothing forces the
      // player off their screen — the announcement is the door, and opening it
      // arms the entry, which is what releases this hold. Without it the batch
      // mounted a full-bleed reveal over wherever the player stood.
      if (this.remoteColonyBonusPending !== undefined) {
        return false;
      }
      return currentRevealEvent() !== undefined;
    },
    /**
     * The reveal modal's MANDATORY closing step, when the pending prompt is the
     * discard half of a colony bonus (Pluto — the server marks it structurally).
     * `ready` once every card of the payout has been taken; the label is
     * singular for one cube and plural for several.
     */
    revealDiscardCloser(): BonusDiscardStep | undefined {
      if (this.consoleRevealMode !== 'drawn') {
        return undefined;
      }
      const ev = currentRevealEvent();
      const untaken = ev === undefined ? 0 : ev.cards.length - ev.takenIndices.size;
      return bonusDiscardStep(this.playerView.waitingFor?.discardPrompt?.colonyBonus, untaken);
    },
    /** The T6 REVEAL overlay mode (drawn > result > viewer), undefined = none. */
    /**
     * The workspace slot the reveal is TELEPORTED into, or undefined for the
     * ordinary full-bleed band.
     *
     * The overlay is not duplicated and not suppressed — it is RE-HOMED: same
     * instance, same `consoleRevealMode`, same input routing, same commands.
     * That is what makes «one component, two hosts» true rather than a claim
     * in a comment. The selector is a stable data attribute on the workspace's
     * outcome zone, which the workspace renders from SUBMIT time so it always
     * exists before Vue resolves the target.
     */
    revealEmbedTarget(): string | undefined {
      // THE VERDICT re-homes on exactly the same terms as a batch. Keyed on
      // `revealOverlayMode`, not on `consoleRevealMode`: a card PLAY's verdict
      // waits behind its own played-hero scene («сначала карта сыграна, потом
      // результат»), and reading the ungated mode here would publish the embed
      // — and with it `markWorkspaceOutcomePresenting` — while the hero still
      // owns the screen and nothing had been re-homed yet.
      if (this.revealOverlayMode === 'result') {
        return this.resultRevealPresentation === 'embedded' && workspaceOutcomeState.embedSlot !== '' ?
          workspaceOutcomeState.embedSlot : undefined;
      }
      if (this.consoleRevealMode !== 'drawn') {
        return undefined;
      }
      const source = currentRevealEvent()?.source;
      if (!workspaceClaimsDrawReveal(source) && !workspaceClaimsColonyReveal(source)) {
        return undefined;
      }
      const slot = workspaceOutcomeState.embedSlot;
      return slot === '' ? undefined : slot;
    },
    /**
     * The workspace slot the TASK HOST is teleported into, for a card pick the
     * player's own workspace produced (buy / keep-some).
     *
     * Narrow on purpose. Only `cardSelect` is re-homed: it is the one prompt
     * family that is genuinely a CONTINUATION of the activation the player
     * just confirmed — the cards it offers are the ones that action turned
     * over. A payment, an OrOptions branch, a placement, a resource pick that
     * happens to ride the same response keep their own band, because the
     * workspace has no honest place to seat them and holding them would
     * strand the prompt.
     */
    /**
     * The prompt BELONGS to an open workspace, whether or not its slot is
     * ready yet. Split out from `taskEmbedTarget` on purpose: ownership and
     * readiness are different questions, and conflating them is what let the
     * standalone band win the race. While this is true and the slot is not
     * there yet the host renders NOWHERE — a brief hold, never a wrong
     * surface. Exactly the `deckDrawHolds()` idiom, which withholds the reveal
     * rather than letting it mount in the wrong place for a frame.
     */
    taskBelongsToWorkspace(): boolean {
      if (this.deckPickBelongsToWorkspace) {
        // The DRAW & SELECT surface serves it, not the host — but the claim's
        // ownership questions (has the answer arrived? may the standalone
        // presenters fire?) are about the PROMPT, not about which component
        // draws it, so they must answer the same either way.
        return true;
      }
      return workspaceClaimsPick() &&
        (this.hostTask?.kind === 'cardSelect' || this.hostTask?.kind === 'payment');
    },
    /**
     * Claimed, but not ready to show yet → hold (render nowhere, never a
     * wrong surface). Two reasons:
     *  · the workspace's zone is not in the DOM yet;
     *  · the EXECUTION BEAT still owes its minimum time. A local server can
     *    answer faster than the stage can be read, and the flow would jump
     *    from confirm straight to a purchase screen — the player never sees
     *    the action physically happen. The beat is held, not faked.
     */
    taskHeldForWorkspace(): boolean {
      return this.taskBelongsToWorkspace &&
        (workspaceOutcomeState.embedSlot === '' || workspaceOutcomeBeatPending());
    },
    /** The ACTION COMMIT's minimum readable beat is still owed (the
     *  deferred-dismiss gate — see `pendingCommitDismiss`). */
    commitHolding(): boolean {
      return actionCommitHolding();
    },
    taskEmbedTarget(): string | undefined {
      // HELD means "renders nowhere yet" — so it is NOT embedded, and saying
      // otherwise is what killed the execution beat: `workspaceOutcomeEmbedded`
      // went true the instant the prompt arrived, the shell marked the outcome
      // `presenting`, the composer's `outcomePendingBeat` flipped false and
      // ABORTED the flight in mid-air (log: `maybeFlip WAITING {landed:false}`
      // immediately followed by `outcomePendingBeat {on:false}`). The card
      // never landed, the backstop released the gate ~2.6 s later, and the old
      // deal played instead. Target-exists ≠ content-embedded.
      if (this.taskHeldForWorkspace) {
        return undefined;
      }
      // The DRAFT's post-buy payment (Helion heat / steel — the plain M€ case
      // auto-resolves server-side): pick-then-pay is ONE decision, so the
      // second half teleports into the workspace's pay slot instead of rising
      // as its own band over the flow it belongs to.
      if (this.hostTask?.kind === 'payment' && workspaceFrameMounted('draft') &&
          this.playerView.game.phase === Phase.RESEARCH && draftCompletionHolding()) {
        return '.con-draftws [data-draft-pay-slot]';
      }
      // The STD-PROJECT's alt-resource payment (a CLIENT prompt — the plain
      // M€ case never builds one): choosing the project and paying for it is
      // ONE decision, so the payment host teleports into the workspace's own
      // step zone («› ОПЛАТА») instead of replacing the screen it belongs to.
      if (this.pendingClientPayment !== undefined && workspaceFrameMounted('standard-projects')) {
        return '.con-stdp [data-embed-slot="stdp-step"]';
      }
      if (!workspaceClaimsPick()) {
        return undefined;
      }
      // `payment` rides along: buying a revealed card is pick-then-pay, one
      // decision in two prompts (ChooseCards defers SelectPaymentDeferred), and
      // letting the second half rise as its own band would break the flow open
      // exactly where it is least expected — after the player already said yes.
      if (this.hostTask?.kind !== 'cardSelect' && this.hostTask?.kind !== 'payment') {
        return undefined;
      }
      const slot = workspaceOutcomeState.embedSlot;
      return slot === '' ? undefined : slot;
    },
    /** Something is (or is about to be) re-homed into the workspace's zone. */
    workspaceOutcomeEmbedded(): boolean {
      return this.revealEmbedTarget !== undefined ||
        this.taskEmbedTarget !== undefined ||
        // The DRAW & SELECT surface is re-homed by the same claim; leaving it
        // out would arm both failure modes at once — the 20 s backstop would
        // still be live under a decision the player is reading, and the claim
        // would never be released when the flow ends, so the hosting workspace
        // would never come back around its source card.
        this.deckPickEmbedTarget !== undefined ||
        // …and the EFFECT DECISION a play's own triggered card raised. Same
        // claim, same zone, same two failure modes if it were left out.
        this.effectDecisionEmbedTarget !== undefined;
    },
    /**
     * MAY THE PLAY COMPOSER LET GO OF THE STAGE?
     *
     * Its successor is standing in the outcome zone (a layer ABOVE the stage,
     * never beside it) AND the landing tableau it carried has finished its own
     * exit. Two halves of ONE handoff: the first says «there is something to
     * take over», the second «and the thing being relieved has gone properly».
     *
     * Splitting them is what makes the exit a dissolve rather than a cut. When
     * the outcome is a DEAL the tableau has usually finished releasing long
     * before the reveal assembles, so this reads exactly as it always did; when
     * the outcome is a DECISION (nothing comes off the deck at all) both events
     * land in the same flush, and clearing the composer there tore the tableau
     * out mid-fade — the one place this whole scene exists to make continuous.
     *
     * It cannot hang: with the claim `presenting`, `playLandingShowing()` is
     * the release flag alone, which is bounded by the dissolve AND its backstop.
     */
    playComposerReleasable(): boolean {
      return this.pendingPlayCard !== undefined &&
        workspaceOutcomeState.host === 'hand' &&
        this.workspaceOutcomeEmbedded &&
        !isPlayedHeroActive() &&
        !playLandingShowing();
    },
    /**
     * THE CARD PLAY WORKSPACE is holding what a play produced (the drawn batch,
     * the pick it raised). The play's ending is re-asked off its falling edge:
     * the take never round-trips the server, so no view change will conclude
     * the flow for us, and an optimistic claim that turns out to host nothing
     * is released by the reconciler — both of those are «the play is over now»
     * and neither is a response.
     */
    handOutcomeLive(): boolean {
      return workspaceOutcomeState.host === 'hand' && workspaceOutcomeClaimed();
    },
    /**
     * THE ANSWER EXISTS — deliberately independent of whether it may be SHOWN
     * yet. The execution beat turns its card over on this, so it must not be
     * gated on the beat that consumes it (which would deadlock: the beat waits
     * for the answer, the answer waits for the beat).
     */
    workspaceOutcomeAnswerArrived(): boolean {
      if (!workspaceOutcomeClaimed()) {
        return false;
      }
      return this.taskBelongsToWorkspace ||
        (this.rawDrawnRevealPending && workspaceClaimsDrawReveal(currentRevealEvent()?.source));
    },
    /**
     * The workspace is PARKED — hidden for board inspection while its
     * committed decision stays alive at full depth. A property of the STACK,
     * never of one surface: that is what makes «half-collapse» (one axis
     * cleared, the other still routing input into an invisible workspace)
     * unexpressible.
     */
    workspaceCollapsed(): boolean {
      return workspaceStackCollapsed();
    },
    /** A claimed batch whose workspace zone is not mounted yet → hold the
     *  reveal rather than let the full-bleed band take it for a frame.
     *
     *  ⚠️ BOTH claim shapes, always. This guard knew only the CARD claim, so
     *  a claimed COLONY payout whose zone was one tick late (the section
     *  re-mounts and publishes its slot a `$nextTick` after the response)
     *  mounted full-bleed over the colony workspace — indistinguishable from
     *  a legacy modal, and the reason «Плутон открывает модалку» was reported
     *  against a flow that had no legacy component in it at all. */
    revealHeldForWorkspace(): boolean {
      const source = currentRevealEvent()?.source;
      return this.rawDrawnRevealPending &&
        (workspaceClaimsDrawReveal(source) || workspaceClaimsColonyReveal(source)) &&
        (workspaceOutcomeState.embedSlot === '' || workspaceOutcomeBeatPending());
    },
    /**
     * WHERE THE DECK-CHECK VERDICT PRESENTS — nowhere, the full-bleed band, or
     * RE-HOMED into the claiming workspace's own zone. The pure decision, fed
     * from the claim (which survives a park) and the composer's mirror.
     */
    resultRevealPresentation(): ResultRevealPresentation {
      const lr = this.playerView.lastReveal;
      return resultRevealPresentation({
        present: lr !== undefined,
        acknowledged: lr !== undefined && `${lr.action}|${lr.revealed.name}` === this.dismissedRevealKey,
        workspaceOwns: workspaceClaimsDeckCheck(lr?.action),
        // «ДЕЙСТВИЯ КАРТ» owns a verdict stage of its own (hero column + deck
        // flight + source FLIP); every other host takes the re-homed overlay.
        hostDrawsItself: workspaceOutcomeState.host === 'card-actions',
        stageMounted: lr !== undefined && lr.action === consoleActionComposerUi.revealClaim,
      });
    },
    consoleRevealMode(): ConsoleRevealMode | undefined {
      if (this.revealHeldForWorkspace) {
        return undefined;
      }
      if (this.rawDrawnRevealPending) {
        return 'drawn';
      }
      // A verdict a WORKSPACE owns is ITS stage — either drawn by the host
      // itself («Действия карт») or the SAME overlay re-homed into its zone
      // («Проверка проекта», the Hydronetwork's copy). Only what nobody claimed
      // rises as the full-bleed band. See `resultRevealPresentation`.
      if (this.resultRevealPresentation !== 'none') {
        // Claimed but the zone is not there yet → hold, exactly like a claimed
        // drawn batch: never our own band for a frame and somewhere else the
        // next one.
        return this.resultRevealPresentation === 'embedded' &&
          workspaceOutcomeState.embedSlot === '' ? undefined : 'result';
      }
      if (revealViewerState.open) {
        return 'viewer';
      }
      return undefined;
    },
    // ── MANDATORY ANNOUNCEMENT GATE (consoleMandatoryGate.ts) ────────────
    /**
     * The viewer's status is an OFF-TURN FORCED REACTION (not their own active
     * turn) — reuses the canonical player-status classifier so the gate and the
     * chip can never disagree. Gates the triggered host sub-prompts (an
     * opponent's card forcing a SelectPlayer / production loss); the viewer's
     * OWN turn continuations stay `turn` and open immediately.
     */
    viewerForcedReaction(): boolean {
      return actionLabelForPlayer(this.playerView, this.thisPlayer, liveWaitingSignal(this.waitingOnPlayers)) === 'forcedaction';
    },
    /**
     * Pending FLOW-scoped mandatory actions, in the ONE deterministic order
     * (`mandatoryBeatFor` presents the first; a task beat outranks them all).
     * Today: the between-generations draft. A new must-open workspace flow
     * contributes its own derivation here — never an auto-`enterWorkspace`.
     */
    mandatoryFlowBeats(): ReadonlyArray<MandatoryFlowBeat> {
      const draft = draftMandatoryFlowBeat(this.playerView);
      return draft === undefined ? [] : [draft];
    },
    /** The current mandatory action beat (never a reveal). */
    mandatoryBeat(): MandatoryBeat | undefined {
      const wf = this.playerView.waitingFor;
      let task = taskFor(this.playerView);
      // Inside the START FLOW the corporation's first action is the Game
      // Start Workspace's own stage — a seamless continuation of the
      // deployment, exactly like the `startSequence` prompts (which are never
      // gated: their full-screen flow IS the presentation). Announcing it
      // would put a plate in front of a scene that is already standing on it;
      // the collapsed workspace's way back is the deferred card, not a beat.
      // Outside the start flow (the mid-game merger chain) it stays an
      // interruptive beat and the confirm modal serves it, exactly as before.
      if (task?.kind === 'corpFirstAction' && corpFirstActionInStartFlow(this.playerView)) {
        task = undefined;
      }
      return mandatoryBeatFor({
        task,
        taskKey: promptIdentityKey(wf),
        forcedReaction: this.viewerForcedReaction,
        flows: this.mandatoryFlowBeats,
      });
    },
    /** The beat's stable identity, for the latch-invalidation watcher ('' = none). */
    mandatoryBeatKey(): string {
      return this.mandatoryBeat?.key ?? '';
    },
    /** The current beat is HELD (announced, not yet OPENED by the player). While
     *  held, its surface is suppressed — only the chip status + the announcement
     *  show; A opens it. Equivalent to `taskGateHeld`: a TASK beat holds its own
     *  prompt closed, and a FLOW beat (the draft) holds the prompts its
     *  workspace would serve (the pick / buy card browser), so nothing legacy
     *  can rise while the workspace waits for its explicit open. */
    mandatoryGateHeld(): boolean {
      return isMandatoryBeatHeld(this.mandatoryBeat);
    },
    /** The held beat suppresses its task surface (shellTask / hostTask). */
    taskGateHeld(): boolean {
      return this.mandatoryGateHeld;
    },
    /**
     * A LIVE PROMPT WHOSE SURFACE HIDES ITSELF WHILE THE TASK IS DEFERRED — the
     * families of «B СВЕРНУТЬ», stated ONCE.
     *
     * Every one of these `v-if`s carries `!consoleState.task.deferred`, so the
     * panel is gone the moment the player minimizes it and the board-home card
     * is the only door back. A family missing here is therefore not a cosmetic
     * gap but a SOFT-LOCK — and a silent one, since a deferred task is
     * deliberately invisible to the leak detector.
     *
     * That is what the DEDICATED COMPOSITE family (`nativeCompositeTask` — the
     * Venus bonus, spend-heat, the planetary thresholds, «оставь K из N») paid
     * for: it is neither host-served nor a section nor a scene, and those three
     * were the only families the predicate used to name. «Разместите бонус
     * шкалы Венеры» → B → the panel folded and nothing ever brought it back.
     *
     * TWO HALVES, and both are load-bearing: the live read (family by family,
     * so each keeps its own admission gate) and `taskMinimizable` — the
     * exhaustive-over-`TaskKind` anchor that says the kind is one the player
     * can fold away at all. A kind no family claims fails the router spec at
     * build time; a family yielding a kind that cannot be minimized offers no
     * card, which is the honest answer (there is nothing set aside).
     */
    minimizableTaskLive(): boolean {
      const task = this.hostTask ?? this.shellTask ?? this.startTask ?? this.nativeCompositeTask;
      return task !== undefined && taskMinimizable(task.kind);
    },
    /** A task the player OPENED then DEFERRED (set aside) — the "return" state
     *  of the unified mandatory prompt (replaces the legacy amber chip). */
    mandatoryDeferredActive(): boolean {
      // The START WORKSPACE has no live task while the table finishes its
      // setup (the server holds everyone), and a minimized workspace with no
      // task used to have NO announcement at all — the player could not get
      // back to their own start. It SERVES throughout (the lifetime hold),
      // and that is exactly the right signal here.
      return (this.minimizableTaskLive || this.startSceneServes ||
        // A PARKED STACK always offers its way back: its frames are alive and
        // the board-home card is the only door to them. Keying this off an
        // ADMITTED task alone is how a live decision became unreachable
        // whenever the admission gate happened to be holding.
        workspaceStackCollapsed()) &&
        this.consoleState.task.deferred;
    },
    /**
     * The player is on the MAIN board view and has opened NOTHING of their own
     * — not the hand carousel / a sheet / the journal / an overlay / a zoom / an
     * inspection / a placement. Deliberately free of the animation + foreground
     * HOLDS: this is the player's own context, not the presentation's.
     *
     * Two consumers that must never drift apart: the announcement's visibility
     * (below) and the foreground watchdog's scope. The watchdog only acts here,
     * because "no serving surface is rendered" is a lie the moment the player
     * opens a screen of their own over a legitimately claimed foreground.
     */
    boardHomeIdle(): boolean {
      return this.consoleState.section === 'board' &&
        this.consoleCardZoom.card === undefined &&
        !journalState.open &&
        this.consoleState.sheet === undefined &&
        this.consoleState.quick === undefined &&
        this.consoleState.confirm === undefined &&
        !this.consoleState.fallbackActive &&
        !this.consoleState.inspecting &&
        !this.consoleState.scaleInspecting &&
        !this.placementActive &&
        !this.botTurnReviewState.open &&
        !this.govScaleFocusState.holding &&
        !this.govScaleFocusState.closing;
    },
    /**
     * MAY THE CURRENT BEAT'S FIRST PRESENTATION HAPPEN NOW? The pending →
     * presented transition of the mandatory-action lifecycle (the watcher
     * below latches it). It waits for the ordinary-notification feed to
     * finish COMPLETELY — nothing visible, empty queue, the last card's exit
     * animation done (`notificationsSettled`) — and for every running
     * presentation beat (theater / flow-holding card / animation holds /
     * reveals / heroes). Deliberately NOT gated on the player's location:
     * the presentation moment is one; WHERE the player stands only decides
     * the FORM (the plate on the board home, the chip beacon elsewhere).
     */
    mandatoryPresentationReady(): boolean {
      return this.mandatoryGateHeld &&
        !isMandatoryBeatPresented(this.mandatoryBeat) &&
        notificationsSettled() &&
        !this.presentationHeld &&
        !isAnimationHoldActive() &&
        this.consoleRevealMode === undefined &&
        !this.rawDrawnRevealPending &&
        !this.playedHeroHolds &&
        !this.tilePlacementHolds;
    },
    /**
     * THE MANDATORY ACTION IS PAST ITS FIRST PRESENTATION — the plate/chip pair
     * may signal. Two shapes, both "already met the player": a fresh HELD beat
     * whose presentation has happened (the latch), and a DEFERRED task (the
     * player opened it themselves — deferral IS a presented state, so it never
     * re-waits behind the feed).
     */
    mandatoryActionPresented(): boolean {
      return (this.mandatoryGateHeld && isMandatoryBeatPresented(this.mandatoryBeat)) ||
        this.mandatoryDeferredActive;
    },
    mandatoryAnnounceVisible(): boolean {
      // ONE premium surface for BOTH states: a fresh HELD decision (opens with
      // A) and a DEFERRED one (returns with A). Board-home + idle either way.
      //
      // ASYMMETRY (load-bearing): the strict quiet — the settled notification
      // feed, the presentation holds, the animation holds — applies ONLY to
      // the FIRST presentation (mandatoryPresentationReady). Once presented,
      // a mandatory action is a STANDING state: a new toast / bot card / board
      // animation presents beside it and must not blink it away, re-queue it
      // or replay its entrance. The plate still yields to the player's own
      // location (boardHomeIdle — the chip carries it elsewhere) and to the
      // viewer's own full-bleed cinematics (a reveal / hero owns the screen).
      return this.mandatoryActionPresented &&
        this.boardHomeIdle &&
        this.consoleRevealMode === undefined &&
        !this.rawDrawnRevealPending &&
        !this.playedHeroHolds &&
        !this.tilePlacementHolds;
    },
    /**
     * The viewer's TOP CHIP carries the pending-decision beacon while the CTA
     * card is NOT on screen (the player parked in another section / screen /
     * modal / a zoom — anywhere `mandatoryAnnounceVisible` is false): the chip
     * is then the ONE reminder of the awaited decision. RAW (undebounced) —
     * the strip debounces engagement so a transient off-screen window (an
     * animation about to end on the board home) never flashes the beacon, and
     * releases INSTANTLY when the announce card takes over — the two surfaces
     * never double-signal.
     */
    mandatoryChipAttention(): boolean {
      // Presented-only, like the plate: while the notification feed is still
      // playing the pending action stays entirely silent (no plate AND no
      // beacon) — the first presentation is ONE moment, whichever form the
      // player's location gives it.
      //
      // This is the PENDING half only. Whether the decision is ANSWERABLE right
      // now is the strip's own `viewerAwaited` (the very status its pill
      // renders), so a chip can never read «ОЖИДАЕТ» and flash for attention in
      // the same breath. Deliberately not duplicated here: this shell has no
      // second opinion about the chip's status to offer.
      return this.mandatoryActionPresented &&
        !this.mandatoryAnnounceVisible &&
        !this.promptServedWhereIStand;
    },
    /**
     * IS THE PLAYER STANDING WHERE THE PROMPT IS ANSWERED?
     *
     * The attention beacon reads «you owe a decision and it is NOT on the
     * screen you are looking at». It used to derive that by NEGATING a
     * rendering condition (`!mandatoryAnnounceVisible`) — and everything in
     * that condition which is not about location (`!isAnimationHoldActive()`,
     * `!presentationHeld`, `consoleRevealMode === undefined`, …) therefore
     * became a reason to raise the alarm. An embedded reveal / draw / pick
     * inside a workspace lights up every one of them, so the chip flashed
     * amber while the player was looking straight at the decision.
     *
     * Two honest signals, both already maintained:
     *  · `shellTaskOnSurface` — for the shell-section kinds it covers;
     *  · a PRESENTING workspace claim — the surface is teleported into the
     *    workspace the player is standing in, which is the definition of
     *    «here». (The start workspace projects onto neither navigation axis,
     *    so `section` cannot answer this and never could.)
     */
    promptServedWhereIStand(): boolean {
      return this.shellTaskOnSurface ||
        (workspaceOutcomeState.host !== undefined &&
          workspaceOutcomeState.stage === 'presenting');
    },
    /** The prompt card's copy (one consoleTaskSummary source, so nothing can
     *  diverge). The A-verb relabels by STATE: «Открыть» for a fresh held
     *  decision, «Вернуться к решению» for a deferred one. */
    mandatoryAnnounceView(): {kicker: string, ask: string, sourceCard: CardName | undefined, openLabel: string} {
      return {
        kicker: this.deferKicker,
        ask: this.deferAsk,
        sourceCard: this.deferSourceCard,
        // A kind may NAME its own press when «Открыть» undersells it (a colony
        // bonus delivery: «Забрать карту» — the press answers the prompt AND
        // takes the player to the colony that paid).
        openLabel: this.mandatoryGateHeld ?
          (this.activeTaskSummary?.openKey ?? 'Open') :
          this.deferReturnLabel,
      };
    },
    /**
     * WHY A NEW ACTION CANNOT BE STARTED RIGHT NOW — '' when it can.
     *
     * ONE answer for every «почему нельзя» on the board home, because there is
     * only ever one real reason to be there: a decision is already owed. It
     * covers both shapes — a live board PLACEMENT, and a mandatory prompt the
     * player MINIMIZED to go and look around.
     *
     * It has to OUTRANK each surface's own arithmetic. With the sponsor's
     * play-from-hand minimized, the basic-actions wheel read «недостаточно
     * растений» / «сейчас недоступно» / «доступно после первого действия»: every
     * line individually true, and together a lie about why the game will not
     * move. The player was told five wrong things instead of the one right one.
     */
    actionBlockedReason(): string {
      return this.placementActive || this.mandatoryDeferredActive ?
        'Finish your current action first' : '';
    },
    shellTaskActive(): boolean {
      return this.shellTask !== undefined && !this.consoleState.task.deferred;
    },
    /**
     * IS THE PLAYER STANDING WHERE THE TASK IS ANSWERED?
     *
     * Each shell-section kind has ONE target surface — the screen
     * `openShellTaskSurface` opens for it. This answers «is that screen the
     * one in front of the player right now», which is the only honest basis
     * for telling them something is waiting: on the target surface the ask is
     * already stated by that surface's own header and command bar, so a chip
     * repeating it is noise; anywhere else it is the only thing that says
     * where to go back to.
     *
     * The `playFromHand` row carries the Game Start Workspace's step: there
     * the hand is hosted INSIDE the workspace, so «on the hand» and «inside
     * the start» are the same place, not two.
     */
    shellTaskOnSurface(): boolean {
      return shellTaskOnSurface(this.shellTask, {
        section: this.consoleState.section,
        sheet: this.consoleState.sheet,
        corpFirstActionOpen: this.corpFirstActionOpen,
      });
    },
    /** The std-projects source: the TOP-LEVEL prompt (EstablishedMethods) or the action menu. */
    standardProjectsAction(): {path: ReadonlyArray<number>, input: SelectProjectCardToPlayModel} | undefined {
      const task = this.shellTask;
      if (task?.kind === 'projectCard' && task.mode === 'standardProject' && this.playerView.waitingFor?.type === 'projectCard') {
        return {path: [], input: this.playerView.waitingFor as SelectProjectCardToPlayModel};
      }
      return findStandardProjectsAction(this.playerView.waitingFor);
    },
    // ── colony pick (T4 — a server SelectColony) ────────────────────────
    colonyModel(): SelectColonyModel | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'colony' ? (wf as SelectColonyModel) : undefined;
    },
    colonyPick(): ConsoleColonyPick | undefined {
      const model = this.colonyModel;
      if (model === undefined) {
        return undefined;
      }
      // Standalone: only while the shell-section task actually serves (the
      // admission gate holds it back behind cinematics). EMBEDDED: the host
      // workspace IS the serving surface — `shellTask` is legitimately gated
      // under a live scene there (the start), so the raw prompt + the latch
      // are the truth instead.
      if (this.shellTask?.kind !== 'colony' && workspaceFrameHost('colonies') === undefined) {
        return undefined;
      }
      const reasons: Record<string, string> = {};
      for (const d of model.disabledColonies ?? []) {
        reasons[d.name] = typeof d.reason === 'string' ? translateText(d.reason) : translateMessage(d.reason);
      }
      const label = model.buttonLabel;
      return {
        selectable: model.coloniesModel.map((c) => c.name),
        reasons,
        buttonLabel: label !== undefined && label !== '' && !['Save', 'Confirm', 'Ok'].includes(label) ? label : 'Select',
      };
    },
    /**
     * The rail source: pick-a-NEW-tile prompts (Aridor) list ONLY the offered
     * tiles; everything else shows the in-game colonies (unpickable ones stay
     * visible with the server reason — information parity).
     */
    coloniesForRail(): ReadonlyArray<ColonyModel> {
      const model = this.colonyModel;
      if (model !== undefined && this.shellTask?.kind === 'colony' && model.purpose === 'addNewColonyToGame') {
        return model.coloniesModel;
      }
      return this.game.colonies;
    },
    /** SelectColony pay-on-commit cancel (Build Colony std project). */
    colonyCancellable(): boolean {
      return this.colonyModel?.placementContext?.cancellable === true;
    },
    /**
     * The COMMITTED track position of the colony an armed trade transaction
     * is watching (undefined outside a transaction). Feeds the watcher that
     * tells the orchestrator when the server's reset really landed — the
     * only signal the reset glide is allowed to start on.
     */
    armedColonyTradeTrack(): number | undefined {
      if (!colonyTradeState.active || colonyTradeState.colonyName === '') {
        return undefined;
      }
      return this.game.colonies.find((c) => c.name === colonyTradeState.colonyName)?.trackPosition;
    },
    /** A task's nested SelectSpace, narrowed for the headless picker. */
    taskSpacePrompt() {
      const p = this.taskSpacePending?.spacePrompt;
      return p !== undefined && p.type === 'space' ? p : undefined;
    },
    /**
     * The server's top-level `SelectSpace` is being HELD behind a cinematic
     * (consolePromptAdmission). The board is ALWAYS mounted, so placement has no
     * `v-if` to suppress — this verdict is what stands in for one.
     *
     * The case that shipped it: Experimental Forest draws 2 plant cards AND
     * places a greenery. The executor draws synchronously and only DEFERS the
     * placement, so ONE response carries the drawn-cards reveal and the
     * SelectSpace together — the reveal assembled over a board that had already
     * gone live, force-switched the section and closed every layer underneath.
     * The draw is a cinematic with a defined END (its last card landing in the
     * dock); nothing may be asked of the player before it.
     *
     * Mirrored out for the board binder (see setConsolePlacementHeld):
     * it paints the hex highlight, which would otherwise stay lit under the modal.
     */
    placementHeld(): boolean {
      return this.playerView.waitingFor?.type === 'space' && !this.admits('placement');
    },
    /**
     * Server-driven placement (SelectSpace) or a client-side board picker.
     *
     * Only the SERVER branch is admission-gated. The two client-side pickers are
     * hand-offs the player just initiated from a surface that UNMOUNTS itself for
     * the pick (convert-plants, a task's nested space branch) — holding those
     * would leave the prompt with no surface at all, which is the strand the
     * `setConsoleTaskSpacePlacement` mirror exists to prevent.
     */
    placementActive(): boolean {
      return (this.playerView.waitingFor?.type === 'space' && !this.placementHeld) ||
        this.convertPlantsPending !== undefined ||
        this.taskSpacePending !== undefined;
    },
    placementCancellable(): boolean {
      if (this.convertPlantsPending !== undefined || this.taskSpacePending !== undefined) {
        return true; // client-side — nothing committed yet
      }
      return this.playerView.waitingFor?.placementContext?.cancellable === true;
    },
    /**
     * WHO asked for this placement. Read off `placementSpaceModel` — the one
     * resolver that already unifies the three placement sources — so the two
     * CLIENT pickers (convert plants, a task's nested space) are covered too;
     * reading the task summary instead would classify only the server prompt.
     *
     * `createMarsSelectSpace` has derived `placementContext.source` from the
     * placing card since the marker existed, and the panel showed none of it:
     * a tile that arrives from a triggered effect had no attribution on screen.
     */
    placementSourceView(): PromptSourceView | undefined {
      return this.placementActive ? promptSourceView(this.placementSpaceModel) : undefined;
    },
    /** The placement source CARD, when there is one — what X inspects. */
    placementSourceCard(): CardName | undefined {
      const view = this.placementSourceView;
      return view?.inspectable === true ? view.card : undefined;
    },
    /**
     * The active space prompt, narrowed to the SelectSpace model — the ONE
     * resolver for every placement read (title / per-cell illegal reason /
     * preview). It covers all three console placement sources: the server's
     * top-level SelectSpace, the client-side convert-plants picker and a task's
     * nested space option (the WGT ocean). `placementActive` counts the same
     * three, so anything derived from it must resolve them all — an earlier
     * split resolver missed the nested one and left that placement with a blank
     * title and no illegal reason.
     */
    placementSpaceModel() {
      const wf = this.playerView.waitingFor;
      if (wf?.type === 'space') {
        return wf;
      }
      return this.convertPlantsPrompt ?? this.taskSpacePrompt;
    },
    /**
     * PLANET FOCUS target — should the enlarged placement stage be up?
     *
     * TRUE while a space prompt whose WHOLE candidate set lives on the main
     * Mars grid is present (read RAW off `placementSpaceModel`, not the
     * admission-gated `placementActive`: a prompt held behind a reveal
     * still engages the mode, so the board is already focused when the
     * overlay clears — and a chained second placement re-claims the mode
     * before any exit gets to run). After the pick resolves, the tile-hero
     * transaction and the card-bonus cover's FIELD phases SUSTAIN an
     * already-engaged mode through the landing + the field reward beats —
     * they never INITIATE it (a non-qualifying placement runs its hero on
     * the normal stage).
     */
    planetFocusTarget(): boolean {
      const prompt = this.placementSpaceModel;
      if (prompt !== undefined &&
          qualifiesForPlanetFocus(prompt.spaces, this.playerView.game.spaces)) {
        return true;
      }
      return (this.tilePlacementState.active || isBoardCardBonusFieldPhase()) &&
        isPlanetFocusEngaged();
    },
    /**
     * The OWED scale beat may play: the exit landed with parameter changes
     * untold, and the world is quiet enough for the scales to be READ (no
     * reveal above the board, no cards in transit). Pure policy in
     * planetFocus.ts, evaluated against the one signal collection.
     */
    planetFocusBeatReady(): boolean {
      return planetFocusBeatAllowed(this.admissionSignals);
    },
    /**
     * The (cell, tile) the preview is for — the refetch key. '' → no preview
     * (not placing, no cell focused, or a custom SelectSpace with no kind).
     */
    cellPreviewKey(): string {
      const prompt = this.placementSpaceModel;
      const id = this.consoleState.boardSpaceId;
      if (!this.placementActive || prompt === undefined || id === undefined || prompt.placementType === undefined) {
        return '';
      }
      const cleared = (prompt.hiddenTiles ?? []).includes(id as SpaceId) ? 'c' : '';
      return `${id}|${prompt.placementType}|${prompt.tileType ?? ''}|${cleared}|${prompt.sourceCard ?? ''}`;
    },
    /** What this cell pick actually PUTS DOWN — a tile, or a marker (a claim /
     *  a camp move). The key comes from the ONE prompt-copy source. */
    placementKickerKey(): string {
      return placementKicker(this.placementSpaceModel);
    },
    /**
     * WHAT this placement puts down — the dossier's identity input, read off
     * the one prompt resolver so all three placement sources (server prompt,
     * convert plants, a task's nested space) resolve the same way.
     */
    placementShape(): PlacementShape | undefined {
      const prompt = this.placementSpaceModel;
      if (prompt === undefined) {
        return undefined;
      }
      return {
        tileType: prompt.tileType,
        placementType: prompt.placementType,
        placementEffect: prompt.placementEffect,
        sourceCard: prompt.sourceCard,
      };
    },
    /**
     * The convert-plants exchange — the ONE placement whose price is an action
     * cost rather than a cell fact. Structural (the pending client pick), and
     * the amount is the live, Ecoline-adjusted price the server exposes.
     */
    plantConversion(): PlacementConversion | undefined {
      if (this.convertPlantsPending === undefined) {
        return undefined;
      }
      return {amount: this.thisPlayer.plantsNeededForGreenery, icon: 'plants'};
    },
    placementTitle(): string {
      const t = this.placementSpaceModel?.title;
      if (t === undefined) {
        return '';
      }
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    selectedCellLegal(): boolean {
      const id = this.consoleState.boardSpaceId;
      if (id === undefined) {
        return false;
      }
      const el = document.querySelector(`[data_space_id="${id}"]`);
      return el !== null && el.classList.contains('board-space--available');
    },
    /** The SERVER's per-cell illegal reason (+M€ deficit), translated. */
    selectedCellIllegalReason(): string {
      const prompt = this.placementSpaceModel;
      const id = this.consoleState.boardSpaceId;
      if (prompt === undefined || id === undefined || this.selectedCellLegal) {
        return '';
      }
      const entry = prompt.illegalSpaces?.find((s) => s.spaceId === id);
      if (entry === undefined) {
        return '';
      }
      const reason = placementReasonToUnplayable(entry.reason, entry.deficit);
      return translateTextWithParams(reason.message, (reason.params ?? []).map(String));
    },
    // ── context panel ──────────────────────────────────────────────────
    contextMode(): 'placement' | 'cell' | 'track' | 'idle' {
      if (this.placementActive) {
        return 'placement';
      }
      if (this.consoleState.scaleInspecting && this.consoleState.trackMarker !== undefined) {
        return 'track';
      }
      if (this.consoleState.inspecting) {
        return 'cell';
      }
      return 'idle';
    },
    /** P27b: the curated LORE for the inspected special cell (Ganymede,
     *  volcanoes, Noctis…) — shown in INSPECTION, deliberately not during
     *  placement (it would crowd the task panel). */
    selectedCellLore(): {title: string, description: string} | undefined {
      const id = this.consoleState.boardSpaceId;
      if (id === undefined) {
        return undefined;
      }
      const info = getSpecialCellInfo(id as SpaceId, this.game.gameOptions.boardName);
      return info !== undefined ? {title: info.title, description: info.description} : undefined;
    },
    /** The focused TRACK marker's explanation — the SAME already-translated
     *  rows the premium ScaleTooltip shows (one source, no drift). */
    trackInfo(): ScaleTooltipContent | null {
      return this.consoleState.trackMarker !== undefined ? scaleTooltipState.content : null;
    },
    /** P27c: the owning SCALE's own hover-overview (name + current value +
     *  description — mirrors ArcScale.overviewContent), shown in the panel
     *  UNDER the focused bonus so the scale hover is never lost on pad. */
    trackScaleOverview(): {titleKey: string, nounKey: string, valueText: string, descriptionKey: string} | null {
      if (this.consoleState.trackMarker === undefined) {
        return null;
      }
      const accent = scaleTooltipState.content?.accent;
      if (accent === undefined) {
        return null;
      }
      const theme = ARC_SCALE_THEMES[accent];
      const value = accent === 'temperature' ? this.game.temperature :
        accent === 'oxygen' ? this.game.oxygenLevel :
          accent === 'venus' ? this.game.venusScaleLevel :
            this.game.oceans;
      return {
        titleKey: theme.title,
        nounKey: theme.noun,
        valueText: accent === 'oceans' ? `${value}/9` : `${value}${theme.unit}`,
        descriptionKey: theme.description,
      };
    },
    /** The dossier overlay's mode — undefined on the idle home (unmounted). */
    contextOverlayMode(): 'placement' | 'cell' | 'track' | undefined {
      const m = this.contextMode;
      return m === 'idle' ? undefined : m;
    },
    /** P30: the right STRATEGY RAIL's Milestones/Awards projections — the
     *  same authoritative sources as the workspaces (models + the live
     *  waitingFor option set + the server's own `maCosts` prices). */
    hudMilestoneZone(): MaHudZone {
      const next = buildMaHudZone('milestones', this.game.milestones, {
        myColor: this.thisPlayer.color,
        availableNow: this.claimableTitles(findMilestoneOptionPath(this.playerView.waitingFor)?.options),
        maxSlots: 3,
        cost: this.milestoneCostValue,
      });
      maHudZoneShare.milestones = shareViewSnapshot(maHudZoneShare.milestones, next) as MaHudZone;
      return maHudZoneShare.milestones;
    },
    hudAwardZone(): MaHudZone {
      const next = buildMaHudZone('awards', this.game.awards, {
        myColor: this.thisPlayer.color,
        availableNow: this.claimableTitles(findAwardOptionPath(this.playerView.waitingFor, this.awardNames)?.options),
        maxSlots: 3,
        // Free sponsorship (Vitor's start action) — the honest live price is 0.
        cost: this.awardFundingActive ? 0 : this.awardCostValue,
      });
      maHudZoneShare.awards = shareViewSnapshot(maHudZoneShare.awards, next) as MaHudZone;
      return maHudZoneShare.awards;
    },
    /**
     * The strategy rail is NOT watchable: the player left the board home, or a
     * workspace / cinematic / full-bleed layer stands over the rail's edge.
     * While true the rail QUEUES its seal beats — they play on the uncover as
     * the continuation of the workspace ceremony, never underneath one.
     */
    strategyRailCovered(): boolean {
      // Deliberately NOT the mandatory announce: the plate is centre-stage
      // while the rail seals at the edge — result first, demand beside it.
      return !this.boardHomeIdle ||
        this.consoleRevealMode !== undefined ||
        this.startSceneVisible;
    },
    selectedCellInfo() {
      const info = boardInfoState.info;
      return info !== undefined && info.space === this.consoleState.boardSpaceId ? info : undefined;
    },
    /**
     * The placement preview, shown only for a LEGAL cell — mirrors the desktop
     * hover popover (an illegal cell shows the server's reason instead of the
     * consequences of a placement that cannot happen).
     */
    selectedCellPreview(): BoardPlacementPreview | undefined {
      return this.selectedCellLegal ? this.cellPreview : undefined;
    },
    cellInfoLoading(): boolean {
      return boardInfoState.loading && boardInfoState.spaceId === this.consoleState.boardSpaceId;
    },
    // ── hand ────────────────────────────────────────────────────────────
    // The WHOLE hand (playable-first), before the tag filter. Drives the
    // filter panel's option counts + the "All" total.
    handEntriesAll(): Array<ConsoleHandEntry> {
      // EXECUTABLE NOW — the server's live play offer. It gates the press and
      // nothing else; off-turn it is empty by construction.
      const playable = new Set((this.playAction?.input.cards ?? [])
        .filter((c) => c.isDisabled !== true)
        .map((c) => c.name));
      const robots = new Set((this.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name));
      const all: Array<CardModel> = [
        ...this.playerView.cardsInHand,
        ...(this.thisPlayer.selfReplicatingRobotsCards ?? []),
      ];
      const entries = all.map((card) => ({
        card,
        playable: playable.has(card.name),
        // POTENTIAL — the server's own turn-independent verdict on the card
        // (`unplayableReasons`, all of them domain reasons). One validation,
        // two questions.
        //
        // `playable ⊆ potential` is enforced here rather than assumed: the live
        // offer can be WIDER than the plain rules verdict, because a prompt may
        // carry its own discount (Eccentric Sponsor's play-from-hand prelude) —
        // `unplayableReasons` knows nothing of it, so a card playable only
        // thanks to that discount would otherwise be dimmed while its own
        // РАЗЫГРАТЬ button was live.
        potential: playable.has(card.name) ||
          potentiallyAvailable(blockersForReasons(card.unplayableReasons ?? [])),
        robot: robots.has(card.name),
      }));
      // Playable-first, stable within groups (CONSOLE_MODE_CONCEPT §8) — by
      // POTENTIAL, so the shelf keeps its reading order when the turn passes
      // (on the viewer's own turn the two sets coincide).
      return [
        ...entries.filter((e) => e.potential),
        ...entries.filter((e) => !e.potential),
      ];
    },
    // The VISIBLE hand — narrowed by the active tag filter (sale mode always
    // shows the whole hand). This is what the grid renders + what handIndex
    // indexes into, so play / inspect / command-bar all read the filtered set.
    /** The card whose HAND SLOT is held empty (Vue-managed, patch-proof):
     *  staged in the play composer, mid-return after cancel, or departing
     *  after a successful play (until the server removes it from the hand).
     *  One physical card never sits in two places at once. */
    stagedHandCard(): CardName | undefined {
      return this.pendingPlayCard?.cardName ?? this.returningPlayCard ?? this.departingPlayCard;
    },
    /**
     * TRUE exactly when the held departing-play slot can be released: the
     * played card is genuinely gone from the hand (and the SRR host). A TINY
     * computed on purpose (perf iteration 3): the release used to ride a
     * watcher on `handEntriesAll`, which force-built the whole
     * playable/potential entry list on EVERY server response — hand closed
     * included — to answer a question that is almost always «no card is
     * departing». While `departingPlayCard` is undefined this tracks nothing
     * but that one string.
     */
    departingPlayCardGone(): boolean {
      const name = this.departingPlayCard;
      if (name === undefined) {
        return false;
      }
      return !this.playerView.cardsInHand.some((c) => c.name === name) &&
        !(this.thisPlayer.selfReplicatingRobotsCards ?? []).some((c) => c.name === name);
    },
    /**
     * THE HAND WORKSPACE'S OPEN DESCENT — what the section needs to know to
     * park its shelf, grow the breadcrumb and render the stage zone.
     *
     * A DESCENT IS A PHASE OF THE HAND'S FRAME, never a second frame: the
     * browse grid is parked, not unmounted, which is exactly why its selection,
     * filter and scroll survive the descent for free. It reads that phase, NOT
     * `pendingPlayCard` — the composer can also be opened WITHOUT a descent (a
     * `playFromHand` task raised over the board), and then the workspace was
     * never entered, so there is nothing to be inside of and the composer keeps
     * its own band.
     */
    handStage(): ConsoleHandStage | undefined {
      const phase = workspaceFramePhase('hand');
      if (phase === undefined || phase === 'browse') {
        return undefined;
      }
      // THE CRUMB ONLY EVER GAINS A TAIL. Once the play's own outcome is on
      // screen, the stage segment is ITS name — «КАРТЫ В РУКЕ › <карта> ›
      // ДОБОР КАРТ» — handed UP by the re-homed surface exactly as it is in
      // «Действия карт» (a surface that titles itself inside someone else's
      // frame reads as a modal that arrived). Until it publishes, the honest
      // generic, so the line never blanks and never renames itself twice.
      // Keyed on the surface being RE-HOMED, exactly like the command bar's own
      // kicker — never on the claim's `presenting` stage, which is published a
      // flush later by a watcher: for that one frame the bar already read «ДОБОР
      // КАРТ» while the crumb still said «РОЗЫГРЫШ», i.e. two places naming the
      // same stage differently.
      // …and from the moment the DECK STARTS DEALING, which is earlier: the
      // landing tableau dissolves there and the drawn cards are visibly on
      // their way, so a crumb that fell back to «РОЗЫГРЫШ» for that stretch
      // would step BACKWARDS through a flow that only ever moves forward.
      // …and once that batch is gone, the tail moves ON to the step this play
      // still OWES (the colony it also builds), whose door is waiting for the
      // cards to finish landing. Without it the line fell back to «РОЗЫГРЫШ»
      // for that gap — backwards, through a flow that only ever moves forward —
      // and then forward again to the same word the step itself publishes, so
      // the crumb animated twice to say one thing.
      // …and once a stage of this claim HAS named itself, that name stands for
      // as long as the claim does. A flow can hand the screen from one of its
      // own stages to the next WITHOUT anything being embedded in between — the
      // effect decision's offer opens the real hand, which is this workspace's
      // own shelf, so nothing is teleported anywhere for the whole discard.
      // Falling back to «РОЗЫГРЫШ» there stepped BACKWARDS through a flow that
      // only moves forward. `phaseKey` is written only by a surface that really
      // was this claim's stage and dies with the claim, so reading it is
      // monotone by construction.
      const outcomeNamed = workspaceOutcomeState.phaseKey !== '';
      const outcomeStage = this.handOutcomeLive &&
        (this.workspaceOutcomeEmbedded || deckDrawDealing() || outcomeNamed) ?
        (outcomeNamed ? workspaceOutcomeState.phaseKey : focusKicker('draw')) :
        this.followUpStepStageKey;
      // …and once that owed step actually STANDS, the tail is the DEEPEST
      // frame's, not ours. It used to stop at the hand, so the moment the colony
      // grid opened inside this workspace the line read «КАРТЫ В РУКЕ › НАУЧНАЯ
      // КОЛОНИЯ › РОЗЫГРЫШ» — naming a stage the player had just left, one
      // screen up. The step publishes its own name UP the stack
      // (`setWorkspaceFrameStage`), so this is a READ of the one source, never a
      // second one; it outranks the terms below because depth outranks phase.
      const nestedStage = workspaceFrameHasNested('hand') ?
        (workspaceStackCrumb()?.stage ?? '') : '';
      const stage = nestedStage !== '' ? nestedStage :
        (outcomeStage !== '' ? outcomeStage : workspaceFrameStage('hand'));
      return {
        subject: workspaceFrameSubject('hand'),
        name: stage === '' ? 'Playing' : stage,
        committed: isCommitted(phase),
      };
    },
    /**
     * «ЭПАТАЖНЫЙ СПОНСОР» — the hand stands as a STEP INSIDE another workspace.
     *
     * One frame lookup. It used to be forty lines that re-derived the claim
     * from server truth + a commit latch + a colony latch + a follow-up
     * predicate on every tick, and each of those terms was a separate way for
     * the claim to lapse under a card that was still flying. A frame does not
     * lapse: it is pushed when the step opens and popped when it is over.
     */
    startSponsorEmbed(): boolean {
      return workspaceFrameHost('hand') === 'start';
    },
    /**
     * THE START WORKSPACE'S FRAME must stand while the opening SERVES it — or
     * while a step it is HOSTING is still unfinished, because an inner frame
     * can never outlive its host. The second half is why this is a computed and
     * not a raw `startSceneServes` watcher: popping the hosted hand makes it
     * re-evaluate on its own, so nothing has to remember to re-check the root.
     */
    startFrameLive(): boolean {
      if (this.startSceneServes || workspaceFrameHasNested('start')) {
        return true;
      }
      // SERVER TRUTH, for the cases the module state cannot answer (a RELOAD
      // wipes the workspace's lifetime hold, so `startSceneServes` is false):
      //
      // 1. The corporation still OWES its mandatory first action and the
      //    start flow is live — the workspace's own final stage. This is what
      //    restores the first-action WAIT (the opponent is still moving, so
      //    there is no prompt at all to re-derive the frame from) and the
      //    ACTIVE stage alike, without ever falling back to a modal.
      if (corpFirstActionInStartFlow(this.playerView) && firstActionOwed(this.playerView)) {
        return true;
      }
      // 2. The PRELUDES phase IS the deployment, it survives a reload, and a
      //    play-from-hand raised in it can only be a prelude's effect
      //    (`PlayProjectCard`) — the same prompt would otherwise open a
      //    STANDALONE hand, throwing the player out of a flow they had not left.
      if (this.game.phase !== Phase.PRELUDES) {
        return false;
      }
      const task = taskFor(this.playerView);
      return task?.kind === 'projectCard' && task.mode === 'playFromHand';
    },
    /**
     * The zone the HAND is teleported into — published by the frame BELOW it
     * (the start workspace hosting a play-from-hand prelude). `undefined` at
     * depth 0 (it stands in its own band) and while the host's zone is not up
     * yet — ownership ≠ readiness, embed rule 4.
     */
    handEmbedTarget(): string | undefined {
      return workspaceFrameTarget('hand');
    },
    /**
     * The workspace slot the PLAY COMPOSER is teleported into (undefined → its
     * own band). The composer is a PHASE of the hand's frame, so it lands in
     * that frame's OWN zone — the same selector a nested frame would use, one
     * level up the same teleport chain.
     */
    playEmbedTarget(): string | undefined {
      if (this.pendingPlayCard === undefined) {
        return undefined;
      }
      const slot = workspaceFrameSlot('hand');
      return !workspaceFrameDescended('hand') || slot === '' ? undefined : slot;
    },
    /**
     * OWNERSHIP ≠ READINESS. The descent is claimed synchronously on the press,
     * but the zone it teleports into exists one flush later. For that one frame
     * the composer must render NOWHERE rather than in its standalone band —
     * mounting it there and moving it next frame is a visible modal-then-embed
     * flash, i.e. exactly the impression this migration removes. Same idiom as
     * `taskHeldForWorkspace` / `deckDrawHolds()`.
     */
    playHeldForWorkspace(): boolean {
      return workspaceFrameDescended('hand') && workspaceFrameSlot('hand') === '';
    },
    /**
     * The card the PLAY PREWARM watches: the browse-hand cursor standing on a
     * playable card (never a sale / select / pick mode — those cursors are not
     * «considering a play»). Feeds the focus-dwell preview prefetch, so by the
     * time A lands the composer usually reads its preview synchronously.
     */
    focusedPlayableHandCard(): CardName | undefined {
      if (this.consoleState.section !== 'hand' || this.consoleState.sale.active ||
          this.handSelectUiActive || this.pendingPlayCard !== undefined) {
        return undefined;
      }
      const entry = this.handEntries[this.consoleState.handIndex];
      return entry?.playable === true ? (entry.card.name as CardName) : undefined;
    },
    handEntries(): ReadonlyArray<ConsoleHandEntry> {
      if (this.consoleState.sale.active) {
        return this.handEntriesAll;
      }
      // CLIENT composer pick: same narrowing as the server select, over the
      // pick's shown-hand universe (no staged card, no SRR-hosted cards).
      if (this.handPickActive) {
        const shown = new Set(this.handPickHandNames);
        const base = this.handEntriesAll.filter((e) => shown.has(e.card.name));
        if (this.handSelectSuitableOnly && this.handSelectFiltered) {
          const sel = new Set(this.handSelectSelectableNames);
          return base.filter((e) => sel.has(e.card.name));
        }
        return base;
      }
      // MANDATORY hand SELECT (discard / reveal / place): the tag filter is
      // replaced by the "suitable only" filter. When on (default) a NARROWED
      // (conditional) prompt shows only the candidate cards; toggling it off
      // reveals the whole hand for context (non-candidates stay non-pickable).
      if (this.handSelectTaskActive) {
        if (this.consoleState.select.suitableOnly && this.handSelectFiltered) {
          const sel = new Set(this.handSelectSelectableNames);
          return this.handEntriesAll.filter((e) => sel.has(e.card.name));
        }
        return this.handEntriesAll;
      }
      return filterHandByTag(this.handEntriesAll, this.consoleState.handTagFilter);
    },
    /**
     * THE ALBUM UNIVERSE — every card PHYSICALLY IN THE ALBUM while the hand
     * is open: mode-narrowed (a client pick's shown hand excludes the staged
     * card + SRR-hosted cards) but NEVER view-filtered. The tag filter and
     * «only suitable» decide which PAGE a card is on — or that it parks with
     * the far page packets — never whether it left the dock. The dock's lift
     * and the open/close flights read THIS, which is what makes the dock
     * genuinely empty for the whole open hand.
     */
    handAlbumUniverse(): ReadonlyArray<ConsoleHandEntry> {
      if (this.handPickActive) {
        const shown = new Set(this.handPickHandNames);
        return this.handEntriesAll.filter((e) => shown.has(e.card.name));
      }
      return this.handEntriesAll;
    },
    /** Universe cards OUTSIDE the current view (tag / suitable filter) —
     *  parked with the far-side page packets by the section's transition
     *  geometry, so the reveal flies them out of the dock and the close
     *  gathers them home with everything else. */
    handPacketExtras(): ReadonlyArray<string> {
      const visible = new Set(this.handEntries.map((e) => e.card.name));
      const out: Array<string> = [];
      for (const e of this.handAlbumUniverse) {
        if (!visible.has(e.card.name)) {
          out.push(e.card.name);
        }
      }
      return out;
    },
    /**
     * THE ALBUM SPINE — the footer bay's centre line while the hand album
     * owns the screen: «1–10 из 15 · 1/2» between the LB/RB page verbs
     * (ConsoleHandDock renders it in place of the «КАРТЫ n/m» counter,
     * whose numbers already live in the album header). Undefined everywhere
     * else — including PAST THE DESCENT (the play composer owns LB/RB for
     * its payment dial there, so the spine must not advertise pages), but
     * NOT during a pick bridge (the browse shelf is the picker again).
     * Mirrors the section's own derivation: page shape is a profile fact,
     * the page is derived from the focus index — no measure, no drift.
     */
    handDockAlbum(): HandDockAlbum | undefined {
      if (this.consoleState.section !== 'hand') {
        return undefined;
      }
      if (workspaceFrameDescended('hand') && !this.handPickActive) {
        return undefined;
      }
      const count = this.handEntries.length;
      const spec = albumSpecFor(consoleLayoutState.profile, albumLayoutState.layout);
      const perPage = spec.cols * spec.rows;
      const pages = Math.max(1, Math.ceil(count / perPage));
      const idx = Math.min(Math.max(0, count - 1), Math.max(0, this.consoleState.handIndex));
      const page = Math.min(pages - 1, Math.floor(idx / perPage));
      // POSITION ONLY — no card-index range: the total lives in the header
      // chip and the page's cards are on screen, so a «9–12 из 14» spent the
      // bay's brightest line on an admin paginator's arithmetic.
      return {
        page: page + 1,
        pages,
        canPrev: page > 0,
        canNext: page < pages - 1,
      };
    },
    // ── mandatory hand SELECT (server `handSelect` task) ──────────────────
    /** The active mandatory hand-select prompt (all candidates in hand), or
     *  undefined. Derived from the shell-section task + the raw waitingFor. */
    handSelectModel(): SelectCardModel | undefined {
      if (this.shellTask?.kind !== 'handSelect') {
        return undefined;
      }
      const wf = this.playerView.waitingFor;
      return wf?.type === 'card' ? (wf as SelectCardModel) : undefined;
    },
    /** True while the hand section is serving a mandatory hand-select. */
    handSelectTaskActive(): boolean {
      return this.handSelectModel !== undefined;
    },
    // ── CLIENT hand pick (composer → hand bridge, consoleHandPick) ────────
    /** A composer (play confirm / blue-card action) handed a card pick to the
     *  hand section — the composer is hidden (v-show) and the hand owns input. */
    handPickActive(): boolean {
      return consoleHandPickState.active;
    },
    /** A repeat-action source (ProjectInspection / Viron) handed the "pick an
     *  action to repeat" to the ДЕЙСТВИЯ КАРТ surface — the source composer is
     *  hidden (v-show) and `ConsoleCardActions` (repeat mode) owns input. */
    repeatPickActive(): boolean {
      return consoleRepeatPickState.active;
    },
    /** The hand section is in EITHER select mode — the server `handSelect`
     *  task OR a client composer pick. One UI, two sources. */
    handSelectUiActive(): boolean {
      return this.handSelectTaskActive || this.handPickActive;
    },
    /** The «suitable only» filter of whichever select source is active. */
    handSelectSuitableOnly(): boolean {
      return this.handPickActive ? consoleHandPickState.suitableOnly : this.consoleState.select.suitableOnly;
    },
    /** The live pick accumulation of whichever select source is active. */
    handSelectPicked(): ReadonlyArray<string> {
      return this.handPickActive ? consoleHandPickState.selected : this.consoleState.select.selected;
    },
    /** The A-verb of whichever select source is active (server buttonLabel /
     *  the pick request's verb — 'Discard' / 'Reveal' / 'Link card' / …). */
    handSelectVerb(): string {
      if (this.handPickActive) {
        return consoleHandPickState.request?.buttonLabel || 'Select';
      }
      return this.handSelectModel?.buttonLabel || 'Select';
    },
    /** Multi pick: every candidate (up to `max`) is already selected — L3 flips
     *  between select-all and unselect-all. */
    pickAllSelected(): boolean {
      const req = consoleHandPickState.request;
      if (req === undefined) {
        return false;
      }
      const target = Math.min(req.selectable.length, req.max);
      return target > 0 && consoleHandPickState.selected.length >= target;
    },
    /** PURE derivation of the select facts (pickable set / single-vs-multi /
     *  conditional-subset / per-card «why not» reasons) — the i18n of a
     *  disabledReason is injected so the derivation module stays locale-free. */
    handSelectDerived(): HandSelectDerivation | undefined {
      // CLIENT composer pick: the request already carries the candidate set +
      // the server's per-card reasons (disabledCards); every OTHER shown hand
      // card gets the honest generic line — same shape as the server path.
      const pick = consoleHandPickState.request;
      if (this.handPickActive && pick !== undefined) {
        const handNames = this.handPickHandNames;
        const selectableSet = new Set<string>(pick.selectable);
        const reasons: Record<string, string> = {};
        for (const [name, reason] of Object.entries(pick.reasons)) {
          reasons[name] = reason !== '' ? reason : translateText('This card cannot be chosen here');
        }
        for (const name of handNames) {
          if (!selectableSet.has(name) && reasons[name] === undefined) {
            reasons[name] = translateText('This card cannot be chosen here');
          }
        }
        return {
          selectable: pick.selectable,
          single: pick.min === 1 && pick.max === 1,
          filtered: pick.selectable.length < handNames.length,
          reasons,
        };
      }
      const model = this.handSelectModel;
      if (model === undefined) {
        return undefined;
      }
      const handNames = this.handEntriesAll.map((e) => e.card.name);
      const translateReason = (r: string | Message | undefined): string =>
        r === undefined ? translateText('This card cannot be chosen here') :
          (typeof r === 'string' ? translateText(r) : translateMessage(r));
      return deriveHandSelect(model, handNames, translateReason);
    },
    /** The hand shown during a CLIENT pick: the real hand WITHOUT the card
     *  staged in the play composer (it is being played — visually lifted out)
     *  and without SRR-hosted cards (they are not "in hand" for the prompt). */
    handPickHandNames(): ReadonlyArray<string> {
      return this.handEntriesAll
        .filter((e) => !e.robot && e.card.name !== this.stagedHandCard)
        .map((e) => e.card.name);
    },
    /** The candidate (pickable) card names of the current hand-select. */
    handSelectSelectableNames(): ReadonlyArray<string> {
      return this.handSelectDerived?.selectable ?? [];
    },
    /** The prompt is a CONDITIONAL subset of the hand (there ARE non-pickable
     *  hand cards) — only then is the "suitable only" filter meaningful. */
    handSelectFiltered(): boolean {
      return this.handSelectDerived?.filtered ?? false;
    },
    /** min===max===1 → A submits the focused card in one press (no toggle). */
    handSelectSingle(): boolean {
      return this.handSelectDerived?.single ?? false;
    },
    /** The CARD that sent the player to this pick, when there is one — the
     *  source of a contextual selection flow (a decision screen's hand pick, a
     *  composer's target pick). Drives the L3 verb and its command hint. */
    contextualSourceCard(): CardName | undefined {
      // A colony step OWED BY A CARD (played card / activation / prelude):
      // the pick and its follow-up present inside that card's workspace, so
      // L3 = the source — the console-wide inspection grammar (X inspects
      // the current object, L3 the card that produced it). Standalone
      // colonies (the player walked in) have no source and no L3.
      if (workspaceFrameHost('colonies') !== undefined) {
        return this.colonyEmbedSourceCard;
      }
      if (this.consoleState.section !== 'hand') {
        return undefined;
      }
      // The CLIENT bridge: a decision screen / composer sent the player here.
      if (this.handPickActive) {
        return consoleHandPickState.request?.source?.card;
      }
      // The SERVER's own MANDATORY hand pick (a discard / reveal / place a card
      // demanded by an effect). The prompt names its source structurally
      // (`discardPrompt.source` / `choiceContext`) and the footer below already
      // advertised «L3 Источник» for this branch — but the two flags are
      // mutually exclusive, so it could never resolve a card and the verb was
      // unreachable. This is the ONE prompt family that most needs it: the
      // player is being made to throw a card away by something they may not
      // have played themselves.
      if (this.handSelectTaskActive) {
        return this.activeTaskSummary?.sourceCard;
      }
      return undefined;
    },
    /** Per-card reason (pre-translated) for a NON-selectable hand card. */
    handSelectReasons(): Record<string, string> {
      return this.handSelectDerived?.reasons ?? {};
    },
    /**
     * ── THE ONE DISCARD ENTRY POINT ──────────────────────────────────────
     * The server marks EVERY "throw cards away" prompt structurally
     * (`discardPrompt`), and both surfaces that can serve the pick — the
     * mandatory `handSelect` task and the client hand-pick bridge (a discard
     * nested in an OrOptions branch, e.g. Mars University) — feed that SAME
     * marker into one derivation. Copy, verb, accent and the leaving
     * animation therefore cannot diverge between cases; there is no
     * per-card discard flow left to keep in sync.
     */
    discardMeta(): DiscardPromptMeta | undefined {
      if (this.handPickActive) {
        return consoleHandPickState.request?.discard;
      }
      const live = discardMetaOf(this.handSelectModel);
      // A CLIENT bridge pick resets itself the moment it resolves, but the
      // cinematic has not seized the card yet — keep the surface exactly as the
      // player left it until it hands off (see `discardFreeze`).
      return live ?? (this.cardDiscardHolds ? this.discardFreeze?.discard : undefined);
    },
    /** The presentation of the active discard (undefined = not a discard). */
    discardIntent(): DiscardIntent | undefined {
      const meta = this.discardMeta;
      return meta === undefined ? undefined : deriveDiscardIntent(meta, this.handSelectPicked.length);
    },
    /** The bundled select-mode state handed to the hand section (undefined when
     *  not in a hand-select). */
    handSelectProps(): ConsoleHandSelectMode | undefined {
      const d = this.handSelectDerived;
      if (d === undefined) {
        // Frozen discard surface (see `discardFreeze`): the answer is delivered
        // and the bridge is gone, but the card is still being lifted out of
        // this very grid. Reverting to browse mode here would flash tag filters
        // and an unrelated «Нельзя разыграть» verdict under the flying card.
        return this.cardDiscardHolds ? this.discardFreeze : undefined;
      }
      const pick = this.handPickActive ? consoleHandPickState.request : undefined;
      const gain = pick?.gainPerCard;
      return {
        active: true,
        selectable: d.selectable,
        // Spread so the computed re-runs (and hands the section a fresh prop)
        // on every pick mutation — the section re-renders the pick bands.
        selected: [...this.handSelectPicked],
        reasons: d.reasons,
        single: d.single,
        filtered: d.filtered,
        suitableOnly: this.handSelectSuitableOnly,
        // The honest «из Y» for the pick's shown-hand universe (the section's
        // own total would count the staged / SRR-hosted cards the pick hides).
        total: pick !== undefined ? this.handPickHandNames.length : undefined,
        // Live payout summary (Public Plans: +1 M€ per revealed card).
        payout: gain !== undefined ? {
          icon: gain.icon,
          amount: gain.amount,
          current: (this.thisPlayer as unknown as Record<string, number>)[gain.icon],
        } : undefined,
        // The source-operation chip (a composer's target pick names WHY).
        context: pick?.source !== undefined ? {kicker: pick.source.kicker, card: pick.source.card} : undefined,
        // THE DISCARD SKIN. Derived from the ONE server marker, whichever
        // source is serving the pick — so Mars University, a Pluto colony
        // bonus and a global event all read the same.
        discard: this.discardIntent,
      };
    },
    /** A hand-served shell task (play-from-hand OR mandatory hand-select) — the
     *  hand section is the surface, so the right stick may scroll the grid. */
    handShellServed(): boolean {
      const t = this.shellTask;
      return t?.kind === 'handSelect' ||
        (t?.kind === 'projectCard' && t.mode === 'playFromHand');
    },
    /** The current multi-select picks satisfy the prompt bounds → RT confirms. */
    handSelectPicksValid(): boolean {
      const pick = consoleHandPickState.request;
      if (this.handPickActive && pick !== undefined) {
        return handSelectPicksValid(pick, consoleHandPickState.selected.length);
      }
      const model = this.handSelectModel;
      return model !== undefined && handSelectPicksValid(model, this.consoleState.select.selected.length);
    },
    // The tag-filter options for the panel (All + tags present in the hand).
    handTagFilterOptions(): Array<ConsoleTagFilterOption> {
      return buildConsoleTagFilters(this.handEntriesAll.map((e) => e.card), this.consoleState.handTagFilter);
    },
    // In sale mode every NON-hosted hand card is sellable (SRR-hosted cards
    // can't be sold) — the target set for L3 select-all / unselect-all.
    saleSellableNames(): ReadonlyArray<string> {
      return this.handEntries.filter((e) => !e.robot).map((e) => e.card.name);
    },
    saleAllSelected(): boolean {
      const names = this.saleSellableNames;
      return names.length > 0 && names.every((n) => this.consoleState.sale.selected.includes(n));
    },
    /** The turn/phase reason (i18n key) shown for a hand card that is rules-OK
     *  but not playable in this window — the honest alternative to a bare block
     *  when the server has no rules-reason (opponent's turn / mid-placement). */
    handSoftReason(): string {
      // On the viewer's OWN turn a card that isn't playable now is blocked by a
      // pending decision (a mandatory corp/forced prompt, a placement, a mid-sub
      // action) — «Сначала завершите текущее действие», NOT «Сейчас не ваш ход»
      // (which is only true when it is genuinely an opponent's turn).
      return this.actionBlockedReason !== '' || this.awaitingInput ?
        'Finish your current action first' : 'Not your turn to take any actions';
    },
    /** The play WINDOW is closed — no live play offer, or a decision is
     *  already owed. THE discriminator for whether the turn note joins a
     *  card's availability view (hand verdict bar + fullscreen panel read
     *  the same flag, so their reason lists match row for row). */
    handTurnWindowClosed(): boolean {
      return this.playAction === undefined || this.actionBlockedReason !== '';
    },
    /** True when the hand grid is the surface the right stick should scroll —
     *  in the hand section with nothing layered on top (a play-confirm / task /
     *  reveal / fullscreen zoom would otherwise get scrolled through blindly). */
    handScrollActive(): boolean {
      return this.consoleState.section === 'hand' &&
        !isHandRevealEpisodeRunning() && // flight targets pin the layout
        // A hidden play composer under a live client hand pick doesn't block —
        // the hand grid IS the active surface for the pick's lifetime.
        (this.pendingPlayCard === undefined || this.handPickActive) &&
        this.hostTask === undefined &&
        // A hand-served shell task (play-from-hand / mandatory hand-select)
        // keeps the grid scrollable; any OTHER shell task means the hand is
        // not the focus surface.
        (this.shellTask === undefined || this.handShellServed) &&
        !this.startSceneServes &&
        this.consoleRevealMode === undefined;
    },
    // ── banner ──────────────────────────────────────────────────────────
    // P27: MANDATORY / critical states ONLY. The plain "your turn" reads
    // from the viewer's own top chip — the centre stays clear for the board.
    bannerText(): string {
      if (this.placementActive) {
        // P20: the inspect-all toggle owns the prompt while active.
        return translateText(this.consoleState.freeRoam ? 'Inspecting all cells' : 'Choose a location on the board');
      }
      if (this.consoleState.fallbackActive) {
        // A demoted premium/desktop scope owns the screen. It used to read a
        // flat «Ожидает решения» — but the prompt behind it is classified, and
        // the marked ones (Venus bonus / spend heat) are precisely the shapes
        // no console surface serves. Name the ask; fall back only when the
        // scope is a lifecycle flow with no pending prompt of its own.
        return this.deferAsk !== '' ? this.deferAsk : translateText('Awaiting decision');
      }
      // A shell-section task (play-from-hand / std project / colony pick):
      // the banner means «what you owe is NOT on the screen you are looking
      // at». It is therefore gated on the player being AWAY from the task's
      // own surface — never on the task merely existing.
      //
      // ⚠️ `shellTaskActive` alone is «the task exists AND is not deferred»,
      // i.e. its surface is OPEN — so keying the banner on it showed the chip
      // exactly when it was pointless and hid it the moment it would have
      // helped. Over an open workspace it is not information but a SECOND
      // TITLE: it reads as «a prompt has arrived» on top of the very screen
      // that prompt IS (inside the Game Start Workspace it landed straight
      // across the breadcrumb tail).
      //
      // The MINIMIZED case is deliberately NOT here either: a deferred task is
      // served by the unified mandatory card (`.con-mandatory`), whose CTA
      // relabels itself «Открыть» / «Вернуться к решению». One state, one
      // voice — the banner is only for «live, un-deferred, and you are
      // elsewhere» (a task admitted while a sheet / the journal / another
      // section still owns the screen).
      if (this.shellTaskActive && !this.shellTaskOnSurface) {
        return this.deferAsk;
      }
      return '';
    },
    confirmTitle(): string {
      return this.consoleState.confirm === 'pass' ? 'Pass for this generation' : 'Convert heat';
    },
    confirmBody(): string {
      return this.consoleState.confirm === 'pass' ?
        'You will take no more actions this generation.' :
        'The temperature is already at its maximum.';
    },
    /** T7 info parity: the desktop PassConfirmContent warning set. */
    confirmWarnings(): Array<string> {
      if (this.consoleState.confirm !== 'pass') {
        return [];
      }
      const warnings: Array<string> = [];
      const unused = this.actionsAvailableCount;
      if (unused > 0) {
        warnings.push(`${translateText('You still have unused available actions')}: ${unused}`);
      }
      if (this.tradeColonyContext !== undefined) {
        warnings.push(translateText('You still have a free trade fleet and can afford a colony trade'));
      }
      if (findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true) !== undefined) {
        warnings.push(translateText('You can still convert plants into greenery'));
      }
      if (findConvertHeatOption(this.playerView.waitingFor) !== undefined) {
        warnings.push(translateText('You can still convert heat into temperature'));
      }
      if (this.hydroActionAvailable) {
        warnings.push(translateText('You can still advance the Hydronetwork this generation'));
      }
      return warnings;
    },
    // ── colonies / hydro ───────────────────────────────────────────────
    tradeColonyContext() {
      return findTradeColonyContext(this.playerView.waitingFor);
    },
    tradeableColonyNames(): ReadonlyArray<string> {
      return this.tradeColonyContext?.colonies ?? [];
    },
    /** The viewer's FREE trade fleets (mirrors ConsoleColoniesSection.freeFleetsFor:
     *  the MORE restrictive of used-trade-fleets and physically-deployed). */
    viewerFreeFleets(): number {
      const deployed = this.game.colonies.filter((c) => c.visitor === this.thisPlayer.color).length;
      return Math.min(freeTradeFleets(this.thisPlayer), Math.max(0, this.thisPlayer.fleetSize - deployed));
    },
    /**
     * The REAL «why can't I trade at the FOCUSED colony» reason, via the shared
     * smart ladder (colony-intrinsic → no fleet → can't afford → turn). Returns a
     * TRANSLATED string (the one params case — another player's docked fleet —
     * needs substitution); consumers `$t()` it, which is a safe passthrough for an
     * already-translated string. '' when the colony IS tradeable (no blocker).
     */
    colonyTradeBlockReason(): string {
      const selected = this.game.colonies[this.consoleState.colonyIndex];
      if (selected === undefined) {
        return translateText(this.awaitingInput ? 'Finish your current action first' : 'Not your turn to take any actions');
      }
      const reason = colonyTradeReason({
        colony: selected,
        tradeable: this.tradeableColonyNames,
        viewerColor: this.thisPlayer.color,
        availableFleets: this.viewerFreeFleets,
        myTurn: this.myTurn,
        awaitingInput: this.awaitingInput,
        resolveName: (color) => displayNameForColor(this.playerView.players, color),
      });
      if (reason === undefined) {
        return '';
      }
      return reason.params !== undefined ?
        translateTextWithParams(reason.key, reason.params.map(String)) :
        translateText(reason.key);
    },
    /** The colony the JOURNAL dossier shows (X on a journal colony row —
     *  read-only, pinned to its one colony, only B closes). The colonies
     *  SECTION's own inspect verb descends into the COLONY FOCUS STAGE
     *  instead — it never opens this overlay. */
    colonyInspectModel(): ColonyModel | undefined {
      if (this.journalColonyInspect === undefined) {
        return undefined;
      }
      return this.game.colonies.find((c) => c.name === this.journalColonyInspect);
    },
    /** The colony workspace's FOCUS STAGE is open (browse grid parked) —
     *  standalone section AND embedded step alike. */
    colonyFocusOpen(): boolean {
      return workspaceFrameMounted('colonies') && this.colonyFocus.open;
    },
    /** The descended-into colony is live-tradeable (the stage's CTA verbs). */
    colonyFocusTradeable(): boolean {
      return this.colonyFocus.colonyName !== '' && this.colonyPick === undefined &&
        this.tradeableColonyNames.includes(this.colonyFocus.colonyName);
    },
    /**
     * A payout batch of the LIVE trade transaction is waiting to be presented
     * — the signal the colonies section must be on screen for (the covers
     * launch from the traded tile; the reveal lands in the section's embed
     * zone). Between two Pluto colony bonuses the discard runs on the HAND
     * (select mode), and the next payout is what brings the player home.
     */
    tradePayoutIncoming(): boolean {
      return this.colonyTradeState.active &&
        colonyTradeClaimsReveal(currentRevealEvent()?.source);
    },
    /**
     * A COLONY payout of ANY origin is arriving for a claim we hold. The
     * trade-only predicate above cannot see a BUILD's draw: the server
     * deliberately leaves `benefit === 'build'` un-tagged (`Colony.tradeRevealTag`),
     * so `source.trade` is undefined and no trade transaction is armed. Keyed
     * on the CLAIM instead — the one fact that says «this flow is still ours».
     */
    colonyPayoutIncoming(): boolean {
      return this.rawDrawnRevealPending &&
        workspaceClaimsColonyReveal(currentRevealEvent()?.source);
    },
    // ── THE COLONY RESOLUTION (colonyResolution.ts) — the Pluto flow's ONE
    //    lifecycle. Every signal is authoritative: the server's discard marker,
    //    the reveal batch's own source, the trade transaction that concludes
    //    only on the committed track reset, the running discard scene. ──────
    colonyResolutionSignals(): ColonyResolutionSignals {
      return {
        discardMeta: colonyBonusDiscardOf(this.playerView.waitingFor),
        collectMeta: colonyBonusCollectOf(this.playerView.waitingFor),
        revealSource: currentRevealEvent()?.source,
        tradeActive: this.colonyTradeState.active,
        tradeColony: this.colonyTradeState.colonyName,
        cardPickColony: this.colonyBonusCardPick?.colonyName ?? '',
        discardFlightMeta: cardDiscardColonyBonus(),
        entryColony: this.bonusEntry.colonyName,
        entryAwaiting: this.bonusEntry.awaiting,
        claimedByColonies: workspaceOutcomeState.host === 'colonies',
      };
    },
    /**
     * THE THIRD SHAPE OF AN OWNER BONUS: one the viewer has to PLACE (Enceladus'
     * microbes, Titan's floaters). Structural — the server's own
     * `choiceContext.source` names the colony that is paying.
     */
    colonyBonusCardPick(): {colonyName: string} | undefined {
      return colonyBonusCardPickOf(this.playerView.waitingFor);
    },
    /** The armed entry is still waiting for its payout (its bounded net rides
     *  this — a computed rather than a path watcher, which is the form module
     *  reactive state is read in here). */
    colonyEntryAwaiting(): boolean {
      return this.bonusEntry.awaiting;
    },
    /**
     * THE AUTHORITATIVE HALF of the gate (`colonyResolutionEvidenceFor`): what
     * the SERVER — or a beat already physically in flight — says is owed, with
     * the client-armed entry left out. Its rising edge ENDS the entry's wait:
     * from then on the resolution stands on its own evidence, so the entry can
     * never outlive it (the latch that froze the whole colony subsystem).
     */
    colonyResolutionEvidence(): boolean {
      return colonyResolutionEvidenceFor(this.colonyResolutionSignals);
    },
    /**
     * THE PLUTO CLOSE GATE: while true, the colony workspace is the flow's one
     * interaction owner — it may collapse (the decision stays live) but never
     * unmount, and no reveal / discard of this resolution may open a second
     * root beside it. An empty reveal between two bonus cycles, a pending
     * discard whose batch was fully taken, the closing track glide — each
     * keeps exactly one term true until the next takes over.
     */
    colonyResolutionLive(): boolean {
      return colonyResolutionLiveFor(this.colonyResolutionSignals);
    },
    /**
     * A colony-bonus COLLECT the workspace may answer BY ITSELF — the next
     * cube of a multi-settlement payout, arriving while the viewer already
     * stands on that colony's bonus stage with nothing on its table. '' = no
     * such delivery (it goes through the announcement instead). The value is
     * the cube's structural key, which is also the one-shot dedupe.
     */
    colonyBonusAutoCollect(): string {
      const collect = colonyBonusCollectOf(this.playerView.waitingFor);
      if (collect === undefined ||
          this.bonusEntry.colonyName !== collect.colonyName ||
          !workspaceFrameMounted('colonies') ||
          currentRevealEvent() !== undefined) {
        return '';
      }
      return `${collect.colonyName}#${collect.index}/${collect.total}`;
    },
    /** The colony this resolution belongs to ('' when nothing is owed). */
    colonyResolutionColonyName(): string {
      return colonyResolutionColony(this.colonyResolutionSignals);
    },
    /**
     * A FOREIGN trade's owner bonus is waiting for its ENTRY: the batch/discard
     * exist, the viewer neither traded nor entered yet. While this holds the
     * presentation is parked behind the mandatory announcement — the plate
     * blinks, nothing force-opens, and the announce's press is the one door.
     */
    remoteColonyBonusPending(): {colonyName: string} | undefined {
      return remoteColonyBonusPendingFor(this.colonyResolutionSignals);
    },
    // ── THE COLONY EMBED — SelectColony inside a live workspace flow ──────
    /** A SelectColony prompt stands, structurally (no admission gating — the
     *  latch must land before any surface routing runs). */
    colonyPromptRaw(): boolean {
      return this.playerView.waitingFor?.type === 'colony';
    },
    /**
     * …AND THE SURFACE MAY OPEN FOR IT NOW — the colony workspace's own DOOR.
     *
     * The prompt above is the structural latch; this is the admission. It was
     * the ONE prompt-routed door that never asked (`waitingFor.type === 'colony'`
     * raw, straight into `pushWorkspaceFrame`), and that is the whole of the
     * reported bug: «Научная колония» draws 2 cards AND builds a colony in one
     * response, so the grid stood up on the raw prompt while the drawn batch
     * assembled on top of it — two live decision surfaces from one press, the
     * lower one unreachable. Worse, both teleport into the SAME zone, so the
     * grid was laid out beside whatever still occupied it (the landing tableau,
     * then the reveal) and re-solved its fit when that left: measured 521 px of
     * a 1621 px band, then a jump to full width — «сначала половина экрана,
     * криво, потом весь workspace».
     *
     * GATED, NOT DEFERRED: the value is reactive, so the door opens by itself
     * the instant the previous effect has finished being presented (for a draw
     * that is «every card taken and landed» — the `followUp` policy's whole
     * arrival chain). Nothing else changes: the same door, the same host
     * resolution, the same crumb — one beat later.
     */
    colonyPromptOpenable(): boolean {
      return this.colonyPromptRaw && this.admits('followUp');
    },
    /**
     * A STEP THIS FLOW OWES IS NOT ON SCREEN YET — the door above is holding it
     * back while the previous effect of the same press finishes.
     *
     * THE THIRD FORM OF «a host does not fold under what it carries». The first
     * is a step STANDING inside it (`workspaceFrameHasNested`), the second is an
     * outcome still MOVING (`handOutcomeLive`), and this is one still OWED —
     * without it the take folded the hand's descent and concluded its workspace,
     * and the colony grid then opened as a lateral screen: one press, two
     * unrelated places. Read by the conclusion (`owed-step`), by the descent's
     * fold guard and by the crumb, which names the coming step rather than
     * stepping backwards for the gap.
     *
     * `frameServing` covers the PARK too: a chain the player set aside already
     * has a home for this prompt, so nothing is owed.
     */
    followUpStepOwed(): boolean {
      const task = taskFor(this.playerView);
      return task !== undefined && followUpStepStage(task.kind) !== undefined &&
        !this.consoleState.task.deferred && frameServing(task.kind) === undefined &&
        !this.admits('followUp');
    },
    /** The crumb tail an OWED step already carries (see `followUpStepOwed`). */
    followUpStepStageKey(): string {
      return (this.followUpStepOwed ? followUpStepStage(taskFor(this.playerView)?.kind) : undefined) ?? '';
    },
    /**
     * The colony FOLLOW-UP is still running: the prompt itself, the armed
     * fleet flight, the reward transaction, the claimed Pluto payout — or ANY
     * leg of the colony RESOLUTION (a mandatory bonus discard, its physical
     * flight, an armed remote-bonus entry). The colonies FRAME lives exactly
     * as long as this does: the reported «COLONIES → MODAL → HAND» break was
     * this list missing the resolution's middle legs.
     */
    colonyFollowUpLive(): boolean {
      return this.colonyPromptRaw || this.colonyTradeState.active ||
        this.tradeFleetState.active || isColonyBuildActive() ||
        workspaceOutcomeState.host === 'colonies' ||
        this.colonyResolutionLive;
    },
    /**
     * The zone the colonies section is TELEPORTED into — published by the
     * frame BELOW it, whichever workspace that is (the hand's card-play step,
     * the action centre, the start's prelude). ONE lookup instead of a
     * per-host switch: the chain does not care who is hosting whom, only that
     * something is (embed rule 3 — slots compose).
     */
    colonyEmbedTarget(): string | undefined {
      return workspaceFrameTarget('colonies');
    },
    colonyEmbedActive(): boolean {
      return this.colonyEmbedTarget !== undefined;
    },
    /**
     * The CARD whose effect owes this colony step — the L3 «Источник» target
     * (§ inspection grammar: X = the current object, L3 = what produced it).
     * It is the HOST frame's carried object: the hand's card-play step carries
     * the played card, the start's prelude step carries the prelude. The action
     * centre is the one host whose card lives in the outcome CLAIM instead (the
     * composer owns the activation, not the browse frame). '' → no verb, never
     * a broken zoom — a standalone entry has no source by definition.
     */
    colonyEmbedSourceCard(): CardName | undefined {
      const host = workspaceFrameHost('colonies');
      if (host === undefined) {
        return undefined;
      }
      const subject = host === 'card-actions' ?
        workspaceOutcomeState.sourceCard : workspaceFrameSubject(host);
      return subject === '' ? undefined : subject as CardName;
    },
    /**
     * A live SelectColony that NO FRAME serves. The watcher heals it by
     * entering the standalone colonies — a prompt may degrade from embedded to
     * standalone, but it may never strand.
     *
     * The «my host died under me» half of this predicate is GONE: a frame is
     * only ever removed from the top, so a host cannot vanish out from under
     * the step it is carrying. That disagreement between ownership and presence
     * was the soft-lock.
     *
     * It reads the DOOR (`colonyPromptOpenable`), never the raw prompt: a prompt
     * whose door is deliberately held behind a running cinematic is not
     * stranded, it is WAITING — and healing it there would re-open the very
     * overlap the gate exists to remove. The leak detector agrees by
     * construction (`isAnimationHoldActive` early-returns), and the value is
     * reactive, so the heal still fires the moment the chain clears.
     */
    colonyPromptStranded(): boolean {
      return this.colonyPromptOpenable && !this.consoleState.task.deferred &&
        workspaceFrameIndex('colonies') === -1;
    },
    hydroActionAvailable(): boolean {
      return findHydroActionPath(this.playerView.waitingFor) !== undefined;
    },
    /**
     * The delta-preview refetch scope. The preview mirrors state that moves
     * WITHIN a generation (track position / usedThisGeneration / energy /
     * tags), so a generation-only key went STALE the moment the viewer
     * advanced: the screen kept planning from the OLD position, and — since
     * the stale preview still claimed `usedThisGeneration: false` — the honest
     * «уже укрепляли в этом поколении» gate never fired and the screen blamed
     * «Сейчас не ваш ход» on a live turn. `gameAge` bumps on every logged
     * change and `undoCount` covers a rewind: together they are the honest
     * "the preview may have moved" signal (same reasoning as the effects
     * overlay's within-generation refetch).
     */
    hydroCacheKey(): string {
      return `${this.game.generation}:${this.game.gameAge}:${this.game.undoCount}`;
    },
    // ── the console-native journal (View — board home only) ────────────
    /** The journal surface renders (it replaces the right info panel). */
    journalPanelVisible(): boolean {
      return journalState.open && this.consoleState.section === 'board';
    },
    /**
     * A surface that NEEDS the pad / the board arrived — the journal yields
     * (placement, an active task / start scene / reveal). A DEFERRED task
     * (amber chip) leaves the player free, so the journal stays available.
     */
    journalHardBlocked(): boolean {
      return this.placementActive ||
        this.consoleRevealMode !== undefined ||
        (this.startSceneServes && !this.consoleState.task.deferred) ||
        (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined) ||
        this.shellTaskActive ||
        // …and the DEDICATED COMPOSITES, which own the pad exactly like the host
        // (their branches sit ABOVE it in the routing chain). Left out, the
        // journal stayed open over «Разместите бонус шкалы Венеры» and kept the
        // pad it needs.
        this.compositeSurfaceActive;
    },
    /** VP visibility for the player viewed in Information Mode. */
    infoVpVisible(): boolean {
      const color = infoModeState.playerColor;
      return color === this.thisPlayer.color || this.game.gameOptions.showOtherPlayersVP === true;
    },
    /**
     * The INSPECTED player of the Information Workspace — a VIEW-ONLY
     * context (never the acting/local player; gameplay code must never read
     * it). One source: infoModeState.playerColor; a vanished color (player
     * left / stale state) degrades to the viewer's own seat.
     */
    inspectedPlayer(): PublicPlayerModel {
      const color = this.infoModeState.playerColor;
      return this.playerView.players.find((p) => p.color === color) ?? this.thisPlayer;
    },
    /**
     * The seat the LEFT RAIL displays: the inspected player while the
     * Information Workspace is open, the viewer's own seat otherwise. The
     * flip is ATOMIC with `open` — closing restores the own context in the
     * same render pass (no flash of the previously inspected player).
     */
    railPlayer(): PublicPlayerModel {
      return this.infoModeState.open ? this.inspectedPlayer : this.thisPlayer;
    },
    railShowsSelf(): boolean {
      return this.railPlayer.color === this.thisPlayer.color;
    },
    /**
     * The rail displays the MARSBOT seat (only possible while the workspace
     * inspects it) — hand it the public Automa state so the rail swaps to
     * the dedicated bot presentation (real economy + printed tracks).
     */
    railAutoma(): MarsBotModel | undefined {
      return this.infoModeState.open && this.railPlayer.isMarsBot === true ?
        this.playerView.game.automa : undefined;
    },
    /** The game rule hides opponents' scores → the rail masks the VP cell
     *  while an opponent is inspected (same gate as the panel's vpVisible). */
    railVpHidden(): boolean {
      return !this.railShowsSelf && this.game.gameOptions.showOtherPlayersVP !== true;
    },
    /** `--info` must persist through the CLOSING transition — see the
     *  template note and infoModeState.closing. */
    infoWorkspaceUp(): boolean {
      return this.infoModeState.open || this.infoModeState.closing;
    },
    /**
     * A WORKSPACE SCREEN (or a right-edge drawer) is up, so the RIGHT RAIL is
     * being REPLACED rather than covered: it stops being drawn and the opening
     * extends over its zone (`.con-root--rail-replaced` in console.less).
     *
     * A compact DIALOG is deliberately NOT here — it stands inside the opening
     * and the trophy gallery stays lit beside it. That is the whole distinction
     * this class carries: «I am the stage now» versus «I am a decision on it».
     *
     * DERIVED FROM THE STACK, never from a list of surface names: the workspace
     * registry already owns «which surfaces are screens», and a second list is
     * exactly what rots the day a tenth workspace lands. The two additions are
     * the workspace-shaped surfaces that are NOT stack frames — the Information
     * Workspace and the «РАЗЫГРАНО» table — plus the two right-edge drawers,
     * which replace that one member by design.
     */
    workspaceScreenUp(): boolean {
      return this.workspaceStackShown ||
        this.infoWorkspaceUp ||
        this.playedOpen;
    },
    /**
     * PRESENCE, not merely STANDING. A frame earns the stage only while the
     * surface it mounts is actually on screen — «the component is mounted» and
     * «the mode is active» are both weaker claims, and the difference is a
     * whole post-game: the endgame is the ONE frame that hides ITSELF (v-show,
     * so its ceremony survives the round trip) while legitimately staying in
     * the stack, and the right rail followed the frame instead of the surface.
     *
     * Every other workspace's presence IS its frame (invariant 1), so they need
     * no entry here — a hidden-but-standing surface is a property of the
     * endgame's collapse contract, never a general state.
     */
    workspaceStackShown(): boolean {
      return workspaceStackState.frames.some(
        (f) => f.kind !== 'endgame' || this.endgameStageUp);
    },
    conRootClasses(): Record<string, boolean> {
      return {
        'con-root--rail-replaced': this.workspaceScreenUp ||
          this.journalPanelVisible ||
          this.contextOverlayMode !== undefined,
        // Post-game: the gameplay HUD leaves — status strip and player rail
        // fade out (visibility, never display: the boxes must survive), so
        // nothing on the frame can pre-reveal a total mid-ceremony.
        'con-root--endgame': this.endgameStageUp,
        // The DOM-presence flags that used to be `.con-root:has(...)` rules
        // (`.con-ws` / `.con-ws--dockcover` / planet focus). Same semantics —
        // true while a matching element exists, leave transitions included —
        // maintained by conWsPresenceBridge, because a root-anchored `:has()`
        // re-ran a WHOLE-DOCUMENT style recalc per animated frame (measured
        // ~1.2 s per 100-card category flight; ~37 ms with plain classes).
        'con-root--ws-open': this.wsPresence.wsOpen,
        'con-root--ws-dockcover': this.wsPresence.wsDockcover,
        'con-root--pfocus': this.wsPresence.planetFocus,
      };
    },
    conMainClasses(): Record<string, boolean> {
      const classes: Record<string, boolean> = {
        'con-main--journal': this.journalPanelVisible,
        'con-main--hand': this.consoleState.section === 'hand',
        'con-main--info': this.infoWorkspaceUp,
        // (No workspace entry here: every workspace surface carries the
        // `con-ws` marker and `.con-root--ws-open` lifts the rail /
        // drops the stacking trap for the whole family, holding through
        // leave transitions automatically.)
      };
      // The inspected player's ACCENT tokens (--con-insp-accent*) — consumed
      // by the rail ring and the workspace seam. Follows `open` (not the
      // closing tail): the rail returns to its neutral chrome the moment the
      // context comes home; the fading workspace falls back to cyan.
      if (this.infoModeState.open) {
        classes[`con-insp-${this.railPlayer.color}`] = true;
      }
      return classes;
    },
    // ── the RT / LT quick selectors (P27 — direct-input command layers) ──
    quickEntries(): Array<QuickEntry> {
      if (this.consoleState.quick === 'actions') {
        return buildRtQuickEntries({
          cardsPlayable: this.wheelCounts.cards,
          cardsTotal: this.cardsTotalCount,
          actionsAvailable: this.wheelCounts.cardActions,
          tradesAvailable: this.wheelCounts.trade,
          hydroAvailable: this.wheelCounts.hydro,
          hasColonies: this.game.colonies.length > 0,
          hasTurmoil: this.game.gameOptions.expansions.turmoil === true,
          hasHydro: this.game.gameOptions.expansions.deltaProject === true,
        });
      }
      if (this.consoleState.quick === 'basics') {
        const wf = this.playerView.waitingFor;
        return buildLtQuickEntries({
          blockedReason: this.actionBlockedReason,
          myTurn: this.myTurn,
          awaitingInput: this.awaitingInput,
          stdAvailable: this.standardProjectsAction !== undefined,
          endTurnAvailable: findEndTurnPath(wf) !== undefined,
          passAvailable: findPassPath(wf) !== undefined,
          // A card-granted bonus action withholds BOTH turn-control verbs, and
          // says why — the server does not offer them, so without this the
          // wheel would fall back to «сейчас недоступно» over a live menu.
          turnControlReason: bonusActionTurnControlReason(this.playerView),
          convertPlantsAvailable: this.convertPlantsReady,
          convertHeatAvailable: this.convertHeatReady,
          plantsNeeded: this.thisPlayer.plantsNeededForGreenery,
          heatNeeded: this.thisPlayer.heatNeededForTemperature,
        });
      }
      return [];
    },
    quickTitle(): string {
      // «ВЫБЕРИТЕ ДЕЙСТВИЕ», not «ДЕЙСТВИЯ»: the top node is «ДЕЙСТВИЯ КАРТ»
      // and the old kicker duplicated its first word right above it.
      return this.consoleState.quick === 'actions' ? 'Choose an action' : 'Basic actions';
    },
    quickTrigger(): 'triggerR' | 'triggerL' {
      return this.consoleState.quick === 'actions' ? 'triggerR' : 'triggerL';
    },
    /** The premium Standard-Projects screen rows (Patent sale included).
     *  FROZEN for the span of a submit: the live rows derive from `waitingFor`,
     *  which moves on with the response — without the freeze the browse grid
     *  re-renders EMPTY under the flow's own beat (the deck-pick precedent). */
    stdProjectItems(): Array<StdProjectItem> {
      const frozen = stdProjectsFlow.frozenItems;
      if (frozen !== undefined && stdProjectsFlowLive()) {
        return [...frozen];
      }
      return buildStdProjectItems({
        cards: this.standardProjectsAction?.input.cards ?? [],
        blockedReason: this.actionBlockedReason,
        myTurn: this.myTurn,
        awaitingInput: this.awaitingInput,
        myMegacredits: this.thisPlayer.megacredits,
        sellAvailable: findSellPatentsAction(this.playerView.waitingFor) !== undefined,
        cardsInHand: this.cardsTotalCount,
      });
    },
    /**
     * A step of the STD-PROJECTS flow is standing inside the workspace — a
     * nested frame (the colony pick, the sale's hand) or the embedded payment
     * host (which teleports without a frame of its own). The screen's browse
     * layer parks on this; the ONE derivation, so the two can never disagree.
     */
    stdpStepUp(): boolean {
      if (!workspaceFrameMounted('standard-projects')) {
        return false;
      }
      return workspaceFrameHasNested('standard-projects') ||
        this.pendingClientPayment !== undefined;
    },
    /**
     * The SPATIAL PRE-SELECT hint (§9): while the player browses the std
     * projects, the HUD readout the FOCUSED project would move carries a
     * quiet ring. Browse only (never during a beat), and never for a maxed
     * parameter — the honest chip already says «no effect», and ringing a
     * dial that will not move would be the lie the preview rules forbid.
     */
    /**
     * THE FACTS A CONCLUSION IS MADE OF, as one value to watch.
     *
     * A committed std-projects flow ends when its STEP lets go — and a step
     * unmounts on its own schedule (the colony's payout settles a second
     * after the server has moved on), so the response watcher is NOT enough:
     * the parent list stood on screen, committed and empty, for as long as
     * nothing else happened. Watching the ingredients means the ending is
     * re-asked exactly when one of them changes, and `concludeWorkspaceFlow`
     * stays the ONE place that decides.
     */
    stdpConclusionSignal(): string {
      if (!workspaceFrameKnown('standard-projects')) {
        return '';
      }
      const task = taskFor(this.playerView);
      return [
        workspaceFramePhase('standard-projects') ?? '',
        workspaceFrameHasNested('standard-projects') ? 'nested' : '',
        // (This workspace claims no outcome of its own — a std project's own
        // artifacts belong to the STEP that produced them, whose claim is
        // covered by `nested` + the colony resolution below.)
        workspaceOutcomeState.stage,
        task?.kind ?? '',
        workspaceFrameParked('standard-projects') ? 'parked' : '',
        this.colonyResolutionLive ? 'colony-resolution' : '',
        this.placementActive ? 'placement' : '',
      ].join('|');
    },
    stdpGhostParam(): 'temperature' | 'oxygen' | 'oceans' | 'venus' | undefined {
      if (!workspaceFrameMounted('standard-projects') || this.stdpStepUp ||
          workspaceFramePhase('standard-projects') !== 'browse') {
        return undefined;
      }
      const focused = this.stdProjectItems[this.consoleState.sheetIndex];
      for (const e of focused?.preview?.effects ?? []) {
        if ((e.icon === 'temperature' || e.icon === 'oxygen' || e.icon === 'venus' || e.icon === 'oceans') &&
            e.current !== e.resulting) {
          return e.icon as 'temperature' | 'oxygen' | 'oceans' | 'venus';
        }
      }
      return undefined;
    },
    /** B on the MANDATORY std-project prompt minimizes (amber chip), else closes. */
    stdBackLabel(): string {
      return this.shellTask?.kind === 'projectCard' && this.shellTask.mode === 'standardProject' ?
        'Minimize' : 'Close';
    },
    // ── sheets ──────────────────────────────────────────────────────────
    sheetTitle(): string {
      switch (this.consoleState.sheet) {
      case 'cardActions': return 'Card actions';
      case 'milestones': return 'Milestones';
      case 'awards': return 'Awards';
      case 'standardProjects': return 'Standard Projects';
      default: return '';
      }
    },
    /** P26: milestones/awards render on the dedicated premium screen. */
    maScreenKind(): ConsoleMaKind | undefined {
      return this.consoleState.sheet === 'milestones' || this.consoleState.sheet === 'awards' ?
        this.consoleState.sheet : undefined;
    },
    /** The premium screen's items — PURE derivation (consoleMaModel). */
    maScreenItems(): Array<ConsoleMaItem> {
      const kind = this.maScreenKind;
      if (kind === undefined) {
        return [];
      }
      const found = kind === 'milestones' ?
        findMilestoneOptionPath(this.playerView.waitingFor) :
        findAwardOptionPath(this.playerView.waitingFor, this.awardNames);
      const describe = (name: string): string => {
        try {
          return kind === 'milestones' ?
            getMilestone(name as MilestoneName).description :
            getAward(name as AwardName).description;
        } catch (err) {
          return '';
        }
      };
      return buildConsoleMaItems(kind, kind === 'milestones' ? this.game.milestones : this.game.awards, {
        myColor: this.thisPlayer.color,
        blockedReason: this.awardFundingActive ? '' : this.actionBlockedReason,
        myTurn: this.myTurn,
        awaitingInput: this.awaitingInput,
        myMegacredits: this.thisPlayer.megacredits,
        availableNow: this.claimableTitles(found?.options),
        describe,
        maxSlots: 3,
        // Free sponsorship (Vitor) costs 0 — the price chip then reads «Бесплатно».
        nextCost: kind === 'milestones' ? this.milestoneCostValue :
          (this.awardFundingActive ? 0 : this.awardCostValue),
        // Claimant label resolves the MarsBot seat to «Бот», never the raw name.
        resolveName: (color) => displayNameForColor(this.playerView.players, color),
      });
    },
    /**
     * THE LIVE PRICES — the engine's own `milestoneCost()` / `awardFundingCost()`,
     * published on the player view (`maCosts`). Every rule that moves them is
     * already applied there: Van Allen / Nirgal Enterprises make them free,
     * Staged Protests adds 8, and the award price climbs 8 → 14 → 20 with each
     * funding. The UI must never re-derive it from constants — it would keep
     * offering a number the server refuses (and the ladder is only a default
     * for a model that predates the field).
     */
    milestoneCostValue(): number {
      return this.playerView.maCosts?.milestone ?? MILESTONE_COST;
    },
    awardCostValue(): number {
      const funded = this.game.awards.filter((a) => a.playerName !== undefined && a.playerName !== '').length;
      return this.playerView.maCosts?.award ?? (AWARD_COSTS[funded] ?? AWARD_COSTS[AWARD_COSTS.length - 1]);
    },
    /** The FREE award-funding prompt (Vitor's start action) is the pending
     *  shell task — the premium awards MA screen hosts it (desktop parity:
     *  the AwardsOverlay's free-sponsorship mode), never the generic list. */
    awardFundingActive(): boolean {
      return this.shellTask?.kind === 'awardFunding';
    },
    /** The descended MA item (undefined = the detail stage is closed). */
    maFocusItem(): ConsoleMaItem | undefined {
      if (!maFocusState.open || this.maScreenKind === undefined) {
        return undefined;
      }
      return this.maScreenItems.find((it) => it.name === maFocusState.name);
    },
    /** The detail stage's economy/slots view — REBUILT from the live
     *  playerView on every commit, so a slot raced away while the stage is
     *  open honestly re-renders as blocked (never a dead submit). */
    maFocusView(): MaConfirmView | undefined {
      if (!maFocusState.open) {
        return undefined;
      }
      const kind = maFocusState.kind;
      const models = kind === 'milestone' ? this.game.milestones : this.game.awards;
      const source = models.find((m) => m.name === maFocusState.name);
      if (source === undefined) {
        return undefined;
      }
      const describe = (name: string): string => {
        try {
          return kind === 'milestone' ?
            getMilestone(name as MilestoneName).description :
            getAward(name as AwardName).description;
        } catch (err) {
          return '';
        }
      };
      const free = kind === 'award' && this.awardFundingActive;
      return buildMaConfirm(kind, source, models, {
        myColor: this.thisPlayer.color,
        myMegacredits: this.thisPlayer.megacredits,
        cost: kind === 'milestone' ? this.milestoneCostValue : (free ? 0 : this.awardCostValue),
        free, // Vitor's free sponsorship — the stage shows the free chip.
        maxSlots: 3,
        playerName: (c) => {
          const pl = this.playerView.players.find((candidate) => candidate.color === c);
          return pl !== undefined ? participantDisplayName(pl) : c;
        },
        describe,
      });
    },
    /** The detail stage's ranked race/standings (the inspect view-model). */
    maFocusInspect(): MaInspectView | undefined {
      const item = this.maFocusItem;
      if (item === undefined) {
        return undefined;
      }
      // Resolve every participant label through the ONE display-name helper
      // (a MarsBot reads «Бот» in the standings, never a raw «MarsBot»).
      return buildMaInspect(item, this.playerView.players.map((p) => ({...p, name: participantDisplayName(p)})));
    },
    /** LIVE availability for the open detail stage (waitingFor = the truth). */
    maFocusAvailable(): boolean {
      if (!maFocusState.open) {
        return false;
      }
      const found = maFocusState.kind === 'milestone' ?
        findMilestoneOptionPath(this.playerView.waitingFor) :
        findAwardOptionPath(this.playerView.waitingFor, this.awardNames);
      return this.claimableTitles(found?.options).has(maFocusState.name);
    },
    /** The CONCRETE blocker when the open detail stage cannot act. */
    maFocusBlockReason(): string {
      if (this.maFocusAvailable) {
        return '';
      }
      const v = this.maFocusView;
      if (v?.takenByOther !== undefined) {
        return v.kind === 'milestone' ? 'Already claimed' : 'Already funded';
      }
      // The shared turn ladder — «завершите действие» only while the free action
      // menu is actually withheld. The old tail returned it unconditionally, so
      // a player whose menu WAS live got told to finish an action they weren't in.
      if (!this.myTurn) {
        return offTurnReason(this.awaitingInput);
      }
      if (v !== undefined && !v.free && this.thisPlayer.megacredits < v.cost) {
        return 'Not enough M€';
      }
      return v?.kind === 'milestone' ?
        'This milestone cannot be claimed right now' :
        'This award cannot be funded right now';
    },
    /** The ceremony queue head — the commit watcher's reactive mirror. */
    maCurrentBeat(): MaCeremonyEvent | undefined {
      return maCeremonyState.current;
    },
    sheetRows(): Array<ConsoleSheetRow> {
      return [];
    },
    // ── the command bar (the truth of the current context) ─────────────
    commandContext(): string {
      // «Разбор хода» review owns the screen — the bar reads as the review.
      if (this.botTurnReviewState.open) {
        return 'Turn review';
      }
      // Scale-focus hold: the modal is briefly gone while the board scale
      // animates — read as the board, not the (hidden) upcoming modal.
      if (this.govScaleFocusState.holding || this.govScaleFocusState.closing) {
        return 'Board';
      }
      if (this.consoleState.fallbackActive) {
        // Lifecycle-aware naming: the wrapped premium flows read as PART of
        // the console experience, not a generic "waiting" veil.
        switch (this.consoleState.fallbackScopeId) {
        case 'startGameFlow': return 'Start of the game';
        case 'endgame': return 'Game results';
        case 'drawReveal': return 'Cards';
        case 'dialog': return 'Card details';
        case 'colonies': return 'Trading';
        // An un-named scope = the desktop modal serving a prompt the console
        // has no surface for. The classification still names it (Venus bonus,
        // spend heat, an out-of-scope guard) — only a scope with NO prompt at
        // all falls through to the honest generic.
        default: return this.activeTaskSummary?.kickerKey ?? 'Awaiting decision';
        }
      }
      if (this.endgameWorkspaceMounted) {
        // The scene's own header already reads «ФИНАЛЬНЫЙ ПОДСЧЁТ» /
        // «ИТОГИ ПАРТИИ» — repeating it in the bar is noise. While the
        // scene is COLLAPSED (the board inspection) the bar names where
        // the B verb leads back to.
        return this.endgameCollapsed ? 'Game results' : '';
      }
      if (this.infoModeState.open) {
        return 'Information';
      }
      if (this.draftWaitActive) {
        return 'Waiting for draft cards';
      }
      if (this.consoleRevealMode !== undefined) {
        // EMBEDDED drawn batch: the kicker mirrors the workspace STAGE
        // («ДОБОР КАРТ») — never a generic «КАРТЫ» beside a breadcrumb that
        // already names the stage. One voice, two places (the buy stage's
        // «ПОКУПКА» parity).
        if (this.revealEmbedTarget !== undefined) {
          return workspaceOutcomeState.phaseKey !== '' ? workspaceOutcomeState.phaseKey : focusKicker('draw');
        }
        return 'Cards';
      }
      if (this.startSceneServes && !this.consoleState.task.deferred && !this.placementActive) {
        // The scene's own header already reads «СТАРТ ПАРТИИ» (kicker +
        // title) — repeating it in the bar is noise. The bar carries ONLY
        // the physical commands during the initial setup.
        // …unless the workspace has YIELDED to a board placement: the scene
        // paints nothing then, so an empty context would leave the placement
        // unnamed — it falls through to the placement kicker below.
        return '';
      }
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        return 'Government Support';
      }
      if (this.effectDecisionActive) {
        // EMBEDDED: the bar names the STAGE the crumb above already names —
        // one voice in two places, exactly as the embedded reveal does. The
        // standalone band has no crumb, so there it names the KIND of decision.
        return this.effectDecisionEmbedTarget !== undefined ?
          (this.effectDecisionVm?.stageKey ?? 'Awaiting decision') :
          (this.effectDecisionVm?.eyebrowKey ?? 'Awaiting decision');
      }
      if (this.finalGreeneryActive) {
        return FINAL_GREENERY_EYEBROW;
      }
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined && !this.handPickActive) {
        // The bar names the KIND of decision the host is serving ("ОПЛАТА" /
        // "ДРАФТ"), not a generic "awaiting" — the host's own header carries
        // the full ask right under it.
        return this.activeTaskSummary?.kickerKey ?? 'Awaiting decision';
      }
      if (this.handPickActive) {
        // A composer's card pick is out on the hand — the bar names the pick.
        return 'Card selection';
      }
      // ...and the REPEAT-ACTION pick (ProjInsp / Viron / Hydronetwork stage 7):
      // the ДЕЙСТВИЯ КАРТ repeat surface owns the screen — never the hidden
      // source composer / the hydro section underneath.
      if (this.repeatPickActive) {
        return 'Repeat action';
      }
      if (this.pendingPlayCard !== undefined) {
        // Inside the hand workspace the bar names the STAGE, not the surface —
        // the breadcrumb above already says which workspace and which card, and
        // repeating that in the footer is the duplication the one-bar rule
        // exists to prevent. Standalone (no descent) it still names itself.
        return this.handStage !== undefined ? this.handStage.name : 'Play project card';
      }
      if (this.corpFirstActionOpen) {
        return 'First action';
      }
      if (this.colonyInspectModel !== undefined) {
        return 'Colony';
      }
      if (this.maFocusItem !== undefined) {
        return this.maFocusItem.name.replace(/[0-9]+$/, '');
      }
      if (this.consoleState.confirm !== undefined) {
        return 'Confirmation';
      }
      if (this.journalPanelVisible) {
        return 'Journal';
      }
      if (this.playedHeroHolds) {
        return 'Played';
      }
      if (this.playedTableVisible) {
        // The open category's caption; the bare table reads as «Разыграно».
        return (consolePlayedUi.categoryOpen || consolePlayedUi.categoryBusy) && consolePlayedUi.categoryLabel !== '' ?
          consolePlayedUi.categoryLabel : 'Played';
      }
      if (this.consoleState.quick !== undefined) {
        // The wheel's own kicker (trigger glyph + title) already names the
        // context centre-screen — repeating it bottom-left is noise on a TV
        // (same rule as the start scene's ''). The bar carries commands only.
        return '';
      }
      if (this.consoleState.sheet === 'cardActions' && consoleActionComposerUi.open &&
          workspaceStackTopAxis() !== 'section') {
        // The ACTION FOCUS stage inside the Action Center: the bar names the
        // STAGE by its PHASE (the SAME source as the frame header — the bar
        // and the breadcrumb can never disagree), never the grid underneath.
        // …unless a SECTION-projecting workspace is standing INSIDE it (a
        // hosted colony step): the bar belongs to the surface the player is
        // driving, which is the same rule input routing uses.
        return focusKicker(consoleActionComposerUi.revealClaim !== '' ? 'reveal' : 'setup');
      }
      if (this.consoleState.sheet !== undefined && workspaceStackTopAxis() !== 'section') {
        return this.sheetTitle;
      }
      if (this.placementActive) {
        // Same source as the right panel's kicker — the bar and the panel can
        // never disagree about what this cell pick puts down.
        return this.placementKickerKey;
      }
      if (this.consoleState.sale.active) {
        return 'Sell patents';
      }
      // A SECTION standing as a STEP of another flow reads as its HOST: the
      // player is inside «СТАНДАРТНЫЕ ПРОЕКТЫ», picking a colony — the bar
      // saying «ТОРГОВЛЯ» beside a breadcrumb that says otherwise is the one
      // place the two voices could contradict each other. (The crumb still
      // carries the full path; the bar carries only where the player IS.)
      const sectionHost = this.consoleState.section === 'colonies' ? workspaceFrameHost('colonies') :
        this.consoleState.section === 'hand' ? workspaceFrameHost('hand') :
          this.consoleState.section === 'hydro' ? workspaceFrameHost('hydro') : undefined;
      if (sectionHost !== undefined) {
        return workspaceFrameRoot(sectionHost);
      }
      switch (this.consoleState.section) {
      case 'hand': return 'Hand';
      case 'colonies': return 'Trading';
      case 'hydro': return 'Mars Hydronetwork';
      default:
        if (this.consoleState.scaleInspecting) {
          return 'Scale inspection';
        }
        return this.consoleState.inspecting ? 'Board inspection' : 'Board';
      }
    },
    /** The played project card(s) shown this turn — X = Осмотреть карту. */
    reviewCardNames(): ReadonlyArray<CardName> {
      return this.botTurnReviewState.review?.cardNames ?? [];
    },
    reviewInspectable(): boolean {
      return this.botTurnReviewState.open && this.reviewCardNames.length > 0;
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
    commands(): Array<ConsoleCommand> {
      // SYSTEM ALERT owns the pad — the bar advertises only the acknowledge.
      if (this.consoleSystemAlertState.current !== undefined) {
        return [{control: 'confirm', label: 'OK'}];
      }
      // TRADE-FLEET LAUNCH / TRADE REWARDS / HYDRO MARKER / BOARD CARD-BONUS /
      // PATENT SALE / TILE-PLACEMENT HERO / DECK DRAW: the animation owns the
      // moment — the pad is inert, the bar advertises nothing (bounded, plays
      // itself out). The trade-reward gate is PHASE-aware: it frees the pad
      // for the reveal take and for a Pluto discard between bonus draws.
      if (isTradeFleetActive() || isColonyTradeInputLocked() || isHydroMarkerActive() || isBoardCardBonusActive() || isPatentSaleActive() || this.tilePlacementHolds || isDeckDrawActive()) {
        return [];
      }
      // The played-card hero scene: the bar goes quiet — the card is the
      // whole story (a press during the result beat quietly skips ahead).
      if (this.playedHeroHolds) {
        return [];
      }
      // «Разбор хода» review: X inspect the played card, L3 show on map, B
      // close. While the fullscreen viewer is up its OWN footer carries the
      // contract; during a peek B returns to the review.
      if (this.botTurnReviewState.open && this.consoleCardZoom.card === undefined) {
        if (this.botTurnReviewState.peek) {
          return [{control: 'back', label: 'Back'}];
        }
        const cmds: Array<ConsoleCommand> = [];
        if (this.reviewInspectable) {
          cmds.push({control: 'secondary', label: 'Inspect card'});
        }
        if (this.reviewMapSpaces.length > 0) {
          cmds.push({control: 'stickL', label: 'Show on map'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      // PRESENTATION FLOW: a visible toast (incl. the compact AI-turn card)
      // deliberately does NOT re-label the bar — the bar keeps the CURRENT
      // screen's contract, and the card carries its own hints
      // («зажать X Осмотреть ход» · «B Закрыть» in .con-notif__actions).
      // Scale-focus hold: an inert transition beat — no command hints.
      if (this.govScaleFocusState.holding || this.govScaleFocusState.closing) {
        return [];
      }
      if (this.consoleState.fallbackActive) {
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Back'},
        ];
      }
      // THE FINAL SCORING WORKSPACE owns the whole post-game screen — its
      // bar contract follows the ceremony phase (the one labelled skip verb
      // while the count runs, the action-list verbs once it settles).
      if (this.endgameWorkspaceMounted) {
        return [...(panelCommands('endgame') ?? [])];
      }
      // LT INFORMATION MODE — the dashboard publishes its live contextual
      // contract (players / detail tabs / VP) through consolePanelUi; the
      // bar is its ONE hint surface (the old in-panel footer is gone).
      if (this.infoModeState.open) {
        return [...(panelCommands('infoMode') ?? [{control: 'inspect', label: 'Close'}])];
      }
      // A draft beat (hero landing / the research rise) owns the moment —
      // the bar advertises only the skip (any button skips).
      if (draftPickBeatActive() || riseSceneEngaged()) {
        return [{control: 'confirm', label: 'Skip'}];
      }
      if (this.draftWaitActive && this.draftTrayMounted) {
        // The pre-game POPOVER path only: nothing to decide — the board stays
        // inspectable while others pick. (The between-generations wait is the
        // WORKSPACE's own stage; its contract arrives via consoleDraftUi.)
        const cmds: Array<ConsoleCommand> = [];
        if (this.draftedCards.length > 0) {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push({control: 'inspect', label: 'Information'});
        return cmds;
      }
      if (this.consoleRevealMode !== undefined) {
        // The command bar is the SINGLE hint zone for the reveal (the overlay
        // has NO footer of its own — B never reads two conflicting labels).
        // Single-card drawn is fullscreen (the dialog covers the bar), so this
        // is the multi-card modal / result / viewer contract.
        const cmds: Array<ConsoleCommand> = [];
        if (this.consoleRevealMode === 'drawn') {
          const ev = currentRevealEvent();
          // ONE pure builder, shared with the EMBEDDED host (the action
          // workspace's outcome stage) — the same component and the same input
          // handler must never advertise two different contracts. A colony
          // bonus that still owes its discard (Pluto) closes INSIDE the modal:
          // once everything is taken, A is that step and there is no take-all /
          // dismiss left to advertise — the step is mandatory.
          cmds.push(...drawnRevealCommandRun({
            closer: this.revealDiscardCloser,
            hasCardSource: ev?.source?.type === 'card',
            hasDiscards: ev?.sequence?.some((step) => !step.matched) === true,
            multi: ev !== undefined && ev.cards.length - ev.takenIndices.size > 1,
          }));
        } else if (this.consoleRevealMode === 'viewer') {
          cmds.push({control: 'secondary', label: 'Inspect'});
          cmds.push({control: 'back', label: 'Close'});
        } else {
          // result: A = OK, X = inspect the REVEALED card, L3 = inspect the
          // SOURCE (acting) card — the same X/L3 idiom as the drawn reveal.
          cmds.push({control: 'confirm', label: 'OK'});
          cmds.push({control: 'secondary', label: 'Inspect'});
          cmds.push({control: 'stickL', label: 'Source'});
        }
        return cmds;
      }
      // …but NOT while the workspace is hosting the play-from-hand step: the
      // player is browsing a real hand, so the bar must carry the HAND's
      // contract (A разыграть · X осмотреть · LB/RB фильтр · B назад), not the
      // deployment's. The scene's own verbs would advertise presses that do
      // nothing on the surface actually in front of the player.
      // Same for the hosted COLONIES step — the colony grid's contract leads.
      // Same for the YIELD to a board placement — the board is the surface.
      // DRAW & SELECT publishes its own contract, and publishes an EMPTY one
      // through its outgoing beats on purpose: the bar must not advertise a
      // verb the surface is swallowing while the cards fly to the dock. Ahead
      // of the start scene for the same reason the pad routing is.
      if (this.deckPickServing) {
        return [...(panelCommands('deckPick') ?? [])];
      }
      if (this.draftWorkspaceOwnsPad) {
        // The workspace publishes its live contract (consoleDraftUi); the bar
        // mirrors it verbatim so it can never diverge from the buttons.
        return consoleDraftUi.commands.length > 0 ?
          [...consoleDraftUi.commands] :
          [{control: 'back', label: 'Minimize'}];
      }
      if (this.startSceneOwnsPad) {
        // The scene publishes its live contract (consoleStartUi — wizard step
        // vs. summary vs. ceremony: X inspects, RT continues / begins, etc.);
        // the bar mirrors it verbatim so it can never diverge from the buttons
        // (the old hard-coded list wrongly showed X = «Продолжить» and hid RT).
        return consoleStartUi.commands.length > 0 ?
          [...consoleStartUi.commands] :
          [
            {control: 'confirm', label: 'Select'},
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: 'Minimize'},
          ];
      }
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        // The panel publishes its context-aware contract (consolePanelUi) —
        // the bar is the ONE hint surface (the in-panel footer is gone).
        return [...(panelCommands('govSupport') ?? [
          {control: 'confirm', label: 'Apply'},
          {control: 'back', label: 'Minimize'},
        ])];
      }
      if (this.productionLossActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        return [...(panelCommands('productionLoss') ?? [
          {control: 'confirm', label: '−1'},
          {control: 'bumperL', label: '+1'},
          {control: 'secondary', label: 'Confirm'},
          {control: 'back', label: 'Minimize'},
        ])];
      }
      // The dedicated composite surfaces publish their own contracts; the
      // fallbacks below only ever show for the frame before the watcher runs.
      if (this.spendHeatActive) {
        return [...(panelCommands('spendHeat') ?? [{control: 'secondary', label: 'Pay'}, {control: 'back', label: 'Minimize'}])];
      }
      if (this.botAttackActive) {
        return [...(panelCommands('botAttack') ?? [{control: 'confirm', label: 'Choose the target'}, {control: 'back', label: 'Minimize'}])];
      }
      if (this.venusBonusActive) {
        return [...(panelCommands('venusBonus') ?? [{control: 'secondary', label: 'Collect'}, {control: 'back', label: 'Minimize'}])];
      }
      if (this.aresGlobalsActive) {
        return [...(panelCommands('aresGlobals') ?? [{control: 'secondary', label: 'Apply'}, {control: 'back', label: 'Minimize'}])];
      }
      if (this.effectDecisionActive) {
        return [...(panelCommands('effectDecision') ?? [])];
      }
      if (this.finalGreeneryActive) {
        return [...(panelCommands('finalGreenery') ?? [])];
      }
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined && !this.handPickActive) {
        // The task host publishes its live contract (browse / pick / lanes /
        // payment differ) — the bar renders it; no in-frame footer anymore.
        return [...(panelCommands('taskHost') ?? [
          {control: 'confirm', label: 'Select'},
          {control: 'secondary', label: 'Confirm'},
          {control: 'back', label: this.pendingClientPayment !== undefined ? 'Cancel' : 'Minimize'},
        ])];
      }
      // The REPEAT-ACTION pick surface owns the pad (the source composers are
      // hidden): it publishes its live contract (the grid «Выбрать» or the
      // nested composer's own verbs) to its DEDICATED store — unstealable,
      // never the shared cardActions slot the outer Viron composer may own.
      if (this.repeatPickActive) {
        return consoleRepeatPickUi.commands.length > 0 ?
          [...consoleRepeatPickUi.commands] :
          [{control: 'confirm', label: 'Select'}, {control: 'back', label: 'Cancel'}];
      }
      // A composer's CLIENT HAND PICK owns the pad (the composers are hidden):
      // the pick verbs mirror the mandatory hand-select grammar, with B as a
      // plain «Назад» to the composer (nothing is lost).
      if (this.handPickActive) {
        const focusName = this.handEntries[this.consoleState.handIndex]?.card.name;
        const canPick = focusName !== undefined && this.handSelectSelectableNames.includes(focusName);
        const verb = this.handSelectVerb;
        const n = consoleHandPickState.selected.length;
        const cmds: Array<ConsoleCommand> = [];
        if (this.handSelectSingle) {
          cmds.push({control: 'confirm', label: verb, enabled: canPick});
        } else {
          cmds.push({control: 'confirm', label: 'Select / Deselect', enabled: canPick});
          cmds.push({control: 'stickL', label: this.pickAllSelected ? 'Unselect all' : 'Select all'});
          cmds.push({control: 'triggerR', label: verb, enabled: this.handSelectPicksValid, badge: n, highlight: n > 0});
        }
        cmds.push({control: 'secondary', label: 'Inspect'});
        // X inspects the card under the cursor, so the EFFECT that sent the
        // player here needs its own verb — never make them guess the context.
        if (this.contextualSourceCard !== undefined) {
          cmds.push({control: 'stickL', label: 'Inspect the source', priority: 1});
        }
        if (this.handSelectFiltered) {
          cmds.push({control: 'triggerL', label: this.handSelectSuitableOnly ? 'All cards' : 'Only suitable'});
        }
        cmds.push({control: 'back', label: 'Back'});
        return cmds;
      }
      if (this.pendingPlayCard !== undefined) {
        // The composer publishes its CONTEXTUAL controls (A plays / Y changes a
        // resolved choice / X inspects / LB·RB only where a value dials / LT
        // only when the payment is configurable) — the bar mirrors them
        // verbatim, so it can never diverge from what the buttons actually do.
        return consolePlayCardUi.commands.length > 0 ?
          [...consolePlayCardUi.commands] :
          [{control: 'confirm', label: 'Play now'}, {control: 'back', label: 'Cancel'}];
      }
      if (this.colonyFocusOpen) {
        // The COLONY FOCUS STAGE mirrors its live state (consoleColoniesUi) —
        // the bar is the ONLY hint surface (no inline duplicates). The verbs
        // follow the INTENT: trade = rows + the one X confirm; build / pick =
        // A IS the confirm (nothing else to choose); inspect = B only.
        if (consoleColoniesUi.composerSub === 'lanes') {
          return [
            {control: 'triggerR', label: 'Max'},
            {control: 'confirm', label: 'Done'},
            {control: 'back', label: 'Back'},
          ];
        }
        if (consoleColoniesUi.composerSub === 'list') {
          return [
            {control: 'confirm', label: 'Select'},
            {control: 'back', label: 'Back'},
          ];
        }
        // The embedded played-card TARGET step (the trade reward's host card):
        // the shared selector's own grammar — A chooses, X inspects the focused
        // candidate fullscreen, B returns to the trade with everything intact.
        if (consoleColoniesUi.composerSub === 'targets') {
          return [
            {control: 'confirm', label: 'Select'},
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: 'Back'},
          ];
        }
        const intent = this.colonyFocus.intent;
        if (intent === 'build') {
          // A BUILD THAT COMPOSES speaks the trade's grammar: its placement
          // bonus needs a card, so A opens that decision and X commits. With
          // nothing to decide it keeps the single-verb «A Построить».
          if (consoleColoniesUi.composerDecisions) {
            return [
              {control: 'confirm', label: 'Select', enabled: consoleColoniesUi.composerEditable},
              {control: 'secondary', label: 'Build', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
              {control: 'back', label: 'Back'},
            ];
          }
          return [
            {control: 'confirm', label: 'Build', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
            {control: 'back', label: 'Back'},
          ];
        }
        if (intent === 'pick') {
          return [
            {control: 'confirm', label: this.colonyPick?.buttonLabel ?? 'Select', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
            {control: 'back', label: 'Back'},
          ];
        }
        if (intent !== 'trade' || !this.colonyFocusTradeable) {
          // The dossier composition: B is the only verb.
          return [{control: 'back', label: 'Back'}];
        }
        return [
          {control: 'confirm', label: 'Select', enabled: consoleColoniesUi.composerEditable},
          {control: 'secondary', label: 'Confirm trade', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.colonyInspectModel !== undefined) {
        // The read-only JOURNAL colony dossier: B closes, nothing else.
        return [{control: 'back', label: 'Close'}];
      }
      if (this.consoleState.confirm !== undefined) {
        return [
          {control: 'confirm', label: 'Confirm'},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.journalPanelVisible) {
        // The journal's whole grammar, honest to the panel's live mirrors
        // (consoleJournalUi — the panel syncs, the bar never guesses).
        // The «Показать» map-peek holds the referenced cells lit until the
        // player presses — B restores the journal (matches the bot review).
        if (consoleJournalUi.peekActive) {
          return [{control: 'back', label: 'Back'}];
        }
        if (consoleJournalUi.inspectOpen) {
          return [{control: 'back', label: 'Close'}];
        }
        if (consoleJournalUi.filterOpen) {
          return [
            {control: 'confirm', label: 'Select'},
            {control: 'back', label: 'Close'},
          ];
        }
        // The panel's own header carries the LB/RB mode tabs, LT/RT
        // generation pager and R3 filter chip ON the controls they drive —
        // the bar advertises only the focused ENTRY's verbs (§3.2: one
        // place per hint; this is what ends the truncated 9-hint runs).
        const cmds: Array<ConsoleCommand> = [
          {control: 'confirm', label: consoleJournalUi.focusExpanded ? 'Collapse' : 'Details', enabled: consoleJournalUi.focusIsGroup},
          // P29: X = «Осмотреть» — cards, standard projects/actions, hydro,
          // map-only entries (never the too-narrow «Карта»).
          {control: 'secondary', label: 'Inspect', enabled: consoleJournalUi.focusInspectable},
        ];
        if (consoleJournalUi.focusHasSpace) {
          cmds.push({control: 'stickL', label: 'Show on map'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.corpFirstActionOpen) {
        // The MANDATORY corp first-action modal: A takes the action, X
        // inspects the corporation, LB/RB switches corps (Merger), B only
        // DEFERS to the amber chip (never a dismissal).
        const cmds: Array<ConsoleCommand> = [
          {control: 'confirm', label: 'Take first action', highlight: true},
          {control: 'secondary', label: 'Inspect'},
        ];
        if (this.corpFirstActionNames.length > 1) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Corporation'});
        }
        cmds.push({control: 'back', label: 'Minimize'});
        return cmds;
      }
      if (this.playedTableVisible) {
        // «Разыграно»: the CATEGORY grammar, honest to the overlay's live
        // mirrors (consolePlayedUi). The table navigates zones and A opens
        // the focused one; inside the category view A/X inspect a card and
        // B is a LOCAL back (the cards fly home, never the tableau closing);
        // mid-flight only B is live (it reverses the same flight).
        if (consolePlayedUi.categoryBusy) {
          return [{control: 'back', label: 'Back'}];
        }
        if (consolePlayedUi.categoryOpen) {
          // X = inspect (the universal read verb); A stays free — it is the
          // reserved pick verb for the future tableau-pick mode of this view.
          return [
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: 'Back'},
          ];
        }
        const cmds: Array<ConsoleCommand> = [];
        cmds.push({control: 'confirm', label: 'Open', enabled: consolePlayedUi.focusCategory !== ''});
        if (consolePlayedUi.canCyclePlayer) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Player'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.consoleState.quick !== undefined) {
        // The cross's slots carry their OWN glyphs + labels on screen — the
        // bar anchors the retreat plus the ONE affordance the wheel itself
        // cannot show: the opposite trigger switches wheels in place. In
        // FOCUS & CONFIRM the bar additionally leads with the mode's core
        // verb (A confirms whatever is focused — directions only navigate).
        const other: ConsoleCommand = this.consoleState.quick === 'actions' ?
          {control: 'triggerL', label: 'Basic actions'} :
          {control: 'triggerR', label: 'Actions'};
        if (this.wheelControl.mode === 'focus-confirm') {
          return [{control: 'confirm', label: 'Select'}, other, {control: 'back', label: 'Close'}];
        }
        return [other, {control: 'back', label: 'Close'}];
      }
      if (this.consoleState.sheet === 'standardProjects' && workspaceStackTopAxis() !== 'section') {
        // A SECTION-projecting step standing inside (the sale's hand, the
        // colony pick) publishes its own contract — this branch yields to it
        // by DEPTH (the axis rule), exactly like the card-actions branch.
        //
        // A beat in flight advertises NOTHING: input is absorbed by phase, so
        // the bar must not promise verbs that cannot land. (The embedded
        // PAYMENT step never reaches here — the task-host branch above owns
        // the bar while a client payment is up.)
        if (!acceptsInput(workspaceFramePhase('standard-projects') ?? 'browse')) {
          return [];
        }
        // One context-sensitive CTA belongs in the canonical command rail;
        // repeating it on every project card adds noise and weakens focus.
        const focused = this.stdProjectItems[this.consoleState.sheetIndex];
        return [
          {
            control: 'confirm',
            label: focused?.key === 'sell-patents' ? 'Sell' : 'Select',
            enabled: focused?.available === true,
            highlight: focused?.available === true,
          },
          {control: 'back', label: this.stdBackLabel},
        ];
      }
      if (this.consoleState.sheet === 'cardActions' && workspaceStackTopAxis() !== 'section') {
        // While the COMPOSER (setup / confirmation) is up, its dedicated
        // store is the authority — with an honest Confirm/Cancel fallback,
        // never the grid verbs (the shared-slot fallback once showed
        // Perform/Inspect/Close under a confirm).
        if (consoleActionComposerUi.open) {
          return consoleActionComposerUi.commands.length > 0 ?
            [...consoleActionComposerUi.commands] :
            [{control: 'confirm', label: 'Confirm'}, {control: 'back', label: 'Cancel'}];
        }
        // The Action Center grid publishes the live contract.
        return [...(panelCommands('cardActions') ?? [
          {control: 'confirm', label: 'Perform'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: 'Close'},
        ])];
      }
      if (this.maScreenKind !== undefined) {
        // The MA WORKSPACE. Detail stage open: A carries the REAL verb
        // (enabled only when the live waitingFor offers it — the stage names
        // the concrete blocker), B is one logical level. During the commit /
        // ceremony beats input is absorbed — the bar advertises nothing.
        if (maFocusState.open) {
          if (!maFocusAcceptsInput()) {
            return [];
          }
          return [
            {control: 'confirm', label: this.maScreenKind === 'milestones' ? 'Claim' : 'Fund',
              enabled: this.maFocusAvailable, highlight: this.maFocusAvailable},
            {control: 'back', label: 'Back'},
          ];
        }
        // The OVERVIEW: ONE primary verb. A opens the detail stage for EVERY
        // item — available, blocked, already taken — so the old `X Осмотреть`
        // has nothing left to show and is gone with the modal era it belonged
        // to. Bumpers switch the category, B closes the workspace.
        const anyMa = this.maScreenItems.length > 0;
        return [
          {control: 'confirm', label: 'Select', enabled: anyMa},
          {control: this.maScreenKind === 'milestones' ? 'bumperR' : 'bumperL',
            label: this.maScreenKind === 'milestones' ? 'Awards' : 'Milestones'},
          {control: 'back', label: this.awardFundingActive ? 'Minimize' : 'Close'},
        ];
      }
      if (this.consoleState.sheet !== undefined && workspaceStackTopAxis() !== 'section') {
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'To the board'},
        ];
      }
      if (this.placementActive) {
        // P21: the placement footer is CONTEXT-ONLY and one-line by
        // contract — LT/RT keep working globally (Info / Actions) but
        // never occupy this bar; a NON-cancellable B is not an action, so
        // it is not a hint (the panel + the B-toast explain mandatory).
        //
        // The bar is the ONE home of every placement verb (the panel renders
        // no controller prompts at all), so the four verbs must SURVIVE the
        // TV fit model: the L3/R3 hints carry explicit priorities below the
        // droppable default — under pressure the generic d-pad hint (the
        // board's highlighted cells already teach navigation) drops first,
        // never a verb with no other home. «Источник» is deliberately the
        // short label here: «Осмотреть источник» was what the 4K fit dropped.
        const cmds: Array<ConsoleCommand> = [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Place here', enabled: this.selectedCellLegal,
            highlight: this.selectedCellLegal},
          // L3 — the SOURCE card fullscreen, the same verb it carries on every
          // other surface in the shell. It replaced «next available cell», a
          // jump that duplicated what the d-pad already does over a board whose
          // legal cells are highlighted.
          ...(this.placementSourceCard !== undefined ?
            [{control: 'stickL' as GlyphControl, label: 'Source', priority: 1}] : []),
          {control: 'stickR', label: this.consoleState.freeRoam ? 'Available only' : 'All cells', priority: 2},
        ];
        if (this.placementCancellable) {
          cmds.push({control: 'back', label: 'Cancel placement'});
        }
        return cmds;
      }
      if (this.consoleState.sale.active) {
        const n = this.consoleState.sale.selected.length;
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'stickL', label: this.saleAllSelected ? 'Unselect all' : 'Select all'},
          {control: 'secondary', label: 'Inspect'},
          {control: 'triggerR', label: 'Sell', enabled: n > 0, badge: n, highlight: n > 0, priority: 1},
          {control: 'back', label: 'Cancel'},
        ];
      }
      // MANDATORY hand SELECT — the pick verbs (no tag filter; the "suitable
      // only" toggle takes LT), submit on A (single) / RT (multi), B minimizes.
      if (this.handSelectTaskActive && this.consoleState.section === 'hand') {
        const focusName = this.handEntries[this.consoleState.handIndex]?.card.name;
        const canPick = focusName !== undefined && this.handSelectSelectableNames.includes(focusName);
        const verb = this.handSelectModel?.buttonLabel || 'Select';
        const n = this.consoleState.select.selected.length;
        const cmds: Array<ConsoleCommand> = [];
        if (this.handSelectSingle) {
          cmds.push({control: 'confirm', label: verb, enabled: canPick});
        } else {
          cmds.push({control: 'confirm', label: 'Select / Deselect', enabled: canPick});
          cmds.push({control: 'triggerR', label: verb, enabled: this.handSelectPicksValid, badge: n, highlight: n > 0});
        }
        cmds.push({control: 'secondary', label: 'Inspect'});
        if (this.contextualSourceCard !== undefined) {
          cmds.push({control: 'stickL', label: 'Inspect the source', priority: 1});
        }
        if (this.handSelectFiltered) {
          cmds.push({control: 'triggerL', label: this.consoleState.select.suitableOnly ? 'All cards' : 'Only suitable'});
        }
        cmds.push({control: 'back', label: 'Minimize'});
        return cmds;
      }
      // The HAND's own browse verbs — but never over an EMBEDDED colony step:
      // the colonies teleported into the hand's zone are DEEPER than it, and
      // `section` projects the deepest frame — so it already says 'colonies'
      // and this branch cannot fire over a colony grid. («A Разыграть» over a
      // colony pick was the lie a hand-written `!colonyEmbedActive` term used
      // to have to prevent, at every section-keyed branch, one at a time.)
      if (this.consoleState.section === 'hand') {
        const playable = this.handEntries[this.consoleState.handIndex]?.playable === true;
        const cmds: Array<ConsoleCommand> = [
          {control: 'confirm', label: 'Play now', enabled: playable},
          {control: 'secondary', label: 'Inspect'},
        ];
        // The tag filter owns LT/RT (+ R3 reset) — shown only when there's a
        // real tag to filter by (more options than just "All"). This is the
        // ONE place these controls are advertised (no inline duplication).
        // Rendered as a spread prev/next hint: LT ◀ ФИЛЬТР ▶ RT. The PAGE
        // verbs (LB/RB) are deliberately NOT here: the bay spine carries
        // them beside the position it navigates — one action, one hint.
        if (this.handTagFilterOptions.length > 1) {
          cmds.push({control: 'triggerL', control2: 'triggerR', label: 'Tag filter', spread: true});
          cmds.push({control: 'stickR', label: 'Reset filter', enabled: this.consoleState.handTagFilter !== 'all'});
        }
        cmds.push({control: 'back', label: this.shellTaskActive ? 'Minimize' : 'To the board'});
        return cmds;
      }
      if (this.consoleState.section === 'colonies') {
        // T4 pick mode: A = the server verb; B = cancel (marker) / minimize.
        // Standalone section AND the embedded step publish the SAME contract
        // (one grid, one grammar — only B's label differs: an embedded step
        // minimizes its host).
        const pick = this.colonyPick;
        if (pick !== undefined) {
          // The overview SELECTS; the focus stage resolves — A's label says
          // where it goes, never pretends the commit happens here.
          return [
            // ONE VERB ON THE OVERVIEW. A always opens the focused colony's
            // detail stage — the action itself is performed THERE, with its
            // availability and its blocked reason on screen — so the label
            // names the press, not a destination it cannot promise
            // («К строительству» over a colony that refuses the build read as
            // a commitment). There is no separate «Осмотреть» either: the
            // stage the overview opens IS the dossier.
            {control: 'confirm', label: 'Select'},
            // The pick is OWED BY A CARD → the console-wide source verb.
            ...(this.colonyEmbedSourceCard !== undefined ?
              [{control: 'stickL' as GlyphControl, label: 'Inspect the source'}] : []),
            {control: 'back', label: this.colonyCancellable ? 'Cancel' : 'Minimize'},
          ];
        }
        return [
          // A always ENTERS the focus stage — see the pick branch above: one
          // verb, one destination, and the stage owns both the action and the
          // reason it may be impossible.
          {control: 'confirm', label: 'Select'},
          ...(this.colonyEmbedSourceCard !== undefined ?
            [{control: 'stickL' as GlyphControl, label: 'Inspect the source'}] : []),
          // B: «свернуть» is right for a step a COMMITTED host owns — the
          // decision stays live and the player is only going to look at the
          // board. A card-sourced TRADE is the opposite case: nothing is
          // committed, the step is one reversible level, and B walks back to
          // the variant that opened it. Promising «свернуть» there would name
          // a park that does not happen.
          {control: 'back',
            label: cardColonyTradeCard() !== '' ? 'Back' :
              (this.colonyEmbedActive ? 'Minimize' : 'To the board')},
        ];
      }
      if (this.consoleState.section === 'hydro') {
        // The hydro WORKSPACE publishes its live command contract into its
        // dedicated store (per step / focus / phase) — the bar never guesses.
        return consoleHydroUi.commands.length > 0 ?
          [...consoleHydroUi.commands] :
          [{control: 'back', label: 'To the board'}];
      }
      // P27b: SCALE INSPECTION MODE — the bonus ring, B/R3 exit.
      if (this.consoleState.scaleInspecting) {
        return [
          {control: 'inspect', label: 'Information'},
          {control: 'back', label: 'To the board'},
          {control: 'stickR', label: 'Exit'},
        ];
      }
      // P27: BOARD INSPECTION MODE — strict cell traversal, B/L3 exit.
      if (this.consoleState.inspecting) {
        return [
          {control: 'inspect', label: 'Information'},
          {control: 'back', label: 'To the board'},
          {control: 'stickL', label: 'Exit'},
        ];
      }
      // Board — the console home screen: the full stable command map.
      // The LB/RB hints moved INTO the right panel's Milestones/Awards
      // blocks (they sit right on the objects they open) — the freed slots
      // bring the Menu/System indicator back to the bar.
      const home: Array<ConsoleCommand> = [
        {control: 'inspect', label: 'Information'},
        {control: 'secondary', label: 'Played'},
        // The bar's badge is the SUM of the wheel it opens — all four
        // categories, same potential semantics — so the hint and the wheel can
        // never say different numbers. The HIGHLIGHT is the other question
        // («can I act right now»), and that one is legitimately turn-gated.
        {control: 'triggerR', label: 'Actions', badge: this.wheelCountsTotal,
          highlight: this.myTurn && this.wheelCountsTotal > 0},
        // The SHORT hint key on purpose — the footer's centre bay (hand
        // dock) splits this richest set across two zones, and the full
        // «Базовые действия» is the one atom that fits neither; the LT
        // quick wheel itself keeps the full 'Basic actions' title.
        {control: 'triggerL', label: 'Basics'},
        {control: 'stickL', label: 'Inspect board'},
        {control: 'stickR', label: 'Scale inspection'},
        {control: 'view', label: 'Log'},
      ];
      // A pending mandatory decision is announced on the board home and opened
      // / returned-to with A (consoleMandatoryGate) — anchor its A verb in the
      // bar (A is otherwise free on the board home).
      if (this.mandatoryAnnounceVisible) {
        home.unshift({control: 'confirm', label: this.mandatoryAnnounceView.openLabel});
      }
      return home;
    },
    // ── P15: the fullscreen viewer's select context ─────────────────────
    /** The TV rules panel shows for cards with structured information —
     *  and suppresses the floating callouts (one place for details). */
    zoomHasRules(): boolean {
      const name = this.consoleCardZoom.card?.name;
      // Asked with the suppression already applied: a card whose only rules
      // block is the requirement the availability panel states in full has
      // nothing left for this panel, and an empty box must not mount.
      return name !== undefined && cardHasRules(name, this.zoomCoveredRequirements);
    },
    /** Rules blocks the availability panel restates in full (server keys). */
    zoomCoveredRequirements(): ReadonlyArray<string> {
      return this.zoomAvailabilityView?.coveredRequirementIds ?? [];
    },
    /** The right SIDE panel shows for a card with structured rules OR whenever
     *  the viewer is an inspect DOSSIER (which always offers СТАТИСТИКА, even if a
     *  card had no rules) OR when the availability panel has something to say.
     *  Gates the panel AND the viewer's width reservation. */
    zoomSideVisible(): boolean {
      return this.zoomHasRules || this.zoomBotCorpAnnotations !== undefined ||
        this.consoleCardZoom.inspect !== undefined || this.zoomAvailabilityView !== undefined;
    },
    /** The MarsBot corporation's printed rule boxes for the rules panel —
     *  only when the viewer is on a bot-corporation entry. */
    zoomBotCorpAnnotations(): ReadonlyArray<CardAnnotation> | undefined {
      const card = this.consoleCardZoom.card;
      if (card === undefined || !isMarsBotCorpZoom(card)) {
        return undefined;
      }
      return marsBotCorpAnnotations(card.marsBotCorp);
    },
    /**
     * The CURRENT-GAME availability view for the zoomed card — only in an
     * explicit context the OPENER opted into (`consoleCardZoom.availability`:
     * the draft workspace's zones pass 'draft', the hand's play browse passes
     * 'play'; a discard pick / patent sale / played-table browse pass nothing
     * and the panel cannot appear there). Built by the SHARED cardAvailability
     * model — the same view the draft's compact block and the hand verdict
     * derive from, so the fullscreen can never disagree with them. Recomputed
     * per browsed card (`consoleCardZoom.card` follows LB/RB), so a previous
     * card's reasons can never linger.
     */
    zoomAvailabilityView(): CardAvailabilityView | undefined {
      const z = this.consoleCardZoom;
      if (z.availability === undefined || z.card === undefined) {
        return undefined;
      }
      const card = z.card as CardModel;
      if (z.availability === 'play') {
        const entry = this.handEntries.find((e) => e.card.name === card.name);
        // The live offer already accepts it — simply playable, nothing to say.
        // (The offer can be WIDER than `unplayableReasons` — a prompt-carried
        // discount — so the offer wins, mirroring the hand grid.)
        if (entry?.playable === true) {
          return undefined;
        }
        // The turn note joins ONLY when the WINDOW is closed (opponent's turn
        // or an owed decision) — on the player's own open window a blocked
        // card is purely a card problem. Never re-derived: the shell's one
        // soft reason, the same string (and the same window flag) the hand
        // verdict bar reads, so the two lists match row for row.
        return buildCardAvailability({
          reasons: card.unplayableReasons,
          turnReason: this.handTurnWindowClosed ? this.handSoftReason : undefined,
        }, 'play');
      }
      return buildCardAvailability({reasons: card.unplayableReasons}, 'draft');
    },
    /** The zoomed card's name typed as a CardName for the rules panel — only
     *  read behind `zoomHasRules`, which is true solely for real project cards
     *  (a bonus entry never resolves rules), so the cast is sound. */
    zoomRulesCardName(): CardName | undefined {
      const name = this.consoleCardZoom.card?.name;
      return name === undefined ? undefined : (name as CardName);
    },
    zoomSelectable(): boolean {
      return this.consoleCardZoom.select !== undefined && this.consoleCardZoom.card !== undefined;
    },
    zoomSelected(): boolean {
      const z = this.consoleCardZoom;
      return z.select !== undefined && z.card !== undefined && z.select.isSelected(z.card.name as CardName);
    },
    zoomSelectLabel(): string {
      return this.consoleCardZoom.select?.selectLabel ?? 'Select';
    },
    zoomDeselectLabel(): string {
      return this.consoleCardZoom.select?.deselectLabel ?? 'Deselect';
    },
    /** P17: the context action verb for the CURRENT card (play parity). */
    zoomActionLabel(): string | undefined {
      const z = this.consoleCardZoom;
      if (z.action === undefined || z.card === undefined) {
        return undefined;
      }
      // The action bridge is only ever attached to project-card lists, so the
      // ZoomCard name is genuinely a CardName here (never a bonus id).
      return z.action.labelFor(z.card.name as CardName);
    },
    /** The RECEIVE bridge A-verb (drawn-cards reveal), or undefined. */
    zoomReceiveLabel(): string | undefined {
      return this.consoleCardZoom.receive?.takeLabel;
    },
    /** The RECEIVE bridge RT-verb (take all), shown only when it exists. */
    zoomTakeAllLabel(): string | undefined {
      const r = this.consoleCardZoom.receive;
      return r?.takeAll !== undefined ? r.takeAllLabel : undefined;
    },
    /** The prominent ROLE status pill (single-card reveal), or undefined. */
    zoomStatusLabel(): string | undefined {
      return this.consoleCardZoom.statusLabel;
    },
    /**
     * The PLAYED-TABLE provenance plate for the card ON SCREEN (undefined =
     * the viewer wasn't opened from «Разыграно»). Rides `index`, so browsing
     * a zone with LB/RB keeps the plate — and «N из M» — honest.
     */
    zoomProvenance(): ConsoleZoomProvenance | undefined {
      // `index` is read explicitly: the resolver is a plain function, so the
      // computed must depend on the reactive field it is keyed by.
      const index = this.consoleCardZoom.index;
      return this.consoleCardZoom.provenanceAt?.(index);
    },
    /** The L3 role-swap chip verb (single-card reveal), or undefined. */
    zoomSwapLabel(): string | undefined {
      return this.consoleCardZoom.swap?.label;
    },
    /** The OTHER card's name shown in the swap chip, or undefined. */
    zoomSwapOtherName(): CardName | undefined {
      return this.consoleCardZoom.swap?.otherName;
    },
    /** The «ПОЛУЧЕНО N» count in the viewer bar (single-card reveal). 0 = hidden. */
    zoomReceivedCount(): number {
      return this.consoleCardZoom.receivedCount;
    },
    /** The static source chip (non-card source, e.g. tile bonus), or undefined. */
    zoomSourceInfo(): {label: string, name: string} | undefined {
      return this.consoleCardZoom.sourceInfo;
    },
    /** True ⇔ R3 peeks the discard pile (single-card fullscreen reveal). */
    zoomDiscardsAvailable(): boolean {
      return this.consoleCardZoom.discards !== undefined;
    },
    /** P17: «why not» lines when the current card is NOT actionable. */
    zoomReasons(): ReadonlyArray<string> {
      const z = this.consoleCardZoom;
      if (z.action === undefined || z.card === undefined || this.zoomActionLabel !== undefined) {
        return [];
      }
      return z.action.reasonsFor(z.card.name as CardName);
    },
    /**
     * The ONE summary of whatever decision is pending — the shared source of
     * truth for the deferred chip, the command bar's context and (via its own
     * computed) the task host's kicker, so the three can never disagree.
     * `undefined` = nothing is pending on a console-owned surface.
     *
     * Precedence mirrors how the surfaces actually mount: the START SCENE
     * outranks a section task (it owns the whole screen), then the host task,
     * then the shell-section task.
     */
    activeTaskSummary(): ConsoleTaskSummary | undefined {
      // A CLIENT-built payment's prompt is NOT `waitingFor` (which still holds
      // the action menu) — hand the summary the real prompt + its source card.
      const client = this.pendingClientPayment;
      if (client !== undefined) {
        return consoleTaskSummary(CLIENT_PAYMENT_TASK, this.playerView, {
          prompt: client.input,
          sourceCard: client.cardName as CardName,
        });
      }
      // The RAW classification — deliberately NOT `hostTask ?? shellTask ??
      // startTask`: a prompt no console surface serves (a `composite` Venus
      // bonus / spend-heat, an `unknown` guard) is EXACTLY the case that used
      // to read «Ожидает решения» hardest, and it still deserves a name.
      const task = taskFor(this.playerView);
      return task === undefined ? undefined : consoleTaskSummary(task, this.playerView);
    },
    /** P15: the deferred-chip return verb, by what is actually pending. */
    deferReturnLabel(): string {
      return this.startDeferSummary?.returnKey ?? this.activeTaskSummary?.returnKey ?? 'Return to the decision';
    },
    /** The deferred chip's classification chip ("ОПЛАТА" / "ДРАФТ"). */
    deferKicker(): string {
      const start = this.startDeferSummary;
      if (start !== undefined) {
        return translateText(start.kickerKey);
      }
      return translateText(this.activeTaskSummary?.kickerKey ?? 'Awaiting decision');
    },
    /**
     * The MINIMIZED START's own copy — the start workspace is the one surface
     * that legitimately stands with NO live prompt (the table is still
     * confirming), so the shared task summary has nothing to say about it.
     * The keys come from the start's own pure model (never a literal here).
     */
    startDeferSummary(): {kickerKey: string, askKey: string, returnKey: string} | undefined {
      if (this.activeTaskSummary !== undefined || !this.startSceneServes) {
        return undefined;
      }
      if (startAwaitingOthers(this.playerView)) {
        return startDeferredSummary('awaiting-table');
      }
      // The deployment's cards are through and the one thing left is the
      // corporation's first action, waiting for the player's turn — say so.
      if (firstActionOwed(this.playerView) && this.playerView.waitingFor === undefined) {
        return startDeferredSummary('awaiting-first-action');
      }
      return startDeferredSummary('in-progress');
    },
    /** The deferred chip's CONCRETE ask ("Сбросьте 1 карту") — the whole point. */
    deferAsk(): string {
      const start = this.startDeferSummary;
      if (start !== undefined) {
        return translateText(start.askKey);
      }
      const ask = this.activeTaskSummary?.ask;
      if (ask === undefined) {
        return '';
      }
      return typeof ask === 'string' ? translateText(ask) : translateMessage(ask);
    },
    /** The card that ASKS, when the server named one — rendered as a chip. */
    deferSourceCard(): CardName | undefined {
      return this.activeTaskSummary?.sourceCard;
    },
  },
  watch: {
    /** The MA commit's verdict may arrive on either feed — the ceremony
     *  queue (fed by NotificationLayer's update) or the raw view values.
     *  Both watchers run the same pure decision; a no-op when not committing. */
    maCurrentBeat() {
      this.evaluateMaFocusCommit();
    },
    'playerView.game.gameAge'() {
      this.evaluateMaFocusCommit();
    },
    'playerView.game.undoCount'() {
      this.evaluateMaFocusCommit();
    },
    /** The free-award-funding task ended (submitted / expired / new game) —
     *  a suspended MA detail draft has lost its restore door and must die
     *  with it (a stale draft re-seating in a LATER game is the trap). */
    awardFundingActive(next: boolean) {
      if (!next) {
        discardMaFocusDraft();
      }
    },
    /** The ACTION COMMIT settled — run the dismiss it was holding back. */
    commitHolding(now: boolean, was: boolean) {
      if (was && !now && this.pendingCommitDismiss !== undefined) {
        const run = this.pendingCommitDismiss;
        this.pendingCommitDismiss = undefined;
        run();
      }
    },
    // NOTIFICATION X-HOLD safety: the tracked card left the screen (TTL ran
    // out despite the pause safeguard, a flow ack, a queue promotion) or a
    // DIFFERENT card took the top slot — an in-flight hold must die with it,
    // never fire an action for a card the player no longer sees.
    topNotification(next: LiveNotification | undefined, prev: LiveNotification | undefined) {
      if (next?.id !== prev?.id) {
        cancelNotifHold();
      }
    },
    // The quick wheel closed or switched under a live arm (closeConsoleLayers,
    // a shell-task surface, the trigger toggle) — the input state dies with
    // its wheel and the NEXT wheel starts at the fixed HOME focus (centre:
    // LT = Standard Projects, RT = Cards — never a remembered position).
    // Eventual releases of still-held controls match nothing and drop.
    'consoleState.quick'() {
      this.wheelInput = initialWheelInput();
    },
    // The CONTROL STYLE changed (the Options row applies instantly, no
    // restart): any armed / tracking / pressed state cancels WITHOUT
    // executing, and an open wheel lands in the new strategy's clean start
    // (home focus for focus-confirm; idle for quick-select). Stale releases
    // of the old strategy match nothing afterwards.
    'wheelControl.mode'() {
      this.wheelInput = initialWheelInput();
    },
    // Start-of-game setup reveal: while the ceremony is DEFERRED (B → inspect the
    // board), suspend the panel override so the left rail shows the REAL applied
    // state (not a mid-reveal staged snapshot). Restored on return.
    'consoleState.task.deferred'(deferred: boolean) {
      setStartSetupRevealSuspended(deferred);
      // Mirror into the leak detector: a deferred task is deliberately set aside
      // (never stranded), and its serving card (`.con-mandatory`) is hidden off
      // the board home — the detector reads this flag instead of a DOM surface.
      // Both default to false and stay synced on every change; the detector's
      // stop-reset covers unmount, so no immediate sync is needed.
      setConsoleTaskDeferred(deferred);
    },
    // A task's nested SelectSpace branch answered ON THE BOARD (final greenery,
    // the WGT ocean): the host / gov-support / production-loss surfaces are all
    // unmounted for its lifetime while `waitingFor` stays the OrOptions — the
    // board is the serving surface and the detector has no DOM node to match it
    // by. Mirror it, or the amber guard covers a working placement (~2 s in).
    taskSpacePending(pending: {index: number, spacePrompt: PlayerInputModel} | undefined) {
      setConsoleTaskSpacePlacement(pending !== undefined);
    },
    // (The old trade-composer close-on-dock watcher is gone: the COLONY FOCUS
    // STAGE folds back to the browse surface AT the confirm — the flight and
    // the reward transaction play over the surface they belong to.)
    //
    // PLUTO COMES HOME. The colony workspace is the trade transaction's HOME
    // surface. A Pluto sequence legitimately walks away from it (each colony
    // bonus's discard runs on the hand in select mode); the moment the NEXT
    // payout batch arrives — or the closing track glide needs the traded tile
    // — the section returns, so the covers/marker have their physical anchors
    // and the reveal lands EMBEDDED in the workspace again (never a detached
    // fullscreen modal mid-flow). The claim is re-established structurally
    // from the transaction itself: the hand trip released it (the embed's
    // falling edge), and the transaction — not a timer — is the truth that
    // says the flow is still ours.
    tradePayoutIncoming(incoming: boolean) {
      if (!incoming) {
        return;
      }
      if (workspaceOutcomeState.host !== 'colonies' && colonyTradeState.colonyName !== '') {
        // A payout is incoming, so `draw` is claimed even when the structural
        // lookup cannot see the colony any more; `pick` rides along when the
        // colony's rewards can land on a card (the late-prompt defense).
        const kinds = this.colonyTradeClaimKinds(colonyTradeState.colonyName);
        claimWorkspaceOutcome('colonies', colonyTradeState.colonyName, kinds.length > 0 ? kinds : ['draw']);
        markWorkspaceOutcomeArrivalDone();
      }
      this.bringColoniesHome();
    },
    /**
     * The same return, for a payout we hold a claim on that the TRADE
     * transaction cannot explain (a build's draw, a second colony bonus after
     * a hand discard). The claim is the truth; the section comes back so the
     * reveal lands INSIDE the workspace instead of over it.
     */
    colonyPayoutIncoming(incoming: boolean) {
      if (incoming) {
        this.bringColoniesHome();
      }
    },
    /**
     * THE ENTRY'S WAIT IS OVER THE MOMENT THE PAYOUT IS REAL. From here on the
     * resolution stands on server evidence alone and the entry is context —
     * which is what makes the falling edge below reachable at all. (Immediate,
     * because a resolution already running when this shell mounts — a reload
     * straight into one — has no rising edge left to give.)
     */
    colonyResolutionEvidence: {
      immediate: true,
      handler(live: boolean): void {
        if (live) {
          noteColonyBonusEntryWaitOver();
        }
      },
    },
    /**
     * …AND A WAIT NOBODY ANSWERS STILL ENDS. The net is bounded and named
     * (`COLONY_BONUS_ENTRY_WAIT_MS`): armed with the wait, cancelled the
     * instant it is over. Nothing is torn down here — the flag simply stops
     * being a reason to stand, and if genuine evidence exists by then the
     * resolution carries on unaffected.
     */
    colonyEntryAwaiting: {
      immediate: true,
      handler(awaiting: boolean): void {
        if (this.colonyEntryWaitTimer !== undefined) {
          window.clearTimeout(this.colonyEntryWaitTimer);
          this.colonyEntryWaitTimer = undefined;
        }
        if (!awaiting) {
          return;
        }
        this.colonyEntryWaitTimer = window.setTimeout(() => {
          this.colonyEntryWaitTimer = undefined;
          noteColonyBonusEntryWaitOver();
        }, COLONY_BONUS_ENTRY_WAIT_MS);
      },
    },
    /**
     * THE COLONY RESOLUTION'S LIFECYCLE — one watcher, both edges.
     *
     * RISING: the workspace crosses the commit boundary for the whole span of
     * the resolution. The frame's phase goes `committed` (B = «свернуть», the
     * crumb's accent turns amber, `hosts: 'inFlow'` starts answering — the
     * hand can now mount INSIDE as a step), and the frame EARNS `handSelect`
     * so the leak detector knows the mandatory discard is served here.
     *
     * FALLING: the resolution is over — no pending input, no flight, the
     * track reset committed. Only now the claim releases, the serves shrink
     * back, and the phase returns to the player's own depth. This is the ONE
     * close gate the task demanded: nothing folds earlier — and the entry's
     * bounded wait above is what guarantees this edge can be REACHED at all.
     */
    colonyResolutionLive(live: boolean, was: boolean): void {
      if (live && !was) {
        resetColonyResolutionUi(); // a fresh resolution starts a fresh receipt
        if (workspaceFrameMounted('colonies')) {
          setWorkspaceFramePhase('colonies', 'committed');
          setWorkspaceFrameServes('colonies', COLONY_RESOLUTION_SERVES);
        }
        return;
      }
      if (!live && was) {
        clearColonyBonusEntry();
        setColonyDiscardStage(false);
        this.colonyFocusRestorePending = false;
        this.colonyBonusCollected = ''; // a new payout may repeat a cube key
        if (workspaceOutcomeState.host === 'colonies') {
          releaseWorkspaceOutcome('resolution-end');
        }
        if (workspaceFrameMounted('colonies')) {
          setWorkspaceFrameServes('colonies', ['colony']);
          if (!workspaceFrameHasNested('colonies')) {
            setWorkspaceFramePhase('colonies', this.colonyFocus.open ? 'configure' : 'browse');
          }
        }
      }
    },
    /**
     * THE NEXT CUBE COLLECTS ITSELF. A recipient with several settlements on
     * one colony is paid one cube at a time (the server resolves each in full
     * before the next), so the second delivery arrives while the player is
     * ALREADY standing on that colony's stage. Announcing it again would send
     * them back to the board to press A on the same colony they are looking
     * at; instead the workspace answers it the moment its table is clear —
     * the next card then arrives into the very stage that is already open.
     *
     * Gated on an EMPTY table on purpose: submitting while the previous card
     * is still lying there would draw the next one into a batch the player is
     * mid-way through taking.
     */
    colonyBonusAutoCollect(key: string): void {
      if (key === '' || key === this.colonyBonusCollected) {
        return;
      }
      this.colonyBonusCollected = key;
      // The announcement must not fire for a beat we are answering ourselves.
      const beat = this.mandatoryBeat;
      if (beat !== undefined) {
        acknowledgeMandatoryBeat(beat.key);
      }
      this.submit({type: 'option'});
    },
    // The closing track glide measures the traded tile's own track cells —
    // the section must be mounted for the marker to physically step home.
    'colonyTradeState.glideNonce'() {
      if (this.colonyTradeState.active) {
        this.bringColoniesHome();
      }
    },
    // ── THE COLONIES FRAME's lifecycle ────────────────────────────────────
    // Rising edge of a SelectColony prompt: PUSH the colonies onto whatever
    // flow the player is standing in. The frame is the claim — there is no
    // second place recording «who hosts whom», so it cannot disagree with the
    // stack, and the host cannot be re-derived later (after the composer left,
    // after a screen change) into a different answer.
    // …and it is the ADMITTED door, never the raw prompt (`colonyPromptOpenable`):
    // one press can produce several effects in one response, and the previous
    // one must be worked through before this surface is handed over. Reactive,
    // so the push happens by itself on the frame the chain clears.
    colonyPromptOpenable(on: boolean) {
      if (!on || workspaceFrameIndex('colonies') !== -1) {
        return;
      }
      this.openColoniesForPrompt();
    },
    // The follow-up ended (rewards granted, Pluto resolved, track reset) — the
    // colonies frame is done and pops, uncovering whatever hosted it.
    colonyFollowUpLive(live: boolean, was: boolean) {
      if (live || !was) {
        return;
      }
      // A visit the PLAYER made stays exactly where it is; a frame the PROMPT
      // pushed hands the screen back once its demand is met. That distinction
      // is the frame's own anchor, not a flag somebody has to clear.
      if (workspaceFrameAnchor('colonies')?.type !== 'prompt') {
        return;
      }
      const host = workspaceFrameHost('colonies');
      // THE COMPLETION SETTLE (standalone only). Popping on the same frame the
      // last physical change lands means the player never sees what it was: the
      // cube had only just seated. The section owns the dwell, then hands the
      // screen forward through `flow-complete`.
      const section = this.$refs.coloniesSection as InstanceType<typeof ConsoleColoniesSection> | undefined;
      if (host === undefined && this.colonyFocus.open && section !== undefined) {
        section.completeFlow();
        return;
      }
      // The focus stage (if the follow-up resolved on it) folds with the step —
      // the parent continuation gets a clean surface back.
      closeColonyFocus();
      leaveWorkspace();
      // WHAT THE UNCOVERED HOST DOES NEXT. Not a latch table: each of these is a
      // genuinely different completion, and every one of them is now a plain
      // question about the frame that came back.
      if (host === 'hand') {
        // THE CARD-PLAY STEP IS OVER — its only remaining business WAS this
        // colony. It ends through the play's ONE guarded ending, which is what
        // makes the two shapes one call: hosted (`start ⊃ hand`) the hand step
        // leaves and the deployment gets its screen back exactly where it
        // stopped; standing alone there is nothing left to show and it goes
        // home. And it still HOLDS if this play ALSO drew cards — the colony
        // was one of two things it owed. (The played hero's own closing beat
        // does this when no colony was involved — same ending, one beat
        // earlier.)
        this.endPlayCardFlow();
      } else if (host === 'card-actions') {
        // The activation's follow-up is done — the action workspace folds the
        // way every completed action does.
        this.foldWorkspaceAfterResult();
      }
    },
    // THE STRANDED-COLONY SELF-HEAL: a live SelectColony that no frame serves
    // degrades to the STANDALONE colonies — never to a prompt with no surface.
    // The deferred flush gives a mounting host its tick before the verdict.
    colonyPromptStranded: {
      flush: 'post',
      handler(stranded: boolean): void {
        if (stranded) {
          this.openColoniesForPrompt();
        }
      },
    },
    // TRADE-REWARD transaction: report the traded colony's COMMITTED track
    // position to the orchestrator. The server sequences its reset AFTER
    // every reward (including interactive colony bonuses that resolve over
    // several responses — Pluto's discards), so the reset can arrive via the
    // gated commit OR a later poll; this one watcher covers both, and the
    // reset glide runs only once the drop truly committed — AND only once the
    // glide's own stage is standing (syncColonyTrackCommit's gate).
    armedColonyTradeTrack() {
      this.syncColonyTrackCommit();
    },
    // MARKER ADVANCE lifecycle: the glide IS the flow's `moving` beat. On the
    // falling edge with a genuine LOCK (settled on the committed destination)
    // the flow advances to `resolving` — the landed stage may now pay out
    // (the reward wave / the embedded deck pick / the ceremony). An abort
    // (server refusal — the transport's error paths roll the flow back beside
    // abortHydroMarker) never advances: settledPosition stays foreign.
    'hydroMarkerState.active'(active: boolean) {
      if (active) {
        return;
      }
      const c = this.hydroFlow.commit;
      if (c === undefined || c.phase !== 'moving') {
        return;
      }
      // A genuine LOCK on the committed destination, or a DEGRADED glide over
      // a commit the SERVER already applied (the view's position is the
      // truth) — both advance; a refusal has already rolled the flow back
      // beside abortHydroMarker, so neither branch fires for it.
      const settled = hydroMarkerState.settledPosition === c.toPosition;
      const committed = (this.thisPlayer.deltaProject?.position ?? -1) === c.toPosition;
      if (settled || committed) {
        advanceHydroCommitPhase('resolving');
        // The glide WAS the execution beat: an embedded follow-up (the deck
        // pick) may mount now that the token has physically locked in.
        if (workspaceOutcomeClaimed() && workspaceOutcomeState.host === 'hydro') {
          markWorkspaceOutcomeBeatDone();
        }
      }
    },
    // The RESOLUTION's own completion signal — reward chips landed, the
    // follow-up answered, the presentation settled. Never a hardcoded
    // timeout: the result stage waits for the LAST physical event.
    // ⚠ A PARK is not completion: a deferred follow-up makes every busy
    // signal false while the decision still stands — the collapsed flow
    // waits for the restore, never walks itself to the result.
    hydroResolutionBusy(busy: boolean) {
      if (this.consoleState.task.deferred || workspaceStackCollapsed()) {
        return;
      }
      const c = this.hydroFlow.commit;
      if (!busy && c !== undefined && c.phase === 'resolving' && c.kind !== 'ceremony') {
        advanceHydroCommitPhase('result');
      }
    },
    // The result stage holds READABLE, then the flow completes on its own —
    // A/B skip the hold through the same door (`finishHydroFlow`).
    'hydroFlow.commit.phase'(phase: string | undefined) {
      if (this.hydroResultTimer !== undefined) {
        window.clearTimeout(this.hydroResultTimer);
        this.hydroResultTimer = undefined;
      }
      if (phase === 'result') {
        this.hydroResultTimer = window.setTimeout(() => {
          this.hydroResultTimer = undefined;
          this.finishHydroFlow();
        }, motionMs(HYDRO_RESULT_HOLD_MS));
      }
      this.syncHydroFramePhase();
    },
    hydroFollowUpLive() {
      this.syncHydroFramePhase();
    },
    'hydroFlow.step'() {
      this.syncHydroFramePhase();
    },
    'hydroFlow.repeatBridge'() {
      this.syncHydroFramePhase();
    },
    // The bridge flag may never outlive the browser it describes: a HARD
    // teardown (`resetConsoleRepeatPick` — game switch / shell unmount)
    // fires no callbacks, and a stale flag would leave the hydro crumb
    // claiming «ПОВТОР ДЕЙСТВИЯ» over a screen nobody is picking on.
    repeatPickActive(active: boolean) {
      if (!active && this.hydroFlow.repeatBridge) {
        setHydroRepeatBridge(false);
      }
    },
    // THE RECOVERY NET: the SERVER phase drives the flow when the glide
    // degraded (an expired arm on a slow answer never fires the marker's own
    // falling edge with the view already moved). Position committed while the
    // record still says `moving` → advance; visuals fast-forward honestly.
    hydroViewerTrackPosition(pos: number) {
      const c = this.hydroFlow.commit;
      if (c !== undefined && c.phase === 'moving' && pos === c.toPosition && !isHydroMarkerActive()) {
        advanceHydroCommitPhase('resolving');
        if (workspaceOutcomeClaimed() && workspaceOutcomeState.host === 'hydro') {
          markWorkspaceOutcomeBeatDone();
        }
      }
    },
    // The deck pick's life ended (submitted, closing beats done) — release a
    // hydro claim so the resolution can settle. (The card-actions host has
    // its own release doors; the hydro host's is this falling edge.)
    // ⚠ A DEFER also drops `deckPickActive` — but the decision still stands
    // in the park, so the claim must survive it for the restore.
    deckPickActive(active: boolean) {
      if (!active && !this.consoleState.task.deferred &&
          workspaceOutcomeState.host === 'hydro' &&
          this.hydroFlow.commit !== undefined) {
        releaseWorkspaceOutcome('hydro-pick-done');
      }
    },
    // A mandatory surface claimed the screen — the journal yields so the
    // task / placement / reveal is never hidden behind it (and never has
    // to share the pad with it).
    journalHardBlocked(now: boolean) {
      if (now && journalState.open) {
        journalState.open = false;
      }
      // The «Разыграно» overlay is the same family of board-home VIEW
      // surface — it yields to a mandatory surface identically. ONE honest
      // exception: while the hero scene owns it (the landing/result beat
      // completes first — the deferred close runs in the phase watcher
      // below). The corp first action has its OWN dedicated modal now, so a
      // stale browse always yields to a mandatory prompt.
      if (now && this.playedOpen && !this.playedHeroHolds) {
        this.closePlayedOverlay();
      }
    },
    /**
     * The played-card hero scene drives the SHELL-owned surfaces around the
     * flying card (the module owns the card; the shell owns the scenery):
     *  - 'lifting' (overlay host) → the composer closes UNDER the already-
     *    independent proxy (the hand slot stays held until the commit removes
     *    the card from the hand — the existing departingPlayCard mechanism);
     *  - 'closing' (workspace host) → the WORKSPACE FOLD: the card is docked
     *    on its pile, the result beat has played — the whole hand workspace
     *    (composer + embedded tableau + parked shelf) dissolves to the board
     *    in ONE leave. Never earlier: the workspace is the scene;
     *  - 'failed'  → the play was refused: the composer is still open —
     *    re-arm its CTA so the player can retry or cancel;
     *  - 'idle'    → transaction over: run the deferred hard-block close
     *    for a manually-open table (suppressed mid-scene above).
     */
    'playedHeroState.phase'(phase: string) {
      if (phase === 'lifting' && playedHeroState.host !== 'workspace') {
        const pending = this.pendingPlayCard;
        if (pending !== undefined) {
          this.clearDepartingPlayCard();
          this.departingPlayCard = pending.cardName;
          this.departingTimer = window.setTimeout(() => this.clearDepartingPlayCard(), 6000);
        }
        this.pendingPlayCard = undefined;
        closeConsoleLayers();
        goBoardHome();
        return;
      }
      if (phase === 'closing' && playedHeroState.host === 'workspace') {
        // The landing scene has told its whole story — the play's ONE ending
        // decides what happens to the workspace around it (see
        // `endPlayCardFlow`: it may hold for a nested step, for the cards this
        // play drew, or for a flow the player parked).
        this.endPlayCardFlow();
        return;
      }
      // THE EXECUTION BEAT of a claimed play, played out. The card has
      // physically left the hand, flown and landed on its pile — that IS the
      // «this action is happening» beat the claim withholds its surface for,
      // so it must be reported here. Left to the 2.6 s backstop instead, a
      // fast draw's reveal is still held when the deck scene starts flying its
      // cards at slots that do not exist yet, and the flight degrades.
      if (phase === 'committing' && playedHeroState.host === 'workspace' &&
          workspaceOutcomeClaimed()) {
        markWorkspaceOutcomeBeatDone();
      }
      if (phase === 'failed') {
        const composer = this.$refs.playConfirm as InstanceType<typeof ConsolePlayCardConfirm> | undefined;
        composer?.resetSubmitting?.();
        // A refused move never happened: the descent goes back to configurable,
        // or B would stay dead and the crumb would keep claiming a commit.
        if (isCommitted(workspaceFramePhase('hand') ?? 'browse')) {
          setWorkspaceFramePhase('hand', 'configure');
        }
        return;
      }
      if (phase === 'idle' && this.journalHardBlocked && this.playedOpen) {
        this.closePlayedOverlay();
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
    'patentSaleState.phase'(phase: string) {
      if (phase === 'inserting') {
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
    consoleMandatoryPresenting: {
      immediate: true,
      handler(presenting: boolean): void {
        if (presenting && this.releasePresentationLease === undefined) {
          this.releasePresentationLease = acquireForegroundLease('mandatory-choice');
        } else if (!presenting && this.releasePresentationLease !== undefined) {
          this.releasePresentationLease();
          this.releasePresentationLease = undefined;
        }
      },
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
    'consoleState.section'(section: string) {
      // `section` is a PROJECTION of the deepest frame — a hand step nested
      // INSIDE the colonies projects 'hand' while the focus stage is still
      // the standing host of its zone, and a PARKED resolution must come back
      // at full depth. The stage therefore resets only when the colonies
      // frame is genuinely GONE (neither live nor parked) — «the section
      // moved» alone is not «the player left».
      if (section !== 'colonies' && this.colonyFocus.open && !workspaceFrameKnown('colonies')) {
        resetColonyFocus();
        resetConsoleColoniesUi();
      }
      // The hand-reveal presentation follows the section on EVERY path, not
      // just the choreographed ones. While an episode runs the director owns
      // these flips (it switches the section itself — skip). Otherwise:
      //  - hand opened by ANY route (a serving task, sale) → the dock pack
      //    reads "cards are in the hand" (the derived dockLiftedNames hides
      //    the visible entries' backs), no proxies;
      //  - hand closed by ANY route (sale cancel, a task replacing the
      //    section) → the pack returns; a stuck hold is impossible.
      if (!isHandRevealEpisodeRunning()) {
        if (section === 'hand' && handRevealState.phase === 'docked') {
          handRevealState.phase = 'open';
        } else if (section !== 'hand') {
          // LEAVING the hand by any route resets the presentation — including
          // from 'opening'/'closing'.
          //
          // ⚠️ Those two used to be excluded «because they belong to a
          // director episode in its pre-install flush». The fear was real but
          // the exclusion was over-broad: that birth happens with the section
          // set TO 'hand', so this `section !== 'hand'` branch can never kill
          // it. What the exclusion DID do was strand the pre-install window —
          // `phase='opening'` + `holdSlots=true` are set BEFORE the measure,
          // so a section change in that gap latched `holdSlots` true FOREVER:
          // every hand slot rendered held (invisible), and the dock's intake
          // accent (which used to read this flag) disabled the compact pose
          // for the rest of the game.
          resetHandReveal();
        }
      }
    },
    // The journal closing for ANY reason (mandatory surface, game switch)
    // takes its read-only colony dossier with it.
    journalPanelVisible(visible: boolean) {
      if (!visible && this.journalColonyInspect !== undefined) {
        this.closeColonyInspect();
      }
    },
    // A shell-section prompt (hand-select discard/reveal / colony / play-from-
    // hand / award) can arrive BEHIND a blocking foreground presentation (the
    // Pluto draw+discard shows the drawn-cards reveal first; a bot-turn holding
    // card / theater can also be up). While busy, the prompt-change watcher's
    // section-open is skipped (`shellTask` is held). When the LAST such
    // presentation clears, open the serving surface so the still-pending prompt
    // isn't left with NO surface (the stranded guard). Respects an explicit
    // defer (the player chose to inspect the board).
    consoleForegroundBusy(busy: boolean, wasBusy: boolean): void {
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
    // The corp first-action confirm can surface AFTER a 'notification-only'
    // hold (the drawn-prelude card intake) releases — a path the reveal /
    // blocking `consoleForegroundBusy` transition above never covers. Make sure
    // the board is the section behind the modal whenever it finally opens, so a
    // later defer (B) reveals the board, not a stale hand / colonies view.
    corpFirstActionOpen(open: boolean): void {
      if (open) {
        goBoardHome();
      }
    },
    /**
     * THE START WORKSPACE'S FRAME. It stands while the opening serves it — or
     * while a step it is HOSTING is still unfinished, because an inner frame
     * can never outlive its host. That second half is why the predicate is a
     * computed and not a raw `startSceneServes` watcher: popping the hosted
     * hand makes it re-evaluate on its own, so nothing has to remember to
     * re-check the root afterwards.
     */
    /**
     * THE DRAFT WORKSPACE'S FRAME — the same lifecycle contract as the start
     * for its END: a PHASE-anchored root closed by its owner watcher
     * (`closeWorkspaceRoot`, never `goBoardHome` — that one protects a phase
     * root from steps inside it).
     *
     * The RISING edge deliberately opens NOTHING. The live draft flow derives
     * a pending MANDATORY ACTION instead (mandatoryFlowBeats → the gate): the
     * announcement waits out the ordinary-notification feed, and only the
     * player's explicit A (`openMandatoryAnnounce`) stands the frame up. That
     * is what stops the workspace from yanking the player out of whatever
     * they were reading the moment the phase flips. The falling edge is also
     * the pending action's INVALIDATION: a draft that stopped being live
     * before it was ever opened simply stops deriving — no empty transition.
     */
    draftFrameLive: {
      immediate: true,
      handler(live: boolean): void {
        if (!live) {
          closeWorkspaceRoot('draft');
          // The per-generation latches + presentation memory reset with the
          // flow (the NEXT generation's draft starts clean).
          resetDraftWorkspace();
        }
      },
    },
    startFrameLive: {
      immediate: true,
      handler(live: boolean): void {
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
    },
    /**
     * THE POST-GAME IS A PHASE ROOT (the start/draft pattern): Phase.END
     * stands the scoring workspace up; anything else marks «this load watched
     * the live game» — the ONE fact that decides whether reaching END plays
     * the ceremony (a finish the player was present for) or lands on the
     * settled result (a reload into an already-ended game must never replay
     * a reveal uninvited). The falling edge (an undo / admin rollback) tears
     * the frame down and resets the ceremony state completely.
     */
    endgameFrameLive: {
      immediate: true,
      handler(live: boolean): void {
        if (live) {
          if (!workspaceFrameKnown('endgame')) {
            enterWorkspace('endgame', {anchor: {type: 'phase', phase: 'end'}});
          }
        } else {
          if (workspaceFrameKnown('endgame')) {
            closeWorkspaceRoot('endgame');
            resetConsoleEndgame();
          }
          // AFTER the reset — the falling edge fires exactly once, and a
          // reset that wiped this note afterwards would turn the NEXT end of
          // the game (an undo, then finishing again) into a silent settle.
          noteConsoleEndgameLivePhase();
        }
      },
    },
    /**
     * THE SPONSOR STEP IS OVER when the project has physically LANDED — not
     * when the submit returned. The hero transaction is the honest completion
     * signal (it spans the request, the flight and the docking), so the frame
     * that held the hand in place through the prompt gap pops exactly here.
     * Whatever the project's own effects then ask for arrives as a normal task
     * and is served by the workspace it is already inside.
     *
     * …UNLESS the project that just landed still OWES an effect the step is
     * HOSTING (a SelectColony living one level deeper in the same teleport
     * chain). Landing is only HALF the signal; the nested frame's own falling
     * edge runs the pop instead. ONE form of that guard now, everywhere.
     */
    'playedHeroState.active'(active: boolean): void {
      if (active || workspaceFrameHost('hand') !== 'start' || workspaceFrameHasNested('hand')) {
        return;
      }
      if (!isCommitted(workspaceFramePhase('hand') ?? 'browse')) {
        return;
      }
      leaveWorkspace();
    },
    // Mirror the live gate-held state into the module so the leak detector (a
    // timer that can't recompute the shell signals) treats a held prompt as
    // legitimately served — the announcement / chip is its surface (A opens it).
    mandatoryGateHeld: {
      immediate: true,
      handler(held: boolean): void {
        setMandatoryGateHeld(held);
      },
    },
    // The beat IDENTITY changed (answered / invalidated / superseded) — retire
    // the latches that referred to the old one, so a completed action leaves
    // nothing stale and a NEXT action runs its own pending → presented cycle
    // (including re-waiting out the notification feed, per the boundary rule).
    mandatoryBeatKey: {
      immediate: true,
      handler(key: string): void {
        noteMandatoryBeatIdentity(key === '' ? undefined : key);
        // A NEW beat can be born already-ready (feed settled, nothing playing),
        // and beat A's latch → ready false → beat B → ready true can all happen
        // inside one flush — a value-equality watcher then observes true → true
        // and never fires. Latch here too; same predicate, same latch, so the
        // two writers cannot disagree.
        const beat = this.mandatoryBeat;
        if (beat !== undefined && this.mandatoryPresentationReady) {
          markMandatoryBeatPresented(beat.key);
        }
      },
    },
    // The pending → presented transition. A WATCHER, not a computed side
    // effect: presentation is a one-way latch keyed by the beat, and this is
    // its single writer. Firing on the rising edge only — once latched, the
    // readiness predicate goes false by itself (isMandatoryBeatPresented).
    mandatoryPresentationReady: {
      immediate: true,
      handler(ready: boolean): void {
        const beat = this.mandatoryBeat;
        if (ready && beat !== undefined) {
          markMandatoryBeatPresented(beat.key);
        }
      },
    },
    // Mirror the RAW admission signals into the foreground watchdog: it runs on
    // the leak detector's 1 s timer and cannot recompute them, and it needs the
    // raw values both to name what is claiming the foreground and to lift its
    // staleness mask the moment a claim goes honestly false again.
    rawAdmissionSignals: {
      immediate: true,
      deep: true,
      handler(raw: AdmissionSignals): void {
        noteAdmissionSignals(raw);
      },
    },
    // …and the watchdog's SCOPE: it may only act while the player is on the
    // board home with nothing of their own open (see boardHomeIdle).
    boardHomeIdle: {
      immediate: true,
      handler(idle: boolean): void {
        setConsoleBoardHomeIdle(idle);
      },
    },
    // Mirror the PLACEMENT verdict into the module so the board binder —
    // which mounts the legacy SelectSpace (its `mounted()` paints the
    // `.board-space--available` hex highlight) and teleports the PlacementBanner
    // to <body>, both keyed off `waitingFor` alone — holds them for exactly the
    // same window. Without it the hexes light up under the reveal modal while
    // every other placement affordance is correctly held.
    placementHeld: {
      immediate: true,
      handler(held: boolean): void {
        setConsolePlacementHeld(held);
      },
    },
    // P13: the fullscreen viewer is a native <dialog> - open it on the
    // undefined->defined transition only (navigation keeps it open).
    // The open CHOREOGRAPHY (consoleZoomMotion): the landing geometry is
    // measured on the still-CLOSED dialog, the premium lift flies a PROXY
    // on a normal fixed layer, and `showModal()` fires only at touchdown —
    // the dialog's first top-layer frame is the final, fully-visible
    // content (the compositor-safe shape; see consoleZoomMotion.ts header).
    // The chrome stays hidden (`--flight`, set BEFORE anything renders) and
    // fades in once the card has landed.
    'consoleCardZoom.card'(card: ZoomCard | undefined, prev: ZoomCard | undefined) {
      if (card !== undefined && prev === undefined) {
        this.zoomFlight = true;
        this.zoomClosing = false;
        // Mark opening SYNCHRONOUSLY here (not inside the async runZoomOpen):
        // from this instant the dialog is rendered-but-CLOSED and the landing
        // measure runs over several frames. A B press in that window must hit
        // the `zoomOpening` branch (→ cancel the open) — NOT the normal close
        // path, which would run playZoomClose over a display:none dialog (rect
        // 0×0 → dive → zoom.close() no-op → no 'close' event → zoomClosing
        // stuck true → "B closes only on the second press"). Set it before the
        // nextTick so no intent can land in the gap.
        this.zoomOpening = true;
        // The ideological focus moves to the fullscreen inspector: the
        // background focus chrome (slot rings, «A …» chips, the gliding
        // frame) goes quiet while the viewer is open.
        document.body.classList.add('con-zoom-open');
        // Bounded-retry open: on a heavy first-open frame (cold session — chunk
        // eval / style recalc in the same tick) the ref/$el may not be ready at
        // nextTick yet; a silent no-op here left the zoom state stuck open over
        // NOTHING (the "first fullscreen shows nothing" bug). Retry a few
        // frames; give up cleanly by rolling the zoom state back.
        const tryOpen = (attempt: number) => {
          if (this.consoleCardZoom.card === undefined) {
            return; // closed before it ever opened
          }
          const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
          const el = zoom?.$el as HTMLElement | undefined;
          if (zoom === undefined || el === undefined || typeof el.querySelector !== 'function') {
            if (attempt < 10) {
              requestAnimationFrame(() => tryOpen(attempt + 1));
            } else {
              this.onCardZoomClosed(); // never strand an open-but-empty zoom state
            }
            return;
          }
          void this.runZoomOpen(zoom);
        };
        void this.$nextTick(() => tryOpen(0));
      }
    },
    // The play composer owns the ideological focus while open — the hand's
    // focus chrome behind it goes quiet (same rule as the fullscreen zoom).
    /**
     * FOCUS PREWARM — the dwell timer follows the browse cursor. Arming is
     * latest-wins (riffling across the hand fires zero requests); leaving the
     * hand / entering any pick mode cancels the pending dwell outright.
     */
    focusedPlayableHandCard(name: CardName | undefined) {
      if (name === undefined) {
        cancelHandPlayPrewarm();
      } else {
        armHandPlayPrewarm(this.playerView, name);
      }
    },
    pendingPlayCard(now: PendingPlayCard | undefined) {
      document.body.classList.toggle('con-play-modal-open', now !== undefined);
      // THE DESCENT ENDS WITH THE COMPOSER, on every path — the B cancel, the
      // successful play (the composer closes under the lifted card), and a
      // prompt-identity change that moved the flow on. One place, so a phase
      // can never outlive its flow and leave the shelf parked behind nothing.
      //
      // THREE exceptions, and they are the same fact three times — something
      // this frame is CARRYING is still owed, and a host cannot fold under it:
      //  · a nested STEP (the played card's colony follow-up);
      //  · this play's own OUTCOME (the cards it drew, the pick it raised);
      //  · a step still OWED — its door is held behind the effect that arrived
      //    with it (one press, several effects). Folding here would retract the
      //    very zone that step is going to teleport into, and the grid would then
      //    open as a lateral screen instead of one level deeper.
      // Without the second one the composer's departure un-parked the browse
      // grid UNDERNEATH the embedded reveal: the hand shelf stood fully lit
      // behind the drawn card, the toolbar came back, and the crumb dropped
      // its tail — a decision surface floating over the screen it belongs to,
      // which is exactly the «modal that arrived» reading the embedding
      // exists to remove.
      if (now === undefined && !workspaceFrameHasNested('hand') && !this.handOutcomeLive &&
          !this.followUpStepOwed) {
        this.foldHandStage();
      }
    },
    // A successfully played card leaves the hand with the server response —
    // release its held slot the moment it is genuinely gone (never a fake
    // return; the safety timer below covers a rejected play). Keyed on the
    // cheap membership computed, NOT on `handEntriesAll` — see its doc.
    departingPlayCardGone(gone: boolean) {
      if (gone) {
        this.clearDepartingPlayCard();
      }
    },
    /** The focused cell (or the placed tile) changed → refetch its preview. */
    cellPreviewKey: {
      immediate: true,
      handler(): void {
        this.loadCellPreview();
      },
    },
    // Server-driven placement pulls the player to the board (§10: a
    // board-target step changes the active section, the frame persists).
    placementActive(now: boolean) {
      if (now) {
        goBoardHome();
        closeConsoleLayers();
      }
      // P20: the R3 inspect-all toggle never outlives its placement.
      this.consoleState.freeRoam = false;
      // P27: placement OWNS the board navigation — the inspection modes
      // yield (entering AND leaving placement land on a clean board home).
      this.consoleState.inspecting = false;
      this.consoleState.scaleInspecting = false;
      this.consoleState.trackMarker = undefined;
    },
    /**
     * PLANET FOCUS driver. Rising edge: the board becomes the stage (arcs
     * + off-Mars flanks recede, the planet expands, the four global-param
     * readouts freeze at their displayed values). Falling edge: the field's
     * whole story is over (pick resolved/cancelled, hero landed, field
     * rewards paid) — the exit transition returns the interface, and only
     * then may the scales move (the beat watcher below). planetFocus.ts
     * owns the phase machine; a mid-exit re-claim is a native reversal.
     */
    planetFocusTarget(now: boolean): void {
      if (now) {
        enterPlanetFocus(this.playerView.game);
      } else {
        beginPlanetFocusExit();
      }
    },
    /** The owed scale beat fires the moment the world can read it. */
    planetFocusBeatReady(now: boolean): void {
      if (now) {
        playPlanetFocusScaleBeat();
      }
    },
    /** The start ceremony fully resolved (the game began) — release any
     *  residual starting-cards delivery HOLD so the dock can never stick
     *  withheld. The normal flow already cleared it on the flight's landing;
     *  this is the belt-and-braces for a theoretical no-payment path. NOT
     *  fired on defer (`startTask` stays defined while the scene is deferred,
     *  so the hold correctly survives a board inspection). */
    startTask(now: ConsoleTask | undefined, was: ConsoleTask | undefined): void {
      // Never yank a LIVE flight — its own safety timeout reconciles it. And
      // never a HELD workspace's withhold: `startTask` flickers undefined in
      // every prompt gap of the deployment (submit round trips), while the
      // bought cards must stay out of the dock until the payment flies them in.
      if (now === undefined && was !== undefined && !startSceneHeld() &&
          handDeliveryState.held.length > 0 && !isHandDeliveryActive()) {
        resetHandDelivery();
      }
    },
    /**
     * THE COMPLETION BARRIER of a start-flow board placement (see
     * startBoardExcursion.ts). ENGAGE is the rising edge of «the serving
     * workspace yielded to a placement»; the RELEASE is owned by the quiet
     * watcher below and is confirmed a tick + a frame later, so the one
     * moment two chain signals hand off (tile settle → reveal claim) can
     * never read as «the chain is over».
     */
    startExcursionEngage(now: boolean): void {
      if (now) {
        engageStartExcursion();
      }
    },
    startExcursionQuietNow(now: boolean): void {
      if (now && startExcursionActive()) {
        this.scheduleStartExcursionRelease();
      }
    },
    /**
     * THE BONUS WINDOW CLOSED — the LEDGER says the last bonus action is spent.
     *
     * Cleared HERE, in the always-mounted shell, and deliberately not in the
     * scene: the scene is UNMOUNTED for the whole window (that is what the
     * latch does), so a watcher of its own could never observe the end of it.
     * Clearing it is what lets `startFrameLive` rise again and bring the
     * workspace back to finish the preparation.
     *
     * No debounce, and none would be honest: the ledger is server state that
     * drops only when the action is FULLY resolved, so — unlike the prompt
     * marker — it cannot blink between two legs of one card play.
     */
    'bonusActionLedgerOwed'(owed: boolean): void {
      if (!owed && consoleStartState.bonusAct.stage !== 'idle') {
        consoleStartState.bonusAct = {stage: 'idle', source: undefined};
      }
    },
    /** The workspace itself let go (the deployment settled / the game moved
     *  on) — a latch without its scene is meaningless, and it must never
     *  leak into a rematch. */
    startSceneServes(now: boolean): void {
      if (!now && startExcursionActive()) {
        releaseStartExcursion();
      }
    },
    /**
     * THE DISCARD HAND-OFF. The cinematic seizes the chosen cards out of the
     * still-open hand grid, and the moment it reaches `leaving` the pick
     * surface closes underneath the flying cards (the survivors gather home
     * into the dock, the condemned ones carry on to the pile). Driven by the
     * scene's own phase — never a timer, and never at submit time, or the
     * player would watch the hand disappear and the card silently cease to
     * exist, which is the whole bug this flow exists to fix.
     */
    'cardDiscardTransaction.phase'(phase: string, was: string | undefined): void {
      // A COLONY-BONUS discard's physical landing writes the resolution's
      // receipt: the «СБРОШЕНО» seat keeps the count between cycles.
      if (phase === 'landing' && cardDiscardColonyBonus() !== undefined) {
        noticeColonyResolutionDiscard();
      }
      // The hand-off itself is AWAITED by the sequence (phase D calls
      // `handOffHandForDiscard`), so nothing is closed from here — a watcher
      // firing alongside the orchestrator is exactly how the two used to race.
      if (phase === 'carrying') {
        this.discardFreeze = undefined; // the packet has left the surface
        return;
      }
      // SAFETY: the scene may end WITHOUT ever reaching its hand-off — the
      // server refused the answer, the response never came, an error path
      // aborted. The hand was deliberately kept open for the seize beat, so
      // something must still close it, or the player is left staring at a pick
      // surface for a decision that is already over. Only when nothing else is
      // asking for the hand (a still-pending prompt legitimately keeps it).
      if (phase === 'idle' && was !== undefined && was !== 'idle') {
        this.discardFreeze = undefined;
        if (this.consoleState.section === 'hand' && !this.handSelectUiActive) {
          this.closeSurfaceForDiscard();
        }
      }
    },
    /** A genuinely NEW decision starts at the top; returning from an overlay
     *  (same prompt, same key) keeps the action card the player opened. */
    effectDecisionKey(now: string, was: string | undefined): void {
      if (now !== '' && now !== was) {
        resetDecisionFocus();
      }
    },
    /** The shade yields to a live pick bridge (surface motion). */
    pickBridgeActive: {
      immediate: true,
      handler(now: boolean): void {
        setPickSuppressed(now);
      },
    },
    /**
     * CLIENT HAND PICK (composer → hand bridge): a composer asks the REAL hand
     * for a card, so the hand stands OVER it as an overlay frame — the composer
     * keeps its place, its state and its captures underneath. Leaving pops that
     * one frame, which puts the player back exactly where they were.
     *
     * There is no «remembered origin section» any more: the frame under the
     * overlay IS the origin, and it was never anywhere else.
     */
    handPickActive(now: boolean): void {
      if (now) {
        const selectable = new Set(this.handSelectSelectableNames);
        const idx = this.handEntries.findIndex((e) => selectable.has(e.card.name));
        this.consoleState.handIndex = idx !== -1 ? idx : 0;
        if (!workspaceFrameMounted('hand')) {
          void this.openHandWithReveal({overlay: true});
        } else {
          void this.$nextTick(() => {
            (this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined)?.ensureSelectedVisible();
          });
        }
        return;
      }
      // A DISCARD answer keeps the hand open: its cinematic has to seize the
      // card out of the real grid first and hands the surface off itself
      // (phase 'leaving'). Popping here would blank the hand a beat before the
      // card had visibly left it — the exact bug the unified discard flow
      // exists to remove.
      if (isCardDiscardActive()) {
        return;
      }
      // The play-composer pick stays in the hand it descended from (that frame
      // is not an overlay); only a hand the PICK stood up goes away again.
      if (workspaceFrameIsOverlay('hand')) {
        leaveWorkspace();
      }
    },
    /**
     * THE EMBEDDED OUTCOME'S LIFECYCLE, in one place.
     *
     * Rising edge → the zone is filled: mark it presenting (the workspace
     * drops its «Drawing cards…» beat for the real content).
     *
     * Falling edge → the flow is OVER: the batch was taken, or the pick (and
     * its payment) submitted and the server asked for nothing more. Release
     * the claim — that release is the SINGLE signal the workspace folds on, so
     * there is exactly one place that decides when an embedded outcome ends,
     * whichever kind it was.
     *
     * Deferred by a tick: one response can retire the pick and raise its
     * payment in the same flush, and reading the edge mid-flush would fold the
     * workspace between the two halves of one decision.
     */
    /**
     * A COMMITTED std-projects flow ends when everything inside it lets go.
     * The signal changes on each of those releases, so the guarded conclusion
     * is re-asked precisely then — and never in a poll.
     */
    stdpConclusionSignal(): void {
      if (!stdProjectsFlowLive() || !workspaceFrameMounted('standard-projects')) {
        return;
      }
      // ONLY the STEP's atomic commit. Two phases are deliberately NOT
      // endings here, and both cost a bug to learn:
      //  · `executing` — the round trip. `isCommitted` answers true for it,
      //    and concluding there closed the workspace mid-submit, so the
      //    follow-up it had just asked for opened as a lateral screen with no
      //    parent — the very shape this migration removes.
      //  · `completing` — the TERMINAL beat, which owns its own dismissal
      //    (the player must be able to READ the committed row). Ending it
      //    from here swallowed the beat entirely.
      if (workspaceFramePhase('standard-projects') !== 'committed') {
        return;
      }
      if (workspaceFrameHasNested('standard-projects') || this.colonyResolutionLive ||
          this.placementActive) {
        return; // a step / its payout is still owed — the conclusion holds
      }
      this.endStdProjectsFlow();
    },
    /**
     * A terminal standard project was REFUSED (server error / network). The
     * commit phrase has already unwound itself; the FLOW has to follow, or the
     * workspace would sit in its sealed `executing` beat with B dead and the
     * rows frozen. Returning to `browse` is the same rollback a lost response
     * gets — the row is immediately usable again and the reason is stated by
     * the existing alert/status path.
     */
    'stdProjectCommitState.abortNonce'() {
      if (stdProjectsFlowLive()) {
        this.rollbackStdProjectFlow();
      }
    },
    /** Publish the answer the moment it exists — the beat flips its card on it. */
    workspaceOutcomeAnswerArrived(arrived: boolean) {
      if (arrived) {
        markWorkspaceOutcomeAnswerIn();
      }
    },
    /**
     * THE PLAY'S OUTCOME IS OVER (every card taken, the pick answered — or the
     * claim turned out to host nothing at all): re-ask the play's ending, which
     * held for exactly this while the cards were on screen.
     *
     * Deferred by a tick: the take releases the claim in the same frame the
     * card detaches onto the flight layer, and the ending must land AFTER that
     * patch — the intake then measures a dock the folding workspace has already
     * uncovered. While the hero scene is still running there is nothing to
     * re-ask (its own closing beat owns the ending).
     */
    handOutcomeLive(live: boolean, was: boolean) {
      if (live || !was || isPlayedHeroActive()) {
        return;
      }
      void this.$nextTick(() => {
        if (!this.handOutcomeLive && !isPlayedHeroActive()) {
          this.endPlayCardFlow();
        }
      });
    },
    /**
     * THE HANDOFF'S SECOND HALF — the play composer unmounts once its landing
     * tableau has finished leaving, and never a frame before.
     *
     * POST-flush deliberately: the composer's own release watcher runs LATER in
     * the same flush this fact first changes in (a child's watcher after its
     * parent's), so asked pre-flush the answer would be «nothing is showing»
     * one tick too early — and clearing there is the cut this replaces.
     */
    playComposerReleasable: {
      flush: 'post',
      handler(releasable: boolean): void {
        if (releasable) {
          this.pendingPlayCard = undefined;
        }
      },
    },
    workspaceOutcomeEmbedded(embedded: boolean, was: boolean) {
      if (embedded) {
        markWorkspaceOutcomePresenting();
        // THE HANDOFF, for a CARD PLAY: its landing scene («Разыграно») held
        // the stage while the drawn cards were still coming off the deck — one
        // surface stays until the next one is actually there, never a blank
        // frame in between. The composer that carried it lets go on the
        // TABLEAU'S OWN schedule (`playComposerReleasable` below), so what is
        // being relieved dissolves instead of being cut out from under itself.
        if (workspaceOutcomeState.host === 'hand' && !isPlayedHeroActive()) {
          // …and the frame stops being a BEAT and becomes a decision about the
          // move's result: `executing` absorbs input by design (a double submit
          // must be impossible while the server has the move), which is exactly
          // wrong once the cards are on screen waiting to be taken.
          //
          // …unless what arrived is a VERDICT, which is not a decision at all:
          // nothing is chosen, owed or continued after it, so the phase is
          // TERMINAL and B is not on offer (consoleWorkspaceFlow 'verdict').
          if (workspaceFramePhase('hand') === 'executing') {
            setWorkspaceFramePhase('hand', this.revealOverlayMode === 'result' ? 'verdict' : 'committed');
          }
        }
        return;
      }
      if (!was) {
        return;
      }
      // A COLONY RESOLUTION between two of its legs (the batch was collected,
      // the mandatory discard / the next bonus cycle / the track reset is still
      // owed): the claim is the flow's ownership and stays — its release
      // belongs to the resolution's own falling edge, never to one leg's end.
      if (workspaceOutcomeState.host === 'colonies' && this.colonyResolutionLive) {
        return;
      }
      // …and «FELL» IS NOT «BEING ANSWERED ELSEWHERE IN THIS SAME WORKSPACE».
      // The optional effect a play triggered hands the screen to the workspace's
      // OWN shelf for its discard: the decision surface unmounts by design (the
      // hand IS the picker) and the discard cinematic then holds every task
      // surface closed for its whole length, so the zone is empty for both. The
      // prompt is still ours and still unanswered — read off the RAW prompt, so
      // no admission gate can make «held» look like «gone». Without this the
      // claim was released mid-pick, the flow concluded under the player, and
      // the card their discard bought arrived over an empty board.
      if (this.effectDecisionBelongsToWorkspace) {
        return;
      }
      void this.$nextTick(() => {
        // COLLAPSED is not FINISHED. Deferring the prompt unmounts its host, so
        // the embed goes false — but the decision is still outstanding and the
        // player is coming back to it. Releasing here would drop the claim,
        // fold the workspace, and hand the prompt back to a standalone band the
        // moment it was restored: the collapse would silently become a close.
        //
        // MY host, not «somebody is parked». The claim names its own host, and
        // the global flag answered for whoever happened to be minimized: a park
        // belonging to another flow skipped this release forever — and
        // `markWorkspaceOutcomePresenting` has already disarmed the 20 s
        // backstop, so the orphaned claim then suppresses the standalone
        // presenter and the drawn cards show NOWHERE.
        const host = workspaceOutcomeState.host;
        if (host !== undefined && workspaceFrameParked(host)) {
          return;
        }
        // …AND «FELL» IS NOT «STILL COMING». A drawn batch legitimately has
        // no embedded surface for the whole DEAL: the reveal is withheld
        // while the cards are physically coming off the deck
        // (`rawDrawnRevealPending` is false by design while `deckDrawHolds`),
        // so the teleport target disappears mid-flight and comes back when
        // the reveal assembles. Releasing in that window drops the claim of a
        // batch that is on its way — and the batch then arrives with nobody
        // to host it, opening a full-bleed modal over the still-standing
        // workspace (Celestic's first action: the deck deals for ~8 s).
        // The server's own unconsumed reveal is the authoritative «it is
        // coming», available long before the client can render it.
        if (deckDrawHolds() || this.rawDrawnRevealPending ||
            this.playerView.cardDrawReveals.length > 0) {
          return;
        }
        if (!this.workspaceOutcomeEmbedded && workspaceOutcomeState.stage === 'presenting') {
          releaseWorkspaceOutcome('embed-fell');
        }
      });
    },
    // A fresh playerView: reconfigure the board-info fetcher (facts may have
    // changed), clamp transient indices to the fresh lists.
    playerView: {
      immediate: true,
      handler(newView: PlayerViewModel, oldView: PlayerViewModel | undefined) {
        // The finale's placement round-trip is over. Released a TICK late on
        // purpose: the placement hero is armed by this very response, and the
        // one frame between "the answer landed" and "the hero holds the
        // foreground" is exactly the frame the screen used to blink in.
        if (this.finalGreeneryCommitting) {
          void this.$nextTick(() => {
            this.finalGreeneryCommitting = false;
          });
        }
        // SURFACE MOTION — resolve the awaiting handoff (the composer held
        // the stage through the submit round-trip). PRE-FLUSH on purpose:
        // the DOM is still the OLD tree, so the departing composer can be
        // measured HERE for the incoming reveal's anchored FLIP; the close +
        // the reveal's mount then land in the SAME patch — no blank frame.
        // THE SERVER ANSWERED. This is the one place that is true BY
        // DEFINITION on a fresh response, so the execution beat's flip is
        // released from here rather than from a computed chain
        // (`hostTask` → `taskBelongsToWorkspace`), which depends on the
        // admission gate and can settle a tick or more later — long enough for
        // the beat to sit face-down waiting on a flag that had no reason to
        // arrive, and to time out on its backstop instead of flipping.
        if (workspaceOutcomeClaimed()) {
          markWorkspaceOutcomeAnswerIn();
          // …AND SETTLE AN OPTIMISTIC CLAIM AGAINST WHAT ACTUALLY CAME BACK. A
          // card PLAY claims before knowing what it produces, deliberately —
          // a triggered effect (Point Luna's Earth tag) draws cards no preview
          // can advertise, so «claim and release if unused» is the only way to
          // catch them. This is the other half of that bargain: a tick later
          // the artifact is readable, and a claim that hosts nothing is dropped
          // instead of expiring on its 20 s backstop — twenty seconds in which
          // its workspace cannot conclude and the player stands in a stage with
          // nothing in it. It releases only on POSITIVE evidence that the
          // outcome went elsewhere, so a real one is never touched. The other
          // hosts claim structurally and settle through their own paths (the
          // action's awaiting handoff, the colony's own call above).
          if (isPlayOutcomeHost(workspaceOutcomeState.host)) {
            this.reconcileWorkspaceOutcome();
          }
        }
        const awaiting = surfaceMotionState.awaiting;
        if (awaiting !== undefined) {
          const lr = newView.lastReveal;
          const resolution = resolveAwaiting(awaiting, {
            gameAge: newView.game.gameAge,
            undoCount: newView.game.undoCount,
            revealArrived: lr !== undefined && `${lr.action}|${lr.revealed.name}` !== this.dismissedRevealKey,
          }, typeof performance !== 'undefined' ? performance.now() : Date.now());
          if (resolution.kind !== 'hold') {
            // An outcome CLAIMED by an open workspace stays IN-FRAME: the
            // workspace keeps the scene and presents it as its own next phase,
            // so neither the close nor the standalone-overlay phase swap runs.
            //  · deck-check — «Действия карт › Результат вскрытия»;
            //  · draw       — «Действия карт › Добор карт», the embedded reveal.
            // The DRAW arm is deliberately NOT gated on `resolution.kind`: a
            // plain draw resolves as an ordinary dismiss (there is no reveal
            // marker to make it a phase), and that dismiss is exactly what used
            // to blank the workspace and hand the batch to the full-bleed band.
            // A LIVE claim also holds the surface. At this pre-flush moment the
            // artifact may not be readable yet (`drawnCardsState` reconciles on
            // the new view, and a follow-up prompt only routes after the patch),
            // so the claim itself is the verdict and `reconcileWorkspaceOutcome`
            // settles it a tick later — closing here on a guess is what handed
            // the batch to the full-bleed band in the first place.
            const claimedInFrame = (resolution.kind === 'phase' &&
              consoleActionComposerUi.revealClaim !== '' &&
              lr !== undefined && lr.action === consoleActionComposerUi.revealClaim) ||
              workspaceClaimsDrawReveal(currentRevealEvent()?.source) ||
              workspaceOutcomeState.sourceCard !== '' ||
              // A SelectColony follow-up standing INSIDE the action workspace:
              // the composer stays and hosts the colonies step — dismissing it
              // here would tear down the very frame the step lands in.
              workspaceFrameHasNested('card-actions');
            if (claimedInFrame) {
              clearAwaitingHandoff();
              // The workspace's own stages carry the outcome from here — the
              // commit beat's job is done, its plan unused (a draw's reward
              // is the cards themselves).
              releaseActionCommit();
              this.reconcileWorkspaceOutcome();
            } else {
              // ── ACTION COMMIT resolution (non-embedded results). The rail
              //    freezes NOW — pre-flush, before this view commits — so a
              //    counter can never tick ahead of the chips about to fly
              //    out of the action graphic (the reward wave's contract).
              const commitPlan = consumeActionCommitPlan();
              if (commitPlan !== undefined && commitPlan.specs.length > 0) {
                beginPanelRewardHold(commitPlan.specs);
              }
              const finishDismiss = () => {
                // The wave FIRST (chips are born over the still-standing
                // icons), then the workspace folds UNDER them — the result
                // outlives the surface that produced it.
                if (commitPlan !== undefined) {
                  this.runCommitRewardWave(commitPlan);
                }
                // Capture the departing composer UNCONDITIONALLY — the incoming
                // surface consumes it only when the pair is phase-linked
                // (departureUsable), so a reveal FLIPs the source card while a
                // follow-up task host (a Helion payment, an OrOptions branch)
                // enters as the continuation of the same activation.
                captureSurfaceDeparture(awaiting.from,
                  document.querySelector(`[data-motion-surface="${awaiting.from}"]`));
                clearAwaitingHandoff();
                closeConsoleLayers();
                releaseActionCommit();
              };
              // A fast server must not cut the minimum readable commit: the
              // dismiss waits for the beat's settle (never a timer — the
              // motion's own completion releases it; a dead stage releases
              // through the beat's short backstop).
              if (actionCommitHolding()) {
                this.pendingCommitDismiss = finishDismiss;
              } else {
                finishDismiss();
              }
            }
          }
        }
        // Draft tray: mark a live pick beat answered, reconcile optimistic
        // state, and ARM the research-rise scene on the draft→buy
        // transition (pre-flush — the buy frame mounts already knowing).
        observeDraftTransition(oldView, newView);
        // The draft WORKSPACE's own latches (pick total / pass direction /
        // hydration cue) — beside the tray observer, same pre-flush timing.
        observeDraftWorkspace(oldView, newView);
        // Colony-trade transaction: observe EVERY commit path. The staged
        // bot pipeline (a trade that ends the turn carries the bot's turns)
        // and a poll after a lost response bypass the transport's gated detect;
        // this fallback claims the manifest there and kicks the reward waves
        // exactly once after whichever commit carried it (idempotent).
        noticeColonyTradeCommit(newView);
        // A COLONIES claim has no awaiting handoff to ride — the trade
        // transaction owns its own pacing (`holdFocusStage`), so it never
        // arms `surfaceMotionState.awaiting` and the reconcile guarded by it
        // above is UNREACHABLE from here. Without this a claim that turned
        // out to have nothing to present (a card colony traded at a
        // zero-quantity position) would stand as an empty follow-up stage,
        // pinning `completeFlow`, until the 20 s claim backstop. The
        // reconcile itself only releases on POSITIVE evidence that the
        // outcome went elsewhere, so a real payout — whose reveal is already
        // readable by the `$nextTick` this defers to, or is still held by the
        // deck-draw scene it explicitly asks about — is never touched.
        if (workspaceOutcomeState.host === 'colonies') {
          this.reconcileWorkspaceOutcome();
        }
        // Government Support scale-focus gate: if the last action was a WGT
        // parameter raise, HOLD the next modal for a beat so the board scale
        // glide (+ top-HUD delta chip) is seen in one focused place. Snap to
        // the board so that feedback is actually visible during the hold.
        if (commitGovScaleFocus()) {
          goBoardHome();
          closeConsoleLayers();
        }
        configureBoardInfo({
          participantId: this.playerView.id,
          color: this.thisPlayer.color,
          boardName: this.game.gameOptions.boardName,
          players: this.playerView.players,
        });
        // `configureBoardInfo` just dropped the fact caches because the board
        // may have moved under us (an opponent's tile landed while we choose) —
        // the focused cell's preview is stale for the same reason. The key is
        // unchanged, so the watcher won't fire: refetch here.
        this.loadCellPreview();
        this.consoleState.handIndex = stepIndex(this.consoleState.handIndex, 0, this.handEntries.length);
        this.consoleState.sheetIndex = this.consoleState.sheet === 'standardProjects' ?
          stepIndex(this.consoleState.sheetIndex, 0, this.stdProjectItems.length) :
          stepSelectable(this.consoleState.sheetIndex, 0, this.sheetRows.map((r) => r.kind !== 'header'));
        this.consoleState.colonyIndex = stepIndex(this.consoleState.colonyIndex, 0, this.coloniesForRail.length);
        // (The trade window closing externally no longer force-closes
        // anything: the COLONY FOCUS STAGE is reactive — its CTA drops and
        // the verdict states the reason, an honest dossier, not a stale form.)
        // A resolved convert-plants prompt (server moved on) drops the local picker.
        if (this.convertPlantsPending !== undefined &&
            findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true) === undefined) {
          this.convertPlantsPending = undefined;
        }
        // The sell-patents window closed externally → drop the stale sale mode
        // (and fold the hand STEP it was standing in, if the std-projects flow
        // hosted one — a step whose mode died must not keep the descent).
        if (this.consoleState.sale.active && findSellPatentsAction(this.playerView.waitingFor) === undefined) {
          this.consoleState.sale.active = false;
          this.consoleState.sale.selected = [];
          if (workspaceFrameHost('hand') === 'standard-projects' && !isPatentSaleActive()) {
            popWorkspaceFrame();
            this.rollbackStdProjectFlow();
          }
        }
        // THE STD-PROJECTS FLOW answers its own round trip BEFORE the generic
        // prompt-identity reconciliation below: a terminal project's response
        // re-arrives on the SAME action-menu identity, so the identity block
        // alone would never see it.
        this.reconcileStdProjectsFlow();
        // T6: the server cleared the reveal result → the ack marker is stale.
        if (this.playerView.lastReveal === undefined && this.dismissedRevealKey !== '') {
          this.dismissedRevealKey = '';
        }
        // CTS: a NEW prompt identity resets the defer + stale nested picks.
        const key = promptIdentityKey(this.playerView.waitingFor);
        if (key !== this.lastTaskKey) {
          this.lastTaskKey = key;
          this.consoleState.task.deferred = false;
          // …and a flow the player set aside is STALE the moment the server
          // asks for something else: restoring it would put them back inside a
          // decision that no longer exists.
          discardWorkspacePark();
          // THE INVARIANT: `parked` non-empty ⇒ `deferred`. A phase-anchored
          // root SURVIVES that discard (the opening is not a flow — it IS the
          // phase), and `deferred` is the flag every way back is gated on:
          // `mandatoryDeferredActive` renders the restore card on it, B reads
          // that same computed, and `restoreWorkspaceStack` has exactly one
          // caller behind them. Clearing it with frames still parked leaves
          // them owned by nobody and reachable by nothing.
          if (workspaceStackCollapsed()) {
            this.consoleState.task.deferred = true;
          }
          this.taskSpacePending = undefined;
          this.finalGreeneryPickPending = false;
          // A client payment built for a prompt that moved on is stale.
          this.pendingClientPayment = undefined;
          // Same for the native play confirm (its playAction path moved on) —
          // EXCEPT mid workspace landing scene: the prompt change IS the
          // commit of the very play this composer hosts, and its embedded
          // tableau must live until the fold (the 'closing' teardown owns the
          // clear there). An abandoned composer with no armed transaction
          // still clears here as before.
          if (!(isPlayedHeroActive() && playedHeroState.host === 'workspace')) {
            this.pendingPlayCard = undefined;
          }
          // A client hand pick belongs to a composer whose prompt just moved
          // on — cancel it (idempotent; restores the section via the watcher).
          cancelConsoleHandPick();
          // Same for a repeat-action pick whose source composer's prompt moved on.
          cancelConsoleRepeatPick();
          // A NEW prompt resets the mandatory hand-SELECT picks + filter (they
          // survive a defer→resume of the SAME prompt, but never leak across
          // prompts). Cleared here rather than in closeConsoleLayers so the
          // defer→resume path keeps a multi-select's accumulated picks.
          this.consoleState.select.selected = [];
          this.consoleState.select.suitableOnly = true;
          // The card-action center is a VOLUNTARY surface — if the top prompt
          // moved off the action menu (a sub-prompt / another player's turn),
          // close it so its dedicated surface can't overlap another one. It
          // survives a 'first action' → 'next action' menu change (still the
          // action menu — same task kind).
          //
          // …EXCEPT when the new prompt is this workspace's OWN OUTCOME. The
          // rule above predates embedded outcomes and reads every non-menu
          // prompt as "someone else's", which is precisely why buying a
          // revealed card tore the workspace down and handed the prompt to a
          // standalone band: the player watched «ДЕЙСТВИЯ КАРТ» disappear and
          // an unrelated window take its place. A claimed prompt is not
          // another surface's — it is the next stage of the action the player
          // just confirmed HERE, so the workspace stays and hosts it.
          // A hosted STEP is the same fact for a SelectColony follow-up: the
          // workspace is standing around the colonies right now.
          if (workspaceFrameMounted('card-actions') &&
              taskFor(this.playerView)?.kind !== 'actionMenu' &&
              !workspaceOutcomeClaimed() &&
              !workspaceFrameHasNested('card-actions')) {
            leaveWorkspace();
            this.consoleState.sheetIndex = 0;
          }
          // A shell-section task (T3/T4) auto-opens its serving surface —
          // unless something is still SET ASIDE (the invariant above). While a
          // park is owed, the restore card is the one door: auto-opening here
          // would stand a screen up beside a parked chain that already owns a
          // workspace of its own, and the first restore would then splice the
          // live stack away underneath the player with no close and no fold.
          // (`consoleForegroundBusy`'s auto-open is gated the same way.)
          //
          // …and it asks the DOOR's admission, not the section's. `shellTask` is
          // a PRESENCE computed: it deliberately waits for less than an opening
          // does (holding a live section for `card-arrival` would unmount the
          // stage a cinematic is playing on — see `followUp`). Response-driven
          // auto-opening is an OPENING, so a prompt that rides the same payload
          // as a still-running effect waits here; `consoleForegroundBusy`'s own
          // watcher opens it the moment that effect is finished.
          const shellTask = this.shellTask;
          if (shellTask !== undefined && !this.consoleState.task.deferred && this.admits('followUp')) {
            this.openShellTaskSurface(shellTask);
          }
        }
      },
    },
  },
  methods: {
    /**
     * May this prompt-surface family come alive right now? THE single admission
     * question — every family asks it, none re-derives it (consolePromptAdmission).
     */
    admits(surface: PromptSurface): boolean {
      return isPromptAdmitted(surface, this.admissionSignals);
    },
    // ── THE WORKSPACE STACK — the shell's whole navigation vocabulary ──────
    /** Presence, from the stack. The ONE `v-if` of every hostable screen —
     *  re-exported here because an Options-API template resolves against the
     *  instance, not the module scope. */
    workspaceFrameRenders(kind: WorkspaceFrameKind): boolean {
      return workspaceFrameRenders(kind);
    },
    /** B = one logical level (template door — same reason as above). */
    leaveWorkspace(): void {
      leaveWorkspace();
    },
    /**
     * «СВЕРНУТЬ» — ONE verb, and it cannot half-happen.
     *
     * The whole stack parks at full depth (both projections go to the board in
     * the same tick) and the pending decision minimizes with it, so the
     * board-home card is always the way back. It used to be written out by hand
     * at six sites as «defer the task, then set the section» — a CONDITIONAL
     * defer next to an UNCONDITIONAL navigation, which is exactly how a live
     * colony pick ended up on screen nowhere with no card to return to.
     */
    collapseWorkspace(): void {
      // THE HAND GOES HOME PHYSICALLY. Collapsing a stack whose visible step
      // is the OPEN hand plays the standard gather (grid → dock) first — the
      // bare park v-ifs the grid away and every dock back popped in on one
      // frame («карты в доке просто появляются одним кадром»). Reduced motion
      // keeps the instant park (its own honest short form), and a running
      // episode already owns the moment.
      if (this.consoleState.section === 'hand' && handRevealState.phase === 'open' &&
          !isHandRevealEpisodeRunning() && !consoleReducedMotionActive()) {
        void this.collapseWithHandGather();
        return;
      }
      this.parkWorkspaceStack();
    },
    /** The bare park — the collapse's state half, shared by both paths. */
    parkWorkspaceStack(): void {
      collapseWorkspaceStack();
      this.consoleState.task.deferred = true;
      // The composer's command contract is published to a SHARED store and
      // released in its own `beforeUnmount` — one flush too late, so the bar
      // would advertise a stage that no longer serves for a frame. Clearing it
      // here is what makes the collapse atomic.
      resetConsoleActionComposerUi();
    },
    /**
     * COLLAPSE WITH THE HAND'S GATHER: measure the live grid while it still
     * stands, start the standard close episode, and only then park — the
     * proxies fly over the board (the park is this path's `setSection`, one
     * tick before the episode's own hook fires against an already-empty live
     * stack, where it is a no-op). The section watcher can't reset the
     * presentation mid-flight: the episode registers synchronously.
     */
    async collapseWithHandGather(): Promise<void> {
      const section = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      const dock = this.$refs.handDock as InstanceType<typeof ConsoleHandDock> | undefined;
      const t = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};
      const sources = dock?.sourceRects(t.pairs.map((p) => p.name)) ?? new Map<string, RevealRect>();
      const pairs: Array<RevealPair> = [];
      for (const p of t.pairs) {
        const source = sources.get(p.name);
        if (source !== undefined) {
          pairs.push({name: p.name, source, target: p.rect, visible: p.visible, clip: p.clip, visual: this.revealVisualFor(p.name)});
        }
      }
      if (pairs.length === 0) {
        // Nothing measurable — the honest instant park (never a zero-pair
        // episode, whose empty-input path would pop the hand frame BEFORE
        // the park and lose the step's depth).
        this.parkWorkspaceStack();
        return;
      }
      const episode = runHandCloseEpisode(pairs, t.scrollTop);
      this.parkWorkspaceStack();
      await holdDockIntakeAccent('hand-close', episode);
    },
    /**
     * Stand the HAND up: a screen of its own, or a STEP inside whatever flow is
     * already open (the start's play-from-hand prelude — «Эпатажный спонсор»).
     * `overlay` is the client PICK BRIDGE: the hand takes the screen while the
     * asking composer waits underneath with its captures intact.
     */
    openHandWorkspace(opts?: {overlay?: boolean}): void {
      if (this.restoreParkedWorkspace('hand') || workspaceFrameIndex('hand') !== -1) {
        return;
      }
      // Nothing open → a screen of its own. Standing INSIDE a flow that can host
      // a step → a step of it (the colony resolution's mandatory discard, the
      // start's play-from-hand prelude — ONE workspace root either way). Only a
      // frame genuinely MID-FLOW that cannot host earns an OVERLAY (the pick
      // bridge, whose surface below hides itself); a stack idling at its browse
      // layer is a lateral move — overlaying it painted TWO live workspaces
      // side by side (the reported hand + colonies split screen).
      const host = opts?.overlay === true ? undefined : workspaceHostForStep();
      const top = workspaceStackTop();
      if (host === undefined && opts?.overlay !== true &&
          (top === undefined || top.phase === 'browse')) {
        enterWorkspace('hand');
        return;
      }
      pushWorkspaceFrame({
        kind: 'hand', subject: '', stage: '', phase: 'browse',
        serves: ['projectCard', 'handSelect'], anchor: {type: 'always'},
        overlay: host === undefined,
      });
    },
    /**
     * A SelectColony arrived — stand the colonies where they BELONG: inside the
     * nearest live unfinished step, or as a screen of their own. The `prompt`
     * anchor is what later says «the demand brought the player here, so hand the
     * screen back when it is met».
     */
    openColoniesForPrompt(): void {
      if (this.restoreParkedWorkspace('colonies')) {
        return;
      }
      const host = workspaceHostForStep();
      const anchor: FrameAnchor = {type: 'prompt', promptType: 'colony'};
      if (host === undefined) {
        enterWorkspace('colonies', {anchor});
      } else if (host === 'standard-projects' && this.colonyCancellable) {
        // The STD-PROJECTS flow's pay-on-commit target step: NOTHING is spent
        // yet (the server marks the pick cancellable), so the flow is still
        // REVERSIBLE — the crumb stays cyan, B cancels server-side for free
        // and folds back to the very row the player left. The colony's own
        // confirm is the single atomic commit.
        this.armStdpStepOrigin();
        setWorkspaceFramePhase(host, 'configure');
        pushWorkspaceFrame({
          kind: 'colonies', subject: '', stage: 'Colony selection', phase: 'configure',
          serves: ['colony'], anchor,
        });
      } else {
        // The host's own beat is OVER — what remains is a decision about its
        // result. Past the commit boundary its B means «collapse», and its
        // crumb tail hands over to the step now standing inside it.
        setWorkspaceFramePhase(host, 'committed');
        pushWorkspaceFrame({
          // The SAME stage name the section publishes up on mount (and the same
          // one the reversible branch above pushes): a frame that opens under a
          // placeholder its own surface immediately corrects makes the crumb
          // tail animate twice to say one thing.
          kind: 'colonies', subject: '', stage: 'Colony selection', phase: 'committed',
          serves: ['colony'], anchor,
        });
      }
      // Land on the first PICKABLE tile so A is meaningful immediately.
      const pick = this.colonyPick;
      const first = pick !== undefined ?
        this.coloniesForRail.findIndex((c) => pick.selectable.includes(c.name)) : -1;
      this.consoleState.colonyIndex = first !== -1 ? first : 0;
    },
    /**
     * A CARD ACTION WALKED INTO THE TRADE. The frame is already pushed (the
     * card-actions surface owns that — it is its own step), so the shell only
     * does what it does for every colony arrival: land the cursor where A is
     * meaningful, i.e. on the first colony this player may actually trade with.
     */
    onCardActionsColonyStep(): void {
      const first = this.coloniesForRail.findIndex((c) => this.tradeableColonyNames.includes(c.name));
      this.consoleState.colonyIndex = first !== -1 ? first : 0;
    },
    /**
     * PLUTO COMES HOME. A trade/build payout needs its own surface back: the
     * covers launch from the traded tile and the reveal lands in the section's
     * zone. Re-entering is a NO-OP while the colonies already stand (embedded
     * or not), so this can never swap the section under a hosting workspace.
     */
    bringColoniesHome(): void {
      if (workspaceFrameMounted('colonies')) {
        return;
      }
      enterWorkspace('colonies', {anchor: {type: 'prompt', promptType: 'colony'}});
      // A workspace re-entered MID-RESOLUTION (a reload, a self-heal) stands
      // straight at the resolution's own depth: committed, hosting, serving
      // the mandatory discard — the rising-edge watcher fired long ago.
      if (this.colonyResolutionLive) {
        setWorkspaceFramePhase('colonies', 'committed');
        setWorkspaceFrameServes('colonies', COLONY_RESOLUTION_SERVES);
      }
    },
    /** Land the cursor on the first pickable card of a hand select. */
    focusFirstSelectableHandCard(): void {
      const selectable = new Set(this.handSelectSelectableNames);
      const idx = this.handEntries.findIndex((e) => selectable.has(e.card.name));
      this.consoleState.handIndex = idx !== -1 ? idx : 0;
    },
    /**
     * Report the traded colony's COMMITTED track position — GATED on the
     * glide's stage. While the full-stage discard owns the room, or the
     * post-discard focus restore is still owed, the committed reset is held
     * back: the marker's return is the resolution's FINAL commit beat, played
     * on the colony's own big track. The restore flushes this.
     */
    syncColonyTrackCommit(): void {
      const value = this.armedColonyTradeTrack;
      if (value === undefined || colonyTradeState.colonyName === '') {
        return;
      }
      if (colonyResolutionUi.discardStage || this.colonyFocusRestorePending) {
        return;
      }
      notifyColonyTradeTrackCommitted(colonyTradeState.colonyName as ColonyName, value);
    },
    /**
     * THE POST-DISCARD RETURN — the resolution comes back from the hand to
     * the colony's own focus: the source chip re-expands into the hero stage,
     * a held next-cycle batch gets its zone republished, and only then the
     * deferred track commit is reported (the final glide plays on the big
     * track). Runs after the hand physically gathered into the dock.
     */
    async restoreColonyFocusAfterDiscard(): Promise<void> {
      const name = this.colonyResolutionColonyName;
      if (this.colonyResolutionLive && workspaceFrameMounted('colonies') &&
          !this.colonyFocus.open && name !== '') {
        const idx = this.coloniesForRail.findIndex((c) => c.name === name);
        this.consoleState.colonyIndex = idx !== -1 ? idx : 0;
        // FOCUS FIRST, flag second: the browse grid stays yielded (the
        // discard-stage flag keeps it hidden) until the focus stage is
        // genuinely standing over it — clearing the flag first uncovered the
        // overview grid for the one-two frames of the swap, and «не
        // показывать Overview даже на один кадр» is the contract.
        // …in the composition the resolution belongs to: a FOREIGN trade's
        // payout comes back to its bonus stage, not to the trade dossier it
        // never opened (the entry context is what tells them apart).
        openColonyFocus(name as ColonyName,
          this.bonusEntry.colonyName === name ? 'bonus' : 'inspect');
        await this.$nextTick();
        setColonyDiscardStage(false);
        // Let the stage publish its zones before anything measures against it
        // (the settle beat of the restore — a held batch opens on it now).
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));
      } else {
        setColonyDiscardStage(false);
      }
      this.colonyFocusRestorePending = false;
      this.syncColonyTrackCommit();
    },
    /**
     * THE OWNER-BONUS ENTRY — the colony workspace opens DIRECTLY on the
     * colony's focus stage in its bonus context (never the overview: the
     * player is here to answer one colony's payout). Used by the remote
     * entry (another player traded) and by a reload straight into the
     * resolution; the viewer's own trade is already standing here.
     *
     * The TRADER is authoritative game state: the trade parked their fleet on
     * the colony (`visitor`), so the stage can honestly say whose trade
     * triggered the bonus without a new server field.
     */
    enterColonyBonusStage(colonyName: string, traderHint?: Color): void {
      const colony = this.coloniesForRail.find((c) => c.name === colonyName);
      // The SERVER names the trader when it knows them (the collect marker);
      // the colony's parked visitor is the fallback for a discard-marked
      // entry, which carries no colour of its own.
      const traderColor = traderHint ?? colony?.visitor;
      const trader = traderColor !== undefined ?
        this.playerView.players.find((p) => p.color === traderColor) : undefined;
      armColonyBonusEntry(colonyName as ColonyName, trader !== undefined ?
        {color: trader.color, name: participantDisplayName(trader)} : undefined);
      if (!workspaceFrameMounted('colonies')) {
        enterWorkspace('colonies', {anchor: {type: 'prompt', promptType: 'card'}});
      }
      setWorkspaceFramePhase('colonies', 'committed');
      setWorkspaceFrameServes('colonies', COLONY_RESOLUTION_SERVES);
      const idx = this.coloniesForRail.findIndex((c) => c.name === colonyName);
      this.consoleState.colonyIndex = idx !== -1 ? idx : 0;
      if (!this.colonyFocus.open) {
        // THE BONUS COMPOSITION, not the trade dossier: the player did not come
        // to weigh an action here — somebody else's trade owes them one thing.
        // (`inspect` put the whole trade screen up and hid the actual decision
        // inside it.)
        openColonyFocus(colonyName as ColonyName, 'bonus');
      }
      // The workspace claims the payout: the reveal presents INSIDE it and the
      // deck-draw scene SERVES the claim (the cards honestly come off the deck
      // and fly into the embedded slots — the start-host pattern). No execution
      // beat exists for an entry, so it is marked done outright.
      //
      // `pick` rides along because an owner bonus has THREE shapes and one of
      // them is a card TARGET pick («куда положить ресурс»): the claim is what
      // re-homes that prompt into this stage's own zone (`taskEmbedTarget` →
      // `workspaceClaimsPick`) instead of raising a band over the colony that
      // is paying it.
      if (workspaceOutcomeState.host !== 'colonies') {
        claimWorkspaceOutcome('colonies', colonyName, ['draw', 'pick']);
        markWorkspaceOutcomeArrivalDone();
      }
      markWorkspaceOutcomeBeatDone();
      // …AND THE WAIT IS ALREADY OVER IF THE PAYOUT IS ALREADY REAL — which is
      // the ordinary case: the marker that opened this door is pending from the
      // same tick. Read here rather than left to the evidence watcher, which
      // fires on a CHANGE and would have nothing to change.
      if (this.colonyResolutionEvidence) {
        noteColonyBonusEntryWaitOver();
      }
    },
    /**
     * COLLECT the colony bonus ANOTHER player's trade paid the viewer — the
     * whole flow of Miranda's «возьмите карту», and Pluto's twin minus the
     * discard.
     *
     * The press is the ANSWER and the JOURNEY at once: the workspace opens on
     * the paying colony (bonus context, the trader named) FIRST — so the claim
     * exists before anything can arrive — and only then does the collect go to
     * the server. The card is drawn inside that answer, so it flies from the
     * deck into the workspace's own zone instead of appearing in a hand
     * nobody looked at.
     */
    openColonyBonusCollect(meta: ColonyBonusCollectMeta): void {
      this.enterColonyBonusStage(meta.colonyName, meta.trader);
      this.submit({type: 'option'});
    },
    /**
     * A COLONY-BONUS DISCARD routed to its owner. Two moments reach here:
     *  · the ENTRY (remote bonus / reload) — the batch is still on the table:
     *    the workspace + bonus stage open and the reveal runs its course; the
     *    discard step opens later from the reveal's own closer;
     *  · the CLOSER (every card taken) — the hand mounts INSIDE the colony
     *    workspace as a step (`hosts: 'inFlow'`), and the crumb reads
     *    «КОЛОНИИ › <колония> › СБРОС КАРТЫ». Never a second workspace root.
     */
    openColonyBonusDiscard(meta: ColonyBonusDiscardMeta): void {
      if (!workspaceFrameMounted('colonies')) {
        this.enterColonyBonusStage(meta.colonyName);
      } else {
        setWorkspaceFramePhase('colonies', 'committed');
        setWorkspaceFrameServes('colonies', COLONY_RESOLUTION_SERVES);
      }
      const ev = currentRevealEvent();
      const untaken = ev === undefined ? 0 : ev.cards.length - ev.takenIndices.size;
      if (untaken > 0) {
        // The bonus card must be COLLECTED first — the reveal owns the screen
        // and its closer brings the flow back here once everything is taken.
        return;
      }
      // THE FULL-STAGE DISCARD. Comparing every card is this phase's one job,
      // so the hand owns the whole central area: the focus stage yields (the
      // colony survives as the section's SOURCE CHIP, the shared element the
      // restore later re-expands from), the claimed reveal slot goes empty
      // (a next-cycle batch parks until the restore), and the REAL hand opens
      // with its own premium dock→grid reveal — never a ready-made grid.
      setColonyDiscardStage(true);
      if (this.colonyFocus.open) {
        // A DIRECT transition: the stage exits with the quick quiet fade —
        // the full fold-to-tile re-materialized the colony composition for a
        // second between the reveal and the hand.
        armColonyFocusQuickExit();
        closeColonyFocus();
      }
      void this.openHandWithReveal({keepTask: true});
      setWorkspaceFrameStage('hand', 'Discarding a card');
      this.focusFirstSelectableHandCard();
    },
    /**
     * THE HAND'S EXIT once it has answered. An OVERLAY hand pops, uncovering
     * the flow that asked for the card exactly where it was left; a hand the
     * player is standing in alone has nothing under it and goes home.
     */
    leaveHandAfterAnswer(): void {
      // The CLOSE EPISODE may already have returned the hand (its director
      // speaks the same verbs) — acting again on an absent frame would pop
      // the HOST instead, which is how a finished discard once took the whole
      // colony resolution down with it.
      if (workspaceFrameIndex('hand') === -1) {
        return;
      }
      // A HOSTED hand — an overlay (pick bridge) or an embedded step (the
      // colony resolution's discard) — pops one level, uncovering the flow
      // that asked for the card exactly where it was left. Only a hand the
      // player stood in alone goes home.
      const verb = this.handExitVerb();
      if (verb === 'none') {
        return;
      }
      if (verb === 'pop') {
        leaveWorkspace();
        return;
      }
      closeConsoleLayers();
      goBoardHome();
    },
    /**
     * WHAT LEAVING THE HAND MEANS RIGHT NOW — ONE answer, for the two sites
     * that ask it: the answer path above and the close episode's own director
     * (`setHandRevealHooks.setSection`).
     *
     * Both used to spell the law out for themselves, and both were wrong in the
     * same way at different times. A HOSTED hand pops ONE level — spelled
     * `goBoardHome` in the director, which wiped the whole stack out from under
     * the colony resolution the instant the gather finished. And a hand whose
     * OWN FLOW is still owed does not leave AT ALL — spelled «go home» in both,
     * which dropped the player on the board in the middle of the effect their
     * play had triggered, so the card their discard bought then arrived as a
     * full-bleed reveal over an empty board. Two sites, one law, two separate
     * bugs: the law is stated once now.
     */
    handExitVerb(): 'none' | 'pop' | 'home' {
      if (workspaceFrameIndex('hand') === -1) {
        return 'none';
      }
      if (workspaceFrameHost('hand') !== undefined) {
        return 'pop';
      }
      // A flow ends through its ONE guarded conclusion, never through an answer
      // given inside it: while this workspace still holds the claim of the play
      // made in it, everything that play set off is still coming HERE.
      return this.handOutcomeLive ? 'none' : 'home';
    },
    /** The card-play descent is over — the hand's frame folds back to its
     *  parked browse grid (selection, filter and scroll intact). */
    foldHandStage(): void {
      if (workspaceFrameDescended('hand') && !workspaceFrameHasNested('hand')) {
        foldWorkspaceFrame();
      }
    },
    /** Titles of the inner SelectOptions — the server's claimable/fundable set. */
    /**
     * Fetch the focused cell's placement preview (the same bounded read-only
     * `/api/game/board-cell-preview?kind=` the desktop hover popover uses, so
     * the two surfaces can never diverge). Only `boardCellPreview` carries the
     * placement CONSEQUENCES — the M€ cost, the Ares hazard-adjacency "reduce a
     * production" penalty, the adjacency bonuses and who else receives them;
     * `boardCellInfo` (the hover facts the panel already had) describes the cell
     * as it stands and would never mention them.
     */
    loadCellPreview(): void {
      const token = ++this.cellPreviewToken;
      const prompt = this.placementSpaceModel;
      const id = this.consoleState.boardSpaceId;
      if (this.cellPreviewKey === '' || prompt?.placementType === undefined || id === undefined) {
        this.cellPreview = undefined;
        return;
      }
      const spaceId = id as SpaceId;
      const cleared = (prompt.hiddenTiles ?? []).includes(spaceId);
      fetchBoardCellPreview(spaceId, prompt.placementType, cleared, prompt.tileType, prompt.sourceCard, prompt.placementEffect).then((preview) => {
        if (token === this.cellPreviewToken) {
          this.cellPreview = preview;
        }
      });
    },
    claimableTitles(options: ReadonlyArray<PlayerInputModel> | undefined): Set<string> {
      const set = new Set<string>();
      for (const o of options ?? []) {
        if (o.type === 'option') {
          const t = inputTitleText(o.title);
          if (t !== undefined) {
            set.add(t);
          }
        }
      }
      return set;
    },
    // Surface-motion transition hooks (plain functions — no `this`); bound
    // by the migrated band-surface <transition :css="false"> wrappers.
    surfaceEnterHook,
    surfaceLeaveHook,
    surfaceEnterCancelledHook,
    surfaceLeaveCancelledHook,
    // ── input ────────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): boolean {
      // Foundation: presses resolve to SEMANTIC actions (consoleActionOf) —
      // the shell compares `action`, never raw button names (undefined for
      // nav/scroll/release and the screen-specific STICKS, which stay raw).
      const action = consoleActionOf(intent);
      // NOTIFICATION X-HOLD lifecycle (consoleNotifHold): the release edge of a
      // tracked hold is resolved FIRST — ahead of every swallowing gate — so a
      // let-go can never be eaten by a scene/alert branch and leave the timer
      // to fire a hold the player abandoned. A release BEFORE the threshold is
      // a TAP: it is REPLAYED through this handler (guarded by notifTapReplay)
      // so X keeps its normal meaning on the surface beneath the toast.
      if (intent.kind === 'release' && intent.button === 'secondary') {
        if (consumeNotifHoldRelease()) {
          return true;
        }
        if (cancelNotifHold()) {
          this.notifTapReplay = true;
          try {
            this.handleIntent({kind: 'press', button: 'secondary'});
          } finally {
            this.notifTapReplay = false;
          }
          return true;
        }
      }
      // SYSTEM ALERT owns the pad ABOVE everything (even mid-hero): a server
      // error / rejected input must always be acknowledgeable — A or B
      // dismisses it (running its callback + advancing the queue); every
      // other intent is swallowed so nothing acts under it.
      if (isConsoleAlertActive()) {
        if (intent.kind === 'press' && (action === 'primary' || action === 'back')) {
          dismissConsoleAlert();
        }
        return true;
      }
      // SURFACE MOTION — a COMMITTED submit is awaiting its answer (the
      // composer holds the stage, its CTA shows the in-flight beat). The
      // action is already on the wire: B must not read as a cancel, another
      // A must not double-fire, and nothing may act under the held scene.
      // Bounded by AWAITING_SAFETY_MS (the resolve/expiry lives in the
      // playerView watcher), so the pad can never stick. Sits BELOW the
      // system alert (a rejected input stays acknowledgeable above).
      if (isSurfaceAwaitingHandoff()) {
        return true;
      }
      // TRADE-FLEET LAUNCH / HYDRO MARKER / BOARD CARD-BONUS / PATENT SALE /
      // TILE-PLACEMENT HERO own the moment: while the ship flies, the marker
      // glides, the bonus cover travels, the terminal takes the sold cards
      // in or the tile is landing on Mars, the pad is inert (nothing can act
      // on an action that's mid-commit). Bounded by the animations' safety
      // timers, so it can never stick. The placement's `armed` beat does NOT
      // gate (nothing visual yet — mirrors the played hero's armed policy),
      // and the pick itself can't double-fire (the arm claims the moment).
      if (isTradeFleetActive() || isHydroMarkerActive() || isBoardCardBonusActive() || isPatentSaleActive() || tilePlacementHolding()) {
        return true;
      }
      // TRADE REWARDS: the chip waves / card covers / marker glide own the
      // moment. PHASE-aware on purpose — the gate opens for the reveal take
      // and for a mandatory prompt between two colony-bonus draws (Pluto's
      // draw→discard pairing), so the transaction can never wedge the pad.
      if (isColonyTradeInputLocked()) {
        return true;
      }
      // DECK DRAW: the deck is dealing itself out — a bounded, self-playing
      // scene the player only watches. The reveal it hands off to takes the
      // pad back the moment its cards are released.
      if (isDeckDrawActive()) {
        return true;
      }
      // PLAYED-CARD HERO owns the moment. While the submit is in flight
      // (`armed`) the composer stays visible: only B (cancel — it would
      // corrupt the transaction) is swallowed, the rest routes normally
      // (the composer's own latch already blocks a second A). From the
      // first visual beat on, input is inert — except during the result
      // beat, where any press ACCELERATES the close (never a cancel).
      if (isPlayedHeroActive()) {
        if (this.playedHeroState.phase === 'armed') {
          if (action === 'back') {
            return true;
          }
        } else {
          if (intent.kind === 'press' && this.playedHeroState.phase === 'showing-result') {
            skipPlayedHeroResult();
          }
          return true;
        }
      }
      // «Разбор хода» review owns the pad while open (a read-only foreground
      // item — the presentation flow holds every other surface). B closes, X
      // inspects the played card, L3 shows the placed tile on the board, the
      // right stick scrolls; during a peek any press returns to the review.
      if (this.botTurnReviewState.open) {
        // The fullscreen viewer opened via X owns the pad while it is up. It now
        // hosts BONUS cards too (the union CardZoomModal), so there is no
        // separate bonus-inspect surface to close first.
        if (this.consoleCardZoom.card !== undefined) {
          return this.handleZoomIntent(intent);
        }
        if (this.botTurnReviewState.peek) {
          if (intent.kind === 'press') {
            setBotReviewPeek(false);
          }
          return true;
        }
        if (intent.kind === 'scroll') {
          this.scrollReviewFeed(intent.dy);
          return true;
        }
        if (intent.kind === 'press') {
          if (action === 'inspect') {
            this.inspectReviewCard();
          } else if (action === 'prevSection') {
            // LB → previous bot turn (edge notice at the first archived turn).
            stepBotTurnReview(-1);
          } else if (action === 'nextSection') {
            // RB → next bot turn (edge notice if the next turn is not made yet).
            stepBotTurnReview(1);
          } else if (intent.button === 'stickL' && this.reviewMapSpaces.length > 0) {
            setBotReviewPeek(true, this.reviewMapSpaces);
          } else if (action === 'back') {
            closeBotTurnReview();
          }
        }
        return true;
      }
      // Government Support scale-focus hold: a brief, inert transition beat
      // while the board scale animates — swallow input so nothing fires under
      // the (about-to-open) next modal.
      if (this.govScaleFocusState.holding || this.govScaleFocusState.closing) {
        return true;
      }
      // P15: OUR fullscreen card viewer owns the pad completely while open
      // (it is a native <dialog>, so this must run BEFORE the resolveScope
      // fallback branch — the generic dialog scope would otherwise trap the
      // input in the DOM engine, where LB/RB browsing and the A select
      // context don't exist). Other (fallback-owned) dialogs never set
      // consoleCardZoom, so they still route to the DOM engine below.
      if (this.consoleCardZoom.card !== undefined) {
        return this.handleZoomIntent(intent);
      }
      // MANDATORY PROMPT (consoleMandatoryGate): while the prompt card is
      // visible the pending mandatory decision is the priority — A OPENS a held
      // one / RETURNS to a deferred one (A is free on the board home; the
      // surface was held closed so it never popped over what the player was
      // watching). Navigation / other presses pass through so the player can
      // keep inspecting the board. Takes A ahead of a transient toast.
      if (this.mandatoryAnnounceVisible && intent.kind === 'press' && action === 'primary') {
        if (this.mandatoryGateHeld) {
          this.openMandatoryAnnounce();
        } else {
          this.restoreDeferredTask();
        }
        return true;
      }
      // PRESENTATION FLOW: a visible console toast never re-labels the command
      // bar and never swallows the screen's own verbs — the bar keeps the
      // CURRENT screen's contract; the card carries its own hints. The toast
      // claims exactly two overrides, both advertised ON the card:
      //  - B closes it («B Закрыть» — every toast);
      //  - press-and-HOLD X fires its DETAIL action (the flow-holding AI-turn
      //    card's «Осмотреть ход»). A single X TAP falls through to the
      //    surface beneath (the release-edge replay at the top of this
      //    handler), so the console-wide inspect verb (open a card fullscreen
      //    etc.) is never stolen. A / navigation pass through untouched — a
      //    deliberate acting press auto-acknowledges the flow-holding card
      //    (acknowledgeFlowHoldingCards in fetchPlayerInput).
      const topCard = this.topNotification;
      if (topCard !== undefined && this.consoleCardZoom.card === undefined) {
        // A visible toast OVERRIDES B everywhere — the press closes the card
        // and is consumed; only the NEXT B (no toast) is the screen's own
        // back/minimize. The other assignment shipped and was wrong within a
        // day: the player sees a toast, taps B to clear it, and their
        // workspace steps back under them instead — a navigation they never
        // asked for is strictly worse than a toast that costs one extra B.
        // The branch sits BELOW every screen-owning moment (alert / awaiting
        // handoff / heroes / review), so a cinematic's own swallow still wins.
        if (action === 'back') {
          cancelNotifHold();
          // A bot-turn card closed BY THE PLAYER collapses the whole AI-turn
          // backlog (ack + deliver + commit) instead of merely uncovering the
          // next one — «я посмотрел» is about the bot's turns, not about this
          // one card. A bare dismiss here also never acked, so the server kept
          // pacing the next turn on a client that had already caught up.
          if (topCard.botTurnKey !== undefined) {
            skipBotTurnPresentation(topCard.botTurnKey);
          } else {
            dismissNotification(topCard.id);
          }
          return true;
        }
        const detailKey = topCard.holdsFlow === true ? topCard.botTurnKey : undefined;
        if (detailKey !== undefined && action === 'inspect' && !this.notifTapReplay) {
          beginNotifHold(topCard.id, () => openBotTurnReviewByKey(detailKey));
          return true;
        }
      }
      // A fallback surface (mandatory modal / dialog / draft / endgame…) on
      // top → the demoted DOM focus engine drives it. (The Hydronetwork is
      // fully console-native now — ConsoleHydroSection mounts no fallback
      // scope root, so its intents flow through the normal console chain
      // below and land in handleSectionIntent.)
      const scope = resolveScope();
      const fallback = scope !== undefined;
      this.consoleState.fallbackActive = fallback;
      this.consoleState.fallbackScopeId = scope?.def.id ?? '';
      if (fallback) {
        return false;
      }
      if (intent.kind === 'release' || intent.kind === 'navEnd' ||
          intent.kind === 'aim' || intent.kind === 'aimEnd') {
        // PRESS→RELEASE surfaces consume falling edges and the stick's AIM
        // protocol; everywhere else those die here so no legacy handler ever
        // double-acts on a button-up or a stick gesture. The quick wheel is
        // the one such surface today: its armed slot commits on the release
        // of the SAME control that seated it (wheelArmModel).
        //
        // ⚠️ A falling edge that STOPS something must never be routed through
        // here at all. The shared hold-to-confirm gate learned that the hard
        // way — it read the button-up as «the player let go», this branch ate
        // it, and the ring kept filling after the release until an
        // irreversible action fired. `consoleHoldConfirm` therefore observes
        // the intent bus directly (`observeConsoleIntents`), above every
        // consuming branch including this one.
        if (this.consoleState.quick !== undefined) {
          this.handleQuickIntent(intent);
        }
        return true;
      }
      if (intent.kind === 'scroll') {
        // P17: the RIGHT STICK scrolls the active console scroll container
        // (the fallback for rare overflow — console layouts fit by design
        // and never show scrollbar chrome). Fallback-owned surfaces keep
        // the DOM engine's own right-stick scroll (they return earlier).
        // …but NOT while an outcome is re-homed inside it: the browse list is
        // parked behind the outcome zone, so scrolling it would move something
        // the player cannot see instead of the content in front of them.
        if (this.consoleState.sheet === 'cardActions' && !this.handPickActive &&
            !this.workspaceOutcomeEmbedded) {
          (this.$refs.cardActions as InstanceType<typeof ConsoleCardActions> | undefined)?.handleIntent(intent);
          return true;
        }
        this.scrollActiveConsole(intent.dy, intent.dx);
        return true;
      }
      // THE FINAL SCORING WORKSPACE owns the pad for the whole post-game
      // («Обзор партии» included — the workspace routes to its own scene).
      // It consumes EVERYTHING below deliberately: Info
      // Mode, the journal and the wheels are live-game instruments — and
      // during the ceremony an Info Mode peek would leak the very totals
      // the count is about to reveal.
      if (this.endgameWorkspaceMounted) {
        // …except a LIVE drawn-cards reveal: a reload into an ended game can
        // still owe undelivered draws, and that overlay stands OVER the
        // settled result (its branch normally sits below this one, which
        // would strand the take press). The cards must be takeable — no
        // silent loss, even at the finish line.
        if (this.consoleRevealMode !== undefined) {
          const overlay = this.$refs.revealOverlay as InstanceType<typeof ConsoleRevealOverlay> | undefined;
          overlay?.handleIntent(intent);
          return true;
        }
        (this.$refs.endgameWs as InstanceType<typeof ConsoleEndgameWorkspace> | undefined)?.handleIntent(intent);
        return true;
      }
      // Information Mode owns everything while open (read-only).
      if (this.infoModeState.open) {
        this.handleInfoIntent(intent);
        return true;
      }
      // The console-native journal owns the pad while open (board home
      // only; a mandatory surface closes it via the journalHardBlocked
      // watcher). View/B close; B inside the filter popover / inspect
      // card / map-peek is a LOCAL back (closes that layer, never the
      // journal); everything else is the panel's own grammar
      // (A / X / L3 / LB·RB / LT·RT / Y / d-pad — see ConsoleJournalPanel).
      // A READ-ONLY colony dossier opened from the journal (X on a colony row)
      // owns the pad ABOVE the journal — B/X closes it back to the journal.
      if (this.journalColonyInspect !== undefined) {
        this.handleColonyInspectIntent(intent);
        return true;
      }
      if (this.journalPanelVisible) {
        const journalLocalBack = consoleJournalUi.filterOpen || consoleJournalUi.inspectOpen || consoleJournalUi.peekActive;
        if (action === 'reset' || (action === 'back' && !journalLocalBack)) {
          this.closeJournal();
          return true;
        }
        // P27b consistency: Y = Information Mode on EVERY surface. The
        // journal's own player-filter moved to R3 (stickR) — so Y here opens
        // Info Mode like everywhere else. Suppressed while a local journal
        // layer (filter popover / inspect card / map peek) owns the pad, so Y
        // there still resolves that layer through the panel's own grammar.
        if (action === 'fullscreen' && !journalLocalBack) {
          this.toggleInfoMode();
          return true;
        }
        const panel = this.$refs.journalPanel as InstanceType<typeof ConsoleJournalPanel> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // The MANDATORY corp first-action modal owns the pad while open
      // (before the «Разыграно» browse below — a stale browse yields to it
      // via the hard-block watcher). Y keeps the global Info Mode meaning.
      if (this.corpFirstActionOpen) {
        if (action === 'fullscreen') {
          this.toggleInfoMode();
          return true;
        }
        const confirm = this.$refs.corpFirstConfirm as InstanceType<typeof ConsoleCorpFirstActionConfirm> | undefined;
        confirm?.handleIntent(intent);
        return true;
      }
      // «Разыграно» (X from the board home) owns the pad while open — a
      // VIEW surface (journal family): B closes (inside the events list B is
      // a LOCAL back), X/A inspect, LB/RB cycle the viewed player, Y keeps
      // the global Info Mode meaning. A mandatory surface closes it via the
      // journalHardBlocked watcher — same yield rule as the journal.
      if (this.playedTableVisible) {
        if (action === 'fullscreen') {
          this.toggleInfoMode();
          return true;
        }
        const overlay = this.$refs.playedOverlay as InstanceType<typeof ConsolePlayedOverlay> | undefined;
        overlay?.handleIntent(intent);
        return true;
      }
      // P27b: Y = INFORMATION MODE — ALWAYS (every surface's former local
      // Y verb moved to RT: task-host MAX/confirm, start-scene Continue,
      // reveal Take-all, sale-mode Sell, hydro Farthest). The two small
      // confirm dialogs keep the pad focused on the decision itself.
      if (action === 'fullscreen' &&
          this.consoleState.confirm === undefined && !this.consoleCardActionsUi.confirmOpen) {
        this.toggleInfoMode();
        return true;
      }
      // DRAFT PICK BEAT (the hero flying into the tray): the host may have
      // already unmounted under it (the response was draftWait) — swallow
      // everything, a press skips to the final state. Bounded (<1s).
      if (draftPickBeatActive()) {
        if (intent.kind === 'press') {
          skipDraftPickBeat();
        }
        return true;
      }
      // THE DISCARD CINEMATIC owns the screen while it plays (bounded — the
      // transaction's own 7 s ceiling, and every beat resolves on its GSAP
      // completion). Swallowing here is what stops a fast controller from
      // tearing the sequence apart: re-opening the hand mid-flip, submitting
      // the next prompt over the carry, or deferring the surface the packet is
      // still standing on.
      if (this.cardDiscardHolds) {
        return true;
      }
      // Draft re-pick WAITING: the pad is otherwise idle (the board stays
      // inspectable, Info Mode is handled above). X opens the read-only
      // drafted-cards viewer; every other button falls through to the board.
      if (this.draftWaitActive && this.draftTrayMounted && action === 'inspect' && this.draftedCards.length > 0) {
        // The pre-game POPOVER path only (the workspace's wait offers the LT
        // sub-stage instead). Opened from the count chip → TEXTUAL.
        openConsoleCardZoom([...this.draftedCards], 0, undefined, undefined, {origin: {kind: 'textual'}});
        return true;
      }
      // CTS T6: a reveal overlay owns input while visible (drawn cards
      // must be taken; the result / viewer close on any confirm).
      if (this.consoleRevealMode !== undefined) {
        const overlay = this.$refs.revealOverlay as InstanceType<typeof ConsoleRevealOverlay> | undefined;
        overlay?.handleIntent(intent);
        return true;
      }
      // CTS T5: the start scene owns input while it serves (B inside =
      // wizard back-step, else defer). The journal is a BOARD-HOME surface
      // now — no View-peek here (safe context policy).
      // …EXCEPT while it hosts the play-from-hand step: the hand it is holding
      // is a real screen with a real cursor, and the player is browsing THAT.
      // Falling through hands input to the normal hand/composer path — the
      // same one they would get outside the start, which is the point.
      // Same for the hosted COLONIES step (a prelude's Build Colony): the
      // colony grid is the surface in front of the player.
      // Same for the YIELD to a board PLACEMENT (a prelude that owes a tile):
      // the scene is hidden, so routing here would swallow the pad — the
      // board below is the surface that serves it (`startSceneOwnsPad`).
      // DRAW & SELECT owns the pad while it serves — BEFORE the start scene,
      // because the commonest host for it IS the start scene (a prelude that
      // looks at the top of the deck). Through its own outgoing beats it
      // deliberately swallows everything, so a committed move can never be
      // re-submitted by a stray press.
      if (this.deckPickServing) {
        (this.$refs.deckPick as InstanceType<typeof ConsoleDeckPick> | undefined)?.handleIntent(intent);
        return true;
      }
      // THE DRAFT WORKSPACE owns the pad while it is the serving surface.
      // `hostTask === undefined` inside the predicate yields it to the
      // embedded payment / the Underworld research choice (host-served).
      if (this.draftWorkspaceOwnsPad) {
        (this.$refs.draftWs as InstanceType<typeof ConsoleDraftWorkspace> | undefined)?.handleIntent(intent);
        return true;
      }
      if (this.startSceneOwnsPad) {
        const scene = this.$refs.startScene as InstanceType<typeof ConsoleStartScene> | undefined;
        scene?.handleIntent(intent);
        return true;
      }
      // Government Support (WGT) — the dedicated briefing panel owns input
      // while it serves (before the generic host branch below).
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        const panel = this.$refs.govSupport as InstanceType<typeof ConsoleGovernmentSupport> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // Production loss (Ares hazard) — the dedicated surface owns input while
      // it serves (before the generic host branch below).
      if (this.productionLossActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        const panel = this.$refs.prodLoss as InstanceType<typeof ConsoleProductionLoss> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // The three dedicated COMPOSITE surfaces own the pad on the same terms.
      if (this.spendHeatActive) {
        (this.$refs.spendHeat as InstanceType<typeof ConsoleSpendHeat> | undefined)?.handleIntent(intent);
        return true;
      }
      if (this.venusBonusActive) {
        (this.$refs.venusBonus as InstanceType<typeof ConsoleVenusBonus> | undefined)?.handleIntent(intent);
        return true;
      }
      if (this.aresGlobalsActive) {
        (this.$refs.aresGlobals as InstanceType<typeof ConsoleAresGlobals> | undefined)?.handleIntent(intent);
        return true;
      }
      if (this.botAttackActive) {
        (this.$refs.botAttack as InstanceType<typeof ConsoleBotAttack> | undefined)?.handleIntent(intent);
        return true;
      }
      // The EFFECT DECISION screen owns input while it stands in for the host
      // (same contract, same gate — kept next to it so the two can never both
      // claim the pad).
      if (this.effectDecisionActive) {
        const panel = this.$refs.effectDecision as InstanceType<typeof ConsoleEffectDecision> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // The FINALE screen owns input on the same terms (its A is the arming
      // one — that lives in the panel, not here).
      if (this.finalGreeneryActive) {
        const panel = this.$refs.finalGreenery as InstanceType<typeof ConsoleFinalGreenery> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // CTS T1–T3: the task host owns input while it serves (B inside the
      // host = defer-to-board / cancel, handled there). No View-peek.
      // …EXCEPT while it has handed a card pick to the hand overlay
      // (`handPickActive`): the host is UNMOUNTED then (same condition as its
      // v-if), so routing here would drop every press into a dead ref. Keep
      // this gate, the two command-bar gates and the template's v-if in
      // LOCK-STEP — a mismatch silently swallows the pad.
      if (this.hostTask !== undefined && !this.consoleState.task.deferred && this.taskSpacePending === undefined && !this.handPickActive) {
        const host = this.$refs.taskHost as InstanceType<typeof ConsoleTaskHost> | undefined;
        host?.handleIntent(intent);
        return true;
      }
      // REPEAT-ACTION PICK (source composer → ДЕЙСТВИЯ КАРТ bridge): the pick
      // surface owns the pad while it is out — the hidden source composers
      // (v-show) must not swallow input. Routed BEFORE every composer branch.
      if (this.repeatPickActive) {
        const panel = this.$refs.repeatPick as InstanceType<typeof ConsoleCardActions> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      // CLIENT HAND PICK (composer → hand bridge): the hand section owns the
      // pad while the pick is out — the hidden composers (v-show) must not
      // swallow input. Routed BEFORE the composer branches below.
      if (this.handPickActive) {
        return this.handleSectionIntent(intent);
      }
      // THE DESCENT OWNS THE PAD WHILE IT MOVES. Between the press and the
      // settled work surface the composer is already mounted but not yet
      // readable — an A there would confirm a play against a CTA the player
      // cannot see. On the way back the same gate stops a second A from
      // re-descending into a card that is still flying home to its slot.
      if (handStageTransitioning()) {
        return true;
      }
      // T8: the native play-card confirm owns input while open.
      if (this.pendingPlayCard !== undefined) {
        const confirm = this.$refs.playConfirm as InstanceType<typeof ConsolePlayCardConfirm> | undefined;
        confirm?.handleIntent(intent);
        return true;
      }
      // T8: the COLONY FOCUS STAGE owns input while open (the section routes
      // the pad into the stage's own composer rows) — standalone AND embedded.
      if (this.colonyFocusOpen) {
        // L3 = the source card, on the stage exactly as on the overview (the
        // viewer opens OVER it — selection and focus survive underneath).
        if (intent.kind === 'press' && intent.button === 'stickL' && this.contextualSourceCard !== undefined) {
          this.inspectContextualSource();
          return true;
        }
        const section = this.$refs.coloniesSection as InstanceType<typeof ConsoleColoniesSection> | undefined;
        section?.handleFocusIntent(intent);
        return true;
      }
      /* (The EMBEDDED COLONIES STEP had its own copy of the grid grammar here
         — nav, A, X, L3, B — because `section` said 'hand' (or 'board') while
         the player was demonstrably driving a colony grid. It projects the
         DEEPEST frame now, so the standalone branch below IS the embedded one,
         and B's verb comes from the frame's own phase. Forty lines of
         second-copy deleted, including the one that held the soft-lock.) */
      if (this.consoleState.confirm !== undefined) {
        if (action === 'primary') {
          this.acceptConfirm();
        } else if (action === 'back') {
          this.consoleState.confirm = undefined;
        }
        return true;
      }
      if (this.consoleState.quick !== undefined) {
        this.handleQuickIntent(intent);
        return true;
      }
      // The console-native card-action center owns the pad while it serves —
      // UNLESS a section-projecting workspace stands INSIDE it. Both axes are
      // set then (sheet `cardActions` + section `colonies`), and asking the
      // sheet first hands the pad to the parked composer while the player is
      // demonstrably driving the colony grid on top of it. Depth breaks the
      // tie, the same rule presence already uses.
      if (this.consoleState.sheet === 'cardActions' && workspaceStackTopAxis() !== 'section') {
        const panel = this.$refs.cardActions as InstanceType<typeof ConsoleCardActions> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      if (this.consoleState.sheet !== undefined && workspaceStackTopAxis() !== 'section') {
        this.handleSheetIntent(intent);
        return true;
      }
      return this.handleSectionIntent(intent);
    },
    // ── Information Workspace (read-only; never submits; Y toggles) ─────
    toggleInfoMode(): void {
      if (this.infoModeState.open) {
        const wasInspectingOther = this.infoModeState.playerColor !== undefined &&
          this.infoModeState.playerColor !== this.thisPlayer.color;
        const snap = closeInfoMode();
        if (snap !== undefined) {
          // The snapshot's cell-focus flag maps onto INSPECTION MODE (P27).
          this.consoleState.inspecting = restoreConsoleSnapshot(snap);
        }
        // A placement prompt that arrived WHILE Info Mode was open must not
        // be restored away from — the board is the mandatory surface.
        if (this.placementActive) {
          goBoardHome();
          this.consoleState.inspecting = false;
        }
        // The rail atomically returned to the viewer's own seat (railPlayer
        // follows `open`) — a soft settle dip acknowledges the context
        // coming home while the workspace departs. Only when it actually
        // changes seats (closing on the own dossier stays perfectly still).
        if (wasInspectingOther) {
          playInspectedReturnMotion();
        }
        return;
      }
      this.consoleState.quick = undefined;
      // The board-home «Разыграно» table yields — the workspace has its own
      // embedded played detail (X), so a stale overlay must not linger under
      // the dim (the two would share the singleton category state).
      if (this.playedOpen) {
        this.closePlayedOverlay();
      }
      openInfoMode(this.thisPlayer.color, this.consoleState.inspecting);
    },
    /** after-leave of the workspace's dismiss transition — release the
     *  `--info` stacking state (kept alive through the fade; see the
     *  conMainClasses note). */
    onInfoModeLeaveSettled(): void {
      settleInfoModeClose();
    },
    /** LB/RB inside the workspace: ONE state flip (rail + panel read the
     *  same inspected color) + the directional switch beat. Rapid presses
     *  coalesce — the state lands on the final player instantly, the motion
     *  restarts from live values (inspectSwitchMotion kills the old tween). */
    cycleInspectedPlayer(step: 1 | -1): void {
      const colors = this.playerView.players.map((p) => p.color);
      const before = this.infoModeState.playerColor;
      this.infoModeState.playerColor = cyclePlayer(colors, before, step);
      this.reconcileInfoDetail();
      if (this.infoModeState.playerColor !== before) {
        playInspectedSwitchMotion(step);
      }
    },
    handleInfoIntent(intent: GamepadIntent): void {
      // THE EMBEDDED «РАЗЫГРАНО» DETAIL (X): the table owns the pad — nav,
      // A (open category), X (inspect), B (fold a category first; at table
      // level the overlay's close event returns to the dashboard). LB/RB
      // stay the GLOBAL seat switch at TABLE level only (matching the
      // standalone grammar — inside a category view the bumpers are inert);
      // Y keeps the global close.
      if (this.infoModeState.detail === 'played') {
        if (intent.kind === 'press') {
          const action = consoleActionOf(intent);
          if (action === 'fullscreen') {
            this.toggleInfoMode();
            return;
          }
          const catEngaged = consolePlayedUi.categoryOpen || consolePlayedUi.categoryBusy;
          if (!catEngaged && (action === 'prevSection' || action === 'nextSection')) {
            this.cycleInspectedPlayer(action === 'prevSection' ? -1 : 1);
            return;
          }
        }
        (this.$refs.infoMode as InstanceType<typeof ConsoleInfoMode> | undefined)?.handlePlayedIntent(intent);
        return;
      }
      if (intent.kind === 'nav') {
        // d-pad up/down scrolls the visible info surface.
        const scroller = document.querySelector<HTMLElement>('.con-info__scroll');
        if (scroller !== null && (intent.dir === 'up' || intent.dir === 'down')) {
          scroller.scrollBy({top: (intent.dir === 'down' ? 140 : -140) * conUiScale(), behavior: 'smooth'});
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      // X = the played table for EVERY participant; the seat-specific extra
      // readers live on the sticks (L3 human extras / R3 the bot's printed
      // board) and the triggers (LT actions / RT effects | bonus piles).
      const viewedIsBot = this.playerView.players
        .find((p) => p.color === this.infoModeState.playerColor)?.isMarsBot === true;
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        this.cycleInspectedPlayer(-1);
        break;
      case 'nextSection':
        this.cycleInspectedPlayer(1);
        break;
      case 'inspect':
        this.openInfoDetail('played');
        break;
      case 'prevTab':
        if (!viewedIsBot) {
          this.openInfoDetail('actions');
        }
        break;
      case 'fullscreen':
        this.toggleInfoMode(); // Y closes — the same key that opened it
        break;
      case 'nextTab':
        this.openInfoDetail(viewedIsBot ? 'botBonus' : 'effects');
        break;
      case 'primary':
        if (this.infoModeState.detail === undefined) {
          if (this.infoVpVisible) {
            this.openInfoDetail('vp');
          } else {
            this.showNotice('Score is hidden until the end of the game');
          }
        }
        break;
      case 'back':
        if (this.infoModeState.detail !== undefined) {
          this.infoModeState.detail = undefined;
        } else {
          this.toggleInfoMode(); // dashboard root: B = close + restore
        }
        break;
      default:
        // The stick presses stay RAW (no semantic action) — the workspace's
        // per-seat extra readers.
        if (intent.button === 'stickL' && !viewedIsBot) {
          this.openInfoDetail('extras');
        } else if (intent.button === 'stickR' && viewedIsBot) {
          this.openInfoDetail('botBoard');
        }
        break;
      }
    },
    openInfoDetail(detail: InfoDetail): void {
      this.infoModeState.detail = this.infoModeState.detail === detail ? undefined : detail;
    },
    // Cycling between a human and the MarsBot participant: a detail that
    // exists only for the OTHER participant type falls back to the dashboard
    // ('vp' and 'played' are SHARED and survive the switch — the embedded
    // table simply re-reads the new inspected seat).
    reconcileInfoDetail(): void {
      const detail = this.infoModeState.detail;
      if (detail === undefined || detail === 'vp' || detail === 'played') {
        return;
      }
      const isBot = this.playerView.players
        .find((p) => p.color === this.infoModeState.playerColor)?.isMarsBot === true;
      const botOnly = detail === 'botBoard' || detail === 'botBonus';
      if (botOnly !== isBot) {
        this.infoModeState.detail = undefined;
      }
    },
    // ── P27: the quick selectors — DIRECT input, no aiming ───────────────
    /**
     * PRESS→RELEASE (wheelArmModel): the DOWN edge of A / a d-pad direction
     * ARMS its slot (the tile seats under the finger), the UP edge of the
     * SAME control COMMITS it. A fast tap arms+commits within its natural
     * duration — no hold threshold. Repeats, cross-control conflicts and
     * stale releases are resolved by the pure machine; this handler only
     * feeds edges in and executes the effects out.
     */
    handleQuickIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.feedWheelArm({type: 'navDown', dir: intent.dir, repeat: intent.repeat, analog: intent.analog === true});
        return;
      }
      if (intent.kind === 'navEnd') {
        this.feedWheelArm({type: 'navUp', dir: intent.dir});
        return;
      }
      // AIM protocol (left stick): the engaged sector moves the FOCUS; the
      // confirmed return to neutral commits it (gamepadPollModel owns the
      // hysteresis / noise / flick guarantees — this is a pure relay).
      if (intent.kind === 'aim') {
        this.feedWheelArm({type: 'aim', dir: intent.dir});
        return;
      }
      if (intent.kind === 'aimEnd') {
        this.feedWheelArm({type: 'aimEnd'});
        return;
      }
      if (intent.kind === 'release') {
        if (intent.button === 'confirm') {
          this.feedWheelArm({type: 'confirmUp'});
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        this.feedWheelArm({type: 'confirmDown'});
        break;
      case 'back':
        // B cancels instantly — armed or not, nothing executes.
        this.feedWheelArm({type: 'cancel'});
        break;
      case 'nextTab':
        // The opening trigger toggles its own selector closed; the other
        // switches wheels in place (any live arm dissolves first).
        this.feedWheelArm({type: 'reset'});
        this.consoleState.quick = this.consoleState.quick === 'actions' ? undefined : 'actions';
        break;
      case 'prevTab':
        this.feedWheelArm({type: 'reset'});
        this.consoleState.quick = this.consoleState.quick === 'basics' ? undefined : 'basics';
        break;
      default:
        break;
      }
    },
    feedWheelArm(event: WheelArmEvent): void {
      const result = reduceWheel(this.wheelInput, event, this.wheelControl.mode, {
        has: (slot) => this.quickEntries.some((e) => e.slot === slot),
        available: (slot) => this.quickEntries.find((e) => e.slot === slot)?.available === true,
      });
      this.wheelInput = result.state;
      const effect = result.effect;
      switch (effect.kind) {
      case 'commit':
        this.activateQuickSlot(effect.slot);
        break;
      case 'refuse': {
        // The blocked slot resisted through the hold; the release restates
        // the honest reason on the shared notice rail.
        const entry = this.quickEntries.find((e) => e.slot === effect.slot);
        this.showNotice(entry !== undefined && entry.reason !== '' ? entry.reason : 'Unavailable right now');
        break;
      }
      case 'dismiss':
        this.consoleState.quick = undefined;
        break;
      default:
        break;
      }
    },
    activateQuickSlot(slot: QuickSlot): void {
      const entry = this.quickEntries.find((e) => e.slot === slot);
      if (entry === undefined) {
        return;
      }
      if (!entry.available) {
        this.showNotice(entry.reason !== '' ? entry.reason : 'Unavailable right now');
        return;
      }
      // WHEEL HANDOFF (surface motion): record the chosen slot + its centre
      // BEFORE the wheel unmounts. The grammar is PRESS → MECHANICAL COMMIT
      // → DEPTH COLLAPSE → CONTEXT REVEAL: the leave hook plays the chosen
      // tile's commit press-in and the wheel's recession while the next
      // surface forms IN PARALLEL from the slot's direction; the handoff
      // spec adds the destination's emblem ECHO and/or a PULSE on the live
      // HUD element a direct action is about to change. Nothing flies.
      const handoff = wheelHandoffSpecFor(entry.id);
      markWheelHandoff(slot, document.querySelector(`.con-quick__slot--${slot}`), handoff?.echo);
      // …and PIN the cross's own box in the same breath. The lines below open a
      // workspace that takes (or hides) the strategy rail, and the wheel's band
      // insets would re-solve in the wider opening while it is still playing its
      // recession — half a rail of sideways twitch on the first frame after the
      // press. Captured here, BEFORE the state change, because that is the last
      // moment the geometry is still the one the player pressed in.
      pinQuickWheelBox();
      const quick = this.consoleState.quick;
      this.consoleState.quick = undefined;
      if (quick === 'actions') {
        this.executeRtEntry(entry.id);
      } else if (quick === 'basics') {
        this.executeLtEntry(entry.id);
      }
      // The PULSE fires only when the commit stayed DIRECT — an execute that
      // diverted into the shared confirm card (heat at max temperature)
      // must not acknowledge on the reservoir it did not touch.
      if (handoff?.pulse !== undefined && this.consoleState.confirm === undefined) {
        pulseWheelAnchors(handoff.pulse);
      }
    },
    // ── the dock ↔ hand-overlay REVEAL episodes (handRevealDirector) ──────
    /**
     * OPEN the hand as a physical reveal: mount the overlay HELD (slots
     * invisible, chrome arriving), measure both ends in one read batch,
     * then fly one proxy per card dock → slot (backs flip to faces around
     * the edge, centre-out fan). Reopening mid-close reverses the running
     * gather instead. Falls back to the plain section switch when the
     * geometry isn't measurable.
     */
    async openHandWithReveal(opts?: {keepTask?: boolean, overlay?: boolean}): Promise<void> {
      if (isHandRevealEpisodeRunning()) {
        if (handRevealState.phase === 'closing') {
          reverseHandReveal(); // reopen mid-close: same timeline, back to open
        }
        return;
      }
      if (this.consoleState.section === 'hand') {
        return;
      }
      // `keepTask`: the Game Start Workspace's play-from-hand step OPENS the
      // hand because of a live prompt — deferring it would be the opposite of
      // navigating away, and would drop the very claim that keeps the hand
      // inside the workspace. Everything below (the real dock → slot
      // choreography) is exactly the same, which is the point: the player
      // gets the hand opening they already know.
      if (opts?.keepTask !== true) {
        this.deferShellTask(); // navigation-away (the RT path's contract)
      }
      // ARM THE ART FIRST — before the section mounts, before the two
      // measuring frames. Every proxy mounts a premium face, and a face whose
      // webp is not decoded yet paints a BLACK art window and then fades the
      // picture in over 240ms; a hand full of those is the «карты без артов»
      // half of the open's flicker. The mount + measure + lift ahead of the
      // flight is exactly the head start the decode needs.
      preloadPremiumCardArt(this.handEntriesAll.map((e) => e.card.name));
      // Phase BEFORE the section flip: the section watcher must see a
      // director-owned transition, not an untracked open (which would lift
      // the dock instantly and skip the choreography).
      handRevealState.phase = 'opening';
      handRevealState.holdSlots = true;
      // The dock stands FULL for the whole opening — its backs are the flight
      // sources, so the pose must not change while they are measured. The
      // lease covers the pre-install window too (measure + two frames), which
      // is precisely where the old flag-reading accent could latch forever.
      const releaseAccent = beginDockIntakeAccent('hand-open');
      try {
        this.openHandWorkspace({overlay: opts?.overlay});
        await this.$nextTick();
        // Two frames: the grid measures itself + ensureSelectedVisible seats
        // the scroll — the targets below are the settled layout.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));
        const section = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
        const dock = this.$refs.handDock as InstanceType<typeof ConsoleHandDock> | undefined;
        const t = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};
        const sources = dock?.sourceRects(t.pairs.map((p) => p.name)) ?? new Map<string, RevealRect>();
        const pairs: Array<RevealPair> = [];
        for (const p of t.pairs) {
          const source = sources.get(p.name);
          if (source !== undefined) {
            pairs.push({name: p.name, source, target: p.rect, visible: p.visible, clip: p.clip, visual: this.revealVisualFor(p.name)});
          }
        }
        await runHandOpenEpisode(pairs);
      } finally {
        releaseAccent();
      }
    },
    /**
     * CLOSE the hand as the physical gather: measure the LIVE slot rects
     * (current scroll/filter), fly the cards back into the dock's exact
     * back positions (faces flip back-side-out on approach). `B` mid-open
     * never reaches here — handleSectionBack reverses the running episode.
     */
    async closeHandWithReveal(exclude?: ReadonlySet<string>): Promise<void> {
      if (isHandRevealEpisodeRunning() || this.consoleState.section !== 'hand') {
        return;
      }
      const section = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      const dock = this.$refs.handDock as InstanceType<typeof ConsoleHandDock> | undefined;
      const t = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};
      const sources = dock?.sourceRects(t.pairs.map((p) => p.name)) ?? new Map<string, RevealRect>();
      const pairs: Array<RevealPair> = [];
      for (const p of t.pairs) {
        // `exclude` = cards that are NOT going home. The discard cinematic owns
        // them on its own layer and is carrying them the other way, so flying a
        // second (invisible) proxy to the dock would fight it and, worse, would
        // land them in a pack they already left.
        if (exclude?.has(p.name) === true) {
          continue;
        }
        const source = sources.get(p.name);
        if (source !== undefined) {
          pairs.push({name: p.name, source, target: p.rect, visible: p.visible, clip: p.clip, visual: this.revealVisualFor(p.name)});
        }
      }
      // The gather measures the dock's back positions too — same lease, same
      // reason (see openHandWithReveal).
      await holdDockIntakeAccent('hand-close', runHandCloseEpisode(pairs, t.scrollTop));
    },
    /**
     * THE DISCARD HAND-OFF (phase D), registered with the discard transaction.
     *
     * It is deliberately the ORDINARY close: the unchosen cards gather back
     * into the dock through the exact episode any other close plays, with the
     * discarded names filtered out. Nothing about the close is duplicated for
     * this case — the only discard-specific part is the exclusion set and the
     * clean-up of the frozen surface once the hand is gone.
     */
    async handOffHandForDiscard(discarded: ReadonlySet<CardName>): Promise<void> {
      if (this.consoleState.section !== 'hand') {
        return;
      }
      // A COLONY-BONUS discard returns to the colony's focus — arm the
      // restore BEFORE the gather, so a track commit landing mid-flight is
      // already deferred to the restored stage.
      const colonyReturn = cardDiscardColonyBonus() !== undefined &&
        workspaceFrameHost('hand') === 'colonies';
      if (colonyReturn) {
        this.colonyFocusRestorePending = true;
      }
      await this.closeHandWithReveal(discarded);
      // The episode already sent the cards home; clear what the pick left
      // behind so the next surface starts from a clean state.
      this.consoleState.select.selected = [];
      this.consoleState.select.suitableOnly = true;
      this.leaveHandAfterAnswer();
      this.discardFreeze = undefined;
      if (colonyReturn) {
        void this.restoreColonyFocusAfterDiscard();
      }
    },
    /** The hand dock (footer bay) clicked — the mouse/touch entry point to
     *  the hand. Same path as RT → КАРТЫ; guarded to the calm board home
     *  (the dock is `live` there — every overlay state is non-interactive). */
    onHandDockOpen(): void {
      if (this.consoleState.section !== 'board' || this.placementActive ||
          this.consoleState.quick !== undefined || this.consoleState.confirm !== undefined) {
        return;
      }
      this.executeRtEntry('cards');
    },
    /** RT — action categories (navigation surfaces; inspection always allowed). */
    executeRtEntry(id: string): void {
      switch (id) {
      case 'cards':
        // A BROWSE open always starts at the TOP of the grid: reset the
        // persisted selection so `ensureSelectedVisible` never pre-scrolls
        // the freshly-mounted grid — the initial viewport is deterministic
        // (first rows), which is what the open reveal measures against.
        // Index 0 = the first PLAYABLE card (playable-first sort). Flows
        // that need a specific focus (hand-select / pick) set their own
        // index on their own path.
        this.consoleState.handIndex = 0;
        void this.openHandWithReveal();
        break;
      case 'cardActions':
        this.openSheet('card-actions');
        break;
      case 'trading':
        this.deferShellTask();
        // The player's OWN visit: the default `always` anchor is what says «this
        // screen stays when the prompt is answered» (a prompt-pushed frame
        // carries a `prompt` anchor and hands the screen back instead).
        enterWorkspace('colonies');
        this.consoleState.colonyIndex = stepIndex(this.consoleState.colonyIndex, 0, this.coloniesForRail.length);
        break;
      case 'hydro':
        this.deferShellTask();
        // The section's own mount decides RESUME vs FRESH (a still-fresh
        // draft re-seats; a stale one resets) — never a blanket reset here.
        enterWorkspace('hydro');
        break;
      default:
        break;
      }
    },
    /** LT — basic actions (turn-ending SUBMITS are guarded during placement). */
    executeLtEntry(id: string): void {
      const wf = this.playerView.waitingFor;
      const guardBusy = (): boolean => {
        if (this.actionBlockedReason !== '') {
          this.showNotice(this.actionBlockedReason);
          return true;
        }
        return false;
      };
      switch (id) {
      case 'standardProjects':
        // Opening is inspection-safe; item ACTIVATION is guarded in
        // activateStdItem (mirrors the sheet-row placement guard).
        this.openSheet('standard-projects');
        break;
      case 'skipTurn': {
        if (guardBusy()) {
          return;
        }
        const path = findEndTurnPath(wf);
        if (path !== undefined) {
          closeConsoleLayers();
          this.submit(optionResponseForPath(path));
        }
        break;
      }
      case 'pass':
        if (guardBusy()) {
          return;
        }
        // Pass ALWAYS confirms (warnings carried over from the desktop).
        this.consoleState.confirm = 'pass';
        break;
      case 'convertHeat': {
        if (guardBusy()) {
          return;
        }
        const found = findConvertHeatOption(wf);
        if (found === undefined) {
          return;
        }
        if ((found.option.warnings ?? []).includes('maxtemp')) {
          // The commit resolves into the confirm card, not a direct spend —
          // the ECHO follows the question instead of the reservoir.
          retargetWheelEcho(CONFIRM_HANDOFF.echo);
          this.consoleState.confirm = 'convertHeat';
        } else {
          this.submit(optionResponseForPath(found.path));
        }
        break;
      }
      case 'convertPlants': {
        if (guardBusy()) {
          return;
        }
        const found = findConvertPlantsOption(wf, this.thisPlayer.canConvertPlants === true);
        if (found === undefined) {
          return;
        }
        this.convertPlantsPending = found;
        closeConsoleLayers();
        goBoardHome();
        break;
      }
      default:
        break;
      }
    },
    handleSheetIntent(intent: GamepadIntent): void {
      // P27: the Standard-Projects premium screen — 2-column GRID nav,
      // A = use / sell, B = close (MANDATORY prompt → defer to the chip).
      // While a SECTION-projecting step stands inside it (the sale's hand,
      // the colony pick) the deepest axis owns the pad — this branch yields.
      if (this.consoleState.sheet === 'standardProjects' && workspaceStackTopAxis() !== 'section') {
        // A beat in flight (the submit round trip / the committed beat)
        // ABSORBS input: a double submit is impossible by construction, and
        // a stray press cannot reach the rows underneath.
        if (!acceptsInput(workspaceFramePhase('standard-projects') ?? 'browse')) {
          return;
        }
        if (intent.kind === 'nav') {
          this.consoleState.sheetIndex = stepGrid(
            this.consoleState.sheetIndex, intent.dir, this.stdProjectItems.length, 2);
          return;
        }
        if (intent.kind === 'press') {
          const a = consoleActionOf(intent);
          if (a === 'primary') {
            this.activateStdItem(this.stdProjectItems[this.consoleState.sheetIndex]);
          } else if (a === 'back') {
            // The EMBEDDED PAYMENT step folds one level (nothing committed) —
            // otherwise B closes the browse layer, exactly as before.
            if (this.pendingClientPayment !== undefined) {
              this.pendingClientPayment = undefined;
              this.rollbackStdProjectFlow();
              return;
            }
            this.deferShellTask();
            leaveWorkspace();
          }
        }
        return;
      }
      // The milestones/awards WORKSPACE. Overview: 2-column GRID nav (every
      // card focusable), A = SELECT (descend into the detail stage), LB/RB =
      // category switch. Detail: A = the real claim/fund commit, B = fold
      // back to the overview; the commit/ceremony beats absorb everything
      // (a double submit is impossible by construction).
      if (this.maScreenKind !== undefined) {
        if (maFocusState.open) {
          if (!maFocusAcceptsInput()) {
            return;
          }
          if (intent.kind === 'press') {
            switch (consoleActionOf(intent)) {
            case 'primary':
              this.submitMaFocusCommit();
              break;
            case 'back':
              this.foldMaFocus();
              break;
            default:
              break;
            }
          }
          return;
        }
        if (intent.kind === 'nav') {
          this.consoleState.sheetIndex = stepGrid(
            this.consoleState.sheetIndex, intent.dir, this.maScreenItems.length, 2);
          return;
        }
        if (intent.kind === 'press') {
          switch (consoleActionOf(intent)) {
          case 'primary':
            // A = «Выбрать»: EVERY item descends into its detail stage —
            // taken/blocked ones included (the stage explains the state).
            // Nothing is ever submitted from the overview, and there is no
            // second inspect route: this IS the reading surface.
            this.enterMaFocus();
            break;
          case 'prevSection':
            if (this.maScreenKind !== 'milestones') {
              this.openSheet('milestones');
            }
            break;
          case 'nextSection':
            if (this.maScreenKind !== 'awards') {
              this.openSheet('awards');
            }
            break;
          case 'back':
            // A pending free-award-funding task DEFERS to the amber chip
            // (mandatory → inspect the board, then return); a no-op when the
            // player is merely viewing the M/A dashboard. A plain close also
            // drops any suspended detail draft — the visit is over.
            if (!this.awardFundingActive) {
              discardMaFocusDraft();
            }
            this.deferShellTask();
            leaveWorkspace();
            break;
          default:
            break;
          }
        }
        return;
      }
      if (intent.kind === 'nav') {
        const step = intent.dir === 'down' ? 1 : intent.dir === 'up' ? -1 : 0;
        if (step !== 0) {
          this.consoleState.sheetIndex = stepSelectable(
            this.consoleState.sheetIndex, step, this.sheetRows.map((r) => r.kind !== 'header'));
        }
        return;
      }
      if (intent.kind === 'press') {
        const a = consoleActionOf(intent);
        if (a === 'primary') {
          this.activateSheetRow(this.sheetRows[this.consoleState.sheetIndex]);
        } else if (a === 'back') {
          // B: ONE logical level. The hydro card pick uncovers the HYDRO track
          // it was opened from (its plan is still being composed there); a sheet
          // opened from the board home uncovers the board. Same verb, no
          // per-sheet special case — that is what a stack is for.
          leaveWorkspace();
        }
      }
    },
    handleSectionIntent(intent: GamepadIntent): boolean {
      // The console-native Hydronetwork screen owns its whole grammar
      // (stages / bonus / CTA / confirm modal / help). Y = Info Mode stays
      // global (handled before this point); the journal is board-home only.
      if (this.consoleState.section === 'hydro') {
        const hydro = this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined;
        hydro?.handleIntent(intent);
        return true;
      }
      if (intent.kind === 'nav') {
        this.handleSectionNav(intent.dir);
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      const onBoard = this.consoleState.section === 'board';
      // Stick-clicks are screen-specific (no base semantic action, by design) —
      // they carry board/hand context verbs, handled raw before the semantic switch.
      if (intent.button === 'stickL') {
        // L3 — «ОСМОТРЕТЬ ИСТОЧНИК» whenever a CONTEXTUAL pick is running (the
        // hand was opened BY an effect). Checked FIRST so the verb reads the
        // same on every contextual selection surface; X stays the card under
        // the cursor, which is why the source needs a button of its own.
        // DURING PLACEMENT L3 is the SAME verb: the card placing this tile.
        // (It used to be «next available cell» — a jump nobody used, on the one
        // screen where the shell's most consistent verb had nowhere to live.)
        // P27: on the board home L3 toggles BOARD INSPECTION MODE. In the hand's
        // sell-patents multi-select L3 = SELECT ALL / UNSELECT ALL.
        if (this.contextualSourceCard !== undefined) {
          this.inspectContextualSource();
        } else if (this.placementActive && this.consoleState.section === 'board') {
          this.inspectPlacementSource();
        } else if (onBoard) {
          this.toggleInspection();
        } else if (this.consoleState.section === 'hand' && this.consoleState.sale.active) {
          this.toggleSelectAllSale();
        } else if (this.consoleState.section === 'hand' && this.handPickActive && !this.handSelectSingle) {
          // Multi hand pick (Public Plans «reveal any number»): L3 = select all
          // candidates (bounded by max) / clear — mirrors the sale-mode L3.
          this.togglePickSelectAll();
        }
        return true;
      }
      if (intent.button === 'stickR') {
        // P20: R3 toggles INSPECT-ALL cells during placement (was the LT
        // hold) — persistent, announced, and reflected in every hint row.
        // P27b: on the board home R3 = SCALE INSPECTION (the cursor walks
        // the track bonuses in a circle). In the hand (non-sale) R3 RESETS the
        // tag filter to "All" (the right-stick AXIS still scrolls the grid).
        if (this.placementActive && this.consoleState.section === 'board') {
          this.consoleState.freeRoam = !this.consoleState.freeRoam;
          this.showNotice(this.consoleState.freeRoam ? 'Inspecting all cells' : 'Available cells only');
        } else if (onBoard) {
          this.toggleScaleInspect();
        } else if (this.consoleState.section === 'hand' && !this.consoleState.sale.active && !this.handSelectUiActive) {
          this.resetHandFilter();
        }
        return true;
      }
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        // Stable board semantics: LB = Milestones (viewable any time).
        // (P29c: the temporary board-scale tuner is gone — ×1.05 shipped
        // as the compiled default in ConsoleBoardSection.)
        // In the hand ALBUM — every mode of it — LB is the PREVIOUS PAGE:
        // leafing is the album's primary horizontal verb and the shoulder
        // pair is its natural instrument (the bay spine shows the same
        // LB/RB beside the position). The first page swallows the press.
        if (onBoard) {
          this.openSheet('milestones');
        } else if (this.consoleState.section === 'hand') {
          this.turnHandPage(-1);
        }
        return true;
      case 'nextSection':
        // In the hand ALBUM RB is the NEXT PAGE (see prevSection).
        if (onBoard) {
          this.openSheet('awards');
        } else if (this.consoleState.section === 'hand') {
          this.turnHandPage(1);
        }
        return true;
      case 'reset':
        this.toggleJournal();
        return true;
      case 'nextTab':
        // P27: RT = the action-category QUICK SELECTOR from the board home
        // (P20: including during placement — inspection is always allowed).
        // In the hand: sale mode CONFIRMS the sale, multi-select CONFIRMS the
        // picked set (established commit verbs — those modes have no tag
        // filters to cycle); the BROWSE hand cycles the tag filter FORWARD
        // (the filter is the album's secondary axis, on the triggers).
        if (onBoard) {
          this.openQuick('actions');
          return true;
        }
        if (this.consoleState.section === 'hand') {
          if (this.consoleState.sale.active) {
            this.confirmSale();
          } else if (this.handSelectUiActive) {
            // Multi-select: RT confirms the picked set (a single-card pick
            // submits directly on A, so RT is inert there).
            if (!this.handSelectSingle) {
              this.confirmHandSelect();
            }
          } else {
            this.cycleHandFilter(1);
          }
        }
        return true;
      case 'prevTab':
        // P27: LT = the basic-actions QUICK SELECTOR (board home only). In the
        // hand: SELECT mode toggles the "suitable only" filter (that IS its
        // one filter axis); the BROWSE hand cycles the tag filter BACK.
        if (onBoard) {
          this.openQuick('basics');
        } else if (this.consoleState.section === 'hand' && this.handSelectUiActive) {
          this.toggleSuitableOnly();
        } else if (this.consoleState.section === 'hand' && !this.consoleState.sale.active) {
          this.cycleHandFilter(-1);
        }
        return true;
      case 'primary':
        this.handleSectionConfirm();
        return true;
      case 'inspect':
        // P13 global rule: X reads the focused object fullscreen; on the BOARD
        // HOME (the main field context only — never mid-placement, never
        // inside an inspection mode) X opens the «Разыграно» tableau.
        //
        // THE COLONIES OVERVIEW HAS NO X. Both verbs led to the same place —
        // the focused colony's stage — so «Осмотреть» was a second name for
        // «Выбрать», and the bar advertised a choice that did not exist. One
        // press, one destination; the stage is the dossier AND the action.
        if (this.consoleState.section === 'hand') {
          this.zoomHandCard();
        } else if (onBoard && !this.placementActive &&
            !this.consoleState.inspecting && !this.consoleState.scaleInspecting) {
          this.openPlayedOverlay();
        }
        return true;
      case 'back':
        this.handleSectionBack();
        return true;
      default:
        return true;
      }
    },
    handleSectionNav(dir: NavDirection): void {
      // Mid-reveal the hand grid must not scroll (the flight targets were
      // measured against the current layout) — nav resumes at touchdown.
      // A FILTER episode never blocks input: snap it and navigate at once.
      if (this.consoleState.section === 'hand' && isHandRevealEpisodeRunning()) {
        if (runningHandRevealKind() !== 'filter') {
          return;
        }
        finishInstant();
      }
      if (this.consoleState.section === 'board') {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        // P27b: SCALE INSPECTION — the cursor walks the bonus ring
        // (left/up = counter-clockwise, right/down = clockwise, wraps).
        if (this.consoleState.scaleInspecting && !this.placementActive) {
          board?.stepTrackMarker(dir === 'right' || dir === 'down' ? 1 : -1);
          return;
        }
        // P27: the cells are NOT part of the normal command loop — the
        // board navigates only in INSPECTION mode or during a placement.
        if (!this.placementActive && !this.consoleState.inspecting) {
          // The button NAME comes from the active glyph set — the notice is
          // plain text (no glyph slot), so it interpolates the label rather
          // than hardcoding «L3», which is only correct by coincidence today.
          this.showNotice(translateTextWithParams('Press ${0} to inspect the board', [activeGlyphSet().stickL.label]));
          return;
        }
        board?.move(dir);
        return;
      }
      if (this.consoleState.section === 'colonies') {
        // 2D stepping over the premium tile grid (layout-aware columns).
        const count = this.coloniesForRail.length;
        const cols = colonyGridCols(colonyGridLayout(count, this.colonyPick !== undefined), count);
        this.consoleState.colonyIndex = colonyNavStep(dir, this.consoleState.colonyIndex, count, cols);
        return;
      }
      // Hand grid: delegate to the section — it owns the plan (cols), the
      // column-preserving up/down stepping, and keep-selected-visible.
      const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      hand?.move(dir);
    },
    handleSectionConfirm(): void {
      // No accidental card activation under the flying reveal proxies —
      // A waits out the episode (navigation stays free; B reverses).
      // A FILTER episode never blocks input: snap it and confirm at once.
      if (this.consoleState.section === 'hand' && isHandRevealEpisodeRunning()) {
        if (runningHandRevealKind() !== 'filter') {
          return;
        }
        finishInstant();
      }
      if (this.consoleState.section === 'board') {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        if (this.placementActive) {
          // Card-bonus cell: ARM the lift BEFORE activating — the click
          // submits synchronously through the headless SelectSpace, and the
          // cover must separate at submit time (never after the response).
          const targetId = this.consoleState.boardSpaceId;
          if (targetId !== undefined) {
            this.armBoardBonusIfCardCell(targetId);
          }
          if (board?.activate() !== true) {
            this.showNotice('Cannot place here');
            // Nothing was submitted — recall the armed cover instantly.
            abortBoardCardBonus('instant');
          }
        }
        return;
      }
      if (this.consoleState.section === 'colonies') {
        this.confirmColonySelection();
        return;
      }
      const entry = this.handEntries[this.consoleState.handIndex];
      if (entry === undefined) {
        return;
      }
      // Sale mode: A toggles the pick (shared with the fullscreen viewer).
      if (this.consoleState.sale.active) {
        this.toggleSalePick(entry.card.name);
        return;
      }
      // Hand SELECT (server task OR a client composer pick): A submits/resolves
      // the focused card (single) or toggles the pick (multi). A non-candidate
      // card explains WHY it can't be picked.
      if (this.handSelectUiActive) {
        this.handSelectPress(entry.card.name);
        return;
      }
      if (!entry.playable) {
        // The fork's rule: NEVER a bare "Нельзя разыграть" — always the reason.
        this.showNotice(this.handBlockedNotice(entry));
        return;
      }
      // Inspection is free; STARTING a play while something is already owed is
      // not — the cards are shown, the reason is named, nothing is hidden.
      if (this.actionBlockedReason !== '') {
        this.showNotice(this.actionBlockedReason);
        return;
      }
      this.openPlayCardFromHand(entry.card.name);
    },
    /** B: one calm step toward the console home (never destructive). */
    handleSectionBack(): void {
      // A running hand-reveal episode owns B: mid-open it REVERSES the same
      // timeline from its current progress (the hard `B` contract);
      // mid-close it's swallowed — the gather is already going home.
      // A FILTER episode is a state answer, not a journey: snap it and let
      // B proceed to the normal close below (responsiveness rule).
      if (isHandRevealEpisodeRunning()) {
        if (runningHandRevealKind() === 'filter') {
          finishInstant();
        } else if (this.handPickActive) {
          // Mid-open under a client pick: snap the flight — the pick-cancel
          // below owns the way back (a reversal would fight its section restore).
          finishInstant();
        } else {
          if (handRevealState.phase === 'opening') {
            reverseHandReveal();
          }
          return;
        }
      }
      // CLIENT HAND PICK: B returns to the composer with the OLD choice kept
      // (the pick is voluntary re-openable — never a lost decision).
      if (this.handPickActive) {
        cancelConsoleHandPick();
        return;
      }
      if (this.consoleState.sale.active) {
        // The sale is ON THE WIRE / physically flying — the press is absorbed
        // (the move is committed; folding the hand mid-scene would tear the
        // gather's live slots out from under its own proxies).
        if (isPatentSaleActive()) {
          return;
        }
        this.consoleState.sale.active = false;
        this.consoleState.sale.selected = [];
        // A sale hosted as a STEP of the std-projects flow folds ONE level
        // back — same workspace, same row, nothing sold. A standalone sale
        // (the legacy lateral entry) still closes to the board.
        if (workspaceFrameHost('hand') === 'standard-projects') {
          popWorkspaceFrame();
          this.rollbackStdProjectFlow();
        } else {
          goBoardHome();
        }
        return;
      }
      // A NESTED STEP (the hand hosted by the start, …): B minimizes the WHOLE
      // hosting workspace — its standard verb — never a bare close. Closing
      // just this level would leave the host standing around an empty zone.
      if (workspaceFrameHost('hand') !== undefined && !workspaceFrameIsOverlay('hand')) {
        this.collapseWorkspace();
        return;
      }
      // THE COLONY FOCUS STAGE: B folds ONE level back to the browse surface
      // (workspace flow: configure → browse) — before the shell-task branch,
      // so an X-opened dossier during a SelectColony pick closes to the grid
      // instead of deferring the whole prompt.
      if (this.colonyFocusOpen) {
        // …but PAST THE COMMIT the stage IS the resolution's scene (the payout,
        // the bonus cycles, the mandatory discard). B there means «свернуть» —
        // the whole workspace parks and the decision stays live on the board's
        // return card — never a fold that would tear the reveal out from under
        // its own flow, and never a way around a mandatory step. The FRAME's
        // phase is the discriminator (set by the resolution's own lifecycle),
        // so a casual inspect while someone ELSE's payout is pending still
        // closes normally.
        if (this.colonyResolutionLive &&
            isCommitted(workspaceFramePhase('colonies') ?? 'browse')) {
          this.collapseWorkspace();
          return;
        }
        closeColonyFocus();
        return;
      }
      // B on a shell-task surface: CANCEL when the server marker allows
      // (pay-on-commit Build Colony), else DEFER to inspect the board.
      if (this.shellTaskActive) {
        if (this.shellTask?.kind === 'colony' && this.colonyCancellable) {
          // Inside the std-projects flow the response to this cancel is what
          // folds the colony step back to the same browse row (the flow's
          // reconciler) — mark it so the fold is a return, never a close.
          if (stdProjectsFlowLive()) {
            requestStdProjectCancel();
          }
          this.submit(cancelResponse());
          return;
        }
        this.collapseWorkspace();
        return;
      }
      if (this.consoleState.section === 'hand') {
        // The physical gather back into the dock (plain browse close — the
        // sale / shell-task paths returned above with their own handling).
        void this.closeHandWithReveal();
        return;
      }
      // Any other open workspace SECTION: the verb comes from the STACK's own
      // depth model, so B can never do one thing and say another — a committed
      // step MINIMIZES its whole workspace (the embed contract's verb), a
      // browse layer closes, a descent folds. «Colonies» and «hydro» need no
      // branch of their own, and neither will the next screen. (A PARKED stack
      // projects to the board, so it falls through to the restore branch below,
      // where it belongs.)
      if (this.consoleState.section !== 'board') {
        if (workspaceStackBackVerb() === 'collapse') {
          this.collapseWorkspace();
        } else {
          workspaceStackBack();
        }
        return;
      }
      if (this.placementActive) {
        if (this.placementCancellable) {
          this.cancelPlacement();
        } else {
          this.showNotice('This placement is mandatory — pick a cell on the map');
        }
        return;
      }
      // A DEFERRED task comes back — B toggles task ↔ board-inspect, the same
      // thing the prompt card's A does.
      //
      // DELIBERATELY LAST of the "go somewhere" branches. It used to run FIRST,
      // as a global fallback, which made B inside another section (the hand,
      // colonies, hydro) yank the minimized prompt back instead of closing the
      // screen the player was looking at — B stopped meaning "one calm step
      // back" the moment anything was deferred. The task is reachable exactly
      // where its card is: from the BOARD HOME. Inspection modes stay BELOW it,
      // because "minimize to look at the board" is what deferring is for.
      // …and it is the SAME predicate the card itself renders on. Spelling the
      // condition out a second time is how it drifted: the card grew two more
      // arms (`startSceneServes`, a PARKED stack — a minimized flow whose
      // prompt is the action menu, which is neither a host nor a shell-section
      // kind) and B never got them, so the announcement stood at the board home
      // saying «вернуться», A restored it and B did nothing at all.
      if (this.mandatoryDeferredActive) {
        this.restoreDeferredTask();
        return;
      }
      // P27: inspection modes — B is one calm step back to the board home.
      if (this.consoleState.scaleInspecting) {
        this.exitScaleInspect();
        return;
      }
      if (this.consoleState.inspecting) {
        this.exitInspection();
      }
    },
    // ── the console-native journal (View — board home only) ─────────────
    toggleJournal(): void {
      if (journalState.open) {
        this.closeJournal();
        return;
      }
      // Board home only (safe context policy): a placement / another
      // section keeps the pad on its own task — honest notice, no toggle.
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
        return;
      }
      if (this.consoleState.section !== 'board') {
        this.showNotice('The journal is available from the main board');
        return;
      }
      journalState.open = true;
    },
    closeJournal(): void {
      journalState.open = false;
      // A read-only colony dossier only exists ON TOP of the journal — it must
      // not outlive it (e.g. a mandatory surface closes the journal underneath).
      if (this.journalColonyInspect !== undefined) {
        this.closeColonyInspect();
      }
    },
    // ── «Разыграно» — the played-cards tableau (X, board home only) ──────
    openPlayedOverlay(): void {
      // Board-home-only by the caller's guards; mutually exclusive with the
      // journal (both replace the player's attention, never each other).
      if (journalState.open) {
        this.closeJournal();
      }
      this.playedOpen = true;
    },
    closePlayedOverlay(): void {
      this.playedOpen = false;
      resetConsolePlayedUi();
      // Focus returns to the board home — the board stays mounted (v-show)
      // with its own retained cursor state; nothing to restore explicitly.
    },
    /** A in the first-action modal: submit that corp's option of the
     *  corporationInitialAction OrOptions — byte-identical to the desktop
     *  start-flow submit. The action's follow-ups (a Tharsis city placement,
     *  Vitor's award pick …) arrive as native tasks; Merger's second
     *  first-action re-opens the modal with the remaining corp. */
    onCorpFirstActionConfirm(name: CardName): void {
      const prompt = startFlowCorpPrompt(this.playerView);
      const index = corpActionOptionIndexFor(prompt, name);
      if (prompt === undefined || index === -1) {
        return;
      }
      this.consoleState.task.deferred = false;
      this.submit({type: 'or', index, response: {type: 'option'}});
    },
    /** B in the first-action modal: the MANDATORY prompt is DEFERRED to the
     *  amber chip (B returns to it) — never just swallowed. */
    onCorpFirstActionDefer(): void {
      this.deferShellTask();
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
          const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
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
      const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
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
    // ── quick selectors / sheets ─────────────────────────────────────────
    /** Open a quick selector from the board home (RT toggles 'actions', LT 'basics'). */
    openQuick(id: ConsoleQuickId): void {
      if (this.consoleState.quick === id) {
        this.consoleState.quick = undefined;
        return;
      }
      this.consoleState.quick = id;
      closeWorkspaceSheet();
      if (id === 'actions') {
        // PRE-WARM the Action Center's preview cache when the RT wheel opens:
        // by the time the player commits «Действия карт» (~300 ms of human
        // time) the per-card previews are complete, so the grid renders its
        // final geometry and sort on the FIRST frame. Idempotent + SWR.
        // ⚠️ AFTER the flush, never inline: the synchronous form ran the
        // whole-tableau fingerprint + per-card graphic walks + the fetch
        // fan-out BEFORE the wheel's first paint — on a late-game Deck that
        // is exactly the frame the wheel's entry animation needs.
        void this.$nextTick(() => {
          if (this.consoleState.quick === 'actions') {
            ensureActionPreviews(this.playerView);
          }
        });
      }
    },
    openSheet(sheet: WorkspaceFrameKind): void {
      // A HAND-OPEN IS ALWAYS A FRESH INSTANCE. Opening a sheet from the wheel
      // while a flow is set aside is «посмотреть», never «вернуться»: the
      // player gets the workspace's ordinary browse layer (read-only while a
      // decision is owed — `actionBlockedReason` states the one reason), the
      // parked chain keeps owning its own state, and RESUME keeps exactly two
      // doors — the board-home restore card (A/B) and the notification CTA,
      // both through `restoreDeferredTask`. This used to route into a full
      // restore instead, which stood the parked deep flow back up under a
      // browse intent — the half-restored «ДЕЙСТВИЯ КАРТ › ПЛУТОН › ПЛУТОН ·
      // СБРОС КАРТЫ» screen. (`enterWorkspace` is lateral: the park is
      // untouched, and the next restore simply gives this browse visit way.)
      const parkOwed = workspaceStackCollapsed();
      // Opening anything that is NOT the task's own surface defers the task;
      // opening the task's OWN surface un-defers it (back on the surface).
      // While a park is owed, NOTHING un-defers here: the parked chain owns
      // the pending decision, and clearing the flag with frames still parked
      // leaves them owned by nobody and reachable by nothing (the invariant
      // `parked non-empty ⇒ deferred`).
      // A FRESH std-projects open never adopts a dead flow (the module record
      // outlives the frame by design — the board excursion needs it — but a
      // deliberate re-entry through the wheel starts at browse).
      if (sheet === 'standard-projects') {
        resetStdProjectsFlow();
      }
      // …and a fresh ДЕЙСТВИЯ КАРТ open starts at the DEFAULT facets («Все» +
      // «Не активированы») for the same reason — see resetCardActionsFilter.
      if (sheet === 'card-actions') {
        resetCardActionsFilter();
      }
      const isTaskSurface = !parkOwed && ((sheet === 'standard-projects' &&
        this.shellTask?.kind === 'projectCard' && this.shellTask.mode === 'standardProject') ||
        (sheet === 'awards' && this.shellTask?.kind === 'awardFunding'));
      if (!isTaskSurface) {
        this.deferShellTask();
      } else {
        this.consoleState.task.deferred = false;
      }
      this.consoleState.quick = undefined;
      enterWorkspace(sheet);
      void this.$nextTick(() => {
        // A RESTORED MA detail owns the cursor (the task-restore door seated
        // it on the draft item before this tick) — never re-home it.
        if (maFocusState.open) {
          return;
        }
        // P26/P27: the MA + Std-Projects screens focus the first ACTIONABLE
        // card, else the top row.
        const selectables = this.maScreenKind !== undefined ?
          this.maScreenItems.map((it) => ({header: false, available: it.available})) :
          sheet === 'standard-projects' ?
            this.stdProjectItems.map((it) => ({header: false, available: it.available})) :
            this.sheetRows.map((r) => ({header: r.kind === 'header', available: r.available}));
        const firstAvailable = selectables.findIndex((s) => !s.header && s.available);
        const firstSelectable = selectables.findIndex((s) => !s.header);
        this.consoleState.sheetIndex = firstAvailable !== -1 ? firstAvailable : Math.max(0, firstSelectable);
      });
    },
    /** A = «Выбрать» on the overview — descend into the focused item's
     *  detail stage. The SCREEN arms the descend origins (the pressed card's
     *  and its emblem pedestal's rects) synchronously at the press. */
    enterMaFocus(): void {
      (this.$refs.maScreen as InstanceType<typeof ConsoleMaScreen> | undefined)?.enterFocus();
    },
    /** B on the detail stage (pre-commit) — fold back to the overview; the
     *  browse layer was only parked, so selection and scroll survive. */
    foldMaFocus(): void {
      closeMaFocus();
    },
    /**
     * A on the detail stage — the ONE commit of the MA workspace. Re-resolves
     * the LIVE option path (the prompt may have moved while the stage was
     * open) and submits the byte-identical nested OR response. The stage does
     * NOT close: the flow enters `committing` (input absorbed), the ceremony
     * is armed as a candidate + the embed claim is set, and the commit
     * watchers decide the outcome (ceremony / payment step / honest refusal).
     * A blocked press answers with the CONCRETE inline reason, never a mute
     * no-op — the stage stays up for reading either way.
     */
    submitMaFocusCommit(): void {
      if (!maFocusState.open || maFocusState.phase !== 'detail') {
        return;
      }
      // A double-tap of A on the list must never buy the thing it just opened:
      // the stage has to have been READABLE first (consoleMaFocus.COMMIT_ARM_MS).
      if (!maFocusCommitArmed()) {
        return;
      }
      const item = this.maFocusItem;
      const view = this.maFocusView;
      if (item === undefined || view === undefined) {
        return;
      }
      if (this.actionBlockedReason !== '') {
        setMaFocusError(this.actionBlockedReason);
        return;
      }
      if (!this.maFocusAvailable) {
        setMaFocusError(this.maFocusBlockReason !== '' ? this.maFocusBlockReason : 'Unavailable right now');
        return;
      }
      const found = item.kind === 'milestone' ?
        findMilestoneOptionPath(this.playerView.waitingFor) :
        findAwardOptionPath(this.playerView.waitingFor, this.awardNames);
      if (found === undefined) {
        setMaFocusError('Unavailable right now');
        return;
      }
      const options = found.options as ReadonlyArray<{type: string, title: string | Message}>;
      const innerIdx = options.findIndex((o) => o.type === 'option' && inputTitleText(o.title) === item.name);
      if (innerIdx === -1) {
        setMaFocusError('Unavailable right now');
        return;
      }
      beginMaFocusCommit({gameAge: this.game.gameAge, undoCount: this.game.undoCount});
      claimMaCeremonyEmbed(item.kind, item.name);
      armMaCeremony({kind: item.kind, name: item.name, cost: view.cost, free: view.free});
      this.armMaFocusSafety();
      // Deliberately NOT `submitInnerOption` — that helper closes the console
      // layers, and the whole point here is that the workspace stays up.
      this.submit(wrapPath([...found.path, innerIdx], {type: 'option' as const}));
    },
    /** The committing beat may never hang: a commit with no verdict restores
     *  the reversible detail with an honest reason. */
    armMaFocusSafety(): void {
      this.clearMaFocusSafety();
      this.maFocusSafetyTimer = window.setTimeout(() => {
        this.maFocusSafetyTimer = undefined;
        if (maFocusState.phase === 'committing') {
          abandonMaCeremonyEmbed();
          disarmMaCeremony();
          failMaFocusCommit('Unavailable right now');
        }
      }, MA_COMMIT_SAFETY_MS);
    },
    clearMaFocusSafety(): void {
      if (this.maFocusSafetyTimer !== undefined) {
        window.clearTimeout(this.maFocusSafetyTimer);
        this.maFocusSafetyTimer = undefined;
      }
    },
    /**
     * The commit-outcome watcher body (pure decision: consoleMaFocus).
     * Runs on every playerView commit AND on every ceremony-queue change —
     * whichever arrives first (the queue is fed by NotificationLayer's own
     * update hook, so the two race benignly).
     */
    evaluateMaFocusCommit(): void {
      if (maFocusState.phase !== 'committing') {
        return;
      }
      const committed = maFocusState.committedAt;
      if (committed === undefined) {
        return;
      }
      const models = maFocusState.kind === 'milestone' ? this.game.milestones : this.game.awards;
      const model = models.find((m) => m.name === maFocusState.name);
      const takenColor = model !== undefined && model.playerName !== undefined && model.playerName !== '' ?
        model.color : undefined;
      const outcome = maFocusCommitOutcome({
        committing: true,
        kind: maFocusState.kind,
        name: maFocusState.name,
        beat: this.maCurrentBeat,
        takenByViewer: takenColor !== undefined && takenColor === this.thisPlayer.color,
        takenByOther: takenColor !== undefined && takenColor !== this.thisPlayer.color,
        paymentPromptUp: this.playerView.waitingFor?.type === 'payment',
        viewAdvanced: this.game.gameAge !== committed.gameAge || this.game.undoCount !== committed.undoCount,
      });
      switch (outcome.kind) {
      case 'wait':
        return;
      case 'ceremony':
        this.clearMaFocusSafety();
        if (this.maScreenKind === undefined || this.maFocusItem === undefined) {
          // The stage is gone (external teardown) — consume the claimed beat
          // deterministically; the board already shows the result.
          abandonMaCeremonyEmbed();
          resetMaFocus();
          return;
        }
        beginMaFocusCeremony();
        return;
      case 'payment':
        // Helion / Stormcraft: the claim's own payment step needs the
        // standard payment surface — the workspace yields (today's exact
        // behaviour for this fork of the flow); the still-armed ceremony
        // then plays globally once the payment resolves.
        this.clearMaFocusSafety();
        releaseMaCeremonyEmbed();
        resetMaFocus();
        leaveWorkspace();
        return;
      case 'refused': {
        this.clearMaFocusSafety();
        abandonMaCeremonyEmbed();
        disarmMaCeremony();
        const reason = outcome.cause === 'raced' ?
          (maFocusState.kind === 'milestone' ? 'Already claimed' : 'Already funded') :
          (this.maFocusBlockReason !== '' ? this.maFocusBlockReason : 'Unavailable right now');
        failMaFocusCommit(reason);
        return;
      }
      default:
        return;
      }
    },
    /**
     * The ceremony's OWN completion signal (the stage's timeline settled —
     * never a parallel timeout): consume the beat, close the workspace. The
     * screen's unmount hook performs the final state reset.
     */
    onMaCeremonyDone(): void {
      if (maFocusState.phase !== 'ceremony') {
        return;
      }
      beginMaFocusClosing();
      abandonMaCeremonyEmbed();
      leaveWorkspace();
    },
    activateSheetRow(row: ConsoleSheetRow | undefined): void {
      if (row === undefined || row.kind === 'header') {
        return;
      }
      // The overlays stay OPEN for inspection while something is owed, but
      // STARTING another action would desync the prompt the server is holding.
      if (this.actionBlockedReason !== '') {
        this.showNotice(this.actionBlockedReason);
        return;
      }
      if (!row.available) {
        this.showNotice(row.reason !== undefined && row.reason !== '' ? row.reason : 'Unavailable right now');
        return;
      }
      // (No generic sheet carries activatable rows today — the premium
      // screens each own their activation path.)
    },
    /** A on the Standard-Projects premium screen (P27) — use / sell. */
    activateStdItem(item: StdProjectItem | undefined): void {
      if (item === undefined) {
        return;
      }
      if (this.actionBlockedReason !== '') {
        this.showNotice(this.actionBlockedReason);
        return;
      }
      if (!item.available) {
        // The deficit reason carries params — pre-translate for the notice.
        const reason = item.reason !== '' ?
          translateTextWithParams(item.reason, [...(item.reasonParams ?? [])]) :
          'Unavailable right now';
        this.showNotice(reason);
        return;
      }
      if (item.key === 'sell-patents') {
        // Patent sale — the hand carousel's SALE mode, hosted as a STEP of
        // this very flow: the workspace descends («› ПРОДАЖА ПАТЕНТОВ»), the
        // hand teleports into its zone, B folds back to the same row with
        // nothing sold. Nothing reaches the server until the sale confirms.
        this.consoleState.sale.active = true;
        this.consoleState.sale.selected = [];
        if (workspaceFrameMounted('standard-projects')) {
          this.armStdpStepOrigin();
          setWorkspaceFrameSubject('standard-projects', 'Patent sale');
          setWorkspaceFramePhase('standard-projects', 'configure');
          this.openHandWorkspace();
          // The crumb's tail is the HAND STEP's own stage name, handed up:
          // «СТАНДАРТНЫЕ ПРОЕКТЫ › ПРОДАЖА ПАТЕНТОВ › ВЫБОР КАРТ».
          setWorkspaceFrameStage('hand', 'Card selection');
          this.consoleState.handIndex = 0;
        } else {
          // No workspace standing (a degenerate entry) — the lateral fallback.
          enterWorkspace('hand');
        }
        return;
      }
      if (item.cardName !== undefined) {
        this.useStandardProject(item.cardName);
      }
    },
    // ── the console-native card-action center (ConsoleCardActions.vue) ────
    // It owns the whole flow (list · inspector · composer) and builds the
    // byte-identical activation batch itself; the shell only POSTs + closes.
    onCardActionsSubmitBatch(responses: ReadonlyArray<unknown>): void {
      // AWAITING HANDOFF (surface motion): the composer's batch is COMMITTED.
      // The center + composer HOLD the stage until the server's answer picks
      // the next scene — closing them here used to blank the board for the
      // whole round-trip (the "confirm → bare board → reveal" gap). The
      // playerView watcher resolves: a reveal continues the scene as a PHASE
      // handoff (the source card FLIPs across), anything else dismisses; a
      // lost response expires via AWAITING_SAFETY_MS.
      beginAwaitingHandoff('action-composer', {
        gameAge: this.playerView.game.gameAge,
        undoCount: this.playerView.game.undoCount,
      });
      // Belt-and-braces expiry: a lost response / dead server can never
      // strand the held stage (the watcher's expiry needs a fresh view to
      // fire; this timer needs nothing). Fingerprinted by startedAt so a
      // newer awaiting is never clobbered.
      const startedAt = surfaceMotionState.awaiting?.startedAt;
      window.setTimeout(() => {
        if (surfaceMotionState.awaiting !== undefined && surfaceMotionState.awaiting.startedAt === startedAt) {
          clearAwaitingHandoff();
          closeConsoleLayers();
        }
      }, AWAITING_SAFETY_MS + 250);
      this.submitBatch(responses);
    },
    onCardActionsClose(): void {
      closeConsoleLayers();
    },
    /**
     * B past the COMMIT BOUNDARY — collapse, not back. The workspace parks so
     * the board can be read; the committed decision keeps living inside it, at
     * full depth, and comes back untouched (same revealed card, same picks, no
     * replayed cinematic, no second trip to the server).
     */
    onCardActionsCollapse(): void {
      this.collapseWorkspace();
    },
    /** B on the repeat-pick grid → cancel the whole repeat pick (return to the
     *  source composer with the OLD choice kept). */
    onRepeatPickClose(): void {
      cancelConsoleRepeatPick();
    },
    acceptConfirm(): void {
      const kind = this.consoleState.confirm;
      this.consoleState.confirm = undefined;
      if (kind === 'pass') {
        const path = findPassPath(this.playerView.waitingFor);
        if (path !== undefined) {
          this.submit(optionResponseForPath(path));
        }
      } else if (kind === 'convertHeat') {
        const found = findConvertHeatOption(this.playerView.waitingFor);
        if (found !== undefined) {
          this.submit(optionResponseForPath(found.path));
        }
      }
    },
    // ── flows ────────────────────────────────────────────────────────────
    openPlayCard(cardName: CardName): void {
      const action = this.playAction;
      const card = action?.input.cards.find((c) => c.name === cardName);
      if (action === undefined || card === undefined || card.isDisabled === true) {
        return;
      }
      // DESCEND, don't open a modal. The player is standing IN «Карты в руке»,
      // so playing this card is the next stage of that screen — claimed
      // SYNCHRONOUSLY (before any render) so no frame can hand the composer to
      // the standalone band first. Opened from anywhere else there is no
      // workspace to be inside of, and the band is the honest presentation.
      // …and INSIDE the Game Start Workspace's play-from-hand step the player
      // is likewise standing in a hand — the composer must descend into its
      // stage zone, never open its own band on top of the workspace (that band
      // is the «modal arrived» reading the whole step exists to remove).
      // A card picked up INSIDE the hand is a PHASE of the hand's frame, never
      // a second frame: the browse grid parks (its selection, filter and scroll
      // survive for free) and the composer teleports into the frame's own zone.
      // The anchor moves with it — a card that leaves the hand takes its own
      // configure stage with it.
      if (workspaceFrameMounted('hand')) {
        descendWorkspaceFrame('hand', cardName, 'Playing', {type: 'cardInHand', card: cardName});
      }
      this.pendingPlayCard = {cardName, input: {...action.input, cards: [card]}};
    },
    /**
     * T8 (pre-select parity): the native play composer resolved — assemble the
     * byte-identical PlayerInputBatch (`buildPlayCardBatch` mirrors
     * PlayerHome.submitPlayCardBatch): the wrapped `{type:'projectCard', card,
     * payment}` + pre-branch responses + the on-play BRANCH pick + every
     * pre-collected step. Genuine follow-ups (board placement / multi-card
     * picks) still arrive as native tasks — the batch's graceful fallback
     * leaves the leftover prompt for them.
     */
    /** The live hand-grid slot for a card (data-zoom-slot marker). */
    handExitSlot(name: CardName): HTMLElement | null {
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      return document.querySelector<HTMLElement>(`.con-hand [data-zoom-slot="${esc}"]`);
    },
    /**
     * DIRECT play from the hand (A on a playable card) — the PERSISTENT HERO.
     *
     * ONE FaceLite hero spawns over the pressed card in the same paint its
     * slot hides (`stagedHandCard`), answers the press on itself (commit ring
     * + lift, `heroCommitLift`), and flies a FIXED-duration transfer into the
     * composer's pre-held card well — the flight starts only once the well's
     * rect has held still across frames, and the real card is revealed UNDER
     * the still-opaque hero on touchdown. Around it, the stage's enter hook
     * fades the rest of the hand in place and materializes the work-surface
     * groups WHILE the hero travels — the card and the level assemble as one
     * event. The grid itself never moves; a far-right card differs only in
     * velocity, never in duration or quality.
     */
    openPlayCardFromHand(name: CardName): void {
      const slot = this.handExitSlot(name);
      // Opening pendingPlayCard ALSO engages the Vue-managed hand-slot hold
      // (stagedHandCard) in the same flush — the source card leaves the
      // table the frame its hero exists; no double-vision, patch-proof.
      this.openPlayCard(name);
      if (slot === null) {
        return;
      }
      void guardHandHeroFlight(runCardTransfer({
        name,
        from: slot,
        resolveTo: () => document.querySelector<HTMLElement>('.con-composer--play [data-zoom-handoff="play-card"]'),
        holdTarget: true,
        onSpawn: heroCommitLift,
      }));
    },
    /**
     * CANCEL of the play composer: the card physically RETURNS to its hand
     * slot (the reverse transfer — playing was never committed). The modal
     * closes at onLift; the hand slot stays held (returningPlayCard) until
     * the proxy TOUCHES DOWN, so the card materializes exactly under it. A
     * hand slot hidden by filters/virtualization degrades to the dive-away
     * exit (touchdown still fires — the hold is always released).
     */
    onPlayCardCancel(): void {
      // Mid-transaction (submit in flight / scene running) a cancel would
      // corrupt the hero state — the input chain already swallows B, this
      // is the belt-and-braces for programmatic emits.
      if (isPlayedHeroActive()) {
        return;
      }
      const pending = this.pendingPlayCard;
      if (pending === undefined) {
        return;
      }
      const name = pending.cardName;
      // The hero flies HOME — the same persistent-hero grammar reversed: it
      // spawns over the anchored card (which hides under it in the same
      // paint), the leave hook blooms the hand back in around the flight, and
      // the card is revealed in its own held-empty slot on touchdown. One
      // path for the workspace descent and the standalone band alike.
      const modalSlot = document.querySelector<HTMLElement>('.con-composer--play [data-zoom-handoff="play-card"]');
      if (modalSlot === null) {
        this.pendingPlayCard = undefined;
        return;
      }
      this.returningPlayCard = name; // keeps the hand slot held across the modal close
      void guardHandHeroFlight(runCardTransfer({
        name,
        from: modalSlot,
        resolveTo: () => this.handExitSlot(name),
        // ONE visible owner from the first frame: the anchored card hides
        // under the hero the moment it spawns — the composer stays mounted
        // through its own leave fade, and without the hold both would paint
        // together for the length of that fade.
        holdFrom: true,
        onLift: () => {
          this.pendingPlayCard = undefined;
        },
        onTouchdown: () => {
          this.returningPlayCard = undefined;
        },
      }));
    },
    clearDepartingPlayCard(): void {
      this.departingPlayCard = undefined;
      if (this.departingTimer !== undefined) {
        window.clearTimeout(this.departingTimer);
        this.departingTimer = undefined;
      }
    },
    onPlayCardConfirmNative(payload: {branchIndex: number, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, payment: Payment, rewards?: ReadonlyArray<ResourceTransferSpec>, draws?: number, repeat?: ConsoleRepeatPickResult}): void {
      const action = this.playAction;
      const pending = this.pendingPlayCard;
      if (pending === undefined || action === undefined) {
        this.pendingPlayCard = undefined;
        return;
      }
      // The HERO transaction (spec: no visual success before the server's
      // word). The composer STAYS OPEN through the submit; nothing lifts,
      // nothing closes. On the confirmed response the transport gate runs
      // the scene — the composer closes UNDER the lifted card at the
      // 'lifting' phase (watcher below); a refused play keeps the composer
      // intact and re-arms its CTA on 'failed'. Double-confirm is blocked
      // both here and by the composer's own submit latch.
      if (isPlayedHeroActive()) {
        return;
      }
      const isEvent = getCard(pending.cardName)?.type === CardType.EVENT;
      const batch = buildPlayCardBatch({
        playPath: action.path,
        cardName: pending.cardName,
        payment: payload.payment,
        branchIndex: payload.branchIndex,
        preResponses: payload.preResponses,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
        // ProjectInspection: append the chosen already-used action + its
        // composed responses → `[play, {card:chosen}, ...composed]`.
        repeat: payload.repeat,
      });
      // ProjectInspection ENTERS through card PLAY, so it EXITS like a card
      // play — never into the Action Center (that surface is the Viron entry
      // point). The event card runs its played-hero scene FIRST (same as any
      // play, repeat tail already in the batch); a repeated REVEAL action
      // (SearchForLife / AsteroidDeflection) then presents its verdict as this
      // workspace's own next stage, AFTER the hero (the reveal is withheld
      // while `playedHeroHolds`). So the order is always: the card is seen
      // played, THEN the action result applies — inside the surface the press
      // was made in, exactly like every other outcome of a play.
      // `rewards` = the play's immediate resource gains (composer-extracted
      // from the server preview) — the hero scene's reward beat carries them
      // from the landed card onto the left panel, delta chips at contact.
      // HOST: a play composed INSIDE the hand workspace lands in the
      // workspace's own EMBEDDED «Разыграно» stage — the standalone overlay
      // never opens for it. A play with no descent behind it (the
      // playFromHand band) — or one made while the player's own table is
      // already open — keeps the overlay scenery.
      armPlayedHero(pending.cardName, isEvent, {
        manualTableOpen: this.playedOpen,
        rewards: payload.rewards,
        host: workspaceFrameDescended('hand') && !this.playedOpen ? 'workspace' : 'overlay',
      });
      // EVERYTHING THIS PLAY SETS OFF STAYS INSIDE THE WORKSPACE IT WAS MADE
      // IN — the cards it draws, the pick it raises. Claimed in the same press
      // as the submit (nothing card-shaped can slip past and open a standalone
      // surface for a frame), by the ONE resolver every play door shares, and
      // OPTIMISTICALLY: a play that turns out to produce nothing embeddable is
      // reconciled away a tick after the response, whereas a missing claim
      // sends a full-bleed reveal over a workspace that has already let go.
      // …including a REPEATED action's verdict: the composed repeat says
      // structurally whether the branch it copied reveals a card, so «Проверка
      // проекта» hosts its «Результат вскрытия» itself instead of handing it to
      // the full-bleed modal over a workspace that had just produced it.
      claimPlayOutcome(pending.cardName, payload.draws ?? 0,
        {deckCheck: payload.repeat?.reveal === true});
      // The descent crosses its commit boundary HERE: the crumb's stage marker
      // goes amber (a committed step is a statement, not an invitation), the
      // depth model stops offering «back» for a move the server already has —
      // and the FRAME survives the round trip on the same fact. Between this
      // submit and the project's landing the server names no prompt at all, and
      // a claim that lapsed there would tear the hand out from under a card
      // that is still in the air.
      setWorkspaceFramePhase('hand', 'executing');
      this.submitBatch(batch);
    },
    /**
     * The hydro stage-7 pick (reuse-a-blue-action) — the ДЕЙСТВИЯ КАРТ
     * surface in REPEAT mode: the SAME premium browser + composer Viron /
     * Проверка проекта use (full dossier, filters, honest reasons, EVERY
     * pre-select of the chosen action composed in place). A PRE-SELECT: the
     * resolve writes the plan (hydroNetworkState.selectedCard + the composed
     * tail), the marker does not move, and the player returns to the hydro
     * summary to commit deliberately. (Stage 9 lives in the workspace's own
     * embedded target step now — the flat pick sheet is gone.)
     */
    openHydroRepeatPick(): void {
      const preview = hydroNetworkState.previewColor === this.thisPlayer.color ?
        hydroNetworkState.preview : undefined;
      const candidates = preview?.reuseActionCards ?? [];
      if (candidates.length === 0 || this.repeatPickActive) {
        this.showNotice('Unavailable right now');
        return;
      }
      // A «change» re-open pre-focuses the previous pick; the filter the player
      // relaxed during THIS operation is kept (fresh open resets it — the
      // bridge scopes the default to the operation).
      const previous = consoleHydroUi.repeatResult;
      const prior = previous !== undefined && previous.chosenCard === hydroNetworkState.selectedCard ?
        {chosenCard: previous.chosenCard, nodeIndex: previous.nodeIndex} : undefined;
      setHydroRepeatBridge(true);
      // THE HANDOFF: the hydro workspace releases FIRST and the nested scene
      // opens on its settle — one surface leaves, the next arrives. (Opening
      // straight away is what stacked one workspace over the other, the
      // parent still lit underneath.) The return half rides the bridge's own
      // falling edge, out of the exact pose the release left behind.
      const openBridge = (): void => {
        enterConsoleRepeatPick({
          title: 'Use a blue card action that has already been used this generation',
          buttonLabel: 'Take action',
          candidates,
          disabled: [],
          // The fork presents the Hydronetwork as a systemic module — the
          // breadcrumb names IT, never the lore «Delta Project» card.
          source: {kicker: 'Mars Hydronetwork', card: CardName.DELTA_PROJECT, label: 'Mars Hydronetwork'},
          prior,
        }, (result) => {
          // A PLAN write (never a submit): the shared brain keeps the card, the
          // console layer keeps the composition. The player lands back on the
          // hydro summary — «Укрепить» stays THEIR deliberate press.
          hydroNetworkState.selectedCard = result.chosenCard;
          consoleHydroUi.repeatResult = result;
          setHydroRepeatBridge(false);
        }, () => {
          setHydroRepeatBridge(false);
        });
      };
      const section = this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined;
      if (section === undefined || section === null) {
        openBridge();
        return;
      }
      section.playBridgeHandoff(openBridge);
    },
    useStandardProject(cardName: CardName): void {
      const action = this.standardProjectsAction;
      const card = action?.input.cards.find((c) => c.name === cardName);
      if (action === undefined || card === undefined || card.isDisabled === true) {
        return;
      }
      const cost = card.calculatedCost ?? 0;
      if (hasUsableStandardProjectAlternativeResources(this.thisPlayer, card, action.input.paymentOptions ?? {})) {
        // T3 → North Star: the alt-resource payment is a STEP of this flow —
        // the task host (promptOverride) teleports into the workspace's own
        // zone («› ОПЛАТА»), the browse layer parks, B cancels back to the
        // same row with nothing committed. The workspace never closes.
        const title = standardProjectPaymentTitle(cardName);
        if (workspaceFrameMounted('standard-projects')) {
          this.armStdpStepOrigin();
          setWorkspaceFrameSubject('standard-projects', cardName);
          setWorkspaceFrameStage('standard-projects', 'Payment');
          setWorkspaceFramePhase('standard-projects', 'configure');
        }
        this.pendingClientPayment = {
          cardName,
          input: buildStandardProjectPaymentModel(this.playerView, action.input, card, title, cost),
        };
        return;
      }
      this.submitStandardProjectPayment(cardName, Payment.of({megacredits: cost}));
    },
    /**
     * THE ONE SUBMIT of the standard-projects flow (plain M€ and the payment
     * step both funnel here). The workspace does NOT close: the frame enters
     * its `executing` beat (input absorbed by phase — a double press cannot
     * exist), the rows freeze, and the RESPONSE decides what the flow is —
     * a nested target step (pay-on-commit), a terminal committed beat, or an
     * honest fold for a follow-up this workspace has no surface for
     * (`reconcileStdProjectsFlow`). A lost response rolls back via the safety.
     */
    submitStandardProjectPayment(cardName: CardName, payment: Payment): void {
      const action = this.standardProjectsAction;
      if (action === undefined) {
        return;
      }
      if (workspaceFrameMounted('standard-projects')) {
        beginStdProjectSubmit(cardName, this.stdProjectItems, this.consoleState.sheetIndex,
          `${this.game.gameAge}|${this.game.undoCount}`);
        // THE COMMIT PHRASE STARTS ON THE PRESS, not on the answer: the row's
        // tactile response owes nothing to the network, and arming here (in
        // the same synchronous turn as the submit) is what lets a fast
        // response find the phrase already running. A project that turns out
        // to need a TARGET releases it again — the gold belongs to a move
        // that is finished, and only a terminal project's is.
        armStdProjectCommit(cardName);
        setWorkspaceFrameSubject('standard-projects', cardName);
        setWorkspaceFrameStage('standard-projects', '');
        setWorkspaceFramePhase('standard-projects', stdProjectsFramePhase('submitting'));
        this.armStdProjectSafety();
      } else {
        // Degenerate entry (no workspace standing) — the legacy close-first path.
        closeConsoleLayers();
      }
      this.submit(wrapPath(action.path, {type: 'projectCard' as const, card: cardName, payment}));
    },
    /**
     * A submit whose response never lands must not strand the player inside a
     * sealed `executing` beat: roll the flow back to browse and say so. The
     * fingerprint (flow still submitting for the SAME card) keeps a late
     * response from being clobbered — mirrors `armMaFocusSafety`.
     */
    armStdProjectSafety(): void {
      const card = stdProjectsFlow.card;
      window.setTimeout(() => {
        if (stdProjectsFlow.state === 'submitting' && stdProjectsFlow.card === card) {
          this.rollbackStdProjectFlow();
          this.showNotice('Unavailable right now');
        }
      }, 12_000);
    },
    /** Arm the std-projects DESCEND phrase from the focused row (the screen
     *  owns the rect; a stale/missing arm degrades to a plain surface). */
    armStdpStepOrigin(): void {
      (this.$refs.stdpScreen as InstanceType<typeof ConsoleStdProjectsScreen> | undefined)?.armStepOrigin();
    },
    /** A refused/lost submit — the flow returns to its reversible browse layer. */
    rollbackStdProjectFlow(): void {
      resetStdProjectsFlow();
      if (workspaceFrameMounted('standard-projects')) {
        setWorkspaceFrameSubject('standard-projects', '');
        setWorkspaceFrameStage('standard-projects', '');
        setWorkspaceFramePhase('standard-projects', 'browse');
      }
    },
    /**
     * THE FLOW'S OWN RECONCILER — one place that answers «the server replied;
     * what is this flow now?» (runs from the playerView watcher, before the
     * generic identity block). The response, not a client guess, decides:
     *  · a colony/space follow-up → a NESTED TARGET STEP (pay-on-commit,
     *    still reversible — B cancels server-side for free);
     *  · the action menu again → a TERMINAL COMMIT (short committed beat,
     *    then the workspace closes);
     *  · anything else → an honest fold (this workspace has no surface for
     *    it; the prompt routes to its own home, exactly as before).
     * The cancel legs live here too: the response to a placement/colony
     * cancel is what folds the step back (or reopens the folded workspace)
     * onto the very row the player left.
     */
    reconcileStdProjectsFlow(): void {
      if (!stdProjectsFlowLive()) {
        return;
      }
      const task = taskFor(this.playerView);
      if (stdProjectsFlow.state === 'submitting') {
        // THE RESPONSE IS THE WATCHER'S OWN EXISTENCE. This runs from the
        // `playerView` watcher, which fires only when a NEW view arrives — so
        // being here at all, in `submitting`, IS the answer. A value gate
        // (`gameAge|undoCount`) looked safer and was strictly worse: those
        // counters do not have to move for a standard project, so the gate
        // silently swallowed the colony answer and the flow stayed
        // `submitting` — a later cancel then arrived at the branch below and
        // was celebrated as a TERMINAL COMMIT.
        if (stdProjectsFlow.cancelRequested) {
          // Answered by a CANCEL (the player pressed B before the follow-up
          // stood up): nothing was spent — return to the browse layer.
          this.rollbackStdProjectFlow();
          return;
        }
        if (task?.kind === 'colony') {
          // openColoniesForPrompt (the shellTask auto-open below) hosts it as
          // a step of this frame; the flow is still reversible.
          // The commit phrase was armed on the press — release it: this move
          // is NOT finished, and the root list must not flash gold at a
          // project whose target has not been chosen yet.
          releaseStdProjectCommit();
          markStdProjectTarget();
          if (workspaceFrameMounted('standard-projects')) {
            setWorkspaceFramePhase('standard-projects', stdProjectsFramePhase('target'));
          }
          return;
        }
        if (task?.kind === 'space' || this.placementActive) {
          // The board serves the placement (the placement watcher already
          // folded the frames — the board IS the step). The excursion draft
          // is what brings a cancel back to this very row.
          releaseStdProjectCommit(); // …and no gold: the move is not finished
          markStdProjectTarget();
          return;
        }
        if (task === undefined || task.kind === 'actionMenu') {
          // TERMINAL SUCCESS — the world has changed (the HUD ticks its own
          // delta chips); the row states the commit, then the flow closes.
          this.playStdProjectCommitBeat();
          return;
        }
        // A follow-up this workspace has no surface for (a Moon placement, a
        // Collusion party pick, the maxed-oceans Whales redirect): fold
        // honestly and let the prompt route to its own home.
        releaseStdProjectCommit();
        resetStdProjectsFlow();
        if (workspaceFrameMounted('standard-projects')) {
          goBoardHome();
          closeConsoleLayers();
        }
        return;
      }
      if (stdProjectsFlow.state === 'target') {
        // The COLONY step's cancel leg: the cancel response restored the
        // action menu — fold the step back to the same browse row (nothing
        // spent, focus untouched). The colony COMMIT leg needs nothing here:
        // the build's own completion signal closes the whole flow
        // (onColonyFlowComplete), and mid-payout guards live there.
        if (stdProjectsFlow.cancelRequested && task?.kind !== 'colony' && task?.kind !== 'space' &&
            !this.placementActive) {
          if (workspaceFrameHost('colonies') === 'standard-projects') {
            // The step's own frame goes with the demand that raised it.
            popWorkspaceFrame();
          }
          if (workspaceFrameMounted('standard-projects')) {
            this.rollbackStdProjectFlow();
            return;
          }
          // The PLACEMENT cancel leg: the workspace was folded for the board —
          // reopen it on the very row the player left (a RESUME via the
          // module draft, never a re-homed fresh open).
          const draft = stdProjectsFlow.boardExcursion;
          resetStdProjectsFlow();
          if (draft !== undefined && this.standardProjectsAction !== undefined) {
            enterWorkspace('standard-projects');
            this.consoleState.sheetIndex = stepIndex(draft.sheetIndex, 0, this.stdProjectItems.length);
          }
          return;
        }
        // The placement COMMITTED (a space answered, the flow moved past it):
        // the tile hero + bonuses play on the board; nothing returns to the
        // list — the flow is spent the moment the server moved on.
        if (stdProjectsFlow.boardExcursion !== undefined && !workspaceFrameMounted('standard-projects') &&
            !stdProjectsFlow.cancelRequested && task?.kind !== 'space' && !this.placementActive) {
          resetStdProjectsFlow();
        }
        return;
      }
      // state === 'commit' — the beat timer owns the close.
    },
    /**
     * The TERMINAL commit's closing half. By the time this runs the gold has
     * already swept (the `WaitingFor` gate ran it and released the world's
     * change at its peak — that is why the delta chips are landing right now,
     * on the crest, and not before the player saw the row fix).
     *
     * All that remains is the READ: the committed gold holds for a beat, then
     * the flow leaves through its ONE guarded conclusion. The workspace can
     * therefore never close before the commit is legible, and the length is
     * the phrase's own (`stdProjectCommitBeatMs`), not a number typed here.
     */
    playStdProjectCommitBeat(): void {
      markStdProjectCommit();
      if (workspaceFrameMounted('standard-projects')) {
        setWorkspaceFramePhase('standard-projects', stdProjectsFramePhase('commit'));
      }
      window.setTimeout(() => {
        if (stdProjectsFlow.state !== 'commit') {
          return;
        }
        releaseStdProjectCommit();
        this.endStdProjectsFlow();
      }, Math.max(motionMs(STDP_HOLD_MS), 1));
    },
    /**
     * THE FLOW IS OVER — the ONE exit of this workspace, whichever ending
     * reached it (a terminal beat, a colony's own payout, a placement that
     * committed). It routes through the shared guarded conclusion, so a
     * hold — a step still standing, a live outcome, an owned prompt, a park —
     * postpones the ending instead of tearing a result off the screen; the
     * `stdpConclusionSignal` watcher re-asks as those holds fall.
     */
    endStdProjectsFlow(): void {
      resetStdProjectsFlow();
      this.concludeWorkspaceFlow('standard-projects');
    },
    submitInnerOption(found: {options: ReadonlyArray<unknown>, path: ReadonlyArray<number>} | undefined, targetTitle: string): boolean {
      if (found === undefined) {
        return false;
      }
      const options = found.options as ReadonlyArray<{type: string, title: string | Message}>;
      const innerIdx = options.findIndex((o) => o.type === 'option' && inputTitleText(o.title) === targetTitle);
      if (innerIdx === -1) {
        this.showNotice('Unavailable right now');
        return false;
      }
      closeConsoleLayers();
      this.submit(wrapPath([...found.path, innerIdx], {type: 'option' as const}));
      return true;
    },
    // ── the colony workspace (browse ⇄ focus; submit mirrors desktop) ─────
    /**
     * Descend into the FOCUSED colony's stage (A = trade, X = inspect — ONE
     * stage either way; consoleColoniesModel.colonyFocusState). The section
     * arms the descend origin (the pressed tile's rect) and opens the flow;
     * the shell only gates re-entry during a live transaction.
     */
    /**
     * DOES TRADING HERE PUT CARDS ON THE TABLE? — the ONE structural question
     * behind the colonies' embedded-outcome claim, asked of the colony's own
     * metadata and never of its name.
     *
     * Both trade paths used to claim `['draw']` unconditionally while the
     * build path beside them was already structural. The claim's only visible
     * consequence is that the workspace stands a follow-up STAGE from submit
     * time — so every colony that pays in production, plants or heat opened an
     * empty, dimmed stage over its own focus surface and held it there
     * (`completeFlow` refuses to fold under a live claim) until the 20 s
     * claim backstop fired. Луна was the report; every non-card colony had it.
     */
    colonyTradeDealsCards(colonyName: string): boolean {
      const model = this.coloniesForRail.find((c) => c.name === colonyName);
      if (model === undefined) {
        return false;
      }
      const metadata = getColony(colonyName as ColonyName);
      const top = metadata.trade.quantity.length - 1;
      // The OWNER bonus only becomes a reveal for THIS player when this player
      // owns a settlement here — otherwise its cards are dealt to someone else
      // and there is nothing for our workspace to present.
      const ownerDraw = colonyOwnerBonusDrawsCards(metadata) &&
        this.thisPlayer !== undefined && model.colonies.includes(this.thisPlayer.color);
      return ownerDraw || colonyTradeMayDrawCards(metadata, Math.min(model.trackPosition, top));
    },
    /**
     * The STRUCTURAL claim kinds of a trade on this colony: `draw` when its
     * payout deals cards the workspace will present, `pick` when a reward can
     * land ON a card the viewer points at (Titan's floaters, Enceladus'
     * microbes — income or the viewer's own settlement bonus). The composer
     * pre-collects every pick into the batch, so `pick` normally never
     * surfaces — the claim is the DEFENSE for the prompt that still does (a
     * capture pruned mid-flight): it teleports into the colony stage's own
     * zone instead of rising as a standalone band over the workspace that
     * asked the question.
     */
    colonyTradeClaimKinds(colonyName: string): Array<'draw' | 'pick'> {
      const kinds: Array<'draw' | 'pick'> = [];
      if (this.colonyTradeDealsCards(colonyName)) {
        kinds.push('draw');
      }
      const model = this.coloniesForRail.find((c) => c.name === colonyName);
      if (model !== undefined) {
        const ownsSettlement = this.thisPlayer !== undefined && model.colonies.includes(this.thisPlayer.color);
        if (colonyTradeAsksCardTargets(getColony(colonyName as ColonyName), ownsSettlement)) {
          kinds.push('pick');
        }
      }
      return kinds;
    },
    enterColonyFocus(intent: ColonyFocusIntent): void {
      if (this.coloniesForRail.length === 0 || this.colonyFocus.open) {
        return;
      }
      // A trade in flight owns the moment (its own gates already swallow A/X;
      // this is the belt for the first frame before they engage).
      if (isTradeFleetActive() || colonyTradeState.active) {
        return;
      }
      const section = this.$refs.coloniesSection as InstanceType<typeof ConsoleColoniesSection> | undefined;
      section?.enterFocus(intent);
    },
    /**
     * A on the colony grid — standalone section AND embedded step alike.
     * T4: a server SelectColony pick outranks the trade flow; without a pick
     * A descends into the focused colony's FOCUS STAGE (trade intent —
     * blocked colonies descend too: the stage carries the honest verdict and
     * the full dossier, which beats a bare refusal notice).
     */
    confirmColonySelection(): void {
      // THE OVERVIEW SELECTS; THE FOCUS STAGE RESOLVES (iteration 2). A on
      // the grid never performs an irreversible action any more — every verb
      // descends into the ONE detail surface, where the destination, the
      // grant and the consequences are on screen before the confirm.
      const pick = this.colonyPick;
      if (pick !== undefined) {
        if (isColonyBuildActive()) {
          return; // a build hero is already flying — never re-enter
        }
        this.enterColonyFocus(pick.buttonLabel === 'Build' ? 'build' : 'pick');
        return;
      }
      if (this.actionBlockedReason !== '') {
        this.showNotice(this.actionBlockedReason);
        return;
      }
      this.enterColonyFocus('trade');
    },
    /**
     * The FOCUS STAGE's build confirm (A on the build brief): arm the
     * premium colony-build hero and submit — the cube physically flies into
     * the stage's own destination slot (the big berth is the live anchor
     * while the stage is up). The stage STAYS: the build resolves where it
     * was configured. A board follow-up (an ocean/hazard build bonus)
     * self-heals via the `placementActive` watcher.
     */
    onColonyBuildConfirm(payload?: {steps: ReadonlyArray<TradeStep>, captures: Readonly<Record<number, unknown>>, targets?: ColonyTradeTargets}): void {
      const pick = this.colonyPick;
      const name = this.colonyFocus.colonyName;
      if (pick === undefined || name === '' || isColonyBuildActive()) {
        return;
      }
      const selected = this.coloniesForRail.find((c) => c.name === name);
      if (selected === undefined || !pick.selectable.includes(selected.name)) {
        return;
      }
      // THE ATOMIC COMMIT of a build hosted by the STD-PROJECTS flow: this is
      // the single press that spends the project's cost (pay-on-commit), so
      // BOTH frames cross the boundary together — B stops meaning «отмена» and
      // starts meaning «свернуть», and the flow's conclusion (the build's own
      // payout finishing) is what closes the chain. `closeConsoleLayers` must
      // NOT run here: it pops the sheet-shaped host out from under the very
      // step that is committing.
      if (workspaceFrameHost('colonies') === 'standard-projects') {
        setWorkspaceFramePhase('standard-projects', 'committed');
        setWorkspaceFramePhase('colonies', 'committed');
      } else {
        closeConsoleLayers();
      }
      this.consoleState.task.deferred = false;
      // The guards accepted: freeze the stage's presentation for the whole
      // resolution (the answer flips its props under the flying cube).
      (this.$refs.coloniesSection as InstanceType<typeof ConsoleColoniesSection> | undefined)?.holdFocusStage();
      const slotIndex = Math.min(2, selected.colonies.length);
      // THE PLACEMENT BONUS'S HOST CARD, chosen on the stage before the cube
      // moves (Titan's floaters). It rides the transaction so the reward chip
      // flies onto that exact card — and the batch below answers the prompt
      // the server is about to raise, so the player is never asked twice.
      armColonyBuild(selected.name, slotIndex, this.thisPlayer.color, payload?.targets?.incomeTargetCard);
      // EMBEDDED OUTCOME — the same two lines the trade paths already have.
      // WITHOUT them a build whose placement bonus DRAWS (Pluto: «возьмите 2
      // карты») had no claim, so `workspaceClaimsColonyReveal` was false, the
      // section never published its embed zone and the reveal teleported to
      // `body` as a full-bleed band over the colony workspace. `kinds` is
      // STRUCTURAL — derived from the colony's own build benefit, so a colony
      // that grants no cards claims nothing and `reconcileWorkspaceOutcome`
      // has nothing to drop.
      {
        const buildKinds: Array<'draw' | 'pick'> = [];
        if (colonyBuildDrawsCards(getColony(selected.name as ColonyName), slotIndex)) {
          buildKinds.push('draw');
        }
        // `pick` — the same late-prompt defense the trade paths carry: a
        // build whose slot bonus lands ON a card (Titan's floaters) keeps
        // any unbatched target prompt inside this workspace.
        if (colonyBuildAsksCardTarget(getColony(selected.name as ColonyName), slotIndex)) {
          buildKinds.push('pick');
        }
        if (buildKinds.length > 0) {
          claimWorkspaceOutcome('colonies', selected.name, buildKinds);
          markWorkspaceOutcomeArrivalDone();
          // …and the BEAT is not owed either — exactly as on the trade paths.
          // THE COVER-LIFT SCENE OWNS THIS PAYOUT'S PACING: the build bonus
          // separates from the slot's own printed card glyph and flies into
          // the reveal's real slots, which it can only measure once that
          // reveal is MOUNTED. Leaving the beat pending held the surface for
          // the whole 2.6 s backstop, so the scene found no slots, degraded,
          // and the cards then appeared out of nothing when the backstop
          // fired — the reported «при строительстве карты просто появляются».
          // The hold exists to protect a beat nobody else is playing; here
          // somebody is.
          markWorkspaceOutcomeBeatDone();
        }
      }
      // The BUILD's own pre-collected tail — byte-identical to answering the
      // live prompts one at a time (`stepResponse`, the trade's own builder),
      // truncated at the first uncaptured step so a diverged decision still
      // arrives as an honest live prompt.
      const responses: Array<unknown> = [colonyResponse(selected.name)];
      for (const [i, step] of (payload?.steps ?? []).entries()) {
        const response = stepResponse(step, payload?.captures[i]);
        if (response === undefined) {
          break;
        }
        responses.push(response);
      }
      if (responses.length > 1) {
        this.submitBatch(responses);
        return;
      }
      this.submit(colonyResponse(selected.name));
    },
    /**
     * The FOCUS STAGE's generic pick confirm (setup remove / Aridor add-tile
     * / a card's free-trade SelectColony). A trade-labelled pick gets the
     * full premium launch (fleet + reward transaction + Pluto claim) and
     * resolves ON the stage; the one-shot picks fold back to the overview —
     * the server's next prompt (or the latch's finalize) drives what
     * surfaces next.
     */
    onColonyPickConfirm(): void {
      const pick = this.colonyPick;
      const name = this.colonyFocus.colonyName;
      if (pick === undefined || name === '') {
        return;
      }
      const selected = this.coloniesForRail.find((c) => c.name === name);
      if (selected === undefined || !pick.selectable.includes(selected.name)) {
        return;
      }
      closeConsoleLayers();
      this.consoleState.task.deferred = false;
      if (pick.buttonLabel === 'trade') {
        if (isTradeFleetActive() || colonyTradeState.active) {
          return;
        }
        (this.$refs.coloniesSection as InstanceType<typeof ConsoleColoniesSection> | undefined)?.holdFocusStage();
        // The PRESSED cell — the origin of the pre-trade advance leg (a
        // trade-offset card moves the track forward before the reward is
        // read). Server truth as of the press; the manifest names where it
        // lands.
        armColonyTrade(selected.name as ColonyName, this.thisPlayer.color, {}, selected.trackPosition);
        armTradeFleet(selected.name as ColonyName, this.thisPlayer.color);
        // STRUCTURAL, like the build path beside it: a colony that pays in
        // production or plants has no follow-up stage to stand. `pick` rides
        // along when a reward can land ON a card — the defense that keeps a
        // late card-target prompt inside this workspace.
        {
          const kinds = this.colonyTradeClaimKinds(selected.name);
          if (kinds.length > 0) {
            claimWorkspaceOutcome('colonies', selected.name, kinds);
            markWorkspaceOutcomeArrivalDone();
            // The TRADE owns this batch's whole pacing (veil + cover flight):
            // the generic execution-beat gate must not hold the veiled reveal
            // off screen while the covers need its slots measured.
            markWorkspaceOutcomeBeatDone();
          }
        }
        this.submit(colonyResponse(selected.name));
        return;
      }
      this.submit(colonyResponse(selected.name));
      closeColonyFocus();
      if (!this.colonyEmbedActive) {
        goBoardHome();
      }
    },
    /**
     * THE COLONY FLOW IS OVER (the stage settled and folded itself). A
     * committed action only moves FORWARD: never back onto the overview the
     * player configured from. Whatever is still unresolved owns the screen —
     * a live task surface already took it — and otherwise the field does.
     */
    onColonyFlowComplete(): void {
      // THE RESOLUTION'S LAST NET first: whatever local edge fired this
      // completion, nothing goes home while the viewer still owes a Pluto
      // follow-up (a pending discard, a flight, a parked batch). The gate has
      // one owner (colonyResolutionLive); this is its enforcement here.
      if (this.colonyResolutionLive) {
        return;
      }
      // A colony step of the STD-PROJECTS flow. The completion signal fires for
      // BOTH endings — the build and the cancel — so the discriminator is the
      // HOST FRAME's own phase, never the signal: past the commit boundary the
      // build happened and the WHOLE flow closes in one splice (never a flash
      // of the parent list between the payout and the board); still reversible
      // means the player CANCELLED, and the step simply folds back to the row
      // they came from (the flow's reconciler owns that leg).
      if (workspaceFrameHost('colonies') === 'standard-projects') {
        if (isCommitted(workspaceFramePhase('standard-projects') ?? 'browse')) {
          // ONE guarded conclusion for every ending of this workspace — never
          // a local close (the `stdpConclusionSignal` watcher re-asks it as
          // the holds fall, so a step that unmounts on its own schedule still
          // ends the flow instead of stranding the parent list on screen).
          this.endStdProjectsFlow();
        }
        return;
      }
      // An embedded host normally CONTINUES the sequence (a played card's own
      // colony pick is one step of playing it) — but a card-sourced TRADE has
      // no continuation: the card action was never submitted, the trade IS the
      // whole move. Its host is a browse list of actions, and one of them has
      // just been used, so returning there would land the player on a screen
      // that no longer offers what they came from.
      if ((this.colonyEmbedActive && cardColonyTradeCard() === '') || this.shellTaskActive) {
        return;
      }
      if (this.consoleState.section === 'colonies') {
        goBoardHome();
      }
    },
    /** X on a JOURNAL colony row — open the READ-ONLY dossier over the journal. */
    openJournalColonyInspect(name: ColonyName): void {
      this.journalColonyInspect = name;
      consoleColoniesUi.inspectOpen = true;
    },
    closeColonyInspect(): void {
      this.journalColonyInspect = undefined;
      consoleColoniesUi.inspectOpen = false;
    },
    /** The JOURNAL dossier owns the pad while open: ↑/↓ scroll, B/X close.
     *  (Pinned to its one colony — no paging, no trade bridge.) */
    handleColonyInspectIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          const scroller = document.querySelector<HTMLElement>('.con-colinspect .con-colinspect__main');
          scroller?.scrollBy({top: intent.dir === 'down' ? 140 : -140, behavior: 'smooth'});
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      const a = consoleActionOf(intent);
      if (a === 'back' || a === 'inspect') {
        this.closeColonyInspect();
      }
    },
    /**
     * The FOCUS STAGE's ONE confirm: the trade and-response + every
     * pre-collected follow-up (M€ payment mix / track choice / card targets)
     * as a single PlayerInputBatch — byte-identical to answering the live
     * prompts one at a time (a diverged later step gracefully arrives as a
     * live prompt).
     */
    onColonyTradeComposerConfirm(payload: {paymentIndex: number, steps: ReadonlyArray<TradeStep>, captures: Readonly<Record<number, unknown>>, targets?: ColonyTradeTargets}): void {
      const colonyName = this.colonyFocus.colonyName;
      const ctx = this.tradeColonyContext;
      // Guard a double-confirm: once the launch is armed the flight (and then
      // the whole reward transaction) owns the moment, so a second press can
      // never re-submit — even after the ship has already docked.
      if (colonyName === '' || ctx === undefined || !ctx.colonies.includes(colonyName) ||
          isTradeFleetActive() || colonyTradeState.active) {
        return;
      }
      const batch = buildTradeBatch({
        tradePath: ctx.path,
        paymentIndex: payload.paymentIndex,
        colonyName,
        steps: payload.steps,
        captures: payload.captures,
      });
      // The stage's card-resource DESTINATIONS — its picked targets AND the
      // single-candidate AUTO targets the server applies without a prompt
      // (`colonyTradeCardDestinations`, one read for the flight and the
      // presented scene alike) — ride into the reward transaction so each
      // chip can fly onto the exact host card. The fallback derivation covers
      // an older payload shape (picks only, no autos).
      const targets: ColonyTradeTargets = payload.targets ?? (() => {
        const derived: ColonyTradeTargets = {};
        const bonusPicks: Array<CardName> = [];
        payload.steps.forEach((step, i) => {
          const capture = payload.captures[i];
          if (step.kind !== 'cardTarget' || capture === undefined) {
            return;
          }
          if (step.role === 'tradeReward') {
            derived.incomeTargetCard = capture as CardName;
          } else {
            bonusPicks.push(capture as CardName);
          }
        });
        if (bonusPicks.length > 0) {
          derived.bonusTargetCards = bonusPicks;
        }
        return derived;
      })();
      // PREMIUM LAUNCH — ITERATION 2: the trade RESOLVES ON THE FOCUS STAGE.
      // The stage does NOT fold at the confirm: the fleet lifts off the
      // always-visible fleet dock and docks at the HERO PLANET's orbital
      // berth, the reward waves launch from the stage's own result groups,
      // the Pluto payout reveals over the stage, and the white marker glides
      // home along the EXPANDED track — the action completes exactly where
      // it was configured. The WaitingFor `holdingForTradeFleet` gate blocks
      // the view commit until the ship docks; the section auto-folds back to
      // the overview only when the WHOLE transaction has settled (its
      // `colonyTradeState.active` falling edge). Desktop is unaffected.
      (this.$refs.coloniesSection as InstanceType<typeof ConsoleColoniesSection> | undefined)?.holdFocusStage();
      // …and the pressed cell, so a trade-offset card's forward step is a
      // MOVE the player watches instead of a number that changed (see the
      // overview path above).
      armColonyTrade(colonyName, this.thisPlayer.color, targets,
        this.coloniesForRail.find((c) => c.name === colonyName)?.trackPosition);
      armTradeFleet(colonyName, this.thisPlayer.color);
      // EMBEDDED OUTCOMES (north star): the player confirmed the trade INSIDE
      // the colony workspace, so its drawn payout (Pluto's income / colony
      // bonuses) presents INSIDE it — the section publishes an embed zone and
      // the reveal re-homes there. The claim is synchronous with the submit
      // (nothing may slip to a standalone band for a frame); `sourceCard`
      // carries the COLONY name (the claim key `workspaceClaimsColonyReveal`
      // matches the server's own `{type:'colony', colonyName}` batch source).
      // The claim is STRUCTURAL (`colonyTradeClaimKinds`) — a colony with no
      // card payout and no card-target reward claims nothing, so it stands no
      // follow-up stage; a trade that could have dealt but didn't is released
      // by `reconcileWorkspaceOutcome` a tick after the answer. The arrival
      // gate is opened up front: the trade transaction OWNS the pacing (veil
      // + cover flight + input lock), so the generic batch-arrival gate must
      // not double-hold the pad.
      {
        const kinds = this.colonyTradeClaimKinds(colonyName);
        if (kinds.length > 0) {
          claimWorkspaceOutcome('colonies', colonyName, kinds);
          markWorkspaceOutcomeArrivalDone();
          // Same as the overview-confirm path: the trade transaction owns the
          // pacing — the veiled reveal must mount promptly so the covers can
          // measure its landing slots.
          markWorkspaceOutcomeBeatDone();
        }
      }
      this.submitBatch(batch);
    },
    // ── hydro advance (mirrors PlayerHome.submitHydroAdvance; the stage-7
    //    COMPOSED repeat appends the ProjInsp/Viron-parity batch tail) ─────
    submitHydroAdvance(payload: {
      spend: number, rewardChoice: number | undefined, selectedCard?: CardName,
      repeat?: ConsoleRepeatPickResult, fromPosition: number, toPosition: number,
      rewards?: ReadonlyArray<ResourceTransferSpec>,
      resultLines?: ReadonlyArray<HydroDeltaLine>, vp?: number,
      stageNameKey?: string, kind?: HydroResolutionKind, targetBefore?: number,
    }): void {
      const path = findHydroActionPath(this.playerView.waitingFor);
      if (path === undefined || isHydroMarkerActive() || this.hydroFlow.commit !== undefined) {
        return; // guard a double-confirm: the flow owns the moment
      }
      const responses = hydroAdvanceResponses(optionResponseForPath(path), payload);
      const kind: HydroResolutionKind = payload.kind ?? 'plain';
      // THE COMMIT BOUNDARY — the flow record freezes the decision (route,
      // choice, target, the result stage's lines) before anything moves.
      beginHydroCommit({
        kind,
        fromPosition: payload.fromPosition,
        toPosition: payload.toPosition,
        spend: payload.spend,
        rewardChoice: payload.rewardChoice,
        selectedCard: payload.selectedCard,
        composedRepeat: payload.repeat !== undefined,
        targetBefore: payload.targetBefore,
        rewardLines: payload.resultLines ?? [],
        vp: payload.vp,
        stageNameKey: payload.stageNameKey ?? '',
      });
      // The landed stage's CARD payout presents INSIDE the workspace — the
      // claim is raised synchronously at submit (the North-Star embedded
      // outcome), and the follow-up prompt is what the parked frame serves.
      if (kind === 'deck-draw') {
        claimWorkspaceOutcome('hydro', CardName.DELTA_PROJECT, ['draw', 'pick'], 0, 4);
        setWorkspaceFrameServes('hydro', ['deckSelect']);
      } else if (kind === 'repeat' && payload.repeat !== undefined) {
        // The repeated action's own draws/picks/VERDICT embed exactly like a
        // direct activation's would — kinds derived from its cached preview
        // branch (structural, never a card table); a cache miss degrades
        // standalone. `deck-check` is here for the same reason the other two
        // are: the copy is this workspace's move, so what it turns over is this
        // workspace's result — «ГИДРОСЕТЬ › ПОИСКИ ЖИЗНИ › РЕЗУЛЬТАТ ВСКРЫТИЯ»,
        // not a full-bleed modal over the track that produced it.
        const branch = actionPreviewMap().get(payload.repeat.chosenCard)
          ?.branches[payload.repeat.composed.branchIndex];
        let expectedCards = 0;
        for (const e of branch?.effects ?? []) {
          if (e.direction === 'gain' && e.icon === 'cards') {
            expectedCards += Math.max(1, Math.round(e.amount));
          }
        }
        const kinds: Array<WorkspaceOutcomeKind> = [];
        if (branch?.reveal !== undefined) {
          kinds.push('deck-check');
        }
        if (expectedCards > 0) {
          kinds.push('draw', 'pick');
        }
        if (kinds.length > 0) {
          claimWorkspaceOutcome('hydro', payload.repeat.chosenCard, kinds,
            payload.repeat.nodeIndex, expectedCards);
        }
        setWorkspaceFrameServes('hydro', ['deckSelect', 'cardSelect', 'payment', 'choice', 'amount', 'resource', 'player']);
      } else if (kind === 'card-resource') {
        // The presented target's counter ticks off the framework's own
        // touchdown tally — a payout ARMS by resetting it.
        resetCardResourceLandings();
      }
      // PREMIUM MARKER ADVANCE: ARM the glide (client-side, from→to) FIRST —
      // the WaitingFor `holdingForHydroMarker` gate BLOCKS the commit (delta
      // chips / new position) until the token LOCKS IN — then submit. The
      // flow advances off the marker watcher; desktop is unaffected.
      armHydroMarker(payload.fromPosition, payload.toPosition, this.thisPlayer.color, payload.rewards ?? []);
      this.syncHydroFramePhase();
      this.submitBatch(responses);
    },
    /** The flow is over (result read / skipped) — reset and go home. */
    finishHydroFlow(): void {
      if (this.hydroResultTimer !== undefined) {
        window.clearTimeout(this.hydroResultTimer);
        this.hydroResultTimer = undefined;
      }
      if (this.hydroFlow.commit === undefined) {
        return;
      }
      if (workspaceOutcomeState.host === 'hydro') {
        releaseWorkspaceOutcome('hydro-flow-complete');
      }
      setWorkspaceFrameServes('hydro', []);
      resetHydroFlow();
      resetHydroPlan();
      consoleHydroUi.repeatResult = undefined;
      if (this.consoleState.section === 'hydro') {
        goBoardHome();
      }
    },
    /** Mirror the flow's phase onto the FRAME — B's verb and the input gate
     *  read the stack, never a hydro-private flag. */
    syncHydroFramePhase(): void {
      if (workspaceFrameIndex('hydro') >= 0) {
        setWorkspaceFramePhase('hydro', hydroWorkspacePhase(this.hydroFollowUpLive));
      }
    },
    confirmSale(): void {
      const picked = this.consoleState.sale.selected;
      if (picked.length === 0 || isPatentSaleActive()) {
        return; // the terminal owns the moment — never a double submit
      }
      const action = findSellPatentsAction(this.playerView.waitingFor);
      if (action === undefined) {
        this.showNotice(offTurnReason(this.awaitingInput));
        return;
      }
      const cards = [...picked] as Array<CardName>;
      // PREMIUM PATENT SALE: ARM the trade-terminal scene FIRST — the sold
      // cards' live hand-slot rects are captured in this same synchronous
      // turn (the hand is still on screen) — THEN submit. The sale UI stays
      // up while the cards flip + gather; the `patentSaleState.phase`
      // watcher closes it when the stack enters the terminal, and the
      // WaitingFor `holdingForPatentSale` gate blocks the commit (new M€ /
      // delta chip) until the payout chip lands on the resource rail.
      // Desktop is unaffected (never arms).
      armPatentSale({cards});
      // Hosted as a step of the STD-PROJECTS flow: the commit is on the wire —
      // the frame crosses into its transient beat (crumb amber, B absorbed by
      // phase). The sale scene's own phases drive the rest; 'failed' rolls
      // this back beside the picks it preserves.
      if (workspaceFrameHost('hand') === 'standard-projects') {
        setWorkspaceFramePhase('standard-projects', 'executing');
      }
      this.submit(wrapPath(action.path, {type: 'card' as const, cards}));
    },
    onConvertPlantsSpacePicked(spaceResponse: {type: 'space', spaceId: string}): void {
      const found = this.convertPlantsPending;
      this.convertPlantsPending = undefined;
      if (found === undefined || found.path.length === 0) {
        return;
      }
      this.armBoardBonusIfCardCell(spaceResponse.spaceId);
      this.submit(wrapPath(found.path, spaceResponse));
    },
    /**
     * The placed cell prints a card-draw bonus and its cover is on the
     * board → ARM the "card bonus lifts off the cell" cinematic BEFORE the
     * submit (the cover separates while the server resolves; the arriving
     * tile-source reveal is then staged instead of popping instantly). A
     * cell without the visual source (no icon in the DOM) never arms —
     * the standard reveal flow stays untouched.
     */
    armBoardBonusIfCardCell(spaceId: string): void {
      // A confirm mid-Planet-Focus-growth settles the board FIRST — this is
      // the earliest cell-anchor measurement of the commit chain (the cover
      // icon rect), and it must never read a still-moving hex. Runs before
      // the DRAW_CARD guard on purpose: armTilePlacement (the next
      // measurer) is only reached through the same submit.
      snapPlanetFocusSettled();
      const space = this.playerView.game.spaces.find((s) => s.id === spaceId);
      if (space === undefined || !space.bonus.includes(SpaceBonus.DRAW_CARD)) {
        return;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(spaceId) : spaceId;
      const icon = document.querySelector(`.board-space[data_space_id="${esc}"] .board-space-bonus--card`);
      if (icon === null) {
        return;
      }
      armBoardCardBonus({kind: 'board-cell', spaceId});
    },
    cancelPlacement(): void {
      if (this.taskSpacePending !== undefined) {
        // A task's nested board pick: nothing committed — return to the task.
        this.taskSpacePending = undefined;
        this.finalGreeneryPickPending = false;
        return;
      }
      if (this.convertPlantsPending !== undefined) {
        // Client-side picker: nothing committed — just drop it.
        this.convertPlantsPending = undefined;
        return;
      }
      // A placement raised by the STD-PROJECTS flow: the cancel's response is
      // what REOPENS the folded workspace on the very row the player left
      // (the flow's reconciler) — mark the leg so it reads as a return.
      if (stdProjectsFlowLive()) {
        requestStdProjectCancel();
      }
      cancelPlacement();
    },
    // ── CTS task host (T1–T3) ────────────────────────────────────────────
    onTaskSubmit(response: unknown): void {
      // The CLIENT payment resolves into the std-project response (T3).
      if (this.pendingClientPayment !== undefined) {
        const cardName = this.pendingClientPayment.cardName;
        this.pendingClientPayment = undefined;
        const payment = (response as {payment?: Payment}).payment;
        if (payment !== undefined) {
          this.submitStandardProjectPayment(cardName, payment);
        }
        return;
      }
      // (The starting-cards DELIVERY is armed + fired entirely inside
      // ConsoleStartScene — the hold begins at the first ceremony frame and
      // the flight fires ONLY on the project-payment confirm. The shell just
      // hosts the delivery layer + passes the held set to the dock.)
      //
      // …but NOT when this host is the workspace's own outcome: the layers it
      // would close include the workspace HOSTING it. Buying a revealed card
      // is pick-then-pay, and tearing the frame down between the two halves is
      // the same break the embedding removes. The workspace folds on its own
      // signal (the claim's release) once the server stops asking.
      //
      // …and the same holds for an embedded EFFECT DECISION: answering the
      // question a play's own card asked is a stage of that play, not the end
      // of the screen it was made in (the discard it opens, and the card that
      // discard buys, are still inside this workspace).
      if (!this.taskBelongsToWorkspace && this.effectDecisionEmbedTarget === undefined) {
        closeConsoleLayers();
      }
      this.consoleState.task.deferred = false;
      this.submit(response);
    },
    /**
     * Government Support scale param (temp/oxygen/venus): CLOSE the panel
     * first, THEN submit — so the board scale glide + accent (see the
     * commit in the playerView watcher) play on a clean board, and the next
     * modal is held until that beat finishes. Snap to the board so the scale
     * is what shows while the panel dismisses.
     */
    onGovSupportLeafConfirm(payload: {response: unknown, param: string}): void {
      goBoardHome();
      closeConsoleLayers();
      this.consoleState.task.deferred = false;
      beginGovScaleClose(payload.param, () => this.submit(payload.response));
    },
    /** B in the host: defer a SERVER task; CANCEL a client payment. */
    onTaskDefer(): void {
      if (this.pendingClientPayment !== undefined) {
        // Nothing committed — the payment step folds ONE level back to the
        // browse layer of the workspace that hosts it (the frame never
        // closed, so the row, focus and preview are exactly where they were).
        this.pendingClientPayment = undefined;
        if (workspaceFrameMounted('standard-projects')) {
          this.rollbackStdProjectFlow();
          return;
        }
        // Legacy fallback (no workspace standing): reopen the task surface.
        const task = this.shellTask;
        if (task?.kind === 'projectCard' && task.mode === 'standardProject') {
          this.openShellTaskSurface(task);
        }
        return;
      }
      // An EMBEDDED task's «Свернуть» folds the WHOLE workspace that hosts it —
      // the atomic collapse (sheet closed + composer contract reset), never a
      // bare deferred flag. The task host is the B-owner during an embedded
      // pick (input routes to it before the workspace), so without this route
      // the flag rises while `sheet === 'cardActions'` stays set: the exact
      // iteration-16 half-collapse — the «вернуться» card never appears
      // (mandatoryAnnounceVisible needs sheet === undefined), input keeps
      // routing into the invisible workspace, and the bar keeps advertising a
      // stage that no longer serves.
      if (this.taskEmbedTarget !== undefined) {
        this.onCardActionsCollapse();
        return;
      }
      // …and so does an embedded DRAW & SELECT (and an embedded EFFECT
      // DECISION): B on a nested step minimizes the workspace HOSTING it, never
      // the step alone. Which collapse that is depends on the host — the action
      // centre has its own atomic one; every other workspace parks its whole
      // stack, exactly as its own B does.
      if (this.deckPickEmbedTarget !== undefined || this.effectDecisionEmbedTarget !== undefined) {
        if (workspaceOutcomeState.host === 'card-actions') {
          this.onCardActionsCollapse();
        } else {
          this.collapseWorkspace();
        }
        return;
      }
      this.consoleState.task.deferred = true;
    },
    /** The draft workspace's submit — the same funnel, but NO layer closing:
     *  the workspace IS the layer and deliberately outlives its own prompt
     *  (the pick beat / purchase flights play past the answer). */
    onDraftSubmit(response: unknown): void {
      this.consoleState.task.deferred = false;
      this.submit(response);
    },
    /** B in the draft workspace = MINIMIZE: park the whole stack atomically
     *  (frames aside + the deferred chip; restore returns the same depth). */
    onDraftDefer(): void {
      this.parkWorkspaceStack();
    },
    // ── shell-section tasks (T3 projectCard / T4 colony) ─────────────────
    /** Open (or re-open after un-defer) the section that serves the task. */
    openShellTaskSurface(task: ConsoleTask): void {
      // Already standing where this is answered — nothing to open, and above
      // all no lateral move: the colonies teleported into a live flow must not
      // have their host's chrome swapped out from under them. Only the cursor
      // lands on the first pickable tile.
      if (task.kind === 'colony' && workspaceFrameMounted('colonies')) {
        const pick = this.colonyPick;
        const rail = this.coloniesForRail;
        const first = pick !== undefined ? rail.findIndex((c) => pick.selectable.includes(c.name)) : -1;
        this.consoleState.colonyIndex = first !== -1 ? first : 0;
        return;
      }
      closeConsoleLayers();
      if (task.kind === 'awardFunding') {
        // FREE award funding rides the premium awards MA screen (its own
        // v-if renders it); openSheet treats it as the task surface.
        this.openSheet('awards');
        // RESUME ≠ FRESH-OPEN: this is the task-restore door, so a suspended
        // PRE-COMMIT detail re-seats exactly (kind, item, focus) — the stage
        // mounts already open, no re-entrance cinematic. A wheel open never
        // reads the draft.
        const draft = maFocusState.draft;
        if (draft !== undefined && draft.kind === 'award') {
          const idx = this.maScreenItems.findIndex((it) => it.name === draft.name);
          if (idx !== -1) {
            this.consoleState.sheetIndex = idx;
            openMaFocus(draft.kind, draft.name);
          }
          discardMaFocusDraft();
        }
        return;
      }
      if (task.kind === 'colony') {
        // The PROMPT brought the player here (the `prompt` anchor) — after the
        // follow-up settles the frame hands the screen back on its own, so the
        // player is never stranded in a workspace they did not open.
        this.openColoniesForPrompt();
        return;
      }
      if (task.kind === 'colonyBonus') {
        const collect = colonyBonusCollectOf(this.playerView.waitingFor);
        if (collect !== undefined) {
          this.openColonyBonusCollect(collect);
        }
        return;
      }
      if (task.kind === 'handSelect') {
        // A COLONY-BONUS discard (Pluto's «draw 1, discard 1») is a PHASE of
        // the colony resolution, never a screen of its own — the whole flow
        // stays inside the ONE colony workspace.
        const bonus = colonyBonusDiscardOf(this.playerView.waitingFor);
        if (bonus !== undefined) {
          this.openColonyBonusDiscard(bonus);
          return;
        }
        // MANDATORY pick from hand (discard / reveal / place): open the hand
        // carousel in select mode + land on the first PICKABLE card so A means
        // something at once. Picks/filter are reset by the prompt-change watcher.
        this.openHandWorkspace();
        this.focusFirstSelectableHandCard();
        return;
      }
      if (task.kind === 'projectCard') {
        // GENERIC (wave 2): candidates that are neither the hand nor the
        // standard-project sheet — ConsoleTaskHost auto-mounts once the gate
        // releases (the same «nothing else to open» rule as choice/payment).
        if (task.mode === 'generic') {
          return;
        }
        if (task.mode === 'playFromHand') {
          const firstPlayable = this.handEntries.findIndex((e) => e.playable);
          this.consoleState.handIndex = firstPlayable !== -1 ? firstPlayable : 0;
          // INSIDE a live workspace the hand does not "appear": it OPENS, with
          // the same dock → slot cinematic every other route gets. The cards
          // are already the player's — they unfold from the dock they are lying
          // in, they are never re-dealt. `keepTask`: this prompt is exactly why
          // we are opening, so deferring it would be the opposite of navigating
          // away. (`openHandWorkspace` decides screen-vs-step; the reveal is
          // the same either way.)
          void this.openHandWithReveal({keepTask: workspaceHostForStep() !== undefined});
        } else {
          this.openSheet('standard-projects');
        }
        return;
      }
      if (task.kind === 'corpFirstAction') {
        // Inside the START FLOW the Game Start Workspace's own stage serves
        // this prompt — its frame is already standing (or restoring via the
        // deferred card); steering the section here would only disturb it.
        if (corpFirstActionInStartFlow(this.playerView)) {
          return;
        }
        // Mid-game (merger chain): the dedicated confirm modal serves it. Its
        // presence is DERIVED (corpFirstActionOpen), so there is nothing to
        // open here: only the board must be the section underneath it.
        goBoardHome();
      }
    },
    /**
     * OPEN the announced interruptive mandatory beat (the player pressed B on
     * the announcement — consoleMandatoryGate). Acknowledging the beat releases
     * the gate: a reveal / host / corp-first modal auto-mounts once its
     * suppression clears, and a shell-section task (hand discard / colony /
     * play-from-hand) is opened onto its surface.
     */
    openMandatoryAnnounce(): void {
      const beat = this.mandatoryBeat;
      if (beat === undefined) {
        return;
      }
      acknowledgeMandatoryBeat(beat.key);
      // A FLOW beat runs its own open route — the ONE door into the workspace
      // (the auto-enter on the phase flip is gone). The acknowledge above has
      // already dropped `mandatoryGateHeld` synchronously, so a second A finds
      // no plate and no branch; the frame guard makes even a raced double
      // press idempotent (one frame, one entrance cinematic, one transition).
      if (beat.flow === 'draft') {
        if (!workspaceFrameKnown('draft')) {
          enterWorkspace('draft', {anchor: {type: 'phase', phase: 'draft'}});
        }
        return;
      }
      const task = taskFor(this.playerView);
      if (task !== undefined && SHELL_SECTION_KINDS.has(task.kind)) {
        this.openShellTaskSurface(task);
        return;
      }
      // A COLONY BONUS THE VIEWER MUST PLACE is a host task by shape (a card
      // target pick) and a colony payout by meaning, so the press walks them to
      // the colony that is paying — the same door Pluto's cards use. The pick
      // itself then teleports into that stage's zone (the claim admits `pick`),
      // so «кто-то поторговал на моей колонии» is ONE screen: the planet, whose
      // trade it was, and the choice — never a band over an unrelated view.
      const bonusPick = this.colonyBonusCardPick;
      if (bonusPick !== undefined) {
        this.enterColonyBonusStage(bonusPick.colonyName);
        return;
      }
      // Other host tasks (choice/player/amount/…) auto-mount ConsoleTaskHost
      // once the gate releases — nothing else to open here.
    },
    /**
     * The reveal modal's closing step was pressed: the payout's discard now runs
     * on its ordinary surface (the hand overlay in select mode — single-select
     * for one card, multi-select + confirm for several, exactly as any other
     * discard). The press is the acknowledgement of the mandatory beat, so the
     * announcement card is skipped and the player lands straight in the hand —
     * the payout continues instead of restarting as a fresh demand.
     */
    /**
     * The last card of an EMBEDDED batch has been taken. The claim is released
     * here — the shell owns the re-homed instance, so it owns the end of its
     * life — and the workspace folds its own stage back to browse off the
     * composer's `outcome-done`. Releasing here (rather than only in the
     * workspace) also covers the case where the workspace has already gone.
     */
    onEmbeddedDrawnComplete(): void {
      const host = workspaceOutcomeState.host;
      // A COLONY RESOLUTION outlives any one of its batches: the mandatory
      // discard, the next colony's cycle and the closing track reset are still
      // this claim's flow. The claim releases on the RESOLUTION's own falling
      // edge (the colonyResolutionLive watcher) — releasing per batch is what
      // used to fold the workspace between the reveal and the discard.
      if (host === 'colonies' && this.colonyResolutionLive) {
        return;
      }
      // …and a PLAY'S CHAIN outlives its batch the same way: the press also
      // woke an optional EFFECT («Рециклон» answering the building tag), and
      // that prompt has been standing in `waitingFor` since the play's own
      // response. The claim stays — the decision teleports into this very zone
      // once the intake settles, and the flow concludes when IT is answered
      // (the reconciler's release → `handOutcomeLive`'s falling edge).
      if (this.playEffectOwed) {
        this.handEffectStageOn();
        return;
      }
      releaseWorkspaceOutcome('drawn-complete');
      this.foldWorkspaceAfterResult(host);
    },
    /**
     * HAND THE CRUMB'S TAIL ON to the coming effect stage — at the take, not
     * at the decision's mount. Between the batch leaving and the decision
     * arriving nobody owns the tail (the reveal's name dies with it, the
     * decision publishes a flush after its teleport), and falling back to the
     * composer's parked «РАЗЫГРАНО» there is a step BACKWARDS through a flow
     * that only moves forward — the same law the discard hand-off and the
     * on-press branch already follow. Idempotent: the decision publishes the
     * same key again on mount, and an unchanged string does not re-animate.
     */
    handEffectStageOn(): void {
      const key = this.rawEffectDecisionVm?.stageKey ?? '';
      if (key !== '') {
        setWorkspaceOutcomePhase(key);
      }
    },
    /**
     * The flow is FINISHED and its result is airborne — fold the WHOLE
     * workspace, atomically (sheet closed + the composer's command contract
     * reset in the same frame — the iteration-16 half-collapse rule). A take
     * never round-trips the server, so no view change will close the sheet
     * for us; without this the workspace sat over the board while the intake
     * aimed at a covered dock («workspace не закрывается» — the receive bug).
     * Idempotent: the buy path reaches it twice (detach + complete).
     *
     * WHICH workspace is the CLAIM's own host, never a hard-coded kind: the
     * two sites that call this used to name «card-actions» outright and skip
     * the two hosts that end differently (`host !== 'colonies' && …`), so a
     * NEW host either concluded somebody else's workspace or nobody's — which
     * is exactly what left the card-play workspace standing over a board it
     * had already handed its cards to. `outcomeHostConcludesFlow` is that
     * question asked once, exhaustively, in the claim's own module:
     *  · the COLONY section IS the surface, and its transaction finishes on
     *    the browse grid the embed zone just handed back;
     *  · the HYDRO track concludes through its own result stage.
     */
    foldWorkspaceAfterResult(host = workspaceOutcomeState.host): void {
      if (outcomeHostConcludesFlow(host) && host !== undefined) {
        // A card PLAY's frame `serves` are registry defaults, not rights this
        // flow earned — see `concludeWorkspaceFlow`.
        this.concludeWorkspaceFlow(host, host !== 'hand');
      }
    },
    /**
     * THE END OF A COMMITTED FLOW — ONE function, EVERY ending.
     *
     * A card activation can finish in four different places, one per result
     * flavour, and each of them used to conclude itself:
     *
     *   · a plain reward           → the awaiting resolve's `finishDismiss`;
     *   · a drawn batch taken      → `onEmbeddedDrawnComplete` / `…Detached`;
     *   · a deck-check verdict «ОК»→ the workspace's own `onRevealAck`;
     *   · a purchase answered      → the claim's release (`embed-fell`).
     *
     * The first two closed the workspace; the last two folded back to the
     * ДЕЙСТВИЯ КАРТ browse grid — so «Поиск жизни» ended by putting the player
     * back in the list, staring at the action they had just performed, now
     * greyed «Активирована». Same question, four answers, two of them wrong,
     * and the only thing deciding which one a player got was whether that
     * action's result happened to be embeddable.
     *
     * So the ending is one call now, and the DECISION is the pure policy
     * (`workspaceConclusionFor`): past the commit boundary the workspace is not
     * a place to come back to — it leaves and the player lands on the board —
     * UNLESS the flow still owes something INSIDE it. That last part is the
     * whole reason this is guarded rather than a bare close: a workspace is ONE
     * FLOW, and a flow routinely outlives the stage that produced its first
     * result (a purchase raises its payment, a colony step stands inside the
     * activation that opened it, a batch is still in the air).
     *
     * SYNCHRONOUS on purpose. Every caller that needs a tick already defers
     * (the claim's falling edge, the embed's, the reconciler's), and the two
     * result-flight sites must fold in the SAME frame the card detaches — a
     * tick of daylight there leaves a dead frame over a finished decision while
     * the intake aims at a still-covered dock.
     */
    concludeWorkspaceFlow(kind: WorkspaceFrameKind, servedPromptHolds = true): boolean {
      if (!workspaceFrameKnown(kind)) {
        return true; // already gone (a second, idempotent report) — nothing to end
      }
      // MY claim, never «somebody holds one»: a foreign host's live outcome
      // says nothing about whether THIS flow is finished.
      const mine = workspaceOutcomeState.host === kind && workspaceOutcomeClaimed();
      const task = taskFor(this.playerView);
      const conclusion = workspaceConclusionFor({
        nested: workspaceFrameHasNested(kind),
        // …and a step this flow OWES but has not been handed yet: the door is
        // held behind the effect that arrived with it, and THIS workspace is the
        // host it will teleport into (`workspaceHostForStep` is the same lookup
        // `openColoniesForPrompt` will make). Concluding here would drop the
        // player on the board and then throw the second effect at them as a
        // screen of its own.
        owedStep: this.followUpStepOwed && workspaceHostForStep() === kind,
        outcomeLive: mine,
        // The second half of a pick-then-pay and a DRAW & SELECT still standing
        // in our zone are both this activation, still being answered — and so
        // is any prompt this FRAME earned the right to serve.
        //
        // …EARNED being the word. `servedPromptHolds: false` is for a flow whose
        // frame carries REGISTRY DEFAULTS instead (the hand's `projectCard` /
        // `handSelect`): a discard the played card just forced is not this
        // play's outcome, and holding the workspace for it would stand the
        // flow around a PARKED browse layer — the picker the prompt needs,
        // invisible behind a finished stage.
        ownsPrompt: (mine && (this.taskBelongsToWorkspace || this.deckPickBelongsToWorkspace)) ||
          (servedPromptHolds && task !== undefined && frameServing(task.kind)?.kind === kind),
        parked: workspaceFrameParked(kind),
      });
      if (conclusion.verdict === 'hold') {
        return false;
      }
      resetConsoleActionComposerUi();
      // The workspace goes and takes everything standing in it. `closeConsoleLayers`
      // is what clears the transient shell state that rode with it (quick
      // selector, sale mode, sheet cursor) and pops the sheet-shaped frames;
      // `closeWorkspaceRoot` is the honest verb for a kind that is not one.
      //
      // …EXCEPT a PHASE-ANCHORED root (the start workspace IS the opening).
      // Such a frame is not part of anybody's flow, so a flow that ran INSIDE
      // it — a corporation's play, a prelude's — can never be what ends it:
      // `goBoardHome` drops everything the flow stood up and leaves the phase
      // alone, which is the same rule it already states for a placement
      // excursion mid-deployment.
      if (workspaceFrameAnchor(kind)?.type === 'phase') {
        goBoardHome();
      } else {
        closeWorkspaceRoot(kind);
      }
      closeConsoleLayers();
      return true;
    },
    /**
     * THE CARD PLAY'S ONE ENDING — every way a play can finish routes here.
     *
     * A play can end in three places and each of them used to conclude itself:
     * the landing scene's closing beat, the colony follow-up's completion, and
     * (never, until now) the cards the play DREW. The third one is what made
     * the first wrong: the closing beat folded the workspace unconditionally,
     * so a card that drew cards let its own workspace dissolve and the batch
     * then arrived as a full-bleed reveal over the board.
     *
     * So the ending is the shared guarded conclusion, and it HOLDS while this
     * workspace still owes something — a nested step (the colony pick), a live
     * outcome of its own (the drawn batch, the buy prompt) or a park.
     *
     * The workspace it asks about is the one the play RAN IN: the hand when a
     * hand frame is standing (the composer's home, embedded or not), else the
     * start (a queue play with no hand step). Asking BOTH is wrong in exactly
     * one shape — the sponsor's ordinary play (`start ⊃ hand`, no follow-up),
     * where the thing nested inside the start IS the play's own hand step and
     * ending it is this beat's whole job.
     */
    endPlayCardFlow(): void {
      const playedIn: WorkspaceFrameKind = workspaceFrameIndex('hand') !== -1 ? 'hand' : 'start';
      // THE LANDING SCENE LETS GO — but not into an empty frame. While this
      // workspace's own outcome is still on its way, the settled tableau stays
      // on screen and the arriving surface is what relieves it (the handoff in
      // `workspaceOutcomeEmbedded`); in every other case the composer goes NOW,
      // because a step that nests teleports into the very zone it occupies.
      const awaiting = workspaceOutcomeState.host === playedIn &&
        workspaceOutcomeClaimed() && workspaceOutcomeState.stage !== 'presenting';
      if (!awaiting) {
        this.pendingPlayCard = undefined;
      }
      this.concludeWorkspaceFlow(playedIn, false);
    },
    /**
     * «ДЕЙСТВИЯ КАРТ» reports its committed flow finished (the deck-check
     * verdict acknowledged, the outcome claim released). The workspace cannot
     * see the rest of the console, so the ending is decided here.
     */
    onCardActionsFlowComplete(): void {
      this.concludeWorkspaceFlow('card-actions');
    },
    /**
     * THE RESULT HAS LEFT THE WORKSPACE — the card is now an independent
     * object on an app-level flight layer (or the exit layer, for a refusal),
     * standing over where it was. From this frame the workspace owns nothing
     * the player still needs, so it may fold.
     *
     * Releasing the claim HERE is what makes the two overlap: the card lifts,
     * the frame collapses under it, the board and the hand dock come back —
     * and only then does the intake's own slot polling find the dock's REAL
     * geometry and finish the flight. Folding earlier would take the card down
     * with the DOM; folding later would leave a dead frame sitting over a
     * finished decision, and the flight would have to aim at a dock that is
     * still hidden (or at a guessed rect, which this flow forbids).
     */
    onWorkspaceResultDetached(): void {
      const host = workspaceOutcomeState.host;
      // The colony RESOLUTION's claim spans every batch — same law as the
      // drawn-complete arm above.
      if (host === 'colonies' && this.colonyResolutionLive) {
        return;
      }
      // …and so does a play chain still owing its EFFECT DECISION (this fires
      // at the intake's staged seam, BEFORE `drawn-complete` — both ends of
      // the take must hold, or the first one folds the workspace under it).
      if (this.playEffectOwed) {
        this.handEffectStageOn();
        return;
      }
      releaseWorkspaceOutcome('result-detached');
      this.foldWorkspaceAfterResult(host);
    },
    /**
     * The ACTION COMMIT's reward wave: the resources the activated mechanic
     * printed MATERIALIZE at their own icons (origins cached at submit — the
     * flight never depends on the workspace outliving the answer) and fly to
     * the rail rows; each counter ticks exactly at its chip's touchdown
     * (the panel reward hold), the delta chip riding that honest transition.
     * One existing framework end to end — specs, arcs, aggregation, layer,
     * reduced motion all come from the resource-transfer system.
     */
    runCommitRewardWave(plan: ActionCommitPlan): void {
      if (plan.specs.length === 0) {
        return;
      }
      void runResourceTransfers({
        specs: plan.specs,
        origins: plan.origins,
        source: {point: plan.sourcePoint},
        arrival: 'auto',
        onArrive: (spec) => releasePanelRewardHold(spec),
      }).finally(() => clearPanelRewardHold());
    },
    /**
     * SETTLE the claim once the response has actually been applied.
     *
     * The awaiting resolve holds the workspace open on the strength of the
     * claim alone, because at that point the artifact is not readable yet. A
     * tick later it is: if the action produced something the workspace hosts
     * (a batch, a card pick), the claim has done its job and stays; if it
     * produced nothing embeddable — the branch promised cards but the outcome
     * was, say, a placement, or the server simply asked nothing — the claim is
     * dropped immediately, which folds the workspace exactly as an unclaimed
     * action would have.
     *
     * Without this the 20 s safety timer would be the only way out, and the
     * player would sit in a stage with nothing in it.
     */
    reconcileWorkspaceOutcome(): void {
      void this.$nextTick(() => {
        if (workspaceOutcomeState.sourceCard === '') {
          return;
        }
        // POSITIVE evidence only. "Nothing is embedded YET" is not evidence —
        // a prompt routes through the admission gate and a draw reconciles
        // through `drawnCardsState`, both of which can trail this tick, and
        // releasing on that guess is exactly how the buy prompt escaped into
        // its own band. So: keep the claim while anything is (or is about to
        // be) ours, and let it go only when the server has demonstrably asked
        // for something else — or for nothing.
        const task = taskFor(this.playerView);
        const ours = this.workspaceOutcomeEmbedded ||
          // The prompt IS ours — whether or not its slot has appeared yet.
          // This is the arm that was missing: readiness was being read as
          // ownership, so a slot that had not mounted on this exact tick was
          // taken to mean "the outcome went elsewhere", the claim dropped, the
          // workspace folded and the standalone band took the prompt.
          this.taskBelongsToWorkspace ||
          this.rawDrawnRevealPending ||
          deckDrawHolds() ||
          consoleActionComposerUi.revealClaim !== '' ||
          // …and while the SERVER is holding a VERDICT this claim owns. Same
          // shape as the reveal arms above and the same reason: the artifact
          // exists long before it can be RE-HOMED. A play's own hero scene
          // («сначала карта сыграна») stands between the answer and the moment
          // the verdict may present, so at this tick there is nothing embedded
          // to see — and reading that as «the outcome went elsewhere» dropped
          // the claim of a repeated action's verdict, which then opened as a
          // full-bleed modal over the workspace that had just produced it.
          workspaceClaimsDeckCheck(this.playerView.lastReveal?.action) ||
          // ⚠️ DELIBERATELY NO «the first-action STAGE is still running» arm.
          // One stood here (for Celestic's trail window — the batch arrives a
          // beat after the answer), but the stage itself waits on the CLAIM
          // (`embedActive` → `firstActionChainQuiet` → `firstActionLeaveDue`),
          // so claim and stage held EACH OTHER and only the 20 s claim backstop
          // broke the loop: a first action with nothing card-shaped in its
          // answer (Arcadian's marker claim — space, then the action menu)
          // left the workspace standing on an EMPTY «ПЕРВОЕ ДЕЙСТВИЕ» stage,
          // swallowing the pad for twenty seconds. The trail window is covered
          // by the POSITIVE evidence arms around this spot — the server-held
          // reveal below (`cardDrawReveals` rides the very answer that resolves
          // a draw), the client-side pending batch (`rawDrawnRevealPending`),
          // the live deal (`deckDrawHolds`) and the claimed prompt kinds — and
          // a prompt the claim can never host must release it even mid-stage:
          // that release is exactly what lets the stage finish and the
          // workspace conclude.
          // …and, generally, while the SERVER still holds an unconsumed
          // reveal for us: that is positive evidence of an artifact on its
          // way, available a full cinematic before the client can render it.
          //
          // EVERY play host, not just the start. A play's chain can put a
          // whole DECISION between the press and the cards («Марсианский
          // университет»: answer the effect → discard → only THEN is a card
          // drawn), so the batch arrives on a later response than the claim —
          // and at that tick the client has nothing rendered yet while the
          // server plainly does.
          (isPlayOutcomeHost(workspaceOutcomeState.host) && this.playerView.cardDrawReveals.length > 0) ||
          // The COLONY claim spans its whole resolution — the mandatory bonus
          // discard is a handSelect the workspace itself hosts, never «the
          // server asked for something else».
          (workspaceOutcomeState.host === 'colonies' && this.colonyResolutionLive) ||
          // The HYDRO claim spans the advance's own resolution: the marker
          // gate delays the view (nothing is «asked» until the token locks),
          // the deck pick's closing beats outlive its prompt, and a PARKED
          // follow-up (deferred / collapsed) still owns its restore.
          (workspaceOutcomeState.host === 'hydro' &&
            (isHydroMarkerActive() || this.deckPickActive ||
              this.consoleState.task.deferred || workspaceStackCollapsed())) ||
          (isPlayOutcomeHost(workspaceOutcomeState.host) ?
            // A PLAY CLAIM IS ABOUT CARDS. Read the RAW prompt, never «the gate
            // is holding something»: the play's own cinematic holds the task
            // host for its whole length, so during a play EVERY prompt looks
            // held — and «held» would then keep the claim alive for a prompt it
            // can never host (a placement, an OrOptions branch, a resource
            // pick), which are the play's ordinary follow-ups and route
            // normally. The workspace would stand open around them until the
            // 20 s backstop. What IS ours is a card question: the pick this
            // play raised, and the payment that finishes it.
            //
            // …plus the one question that is NOT about cards and is
            // unmistakably this press's own: the optional EFFECT a card of the
            // player's woke up («Марсианский университет» answering the science
            // tag they just played). Structural on both sides — the server's
            // `choiceContext` marker, and a shape this console can actually
            // present — so an ordinary un-hostable OrOptions branch still
            // releases the claim exactly as before.
            PLAY_CLAIMED_TASK_KINDS.has(task?.kind as TaskKind) ||
              this.effectDecisionBelongsToWorkspace :
            // The prompt exists but the gate is still holding it: it may yet be
            // ours once it opens.
            (this.hostServesPrompt && this.hostTask === undefined));
        if (ours) {
          return;
        }
        // A prompt the workspace does not host (a placement, an OrOptions
        // branch, a resource pick) IS the demonstration that this action's
        // outcome lives elsewhere.
        releaseWorkspaceOutcome('reconcile');
      });
    },
    onRevealDiscardPick(): void {
      const beat = this.mandatoryBeat;
      if (beat !== undefined) {
        acknowledgeMandatoryBeat(beat.key);
      }
      void this.$nextTick(() => {
        const task = taskFor(this.playerView);
        if (task !== undefined && SHELL_SECTION_KINDS.has(task.kind)) {
          this.openShellTaskSurface(task);
        }
      });
    },
    /**
     * Confirm the start excursion's release OFF the synchronous flush: the
     * quiet condition is re-read after a tick + a frame, so a hand-off gap
     * between two chain signals (the tile transaction finishing in the same
     * response that stages the bonus reveal) can never release the barrier
     * mid-chain. Deterministic — a re-check of live state, never a duration.
     */
    scheduleStartExcursionRelease(): void {
      const token = ++this.excursionReleaseToken;
      void this.$nextTick(() => {
        const confirm = () => {
          if (token !== this.excursionReleaseToken) {
            return; // a newer beat superseded this check
          }
          if (startExcursionActive() && this.startExcursionQuietNow) {
            releaseStartExcursion();
          }
        };
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(confirm);
        } else {
          confirm(); // server-runner / jsdom — no frame clock to wait on
        }
      });
    },
    /** Navigating away from a shell task's surface DEFERS it (the prompt card
     *  flips to its «Вернуться к решению» state). */
    deferShellTask(): void {
      if (this.shellTask !== undefined && !this.consoleState.task.deferred) {
        this.consoleState.task.deferred = true;
      }
    },
    /** Return to a DEFERRED task — clear the defer + re-open its surface (a
     *  shell-section task; host / start scenes re-render via their own v-if).
     *  Shared by the prompt card's A and the global B-back. */
    restoreDeferredTask(): void {
      this.consoleState.task.deferred = false;
      // A PARKED STACK comes back exactly as it was — same depth, same
      // decision, same picks and no second trip to the server. That is the
      // entire difference between «свернуть» and «закрыть», and it is one
      // call instead of a branch per workspace (the action centre's claim,
      // the hand step inside the start, …), each of which had to re-derive
      // which surface to re-open.
      if (workspaceStackCollapsed()) {
        // A parked OPEN-HAND step replays the premium dock → grid reveal on
        // its way back (the physical twin of the collapse's gather). The
        // phase is seated BEFORE the frames return: the section watcher sees
        // a director-owned transition instead of an untracked open, which
        // would paint the finished grid one frame early.
        const handComesBack = workspaceFrameParked('hand') &&
          !isHandRevealEpisodeRunning() && !consoleReducedMotionActive();
        if (handComesBack) {
          handRevealState.phase = 'opening';
          handRevealState.holdSlots = true;
        }
        restoreWorkspaceStack();
        if (handComesBack) {
          if (this.consoleState.section === 'hand') {
            void this.replayHandOpenReveal();
          } else {
            // The restored depth doesn't project the hand after all — undo
            // the seeded hold, or every slot stays invisible forever.
            resetHandReveal();
          }
        }
        // A COLONY RESOLUTION comes back on its focus stage (the section's
        // unmount closed it with the park): the source, the payout zone and
        // the «СБРОШЕНО» seat live there — never the overview grid. During
        // the FULL-STAGE DISCARD the hand owns the room instead: reopening
        // the focus here painted the whole colony composition OVER the
        // discard grid (the reported two-screens overlay).
        if (this.colonyResolutionLive && workspaceFrameMounted('colonies') &&
            !this.colonyFocus.open && !colonyResolutionUi.discardStage) {
          const name = this.colonyResolutionColonyName;
          if (name !== '') {
            openColonyFocus(name as ColonyName, 'inspect');
          }
        }
        return;
      }
      if (this.hostTask === undefined && !this.startSceneServes && this.shellTask !== undefined) {
        this.openShellTaskSurface(this.shellTask);
      }
    },
    /**
     * Replay the dock → grid reveal for a hand that came back from the PARK
     * (its frame already stands — `openHandWithReveal` would push a second
     * one). The measure loop rides the restore's own teleport chain: the
     * host re-mounts, publishes its zone, the hand teleports in, the grid
     * solves its fit — a few frames, bounded, with the honest instant-open
     * degrade when nothing becomes measurable.
     */
    async replayHandOpenReveal(): Promise<void> {
      if (isHandRevealEpisodeRunning()) {
        return;
      }
      const releaseAccent = beginDockIntakeAccent('hand-open');
      try {
        await this.$nextTick();
        let t: ReturnType<InstanceType<typeof ConsoleHandSection>['transitionTargets']> = {pairs: [], scrollTop: 0};
        for (let i = 0; i < 10 && t.pairs.length === 0; i++) {
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          const section = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
          if (section !== undefined) {
            t = section.transitionTargets();
          }
        }
        const dock = this.$refs.handDock as InstanceType<typeof ConsoleHandDock> | undefined;
        const sources = dock?.sourceRects(t.pairs.map((p) => p.name)) ?? new Map<string, RevealRect>();
        const pairs: Array<RevealPair> = [];
        for (const p of t.pairs) {
          const source = sources.get(p.name);
          if (source !== undefined) {
            pairs.push({name: p.name, source, target: p.rect, visible: p.visible, clip: p.clip, visual: this.revealVisualFor(p.name)});
          }
        }
        await runHandOpenEpisode(pairs);
      } finally {
        releaseAccent();
      }
    },
    /**
     * A SERVER-ROUTED opening met a workspace that is SET ASIDE — that demand
     * is «вернуться в него», never «поставить второй такой же рядом»: the
     * parked chain is the prompt's home (`stackServes` counts the park), so
     * the door that serves the prompt must restore the exact instance.
     *
     * ⚠️ PROMPT-ROUTED DOORS ONLY (openHandWorkspace / openColoniesForPrompt —
     * openings the SERVER's demand drives). A hand-open from the wheel is the
     * OPPOSITE intent — «посмотреть, пока решение отложено» — and `openSheet`
     * therefore never calls this: a fresh browse instance stands beside the
     * park, read-only, and resume stays with the board-home restore card.
     *
     * Kinds are unique within a stack, but the park is a SECOND stack, so
     * «live» and «parked» could hold the same kind at once — and the very next
     * restore splices the live stack away, taking a screen the player was
     * standing in with no close, no fold and no animation. For a prompt-routed
     * door that splice is a duplicate-in-the-making, hence this helper.
     *
     * Returns true when the park answered and the caller must stop.
     */
    restoreParkedWorkspace(kind: WorkspaceFrameKind): boolean {
      if (workspaceFrameIndex(kind) === -1 && workspaceFrameParked(kind)) {
        this.restoreDeferredTask();
        return true;
      }
      return false;
    },
    onTaskSpacePick(payload: {index: number, spacePrompt: PlayerInputModel}): void {
      this.taskSpacePending = payload;
      goBoardHome();
    },
    /**
     * A nested option whose card candidates are ALL IN HAND (Mars University's
     * "discard a card to draw a card" branch): the pick leaves the task host
     * and rides the REAL hand overlay through the shared hand-pick bridge —
     * the same surface a top-level in-hand prompt and a composer pick use. The
     * answer is wrapped back into this option's OR index, byte-identical to
     * what the host would have submitted from its own grid.
     *
     * Cancelling (B in the hand) returns to the branch list: the host is
     * re-mounted by its own v-if, showing «Выберите вариант» again — which is
     * exactly where the player was before choosing this branch.
     */
    onTaskHandPick(payload: {index: number, cardPrompt: SelectCardModel, source?: EffectDecisionSource, nextStage?: string}): void {
      const prompt = payload.cardPrompt;
      const reasons: Record<string, string> = {};
      for (const d of prompt.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason === undefined ? '' :
          (typeof d.disabledReason === 'string' ? translateText(d.disabledReason) : translateMessage(d.disabledReason));
      }
      // THE PICK IS THE NEXT STAGE OF THE SAME EFFECT, not a screen the player
      // was dropped into: inside the workspace that raised the decision the
      // hand's own shelf becomes the picker (the play stage steps aside —
      // `--stagepaused`), so the crumb's tail must ADVANCE («… › ЭФФЕКТ» →
      // «… › СБРОС КАРТЫ») instead of blanking.
      //
      // Published HERE because the decision surface unmounts for the pick and
      // its own `beforeUnmount` would otherwise clear the tail; it deliberately
      // only clears a phase that is still its own, so this write wins.
      const ownsStage = workspaceClaimsEffect();
      const pickStage = prompt.discardPrompt !== undefined ? 'Discarding a card' : 'Card selection';
      // …and the tail is HANDED ON at the answer rather than retracted. What
      // this pick buys is the flow's next stage (the card the discard draws),
      // and between the submit and the deal nothing owns the tail — retracting
      // there would drop it back to the composer's last stage, «РАЗЫГРАНО»,
      // which is two steps BACK through a flow that only moves forward.
      //
      // The asking surface computes it (`nextStageKeyOf`, one pure rule for
      // both press kinds); a pick handed over by the generic task host carries
      // none, which is the honest answer there — nothing claims that flow.
      const nextStage = payload.nextStage ?? '';
      if (ownsStage) {
        setWorkspaceOutcomePhase(pickStage);
      }
      enterConsoleHandPick({
        title: prompt.title,
        buttonLabel: prompt.buttonLabel || 'Select',
        selectable: prompt.cards.map((c) => c.name),
        reasons,
        min: prompt.min,
        max: prompt.max,
        selected: [],
        // The RAW server marker — the shell derives the discard skin from the
        // very same field a top-level discard uses (one derivation, no drift).
        discard: prompt.discardPrompt,
        // The CONTEXT travels with the pick, so the overlay keeps naming the
        // effect that sent the player there and L3 can open it. Without it the
        // hand reads as an unrelated screen they were dropped into.
        source: payload.source?.card !== undefined ?
          {kicker: this.effectDecisionVm?.eyebrowKey ?? 'Card effect', card: payload.source.card} :
          undefined,
      }, (cards) => {
        // ONLY OUR OWN KEY: by now the claim may already be naming something
        // else (or be gone entirely), and overwriting a stage we do not own is
        // how a crumb starts describing a screen that is not there.
        if (ownsStage && workspaceOutcomeState.phaseKey === pickStage) {
          setWorkspaceOutcomePhase(nextStage);
        }
        this.submit(orWrappedResponse(payload.index, cardsResponse(cards)));
      });
    },
    /**
     * The FINALE's placement branch. Same board hand-off as every other nested
     * `SelectSpace`, plus a marker: this screen must stay down for the WHOLE
     * commit (see `finalGreeneryCommitting`), not just while the pick is out.
     */
    onFinalGreenerySpacePick(payload: {index: number, spacePrompt: PlayerInputModel}): void {
      this.finalGreeneryPickPending = true;
      this.onTaskSpacePick(payload);
    },
    onTaskSpacePicked(spaceResponse: {type: 'space', spaceId: string}): void {
      const pending = this.taskSpacePending;
      this.taskSpacePending = undefined;
      if (pending === undefined) {
        return;
      }
      // Committed: hold the finale down until the answer lands (and the
      // placement hero has taken the foreground).
      this.finalGreeneryCommitting = this.finalGreeneryPickPending;
      this.finalGreeneryPickPending = false;
      this.consoleState.task.deferred = false;
      this.armBoardBonusIfCardCell(spaceResponse.spaceId);
      this.submit(orWrappedResponse(pending.index, spaceResponse));
    },
    // ── T6: reveal-result ack + notification CTAs ────────────────────────
    /**
     * «ОК» on the deck-check result: mark seen until the server clears it.
     *
     * …and, when the verdict stood as a WORKSPACE'S OWN STAGE (the overlay
     * re-homed into its zone — a repeated action played from the hand, the
     * Hydronetwork's copy), this press is also the end of what that workspace
     * was holding: the claim is released and the ONE guarded conclusion is
     * asked, exactly as «ДЕЙСТВИЯ КАРТ» does through `onCardActionsRevealAck`.
     * Without it the claim would stand until its 20 s backstop with nothing on
     * screen, and the flow could never conclude.
     *
     * The card-actions host is carved out because it acks through its OWN path
     * (it draws its own verdict stage and releases the claim there); calling
     * both would release twice and conclude a workspace that is mid-fold.
     */
    onDismissRevealResult(): void {
      const lr = this.playerView.lastReveal;
      if (lr !== undefined) {
        this.dismissedRevealKey = `${lr.action}|${lr.revealed.name}`;
      }
      const host = workspaceOutcomeState.host;
      if (host !== undefined && host !== 'card-actions' && workspaceClaimsDeckCheck(lr?.action)) {
        releaseWorkspaceOutcome('reveal-result-ack');
        this.foldWorkspaceAfterResult(host);
      }
    },
    /** «ОК» on the IN-FRAME reveal phase (the Action Focus stage): mark the
     *  reveal seen exactly like the standalone overlay's OK, and release the
     *  stage's claim so a FUTURE reveal routes normally. */
    onCardActionsRevealAck(): void {
      // The Viron in-frame reveal (the ONLY repeat-reveal that runs INSIDE the
      // Action Center — its own entry point) acks back to the browse grid.
      // ProjectInspection reveals never reach here — they ride the standalone
      // reveal overlay and ack to the board (its entry point was card play).
      this.onDismissRevealResult();
      resetConsoleActionRevealClaim();
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
    /** The notification's «Отменить размещение» CTA (server-cancellable). */
    onNotificationCancel(): void {
      this.cancelPlacement();
    },
    // ── P13/P15: the fullscreen card viewer (module-state driven) ───────
    onCardZoomNavigate(card: ZoomCard, pos: number): void {
      navigateConsoleCardZoom(card, pos);
      // The card "in hand" changed: the table hold moves to ITS slot, and
      // the host keeps the underlying focus in lockstep (so closing lands
      // the cursor on the card the player looked at LAST).
      retargetZoomHold(pos);
      this.consoleCardZoom.origin.onBrowse?.(pos);
    },
    /**
     * The OPEN sequence (see consoleZoomMotion.ts header — load-bearing):
     * measure the landing on the CLOSED dialog, fly the proxy on a normal
     * layer, and call `show()` (showModal) only at touchdown so the dialog's
     * first top-layer frame is final, static, fully-visible content — the
     * compositor-safe shape the mouse path always had. Every deferred
     * callback is fenced by `zoomOpenToken` (a close + reopen can never be
     * touched by a stale flight/safety callback).
     */
    async runZoomOpen(zoom: InstanceType<typeof CardZoomModal>): Promise<void> {
      const token = ++this.zoomOpenToken;
      this.zoomOpening = true;
      const origin: ZoomOrigin = this.consoleCardZoom.origin;
      beginZoomOpen(origin);
      const landing = await zoom.measureLanding();
      if (token !== this.zoomOpenToken || this.consoleCardZoom.card === undefined) {
        return; // closed / reopened while measuring — that sequence owns state
      }
      const index = this.consoleCardZoom.index;
      if (landing === undefined || consoleReducedMotionActive()) {
        // VANILLA open (also the reduced-motion / JSDOM / degenerate-layout
        // path): show immediately — first frame final and fully visible.
        zoom.show();
        this.zoomOpening = false;
        window.setTimeout(() => {
          if (token === this.zoomOpenToken) {
            this.zoomFlight = false;
          }
        }, motionMs(140));
        return;
      }
      // Premium flight: proxy flies slot→landing while the veil (the ONE
      // dim — the dialog's ::backdrop paints nothing) fades in beneath it;
      // showModal at touchdown adds no visual dim step.
      const source = zoomOpenSourceRect(index);
      this.zoomOpenProxy = {card: this.consoleCardZoom.card, zoom: landing.zoom};
      await this.$nextTick();
      if (token !== this.zoomOpenToken) {
        return;
      }
      const proxyEl = this.$refs.zoomFlightProxy as HTMLElement | undefined;
      playZoomOpenFlight(proxyEl, index, source, landing.rect, {
        onShow: () => {
          if (token === this.zoomOpenToken && this.consoleCardZoom.card !== undefined) {
            zoom.show();
          }
        },
        onDone: () => {
          if (token !== this.zoomOpenToken) {
            return;
          }
          this.zoomOpening = false;
          this.zoomFlight = false; // chrome fades in over the landed card
          // The proxy was already made INVISIBLE synchronously at hand-off
          // (playZoomOpenFlight — it must not share a single PAINT with the
          // dialog card, or their halos stack into a bright contour flash).
          // This is only the UNMOUNT of an already-hidden element, so its
          // timing is free — a beat later keeps it off the hand-off frame.
          this.zoomOpenClearTimer = window.setTimeout(() => this.clearZoomOpenFlight(), motionMs(160));
        },
      });
    },
    /** Drop the open-flight proxy (idempotent; any close path). */
    clearZoomOpenFlight(): void {
      if (this.zoomOpenClearTimer !== undefined) {
        window.clearTimeout(this.zoomOpenClearTimer);
        this.zoomOpenClearTimer = undefined;
      }
      this.zoomOpenProxy = undefined;
    },
    onCardZoomClosed(): void {
      // Any close path (choreographed B, native Esc, backdrop tap): restore
      // every held slot + kill the flight, then clear the module state.
      releaseZoomMotion();
      this.zoomOpenToken++; // fence out any stale open-sequence callback
      this.zoomFlight = false;
      this.zoomClosing = false;
      this.zoomSwapping = false;
      this.zoomOpening = false;
      this.clearZoomOpenFlight();
      document.body.classList.remove('con-zoom-open');
      closeConsoleCardZoom();
    },
    /** P15: the controller drives the viewer natively while it is open. */
    handleZoomIntent(intent: GamepadIntent): boolean {
      // A close/handoff flight is in progress: the card is mid-air — swallow
      // everything (no browsing a departing card, no double execute).
      if (this.zoomClosing) {
        return true;
      }
      // Mid OPEN-flight (dialog not shown yet): only closing is meaningful —
      // browsing/acting waits for the landing (≤400ms). B/X aborts cleanly.
      if (this.zoomOpening) {
        if (intent.kind === 'press' && !this.consoleCardZoom.mandatory) {
          const action = consoleActionOf(intent);
          if (action === 'back' || action === 'inspect') {
            void this.closeZoomViewer();
          }
        }
        return true;
      }
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      // INSPECT DOSSIER: LB/RB switch the ПРАВИЛА/СТАТИСТИКА tab (never browse —
      // the inspect list is always ONE card, so prev/next are free here). A
      // repeated press just re-sets the same tab (idempotent, no overlap).
      if (this.consoleCardZoom.inspect !== undefined) {
        if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
          setConsoleZoomInspectTab(intent.dir === 'left' ? 'rules' : 'history');
          return true;
        }
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'left') {
          zoom?.prev();
        } else if (intent.dir === 'right') {
          zoom?.next();
        }
        return true;
      }
      if (intent.kind === 'scroll') {
        // Right-stick pages the RULES BODY, but ONLY when it genuinely
        // overflows (a very long rules set standing beside the availability
        // panel — the one case the side column cannot fit outright). The
        // panel answers false when there is nothing to scroll, and the stick
        // keeps its old meaning: swallowed, so it can never leak to a surface
        // underneath. No new binding, no advertised verb for a journey the
        // player cannot make.
        const rules = this.$refs.zoomRulesPanel as {scrollBody?: (dy: number) => boolean} | undefined;
        rules?.scrollBody?.(intent.dy);
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      // L3 = the single-card reveal ROLE SWAP (received ⇄ source) on the SAME
      // viewer (screen-specific stick, before the semantic-action switch).
      if (intent.button === 'stickL' && this.consoleCardZoom.swap !== undefined) {
        this.zoomSwap();
        return true;
      }
      // R3 = peek the conditional-search DISCARD pile from the single-card
      // fullscreen reveal (parity with the multi-card modal's R3). The bridge
      // REPLACES the viewer with the read-only pile; B returns to the mandatory
      // received card. Guarded against a mid-swap crossfade.
      if (intent.button === 'stickR' && this.consoleCardZoom.discards !== undefined && !this.zoomSwapping) {
        this.consoleCardZoom.discards();
        return true;
      }
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        // In the inspect dossier LB switches to ПРАВИЛА (else browse prev).
        if (this.consoleCardZoom.inspect !== undefined) {
          setConsoleZoomInspectTab('rules');
        } else {
          zoom?.prev();
        }
        return true;
      case 'nextSection':
        // In the inspect dossier RB switches to СТАТИСТИКА (else browse next).
        if (this.consoleCardZoom.inspect !== undefined) {
          setConsoleZoomInspectTab('history');
        } else {
          zoom?.next();
        }
        return true;
      case 'primary':
        // A = take the on-screen card (RECEIVE bridge) OR toggle the pick
        // (selection contexts) OR fire the context ACTION (play-from-hand
        // parity, P17) — read-only contexts (source viewer) no-op.
        if (this.consoleCardZoom.receive !== undefined) {
          this.zoomTakeReceived();
        } else if (this.consoleCardZoom.select !== undefined) {
          this.zoomToggleSelect();
        } else {
          this.zoomExecuteAction();
        }
        return true;
      case 'nextTab': {
        // RT = take all (RECEIVE bridge only). Same premium parity as the
        // single take: CLOSE the viewer first (the card flies back to its
        // slot), THEN run the reveal modal's own group collect — never a
        // bare state jump. Otherwise the viewer owns RT.
        const r = this.consoleCardZoom.receive;
        if (r?.takeAll !== undefined && !this.zoomClosing) {
          const takeAll = r.takeAll;
          void this.closeZoomViewer().then(() => takeAll());
        }
        return true;
      }
      case 'inspect': // X closes too — the same key that opened it
      case 'back':
        // A MANDATORY viewer (single-card reveal) cannot be closed — the only
        // completion is taking the received card (A). Swallow B / X so the
        // player can never return to the game with the card untaken; the swap
        // (L3) is the only way to look at the source and back.
        if (this.consoleCardZoom.mandatory) {
          return true;
        }
        void this.closeZoomViewer();
        return true;
      default:
        return true; // the viewer owns ALL input while open
      }
    },
    /**
     * L3 single-card reveal ROLE SWAP — flip the fullscreen between the
     * received card and the draw source on the SAME viewer (a soft crossfade,
     * never a nested viewer / recreation). The reveal overlay's `swap()`
     * re-points the module card + bridges; `playZoomSwap` crossfades the stage
     * and re-fits (the paired card can size differently). Re-entrant-guarded
     * so rapid L3 gives clean flips, not a mid-animation stutter.
     */
    zoomSwap(): void {
      const swap = this.consoleCardZoom.swap;
      if (swap === undefined || this.zoomClosing || this.zoomSwapping) {
        return;
      }
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      this.zoomSwapping = true;
      void playZoomSwap(zoom?.$el as HTMLElement | undefined, () => swap.swap(), () => zoom?.fitCardToViewport())
        .then(() => {
          this.zoomSwapping = false;
        });
    },
    zoomToggleSelect(): void {
      const z = this.consoleCardZoom;
      if (z.select !== undefined && z.card !== undefined) {
        z.select.toggle(z.card.name as CardName);
      }
    },
    /**
     * The RECEIVE bridge A-verb — take the inspected card from FULLSCREEN.
     * PREMIUM PARITY: never a bare state jump — the viewer CLOSES first (the
     * card flies back into its reveal slot, choreographed), THEN the opener
     * runs the SAME premium take the reveal modal uses (the hand intake —
     * the card lifts off the slot and lays into the hand dock). So a
     * fullscreen take is the identical physical pipeline as an in-modal
     * take. Re-entrant safe (`zoomClosing` guards a double press mid-flight).
     */
    zoomTakeReceived(): void {
      const r = this.consoleCardZoom.receive;
      if (r === undefined || this.zoomClosing) {
        return;
      }
      const idx = this.consoleCardZoom.index;
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (r.departFromFullscreen === true) {
        // SINGLE-CARD reveal: the card departs from fullscreen INTO THE HAND
        // — playZoomDepart hands the flight to the hand-intake director (the
        // proxy takes over at the stage rect; the dialog closes in that same
        // paint via the staged callback, so the top layer never covers the
        // flight) and the card arcs into the dock, flipping to its back.
        // `takeAt` is the reveal overlay's bare commit — fired as the flight
        // begins; the counter ticks only on the touchdown.
        const card = this.consoleCardZoom.card;
        if (card === undefined) {
          r.takeAt(idx);
          zoom?.close();
          return;
        }
        this.zoomFlight = true;
        this.zoomClosing = true;
        void playZoomDepart(zoom?.$el as HTMLElement | undefined, card.name as CardName, () => r.takeAt(idx), () => zoom?.close());
        return;
      }
      // MULTI-CARD: close back to the strip slot first, then the reveal modal's
      // own premium take (the hand intake) lifts the card off the slot.
      void this.closeZoomViewer().then(() => r.takeAt(idx));
    },
    /** P17: the viewer's A hands the card to the context action. Two paths:
     *  - HANDOFF (the action opens a surface showing this card, e.g. the
     *    play-confirm composer): execute FIRST — the composer mounts UNDER
     *    the top-layer dialog — then the fullscreen card FLIES INTO the
     *    composer's card slot and the viewer closes on landing. The card
     *    visibly travels fullscreen → modal, never "back to the table".
     *  - default: the viewer closes first (flight included), so the exact
     *    source context restores underneath the follow-up surface. */
    zoomExecuteAction(): void {
      const z = this.consoleCardZoom;
      const card = z.card;
      const action = z.action;
      if (card === undefined || action === undefined || action.labelFor(card.name as CardName) === undefined) {
        return;
      }
      const handoffSel = action.handoffTarget?.(card.name as CardName);
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (handoffSel !== undefined && zoom !== undefined) {
        action.execute(card.name as CardName);
        this.zoomFlight = true;
        this.zoomClosing = true;
        void playZoomHandoff(zoom.$el as HTMLElement | undefined, () => document.querySelector<HTMLElement>(handoffSel))
          .then(() => zoom.close());
        return;
      }
      void this.closeZoomViewer().then(() => action.execute(card.name as CardName));
    },
    /**
     * Choreographed close: the chrome hides, the card flies back into the
     * CURRENT card's slot (physical origin) or dives away (textual/none),
     * THEN the dialog actually closes. Re-entrant safe (playZoomClose
     * resolves immediately while a close is already in flight; dialog.close
     * self-guards on `open`).
     */
    async closeZoomViewer(): Promise<void> {
      const zoom = this.$refs.cardZoom as InstanceType<typeof CardZoomModal> | undefined;
      if (zoom === undefined) {
        return;
      }
      const dialogEl = zoom.$el as HTMLDialogElement | undefined;
      // Closed during the OPEN flight (dialog never shown): abort the flight
      // and unwind directly — `dialog.close()` would no-op and the 'close'
      // event (the normal state unwinder) would never fire.
      if (this.zoomOpening && dialogEl?.open !== true) {
        cancelZoomOpen();
        this.onCardZoomClosed();
        return;
      }
      this.zoomFlight = true;
      this.zoomClosing = true;
      await playZoomClose(dialogEl as HTMLElement | undefined, this.consoleCardZoom.index);
      zoom.close();
    },
    /** P17: right-stick scroll for the ACTIVE console scroll container —
     *  the journal peek while open, else the topmost visible scrollable
     *  `.con-info__scroll` (console layers stack in DOM order). */
    scrollActiveConsole(dy: number, dx = 0): void {
      if (Math.abs(dy) < 0.05 && Math.abs(dx) < 0.05) {
        return;
      }
      // The hand ALBUM turns pages on the right stick (either axis — a firm
      // flick, hold-to-repeat) — but only when it is the active surface (no
      // play-confirm / task / reveal / zoom on top, which would otherwise be
      // paged through blindly).
      if (this.handScrollActive) {
        const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
        hand?.stickScroll(dy, dx);
        return;
      }
      // The EMBEDDED «Разыграно» table (Information Workspace X detail) owns
      // the right stick while it is the workspace's content.
      if (this.infoModeState.open && this.infoModeState.detail === 'played') {
        (this.$refs.infoMode as InstanceType<typeof ConsoleInfoMode> | undefined)
          ?.handlePlayedIntent({kind: 'scroll', dx: 0, dy});
        return;
      }
      // The corp first-action modal's briefing column scrolls first.
      if (this.corpFirstActionOpen) {
        const confirm = this.$refs.corpFirstConfirm as InstanceType<typeof ConsoleCorpFirstActionConfirm> | undefined;
        confirm?.stickScroll(dy);
        return;
      }
      // The «Разыграно» overlay owns the right stick while open (main table
      // or the nested events list — the overlay routes internally).
      if (this.playedTableVisible) {
        const played = this.$refs.playedOverlay as InstanceType<typeof ConsolePlayedOverlay> | undefined;
        played?.stickScroll(dy);
        return;
      }
      const candidates: Array<HTMLElement> = [];
      if (journalState.open) {
        const feed = document.querySelector<HTMLElement>('.con-journal__scroll');
        if (feed !== null) {
          candidates.push(feed);
        }
      }
      if (candidates.length === 0) {
        document.querySelectorAll<HTMLElement>('.con-info__scroll').forEach((el) => candidates.push(el));
      }
      for (let i = candidates.length - 1; i >= 0; i--) {
        const el = candidates[i];
        if (el.offsetParent !== null && el.scrollHeight > el.clientHeight + 1) {
          el.scrollBy({top: dy * CONSOLE_SCROLL_STEP_PX * conUiScale(), behavior: 'auto'});
          return;
        }
      }
    },
    /** Right-stick scroll of the review's scroll area. Returns true when it
     *  actually OVERFLOWS. */
    scrollReviewFeed(dy: number): boolean {
      const feed = document.querySelector<HTMLElement>('.con-bot-review__scroll');
      if (feed === null || feed.scrollHeight <= feed.clientHeight + 1) {
        return false;
      }
      if (Math.abs(dy) >= 0.05) {
        feed.scrollBy({top: dy * CONSOLE_SCROLL_STEP_PX * conUiScale(), behavior: 'auto'});
      }
      return true;
    },
    /**
     * X on the review — inspect the played card. A BONUS turn opens the
     * full-rules bonus-card inspect; a PROJECT turn opens the fullscreen browser
     * over the project cards the turn played (newest on screen).
     */
    inspectReviewCard(): boolean {
      const review = this.botTurnReviewState.review;
      if (review === undefined) {
        return false;
      }
      const card = review.card;
      // Service flips (tie-break / pick — themselves project cards) always page
      // LAST, so X opens the MAIN card first and the flips are reachable only by
      // browsing to the end (lower priority, per the review's card-order rule).
      const service: Array<ZoomCard> = (review.technicalReveals ?? []).map((t) => ({name: t.name} as CardModel));
      if (card?.kind === 'bonus') {
        // A BONUS turn is now part of the SAME pageable browser: the primary
        // bonus card first, then any secondary bonus card (Corp Competition
        // drew another), then the service flips — one LB/RB list, desktop parity.
        const entries: Array<ZoomCard> = [bonusZoomEntry(card.id, review.ctx)];
        if (card.secondaryCard !== undefined) {
          entries.push(bonusZoomEntry(card.secondaryCard, review.ctx));
        }
        entries.push(...service);
        // Bot-turn review — opened from log chips, no card tiles → TEXTUAL.
        openConsoleCardZoom(entries, 0, undefined, undefined, {contextLabel: 'MarsBot turn', origin: {kind: 'textual'}});
        return true;
      }
      // A project turn: the played card(s) FIRST, then the service flips LAST.
      const projects: Array<ZoomCard> = this.reviewCardNames.map((name) => ({name} as CardModel));
      const entries = [...projects, ...service];
      if (entries.length === 0) {
        return false;
      }
      openConsoleCardZoom(entries, 0, undefined, undefined, {contextLabel: 'MarsBot turn', origin: {kind: 'textual'}});
      return true;
    },
    /** PHYSICAL zoom origin for the hand grid: the fullscreen card lifts out
     *  of the `data-zoom-slot` tile; browsing LB/RB moves `handIndex`, whose
     *  section watcher scrolls the slot into view — so the close flight
     *  always has a live slot to land in (a still-virtualized slot falls
     *  back to the inspector dive gracefully). */
    handZoomOrigin() {
      const names = this.handEntries.map((e) => e.card.name);
      return slotZoomOrigin(
        () => document.querySelector<HTMLElement>('.con-hand'),
        (i) => names[i] ?? '',
        (i) => {
          this.consoleState.handIndex = i;
        },
      );
    },
    /** X in the hand section: read the focused card fullscreen. In SALE
     *  mode the viewer's A toggles the pick (a pure selection flip — the
     *  sale submit stays on the section's Y). In PLAY mode (P17 desktop
     *  parity) the viewer's A plays a PLAYABLE card through the existing
     *  play-confirm flow, and an unplayable card shows its structured
     *  «why not» reasons instead — never a mute fullscreen. */
    zoomHandCard(): void {
      if (this.handEntries.length === 0) {
        return;
      }
      // X mid-filter-glide: snap the episode first — the zoom flight measures
      // the slot rect, which is held-invisible under a flying proxy.
      if (runningHandRevealKind() === 'filter') {
        finishInstant();
      }
      const origin = this.handZoomOrigin();
      if (this.consoleState.sale.active) {
        openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, {
          isSelected: (name: CardName) => this.consoleState.sale.selected.includes(name),
          toggle: (name: CardName) => this.toggleSalePick(name),
        }, undefined, {origin});
        return;
      }
      // Hand SELECT (server task OR client composer pick): fullscreen A
      // answers the single-pick / toggles a multi-pick; a non-candidate card
      // surfaces its «why not» reason (single) or is inert (multi — the reason
      // is on the grid card / verdict bar).
      if (this.handSelectUiActive) {
        const verb = this.handSelectVerb;
        const selectable = (name: CardName) => this.handSelectSelectableNames.includes(name);
        if (this.handSelectSingle) {
          openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, undefined, {
            labelFor: (name: CardName) => (selectable(name) ? verb : undefined),
            reasonsFor: (name: CardName) => {
              const r = this.handSelectReasons[name];
              return !selectable(name) && r !== undefined && r !== '' ? [r] : [];
            },
            execute: (name: CardName) => this.handSelectExecuteSingle(name),
          }, {origin});
        } else {
          openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, {
            isSelected: (name: CardName) => this.handSelectPicked.includes(name),
            toggle: (name: CardName) => {
              if (selectable(name)) {
                this.toggleHandSelectPick(name);
              }
            },
          }, undefined, {origin});
        }
        return;
      }
      openConsoleCardZoom(this.handEntries.map((e) => e.card), this.consoleState.handIndex, undefined, {
        labelFor: (name: CardName) => {
          const entry = this.handEntries.find((e) => e.card.name === name);
          return entry?.playable === true ? 'Play now' : undefined;
        },
        reasonsFor: (name: CardName) => this.handUnplayableReasons(name),
        execute: (name: CardName) => this.openPlayCard(name),
        // «Разыграть» opens the play-confirm composer, which shows THIS card
        // — the fullscreen card flies INTO its slot there, not back to the hand.
        handoffTarget: () => '.con-composer--play [data-zoom-handoff="play-card"]',
      }, {origin, availability: 'play'});
    },
    /** Translated «why not» lines for a hand card (mirrors the hand
     *  section's info panel — same server-structured reasons, same shared
     *  formatter so the unit-suffixed "Сейчас: …" reads identically). */
    handUnplayableReasons(name: CardName): ReadonlyArray<string> {
      const entry = this.handEntries.find((e) => e.card.name === name);
      const reasons = entry?.card.unplayableReasons ?? [];
      return reasons.slice(0, 3).map((r) => unplayableReasonLine(r));
    },
    /** "Нельзя разыграть: <первая причина>" — the global fix so pressing A on
     *  an unplayable card never shows a bare block (the fork's always-explain
     *  rule). Pre-translated (showNotice's $t is a no-op on unknown strings),
     *  with an honest generic fallback when no structured reason surfaced. */
    handBlockedNotice(entry: ConsoleHandEntry): string {
      const first = (entry.card.unplayableReasons ?? [])[0];
      // No server RULES reason → the card is fine, it's just not the player's
      // window (opponent's turn / mid-placement) — name that honestly rather
      // than a misleading "conditions not met".
      if (first === undefined) {
        return translateText(this.handSoftReason);
      }
      return translateTextWithParams('Cannot play: ${0}', [unplayableReasonLine(first)]);
    },
    /**
     * LB/RB — the ALBUM PAGE TURN, one verb for every hand mode (browse,
     * sale, select, pick, embedded): the section owns the motion (a
     * retargetable transform slide — rapid presses redirect, never queue)
     * and the page derives from the focus index, so selection and picks
     * survive by construction. The first/last page swallows the press.
     */
    turnHandPage(dir: 1 | -1): void {
      const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      hand?.turnPage(dir);
    },
    /** The bay spine's own LB/RB chips clicked (mouse door). */
    onDockPage(dir: 1 | -1): void {
      this.turnHandPage(dir);
    },
    /** LT/RT: cycle the hand tag filter; R3: reset it to "All". Both preserve
     *  the selected card when it survives the new filter, else keep the
     *  nearest logical slot (never a jump to a random first page). */
    cycleHandFilter(dir: 1 | -1): void {
      this.applyHandFilterChange(() => {
        this.consoleState.handTagFilter = cycleTagFilter(this.handTagFilterOptions, this.consoleState.handTagFilter, dir);
      });
    },
    resetHandFilter(): void {
      if (this.consoleState.handTagFilter === 'all') {
        return;
      }
      this.applyHandFilterChange(() => {
        this.consoleState.handTagFilter = 'all';
      });
    },
    /**
     * Apply a tag-filter mutation as a PHYSICAL transition (the cards are
     * objects in the player's album, they never blink): measure the OLD slot
     * rects BEFORE the change, apply it (entries recompute synchronously —
     * the director's state writes ride the SAME patch flush, so nothing
     * flashes), then hand the episode to `runHandFilterEpisode`. In the
     * ALBUM model a filter is a RE-PAGINATION: leavers gather into the edge
     * PACKETS (never back into the dock — the dock stays empty for the whole
     * open hand), enterers glide out of those packets, survivors glide to
     * their re-planned slots. Rapid re-filtering stays responsive: a
     * still-running episode is SNAPPED to its end state first (never queued).
     * Falls back to the plain instant switch outside the browsable open hand
     * (sale never reaches here; staged-card / reduced-motion / unmounted
     * refs degrade the same way).
     */
    applyHandFilterChange(apply: () => void): void {
      const selectedName = this.handEntries[this.consoleState.handIndex]?.card.name;
      if (isHandRevealEpisodeRunning()) {
        // Re-filter mid-glide (or mid-open): snap the running episode to its
        // end state, then answer the new input from settled geometry.
        finishInstant();
      }
      const section = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      // During a CLIENT hand pick the staged (being-played) card is EXCLUDED
      // from the entries, so the episode is safe to run under it — that's how
      // the pick's «suitable only» toggle gets the same physical transition
      // as the tag filter.
      const canAnimate = this.consoleState.section === 'hand' &&
        handRevealState.phase === 'open' && !isHandRevealEpisodeRunning() &&
        (this.stagedHandCard === undefined || this.handPickActive) &&
        section !== undefined;
      if (!canAnimate) {
        apply();
        this.refocusAfterFilter(selectedName);
        return;
      }
      const before = section.transitionTargets();
      apply();
      this.refocusAfterFilter(selectedName);
      const newNames = this.handEntries.map((e) => e.card.name);
      // The ENTERERS never had an album slot under the old filter, so their
      // art has never mounted: warm it before their proxies glide out of the
      // packets, or they fly a black art window (see openHandWithReveal).
      // Already-warm URLs are a memory-cache no-op.
      const seen = new Set(before.pairs.map((p) => p.name));
      preloadPremiumCardArt(newNames.filter((n) => !seen.has(n)));
      const newSet = new Set<string>(newNames);
      // A card parked in the packets that STAYS out of view takes no part in
      // the episode (no proxy at all): a packet→packet flight would paint a
      // phantom card at the stage edge. Kept pairs: everything visible before,
      // plus a parked card ENTERING the view (it glides in from its packet).
      const beforePairs = before.pairs.filter((p) => p.visible || newSet.has(p.name));
      const involved = new Set<string>([...beforePairs.map((p) => p.name), ...newNames]);
      // Leaver landings + enterer origins = the right-edge PACKET anchors —
      // the same conceptual place the open/close flights park the out-of-view
      // universe, so a filtered-out card always exits toward where it lives.
      const packetHomes = section.packetHomeRects([...involved]);
      void runHandFilterEpisode({
        before: beforePairs.map((p) => ({name: p.name, rect: p.rect, visible: p.visible, clip: p.clip})),
        dock: packetHomes,
        newNames,
        measureAfter: () => {
          // The album derives its page from the refocused index — the patch
          // has already flushed, so the measured targets are the settled
          // post-filter geometry.
          section.ensureSelectedVisible();
          return section.transitionTargets().pairs.map((p) => ({name: p.name, rect: p.rect, visible: p.visible, clip: p.clip}));
        },
        visualFor: (name) => this.revealVisualFor(name),
      });
    },
    /**
     * The card's LANDED grid presentation, carried by the reveal/filter
     * proxies so the settled state is readable DURING the flight and can
     * never pop at the handoff. Mirrors the section's slot exactly: browse →
     * unplayable dim + the `shortBlockerLabel` chip; select/pick → the strong
     * select-disabled dim + «Unavailable»; sale shows the whole hand undimmed.
     *
     * The LIVE MODEL rides along UNCONDITIONALLY — it is the biggest half of
     * «the same card lands». The grid slot renders `<Card :card>`, so without
     * it the flying face loses the discount chip and the stored-resource
     * capsule, drops the disabled wash, and — because the cost chip widens the
     * title's left safe-area — even re-sizes and re-wraps the card's NAME.
     * That is why this returns a presentation for every card now instead of
     * `undefined` for «nothing special»: there is no such thing as a card with
     * nothing to carry.
     */
    revealVisualFor(name: CardName): RevealVisual {
      const entry = this.handEntriesAll.find((e) => e.card.name === name);
      const card = entry?.card;
      if (this.consoleState.sale.active) {
        return {card};
      }
      if (this.handSelectUiActive) {
        return this.handSelectSelectableNames.includes(name) ?
          {card} :
          {card, dim: 'strong', chip: 'Unavailable'};
      }
      // Mirrors the slot: the dim belongs to the RULES verdict, never to the
      // turn — a card the player simply cannot play YET lands bright.
      if (entry === undefined || entry.potential) {
        return {card};
      }
      return {card, dim: 'soft', chip: shortBlockerLabel(entry.card.unplayableReasons ?? [])};
    },
    refocusAfterFilter(selectedName: CardName | undefined): void {
      const list = this.handEntries; // recomputed for the new filter
      const at = selectedName !== undefined ? list.findIndex((e) => e.card.name === selectedName) : -1;
      // The focused card survives the filter → follow it (its page opens by
      // derivation). Gone → the NEAREST LOGICAL slot: the same index clamped,
      // never a reset to the first page (the player keeps their place).
      this.consoleState.handIndex = at >= 0 ? at :
        Math.min(Math.max(0, this.consoleState.handIndex), Math.max(0, list.length - 1));
      const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
      void this.$nextTick(() => hand?.ensureSelectedVisible());
    },
    /** P15: the sale pick flip, shared by the section's A and the viewer. */
    toggleSalePick(name: string): void {
      const at = this.consoleState.sale.selected.indexOf(name);
      if (at === -1) {
        this.consoleState.sale.selected.push(name);
      } else {
        this.consoleState.sale.selected.splice(at, 1);
      }
    },
    /** L3 in the sell-patents multi-select: select ALL sellable cards, or clear
     *  the selection if they're already all picked. */
    toggleSelectAllSale(): void {
      const names = this.saleSellableNames;
      if (names.length === 0) {
        return;
      }
      this.consoleState.sale.selected = this.saleAllSelected ? [] : [...names];
    },
    // ── hand SELECT (server `handSelect` task OR a client composer pick) ──
    /** A on a hand card in select mode: submit/resolve (single-pick) / toggle
     *  (multi), or explain WHY a non-candidate can't be chosen (never a mute A). */
    handSelectPress(name: string): void {
      if (!this.handSelectUiActive) {
        return;
      }
      // The answer is already on its way and the cards are being seized — a
      // second A press must not submit twice.
      if (isCardDiscardActive()) {
        return;
      }
      if (!this.handSelectSelectableNames.includes(name)) {
        const reason = this.handSelectReasons[name];
        this.showNotice(reason !== undefined && reason !== '' ? reason : translateText('This card cannot be chosen here'));
        return;
      }
      if (this.handSelectSingle) {
        // Single-card pick: A answers it in one press (no toggle-then-confirm).
        this.handSelectExecuteSingle(name);
        return;
      }
      this.toggleHandSelectPick(name);
    },
    /** The single-pick answer of whichever select source is active: a client
     *  pick RESOLVES back to its composer; the server task SUBMITS. */
    handSelectExecuteSingle(name: string): void {
      if (isCardDiscardActive()) {
        return; // the answer is already in flight (fullscreen A / double press)
      }
      this.armDiscardScene([name as CardName]);
      if (this.handPickActive) {
        resolveConsoleHandPick([name as CardName]);
        return;
      }
      this.submitHandSelect([name]);
    },
    /**
     * THE ONE ARM POINT of the discard cinematic. Both answer paths (the
     * mandatory task's submit and the client bridge's resolve) call it
     * SYNCHRONOUSLY before delivering, so the launch rects are captured while
     * the pick surface is still on screen — a commit can unmount it three
     * frames later. A non-discard pick, or a legal empty pick, arms nothing.
     */
    armDiscardScene(names: ReadonlyArray<CardName>): void {
      const meta = this.discardMeta;
      if (meta === undefined || names.length === 0) {
        return;
      }
      // The surface as it looks RIGHT NOW — replayed while the scene seizes.
      this.discardFreeze = this.handSelectProps;
      armCardDiscard({
        names,
        meta,
        // BOTH the live element AND a rect snapshot, always: the element is
        // re-measured if it is still connected when the proxies spawn, and the
        // snapshot carries the flight when the surface unmounted in between (a
        // commit can tear the hand down three frames before the spawn). Without
        // the snapshot the card would silently skip its flight.
        sources: names.map((name) => {
          const el = this.discardSourceElement(name);
          return {name, el, rect: this.discardSourceRect(name, el)};
        }),
      });
    },
    /** The live element the card takes off from: its slot in the open hand
     *  grid, else the fullscreen inspector holding it (A can be pressed from
     *  the zoom), else nothing (the dock rect is the fallback). */
    discardSourceElement(name: CardName): HTMLElement | undefined {
      const slot = document.querySelector<HTMLElement>(`.con-hand__slot[data-zoom-slot="${name}"]`);
      if (slot !== null) {
        return slot;
      }
      const zoomed = document.querySelector<HTMLElement>(`.con-zoom [data-zoom-slot="${name}"]`);
      return zoomed ?? undefined;
    },
    /** The launch rect captured NOW: the live slot's own box when there is one,
     *  else the card's home in the dock — so a flight always starts from where
     *  the player last saw the card, never from the viewport origin. */
    discardSourceRect(name: CardName, el: HTMLElement | undefined): {left: number, top: number, width: number, height: number} | undefined {
      if (el !== undefined) {
        const card = el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? el;
        const r = card.getBoundingClientRect();
        if (r.width > 10 && r.height > 10) {
          return {left: r.left, top: r.top, width: r.width, height: r.height};
        }
      }
      const dock = this.$refs.handDock as {sourceRects?: (names: ReadonlyArray<CardName>) => Map<CardName, {left: number, top: number, width: number, height: number}>} | undefined;
      return dock?.sourceRects?.([name])?.get(name);
    },
    /** L3 — open the effect's SOURCE in the ordinary fullscreen viewer. The
     *  overlay, its scroll, the focused card and the pick all stay exactly as
     *  they are underneath: the viewer owns nothing but itself. */
    inspectContextualSource(): void {
      const name = this.contextualSourceCard;
      if (name === undefined) {
        return;
      }
      // The viewer NAMES its role — console-wide inspection grammar: X reads
      // the current object, L3 reads the source that produced it. One verb for
      // every host (the colony step used to carry a second copy of this).
      openConsoleCardZoom([{name}], 0, undefined, undefined, {statusLabel: 'Source'});
    },
    /**
     * X mid-placement — the card that is placing this tile, fullscreen. The
     * viewer names its role, and the board is never unmounted: the cursor,
     * the highlighted cells and the panel's facts are exactly as they were
     * when it closes.
     */
    inspectPlacementSource(): void {
      const name = this.placementSourceCard;
      if (name === undefined) {
        return;
      }
      openConsoleCardZoom([{name}], 0, undefined, undefined, {
        statusLabel: 'Source',
        origin: {
          kind: 'physical',
          resolve: () => document.querySelector<HTMLElement>('.con-context .con-src') ?? null,
        },
      });
    },
    /** Multi-select toggle (respects `max` — a full set ignores a new pick). */
    toggleHandSelectPick(name: string): void {
      const pickMode = this.handPickActive;
      const picked = pickMode ? consoleHandPickState.selected : this.consoleState.select.selected;
      const max = pickMode ? (consoleHandPickState.request?.max ?? 1) : (this.handSelectModel?.max ?? 1);
      const at = picked.indexOf(name as CardName);
      if (at !== -1) {
        picked.splice(at, 1);
        return;
      }
      if (picked.length >= max) {
        return;
      }
      picked.push(name as CardName);
    },
    /** L3 in a multi client pick: select every candidate (bounded by `max`),
     *  or clear the whole selection when it is already complete. */
    togglePickSelectAll(): void {
      const req = consoleHandPickState.request;
      if (req === undefined) {
        return;
      }
      consoleHandPickState.selected = this.pickAllSelected ?
        [] :
        [...req.selectable.slice(0, req.max)];
    },
    /** RT / confirm: deliver the accumulated multi-select picks (bounds-checked).
     *  A client pick resolves to its composer; the server task submits. */
    confirmHandSelect(): void {
      if (isCardDiscardActive()) {
        return; // the answer is already in flight — never submit a set twice
      }
      if (this.handPickActive) {
        const req = consoleHandPickState.request;
        const picked = consoleHandPickState.selected;
        if (req === undefined || picked.length < req.min || picked.length > req.max) {
          return;
        }
        this.armDiscardScene([...picked]);
        resolveConsoleHandPick([...picked]);
        return;
      }
      const model = this.handSelectModel;
      if (model === undefined) {
        return;
      }
      const picked = this.consoleState.select.selected;
      if (picked.length < model.min || picked.length > model.max) {
        return;
      }
      this.submitHandSelect([...picked]);
    },
    /** Submit the mandatory hand-select answer. The TOP-LEVEL SelectCard takes
     *  the BARE {type:'card', cards} (no OR wrapping) — byte-identical to the
     *  desktop hand-select overlay's `onHandSelect`. */
    submitHandSelect(cards: ReadonlyArray<string>): void {
      this.consoleState.select.selected = [];
      this.consoleState.select.suitableOnly = true;
      // A DISCARD keeps the hand open: the cinematic seizes the cards out of
      // the real grid first and hands the surface off itself (phase 'leaving'),
      // so the player watches the card leave the hand instead of the hand
      // vanishing and the card silently ceasing to exist. Every other pick
      // closes immediately, exactly as before.
      if (!isCardDiscardActive()) {
        this.leaveHandAfterAnswer();
      }
      this.submit(cardsResponse(cards as ReadonlyArray<CardName>));
    },
    /** The discard cinematic's hand-off: the hand section closes (the surviving
     *  cards fly home to the dock) while the condemned ones keep flying on the
     *  app-level stage. Driven by the scene's phase, never by a timer. */
    closeSurfaceForDiscard(): void {
      this.consoleState.select.selected = [];
      this.consoleState.select.suitableOnly = true;
      this.leaveHandAfterAnswer();
    },
    /** LT: flip the "suitable only" filter (candidates-only ↔ the whole hand)
     *  as the SAME physical card transition the tag filter plays (leavers
     *  gather into the dock, enterers fan out, survivors glide) — the focus
     *  stays on the surviving card, else lands on the first one. */
    toggleSuitableOnly(): void {
      if (!this.handSelectFiltered) {
        return;
      }
      this.applyHandFilterChange(() => {
        if (this.handPickActive) {
          consoleHandPickState.suitableOnly = !consoleHandPickState.suitableOnly;
        } else {
          this.consoleState.select.suitableOnly = !this.consoleState.select.suitableOnly;
        }
      });
    },
    // ── transport ────────────────────────────────────────────────────────
    submit(response: unknown): void {
      submitInput(response as InputResponse);
    },
    submitBatch(responses: ReadonlyArray<unknown>): void {
      transportSubmitBatch(responses as ReadonlyArray<InputResponse>);
    },
    showNotice(key: string): void {
      this.notice = key;
      if (this.noticeTimer !== undefined) {
        window.clearTimeout(this.noticeTimer);
      }
      this.noticeTimer = window.setTimeout(() => {
        this.notice = '';
      }, motionMs(2400));
    },
  },
  mounted() {
    // READ-ONLY e2e/diagnostics probe: the nested-continuation state in one
    // snapshot (the e2e specs dump it on a failure instead of guessing from
    // pixels). Never used by product code.
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
      tradeActive: colonyTradeState.active,
      // The COVER SCENE's own state: a scene stuck past its last beat holds
      // the pad (isColonyTradeInputLocked), which reads on screen as «the card
      // is there and А does nothing» — the one symptom with no other tell.
      cardScene: colonyTradeState.cardScene,
      tradePhase: colonyTradeState.phase,
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
    // Planet Focus reads the LIVE committed parameters through this source
    // at its release (the playerView root identity changes every response,
    // so the module can never hold an object reference itself).
    this.offPlanetFocusParams = registerPlanetFocusParamsSource(
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
        (this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined)?.restoreScroll(px);
      },
    });
    // Clear any scale-overview tooltip a stray real-mouse hover left showing
    // before the shell reported its presence (mouse tooltips are suppressed in
    // console mode from here on — see ArcScale.mouseTooltipsSuppressed).
    hideScaleTooltip();
    startConsoleLeakDetector(() => this.playerView);
    // T6: the notification CTAs go through the typed notificationBus;
    // PlayerHome's listeners don't exist in console — the shell answers them.
    (this as unknown as {__notifOff: Array<() => void>}).__notifOff = [
      notificationBus.goToAction.on(this.onNotificationGoToAction),
      notificationBus.cancel.on(this.onNotificationCancel),
    ];
  },
  beforeUnmount() {
    this.offIntent?.();
    this.offWsPresence?.();
    this.offPlanetFocusParams?.();
    resetPlanetFocus(); // never carry a held HUD / mid-exit phase across games
    resetHandReveal(); // never leak a mid-episode timeline / held dock
    resetHandDelivery(); // never leak a mid-flight delivery / held dock
    releaseStartExcursion(); // a leaked barrier would hide the next game's start scene
    resetDockIntakeAccent(); // a leaked lease would disable the compact pose
    resetConsoleHandPick(); // never leak a client pick across games/sessions
    // The stack can never outlive the shell: an orphaned frame suppresses the
    // standalone band, so the next prompt would be presented NOWHERE.
    resetWorkspaceStack();
    resetHandStageMotion();
    resetHandPlayPrewarm(); // pending dwell timers + version-keyed previews
    resetConsoleRepeatPick(); // same for a repeat-action pick + its command store
    resetConsoleRepeatPickUi();
    // A composer's TABLEAU pick is module state too — fold it (cancel) so a
    // game switch never carries a live pick / dead callbacks across sessions.
    resetCategoryDirector();
    resetPlayedCategoryView();
    // The play's return beat is module state as well — never carry a live
    // flight (or its dock withhold) across a game switch.
    resetPlayedCardReturns();
    // The discard cinematic is module state too — never carry a live scene (or
    // its animation hold) across a game switch.
    resetCardDiscard();
    registerDiscardOverlayHandoff(undefined);
    setAlbumLayoutRecomposer(undefined);
    // The colony-bonus entry is module state as well: a live wait (and its net)
    // must never carry a stale «a payout is owed here» into the next game.
    clearColonyBonusEntry();
    if (this.colonyEntryWaitTimer !== undefined) {
      window.clearTimeout(this.colonyEntryWaitTimer);
      this.colonyEntryWaitTimer = undefined;
    }
    if (this.noticeTimer !== undefined) {
      window.clearTimeout(this.noticeTimer);
    }
    this.releasePresentationLease?.();
    this.releasePresentationLease = undefined;
    this.consoleState.shellMounted = false;
    resetMandatoryGate(); // never carry an acknowledgment across games/sessions
    setMandatoryGateHeld(false); // shell gone → clear the held mirror (the watcher won't fire on unmount)
    resetPromptAdmission(); // shell gone → the placement can never stay held (desktop reads the mirror too)
    // A workspace outcome claim SUPPRESSES standalone presenters, so an
    // orphaned one is worse than a leak: a drawn batch in the next game would
    // be routed to a workspace that no longer exists and never be shown.
    resetWorkspaceOutcome();
    resetDeckPick(); // never carry a live draw-and-select commit across games
    resetNotifHold(); // never leak a hold timer across games/sessions
    resetSurfaceMotion(); // never leak a held handoff / shade owner across sessions
    resetActionPreviews(); // per-game preview cache dies with the shell
    stopConsoleLeakDetector();
    resetGovScaleFocus();
    releaseZoomMotion();
    this.zoomOpenToken++; // fence out any stale open-sequence callback
    this.clearZoomOpenFlight();
    abortTradeFleet(); // recall any in-flight fleet (zombie-safe on teardown)
    abortColonyTrade(); // unwind any trade-reward transaction (zombie-safe)
    abortHydroMarker(); // recall any in-flight marker glide (zombie-safe)
    resetHydroFlow(); // drop any in-flight hydro commit presentation (zombie-safe)
    resetConsoleHydroUi(); // …and its console-only draft (commands + composed repeat)
    abortBoardCardBonus('instant'); // recall any in-flight bonus cover (zombie-safe)
    abortDeckDraw(); // drop any in-flight deck-draw scene (zombie-safe)
    abortPlayedHero(); // unwind any in-flight played-card hero scene (zombie-safe)
    document.body.classList.remove('con-zoom-open');
    document.body.classList.remove('con-play-modal-open');
    this.clearDepartingPlayCard();
    (this as unknown as {__notifOff?: Array<() => void>}).__notifOff?.forEach((off) => off());
  },
});
</script>
