# python cluster.py <graph.json> — assign the shell's members to DOMAINS: seeds by name, then affinity (who a member
# uses / is used by). Prints each domain's size and writes domains.json {domain: [members]}.
import json, os, re, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
g = json.load(open(sys.argv[1], encoding='utf8'))
M = g['members']

# Order matters: first match wins. (name regex → domain)
SEEDS = [
    ('supervisor', r'^(livenessRungStops|lastLivenessAccepting|stuckWorkspaceIsGhost|forceRecoverStuckWorkspace|reapStaleFreeTurnFrame|reapDeadPhaseFrames|checkLiveness|backOwedOnStandingFrame|judgedTransientBeat|reopenStartStep|reopenOrphanQuestion|runStartDirectorCure|runScreenDirectorCure|shellWaitNodes|registerLivenessRungs|deadLiveFramePasses|beatStallTimer|commitFoldOwedSince|staleFreeTurnKey|startSupervisor|stopSupervisor|declareScreenControlDefect)$'),
    ('padRouter', r'^(handleIntent|handleSectionIntent|handleSectionNav|handleSectionConfirm|handleSectionBack|handleSheetIntent|handleInfoIntent|cycleInspectedPlayer|onAuxCellPressed|feedWheelArm|activateQuickSlot|executeRtEntry|executeLtEntry|scrollActiveConsole|scrollReviewFeed|notifTapReplay|offIntent)$'),
    ('commandBar', r'^(commands|commandContext|sheetTitle|sheetRows|bannerText|dockArmedEffects|activeTaskSummary|contextMode|contextOverlayMode)$'),
    ('seat', r'^(game|thisPlayer|myTurn|awaitingInput|viewerPassed|postGame|postGameInspection|actionBlockedReason|viewerAskedNothing|viewerAskedOffTurn|viewerForcedReaction|viewerHandNames|inspectedPlayer|botExtrasCtx|questionTableKey|parliamentSeatName|whenViewerAskedNothingChanges|whenViewerAskedOffTurnChanges|whenQuestionTableKeyChanges)$'),
    ('hydro', r'[hH]ydro|[eE]spionage|[bB]lockade|cardDeltaEntry|onCardActionsDeltaStep|trackMoveFlow|deltaRewardPickOut'),
    ('parliament', r'[pP]arliament|sitting|Sitting|stagedVote|StagedVote|political|partyDiscard|PartyDiscard|lawStep|lawPlay|LawPlay|lawLive|LawLive|ledger|Ledger|govSupport|GovSupport|govScale'),
    ('colony', r'[cC]olon(y|ies)|[tT]rade|[fF]leet|settlement|Settlement|armedColony'),
    ('start', r'^start[A-Z]|[sS]tartHosted|StartWalk|StartExcursion|setupHandPending|StartDirector|StartStep'),
    ('placement', r'[pP]lacement|finalGreenery|FinalGreenery|planetFocus|boardStory|BoardStory|remoteLanding|boardSpaceIds|scaleStory|scaleBonus|plantConversion|plantExchange|ConvertPlants|taskSpace|TaskSpace|nomadMove|tilePlacement|boardInPlainView|boardPeek|boardBeats|drainBoardBeats|BoardBonus|trackInfo|trackScaleOverview|selectedCell|inspectCellSource|inspectedCellSourceCard'),
    ('mandatory', r'^mandatory|[dD]efer(red)?[A-Z]|^defer|MandatoryAnnounce|yieldAnnounceInCycle|minimizableTaskLive|boardHomeIdle|promptServedWhereIStand|promptOwnedByClaim|promptServedByStandingFrame|sittingInvitationFields|taskGateHeld'),
    ('stdProjects', r'[sS]td(p|Project)|StandardProject|standardProjects|activateStdItem|stdBackLabel|salePatent|confirmSale|toggleSalePick|toggleSelectAllSale|saleSellable|saleAllSelected|patentSale'),
    ('finale', r'^finale|^endgame|[eE]ndgame|^postGame|terraformedScene'),
    ('draft', r'^draft|Draft'),
    ('played', r'^played|Played|corpFirstAction|CorpFirstAction'),
    ('reveal', r'[rR]eveal|exitBarrier|ExitBarrier|externalDraw|ExternalDraw|deckPick|DeckPick|flowDeckState|DrawnComplete|drawn'),
    ('outcome', r'[oO]utcome|[cC]onclu|owedConclusion|commitFold|commitHolding|CommitRewardWave|pendingCommitDismiss|foldWorkspaceAfterResult|WorkspaceResultDetached|frameServesLiveQuestion|frameAnchorIsDead|openHeldFrameQuestionDoor|questionDoor|followUpStep|hostedStep|HostedStep|liveGrantStep|LiveGrantStep'),
    ('router', r'[aA]dmission|admits|hostTask|shellTask|ShellTask|nativeCompositeTask|activeConsoleTask|promptPresence|promptAnswerInFlight|answerPlaysInPlace|hostServesPrompt|promptServedNatively|compositeServesPrompt|compositeSurfaceActive|taskHostRendered|standalonePromptSurfaceStands|^task[A-Z]|onTask|lastTaskKey|series|Series|venusBonus|VenusBonus|spendHeatActive|aresGlobalsActive|productionLossActive|botAttack|botCardContext|clientPickSceneLive|effectDecision|EffectDecision|playEffectOwed'),
    ('staged', r'[sS]taged'),
    ('handSelect', r'[hH]andSelect|[pP]ick[A-Z]|^pick|toggleSuitableOnly|toggleSelectAllTask|taskAllSelected|[dD]iscard|contextualSource|ContextualSource|[fF]ilter|closeSurfaceForDiscard|firstPickFocusIndex|focusFirstSelectableHandCard'),
    ('playCard', r'playCard|PlayCard|playAction|playPick|playEmbed|playHeld|playComposer|PlayComposer|departing|Departing|pendingClient|confirm[A-Z]|^confirm|acceptConfirm|passReading|passLeftBehind|passFacts|submitInnerOption|handEffectStageOn|focusedPlayableHandCard|FocusedPlayableHandCard'),
    ('cardActions', r'cardActions|CardActions|actionsAvailable|repeatPick|RepeatPick'),
    ('hand', r'^hand|Hand[A-Z]|[dD]ock[A-Z]|^dock|handSelect|[pP]ick[A-Z]|^pick|[dD]iscard|playCard|PlayCard|playAction|playPick|playEmbed|playHeld|playComposer|PlayComposer|departing|returningPlayCard|pendingPlayCard|pendingClient|cardsPlayable|cardsTotal|cardArrival|cardStageExit|[fF]ilter|contextualSource|ContextualSource|footer|sceneOverHand|sceneHandedOver|cardActions|CardActions|actionsAvailable|consoleCardActionsUi|repeatPick|RepeatPick|acceptConfirm|confirmOptionOf|confirm[A-Z]|passReading|passLeftBehind|passFacts|submitInnerOption'),
    ('workspace', r'[wW]orkspace|collapse|Collapse|wsPresence|enterOrRestore|openSheet|seedSheetCursor|activateSheetRow|conRootClasses|conMainClasses|strategyRail'),
]
SEEDS = [(d, re.compile(rx)) for d, rx in SEEDS]

