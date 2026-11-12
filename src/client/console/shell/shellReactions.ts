/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SHELL'S REACTIONS — the ordered table (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §5 · S-last).
 *
 * What was the `watch` block of `ConsoleShell.vue`: one row per reaction of the game screen, each a `watch` of ONE
 * member of the shell that only DELEGATES to the reaction's body in its domain's controller (`when<Key>Changes`).
 * The table is installed at the END of the shell's composition — after every controller's own watchers, before the
 * shell's wiring hooks — which is exactly where the Options `watch` block was created.
 *
 * THE ORDER OF THE ROWS IS LOAD-BEARING. They are watchers of ONE component (the game screen): the scheduler runs
 * them in the order their sources were triggered, and rows of the SAME source in creation order
 * (`tests/client/console/vueTickOrder.spec.ts`). Never reorder a row; never put a body here; a new reaction is a
 * level-triggered decision in its controller — or, when it must act among these (a decision that closes a workspace
 * or opens a door — `.claude/rules/console-flow.md` § A decision that ACTS has a place in the tick), a row at the
 * place it belongs, with its reason. The size of the table is guarded (`tests/console/shellControllers.spec.ts`).
 *
 * A row reads the shell through the same late-bound port the controllers use (`shellPort.ts`): a member's ref is read
 * through, a prop is the live prop, a mirror is the module state itself.
 */
import {watch} from 'vue';
import type {Shell} from '@/client/console/shell/shellMembers';

