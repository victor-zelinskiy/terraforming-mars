<template>
  <div class="con-root">
    <!-- P27: the strip is player IDENTITY + live turn STATUS only — the
         cards/actions counters live in the right home panel now, and the
         viewer's "your turn" reads from their own chip (no central pill). -->
    <ConsoleStatusStrip :playerView="playerView"
                        :waitingOnPlayers="waitingOnPlayers"
                        :epoch="playerView.runId"
                        :attentionPending="mandatoryChipAttention" />

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

    <!-- MANDATORY ANNOUNCEMENT (consoleMandatoryGate): an INTERRUPTIVE mandatory
         DECISION (corp first action / forced hand pick / off-turn reaction) is
         ANNOUNCED here — not popped open — and the player opens it with B when
         they're ready. Shown only once the foreground is idle (screens closed,
         animations done). A drawn-cards reveal is NOT announced — it flows
         straight through from its draw cinematic (never split from it). -->
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
      <ConsoleResourcePanel :player="railPlayer" :epoch="playerView.runId"
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
      <!-- The right CONTEXT + INFO panel (board home / inspection / task). -->
      <ConsoleContextPanel v-show="consoleState.section === 'board'"
                           :mode="contextMode"
                           :info="selectedCellInfo"
                           :preview="selectedCellPreview"
                           :loading="cellInfoLoading"
                           :viewerColor="thisPlayer.color"
                           :players="playerView.players"
                           :placementTitle="placementTitle"
                           :selectedLegal="selectedCellLegal"
                           :illegalReason="selectedCellIllegalReason"
                           :inspectAll="consoleState.freeRoam"
                           :sourceView="placementSourceView"
                           :myTurn="myTurn"
                           :actionsAvailable="actionsAvailableCount"
                           :actionsTotal="actionsTotalCount"
                           :milestoneSummary="homeMilestoneSummary"
                           :awardSummary="homeAwardSummary"
                           :trackInfo="trackInfo"
                           :trackScale="trackScaleOverview"
                           :lore="selectedCellLore" />
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
      <ConsoleHandSection v-if="consoleState.section === 'hand'"
                          ref="handSection"
                          :entries="handEntries"
                          :index="consoleState.handIndex"
                          :saleActive="consoleState.sale.active"
                          :saleSelected="consoleState.sale.selected"
                          :saleMegacredits="thisPlayer.megacredits"
                          :select="handSelectProps"
                          :discarding="discardInOverlay"
                          :softReason="handSoftReason"
                          :tagFilters="handTagFilterOptions"
                          :activeTag="consoleState.handTagFilter"
                          :stagedCard="stagedHandCard"
                          :stage="handStage"
                          :stagePaused="pickBridgeActive"
                          :transitHold="handRevealState.holdSlots"
                          :filterBusy="handRevealState.filterActive"
                          :underScene="sceneOverHand || consoleRevealMode !== undefined" />
      <!-- Surface-motion 'section': a workspace switch gets a light rise
           (no dim) — never the bare v-if pop it used to be. The wheel's
           «Торговля» slot hands off directionally into it. -->
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleColoniesSection v-if="consoleState.section === 'colonies'"
                                data-motion-surface="section"
                                :colonies="coloniesForRail"
                                :index="consoleState.colonyIndex"
                                :tradeable="tradeableColonyNames"
                                :tradeBlockReason="colonyTradeBlockReason"
                                :pick="colonyPick"
                                :players="playerView.players"
                                :viewerColor="thisPlayer.color"
                                :dockedColony="tradeFleetState.dockedColonyName"
                                :tradeOffset="thisPlayer.colonyTradeOffset ?? 0" />
      </transition>
      <!-- The console-NATIVE Hydronetwork screen (the full rework — the
           desktop overlay is no longer re-hosted here). One shared brain:
           hydroNetworkState + buildHydroModel; the shell keeps the pick
           sheet + the byte-identical submit batch. -->
      <transition :css="false" appear
                  @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                  @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
        <ConsoleHydroSection v-if="consoleState.section === 'hydro'"
                             data-motion-surface="section"
                             ref="hydroSection"
                             :playerView="playerView"
                             :actionAvailable="hydroActionAvailable"
                             :cacheKey="hydroCacheKey"
                             @pick="openHydroPick"
                             @notice="showNotice($event)"
                             @confirm="submitHydroAdvance($event)"
                             @close="consoleState.section = 'board'" />
      </transition>

      <!-- THE ACTION WORKSPACE («Действия карт») — the console-native
           blue-card action center as an ABSOLUTE child of .con-main filling
           everything RIGHT of the player rail (the information-workspace
           seam geometry: left edge from --con-rail-w / --con-main-gap). The
           rail stays visible and LIT above the shared shade (the `con-ws`
           marker + `.con-root:has(.con-ws)` lift it for as long as the
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
        <!-- COLLAPSE, not close: past the commit boundary B hides this
             workspace (v-show) so the board can be read, and the committed
             decision keeps living inside it — same revealed card, same picks,
             no replayed cinematic, no restarted server flow. Destroying it
             here is what would force the flow to be rebuilt on re-open. -->
        <ConsoleCardActions v-if="consoleState.sheet === 'cardActions'"
                            v-show="!handPickActive && !repeatPickActive && !workspaceCollapsed"
                            ref="cardActions"
                            :playerView="playerView"
                            :collapsed="workspaceCollapsed"
                            @blocked="showNotice"
                            @submit-batch="onCardActionsSubmitBatch"
                            @reveal-ack="onCardActionsRevealAck"
                            @collapse="onCardActionsCollapse"
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

    <!-- Colony trade — the console-native pre-select COMPOSER (payment path +
         M€ mix + track choice + card targets + the live «Итог торговли»);
         confirms as ONE PlayerInputBatch (colonyTradePlan.buildTradeBatch). -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleColonyTradeConfirm v-if="pendingTradeColony !== undefined"
                                 ref="tradeConfirm"
                                 :colony="pendingTradeColonyModel"
                                 :colonyName="pendingTradeColony.colonyName"
                                 :options="pendingTradeColony.paymentOptions"
                                 :disabledOptions="pendingTradeColony.disabledPayments"
                                 :players="playerView.players"
                                 :preview="pendingTradeColony.preview"
                                 :thisPlayer="thisPlayer"
                                 :viewerColor="thisPlayer.color"
                                 @confirm="onColonyTradeComposerConfirm($event)"
                                 @cancel="pendingTradeColony = undefined" />
    </transition>

    <!-- Colony inspect (X = «Осмотреть») — the read-only full dossier for ANY
         colony; ←/→ page through the colonies while open. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleColonyInspect v-if="colonyInspectModel !== undefined"
                            :colony="colonyInspectModel"
                            :players="playerView.players"
                            :viewerColor="thisPlayer.color"
                            :playerId="playerView.id"
                            :tradeOffset="thisPlayer.colonyTradeOffset ?? 0"
                            :readonly="colonyInspectReadonly"
                            :tradeable="colonyInspectTradeable"
                            :blockReason="colonyInspectReadonly ? '' : colonyTradeBlockReason"
                            :paymentOptions="colonyInspectReadonly || tradeColonyContext === undefined ? [] : tradeColonyContext.paymentOptions"
                            :disabledPayments="colonyInspectReadonly || tradeColonyContext === undefined ? [] : tradeColonyContext.disabledPayments" />
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

    <!-- Milestones/Awards — the console-native premium CONFIRMATION (an A
         on an available dashboard item opens this; nothing is submitted
         until the modal's own A — accidental claim/fund is impossible). -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleMaConfirm v-if="maConfirmView !== undefined"
                        ref="maConfirm"
                        :view="maConfirmView"
                        :available="maConfirmAvailable"
                        :blockReason="maConfirmBlockReason"
                        @confirm="submitMaConfirm"
                        @cancel="pendingMaConfirm = undefined" />
    </transition>

    <!-- Milestones/Awards — the X → «Осмотреть» full-text READER (the premium
         reader for the long descriptions the dashboard cards must clamp). -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleMaInspect v-if="maInspectItem !== undefined" :item="maInspectItem" :players="playerView.players" />
    </transition>

    <!-- THE SURFACE-MOTION SHADE (surfaceMotionState) — the ONE dim behind
         every migrated band surface. Always mounted; only its opacity moves,
         so a wheel → sheet → composer → reveal chain keeps one continuous
         darkness (never stacked dims, never a blink through zero). -->
    <!-- `--focus` deepens the vignette while a wheel slot is ARMED — the
         dimming is a transition instrument, not a static backdrop: open
         wheel → focused hold → (commit) the shade hands its darkness to the
         incoming surface, or releases toward a workspace. Opacity-only. -->
    <div class="con-shade" :class="{'con-shade--on': surfaceShadeVisible, 'con-shade--veil': surfaceShadeVeil, 'con-shade--focus': wheelInput.arm !== undefined}" aria-hidden="true"></div>

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
      <ConsoleStdProjectsScreen v-if="consoleState.sheet === 'standardProjects'"
                                :items="stdProjectItems"
                                :index="consoleState.sheetIndex"
                                :myMegacredits="thisPlayer.megacredits"
                                :backLabel="stdBackLabel" />
      <ConsoleMaScreen v-else-if="maScreenKind !== undefined" :kind="maScreenKind" :items="maScreenItems" :index="consoleState.sheetIndex" :myMegacredits="thisPlayer.megacredits" :free="awardFundingActive && maScreenKind === 'awards'" />
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
        <ConsoleTaskHost v-if="hostTask !== undefined && !taskHeldForWorkspace && !effectDecisionActive && !finalGreeneryActive && !govSupportActive && !productionLossActive && !govScaleFocusState.holding && !consoleState.task.deferred && taskSpacePending === undefined && !handPickActive"
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
         represent the prompt honestly — otherwise the host keeps it. -->
    <transition :css="false" appear
                @enter="surfaceEnterHook" @leave="surfaceLeaveHook"
                @enter-cancelled="surfaceEnterCancelledHook" @leave-cancelled="surfaceLeaveCancelledHook">
      <ConsoleEffectDecision v-if="effectDecisionActive && effectDecisionVm !== undefined"
                             ref="effectDecision"
                             :playerView="playerView"
                             :vm="effectDecisionVm"
                             @submit="onTaskSubmit"
                             @defer="onTaskDefer"
                             @hand-pick="onTaskHandPick" />
    </transition>

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

    <!-- CTS T5: the game-opening START SCENE (initialCards wizard /
         start-sequence ceremony) — the console-native replacement for
         both desktop start surfaces. B defers to the amber chip. -->
    <transition name="con-layer">
      <ConsoleStartScene v-if="startSceneMounted"
                         :yielded="placementActive"
                         ref="startScene"
                         :playerView="playerView"
                         :waitingOnPlayers="waitingOnPlayers"
                         :task="startTask"
                         @submit="onTaskSubmit"
                         @defer="consoleState.task.deferred = true" />
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
        <ConsoleInspectSide v-if="consoleCardZoom.inspect !== undefined && zoomRulesCardName !== undefined"
                            :cardName="zoomRulesCardName"
                            :history="consoleCardZoom.inspect.history"
                            :tab="consoleCardZoom.inspectTab"
                            :nonce="side.nonce"
                            :closing="side.closing" />
        <ConsoleCardRulesPanel v-else-if="zoomRulesCardName !== undefined"
                               :cardName="zoomRulesCardName"
                               :nonce="side.nonce"
                               :closing="side.closing" />
      </template>
      <template #actions>
        <!-- A read-only inspector (bot-turn / card-actions, opened from a chip)
             names itself, so the card never reads as an ordinary picked card. -->
        <div v-if="consoleCardZoom.contextLabel !== undefined" class="con-zoom__context">
          <span class="con-zoom__context-mark" aria-hidden="true">◈</span>
          <span>{{ $t(consoleCardZoom.contextLabel) }}</span>
        </div>
        <!-- P17: an UNPLAYABLE card is never mute — the same structured
             server reasons the hand verdict shows (desktop parity). -->
        <div v-if="zoomReasons.length > 0" class="con-zoom__reasons">
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

    <!-- The «Гидромоделирование» DRAW stage — 4 cards lift off the reached
         track stop, fan out + flip open, and land in the pick-2-of-4 modal
         (which materializes around them; consoleHydroDraw.ts). -->
    <ConsoleHydroDrawLayer />

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
      <ConsoleHandDock v-show="handDockVisible && !dockParkedUnderScene"
                       ref="handDock"
                       :cards="handDockCards"
                       :playableCount="cardsPlayableCount"
                       :epoch="playerView.runId"
                       :interactive="handDockInteractive"
                       :raised="consoleState.quick === 'actions'"
                       :compact="planetFocusState.phase !== 'idle'"
                       :liftedNames="dockLiftedNames"
                       :deliveryHeld="dockHeld"
                       @open="onHandDockOpen" />
      <!-- The command bar keeps its BAY (centre track) for the whole in-game
           lifecycle — the bay-mode fit (planCommandRun drops/splits commands
           to the width) is what keeps the setup's 5-command run from clipping
           at TV 4K. Only the DOCK CARDS (the «КАРТЫ 0/0» readout) are hidden
           during the pre-game setup (handDockVisible); the reserved bay track
           stays, so the bar layout is identical to in-game. -->
      <ConsoleCommandBar :context="commandContext" :commands="commands" :bay="game.phase !== 'end'" />
    </div>

    <!-- HEADLESS transport: the WaitingFor brain (polling / holds / modal
         routing / SelectSpace placement handlers) runs unchanged; its INLINE
         rendering is hidden. Its teleported surfaces (MandatoryInputModal,
         PlacementBanner) render at body level = the iteration-1 FALLBACK. -->
    <div class="con-wf-host" aria-hidden="true">
      <waiting-for v-if="game.phase !== 'end'" ref="waitingFor"
                   :playerView="playerView"
                   :waitingfor="playerView.waitingFor"
                   :modal-suppressed="hostServesPrompt || tilePlacementHolds || presentationHeld || consoleRevealMode !== undefined || startSceneServes || draftWaitActive || govScaleFocusState.holding || govScaleFocusState.closing || playedHeroHolds"></waiting-for>
      <select-space v-if="convertPlantsPrompt !== undefined"
                    :playerView="playerView"
                    :playerinput="convertPlantsPrompt"
                    :onsave="onConvertPlantsSpacePicked"
                    :showsave="false"
                    :showtitle="false" />
      <!-- Nested board pick from a task's space-type option (WGT ocean):
           the same headless SelectSpace machinery as convert-plants. -->
      <select-space v-if="taskSpacePrompt !== undefined"
                    :playerView="playerView"
                    :playerinput="taskSpacePrompt"
                    :onsave="onTaskSpacePicked"
                    :showsave="false"
                    :showtitle="false" />
    </div>

    <!-- Play-a-card flow — the console-native confirm (CTS T8: the
         re-hosted HandCardPaymentContent modal is retired). Preview +
         payment here; the on-play choices arrive as NATIVE follow-up
         tasks after confirm (the legacy-supported sequential contract).

         EMBEDDED HOSTING (consoleWorkspaceStage): when the player entered
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
                                v-show="!handPickActive && !repeatPickActive"
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
 * P0: everything ends in WaitingFor.onsave()/onsaveBatch() with payloads
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
import {DiscardPromptMeta, SelectCardModel, SelectColonyModel, SelectPaymentModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {playerActionSourceCount} from '@/client/components/actions/actionExtraction';
import {placementReasonToUnplayable} from '@/client/components/board/placementReason';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';
import {SpaceId} from '@/common/Types';

import WaitingFor from '@/client/components/WaitingFor.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import {buildStandardProjectPaymentModel, hasUsableStandardProjectAlternativeResources, standardProjectPaymentTitle} from '@/client/components/payment/paymentModelUtils';

import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import ConsoleTerraformingCeremony from '@/client/components/console/ConsoleTerraformingCeremony.vue';
import ConsoleBotTurnReview from '@/client/components/console/ConsoleBotTurnReview.vue';
import {botTurnReviewState, closeBotTurnReview, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import {openBotTurnReviewByKey, stepBotTurnReview} from '@/client/components/marsbot/marsBotPresentation';
import {acquireForegroundLease, isMandatoryPromptsHeld} from '@/client/components/presentation/presentationFlow';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';
import {PendingQueueSummary} from '@/client/components/presentation/presentationPolicy';
import {notificationState, pendingSummary, dismiss as dismissNotification} from '@/client/components/notifications/notificationState';
import {beginNotifHold, cancelNotifHold, consumeNotifHoldRelease, resetNotifHold} from '@/client/console/consoleNotifHold';
import {LiveNotification} from '@/client/components/notifications/notificationTypes';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import ConsoleHandDock from '@/client/components/console/ConsoleHandDock.vue';
import {handDockBayRem} from '@/client/console/consoleHandDock';
import ConsoleSheet, {ConsoleSheetRow} from '@/client/components/console/ConsoleSheet.vue';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import ConsoleMaConfirm from '@/client/components/console/ConsoleMaConfirm.vue';
import ConsoleMaInspect from '@/client/components/console/ConsoleMaInspect.vue';
import ConsoleMaCeremony from '@/client/components/console/ConsoleMaCeremony.vue';
import {buildConsoleMaItems, ConsoleMaItem, ConsoleMaKind, consoleMaPressNotice, stepGrid} from '@/client/components/console/consoleMaModel';
import {buildMaConfirm, MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {armMaCeremony} from '@/client/components/ma/maCeremonyState';
import {MaKind} from '@/client/components/ma/maArt';
import ConsoleQuickSelector from '@/client/components/console/ConsoleQuickSelector.vue';
import ConsoleStdProjectsScreen from '@/client/components/console/ConsoleStdProjectsScreen.vue';
import {buildRtQuickEntries, buildLtQuickEntries, buildStdProjectItems, buildHomeMaSummary, HomeMaSummary, QuickEntry, QuickSlot, StdProjectItem} from '@/client/console/consoleQuickModel';
import ConsoleContextPanel from '@/client/components/console/ConsoleContextPanel.vue';
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
import ConsoleStartScene from '@/client/components/console/ConsoleStartScene.vue';
import ConsoleRevealOverlay, {ConsoleRevealMode} from '@/client/components/console/ConsoleRevealOverlay.vue';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';
import type {ConsoleHandStage} from '@/client/components/console/ConsoleHandSection.vue';
import {
  openWorkspaceStage,
  closeWorkspaceStage,
  markWorkspaceStageCommitted,
  rollbackWorkspaceStageCommit,
  resetWorkspaceStage,
  workspaceStageOpen,
  workspaceStageTarget,
  workspaceStageState,
} from '@/client/console/consoleWorkspaceStage';
import {isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {resetHandStageMotion, handStageTransitioning, guardHandHeroFlight, heroCommitLift} from '@/client/console/consoleHandStageMotion';
import {armHandPlayPrewarm, cancelHandPlayPrewarm, resetHandPlayPrewarm} from '@/client/console/consoleHandPlayPrewarm';
import ConsoleCorpFirstActionConfirm from '@/client/components/console/ConsoleCorpFirstActionConfirm.vue';
import ConsoleCardExitLayer from '@/client/components/console/cardDeal/ConsoleCardExitLayer.vue';
import ConsoleCardDiscardLayer from '@/client/components/console/cardDiscard/ConsoleCardDiscardLayer.vue';
import {
  armCardDiscard, cardDiscardTransaction, isCardDiscardActive,
  registerDiscardOverlayHandoff, resetCardDiscard,
} from '@/client/console/cardDiscard/consoleCardDiscard';
import {discardPhaseInOverlay} from '@/client/console/cardDiscard/discardModel';
import {
  DiscardIntent, deriveDiscardIntent, discardMetaOf,
} from '@/client/console/cardDiscard/discardIntent';
import ConsoleHandRevealLayer from '@/client/components/console/ConsoleHandRevealLayer.vue';
import ConsoleHandDeliveryLayer from '@/client/components/console/ConsoleHandDeliveryLayer.vue';
import {handRevealState, RevealVisual} from '@/client/console/handDock/handRevealState';
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
import {Phase} from '@/common/Phase';
import ConsoleColonyTradeConfirm from '@/client/components/console/ConsoleColonyTradeConfirm.vue';
import ConsoleTradeFleetLayer from '@/client/components/console/colonyFleet/ConsoleTradeFleetLayer.vue';
import {armTradeFleet, abortTradeFleet, isTradeFleetActive, tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import ConsoleColonyTradeLayer from '@/client/components/console/colonyTrade/ConsoleColonyTradeLayer.vue';
import {
  abortColonyTrade, armColonyTrade, colonyTradeState, isColonyTradeInputLocked,
  noticeColonyTradeCommit, notifyColonyTradeTrackCommitted,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {ColonyTradeTargets} from '@/client/console/colonyTrade/colonyTradeModel';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import ConsolePlayedHeroLayer from '@/client/components/console/played/ConsolePlayedHeroLayer.vue';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {resetPlayedCategoryView} from '@/client/console/played/playedCategoryView';
import {resetPlayedCardReturns} from '@/client/console/played/playedCardReturn';
import {resetCategoryDirector} from '@/client/console/played/playedCategoryDirector';
import {
  abortPlayedHero, armPlayedHero, isPlayedHeroActive, playedHeroHolding, playedHeroState, skipPlayedHeroResult,
} from '@/client/console/played/consolePlayedHero';
import {CardType} from '@/common/cards/CardType';
import {colonyGridCols, colonyGridLayout, colonyNavStep, consoleColoniesUi, resetConsoleColoniesUi} from '@/client/console/consoleColoniesModel';
import {consolePlayCardUi} from '@/client/console/consolePlayCardUi';
import {consoleStartUi} from '@/client/console/consoleStartUi';
import {startAwaitingOthers, startDeferredSummary, startSceneHeld} from '@/client/console/consoleStartState';
import {panelCommands} from '@/client/console/consolePanelUi';
import {consoleActionComposerUi, resetConsoleActionComposerUi, resetConsoleActionRevealClaim} from '@/client/console/consoleActionComposerUi';
import {focusKicker} from '@/client/console/consoleActionFlow';
import {buildTradeBatch, freeTradeFleets, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {colonyTradeReason} from '@/client/console/colonyTradeReason';
import {buildPlayCardBatch} from '@/client/console/consolePlayCardComposer';
import {fetchColonyTradePreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';
import ConsoleCardRulesPanel, {cardHasRules} from '@/client/components/console/ConsoleCardRulesPanel.vue';
import ConsoleInspectSide from '@/client/components/console/ConsoleInspectSide.vue';
import Card from '@/client/components/card/CardFace.vue';
import {ZoomCard, bonusZoomEntry} from '@/client/components/card/cardZoomTypes';
import {consoleCardZoom, openConsoleCardZoom, navigateConsoleCardZoom, closeConsoleCardZoom, setConsoleZoomInspectTab, slotZoomOrigin, ZoomOrigin, ConsoleZoomProvenance} from '@/client/console/consoleCardZoom';
import {beginZoomOpen, cancelZoomOpen, playZoomOpenFlight, zoomOpenSourceRect, playZoomClose, playZoomDepart, playZoomHandoff, playZoomSwap, retargetZoomHold, releaseZoomMotion} from '@/client/console/consoleZoomMotion';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {currentRevealEvent, untakenNameMultiset} from '@/client/components/drawnCards/drawnCardsState';
import {revealViewerState} from '@/client/components/notifications/revealViewerState';
import {ConsoleTask, TaskKind, taskFor, taskServedByHost, SCENE_KINDS, SHELL_SECTION_KINDS} from '@/client/console/consoleTaskRouter';
import ConsoleSpendHeat from '@/client/components/console/ConsoleSpendHeat.vue';
import ConsoleVenusBonus from '@/client/components/console/ConsoleVenusBonus.vue';
import ConsoleAresGlobals from '@/client/components/console/ConsoleAresGlobals.vue';

import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';

/** The kinds served by a DEDICATED composite surface (not by the task host). */
const NATIVE_COMPOSITE_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['venusBonus', 'spendHeat', 'aresGlobal']);
import {ConsoleTaskSummary, consoleTaskSummary} from '@/client/console/consoleTaskSummary';
import {setStartSetupRevealSuspended} from '@/client/components/startGameFlow/startSetupRevealState';
import {corpActionOptionIndexFor, corporationCardNames, corpStatusFor, startFlowCorpPrompt} from '@/client/components/startGameFlow/startGameFlowState';
import {cancelResponse, cardsResponse, colonyResponse, orWrappedResponse} from '@/client/console/taskResponses';
import {leakDetectorState, startConsoleLeakDetector, stopConsoleLeakDetector, setConsoleTaskDeferred, setConsoleTaskSpacePlacement} from '@/client/console/consoleLeakDetector';
import {govScaleFocusState, beginGovScaleClose, commitGovScaleFocus, resetGovScaleFocus} from '@/client/console/consoleGovScaleFocus';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import ConsoleHydroMarkerLayer from '@/client/components/console/hydroMarker/ConsoleHydroMarkerLayer.vue';
import {armHydroMarker, abortHydroMarker, isHydroMarkerActive, hydroMarkerState} from '@/client/console/hydroMarker/consoleHydroMarker';
import ConsoleHydroDrawLayer from '@/client/components/console/hydroDraw/ConsoleHydroDrawLayer.vue';
import {armHydroDraw, abortHydroDraw, isHydroDrawActive} from '@/client/console/hydroDraw/consoleHydroDraw';
import {bonusDiscardStep, BonusDiscardStep} from '@/client/console/colonyTrade/colonyBonusDiscardStep';
import {drawnRevealCommandRun} from '@/client/console/consoleRevealCommands';
import {workspaceClaimsDrawReveal, workspaceClaimsPick, workspaceOutcomeClaimed, workspaceOutcomeBeatPending, markWorkspaceOutcomeAnswerIn, markWorkspaceOutcomePresenting, releaseWorkspaceOutcome, resetWorkspaceOutcome, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import ConsoleBoardCardBonusLayer from '@/client/components/console/boardCardBonus/ConsoleBoardCardBonusLayer.vue';
import {armBoardCardBonus, abortBoardCardBonus, isBoardCardBonusActive, isBoardCardBonusFieldPhase} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {
  planetFocusState, enterPlanetFocus, beginPlanetFocusExit, playPlanetFocusScaleBeat,
  planetFocusBeatAllowed, qualifiesForPlanetFocus, captureGlobalParams,
  registerPlanetFocusParamsSource, resetPlanetFocus, isPlanetFocusEngaged,
  snapPlanetFocusSettled,
} from '@/client/console/planetFocus';
import ConsoleDeckDrawLayer from '@/client/components/console/deckDraw/ConsoleDeckDrawLayer.vue';
import {abortDeckDraw, deckDrawHolds, isDeckDrawActive} from '@/client/console/deckDraw/consoleDeckDraw';
import ConsolePatentSaleLayer from '@/client/components/console/patentSale/ConsolePatentSaleLayer.vue';
import {armPatentSale, isPatentSaleActive, patentSaleState} from '@/client/console/patentSale/consolePatentSale';
import ConsoleResourceTransferLayer from '@/client/components/console/resourceTransfer/ConsoleResourceTransferLayer.vue';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {runResourceTransfers, beginPanelRewardHold, releasePanelRewardHold, clearPanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ActionCommitPlan, actionCommitHolding, consumeActionCommitPlan, releaseActionCommit} from '@/client/console/consoleActionCommit';
import ConsoleTilePlacementLayer from '@/client/components/console/tilePlacement/ConsoleTilePlacementLayer.vue';
import {tilePlacementHolding, tilePlacementState} from '@/client/console/tilePlacement/consoleTilePlacement';
import ConsoleColonyBuildLayer from '@/client/components/console/colonyBuild/ConsoleColonyBuildLayer.vue';
import {armColonyBuild, isColonyBuildActive} from '@/client/console/colonyBuild/consoleColonyBuild';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import ConsoleJournalPanel from '@/client/components/console/ConsoleJournalPanel.vue';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {consoleJournalUi} from '@/client/console/consoleJournalState';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl, activeGlyphSet} from '@/client/gamepad/glyphSets';
import {resolveScope} from '@/client/gamepad/focusScopes';
import {consoleState, closeConsoleLayers, stepIndex, stepSelectable, registerConsoleIntentHandler, ConsoleSection, ConsoleSheetId, ConsoleQuickId} from '@/client/console/consoleRouter';
import {surfaceShadeOn, setPickSuppressed, beginAwaitingHandoff, clearAwaitingHandoff, isSurfaceAwaitingHandoff, captureSurfaceDeparture, markWheelHandoff, retargetWheelEcho, resetSurfaceMotion, surfaceMotionState} from '@/client/console/surfaceMotion/surfaceMotionState';
import {WheelArmEvent, WheelInputState, initialWheelInput, reduceWheel} from '@/client/console/quickWheel/wheelArmModel';
import {wheelControlState} from '@/client/console/quickWheel/wheelControlMode';
import {wheelHandoffSpecFor, CONFIRM_HANDOFF} from '@/client/console/quickWheel/wheelHandoffModel';
import {pulseWheelAnchors} from '@/client/console/quickWheel/wheelPulse';
import {ensureActionPreviews, resetActionPreviews} from '@/client/console/actionPreviewStore';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {resolveAwaiting, AWAITING_SAFETY_MS} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {surfaceEnterHook, surfaceLeaveHook, surfaceEnterCancelledHook, surfaceLeaveCancelledHook} from '@/client/console/surfaceMotion/surfaceMotionDirector';
import {consoleHandPickState, cancelConsoleHandPick, enterConsoleHandPick, resolveConsoleHandPick, resetConsoleHandPick} from '@/client/console/consoleHandPick';
import {consoleRepeatPickState, cancelConsoleRepeatPick, enterConsoleRepeatPick, resetConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {hydroAdvanceResponses} from '@/client/console/consoleHydroAdvance';
import {consoleRepeatPickUi, resetConsoleRepeatPickUi} from '@/client/console/consoleRepeatPickUi';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import {useWorkspaceBandGeometry} from '@/client/console/composables/useWorkspaceBandGeometry';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {awaitingViewerInput, offTurnReason} from '@/client/console/offTurnReason';
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
  TradeColonyContext,
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
  mandatoryBeatFor,
  isMandatoryBeatHeld,
  acknowledgeMandatoryBeat,
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

/** P17: px per full-deflection frame for the right-stick console scroll
 *  (mirrors the DOM engine's SCROLL_STEP_PX so the feel is identical). */
const CONSOLE_SCROLL_STEP_PX = 24;

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
    ConsoleMaConfirm,
    ConsoleMaInspect,
    ConsoleMaCeremony,
    ConsoleQuickSelector,
    BarButtonIcon,
    ConsoleStdProjectsScreen,
    ConsoleContextPanel,
    ConsoleSystemAlert,
    ConsoleBoardSection,
    ConsoleHandSection,
    ConsoleResourcePanel,
    ConsoleColoniesSection,
    ConsoleInfoMode,
    ConsoleCardRulesPanel,
    ConsoleInspectSide,
    ConsoleStrandedPrompt,
    ConsoleTaskHost,
    ConsoleGovernmentSupport,
    ConsoleEffectDecision,
    ConsoleFinalGreenery,
    ConsoleProductionLoss,
    ConsoleSpendHeat,
    ConsoleVenusBonus,
    ConsoleAresGlobals,
    ConsoleStartScene,
    ConsoleRevealOverlay,
    ConsolePlayCardConfirm,
    ConsoleCorpFirstActionConfirm,
    ConsoleCardExitLayer,
    ConsoleCardDiscardLayer,
    ConsoleHandRevealLayer,
    ConsoleHandDeliveryLayer,
    ConsoleDraftTray,
    ConsoleHydroMarkerLayer,
    ConsoleHydroDrawLayer,
    ConsoleBoardCardBonusLayer,
    ConsoleDeckDrawLayer,
    ConsoleColonyTradeConfirm,
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
    'waiting-for': WaitingFor,
    'select-space': SelectSpace,
  },
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /**
     * The LIVE list of players the server is waiting on (App-level, refreshed
     * by the headless WaitingFor's `/api/waitingFor` poll — mirrors what the
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
    // The workspace band's ONE geometry: the fixed band surfaces read the
    // LIVE main-column box instead of approximating it from tokens, so every
    // workspace opens in a pixel-identical frame.
    const conMainEl = ref<HTMLElement>();
    useWorkspaceBandGeometry(conMainEl);
    return {conMainEl};
  },
  data() {
    return {
      consoleState,
      consoleCardZoom,
      playedHeroState,
      handRevealState,
      handDeliveryState,
      patentSaleState,
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
      botTurnReviewState,
      /** The colony trade-launch controller (drives the docked-settle glow). */
      tradeFleetState,
      /** The hydronetwork marker-advance controller (the plan-reset watcher). */
      hydroMarkerState,
      pendingPlayCard: undefined as PendingPlayCard | undefined,
      /** The client hand-pick bridge state (composer → hand section). */
      consoleHandPickState,
      consoleRepeatPickState,
      /** The section to restore when a client hand pick resolves/cancels. */
      handPickReturn: undefined as ConsoleSection | undefined,
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
      /** The card just PLAYED (success) — its hand slot stays held until the
       *  server response removes it from the hand (never a fake return). */
      departingPlayCard: undefined as CardName | undefined,
      departingTimer: undefined as number | undefined,
      pendingClientPayment: undefined as PendingClientPayment | undefined,
      /** P24: the hydro pick-sheet candidates (name + live animal count). */
      hydroPickCards: [] as Array<{name: CardName, current?: number}>,
      pendingTradeColony: undefined as {colonyName: ColonyName, paymentOptions: TradeColonyContext['paymentOptions'], disabledPayments: TradeColonyContext['disabledPayments'], preview?: ColonyTradePreviewModel} | undefined,
      /** X = «Осмотреть» — the read-only colony dossier overlay. */
      colonyInspectOpen: false,
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
      /** Milestones/Awards premium confirm (nothing submitted until its A). */
      pendingMaConfirm: undefined as {kind: MaKind, name: string} | undefined,
      // X → «Осмотреть»: the NAME of the milestone/award shown in the premium
      // full-text reader (the live item is recomputed from maScreenItems).
      maInspect: undefined as string | undefined,
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
    // ── action intelligence (same sources as the desktop bar buttons) ──
    cardsPlayableCount(): number {
      const raw = (this.playAction?.input.cards ?? []).filter((c) => c.isDisabled !== true).length;
      // Never read ahead of the intake-aware total (a card still mid-flight
      // into the dock is not "in hand" on any HUD readout).
      return Math.min(raw, this.cardsTotalCount);
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
      return this.thisPlayer.availableBlueCardActionCount;
    },
    actionsTotalCount(): number {
      return playerActionSourceCount(this.thisPlayer.tableau);
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
     * Dock backs the hand OVERLAY owns right now (hidden in the tray) —
     * DERIVED, never stored, so it can't drift from the live hand:
     *  - the VISIBLE (filtered) entries while the overlay owns the cards —
     *    phase `open`/`closing`, or `opening` once its proxies stand (the
     *    old whole-pack `dockLifted` timing). A card OUTSIDE the tag filter
     *    is not in `handEntries`, so its back stays physically in the tray
     *    the whole time the hand is open;
     *  - plus `dockExtraLift`: tag-filter leavers still airborne on their
     *    way back to the pack (released at the episode's materialization).
     */
    dockLiftedNames(): ReadonlyArray<string> {
      const st = handRevealState;
      const overlayOwns = st.phase === 'open' || st.phase === 'closing' ||
        (st.phase === 'opening' && st.flights.length > 0);
      if (!overlayOwns) {
        return st.dockExtraLift;
      }
      return [...this.handEntries.map((e) => e.card.name), ...st.dockExtraLift];
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
        this.pendingTradeColony !== undefined ||
        this.corpFirstActionOpen ||
        this.govSupportActive ||
        this.productionLossActive ||
        this.nativeCompositeTask !== undefined ||
        this.maConfirmView !== undefined ||
        this.maInspectItem !== undefined ||
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
      // The DRAFT pick task host lives INSIDE `.con-main` (z1), so `footerUnderScene`
      // (z11390) can never drop the footer below it — only `behind-workspace` (z0)
      // beats con-main. Detect the draft by the game PHASE (the pick prompt's
      // buttonLabel is 'Select', so the task router classifies it as cardSelect
      // mode 'target', NOT 'draft' — a mode check can't see it). No card flies into
      // the dock during a pick (the drafted card lands in the separate `draftedCards`
      // stack), so parking the dock BELOW the host is safe. The research BUY is phase
      // RESEARCH, so the deck→dock buy flights keep the footer on top (not matched).
      if (phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING) {
        return true;
      }
      // The bare colonies / hydro section grid. ⚠ ONLY the bare grid — while a
      // dimming OVERLAY is up (the trade / hydro confirm, inspect, a sheet…)
      // the footer MUST stay at its high z so the command bar reads BRIGHT
      // above the overlay's backdrop (dropping it left the bar dimmed under the
      // trade confirm — "не понятно какую кнопку нажать"). Those states are
      // exactly `dockParkedUnderScene` (where the dock is hidden anyway, so
      // nothing needs to tuck behind) + the hydro confirm.
      return (this.consoleState.section === 'colonies' || this.consoleState.section === 'hydro') &&
        !this.dockParkedUnderScene && !consoleHydroUi.confirmOpen;
    },
    /**
     * The pre-game INITIAL-SETUP window: the player has NO actual hand yet —
     * the `initialCards` wizard is live (incl. deferred / the submit in
     * flight), the initial draft is still dealing, or the viewer already
     * submitted and gen-1 research waits on the other players. The hand
     * dock's «КАРТЫ 0/0» would be a false readout for a hand that does not
     * exist, so the footer unmounts the dock AND its bay for the whole
     * window (see `handDockVisible`). The dock appears the moment the game
     * actually starts — the start ceremony's card delivery (post-launch) is
     * the first real hand content and needs the dock as its landing target.
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
        this.playerView.waitingFor === undefined;
    },
    /** The dock (and the bar's centre bay) exists whenever a REAL hand can —
     *  everything but the endgame and the pre-game initial setup. */
    handDockVisible(): boolean {
      return this.game.phase !== 'end' && !this.setupHandPending;
    },
    handDockInteractive(): boolean {
      if (this.consoleState.section !== 'board' || this.consoleState.fallbackActive || this.game.phase === 'end') {
        return false;
      }
      return !(
        this.hostTask !== undefined ||
        this.startSceneServes ||
        this.govSupportActive ||
        this.productionLossActive ||
        this.nativeCompositeTask !== undefined ||
        this.consoleRevealMode !== undefined ||
        this.consoleState.sheet !== undefined ||
        this.consoleState.confirm !== undefined ||
        this.pendingPlayCard !== undefined ||
        this.pendingTradeColony !== undefined ||
        this.maConfirmView !== undefined ||
        this.maInspectItem !== undefined ||
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
    /** A blocking foreground presentation is up: the console reveal overlay
     *  (drawn cards / result / viewer) OR a mandatory hold (bot-turn holding
     *  card / theater). While busy, a pending shell-section prompt is held
     *  BEHIND it and its section is NOT auto-opened; a watcher opens the
     *  serving surface the moment this clears (else it'd be a stranded prompt). */
    consoleForegroundBusy(): boolean {
      return this.consoleRevealMode !== undefined || this.presentationHeld || this.playedHeroHolds ||
        // Cards still travelling (deck draw / board lift / the intake into the
        // dock) — the SAME rule the host family follows, so a hand-select
        // prompt cannot open over a card in the air either.
        this.cardArrivalBusy;
    },
    /** The surface-motion shade (`.con-shade--on`): ≥1 migrated band surface
     *  owns the foreground, a committed submit is awaiting its answer, or
     *  the trade-fleet flight keeps its thin veil over the colony grid. */
    surfaceShadeVisible(): boolean {
      return surfaceShadeOn() || isTradeFleetActive();
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
     *  the lease): task host / start scene / gov-support panel, plus the
     *  reveal overlays ('drawn' also derives from drawnCardsState — the lease
     *  covers the console-only 'result'/'viewer' modes too).
     *
     *  A LEASE IS A CLAIM THAT SOMETHING IS VISIBLE — so every branch here must
     *  match a surface that really renders. The two states documented as
     *  "render nowhere" are excluded explicitly: the hero beat unmounting the
     *  reveal (via `revealOverlayVisible`) and a host claimed by a workspace
     *  whose outcome slot does not exist yet (`taskHeldForWorkspace`, see its
     *  own comment). Everything else the watchdog covers as the net. */
    consoleMandatoryPresenting(): boolean {
      if (this.revealOverlayMode !== undefined) {
        return true;
      }
      if (this.consoleState.task.deferred || this.taskHeldForWorkspace) {
        return false;
      }
      return (this.hostTask !== undefined && this.taskSpacePending === undefined) ||
        this.startSceneServes ||
        this.govSupportActive;
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
    /** A client pick bridge (hand / repeat-action) hides the owning composer
     *  via v-show — the picked-in surface owns the screen, the shade yields.
     *  (The TABLEAU bridge is gone: a played-card pick is now an EMBEDDED step
     *  inside the workspace that asked, so nothing is hidden for it.) */
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
      if (this.hostTask?.kind !== 'choice') {
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
        !this.handPickActive;
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
    venusBonusActive(): boolean {
      return this.nativeCompositeTask?.kind === 'venusBonus' && !this.consoleState.task.deferred;
    },
    spendHeatActive(): boolean {
      return this.nativeCompositeTask?.kind === 'spendHeat' && !this.consoleState.task.deferred;
    },
    aresGlobalsActive(): boolean {
      return this.nativeCompositeTask?.kind === 'aresGlobal' && !this.consoleState.task.deferred;
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
      // The corporation's MANDATORY FIRST ACTION is a STANDALONE start-of-game
      // confirm modal that hosts NONE of the start-sequence cinematics — the
      // prelude tile / resource flights, the drawn-cards reveal AND the card
      // intake that lays the drawn cards into the dock. The guard above already
      // waits out the reveal / hero / BLOCKING holds, but the intake + card
      // deal register 'notification-only' holds (they legitimately play OVER
      // the other shell sections and the action menu, so they must not hold
      // those), which are invisible to it. Hold the corp confirm until the
      // WHOLE presentation has settled — otherwise it pops as "modal spam"
      // over the still-running prelude / intake animations (the exact overlap
      // the user reported). Safe from a self-deadlock: the confirm animates
      // nothing of its own, so nothing it hosts keeps the hold alive; the hold
      // is reactive, so the modal appears the instant the last flight lands.
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
    startSceneServes(): boolean {
      return this.startTask !== undefined || startSceneHeld();
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
      return this.startSceneMounted && !this.placementActive;
    },
    /** MOUNTED ≠ VISIBLE. The scene owns the start's lifetime (its hold, its
     *  claims, its release beat), so it stays mounted through a yield and
     *  only stops painting — see the scene's `yielded` prop. */
    startSceneMounted(): boolean {
      return this.startSceneServes && !govScaleFocusState.holding && !this.consoleState.task.deferred;
    },
    /** OPTIONAL draft re-pick — the fork shows a calm "waiting for the other
     *  players" banner instead of offering to change the pick (desktop parity). */
    draftWaitActive(): boolean {
      return taskFor(this.playerView)?.kind === 'draftWait';
    },
    /** The persistent draft tray lives through the WHOLE draft (picks +
     *  waits) and stays for the research-rise handoff; it renders empty-
     *  invisible before the first pick and leaves once the draft resolves. */
    draftTrayMounted(): boolean {
      const phase = this.playerView.game.phase;
      return phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING ||
        this.draftWaitActive || draftPickBeatActive() || riseSceneEngaged();
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
      if (this.consoleRevealMode !== 'drawn') {
        return undefined;
      }
      if (!workspaceClaimsDrawReveal(currentRevealEvent()?.source)) {
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
      return this.revealEmbedTarget !== undefined || this.taskEmbedTarget !== undefined;
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
     * The workspace is COLLAPSED — hidden for board inspection while its
     * committed decision stays alive. Rides the existing deferred-prompt flag
     * (the board home already renders the restore card for it), so there is
     * one «свернуть» in the console, not two.
     */
    workspaceCollapsed(): boolean {
      return workspaceOutcomeClaimed() && this.consoleState.task.deferred;
    },
    /** A claimed batch whose workspace zone is not mounted yet → hold the
     *  reveal rather than let the full-bleed band take it for a frame. */
    revealHeldForWorkspace(): boolean {
      return this.rawDrawnRevealPending &&
        workspaceClaimsDrawReveal(currentRevealEvent()?.source) &&
        (workspaceOutcomeState.embedSlot === '' || workspaceOutcomeBeatPending());
    },
    consoleRevealMode(): ConsoleRevealMode | undefined {
      if (this.revealHeldForWorkspace) {
        return undefined;
      }
      if (this.rawDrawnRevealPending) {
        return 'drawn';
      }
      const lr = this.playerView.lastReveal;
      if (lr !== undefined && `${lr.action}|${lr.revealed.name}` !== this.dismissedRevealKey &&
          lr.action !== consoleActionComposerUi.revealClaim) {
        // A reveal CLAIMED by the Action Focus stage presents IN-FRAME —
        // the standalone result overlay must not double-mount over it.
        return 'result';
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
    /** The current interruptive mandatory DECISION beat (never a reveal). */
    mandatoryBeat(): MandatoryBeat | undefined {
      const wf = this.playerView.waitingFor;
      return mandatoryBeatFor({
        task: taskFor(this.playerView),
        taskKey: promptIdentityKey(wf),
        forcedReaction: this.viewerForcedReaction,
      });
    },
    /** The current beat is HELD (announced, not yet OPENED by the player). While
     *  held, its surface is suppressed — only the chip status + the announcement
     *  show; B opens it. Equivalent to `taskGateHeld` (a beat is always a task). */
    mandatoryGateHeld(): boolean {
      return isMandatoryBeatHeld(this.mandatoryBeat);
    },
    /** The held beat suppresses its task surface (shellTask / hostTask). */
    taskGateHeld(): boolean {
      return this.mandatoryGateHeld;
    },
    /**
     * Is the player idle/free enough to SHOW the announcement (and press B to
     * open)? While an animation / hero / another full surface owns the screen the
     * beat stays HELD but the announcement waits — the player sees only their
     * chip status until they've "closed the screen / finished the animations".
     */
    /** A task the player OPENED then DEFERRED (set aside) — the "return" state
     *  of the unified mandatory prompt (replaces the legacy amber chip). */
    mandatoryDeferredActive(): boolean {
      // The START WORKSPACE has no live task while the table finishes its
      // setup (the server holds everyone), and a minimized workspace with no
      // task used to have NO announcement at all — the player could not get
      // back to their own start. It SERVES throughout (the lifetime hold),
      // and that is exactly the right signal here.
      return (this.hostTask !== undefined || this.shellTask !== undefined ||
        this.startTask !== undefined || this.startSceneServes) &&
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
    mandatoryAnnounceVisible(): boolean {
      // ONE premium surface for BOTH states: a fresh HELD decision (opens with
      // A) and a DEFERRED one (returns with A). Board-home + idle either way.
      return (this.mandatoryGateHeld || this.mandatoryDeferredActive) &&
        this.boardHomeIdle &&
        // …and nothing is still PLAYING: the beat stays held until the player
        // has "finished the animations", they just see their chip status.
        !isAnimationHoldActive() &&
        !this.presentationHeld &&
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
      return (this.mandatoryGateHeld || this.mandatoryDeferredActive) && !this.mandatoryAnnounceVisible;
    },
    /** The prompt card's copy (one consoleTaskSummary source, so nothing can
     *  diverge). The A-verb relabels by STATE: «Открыть» for a fresh held
     *  decision, «Вернуться к решению» for a deferred one. */
    mandatoryAnnounceView(): {kicker: string, ask: string, sourceCard: CardName | undefined, openLabel: string} {
      return {
        kicker: this.deferKicker,
        ask: this.deferAsk,
        sourceCard: this.deferSourceCard,
        openLabel: this.mandatoryGateHeld ? 'Open' : this.deferReturnLabel,
      };
    },
    shellTaskActive(): boolean {
      return this.shellTask !== undefined && !this.consoleState.task.deferred;
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
      if (model === undefined || this.shellTask?.kind !== 'colony') {
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
     * Mirrored out for the legacy `WaitingFor` (see setConsolePlacementHeld):
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
    /** P27: the right home panel's strategic Milestones/Awards summaries. */
    homeMilestoneSummary(): HomeMaSummary {
      return buildHomeMaSummary('milestones', this.game.milestones, {
        myColor: this.thisPlayer.color,
        availableNow: this.claimableTitles(findMilestoneOptionPath(this.playerView.waitingFor)?.options),
        maxSlots: 3,
      });
    },
    homeAwardSummary(): HomeMaSummary {
      return buildHomeMaSummary('awards', this.game.awards, {
        myColor: this.thisPlayer.color,
        availableNow: this.claimableTitles(findAwardOptionPath(this.playerView.waitingFor, this.awardNames)?.options),
        maxSlots: 3,
      });
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
        robot: robots.has(card.name),
      }));
      // Playable-first, stable within groups (CONSOLE_MODE_CONCEPT §8).
      return [
        ...entries.filter((e) => e.playable),
        ...entries.filter((e) => !e.playable),
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
     * THE HAND WORKSPACE'S OPEN DESCENT — what the section needs to know to
     * park its shelf, grow the breadcrumb and render the stage zone.
     *
     * It reads the live `workspaceStageState`, NOT `pendingPlayCard`, and the
     * difference matters: the play composer can also be opened WITHOUT a
     * descent (a `playFromHand` task raised over the board), and in that case
     * the workspace was never entered, so there is nothing to be inside of and
     * the composer keeps its own band.
     */
    handStage(): ConsoleHandStage | undefined {
      if (!workspaceStageOpen('hand')) {
        return undefined;
      }
      return {
        subject: workspaceStageState.subject,
        // Until the composer publishes its own step, the crumb shows the
        // honest generic — so it never blinks and never renames itself twice.
        name: workspaceStageState.stage === '' ? 'Playing' : workspaceStageState.stage,
        committed: isCommitted(workspaceStageState.phase),
      };
    },
    /**
     * The workspace slot the PLAY COMPOSER is teleported into (undefined → its
     * own band). Same shape as `taskEmbedTarget` / `revealEmbedTarget`.
     */
    playEmbedTarget(): string | undefined {
      if (this.pendingPlayCard === undefined) {
        return undefined;
      }
      return workspaceStageTarget('hand');
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
      return workspaceStageOpen('hand') && workspaceStageState.slot === '';
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
      return this.placementActive || this.awaitingInput ? 'Finish your current action first' : 'Not your turn to take any actions';
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
      // the banner names the server's ask over the serving section.
      if (this.shellTaskActive) {
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
    /** The colony the X = «Осмотреть» overlay shows. Two sources: the colonies
     *  SECTION (←/→ pages the rail, A can trade) and the JOURNAL (a fixed
     *  colony by name, read-only — only B closes). */
    colonyInspectModel(): ColonyModel | undefined {
      if (this.journalColonyInspect !== undefined) {
        return this.game.colonies.find((c) => c.name === this.journalColonyInspect);
      }
      if (!this.colonyInspectOpen || this.consoleState.section !== 'colonies') {
        return undefined;
      }
      return this.coloniesForRail[this.consoleState.colonyIndex];
    },
    /** The inspect overlay is up (either source). */
    colonyInspectActive(): boolean {
      return this.journalColonyInspect !== undefined ||
        (this.colonyInspectOpen && this.consoleState.section === 'colonies');
    },
    /** A journal-opened inspect is READ-ONLY (no trade bridge — only B closes). */
    colonyInspectReadonly(): boolean {
      return this.journalColonyInspect !== undefined;
    },
    /** A = trade from inspect is offered only for a live-tradeable colony
     *  opened from the section (never the read-only journal dossier). */
    colonyInspectTradeable(): boolean {
      const model = this.colonyInspectModel;
      return !this.colonyInspectReadonly && model !== undefined &&
        this.tradeableColonyNames.includes(model.name);
    },
    pendingTradeColonyModel(): ColonyModel | undefined {
      const pending = this.pendingTradeColony;
      if (pending === undefined) {
        return undefined;
      }
      return this.game.colonies.find((c) => c.name === pending.colonyName);
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
        this.shellTaskActive;
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
    conMainClasses(): Record<string, boolean> {
      const classes: Record<string, boolean> = {
        'con-main--journal': this.journalPanelVisible,
        'con-main--hand': this.consoleState.section === 'hand',
        'con-main--info': this.infoWorkspaceUp,
        // (No workspace entry here: every workspace surface carries the
        // `con-ws` marker and `.con-root:has(.con-ws)` lifts the rail /
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
          cardsPlayable: this.cardsPlayableCount,
          cardsTotal: this.cardsTotalCount,
          actionsAvailable: this.actionsAvailableCount,
          hasColonies: this.game.colonies.length > 0,
          hasTurmoil: this.game.gameOptions.expansions.turmoil === true,
          hasHydro: this.game.gameOptions.expansions.deltaProject === true,
        });
      }
      if (this.consoleState.quick === 'basics') {
        const wf = this.playerView.waitingFor;
        return buildLtQuickEntries({
          myTurn: this.myTurn,
          awaitingInput: this.awaitingInput,
          stdAvailable: this.standardProjectsAction !== undefined,
          endTurnAvailable: findEndTurnPath(wf) !== undefined,
          passAvailable: findPassPath(wf) !== undefined,
          convertPlantsAvailable: this.convertPlantsReady,
          convertHeatAvailable: this.convertHeatReady,
          plantsNeeded: this.thisPlayer.plantsNeededForGreenery,
          heatNeeded: this.thisPlayer.heatNeededForTemperature,
        });
      }
      return [];
    },
    quickTitle(): string {
      return this.consoleState.quick === 'actions' ? 'Actions' : 'Basic actions';
    },
    quickTrigger(): 'triggerR' | 'triggerL' {
      return this.consoleState.quick === 'actions' ? 'triggerR' : 'triggerL';
    },
    /** The premium Standard-Projects screen rows (Patent sale included). */
    stdProjectItems(): Array<StdProjectItem> {
      return buildStdProjectItems({
        cards: this.standardProjectsAction?.input.cards ?? [],
        myTurn: this.myTurn,
        awaitingInput: this.awaitingInput,
        myMegacredits: this.thisPlayer.megacredits,
        sellAvailable: findSellPatentsAction(this.playerView.waitingFor) !== undefined,
        cardsInHand: this.cardsTotalCount,
      });
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
      case 'hydroPick':
        // Name the pick honestly: a used blue action (pos 7) vs an animal
        // target card (pos 9) — the mirror comes from the hydro section.
        return consoleHydroUi.pickKind === 'animal-target' ?
          'Choose a card for the animals' : 'Choose a used blue card action';
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
        myTurn: this.myTurn,
        awaitingInput: this.awaitingInput,
        myMegacredits: this.thisPlayer.megacredits,
        availableNow: this.claimableTitles(found?.options),
        describe,
        maxSlots: 3,
        // Free sponsorship (Vitor) costs 0 — the wallet then reads «Бесплатно».
        nextCost: kind === 'milestones' ? 8 : (this.awardFundingActive ? 0 : this.awardCostValue),
        // Claimant label resolves the MarsBot seat to «Бот», never the raw name.
        resolveName: (color) => displayNameForColor(this.playerView.players, color),
      });
    },
    /** The NEXT award funding price as a number (8/14/20). */
    awardCostValue(): number {
      const funded = this.game.awards.filter((a) => a.playerName !== undefined && a.playerName !== '').length;
      return [8, 14, 20][funded] ?? 20;
    },
    /** The FREE award-funding prompt (Vitor's start action) is the pending
     *  shell task — the premium awards MA screen hosts it (desktop parity:
     *  the AwardsOverlay's free-sponsorship mode), never the generic list. */
    awardFundingActive(): boolean {
      return this.shellTask?.kind === 'awardFunding';
    },
    /** The LIVE item shown in the X → «Осмотреть» reader (recomputed from the
     *  dashboard, so its standings/availability stay fresh); undefined = the
     *  reader is closed or its item left the list. */
    maInspectItem(): ConsoleMaItem | undefined {
      return this.maInspect === undefined ? undefined :
        this.maScreenItems.find((it) => it.name === this.maInspect);
    },
    /** The premium MA confirm view — REBUILT from the live playerView on
     *  every commit, so a slot raced away while the modal is open honestly
     *  re-renders as blocked (never a dead submit). */
    maConfirmView(): MaConfirmView | undefined {
      const p = this.pendingMaConfirm;
      if (p === undefined) {
        return undefined;
      }
      const models = p.kind === 'milestone' ? this.game.milestones : this.game.awards;
      const source = models.find((m) => m.name === p.name);
      if (source === undefined) {
        return undefined;
      }
      const describe = (name: string): string => {
        try {
          return p.kind === 'milestone' ?
            getMilestone(name as MilestoneName).description :
            getAward(name as AwardName).description;
        } catch (err) {
          return '';
        }
      };
      const free = p.kind === 'award' && this.awardFundingActive;
      return buildMaConfirm(p.kind, source, models, {
        myColor: this.thisPlayer.color,
        myMegacredits: this.thisPlayer.megacredits,
        cost: p.kind === 'milestone' ? 8 : (free ? 0 : this.awardCostValue),
        free, // Vitor's free sponsorship — the premium confirm shows the free chip.
        maxSlots: 3,
        playerName: (c) => {
          const pl = this.playerView.players.find((candidate) => candidate.color === c);
          return pl !== undefined ? participantDisplayName(pl) : c;
        },
        describe,
      });
    },
    /** LIVE availability for the open MA confirm (waitingFor = the truth). */
    maConfirmAvailable(): boolean {
      const p = this.pendingMaConfirm;
      if (p === undefined) {
        return false;
      }
      const found = p.kind === 'milestone' ?
        findMilestoneOptionPath(this.playerView.waitingFor) :
        findAwardOptionPath(this.playerView.waitingFor, this.awardNames);
      return this.claimableTitles(found?.options).has(p.name);
    },
    /** The CONCRETE blocker when the open MA confirm went stale. */
    maConfirmBlockReason(): string {
      if (this.maConfirmAvailable) {
        return '';
      }
      const v = this.maConfirmView;
      if (v?.takenByOther !== undefined) {
        return v.kind === 'milestone' ? 'Already claimed' : 'Already funded';
      }
      if (!this.awaitingInput) {
        return 'Not your turn to take any actions';
      }
      if (v !== undefined && !v.free && this.thisPlayer.megacredits < v.cost) {
        return 'Not enough M€';
      }
      return 'Finish your current action first';
    },
    sheetRows(): Array<ConsoleSheetRow> {
      switch (this.consoleState.sheet) {
      case 'hydroPick':
        // P24: hydro stage 7/9 card pick — name + the card's own rule text
        // (manifest description) + the live resource count where relevant.
        return this.hydroPickCards.map((c) => ({
          key: c.name,
          title: c.name,
          sub: this.hydroPickDescription(c.name),
          meta: c.current !== undefined ? `${c.current}` : undefined,
          available: true,
        }));
      default:
        return [];
      }
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
      if (this.startSceneServes && !this.consoleState.task.deferred) {
        // The scene's own header already reads «СТАРТ ПАРТИИ» (kicker +
        // title) — repeating it in the bar is noise. The bar carries ONLY
        // the physical commands during the initial setup.
        return '';
      }
      if (this.govSupportActive && !this.consoleState.task.deferred && this.taskSpacePending === undefined) {
        return 'Government Support';
      }
      if (this.effectDecisionActive) {
        return this.effectDecisionVm?.eyebrowKey ?? 'Awaiting decision';
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
      if (this.pendingTradeColony !== undefined) {
        return 'Trade';
      }
      if (this.colonyInspectActive) {
        return 'Colony';
      }
      if (this.maInspectItem !== undefined) {
        return this.maInspectItem.name.replace(/[0-9]+$/, '');
      }
      if (this.pendingMaConfirm !== undefined) {
        return 'Confirmation';
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
      if (this.consoleState.sheet === 'cardActions' && consoleActionComposerUi.open) {
        // The ACTION FOCUS stage inside the Action Center: the bar names the
        // STAGE by its PHASE (the SAME source as the frame header — the bar
        // and the breadcrumb can never disagree), never the grid underneath.
        return focusKicker(consoleActionComposerUi.revealClaim !== '' ? 'reveal' : 'setup');
      }
      if (this.consoleState.sheet !== undefined) {
        return this.sheetTitle;
      }
      if (this.placementActive) {
        return 'Tile placement';
      }
      if (this.consoleState.sale.active) {
        return 'Sell patents';
      }
      switch (this.consoleState.section) {
      case 'hand': return 'Hand';
      case 'colonies': return 'Trading';
      case 'hydro': return consoleHydroUi.confirmOpen ? 'Confirmation' : 'Mars Hydronetwork';
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
      if (isTradeFleetActive() || isColonyTradeInputLocked() || isHydroMarkerActive() || isHydroDrawActive() || isBoardCardBonusActive() || isPatentSaleActive() || this.tilePlacementHolds || isDeckDrawActive()) {
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
      if (this.draftWaitActive) {
        // Nothing to decide — the board stays inspectable while others pick.
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
      if (this.startSceneServes && !this.consoleState.task.deferred) {
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
      if (this.pendingTradeColony !== undefined) {
        // The composer mirrors its live state (consoleColoniesUi) — the bar
        // is the ONLY hint surface (no inline duplicates).
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
        return [
          {control: 'confirm', label: 'Select', enabled: consoleColoniesUi.composerEditable},
          {control: 'secondary', label: 'Confirm trade', enabled: consoleColoniesUi.composerReady, highlight: consoleColoniesUi.composerReady},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.colonyInspectActive) {
        const cmds: Array<ConsoleCommand> = [];
        // Section source: ←/→ pages colonies + A trades a live-tradeable one.
        if (this.journalColonyInspect === undefined && this.colonyInspectTradeable) {
          cmds.push({control: 'confirm', label: 'Trade'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.maInspectItem !== undefined) {
        const cmds: Array<ConsoleCommand> = [];
        if (this.maInspectItem.available) {
          cmds.push({control: 'confirm', label: this.maInspectItem.kind === 'milestone' ? 'Claim' : 'Fund'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.pendingMaConfirm !== undefined) {
        return [
          {control: 'confirm', label: this.pendingMaConfirm.kind === 'milestone' ? 'Claim' : 'Fund', enabled: this.maConfirmAvailable},
          {control: 'back', label: 'Cancel'},
        ];
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
      if (this.consoleState.sheet === 'standardProjects') {
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
      if (this.consoleState.sheet === 'cardActions') {
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
        // P26: the hints mirror the REAL state — the verb is enabled only
        // when the focused item is actionable; bumpers switch the category.
        const focusedMa = this.maScreenItems[this.consoleState.sheetIndex];
        return [
          {control: 'confirm', label: this.maScreenKind === 'milestones' ? 'Claim' : 'Fund', enabled: focusedMa?.available === true},
          {control: 'secondary', label: 'Inspect'},
          {control: this.maScreenKind === 'milestones' ? 'bumperR' : 'bumperL',
            label: this.maScreenKind === 'milestones' ? 'Awards' : 'Milestones'},
          {control: 'back', label: this.awardFundingActive ? 'Minimize' : 'Close'},
        ];
      }
      if (this.consoleState.sheet !== undefined) {
        return [
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: this.consoleState.sheet === 'hydroPick' ? 'Back' : 'To the board'},
        ];
      }
      if (this.placementActive) {
        // P21: the placement footer is CONTEXT-ONLY and one-line by
        // contract — LT/RT keep working globally (Info / Actions) but
        // never occupy this bar; a NON-cancellable B is not an action, so
        // it is not a hint (the panel + the B-toast explain mandatory).
        const cmds: Array<{control: GlyphControl, label: string, enabled?: boolean}> = [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Place here', enabled: this.selectedCellLegal},
          // L3 — the SOURCE card fullscreen, the same verb it carries on every
          // other surface in the shell. It replaced «next available cell», a
          // jump that duplicated what the d-pad already does over a board whose
          // legal cells are highlighted.
          ...(this.placementSourceCard !== undefined ?
            [{control: 'stickL' as GlyphControl, label: 'Inspect the source'}] : []),
          {control: 'stickR', label: this.consoleState.freeRoam ? 'Available only' : 'All cells'},
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
      if (this.consoleState.section === 'hand') {
        const playable = this.handEntries[this.consoleState.handIndex]?.playable === true;
        const cmds: Array<ConsoleCommand> = [
          {control: 'confirm', label: 'Play now', enabled: playable},
          {control: 'secondary', label: 'Inspect'},
        ];
        // The tag filter owns LB/RB (+ R3 reset) — shown only when there's a
        // real tag to filter by (more options than just "All"). This is the
        // ONE place these controls are advertised (no inline duplication).
        // Rendered as a spread prev/next hint: LB ◀ ФИЛЬТР ▶ RB.
        if (this.handTagFilterOptions.length > 1) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Tag filter', spread: true});
          cmds.push({control: 'stickR', label: 'Reset filter', enabled: this.consoleState.handTagFilter !== 'all'});
        }
        cmds.push({control: 'back', label: this.shellTaskActive ? 'Minimize' : 'To the board'});
        return cmds;
      }
      if (this.consoleState.section === 'colonies') {
        // T4 pick mode: A = the server verb; B = cancel (marker) / minimize.
        const pick = this.colonyPick;
        if (pick !== undefined) {
          const selected = this.coloniesForRail[this.consoleState.colonyIndex];
          const pickable = selected !== undefined && pick.selectable.includes(selected.name);
          return [
            {control: 'confirm', label: pick.buttonLabel, enabled: pickable},
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: this.colonyCancellable ? 'Cancel' : 'Minimize'},
          ];
        }
        const selected = this.game.colonies[this.consoleState.colonyIndex];
        const tradeable = selected !== undefined && this.tradeableColonyNames.includes(selected.name);
        return [
          {control: 'confirm', label: 'Trade', enabled: tradeable},
          {control: 'secondary', label: 'Inspect'},
          {control: 'back', label: 'To the board'},
        ];
      }
      if (this.consoleState.section === 'hydro') {
        // The console-native Hydronetwork grammar (full rework). The bar is
        // honest: enabled flags come from the section's live-model mirrors.
        if (consoleHydroUi.confirmOpen) {
          // The bonus (pos 1/2) is CHOSEN in the confirm modal now — LB/RB
          // switch it, A confirms the highlighted one, B goes back. A held
          // stage 7/9 pick advertises X = «Изменить выбор» (re-open the pick).
          const confirmCmds: Array<ConsoleCommand> = [];
          if (consoleHydroUi.bonusChoice) {
            confirmCmds.push({control: 'bumperL', control2: 'bumperR', label: 'Switch bonus'});
          }
          if (consoleHydroUi.pickChosen) {
            confirmCmds.push({control: 'secondary', label: 'Change selection'});
          }
          confirmCmds.push(
            {control: 'confirm', label: 'Confirm'},
            {control: 'back', label: 'Back'},
          );
          return confirmCmds;
        }
        if (consoleHydroUi.helpOpen) {
          return [{control: 'back', label: 'Close'}];
        }
        // The bonus choice moved to the confirm modal — the plan bar no longer
        // carries an LB/RB «Bonus» control.
        const cmds: Array<ConsoleCommand> = [{control: 'dpadH', label: 'Stages', priority: 2}];
        cmds.push(
          // The SHORT key on purpose (the old «Farthest available» was the
          // one atom that reliably truncated in the bay bar).
          {control: 'triggerR', label: 'Farthest stage'},
          consoleHydroUi.mode === 'details' ?
            {control: 'confirm', label: 'Back to plan'} :
            {control: 'confirm', label: 'Reinforce', enabled: consoleHydroUi.primaryEnabled},
          {control: 'secondary', label: 'Details'},
          {control: 'back', label: 'To the board'},
        );
        return cmds;
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
        {control: 'triggerR', label: 'Actions', badge: this.cardsPlayableCount + this.actionsAvailableCount,
          highlight: this.myTurn && (this.cardsPlayableCount + this.actionsAvailableCount) > 0},
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
      return name !== undefined && cardHasRules(name);
    },
    /** The right SIDE panel shows for a card with structured rules OR whenever
     *  the viewer is an inspect DOSSIER (which always offers СТАТИСТИКА, even if a
     *  card had no rules). Gates the panel AND the viewer's width reservation. */
    zoomSideVisible(): boolean {
      return this.zoomHasRules || this.consoleCardZoom.inspect !== undefined;
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
      return startDeferredSummary(startAwaitingOthers(this.playerView));
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
    // TRADE-FLEET LAUNCH lifecycle: the composer stays mounted (dissolved via
    // `--launching`) through the whole flight; the trade overlay only fully
    // CLOSES once the ship has DOCKED (success) or the flight was recalled
    // (error/stall). Both land here as active → false.
    'tradeFleetState.active'(active: boolean) {
      if (!active && this.pendingTradeColony !== undefined) {
        this.pendingTradeColony = undefined;
      }
    },
    // TRADE-REWARD transaction: report the traded colony's COMMITTED track
    // position to the orchestrator. The server sequences its reset AFTER
    // every reward (including interactive colony bonuses that resolve over
    // several responses — Pluto's discards), so the reset can arrive via the
    // gated commit OR a later poll; this one watcher covers both, and the
    // reset glide runs only once the drop truly committed.
    armedColonyTradeTrack(value: number | undefined) {
      if (value !== undefined && colonyTradeState.colonyName !== '') {
        notifyColonyTradeTrackCommitted(colonyTradeState.colonyName as ColonyName, value);
      }
    },
    // MARKER ADVANCE lifecycle: the hydro screen STAYS OPEN through the whole
    // glide; when the marker has locked in + the view committed (active →
    // false), reset the plan so the (now-used) screen shows a clean state.
    // The screen is never auto-closed (advancing leaves you in hydro).
    'hydroMarkerState.active'(active: boolean) {
      if (!active && this.consoleState.section === 'hydro') {
        resetHydroPlan();
        // The committed advance consumed the stage-7 composition (if any).
        consoleHydroUi.repeatResult = undefined;
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
        this.consoleState.section = 'board';
        return;
      }
      if (phase === 'closing' && playedHeroState.host === 'workspace') {
        // One synchronous turn, one patch: clearing the pending play closes
        // the stage claim (its own watcher), and the section change takes the
        // whole workspace down through the section leave — the board is
        // already committed and current underneath.
        this.pendingPlayCard = undefined;
        closeConsoleLayers();
        this.consoleState.section = 'board';
        return;
      }
      if (phase === 'failed') {
        const composer = this.$refs.playConfirm as InstanceType<typeof ConsolePlayCardConfirm> | undefined;
        composer?.resetSubmitting?.();
        // A refused move never happened: the descent goes back to configurable,
        // or B would stay dead and the crumb would keep claiming a commit.
        rollbackWorkspaceStageCommit();
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
     * with zero trace and the WaitingFor alert explains.
     */
    'patentSaleState.phase'(phase: string) {
      if (phase === 'inserting') {
        closeConsoleLayers();
        this.consoleState.section = 'board';
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
    // Leaving the colonies section closes the X-inspect dossier (and clears
    // the composer's command-bar mirror so stale hints can't linger).
    'consoleState.section'(section: string) {
      if (section !== 'colonies' && this.colonyInspectOpen) {
        this.colonyInspectOpen = false;
        resetConsoleColoniesUi();
      }
      // Leaving the hand by ANY route ends the descent with it: the workspace
      // the player was standing inside of is no longer on screen, so a claim
      // that outlived it would park a shelf behind nothing and keep the
      // composer teleporting into a detached zone.
      if (section !== 'hand') {
        closeWorkspaceStage();
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
        } else if (section !== 'hand' && (handRevealState.phase === 'open' ||
            (handRevealState.phase === 'docked' && (handRevealState.holdSlots || handRevealState.dockExtraLift.length > 0)))) {
          // NOT 'opening'/'closing': those belong to a director episode in
          // its pre-install flush — resetting there would kill it mid-birth.
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
        this.consoleState.section = 'board';
      }
    },
    // Mirror the live gate-held state into the module so the leak detector (a
    // timer that can't recompute the shell signals) treats a held prompt as
    // legitimately served — the announcement / chip is its surface (B opens it).
    mandatoryGateHeld: {
      immediate: true,
      handler(held: boolean): void {
        setMandatoryGateHeld(held);
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
    // Mirror the PLACEMENT verdict into the module so the legacy WaitingFor —
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
      // prompt-identity change that moved the flow on. One place, so a claim
      // can never outlive its flow and leave the shelf parked behind nothing.
      if (now === undefined) {
        closeWorkspaceStage();
      }
    },
    // A successfully played card leaves the hand with the server response —
    // release its held slot the moment it is genuinely gone (never a fake
    // return; the safety timer below covers a rejected play).
    handEntriesAll(entries: ReadonlyArray<ConsoleHandEntry>) {
      const name = this.departingPlayCard;
      if (name !== undefined && !entries.some((e) => e.card.name === name)) {
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
        this.consoleState.section = 'board';
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
     * THE DISCARD HAND-OFF. The cinematic seizes the chosen cards out of the
     * still-open hand grid, and the moment it reaches `leaving` the pick
     * surface closes underneath the flying cards (the survivors gather home
     * into the dock, the condemned ones carry on to the pile). Driven by the
     * scene's own phase — never a timer, and never at submit time, or the
     * player would watch the hand disappear and the card silently cease to
     * exist, which is the whole bug this flow exists to fix.
     */
    'cardDiscardTransaction.phase'(phase: string, was: string | undefined): void {
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
     * CLIENT HAND PICK (composer → hand bridge): entering the pick remembers
     * the current section, opens the hand (with the premium dock→grid reveal
     * when coming from another section — the Action Center case) and seats the
     * cursor on the first PICKABLE card; leaving restores the section, so the
     * hidden composer (v-show) is back exactly where the player left it.
     */
    handPickActive(now: boolean): void {
      if (now) {
        this.handPickReturn = this.consoleState.section;
        const selectable = new Set(this.handSelectSelectableNames);
        const idx = this.handEntries.findIndex((e) => selectable.has(e.card.name));
        this.consoleState.handIndex = idx !== -1 ? idx : 0;
        if (this.consoleState.section !== 'hand') {
          void this.openHandWithReveal();
        } else {
          void this.$nextTick(() => {
            (this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined)?.ensureSelectedVisible();
          });
        }
        return;
      }
      const back = this.handPickReturn;
      this.handPickReturn = undefined;
      // A DISCARD answer keeps the hand open: its cinematic has to seize the
      // card out of the real grid first and hands the surface off itself
      // (phase 'leaving'). Restoring the section here would blank the hand a
      // beat before the card had visibly left it — the exact bug the unified
      // discard flow exists to remove.
      if (isCardDiscardActive()) {
        return;
      }
      // The play-composer pick stays in the hand (the composer re-shows over
      // it); the Action-Center pick returns to its origin section instantly —
      // the re-shown full-screen center covers the switch.
      if (back !== undefined && back !== 'hand' && this.consoleState.section === 'hand') {
        this.consoleState.section = back;
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
    /** Publish the answer the moment it exists — the beat flips its card on it. */
    workspaceOutcomeAnswerArrived(arrived: boolean) {
      if (arrived) {
        markWorkspaceOutcomeAnswerIn();
      }
    },
    workspaceOutcomeEmbedded(embedded: boolean, was: boolean) {
      if (embedded) {
        markWorkspaceOutcomePresenting();
        return;
      }
      if (!was) {
        return;
      }
      void this.$nextTick(() => {
        // COLLAPSED is not FINISHED. Deferring the prompt unmounts its host, so
        // the embed goes false — but the decision is still outstanding and the
        // player is coming back to it. Releasing here would drop the claim,
        // fold the workspace, and hand the prompt back to a standalone band the
        // moment it was restored: the collapse would silently become a close.
        if (this.workspaceCollapsed) {
          return;
        }
        if (!this.workspaceOutcomeEmbedded && workspaceOutcomeState.stage === 'presenting') {
          releaseWorkspaceOutcome();
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
              workspaceOutcomeState.sourceCard !== '';
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
        // Colony-trade transaction: observe EVERY commit path. The staged
        // bot pipeline (a trade that ends the turn carries the bot's turns)
        // and a poll after a lost response bypass WaitingFor's gated detect;
        // this fallback claims the manifest there and kicks the reward waves
        // exactly once after whichever commit carried it (idempotent).
        noticeColonyTradeCommit(newView);
        // Government Support scale-focus gate: if the last action was a WGT
        // parameter raise, HOLD the next modal for a beat so the board scale
        // glide (+ top-HUD delta chip) is seen in one focused place. Snap to
        // the board so that feedback is actually visible during the hold.
        if (commitGovScaleFocus()) {
          this.consoleState.section = 'board';
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
        // The trade window closed externally → drop the stale payment modal.
        if (this.pendingTradeColony !== undefined && this.tradeColonyContext === undefined) {
          this.pendingTradeColony = undefined;
        }
        // A resolved convert-plants prompt (server moved on) drops the local picker.
        if (this.convertPlantsPending !== undefined &&
            findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true) === undefined) {
          this.convertPlantsPending = undefined;
        }
        // The sell-patents window closed externally → drop the stale sale mode.
        if (this.consoleState.sale.active && findSellPatentsAction(this.playerView.waitingFor) === undefined) {
          this.consoleState.sale.active = false;
          this.consoleState.sale.selected = [];
        }
        // T6: the server cleared the reveal result → the ack marker is stale.
        if (this.playerView.lastReveal === undefined && this.dismissedRevealKey !== '') {
          this.dismissedRevealKey = '';
        }
        // CTS: a NEW prompt identity resets the defer + stale nested picks.
        const key = promptIdentityKey(this.playerView.waitingFor);
        if (key !== this.lastTaskKey) {
          this.lastTaskKey = key;
          this.consoleState.task.deferred = false;
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
          if (this.consoleState.sheet === 'cardActions' &&
              taskFor(this.playerView)?.kind !== 'actionMenu' &&
              !workspaceOutcomeClaimed()) {
            this.consoleState.sheet = undefined;
            this.consoleState.sheetIndex = 0;
          }
          // A shell-section task (T3/T4) auto-opens its serving surface.
          const shellTask = this.shellTask;
          if (shellTask !== undefined) {
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
      fetchBoardCellPreview(spaceId, prompt.placementType, cleared, prompt.tileType, prompt.sourceCard).then((preview) => {
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
      if (isTradeFleetActive() || isHydroMarkerActive() || isHydroDrawActive() || isBoardCardBonusActive() || isPatentSaleActive() || tilePlacementHolding()) {
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
        if (action === 'back') {
          cancelNotifHold();
          dismissNotification(topCard.id);
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
        this.scrollActiveConsole(intent.dy);
        return true;
      }
      // The premium MA reader (X → «Осмотреть») owns the pad while open: it
      // sits above the dashboard, so no background command leaks. A sponsors /
      // claims when the item is available (hands off to the confirm), B or X
      // close back to the dashboard; the right stick scrolls the long text.
      if (this.maInspectItem !== undefined) {
        if (intent.kind === 'press') {
          if (action === 'back' || action === 'inspect') {
            this.closeMaInspect();
          } else if (action === 'primary') {
            this.confirmMaInspect();
          }
        }
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
      if (this.draftWaitActive && action === 'inspect' && this.draftedCards.length > 0) {
        // Opened from the count chip (no card tiles on screen) → TEXTUAL.
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
      if (this.startSceneServes && !this.consoleState.task.deferred) {
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
      // T8: the native colony-trade composer owns input while open.
      if (this.pendingTradeColony !== undefined) {
        const confirm = this.$refs.tradeConfirm as InstanceType<typeof ConsoleColonyTradeConfirm> | undefined;
        confirm?.handleIntent(intent);
        return true;
      }
      // X = «Осмотреть»: the colony dossier owns the pad while open.
      if (this.colonyInspectOpen) {
        this.handleColonyInspectIntent(intent);
        return true;
      }
      // The premium Milestones/Awards confirm owns input while open (A =
      // confirm, B = cancel — no background command leakage). A vanished
      // model (game switched in-session) drops the pending confirm cleanly.
      if (this.pendingMaConfirm !== undefined) {
        if (this.maConfirmView === undefined) {
          this.pendingMaConfirm = undefined;
        } else {
          const confirm = this.$refs.maConfirm as InstanceType<typeof ConsoleMaConfirm> | undefined;
          confirm?.handleIntent(intent);
          return true;
        }
      }
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
      // The console-native card-action center owns the pad while it serves.
      if (this.consoleState.sheet === 'cardActions') {
        const panel = this.$refs.cardActions as InstanceType<typeof ConsoleCardActions> | undefined;
        panel?.handleIntent(intent);
        return true;
      }
      if (this.consoleState.sheet !== undefined) {
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
          this.consoleState.section = 'board';
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
    async openHandWithReveal(): Promise<void> {
      if (isHandRevealEpisodeRunning()) {
        if (handRevealState.phase === 'closing') {
          reverseHandReveal(); // reopen mid-close: same timeline, back to open
        }
        return;
      }
      if (this.consoleState.section === 'hand') {
        return;
      }
      this.deferShellTask(); // navigation-away (the RT path's contract)
      // Phase BEFORE the section flip: the section watcher must see a
      // director-owned transition, not an untracked open (which would lift
      // the dock instantly and skip the choreography).
      handRevealState.phase = 'opening';
      handRevealState.holdSlots = true;
      this.consoleState.section = 'hand';
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
      await runHandCloseEpisode(pairs, t.scrollTop);
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
      await this.closeHandWithReveal(discarded);
      // The episode already put the shell on the board; clear what the pick
      // left behind so the next surface starts from a clean state.
      closeConsoleLayers();
      this.consoleState.select.selected = [];
      this.consoleState.select.suitableOnly = true;
      this.consoleState.section = 'board';
      this.discardFreeze = undefined;
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
        this.openSheet('cardActions');
        break;
      case 'trading':
        this.deferShellTask();
        this.consoleState.section = 'colonies';
        this.consoleState.colonyIndex = stepIndex(this.consoleState.colonyIndex, 0, this.coloniesForRail.length);
        break;
      case 'hydro':
        this.deferShellTask();
        resetHydroPlan();
        consoleHydroUi.repeatResult = undefined; // a fresh visit plans from scratch
        this.consoleState.section = 'hydro';
        break;
      default:
        break;
      }
    },
    /** LT — basic actions (turn-ending SUBMITS are guarded during placement). */
    executeLtEntry(id: string): void {
      const wf = this.playerView.waitingFor;
      const guardPlacement = (): boolean => {
        if (this.placementActive) {
          this.showNotice('Finish your current action first');
          return true;
        }
        return false;
      };
      switch (id) {
      case 'standardProjects':
        // Opening is inspection-safe; item ACTIVATION is guarded in
        // activateStdItem (mirrors the sheet-row placement guard).
        this.openSheet('standardProjects');
        break;
      case 'skipTurn': {
        if (guardPlacement()) {
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
        if (guardPlacement()) {
          return;
        }
        // Pass ALWAYS confirms (warnings carried over from the desktop).
        this.consoleState.confirm = 'pass';
        break;
      case 'convertHeat': {
        if (guardPlacement()) {
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
        if (guardPlacement()) {
          return;
        }
        const found = findConvertPlantsOption(wf, this.thisPlayer.canConvertPlants === true);
        if (found === undefined) {
          return;
        }
        this.convertPlantsPending = found;
        closeConsoleLayers();
        this.consoleState.section = 'board';
        break;
      }
      default:
        break;
      }
    },
    handleSheetIntent(intent: GamepadIntent): void {
      // P27: the Standard-Projects premium screen — 2-column GRID nav,
      // A = use / sell, B = close (MANDATORY prompt → defer to the chip).
      if (this.consoleState.sheet === 'standardProjects') {
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
            this.deferShellTask();
            this.consoleState.sheet = undefined;
            this.consoleState.section = 'board';
          }
        }
        return;
      }
      // P26: the milestones/awards premium screen — 2-column GRID nav
      // (every card focusable), A = claim/fund, LB/RB = category switch.
      if (this.maScreenKind !== undefined) {
        if (intent.kind === 'nav') {
          this.consoleState.sheetIndex = stepGrid(
            this.consoleState.sheetIndex, intent.dir, this.maScreenItems.length, 2);
          return;
        }
        if (intent.kind === 'press') {
          switch (consoleActionOf(intent)) {
          case 'primary':
            this.activateMaItem(this.maScreenItems[this.consoleState.sheetIndex]);
            break;
          case 'inspect':
            // X → «Осмотреть»: open the full-text reader for the focused item.
            this.openMaInspect(this.maScreenItems[this.consoleState.sheetIndex]);
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
            // player is merely viewing the M/A dashboard.
            this.deferShellTask();
            this.consoleState.sheet = undefined;
            this.consoleState.section = 'board';
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
          // B: back to the board. The hydro card pick returns to the HYDRO
          // screen (its plan is still being composed there), never to the board.
          const stayInSection = this.consoleState.sheet === 'hydroPick';
          this.consoleState.sheet = undefined;
          if (!stayInSection) {
            this.consoleState.section = 'board';
          }
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
        // In the browse hand LB cycles the tag filter to the PREVIOUS tag.
        if (onBoard) {
          this.openSheet('milestones');
        } else if (this.consoleState.section === 'hand' && !this.consoleState.sale.active && !this.handSelectUiActive) {
          this.cycleHandFilter(-1);
        }
        return true;
      case 'nextSection':
        // In the browse hand RB cycles the tag filter to the NEXT tag.
        if (onBoard) {
          this.openSheet('awards');
        } else if (this.consoleState.section === 'hand' && !this.consoleState.sale.active && !this.handSelectUiActive) {
          this.cycleHandFilter(1);
        }
        return true;
      case 'reset':
        this.toggleJournal();
        return true;
      case 'nextTab':
        // P27: RT = the action-category QUICK SELECTOR from the board home
        // (P20: including during placement — inspection is always allowed). In
        // the hand: sale mode CONFIRMS the sale; the tag filter moved to LB/RB.
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
          }
        }
        return true;
      case 'prevTab':
        // P27: LT = the basic-actions QUICK SELECTOR (board home only). In the
        // hand: SELECT mode toggles the "suitable only" filter; the tag filter
        // moved to LB/RB.
        if (onBoard) {
          this.openQuick('basics');
        } else if (this.consoleState.section === 'hand' && this.handSelectUiActive) {
          this.toggleSuitableOnly();
        }
        return true;
      case 'primary':
        this.handleSectionConfirm();
        return true;
      case 'inspect':
        // P13 global rule: X reads the focused object fullscreen — in the
        // colonies section X = «Осмотреть» (the full colony dossier); on the
        // BOARD HOME (the main field context only — never mid-placement,
        // never inside an inspection mode) X opens the «Разыграно» tableau.
        if (this.consoleState.section === 'hand') {
          this.zoomHandCard();
        } else if (this.consoleState.section === 'colonies') {
          this.toggleColonyInspect();
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
        // T4: a server SelectColony pick outranks the trade flow.
        const pick = this.colonyPick;
        if (pick !== undefined) {
          // A colony-build hero is already playing — never re-submit.
          if (isColonyBuildActive()) {
            return;
          }
          const selected = this.coloniesForRail[this.consoleState.colonyIndex];
          if (selected === undefined) {
            return;
          }
          if (!pick.selectable.includes(selected.name)) {
            const reason = pick.reasons[selected.name];
            this.showNotice(reason !== undefined && reason !== '' ? reason : 'Unavailable right now');
            return;
          }
          closeConsoleLayers();
          this.consoleState.task.deferred = false;
          // BUILD: arm the premium colony-build hero and STAY on the colonies
          // screen — the cube drop + one-time bonus lift plays where it
          // happens. A board follow-up (an ocean/hazard build bonus) self-heals
          // via the `placementActive` watcher, which flips to the board on the
          // next `space` prompt. (Mirrors the trade-fleet arm-then-submit.)
          if (pick.buttonLabel === 'Build') {
            const slotIndex = Math.min(2, selected.colonies.length);
            armColonyBuild(selected.name, slotIndex, this.thisPlayer.color);
            this.submit(colonyResponse(selected.name));
            return;
          }
          this.submit(colonyResponse(selected.name));
          // The other SelectColony picks (Aridor's extra tile, setup remove …)
          // are ONE-SHOT: leave the colonies screen so the player isn't stranded
          // wondering whether another colony choice is expected — the server's
          // next prompt (or the turn) drives what surfaces next.
          this.consoleState.section = 'board';
          return;
        }
        if (this.placementActive) {
          this.showNotice('Finish your current action first');
          return;
        }
        this.tryOpenColonyTrade();
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
      // P20: inspection is free; STARTING a play mid-placement is not.
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
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
        this.consoleState.sale.active = false;
        this.consoleState.sale.selected = [];
        this.consoleState.section = 'board';
        return;
      }
      // B on a shell-task surface: CANCEL when the server marker allows
      // (pay-on-commit Build Colony), else DEFER to inspect the board.
      if (this.shellTaskActive) {
        if (this.shellTask?.kind === 'colony' && this.colonyCancellable) {
          this.submit(cancelResponse());
          return;
        }
        this.deferShellTask();
        this.consoleState.section = 'board';
        return;
      }
      if (this.consoleState.section === 'hand') {
        // The physical gather back into the dock (plain browse close — the
        // sale / shell-task paths returned above with their own handling).
        void this.closeHandWithReveal();
        return;
      }
      if (this.consoleState.section === 'colonies' || this.consoleState.section === 'hydro') {
        this.consoleState.section = 'board';
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
      if ((this.hostTask !== undefined || this.shellTask !== undefined || this.startTask !== undefined) && this.consoleState.task.deferred) {
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
      this.consoleState.sheet = undefined;
      if (id === 'actions') {
        // PRE-WARM the Action Center's preview cache the moment the RT wheel
        // opens: by the time the player commits «Действия карт» the per-card
        // previews are complete, so the grid renders its final geometry and
        // sort on the FIRST frame (no trickle-in reflow). Idempotent + SWR.
        ensureActionPreviews(this.playerView);
      }
    },
    openSheet(sheet: ConsoleSheetId): void {
      // A sheet switch / (re)open closes a stale full-text reader.
      this.maInspect = undefined;
      // Opening anything that is NOT the task's own surface defers the task;
      // opening the task's OWN surface un-defers it (back on the surface).
      const isTaskSurface = (sheet === 'standardProjects' &&
        this.shellTask?.kind === 'projectCard' && this.shellTask.mode === 'standardProject') ||
        (sheet === 'awards' && this.shellTask?.kind === 'awardFunding');
      if (!isTaskSurface) {
        this.deferShellTask();
      } else {
        this.consoleState.task.deferred = false;
      }
      this.consoleState.quick = undefined;
      this.consoleState.sheet = sheet;
      void this.$nextTick(() => {
        // P26/P27: the MA + Std-Projects screens focus the first ACTIONABLE
        // card, else the top row.
        const selectables = this.maScreenKind !== undefined ?
          this.maScreenItems.map((it) => ({header: false, available: it.available})) :
          this.consoleState.sheet === 'standardProjects' ?
            this.stdProjectItems.map((it) => ({header: false, available: it.available})) :
            this.sheetRows.map((r) => ({header: r.kind === 'header', available: r.available}));
        const firstAvailable = selectables.findIndex((s) => !s.header && s.available);
        const firstSelectable = selectables.findIndex((s) => !s.header);
        this.consoleState.sheetIndex = firstAvailable !== -1 ? firstAvailable : Math.max(0, firstSelectable);
      });
    },
    /** P26: A on the premium MA screen — a non-available press answers with
     *  the CONCRETE reason (owner / turn / money / slots / threshold), never
     *  a mute no-op. An AVAILABLE press opens the premium CONFIRMATION —
     *  claiming/funding is a strategic commitment, never a bare A. */
    activateMaItem(item: ConsoleMaItem | undefined): void {
      if (item === undefined || this.maScreenKind === undefined) {
        return;
      }
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
        return;
      }
      if (!item.available) {
        this.showNotice(consoleMaPressNotice(item));
        return;
      }
      this.pendingMaConfirm = {kind: item.kind, name: item.name};
    },
    /** X → «Осмотреть»: open the premium full-text reader for a dashboard
     *  item (works for taken / blocked items too — it is read-only). */
    openMaInspect(item: ConsoleMaItem | undefined): void {
      if (item === undefined) {
        return;
      }
      this.maInspect = item.name;
    },
    /** B / X in the reader → back to the dashboard (nothing submitted). */
    closeMaInspect(): void {
      this.maInspect = undefined;
    },
    /** A in the reader → sponsor / claim when available: close the reader and
     *  hand off to the existing premium confirm (never submits directly). */
    confirmMaInspect(): void {
      const item = this.maInspectItem;
      this.maInspect = undefined;
      if (item !== undefined && item.available) {
        this.activateMaItem(item);
      }
    },
    /** The MA confirm's A — re-resolves the LIVE option path (the prompt may
     *  have moved while the modal was open) and submits the byte-identical
     *  nested OR response; the ceremony is armed as a CANDIDATE and fires
     *  only when the fresh view proves the claim/fund resolved. */
    submitMaConfirm(): void {
      const pending = this.pendingMaConfirm;
      const view = this.maConfirmView;
      this.pendingMaConfirm = undefined;
      if (pending === undefined) {
        return;
      }
      const found = pending.kind === 'milestone' ?
        findMilestoneOptionPath(this.playerView.waitingFor) :
        findAwardOptionPath(this.playerView.waitingFor, this.awardNames);
      if (found === undefined) {
        this.showNotice('Unavailable right now');
        return;
      }
      const sent = this.submitInnerOption(found, pending.name);
      if (sent) {
        armMaCeremony({
          kind: pending.kind,
          name: pending.name,
          cost: view?.cost ?? 0,
          free: view?.free ?? false,
        });
      }
    },
    activateSheetRow(row: ConsoleSheetRow | undefined): void {
      if (row === undefined || row.kind === 'header') {
        return;
      }
      // P20: the overlays stay OPEN for inspection during a placement, but
      // STARTING another action would desync the pending SelectSpace.
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
        return;
      }
      if (!row.available) {
        this.showNotice(row.reason !== undefined && row.reason !== '' ? row.reason : 'Unavailable right now');
        return;
      }
      switch (this.consoleState.sheet) {
      case 'hydroPick':
        // A pure PLAN write (never a submit) — the hydro confirm reads it.
        hydroNetworkState.selectedCard = row.key as CardName;
        this.consoleState.sheet = undefined;
        // Smart continuation: the pick was the LAST pending to-do, so the
        // primary flow resumes — the confirmation modal opens with the
        // complete plan (nothing is submitted until its A).
        void this.$nextTick(() => {
          const hydro = this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined;
          hydro?.onPrimary();
        });
        break;
      }
    },
    /** A on the Standard-Projects premium screen (P27) — use / sell. */
    activateStdItem(item: StdProjectItem | undefined): void {
      if (item === undefined) {
        return;
      }
      if (this.placementActive) {
        this.showNotice('Finish your current action first');
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
        // Patent sale — the hand carousel's SALE mode (A toggles, Y sells).
        this.consoleState.sheet = undefined;
        this.consoleState.sale.active = true;
        this.consoleState.sale.selected = [];
        this.consoleState.section = 'hand';
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
     * B past the COMMIT BOUNDARY — collapse, not back. The workspace hides so
     * the board can be read; the committed decision keeps living inside it.
     *
     * It rides the existing deferred-prompt flag, which already gives the
     * board home its restore card, so «свернуть» stays ONE concept in the
     * console. The claim is deliberately untouched: it is what keeps the
     * prompt routed here, so on restore the player lands straight back on the
     * live stage — same revealed card, same picks, no replayed cinematic and
     * no second trip to the server.
     */
    onCardActionsCollapse(): void {
      // A REAL minimize, identical to every other deferred surface: the sheet
      // is CLOSED, not hidden. Hiding it (v-show) left `sheet === 'cardActions'`
      // set, and that one fact is what `mandatoryAnnounceVisible` keys off —
      // so the «вернуться» card never appeared and input still routed into the
      // invisible workspace. From the player's side the game was simply locked.
      //
      // Leaving the surface destroys the component, which is exactly why the
      // committed decision model lives in `workspaceOutcomeState` instead: the
      // claim keeps the prompt routed here and carries what the stage needs to
      // be rebuilt, so the player can go read their hand, open the wheel, look
      // at the milestones — and come back to the same decision.
      this.consoleState.task.deferred = true;
      this.consoleState.sheet = undefined;
      this.consoleState.sheetIndex = 0;
      this.consoleState.section = 'board';
      // The composer's command contract is published to a SHARED store and
      // released in its own `beforeUnmount`. That is one flush too late: for
      // the frame between the sheet closing and the unmount running, the bar
      // still advertised «НАСТРОЙКА ДЕЙСТВИЯ · БЕРЁМ КАРТЫ ИЗ КОЛОДЫ…» over a
      // bare board — a surface that no longer exists telling the player what
      // A does. Clearing it HERE makes the collapse atomic.
      resetConsoleActionComposerUi();
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
      if (this.consoleState.section === 'hand') {
        openWorkspaceStage('hand', cardName, 'Playing');
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
    onPlayCardConfirmNative(payload: {branchIndex: number, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, payment: Payment, rewards?: ReadonlyArray<ResourceTransferSpec>, repeat?: ConsoleRepeatPickResult}): void {
      const action = this.playAction;
      const pending = this.pendingPlayCard;
      if (pending === undefined || action === undefined) {
        this.pendingPlayCard = undefined;
        return;
      }
      // The HERO transaction (spec: no visual success before the server's
      // word). The composer STAYS OPEN through the submit; nothing lifts,
      // nothing closes. On the confirmed response the WaitingFor gate runs
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
      // (SearchForLife / AsteroidDeflection) then shows its outcome via the
      // STANDALONE reveal overlay AFTER the hero (gated on !playedHeroHolds
      // below) and acks back to the BOARD. So the order is always: the card is
      // seen played, THEN the action result applies.
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
        host: workspaceStageOpen('hand') && !this.playedOpen ? 'workspace' : 'overlay',
      });
      // The descent crosses its commit boundary HERE: the crumb's stage marker
      // goes amber (a committed step is a statement, not an invitation) and the
      // depth model stops offering «back» for a move the server already has.
      markWorkspaceStageCommitted();
      this.submitBatch(batch);
    },
    /**
     * P24: the hydro stage 7/9 pick. Stage 7 (reuse-a-blue-action) routes to
     * the ДЕЙСТВИЯ КАРТ surface in REPEAT mode — the SAME premium browser +
     * composer Viron / Проверка проекта use (full dossier, filters, honest
     * reasons, pre-selects composed in place); stage 9 (animal target) keeps
     * the console card sheet. Both write hydroNetworkState.selectedCard (the
     * same field the desktop pick-mode bridges write), so the confirm payload
     * stays byte-identical; the stage-7 composition additionally rides the
     * console-only `consoleHydroUi.repeatResult`.
     */
    openHydroPick(): void {
      if (consoleHydroUi.pickKind === 'reuse-action') {
        this.openHydroRepeatPick();
        return;
      }
      this.openHydroPickSheet();
    },
    openHydroRepeatPick(): void {
      const hydro = this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined;
      const candidates = (hydro?.eligibleCards ?? []).map((c) => c.name);
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
        // console layer keeps the composition; the smart primary then resumes —
        // the confirmation modal opens over the completed plan.
        hydroNetworkState.selectedCard = result.chosenCard;
        consoleHydroUi.repeatResult = result;
        void this.$nextTick(() => {
          (this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined)?.onPrimary();
        });
      });
    },
    openHydroPickSheet(): void {
      const hydro = this.$refs.hydroSection as InstanceType<typeof ConsoleHydroSection> | undefined;
      const cards = hydro?.eligibleCards ?? [];
      if (cards.length === 0) {
        this.showNotice('Unavailable right now');
        return;
      }
      this.hydroPickCards = cards.map((c) => ({name: c.name, current: c.current}));
      this.consoleState.sheet = 'hydroPick';
      this.consoleState.sheetIndex = 0;
    },
    useStandardProject(cardName: CardName): void {
      const action = this.standardProjectsAction;
      const card = action?.input.cards.find((c) => c.name === cardName);
      if (action === undefined || card === undefined || card.isDisabled === true) {
        return;
      }
      const cost = card.calculatedCost ?? 0;
      if (hasUsableStandardProjectAlternativeResources(this.thisPlayer, card, action.input.paymentOptions ?? {})) {
        // T3: the alt-resource payment is hosted NATIVELY by the task host
        // (promptOverride) — B cancels back to the sheet, nothing committed.
        const title = standardProjectPaymentTitle(cardName);
        this.pendingClientPayment = {
          cardName,
          input: buildStandardProjectPaymentModel(this.playerView, action.input, card, title, cost),
        };
        closeConsoleLayers();
        return;
      }
      closeConsoleLayers();
      this.submitStandardProjectPayment(cardName, Payment.of({megacredits: cost}));
    },
    submitStandardProjectPayment(cardName: CardName, payment: Payment): void {
      const action = this.standardProjectsAction;
      if (action === undefined) {
        return;
      }
      this.submit(wrapPath(action.path, {type: 'projectCard' as const, card: cardName, payment}));
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
    // ── colonies trade (mirrors the desktop contract byte-for-byte) ─────
    /** X = «Осмотреть» from the colonies SECTION — toggle the dossier (A can
     *  then trade). */
    toggleColonyInspect(): void {
      if (this.colonyInspectOpen) {
        this.colonyInspectOpen = false;
        consoleColoniesUi.inspectOpen = false;
        return;
      }
      if (this.coloniesForRail.length === 0) {
        return;
      }
      this.colonyInspectOpen = true;
      consoleColoniesUi.inspectOpen = true;
    },
    /** X on a JOURNAL colony row — open the READ-ONLY dossier over the journal. */
    openJournalColonyInspect(name: ColonyName): void {
      this.colonyInspectOpen = false;
      this.journalColonyInspect = name;
      consoleColoniesUi.inspectOpen = true;
    },
    /** Close whichever inspect source is open (section or journal). */
    closeColonyInspect(): void {
      this.colonyInspectOpen = false;
      this.journalColonyInspect = undefined;
      consoleColoniesUi.inspectOpen = false;
    },
    /** The inspect overlay owns the pad: ←/→ page colonies (section source
     *  only), ↑/↓ scroll, A trades a live-tradeable colony (section), B/X close. */
    handleColonyInspectIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        // ←/→ pages the rail ONLY for the section source (a journal dossier is
        // pinned to its one colony).
        if ((intent.dir === 'left' || intent.dir === 'right') && this.journalColonyInspect === undefined) {
          this.consoleState.colonyIndex = stepIndex(
            this.consoleState.colonyIndex, intent.dir === 'right' ? 1 : -1, this.coloniesForRail.length);
          return;
        }
        if (intent.dir === 'up' || intent.dir === 'down') {
          const scroller = document.querySelector<HTMLElement>('.con-colinspect .con-colinspect__main');
          scroller?.scrollBy({top: intent.dir === 'down' ? 140 : -140, behavior: 'smooth'});
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      // A = trade this colony (section source, live-tradeable only) — close the
      // dossier and open the composer. Read-only journal dossier: A does nothing.
      const a = consoleActionOf(intent);
      if (a === 'primary' && this.colonyInspectTradeable) {
        this.closeColonyInspect();
        this.tryOpenColonyTrade();
        return;
      }
      if (a === 'back' || a === 'inspect') {
        this.closeColonyInspect();
      }
    },
    tryOpenColonyTrade(): void {
      const ctx = this.tradeColonyContext;
      const selected = this.game.colonies[this.consoleState.colonyIndex];
      if (selected === undefined) {
        return;
      }
      if (ctx === undefined || !ctx.colonies.includes(selected.name)) {
        this.showNotice(this.colonyTradeBlockReason);
        return;
      }
      // ALWAYS confirm through the premium trade composer — never instant.
      const pending = {
        colonyName: selected.name,
        paymentOptions: ctx.paymentOptions,
        disabledPayments: ctx.disabledPayments,
      };
      this.pendingTradeColony = pending;
      // The shared server preview (track advance / card targets / M€ prompt)
      // loads in the background; the composer degrades gracefully meanwhile.
      void fetchColonyTradePreview(this.playerView.id, selected.name).then((preview) => {
        if (this.pendingTradeColony === pending && preview !== undefined && preview.colonyName === pending.colonyName) {
          this.pendingTradeColony = {...pending, preview};
        }
      });
    },
    /**
     * The composer's ONE confirm: the trade and-response + every pre-collected
     * follow-up (M€ payment mix / track choice / card targets) as a single
     * PlayerInputBatch — byte-identical to answering the live prompts one at a
     * time (a diverged later step gracefully arrives as a live prompt).
     */
    onColonyTradeComposerConfirm(payload: {paymentIndex: number, steps: ReadonlyArray<TradeStep>, captures: Readonly<Record<number, unknown>>}): void {
      const pending = this.pendingTradeColony;
      const ctx = this.tradeColonyContext;
      // Guard a double-confirm: once the launch is armed the flight (and then
      // the whole reward transaction) owns the moment, so a second press can
      // never re-submit — even after the ship has already docked.
      if (pending === undefined || ctx === undefined || isTradeFleetActive() || colonyTradeState.active) {
        return;
      }
      const batch = buildTradeBatch({
        tradePath: ctx.path,
        paymentIndex: payload.paymentIndex,
        colonyName: pending.colonyName,
        steps: payload.steps,
        captures: payload.captures,
      });
      // The composer's pre-collected card-resource DESTINATIONS (Titan /
      // Enceladus / Miranda picks) ride into the reward transaction so each
      // chip can fly onto the exact chosen host card.
      const targets: ColonyTradeTargets = {};
      const bonusPicks: Array<CardName> = [];
      payload.steps.forEach((step, i) => {
        const capture = payload.captures[i];
        if (step.kind !== 'cardTarget' || capture === undefined) {
          return;
        }
        if (step.role === 'tradeReward') {
          targets.incomeTargetCard = capture as CardName;
        } else {
          bonusPicks.push(capture as CardName);
        }
      });
      if (bonusPicks.length > 0) {
        targets.bonusTargetCards = bonusPicks;
      }
      // PREMIUM LAUNCH: ARM the trade-fleet flight (client-side) FIRST — the
      // composer dissolves + the ship lifts off toward the colony immediately,
      // independent of the server — THEN submit. The `pendingTradeColony`
      // overlay is deliberately KEPT (dissolved via `--launching`, not closed)
      // until the ship DOCKS; the WaitingFor `holdingForTradeFleet` gate
      // blocks the view commit (delta chips / next prompt / docked board
      // state) until then. A watcher on `tradeFleetState.active` closes the
      // composer once the flight ends (dock or abort). Desktop is unaffected
      // (never arms → detectTradeFleet returns undefined → no hold).
      //
      // The trade-REWARD transaction arms WITH the flight: the same submit's
      // response carries the atomic reward manifest (WaitingFor claims it,
      // freezes the traded track, seeds the reward holds), and after the dock
      // the reward waves → merged reveal → track reset play as ONE story.
      armColonyTrade(pending.colonyName, this.thisPlayer.color, targets);
      armTradeFleet(pending.colonyName, this.thisPlayer.color);
      this.submitBatch(batch);
    },
    // ── hydro advance (mirrors PlayerHome.submitHydroAdvance; the stage-7
    //    COMPOSED repeat appends the ProjInsp/Viron-parity batch tail) ─────
    submitHydroAdvance(payload: {spend: number, rewardChoice: number | undefined, selectedCard?: CardName, repeat?: ConsoleRepeatPickResult, fromPosition: number, toPosition: number, rewards?: ReadonlyArray<ResourceTransferSpec>, drawStage?: boolean}): void {
      const path = findHydroActionPath(this.playerView.waitingFor);
      if (path === undefined || isHydroMarkerActive()) {
        return; // guard a double-confirm: the marker glide owns the moment
      }
      const responses = hydroAdvanceResponses(optionResponseForPath(path), payload);
      // PREMIUM MARKER ADVANCE: ARM the marker glide (client-side, from→to)
      // FIRST — the confirm modal already closed, the hydro SCREEN STAYS OPEN,
      // and the marker physically moves to the new stop — THEN submit. The
      // WaitingFor `holdingForHydroMarker` gate BLOCKS the commit (delta chips /
      // new position) until the marker LOCKS IN. The plan is reset + the
      // screen kept open by the `hydroMarkerState.active` watcher (never
      // `section='board'` — trading leaves you in colonies, advancing leaves
      // you in hydro). Desktop is unaffected (never arms).
      armHydroMarker(payload.fromPosition, payload.toPosition, this.thisPlayer.color, payload.rewards ?? []);
      // «Гидромоделирование» (draw 4, keep 2): dress the follow-up SelectCard
      // with the card-lift cinematic — once the marker has SETTLED on the new
      // stop (the cell the player is then looking at), the 4 cards rise out of
      // that very cell, open into a fan and travel into the pick modal, which
      // materializes around them.
      if (payload.drawStage === true) {
        armHydroDraw(payload.toPosition);
      }
      this.submitBatch(responses);
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
      const wfRef = this.$refs.waitingFor as {onPlacementCancel?: () => void} | undefined;
      wfRef?.onPlacementCancel?.();
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
      if (!this.taskBelongsToWorkspace) {
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
      this.consoleState.section = 'board';
      closeConsoleLayers();
      this.consoleState.task.deferred = false;
      beginGovScaleClose(payload.param, () => this.submit(payload.response));
    },
    /** B in the host: defer a SERVER task; CANCEL a client payment. */
    onTaskDefer(): void {
      if (this.pendingClientPayment !== undefined) {
        // Nothing committed — back to the sheet the payment came from.
        this.pendingClientPayment = undefined;
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
      this.consoleState.task.deferred = true;
    },
    // ── shell-section tasks (T3 projectCard / T4 colony) ─────────────────
    /** Open (or re-open after un-defer) the section that serves the task. */
    openShellTaskSurface(task: ConsoleTask): void {
      closeConsoleLayers();
      if (task.kind === 'awardFunding') {
        // FREE award funding rides the premium awards MA screen (its own
        // v-if renders it); openSheet treats it as the task surface.
        this.consoleState.section = 'board';
        this.openSheet('awards');
        return;
      }
      if (task.kind === 'colony') {
        this.consoleState.section = 'colonies';
        // Land on the first PICKABLE tile so A is meaningful immediately.
        const pick = this.colonyPick;
        const rail = this.coloniesForRail;
        const first = pick !== undefined ? rail.findIndex((c) => pick.selectable.includes(c.name)) : -1;
        this.consoleState.colonyIndex = first !== -1 ? first : 0;
        return;
      }
      if (task.kind === 'handSelect') {
        // MANDATORY pick from hand (discard / reveal / place): open the hand
        // carousel in select mode + land on the first PICKABLE card so A means
        // something at once. Picks/filter are reset by the prompt-change watcher.
        this.consoleState.section = 'hand';
        const selectable = new Set(this.handSelectSelectableNames);
        const idx = this.handEntries.findIndex((e) => selectable.has(e.card.name));
        this.consoleState.handIndex = idx !== -1 ? idx : 0;
        return;
      }
      if (task.kind === 'projectCard') {
        if (task.mode === 'playFromHand') {
          this.consoleState.section = 'hand';
          const firstPlayable = this.handEntries.findIndex((e) => e.playable);
          this.consoleState.handIndex = firstPlayable !== -1 ? firstPlayable : 0;
        } else {
          this.consoleState.section = 'board';
          this.openSheet('standardProjects');
        }
        return;
      }
      if (task.kind === 'corpFirstAction') {
        // The corporation's mandatory FIRST ACTION (the player's first turn):
        // the dedicated confirm modal serves it. Its presence is DERIVED
        // (corpFirstActionOpen), so there is nothing to open here: only the
        // board must be the section underneath it.
        this.consoleState.section = 'board';
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
      const task = taskFor(this.playerView);
      if (task !== undefined && SHELL_SECTION_KINDS.has(task.kind)) {
        this.openShellTaskSurface(task);
      }
      // Host tasks (choice/player/amount/…) auto-mount ConsoleTaskHost once the
      // gate releases — nothing else to open here.
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
      releaseWorkspaceOutcome();
      this.foldWorkspaceAfterResult();
    },
    /**
     * The flow is FINISHED and its result is airborne — fold the WHOLE
     * workspace, atomically (sheet closed + the composer's command contract
     * reset in the same frame — the iteration-16 half-collapse rule). A take
     * never round-trips the server, so no view change will close the sheet
     * for us; without this the workspace sat over the board while the intake
     * aimed at a covered dock («workspace не закрывается» — the receive bug).
     * Idempotent: the buy path reaches it twice (detach + complete).
     */
    foldWorkspaceAfterResult(): void {
      resetConsoleActionComposerUi();
      closeConsoleLayers();
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
      releaseWorkspaceOutcome();
      this.foldWorkspaceAfterResult();
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
          // The prompt exists but the gate is still holding it: it may yet be
          // ours once it opens.
          (this.hostServesPrompt && this.hostTask === undefined);
        if (ours) {
          return;
        }
        // A prompt the workspace does not host (a placement, an OrOptions
        // branch, a resource pick) IS the demonstration that this action's
        // outcome lives elsewhere.
        releaseWorkspaceOutcome();
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
      // A prompt still CLAIMED by the action workspace belongs inside it, so
      // returning means re-opening that workspace — not letting the prompt
      // rise as a standalone band, which would silently turn the collapse into
      // "the flow moved somewhere else". The workspace rebuilds its committed
      // stage from the claim (same card, same variant, no replayed cinematic).
      if (workspaceOutcomeClaimed()) {
        this.openSheet('cardActions');
        return;
      }
      if (this.hostTask === undefined && !this.startSceneServes && this.shellTask !== undefined) {
        this.openShellTaskSurface(this.shellTask);
      }
    },
    onTaskSpacePick(payload: {index: number, spacePrompt: PlayerInputModel}): void {
      this.taskSpacePending = payload;
      this.consoleState.section = 'board';
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
    onTaskHandPick(payload: {index: number, cardPrompt: SelectCardModel, source?: EffectDecisionSource}): void {
      const prompt = payload.cardPrompt;
      const reasons: Record<string, string> = {};
      for (const d of prompt.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason === undefined ? '' :
          (typeof d.disabledReason === 'string' ? translateText(d.disabledReason) : translateMessage(d.disabledReason));
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
    /** «ОК» on the deck-check result: mark seen until the server clears it. */
    onDismissRevealResult(): void {
      const lr = this.playerView.lastReveal;
      if (lr !== undefined) {
        this.dismissedRevealKey = `${lr.action}|${lr.revealed.name}`;
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
      if (this.consoleState.task.deferred) {
        this.consoleState.task.deferred = false;
        if (this.hostTask === undefined && !this.startSceneServes && this.shellTask !== undefined) {
          this.openShellTaskSurface(this.shellTask);
        }
      }
      if (this.placementActive) {
        this.consoleState.section = 'board';
        closeConsoleLayers();
      }
    },
    hydroPickDescription(name: CardName): string {
      try {
        const meta = getCard(name)?.metadata;
        const d = meta?.description;
        if (typeof d === 'string') {
          return d;
        }
        if (d !== undefined && typeof (d as {text?: string}).text === 'string') {
          return (d as {text: string}).text;
        }
      } catch (err) {
        // manifest miss — the name alone still identifies the card
      }
      return '';
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
        // Right-stick does nothing in the fullscreen viewer — the rule-overlay
        // traversal was removed (it overloaded the controls for little value).
        // Swallow it so it can't leak to a surface underneath.
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
    scrollActiveConsole(dy: number): void {
      if (Math.abs(dy) < 0.05) {
        return;
      }
      // The hand SMART GRID owns its own vertical scroll (+ keep-selected-visible
      // reconcile) — but only when it is the active surface (no play-confirm /
      // task / reveal / zoom on top, which would otherwise scroll it blindly).
      if (this.handScrollActive) {
        const hand = this.$refs.handSection as InstanceType<typeof ConsoleHandSection> | undefined;
        hand?.stickScroll(dy);
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
      }, {origin});
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
    /** LT/RT: cycle the hand tag filter; R3: reset it to "All". Both preserve
     *  the selected card when it survives the new filter, else focus the first
     *  card of the filtered set (never a lost / dangling selection). */
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
     * objects in the player's hand, they never blink): measure the OLD slot
     * rects + the dock homes BEFORE the change, apply it (entries recompute
     * synchronously — the director's state writes ride the SAME patch flush,
     * so nothing flashes), then hand the episode to `runHandFilterEpisode`:
     * leavers gather into the dock, enterers fan out of it, survivors glide
     * to their re-planned slots. Rapid re-filtering stays responsive: a
     * still-running episode is SNAPPED to its end state first (never queued).
     * Falls back to the plain instant switch outside the browsable open hand
     * (sale/select never reach here; staged-card / reduced-motion / unmounted
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
      const dock = this.$refs.handDock as InstanceType<typeof ConsoleHandDock> | undefined;
      // During a CLIENT hand pick the staged (being-played) card is EXCLUDED
      // from the entries, so the episode is safe to run under it — that's how
      // the pick's «suitable only» toggle gets the same physical transition
      // as the tag filter.
      const canAnimate = this.consoleState.section === 'hand' &&
        handRevealState.phase === 'open' && !isHandRevealEpisodeRunning() &&
        (this.stagedHandCard === undefined || this.handPickActive) &&
        section !== undefined && dock !== undefined;
      if (!canAnimate) {
        apply();
        this.refocusAfterFilter(selectedName);
        return;
      }
      const before = section.transitionTargets();
      apply();
      this.refocusAfterFilter(selectedName);
      const newNames = this.handEntries.map((e) => e.card.name);
      const involved = new Set<string>([...before.pairs.map((p) => p.name), ...newNames]);
      const dockRects = dock.sourceRects([...involved]);
      void runHandFilterEpisode({
        before: before.pairs.map((p) => ({name: p.name, rect: p.rect, visible: p.visible, clip: p.clip})),
        dock: dockRects,
        newNames,
        measureAfter: () => {
          // Seat the grid scroll on the refocused card FIRST (sync layout),
          // so the measured targets are the settled post-filter geometry.
          section.ensureSelectedVisible();
          return section.transitionTargets().pairs.map((p) => ({name: p.name, rect: p.rect, visible: p.visible, clip: p.clip}));
        },
        visualFor: (name) => this.revealVisualFor(name),
      });
    },
    /**
     * The card's LANDED grid presentation (dim + compact blocker chip),
     * carried by the reveal/filter proxies so the settled state is readable
     * DURING the flight and can never pop at the handoff. Mirrors the
     * section's slot classes exactly: browse → unplayable dim + the
     * `shortBlockerLabel` chip; select/pick → the strong select-disabled dim
     * + «Unavailable»; sale shows the whole hand undimmed.
     */
    revealVisualFor(name: CardName): RevealVisual | undefined {
      if (this.consoleState.sale.active) {
        return undefined;
      }
      if (this.handSelectUiActive) {
        return this.handSelectSelectableNames.includes(name) ?
          undefined :
          {dim: 'strong', chip: 'Unavailable'};
      }
      const entry = this.handEntriesAll.find((e) => e.card.name === name);
      if (entry === undefined || entry.playable) {
        return undefined;
      }
      return {dim: 'soft', chip: shortBlockerLabel(entry.card.unplayableReasons ?? [])};
    },
    refocusAfterFilter(selectedName: CardName | undefined): void {
      const list = this.handEntries; // recomputed for the new filter
      const at = selectedName !== undefined ? list.findIndex((e) => e.card.name === selectedName) : -1;
      this.consoleState.handIndex = at >= 0 ? at : 0;
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
      openConsoleCardZoom([{name}], 0);
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
        closeConsoleLayers();
        this.consoleState.section = 'board';
      }
      this.submit(cardsResponse(cards as ReadonlyArray<CardName>));
    },
    /** The discard cinematic's hand-off: the hand section closes (the surviving
     *  cards fly home to the dock) while the condemned ones keep flying on the
     *  app-level stage. Driven by the scene's phase, never by a timer. */
    closeSurfaceForDiscard(): void {
      closeConsoleLayers();
      this.consoleState.select.selected = [];
      this.consoleState.select.suitableOnly = true;
      this.consoleState.section = 'board';
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
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
    },
    submitBatch(responses: ReadonlyArray<unknown>): void {
      const wfRef = this.$refs.waitingFor as {onsaveBatch?: (out: ReadonlyArray<unknown>) => void} | undefined;
      wfRef?.onsaveBatch?.(responses);
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
    // Phase D of the discard cinematic reuses the ORDINARY hand-close episode;
    // the transaction awaits this instead of the shell watching a phase.
    registerDiscardOverlayHandoff((discarded) => this.handOffHandForDiscard(discarded));
    this.offIntent = registerConsoleIntentHandler((intent) => this.handleIntent(intent));
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
      setSection: (s) => {
        this.consoleState.section = s;
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
    this.offPlanetFocusParams?.();
    resetPlanetFocus(); // never carry a held HUD / mid-exit phase across games
    resetHandReveal(); // never leak a mid-episode timeline / held dock
    resetHandDelivery(); // never leak a mid-flight delivery / held dock
    resetConsoleHandPick(); // never leak a client pick across games/sessions
    // A descent can never outlive the shell: an orphaned claim suppresses the
    // standalone band, so the next play would be presented NOWHERE.
    resetWorkspaceStage();
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
    abortHydroDraw(); // drop any in-flight «Гидромоделирование» draw scene (zombie-safe)
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