assign = {}
STAY = {'whenPlayerViewChanges', 'submit', 'submitBatch', 'shellPortsConform'}
import os
FIXED = ['viewer', 'ma', 'info', 'notice', 'wheel', 'cell', 'convert', 'rail', 'journal', 'surface']
for d in FIXED:
    spec = json.load(open(os.path.join(HERE, 'specs', '%s.json' % d), encoding='utf8'))
    for name in spec['members']:
        if name in M:
            assign[name] = d
for name in M:
    if name in assign or name in STAY:
        continue
    for d, rx in SEEDS:
        if rx.search(name):
            assign[name] = d
            break

# affinity for the rest: neighbours (uses + used-by) vote; iterate to a fixed point
used_by = collections.defaultdict(set)
for a, v in M.items():
    for b in v['uses']:
        used_by[b].add(a)
for _ in range(6):
    moved = 0
    for name in M:
        if name in assign or name in STAY:
            continue
        votes = collections.Counter()
        for n in list(M[name]['uses']) + list(used_by[name]):
            if n in assign:
                votes[assign[n]] += 1
        if votes:
            top, c = votes.most_common(1)[0]
            if c >= 2 or len(votes) == 1:
                assign[name] = top
                moved += 1
    if moved == 0:
        break

dom = collections.defaultdict(list)
for name in M:
    dom[assign.get(name, 'core')].append(name)
json.dump(dom, open(os.path.join(HERE, 'domains.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
tot = 0
for d, names in sorted(dom.items(), key=lambda kv: -sum(M[n]['lines'] for n in kv[1])):
    lines = sum(M[n]['lines'] for n in names)
    tot += lines
    # coupling: uses that leave the domain
    out = collections.Counter()
    for n in names:
        for u in M[n]['uses']:
            if assign.get(u, 'core') != d:
                out[assign.get(u, 'core')] += 1
    print(f"{d:12} {len(names):4} members {lines:6} lines  -> " + ' '.join(f"{k}:{v}" for k, v in out.most_common(8)))
print('total lines', tot)
if len(sys.argv) > 2:
    print(' '.join(dom[sys.argv[2]]))