export function installShellReactions(shell: Shell): void {
  watch(() => shell.handAlbumPickerKey, () => shell.whenHandAlbumPickerKeyChanges());
  watch(() => shell.viewerAskedNothing, (none) => shell.whenViewerAskedNothingChanges(none));
  watch(() => shell.viewerAskedOffTurn, (offTurn) => shell.whenViewerAskedOffTurnChanges(offTurn));
  watch(() => shell.revealEmbedTarget, (target) => shell.whenRevealEmbedTargetChanges(target));
  watch(() => shell.promptPresenceEntries, (entries) => shell.whenPromptPresenceEntriesChanges(entries));
  watch(() => shell.promptPresenceIdentity, () => shell.whenPromptPresenceIdentityChanges());
  watch(() => shell.promptAnswerInFlight, (inProgress) => shell.whenPromptAnswerInFlightChanges(inProgress));
  watch(() => shell.clientPickSceneLive, (live) => shell.whenClientPickSceneLiveChanges(live));
  watch(() => shell.cardDeltaEntryFrameLive, (live) => shell.whenCardDeltaEntryFrameLiveChanges(live), {immediate: true});
  watch(() => shell.maCurrentBeat, () => shell.whenMaCurrentBeatChanges());
  watch(() => shell.playerView.game.gameAge, () => shell.whenPlayerViewGameGameAgeChanges());
  watch(() => shell.playerView.game.undoCount, () => shell.whenPlayerViewGameUndoCountChanges());
  watch(() => shell.awardFundingActive, (next) => shell.whenAwardFundingActiveChanges(next));
  watch(() => shell.commitHolding, (now, was) => shell.whenCommitHoldingChanges(now, was));
  watch(() => shell.topNotification, (next, prev) => shell.whenTopNotificationChanges(next, prev));
  watch(() => shell.consoleState.quick, () => shell.whenConsoleStateQuickChanges());
  watch(() => shell.wheelControl.mode, () => shell.whenWheelControlModeChanges());
  watch(() => shell.parliamentBillStanding, (on) => shell.whenParliamentBillStandingChanges(on), {immediate: true});
  watch(() => shell.consoleState.task.deferred, (deferred) => shell.whenConsoleStateTaskDeferredChanges(deferred));
  watch(() => shell.taskSpacePending, (pending) => shell.whenTaskSpacePendingChanges(pending));
  watch(() => shell.tradePayoutIncoming, (incoming) => shell.whenTradePayoutIncomingChanges(incoming));
  watch(() => shell.colonyPayoutIncoming, (incoming) => shell.whenColonyPayoutIncomingChanges(incoming));
  // IMMEDIATE: a decision already standing at mount (a reload into a
  // pending batch with a restored stack) has no change edge left to fire
  // on — unapplied, the presentation hold above it would stand forever.
  watch(() => shell.outcomeAdoptionDecision, (decision) => shell.whenOutcomeAdoptionDecisionChanges(decision), {immediate: true, flush: 'post'});
  watch(() => shell.exitBarrierHeldBatch, (id) => shell.whenExitBarrierHeldBatchChanges(id));
  watch(() => shell.colonySequenceKey, () => shell.whenColonySequenceKeyChanges(), {immediate: true});
  watch(() => shell.bonusSequence.awaiting, (awaiting) => shell.whenBonusSequenceAwaitingChanges(awaiting));
  watch(() => shell.colonyResolutionEvidence, (live) => shell.whenColonyResolutionEvidenceChanges(live), {immediate: true});
  watch(() => shell.colonyEntryAwaiting, (awaiting) => shell.whenColonyEntryAwaitingChanges(awaiting), {immediate: true});
  watch(() => shell.settlementMarkerKey, () => shell.whenSettlementMarkerKeyChanges(), {immediate: true, flush: 'pre'});
  watch(() => shell.questionTableKey, () => shell.whenQuestionTableKeyChanges(), {immediate: true, flush: 'pre'});
  watch(() => shell.colonyDiscardStageStranded, (stranded) => shell.whenColonyDiscardStageStrandedChanges(stranded));
  watch(() => shell.colonyResolutionLive, (live, was) => shell.whenColonyResolutionLiveChanges(live, was));
  watch(() => shell.workspaceOutcomeServingNow, (serving) => shell.whenWorkspaceOutcomeServingNowChanges(serving));
  // THE OWED CONCLUSIONS' FACTS — the row `owedConclusionSignal` stood in, and a watcher OF THE SHELL on purpose: the
  // facts of a conclusion move in two steps inside one tick (an owed step's door falls, a reaction of the shell then
  // pushes the step's frame), and an ending asked between the two — or after the render — is wrong
  // (`workspaceConclusionOwe.ts` says how both were found). Do not turn it into a free watcher.
  watch(() => shell.owedConclusionFacts, () => shell.whenOwedConclusionFactsChanges());
  watch(() => shell.boardBeatsWatchable, (watchable) => shell.whenBoardBeatsWatchableChanges(watchable));
  watch(() => shell.colonyBonusAutoCollect, (key) => shell.whenColonyBonusAutoCollectChanges(key));
  watch(() => shell.colonyTradeState.glideNonce, () => shell.whenColonyTradeStateGlideNonceChanges());
  watch(() => shell.colonyPromptOpenable, (on) => shell.whenColonyPromptOpenableChanges(on));
  watch(() => shell.colonyTrackRaiseKey, (key) => shell.whenColonyTrackRaiseKeyChanges(key));
  watch(() => shell.colonyFollowUpLive, (live, was) => shell.whenColonyFollowUpLiveChanges(live, was));
  watch(() => shell.colonyPromptStranded, (stranded) => shell.whenColonyPromptStrandedChanges(stranded), {flush: 'post'});
  watch(() => shell.armedColonyTradeTrack, () => shell.whenArmedColonyTradeTrackChanges());
  watch(() => shell.hydroMarkerState.active, (active) => shell.whenHydroMarkerStateActiveChanges(active));
  watch(() => shell.hydroResolutionBusy, (busy) => shell.whenHydroResolutionBusyChanges(busy));
  watch(() => shell.workspaceCollapsed, (collapsed) => shell.whenWorkspaceCollapsedChanges(collapsed));
  watch(() => shell.hydroFrameStands, (stands) => shell.whenHydroFrameStandsChanges(stands));
  watch(() => shell.hydroFlow.commit?.phase, (phase) => shell.whenHydroFlowCommitPhaseChanges(phase));
  watch(() => shell.hydroFollowUpLive, () => shell.whenHydroFollowUpLiveChanges());
  watch(() => shell.hydroFlow.step, () => shell.whenHydroFlowStepChanges());
  watch(() => shell.hydroFlow.repeatBridge, () => shell.whenHydroFlowRepeatBridgeChanges());
  watch(() => shell.repeatPickActive, (active) => shell.whenRepeatPickActiveChanges(active));
  watch(() => shell.repeatPickFrameLive, (live) => shell.whenRepeatPickFrameLiveChanges(live));
  watch(() => shell.hydroRewardFrameLive, (live) => shell.whenHydroRewardFrameLiveChanges(live));
  watch(() => shell.espionageExecutionStanding, (standing, was) => shell.whenEspionageExecutionStandingChanges(standing, was));
  watch(() => shell.hydroViewerTrackPosition, (pos) => shell.whenHydroViewerTrackPositionChanges(pos));
  watch(() => shell.deckPickActive, (active) => shell.whenDeckPickActiveChanges(active));
  watch(() => shell.hydroTraversalResumeReady, (ready) => shell.whenHydroTraversalResumeReadyChanges(ready));
  watch(() => shell.presentedDrawnRevealId, (id) => shell.whenPresentedDrawnRevealIdChanges(id), {immediate: true});
  watch(() => shell.journalHardBlocked, (now) => shell.whenJournalHardBlockedChanges(now));
  watch(() => shell.playedHeroState.phase, (phase) => shell.whenPlayedHeroStatePhaseChanges(phase));
  watch(() => shell.patentSaleState.phase, (phase) => shell.whenPatentSaleStatePhaseChanges(phase));
  watch(() => shell.consoleMandatoryPresenting, (presenting) => shell.whenConsoleMandatoryPresentingChanges(presenting), {immediate: true});
  watch(() => shell.consoleState.sheet, (sheet) => shell.whenConsoleStateSheetChanges(sheet));
  watch(() => shell.consoleState.section, (section) => shell.whenConsoleStateSectionChanges(section));
  watch(() => shell.journalPanelVisible, (visible) => shell.whenJournalPanelVisibleChanges(visible));
  watch(() => shell.ledgerPayoutOrphaned, (orphaned) => shell.whenLedgerPayoutOrphanedChanges(orphaned));
  watch(() => shell.chainPlacementOrderEmbedded, (now) => shell.whenChainPlacementOrderEmbeddedChanges(now));
  watch(() => shell.startDiscardStepDue, (due) => shell.whenStartDiscardStepDueChanges(due));
  watch(() => shell.startPartyStepDue, (due) => shell.whenStartPartyStepDueChanges(due));
  watch(() => shell.startHostedStepDue, (kind) => shell.whenStartHostedStepDueChanges(kind));
  watch(() => shell.startStrandedNow, (now) => shell.whenStartStrandedNowChanges(now));
  watch(() => shell.startShadowSig, (sig) => shell.whenStartShadowSigChanges(sig));
  watch(() => shell.playerView.waitingFor?.promptId, (id) => shell.whenPlayerViewWaitingForPromptIdChanges(id));
  watch(() => shell.ledgerDiscardStepDue, (due) => shell.whenLedgerDiscardStepDueChanges(due));
  watch(() => shell.consoleForegroundBusy, (busy, wasBusy) => shell.whenConsoleForegroundBusyChanges(busy, wasBusy));
  watch(() => shell.corpFirstActionOpen, (open) => shell.whenCorpFirstActionOpenChanges(open));
  watch(() => shell.draftFrameLive, (live) => shell.whenDraftFrameLiveChanges(live), {immediate: true});
  watch(() => shell.offStageDeadAnchorKey, (key) => shell.whenOffStageDeadAnchorKeyChanges(key));
  watch(() => shell.parliamentSittingFrameLive, (live) => shell.whenParliamentSittingFrameLiveChanges(live), {immediate: true});
  watch(() => shell.parliamentEmbedTarget, (target) => shell.whenParliamentEmbedTargetChanges(target));
  watch(() => shell.stagedVoteModel, (vote) => shell.whenStagedVoteModelChanges(vote), {flush: 'sync'});
  watch(() => shell.playedHeroTold, (told) => shell.whenPlayedHeroToldChanges(told));
  watch(() => shell.hostedStepDeclaredCard, (card) => shell.whenHostedStepDeclaredCardChanges(card));
  watch(() => shell.venusBonusEmbedTarget, (target) => shell.whenVenusBonusEmbedTargetChanges(target));
  watch(() => shell.parliamentLeaving, (leaving) => shell.whenParliamentLeavingChanges(leaving));
  watch(() => shell.parliamentShown, (shown, was) => shell.whenParliamentShownChanges(shown, was));
  watch(() => shell.externalDrawFrameLive, (live) => shell.whenExternalDrawFrameLiveChanges(live), {immediate: true});
  watch(() => shell.draftPaymentServeSignal, () => shell.whenDraftPaymentServeSignalChanges(), {immediate: true});
  watch(() => shell.startFrameLive, (live) => shell.whenStartFrameLiveChanges(live), {immediate: true});
  watch(() => shell.endgameFrameLive, (live) => shell.whenEndgameFrameLiveChanges(live), {immediate: true});
  watch(() => shell.playedHeroState.active, (active) => shell.whenPlayedHeroStateActiveChanges(active));
  watch(() => shell.mandatoryGateHeld, (held) => shell.whenMandatoryGateHeldChanges(held), {immediate: true});
  watch(() => shell.deferredWhileOnOwnSurface, (on) => shell.whenDeferredWhileOnOwnSurfaceChanges(on));
  watch(() => shell.mandatoryBeatKey, (key) => shell.whenMandatoryBeatKeyChanges(key), {immediate: true});
  watch(() => shell.mandatoryPresentationReady, (ready) => shell.whenMandatoryPresentationReadyChanges(ready), {immediate: true});
  watch(() => shell.rawAdmissionSignals, (raw) => shell.whenRawAdmissionSignalsChanges(raw), {immediate: true, deep: true});
  watch(() => shell.boardHomeIdle, (idle) => shell.whenBoardHomeIdleChanges(idle), {immediate: true});
  watch(() => shell.placementHeld, (held) => shell.whenPlacementHeldChanges(held), {immediate: true});
  watch(() => shell.consoleCardZoom.card, (card, prev) => shell.whenConsoleCardZoomCardChanges(card, prev));
  watch(() => shell.focusedPlayableHandCard, (name) => shell.whenFocusedPlayableHandCardChanges(name));
  watch(() => shell.colonyRosterLevel, (level) => shell.whenColonyRosterLevelChanges(level));
  watch(() => shell.colonyRailNames, (next, prev) => shell.whenColonyRailNamesChanges(next, prev));
  watch(() => shell.stagedColonyCommitting, (now, was) => shell.whenStagedColonyCommittingChanges(now, was));
  watch(() => shell.stagedVoteCommitting, (now, was) => shell.whenStagedVoteCommittingChanges(now, was));
  watch(() => shell.pendingPlayCard, (now) => shell.whenPendingPlayCardChanges(now));
  watch(() => shell.departingPlayCardGone, (gone) => shell.whenDepartingPlayCardGoneChanges(gone));
  watch(() => shell.cellPreviewKey, () => shell.whenCellPreviewKeyChanges(), {immediate: true});
  watch(() => shell.placementPeekTarget, (peek) => shell.whenPlacementPeekTargetChanges(peek), {immediate: true});
  watch(() => shell.placementTakesBoardForLanding, (now) => shell.whenPlacementTakesBoardForLandingChanges(now));
  watch(() => shell.boardStoryCoverCandidate, (now) => shell.whenBoardStoryCoverCandidateChanges(now));
  watch(() => shell.boardStoryCoverOwed, (owed) => shell.whenBoardStoryCoverOwedChanges(owed));
  watch(() => shell.placementTakesBoardForStory, (now) => shell.whenPlacementTakesBoardForStoryChanges(now));
  watch(() => shell.placementActive, (now) => shell.whenPlacementActiveChanges(now));
  watch(() => shell.placementMoveFrom, (now, before) => shell.whenPlacementMoveFromChanges(now, before));
  watch(() => shell.placementRawSpaceModel, (raw) => shell.whenPlacementRawSpaceModelChanges(raw));
  watch(() => shell.placementWorldVersion, () => shell.whenPlacementWorldVersionChanges());
  watch(() => shell.planetFocusTarget, (now) => shell.whenPlanetFocusTargetChanges(now));
  watch(() => shell.terraformedSceneState.phase, (now) => shell.whenTerraformedSceneStatePhaseChanges(now));
  watch(() => shell.startTask, (now, was) => shell.whenStartTaskChanges(now, was));
  watch(() => shell.startExcursionEngage, (now) => shell.whenStartExcursionEngageChanges(now));
  watch(() => shell.hydroBonusReturnSignal, () => shell.whenHydroBonusReturnSignalChanges());
  watch(() => shell.hydroBonusDoorSignal, () => shell.whenHydroBonusDoorSignalChanges());
  watch(() => shell.espionagePromptDoorSignal, (open) => shell.whenEspionagePromptDoorSignalChanges(open), {immediate: true});
  watch(() => shell.blockadePromptDoorSignal, (open) => shell.whenBlockadePromptDoorSignalChanges(open), {immediate: true});
  watch(() => shell.startExcursionQuietNow, (now) => shell.whenStartExcursionQuietNowChanges(now));
  watch(() => shell.bonusActionLedgerOwed, (owed) => shell.whenBonusActionLedgerOwedChanges(owed));
  watch(() => shell.startSceneServes, (now) => shell.whenStartSceneServesChanges(now));
  watch(() => shell.cardDiscardTransaction.phase, (phase, was) => shell.whenCardDiscardTransactionPhaseChanges(phase, was));
  watch(() => shell.effectDecisionKey, (now, was) => shell.whenEffectDecisionKeyChanges(now, was));
  watch(() => shell.effectDecisionDirectPick, (action) => shell.whenEffectDecisionDirectPickChanges(action));
  watch(() => shell.pickBridgeActive, (now) => shell.whenPickBridgeActiveChanges(now), {immediate: true});
  watch(() => shell.freshPickFocusAt, (at) => shell.whenFreshPickFocusAtChanges(at));
  watch(() => shell.handSelectProps, (v) => shell.whenHandSelectPropsChanges(v));
  watch(() => shell.handPickActive, (now) => shell.whenHandPickActiveChanges(now));
  watch(() => shell.playPickActive, (now) => shell.whenPlayPickActiveChanges(now));
  watch(() => shell.stdpConclusionSignal, () => shell.whenStdpConclusionSignalChanges());
  watch(() => shell.stdProjectCommitState.abortNonce, () => shell.whenStdProjectCommitStateAbortNonceChanges());
  watch(() => shell.workspaceOutcomeAnswerArrived, (arrived) => shell.whenWorkspaceOutcomeAnswerArrivedChanges(arrived));
  watch(() => shell.handCardsBelongToDock, (now, was) => shell.whenHandCardsBelongToDockChanges(now, was));
  watch(() => shell.handOutcomeLive, (live, was) => shell.whenHandOutcomeLiveChanges(live, was));
  watch(() => shell.playComposerReleasable, (releasable) => shell.whenPlayComposerReleasableChanges(releasable), {flush: 'post'});
  watch(() => shell.workspaceOutcomeEmbedded, (embedded, was) => shell.whenWorkspaceOutcomeEmbeddedChanges(embedded, was));
  watch(() => shell.finalGreeneryActive, (on) => shell.whenFinalGreeneryActiveChanges(on), {flush: 'post'});
  watch(() => shell.finaleOverForViewer, (over) => shell.whenFinaleOverForViewerChanges(over));
  watch(() => shell.playerView, (newView, oldView) => shell.whenPlayerViewChanges(newView, oldView), {immediate: true});
}
